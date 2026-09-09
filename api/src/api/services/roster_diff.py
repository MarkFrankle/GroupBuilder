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
from typing import Any, Dict, List, Set, Tuple

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


def _pairs(
    people: List[Dict[str, Any]], rename_map: Dict[str, str]
) -> Set[Tuple[str, str]]:
    """The roster's keep-apart rules as an unordered set of name pairs.

    Compared as a set of pairs rather than as a per-person field, and only after
    renames are resolved. Adding ``keep_apart`` to MIXING_FIELDS instead would
    compare the other person's name literally, so renaming anyone named in a
    rule would read as a mixing change and collapse the rename fast path into a
    full rebuild - destroying the plan over a typo fix.

    This depends on ``apply_renames`` rewriting ``keep_apart`` when it
    propagates a rename. If it stops, the canonical side keeps the old spelling,
    every later diff sees a pair that the draft can never match, and the roster
    reads dirty forever with a rebuild as the only way out.
    """
    out: Set[Tuple[str, str]] = set()
    for person in people:
        a = rename_map.get(person["name"], person["name"])
        for other in person.get("keep_apart") or []:
            b = rename_map.get(other, other)
            # Canonical form, matching the derivation layer: a self-pair in
            # pre-feature or hand-edited data would otherwise be a phantom the
            # draft can never match, and so a permanent spurious rebuild.
            if a != b:
                out.add(tuple(sorted((a, b))))
    return out


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

    # Renames are applied to the canonical side so a spelling change reads as
    # the same rule, not a different one. Removing a rule needs a rebuild too:
    # the existing plan stays *legal* without it - a relaxed constraint is still
    # satisfied - so only optimality is lost. It is still the right call. The
    # coordinator removed the rule precisely so those two may now meet, and the
    # rebuild is user-triggered either way; do not "optimise" this into a no-op.
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

    The ``keep_apart`` rewrite is not cosmetic: ``_pairs`` compares the two
    rosters' rules by name, so leaving the old spelling here would make every
    later diff see a changed rule and demand a rebuild forever.
    """
    new_assignments = copy.deepcopy(assignments)
    new_participants = copy.deepcopy(participant_data)

    def rename(person: Dict[str, Any]) -> None:
        if person.get("name") in renames:
            person["name"] = renames[person["name"]]
        if person.get("partner") in renames:
            person["partner"] = renames[person["partner"]]
        if person.get("keep_apart") is not None:
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
