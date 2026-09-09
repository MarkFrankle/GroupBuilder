"""The stored keep-apart rules: id pairs on the Program document."""

import pytest

from api.services.keep_apart_storage import KeepApartStorage

PROGRAM = "test_org_id"


@pytest.fixture
def storage(client):
    """A storage instance against the mock Firestore the client fixture sets up."""
    return KeepApartStorage()


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
