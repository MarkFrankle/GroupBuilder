from assignment_logic.api_handler import handle_generate_assignments


def _people(n):
    return [
        {
            "id": i + 1,
            "name": f"P{i}",
            "religion": "X",
            "gender": "M",
            "couple_id": None,
        }
        for i in range(n)
    ]


def test_seeded_pairing_is_avoided_when_slack_exists():
    people = _people(9)
    seed = {(1, 2)}
    result = handle_generate_assignments(
        people,
        numTables=3,
        numSessions=1,
        max_time_seconds=5,
        historical_pairings=seed,
    )
    assert result["status"] == "success"
    tables = result["assignments"][0]["tables"]
    for _, seats in tables.items():
        names = {s["name"] for s in seats}
        assert not ({"P0", "P1"} <= names), "seeded pair should be split"


def test_handler_no_longer_accepts_use_incremental():
    import pytest

    people = _people(9)
    with pytest.raises(TypeError):
        handle_generate_assignments(
            people, numTables=3, numSessions=4, use_incremental=True
        )


def test_handler_returns_a_plan_within_the_computed_pairwise_cap():
    from assignment_logic.capacity import compute_pairwise_cap

    people = _people(9)
    result = handle_generate_assignments(
        people, numTables=3, numSessions=4, max_time_seconds=30
    )
    assert result["status"] == "success"

    cap = compute_pairwise_cap(people, num_tables=3, num_sessions=4)
    meetings = {}
    for session in result["assignments"]:
        for seats in session["tables"].values():
            names = sorted(s["name"] for s in seats)
            for i in range(len(names)):
                for j in range(i + 1, len(names)):
                    key = (names[i], names[j])
                    meetings[key] = meetings.get(key, 0) + 1
    assert max(meetings.values()) <= cap


def test_handler_reports_the_caps_it_actually_solved_with():
    people = _people(9)
    result = handle_generate_assignments(
        people, numTables=3, numSessions=4, max_time_seconds=30
    )
    assert result["status"] == "success"
    assert result["pairwise_cap"] is not None
    assert result["table_overlap_cap"] is not None
