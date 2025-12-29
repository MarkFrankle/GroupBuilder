from assignment_logic.group_builder import GroupBuilder
import logging

logger = logging.getLogger(__name__)

def handle_generate_assignments(participants_df, numTables, numSessions, use_incremental=None):
    """
    Generate table assignments using the constraint solver.

    Args:
        participants_df: List of participant dictionaries
        numTables: Number of tables
        numSessions: Number of sessions
        use_incremental: If True, use incremental solving. If None, auto-decide based on problem size.

    Returns:
        dict: Results with assignments and metadata
    """
    builder = GroupBuilder(participants_df, numTables, numSessions)

    # Auto-decide whether to use incremental solving
    if use_incremental is None:
        # Use incremental for 4+ sessions (dramatically faster for larger problems)
        use_incremental = numSessions >= 4

    if use_incremental:
        logger.info(f"Using incremental solver (batch size: 2)")
        results = builder.generate_assignments_incremental(batch_size=2)
    else:
        logger.info(f"Using regular solver")
        results = builder.generate_assignments()

    return results
