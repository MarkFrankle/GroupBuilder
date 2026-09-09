"""Keep-apart rules: which pairs of people must never share a table.

Stored on the Program document as ``keep_apart``, a list of two-element lists of
roster document ids. Ids rather than names, following ``partner_id``: the roster
document id is stable, so a rename needs no work here at all.

A program-level list rather than a field on each participant, because the
relationship is one-to-many. ``couple_id`` and ``linked_id`` are integers
stamped on a person, which works only for a one-to-one partnership; someone in
three keep-apart pairs has no single field to wear them in.

Pairs are order-normalised on write, so a pair has exactly one representation
and membership is a set question rather than a search.
"""

from typing import List, Optional, Tuple

from ..firebase_admin import get_firestore_client


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
        return [tuple(sorted(pair)) for pair in raw if len(pair) == 2]

    def add_pair(self, program_id: str, a_id: str, b_id: str) -> List[Tuple[str, str]]:
        """Keep these two apart. Returns the new list of pairs."""
        pairs = self.get_pairs(program_id)
        key = tuple(sorted((a_id, b_id)))
        if key not in pairs:
            pairs.append(key)
        return self._write(program_id, pairs)

    def remove_pair(
        self, program_id: str, a_id: str, b_id: str
    ) -> List[Tuple[str, str]]:
        """Drop the rule for these two, in either order. Returns the new list."""
        key = tuple(sorted((a_id, b_id)))
        remaining = [p for p in self.get_pairs(program_id) if p != key]
        return self._write(program_id, remaining)

    def _write(
        self, program_id: str, pairs: List[Tuple[str, str]]
    ) -> List[Tuple[str, str]]:
        self._program_ref(program_id).set(
            {"keep_apart": [list(p) for p in pairs]}, merge=True
        )
        return pairs


# Singleton instance for dependency injection
_keep_apart_storage: Optional[KeepApartStorage] = None


def get_keep_apart_storage() -> KeepApartStorage:
    """FastAPI dependency for KeepApartStorage."""
    global _keep_apart_storage
    if _keep_apart_storage is None:
        _keep_apart_storage = KeepApartStorage()
    return _keep_apart_storage
