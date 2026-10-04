from datetime import datetime, timezone
from typing import Optional

VALID_RELIGIONS = {"Christian", "Jewish", "Muslim", "Other"}
VALID_GENDERS = {"Male", "Female", "Other"}

_roster_service: Optional["RosterService"] = None

# One Firestore batch holds at most 500 writes. A replace spends one per old
# roster document, one per new one, and one on the Program document.
_MAX_BATCH_WRITES = 500


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

        return {
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
