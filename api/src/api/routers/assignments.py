from fastapi import APIRouter, HTTPException
from assignment_logic.api_handler import handle_generate_assignments
from api.storage import get_session, session_exists, store_result, get_result, result_exists, store_session
from api.email import send_magic_link_email
from datetime import datetime
import logging
import uuid

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/")
def get_assignments(session_id: str):
    logger.info(f"Generating assignments for session: {session_id}")

    if not session_exists(session_id):
        logger.warning(f"Session not found: {session_id}")
        raise HTTPException(status_code=404, detail="Session not found. Please upload a file first.")

    try:
        session_data = get_session(session_id)
        participants_dict = session_data["participant_dict"]
        num_tables = session_data["num_tables"]
        num_sessions = session_data["num_sessions"]

        logger.info(f"Starting solver with {len(participants_dict)} participants, {num_tables} tables, {num_sessions} sessions")

        results = handle_generate_assignments(participants_dict, num_tables, num_sessions)

        if results['status'] != 'success':
            error_msg = results.get('error', 'No feasible solution found')
            logger.error(f"Solver failed: {error_msg}")
            raise HTTPException(status_code=400, detail=error_msg)

        logger.info(f"Successfully generated assignments (quality: {results.get('solution_quality', 'unknown')}, "
                   f"time: {results.get('solve_time', 'unknown')}s)")

        # Debug: Log the results to see if there's NaN
        logger.info(f"Results keys: {results.keys()}")
        logger.info(f"total_deviation value: {results.get('total_deviation')} (type: {type(results.get('total_deviation'))})")

        store_result(session_id, {
            "assignments": results['assignments'],
            "metadata": {
                "solution_quality": results.get('solution_quality'),
                "solve_time": results.get('solve_time'),
                "total_deviation": results.get('total_deviation')
            },
            "created_at": datetime.now().isoformat()
        })

        # Send magic link email if provided
        user_email = session_data.get("email")
        if user_email:
            magic_link_path = f"/table-assignments?session={session_id}"
            send_magic_link_email(
                to_email=user_email,
                magic_link_path=magic_link_path,
                num_sessions=num_sessions,
                num_tables=num_tables
            )

        # Keep upload data for regeneration (auto-cleaned after 1 hour)
        # Debug: Check what we're about to return
        import json
        try:
            json.dumps(results['assignments'])
            logger.info("Assignments are JSON serializable")
        except Exception as e:
            logger.error(f"Assignments NOT JSON serializable: {e}")
            logger.error(f"Assignments preview: {str(results['assignments'])[:500]}")

        return results['assignments']
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to generate assignments: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to generate assignments: {str(e)}")

@router.post("/regenerate/{session_id}")
async def regenerate_assignments(session_id: str):
    """Regenerate assignments using the same upload data (within 1 hour of upload)"""
    logger.info(f"Regenerating assignments for session: {session_id}")

    if not session_exists(session_id):
        logger.warning(f"Session not found or expired: {session_id}")
        raise HTTPException(
            status_code=404,
            detail="Session expired. Upload data is only kept for 1 hour. Please upload again."
        )

    try:
        session_data = get_session(session_id)
        participants_dict = session_data["participant_dict"]
        num_tables = session_data["num_tables"]
        num_sessions = session_data["num_sessions"]

        logger.info(f"Regenerating with {len(participants_dict)} participants, {num_tables} tables, {num_sessions} sessions")

        results = handle_generate_assignments(participants_dict, num_tables, num_sessions)

        if results['status'] != 'success':
            error_msg = results.get('error', 'No feasible solution found')
            logger.error(f"Regeneration failed: {error_msg}")
            raise HTTPException(status_code=400, detail=error_msg)

        logger.info(f"Successfully regenerated assignments (quality: {results.get('solution_quality', 'unknown')}, "
                   f"time: {results.get('solve_time', 'unknown')}s)")

        store_result(session_id, {
            "assignments": results['assignments'],
            "metadata": {
                "solution_quality": results.get('solution_quality'),
                "solve_time": results.get('solve_time'),
                "total_deviation": results.get('total_deviation'),
                "regenerated": True
            },
            "created_at": datetime.now().isoformat()
        })

        return results['assignments']
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to regenerate assignments: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to regenerate assignments: {str(e)}")


@router.get("/results/{session_id}")
async def get_cached_results(session_id: str):
    logger.info(f"Retrieving cached results for session: {session_id}")

    if not result_exists(session_id):
        logger.warning(f"No cached results for session: {session_id}")
        raise HTTPException(status_code=404, detail="Results not found or expired. Links expire after 30 days.")

    result_data = get_result(session_id)
    return result_data["assignments"]


@router.get("/sessions/{session_id}/metadata")
async def get_session_metadata(session_id: str):
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
    }


@router.post("/sessions/{session_id}/clone")
async def clone_session_with_params(session_id: str, num_tables: int, num_sessions: int):
    """Clone a session with new table/session parameters (reuses participant data)"""
    logger.info(f"Cloning session {session_id} with new params: tables={num_tables}, sessions={num_sessions}")

    if not session_exists(session_id):
        logger.warning(f"Source session not found or expired: {session_id}")
        raise HTTPException(status_code=404, detail="Source session not found or expired.")

    # Validate parameters
    if num_tables < 1 or num_tables > 10:
        raise HTTPException(status_code=400, detail="Number of tables must be between 1 and 10.")
    if num_sessions < 1 or num_sessions > 6:
        raise HTTPException(status_code=400, detail="Number of sessions must be between 1 and 6.")

    # Get original session data
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
