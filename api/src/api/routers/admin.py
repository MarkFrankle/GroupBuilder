"""Admin routes for organization management."""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from typing import List
from datetime import datetime, timedelta
from ..middleware.auth import get_current_user, AuthUser
from ..firebase_admin import get_firestore_client
import secrets
import os
from ..services.email_service import get_email_service

router = APIRouter(prefix="/api/admin", tags=["admin"])


class CreateOrgRequest(BaseModel):
    """Request to create a new organization."""
    name: str
    facilitator_emails: List[EmailStr]


class OrganizationResponse(BaseModel):
    """Organization summary."""
    id: str
    name: str
    created_at: datetime
    member_count: int


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
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )

    return user


@router.post("/organizations", response_model=dict)
async def create_organization(
    request: CreateOrgRequest,
    user: AuthUser = Depends(require_bb_admin)
):
    """Create new organization and send invites.

    Returns:
        Created org ID and invite status
    """
    db = get_firestore_client()

    # Create organization document
    org_ref = db.collection("organizations").document()
    org_ref.set({
        "name": request.name,
        "created_at": datetime.utcnow(),
        "created_by": user.user_id,
    })

    # Create invite records
    invites = []
    for email in request.facilitator_emails:
        invite_token = secrets.token_urlsafe(32)
        invite_ref = org_ref.collection("invites").document()
        invite_ref.set({
            "email": email,
            "token": invite_token,
            "created_at": datetime.utcnow(),
            "expires_at": datetime.utcnow() + timedelta(days=7),
            "status": "pending",
        })

        # Send invite email
        email_service = get_email_service()
        email_sent = email_service.send_facilitator_invite(
            to_email=email,
            org_name=request.name,
            invite_token=invite_token,
            inviter_email=user.email
        )

        invites.append({
            "email": email,
            "invite_link": f"{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/invite/{invite_token}",
            "email_sent": email_sent
        })

    return {
        "org_id": org_ref.id,
        "invites": invites
    }


@router.get("/organizations", response_model=List[OrganizationResponse])
async def list_organizations(
    user: AuthUser = Depends(require_bb_admin)
):
    """List all organizations (admin only)."""
    db = get_firestore_client()

    orgs = []
    org_docs = db.collection("organizations").stream()

    for org_doc in org_docs:
        org_data = org_doc.to_dict()

        # Count members
        members = org_doc.reference.collection("members").stream()
        member_count = sum(1 for _ in members)

        orgs.append({
            "id": org_doc.id,
            "name": org_data["name"],
            "created_at": org_data["created_at"],
            "member_count": member_count,
        })

    return orgs
