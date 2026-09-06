"""Tests for shared FastAPI dependencies.

``validate_program_access`` is the app's program-level authorization gate. The
route test clients override it wholesale via ``app.dependency_overrides``, so it
is never actually executed there. These tests call it directly, bypassing
FastAPI's dependency injection, to exercise the real allow and deny branches.

The dependency is pure policy — who is denied and with what message. The two
Firestore reads and the archived-program rule behind ``is_active_member`` are
tested in ``test_firestore_service.py``.
"""
import pytest
from fastapi import HTTPException

from api.dependencies import validate_program_access
from api.middleware.auth import AuthUser


class _StubFirestoreService:
    """Minimal stand-in exposing only the method the dependency calls."""

    def __init__(self, memberships):
        self._memberships = memberships
        self.calls = []

    def is_active_member(self, user_id, program_id):
        self.calls.append((user_id, program_id))
        return (user_id, program_id) in self._memberships


def _call(program_id, memberships, user_id="test_user"):
    """Invoke the dependency directly, bypassing FastAPI injection.

    ``memberships`` is the set of (user_id, program_id) pairs that are members
    of an active program.
    """
    user = AuthUser(user_id=user_id, email="test@example.com", email_verified=True)
    return validate_program_access(
        program_id=program_id,
        user=user,
        firestore_service=_StubFirestoreService(memberships),
    )


def test_member_returns_program_id():
    """A member of the requested program gets the program_id back."""
    result = _call("org_a", {("test_user", "org_a"), ("test_user", "org_b")})

    assert result == "org_a"


def test_non_member_is_forbidden():
    """A user belonging to other programs is denied the requested one."""
    with pytest.raises(HTTPException) as exc_info:
        _call("org_a", {("test_user", "org_b")})

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == "Not a member of this program"


def test_user_with_no_programs_is_forbidden():
    """A brand-new user with no program memberships is denied."""
    with pytest.raises(HTTPException) as exc_info:
        _call("org_a", set())

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == "Not a member of this program"


def test_membership_is_checked_for_the_requested_program():
    """The gate asks about the program the request named, not any other."""
    stub = _StubFirestoreService({("test_user", "org_a")})
    user = AuthUser(user_id="test_user", email="t@example.com", email_verified=True)

    validate_program_access(program_id="org_a", user=user, firestore_service=stub)

    assert stub.calls == [("test_user", "org_a")]


def test_denials_are_indistinguishable():
    """Every denial carries the same message, whatever the underlying cause."""
    details = []
    for memberships in (set(), {("test_user", "org_b")}, {("someone_else", "org_a")}):
        with pytest.raises(HTTPException) as exc_info:
            _call("org_a", memberships)
        details.append((exc_info.value.status_code, exc_info.value.detail))

    assert len(set(details)) == 1
