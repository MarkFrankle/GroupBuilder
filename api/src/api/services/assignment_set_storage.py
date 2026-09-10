"""Assignment set storage — one generation lineage per document, versions nested."""
import json
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from ..firebase_admin import get_firestore_client


def _serialize_for_firestore(data: Any) -> Any:
    """Convert data to Firestore-compatible types.

    The solver returns numpy scalars and datetimes that Firestore rejects;
    a JSON round-trip with ``default=str`` flattens them.
    """
    return json.loads(json.dumps(data, default=str))


class AssignmentSetStorage:
    """Store assignment sets in Firestore, one collection per program.

    organizations/{program_id}/assignment_sets/{set_id}/versions/{version_id}

    The program document holds ``current_assignment_set_id``. That pointer is
    the authority on which set is current; older sets are kept, and
    ``list_recent_sets`` returns the current one followed by the rest,
    newest first.
    """

    def __init__(self):
        self.db = get_firestore_client()

    def _program_ref(self, program_id: str):
        return self.db.collection("organizations").document(program_id)

    def _set_ref(self, program_id: str, set_id: str):
        return (
            self._program_ref(program_id).collection("assignment_sets").document(set_id)
        )

    def create_set(
        self,
        program_id: str,
        user_id: str,
        participant_data: List[Dict[str, Any]],
        filename: str,
        num_tables: int,
        num_sessions: int,
        make_current: bool = True,
        accepted: bool = True,
        previous_set_id: Optional[str] = None,
    ) -> str:
        """Mint a new assignment set, and by default point the program at it.

        Pass ``make_current=False`` to create the set without repointing, then
        call :meth:`set_current_set_id` once its first version is safely
        written. The program pointer is what every read resolves through, so
        moving it before the version exists would publish an empty plan - the
        failure this ordering exists to prevent.

        ``accepted=False`` with ``previous_set_id`` marks a rebuilt set the
        coordinator has not yet confirmed - see Item 6b. Readers treat a missing
        ``accepted`` field as ``True`` (sets written before 6b were never
        provisional).

        Returns the new set id.
        """
        set_id = str(uuid.uuid4())

        self._set_ref(program_id, set_id).set(
            {
                "assignment_set_id": set_id,
                "created_by": user_id,
                "created_at": datetime.now(timezone.utc),
                "filename": filename,
                "num_tables": num_tables,
                "num_sessions": num_sessions,
                "participant_data": _serialize_for_firestore(participant_data),
                "accepted": accepted,
                "previous_set_id": previous_set_id,
            }
        )

        if make_current:
            self.set_current_set_id(program_id, set_id)

        return set_id

    def set_current_set_id(self, program_id: str, set_id: str) -> None:
        """Point the program at one of its assignment sets."""
        self._program_ref(program_id).set(
            {"current_assignment_set_id": set_id}, merge=True
        )

    def accept_set(self, program_id: str, set_id: str) -> None:
        """Confirm a provisional set. Idempotent."""
        self._set_ref(program_id, set_id).set({"accepted": True}, merge=True)

    def revert_to_previous_set(self, program_id: str, set_id: str) -> str:
        """Repoint the program at ``set_id``'s predecessor. Returns that id.

        The abandoned set is left in Firestore, unreachable - consistent with
        every rebuild, which already orphans the prior set. Raises if there is
        no predecessor to fall back to.
        """
        doc = self.get_set(program_id, set_id) or {}
        previous_set_id = doc.get("previous_set_id")
        if not previous_set_id:
            raise ValueError("This set has no previous set to revert to.")
        self.set_current_set_id(program_id, previous_set_id)
        return previous_set_id

    def get_current_set_id(self, program_id: str) -> Optional[str]:
        """Return the program's current assignment set id, or None."""
        doc = self._program_ref(program_id).get()
        if not doc.exists:
            return None
        return (doc.to_dict() or {}).get("current_assignment_set_id")

    def get_set(self, program_id: str, set_id: str) -> Optional[Dict[str, Any]]:
        """Return one assignment set document by id, or None."""
        doc = self._set_ref(program_id, set_id).get()
        return doc.to_dict() if doc.exists else None

    def list_recent_sets(self, program_id: str, limit: int = 2) -> List[Dict[str, Any]]:
        """The program's current set, then the most recent others.

        History reaches back exactly one set, so the default limit is two. The
        program pointer decides which set is current — creation order does not,
        because the pointer is the authority on "current" everywhere else in
        this service. If the pointer names a set that no longer exists, the
        result is simply the newest sets, with no current one to lead it.
        """
        current_id = self.get_current_set_id(program_id)
        if not current_id:
            return []

        by_recency = [
            doc.to_dict()
            for doc in self._program_ref(program_id)
            .collection("assignment_sets")
            .order_by("created_at", direction="DESCENDING")
            .stream()
        ]

        current = [s for s in by_recency if s.get("assignment_set_id") == current_id]
        others = [
            s
            for s in by_recency
            if s.get("assignment_set_id") != current_id
            # An abandoned rebuild - provisional and no longer current - was
            # explicitly undone. It must not surface in any history window.
            and s.get("accepted") is not False
        ]

        return (current + others)[:limit]

    def save_version(
        self,
        program_id: str,
        set_id: str,
        version_id: str,
        assignments: Any,
        metadata: Dict[str, Any],
    ) -> None:
        """Write one version under an assignment set."""
        self._set_ref(program_id, set_id).collection("versions").document(
            version_id
        ).set(
            {
                "created_at": datetime.now(timezone.utc),
                "assignments": _serialize_for_firestore(assignments),
                "metadata": _serialize_for_firestore(metadata),
            }
        )

    def overwrite_version_assignments(
        self,
        program_id: str,
        set_id: str,
        version_id: str,
        assignments: Any,
    ) -> None:
        """Replace one version's seating in place, leaving the rest of it alone.

        Used by the rename path. A rename is not a change to the plan - nobody
        moved - so a new version would be materially identical to its parent.
        ``created_at`` and ``metadata`` are untouched, so history reads the same
        as it did before the spelling was fixed.
        """
        self._set_ref(program_id, set_id).collection("versions").document(
            version_id
        ).set({"assignments": _serialize_for_firestore(assignments)}, merge=True)

    def update_participant_data(
        self,
        program_id: str,
        set_id: str,
        participant_data: List[Dict[str, Any]],
    ) -> None:
        """Replace a set's canonical roster in place."""
        self._set_ref(program_id, set_id).set(
            {"participant_data": _serialize_for_firestore(participant_data)},
            merge=True,
        )

    def get_version(
        self, program_id: str, set_id: str, version_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Return one version, or the newest one when ``version_id`` is None."""
        versions_ref = self._set_ref(program_id, set_id).collection("versions")

        if version_id:
            doc = versions_ref.document(version_id).get()
            return doc.to_dict() if doc.exists else None

        docs = list(
            versions_ref.order_by("created_at", direction="DESCENDING")
            .limit(1)
            .stream()
        )
        return docs[0].to_dict() if docs else None

    def list_versions(self, program_id: str, set_id: str) -> List[Dict[str, Any]]:
        """Version metadata for one set, newest first."""
        versions_ref = self._set_ref(program_id, set_id).collection("versions")

        versions = []
        for doc in versions_ref.order_by("created_at", direction="DESCENDING").stream():
            data = doc.to_dict()
            created_at = data.get("created_at")
            versions.append(
                {
                    "version_id": doc.id,
                    "created_at": created_at.timestamp() if created_at else None,
                    "metadata": data.get("metadata", {}),
                }
            )
        return versions


# Singleton instance for dependency injection
_assignment_set_storage: Optional[AssignmentSetStorage] = None


def get_assignment_set_storage() -> AssignmentSetStorage:
    """FastAPI dependency for AssignmentSetStorage.

    Returns a singleton instance to avoid creating new connections per request.
    """
    global _assignment_set_storage
    if _assignment_set_storage is None:
        _assignment_set_storage = AssignmentSetStorage()
    return _assignment_set_storage
