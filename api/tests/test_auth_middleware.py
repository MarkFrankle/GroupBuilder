"""Tests for auth middleware."""
import pytest
from fastapi import FastAPI, Depends
from fastapi.testclient import TestClient
from api.middleware.auth import get_current_user, require_session_access, AuthUser


@pytest.fixture
def test_app():
    """Create test FastAPI app."""
    app = FastAPI()

    @app.get("/protected")
    async def protected_route(user: AuthUser = Depends(get_current_user)):
        return {"user_id": user.user_id, "email": user.email}

    return app


def test_missing_authorization_header(test_app):
    """Should return 401 if Authorization header missing."""
    client = TestClient(test_app)
    response = client.get("/protected")

    assert response.status_code == 401
    assert response.json() == {"detail": "Authorization header missing"}


def test_invalid_authorization_format(test_app):
    """Should return 401 if Authorization header not 'Bearer <token>'."""
    client = TestClient(test_app)
    response = client.get(
        "/protected",
        headers={"Authorization": "InvalidFormat"}
    )

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid authorization header format"}


def test_require_session_access_forbidden(monkeypatch):
    """Should return 403 if user doesn't have access to session."""
    # Create test app with session route
    app = FastAPI()

    @app.get("/session/{session_id}")
    async def session_route(
        session_id: str,
        user: AuthUser = Depends(require_session_access)
    ):
        return {"message": "Access granted"}

    # Mock get_current_user to return a user (using dependency override)
    async def mock_get_current_user():
        return AuthUser(
            user_id="user123",
            email="test@example.com",
            email_verified=True
        )

    # Mock FirestoreService to return False for access check
    class MockFirestoreService:
        def check_user_can_access_session(self, user_id, session_id):
            return False

    # Use FastAPI's dependency override instead of monkeypatch
    app.dependency_overrides[get_current_user] = mock_get_current_user

    # Monkeypatch FirestoreService
    monkeypatch.setattr(
        "api.middleware.auth.FirestoreService",
        lambda: MockFirestoreService()
    )

    client = TestClient(app)
    response = client.get("/session/session456")
    assert response.status_code == 403
    assert "Access denied" in response.json()["detail"]
