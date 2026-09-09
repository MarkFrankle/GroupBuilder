"""The keep-apart endpoints, and the two pairs a coordinator can state but shouldn't."""

import pytest


def _put(client, participant_id, name, **extra):
    body = {
        "name": name,
        "religion": "Christian",
        "gender": "Female",
        "partner_id": None,
    }
    body.update(extra)
    response = client.put(
        f"/api/roster/{participant_id}?program_id=test_org_id", json=body
    )
    assert response.status_code == 200
    return response.json()


@pytest.fixture
def roster(client):
    """Four people: a linked pair, a couple, and nobody else."""
    _put(client, "kathy", "Kathy Veit", partner_id="heather", keep_together=True)
    _put(client, "heather", "Heather Hadlock", partner_id="kathy", keep_together=True)
    _put(client, "mel", "Mel Kronick", gender="Male")
    _put(client, "dana", "Dana Ruiz")
    return client


class TestKeepApartPairs:
    def test_add_then_list(self, roster):
        response = roster.post(
            "/api/roster/keep-apart?program_id=test_org_id",
            json={"a_id": "mel", "b_id": "dana"},
        )
        assert response.status_code == 200
        assert response.json()["pairs"] == [["dana", "mel"]]

        listed = roster.get("/api/roster/keep-apart?program_id=test_org_id")
        assert listed.status_code == 200
        assert listed.json()["pairs"] == [["dana", "mel"]]

    def test_remove_in_reverse_order(self, roster):
        roster.post(
            "/api/roster/keep-apart?program_id=test_org_id",
            json={"a_id": "mel", "b_id": "dana"},
        )
        response = roster.delete(
            "/api/roster/keep-apart/dana/mel?program_id=test_org_id"
        )
        assert response.status_code == 200
        assert response.json()["pairs"] == []
        assert (
            roster.get("/api/roster/keep-apart?program_id=test_org_id").json()["pairs"]
            == []
        )

    def test_adding_the_same_pair_twice_stores_it_once(self, roster):
        for _ in range(2):
            response = roster.post(
                "/api/roster/keep-apart?program_id=test_org_id",
                json={"a_id": "mel", "b_id": "dana"},
            )
            assert response.status_code == 200
        assert response.json()["pairs"] == [["dana", "mel"]]

    def test_lists_several_pairs(self, roster):
        for a, b in (("mel", "dana"), ("kathy", "mel"), ("heather", "dana")):
            assert (
                roster.post(
                    "/api/roster/keep-apart?program_id=test_org_id",
                    json={"a_id": a, "b_id": b},
                ).status_code
                == 200
            )
        listed = roster.get("/api/roster/keep-apart?program_id=test_org_id")
        assert listed.status_code == 200
        # Insertion order, each pair ordered smallest id first.
        assert listed.json()["pairs"] == [
            ["dana", "mel"],
            ["kathy", "mel"],
            ["dana", "heather"],
        ]

    def test_deleting_a_participant_prunes_their_pairs(self, roster):
        roster.post(
            "/api/roster/keep-apart?program_id=test_org_id",
            json={"a_id": "mel", "b_id": "dana"},
        )
        assert (
            roster.delete("/api/roster/dana?program_id=test_org_id").status_code == 200
        )
        # A rule about someone who is gone is not a rule, and the stored pair
        # would otherwise name an id that can never resolve again.
        assert (
            roster.get("/api/roster/keep-apart?program_id=test_org_id").json()["pairs"]
            == []
        )
        # DELETE on a rule still skips roster validation, so removing one that
        # names a departed person is a plain no-op rather than a 400.
        removed = roster.delete(
            "/api/roster/keep-apart/dana/mel?program_id=test_org_id"
        )
        assert removed.status_code == 200
        assert removed.json()["pairs"] == []

    def test_removing_a_pair_that_was_never_added_is_a_no_op(self, roster):
        roster.post(
            "/api/roster/keep-apart?program_id=test_org_id",
            json={"a_id": "mel", "b_id": "dana"},
        )
        response = roster.delete(
            "/api/roster/keep-apart/kathy/dana?program_id=test_org_id"
        )
        assert response.status_code == 200
        assert response.json()["pairs"] == [["dana", "mel"]]


class TestRefusals:
    def test_linked_partners_are_refused_with_the_remedy(self, roster):
        response = roster.post(
            "/api/roster/keep-apart?program_id=test_org_id",
            json={"a_id": "kathy", "b_id": "heather"},
        )
        assert response.status_code == 400
        assert response.json()["detail"] == (
            "Kathy Veit and Heather Hadlock are linked partners, so they can't "
            "also be kept apart. Remove the link first."
        )

    def test_couple_is_refused_with_the_fact_and_no_lecture(self, client):
        # Its own roster, not the shared fixture: that Kathy is already linked
        # to Heather, and a linked pair takes the other refusal.
        _put(client, "kathy", "Kathy Veit", partner_id="mel")
        _put(client, "mel", "Mel Kronick", gender="Male", partner_id="kathy")
        response = client.post(
            "/api/roster/keep-apart?program_id=test_org_id",
            json={"a_id": "kathy", "b_id": "mel"},
        )
        assert response.status_code == 400
        detail = response.json()["detail"]
        assert detail == (
            "Kathy Veit and Mel Kronick are a couple, and couples are always "
            "seated at different tables."
        )
        assert "don't need" not in detail

    def test_self_pair_is_refused(self, roster):
        response = roster.post(
            "/api/roster/keep-apart?program_id=test_org_id",
            json={"a_id": "mel", "b_id": "mel"},
        )
        assert response.status_code == 400
        assert (
            response.json()["detail"] == "A person can't be kept apart from themselves."
        )

    def test_unknown_participant_is_refused(self, roster):
        response = roster.post(
            "/api/roster/keep-apart?program_id=test_org_id",
            json={"a_id": "mel", "b_id": "nobody"},
        )
        assert response.status_code == 400
        assert response.json()["detail"] == "That person is no longer on the roster."
        assert (
            roster.get("/api/roster/keep-apart?program_id=test_org_id").json()["pairs"]
            == []
        )


class TestLinkingPeopleWhoAreKeptApart:
    """The mirror refusal, on PUT. The contradiction has two doors."""

    def test_linking_a_kept_apart_pair_is_refused(self, roster):
        assert (
            roster.post(
                "/api/roster/keep-apart?program_id=test_org_id",
                json={"a_id": "mel", "b_id": "dana"},
            ).status_code
            == 200
        )
        response = roster.put(
            "/api/roster/mel?program_id=test_org_id",
            json={
                "name": "Mel Kronick",
                "religion": "Christian",
                "gender": "Male",
                "partner_id": "dana",
                "keep_together": True,
            },
        )
        assert response.status_code == 400
        assert response.json()["detail"] == (
            "Mel Kronick and Dana Ruiz are kept apart, so they can't also be "
            "linked partners. Remove the keep-apart rule first."
        )

    def test_the_refusal_holds_from_the_other_side_too(self, roster):
        roster.post(
            "/api/roster/keep-apart?program_id=test_org_id",
            json={"a_id": "mel", "b_id": "dana"},
        )
        response = roster.put(
            "/api/roster/dana?program_id=test_org_id",
            json={
                "name": "Dana Ruiz",
                "religion": "Christian",
                "gender": "Female",
                "partner_id": "mel",
                "keep_together": True,
            },
        )
        assert response.status_code == 400
        assert response.json()["detail"] == (
            "Dana Ruiz and Mel Kronick are kept apart, so they can't also be "
            "linked partners. Remove the keep-apart rule first."
        )

    def test_a_couple_over_a_kept_apart_pair_is_still_allowed(self, roster):
        roster.post(
            "/api/roster/keep-apart?program_id=test_org_id",
            json={"a_id": "mel", "b_id": "dana"},
        )
        response = roster.put(
            "/api/roster/mel?program_id=test_org_id",
            json={
                "name": "Mel Kronick",
                "religion": "Christian",
                "gender": "Male",
                "partner_id": "dana",
                "keep_together": False,
            },
        )
        assert response.status_code == 200
        assert response.json()["partner_id"] == "dana"
