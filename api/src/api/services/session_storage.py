"""Session storage service using Firestore instead of Redis."""
from typing import Dict, Any, Optional, List
from datetime import datetime
from ..firebase_admin import get_firestore_client


class SessionStorage:
    """Store sessions in Firestore organized by organization."""

    def __init__(self):
        self.db = get_firestore_client()

    def save_session(
        self,
        org_id: str,
        session_id: str,
        user_id: str,
        participant_data: Dict[str, Any],
        filename: str,
        num_tables: int,
        num_sessions: int
    ) -> None:
        """Save session to organization's sessions collection.

        Args:
            org_id: Organization ID
            session_id: Session UUID
            user_id: User who created session
            participant_data: Participant dictionary
            filename: Original filename
            num_tables: Number of tables
            num_sessions: Number of sessions
        """
        session_ref = (
            self.db.collection("organizations")
            .document(org_id)
            .collection("sessions")
            .document(session_id)
        )

        session_ref.set({
            "created_by": user_id,
            "created_at": datetime.utcnow(),
            "filename": filename,
            "num_tables": num_tables,
            "num_sessions": num_sessions,
            "participant_data": participant_data,
        })

    def get_session(
        self,
        session_id: str
    ) -> Optional[Dict[str, Any]]:
        """Get session data by ID (searches across all orgs).

        Args:
            session_id: Session UUID

        Returns:
            Session data or None if not found
        """
        # Use collection group query
        sessions_ref = self.db.collection_group("sessions")
        query = sessions_ref.where("__name__", "==", session_id).limit(1)
        docs = list(query.stream())

        if not docs:
            return None

        return docs[0].to_dict()

    def save_results(
        self,
        org_id: str,
        session_id: str,
        version_id: str,
        assignments: Dict[str, Any],
        metadata: Dict[str, Any]
    ) -> None:
        """Save assignment results.

        Args:
            org_id: Organization ID
            session_id: Session UUID
            version_id: Version identifier
            assignments: Assignment data
            metadata: Result metadata (solve time, etc.)
        """
        result_ref = (
            self.db.collection("organizations")
            .document(org_id)
            .collection("results")
            .document(session_id)
            .collection("versions")
            .document(version_id)
        )

        result_ref.set({
            "created_at": datetime.utcnow(),
            "assignments": assignments,
            "metadata": metadata,
        })

    def get_results(
        self,
        session_id: str,
        version_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Get assignment results.

        Args:
            session_id: Session UUID
            version_id: Specific version or latest if None

        Returns:
            Results data or None if not found
        """
        # Find session's org first
        sessions_ref = self.db.collection_group("sessions")
        query = sessions_ref.where("__name__", "==", session_id).limit(1)
        session_docs = list(query.stream())

        if not session_docs:
            return None

        session_doc = session_docs[0]
        org_id = session_doc.reference.parent.parent.id

        # Get results
        results_ref = (
            self.db.collection("organizations")
            .document(org_id)
            .collection("results")
            .document(session_id)
            .collection("versions")
        )

        if version_id:
            result_doc = results_ref.document(version_id).get()
            if not result_doc.exists:
                return None
            return result_doc.to_dict()
        else:
            # Get latest version
            query = results_ref.order_by("created_at", direction="DESCENDING").limit(1)
            docs = list(query.stream())
            if not docs:
                return None
            return docs[0].to_dict()
