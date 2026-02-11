"""Firestore service layer for organization and session access."""
from typing import List, Optional, Dict, Any
from google.cloud.firestore_v1 import Client
from ..firebase_admin import get_firestore_client


class FirestoreService:
    """Service layer for Firestore operations."""

    def __init__(self):
        """Initialize with Firestore client."""
        self.db: Client = get_firestore_client()

    def get_user_organizations(self, user_id: str) -> List[Dict[str, Any]]:
        """Get all organizations a user belongs to.

        Args:
            user_id: Firebase user ID

        Returns:
            List of organization documents with id and data
        """
        orgs = []

        # Query all organizations
        orgs_ref = self.db.collection("organizations")
        org_docs = orgs_ref.stream()

        for org_doc in org_docs:
            # Check if user is a member of this org
            member_ref = org_doc.reference.collection("members").document(user_id)
            member_doc = member_ref.get()

            if member_doc.exists:
                orgs.append({
                    "id": org_doc.id,
                    **org_doc.to_dict()
                })

        return orgs

    def check_user_can_access_session(
        self,
        user_id: str,
        session_id: str
    ) -> bool:
        """Check if user has access to a session.

        Args:
            user_id: Firebase user ID
            session_id: Session UUID

        Returns:
            True if user belongs to session's organization
        """
        # Get all organizations user belongs to
        user_orgs = self.get_user_organizations(user_id)
        user_org_ids = {org["id"] for org in user_orgs}

        if not user_org_ids:
            return False

        # Find which org owns this session
        # Use collection group query to search across all orgs
        sessions_ref = self.db.collection_group("sessions")
        session_query = sessions_ref.where("__name__", "==", session_id).limit(1)
        session_docs = list(session_query.stream())

        if not session_docs:
            return False

        session_doc = session_docs[0]
        # Get org ID from parent reference
        org_id = session_doc.reference.parent.parent.id

        return org_id in user_org_ids

    def get_session_organization_id(self, session_id: str) -> Optional[str]:
        """Get the organization ID that owns a session.

        Args:
            session_id: Session UUID

        Returns:
            Organization ID or None if session not found
        """
        sessions_ref = self.db.collection_group("sessions")
        session_query = sessions_ref.where("__name__", "==", session_id).limit(1)
        session_docs = list(session_query.stream())

        if not session_docs:
            return None

        session_doc = session_docs[0]
        return session_doc.reference.parent.parent.id
