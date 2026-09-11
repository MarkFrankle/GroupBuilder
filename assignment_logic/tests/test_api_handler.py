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
