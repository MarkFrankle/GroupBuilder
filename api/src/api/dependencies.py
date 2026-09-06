"""Shared FastAPI dependencies."""
from fastapi import Depends, HTTPException

from api.middleware.auth import AuthUser, get_current_user
from api.services.firestore_service import FirestoreService, get_firestore_service


def validate_program_access(
    program_id: str,
    user: AuthUser = Depends(get_current_user),
    firestore_service: FirestoreService = Depends(get_firestore_service),
) -> str:
    """Require that the current user is a member of the specified program.

    Declared as a plain ``def`` on purpose: the membership lookup is synchronous
    blocking Firestore I/O, so FastAPI must run it in the threadpool rather than
    on the event loop.

    Args:
        program_id: Program ID from the request
        user: Current authenticated user
        firestore_service: Firestore service instance (injected)

    Returns:
        The validated program_id, for injection into the route handler

    Raises:
        HTTPException: 403 if the user is not a member of the program
    """
    programs = firestore_service.get_user_programs(user.user_id)
    if not any(p["id"] == program_id for p in programs):
        raise HTTPException(status_code=403, detail="Not a member of this program")
    return program_id
