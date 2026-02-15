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
    assert hasattr(firestore_service, "get_user_organizations")
    assert hasattr(firestore_service, "check_user_can_access_session")
    assert hasattr(firestore_service, "get_session_organization_id")


def test_get_user_organizations_returns_empty_list_when_no_orgs(
    firestore_service, mock_firestore_client
):
    """Should return empty list when user has no organizations."""
    # Mock the collection and stream to return empty
    mock_firestore_client.collection.return_value.stream.return_value = []

    result = firestore_service.get_user_organizations("test-user-id")

    assert result == []
    mock_firestore_client.collection.assert_called_with("organizations")
