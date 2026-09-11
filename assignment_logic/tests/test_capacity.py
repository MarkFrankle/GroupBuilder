from assignment_logic.capacity import compute_pairwise_cap, compute_overlap_lower_bound


def _people(n, religions=("A", "B", "C", "D")):
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


def test_standard_bbt_shape_floor_is_two():
    # 24 people, 4 tables of 6, 5 sessions: 300 meeting-slots over 276 pairs.
    assert compute_pairwise_cap(_people(24), num_tables=4, num_sessions=5) == 2


def test_affine_plane_shape_floor_is_one():
    # 9 people, 3 tables of 3, 4 sessions: every pair meets exactly once
    # (AG(2,3) — see CLAUDE.md's note on solver test sizing).
    assert compute_pairwise_cap(_people(9), num_tables=3, num_sessions=4) == 1


def test_couples_and_linked_pairs_are_excluded_from_the_count():
    people = _people(24)
    people[0]["couple_id"] = "c1"
    people[1]["couple_id"] = "c1"  # never meet -> removed from free_pairs
    people[2]["linked_id"] = "l1"
    people[3][
        "linked_id"
    ] = "l1"  # always meet -> removed from free_pairs and free_slots
    # Shouldn't change the floor for this shape, but must not crash and
    # must actually subtract them (regression guard for the arithmetic).
    cap = compute_pairwise_cap(people, num_tables=4, num_sessions=5)
    assert cap == 2


def test_overlap_lower_bound_uses_the_largest_table():
    # 25 people / 4 tables -> sizes 7,6,6,6. ceil(7/4) = 2.
    assert compute_overlap_lower_bound(_people(25), num_tables=4) == 2
