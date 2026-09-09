"""Keep-apart is a hard constraint: the pair never shares a table, ever.

Every participant is identical so the religion and gender spread constraints
impose nothing - a mixed roster pins down nearly every legal partition and the
solver then has no freedom left to demonstrate the behaviour under test.
"""

from assignment_logic.group_builder import GroupBuilder


def _person(i, keep_apart=None):
    return {
        "id": i,
        "name": f"P{i}",
        "religion": "Christian",
        "gender": "Female",
        "partner": None,
        "couple_id": None,
        "linked_id": None,
        "is_facilitator": False,
        "keep_together": False,
        "keep_apart": keep_apart or [],
    }


def test_a_keep_apart_pair_never_shares_a_table():
    participants = [_person(i) for i in range(1, 10)]
    participants[0]["keep_apart"] = ["P2"]
    participants[1]["keep_apart"] = ["P1"]

    result = GroupBuilder(participants, 3, 3).generate_assignments(max_time_seconds=10)

    assert result["status"] == "success"
    for session in result["assignments"]:
        for table in session["tables"].values():
            names = {p["name"] for p in table}
            assert not {"P1", "P2"} <= names


def test_keep_apart_is_hard_enough_to_make_a_program_infeasible():
    # Three people, one table: P1 and P2 cannot be separated.
    participants = [_person(i) for i in range(1, 4)]
    participants[0]["keep_apart"] = ["P2"]
    participants[1]["keep_apart"] = ["P1"]

    result = GroupBuilder(participants, 1, 1).generate_assignments(max_time_seconds=10)

    assert result["status"] != "success"


def test_a_missing_keep_apart_field_is_treated_as_no_rule():
    # participant_data frozen before this feature has no keep_apart key.
    participants = [_person(i) for i in range(1, 10)]
    for p in participants:
        del p["keep_apart"]

    result = GroupBuilder(participants, 3, 3).generate_assignments(max_time_seconds=10)

    assert result["status"] == "success"
