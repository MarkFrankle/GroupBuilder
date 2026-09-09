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
