from fastapi import APIRouter, HTTPException
from assignment_logic.api_handler import handle_generate_assignments
from api.storage import get_session, session_exists, store_result, get_result, result_exists
from api.email import send_magic_link_email
from datetime import datetime
import logging

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
