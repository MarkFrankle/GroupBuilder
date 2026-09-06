"""Firestore service layer for program access."""
from typing import List, Optional, Dict, Any
from google.cloud.firestore_v1 import Client
from ..firebase_admin import get_firestore_client


class FirestoreService:
    """Service layer for Firestore operations."""

    def __init__(self):
        """Initialize with Firestore client."""
        self.db: Client = get_firestore_client()

    def get_user_programs(self, user_id: str) -> List[Dict[str, Any]]:
        """Get all active programs a user belongs to.

        Args:
            user_id: Firebase user ID

        Returns:
            List of active program documents with id and data
        """
        programs = []

        # Query all programs
        programs_ref = self.db.collection("organizations")
        program_docs = programs_ref.stream()

        for program_doc in program_docs:
            program_data = program_doc.to_dict()

            # Skip inactive programs
            if not program_data.get("active", True):
                continue

            # Check if user is a member of this program
            member_ref = program_doc.reference.collection("members").document(user_id)
            member_doc = member_ref.get()

            if member_doc.exists:
                programs.append({"id": program_doc.id, **program_data})

        # Sort by created_at descending (newest first)
        programs.sort(key=lambda p: p.get("created_at", ""), reverse=True)
        return programs

    def is_active_member(self, user_id: str, program_id: str) -> bool:
        """Check whether a user is a member of an active program.

        Args:
            user_id: Firebase user ID
            program_id: Program ID

        Returns:
            True only if the program exists, is active, and has a membership
            document for this user. An archived program grants nobody access.
        """
        program = self.db.collection("organizations").document(program_id).get()
        if not program.exists:
            return False
        if not (program.to_dict() or {}).get("active", True):
            return False

        member = program.reference.collection("members").document(user_id).get()
        return member.exists


# Singleton instance for dependency injection
_firestore_service: Optional[FirestoreService] = None


def get_firestore_service() -> FirestoreService:
    """FastAPI dependency for FirestoreService.

    Returns a singleton instance to avoid creating new connections per request.
    """
    global _firestore_service
    if _firestore_service is None:
        _firestore_service = FirestoreService()
    return _firestore_service
