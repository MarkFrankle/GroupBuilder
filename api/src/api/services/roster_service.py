from datetime import datetime, timezone
from typing import Optional

VALID_RELIGIONS = {"Christian", "Jewish", "Muslim", "Other"}
VALID_GENDERS = {"Male", "Female", "Other"}

_roster_service: Optional["RosterService"] = None

# One Firestore batch holds at most 500 writes. A replace spends one per old
# roster document, one per new one, and one on the Program document.
_MAX_BATCH_WRITES = 500


def next_position(participants: list[dict]) -> int:
    """The position after everyone's, for a row joining the bottom."""
    return max((p.get("position", -1) for p in participants), default=-1) + 1


class RosterService:
    def __init__(self, db=None):
        if db is None:
            from api.firebase_admin import get_firestore_client

            db = get_firestore_client()
        self.db = db

    def _roster_collection(self, program_id: str):
        return (
            self.db.collection("organizations")
            .document(program_id)
            .collection("roster")
        )

    def get_roster(self, program_id: str) -> list[dict]:
        docs = self._roster_collection(program_id).stream()
        participants = []
        for doc in docs:
            data = doc.to_dict()
            data["id"] = doc.id
            participants.append(data)
        # Sorted here, not with order_by: Firestore's order_by silently drops
        # documents without the field, and rosters saved before sorting existed
        # have no positions. Those come last, by name, until the first sort.
        participants.sort(
            key=lambda p: (
                p.get("position") is None,
                p.get("position") or 0,
                p["name"].lower(),
            )
        )
        return participants

    def _validated_doc(self, data: dict) -> dict:
        name = data.get("name", "").strip()
        if not name:
            raise ValueError("name must not be empty")

        religion = data.get("religion", "")
        if religion not in VALID_RELIGIONS:
            raise ValueError(
                f"Invalid religion: {religion}. Must be one of {VALID_RELIGIONS}"
            )

        gender = data.get("gender", "")
        if gender not in VALID_GENDERS:
            raise ValueError(
                f"Invalid gender: {gender}. Must be one of {VALID_GENDERS}"
            )

        doc = {
            "name": name,
            "religion": religion,
            "gender": gender,
            "partner_id": data.get("partner_id"),
            "is_facilitator": bool(data.get("is_facilitator", False)),
            "keep_together": bool(data.get("keep_together", False)),
            "absent_sessions": sorted(
                {int(n) for n in (data.get("absent_sessions") or []) if int(n) >= 1}
            ),
            "updated_at": datetime.now(timezone.utc),
        }
        # Passed through, never invented: a row rebuilt from a get_roster dict
        # keeps its place, and a plain field edit (merge=True) leaves it alone.
        if data.get("position") is not None:
            doc["position"] = int(data["position"])
        return doc

    def upsert_participant(
        self, program_id: str, participant_id: str, data: dict
    ) -> dict:
        doc_data = self._validated_doc(data)
        doc_ref = self._roster_collection(program_id).document(participant_id)
        doc_ref.set(doc_data, merge=True)

        doc_data["id"] = participant_id
        return doc_data

    def stage_participant(
        self, batch, program_id: str, participant_id: str, data: dict
    ) -> dict:
        """Validate one participant and add its write to ``batch``."""
        doc_data = self._validated_doc(data)
        batch.set(
            self._roster_collection(program_id).document(participant_id), doc_data
        )
        return {**doc_data, "id": participant_id}

    def stage_replace(
        self, batch, program_id: str, participants: dict[str, dict]
    ) -> None:
        """Add a whole-roster swap to ``batch``. The caller commits.

        Every row is validated before anything is staged, so an invalid row
        leaves the batch untouched.
        """
        docs = {pid: self._validated_doc(data) for pid, data in participants.items()}
        collection = self._roster_collection(program_id)
        existing = list(collection.stream())
        if len(existing) + len(docs) + 1 > _MAX_BATCH_WRITES:
            raise ValueError(
                "This roster is too large to upload in one go. "
                "Split it into smaller files or add people by hand."
            )
        for doc in existing:
            batch.delete(doc.reference)
        for pid, data in docs.items():
            batch.set(collection.document(pid), data)

    def stage_order(self, batch, program_id: str, ids: list[str]) -> None:
        """Add a write per id setting its position to its index. Merge only:
        nothing but the order changes."""
        collection = self._roster_collection(program_id)
        for position, participant_id in enumerate(ids):
            batch.set(
                collection.document(participant_id), {"position": position}, merge=True
            )

    def delete_participant(self, program_id: str, participant_id: str):
        self._roster_collection(program_id).document(participant_id).delete()

    def get_participant(self, program_id: str, participant_id: str) -> Optional[dict]:
        doc = self._roster_collection(program_id).document(participant_id).get()
        if not doc.exists:
            return None
        data = doc.to_dict()
        data["id"] = doc.id
        return data


def get_roster_service() -> RosterService:
    global _roster_service
    if _roster_service is None:
        _roster_service = RosterService()
    return _roster_service
