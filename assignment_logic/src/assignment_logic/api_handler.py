from assignment_logic.group_builder import GroupBuilder
import logging

logger = logging.getLogger(__name__)

def handle_generate_assignments(participants_df, numTables, numSessions, use_incremental=None, max_time_seconds=120):
    """
    Generate table assignments using the constraint solver.

    Args:
        participants_df: List of participant dictionaries
        numTables: Number of tables
        numSessions: Number of sessions
        use_incremental: If True, use incremental solving. If None, auto-decide based on problem size.
        max_time_seconds: Total time budget for solving (default: 120s)

    Returns:
        dict: Results with assignments and metadata
    """
    builder = GroupBuilder(participants_df, numTables, numSessions)

    # Auto-decide whether to use incremental solving
    if use_incremental is None:
        # Use incremental for 4+ sessions (dramatically faster for larger problems)
        use_incremental = numSessions >= 4

    if use_incremental:
        logger.info(f"Using incremental solver (batch size: 2, timeout: {max_time_seconds}s)")
        results = builder.generate_assignments_incremental(batch_size=2, max_time_seconds=max_time_seconds)
    else:
        logger.info(f"Using regular solver (timeout: {max_time_seconds}s)")
        results = builder.generate_assignments(max_time_seconds=max_time_seconds)

    return results
