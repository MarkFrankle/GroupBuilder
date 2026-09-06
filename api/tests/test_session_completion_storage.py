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
    def test_no_completed_sessions_by_default(self, storage):
        assert storage.get_completed_sessions(PROGRAM) == []

    def test_mark_complete_persists(self, storage):
        storage.mark_complete(PROGRAM, 2)

        assert storage.get_completed_sessions(PROGRAM) == [2]

    def test_marking_is_idempotent(self, storage):
        storage.mark_complete(PROGRAM, 2)
        storage.mark_complete(PROGRAM, 2)

        assert storage.get_completed_sessions(PROGRAM) == [2]

    def test_completed_sessions_come_back_sorted(self, storage):
        storage.mark_complete(PROGRAM, 3)
        storage.mark_complete(PROGRAM, 1)

        assert storage.get_completed_sessions(PROGRAM) == [1, 3]

    def test_mark_incomplete_removes_one(self, storage):
        storage.mark_complete(PROGRAM, 1)
        storage.mark_complete(PROGRAM, 2)

        storage.mark_incomplete(PROGRAM, 1)

        assert storage.get_completed_sessions(PROGRAM) == [2]

    def test_mark_incomplete_on_an_open_session_is_a_no_op(self, storage):
        storage.mark_incomplete(PROGRAM, 1)

        assert storage.get_completed_sessions(PROGRAM) == []

    def test_is_complete(self, storage):
        storage.mark_complete(PROGRAM, 2)

        assert storage.is_complete(PROGRAM, 2) is True
        assert storage.is_complete(PROGRAM, 1) is False

    def test_completion_survives_a_new_assignment_set(
        self, storage, sample_set_data, add_assignment_set_to_firestore
    ):
        """The decision this item turns on: minting a new set must not clear the past."""
        add_assignment_set_to_firestore(sample_set_data)
        storage.mark_complete(PROGRAM, 1)

        add_assignment_set_to_firestore(sample_set_data)

        assert storage.get_completed_sessions(PROGRAM) == [1]
