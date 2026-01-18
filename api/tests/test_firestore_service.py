"""Tests for Firestore service layer."""
import pytest
from api.services.firestore_service import FirestoreService


@pytest.fixture
def firestore_service():
    """Create FirestoreService instance for testing."""
    # Note: This will use test Firestore instance if configured
    # For now, just test that the service can be instantiated
    return FirestoreService()


def test_firestore_service_instantiation(firestore_service):
    """Should be able to instantiate FirestoreService."""
    assert firestore_service is not None
    assert hasattr(firestore_service, 'db')
    assert hasattr(firestore_service, 'get_user_organizations')
    assert hasattr(firestore_service, 'check_user_can_access_session')
    assert hasattr(firestore_service, 'get_session_organization_id')
