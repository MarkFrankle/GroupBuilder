import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional
from slowapi import Limiter
from slowapi.util import get_remote_address

from api.dependencies import validate_program_access
from api.middleware.auth import get_current_user, AuthUser
from api.services.roster_service import (
    RosterService,
    VALID_GENDERS,
    VALID_RELIGIONS,
    get_roster_service,
)
from api.services.roster_draft_storage import (
    RosterDraftStorage,
    get_roster_draft_storage,
)
from api.services.assignment_set_storage import (
    AssignmentSetStorage,
    get_assignment_set_storage,
)
from api.services.session_completion_storage import (
    SessionCompletionStorage,
    get_session_completion_storage,
)
from api.services.session_completion_guards import (
    not_accepted_refusal,
    refuse_if_below_completed_prefix,
)
from api.services.keep_apart_storage import (
    KeepApartStorage,
    get_keep_apart_storage,
)
from api.services.roster_diff import apply_renames, diff_rosters
from api.services.roster_gate import ShortfallError, check_shortfalls
from api.services.program_solve import (
    SolveFailed,
    solve_program,
    solve_around_completed_sessions,
)

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
    absent_sessions: list[int] = Field(default_factory=list)


class UploadedPerson(BaseModel):
    """One person from an upload. A draft has religion and/or gender missing."""

    name: str
    religion: Optional[str] = None
    gender: Optional[str] = None
    is_facilitator: bool = False
    partner_name: Optional[str] = None


class UploadRosterRequest(BaseModel):
    participants: list[UploadedPerson]
    drafts: list[UploadedPerson] = Field(default_factory=list)


class DraftUpdate(BaseModel):
    name: Optional[str] = None
    religion: Optional[str] = None
    gender: Optional[str] = None
    is_facilitator: Optional[bool] = None


def _name_key(name: str) -> str:
    """How uploads and drafts match names: case and spacing don't count."""
    # .lower(), not .casefold(): must match nameKey's toLowerCase() in rosterImport.ts.
    return " ".join(name.split()).lower()


def _people(n: int) -> str:
    return f"{n} {'person' if n == 1 else 'people'}"


def _name_taken(name: str) -> str:
    return (
        f"Someone named {name} is already on the roster. "
        "Add a last initial or a nickname to tell them apart."
    )


def _drafts_refusal(n: int) -> str:
    verb = "isn't" if n == 1 else "aren't"
    return (
        f"{_people(n)} from your upload {verb} on the roster yet. "
        "Fix the highlighted cells on the roster first."
    )


@router.get("/")
@limiter.limit("30/minute")
async def get_roster(
    request: Request,
    program_id: str = Depends(validate_program_access),
    roster_service: RosterService = Depends(get_roster_service),
):
    participants = roster_service.get_roster(program_id)
    return {"participants": participants}


def _absent_sessions_by_name(head: dict | None) -> dict[str, list[int]]:
    """Invert a version's per-session ``absentParticipants`` into name -> [session#].

    The assignment set owns absences once it exists; this is how the Roster page
    (locked column) and ``POST /roster/discard`` read them back out.
    """
    result: dict[str, list[int]] = {}
    for session in (head or {}).get("assignments", []):
        session_number = int(session["session"])
        for person in session.get("absentParticipants") or []:
            result.setdefault(person["name"], []).append(session_number)
    return {name: sorted(nums) for name, nums in result.items()}


@router.get("/canonical")
async def get_canonical_roster(
    program_id: str = Depends(validate_program_access),
    assignment_set_id: str | None = None,
    storage: AssignmentSetStorage = Depends(get_assignment_set_storage),
):
    """The roster a given set of assignments was built from, plus its shape.

    This is the *canonical* copy - frozen on the assignment set at generate
    time. The live ``roster/`` collection is the draft. The Roster page derives
    its lock by comparing the two, so an empty answer here means "no assignments
    yet", which is a normal first-run state rather than an error.

    Defaults to the program's current set. History views pass
    ``assignment_set_id`` to fetch a specific past set's own frozen roster
    (including its own keep-apart rules) instead - a past plan must be checked
    against the rules it was actually built with, not whatever is current today.
    """
    set_id = assignment_set_id or storage.get_current_set_id(program_id)
    if not set_id:
        return {"participants": [], "num_tables": None, "num_sessions": None}

    assignment_set = storage.get_set(program_id, set_id) or {}
    absent_by_name = _absent_sessions_by_name(storage.get_version(program_id, set_id))
    participants = [
        {**p, "absent_sessions": absent_by_name.get(p["name"], [])}
        for p in assignment_set.get("participant_data", [])
    ]
    return {
        "participants": participants,
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
                "absent_sessions": sorted(p.get("absent_sessions") or []),
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
    # into the solver, and into Item 15's client-side flag detection. Deriving
    # it symmetrically here on every freeze is what makes an asymmetric field
    # unrepresentable. Item 6a's rename propagation must rewrite this field too:
    # until apply_renames does, a rename leaves stale names inside a frozen
    # keep_apart.
    #
    # A pair naming an id that no longer resolves is dropped, exactly as a
    # dangling partner_id resolves to None above. Deleting a participant
    # therefore retires their rules with no cascade and no cleanup pass.
    #
    # The stamp is keyed by name, so two people sharing a name both receive a
    # rule aimed at either of them - the same collapse partner already suffers,
    # and in the safe direction: an extra separation, never a missed one. The
    # a_name == b_name test below is only the self-pair guard, not a
    # duplicate-name guard.
    keep_apart_names: dict[str, list[str]] = {p["name"]: [] for p in result}
    for a_id, b_id in keep_apart_pairs or []:
        a_name, b_name = id_to_name.get(a_id), id_to_name.get(b_id)
        if a_name is None or b_name is None or a_name == b_name:
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
    drafts_storage: RosterDraftStorage = Depends(get_roster_draft_storage),
):
    """Rebuild the program from the live roster.

    Solves first and commits only on success. The set is minted *after* a
    solution exists, so a failed solve leaves the program exactly where it was.
    """
    # Refuse before any work or write. The floor check goes first so the more
    # specific message wins for a coordinator shrinking the program.
    refuse_if_below_completed_prefix(completion, program_id, data.num_sessions)
    # Drafts are people the coordinator uploaded but hasn't finished. Building
    # without them would quietly leave them out of every session.
    pending = len(drafts_storage.get_drafts(program_id))
    if pending:
        raise HTTPException(status_code=400, detail=_drafts_refusal(pending))
    completed_through = completion.get_completed_through(program_id)

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

    if current_set is not None and current_set.get("accepted", True) is False:
        raise HTTPException(status_code=409, detail=not_accepted_refusal())

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

    if completed_through >= data.num_sessions:
        raise HTTPException(
            status_code=409,
            detail=(
                "Every session is complete, so there is nothing to rebuild. "
                "Reopen the last session first if you need to change it."
            ),
        )

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
    head = None
    if current_set_id:
        head = storage.get_version(program_id, current_set_id)
        for session in (head or {}).get("assignments", []):
            absent = session.get("absentParticipants") or []
            if absent:
                absence_map[int(session["session"])] = absent
    else:
        # First build: there is no assignment set to read absences off, so the
        # per-participant ``absent_sessions`` recorded on the Roster page is the
        # only source. Entries outside 1..num_sessions are dropped here - a mark
        # left over from a since-reduced session count is not an error.
        for p in participant_list:
            for n in p.get("absent_sessions") or []:
                if 1 <= int(n) <= data.num_sessions:
                    absence_map.setdefault(int(n), []).append(p)

    # Still nothing written.
    try:
        if completed_through:
            frozen_sessions = [
                s
                for s in (head or {}).get("assignments", [])
                if int(s["session"]) <= completed_through
            ]
            # A short list means we could not read every completed session -
            # carrying it forward would silently save the wrong session count.
            if len(frozen_sessions) != completed_through:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Couldn't read the completed sessions to carry them "
                        "forward. Please try again."
                    ),
                )
            # A rename made in the same edit as a structural change never hits
            # the fast path, so propagate it into the frozen copy here: the
            # seed resolves by new name, and the frozen/resolved boundary stays
            # one spelling. ``diff`` exists only when a current set does, which
            # a nonzero ``completed_through`` implies - guarded anyway.
            if current_set is not None and diff.renames:
                frozen_sessions, _ = apply_renames(frozen_sessions, [], diff.renames)
            assignments, metadata = solve_around_completed_sessions(
                participants=participant_list,
                num_tables=data.num_tables,
                num_sessions=data.num_sessions,
                completed_through=completed_through,
                frozen_sessions=frozen_sessions,
                absence_map=absence_map,
                max_time_seconds=120,
            )
        else:
            assignments, metadata = solve_program(
                participants=participant_list,
                num_tables=data.num_tables,
                num_sessions=data.num_sessions,
                absence_map=absence_map,
                max_time_seconds=120,
            )
    except SolveFailed as e:
        raise HTTPException(status_code=400, detail=str(e))

    provisional = current_set is not None

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
            accepted=not provisional,
            previous_set_id=current_set_id if provisional else None,
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
    keep_apart: KeepApartStorage = Depends(get_keep_apart_storage),
    drafts_storage: RosterDraftStorage = Depends(get_roster_draft_storage),
):
    """Throw the draft away and rewrite the roster from the current sessions.

    The rebuilt documents get fresh ids, so everything stored *as* a roster
    document id has to be carried across: ``partner_id`` on the document, and
    the program-level ``keep_apart`` pairs. Both are resolved to names before
    the delete and re-resolved to the new ids after the rewrite, because names
    are what the canonical roster is matched on. A keep-apart pair naming
    someone the canonical roster does not contain is dropped - discard restores
    the frozen set, so a person absent from it is genuinely gone.
    """
    set_id = storage.get_current_set_id(program_id)
    if not set_id:
        raise HTTPException(
            status_code=400,
            detail="There are no sessions yet, so there is nothing to go back to.",
        )

    assignment_set = storage.get_set(program_id, set_id) or {}
    canonical = assignment_set.get("participant_data") or []
    absent_by_name = _absent_sessions_by_name(storage.get_version(program_id, set_id))

    live_roster = roster_service.get_roster(program_id)
    live_names = {p["id"]: p["name"] for p in live_roster}
    keep_apart_names = [
        (live_names[a_id], live_names[b_id])
        for a_id, b_id in keep_apart.get_pairs(program_id)
        if a_id in live_names and b_id in live_names
    ]

    for participant in live_roster:
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
                "absent_sessions": absent_by_name.get(p["name"], []),
            },
        )

    keep_apart.replace_pairs(
        program_id,
        [
            (new_ids[a_name], new_ids[b_name])
            for a_name, b_name in keep_apart_names
            if a_name in new_ids and b_name in new_ids
        ],
    )

    # Discard throws the upload away, and its drafts with it.
    drafts_storage.write_drafts(program_id, [])

    return {"status": "discarded", "count": len(canonical)}


@router.put("/")
@limiter.limit("10/minute")
async def upload_roster(
    request: Request,
    body: UploadRosterRequest,
    program_id: str = Depends(validate_program_access),
    roster_service: RosterService = Depends(get_roster_service),
    keep_apart: KeepApartStorage = Depends(get_keep_apart_storage),
    drafts_storage: RosterDraftStorage = Depends(get_roster_draft_storage),
):
    """Replace the whole roster, and its drafts, with an uploaded one.

    Uploaded people have no ids, so partners arrive as names and everyone gets
    a fresh uuid. A partner who is still a draft is linked when that draft
    saves. Whatever the file does not carry is taken from the roster being
    replaced, but only when every name involved comes over: absences (one
    name), keep-apart pairs (both names, drafts included, since a draft keeps
    its id when it saves), and a pair's keep-together setting when the same two
    are paired again. The preview already resolves duplicates and partners; the
    checks here are a backstop.
    """
    everyone = body.participants + body.drafts
    if not everyone:
        raise HTTPException(
            status_code=400,
            detail="The file has no people in it. Add at least one row and try again.",
        )

    by_key: dict[str, UploadedPerson] = {}
    for p in everyone:
        key = _name_key(p.name)
        if not key:
            # Participants would fail validation anyway; drafts would not.
            raise HTTPException(
                status_code=400,
                detail="Every person needs a name. Fill in the blank names and try again.",
            )
        if key in by_key:
            raise HTTPException(
                status_code=400,
                detail=f"{p.name} appears more than once. Give each person a different name and try again.",
            )
        by_key[key] = p
    for p in everyone:
        if not p.partner_name:
            continue
        partner = by_key.get(_name_key(p.partner_name))
        if (
            partner is None
            or partner is p
            or _name_key(partner.partner_name or "") != _name_key(p.name)
        ):
            raise HTTPException(
                status_code=400,
                detail=f"{p.name}'s partner doesn't match anyone on the list. Fix or clear the partner and try again.",
            )

    live = roster_service.get_roster(program_id)
    live_by_id = {p["id"]: p for p in live}
    live_by_key = {_name_key(p["name"]): p for p in live}
    old_pairs = [
        (_name_key(live_by_id[a]["name"]), _name_key(live_by_id[b]["name"]))
        for a, b in keep_apart.get_pairs(program_id)
        if a in live_by_id and b in live_by_id
    ]

    new_ids = {key: str(uuid.uuid4()) for key in by_key}
    draft_keys = {_name_key(d.name) for d in body.drafts}
    docs = {}
    for p in body.participants:
        key = _name_key(p.name)
        old = live_by_key.get(key, {})
        partner_key = _name_key(p.partner_name) if p.partner_name else None
        if partner_key in draft_keys:
            partner_key = None
        old_partner = live_by_id.get(old.get("partner_id") or "")
        same_pair = (
            partner_key is not None
            and old_partner is not None
            and _name_key(old_partner["name"]) == partner_key
        )
        docs[new_ids[key]] = {
            "name": p.name,
            "religion": p.religion,
            "gender": p.gender,
            "partner_id": new_ids[partner_key] if partner_key else None,
            "is_facilitator": p.is_facilitator,
            "keep_together": bool(old.get("keep_together")) if same_pair else False,
            "absent_sessions": old.get("absent_sessions") or [],
        }

    draft_docs = [
        {
            "id": new_ids[_name_key(d.name)],
            "name": d.name.strip(),
            "religion": d.religion if d.religion in VALID_RELIGIONS else None,
            "gender": d.gender if d.gender in VALID_GENDERS else None,
            "is_facilitator": d.is_facilitator,
            "partner_name": d.partner_name,
            "absent_sessions": live_by_key.get(_name_key(d.name), {}).get(
                "absent_sessions"
            )
            or [],
        }
        for d in body.drafts
    ]

    batch = roster_service.db.batch()
    try:
        roster_service.stage_replace(batch, program_id, docs)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    drafts_storage.stage_drafts(batch, program_id, draft_docs)
    batch.commit()

    # Outside the batch on purpose: a failure here costs rules, never the
    # roster. new_ids covers drafts too, so a pair can wait on a draft.
    keep_apart.replace_pairs(
        program_id,
        [
            (new_ids[a], new_ids[b])
            for a, b in old_pairs
            if a in new_ids and b in new_ids
        ],
    )

    return {"status": "replaced", "count": len(docs), "drafts": len(draft_docs)}


class KeepApartPair(BaseModel):
    a_id: str
    b_id: str


def _validate_keep_apart(participants: list[dict], a_id: str, b_id: str) -> None:
    """Refuse the two pairs a coordinator can state but should not.

    Both are detectable by reading two fields, so neither needs a solve - which
    is why refusing them here does not reintroduce the feasibility pre-check
    this feature ruled out. Everything that *would* need a solve falls through
    to the solver's own refusal at rebuild time.
    """
    by_id = {p["id"]: p for p in participants}
    a, b = by_id.get(a_id), by_id.get(b_id)

    if a_id == b_id:
        raise HTTPException(
            status_code=400, detail="A person can't be kept apart from themselves."
        )
    if not a or not b:
        raise HTTPException(
            status_code=400, detail="That person is no longer on the roster."
        )

    partnered = a.get("partner_id") == b_id or b.get("partner_id") == a_id
    if partnered:
        if a.get("keep_together") or b.get("keep_together"):
            raise HTTPException(
                status_code=400,
                detail=(
                    f"{a['name']} and {b['name']} are linked partners, so they "
                    "can't also be kept apart. Remove the link first."
                ),
            )
        raise HTTPException(
            status_code=400,
            detail=(
                f"{a['name']} and {b['name']} are a couple, and couples are "
                "always seated at different tables."
            ),
        )


# These three are declared above the /{participant_id} routes on purpose: a
# route declared after them would have "keep-apart" matched as a participant id,
# and DELETE would delete a participant instead of a rule.
@router.get("/keep-apart")
@limiter.limit("30/minute")
async def list_keep_apart(
    request: Request,
    program_id: str = Depends(validate_program_access),
    keep_apart: KeepApartStorage = Depends(get_keep_apart_storage),
):
    return {"pairs": [list(p) for p in keep_apart.get_pairs(program_id)]}


@router.post("/keep-apart")
@limiter.limit("60/minute")
async def add_keep_apart(
    request: Request,
    data: KeepApartPair,
    program_id: str = Depends(validate_program_access),
    roster_service: RosterService = Depends(get_roster_service),
    keep_apart: KeepApartStorage = Depends(get_keep_apart_storage),
):
    _validate_keep_apart(roster_service.get_roster(program_id), data.a_id, data.b_id)
    pairs = keep_apart.add_pair(program_id, data.a_id, data.b_id)
    return {"pairs": [list(p) for p in pairs]}


@router.delete("/keep-apart/{a_id}/{b_id}")
@limiter.limit("60/minute")
async def remove_keep_apart(
    request: Request,
    a_id: str,
    b_id: str,
    program_id: str = Depends(validate_program_access),
    keep_apart: KeepApartStorage = Depends(get_keep_apart_storage),
):
    """No validation: removing a rule can never create an impossible state, and
    a rule naming someone since deleted has to stay removable.

    The pair travels in the path, like every other DELETE here - a body on
    DELETE has no defined semantics and some proxies strip it.
    """
    pairs = keep_apart.remove_pair(program_id, a_id, b_id)
    return {"pairs": [list(p) for p in pairs]}


@router.get("/drafts")
async def list_drafts(
    program_id: str = Depends(validate_program_access),
    drafts_storage: RosterDraftStorage = Depends(get_roster_draft_storage),
):
    return {"drafts": drafts_storage.get_drafts(program_id)}


@router.put("/drafts/{draft_id}")
@limiter.limit("60/minute")
async def update_draft(
    request: Request,
    draft_id: str,
    data: DraftUpdate,
    program_id: str = Depends(validate_program_access),
    roster_service: RosterService = Depends(get_roster_service),
    drafts_storage: RosterDraftStorage = Depends(get_roster_draft_storage),
):
    """Edit a draft. Once it has both a religion and a gender it is saved as a
    participant under the same id, linked to a waiting partner if that person
    is saved and unpaired, and dropped from the drafts, all in one batch."""
    drafts = drafts_storage.get_drafts(program_id)
    draft = next((d for d in drafts if d["id"] == draft_id), None)
    if draft is None:
        raise HTTPException(
            status_code=404,
            detail="This person is no longer waiting to be saved. Reload the page to see the current roster.",
        )

    changes = {
        k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None
    }
    if "religion" in changes and changes["religion"] not in VALID_RELIGIONS:
        raise HTTPException(status_code=400, detail="Choose a religion from the list.")
    if "gender" in changes and changes["gender"] not in VALID_GENDERS:
        raise HTTPException(status_code=400, detail="Choose a gender from the list.")

    roster = roster_service.get_roster(program_id)
    if "name" in changes:
        name = changes["name"].strip()
        if not name:
            raise HTTPException(status_code=400, detail="A name can't be empty.")
        taken = {_name_key(p["name"]) for p in roster} | {
            _name_key(d["name"]) for d in drafts if d["id"] != draft_id
        }
        if _name_key(name) in taken:
            raise HTTPException(status_code=400, detail=_name_taken(name))
        changes["name"] = name

    updated = {**draft, **changes}
    remaining = [d for d in drafts if d["id"] != draft_id]
    if not (updated.get("religion") and updated.get("gender")):
        drafts_storage.write_drafts(program_id, remaining + [updated])
        return {"draft": updated, "participant": None}

    partner = None
    if updated.get("partner_name"):
        partner = next(
            (
                p
                for p in roster
                if _name_key(p["name"]) == _name_key(updated["partner_name"])
                and not p.get("partner_id")
            ),
            None,
        )

    batch = roster_service.db.batch()
    participant = roster_service.stage_participant(
        batch,
        program_id,
        draft_id,
        {
            "name": updated["name"],
            "religion": updated["religion"],
            "gender": updated["gender"],
            "is_facilitator": updated.get("is_facilitator", False),
            "partner_id": partner["id"] if partner else None,
            "keep_together": False,
            "absent_sessions": updated.get("absent_sessions") or [],
        },
    )
    if partner:
        roster_service.stage_participant(
            batch,
            program_id,
            partner["id"],
            {**partner, "partner_id": draft_id, "keep_together": False},
        )
    drafts_storage.stage_drafts(batch, program_id, remaining)
    batch.commit()
    return {"draft": None, "participant": participant}


@router.delete("/drafts/{draft_id}")
@limiter.limit("30/minute")
async def delete_draft(
    request: Request,
    draft_id: str,
    program_id: str = Depends(validate_program_access),
    drafts_storage: RosterDraftStorage = Depends(get_roster_draft_storage),
):
    drafts = drafts_storage.get_drafts(program_id)
    drafts_storage.write_drafts(program_id, [d for d in drafts if d["id"] != draft_id])
    return {"status": "deleted"}


@router.put("/{participant_id}")
@limiter.limit("60/minute")
async def upsert_participant(
    request: Request,
    participant_id: str,
    data: ParticipantData,
    program_id: str = Depends(validate_program_access),
    roster_service: RosterService = Depends(get_roster_service),
    keep_apart: KeepApartStorage = Depends(get_keep_apart_storage),
):
    # The mirror of the POST /keep-apart refusal. Without it the contradiction
    # is reachable from this side - link two people already kept apart - and
    # the coordinator meets it as the solver's generic "No solution exists"
    # at rebuild time instead of a message naming the remedy. Only
    # keep_together conflicts; a couple plus a keep-apart rule is redundant,
    # not contradictory, and couple_id already separates them.
    if data.keep_together and data.partner_id:
        pair = tuple(sorted((participant_id, data.partner_id)))
        if pair in keep_apart.get_pairs(program_id):
            partner = roster_service.get_participant(program_id, data.partner_id)
            partner_name = (partner or {}).get("name", "that person")
            raise HTTPException(
                status_code=400,
                detail=(
                    f"{data.name} and {partner_name} are kept apart, so they "
                    "can't also be linked partners. Remove the keep-apart rule "
                    "first."
                ),
            )

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
    keep_apart: KeepApartStorage = Depends(get_keep_apart_storage),
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
    # A rule about someone who is gone is not a rule. Left behind, the pair
    # would also point at an id that can never resolve again.
    pairs = keep_apart.get_pairs(program_id)
    remaining = [p for p in pairs if participant_id not in p]
    if len(remaining) != len(pairs):
        keep_apart.replace_pairs(program_id, remaining)
    return {"status": "deleted"}
