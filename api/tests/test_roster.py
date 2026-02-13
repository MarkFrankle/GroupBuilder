import io
import pytest
import pandas as pd


class TestGetRoster:
    def test_returns_empty_roster(self, client):
        response = client.get("/api/roster/")
        assert response.status_code == 200
        assert response.json() == {"participants": []}

    def test_returns_participants(self, client):
        client.put(
            "/api/roster/p1",
            json={
                "name": "Alice",
                "religion": "Christian",
                "gender": "Female",
                "partner_id": None,
            },
        )
        response = client.get("/api/roster/")
        assert response.status_code == 200
        data = response.json()
        assert len(data["participants"]) == 1
        assert data["participants"][0]["name"] == "Alice"


class TestUpsertParticipant:
    def test_creates_participant(self, client):
        response = client.put(
            "/api/roster/p1",
            json={
                "name": "Alice",
                "religion": "Christian",
                "gender": "Female",
                "partner_id": None,
            },
        )
        assert response.status_code == 200
        assert response.json()["name"] == "Alice"

    def test_updates_participant(self, client):
        client.put(
            "/api/roster/p1",
            json={
                "name": "Alice",
                "religion": "Christian",
                "gender": "Female",
                "partner_id": None,
            },
        )
        response = client.put(
            "/api/roster/p1",
            json={
                "name": "Alice Updated",
                "religion": "Jewish",
                "gender": "Female",
                "partner_id": None,
            },
        )
        assert response.status_code == 200
        assert response.json()["name"] == "Alice Updated"

    def test_rejects_invalid_data(self, client):
        response = client.put(
            "/api/roster/p1",
            json={
                "name": "",
                "religion": "Christian",
                "gender": "Female",
                "partner_id": None,
            },
        )
        assert response.status_code == 400


class TestDeleteParticipant:
    def test_deletes_participant(self, client):
        client.put(
            "/api/roster/p1",
            json={
                "name": "Alice",
                "religion": "Christian",
                "gender": "Female",
                "partner_id": None,
            },
        )
        response = client.delete("/api/roster/p1")
        assert response.status_code == 200
        roster = client.get("/api/roster/")
        assert len(roster.json()["participants"]) == 0

    def test_clears_partner_on_delete(self, client):
        client.put(
            "/api/roster/p1",
            json={
                "name": "Alice",
                "religion": "Christian",
                "gender": "Female",
                "partner_id": "p2",
            },
        )
        client.put(
            "/api/roster/p2",
            json={
                "name": "Bob",
                "religion": "Christian",
                "gender": "Male",
                "partner_id": "p1",
            },
        )
        client.delete("/api/roster/p1")
        roster = client.get("/api/roster/")
        bob = [p for p in roster.json()["participants"] if p["name"] == "Bob"][0]
        assert bob["partner_id"] is None


class TestCreateSessionFromRoster:
    def test_creates_session(self, client):
        client.put(
            "/api/roster/p1",
            json={
                "name": "Alice",
                "religion": "Christian",
                "gender": "Female",
                "partner_id": None,
            },
        )
        client.put(
            "/api/roster/p2",
            json={
                "name": "Bob",
                "religion": "Jewish",
                "gender": "Male",
                "partner_id": None,
            },
        )
        response = client.post(
            "/api/roster/generate",
            json={
                "num_tables": 1,
                "num_sessions": 1,
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert "session_id" in data

    def test_rejects_empty_roster(self, client):
        response = client.post(
            "/api/roster/generate",
            json={
                "num_tables": 1,
                "num_sessions": 1,
            },
        )
        assert response.status_code == 400

    def test_rejects_too_few_participants(self, client):
        client.put(
            "/api/roster/p1",
            json={
                "name": "Alice",
                "religion": "Christian",
                "gender": "Female",
                "partner_id": None,
            },
        )
        response = client.post(
            "/api/roster/generate",
            json={
                "num_tables": 3,
                "num_sessions": 1,
            },
        )
        assert response.status_code == 400


class TestFacilitatorField:
    def test_upsert_with_facilitator_flag(self, client):
        response = client.put(
            "/api/roster/p1",
            json={
                "name": "Alice",
                "religion": "Christian",
                "gender": "Female",
                "is_facilitator": True,
            },
        )
        assert response.status_code == 200
        get_resp = client.get("/api/roster/")
        participant = get_resp.json()["participants"][0]
        assert participant["is_facilitator"] is True

    def test_upsert_defaults_facilitator_false(self, client):
        response = client.put(
            "/api/roster/p1",
            json={
                "name": "Alice",
                "religion": "Christian",
                "gender": "Female",
            },
        )
        assert response.status_code == 200
        get_resp = client.get("/api/roster/")
        participant = get_resp.json()["participants"][0]
        assert participant["is_facilitator"] is False

    def test_generate_rejects_too_few_facilitators(self, client):
        # 2 participants, 1 facilitator, 2 tables → need 2 facilitators
        client.put(
            "/api/roster/p1",
            json={
                "name": "Alice",
                "religion": "Christian",
                "gender": "Female",
                "is_facilitator": True,
            },
        )
        client.put(
            "/api/roster/p2",
            json={
                "name": "Bob",
                "religion": "Jewish",
                "gender": "Male",
                "is_facilitator": False,
            },
        )
        response = client.post(
            "/api/roster/generate", json={"num_tables": 2, "num_sessions": 1}
        )
        assert response.status_code == 400
        assert "facilitator" in response.json()["detail"].lower()


class TestImportRoster:
    def _make_excel(self, participants):
        df = pd.DataFrame(participants)
        buffer = io.BytesIO()
        df.to_excel(buffer, index=False)
        buffer.seek(0)
        return buffer

    def test_imports_excel_file(self, client):
        excel = self._make_excel(
            [
                {
                    "Name": "Alice",
                    "Religion": "Christian",
                    "Gender": "Female",
                    "Partner": "",
                },
                {"Name": "Bob", "Religion": "Jewish", "Gender": "Male", "Partner": ""},
            ]
        )
        response = client.post(
            "/api/roster/import",
            files={
                "file": (
                    "roster.xlsx",
                    excel,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["participants"]) == 2

    def test_imports_with_partners(self, client):
        excel = self._make_excel(
            [
                {
                    "Name": "Alice",
                    "Religion": "Christian",
                    "Gender": "Female",
                    "Partner": "Bob",
                },
                {
                    "Name": "Bob",
                    "Religion": "Jewish",
                    "Gender": "Male",
                    "Partner": "Alice",
                },
            ]
        )
        response = client.post(
            "/api/roster/import",
            files={
                "file": (
                    "roster.xlsx",
                    excel,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
            },
        )
        assert response.status_code == 200
        participants = response.json()["participants"]
        alice = [p for p in participants if p["name"] == "Alice"][0]
        bob = [p for p in participants if p["name"] == "Bob"][0]
        assert alice["partner_id"] == bob["id"]
        assert bob["partner_id"] == alice["id"]

    def test_rejects_missing_columns(self, client):
        excel = self._make_excel([{"Name": "Alice", "Religion": "Christian"}])
        response = client.post(
            "/api/roster/import",
            files={
                "file": (
                    "roster.xlsx",
                    excel,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
            },
        )
        assert response.status_code == 400

    def test_clears_existing_roster_on_import(self, client):
        client.put(
            "/api/roster/p1",
            json={
                "name": "OldPerson",
                "religion": "Christian",
                "gender": "Female",
                "partner_id": None,
            },
        )
        excel = self._make_excel(
            [
                {
                    "Name": "NewPerson",
                    "Religion": "Jewish",
                    "Gender": "Male",
                    "Partner": "",
                },
            ]
        )
        response = client.post(
            "/api/roster/import",
            files={
                "file": (
                    "roster.xlsx",
                    excel,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
            },
        )
        assert response.status_code == 200
        roster = client.get("/api/roster/")
        names = [p["name"] for p in roster.json()["participants"]]
        assert "NewPerson" in names
        assert "OldPerson" not in names


class TestFullFlow:
    def test_create_roster_and_generate(self, client):
        """Create participants via API, then generate assignments."""
        for i in range(6):
            response = client.put(
                f"/api/roster/p{i}",
                json={
                    "name": f"Person{i}",
                    "religion": ["Christian", "Jewish", "Muslim"][i % 3],
                    "gender": ["Male", "Female"][i % 2],
                    "partner_id": None,
                },
            )
            assert response.status_code == 200

        roster = client.get("/api/roster/")
        assert len(roster.json()["participants"]) == 6

        response = client.post(
            "/api/roster/generate",
            json={
                "num_tables": 2,
                "num_sessions": 2,
            },
        )
        assert response.status_code == 200
        assert "session_id" in response.json()
