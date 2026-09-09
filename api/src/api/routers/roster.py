import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional
from slowapi import Limiter
from slowapi.util import get_remote_address

from api.dependencies import validate_program_access
from api.middleware.auth import get_current_user, AuthUser
from api.services.roster_service import RosterService, get_roster_service
from api.services.assignment_set_storage import (
    AssignmentSetStorage,
    get_assignment_set_storage,
)
from api.services.session_completion_storage import (
    SessionCompletionStorage,
    get_session_completion_storage,
)
from api.services.session_completion_guards import (
    refuse_if_any_session_complete,
    refuse_if_below_completed_prefix,
)
from api.services.keep_apart_storage import (
    KeepApartStorage,
    get_keep_apart_storage,
)
from api.services.roster_diff import apply_renames, diff_rosters
from api.services.roster_gate import ShortfallError, check_shortfalls
from api.services.program_solve import SolveFailed, solve_program

logger = logging.getLogger(__name__)
router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


class ParticipantData(BaseModel):
    name: str
    religion: str
    gender: str
    partner_id: Optional[str] = None
    is_facilitator: bool = False
    keep_together: bool = False


@router.get("/")
@limiter.limit("30/minute")
async def get_roster(
    request: Request,
    program_id: str = Depends(validate_program_access),
    roster_service: RosterService = Depends(get_roster_service),
):
    participants = roster_service.get_roster(program_id)
    return {"participants": participants}


@router.get("/canonical")
async def get_canonical_roster(
    program_id: str = Depends(validate_program_access),
    storage: AssignmentSetStorage = Depends(get_assignment_set_storage),
):
    """The roster the current assignments were built from, plus its shape.

    This is the *canonical* copy - frozen on the assignment set at generate
    time. The live ``roster/`` collection is the draft. The Roster page derives
    its lock by comparing the two, so an empty answer here means "no assignments
    yet", which is a normal first-run state rather than an error.
    """
    set_id = storage.get_current_set_id(program_id)
    if not set_id:
        return {"participants": [], "num_tables": None, "num_sessions": None}

    assignment_set = storage.get_set(program_id, set_id) or {}
    return {
        "participants": assignment_set.get("participant_data", []),
        "num_tables": assignment_set.get("num_tables"),
        "num_sessions": assignment_set.get("num_sessions"),
    }


class GenerateRequest(BaseModel):
    num_tables: int = Field(ge=1, le=10)
    num_sessions: int = Field(ge=1, le=6)


def _roster_to_participant_list(
    participants: list[dict],
    keep_apart_pairs: list[tuple[str, str]] | None = None,
) -> list[dict]:
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
                "linked_id": None,
                "is_facilitator": p.get("is_facilitator", False),
                "keep_together": p.get("keep_together", False),
            }
        )

    # Assign couple IDs (separate) and linked IDs (keep-together)
    couple_map = {}
    linked_map = {}
    next_couple_id = 1
    next_linked_id = 1
    for p in result:
        if p["partner"]:
            key = tuple(sorted([p["name"], p["partner"]]))
            if p["keep_together"]:
                if key not in linked_map:
                    linked_map[key] = next_linked_id
                    next_linked_id += 1
                p["linked_id"] = linked_map[key]
            else:
                if key not in couple_map:
                    couple_map[key] = next_couple_id
                    next_couple_id += 1
                p["couple_id"] = couple_map[key]

    # Keep-apart is stored program-level as id pairs because it is one-to-many;
    # it is *frozen* per participant because participant_data is what travels -
    # through the solver, through the rename propagation, and into the
    # client-side flag detection. Deriving it symmetrically here on every freeze
    # is what makes an asymmetric field unrepresentable.
    #
    # A pair naming an id that no longer resolves is dropped, exactly as a
    # dangling partner_id resolves to None above. Deleting a participant
    # therefore retires their rules with no cascade and no cleanup pass.
    keep_apart_names: dict[str, list[str]] = {p["name"]: [] for p in result}
    for a_id, b_id in keep_apart_pairs or []:
        a_name, b_name = id_to_name.get(a_id), id_to_name.get(b_id)
        if not a_name or not b_name or a_name == b_name:
            continue
        keep_apart_names[a_name].append(b_name)
        keep_apart_names[b_name].append(a_name)

    for p in result:
        p["keep_apart"] = sorted(set(keep_apart_names[p["name"]]))

    return result


@router.post("/generate")
@limiter.limit("10/minute")
async def generate_from_roster(
    request: Request,
    data: GenerateRequest,
    user: AuthUser = Depends(get_current_user),
    program_id: str = Depends(validate_program_access),
    roster_service: RosterService = Depends(get_roster_service),
    storage: AssignmentSetStorage = Depends(get_assignment_set_storage),
    completion: SessionCompletionStorage = Depends(get_session_completion_storage),
    keep_apart: KeepApartStorage = Depends(get_keep_apart_storage),
):
    """Rebuild the program from the live roster.

    Solves first and commits only on success. The set is minted *after* a
    solution exists, so a failed solve leaves the program exactly where it was.
    """
    # Refuse before any work or write. The floor check goes first so the more
    # specific message wins for a coordinator shrinking the program.
    refuse_if_below_completed_prefix(completion, program_id, data.num_sessions)
    refuse_if_any_session_complete(completion, program_id)

    participants = roster_service.get_roster(program_id)
    if not participants:
        raise HTTPException(status_code=400, detail="Roster is empty")

    # Canonical participant_data is literally this function's output, so the
    # draft has to pass through it before any comparison. Diffing raw roster
    # documents would compare partner_id against partner and read every
    # partnered person as changed.
    participant_list = _roster_to_participant_list(
        participants, keep_apart_pairs=keep_apart.get_pairs(program_id)
    )

    # "No current set" is the first-run signal, not "canonical is empty" - that
    # distinguishes never-generated from a degenerate empty-roster set.
    current_set_id = storage.get_current_set_id(program_id)
    current_set = (
        storage.get_set(program_id, current_set_id) if current_set_id else None
    )

    # A rename-only change propagates and returns without solving. Skipping the
    # rebuild without propagating would leave the old spelling on the
    # Assignments page forever - participants are matched by name everywhere.
    if current_set:
        shape_unchanged = (
            current_set.get("num_tables") == data.num_tables
            and current_set.get("num_sessions") == data.num_sessions
        )
        diff = diff_rosters(
            canonical=current_set.get("participant_data") or [], draft=participant_list
        )
        if shape_unchanged and diff.renames and not diff.needs_rebuild:
            # The canonical roster is renamed once.
            _, renamed_participants = apply_renames(
                [], current_set.get("participant_data") or [], diff.renames
            )
            # Then every version of the set, not just the head. Promotion can
            # put any version of the current set back at the head, so leaving
            # the older ones spelt the old way means undoing a shuffle
            # resurrects the typo - and the page would then read Locked,
            # because the roster still matches participant_data, offering no
            # way to notice it or clear it. Version counts per set are small
            # and bounded.
            for entry in storage.list_versions(program_id, current_set_id):
                version_id = entry["version_id"]
                version = storage.get_version(program_id, current_set_id, version_id)
                if not version:
                    continue
                # Overwritten in place rather than replaced by a new version:
                # nobody moved, so a new history entry would be materially
                # identical to its parent.
                renamed_assignments, _ = apply_renames(
                    version.get("assignments") or [], [], diff.renames
                )
                storage.overwrite_version_assignments(
                    program_id, current_set_id, version_id, renamed_assignments
                )

            storage.update_participant_data(
                program_id, current_set_id, renamed_participants
            )
            return {
                "assignment_set_id": current_set_id,
                "rebuilt": False,
                "message": "Roster saved. No rebuild needed.",
            }

    # Shortfall gate - arithmetic only, no solve. It sits after the rename fast
    # path on purpose: the gate exists to name what is short before we run the
    # solver, and a rename never reaches the solver. Running it first refused a
    # typo fix whenever the roster happened to be below the headcount.
    try:
        check_shortfalls(participant_list, data.num_tables)
    except ShortfallError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Absences carry across every rebuild, always - there is no checkbox,
    # because forgetting one silently seats someone who is away.
    absence_map = {}
    if current_set_id:
        version = storage.get_version(program_id, current_set_id)
        for session in (version or {}).get("assignments", []):
            absent = session.get("absentParticipants") or []
            if absent:
                absence_map[int(session["session"])] = absent

    # Still nothing written.
    try:
        assignments, metadata = solve_program(
            participants=participant_list,
            num_tables=data.num_tables,
            num_sessions=data.num_sessions,
            absence_map=absence_map,
            max_time_seconds=120,
        )
    except SolveFailed as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Commit: mint the set and write its first version together.
    try:
        # The program is repointed last. Creating the set and writing its first
        # version are two writes, and a program pointed at a set whose version
        # never arrived is the empty-set bug this endpoint exists to close -
        # narrower than before, but the same failure. Until the pointer moves,
        # the half-built set is unreachable and the old plan is still current.
        set_id = storage.create_set(
            program_id=program_id,
            user_id=user.user_id,
            participant_data=participant_list,
            filename="roster",
            num_tables=data.num_tables,
            num_sessions=data.num_sessions,
            make_current=False,
        )
        storage.save_version(
            program_id=program_id,
            set_id=set_id,
            version_id="v1",
            assignments=assignments,
            metadata=metadata,
        )
        storage.set_current_set_id(program_id, set_id)
    except Exception as e:
        logger.error(f"Failed to save the rebuilt program: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Couldn't save the new group set. Please try again.",
        )

    return {
        "assignment_set_id": set_id,
        "rebuilt": True,
        "message": "Sessions rebuilt.",
    }


@router.post("/discard")
@limiter.limit("10/minute")
async def discard_roster_changes(
    request: Request,
    program_id: str = Depends(validate_program_access),
    roster_service: RosterService = Depends(get_roster_service),
    storage: AssignmentSetStorage = Depends(get_assignment_set_storage),
):
    """Throw the draft away and rewrite the roster from the current sessions.

    The rebuilt documents get fresh ids. That is safe: nothing outside the
    roster grid holds a roster document id, and ``partner_id`` is resolved back
    to a name every time the program is generated, so the only thing that has
    to survive is who is partnered with whom - which is matched by name here.
    """
    set_id = storage.get_current_set_id(program_id)
    if not set_id:
        raise HTTPException(
            status_code=400,
            detail="There are no sessions yet, so there is nothing to go back to.",
        )

    assignment_set = storage.get_set(program_id, set_id) or {}
    canonical = assignment_set.get("participant_data") or []

    for participant in roster_service.get_roster(program_id):
        roster_service.delete_participant(program_id, participant["id"])

    new_ids = {p["name"]: str(uuid.uuid4()) for p in canonical}
    for p in canonical:
        partner_name = p.get("partner")
        roster_service.upsert_participant(
            program_id,
            new_ids[p["name"]],
            {
                "name": p["name"],
                "religion": p["religion"],
                "gender": p["gender"],
                "partner_id": new_ids.get(partner_name) if partner_name else None,
                "is_facilitator": p.get("is_facilitator", False),
                "keep_together": p.get("keep_together", False),
            },
        )

    return {"status": "discarded", "count": len(canonical)}


@router.put("/{participant_id}")
@limiter.limit("60/minute")
async def upsert_participant(
    request: Request,
    participant_id: str,
    data: ParticipantData,
    program_id: str = Depends(validate_program_access),
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
    program_id: str = Depends(validate_program_access),
    roster_service: RosterService = Depends(get_roster_service),
):
    participant = roster_service.get_participant(program_id, participant_id)
    if participant and participant.get("partner_id"):
        partner = roster_service.get_participant(program_id, participant["partner_id"])
        if partner and partner.get("partner_id") == participant_id:
            roster_service.upsert_participant(
                program_id,
                participant["partner_id"],
                {**partner, "partner_id": None, "keep_together": False},
            )
    roster_service.delete_participant(program_id, participant_id)
    return {"status": "deleted"}
