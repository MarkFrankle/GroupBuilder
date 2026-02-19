"""User-related endpoints."""
from fastapi import APIRouter, Depends
from api.middleware.auth import get_current_user, AuthUser
from api.services.firestore_service import get_firestore_service, FirestoreService
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/me/programs")
async def get_my_programs(
    user: AuthUser = Depends(get_current_user),
    firestore_service: FirestoreService = Depends(get_firestore_service),
):
    """Get all programs the current user belongs to.

    Returns:
        List of programs with id, name, and user's role
    """
    logger.info(f"Fetching programs for user: {user.email}")

    programs = firestore_service.get_user_programs(user.user_id)

    logger.info(f"User {user.email} belongs to {len(programs)} program(s)")

    return {"programs": programs, "count": len(programs)}
