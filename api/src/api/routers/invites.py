"""Invite acceptance routes."""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from datetime import datetime, timezone
from ..middleware.auth import get_current_user, AuthUser
from ..firebase_admin import get_firestore_client

router = APIRouter(prefix="/api/invites", tags=["invites"])


class InviteDetailsResponse(BaseModel):
    """Invite details for display before acceptance."""

    org_id: str
    org_name: str
    invited_email: str
    expires_at: float  # Unix timestamp
    status: str


class AcceptInviteRequest(BaseModel):
    """Request to accept an invite."""

    token: str


@router.get("/{token}", response_model=InviteDetailsResponse)
async def get_invite_details(token: str):
    """Get invite details by token (public endpoint for pre-auth display).

    Args:
        token: The invite token from the URL

    Returns:
        Invite details including org name and expiration

    Raises:
        HTTPException: 404 if invite not found, 410 if expired/used
    """
    db = get_firestore_client()

    # Search for invite across all organizations using collection group query
    invites_query = db.collection_group("invites").where("token", "==", token).limit(1)
    invite_docs = list(invites_query.stream())

    if not invite_docs:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Invite not found"
        )

    invite_doc = invite_docs[0]
    invite_data = invite_doc.to_dict()

    # Get organization ID from the invite's parent reference
    org_id = invite_doc.reference.parent.parent.id

    # Get organization details
    org_ref = db.collection("organizations").document(org_id)
    org_doc = org_ref.get()

    if not org_doc.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found"
        )

    org_data = org_doc.to_dict()

    # Check if invite is still valid
    if invite_data["status"] != "pending":
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail=f"Invite has already been {invite_data['status']}",
        )

    if invite_data["expires_at"] < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_410_GONE, detail="Invite has expired"
        )

    # Convert Firestore timestamp to Unix timestamp
    expires_at = invite_data["expires_at"]
    expires_at_unix = expires_at.timestamp() if expires_at else 0

    return {
        "org_id": org_id,
        "org_name": org_data["name"],
        "invited_email": invite_data["email"],
        "expires_at": expires_at_unix,
        "status": invite_data["status"],
    }


@router.post("/accept")
async def accept_invite(
    request: AcceptInviteRequest, user: AuthUser = Depends(get_current_user)
):
    """Accept an invite and add user to organization.

    Args:
        request: Contains the invite token
        user: Authenticated user from Firebase token

    Returns:
        Success message with org details

    Raises:
        HTTPException: 404 if invite not found, 403 if wrong email, 410 if expired/used
    """
    db = get_firestore_client()

    # Find invite by token
    invites_query = (
        db.collection_group("invites").where("token", "==", request.token).limit(1)
    )
    invite_docs = list(invites_query.stream())

    if not invite_docs:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Invite not found"
        )

    invite_doc = invite_docs[0]
    invite_data = invite_doc.to_dict()

    # Get organization ID from parent reference
    org_id = invite_doc.reference.parent.parent.id

    # Validate invite status
    if invite_data["status"] != "pending":
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail=f"Invite has already been {invite_data['status']}",
        )

    # Check expiration
    if invite_data["expires_at"] < datetime.now(timezone.utc):
        # Update status to expired
        invite_doc.reference.update({"status": "expired"})
        raise HTTPException(
            status_code=status.HTTP_410_GONE, detail="Invite has expired"
        )

    # Verify user email matches invite email
    if user.email.lower() != invite_data["email"].lower():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"This invite is for {invite_data['email']}, but you are logged in as {user.email}",
        )

    # Get organization
    org_ref = db.collection("organizations").document(org_id)
    org_doc = org_ref.get()

    if not org_doc.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found"
        )

    org_data = org_doc.to_dict()

    # Add user to organization members
    member_ref = org_ref.collection("members").document(user.user_id)
    member_ref.set(
        {
            "user_id": user.user_id,
            "email": user.email,
            "role": "facilitator",
            "joined_at": datetime.now(timezone.utc),
            "invited_by_token": request.token,
        }
    )

    # Update invite status
    invite_doc.reference.update(
        {
            "status": "accepted",
            "accepted_at": datetime.now(timezone.utc),
            "accepted_by_user_id": user.user_id,
        }
    )

    return {
        "success": True,
        "org_id": org_id,
        "org_name": org_data["name"],
        "role": "facilitator",
    }
