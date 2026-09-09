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

NO_SOLUTION = "No solution exists with the given constraints."


class SolveFailed(Exception):
    """The solver returned no usable answer."""


def extract_pairings_from_sessions(
    assignments: List[Dict[str, Any]], exclude_session: int
) -> set:
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
        session_num = session_data["session"]

        # Skip the session we're regenerating
        if session_num == exclude_session:
            continue

        # Extract pairings from each table in this session
        for table_num, participants in session_data["tables"].items():
            # Create pairs for all participants at this table
            for i in range(len(participants)):
                for j in range(i + 1, len(participants)):
                    p1 = participants[i]["name"]
                    p2 = participants[j]["name"]
                    # Use sorted tuple so (Alice, Bob) == (Bob, Alice)
                    pair_key = tuple(sorted([p1, p2]))
                    historical_pairings.add(pair_key)

    logger.info(
        f"Extracted {len(historical_pairings)} historical pairings from {len(assignments) - 1} sessions"
    )
    return historical_pairings


def solve_program(
    participants: List[Dict[str, Any]],
    num_tables: int,
    num_sessions: int,
    absence_map: Dict[int, List[Dict[str, Any]]],
    max_time_seconds: int = 120,
    label_when_clean: str = LABEL_GENERATED,
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """Solve every session, then re-solve the ones with absences.

    Returns ``(assignments, metadata)``. Never writes anything.
    """
    results = handle_generate_assignments(
        participants, num_tables, num_sessions, max_time_seconds=max_time_seconds
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
    }

    return assignments, metadata
