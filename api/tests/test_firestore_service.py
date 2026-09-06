"""Tests for Firestore service layer."""
import pytest
from unittest.mock import MagicMock, patch


@pytest.fixture
def mock_firestore_client():
    """Create a mock Firestore client."""
    return MagicMock()


@pytest.fixture
def firestore_service(mock_firestore_client):
    """Create FirestoreService instance with mocked Firestore client."""
    with patch(
        "api.services.firestore_service.get_firestore_client",
        return_value=mock_firestore_client,
    ):
        from api.services.firestore_service import FirestoreService

        return FirestoreService()


def test_firestore_service_instantiation(firestore_service):
    """Should be able to instantiate FirestoreService."""
    assert firestore_service is not None
    assert hasattr(firestore_service, "db")
    assert hasattr(firestore_service, "get_user_programs")


def test_get_user_programs_returns_empty_list_when_no_programs(
    firestore_service, mock_firestore_client
):
    """Should return empty list when user has no programs."""
    # Mock the collection and stream to return empty
    mock_firestore_client.collection.return_value.stream.return_value = []

    result = firestore_service.get_user_programs("test-user-id")

    assert result == []
    mock_firestore_client.collection.assert_called_with("organizations")


@pytest.fixture
def membership_service():
    """FirestoreService backed by the shared mock Firestore client.

    ``conftest`` patches ``get_firestore_client`` process-wide, so this is the
    same fake the routes use. Programs are seeded through it directly.
    """
    import api.firebase_admin
    from api.services.firestore_service import FirestoreService

    db = api.firebase_admin.get_firestore_client()
    db._collections.clear()

    def seed(program_id, active, members):
        program_ref = db.collection("organizations").document(program_id)
        program_ref.set({"name": program_id, "active": active})
        for member in members:
            program_ref.collection("members").document(member).set({"role": "member"})

    return FirestoreService(), seed


def test_is_active_member_true_for_member_of_active_program(membership_service):
    """A member of an active program is authorized."""
    service, seed = membership_service
    seed("org_a", active=True, members=["alice"])

    assert service.is_active_member("alice", "org_a") is True


def test_is_active_member_false_for_non_member(membership_service):
    """Someone else's membership does not authorize this user."""
    service, seed = membership_service
    seed("org_a", active=True, members=["bob"])

    assert service.is_active_member("alice", "org_a") is False


def test_is_active_member_false_for_archived_program(membership_service):
    """Membership in a deactivated program grants nothing."""
    service, seed = membership_service
    seed("org_a", active=False, members=["alice"])

    assert service.is_active_member("alice", "org_a") is False


def test_is_active_member_false_for_missing_program(membership_service):
    """An unknown program id is not authorized."""
    service, seed = membership_service
    seed("org_a", active=True, members=["alice"])

    assert service.is_active_member("alice", "ghost") is False
