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

    data = storage.get_current_set(PROGRAM)

    assert data["num_tables"] == 2
    assert data["num_sessions"] == 3
    assert len(data["participant_data"]) == 2


def test_creating_a_second_set_moves_the_pointer(storage):
    first = _make_set(storage, filename="old")
    second = _make_set(storage, filename="new")

    assert first != second
    assert storage.get_current_set_id(PROGRAM) == second
    assert storage.get_current_set(PROGRAM)["filename"] == "new"


def test_program_with_no_set_returns_none(storage):
    assert storage.get_current_set(PROGRAM) is None
    assert storage.get_current_set_id(PROGRAM) is None


def test_program_document_that_does_not_exist_returns_none(storage):
    """PROGRAM is pre-created by the client fixture; this covers a brand-new
    program whose document has not been written at all."""
    assert storage.get_current_set_id("program_that_does_not_exist") is None
    assert storage.get_current_set("program_that_does_not_exist") is None


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
