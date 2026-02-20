import uuid

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional
from slowapi import Limiter
from slowapi.util import get_remote_address

from api.middleware.auth import get_current_user, AuthUser
from api.services.roster_service import RosterService, get_roster_service
from api.services.firestore_service import FirestoreService, get_firestore_service
from api.services.session_storage import SessionStorage

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


class ParticipantData(BaseModel):
    name: str
    religion: str
    gender: str
    partner_id: Optional[str] = None
    is_facilitator: bool = False


async def _get_org_id(
    user: AuthUser = Depends(get_current_user),
    firestore_service: FirestoreService = Depends(get_firestore_service),
) -> str:
    programs = firestore_service.get_user_programs(user.user_id)
    if not programs:
        raise HTTPException(status_code=403, detail="User has no program")
    return programs[0]["id"]


@router.get("/")
@limiter.limit("30/minute")
async def get_roster(
    request: Request,
    program_id: str = Depends(_get_org_id),
    roster_service: RosterService = Depends(get_roster_service),
):
    participants = roster_service.get_roster(program_id)
    return {"participants": participants}


class GenerateRequest(BaseModel):
    num_tables: int = Field(ge=1, le=10)
    num_sessions: int = Field(ge=1, le=6)


def _roster_to_participant_list(participants: list[dict]) -> list[dict]:
    """Convert roster docs to the solver's expected participant dict format."""
    id_to_name = {p["id"]: p["name"] for p in participants}

    result = []
    for i, p in enumerate(participants):
        partner_name = None
        if p.get("partner_id") and p["partner_id"] in id_to_name:
            partner_name = id_to_name[p["partner_id"]]
        result.append(
            {
                "id": i + 1,
                "name": p["name"],
                "religion": p["religion"],
                "gender": p["gender"],
                "partner": partner_name,
                "couple_id": None,
                "is_facilitator": p.get("is_facilitator", False),
            }
        )

    # Assign couple IDs
    couple_map = {}
    next_couple_id = 1
    for p in result:
        if p["partner"]:
            key = tuple(sorted([p["name"], p["partner"]]))
            if key not in couple_map:
                couple_map[key] = next_couple_id
                next_couple_id += 1
            p["couple_id"] = couple_map[key]

    return result


@router.post("/generate")
@limiter.limit("10/minute")
async def generate_from_roster(
    request: Request,
    data: GenerateRequest,
    user: AuthUser = Depends(get_current_user),
    program_id: str = Depends(_get_org_id),
    roster_service: RosterService = Depends(get_roster_service),
):
    participants = roster_service.get_roster(program_id)
    if not participants:
        raise HTTPException(status_code=400, detail="Roster is empty")

    if len(participants) < data.num_tables:
        raise HTTPException(
            status_code=400,
            detail=f"Need at least {data.num_tables} participants for {data.num_tables} tables",
        )

    participant_list = _roster_to_participant_list(participants)

    facilitator_count = sum(
        1 for p in participant_list if p.get("is_facilitator", False)
    )
    if facilitator_count > 0 and facilitator_count < data.num_tables:
        raise HTTPException(
            status_code=400,
            detail=f"Need at least {data.num_tables} facilitators for {data.num_tables} tables (have {facilitator_count})",
        )

    session_id = str(uuid.uuid4())
    storage = SessionStorage()
    storage.save_session(
        org_id=program_id,
        session_id=session_id,
        user_id=user.user_id,
        participant_data=participant_list,
        num_tables=data.num_tables,
        num_sessions=data.num_sessions,
        filename="roster",
    )

    return {"session_id": session_id, "message": "Session created from roster"}


@router.put("/{participant_id}")
@limiter.limit("60/minute")
async def upsert_participant(
    request: Request,
    participant_id: str,
    data: ParticipantData,
    program_id: str = Depends(_get_org_id),
    roster_service: RosterService = Depends(get_roster_service),
):
    try:
        result = roster_service.upsert_participant(
            program_id, participant_id, data.model_dump()
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{participant_id}")
@limiter.limit("30/minute")
async def delete_participant(
    request: Request,
    participant_id: str,
    program_id: str = Depends(_get_org_id),
    roster_service: RosterService = Depends(get_roster_service),
):
    participant = roster_service.get_participant(program_id, participant_id)
    if participant and participant.get("partner_id"):
        partner = roster_service.get_participant(program_id, participant["partner_id"])
        if partner and partner.get("partner_id") == participant_id:
            roster_service.upsert_participant(
                program_id, participant["partner_id"], {**partner, "partner_id": None}
            )
    roster_service.delete_participant(program_id, participant_id)
    return {"status": "deleted"}
