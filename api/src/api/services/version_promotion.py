"""Why an older version cannot be promoted, said as a fact about the roster.

Each assignment set keeps the roster it was built against, so this is a count
off two stored lists rather than an inference.
"""
from typing import Any, Dict, List


def _names(participants: List[Dict[str, Any]]) -> set:
    return {p.get("name") for p in participants or [] if isinstance(p, dict)}


def roster_change_reason(
    old_participants: List[Dict[str, Any]],
    current_participants: List[Dict[str, Any]],
    change_date: str,
) -> str:
    """One sentence naming what the older version can and cannot seat."""
    old = _names(old_participants)
    current = _names(current_participants)

    if old == current:
        return f"This version predates your setup change on {change_date}."

    seated = len(old & current)
    departed = len(old - current)

    sentence = (
        f"This version predates your roster change on {change_date} — "
        f"it seats {seated} of your {len(current)} participants"
    )

    if departed:
        person = "person who has" if departed == 1 else "people who have"
        sentence += f", and {departed} {person} since left"

    return sentence + "."
