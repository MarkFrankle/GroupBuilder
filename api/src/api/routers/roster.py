from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from slowapi import Limiter
from slowapi.util import get_remote_address

from api.middleware.auth import get_current_user, AuthUser
from api.services.roster_service import RosterService, get_roster_service
from api.services.firestore_service import FirestoreService, get_firestore_service

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


class ParticipantData(BaseModel):
    name: str
    religion: str
    gender: str
    partner_id: Optional[str] = None


async def _get_org_id(
    user: AuthUser = Depends(get_current_user),
    firestore_service: FirestoreService = Depends(get_firestore_service),
) -> str:
    orgs = firestore_service.get_user_organizations(user.user_id)
    if not orgs:
        raise HTTPException(status_code=403, detail="User has no organization")
    return orgs[0]["id"]


@router.get("/")
@limiter.limit("30/minute")
async def get_roster(
    request: Request,
    org_id: str = Depends(_get_org_id),
    roster_service: RosterService = Depends(get_roster_service),
):
    participants = roster_service.get_roster(org_id)
    return {"participants": participants}


@router.put("/{participant_id}")
@limiter.limit("60/minute")
async def upsert_participant(
    request: Request,
    participant_id: str,
    data: ParticipantData,
    org_id: str = Depends(_get_org_id),
    roster_service: RosterService = Depends(get_roster_service),
):
    try:
        result = roster_service.upsert_participant(org_id, participant_id, data.model_dump())
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{participant_id}")
@limiter.limit("30/minute")
async def delete_participant(
    request: Request,
    participant_id: str,
    org_id: str = Depends(_get_org_id),
    roster_service: RosterService = Depends(get_roster_service),
):
    participant = roster_service.get_participant(org_id, participant_id)
    if participant and participant.get("partner_id"):
        partner = roster_service.get_participant(org_id, participant["partner_id"])
        if partner and partner.get("partner_id") == participant_id:
            roster_service.upsert_participant(org_id, participant["partner_id"], {
                **partner, "partner_id": None
            })
    roster_service.delete_participant(org_id, participant_id)
    return {"status": "deleted"}
