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
        response = roster.request(
            "DELETE",
            "/api/roster/keep-apart?program_id=test_org_id",
            json={"a_id": "dana", "b_id": "mel"},
        )
        assert response.status_code == 200
        assert response.json()["pairs"] == []
        assert (
            roster.get("/api/roster/keep-apart?program_id=test_org_id").json()["pairs"]
            == []
        )


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
