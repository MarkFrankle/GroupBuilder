"""Session storage service using Firestore instead of Redis."""
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone
import json
from ..firebase_admin import get_firestore_client


def _serialize_for_firestore(data: Any) -> Any:
    """Convert data to Firestore-compatible types.
    
    This handles numpy types, datetime objects, and other non-standard
    Python types by converting them through JSON serialization.
    
    Args:
        data: Data to serialize
        
    Returns:
        Firestore-compatible data
    """
    return json.loads(json.dumps(data, default=str))


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
            "session_id": session_id,  # Store session_id as a field for collection group queries
            "created_by": user_id,
            "created_at": datetime.now(timezone.utc),
            "filename": filename,
            "num_tables": num_tables,
            "num_sessions": num_sessions,
            "participant_data": _serialize_for_firestore(participant_data),
        })

    def get_session(
        self,
        session_id: str
    ) -> Optional[Dict[str, Any]]:
        """Get session data by ID (searches across all orgs).

        Args:
            session_id: Session UUID

        Returns:
            Session data with org_id included, or None if not found
        """
        # Use collection group query
        sessions_ref = self.db.collection_group("sessions")
        query = sessions_ref.where("session_id", "==", session_id).limit(1)
        docs = list(query.stream())

        if not docs:
            return None

        doc = docs[0]
        session_data = doc.to_dict()
        
        # Extract org_id from document path: organizations/{org_id}/sessions/{session_id}
        org_id = doc.reference.parent.parent.id
        session_data["org_id"] = org_id
        
        return session_data
    
    def session_exists(self, session_id: str) -> bool:
        """Check if a session exists.
        
        Args:
            session_id: Session UUID
            
        Returns:
            True if session exists, False otherwise
        """
        return self.get_session(session_id) is not None

    def save_results(
        self,
        session_id: str,
        version_id: str,
        assignments: Dict[str, Any],
        metadata: Dict[str, Any],
        org_id: Optional[str] = None
    ) -> None:
        """Save assignment results.

        Args:
            session_id: Session UUID
            version_id: Version identifier
            assignments: Assignment data
            metadata: Result metadata (solve time, etc.)
            org_id: Organization ID (optional - will be looked up from session if not provided)
        """
        # Look up org_id from session if not provided
        if org_id is None:
            session_data = self.get_session(session_id)
            if not session_data:
                raise ValueError(f"Session {session_id} not found")
            org_id = session_data["org_id"]
        
        result_ref = (
            self.db.collection("organizations")
            .document(org_id)
            .collection("results")
            .document(session_id)
            .collection("versions")
            .document(version_id)
        )

        result_ref.set({
            "created_at": datetime.now(timezone.utc),
            "assignments": _serialize_for_firestore(assignments),
            "metadata": _serialize_for_firestore(metadata),
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
        query = sessions_ref.where("session_id", "==", session_id).limit(1)
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
    
    def result_exists(self, session_id: str) -> bool:
        """Check if any results exist for a session.
        
        Args:
            session_id: Session UUID
            
        Returns:
            True if results exist, False otherwise
        """
        return self.get_results(session_id) is not None
    
    def get_result_versions(self, session_id: str) -> List[Dict[str, Any]]:
        """Get list of all result versions for a session.
        
        Args:
            session_id: Session UUID
            
        Returns:
            List of version metadata, sorted by creation time (newest first)
        """
        # Find session's org first
        session_data = self.get_session(session_id)
        if not session_data:
            return []
        
        org_id = session_data["org_id"]
        
        # Get all versions
        versions_ref = (
            self.db.collection("organizations")
            .document(org_id)
            .collection("results")
            .document(session_id)
            .collection("versions")
        )
        
        versions = []
        for doc in versions_ref.order_by("created_at", direction="DESCENDING").stream():
            version_data = doc.to_dict()
            created_at = version_data.get("created_at")
            # Convert Firestore timestamp to Unix timestamp (seconds since epoch)
            created_at_unix = created_at.timestamp() if created_at else None
            
            versions.append({
                "version_id": doc.id,
                "created_at": created_at_unix,
                "metadata": version_data.get("metadata", {})
            })
        
        return versions

