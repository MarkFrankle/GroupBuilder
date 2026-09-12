"""
Finding a working pair of hard caps has no closed form. compute_pairwise_cap
and compute_overlap_lower_bound (capacity.py) each give a weak lower bound -
valid floors that are not guaranteed achievable once couples, linked pairs,
and keep-apart rules reduce the roster's actual degrees of freedom (see the
dual-cap-solver plan's revision note: the pairwise floor in particular was
found genuinely infeasible for a roster with just one couple and one linked
pair, even though it's provably tight for a fully symmetric roster).

This probes upward from both floors with real, bounded solves until one
succeeds: the pairwise cap escalates as the outer loop, the table-overlap
cap as the inner loop at each pairwise value. In the common case - any
roster shape with real slack, i.e. real BBT-program scale - the very first
combination (both floors) succeeds, so the two-level search costs nothing
extra for the case that matters. Only a zero-slack edge case pays for the
extra search.

Each probe's own successful solve IS the final answer - there is no
separate "confirm" pass, so a caller never pays for the same solve twice.
"""

import logging

from assignment_logic.capacity import compute_pairwise_cap, compute_overlap_lower_bound
from assignment_logic.group_builder import GroupBuilder

logger = logging.getLogger(__name__)


def find_feasible_plan(
    participants,
    num_tables,
    num_sessions,
    probe_seconds=20,
    max_pairwise_tries=3,
    max_overlap_tries=4,
    min_pairwise_cap=None,
    min_overlap_cap=None,
    **group_builder_kwargs,
):
    """
    Returns (result, pairwise_cap_used, table_overlap_cap_used,
    pairwise_floor, overlap_floor). On exhaustion, cap_used values are None
    so the caller can surface a real error, but the floors are always
    populated - they're computed once, up front, independent of whether any
    probe succeeds.

    min_pairwise_cap / min_overlap_cap raise the starting point of each
    escalation above this call's own pigeonhole floor. A caller solving a
    subset of a program (e.g. a single-session reshuffle) computes a
    weaker floor than the whole program was built under - without a
    floor, escalation could converge on a looser cap than the rest of the
    program is already locked to, silently permitting more repeat
    meetings than the accepted plan allows. The returned pairwise_floor /
    overlap_floor already reflect this raise (they're maxed against
    min_pairwise_cap / min_overlap_cap below), so a caller comparing
    "how close to floor is this result" gets the programwide floor, not
    just this subset's weaker one.
    """
    total_program_sessions = (
        group_builder_kwargs.get("total_program_sessions") or num_sessions
    )
    pairwise_floor = compute_pairwise_cap(
        participants, num_tables, total_program_sessions
    )
    if min_pairwise_cap is not None:
        pairwise_floor = max(pairwise_floor, min_pairwise_cap)
    overlap_floor = compute_overlap_lower_bound(participants, num_tables)
    if min_overlap_cap is not None:
        overlap_floor = max(overlap_floor, min_overlap_cap)

    last_result = None
    for p_attempt in range(max_pairwise_tries):
        pairwise_cap = pairwise_floor + p_attempt
        for o_attempt in range(max_overlap_tries):
            overlap_cap = overlap_floor + o_attempt
            builder = GroupBuilder(
                participants,
                num_tables,
                num_sessions,
                pairwise_cap=pairwise_cap,
                table_overlap_cap=overlap_cap,
                **group_builder_kwargs,
            )
            result = builder.generate_assignments(max_time_seconds=probe_seconds)
            if result["status"] == "success":
                logger.info(
                    f"Found feasible pairwise_cap={pairwise_cap}, "
                    f"table_overlap_cap={overlap_cap} on attempt "
                    f"({p_attempt + 1}, {o_attempt + 1})"
                )
                return result, pairwise_cap, overlap_cap, pairwise_floor, overlap_floor
            logger.info(
                f"pairwise_cap={pairwise_cap}, table_overlap_cap={overlap_cap} "
                f"did not resolve in {probe_seconds}s, escalating"
            )
            last_result = result
    return last_result, None, None, pairwise_floor, overlap_floor
