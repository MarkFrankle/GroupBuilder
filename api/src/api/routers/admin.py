"""Admin routes for organization management."""
import logging
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, EmailStr

from ..middleware.auth import get_current_user, AuthUser
from ..firebase_admin import get_firestore_client
from ..services.email_service import get_email_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["admin"])

# Simple in-memory rate limiting for org creation
_rate_limit_store: Dict[str, List[datetime]] = {}
RATE_LIMIT_WINDOW = timedelta(minutes=10)
RATE_LIMIT_MAX_REQUESTS = 5


class CreateOrgRequest(BaseModel):
    """Request to create a new organization."""
    name: str
    facilitator_emails: List[EmailStr]


class InviteResult(BaseModel):
    """Result of a single invite attempt."""
    email: str
    invite_link: str
    email_sent: bool
    error: Optional[str] = None


class CreateOrgResponse(BaseModel):
    """Response from organization creation."""
    org_id: str
    invites: List[InviteResult]
    partial_failure: bool = False


class OrganizationResponse(BaseModel):
    """Organization summary."""
    id: str
    name: str
    created_at: datetime
    member_count: int


class PaginatedOrgsResponse(BaseModel):
    """Paginated list of organizations."""
    organizations: List[OrganizationResponse]
    total: int
    limit: int
    offset: int


def check_rate_limit(user_id: str) -> None:
    """Check if user has exceeded rate limit for org creation.
    
    Raises:
        HTTPException: 429 if rate limit exceeded
    """
    now = datetime.now(timezone.utc)
    
    # Clean up old entries
    if user_id in _rate_limit_store:
        _rate_limit_store[user_id] = [
            ts for ts in _rate_limit_store[user_id]
            if now - ts < RATE_LIMIT_WINDOW
        ]
    
    # Check limit
    requests = _rate_limit_store.get(user_id, [])
    if len(requests) >= RATE_LIMIT_MAX_REQUESTS:
        logger.warning(f"Rate limit exceeded for user {user_id}")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded. Maximum {RATE_LIMIT_MAX_REQUESTS} organizations per {int(RATE_LIMIT_WINDOW.total_seconds() / 60)} minutes."
        )
    
    # Record this request
    if user_id not in _rate_limit_store:
        _rate_limit_store[user_id] = []
    _rate_limit_store[user_id].append(now)


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


@router.post("/organizations", response_model=CreateOrgResponse)
async def create_organization(
    request: CreateOrgRequest,
    user: AuthUser = Depends(require_bb_admin)
):
    """Create new organization and send invites.

    Returns:
        Created org ID and invite status with partial failure info
    """
    # Check rate limit
    check_rate_limit(user.user_id)
    
    db = get_firestore_client()
    now = datetime.now(timezone.utc)

    # Create organization document
    org_ref = db.collection("organizations").document()
    org_ref.set({
        "name": request.name,
        "created_at": now,
        "created_by": user.user_id,
    })
    
    logger.info(f"Created organization {org_ref.id} by user {user.user_id}")

    # Create invite records
    invites: List[InviteResult] = []
    email_service = get_email_service()
    has_failure = False
    
    for email in request.facilitator_emails:
        invite_token = secrets.token_urlsafe(32)
        invite_ref = org_ref.collection("invites").document()
        invite_ref.set({
            "email": email,
            "token": invite_token,
            "created_at": now,
            "expires_at": now + timedelta(days=7),
            "status": "pending",
        })

        invite_link = f"{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/invite/{invite_token}"
        
        # Send invite email
        try:
            email_sent = email_service.send_facilitator_invite(
                to_email=email,
                org_name=request.name,
                invite_token=invite_token,
                inviter_email=user.email
            )
            
            if not email_sent:
                has_failure = True
                logger.warning(f"Failed to send invite email to {email} for org {org_ref.id}")
            
            invites.append(InviteResult(
                email=email,
                invite_link=invite_link,
                email_sent=email_sent,
                error=None if email_sent else "Email delivery failed"
            ))
        except Exception as e:
            has_failure = True
            logger.error(f"Exception sending invite to {email}: {e}")
            invites.append(InviteResult(
                email=email,
                invite_link=invite_link,
                email_sent=False,
                error="Failed to send email"
            ))

    return CreateOrgResponse(
        org_id=org_ref.id,
        invites=invites,
        partial_failure=has_failure
    )


@router.get("/organizations", response_model=PaginatedOrgsResponse)
async def list_organizations(
    user: AuthUser = Depends(require_bb_admin),
    limit: int = Query(default=20, ge=1, le=100, description="Max orgs to return"),
    offset: int = Query(default=0, ge=0, description="Number of orgs to skip")
):
    """List all organizations with pagination (admin only)."""
    db = get_firestore_client()

    # Get all orgs (Firestore doesn't support COUNT without reading docs)
    all_org_docs = list(db.collection("organizations").stream())
    total = len(all_org_docs)
    
    # Apply pagination
    paginated_docs = all_org_docs[offset:offset + limit]

    orgs = []
    for org_doc in paginated_docs:
        org_data = org_doc.to_dict()

        # Count members
        members = org_doc.reference.collection("members").stream()
        member_count = sum(1 for _ in members)

        orgs.append(OrganizationResponse(
            id=org_doc.id,
            name=org_data["name"],
            created_at=org_data["created_at"],
            member_count=member_count,
        ))

    return PaginatedOrgsResponse(
        organizations=orgs,
        total=total,
        limit=limit,
        offset=offset
    )


class InviteInfo(BaseModel):
    """Information about a valid invite."""
    org_id: str
    org_name: str
    email: str
    expires_at: datetime


@router.get("/invites/{token}", response_model=InviteInfo)
async def validate_invite(token: str):
    """Validate an invite token and return invite details.
    
    This endpoint is public (no auth required) to allow invite validation
    before the user signs in.
    
    Raises:
        HTTPException: 404 if invite not found or expired
    """
    db = get_firestore_client()
    now = datetime.now(timezone.utc)
    
    # Search for invite across all organizations
    # Note: In production, consider indexing tokens in a separate collection
    orgs = db.collection("organizations").stream()
    
    for org_doc in orgs:
        invites = org_doc.reference.collection("invites").where("token", "==", token).stream()
        
        for invite_doc in invites:
            invite_data = invite_doc.to_dict()
            
            # Check if invite is expired
            expires_at = invite_data.get("expires_at")
            if expires_at and expires_at.replace(tzinfo=timezone.utc) < now:
                logger.info(f"Expired invite token used: {token[:8]}...")
                raise HTTPException(
                    status_code=status.HTTP_410_GONE,
                    detail="This invitation has expired. Please request a new invite."
                )
            
            # Check if already accepted
            if invite_data.get("status") == "accepted":
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="This invitation has already been used."
                )
            
            org_data = org_doc.to_dict()
            return InviteInfo(
                org_id=org_doc.id,
                org_name=org_data["name"],
                email=invite_data["email"],
                expires_at=expires_at
            )
    
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Invalid or expired invitation link."
    )
