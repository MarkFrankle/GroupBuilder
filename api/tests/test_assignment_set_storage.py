"""Tests for AssignmentSetStorage — the generation-lineage store."""
import pytest

from api.services.assignment_set_storage import AssignmentSetStorage


PROGRAM = "test_org_id"


@pytest.fixture
def storage(client):
    """client patches the Firestore client with the in-memory fake."""
    return AssignmentSetStorage()


def _make_set(storage, filename="roster"):
    return storage.create_set(
        program_id=PROGRAM,
        user_id="user_1",
        participant_data=[{"name": "Alice"}, {"name": "Bob"}],
        filename=filename,
        num_tables=2,
        num_sessions=3,
    )


def test_create_set_returns_id_and_points_program_at_it(storage):
    set_id = _make_set(storage)

    assert set_id
    assert storage.get_current_set_id(PROGRAM) == set_id


def test_get_current_set_returns_the_frozen_roster(storage):
    _make_set(storage)

    data = storage.get_set(PROGRAM, storage.get_current_set_id(PROGRAM))

    assert data["num_tables"] == 2
    assert data["num_sessions"] == 3
    assert len(data["participant_data"]) == 2


def test_creating_a_second_set_moves_the_pointer(storage):
    first = _make_set(storage, filename="old")
    second = _make_set(storage, filename="new")

    assert first != second
    assert storage.get_current_set_id(PROGRAM) == second
    assert storage.get_set(PROGRAM, second)["filename"] == "new"


def test_program_with_no_set_returns_none(storage):
    assert storage.get_current_set_id(PROGRAM) is None


def test_program_document_that_does_not_exist_returns_none(storage):
    """PROGRAM is pre-created by the client fixture; this covers a brand-new
    program whose document has not been written at all."""
    assert storage.get_current_set_id("program_that_does_not_exist") is None


def test_save_and_get_version(storage):
    set_id = _make_set(storage)

    storage.save_version(
        program_id=PROGRAM,
        set_id=set_id,
        version_id="v1",
        assignments=[{"session": 1, "tables": {}}],
        metadata={"solve_time": 1.5},
    )

    result = storage.get_version(PROGRAM, set_id, "v1")
    assert result["assignments"][0]["session"] == 1
    assert result["metadata"]["solve_time"] == 1.5


def test_get_version_without_id_returns_latest(storage):
    set_id = _make_set(storage)
    storage.save_version(PROGRAM, set_id, "v1", [{"session": 1}], {"n": 1})
    storage.save_version(PROGRAM, set_id, "v2", [{"session": 1}], {"n": 2})

    latest = storage.get_version(PROGRAM, set_id)

    assert latest["metadata"]["n"] == 2


def test_list_versions_newest_first(storage):
    set_id = _make_set(storage)
    storage.save_version(PROGRAM, set_id, "v1", [], {})
    storage.save_version(PROGRAM, set_id, "v2", [], {})

    versions = storage.list_versions(PROGRAM, set_id)

    assert [v["version_id"] for v in versions] == ["v2", "v1"]


def test_versions_are_scoped_to_their_set(storage):
    first = _make_set(storage)
    storage.save_version(PROGRAM, first, "v1", [], {})
    second = _make_set(storage)

    assert storage.list_versions(PROGRAM, second) == []
    assert storage.get_version(PROGRAM, second) is None


def test_list_recent_sets_returns_current_first_then_previous(storage):
    first = _make_set(storage, filename="old")
    second = _make_set(storage, filename="new")

    sets = storage.list_recent_sets(PROGRAM)

    assert [s["assignment_set_id"] for s in sets] == [second, first]


def test_list_recent_sets_stops_at_the_limit(storage):
    _make_set(storage, filename="oldest")
    middle = _make_set(storage, filename="middle")
    newest = _make_set(storage, filename="newest")

    assert [s["assignment_set_id"] for s in storage.list_recent_sets(PROGRAM)] == [
        newest,
        middle,
    ]
    assert [
        s["assignment_set_id"] for s in storage.list_recent_sets(PROGRAM, limit=1)
    ] == [newest]


def test_list_recent_sets_puts_the_pointer_first_even_if_it_is_not_newest(storage):
    """The program pointer is the authority on 'current', not creation order."""
    older = _make_set(storage, filename="old")
    _make_set(storage, filename="new")
    storage._program_ref(PROGRAM).set({"current_assignment_set_id": older}, merge=True)

    sets = storage.list_recent_sets(PROGRAM)

    assert sets[0]["assignment_set_id"] == older


def test_list_recent_sets_on_a_program_with_no_sets(storage):
    assert storage.list_recent_sets("program_that_does_not_exist") == []


def test_list_recent_sets_when_a_program_has_only_one_set(storage):
    only = _make_set(storage)

    assert [s["assignment_set_id"] for s in storage.list_recent_sets(PROGRAM)] == [only]


def test_list_recent_sets_survives_a_pointer_at_a_missing_set(storage):
    """A dangling pointer degrades to newest-first rather than raising."""
    newest = _make_set(storage)
    storage._program_ref(PROGRAM).set(
        {"current_assignment_set_id": "set_that_was_deleted"}, merge=True
    )

    assert [s["assignment_set_id"] for s in storage.list_recent_sets(PROGRAM)] == [
        newest
    ]


def test_overwrite_version_assignments_replaces_seats_in_place(storage):
    """A rename rewrites the head version without minting a new one."""
    set_id = _make_set(storage)
    storage.save_version(
        program_id=PROGRAM,
        set_id=set_id,
        version_id="v1",
        assignments=[{"session": 1, "tables": {"1": [{"name": "Kathrine"}]}}],
        metadata={"label": "Sessions generated"},
    )
    before = storage.get_version(PROGRAM, set_id, "v1")["created_at"]

    storage.overwrite_version_assignments(
        PROGRAM,
        set_id,
        "v1",
        [{"session": 1, "tables": {"1": [{"name": "Katherine"}]}}],
    )

    version = storage.get_version(PROGRAM, set_id, "v1")
    assert version["assignments"][0]["tables"]["1"][0]["name"] == "Katherine"
    assert version["metadata"]["label"] == "Sessions generated"
    assert version["created_at"] == before
    assert [v["version_id"] for v in storage.list_versions(PROGRAM, set_id)] == ["v1"]


def test_update_participant_data_replaces_the_canonical_roster(storage):
    set_id = _make_set(storage)

    storage.update_participant_data(PROGRAM, set_id, [{"name": "Carol"}])

    data = storage.get_set(PROGRAM, set_id)
    assert [p["name"] for p in data["participant_data"]] == ["Carol"]
    assert data["num_tables"] == 2
    assert data["filename"] == "roster"


class TestProvisionalSets:
    def _pd(self):
        return [{"id": 1, "name": "A", "religion": "X", "gender": "M"}]

    def test_a_set_is_accepted_by_default(self, storage):
        set_id = storage.create_set(
            program_id=PROGRAM,
            user_id="u",
            participant_data=self._pd(),
            filename="roster",
            num_tables=1,
            num_sessions=3,
        )
        assert storage.get_set(PROGRAM, set_id)["accepted"] is True
        assert storage.get_set(PROGRAM, set_id).get("previous_set_id") is None

    def test_a_provisional_set_records_its_predecessor(self, storage):
        first = storage.create_set(
            program_id=PROGRAM,
            user_id="u",
            participant_data=self._pd(),
            filename="roster",
            num_tables=1,
            num_sessions=3,
        )
        second = storage.create_set(
            program_id=PROGRAM,
            user_id="u",
            participant_data=self._pd(),
            filename="roster",
            num_tables=1,
            num_sessions=3,
            accepted=False,
            previous_set_id=first,
        )
        doc = storage.get_set(PROGRAM, second)
        assert doc["accepted"] is False
        assert doc["previous_set_id"] == first
