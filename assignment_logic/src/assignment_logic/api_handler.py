import logging

from assignment_logic.capacity_search import find_feasible_plan

logger = logging.getLogger(__name__)


def handle_generate_assignments(
    participants_df,
    numTables,
    numSessions,
    max_time_seconds=120,
    historical_pairings=None,
    total_program_sessions=None,
    historical_tables=None,
):
    """
    Generate table assignments using a single joint CP-SAT solve with two
    hard caps: pairwise repeats and whole-table overlap. Neither cap's
    pigeonhole floor is trusted as achievable on its own - find_feasible_plan
    escalates both from their floors until a real solve succeeds. See
    docs/plans/2026-09-11-dual-cap-solver.md for why this replaced the old
    incremental batcher and soft repeat penalty.
    """
    # find_feasible_plan can run up to max_pairwise_tries * max_overlap_tries
    # probes (12 with its defaults) before giving up - divide the caller's
    # total budget across the worst case rather than handing the full
    # budget to every probe. The common case (any shape with real slack)
    # succeeds on probe 1 and never spends the rest.
    probe_seconds = max(5, max_time_seconds / 12)

    result, pairwise_cap, overlap_cap = find_feasible_plan(
        participants_df,
        numTables,
        numSessions,
        probe_seconds=probe_seconds,
        historical_pairings=historical_pairings,
        total_program_sessions=total_program_sessions,
        historical_tables=historical_tables,
    )
    if result["status"] == "success":
        logger.info(
            f"Solved with pairwise_cap={pairwise_cap}, table_overlap_cap={overlap_cap}"
        )
    else:
        logger.error("No feasible pair of caps found within the search budget")
    return result
