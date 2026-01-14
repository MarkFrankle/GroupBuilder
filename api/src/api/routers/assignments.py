from fastapi import APIRouter, HTTPException, Query, Path, Request, Body
from assignment_logic.api_handler import handle_generate_assignments
from assignment_logic.group_builder import GroupBuilder
from api.storage import (
    get_session, session_exists, store_result, get_result, result_exists,
    store_session, get_result_versions
)
from api.utils.seating_arrangement import arrange_circular_seating
from slowapi import Limiter
from slowapi.util import get_remote_address
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
import logging
import uuid
import os

logger = logging.getLogger(__name__)
router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


def _extract_pairings_from_sessions(assignments: List[Dict[str, Any]], exclude_session: int) -> set:
    """
    Extract all participant pairings from sessions except the one being regenerated.

    Args:
        assignments: List of session assignments
        exclude_session: Session number to exclude (the one being regenerated)

    Returns:
        Set of tuples representing pairs that have met in other sessions
    """
    historical_pairings = set()

    for session_data in assignments:
        session_num = session_data['session']

        # Skip the session we're regenerating
        if session_num == exclude_session:
            continue

        # Extract pairings from each table in this session
        for table_num, participants in session_data['tables'].items():
            # Create pairs for all participants at this table
            for i in range(len(participants)):
                for j in range(i + 1, len(participants)):
                    p1 = participants[i]['name']
                    p2 = participants[j]['name']
                    # Use sorted tuple so (Alice, Bob) == (Bob, Alice)
                    pair_key = tuple(sorted([p1, p2]))
                    historical_pairings.add(pair_key)

    logger.info(f"Extracted {len(historical_pairings)} historical pairings from {len(assignments) - 1} sessions")
    return historical_pairings


def _get_active_participants(all_participants: List[Dict[str, Any]], absent_participants: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Get list of participants who should be assigned in this session.

    Args:
        all_participants: Full list of participants
        absent_participants: List of participants to mark as absent

    Returns:
        List of active participants (excluding absences)
    """
    absent_names = {p['name'] for p in absent_participants}
    active = [p for p in all_participants if p['name'] not in absent_names]

    logger.info(f"Active participants: {len(active)} (total: {len(all_participants)}, absent: {len(absent_names)})")
    return active


def _extract_current_table_assignments(
    session_assignment: Dict[str, Any],
    participant_dict: List[Dict[str, Any]]
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
    name_to_id = {p['name']: p['id'] for p in participant_dict}

    current_assignments = {}

    for table_num_str, participants in session_assignment['tables'].items():
        table_idx = int(table_num_str) - 1  # Convert from 1-indexed to 0-indexed
        for participant in participants:
            if participant:  # Skip None/null entries
                participant_id = name_to_id.get(participant['name'])
                if participant_id is not None:
                    current_assignments[participant_id] = table_idx

    logger.info(f"Extracted {len(current_assignments)} current table assignments to prefer avoiding")
    return current_assignments


def _generate_assignments_internal(session_id: str, mark_regenerated: bool = False, max_time_seconds: int = 120):
    """
    Internal helper to generate assignments (shared by get_assignments and regenerate_assignments).

    Args:
        session_id: The session ID
        mark_regenerated: Whether to mark results as regenerated
        max_time_seconds: Maximum solver time in seconds (default: 120)

    Returns:
        Tuple of (assignments, version_id, metadata)
    """
    session_data = get_session(session_id)
    participants_dict = session_data["participant_dict"]
    num_tables = session_data["num_tables"]
    num_sessions = session_data["num_sessions"]

    logger.info(
        f"{'Regenerating' if mark_regenerated else 'Generating'} assignments for session {session_id}: "
        f"{len(participants_dict)} participants, {num_tables} tables, {num_sessions} sessions, "
        f"max_time={max_time_seconds}s"
    )

    results = handle_generate_assignments(participants_dict, num_tables, num_sessions, max_time_seconds=max_time_seconds)

    if results['status'] != 'success':
        error_msg = results.get('error', 'No feasible solution found')
        logger.error(f"Solver failed: {error_msg}")
        raise HTTPException(status_code=400, detail=error_msg)

    # Log solver statistics
    num_branches = results.get('num_branches', 'N/A')
    num_conflicts = results.get('num_conflicts', 'N/A')
    branches_str = f"{num_branches:,}" if isinstance(num_branches, int) else num_branches
    conflicts_str = f"{num_conflicts:,}" if isinstance(num_conflicts, int) else num_conflicts

    logger.info(
        f"Solver [{len(participants_dict)}p/{num_tables}t/{num_sessions}s]: "
        f"{results.get('solution_quality', 'unknown').upper()} in {results.get('solve_time', 0):.2f}s | "
        f"Deviation: {results.get('total_deviation', 'N/A')} | "
        f"Branches: {branches_str} | "
        f"Conflicts: {conflicts_str}"
    )

    # Prepare result data
    result_metadata = {
        "solution_quality": results.get('solution_quality'),
        "solve_time": results.get('solve_time'),
        "total_deviation": results.get('total_deviation'),
        "max_time_seconds": max_time_seconds
    }

    if mark_regenerated:
        result_metadata["regenerated"] = True

    # Store results
    version_id = store_result(session_id, {
        "assignments": results['assignments'],
        "metadata": result_metadata,
        "created_at": datetime.now().isoformat()
    })

    return results['assignments'], version_id, result_metadata


@router.get("/")
@limiter.limit("5/minute")  # Limit expensive solver operations
def get_assignments(
    request: Request,
    session_id: str = Query(..., description="Session ID", min_length=36, max_length=36, pattern="^[a-f0-9-]{36}$"),
    max_time_seconds: int = Query(120, ge=30, le=240, description="Maximum solver time in seconds (30-240)")
):
    """Generate assignments for a session."""
    if not session_exists(session_id):
        logger.warning(f"Session not found: {session_id}")
        raise HTTPException(status_code=404, detail="Session not found. Please upload a file first.")

    try:
        assignments, _, _ = _generate_assignments_internal(
            session_id=session_id,
            mark_regenerated=False,
            max_time_seconds=max_time_seconds
        )
        return assignments
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to generate assignments: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="An error occurred while generating assignments. Please try again or contact support if the problem persists."
        )

@router.post("/regenerate/{session_id}")
@limiter.limit("5/minute")  # Limit expensive solver operations
async def regenerate_assignments(
    request: Request,
    session_id: str = Path(..., description="Session ID", min_length=36, max_length=36, pattern="^[a-f0-9-]{36}$"),
    max_time_seconds: int = Query(120, ge=30, le=240, description="Maximum solver time in seconds (30-240)")
):
    """Regenerate assignments using the same upload data (within 1 hour of upload)"""
    if not session_exists(session_id):
        logger.warning(f"Session not found or expired: {session_id}")
        raise HTTPException(
            status_code=404,
            detail="Session expired. Upload data is only kept for 1 hour. Please upload again."
        )

    try:
        assignments, version_id, _ = _generate_assignments_internal(
            session_id=session_id,
            mark_regenerated=True,
            max_time_seconds=max_time_seconds
        )

        logger.info(f"Stored regenerated results as {version_id}")

        return {
            "assignments": assignments,
            "version_id": version_id
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to regenerate assignments: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="An error occurred while regenerating assignments. Please try again or contact support if the problem persists."
        )


@router.post("/regenerate/{session_id}/session/{session_number}")
@limiter.limit("20/minute")  # More lenient for single session (much cheaper than full regeneration)
async def regenerate_single_session(
    request: Request,
    session_id: str = Path(..., description="Session ID", min_length=36, max_length=36, pattern="^[a-f0-9-]{36}$"),
    session_number: int = Path(..., description="Session number to regenerate (1-based)", ge=1, le=6),
    max_time_seconds: int = Query(120, ge=30, le=240, description="Maximum solver time in seconds (30-240)"),
    version_id: Optional[str] = Query(None, description="Version ID to base regeneration on (defaults to latest)"),
    absent_participants: List[Dict[str, Any]] = Body(default=[])
):
    """
    Regenerate a single session while keeping other sessions unchanged.

    This endpoint allows regenerating just one problematic session (e.g., session 2)
    while preserving the assignments for all other sessions. The solver will avoid
    pairing participants who sat together in other sessions.

    Args:
        session_id: The session ID
        session_number: Which session to regenerate (1-based index)
        max_time_seconds: Solver time limit
        version_id: Which version to base regeneration on (default: latest)
        absent_participants: List of participants to mark absent for this session

    Returns:
        New version with the regenerated session merged in
    """
    if not session_exists(session_id):
        logger.warning(f"Session not found or expired: {session_id}")
        raise HTTPException(
            status_code=404,
            detail="Session expired. Upload data is only kept for 1 hour. Please upload again."
        )

    try:
        # 1. Get existing session data
        session_data = get_session(session_id)
        num_tables = session_data["num_tables"]
        num_sessions = session_data["num_sessions"]
        all_participants = session_data["participant_dict"]

        # Validate session number
        if session_number > num_sessions:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid session number {session_number}. This session only has {num_sessions} sessions."
            )

        # 2. Get current assignments (from specified version or latest)
        current_result = get_result(session_id, version_id=version_id)
        if current_result is None:
            raise HTTPException(
                status_code=404,
                detail="No existing results found. Please generate assignments first before regenerating a specific session."
            )

        existing_assignments = current_result['assignments']

        # 3. Extract historical pairings from OTHER sessions
        historical_pairings = _extract_pairings_from_sessions(
            existing_assignments,
            exclude_session=session_number
        )

        # 4. Extract current table assignments to prefer variety
        session_assignment = existing_assignments[session_number - 1]
        current_table_assignments = _extract_current_table_assignments(
            session_assignment,
            all_participants
        )

        # 5. Get active participants for this session
        active_participants = _get_active_participants(
            all_participants,
            absent_participants
        )

        # Validate we have enough participants for the tables
        if len(active_participants) < num_tables:
            raise HTTPException(
                status_code=400,
                detail=f"Not enough active participants ({len(active_participants)}) for {num_tables} tables. "
                       f"Need at least {num_tables} participants."
            )

        logger.info(
            f"Regenerating session {session_number} for session_id {session_id}: "
            f"{len(active_participants)} active participants, {num_tables} tables, "
            f"{len(historical_pairings)} historical pairings to avoid, "
            f"{len(current_table_assignments)} current assignments to FORBID (hard constraint), "
            f"max_time={max_time_seconds}s"
        )

        # 6. Try to solve with HARD constraint: participants cannot be assigned to same tables
        logger.info("Attempt 1: Solving with HARD constraint (must generate different assignments)")
        builder = GroupBuilder(
            participants=active_participants,
            num_tables=num_tables,
            num_sessions=1,  # Only regenerating one session
            historical_pairings=historical_pairings,  # Pass existing pairings
            current_table_assignments=current_table_assignments,  # FORBID same assignments
            pairing_window_size=session_data.get('pairing_window_size'),
            solver_num_workers=4,
            require_different_assignments=True  # HARD CONSTRAINT
        )

        result = builder.generate_assignments(max_time_seconds=max_time_seconds)
        assignments_unchanged = False

        # If hard constraint fails, try again without it (current assignments may be optimal)
        if result['status'] != 'success':
            logger.warning(
                f"Hard constraint failed (status: {result.get('status')}). "
                f"Attempting fallback: same assignments may be optimal"
            )
            logger.info("Attempt 2: Solving WITHOUT hard constraint (may return same assignments)")

            # Retry without hard constraint
            builder_fallback = GroupBuilder(
                participants=active_participants,
                num_tables=num_tables,
                num_sessions=1,
                historical_pairings=historical_pairings,
                current_table_assignments=current_table_assignments,  # Soft penalty, not forbidden
                pairing_window_size=session_data.get('pairing_window_size'),
                solver_num_workers=4,
                require_different_assignments=False  # SOFT CONSTRAINT (allow same assignments)
            )

            result = builder_fallback.generate_assignments(max_time_seconds=max_time_seconds)

            if result['status'] != 'success':
                error_msg = result.get('error', 'No feasible solution found')
                logger.error(f"Solver failed even without hard constraint: {error_msg}")
                raise HTTPException(status_code=400, detail=error_msg)

            # Mark that assignments are unchanged
            assignments_unchanged = True
            logger.info("Fallback succeeded: returning same assignments (these are already optimal)")

        # Log solver statistics
        logger.info(
            f"Solver [{len(active_participants)}p/{num_tables}t/1s]: "
            f"{result.get('solution_quality', 'unknown').upper()} in {result.get('solve_time', 0):.2f}s | "
            f"Deviation: {result.get('total_deviation', 'N/A')} | "
            f"Unchanged: {assignments_unchanged}"
        )

        # 6. Merge regenerated session back into full assignments
        new_assignments = existing_assignments.copy()
        new_assignments[session_number - 1] = {
            'session': session_number,
            'tables': result['assignments'][0]['tables'],  # Result only has 1 session
            'absentParticipants': absent_participants
        }

        # 7. Store as new version
        result_metadata = {
            "solution_quality": result.get('solution_quality'),
            "solve_time": result.get('solve_time'),
            "total_deviation": result.get('total_deviation'),
            "max_time_seconds": max_time_seconds,
            "regenerated": True,
            "regenerated_session": session_number,
            "assignments_unchanged": assignments_unchanged  # Flag if same assignments returned
        }

        version_id = store_result(session_id, {
            "assignments": new_assignments,
            "metadata": result_metadata,
            "created_at": datetime.now().isoformat()
        })

        logger.info(f"Stored regenerated session {session_number} as version {version_id} (unchanged: {assignments_unchanged})")

        return {
            "assignments": new_assignments,
            "version_id": version_id,
            "session": session_number,
            "solve_time": result.get('solve_time'),
            "quality": result.get('solution_quality'),
            "assignments_unchanged": assignments_unchanged  # Frontend can show notification
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to regenerate single session: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="An error occurred while regenerating the session. Please try again or contact support if the problem persists."
        )


@router.get("/results/{session_id}")
async def get_cached_results(
    session_id: str = Path(..., description="Session ID", min_length=36, max_length=36, pattern="^[a-f0-9-]{36}$"),
    version: Optional[str] = Query(None, description="Version ID (e.g., 'v1'). Defaults to latest.", max_length=10)
):
    logger.info(f"Retrieving cached results for session: {session_id}, version: {version or 'latest'}")

    if not result_exists(session_id):
        logger.warning(f"No cached results for session: {session_id}")
        raise HTTPException(status_code=404, detail="Results not found or expired. Links expire after 30 days.")

    result_data = get_result(session_id, version_id=version)

    if result_data is None:
        logger.warning(f"Version {version} not found for session: {session_id}")
        raise HTTPException(status_code=404, detail=f"Version {version} not found.")

    return result_data["assignments"]


@router.get("/results/{session_id}/versions")
async def get_result_version_list(
    session_id: str = Path(..., description="Session ID", min_length=36, max_length=36, pattern="^[a-f0-9-]{36}$")
):
    """Get list of all result versions for a session"""
    logger.info(f"Retrieving version list for session: {session_id}")

    versions = get_result_versions(session_id)

    if not versions:
        logger.warning(f"No versions found for session: {session_id}")
        raise HTTPException(status_code=404, detail="No results found for this session.")

    return {"versions": versions}


@router.get("/sessions/{session_id}/metadata")
async def get_session_metadata(
    session_id: str = Path(..., description="Session ID", min_length=36, max_length=36, pattern="^[a-f0-9-]{36}$")
):
    """Get metadata about a session for displaying in Recent Uploads"""
    logger.info(f"Retrieving metadata for session: {session_id}")

    if not session_exists(session_id):
        logger.warning(f"Session not found or expired: {session_id}")
        raise HTTPException(status_code=404, detail="Session not found or expired.")

    session_data = get_session(session_id)

    return {
        "session_id": session_id,
        "filename": session_data.get("filename", "Unknown"),
        "num_participants": len(session_data.get("participant_dict", {})),
        "num_tables": session_data.get("num_tables"),
        "num_sessions": session_data.get("num_sessions"),
        "created_at": session_data.get("created_at"),
        "has_results": result_exists(session_id),
    }


@router.post("/sessions/{session_id}/clone")
async def clone_session_with_params(
    session_id: str = Path(..., description="Session ID", min_length=36, max_length=36, pattern="^[a-f0-9-]{36}$"),
    num_tables: int = Query(..., ge=1, le=10, description="Number of tables (1-10)"),
    num_sessions: int = Query(..., ge=1, le=6, description="Number of sessions (1-6)")
):
    """Clone a session with new table/session parameters (reuses participant data)"""
    logger.info(f"Cloning session {session_id} with new params: tables={num_tables}, sessions={num_sessions}")

    if not session_exists(session_id):
        logger.warning(f"Source session not found or expired: {session_id}")
        raise HTTPException(status_code=404, detail="Source session not found or expired.")

    # Get original session data (validation handled by FastAPI)
    original_session = get_session(session_id)
    participant_dict = original_session.get("participant_dict", [])

    # Validate participant count vs tables
    num_participants = len(participant_dict)
    if num_participants < num_tables:
        raise HTTPException(
            status_code=400,
            detail=f"Not enough participants ({num_participants}) for {num_tables} tables. "
                   f"Need at least {num_tables} participants."
        )

    # Create new session with same participant data but new parameters
    new_session_id = str(uuid.uuid4())

    store_session(new_session_id, {
        "participant_dict": participant_dict,
        "num_tables": num_tables,
        "num_sessions": num_sessions,
        "filename": original_session.get("filename", "Unknown"),
        "created_at": datetime.now().isoformat(),
        "cloned_from": session_id
    })

    logger.info(f"Successfully cloned session. New session ID: {new_session_id}")

    return {
        "message": "Session cloned successfully",
        "session_id": new_session_id
    }


class SeatingRequest(BaseModel):
    assignments: List[Dict[str, Any]]


@router.post("/seating/{session_id}")
async def generate_seating_chart(
    session_id: str,
    session: int,
    request: SeatingRequest
):
    """
    Generate circular seating arrangements for a session.

    Distributes religions evenly around each table.
    """
    # Find the requested session
    session_data = next(
        (a for a in request.assignments if a["session"] == session),
        None
    )

    if not session_data:
        raise HTTPException(status_code=404, detail=f"Session {session} not found")

    # Arrange each table
    tables = []
    for table_num_str, participants in session_data["tables"].items():
        table_num = int(table_num_str)

        # Filter out any null/empty participants
        valid_participants = [p for p in participants if p]

        # Arrange seats
        arranged_seats = arrange_circular_seating(valid_participants)

        tables.append({
            "table_number": table_num,
            "seats": arranged_seats
        })

    # Sort tables by number
    tables.sort(key=lambda t: t["table_number"])

    return {
        "session": session,
        "tables": tables,
        "absent_participants": session_data.get("absentParticipants", [])
    }
