import pytest

from api.routers.roster import _roster_to_participant_list


class TestRosterToParticipantList:
    def test_keep_together_pairs_get_linked_id(self):
        participants = [
            {
                "id": "a",
                "name": "Alice",
                "religion": "Christian",
                "gender": "Female",
                "partner_id": "b",
                "keep_together": True,
            },
            {
                "id": "b",
                "name": "Bob",
                "religion": "Christian",
                "gender": "Male",
                "partner_id": "a",
                "keep_together": True,
            },
        ]
        result = _roster_to_participant_list(participants)
        for p in result:
            assert p["linked_id"] is not None
            assert p["couple_id"] is None
        assert result[0]["linked_id"] == result[1]["linked_id"]

    def test_separate_pairs_get_couple_id(self):
        participants = [
            {
                "id": "a",
                "name": "Alice",
                "religion": "Christian",
                "gender": "Female",
                "partner_id": "b",
                "keep_together": False,
            },
            {
                "id": "b",
                "name": "Bob",
                "religion": "Christian",
                "gender": "Male",
                "partner_id": "a",
                "keep_together": False,
            },
        ]
        result = _roster_to_participant_list(participants)
        for p in result:
            assert p["couple_id"] is not None
            assert p["linked_id"] is None
        assert result[0]["couple_id"] == result[1]["couple_id"]

    def test_unpaired_get_neither(self):
        participants = [
            {"id": "a", "name": "Alice", "religion": "Christian", "gender": "Female"},
        ]
        result = _roster_to_participant_list(participants)
        assert result[0]["couple_id"] is None
        assert result[0]["linked_id"] is None


class TestGetRoster:
    def test_returns_empty_roster(self, client):
        response = client.get("/api/roster/?program_id=test_org_id")
        assert response.status_code == 200
        assert response.json() == {"participants": []}

    def test_returns_participants(self, client):
        client.put(
            "/api/roster/p1?program_id=test_org_id",
            json={
                "name": "Alice",
                "religion": "Christian",
                "gender": "Female",
                "partner_id": None,
            },
        )
        response = client.get("/api/roster/?program_id=test_org_id")
        assert response.status_code == 200
        data = response.json()
        assert len(data["participants"]) == 1
        assert data["participants"][0]["name"] == "Alice"


class TestUpsertParticipant:
    def test_creates_participant(self, client):
        response = client.put(
            "/api/roster/p1?program_id=test_org_id",
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
            "/api/roster/p1?program_id=test_org_id",
            json={
                "name": "Alice",
                "religion": "Christian",
                "gender": "Female",
                "partner_id": None,
            },
        )
        response = client.put(
            "/api/roster/p1?program_id=test_org_id",
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
            "/api/roster/p1?program_id=test_org_id",
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
            "/api/roster/p1?program_id=test_org_id",
            json={
                "name": "Alice",
                "religion": "Christian",
                "gender": "Female",
                "partner_id": None,
            },
        )
        response = client.delete("/api/roster/p1?program_id=test_org_id")
        assert response.status_code == 200
        roster = client.get("/api/roster/?program_id=test_org_id")
        assert len(roster.json()["participants"]) == 0

    def test_clears_partner_on_delete(self, client):
        client.put(
            "/api/roster/p1?program_id=test_org_id",
            json={
                "name": "Alice",
                "religion": "Christian",
                "gender": "Female",
                "partner_id": "p2",
            },
        )
        client.put(
            "/api/roster/p2?program_id=test_org_id",
            json={
                "name": "Bob",
                "religion": "Christian",
                "gender": "Male",
                "partner_id": "p1",
            },
        )
        client.delete("/api/roster/p1?program_id=test_org_id")
        roster = client.get("/api/roster/?program_id=test_org_id")
        bob = [p for p in roster.json()["participants"] if p["name"] == "Bob"][0]
        assert bob["partner_id"] is None


class TestCreateAssignmentSetFromRoster:
    def test_creates_assignment_set(self, client):
        client.put(
            "/api/roster/p1?program_id=test_org_id",
            json={
                "name": "Alice",
                "religion": "Christian",
                "gender": "Female",
                "partner_id": None,
            },
        )
        client.put(
            "/api/roster/p2?program_id=test_org_id",
            json={
                "name": "Bob",
                "religion": "Jewish",
                "gender": "Male",
                "partner_id": None,
            },
        )
        response = client.post(
            "/api/roster/generate?program_id=test_org_id",
            json={
                "num_tables": 1,
                "num_sessions": 1,
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert "assignment_set_id" in data

    def test_points_program_at_the_new_set(self, client):
        """Generating from a roster mints a set and makes it the current one."""
        client.put(
            "/api/roster/p1?program_id=test_org_id",
            json={
                "name": "Alice",
                "religion": "Christian",
                "gender": "Female",
                "partner_id": None,
            },
        )
        response = client.post(
            "/api/roster/generate?program_id=test_org_id",
            json={"num_tables": 1, "num_sessions": 1},
        )

        assert response.status_code == 200
        set_id = response.json()["assignment_set_id"]

        from api.services.assignment_set_storage import AssignmentSetStorage

        storage = AssignmentSetStorage()
        assert storage.get_current_set_id("test_org_id") == set_id

        stored = storage.get_set("test_org_id", set_id)
        assert [p["name"] for p in stored["participant_data"]] == ["Alice"]
        assert stored["num_tables"] == 1

    def test_rejects_empty_roster(self, client):
        response = client.post(
            "/api/roster/generate?program_id=test_org_id",
            json={
                "num_tables": 1,
                "num_sessions": 1,
            },
        )
        assert response.status_code == 400

    def test_rejects_too_few_participants(self, client):
        client.put(
            "/api/roster/p1?program_id=test_org_id",
            json={
                "name": "Alice",
                "religion": "Christian",
                "gender": "Female",
                "partner_id": None,
            },
        )
        response = client.post(
            "/api/roster/generate?program_id=test_org_id",
            json={
                "num_tables": 3,
                "num_sessions": 1,
            },
        )
        assert response.status_code == 400


class TestFacilitatorField:
    def test_upsert_with_facilitator_flag(self, client):
        response = client.put(
            "/api/roster/p1?program_id=test_org_id",
            json={
                "name": "Alice",
                "religion": "Christian",
                "gender": "Female",
                "is_facilitator": True,
            },
        )
        assert response.status_code == 200
        get_resp = client.get("/api/roster/?program_id=test_org_id")
        participant = get_resp.json()["participants"][0]
        assert participant["is_facilitator"] is True

    def test_upsert_defaults_facilitator_false(self, client):
        response = client.put(
            "/api/roster/p1?program_id=test_org_id",
            json={
                "name": "Alice",
                "religion": "Christian",
                "gender": "Female",
            },
        )
        assert response.status_code == 200
        get_resp = client.get("/api/roster/?program_id=test_org_id")
        participant = get_resp.json()["participants"][0]
        assert participant["is_facilitator"] is False

    def test_generate_rejects_too_few_facilitators(self, client):
        # 2 participants, 1 facilitator, 2 tables → need 2 facilitators
        client.put(
            "/api/roster/p1?program_id=test_org_id",
            json={
                "name": "Alice",
                "religion": "Christian",
                "gender": "Female",
                "is_facilitator": True,
            },
        )
        client.put(
            "/api/roster/p2?program_id=test_org_id",
            json={
                "name": "Bob",
                "religion": "Jewish",
                "gender": "Male",
                "is_facilitator": False,
            },
        )
        response = client.post(
            "/api/roster/generate?program_id=test_org_id",
            json={"num_tables": 2, "num_sessions": 1},
        )
        assert response.status_code == 400
        assert "facilitator" in response.json()["detail"].lower()


class TestFullFlow:
    def test_create_roster_and_generate(self, client):
        """Create participants via API, then generate assignments."""
        for i in range(6):
            response = client.put(
                f"/api/roster/p{i}?program_id=test_org_id",
                json={
                    "name": f"Person{i}",
                    "religion": ["Christian", "Jewish", "Muslim"][i % 3],
                    "gender": ["Male", "Female"][i % 2],
                    "partner_id": None,
                },
            )
            assert response.status_code == 200

        roster = client.get("/api/roster/?program_id=test_org_id")
        assert len(roster.json()["participants"]) == 6

        response = client.post(
            "/api/roster/generate?program_id=test_org_id",
            json={
                "num_tables": 2,
                "num_sessions": 2,
            },
        )
        assert response.status_code == 200
        assert "assignment_set_id" in response.json()


class TestGenerateRefusesCompletedSessions:
    """A whole-program rebuild cannot run once a Session is frozen."""

    def _add_participants(self, client, count=2):
        for i in range(count):
            client.put(
                f"/api/roster/p{i}?program_id=test_org_id",
                json={
                    "name": f"Person{i}",
                    "religion": ["Christian", "Jewish", "Muslim"][i % 3],
                    "gender": ["Male", "Female"][i % 2],
                    "partner_id": None,
                },
            )

    def test_generate_is_refused_when_a_session_is_complete(self, client):
        self._add_participants(client)
        client.post(
            "/api/roster/generate?program_id=test_org_id",
            json={"num_tables": 1, "num_sessions": 6},
        )
        assert (
            client.post(
                "/api/assignments/completion/6?program_id=test_org_id"
            ).status_code
            == 200
        )

        response = client.post(
            "/api/roster/generate?program_id=test_org_id",
            json={"num_tables": 1, "num_sessions": 3},
        )

        assert response.status_code == 409
        assert "Session 6 is already complete" in response.json()["detail"]

    def test_generate_still_works_when_nothing_is_complete(self, client):
        self._add_participants(client)

        response = client.post(
            "/api/roster/generate?program_id=test_org_id",
            json={"num_tables": 1, "num_sessions": 3},
        )

        assert response.status_code == 200

    def test_refusal_does_not_repoint_the_program(self, client):
        """The guard must run before the Firestore write, not after."""
        self._add_participants(client)
        first = client.post(
            "/api/roster/generate?program_id=test_org_id",
            json={"num_tables": 1, "num_sessions": 6},
        ).json()["assignment_set_id"]
        client.post("/api/assignments/completion/6?program_id=test_org_id")

        client.post(
            "/api/roster/generate?program_id=test_org_id",
            json={"num_tables": 1, "num_sessions": 3},
        )

        from api.services.assignment_set_storage import AssignmentSetStorage

        assert AssignmentSetStorage().get_current_set_id("test_org_id") == first
