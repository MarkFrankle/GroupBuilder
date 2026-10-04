"""Upload drafts, stored on the Program document as ``roster_drafts``.

A draft is an uploaded person whose religion or gender couldn't be read. Drafts
are deliberately not roster documents: every roster document is a complete,
solvable participant, and the solver never sees a draft. They live on the
server rather than in one browser so every coordinator sees them and generate
can refuse while they exist.
"""

from typing import Optional

from ..firebase_admin import get_firestore_client


class RosterDraftStorage:
    def __init__(self):
        self.db = get_firestore_client()

    def _program_ref(self, program_id: str):
        return self.db.collection("organizations").document(program_id)

    def get_drafts(self, program_id: str) -> list[dict]:
        doc = self._program_ref(program_id).get()
        raw = ((doc.to_dict() or {}) if doc.exists else {}).get("roster_drafts") or []
        return [d for d in raw if isinstance(d, dict) and d.get("id")]

    def stage_drafts(self, batch, program_id: str, drafts: list[dict]) -> None:
        batch.set(self._program_ref(program_id), {"roster_drafts": drafts}, merge=True)

    def write_drafts(self, program_id: str, drafts: list[dict]) -> None:
        self._program_ref(program_id).set({"roster_drafts": drafts}, merge=True)


_roster_draft_storage: Optional[RosterDraftStorage] = None


def get_roster_draft_storage() -> RosterDraftStorage:
    """FastAPI dependency for RosterDraftStorage."""
    global _roster_draft_storage
    if _roster_draft_storage is None:
        _roster_draft_storage = RosterDraftStorage()
    return _roster_draft_storage
