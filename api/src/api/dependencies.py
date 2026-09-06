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
    denied = HTTPException(status_code=403, detail="Not a member of this program")

    program = (
        firestore_service.db.collection("organizations").document(program_id).get()
    )
    # An archived program authorizes nobody. Checking membership alone would
    # quietly grant access to programs that have been deactivated.
    if not program.exists or not (program.to_dict() or {}).get("active", True):
        raise denied

    member = program.reference.collection("members").document(user.user_id).get()
    if not member.exists:
        raise denied

    return program_id
