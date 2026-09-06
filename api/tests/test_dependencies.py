"""Tests for shared FastAPI dependencies.

``validate_program_access`` is the app's program-level authorization gate. The
route test clients override it wholesale via ``app.dependency_overrides``, so it
is never actually executed there. These tests call it directly, bypassing
FastAPI's dependency injection, to exercise the real allow and deny branches.

It reads two documents: the program itself (which must exist and be active) and
the caller's membership document beneath it. The stubs below model exactly that
shape.
"""
import pytest
from fastapi import HTTPException

from api.dependencies import validate_program_access
from api.middleware.auth import AuthUser


class _StubDocument:
    def __init__(self, exists, data=None, members=()):
        self.exists = exists
        self._data = data or {}
        self.reference = _StubReference(members)

    def to_dict(self):
        return self._data


class _StubCollection:
    def __init__(self, docs):
        self._docs = docs

    def document(self, doc_id):
        return _StubReference(self._docs.get(doc_id, {}), present=doc_id in self._docs)


class _StubReference:
    """Stands in for both a document reference and a members collection owner."""

    def __init__(self, contents, present=True):
        self._contents = contents
        self._present = present

    def collection(self, name):
        assert name == "members"
        return _StubCollection({m: {} for m in self._contents})

    def get(self):
        return _StubDocument(self._present, self._contents)


class _StubDb:
    def __init__(self, programs):
        self._programs = programs

    def collection(self, name):
        assert name == "organizations"
        return self

    def document(self, program_id):
        self._program_id = program_id
        return self

    def get(self):
        program = self._programs.get(self._program_id)
        if program is None:
            return _StubDocument(exists=False)
        return _StubDocument(
            exists=True,
            data={"active": program["active"]},
            members=program["members"],
        )


class _StubFirestoreService:
    def __init__(self, programs):
        self.db = _StubDb(programs)


def _call(program_id, programs, user_id="test_user"):
    """Invoke the dependency directly, bypassing FastAPI injection.

    ``programs`` maps program_id -> {"active": bool, "members": [user_id, ...]}.
    """
    user = AuthUser(user_id=user_id, email="test@example.com", email_verified=True)
    return validate_program_access(
        program_id=program_id,
        user=user,
        firestore_service=_StubFirestoreService(programs),
    )


def test_member_returns_program_id():
    """A member of the requested program gets the program_id back."""
    result = _call(
        "org_a",
        {
            "org_a": {"active": True, "members": ["test_user"]},
            "org_b": {"active": True, "members": ["test_user"]},
        },
    )

    assert result == "org_a"


def test_non_member_is_forbidden():
    """A user belonging to other programs is denied the requested one."""
    with pytest.raises(HTTPException) as exc_info:
        _call(
            "org_a",
            {
                "org_a": {"active": True, "members": ["someone_else"]},
                "org_b": {"active": True, "members": ["test_user"]},
            },
        )

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == "Not a member of this program"


def test_user_with_no_programs_is_forbidden():
    """A brand-new user with no program memberships is denied."""
    with pytest.raises(HTTPException) as exc_info:
        _call("org_a", {"org_a": {"active": True, "members": []}})

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == "Not a member of this program"


def test_archived_program_is_forbidden():
    """Membership in a deactivated program grants nothing."""
    with pytest.raises(HTTPException) as exc_info:
        _call("org_a", {"org_a": {"active": False, "members": ["test_user"]}})

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == "Not a member of this program"


def test_missing_program_is_forbidden():
    """A program_id that does not exist is denied, not 404'd."""
    with pytest.raises(HTTPException) as exc_info:
        _call("ghost", {"org_a": {"active": True, "members": ["test_user"]}})

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == "Not a member of this program"
