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

    The program document holds ``current_assignment_set_id``. Only the set it
    points at is ever served; older sets are unreachable by design.
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
    ) -> str:
        """Mint a new assignment set and point the program at it.

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
            }
        )

        self._program_ref(program_id).set(
            {"current_assignment_set_id": set_id}, merge=True
        )

        return set_id

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
