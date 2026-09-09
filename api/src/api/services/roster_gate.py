"""Shortfall detection for a rebuild.

Three checks, all arithmetic on counts — no solve. They catch the failures that
are countable and say something useful about each; everything else falls through
to the solver's refusal, which is deliberate (see Item 9: no feasibility
pre-check).

This can never promise feasibility. Religion *and* gender spread are both hard
per-table constraints, so a skewed roster can be infeasible with no arithmetic
tell. Accepted, not solved.
"""

from collections import Counter
from typing import Any, Dict, List


class ShortfallError(Exception):
    """Something countable is short. The message names the remedy."""


def check_shortfalls(participants: List[Dict[str, Any]], num_tables: int) -> None:
    """Raise ``ShortfallError`` naming the first thing that is short."""
    needed = num_tables * 2
    if len(participants) < needed:
        raise ShortfallError(f"Add {needed - len(participants)} more participants.")

    facilitators = [p for p in participants if p.get("is_facilitator")]
    # Zero facilitators is legal: the solver skips facilitator coverage entirely.
    if not facilitators:
        return

    if len(facilitators) < num_tables:
        raise ShortfallError(
            f"You have {len(facilitators)} facilitators and {num_tables} tables — "
            f"every table needs one."
        )

    by_religion = Counter(p.get("religion", "Other") for p in facilitators)
    for religion, count in by_religion.items():
        if count > num_tables:
            raise ShortfallError(
                f"You have {count} {religion} facilitators and {num_tables} tables — "
                f"no table can seat two facilitators of the same religion."
            )
