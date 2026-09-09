"""The stored keep-apart rules: id pairs on the Program document."""

import pytest

from api.services.keep_apart_storage import KeepApartStorage

PROGRAM = "test_org_id"


@pytest.fixture
def storage(client):
    """A storage instance against the mock Firestore the client fixture sets up."""
    return KeepApartStorage()


@pytest.fixture
def sample_set_data():
    """Sample assignment set data (mirrors test_session_completion_storage.py)."""
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
        ],
        "num_tables": 1,
        "num_sessions": 1,
        "filename": "test.xlsx",
    }


def test_a_new_program_has_no_pairs(storage):
    assert storage.get_pairs(PROGRAM) == []


def test_a_pair_is_stored_order_normalised(storage):
    storage.add_pair(PROGRAM, "zeta", "alpha")
    assert storage.get_pairs(PROGRAM) == [("alpha", "zeta")]


def test_adding_the_same_pair_twice_is_idempotent(storage):
    storage.add_pair(PROGRAM, "a", "b")
    storage.add_pair(PROGRAM, "b", "a")
    assert storage.get_pairs(PROGRAM) == [("a", "b")]


def test_a_pair_is_removed_in_either_order(storage):
    storage.add_pair(PROGRAM, "a", "b")
    storage.remove_pair(PROGRAM, "b", "a")
    assert storage.get_pairs(PROGRAM) == []


def test_removing_a_pair_that_was_never_added_is_a_no_op(storage):
    storage.remove_pair(PROGRAM, "a", "b")
    assert storage.get_pairs(PROGRAM) == []


def test_one_person_can_be_in_several_pairs(storage):
    """The whole reason this is a program-level list: the rule is one-to-many."""
    storage.add_pair(PROGRAM, "a", "b")
    storage.add_pair(PROGRAM, "a", "c")
    assert storage.get_pairs(PROGRAM) == [("a", "b"), ("a", "c")]

    storage.remove_pair(PROGRAM, "a", "b")
    assert storage.get_pairs(PROGRAM) == [("a", "c")]


def test_malformed_entries_are_not_rules(storage):
    """Junk in the stored array is dropped on read, never read as a pair."""
    storage._program_ref(PROGRAM).set(
        {"keep_apart": [["a", "b"], "cd", ["x", "y", "z"], ["p", None], None, 7]},
        merge=True,
    )
    assert storage.get_pairs(PROGRAM) == [("a", "b")]


def test_adding_a_pair_does_not_clobber_the_program_document(
    storage, sample_set_data, add_assignment_set_to_firestore
):
    """Keep-apart must merge into the Program doc, not replace it."""
    set_id = add_assignment_set_to_firestore(sample_set_data)

    storage.add_pair(PROGRAM, "a", "b")

    program = storage._program_ref(PROGRAM).get().to_dict()
    assert program["current_assignment_set_id"] == set_id
    assert program["name"] == "Test Organization"
    assert program["active"] is True
