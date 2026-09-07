"""Session completion — which meeting nights are finished.

Completion is a fact about a meeting night, not about a generation lineage, so it
lives on the Program document rather than on an assignment set. Item 6's "Save and
rebuild sessions" mints a *new* assignment set; set-scoped completion would vanish
at exactly the moment it is load-bearing, since the forced rebuild is scoped to
incomplete Sessions only.

Completion is contiguous — time is linear, so the completed Sessions are always a
prefix ``1..completed_through``. Storing an integer rather than a list makes a gap
unrepresentable instead of merely refused: an array can express ``[1, 3]``, so a
bug or a hand-edited document eventually produces one and every reader has to cope.
"""
from typing import Optional

from ..firebase_admin import get_firestore_client


class SessionCompletionStorage:
    """Read and write ``completed_through`` on a Program document."""

    def __init__(self):
        self.db = get_firestore_client()

    def _program_ref(self, program_id: str):
        return self.db.collection("organizations").document(program_id)

    def get_completed_through(self, program_id: str) -> int:
        """How many leading Sessions are complete. ``0`` means none."""
        doc = self._program_ref(program_id).get()
        if not doc.exists:
            return 0
        return int((doc.to_dict() or {}).get("completed_through") or 0)

    def is_complete(self, program_id: str, session_number: int) -> bool:
        return session_number <= self.get_completed_through(program_id)

    def mark_complete(self, program_id: str, session_number: int) -> int:
        """Complete through ``session_number``. Returns the new value.

        Never regresses. Ordering is enforced by the router; a stale repeat of an
        earlier mark arriving here must not silently reopen the Sessions above it.
        """
        current = self.get_completed_through(program_id)
        return self._write(program_id, max(current, int(session_number)))

    def mark_incomplete(self, program_id: str, session_number: int) -> int:
        """Reopen ``session_number``. A no-op if it was already open."""
        current = self.get_completed_through(program_id)
        return self._write(program_id, min(current, int(session_number) - 1))

    def _write(self, program_id: str, completed_through: int) -> int:
        value = max(0, completed_through)
        self._program_ref(program_id).set({"completed_through": value}, merge=True)
        return value


# Singleton instance for dependency injection
_session_completion_storage: Optional[SessionCompletionStorage] = None


def get_session_completion_storage() -> SessionCompletionStorage:
    """FastAPI dependency for SessionCompletionStorage."""
    global _session_completion_storage
    if _session_completion_storage is None:
        _session_completion_storage = SessionCompletionStorage()
    return _session_completion_storage
