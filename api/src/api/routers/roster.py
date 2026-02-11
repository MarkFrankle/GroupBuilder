import io
import uuid

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File
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


REQUIRED_COLUMNS = {"Name", "Religion", "Gender", "Partner"}


@router.post("/import")
@limiter.limit("10/minute")
async def import_roster(
    request: Request,
    file: UploadFile = File(...),
    org_id: str = Depends(_get_org_id),
    roster_service: RosterService = Depends(get_roster_service),
):
    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="File must be .xlsx or .xls")

    contents = await file.read()
    try:
        df = pd.read_excel(io.BytesIO(contents))
    except Exception:
        raise HTTPException(status_code=400, detail="Could not parse Excel file")

    missing = REQUIRED_COLUMNS - set(df.columns)
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing columns: {', '.join(missing)}")

    # Clear existing roster
    existing = roster_service.get_roster(org_id)
    for p in existing:
        roster_service.delete_participant(org_id, p["id"])

    # First pass: create without partners
    name_to_id = {}
    participants = []
    for _, row in df.iterrows():
        name = str(row["Name"]).strip()
        if not name or name == "nan":
            continue
        pid = str(uuid.uuid4())
        religion = str(row.get("Religion", "Other")).strip()
        if religion == "nan" or religion not in ("Christian", "Jewish", "Muslim", "Other"):
            religion = "Other"
        gender = str(row.get("Gender", "Other")).strip()
        if gender == "nan" or gender not in ("Male", "Female", "Other"):
            gender = "Other"

        roster_service.upsert_participant(org_id, pid, {
            "name": name, "religion": religion,
            "gender": gender, "partner_id": None,
        })
        name_to_id[name] = pid
        participants.append({"id": pid, "name": name, "religion": religion,
                             "gender": gender, "partner_id": None})

    # Second pass: link partners
    for _, row in df.iterrows():
        name = str(row["Name"]).strip()
        partner_name = str(row.get("Partner", "")).strip()
        if not partner_name or partner_name == "nan" or partner_name == "":
            continue
        if name in name_to_id and partner_name in name_to_id:
            pid = name_to_id[name]
            partner_pid = name_to_id[partner_name]
            p = [x for x in participants if x["id"] == pid][0]
            p["partner_id"] = partner_pid
            roster_service.upsert_participant(org_id, pid, {**p})

    final = roster_service.get_roster(org_id)
    return {"participants": final}


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
