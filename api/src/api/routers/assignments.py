from fastapi import APIRouter, HTTPException, Query, Path, Request, Body, Depends
from assignment_logic.api_handler import handle_generate_assignments
from assignment_logic.group_builder import GroupBuilder
from api.dependencies import validate_program_access
from api.services.assignment_set_storage import (
    AssignmentSetStorage,
    get_assignment_set_storage,
)
from api.services.session_completion_storage import (
    SessionCompletionStorage,
    get_session_completion_storage,
)
from api.services.session_completion_guards import refuse_if_any_session_complete
from api.services.version_promotion import roster_change_reason
from api.services.program_solve import (
    LABEL_GENERATED,
    SolveFailed,
    extract_pairings_from_sessions,
    solve_program,
)
from api.utils.seating_arrangement import arrange_circular_seating
from slowapi import Limiter
from slowapi.util import get_remote_address
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
import logging

logger = logging.getLogger(__name__)
router = APIRouter()
limiter = Limiter(key_func=get_remote_address)

NO_ASSIGNMENT_SET = (
    "This program has no assignments yet. Generate them from Setup first."
)
ASSIGNMENT_SET_MISSING = (
    "Something went wrong loading this program's assignments. "
    "Please contact support."
)
ASSIGNMENTS_MALFORMED = (
    "These assignments could not be saved. Reload the page and try your edit again."
)

# A version is the state after something happened, so every label is a completed
# action in the past tense.
# LABEL_GENERATED is imported from
# program_solve, which decides which of them a solve earned.
LABEL_REBUILT = "Sessions rebuilt"
LABEL_MANUAL_EDIT = "Manual edit"


def _require_current_set_id(storage: AssignmentSetStorage, program_id: str) -> str:
    """Resolve the program's current assignment set, or 404."""
    set_id = storage.get_current_set_id(program_id)
    if not set_id:
        logger.warning(f"No assignment set for program: {program_id}")
        raise HTTPException(status_code=404, detail=NO_ASSIGNMENT_SET)
    return set_id


SET_OUT_OF_WINDOW = (
    "That version is no longer available. History goes back to your last setup change."
)


def _resolve_readable_set_id(
    storage: AssignmentSetStorage, program_id: str, assignment_set_id: Optional[str]
) -> str:
    """The set a read may target: the current one, or the one before it.

    Enforced here rather than left to what History happens to offer, so the
    two-set window is a property of the API and not of one menu.
    """
    current_set_id = _require_current_set_id(storage, program_id)
    if not assignment_set_id or assignment_set_id == current_set_id:
        return current_set_id

    readable = {
        s.get("assignment_set_id")
        for s in storage.list_recent_sets(program_id, limit=2)
    }
    if assignment_set_id not in readable:
        raise HTTPException(status_code=409, detail=SET_OUT_OF_WINDOW)

    return assignment_set_id


def _require_current_set(
    storage: AssignmentSetStorage, program_id: str
) -> tuple[str, Dict[str, Any]]:
    """Resolve the program's current assignment set id and document.

    Raises 404 when the program simply has no assignments yet, and 500 when it
    points at an assignment set that no longer exists — that second case is
    corrupt data, not a state the user can fix by generating.
    """
    set_id = _require_current_set_id(storage, program_id)
    assignment_set = storage.get_set(program_id, set_id)
    if assignment_set is None:
        logger.error(
            "Program %s points at missing assignment set %s", program_id, set_id
        )
        raise HTTPException(status_code=500, detail=ASSIGNMENT_SET_MISSING)
    return set_id, assignment_set


def _format_set_date(created_at: Any) -> str:
    """The date a setup change was committed, for the not-promotable sentence."""
    try:
        return created_at.strftime("%b %-d")
    except (AttributeError, ValueError):
        return "an earlier date"


def session_complete_refusal(session_number: int) -> str:
    """Message refusing a change to a Session the user has marked complete."""
    return (
        f"Session {session_number} is marked complete and cannot be changed. "
        "Reopen it first if you need to make changes."
    )


def out_of_order_completion_refusal(session_number: int, completed_through: int) -> str:
    """Message refusing a completion that would leave a gap.

    Completion is contiguous — time is linear — so the only Session that can be
    completed is the one after the last completed one.
    """
    return (
        f"Session {session_number} can't be completed yet — "
        f"Session {completed_through + 1} is still open. "
        "Complete your sessions in order."
    )


def out_of_order_reopen_refusal(session_number: int, completed_through: int) -> str:
    """Message refusing a reopen below the last completed Session."""
    return (
        f"Session {session_number} can't be reopened while Session "
        f"{completed_through} is still complete. "
        f"Reopen Session {completed_through} first."
    )


def _validate_session_number(
    storage: AssignmentSetStorage, program_id: str, session_number: int
) -> None:
    """Refuse a session number the current assignment set does not contain."""
    _, assignment_set = _require_current_set(storage, program_id)
    num_sessions = assignment_set.get("num_sessions") or 0
    if num_sessions < 1:
        logger.error("Assignment set for program %s has no session count", program_id)
        raise HTTPException(status_code=500, detail=ASSIGNMENT_SET_MISSING)
    if session_number > num_sessions:
        raise HTTPException(
            status_code=400,
            detail=(
                f"There is no session {session_number}. "
                f"This program has sessions 1 through {num_sessions}."
            ),
        )


def _require_wellformed_assignments(assignments: Any) -> None:
    """Reject a submitted array that cannot be diffed session by session.

    Every entry must name an integer session, and no session may appear twice:
    a duplicate would let a tampered entry hide behind a matching one while
    still being the entry the program shows.
    """
    numbers = []
    for entry in assignments:
        if not isinstance(entry, dict) or not isinstance(entry.get("session"), int):
            raise HTTPException(status_code=400, detail=ASSIGNMENTS_MALFORMED)
        numbers.append(entry["session"])
    if len(numbers) != len(set(numbers)):
        raise HTTPException(status_code=400, detail=ASSIGNMENTS_MALFORMED)


def _session_by_number(assignments: Any) -> Dict[int, Dict[str, Any]]:
    """Index an assignments array by session number, skipping malformed entries."""
    indexed: Dict[int, Dict[str, Any]] = {}
    for entry in assignments or []:
        number = entry.get("session") if isinstance(entry, dict) else None
        if isinstance(number, int):
            indexed[number] = entry
    return indexed


def _refuse_if_completed_sessions_changed(
    completion: SessionCompletionStorage,
    program_id: str,
    stored_assignments: Any,
    submitted_assignments: Any,
) -> None:
    """Refuse a save that would alter a frozen Session.

    ``/results/save`` is program-scoped, so the only truthful check is a
    comparison against what is stored. A dropped Session counts as a change: an
    omission still changes what the program says happened that night.

    Sessions completed before any version exists are skipped — there is nothing
    frozen to protect yet, and refusing would strand the program.
    """
    completed_through = completion.get_completed_through(program_id)
    if not completed_through:
        return

    stored = _session_by_number(stored_assignments)
    submitted = _session_by_number(submitted_assignments)

    for number in range(1, completed_through + 1):
        if number not in stored:
            continue
        if stored[number] != submitted.get(number):
            raise HTTPException(
                status_code=409,
                detail=session_complete_refusal(number),
            )


def _next_version_id(
    storage: AssignmentSetStorage, program_id: str, set_id: str
) -> str:
    """Next sequential version id for an assignment set."""
    return f"v{len(storage.list_versions(program_id, set_id)) + 1}"


def _get_active_participants(
    all_participants: List[Dict[str, Any]], absent_participants: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Get list of participants who should be assigned in this session.

    Args:
        all_participants: Full list of participants
        absent_participants: List of participants to mark as absent

    Returns:
        List of active participants (excluding absences)
    """
    absent_names = {p["name"] for p in absent_participants}
    active = [p for p in all_participants if p["name"] not in absent_names]

    logger.info(
        f"Active participants: {len(active)} (total: {len(all_participants)}, absent: {len(absent_names)})"
    )
    return active


def _extract_current_table_assignments(
    session_assignment: Dict[str, Any], participant_dict: List[Dict[str, Any]]
) -> Dict[int, int]:
    """
    Extract current table assignments for a session to prefer variety when regenerating.

    Args:
        session_assignment: The session assignment data containing tables
        participant_dict: List of participant dicts with id and name

    Returns:
        Dict mapping participant_id -> table_number (0-indexed)
    """
    # Build name-to-id mapping
    name_to_id = {p["name"]: p["id"] for p in participant_dict}

    current_assignments = {}

    for table_num_str, participants in session_assignment["tables"].items():
        table_idx = int(table_num_str) - 1  # Convert from 1-indexed to 0-indexed
        for participant in participants:
            if participant:  # Skip None/null entries
                participant_id = name_to_id.get(participant["name"])
                if participant_id is not None:
                    current_assignments[participant_id] = table_idx

    logger.info(
        f"Extracted {len(current_assignments)} current table assignments to prefer avoiding"
    )
    return current_assignments


def _generate_assignments_internal(
    storage: AssignmentSetStorage,
    program_id: str,
    set_id: str,
    assignment_set: Dict[str, Any],
    mark_regenerated: bool = False,
    max_time_seconds: int = 120,
):
    """
    Internal helper to generate assignments (shared by get_assignments and regenerate_assignments).

    Args:
        storage: Assignment set storage
        program_id: The program the assignment set belongs to
        set_id: The assignment set to solve and version
        assignment_set: That set's already-resolved document
        mark_regenerated: Whether to mark results as regenerated
        max_time_seconds: Maximum solver time in seconds (default: 120)

    Returns:
        Tuple of (assignments, version_id, metadata)
    """
    participants_dict = assignment_set["participant_data"]
    num_tables = assignment_set["num_tables"]
    num_sessions = assignment_set["num_sessions"]

    logger.info(
        f"{'Regenerating' if mark_regenerated else 'Generating'} assignments for program {program_id}: "
        f"{len(participants_dict)} participants, {num_tables} tables, {num_sessions} sessions, "
        f"max_time={max_time_seconds}s"
    )

    results = handle_generate_assignments(
        participants_dict, num_tables, num_sessions, max_time_seconds=max_time_seconds
    )

    if results["status"] != "success":
        error_msg = results.get("error", "No feasible solution found")
        logger.error(f"Solver failed: {error_msg}")
        raise HTTPException(status_code=400, detail=error_msg)

    # Log solver statistics
    num_branches = results.get("num_branches", "N/A")
    num_conflicts = results.get("num_conflicts", "N/A")
    branches_str = (
        f"{num_branches:,}" if isinstance(num_branches, int) else num_branches
    )
    conflicts_str = (
        f"{num_conflicts:,}" if isinstance(num_conflicts, int) else num_conflicts
    )

    logger.info(
        f"Solver [{len(participants_dict)}p/{num_tables}t/{num_sessions}s]: "
        f"{results.get('solution_quality', 'unknown').upper()} in {results.get('solve_time', 0):.2f}s | "
        f"Deviation: {results.get('total_deviation', 'N/A')} | "
        f"Branches: {branches_str} | "
        f"Conflicts: {conflicts_str}"
    )

    # Prepare result data
    result_metadata = {
        "solution_quality": results.get("solution_quality"),
        "solve_time": results.get("solve_time"),
        "total_deviation": results.get("total_deviation"),
        "max_time_seconds": max_time_seconds,
        "label": LABEL_REBUILT if mark_regenerated else LABEL_GENERATED,
    }

    if mark_regenerated:
        result_metadata["regenerated"] = True

    version_id = _next_version_id(storage, program_id, set_id)

    storage.save_version(
        program_id=program_id,
        set_id=set_id,
        version_id=version_id,
        assignments=results["assignments"],
        metadata=result_metadata,
    )

    return results["assignments"], version_id, result_metadata


@router.get("/")
@limiter.limit("5/minute")  # Limit expensive solver operations
def get_assignments(
    request: Request,
    program_id: str = Depends(validate_program_access),
    max_time_seconds: int = Query(
        120, ge=30, le=240, description="Maximum solver time in seconds (30-240)"
    ),
    storage: AssignmentSetStorage = Depends(get_assignment_set_storage),
    completion: SessionCompletionStorage = Depends(get_session_completion_storage),
):
    """Generate assignments for a program's current assignment set.

    Re-solves the whole program and saves a version, so it must refuse once any
    Session is frozen - the same rule ``/regenerate`` already enforced. This
    route had no such guard and no remaining caller after Item 6a removed the
    two-call generate flow, which made it a way to rewrite a completed Session's
    seating. Deleting it outright is tracked in BACKLOG.md.
    """
    refuse_if_any_session_complete(completion, program_id)

    set_id, assignment_set = _require_current_set(storage, program_id)

    try:
        assignments, _, _ = _generate_assignments_internal(
            storage=storage,
            program_id=program_id,
            set_id=set_id,
            assignment_set=assignment_set,
            mark_regenerated=False,
            max_time_seconds=max_time_seconds,
        )
        return assignments
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to generate assignments: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="An error occurred while generating assignments. Please try again or contact support if the problem persists.",
        )


@router.post("/regenerate")
@limiter.limit("5/minute")  # Limit expensive solver operations
async def regenerate_assignments(
    request: Request,
    program_id: str = Depends(validate_program_access),
    max_time_seconds: int = Query(
        120, ge=30, le=240, description="Maximum solver time in seconds (30-240)"
    ),
    storage: AssignmentSetStorage = Depends(get_assignment_set_storage),
    completion: SessionCompletionStorage = Depends(get_session_completion_storage),
):
    """Regenerate assignments from the current assignment set's roster snapshot."""
    refuse_if_any_session_complete(completion, program_id)

    set_id, assignment_set = _require_current_set(storage, program_id)

    try:
        assignments, version_id, _ = _generate_assignments_internal(
            storage=storage,
            program_id=program_id,
            set_id=set_id,
            assignment_set=assignment_set,
            mark_regenerated=True,
            max_time_seconds=max_time_seconds,
        )

        logger.info(f"Stored regenerated results as {version_id}")

        return {"assignments": assignments, "version_id": version_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to regenerate assignments: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="An error occurred while regenerating assignments. Please try again or contact support if the problem persists.",
        )


@router.post("/regenerate/with_absences")
@limiter.limit("5/minute")
async def regenerate_all_with_absences(
    request: Request,
    program_id: str = Depends(validate_program_access),
    max_time_seconds: int = Query(120, ge=30, le=240),
    per_session_absences: List[Dict[str, Any]] = Body(default=[]),
    storage: AssignmentSetStorage = Depends(get_assignment_set_storage),
    completion: SessionCompletionStorage = Depends(get_session_completion_storage),
):
    """
    Regenerate all sessions with per-session absences, saving exactly one new version.

    per_session_absences: [{"session_number": 1, "absent_participants": [...]}, ...]
    Sessions not listed are solved with all participants present.
    """
    refuse_if_any_session_complete(completion, program_id)

    set_id, assignment_set = _require_current_set(storage, program_id)

    try:
        participants = assignment_set["participant_data"]
        num_tables = assignment_set["num_tables"]
        num_sessions = assignment_set["num_sessions"]

        absence_map: Dict[int, List[Dict[str, Any]]] = {}
        for entry in per_session_absences:
            sn = entry.get("session_number")
            absent = entry.get("absent_participants", [])
            if sn and absent:
                absence_map[int(sn)] = absent

        try:
            assignments, metadata = solve_program(
                participants=participants,
                num_tables=num_tables,
                num_sessions=num_sessions,
                absence_map=absence_map,
                max_time_seconds=max_time_seconds,
                label_when_clean=LABEL_REBUILT,
            )
        except SolveFailed as e:
            raise HTTPException(status_code=400, detail=str(e))

        metadata["regenerated"] = True

        # Save exactly one new version
        version_id = _next_version_id(storage, program_id, set_id)

        storage.save_version(
            program_id=program_id,
            set_id=set_id,
            version_id=version_id,
            assignments=assignments,
            metadata=metadata,
        )

        logger.info(
            f"Saved regen-with-absences result as {version_id} for program {program_id}"
        )
        return {"version_id": version_id, "assignments": assignments}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to regenerate with absences: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="An error occurred while regenerating assignments. Please try again or contact support if the problem persists.",
        )


@router.post("/regenerate/session/{session_number}")
@limiter.limit(
    "20/minute"
)  # More lenient for single session (much cheaper than full regeneration)
async def regenerate_single_session(
    request: Request,
    session_number: int = Path(
        ..., description="Session number to regenerate (1-based)", ge=1, le=6
    ),
    program_id: str = Depends(validate_program_access),
    max_time_seconds: int = Query(
        120, ge=30, le=240, description="Maximum solver time in seconds (30-240)"
    ),
    version_id: Optional[str] = Query(
        None, description="Version ID to base regeneration on (defaults to latest)"
    ),
    absent_participants: List[Dict[str, Any]] = Body(default=[]),
    storage: AssignmentSetStorage = Depends(get_assignment_set_storage),
    completion: SessionCompletionStorage = Depends(get_session_completion_storage),
):
    """
    Regenerate a single session while keeping other sessions unchanged.

    This endpoint allows regenerating just one problematic session (e.g., session 2)
    while preserving the assignments for all other sessions. The solver will avoid
    pairing participants who sat together in other sessions.

    Args:
        session_number: Which session (meeting night) to regenerate (1-based index)
        program_id: The program whose current assignment set is being edited
        max_time_seconds: Solver time limit
        version_id: Which version to base regeneration on (default: latest)
        absent_participants: List of participants to mark absent for this session

    Returns:
        New version with the regenerated session merged in
    """
    if completion.is_complete(program_id, session_number):
        raise HTTPException(
            status_code=409,
            detail=session_complete_refusal(session_number),
        )

    _validate_session_number(storage, program_id, session_number)

    set_id, assignment_set = _require_current_set(storage, program_id)

    try:
        num_tables = assignment_set["num_tables"]
        all_participants = assignment_set["participant_data"]

        # 2. Get current assignments (from specified version or latest)
        current_result = storage.get_version(program_id, set_id, version_id=version_id)
        if current_result is None:
            raise HTTPException(
                status_code=404,
                detail="No existing results found. Please generate assignments first before regenerating a specific session.",
            )

        existing_assignments = current_result["assignments"]

        # 3. Extract historical pairings from OTHER sessions
        historical_pairings = extract_pairings_from_sessions(
            existing_assignments, exclude_session=session_number
        )

        # 4. Extract current table assignments to prefer variety
        session_assignment = existing_assignments[session_number - 1]
        current_table_assignments = _extract_current_table_assignments(
            session_assignment, all_participants
        )

        # 5. Get active participants for this session
        active_participants = _get_active_participants(
            all_participants, absent_participants
        )

        # Validate we have enough participants for the tables
        if len(active_participants) < num_tables:
            raise HTTPException(
                status_code=400,
                detail=f"Not enough active participants ({len(active_participants)}) for {num_tables} tables. "
                f"Need at least {num_tables} participants.",
            )

        logger.info(
            f"Regenerating session {session_number} for program {program_id}: "
            f"{len(active_participants)} active participants, {num_tables} tables, "
            f"{len(historical_pairings)} historical pairings to avoid, "
            f"{len(current_table_assignments)} current assignments to FORBID (hard constraint), "
            f"max_time={max_time_seconds}s"
        )

        # 6. Try to solve with HARD constraint: participants cannot be assigned to same tables
        logger.info(
            "Attempt 1: Solving with HARD constraint (must generate different assignments)"
        )
        builder = GroupBuilder(
            participants=active_participants,
            num_tables=num_tables,
            num_sessions=1,  # Only regenerating one session
            historical_pairings=historical_pairings,  # Pass existing pairings
            current_table_assignments=current_table_assignments,  # FORBID same assignments
            pairing_window_size=assignment_set.get("pairing_window_size"),
            solver_num_workers=4,
            require_different_assignments=True,  # HARD CONSTRAINT
        )

        result = builder.generate_assignments(max_time_seconds=max_time_seconds)
        assignments_unchanged = False

        # If hard constraint fails, try again without it (current assignments may be optimal)
        if result["status"] != "success":
            logger.warning(
                f"Hard constraint failed (status: {result.get('status')}). "
                f"Attempting fallback: same assignments may be optimal"
            )
            logger.info(
                "Attempt 2: Solving WITHOUT hard constraint (may return same assignments)"
            )

            # Retry without hard constraint
            builder_fallback = GroupBuilder(
                participants=active_participants,
                num_tables=num_tables,
                num_sessions=1,
                historical_pairings=historical_pairings,
                current_table_assignments=current_table_assignments,  # Soft penalty, not forbidden
                pairing_window_size=assignment_set.get("pairing_window_size"),
                solver_num_workers=4,
                require_different_assignments=False,  # SOFT CONSTRAINT (allow same assignments)
            )

            result = builder_fallback.generate_assignments(
                max_time_seconds=max_time_seconds
            )

            if result["status"] != "success":
                error_msg = result.get("error", "No feasible solution found")
                logger.error(f"Solver failed even without hard constraint: {error_msg}")
                raise HTTPException(status_code=400, detail=error_msg)

            # Mark that assignments are unchanged
            assignments_unchanged = True
            logger.info(
                "Fallback succeeded: returning same assignments (these are already optimal)"
            )

        # Log solver statistics
        logger.info(
            f"Solver [{len(active_participants)}p/{num_tables}t/1s]: "
            f"{result.get('solution_quality', 'unknown').upper()} in {result.get('solve_time', 0):.2f}s | "
            f"Deviation: {result.get('total_deviation', 'N/A')} | "
            f"Unchanged: {assignments_unchanged}"
        )

        # 7. Merge regenerated session back into full assignments
        new_assignments = existing_assignments.copy()
        new_assignments[session_number - 1] = {
            "session": session_number,
            "tables": result["assignments"][0]["tables"],  # Result only has 1 session
            "absentParticipants": absent_participants,
        }

        # 8. Store as new version
        result_metadata = {
            "solution_quality": result.get("solution_quality"),
            "solve_time": result.get("solve_time"),
            "total_deviation": result.get("total_deviation"),
            "max_time_seconds": max_time_seconds,
            "regenerated": True,
            "regenerated_session": session_number,
            "label": f"Session {session_number} shuffled",
            "assignments_unchanged": assignments_unchanged,  # Flag if same assignments returned
        }

        new_version_id = _next_version_id(storage, program_id, set_id)

        storage.save_version(
            program_id=program_id,
            set_id=set_id,
            version_id=new_version_id,
            assignments=new_assignments,
            metadata=result_metadata,
        )

        logger.info(
            f"Stored regenerated session {session_number} as version {new_version_id} (unchanged: {assignments_unchanged})"
        )

        return {
            "assignments": new_assignments,
            "version_id": new_version_id,
            "session": session_number,
            "solve_time": result.get("solve_time"),
            "quality": result.get("solution_quality"),
            "assignments_unchanged": assignments_unchanged,  # Frontend can show notification
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to regenerate single session: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="An error occurred while regenerating the session. Please try again or contact support if the problem persists.",
        )


@router.get("/results")
async def get_cached_results(
    program_id: str = Depends(validate_program_access),
    version: Optional[str] = Query(
        None, description="Version ID (e.g., 'v1'). Defaults to latest.", max_length=10
    ),
    assignment_set_id: Optional[str] = Query(
        None,
        description="Assignment set the version belongs to. Defaults to current.",
        max_length=64,
    ),
    storage: AssignmentSetStorage = Depends(get_assignment_set_storage),
):
    """Get assignment results for one version of a readable assignment set.

    Defaults to the current set. A previous set may be named explicitly, which
    is how History reads a version minted before the last setup change.
    """
    set_id = _resolve_readable_set_id(storage, program_id, assignment_set_id)

    logger.info(
        f"Retrieving cached results for program: {program_id}, version: {version or 'latest'}"
    )

    result_data = storage.get_version(program_id, set_id, version_id=version)

    if result_data is None:
        if version:
            logger.warning(f"Version {version} not found for program: {program_id}")
            raise HTTPException(status_code=404, detail=f"Version {version} not found.")
        logger.warning(f"No cached results for program: {program_id}")
        raise HTTPException(status_code=404, detail="Results not found.")

    return result_data["assignments"]


@router.get("/results/versions")
async def get_result_version_list(
    program_id: str = Depends(validate_program_access),
    storage: AssignmentSetStorage = Depends(get_assignment_set_storage),
):
    """Versions for the current assignment set, then the one before it.

    History reaches back exactly one set. Further back would be the browsable
    archive this redesign deleted; no further back leaves the divider at the
    setup change with nothing to draw.
    """
    current_set_id, current_set = _require_current_set(storage, program_id)

    logger.info(f"Retrieving version list for program: {program_id}")

    recent_sets = storage.list_recent_sets(program_id, limit=2)

    entries: List[Dict[str, Any]] = []
    for assignment_set in recent_sets:
        set_id = assignment_set.get("assignment_set_id")
        is_current = set_id == current_set_id

        reason = None
        if not is_current:
            reason = roster_change_reason(
                old_participants=assignment_set.get("participant_data", []),
                current_participants=current_set.get("participant_data", []),
                change_date=_format_set_date(current_set.get("created_at")),
            )

        for version in storage.list_versions(program_id, set_id):
            entries.append(
                {
                    **version,
                    "assignment_set_id": set_id,
                    "label": (version.get("metadata") or {}).get("label"),
                    "promotable": is_current,
                    "not_promotable_reason": reason,
                }
            )

    if not entries:
        logger.warning(f"No versions found for program: {program_id}")
        raise HTTPException(
            status_code=404, detail="No results found for this program."
        )

    return {"versions": entries}


@router.post("/results/save")
async def save_edited_assignments(
    request: Request,
    program_id: str = Depends(validate_program_access),
    body: Dict[str, Any] = Body(...),
    storage: AssignmentSetStorage = Depends(get_assignment_set_storage),
    completion: SessionCompletionStorage = Depends(get_session_completion_storage),
):
    """Save manually edited assignments as a new version."""
    set_id = _require_current_set_id(storage, program_id)

    assignments = body.get("assignments")
    based_on_version = body.get("based_on_version")

    # Item 7's rule — the caller that knows what happened writes the label —
    # applied to a caller Item 7 could not yet see. A blank or non-string label
    # falls back rather than putting an empty row in History.
    label = body.get("label")
    if not isinstance(label, str) or not label.strip():
        label = LABEL_MANUAL_EDIT

    if not assignments:
        raise HTTPException(status_code=400, detail="assignments is required")

    _require_wellformed_assignments(assignments)

    current = storage.get_version(program_id, set_id)
    if current is not None:
        _refuse_if_completed_sessions_changed(
            completion, program_id, current.get("assignments"), assignments
        )

    try:
        version_id = _next_version_id(storage, program_id, set_id)

        metadata = {
            "source": "manual_edit",
            "based_on": based_on_version,
            "label": label,
        }

        storage.save_version(
            program_id=program_id,
            set_id=set_id,
            version_id=version_id,
            assignments=assignments,
            metadata=metadata,
        )

        logger.info(
            f"Saved manual edits as version {version_id} for program {program_id}"
        )

        return {"version_id": version_id}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to save edited assignments: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to save edited assignments")


@router.post("/results/promote/{version_id}")
async def promote_version(
    version_id: str = Path(..., max_length=10),
    program_id: str = Depends(validate_program_access),
    assignment_set_id: Optional[str] = Query(None, max_length=64),
    storage: AssignmentSetStorage = Depends(get_assignment_set_storage),
    completion: SessionCompletionStorage = Depends(get_session_completion_storage),
):
    """Make an older version current again, by writing it as a new version.

    Promotion is not a rewind — the chain only ever grows, so undoing a shuffle
    leaves you at a new version whose content equals an old one. History stays
    honest about what happened and when.
    """
    current_set_id, current_set = _require_current_set(storage, program_id)

    if assignment_set_id and assignment_set_id != current_set_id:
        older = storage.get_set(program_id, assignment_set_id)
        if older is None:
            raise HTTPException(status_code=404, detail=SET_OUT_OF_WINDOW)
        raise HTTPException(
            status_code=409,
            detail=roster_change_reason(
                old_participants=older.get("participant_data", []),
                current_participants=current_set.get("participant_data", []),
                change_date=_format_set_date(current_set.get("created_at")),
            ),
        )

    promoted = storage.get_version(program_id, current_set_id, version_id=version_id)
    if promoted is None:
        raise HTTPException(status_code=404, detail=f"Version {version_id} not found.")

    assignments = promoted.get("assignments")
    _require_wellformed_assignments(assignments)

    current = storage.get_version(program_id, current_set_id)
    if current is not None:
        _refuse_if_completed_sessions_changed(
            completion, program_id, current.get("assignments"), assignments
        )

    promoted_label = (promoted.get("metadata") or {}).get("label") or version_id
    label = f'Restored "{promoted_label}"'

    new_version_id = _next_version_id(storage, program_id, current_set_id)
    storage.save_version(
        program_id=program_id,
        set_id=current_set_id,
        version_id=new_version_id,
        assignments=assignments,
        metadata={
            "source": "promotion",
            "based_on": version_id,
            "label": label,
        },
    )

    logger.info(f"Promoted {version_id} as {new_version_id} for program {program_id}")

    return {"version_id": new_version_id, "label": label}


@router.get("/metadata")
async def get_assignment_set_metadata(
    program_id: str = Depends(validate_program_access),
    storage: AssignmentSetStorage = Depends(get_assignment_set_storage),
):
    """Get metadata about the program's current assignment set."""
    set_id, assignment_set = _require_current_set(storage, program_id)

    logger.info(f"Retrieving assignment set metadata for program: {program_id}")

    created_at = assignment_set.get("created_at")
    created_at_unix = created_at.timestamp() if created_at else None

    return {
        "assignment_set_id": set_id,
        "filename": assignment_set.get("filename", "Unknown"),
        "num_participants": len(assignment_set.get("participant_data", [])),
        "num_tables": assignment_set.get("num_tables"),
        "num_sessions": assignment_set.get("num_sessions"),
        "created_at": created_at_unix,
        "has_results": storage.get_version(program_id, set_id) is not None,
    }


@router.get("/completion")
async def get_session_completion(
    program_id: str = Depends(validate_program_access),
    storage: AssignmentSetStorage = Depends(get_assignment_set_storage),
    completion: SessionCompletionStorage = Depends(get_session_completion_storage),
):
    """How many leading Sessions (meeting nights) are complete."""
    _require_current_set_id(storage, program_id)

    return {"completed_through": completion.get_completed_through(program_id)}


@router.post("/completion/{session_number}")
async def mark_session_complete(
    session_number: int = Path(..., description="Session number (1-based)", ge=1),
    program_id: str = Depends(validate_program_access),
    storage: AssignmentSetStorage = Depends(get_assignment_set_storage),
    completion: SessionCompletionStorage = Depends(get_session_completion_storage),
):
    """Mark one Session complete. Idempotent, and only ever the next one."""
    _validate_session_number(storage, program_id, session_number)

    completed_through = completion.get_completed_through(program_id)
    if session_number > completed_through + 1:
        raise HTTPException(
            status_code=400,
            detail=out_of_order_completion_refusal(session_number, completed_through),
        )

    completed = completion.mark_complete(program_id, session_number)
    logger.info(f"Marked session {session_number} complete for program {program_id}")

    return {"completed_through": completed}


@router.delete("/completion/{session_number}")
async def reopen_session(
    session_number: int = Path(..., description="Session number (1-based)", ge=1),
    program_id: str = Depends(validate_program_access),
    completion: SessionCompletionStorage = Depends(get_session_completion_storage),
):
    """Reopen the most recently completed Session.

    Only the latest may be reopened: completion is a prefix, so reopening below
    the last completed Session would leave a gap. Nothing needs range-checking
    here — a session number the program does not contain is necessarily above
    ``completed_through``, which is a no-op.
    """
    completed_through = completion.get_completed_through(program_id)
    if 0 < session_number < completed_through:
        raise HTTPException(
            status_code=400,
            detail=out_of_order_reopen_refusal(session_number, completed_through),
        )

    completed = completion.mark_incomplete(program_id, session_number)
    logger.info(f"Reopened session {session_number} for program {program_id}")

    return {"completed_through": completed}


class SeatingRequest(BaseModel):
    assignments: List[Dict[str, Any]]


@router.post("/seating/{session_number}")
async def generate_seating_chart(
    request: SeatingRequest,
    session_number: int = Path(..., description="Session number (1-based)", ge=1),
    program_id: str = Depends(validate_program_access),
):
    """
    Generate circular seating arrangements for one session (meeting night).

    Distributes religions evenly around each table.
    """
    # Find the requested session
    session_data = next(
        (a for a in request.assignments if a["session"] == session_number), None
    )

    if not session_data:
        raise HTTPException(
            status_code=404, detail=f"Session {session_number} not found"
        )

    # Arrange each table
    tables = []
    for table_num_str, participants in session_data["tables"].items():
        table_num = int(table_num_str)

        # Filter out any null/empty participants
        valid_participants = [p for p in participants if p]

        # Arrange seats
        arranged_seats = arrange_circular_seating(valid_participants)

        tables.append({"table_number": table_num, "seats": arranged_seats})

    # Sort tables by number
    tables.sort(key=lambda t: t["table_number"])

    return {
        "session": session_number,
        "tables": tables,
        "absent_participants": session_data.get("absentParticipants", []),
    }
