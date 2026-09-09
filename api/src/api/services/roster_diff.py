"""Comparing the draft roster against the canonical one.

The roster exists twice: the live ``roster/`` collection (draft) and the
``participant_data`` frozen on the current assignment set (canonical). The
Roster page's whole state model is derived from comparing them, so the
comparison lives here and is used by both the API and - reimplemented in
TypeScript for display - the frontend.

Two questions, deliberately separate:

* ``is_dirty`` - do they differ at all? Drives the lock and the changeset.
* ``needs_rebuild`` - do they differ in a way that changes the mixing?

The only difference that is dirty but does not need a rebuild is a name
spelling change, which is propagated instead. See ``apply_renames``.
"""

import copy
from dataclasses import dataclass, field
from typing import Any, Dict, List, Tuple

# Everything the solver mixes on. The name is deliberately absent: it is the
# identity key, handled by rename detection rather than by comparison.
MIXING_FIELDS = ("religion", "gender", "partner", "is_facilitator", "keep_together")


@dataclass
class RosterDiff:
    is_dirty: bool = False
    needs_rebuild: bool = False
    renames: Dict[str, str] = field(default_factory=dict)


def _normalise(person: Dict[str, Any]) -> Tuple:
    return tuple(person.get(f) for f in MIXING_FIELDS)


def diff_rosters(
    canonical: List[Dict[str, Any]], draft: List[Dict[str, Any]]
) -> RosterDiff:
    canonical_by_name = {p["name"]: p for p in canonical}
    draft_by_name = {p["name"]: p for p in draft}

    added = set(draft_by_name) - set(canonical_by_name)
    removed = set(canonical_by_name) - set(draft_by_name)

    changed = any(
        _normalise(canonical_by_name[name]) != _normalise(draft_by_name[name])
        for name in set(canonical_by_name) & set(draft_by_name)
    )

    # A rename shows up as exactly one unmatched name on each side. More than one
    # on either side is ambiguous - we will not pair them up by guesswork, so it
    # falls through as a rebuild.
    #
    # Note this also catches a genuine *replacement* - Ellen drops out, Priya
    # joins - whenever the two happen to share every mixing field. That is
    # deliberate, not an oversight. Because a rename is only ever detected when
    # all of MIXING_FIELDS match, seating Priya in Ellen's chair preserves every
    # constraint the solver enforces and the whole repeat structure: the plan is
    # exactly as good, and re-solving would cost the coordinator their seating
    # for no gain. Nor can it falsify the past - the endpoint refuses every
    # rebuild, this fast path included, once any Session is complete, so every
    # Session a rename can touch is still prospective.
    #
    # That last clause is what makes it safe. If renames are ever allowed while
    # a Session is complete, rewriting a name would rewrite who attended a night
    # that already happened, and telling a typo from a replacement would become
    # load-bearing.
    renames: Dict[str, str] = {}
    if len(added) == 1 and len(removed) == 1:
        old, new = removed.pop(), added.pop()
        if _normalise(canonical_by_name[old]) == _normalise(draft_by_name[new]):
            renames = {old: new}
            added, removed = set(), set()
        else:
            added, removed = {new}, {old}

    is_dirty = bool(added or removed or changed or renames)
    needs_rebuild = bool(added or removed or changed)

    return RosterDiff(is_dirty=is_dirty, needs_rebuild=needs_rebuild, renames=renames)


def apply_renames(
    assignments: List[Dict[str, Any]],
    participant_data: List[Dict[str, Any]],
    renames: Dict[str, str],
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Rewrite old names to new ones everywhere a name is stored.

    Names appear in four places, all of them here: seat entries, the ``partner``
    field on a seat, the ``absentParticipants`` list, and the canonical
    ``participant_data``. Returns fresh structures; the inputs are not mutated.
    """
    new_assignments = copy.deepcopy(assignments)
    new_participants = copy.deepcopy(participant_data)

    def rename(person: Dict[str, Any]) -> None:
        if person.get("name") in renames:
            person["name"] = renames[person["name"]]
        if person.get("partner") in renames:
            person["partner"] = renames[person["partner"]]

    for session in new_assignments:
        for seats in (session.get("tables") or {}).values():
            for seat in seats:
                if seat:
                    rename(seat)
        for absent in session.get("absentParticipants") or []:
            rename(absent)

    for person in new_participants:
        rename(person)

    return new_assignments, new_participants
