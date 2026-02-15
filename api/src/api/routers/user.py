"""User-related endpoints."""
from fastapi import APIRouter, Depends
from api.middleware.auth import get_current_user, AuthUser
from api.services.firestore_service import get_firestore_service, FirestoreService
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/me/organizations")
async def get_my_organizations(
    user: AuthUser = Depends(get_current_user),
    firestore_service: FirestoreService = Depends(get_firestore_service),
):
    """Get all organizations the current user belongs to.

    Returns:
        List of organizations with id, name, and user's role
    """
    logger.info(f"Fetching organizations for user: {user.email}")

    organizations = firestore_service.get_user_organizations(user.user_id)

    logger.info(f"User {user.email} belongs to {len(organizations)} organization(s)")

    return {"organizations": organizations, "count": len(organizations)}
