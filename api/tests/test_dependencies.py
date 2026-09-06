"""Tests for shared FastAPI dependencies.

``validate_program_access`` is the app's program-level authorization gate. The
route test clients override it wholesale via ``app.dependency_overrides``, so it
is never actually executed there. These tests call it directly, bypassing
FastAPI's dependency injection, to exercise the real allow and deny branches.
"""
import pytest
from fastapi import HTTPException

from api.dependencies import validate_program_access
from api.middleware.auth import AuthUser


class _StubFirestoreService:
    """Minimal stand-in exposing only the method the dependency calls."""

    def __init__(self, programs):
        self._programs = programs

    def get_user_programs(self, user_id):
        return self._programs


def _call(program_id, programs):
    """Invoke the dependency directly, bypassing FastAPI injection."""
    user = AuthUser(user_id="test_user", email="test@example.com", email_verified=True)
    return validate_program_access(
        program_id=program_id,
        user=user,
        firestore_service=_StubFirestoreService(programs),
    )


def test_member_returns_program_id():
    """A member of the requested program gets the program_id back."""
    result = _call("org_a", [{"id": "org_a"}, {"id": "org_b"}])

    assert result == "org_a"


def test_non_member_is_forbidden():
    """A user belonging to other programs is denied the requested one."""
    with pytest.raises(HTTPException) as exc_info:
        _call("org_a", [{"id": "org_b"}])

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == "Not a member of this program"


def test_user_with_no_programs_is_forbidden():
    """A brand-new user with no program memberships is denied."""
    with pytest.raises(HTTPException) as exc_info:
        _call("org_a", [])

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == "Not a member of this program"
