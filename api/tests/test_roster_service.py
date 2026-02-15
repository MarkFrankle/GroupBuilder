import pytest
from unittest.mock import MagicMock, patch
from api.services.roster_service import RosterService


@pytest.fixture
def mock_db():
    """Create a mock Firestore client."""
    return MagicMock()


@pytest.fixture
def service(mock_db):
    return RosterService(mock_db)


class TestGetRoster:
    def test_returns_empty_list_for_new_org(self, service, mock_db):
        mock_db.collection.return_value.document.return_value.collection.return_value.stream.return_value = (
            []
        )
        result = service.get_roster("org_1")
        assert result == []

    def test_returns_participants(self, service, mock_db):
        mock_doc = MagicMock()
        mock_doc.id = "p1"
        mock_doc.to_dict.return_value = {
            "name": "Alice",
            "religion": "Christian",
            "gender": "Female",
            "partner_id": None,
        }
        mock_db.collection.return_value.document.return_value.collection.return_value.stream.return_value = [
            mock_doc
        ]

        result = service.get_roster("org_1")
        assert len(result) == 1
        assert result[0]["id"] == "p1"
        assert result[0]["name"] == "Alice"


class TestUpsertParticipant:
    def test_creates_new_participant(self, service, mock_db):
        doc_ref = MagicMock()
        mock_db.collection.return_value.document.return_value.collection.return_value.document.return_value = (
            doc_ref
        )

        result = service.upsert_participant(
            "org_1",
            "p1",
            {
                "name": "Alice",
                "religion": "Christian",
                "gender": "Female",
                "partner_id": None,
            },
        )
        doc_ref.set.assert_called_once()
        call_data = doc_ref.set.call_args[0][0]
        assert call_data["name"] == "Alice"
        assert "updated_at" in call_data

    def test_rejects_invalid_religion(self, service):
        with pytest.raises(ValueError, match="religion"):
            service.upsert_participant(
                "org_1",
                "p1",
                {
                    "name": "Alice",
                    "religion": "Pastafarian",
                    "gender": "Female",
                    "partner_id": None,
                },
            )

    def test_rejects_invalid_gender(self, service):
        with pytest.raises(ValueError, match="gender"):
            service.upsert_participant(
                "org_1",
                "p1",
                {
                    "name": "Alice",
                    "religion": "Christian",
                    "gender": "Robot",
                    "partner_id": None,
                },
            )

    def test_rejects_empty_name(self, service):
        with pytest.raises(ValueError, match="name"):
            service.upsert_participant(
                "org_1",
                "p1",
                {
                    "name": "",
                    "religion": "Christian",
                    "gender": "Female",
                    "partner_id": None,
                },
            )
