import pytest


class TestGetRoster:
    def test_returns_empty_roster(self, client):
        response = client.get("/api/roster/")
        assert response.status_code == 200
        assert response.json() == {"participants": []}

    def test_returns_participants(self, client):
        client.put("/api/roster/p1", json={
            "name": "Alice", "religion": "Christian",
            "gender": "Female", "partner_id": None,
        })
        response = client.get("/api/roster/")
        assert response.status_code == 200
        data = response.json()
        assert len(data["participants"]) == 1
        assert data["participants"][0]["name"] == "Alice"


class TestUpsertParticipant:
    def test_creates_participant(self, client):
        response = client.put("/api/roster/p1", json={
            "name": "Alice", "religion": "Christian",
            "gender": "Female", "partner_id": None,
        })
        assert response.status_code == 200
        assert response.json()["name"] == "Alice"

    def test_updates_participant(self, client):
        client.put("/api/roster/p1", json={
            "name": "Alice", "religion": "Christian",
            "gender": "Female", "partner_id": None,
        })
        response = client.put("/api/roster/p1", json={
            "name": "Alice Updated", "religion": "Jewish",
            "gender": "Female", "partner_id": None,
        })
        assert response.status_code == 200
        assert response.json()["name"] == "Alice Updated"

    def test_rejects_invalid_data(self, client):
        response = client.put("/api/roster/p1", json={
            "name": "", "religion": "Christian",
            "gender": "Female", "partner_id": None,
        })
        assert response.status_code == 400


class TestDeleteParticipant:
    def test_deletes_participant(self, client):
        client.put("/api/roster/p1", json={
            "name": "Alice", "religion": "Christian",
            "gender": "Female", "partner_id": None,
        })
        response = client.delete("/api/roster/p1")
        assert response.status_code == 200
        roster = client.get("/api/roster/")
        assert len(roster.json()["participants"]) == 0

    def test_clears_partner_on_delete(self, client):
        client.put("/api/roster/p1", json={
            "name": "Alice", "religion": "Christian",
            "gender": "Female", "partner_id": "p2",
        })
        client.put("/api/roster/p2", json={
            "name": "Bob", "religion": "Christian",
            "gender": "Male", "partner_id": "p1",
        })
        client.delete("/api/roster/p1")
        roster = client.get("/api/roster/")
        bob = [p for p in roster.json()["participants"] if p["name"] == "Bob"][0]
        assert bob["partner_id"] is None
