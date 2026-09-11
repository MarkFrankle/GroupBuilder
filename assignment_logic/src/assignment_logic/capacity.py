"""
Pure combinatorics for the dual hard-cap solver design. No CP-SAT
dependency here on purpose: these are cheap to compute and cheap to test
in isolation from the solver.
"""

import math
from collections import defaultdict
from itertools import combinations


def _relational_pairs(participants):
    """Return (forced_apart_pairs, forced_together_pairs) as sets of
    sorted id-tuples, derived from couple_id, linked_id, and keep_apart."""
    couples = defaultdict(list)
    linked = defaultdict(list)
    for p in participants:
        if p.get("couple_id"):
            couples[p["couple_id"]].append(p["id"])
        if p.get("linked_id"):
            linked[p["linked_id"]].append(p["id"])

    name_to_id = {p["name"]: p["id"] for p in participants}
    forced_apart = set()
    for p in participants:
        for other_name in p.get("keep_apart") or []:
            other_id = name_to_id.get(other_name)
            if other_id and other_id != p["id"]:
                forced_apart.add(tuple(sorted((p["id"], other_id))))
    for group in couples.values():
        if len(group) == 2:
            forced_apart.add(tuple(sorted(group)))

    forced_together = set()
    for group in linked.values():
        if len(group) == 2:
            forced_together.add(tuple(sorted(group)))

    return forced_apart, forced_together


def compute_pairwise_cap(participants, num_tables, num_sessions):
    """
    The lowest max-repeat-count any plan for this roster could possibly
    achieve, derived by pigeonhole: total pair-meeting slots (assuming
    the existing "tables differ by at most 1 person" balance holds)
    divided among the pairs that are actually free to meet.

    Excludes forced-apart pairs (never meet, so irrelevant) and
    forced-together pairs (fixed at num_sessions meetings by a separate
    hard constraint, so they'd otherwise inflate the free_slots budget
    everyone else is competing for).
    """
    n = len(participants)
    base_size = n // num_tables
    remainder = n % num_tables
    meetings_per_session = remainder * math.comb(base_size + 1, 2) + (
        num_tables - remainder
    ) * math.comb(base_size, 2)
    total_slots = meetings_per_session * num_sessions

    forced_apart, forced_together = _relational_pairs(participants)
    all_ids = [p["id"] for p in participants]
    total_pairs = len(list(combinations(all_ids, 2)))
    free_pairs = total_pairs - len(forced_apart) - len(forced_together)
    free_slots = total_slots - len(forced_together) * num_sessions

    if free_pairs <= 0:
        return num_sessions
    return math.ceil(free_slots / free_pairs)


def compute_overlap_lower_bound(participants, num_tables):
    """
    A WEAK lower bound on the tightest possible whole-table overlap cap:
    redistributing one table's people as evenly as possible across all
    tables in a different session. This is always a valid floor (the true
    minimum can never be lower) but is NOT guaranteed achievable once
    religion/gender balance, facilitator rules, couples, and keep-apart
    all compound — treat it as a search starting point, never a final
    answer. See find_feasible_overlap_cap in capacity_search.py.
    """
    n = len(participants)
    base_size = n // num_tables
    remainder = n % num_tables
    max_table_size = base_size + (1 if remainder > 0 else 0)
    return max(1, math.ceil(max_table_size / num_tables))
