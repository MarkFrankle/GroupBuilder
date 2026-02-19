from datetime import datetime, timezone
from typing import Optional

VALID_RELIGIONS = {"Christian", "Jewish", "Muslim", "Other"}
VALID_GENDERS = {"Male", "Female", "Other"}

_roster_service: Optional["RosterService"] = None


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

    def upsert_participant(
        self, program_id: str, participant_id: str, data: dict
    ) -> dict:
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

        now = datetime.now(timezone.utc)
        doc_data = {
            "name": name,
            "religion": religion,
            "gender": gender,
            "partner_id": data.get("partner_id"),
            "is_facilitator": bool(data.get("is_facilitator", False)),
            "updated_at": now,
        }

        doc_ref = self._roster_collection(program_id).document(participant_id)
        doc_ref.set(doc_data, merge=True)

        doc_data["id"] = participant_id
        return doc_data

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
