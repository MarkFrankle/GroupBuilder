"""Shared FastAPI dependencies."""
from fastapi import Depends, HTTPException

from api.middleware.auth import AuthUser, get_current_user
from api.services.firestore_service import FirestoreService, get_firestore_service


async def validate_program_access(
    program_id: str,
    user: AuthUser = Depends(get_current_user),
    firestore_service: FirestoreService = Depends(get_firestore_service),
) -> str:
    """Validate the caller is a member of ``program_id``. Returns program_id."""
    programs = firestore_service.get_user_programs(user.user_id)
    if not any(p["id"] == program_id for p in programs):
        raise HTTPException(status_code=403, detail="Not a member of this program")
    return program_id
