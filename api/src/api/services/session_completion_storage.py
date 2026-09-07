"""Session completion — which meeting nights are finished.

Completion is a fact about a meeting night, not about a generation lineage, so it
lives on the Program document rather than on an assignment set. Item 6's "Save and
rebuild sessions" mints a *new* assignment set; set-scoped completion would vanish
at exactly the moment it is load-bearing, since the forced rebuild is scoped to
incomplete Sessions only.
"""
from typing import List, Optional

from ..firebase_admin import get_firestore_client


class SessionCompletionStorage:
    """Read and write ``completed_sessions`` on a Program document."""

    def __init__(self):
        self.db = get_firestore_client()

    def _program_ref(self, program_id: str):
        return self.db.collection("organizations").document(program_id)

    def get_completed_sessions(self, program_id: str) -> List[int]:
        """Completed session numbers for a program, ascending. Never None."""
        doc = self._program_ref(program_id).get()
        if not doc.exists:
            return []
        completed = (doc.to_dict() or {}).get("completed_sessions") or []
        return sorted(int(n) for n in completed)

    def is_complete(self, program_id: str, session_number: int) -> bool:
        return session_number in self.get_completed_sessions(program_id)

    def mark_complete(self, program_id: str, session_number: int) -> List[int]:
        """Mark one session complete. Idempotent. Returns the new list."""
        completed = set(self.get_completed_sessions(program_id))
        completed.add(int(session_number))
        return self._write(program_id, completed)

    def mark_incomplete(self, program_id: str, session_number: int) -> List[int]:
        """Reopen one session. A no-op if it was not complete. Returns the new list."""
        completed = set(self.get_completed_sessions(program_id))
        completed.discard(int(session_number))
        return self._write(program_id, completed)

    def _write(self, program_id: str, completed: set) -> List[int]:
        ordered = sorted(completed)
        self._program_ref(program_id).set({"completed_sessions": ordered}, merge=True)
        return ordered


# Singleton instance for dependency injection
_session_completion_storage: Optional[SessionCompletionStorage] = None


def get_session_completion_storage() -> SessionCompletionStorage:
    """FastAPI dependency for SessionCompletionStorage."""
    global _session_completion_storage
    if _session_completion_storage is None:
        _session_completion_storage = SessionCompletionStorage()
    return _session_completion_storage
