import pytest
from itertools import combinations
from assignment_logic.group_builder import GroupBuilder


class TestGroupBuilder:
    """Test suite for the GroupBuilder constraint solver"""

    def test_simple_assignment_single_session(self):
        """Test that a simple problem with one session can be solved"""
        participants = [
            {
                "id": 1,
                "name": "Alice",
                "religion": "Christian",
                "gender": "Female",
                "couple_id": None,
            },
            {
                "id": 2,
                "name": "Bob",
                "religion": "Jewish",
                "gender": "Male",
                "couple_id": None,
            },
            {
                "id": 3,
                "name": "Charlie",
                "religion": "Muslim",
                "gender": "Male",
                "couple_id": None,
            },
            {
                "id": 4,
                "name": "Diana",
                "religion": "Christian",
                "gender": "Female",
                "couple_id": None,
            },
        ]

        builder = GroupBuilder(participants, num_tables=2, num_sessions=1)
        result = builder.generate_assignments()

        assert result["status"] == "success"
        assert len(result["assignments"]) == 1
        assert len(result["assignments"][0]["tables"]) == 2

    def test_couple_separation(self):
        """Test that couples are seated at different tables"""
        participants = [
            {
                "id": 1,
                "name": "John",
                "religion": "Christian",
                "gender": "Male",
                "couple_id": 1,
            },
            {
                "id": 2,
                "name": "Jane",
                "religion": "Christian",
                "gender": "Female",
                "couple_id": 1,
            },
            {
                "id": 3,
                "name": "Bob",
                "religion": "Jewish",
                "gender": "Male",
                "couple_id": 2,
            },
            {
                "id": 4,
                "name": "Alice",
                "religion": "Jewish",
                "gender": "Female",
                "couple_id": 2,
            },
        ]

        builder = GroupBuilder(participants, num_tables=2, num_sessions=1)
        result = builder.generate_assignments()

        assert result["status"] == "success"

        # Check that couples are at different tables
        session = result["assignments"][0]
        tables = session["tables"]

        # Build map of participant names to their couple_id
        couple_map = {
            p["name"]: p["couple_id"] for p in participants if p.get("couple_id")
        }

        for table_id, participants_at_table in tables.items():
            # Get couple_ids for participants at this table
            couple_ids = [
                couple_map.get(p["name"])
                for p in participants_at_table
                if couple_map.get(p["name"]) is not None
            ]
            # No duplicate couple_ids should exist at the same table
            assert len(couple_ids) == len(
                set(couple_ids)
            ), f"Table {table_id} has couples together: {couple_ids}"

    def test_linked_partners_same_table(self):
        """Test that linked partners (keep_together) are seated at the same table"""
        participants = [
            {
                "id": 1,
                "name": "John",
                "religion": "Christian",
                "gender": "Male",
                "linked_id": 1,
            },
            {
                "id": 2,
                "name": "Jane",
                "religion": "Christian",
                "gender": "Female",
                "linked_id": 1,
            },
            {
                "id": 3,
                "name": "Bob",
                "religion": "Jewish",
                "gender": "Male",
                "couple_id": 2,
            },
            {
                "id": 4,
                "name": "Alice",
                "religion": "Jewish",
                "gender": "Female",
                "couple_id": 2,
            },
            {"id": 5, "name": "Mo", "religion": "Muslim", "gender": "Male"},
            {"id": 6, "name": "Sara", "religion": "Muslim", "gender": "Female"},
            {"id": 7, "name": "David", "religion": "Christian", "gender": "Male"},
            {"id": 8, "name": "Fatima", "religion": "Muslim", "gender": "Female"},
        ]
        for p in participants:
            p.setdefault("couple_id", None)
            p.setdefault("linked_id", None)
            p.setdefault("is_facilitator", False)

        builder = GroupBuilder(participants, num_tables=2, num_sessions=2)
        result = builder.generate_assignments()
        assert result["status"] == "success"

        for session in result["assignments"]:
            john_table = None
            jane_table = None
            for table_id, table_participants in session["tables"].items():
                for p in table_participants:
                    if p["name"] == "John":
                        john_table = table_id
                    if p["name"] == "Jane":
                        jane_table = table_id
            assert (
                john_table == jane_table
            ), f"Session {session['session']}: John at table {john_table}, Jane at table {jane_table}"

        for session in result["assignments"]:
            bob_table = None
            alice_table = None
            for table_id, table_participants in session["tables"].items():
                for p in table_participants:
                    if p["name"] == "Bob":
                        bob_table = table_id
                    if p["name"] == "Alice":
                        alice_table = table_id
            assert (
                bob_table != alice_table
            ), f"Session {session['session']}: Bob and Alice both at table {bob_table}"

    def test_balanced_table_sizes(self):
        """Test that all tables have balanced sizes (within 1 person)"""
        participants = [
            {
                "id": i,
                "name": f"Person{i}",
                "religion": "Christian",
                "gender": "Male",
                "couple_id": None,
            }
            for i in range(1, 11)  # 10 participants
        ]

        builder = GroupBuilder(participants, num_tables=3, num_sessions=1)
        result = builder.generate_assignments()

        assert result["status"] == "success"

        session = result["assignments"][0]
        table_sizes = [len(participants) for participants in session["tables"].values()]

        # All tables should be within 1 person of each other
        assert max(table_sizes) - min(table_sizes) <= 1

    def test_multiple_sessions(self):
        """Test that multiple sessions can be generated"""
        participants = [
            {
                "id": 1,
                "name": "Alice",
                "religion": "Christian",
                "gender": "Female",
                "couple_id": None,
            },
            {
                "id": 2,
                "name": "Bob",
                "religion": "Jewish",
                "gender": "Male",
                "couple_id": None,
            },
            {
                "id": 3,
                "name": "Charlie",
                "religion": "Muslim",
                "gender": "Male",
                "couple_id": None,
            },
            {
                "id": 4,
                "name": "Diana",
                "religion": "Christian",
                "gender": "Female",
                "couple_id": None,
            },
            {
                "id": 5,
                "name": "Eve",
                "religion": "Jewish",
                "gender": "Female",
                "couple_id": None,
            },
            {
                "id": 6,
                "name": "Frank",
                "religion": "Muslim",
                "gender": "Male",
                "couple_id": None,
            },
        ]

        builder = GroupBuilder(participants, num_tables=2, num_sessions=3)
        result = builder.generate_assignments()

        assert result["status"] == "success"
        assert len(result["assignments"]) == 3

        # Each session should have the correct number of tables
        for session in result["assignments"]:
            assert len(session["tables"]) == 2

    def test_handles_small_groups(self):
        """Test that small groups with more tables than ideal still work"""
        # 2 participants with 3 tables - solver should handle this (some tables may be empty or very unbalanced)
        participants = [
            {
                "id": 1,
                "name": "Alice",
                "religion": "Christian",
                "gender": "Female",
                "couple_id": None,
            },
            {
                "id": 2,
                "name": "Bob",
                "religion": "Jewish",
                "gender": "Male",
                "couple_id": None,
            },
        ]

        builder = GroupBuilder(participants, num_tables=3, num_sessions=1)
        result = builder.generate_assignments()

        # The solver may find a solution (e.g., tables with 1, 1, and 0 people)
        # or it may fail due to balance constraints
        # Either way, we should get a valid response
        assert result["status"] in ["success", "failure"]
        if result["status"] == "failure":
            assert "error" in result

    def test_diversity_distribution(self):
        """Test that religions are distributed evenly across tables"""
        participants = [
            {
                "id": 1,
                "name": "Christian1",
                "religion": "Christian",
                "gender": "Male",
                "couple_id": None,
            },
            {
                "id": 2,
                "name": "Christian2",
                "religion": "Christian",
                "gender": "Female",
                "couple_id": None,
            },
            {
                "id": 3,
                "name": "Jewish1",
                "religion": "Jewish",
                "gender": "Male",
                "couple_id": None,
            },
            {
                "id": 4,
                "name": "Jewish2",
                "religion": "Jewish",
                "gender": "Female",
                "couple_id": None,
            },
            {
                "id": 5,
                "name": "Muslim1",
                "religion": "Muslim",
                "gender": "Male",
                "couple_id": None,
            },
            {
                "id": 6,
                "name": "Muslim2",
                "religion": "Muslim",
                "gender": "Female",
                "couple_id": None,
            },
        ]

        builder = GroupBuilder(participants, num_tables=2, num_sessions=1)
        result = builder.generate_assignments()

        assert result["status"] == "success"

        session = result["assignments"][0]
        for table_id, participants_at_table in session["tables"].items():
            religions = [p["religion"] for p in participants_at_table]
            # Each table should have diverse religions
            # With 3 participants per table and 3 religions, ideally 1 of each
            religion_counts = {}
            for r in religions:
                religion_counts[r] = religion_counts.get(r, 0) + 1

            # Check that no religion dominates (has more than 2 people at a 3-person table)
            for count in religion_counts.values():
                assert count <= 2

    def test_solution_quality_metadata(self):
        """Test that the result includes solution quality metadata"""
        participants = [
            {
                "id": i,
                "name": f"Person{i}",
                "religion": "Christian",
                "gender": "Male",
                "couple_id": None,
            }
            for i in range(1, 7)
        ]

        builder = GroupBuilder(participants, num_tables=2, num_sessions=2)
        result = builder.generate_assignments()

        assert result["status"] == "success"
        assert "solution_quality" in result
        assert result["solution_quality"] in ["optimal", "feasible"]
        assert "solve_time" in result
        assert result["solve_time"] >= 0

    def test_require_different_assignments_hard_constraint(self):
        """Test that require_different_assignments=True enforces different table assignments when feasible"""
        # Use fewer participants with more tables for more flexibility
        participants = [
            {
                "id": 1,
                "name": "Alice",
                "religion": "Christian",
                "gender": "Female",
                "couple_id": None,
            },
            {
                "id": 2,
                "name": "Bob",
                "religion": "Jewish",
                "gender": "Male",
                "couple_id": None,
            },
            {
                "id": 3,
                "name": "Charlie",
                "religion": "Muslim",
                "gender": "Male",
                "couple_id": None,
            },
            {
                "id": 4,
                "name": "Diana",
                "religion": "Christian",
                "gender": "Female",
                "couple_id": None,
            },
            {
                "id": 5,
                "name": "Eve",
                "religion": "Jewish",
                "gender": "Female",
                "couple_id": None,
            },
            {
                "id": 6,
                "name": "Frank",
                "religion": "Muslim",
                "gender": "Male",
                "couple_id": None,
            },
        ]

        # Forbid Bob (id=2, not the first participant) from table 1
        # Symmetry breaking fixes Alice (id=1) to table 0, so we can't forbid her
        current_table_assignments = {
            2: 1,  # Bob at table 1 - will be forbidden from table 1
        }

        builder = GroupBuilder(
            participants,
            num_tables=3,  # More tables = more flexibility
            num_sessions=1,
            current_table_assignments=current_table_assignments,
            require_different_assignments=True,
        )
        result = builder.generate_assignments(max_time_seconds=10)

        assert (
            result["status"] == "success"
        ), f"Expected success but got {result.get('status')}: {result.get('error')}"

        # Verify Bob is NOT at table 1
        session = result["assignments"][0]
        tables = session["tables"]

        bob_table = None
        for table_id, participants_at_table in tables.items():
            for p in participants_at_table:
                if p["name"] == "Bob":  # Find Bob by name
                    bob_table = int(table_id) - 1  # Convert to 0-indexed

        assert bob_table is not None, "Bob should be assigned to a table"
        assert (
            bob_table != 1
        ), f"Hard constraint should prevent Bob from being at table 1, but he's at table {bob_table}"

    def test_require_different_assignments_impossible_case(self):
        """Test graceful failure when different assignments are impossible"""
        # Create a scenario where it's impossible to change assignments:
        # Only 2 participants and 2 tables - only 2 valid arrangements exist (A,B) or (B,A)
        # If we lock them to (A,B) with couples constraint, (B,A) may be infeasible
        participants = [
            {
                "id": 1,
                "name": "John",
                "religion": "Christian",
                "gender": "Male",
                "couple_id": 1,
            },
            {
                "id": 2,
                "name": "Jane",
                "religion": "Christian",
                "gender": "Female",
                "couple_id": 1,
            },
        ]

        # Current assignment: John at table 0, Jane at table 1 (couples separated)
        current_table_assignments = {
            1: 0,  # John at table 0
            2: 1,  # Jane at table 1
        }

        builder = GroupBuilder(
            participants,
            num_tables=2,
            num_sessions=1,
            current_table_assignments=current_table_assignments,
            require_different_assignments=True,
        )
        result = builder.generate_assignments(max_time_seconds=5)

        # With hard constraint and couple separation, this should fail
        # (swapping would put the couple together, which violates couple constraint)
        assert result["status"] == "failure"

    def test_require_different_assignments_forbids_table_rotation(self):
        """A hard-constraint shuffle must not be satisfiable by just moving
        a table's whole membership to a different index - that trick passes
        the old per-participant "not my previous table index" check while
        leaving every pairing exactly as it was.

        Cross-group pairings are pinned at their pairwise cap (already met
        elsewhere), so the *only* way to satisfy "not my previous index"
        without introducing a forbidden new pairing is to move each
        previous table's three people, as a block, to one of the other two
        tables - i.e. the rotation trick. Before this fix that trick made
        the old hard constraint trivially satisfiable; this asserts the
        solver now correctly reports it as infeasible instead of silently
        handing back the same groupings under new table numbers.
        """
        participants = [
            {
                "id": i,
                "name": f"P{i}",
                "religion": "Christian",
                "gender": "Male",
                "couple_id": None,
            }
            for i in range(1, 10)
        ]
        groups = [[4, 5, 6], [7, 8, 9], [1, 2, 3]]  # tables 0, 1, 2

        # Symmetry breaking pins participant id 1 to table 0, so id 1's
        # previous table must not be 0 or that alone conflicts.
        current_table_assignments = {
            p_id: table for table, members in enumerate(groups) for p_id in members
        }

        # Forbid any pairing across different previous groups: mark them as
        # already met at the pairwise cap. Same-group pairs are left at 0
        # historical meetings, so re-seating a group together is still
        # legal on its own - only mixing groups is closed off.
        historical_meeting_counts = {}
        for g1, g2 in combinations(groups, 2):
            for p1 in g1:
                for p2 in g2:
                    historical_meeting_counts[tuple(sorted((p1, p2)))] = 1

        builder = GroupBuilder(
            participants,
            num_tables=3,
            num_sessions=1,
            current_table_assignments=current_table_assignments,
            require_different_assignments=True,
            historical_meeting_counts=historical_meeting_counts,
            pairwise_cap=1,
        )
        result = builder.generate_assignments(max_time_seconds=10)

        assert result["status"] == "failure", (
            "Rotation was the only assignment satisfying both the old "
            "hard constraint and the pairwise cap - the solver should "
            "report that as infeasible, not silently return it."
        )

    def test_soft_constraint_allows_same_assignments(self):
        """Test that without require_different_assignments, same assignments are allowed if optimal"""
        participants = [
            {
                "id": 1,
                "name": "John",
                "religion": "Christian",
                "gender": "Male",
                "couple_id": 1,
            },
            {
                "id": 2,
                "name": "Jane",
                "religion": "Christian",
                "gender": "Female",
                "couple_id": 1,
            },
        ]

        # Current assignment: already optimal (couples separated)
        current_table_assignments = {
            1: 0,
            2: 1,
        }

        builder = GroupBuilder(
            participants,
            num_tables=2,
            num_sessions=1,
            current_table_assignments=current_table_assignments,
            require_different_assignments=False,  # Soft constraint
        )
        result = builder.generate_assignments(max_time_seconds=5)

        # Soft constraint should succeed even if same assignments are returned
        assert result["status"] == "success"


def test_facilitator_coverage():
    """Every table must have at least one facilitator."""
    participants = [
        {
            "id": 1,
            "name": "Fac1",
            "religion": "Christian",
            "gender": "Male",
            "partner": None,
            "couple_id": None,
            "is_facilitator": True,
        },
        {
            "id": 2,
            "name": "Fac2",
            "religion": "Jewish",
            "gender": "Female",
            "partner": None,
            "couple_id": None,
            "is_facilitator": True,
        },
        {
            "id": 3,
            "name": "P1",
            "religion": "Muslim",
            "gender": "Male",
            "partner": None,
            "couple_id": None,
            "is_facilitator": False,
        },
        {
            "id": 4,
            "name": "P2",
            "religion": "Christian",
            "gender": "Female",
            "partner": None,
            "couple_id": None,
            "is_facilitator": False,
        },
        {
            "id": 5,
            "name": "P3",
            "religion": "Jewish",
            "gender": "Male",
            "partner": None,
            "couple_id": None,
            "is_facilitator": False,
        },
        {
            "id": 6,
            "name": "P4",
            "religion": "Muslim",
            "gender": "Female",
            "partner": None,
            "couple_id": None,
            "is_facilitator": False,
        },
    ]
    gb = GroupBuilder(participants, num_tables=2, num_sessions=1)
    result = gb.generate_assignments()
    assert result["status"] == "success"
    for session in result["assignments"]:
        for table_num, table_participants in session["tables"].items():
            facilitators = [p for p in table_participants if p.get("is_facilitator")]
            assert len(facilitators) >= 1, f"Table {table_num} has no facilitator"


def test_facilitator_religion_diversity_per_table():
    """No two facilitators at the same table share a religion."""
    # 4 facilitators (2 Christian, 2 Jewish), 2 tables — each table gets 2 facilitators
    # who must be different religions.
    participants = [
        {
            "id": 1,
            "name": "Fac_C1",
            "religion": "Christian",
            "gender": "Male",
            "partner": None,
            "couple_id": None,
            "is_facilitator": True,
        },
        {
            "id": 2,
            "name": "Fac_C2",
            "religion": "Christian",
            "gender": "Female",
            "partner": None,
            "couple_id": None,
            "is_facilitator": True,
        },
        {
            "id": 3,
            "name": "Fac_J1",
            "religion": "Jewish",
            "gender": "Male",
            "partner": None,
            "couple_id": None,
            "is_facilitator": True,
        },
        {
            "id": 4,
            "name": "Fac_J2",
            "religion": "Jewish",
            "gender": "Female",
            "partner": None,
            "couple_id": None,
            "is_facilitator": True,
        },
        {
            "id": 5,
            "name": "P1",
            "religion": "Muslim",
            "gender": "Male",
            "partner": None,
            "couple_id": None,
            "is_facilitator": False,
        },
        {
            "id": 6,
            "name": "P2",
            "religion": "Christian",
            "gender": "Female",
            "partner": None,
            "couple_id": None,
            "is_facilitator": False,
        },
        {
            "id": 7,
            "name": "P3",
            "religion": "Jewish",
            "gender": "Male",
            "partner": None,
            "couple_id": None,
            "is_facilitator": False,
        },
        {
            "id": 8,
            "name": "P4",
            "religion": "Muslim",
            "gender": "Female",
            "partner": None,
            "couple_id": None,
            "is_facilitator": False,
        },
    ]
    gb = GroupBuilder(participants, num_tables=2, num_sessions=1)
    result = gb.generate_assignments()
    assert result["status"] == "success"
    for session in result["assignments"]:
        for table_num, table_participants in session["tables"].items():
            facilitators = [p for p in table_participants if p.get("is_facilitator")]
            religions = [f["religion"] for f in facilitators]
            assert len(religions) == len(
                set(religions)
            ), f"Table {table_num}: facilitators share religion: {religions}"


def test_facilitator_output_includes_flag():
    """Solver output includes is_facilitator in participant dicts."""
    participants = [
        {
            "id": 1,
            "name": "Fac1",
            "religion": "Christian",
            "gender": "Male",
            "partner": None,
            "couple_id": None,
            "is_facilitator": True,
        },
        {
            "id": 2,
            "name": "P1",
            "religion": "Jewish",
            "gender": "Female",
            "partner": None,
            "couple_id": None,
            "is_facilitator": False,
        },
        {
            "id": 3,
            "name": "P2",
            "religion": "Muslim",
            "gender": "Male",
            "partner": None,
            "couple_id": None,
            "is_facilitator": False,
        },
        {
            "id": 4,
            "name": "P3",
            "religion": "Christian",
            "gender": "Female",
            "partner": None,
            "couple_id": None,
            "is_facilitator": False,
        },
    ]
    gb = GroupBuilder(participants, num_tables=1, num_sessions=1)
    result = gb.generate_assignments()
    assert result["status"] == "success"
    all_participants = result["assignments"][0]["tables"][1]
    fac = next(p for p in all_participants if p["name"] == "Fac1")
    assert fac["is_facilitator"] is True
    non_fac = next(p for p in all_participants if p["name"] == "P1")
    assert non_fac["is_facilitator"] is False


def _count_meetings(result):
    """Map each pair of names to how many sessions they shared a table in."""
    from collections import Counter
    import itertools

    meetings = Counter()
    for session in result["assignments"]:
        for people in session["tables"].values():
            names = sorted(p["name"] for p in people)
            for pair in itertools.combinations(names, 2):
                meetings[pair] += 1
    return meetings


def _twenty_four_participants_with_relations():
    """24 people at the standard BBT program shape (4 tables, 5 sessions),
    with 6 facilitators, 2 couples, 1 linked pair, and 2 keep-apart pairs -
    the shape the 2026-09-11 spike validated the dual-cap design against
    (pairwise floor 2, overlap floor 2-3, both reachable in 5-20s)."""
    religions = ["Jewish", "Christian", "Muslim", "Interfaith"]
    people = []
    for i in range(24):
        people.append(
            {
                "id": f"p{i}",
                "name": f"P{i}",
                "religion": religions[i % len(religions)],
                "gender": "F" if i % 2 == 0 else "M",
                "couple_id": None,
                "linked_id": None,
                "keep_apart": [],
                "is_facilitator": i < 6,
            }
        )
    # 2 couples: kept apart every session.
    people[6]["couple_id"] = "c1"
    people[7]["couple_id"] = "c1"
    people[8]["couple_id"] = "c2"
    people[9]["couple_id"] = "c2"
    # 1 linked pair: kept together every session.
    people[10]["linked_id"] = "l1"
    people[11]["linked_id"] = "l1"
    # 2 keep-apart pairs: by name, symmetric.
    people[12]["keep_apart"] = ["P13"]
    people[13]["keep_apart"] = ["P12"]
    people[14]["keep_apart"] = ["P15"]
    people[15]["keep_apart"] = ["P14"]
    return people


def _nine_participants():
    """Nine people who are alike in every way the solver constrains on.

    Religion and gender spread are *hard* constraints, so a mixed roster pins
    down most of the legal partitions and leaves the repeat penalty nothing to
    say. Making everyone identical isolates the behaviour under test.
    """
    return [
        {
            "id": f"p{i}",
            "name": f"P{i}",
            "religion": "Jewish",
            "gender": "F",
            "couple_id": None,
            "linked_id": None,
        }
        for i in range(9)
    ]


def test_pairwise_repeats_never_exceed_an_explicit_cap():
    """The cap is now a hard constraint the caller must supply (it's a
    search parameter owned by capacity_search, not something GroupBuilder
    derives for itself - see the dual-cap-solver plan's revision after the
    pigeonhole floor proved infeasible for constrained rosters). When the
    caller does supply one, GroupBuilder must hold the line exactly."""
    from assignment_logic.capacity import compute_pairwise_cap

    people = _nine_participants()
    expected_cap = compute_pairwise_cap(people, num_tables=3, num_sessions=4)
    assert expected_cap == 1  # AG(2,3): every pair meets exactly once

    builder = GroupBuilder(
        people, num_tables=3, num_sessions=4, pairwise_cap=expected_cap
    )
    result = builder.generate_assignments(max_time_seconds=30)

    assert result["status"] == "success"
    meetings = _count_meetings(result)
    assert max(meetings.values()) == expected_cap


def test_historical_meeting_counts_forbid_a_pair_that_already_hit_the_cap():
    """A single-session regeneration must not let a pair meet again if
    they've already used up their whole-program budget elsewhere."""
    people = _nine_participants()
    # Whole program's cap for this shape is 1 (see above). P0 & P1
    # already met once in another session -> forbidden here.
    builder = GroupBuilder(
        people,
        num_tables=3,
        num_sessions=1,
        pairwise_cap=1,
        historical_meeting_counts={("p0", "p1"): 1},
    )
    result = builder.generate_assignments(max_time_seconds=15)
    assert result["status"] == "success"
    tables = result["assignments"][0]["tables"]
    for seats in tables.values():
        names = {s["name"] for s in seats}
        assert not ({"P0", "P1"} <= names)


def test_single_session_solve_prefers_not_repeating_a_historical_pair():
    """A single-session solve (num_sessions=1) has no rolling-window signal
    at all - range(s1+1, min(s1+window+1, 1)) is always empty when there's
    only one session - so without this objective term, nothing prefers
    avoiding a pair who already met elsewhere. Four participants, two
    two-seat tables: P0+P1 have already met once; P2+P3 have not. Seating
    P0 with P1 recreates a repeat; seating P0 with P2 (or P3) does not.
    Both arrangements are equally legal (no cap is set, so neither is
    forbidden) - only the objective can prefer one over the other.
    """
    participants = [
        {
            "id": f"p{i}",
            "name": f"P{i}",
            "religion": "Christian",
            "gender": "Male",
            "couple_id": None,
        }
        for i in range(4)
    ]

    builder = GroupBuilder(
        participants,
        num_tables=2,
        num_sessions=1,
        historical_meeting_counts={("p0", "p1"): 1},
    )
    result = builder.generate_assignments(max_time_seconds=15)

    assert result["status"] == "success"
    assert result["solution_quality"] == "optimal"
    tables = result["assignments"][0]["tables"]
    seated_together = {frozenset(s["name"] for s in seats) for seats in tables.values()}
    assert frozenset({"P0", "P1"}) not in seated_together, (
        "P0 and P1 already met once elsewhere and a repeat-free seating "
        "exists - the solver had no reason to prefer it before this fix, "
        "since a single-session solve's rolling window is always empty."
    )


def test_table_overlap_never_exceeds_the_configured_cap():
    from itertools import combinations

    people = _twenty_four_participants_with_relations()
    builder = GroupBuilder(people, num_tables=4, num_sessions=5, table_overlap_cap=3)
    result = builder.generate_assignments(max_time_seconds=20)
    assert result["status"] == "success"

    tables = []
    for session in result["assignments"]:
        for people_at_table in session["tables"].values():
            tables.append(frozenset(p["name"] for p in people_at_table))
    for a, b in combinations(tables, 2):
        assert len(a & b) <= 3


def test_single_session_solve_prefers_less_overlap_with_a_historical_table():
    """The whole-table-overlap cap (`table_overlap_cap`) is enforced as a pure
    hard constraint (`sum(both_slots) <= cap` / `overlap_count <= cap`) with
    no objective term pushing the solver toward *less* overlap than the cap
    allows - the same class of bug fixed for pairwise repeats above, but on
    the overlap axis. Four participants, two two-seat tables, one session to
    solve: P0 and P1 already sat together at a historical table elsewhere in
    the program. Reseating them together again reproduces that table's full
    membership (overlap = 2); splitting them does not (overlap <= 1). A cap
    of 2 makes both arrangements legal - only the objective can prefer the
    lower-overlap one.
    """
    participants = [
        {
            "id": f"p{i}",
            "name": f"P{i}",
            "religion": "Christian",
            "gender": "Male",
            "couple_id": None,
        }
        for i in range(4)
    ]

    builder = GroupBuilder(
        participants,
        num_tables=2,
        num_sessions=1,
        table_overlap_cap=2,
        historical_tables=[{"p0", "p1"}],
    )
    result = builder.generate_assignments(max_time_seconds=15)

    assert result["status"] == "success"
    assert result["solution_quality"] == "optimal"
    tables = result["assignments"][0]["tables"]
    seated_together = {frozenset(s["name"] for s in seats) for seats in tables.values()}
    assert frozenset({"P0", "P1"}) not in seated_together, (
        "P0 and P1 already shared a historical table and a lower-overlap "
        "seating exists - the solver had no reason to prefer it before "
        "this fix, since the overlap cap is a hard ceiling, not a target."
    )


def test_overlap_cap_too_tight_is_reported_infeasible_not_silently_ignored():
    people = _twenty_four_participants_with_relations()
    builder = GroupBuilder(
        people, num_tables=4, num_sessions=5, table_overlap_cap=1
    )  # 1 is below the proven floor for this shape
    result = builder.generate_assignments(max_time_seconds=20)
    assert result["status"] == "failure"
    assert "No solution exists" in result["error"]


def test_absent_participant_is_not_seated_in_their_absent_session():
    """An absent participant gets no seat at all in their absent session, but
    is seated normally in every other session."""
    participants = [
        {
            "id": f"p{i}",
            "name": f"P{i}",
            "religion": "Christian",
            "gender": "Male",
            "couple_id": None,
        }
        for i in range(6)
    ]
    builder = GroupBuilder(
        participants,
        num_tables=2,
        num_sessions=2,
        absent_ids_by_session={1: {"p5"}},  # P5 absent in session 2 (0-indexed: 1)
    )
    result = builder.generate_assignments(max_time_seconds=15)

    assert result["status"] == "success"
    session_one, session_two = result["assignments"]
    seated_s1 = {p["name"] for seats in session_one["tables"].values() for p in seats}
    seated_s2 = {p["name"] for seats in session_two["tables"].values() for p in seats}
    assert seated_s1 == {f"P{i}" for i in range(6)}
    assert seated_s2 == {f"P{i}" for i in range(5)}  # P5 missing


def test_linked_partner_absence_does_not_force_the_present_partner_anywhere():
    """If one linked partner is absent, the equality constraint pinning them
    to the same table must not apply that session - there is no variable
    for the absent partner to be equal to."""
    participants = [
        {
            "id": "p0",
            "name": "P0",
            "religion": "Christian",
            "gender": "Male",
            "couple_id": None,
            "linked_id": "l1",
        },
        {
            "id": "p1",
            "name": "P1",
            "religion": "Jewish",
            "gender": "Female",
            "couple_id": None,
            "linked_id": "l1",
        },
        {
            "id": "p2",
            "name": "P2",
            "religion": "Muslim",
            "gender": "Male",
            "couple_id": None,
        },
        {
            "id": "p3",
            "name": "P3",
            "religion": "Christian",
            "gender": "Female",
            "couple_id": None,
        },
    ]
    builder = GroupBuilder(
        participants,
        num_tables=2,
        num_sessions=1,
        absent_ids_by_session={0: {"p1"}},  # P1 (linked to P0) absent
    )
    result = builder.generate_assignments(max_time_seconds=10)
    assert result["status"] == "success"
    seated = {
        p["name"]
        for seats in result["assignments"][0]["tables"].values()
        for p in seats
    }
    assert seated == {"P0", "P2", "P3"}


def test_pairwise_cap_is_enforced_correctly_across_an_absent_session():
    """A pair's hard cap must still be respected globally even when one of
    their potential meeting sessions has one of them absent - an absent
    session must count as "did not meet," not raise or silently allow an
    extra meeting.

    NOTE: the plan's original fixture (6 people, 2 tables, 3 sessions,
    pairwise_cap=1) is pigeonhole-infeasible even with nobody absent: 2
    balanced tables of 3 force 6 pair-meetings per session, so 3 sessions
    demand 18 pair-meetings (16 once one session loses a person to
    absence) against only C(6,2)=15 distinct pairs, i.e. cap=1 can never
    be satisfied. Using 9 people / 3 tables / 4 sessions instead (the
    AG(2,3) shape documented in CLAUDE.md, where a pairwise_cap=1 solve
    with everyone present is exactly achievable - every pair meets once)
    keeps enough slack once one person is absent for one session.
    """
    participants = [
        {
            "id": f"p{i}",
            "name": f"P{i}",
            "religion": "Christian",
            "gender": "Male",
            "couple_id": None,
        }
        for i in range(9)
    ]
    builder = GroupBuilder(
        participants,
        num_tables=3,
        num_sessions=4,
        pairwise_cap=1,
        absent_ids_by_session={1: {"p0"}},  # P0 absent session 2 (0-indexed 1)
    )
    result = builder.generate_assignments(max_time_seconds=20)
    assert result["status"] == "success"

    from collections import Counter
    import itertools

    meetings = Counter()
    for session in result["assignments"]:
        for people in session["tables"].values():
            names = sorted(p["name"] for p in people)
            for pair in itertools.combinations(names, 2):
                meetings[pair] += 1
    assert max(meetings.values()) <= 1
    # P0 was absent one of the four sessions but still shows up in the other three
    p0_sessions = sum(
        1
        for session in result["assignments"]
        for people in session["tables"].values()
        if any(p["name"] == "P0" for p in people)
    )
    assert p0_sessions == 3


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
