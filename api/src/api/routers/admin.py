"""Admin routes for program management."""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from typing import List
from datetime import datetime, timezone, timedelta
from ..middleware.auth import get_current_user, AuthUser
from ..firebase_admin import get_firestore_client
import secrets
import os
from ..services.email_service import get_email_service

router = APIRouter(prefix="/api/admin", tags=["admin"])


class CreateOrgRequest(BaseModel):
    """Request to create a new program."""

    name: str
    facilitator_emails: List[EmailStr]


class ProgramResponse(BaseModel):
    """Program summary."""

    id: str
    name: str
    created_at: float  # Unix timestamp
    member_count: int
    active: bool = True


async def require_bb_admin(user: AuthUser = Depends(get_current_user)) -> AuthUser:
    """Require that user is a Building Bridges admin.

    Raises:
        HTTPException: 403 if user is not BB admin
    """
    db = get_firestore_client()

    # Check by email (bootstrap script uses email as document ID)
    admin_ref = db.collection("bb_admins").document(user.email)
    admin_doc = admin_ref.get()

    if not admin_doc.exists or not admin_doc.to_dict().get("active", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required"
        )

    return user


@router.post("/programs", response_model=dict)
async def create_program(
    request: CreateOrgRequest, user: AuthUser = Depends(require_bb_admin)
):
    """Create new program and send invites.

    Returns:
        Created program ID and invite status
    """
    db = get_firestore_client()

    # Create program document
    program_ref = db.collection("organizations").document()
    program_ref.set(
        {
            "name": request.name,
            "created_at": datetime.now(timezone.utc),
            "created_by": user.user_id,
            "active": True,
        }
    )

    # Create invite records
    invites = []
    for email in request.facilitator_emails:
        invite_token = secrets.token_urlsafe(32)
        invite_ref = program_ref.collection("invites").document()
        invite_ref.set(
            {
                "email": email,
                "token": invite_token,
                "created_at": datetime.now(timezone.utc),
                "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
                "status": "pending",
            }
        )

        # Send invite email
        email_service = get_email_service()
        email_sent = email_service.send_facilitator_invite(
            to_email=email,
            org_name=request.name,
            invite_token=invite_token,
            inviter_email=user.email,
        )

        invites.append(
            {
                "email": email,
                "invite_link": f"{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/invite/{invite_token}",
                "email_sent": email_sent,
            }
        )

    return {"program_id": program_ref.id, "invites": invites}


@router.get("/programs", response_model=List[ProgramResponse])
async def list_programs(
    show_inactive: bool = False, user: AuthUser = Depends(require_bb_admin)
):
    """List programs (admin only).

    Args:
        show_inactive: If True, include inactive programs
    """
    db = get_firestore_client()

    programs = []
    program_docs = db.collection("organizations").stream()

    for program_doc in program_docs:
        program_data = program_doc.to_dict()

        # Filter inactive programs unless show_inactive is True
        is_active = program_data.get(
            "active", True
        )  # Default to True for legacy programs
        if not show_inactive and not is_active:
            continue

        # Count members
        members = program_doc.reference.collection("members").stream()
        member_count = sum(1 for _ in members)

        # Convert Firestore timestamp to Unix timestamp
        created_at = program_data["created_at"]
        created_at_unix = created_at.timestamp() if created_at else 0

        programs.append(
            {
                "id": program_doc.id,
                "name": program_data["name"],
                "created_at": created_at_unix,
                "member_count": member_count,
                "active": is_active,
            }
        )

    return programs


@router.delete("/programs/{program_id}")
async def delete_program(program_id: str, user: AuthUser = Depends(require_bb_admin)):
    """Soft delete a program by marking it as inactive.

    Args:
        program_id: Program ID
        user: Authenticated admin user

    Returns:
        Success message

    Raises:
        HTTPException: 404 if program not found
    """
    db = get_firestore_client()

    # Get program
    program_ref = db.collection("organizations").document(program_id)
    program_doc = program_ref.get()

    if not program_doc.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Program not found"
        )

    # Soft delete by marking as inactive
    program_ref.update(
        {
            "active": False,
            "deleted_at": datetime.now(timezone.utc),
            "deleted_by": user.user_id,
        }
    )

    return {"success": True, "message": "Program deleted successfully"}
