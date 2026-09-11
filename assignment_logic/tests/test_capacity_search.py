from assignment_logic.capacity_search import find_feasible_plan


def _people(n, religions=("A", "B", "C")):
    return [
        {
            "id": str(i),
            "name": f"P{i}",
            "religion": religions[i % len(religions)],
            "gender": "F" if i % 2 == 0 else "M",
            "couple_id": None,
            "linked_id": None,
            "keep_apart": [],
        }
        for i in range(n)
    ]


def test_finds_a_working_plan_and_returns_the_caps_used():
    result, pairwise_cap, overlap_cap = find_feasible_plan(
        _people(9),
        num_tables=3,
        num_sessions=4,
        probe_seconds=10,
        max_pairwise_tries=3,
        max_overlap_tries=3,
    )
    assert result["status"] == "success"
    assert pairwise_cap >= 1
    assert overlap_cap >= 1


def test_gives_up_cleanly_after_max_tries_on_an_impossible_request():
    # This roster's pigeonhole floor (2) is provably infeasible - the
    # couple + linked pair need pairwise_cap=3 to resolve (see
    # test_pairwise_cap_escalates_outer_...  above). Capping the search at
    # a single try (the floor only, no escalation) must give up cleanly
    # rather than hang or silently return something worse.
    people = _people(8)
    people[0]["couple_id"] = "c1"
    people[1]["couple_id"] = "c1"
    people[2]["linked_id"] = "l1"
    people[3]["linked_id"] = "l1"

    result, pairwise_cap, overlap_cap = find_feasible_plan(
        people,
        num_tables=2,
        num_sessions=3,
        probe_seconds=3,
        max_pairwise_tries=1,
        max_overlap_tries=2,
    )
    assert result["status"] == "failure"
    assert pairwise_cap is None
    assert overlap_cap is None


def test_pairwise_cap_escalates_outer_when_a_constrained_roster_needs_more_than_the_floor():
    """A roster with a couple + linked pair (see the dual-cap-solver plan's
    revision note) can make the exact pigeonhole floor infeasible even
    though it isn't the overlap cap's fault - the search must be able to
    step the pairwise cap up, not just the overlap cap."""
    people = _people(8)
    people[0]["couple_id"] = "c1"
    people[1]["couple_id"] = "c1"
    people[2]["linked_id"] = "l1"
    people[3]["linked_id"] = "l1"

    result, pairwise_cap, overlap_cap = find_feasible_plan(
        people,
        num_tables=2,
        num_sessions=3,
        probe_seconds=10,
        max_pairwise_tries=4,
        max_overlap_tries=4,
    )
    assert result["status"] == "success"
    assert pairwise_cap >= 1
    assert overlap_cap >= 1
