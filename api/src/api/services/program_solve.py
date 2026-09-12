"""Solving a whole program, with no storage and no HTTP.

Pulled out of ``routers/assignments.py`` so a solve can run *before* an
assignment set exists. ``POST /roster/generate`` must know it has a solution
before it mints a set and repoints the program - otherwise a failed solve
strands the program on an empty set, which is what it did before Item 6a.

Raises ``SolveFailed`` rather than ``HTTPException``: this module knows the
solver, not the API. Callers translate.
"""

import logging
from typing import Any, Dict, List, Tuple

from assignment_logic.api_handler import handle_generate_assignments
from assignment_logic.group_builder import GroupBuilder

logger = logging.getLogger(__name__)

# A version is the state after something happened, so every label is a
# completed action in the past tense. These two live here because this module
# decides which one a solve earned; the router imports them.
LABEL_GENERATED = "Sessions generated"
LABEL_REBUILT_WITH_ABSENCES = "Sessions rebuilt with absences"
LABEL_REBUILT_AROUND_COMPLETED = "Sessions rebuilt around completed sessions"

NO_SOLUTION = "No solution exists with the given constraints."


class SolveFailed(Exception):
    """The solver returned no usable answer."""


def extract_pairings_from_sessions(
    assignments: List[Dict[str, Any]], exclude_session: int
) -> Dict[Any, int]:
    """
    Count how many times each pair met in sessions other than the one being
    regenerated.

    Returns counts, not just membership: a pair that already met twice
    elsewhere has less remaining budget under the solver's hard pairwise
    cap than a pair that met once, and a bare set collapses that
    distinction back down to "met at least once" - silently letting a
    downstream solve allow one more meeting than the whole program's cap
    actually permits. See the dual-cap-solver plan's Task 8 notes.

    Args:
        assignments: List of session assignments
        exclude_session: Session number to exclude (the one being regenerated)

    Returns:
        Dict mapping a pair (sorted tuple) to how many sessions they shared a table in.
    """
    historical_pairings: Dict[Any, int] = {}

    for session_data in assignments:
        session_num = session_data["session"]

        # Skip the session we're regenerating
        if session_num == exclude_session:
            continue

        # Extract pairings from each table in this session
        for table_num, participants in session_data["tables"].items():
            # A frozen or completed session can carry ``None`` seats (an empty
            # chair); those are not people and never form a pairing.
            seated = [p for p in participants if p]
            # Create pairs for all participants at this table
            for i in range(len(seated)):
                for j in range(i + 1, len(seated)):
                    p1 = seated[i]["name"]
                    p2 = seated[j]["name"]
                    # Use sorted tuple so (Alice, Bob) == (Bob, Alice)
                    pair_key = tuple(sorted([p1, p2]))
                    historical_pairings[pair_key] = (
                        historical_pairings.get(pair_key, 0) + 1
                    )

    logger.info(
        f"Extracted {len(historical_pairings)} historical pairings from {len(assignments) - 1} sessions"
    )
    return historical_pairings


def extract_historical_tables(
    assignments: List[Dict[str, Any]], exclude_session: int
) -> List[frozenset]:
    """
    Table memberships (by participant name) from every session except the
    one being regenerated - the whole-table overlap cap's counterpart to
    extract_pairings_from_sessions. Lets a single-session solve respect the
    program's overlap cap against tables it doesn't get to re-derive.
    """
    tables = []
    for session_data in assignments:
        if session_data["session"] == exclude_session:
            continue
        for table_num, participants in session_data["tables"].items():
            seated = {p["name"] for p in participants if p}
            if seated:
                tables.append(frozenset(seated))
    return tables


def solve_program(
    participants: List[Dict[str, Any]],
    num_tables: int,
    num_sessions: int,
    absence_map: Dict[int, List[Dict[str, Any]]],
    max_time_seconds: int = 120,
    label_when_clean: str = LABEL_GENERATED,
    _historical_seed=None,
    _total_program_sessions=None,
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """Solve every session, then re-solve the ones with absences.

    ``_historical_seed``, when given, is a dict of real meeting counts (not
    just a set of pairs) from sessions outside this solve - e.g. frozen
    sessions a rebuild-around-completed call is re-solving the remainder
    for. It's passed through as the hard pairwise cap's budget, not the
    soft penalty: a pair that already spent its whole-program budget in a
    frozen session must be forbidden here, not merely discouraged.
    ``_total_program_sessions`` lets that cap be computed against the
    whole program even when ``num_sessions`` here is just the remainder.

    Returns ``(assignments, metadata)``. Never writes anything.
    """
    results = handle_generate_assignments(
        participants,
        num_tables,
        num_sessions,
        max_time_seconds=max_time_seconds,
        historical_meeting_counts=_historical_seed,
        total_program_sessions=_total_program_sessions,
    )
    if results["status"] != "success":
        logger.error("Solver failed: %s", results.get("error"))
        raise SolveFailed(NO_SOLUTION)

    assignments = results["assignments"]
    absences_applied = False

    for session_number, absent in absence_map.items():
        if session_number < 1 or session_number > num_sessions:
            continue

        absent_names = {p["name"] for p in absent}
        active = [p for p in participants if p["name"] not in absent_names]

        if len(active) < num_tables:
            logger.warning(
                "Skipping absence re-solve for session %s: only %s active for %s tables",
                session_number,
                len(active),
                num_tables,
            )
            # Preserve the record so it survives future rebuilds, even though the
            # tables keep the everyone-present layout.
            assignments[session_number - 1]["absentParticipants"] = absent
            continue

        historical = extract_pairings_from_sessions(
            assignments, exclude_session=session_number
        )
        builder = GroupBuilder(
            participants=active,
            num_tables=num_tables,
            num_sessions=1,
            historical_pairings=historical,
            solver_num_workers=4,
        )
        single = builder.generate_assignments(
            max_time_seconds=min(60, max_time_seconds)
        )

        if single["status"] == "success":
            assignments[session_number - 1] = {
                "session": session_number,
                "tables": single["assignments"][0]["tables"],
                "absentParticipants": absent,
            }
            absences_applied = True
        else:
            logger.warning(
                "Could not apply absences for session %s; keeping full-solve result",
                session_number,
            )
            assignments[session_number - 1]["absentParticipants"] = absent

    # The full-solve quality numbers describe the all-present solve. Once any
    # session was re-solved, they no longer match what is saved, so drop them
    # rather than report stale values.
    metadata: Dict[str, Any] = {
        "max_time_seconds": max_time_seconds,
        "label": LABEL_REBUILT_WITH_ABSENCES if absences_applied else label_when_clean,
        "solution_quality": None
        if absences_applied
        else results.get("solution_quality"),
        "solve_time": None if absences_applied else results.get("solve_time"),
        "total_deviation": None if absences_applied else results.get("total_deviation"),
        # A per-session absence re-solve bypasses find_feasible_plan (plain
        # GroupBuilder, no cap search), so it doesn't reconfirm either cap
        # against the sessions actually saved - null both rather than report
        # a number that no longer describes this result.
        "pairwise_cap": None if absences_applied else results.get("pairwise_cap"),
        "table_overlap_cap": None
        if absences_applied
        else results.get("table_overlap_cap"),
        "pairwise_floor": None if absences_applied else results.get("pairwise_floor"),
        "table_overlap_floor": None
        if absences_applied
        else results.get("table_overlap_floor"),
    }

    return assignments, metadata


def solve_around_completed_sessions(
    participants: List[Dict[str, Any]],
    num_tables: int,
    num_sessions: int,
    completed_through: int,
    frozen_sessions: List[Dict[str, Any]],
    absence_map: Dict[int, List[Dict[str, Any]]],
    max_time_seconds: int = 120,
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """Freeze sessions 1..k, re-solve k+1..N around them (Item 6b).

    ``frozen_sessions`` is copied into the result untouched - it keeps seating
    people no longer on ``participants`` and never gains people added since.
    Real meeting counts from the frozen sessions seed the solver's hard
    pairwise cap (not just a soft penalty) - a pair that already spent its
    whole-program budget in a frozen session must be forbidden from meeting
    again in the remainder, not merely discouraged. The cap itself is
    computed against ``num_sessions`` (the whole program), not ``remainder``,
    via ``_total_program_sessions``. A pairing naming someone absent from the
    current roster is dropped, because they are not in the sessions being
    solved.
    """
    remainder = num_sessions - completed_through
    if remainder < 1:
        raise SolveFailed(NO_SOLUTION)

    name_to_id = {p["name"]: p["id"] for p in participants}
    seed_counts: Dict[Any, int] = {}
    for (a, b), count in extract_pairings_from_sessions(
        frozen_sessions, exclude_session=-1
    ).items():
        if a in name_to_id and b in name_to_id:
            seed_counts[tuple(sorted([name_to_id[a], name_to_id[b]]))] = count

    remainder_absences = {
        (s - completed_through): absent
        for s, absent in absence_map.items()
        if completed_through < s <= num_sessions
    }

    resolved, meta = solve_program(
        participants=participants,
        num_tables=num_tables,
        num_sessions=remainder,
        absence_map=remainder_absences,
        max_time_seconds=max_time_seconds,
        label_when_clean=LABEL_REBUILT_AROUND_COMPLETED,
        _historical_seed=seed_counts,
        _total_program_sessions=num_sessions,
    )

    for i, session in enumerate(resolved):
        session["session"] = completed_through + i + 1

    assignments = list(frozen_sessions) + resolved
    meta["label"] = LABEL_REBUILT_AROUND_COMPLETED
    meta["solution_quality"] = None
    meta["solve_time"] = None
    meta["total_deviation"] = None
    return assignments, meta
