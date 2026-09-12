"""Keep-apart ids resolve to names when the roster is frozen."""

from api.routers.roster import _roster_to_participant_list


def _p(pid, name):
    return {
        "id": pid,
        "name": name,
        "religion": "Christian",
        "gender": "Female",
        "is_facilitator": False,
        "keep_together": False,
    }


def test_a_pair_resolves_to_names_on_both_people():
    people = [_p("a", "Ken Adler"), _p("b", "Bill Steigelmann")]

    result = _roster_to_participant_list(people, keep_apart_pairs=[("a", "b")])

    by_name = {p["name"]: p for p in result}
    assert by_name["Ken Adler"]["keep_apart"] == ["Bill Steigelmann"]
    assert by_name["Bill Steigelmann"]["keep_apart"] == ["Ken Adler"]


def test_someone_in_two_pairs_carries_both():
    people = [_p("a", "A"), _p("b", "B"), _p("c", "C")]

    result = _roster_to_participant_list(
        people, keep_apart_pairs=[("a", "b"), ("a", "c")]
    )

    by_name = {p["name"]: p for p in result}
    assert by_name["A"]["keep_apart"] == ["B", "C"]


def test_a_pair_naming_a_deleted_participant_is_dropped():
    people = [_p("a", "A")]

    result = _roster_to_participant_list(people, keep_apart_pairs=[("a", "gone")])

    assert result[0]["keep_apart"] == []


def test_no_pairs_is_an_empty_list_not_a_missing_key():
    result = _roster_to_participant_list([_p("a", "A")], keep_apart_pairs=[])
    assert result[0]["keep_apart"] == []


def test_ordering_is_sorted_not_insertion_order():
    people = [_p("a", "A"), _p("b", "B"), _p("c", "C")]

    result = _roster_to_participant_list(
        people, keep_apart_pairs=[("a", "c"), ("a", "b")]
    )

    by_name = {p["name"]: p for p in result}
    assert by_name["A"]["keep_apart"] == ["B", "C"]


def test_a_duplicate_pair_is_not_stamped_twice():
    """This function does not trust the write boundary to have deduped."""
    people = [_p("a", "A"), _p("b", "B")]

    result = _roster_to_participant_list(
        people, keep_apart_pairs=[("a", "b"), ("a", "b")]
    )

    by_name = {p["name"]: p for p in result}
    assert by_name["A"]["keep_apart"] == ["B"]


def test_two_ids_sharing_a_name_collapse_rather_than_raise():
    """Accepted, not a bug: people are matched by name system-wide, so two
    people called Ken both receive a rule aimed at either of them. The extra
    separation is the safe direction, and a pair that resolves to one name on
    both sides is dropped as a self-pair rather than separating Ken from Ken."""
    people = [_p("a", "Ken"), _p("b", "Ken"), _p("c", "Dana")]

    result = _roster_to_participant_list(
        people, keep_apart_pairs=[("a", "b"), ("a", "c")]
    )

    kens = [p for p in result if p["name"] == "Ken"]
    assert [p["keep_apart"] for p in kens] == [["Dana"], ["Dana"]]
    assert [p["keep_apart"] for p in result if p["name"] == "Dana"] == [["Ken"]]


class TestFrozenOnGenerate:
    """The wiring itself: ``POST /roster/generate`` reads the stored pairs.

    The unit tests above all call ``_roster_to_participant_list`` directly, so
    they pass whether or not the endpoint ever asks storage for the pairs. This
    is the only test that fails if the ``keep_apart_pairs=`` argument is dropped
    at the call site.
    """

    def _roster(self, count):
        return [
            {
                "id": f"p{i}",
                "name": f"Person{i}",
                "religion": ["Christian", "Jewish", "Muslim"][i % 3],
                "gender": ["Male", "Female"][i % 2],
                "partner_id": None,
                "is_facilitator": i < 2,
            }
            for i in range(count)
        ]

    def test_stored_pairs_reach_the_frozen_participant_data(
        self, client, add_roster_to_firestore
    ):
        from api.services.assignment_set_storage import AssignmentSetStorage
        from api.services.keep_apart_storage import KeepApartStorage

        add_roster_to_firestore(self._roster(6))
        KeepApartStorage().add_pair("test_org_id", "p0", "p1")

        response = client.post(
            "/api/roster/generate?program_id=test_org_id",
            json={"num_tables": 2, "num_sessions": 2},
        )

        assert response.status_code == 200, response.text

        storage = AssignmentSetStorage()
        set_id = storage.get_current_set_id("test_org_id")
        frozen = storage.get_set("test_org_id", set_id)["participant_data"]
        by_name = {p["name"]: p for p in frozen}

        assert by_name["Person0"]["keep_apart"] == ["Person1"]
        assert by_name["Person1"]["keep_apart"] == ["Person0"]
        assert by_name["Person2"]["keep_apart"] == []
