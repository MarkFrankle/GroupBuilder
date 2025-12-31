from fastapi import APIRouter, HTTPException, Query, Path, Request
from assignment_logic.api_handler import handle_generate_assignments
from api.storage import (
    get_session, session_exists, store_result, get_result, result_exists,
    store_session, get_result_versions
)
from api.email import send_magic_link_email
from slowapi import Limiter
from slowapi.util import get_remote_address
from datetime import datetime
import logging
import uuid

logger = logging.getLogger(__name__)
router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


def _generate_assignments_internal(session_id: str, send_email: bool = False, mark_regenerated: bool = False):
    """
    Internal helper to generate assignments (shared by get_assignments and regenerate_assignments).

    Args:
        session_id: The session ID
        send_email: Whether to send email with magic link
        mark_regenerated: Whether to mark results as regenerated

    Returns:
        Tuple of (assignments, version_id, metadata)
    """
    session_data = get_session(session_id)
    participants_dict = session_data["participant_dict"]
    num_tables = session_data["num_tables"]
    num_sessions = session_data["num_sessions"]

    logger.info(
        f"{'Regenerating' if mark_regenerated else 'Generating'} assignments for session {session_id}: "
        f"{len(participants_dict)} participants, {num_tables} tables, {num_sessions} sessions"
    )

    results = handle_generate_assignments(participants_dict, num_tables, num_sessions)

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
        "total_deviation": results.get('total_deviation')
    }

    if mark_regenerated:
        result_metadata["regenerated"] = True

    # Store results
    version_id = store_result(session_id, {
        "assignments": results['assignments'],
        "metadata": result_metadata,
        "created_at": datetime.now().isoformat()
    })

    # Send email if requested
    if send_email and session_data.get("email"):
        send_magic_link_email(
            to_email=session_data["email"],
            magic_link_path=f"/table-assignments?session={session_id}",
            num_sessions=num_sessions,
            num_tables=num_tables
        )

    return results['assignments'], version_id, result_metadata


@router.get("/")
@limiter.limit("5/minute")  # Limit expensive solver operations
def get_assignments(
    request: Request,
    session_id: str = Query(..., description="Session ID", min_length=36, max_length=36, pattern="^[a-f0-9-]{36}$")
):
    """Generate assignments for a session and optionally send email with results link."""
    if not session_exists(session_id):
        logger.warning(f"Session not found: {session_id}")
        raise HTTPException(status_code=404, detail="Session not found. Please upload a file first.")

    try:
        assignments, _, _ = _generate_assignments_internal(
            session_id=session_id,
            send_email=True,
            mark_regenerated=False
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
    session_id: str = Path(..., description="Session ID", min_length=36, max_length=36, pattern="^[a-f0-9-]{36}$")
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
            send_email=False,
            mark_regenerated=True
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


@router.get("/results/{session_id}")
async def get_cached_results(
    session_id: str = Path(..., description="Session ID", min_length=36, max_length=36, pattern="^[a-f0-9-]{36}$"),
    version: str = Query(None, description="Version ID (e.g., 'v1'). Defaults to latest.", max_length=10)
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
        "email": original_session.get("email"),
        "created_at": datetime.now().isoformat(),
        "cloned_from": session_id
    })

    logger.info(f"Successfully cloned session. New session ID: {new_session_id}")

    return {
        "message": "Session cloned successfully",
        "session_id": new_session_id
    }
