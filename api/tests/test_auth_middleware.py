"""Tests for auth middleware."""
import pytest
from fastapi import FastAPI, Depends
from fastapi.testclient import TestClient
from api.middleware.auth import get_current_user, AuthUser


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
