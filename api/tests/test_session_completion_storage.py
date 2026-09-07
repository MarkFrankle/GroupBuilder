"""Tests for program-level session completion state."""

import pytest

from api.services.session_completion_storage import SessionCompletionStorage

PROGRAM = "test_org_id"


@pytest.fixture
def sample_set_data():
    """Sample assignment set data (mirrors test_assignments.py)."""
    return {
        "participant_dict": [
            {
                "id": 1,
                "name": "Alice",
                "religion": "Christian",
                "gender": "Female",
                "couple_id": None,
            },
            {
                "id": 2,
                "name": "Bob",
                "religion": "Jewish",
                "gender": "Male",
                "couple_id": None,
            },
            {
                "id": 3,
                "name": "Charlie",
                "religion": "Muslim",
                "gender": "Male",
                "couple_id": None,
            },
            {
                "id": 4,
                "name": "Diana",
                "religion": "Christian",
                "gender": "Female",
                "couple_id": None,
            },
        ],
        "num_tables": 2,
        "num_sessions": 2,
        "filename": "test.xlsx",
    }


@pytest.fixture
def storage(client):
    """A storage instance against the mock Firestore the client fixture sets up."""
    return SessionCompletionStorage()


class TestSessionCompletionStorage:
    def test_nothing_complete_by_default(self, storage):
        assert storage.get_completed_through(PROGRAM) == 0

    def test_mark_complete_persists(self, storage):
        storage.mark_complete(PROGRAM, 1)

        assert storage.get_completed_through(PROGRAM) == 1

    def test_marking_is_idempotent(self, storage):
        storage.mark_complete(PROGRAM, 1)
        storage.mark_complete(PROGRAM, 1)

        assert storage.get_completed_through(PROGRAM) == 1

    def test_marking_an_already_complete_session_does_not_regress(self, storage):
        """Completion only ever moves forward at this layer.

        Ordering is the router's job; storage must not turn a stale repeat of an
        earlier mark into a silent reopen of the sessions above it.
        """
        storage.mark_complete(PROGRAM, 1)
        storage.mark_complete(PROGRAM, 2)

        storage.mark_complete(PROGRAM, 1)

        assert storage.get_completed_through(PROGRAM) == 2

    def test_reopening_the_latest_decrements(self, storage):
        storage.mark_complete(PROGRAM, 1)
        storage.mark_complete(PROGRAM, 2)

        storage.mark_incomplete(PROGRAM, 2)

        assert storage.get_completed_through(PROGRAM) == 1

    def test_reopening_an_open_session_is_a_no_op(self, storage):
        storage.mark_incomplete(PROGRAM, 1)

        assert storage.get_completed_through(PROGRAM) == 0

    def test_is_complete_is_a_prefix_test(self, storage):
        storage.mark_complete(PROGRAM, 1)
        storage.mark_complete(PROGRAM, 2)

        assert storage.is_complete(PROGRAM, 1) is True
        assert storage.is_complete(PROGRAM, 2) is True
        assert storage.is_complete(PROGRAM, 3) is False

    def test_the_completed_prefix_persists_across_a_new_set(
        self, storage, sample_set_data, add_assignment_set_to_firestore
    ):
        """The decision this item turns on: minting a new set must not clear the past.

        Named for what it asserts — the completed prefix survives. The seating
        those Sessions froze does not; see the test below.
        """
        add_assignment_set_to_firestore(sample_set_data)
        storage.mark_complete(PROGRAM, 1)

        add_assignment_set_to_firestore(sample_set_data)

        assert storage.get_completed_through(PROGRAM) == 1

    def test_a_new_set_does_not_carry_the_frozen_seating(
        self,
        storage,
        sample_set_data,
        add_assignment_set_to_firestore,
        add_version_to_firestore,
    ):
        """Why the API refuses rebuilds instead of relying on this layer.

        Only the current set is ever served, and a new set starts with no
        versions, so the seating a completed Session froze becomes unreachable.
        Storage cannot fix that; the routers refuse the rebuild instead
        (see TestGenerateRefusesCompletedSessions in test_roster.py).
        """
        old_set_id = add_assignment_set_to_firestore(sample_set_data)
        add_version_to_firestore(old_set_id, "v1", [{"session": 1, "tables": {}}])
        storage.mark_complete(PROGRAM, 1)

        new_set_id = add_assignment_set_to_firestore(sample_set_data)

        from api.services.assignment_set_storage import AssignmentSetStorage

        set_storage = AssignmentSetStorage()
        assert set_storage.get_current_set_id(PROGRAM) == new_set_id
        assert set_storage.list_versions(PROGRAM, new_set_id) == []
        assert set_storage.list_versions(PROGRAM, old_set_id) != []

    def test_marking_complete_does_not_clobber_the_program_document(
        self, storage, sample_set_data, add_assignment_set_to_firestore
    ):
        """Completion must merge into the Program doc, not replace it."""
        set_id = add_assignment_set_to_firestore(sample_set_data)

        storage.mark_complete(PROGRAM, 1)

        from api.services.assignment_set_storage import AssignmentSetStorage

        program = AssignmentSetStorage()._program_ref(PROGRAM).get().to_dict()
        assert program["current_assignment_set_id"] == set_id
        assert program["name"] == "Test Organization"
        assert program["active"] is True
