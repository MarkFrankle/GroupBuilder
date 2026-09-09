"""Comparing the draft roster against the canonical one.

The roster exists twice: the live ``roster/`` collection (draft) and the
``participant_data`` frozen on the current assignment set (canonical). The
Roster page's whole state model is derived from comparing them, so the
comparison lives here and is used by both the API and - reimplemented in
TypeScript for display - the frontend.

Two questions, deliberately separate:

* ``is_dirty`` - do they differ at all? Drives the lock and the changeset.
* ``needs_rebuild`` - do they differ in a way that changes the mixing?

Mixing-relevant differences are the ``MIXING_FIELDS`` below, plus the set of
``keep_apart`` pairs, which is compared separately - see ``diff_rosters``.

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

    # Keep-apart is compared as a set of pairs rather than as a per-person
    # field, and *after* renames are resolved. Adding it to MIXING_FIELDS
    # instead would compare partner names literally, so renaming anyone named
    # in a rule would read as a mixing change and collapse the rename fast path
    # into a full rebuild - destroying the plan over a typo fix.
    def _pairs(people, rename_map):
        out = set()
        for p in people:
            a = rename_map.get(p["name"], p["name"])
            for other in p.get("keep_apart") or []:
                b = rename_map.get(other, other)
                if a != b:
                    out.add(tuple(sorted((a, b))))
        return out

    keep_apart_changed = _pairs(canonical, renames) != _pairs(draft, {})

    is_dirty = bool(added or removed or changed or renames or keep_apart_changed)
    needs_rebuild = bool(added or removed or changed or keep_apart_changed)

    return RosterDiff(is_dirty=is_dirty, needs_rebuild=needs_rebuild, renames=renames)


def apply_renames(
    assignments: List[Dict[str, Any]],
    participant_data: List[Dict[str, Any]],
    renames: Dict[str, str],
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Rewrite old names to new ones everywhere a name is stored.

    Names appear in five places, all of them here: seat entries, the ``partner``
    field on a seat, the ``absentParticipants`` list, the canonical
    ``participant_data``, and the ``keep_apart`` lists it carries. Returns fresh
    structures; the inputs are not mutated.
    """
    new_assignments = copy.deepcopy(assignments)
    new_participants = copy.deepcopy(participant_data)

    def rename(person: Dict[str, Any]) -> None:
        if person.get("name") in renames:
            person["name"] = renames[person["name"]]
        if person.get("partner") in renames:
            person["partner"] = renames[person["partner"]]
        if person.get("keep_apart"):
            person["keep_apart"] = [
                renames.get(other, other) for other in person["keep_apart"]
            ]

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
