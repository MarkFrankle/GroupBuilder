"""Keep-apart rules: which pairs of people must never share a table.

Stored on the Program document as ``keep_apart``, a list of two-element lists of
roster document ids. Ids rather than names, following ``partner_id``: the roster
document id is stable, so a rename needs no work here at all.

A program-level list rather than a field on each participant, because the
relationship is one-to-many. ``couple_id`` and ``linked_id`` are integers
stamped on a person, which works only for a one-to-one partnership; someone in
three keep-apart pairs has no single field to wear them in.

Every pair is order-normalised at the write boundary, so a pair has exactly one
stored representation and comparing two pairs is a plain equality test rather
than a check of both orders.
"""

from typing import Any, List, Optional, Tuple

from ..firebase_admin import get_firestore_client


def _normalise(a_id: str, b_id: str) -> Tuple[str, str]:
    """The one canonical form of a pair: smaller id first."""
    lo, hi = sorted((a_id, b_id))
    return lo, hi


def _is_pair(entry: Any) -> bool:
    """Is this stored entry a rule at all?

    Deliberately strict. A bare ``len(entry) == 2`` admits the string ``"ab"``
    and would fabricate the pair ``("a", "b")`` out of nothing, while ``None``
    or an int raises out of ``len()``. Junk is not a rule, so it is dropped on
    read — and because a write rewrites the whole array, the next write erases
    it for good. That is the intended outcome now that only genuine junk falls
    through here.
    """
    return (
        isinstance(entry, list)
        and len(entry) == 2
        and all(isinstance(x, str) for x in entry)
    )


class KeepApartStorage:
    """Read and write ``keep_apart`` on a Program document."""

    def __init__(self):
        self.db = get_firestore_client()

    def _program_ref(self, program_id: str):
        return self.db.collection("organizations").document(program_id)

    def get_pairs(self, program_id: str) -> List[Tuple[str, str]]:
        """Every stored pair, each ordered smallest id first."""
        doc = self._program_ref(program_id).get()
        if not doc.exists:
            return []
        raw = (doc.to_dict() or {}).get("keep_apart") or []
        return [_normalise(*entry) for entry in raw if _is_pair(entry)]

    def add_pair(self, program_id: str, a_id: str, b_id: str) -> List[Tuple[str, str]]:
        """Keep these two apart. Returns the new list of pairs.

        Storage takes the ids as given. Rejecting a person paired with
        themselves is the router's job, as ordering is for session completion.
        """
        pairs = self.get_pairs(program_id)
        key = _normalise(a_id, b_id)
        if key not in pairs:
            pairs.append(key)
        return self._write(program_id, pairs)

    def remove_pair(
        self, program_id: str, a_id: str, b_id: str
    ) -> List[Tuple[str, str]]:
        """Drop the rule for these two, in either order. Returns the new list."""
        key = _normalise(a_id, b_id)
        remaining = [p for p in self.get_pairs(program_id) if p != key]
        return self._write(program_id, remaining)

    def replace_pairs(
        self, program_id: str, pairs: List[Tuple[str, str]]
    ) -> List[Tuple[str, str]]:
        """Overwrite the whole list in one write. Returns the new list.

        For the two callers that rewrite the list wholesale rather than edit
        one rule: discard, which remaps every pair onto freshly created roster
        ids, and delete, which drops every pair naming the deleted person.
        Both would otherwise be a read-and-write per pair through
        ``remove_pair``/``add_pair``.
        """
        return self._write(program_id, pairs)

    def _write(
        self, program_id: str, pairs: List[Tuple[str, str]]
    ) -> List[Tuple[str, str]]:
        normalised = [_normalise(*p) for p in pairs]
        self._program_ref(program_id).set(
            {"keep_apart": [list(p) for p in normalised]}, merge=True
        )
        return normalised


# Singleton instance for dependency injection
_keep_apart_storage: Optional[KeepApartStorage] = None


def get_keep_apart_storage() -> KeepApartStorage:
    """FastAPI dependency for KeepApartStorage."""
    global _keep_apart_storage
    if _keep_apart_storage is None:
        _keep_apart_storage = KeepApartStorage()
    return _keep_apart_storage
