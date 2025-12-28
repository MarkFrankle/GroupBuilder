from fastapi import APIRouter, HTTPException
from assignment_logic.api_handler import handle_generate_assignments
from .upload import group_data
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

cached_results = {}

@router.get("/")
def get_assignments(session_id: str):
    logger.info(f"Generating assignments for session: {session_id}")

    if session_id not in group_data:
        logger.warning(f"Session not found in group_data: {session_id}")
        raise HTTPException(status_code=404, detail="Session not found. Please upload a file first.")

    try:
        session_data = group_data[session_id]["data"]
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

        # Cache results with session_id for retrieval
        cached_results[session_id] = {
            "assignments": results['assignments'],
            "metadata": {
                "solution_quality": results.get('solution_quality'),
                "solve_time": results.get('solve_time'),
                "total_deviation": results.get('total_deviation')
            }
        }

        # Don't delete session data immediately - keep it for potential regeneration
        # It will be cleaned up by the cleanup function after 1 hour

        return results['assignments']
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to generate assignments: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to generate assignments: {str(e)}")

@router.get("/results/{session_id}")
async def get_cached_results(session_id: str):
    logger.info(f"Retrieving cached results for session: {session_id}")

    if session_id not in cached_results:
        logger.warning(f"No cached results for session: {session_id}")
        raise HTTPException(status_code=404, detail="No results found for this session. Please generate assignments first.")

    return cached_results[session_id]["assignments"]
