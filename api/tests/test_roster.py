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

    def test_carries_absent_sessions(self):
        participants = [
            {
                "id": "a",
                "name": "Alice",
                "religion": "Christian",
                "gender": "Female",
                "absent_sessions": [4, 2],
            },
            {"id": "b", "name": "Bob", "religion": "Jewish", "gender": "Male"},
        ]
        result = _roster_to_participant_list(participants)
        assert result[0]["absent_sessions"] == [2, 4]
        assert result[1]["absent_sessions"] == []


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
                "is_facilitator": True,
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
                "is_facilitator": True,
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
            json={"num_tables": 1, "num_sessions": 1},
        )

        assert response.status_code == 200
        set_id = response.json()["assignment_set_id"]

        from api.services.assignment_set_storage import AssignmentSetStorage

        storage = AssignmentSetStorage()
        assert storage.get_current_set_id("test_org_id") == set_id

        stored = storage.get_set("test_org_id", set_id)
        assert sorted(p["name"] for p in stored["participant_data"]) == ["Alice", "Bob"]
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
        # 4 participants, 1 facilitator, 2 tables → need 2 facilitators. The
        # roster is big enough to clear the headcount check, so the facilitator
        # shortfall is what the coordinator hears about.
        client.put(
            "/api/roster/p1?program_id=test_org_id",
            json={
                "name": "Alice",
                "religion": "Christian",
                "gender": "Female",
                "is_facilitator": True,
            },
        )
        for i, (name, religion, gender) in enumerate(
            [
                ("Bob", "Jewish", "Male"),
                ("Cara", "Muslim", "Female"),
                ("Dan", "Christian", "Male"),
            ],
            start=2,
        ):
            client.put(
                f"/api/roster/p{i}?program_id=test_org_id",
                json={
                    "name": name,
                    "religion": religion,
                    "gender": gender,
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
                    "is_facilitator": i < 3,
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

    def _add_participants(self, client, count=2, facilitators=1):
        for i in range(count):
            client.put(
                f"/api/roster/p{i}?program_id=test_org_id",
                json={
                    "name": f"Person{i}",
                    "religion": ["Christian", "Jewish", "Muslim"][i % 3],
                    "gender": ["Male", "Female"][i % 2],
                    "partner_id": None,
                    "is_facilitator": i < facilitators,
                },
            )

    def test_generate_still_works_when_nothing_is_complete(self, client):
        self._add_participants(client)

        response = client.post(
            "/api/roster/generate?program_id=test_org_id",
            json={"num_tables": 1, "num_sessions": 3},
        )

        assert response.status_code == 200

    def test_rebuild_while_pending_is_refused_and_does_not_repoint(self, client):
        self._add_participants(client)
        client.post(
            "/api/roster/generate?program_id=test_org_id",
            json={"num_tables": 1, "num_sessions": 6},
        )
        client.post("/api/assignments/completion/1?program_id=test_org_id")

        provisional = client.post(
            "/api/roster/generate?program_id=test_org_id",
            json={"num_tables": 1, "num_sessions": 6},
        ).json()["assignment_set_id"]

        again = client.post(
            "/api/roster/generate?program_id=test_org_id",
            json={"num_tables": 1, "num_sessions": 6},
        )
        assert again.status_code == 409

        from api.services.assignment_set_storage import AssignmentSetStorage

        assert AssignmentSetStorage().get_current_set_id("test_org_id") == provisional


class TestGenerateCarriesCompletedSessionsForward:
    """Item 6b: a mid-program rebuild freezes completed sessions."""

    def _seed_program(self, client, people=9, tables=3, sessions=4):
        for i in range(people):
            client.put(
                f"/api/roster/p{i}?program_id=test_org_id",
                json={
                    "name": f"P{i}",
                    "religion": ["Christian", "Jewish", "Muslim"][i % 3],
                    "gender": ["Male", "Female"][i % 2],
                    "partner_id": None,
                    "is_facilitator": i < tables,
                },
            )
        r = client.post(
            "/api/roster/generate?program_id=test_org_id",
            json={"num_tables": tables, "num_sessions": sessions},
        )
        assert r.status_code == 200
        return r.json()["assignment_set_id"]

    def test_completed_session_is_frozen_across_the_rebuild(self, client):
        self._seed_program(client, people=12)
        client.post("/api/assignments/completion/1?program_id=test_org_id")

        before = client.get("/api/assignments/results?program_id=test_org_id").json()
        session_one_before = next(s for s in before if s["session"] == 1)

        client.delete("/api/roster/p8?program_id=test_org_id")
        r = client.post(
            "/api/roster/generate?program_id=test_org_id",
            json={"num_tables": 3, "num_sessions": 4},
        )
        assert r.status_code == 200, r.json()

        after = client.get("/api/assignments/results?program_id=test_org_id").json()
        session_one_after = next(s for s in after if s["session"] == 1)
        assert session_one_after["tables"] == session_one_before["tables"]
        assert session_one_after.get("absentParticipants") == session_one_before.get(
            "absentParticipants"
        )

    def test_a_rename_alongside_a_removal_propagates_into_the_frozen_session(
        self, client
    ):
        self._seed_program(client, people=12)
        client.post("/api/assignments/completion/1?program_id=test_org_id")
        client.put(
            "/api/roster/p0?program_id=test_org_id",
            json={
                "name": "P0renamed",
                "religion": "Christian",
                "gender": "Male",
                "partner_id": None,
                "is_facilitator": True,
            },
        )
        client.delete("/api/roster/p8?program_id=test_org_id")
        r = client.post(
            "/api/roster/generate?program_id=test_org_id",
            json={"num_tables": 3, "num_sessions": 4},
        )
        assert r.status_code == 200, r.json()
        after = client.get("/api/assignments/results?program_id=test_org_id").json()
        session_one = next(s for s in after if s["session"] == 1)
        names = {
            seat["name"] for _, seats in session_one["tables"].items() for seat in seats
        }
        assert "P0renamed" in names
        assert "P0" not in names

    def test_a_participant_added_after_completion_appears_only_in_resolved_sessions(
        self, client
    ):
        self._seed_program(client)
        client.post("/api/assignments/completion/1?program_id=test_org_id")
        client.put(
            "/api/roster/p9?program_id=test_org_id",
            json={
                "name": "P9new",
                "religion": "Jewish",
                "gender": "Female",
                "partner_id": None,
            },
        )
        r = client.post(
            "/api/roster/generate?program_id=test_org_id",
            json={"num_tables": 3, "num_sessions": 4},
        )
        assert r.status_code == 200, r.json()
        after = client.get("/api/assignments/results?program_id=test_org_id").json()
        s1 = next(s for s in after if s["session"] == 1)
        s1_names = {seat["name"] for _, seats in s1["tables"].items() for seat in seats}
        assert "P9new" not in s1_names
        later_names = {
            seat["name"]
            for s in after
            if s["session"] > 1
            for _, seats in s["tables"].items()
            for seat in seats
        }
        assert "P9new" in later_names

    def test_infeasible_rebuild_leaves_the_old_plan_current(self, client):
        first = self._seed_program(client)
        client.post("/api/assignments/completion/1?program_id=test_org_id")
        # Link P0 and P1 as a couple, then demand a single table: couples
        # separation is a hard constraint, so the remainder solve is infeasible.
        client.put(
            "/api/roster/p0?program_id=test_org_id",
            json={
                "name": "P0",
                "religion": "Christian",
                "gender": "Male",
                "partner_id": "p1",
            },
        )
        client.put(
            "/api/roster/p1?program_id=test_org_id",
            json={
                "name": "P1",
                "religion": "Jewish",
                "gender": "Female",
                "partner_id": "p0",
            },
        )
        r = client.post(
            "/api/roster/generate?program_id=test_org_id",
            json={"num_tables": 1, "num_sessions": 4},
        )
        assert r.status_code == 400, r.json()
        from api.services.assignment_set_storage import AssignmentSetStorage

        assert AssignmentSetStorage().get_current_set_id("test_org_id") == first
        meta = client.get("/api/assignments/metadata?program_id=test_org_id").json()
        assert meta["accepted"] is not False

    def test_the_rebuilt_set_is_provisional(self, client):
        self._seed_program(client, people=12)
        client.post("/api/assignments/completion/1?program_id=test_org_id")
        client.delete("/api/roster/p8?program_id=test_org_id")
        client.post(
            "/api/roster/generate?program_id=test_org_id",
            json={"num_tables": 3, "num_sessions": 4},
        )

        meta = client.get("/api/assignments/metadata?program_id=test_org_id").json()
        assert meta["accepted"] is False
        assert meta["previous_set_id"] is not None

    def test_rebuild_with_every_session_complete_is_refused(self, client):
        self._seed_program(client, sessions=2)
        client.post("/api/assignments/completion/1?program_id=test_org_id")
        client.post("/api/assignments/completion/2?program_id=test_org_id")
        client.delete("/api/roster/p8?program_id=test_org_id")

        r = client.post(
            "/api/roster/generate?program_id=test_org_id",
            json={"num_tables": 3, "num_sessions": 2},
        )
        assert r.status_code == 409
        assert "every session is complete" in r.json()["detail"].lower()

    def test_rename_only_change_is_allowed_when_all_sessions_complete(self, client):
        self._seed_program(client, sessions=2)
        client.post("/api/assignments/completion/1?program_id=test_org_id")
        client.post("/api/assignments/completion/2?program_id=test_org_id")
        client.put(
            "/api/roster/p0?program_id=test_org_id",
            json={
                "name": "P0x",
                "religion": "Christian",
                "gender": "Male",
                "partner_id": None,
                "is_facilitator": True,
            },
        )
        r = client.post(
            "/api/roster/generate?program_id=test_org_id",
            json={"num_tables": 3, "num_sessions": 2},
        )
        assert r.status_code == 200
        assert r.json()["rebuilt"] is False
        after = client.get("/api/assignments/results?program_id=test_org_id").json()
        names = {
            s["name"]
            for sess in after
            for _, seats in sess["tables"].items()
            for s in seats
        }
        assert "P0x" in names and "P0" not in names


class TestCanonicalRoster:
    """GET /api/roster/canonical serves the roster the current assignments were built from."""

    def test_returns_the_frozen_roster_and_shape(
        self, client, add_assignment_set_to_firestore
    ):
        add_assignment_set_to_firestore(
            {
                "participant_data": [
                    {
                        "id": 1,
                        "name": "Alice",
                        "religion": "Christian",
                        "gender": "Female",
                        "partner": None,
                        "is_facilitator": False,
                        "keep_together": False,
                    }
                ],
                "num_tables": 2,
                "num_sessions": 3,
            }
        )

        response = client.get("/api/roster/canonical?program_id=test_org_id")

        assert response.status_code == 200
        body = response.json()
        assert body["num_tables"] == 2
        assert body["num_sessions"] == 3
        assert [p["name"] for p in body["participants"]] == ["Alice"]

    def test_derives_absent_sessions_from_the_current_version(
        self, client, add_assignment_set_to_firestore, add_version_to_firestore
    ):
        set_id = add_assignment_set_to_firestore(
            {"participant_data": _canonical(4), "num_tables": 2, "num_sessions": 2}
        )
        add_version_to_firestore(
            set_id,
            "v1",
            [
                {"session": 1, "tables": {"1": [], "2": []}},
                {
                    "session": 2,
                    "tables": {"1": [], "2": []},
                    "absentParticipants": [{"name": "Person3"}],
                },
            ],
        )

        body = client.get("/api/roster/canonical?program_id=test_org_id").json()
        by_name = {p["name"]: p for p in body["participants"]}
        assert by_name["Person3"]["absent_sessions"] == [2]
        assert by_name["Person0"]["absent_sessions"] == []

    def test_no_assignment_set_yet_is_a_normal_state(self, client):
        """A program before its first generate has no canonical roster. That is
        not an error - it is the first-run state, and the page renders unlocked."""
        response = client.get("/api/roster/canonical?program_id=test_org_id")

        assert response.status_code == 200
        assert response.json() == {
            "participants": [],
            "num_tables": None,
            "num_sessions": None,
        }


def _draft(count, **overrides):
    """A roster big enough to clear the shortfall gate and mix cleanly.

    The first three people (one per religion) are marked as facilitators, which
    clears the "at least as many facilitators as tables" gate for every
    num_tables value used in this file (max 3) without tripping the
    same-religion-per-table facilitator cap.
    """
    people = []
    for i in range(count):
        people.append(
            {
                "id": f"p{i}",
                "name": f"Person{i}",
                "religion": ["Christian", "Jewish", "Muslim"][i % 3],
                "gender": ["Male", "Female"][i % 2],
                "partner_id": None,
                "is_facilitator": i < 3,
            }
        )
    return people


def _canonical(count):
    """The same roster in canonical form — what ``_roster_to_participant_list``
    produces, which is exactly what generate freezes on the set."""
    return _roster_to_participant_list(_draft(count))


class TestRebuild:
    """``POST /roster/generate`` solves first and commits only on success."""

    def test_a_failed_solve_leaves_the_old_set_in_place(
        self,
        client,
        add_assignment_set_to_firestore,
        add_roster_to_firestore,
        monkeypatch,
    ):
        """The regression test for the bug this endpoint had: it used to mint an
        empty set and repoint the program *before* anything solved, so a failed
        solve made the old plan unreachable and the new one nonexistent."""
        from api.services.assignment_set_storage import AssignmentSetStorage
        from api.services.program_solve import SolveFailed, NO_SOLUTION

        original = add_assignment_set_to_firestore(
            {
                "participant_data": _canonical(4),
                "num_tables": 2,
                "num_sessions": 2,
            }
        )
        add_roster_to_firestore(_draft(6))

        def boom(**kwargs):
            raise SolveFailed(NO_SOLUTION)

        monkeypatch.setattr("api.routers.roster.solve_program", boom)

        response = client.post(
            "/api/roster/generate?program_id=test_org_id",
            json={"num_tables": 2, "num_sessions": 2},
        )

        assert response.status_code == 400
        assert response.json()["detail"] == NO_SOLUTION
        assert AssignmentSetStorage().get_current_set_id("test_org_id") == original

    def test_a_failed_version_write_leaves_the_old_set_in_place(
        self,
        client,
        add_assignment_set_to_firestore,
        add_roster_to_firestore,
        monkeypatch,
    ):
        """The narrower half of the same bug: the solve succeeded, the set was
        created, and then the version write failed. The program must still point
        at the old set, because a program pointed at a versionless set shows an
        empty plan."""
        from api.services.assignment_set_storage import AssignmentSetStorage

        original_set_id = add_assignment_set_to_firestore(
            {"participant_data": [], "num_tables": 2, "num_sessions": 1}
        )
        add_roster_to_firestore(
            [
                {
                    "id": f"p{i}",
                    "name": f"P{i}",
                    "religion": "Other",
                    "gender": "Other",
                    "partner_id": None,
                    "is_facilitator": i < 2,
                    "keep_together": False,
                }
                for i in range(4)
            ]
        )

        def _boom(*args, **kwargs):
            raise RuntimeError("firestore is having a day")

        monkeypatch.setattr(AssignmentSetStorage, "save_version", _boom)

        response = client.post(
            "/api/roster/generate?program_id=test_org_id",
            json={"num_tables": 2, "num_sessions": 1},
        )

        assert response.status_code == 500
        assert (
            AssignmentSetStorage().get_current_set_id("test_org_id") == original_set_id
        )

    def test_a_successful_rebuild_mints_a_set_with_its_first_version(
        self, client, add_roster_to_firestore
    ):
        from api.services.assignment_set_storage import AssignmentSetStorage

        add_roster_to_firestore(_draft(6))

        response = client.post(
            "/api/roster/generate?program_id=test_org_id",
            json={"num_tables": 2, "num_sessions": 2},
        )

        assert response.status_code == 200
        body = response.json()
        assert body["rebuilt"] is True

        storage = AssignmentSetStorage()
        set_id = body["assignment_set_id"]
        assert storage.get_current_set_id("test_org_id") == set_id
        assert storage.get_version("test_org_id", set_id) is not None

    def test_a_shortfall_refuses_before_any_work(self, client, add_roster_to_firestore):
        add_roster_to_firestore(_draft(3))

        response = client.post(
            "/api/roster/generate?program_id=test_org_id",
            json={"num_tables": 3, "num_sessions": 2},
        )

        assert response.status_code == 400
        assert response.json()["detail"] == "Add 3 more participants."

    def test_a_rename_only_change_propagates_without_solving(
        self,
        client,
        add_assignment_set_to_firestore,
        add_version_to_firestore,
        add_roster_to_firestore,
        monkeypatch,
    ):
        """Skipping the rebuild without propagating would leave the old spelling
        on the Assignments page forever — participants are matched by name."""
        from api.services.assignment_set_storage import AssignmentSetStorage

        canonical = _canonical(4)
        canonical[0]["name"] = "Kathrine"
        set_id = add_assignment_set_to_firestore(
            {"participant_data": canonical, "num_tables": 2, "num_sessions": 2}
        )
        add_version_to_firestore(
            set_id,
            "v1",
            [
                {
                    "session": 1,
                    "tables": {
                        "1": [{"name": "Kathrine"}, {"name": "Person1"}],
                        "2": [{"name": "Person2"}, {"name": "Person3"}],
                    },
                }
            ],
        )
        draft = _draft(4)
        draft[0]["name"] = "Katherine"
        add_roster_to_firestore(draft)

        def never(**kwargs):
            raise AssertionError("a rename must not run the solver")

        monkeypatch.setattr("api.routers.roster.solve_program", never)

        response = client.post(
            "/api/roster/generate?program_id=test_org_id",
            json={"num_tables": 2, "num_sessions": 2},
        )

        assert response.status_code == 200
        body = response.json()
        assert body["rebuilt"] is False
        assert body["assignment_set_id"] == set_id

        storage = AssignmentSetStorage()
        version = storage.get_version("test_org_id", set_id, "v1")
        assert version["assignments"][0]["tables"]["1"][0]["name"] == "Katherine"
        stored = storage.get_set("test_org_id", set_id)
        assert "Katherine" in [p["name"] for p in stored["participant_data"]]
        assert "Kathrine" not in [p["name"] for p in stored["participant_data"]]

    def test_a_rename_reaches_every_version_not_just_the_head(
        self,
        client,
        add_assignment_set_to_firestore,
        add_version_to_firestore,
        add_roster_to_firestore,
    ):
        """Promotion can put any version of the current set back at the head, so
        a rename that only fixed the head would let undoing a shuffle resurrect
        the old spelling - while the page reported Locked, because the roster
        still matched participant_data."""
        canonical = [
            {
                "name": "Kathrine",
                "religion": "Other",
                "gender": "Other",
                "partner": None,
                "is_facilitator": False,
                "keep_together": False,
            }
        ]
        set_id = add_assignment_set_to_firestore(
            {"participant_data": canonical, "num_tables": 1, "num_sessions": 1}
        )
        for version_id in ("v1", "v2"):
            add_version_to_firestore(
                set_id,
                version_id,
                [
                    {
                        "session": 1,
                        "tables": {"1": [{"name": "Kathrine", "partner": None}]},
                    }
                ],
            )
        add_roster_to_firestore(
            [
                {
                    "id": "a",
                    "name": "Katherine",
                    "religion": "Other",
                    "gender": "Other",
                    "partner_id": None,
                    "is_facilitator": False,
                    "keep_together": False,
                }
            ]
        )

        response = client.post(
            "/api/roster/generate?program_id=test_org_id",
            json={"num_tables": 1, "num_sessions": 1},
        )

        assert response.status_code == 200
        assert response.json()["rebuilt"] is False

        from api.services.assignment_set_storage import AssignmentSetStorage

        storage = AssignmentSetStorage()
        for version_id in ("v1", "v2"):
            version = storage.get_version("test_org_id", set_id, version_id)
            seated = version["assignments"][0]["tables"]["1"][0]["name"]
            assert seated == "Katherine", f"{version_id} kept the old spelling"

    def test_absences_survive_a_rebuild(
        self,
        client,
        add_assignment_set_to_firestore,
        add_version_to_firestore,
        add_roster_to_firestore,
    ):
        """Absences are read off the current version every time — there is no
        checkbox, because forgetting one silently seats someone who is away."""
        from api.services.assignment_set_storage import AssignmentSetStorage

        set_id = add_assignment_set_to_firestore(
            {"participant_data": _canonical(8), "num_tables": 2, "num_sessions": 2}
        )
        add_version_to_firestore(
            set_id,
            "v1",
            [
                {"session": 1, "tables": {"1": [], "2": []}},
                {
                    "session": 2,
                    "tables": {"1": [], "2": []},
                    "absentParticipants": [{"name": "Person7"}],
                },
            ],
        )
        add_roster_to_firestore(_draft(8))

        response = client.post(
            "/api/roster/generate?program_id=test_org_id",
            json={"num_tables": 2, "num_sessions": 2},
        )

        assert response.status_code == 200
        new_set_id = response.json()["assignment_set_id"]
        version = AssignmentSetStorage().get_version("test_org_id", new_set_id)

        session_two = version["assignments"][1]
        assert [p["name"] for p in session_two["absentParticipants"]] == ["Person7"]
        seated = [
            person["name"]
            for seats in session_two["tables"].values()
            for person in seats
        ]
        assert "Person7" not in seated

    def test_first_build_applies_prebuild_absences(
        self, client, add_roster_to_firestore
    ):
        """No assignment set yet: the per-participant ``absent_sessions`` on the
        live roster is the only source, and it must reach the first solve."""
        from api.services.assignment_set_storage import AssignmentSetStorage

        roster = _draft(6)
        roster[5]["absent_sessions"] = [2]
        add_roster_to_firestore(roster)

        response = client.post(
            "/api/roster/generate?program_id=test_org_id",
            json={"num_tables": 2, "num_sessions": 2},
        )
        assert response.status_code == 200
        set_id = response.json()["assignment_set_id"]
        version = AssignmentSetStorage().get_version("test_org_id", set_id)

        session_one, session_two = version["assignments"]
        assert [p["name"] for p in session_two.get("absentParticipants", [])] == [
            "Person5"
        ]
        seated_two = [
            person["name"]
            for seats in session_two["tables"].values()
            for person in seats
        ]
        seated_one = [
            person["name"]
            for seats in session_one["tables"].values()
            for person in seats
        ]
        assert "Person5" not in seated_two
        assert "Person5" in seated_one

    def test_completion_refusals_still_fire(
        self, client, add_assignment_set_to_firestore, add_roster_to_firestore
    ):
        add_assignment_set_to_firestore(
            {"participant_data": _canonical(4), "num_tables": 2, "num_sessions": 2}
        )
        add_roster_to_firestore(_draft(4))
        assert (
            client.post(
                "/api/assignments/completion/1?program_id=test_org_id"
            ).status_code
            == 200
        )
        assert (
            client.post(
                "/api/assignments/completion/2?program_id=test_org_id"
            ).status_code
            == 200
        )

        response = client.post(
            "/api/roster/generate?program_id=test_org_id",
            json={"num_tables": 2, "num_sessions": 2},
        )

        assert response.status_code == 409


class TestDiscard:
    """``POST /roster/discard`` throws the draft away and rewrites the live
    roster from the roster the current sessions were built from."""

    def test_refuses_when_there_is_nothing_to_discard_back_to(
        self, client, add_roster_to_firestore
    ):
        add_roster_to_firestore(_draft(4))

        response = client.post("/api/roster/discard?program_id=test_org_id")

        assert response.status_code == 400

    def test_restores_the_canonical_roster_by_name(
        self, client, add_assignment_set_to_firestore, add_roster_to_firestore
    ):
        """Document ids change across a discard, and that is safe: nothing
        outside the grid holds a roster document id, and ``partner_id`` is
        re-resolved to names at every generate."""
        from api.services.roster_service import RosterService

        canonical = _canonical(4)
        canonical[0]["partner"] = canonical[1]["name"]
        canonical[1]["partner"] = canonical[0]["name"]
        canonical[0]["keep_together"] = True
        canonical[1]["keep_together"] = True
        canonical[2]["is_facilitator"] = True
        add_assignment_set_to_firestore(
            {"participant_data": canonical, "num_tables": 2, "num_sessions": 2}
        )
        draft = _draft(6)
        draft[0]["name"] = "Typo"
        add_roster_to_firestore(draft)

        response = client.post("/api/roster/discard?program_id=test_org_id")

        assert response.status_code == 200
        roster = RosterService().get_roster("test_org_id")
        by_name = {p["name"]: p for p in roster}
        assert sorted(by_name) == sorted(p["name"] for p in canonical)
        assert "Typo" not in by_name

        # Partnerships survive, resolved back to the *new* ids.
        a, b = by_name[canonical[0]["name"]], by_name[canonical[1]["name"]]
        assert a["partner_id"] == b["id"]
        assert b["partner_id"] == a["id"]
        assert a["keep_together"] is True
        assert by_name[canonical[2]["name"]]["is_facilitator"] is True

        # The ids are new, and that is the point of the name matching above.
        assert not ({p["id"] for p in roster} & {p["id"] for p in draft})

    def test_reseeds_absent_sessions_from_the_discarded_set(
        self,
        client,
        add_assignment_set_to_firestore,
        add_version_to_firestore,
        add_roster_to_firestore,
    ):
        """The assignment set owns absences post-build, so discard writes them
        back onto the fresh roster docs - by name, since the ids are new."""
        from api.services.roster_service import RosterService

        set_id = add_assignment_set_to_firestore(
            {"participant_data": _canonical(4), "num_tables": 2, "num_sessions": 2}
        )
        add_version_to_firestore(
            set_id,
            "v1",
            [
                {"session": 1, "tables": {"1": [], "2": []}},
                {
                    "session": 2,
                    "tables": {"1": [], "2": []},
                    "absentParticipants": [{"name": "Person1"}],
                },
            ],
        )
        add_roster_to_firestore(_draft(6))

        assert (
            client.post("/api/roster/discard?program_id=test_org_id").status_code == 200
        )

        by_name = {p["name"]: p for p in RosterService().get_roster("test_org_id")}
        assert by_name["Person1"]["absent_sessions"] == [2]
        assert by_name["Person0"]["absent_sessions"] == []

    def _add_keep_apart(self, client, a_id, b_id):
        response = client.post(
            "/api/roster/keep-apart?program_id=test_org_id",
            json={"a_id": a_id, "b_id": b_id},
        )
        assert response.status_code == 200

    def _pair_names(self, client):
        """The stored pairs as name pairs, resolved through the live roster."""
        from api.services.roster_service import RosterService

        names = {p["id"]: p["name"] for p in RosterService().get_roster("test_org_id")}
        pairs = client.get("/api/roster/keep-apart?program_id=test_org_id").json()[
            "pairs"
        ]
        return sorted(
            tuple(sorted((names[a], names[b])))
            for a, b in pairs
            if a in names and b in names
        )

    def test_keep_apart_pairs_survive_a_discard(
        self, client, add_assignment_set_to_firestore, add_roster_to_firestore
    ):
        """The pairs are stored as roster document ids, and discard mints new
        ones. They have to be remapped or every rule dangles."""
        add_assignment_set_to_firestore(
            {"participant_data": _canonical(4), "num_tables": 2, "num_sessions": 2}
        )
        add_roster_to_firestore(_draft(4))
        self._add_keep_apart(client, "p0", "p2")

        assert (
            client.post("/api/roster/discard?program_id=test_org_id").status_code == 200
        )

        assert self._pair_names(client) == [("Person0", "Person2")]
        # And the pair names ids that actually exist now.
        stored = client.get("/api/roster/keep-apart?program_id=test_org_id").json()[
            "pairs"
        ]
        assert len(stored) == 1
        assert not set(stored[0]) & {"p0", "p2"}

    def test_a_pair_naming_someone_absent_from_the_frozen_set_is_dropped(
        self, client, add_assignment_set_to_firestore, add_roster_to_firestore
    ):
        """Discard restores the frozen roster, so a draft-only person is gone -
        and so is any rule about them."""
        add_assignment_set_to_firestore(
            {"participant_data": _canonical(4), "num_tables": 2, "num_sessions": 2}
        )
        add_roster_to_firestore(_draft(6))
        self._add_keep_apart(client, "p0", "p2")
        self._add_keep_apart(client, "p1", "p5")

        assert (
            client.post("/api/roster/discard?program_id=test_org_id").status_code == 200
        )

        assert self._pair_names(client) == [("Person0", "Person2")]
        assert (
            len(
                client.get("/api/roster/keep-apart?program_id=test_org_id").json()[
                    "pairs"
                ]
            )
            == 1
        )

    def test_the_frozen_keep_apart_names_are_unchanged_by_a_discard(
        self, client, add_assignment_set_to_firestore, add_roster_to_firestore
    ):
        """The end-to-end shape the roster lock depends on: what
        ``_roster_to_participant_list`` derives has to be the same on both sides
        of a discard, or the roster reads permanently dirty."""
        from api.services.roster_service import RosterService

        canonical = _canonical(4)
        canonical[0]["keep_apart"] = ["Person2"]
        canonical[2]["keep_apart"] = ["Person0"]
        add_assignment_set_to_firestore(
            {"participant_data": canonical, "num_tables": 2, "num_sessions": 2}
        )
        add_roster_to_firestore(_draft(4))
        self._add_keep_apart(client, "p0", "p2")

        def derived():
            roster = RosterService().get_roster("test_org_id")
            pairs = [
                tuple(p)
                for p in client.get(
                    "/api/roster/keep-apart?program_id=test_org_id"
                ).json()["pairs"]
            ]
            return {
                p["name"]: p["keep_apart"]
                for p in _roster_to_participant_list(roster, keep_apart_pairs=pairs)
            }

        before = derived()
        assert before["Person0"] == ["Person2"]

        assert (
            client.post("/api/roster/discard?program_id=test_org_id").status_code == 200
        )

        assert derived() == before
        assert derived() == {p["name"]: p["keep_apart"] for p in canonical}


class TestDeletePrunesKeepApart:
    """Deleting a participant retires their keep-apart rules."""

    def test_delete_removes_their_pairs_and_leaves_the_others(
        self, client, add_roster_to_firestore
    ):
        add_roster_to_firestore(_draft(4))
        for a, b in (("p0", "p1"), ("p0", "p2"), ("p1", "p3")):
            response = client.post(
                "/api/roster/keep-apart?program_id=test_org_id",
                json={"a_id": a, "b_id": b},
            )
            assert response.status_code == 200

        assert client.delete("/api/roster/p0?program_id=test_org_id").status_code == 200

        pairs = client.get("/api/roster/keep-apart?program_id=test_org_id").json()[
            "pairs"
        ]
        assert pairs == [["p1", "p3"]]
