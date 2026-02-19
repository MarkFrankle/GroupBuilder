"""Additional admin endpoints for program details."""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from ..middleware.auth import get_current_user, AuthUser
from ..firebase_admin import get_firestore_client
from .admin import require_bb_admin
import secrets
import os
from ..services.email_service import get_email_service

router = APIRouter(prefix="/api/admin", tags=["admin"])


class MemberInfo(BaseModel):
    """Program member details."""

    user_id: str
    email: str
    role: str
    joined_at: float  # Unix timestamp


class InviteInfo(BaseModel):
    """Invite details."""

    id: str
    email: str
    status: str
    created_at: float  # Unix timestamp
    expires_at: float  # Unix timestamp
    accepted_at: Optional[float] = None  # Unix timestamp
    accepted_by_user_id: Optional[str] = None
    removed_at: Optional[float] = None  # Unix timestamp


class ProgramDetailsResponse(BaseModel):
    """Detailed program information."""

    id: str
    name: str
    created_at: float  # Unix timestamp
    created_by: str
    members: List[MemberInfo]
    invites: List[InviteInfo]


@router.get("/programs/{program_id}", response_model=ProgramDetailsResponse)
async def get_program_details(
    program_id: str, user: AuthUser = Depends(require_bb_admin)
):
    """Get detailed program info including members and invites.

    Args:
        program_id: Program ID
        user: Authenticated admin user

    Returns:
        Detailed program information

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

    program_data = program_doc.to_dict()

    # Get members
    members = []
    member_docs = program_ref.collection("members").stream()
    for member_doc in member_docs:
        member_data = member_doc.to_dict()
        joined_at = member_data.get("joined_at")
        joined_at_unix = (
            joined_at.timestamp()
            if joined_at
            else datetime.now(timezone.utc).timestamp()
        )

        members.append(
            {
                "user_id": member_data.get("user_id", ""),
                "email": member_data.get("email", ""),
                "role": member_data.get("role", "member"),
                "joined_at": joined_at_unix,
            }
        )

    # Get invites
    invites = []
    invite_docs = program_ref.collection("invites").stream()
    for invite_doc in invite_docs:
        invite_data = invite_doc.to_dict()

        # Convert Firestore timestamps to Unix timestamps
        created_at = invite_data.get("created_at")
        created_at_unix = (
            created_at.timestamp()
            if created_at
            else datetime.now(timezone.utc).timestamp()
        )

        expires_at = invite_data.get("expires_at")
        expires_at_unix = (
            expires_at.timestamp()
            if expires_at
            else datetime.now(timezone.utc).timestamp()
        )

        accepted_at = invite_data.get("accepted_at")
        accepted_at_unix = accepted_at.timestamp() if accepted_at else None

        removed_at = invite_data.get("removed_at")
        removed_at_unix = removed_at.timestamp() if removed_at else None

        invites.append(
            {
                "id": invite_doc.id,
                "email": invite_data.get("email", ""),
                "status": invite_data.get("status", "unknown"),
                "created_at": created_at_unix,
                "expires_at": expires_at_unix,
                "accepted_at": accepted_at_unix,
                "accepted_by_user_id": invite_data.get("accepted_by_user_id"),
                "removed_at": removed_at_unix,
            }
        )

    # Sort invites by created_at (newest first)
    invites.sort(key=lambda x: x["created_at"], reverse=True)

    # Convert program created_at timestamp
    program_created_at = program_data["created_at"]
    program_created_at_unix = (
        program_created_at.timestamp() if program_created_at else 0
    )

    return {
        "id": program_id,
        "name": program_data["name"],
        "created_at": program_created_at_unix,
        "created_by": program_data.get("created_by", ""),
        "members": members,
        "invites": invites,
    }


class AddInvitesRequest(BaseModel):
    """Request to add invites to an existing program."""

    facilitator_emails: List[str]


@router.post("/programs/{program_id}/invites")
async def add_program_invites(
    program_id: str,
    request: AddInvitesRequest,
    user: AuthUser = Depends(require_bb_admin),
):
    """Add new invites to an existing program.

    Args:
        program_id: Program ID
        request: List of facilitator emails to invite
        user: Authenticated admin user

    Returns:
        List of created invites with links

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

    program_data = program_doc.to_dict()

    # Create invite records
    invites = []
    for email in request.facilitator_emails:
        invite_token = secrets.token_urlsafe(32)
        invite_ref = program_ref.collection("invites").document()
        invite_ref.set(
            {
                "email": email.strip().lower(),
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
            org_name=program_data["name"],
            invite_token=invite_token,
            inviter_email=user.email,
        )

        invites.append(
            {
                "id": invite_ref.id,
                "email": email,
                "invite_link": f"{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/invite/{invite_token}",
                "email_sent": email_sent,
            }
        )

    return {"program_id": program_id, "invites": invites}


@router.delete("/programs/{program_id}/invites/{invite_id}")
async def revoke_invite(
    program_id: str, invite_id: str, user: AuthUser = Depends(require_bb_admin)
):
    """Revoke a pending invite.

    Args:
        program_id: Program ID
        invite_id: Invite document ID
        user: Authenticated admin user

    Returns:
        Success message

    Raises:
        HTTPException: 404 if not found, 400 if not pending
    """
    db = get_firestore_client()

    # Get invite
    invite_ref = (
        db.collection("organizations")
        .document(program_id)
        .collection("invites")
        .document(invite_id)
    )
    invite_doc = invite_ref.get()

    if not invite_doc.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Invite not found"
        )

    invite_data = invite_doc.to_dict()

    # Only allow revoking pending invites
    if invite_data["status"] != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot revoke invite with status: {invite_data['status']}",
        )

    # Update status to revoked
    invite_ref.update(
        {
            "status": "revoked",
            "revoked_at": datetime.now(timezone.utc),
            "revoked_by": user.user_id,
        }
    )

    return {"success": True, "message": "Invite revoked successfully"}


@router.delete("/programs/{program_id}/members/{user_id}")
async def remove_member(
    program_id: str, user_id: str, user: AuthUser = Depends(require_bb_admin)
):
    """Remove a member from a program.

    Args:
        program_id: Program ID
        user_id: User ID to remove
        user: Authenticated admin user

    Returns:
        Success message

    Raises:
        HTTPException: 404 if not found
    """
    db = get_firestore_client()

    # Get member
    member_ref = (
        db.collection("organizations")
        .document(program_id)
        .collection("members")
        .document(user_id)
    )
    member_doc = member_ref.get()

    if not member_doc.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Member not found"
        )

    member_data = member_doc.to_dict()
    member_email = member_data.get("email")

    # Delete member
    member_ref.delete()

    # Update corresponding invite status to "removed" if it exists
    if member_email:
        program_ref = db.collection("organizations").document(program_id)
        invites_query = (
            program_ref.collection("invites")
            .where("email", "==", member_email.lower())
            .where("status", "==", "accepted")
            .limit(1)
        )
        invite_docs = list(invites_query.stream())

        if invite_docs:
            invite_doc = invite_docs[0]
            invite_doc.reference.update(
                {
                    "status": "removed",
                    "removed_at": datetime.now(timezone.utc),
                    "removed_by": user.user_id,
                }
            )

    return {"success": True, "message": "Member removed successfully"}
