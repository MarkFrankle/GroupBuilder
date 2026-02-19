"""Firestore service layer for program and session access."""
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

        return programs

    def check_user_can_access_session(self, user_id: str, session_id: str) -> bool:
        """Check if user has access to a session.

        Args:
            user_id: Firebase user ID
            session_id: Session UUID

        Returns:
            True if user belongs to session's program
        """
        # Get all programs user belongs to
        user_programs = self.get_user_programs(user_id)
        user_program_ids = {program["id"] for program in user_programs}

        if not user_program_ids:
            return False

        # Find which program owns this session
        # Use collection group query to search across all programs
        sessions_ref = self.db.collection_group("sessions")
        session_query = sessions_ref.where("session_id", "==", session_id).limit(1)
        session_docs = list(session_query.stream())

        if not session_docs:
            return False

        session_doc = session_docs[0]
        # Get program ID from parent reference
        program_id = session_doc.reference.parent.parent.id

        return program_id in user_program_ids

    def get_session_program_id(self, session_id: str) -> Optional[str]:
        """Get the program ID that owns a session.

        Args:
            session_id: Session UUID

        Returns:
            Program ID or None if session not found
        """
        sessions_ref = self.db.collection_group("sessions")
        session_query = sessions_ref.where("session_id", "==", session_id).limit(1)
        session_docs = list(session_query.stream())

        if not session_docs:
            return None

        session_doc = session_docs[0]
        return session_doc.reference.parent.parent.id


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
