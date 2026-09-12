"""The pure solve helper: assignments in, assignments out, no storage."""

import pytest

from api.services.program_solve import SolveFailed, solve_program


def _identical_people(n):
    """A roster with no diversity at all.

    Religion and gender spread are *hard* constraints, so a mixed roster pins
    down nearly every legal partition and leaves the solver no freedom. Making
    everyone identical isolates the behaviour under test. See CLAUDE.md.
    """
    return [
        {
            "id": i + 1,
            "name": f"P{i + 1}",
            "religion": "Other",
            "gender": "Other",
            "partner": None,
            "couple_id": None,
            "linked_id": None,
            "is_facilitator": False,
            "keep_together": False,
        }
        for i in range(n)
    ]


class TestSolveProgram:
    def test_returns_one_entry_per_session_and_seats_everyone(self):
        assignments, metadata = solve_program(
            participants=_identical_people(6),
            num_tables=2,
            num_sessions=2,
            absence_map={},
            max_time_seconds=10,
        )

        assert [a["session"] for a in assignments] == [1, 2]
        for session in assignments:
            seated = [p["name"] for t in session["tables"].values() for p in t]
            assert sorted(seated) == sorted(f"P{i + 1}" for i in range(6))
        assert metadata["label"] == "Sessions generated"

    def test_an_absent_person_is_not_seated_and_the_record_survives(self):
        absent = [
            {"name": "P6", "religion": "Other", "gender": "Other", "partner": None}
        ]

        assignments, metadata = solve_program(
            participants=_identical_people(6),
            num_tables=2,
            num_sessions=2,
            absence_map={2: absent},
            max_time_seconds=10,
        )

        session_two = assignments[1]
        seated = [p["name"] for t in session_two["tables"].values() for p in t]
        assert "P6" not in seated
        assert session_two["absentParticipants"] == absent
        # Session 1 is untouched by session 2's absence.
        assert "absentParticipants" not in assignments[0]
        # The session-2 re-solve bypasses find_feasible_plan entirely, so the
        # whole-solve caps no longer describe what got saved.
        assert metadata["pairwise_cap"] is None
        assert metadata["table_overlap_cap"] is None
        assert metadata["pairwise_floor"] is None
        assert metadata["table_overlap_floor"] is None

    def test_caps_are_reported_when_no_absence_resolve_ran(self):
        assignments, metadata = solve_program(
            participants=_identical_people(9),
            num_tables=3,
            num_sessions=4,
            absence_map={},
            max_time_seconds=10,
        )
        assert len(assignments) == 4
        assert isinstance(metadata["pairwise_cap"], int)
        assert isinstance(metadata["table_overlap_cap"], int)
        assert isinstance(metadata["pairwise_floor"], int)
        assert isinstance(metadata["table_overlap_floor"], int)

    def test_an_infeasible_program_raises_rather_than_returning_junk(self):
        """A couple with only one table to sit at.

        Couples separation is a *hard* constraint, so two people who must not
        share a table and have exactly one table between them is unsatisfiable.
        Chosen over the more obvious "more tables than people", which is not
        infeasible at all - the solver seats everyone and drops the empty
        tables - and over ``num_tables=0``, which the API rejects at validation
        (``Field(ge=1)``) and so can never reach the solver in production.
        """
        couple = [
            {
                "id": 1,
                "name": "Alice",
                "religion": "Other",
                "gender": "Other",
                "partner": "Bob",
                "couple_id": 1,
                "linked_id": None,
                "is_facilitator": False,
                "keep_together": False,
            },
            {
                "id": 2,
                "name": "Bob",
                "religion": "Other",
                "gender": "Other",
                "partner": "Alice",
                "couple_id": 1,
                "linked_id": None,
                "is_facilitator": False,
                "keep_together": False,
            },
        ]

        with pytest.raises(SolveFailed) as exc:
            solve_program(
                participants=couple,
                num_tables=1,
                num_sessions=1,
                absence_map={},
                max_time_seconds=10,
            )
        assert "No solution exists" in str(exc.value)


from api.services.program_solve import (
    solve_around_completed_sessions,
    LABEL_REBUILT_AROUND_COMPLETED,
)


def _people(n):
    return [
        {
            "id": i + 1,
            "name": f"P{i}",
            "religion": "X",
            "gender": "M",
            "partner": None,
            "couple_id": None,
            "linked_id": None,
            "is_facilitator": False,
            "keep_together": False,
        }
        for i in range(n)
    ]


def _frozen_session_one(names_by_table):
    return {
        "session": 1,
        "tables": {
            str(t): [{"name": n} for n in names] for t, names in names_by_table.items()
        },
        "absentParticipants": [],
    }


class TestSolveAroundCompleted:
    def test_frozen_session_is_copied_verbatim(self):
        people = _people(9)
        frozen = [
            _frozen_session_one(
                {0: ["P0", "P1", "P2"], 1: ["P3", "P4", "P5"], 2: ["P6", "P7", "P8"]}
            )
        ]
        assignments, meta = solve_around_completed_sessions(
            participants=people,
            num_tables=3,
            num_sessions=4,
            completed_through=1,
            frozen_sessions=frozen,
            absence_map={},
            max_time_seconds=5,
        )
        assert assignments[0] == frozen[0]
        assert [a["session"] for a in assignments] == [1, 2, 3, 4]
        assert meta["label"] == LABEL_REBUILT_AROUND_COMPLETED
        assert meta["solution_quality"] is None

    def test_a_frozen_session_absence_survives_verbatim(self):
        people = _people(9)
        frozen_session = _frozen_session_one(
            {0: ["P1", "P2"], 1: ["P3", "P4", "P5"], 2: ["P6", "P7", "P8"]}
        )
        frozen_session["absentParticipants"] = [{"name": "P0"}]
        assignments, _ = solve_around_completed_sessions(
            participants=people,
            num_tables=3,
            num_sessions=4,
            completed_through=1,
            frozen_sessions=[frozen_session],
            absence_map={},
            max_time_seconds=5,
        )
        assert assignments[0] == frozen_session
        assert assignments[0]["absentParticipants"] == [{"name": "P0"}]

    def test_frozen_pair_is_split_in_the_resolved_sessions(self):
        people = _people(9)
        frozen = [
            _frozen_session_one(
                {0: ["P0", "P1", "P2"], 1: ["P3", "P4", "P5"], 2: ["P6", "P7", "P8"]}
            )
        ]
        assignments, _ = solve_around_completed_sessions(
            participants=people,
            num_tables=3,
            num_sessions=4,
            completed_through=1,
            frozen_sessions=frozen,
            absence_map={},
            max_time_seconds=5,
        )
        for session in assignments[1:]:
            for _, seats in session["tables"].items():
                names = {s["name"] for s in seats}
                assert not ({"P0", "P1"} <= names)
                assert not ({"P0", "P2"} <= names)

    def test_a_pair_who_already_spent_their_whole_program_budget_never_meets_again(
        self,
    ):
        """9 people / 3 tables / 5 sessions puts the whole-program pairwise
        cap at 2 (compute_pairwise_cap). Freezing 2 sessions with P0 and P1
        seated together in both spends their entire budget before the
        remainder is even solved - the fix this test pins is that the real
        count (2), not just membership, reaches the hard cap's budget
        subtraction. See extract_pairings_from_sessions and the
        dual-cap-solver plan's Task 8 notes."""
        people = _people(9)
        frozen = [
            _frozen_session_one(
                {0: ["P0", "P1", "P2"], 1: ["P3", "P4", "P5"], 2: ["P6", "P7", "P8"]}
            ),
            {
                "session": 2,
                "tables": {
                    "0": [{"name": "P0"}, {"name": "P1"}, {"name": "P3"}],
                    "1": [{"name": "P2"}, {"name": "P4"}, {"name": "P5"}],
                    "2": [{"name": "P6"}, {"name": "P7"}, {"name": "P8"}],
                },
                "absentParticipants": [],
            },
        ]
        assignments, _ = solve_around_completed_sessions(
            participants=people,
            num_tables=3,
            num_sessions=5,
            completed_through=2,
            frozen_sessions=frozen,
            absence_map={},
            max_time_seconds=10,
        )
        assert len(assignments) == 5
        for session in assignments[2:]:
            for _, seats in session["tables"].items():
                names = {s["name"] for s in seats}
                assert not ({"P0", "P1"} <= names)

    def test_a_frozen_pairing_naming_a_departed_person_is_dropped(self):
        people = _people(8)  # P0..P7
        frozen = [
            _frozen_session_one(
                {0: ["P0", "P1", "P8"], 1: ["P2", "P3", "P4"], 2: ["P5", "P6", "P7"]}
            )
        ]
        assignments, _ = solve_around_completed_sessions(
            participants=people,
            num_tables=2,
            num_sessions=3,
            completed_through=1,
            frozen_sessions=frozen,
            absence_map={},
            max_time_seconds=5,
        )
        assert len(assignments) == 3
        assert assignments[0] == frozen[0]

    def test_absence_on_an_incomplete_session_is_carried_into_the_rebuild(self):
        people = _people(9)
        frozen = [
            _frozen_session_one(
                {0: ["P0", "P1", "P2"], 1: ["P3", "P4", "P5"], 2: ["P6", "P7", "P8"]}
            )
        ]
        absence_map = {3: [{"name": "P0"}]}
        assignments, _ = solve_around_completed_sessions(
            participants=people,
            num_tables=3,
            num_sessions=4,
            completed_through=1,
            frozen_sessions=frozen,
            absence_map=absence_map,
            max_time_seconds=5,
        )
        s3 = next(s for s in assignments if s["session"] == 3)
        s3_seated = {
            seat["name"] for _, seats in s3["tables"].items() for seat in seats
        }
        assert "P0" not in s3_seated
        assert s3.get("absentParticipants") == [{"name": "P0"}]

    def test_infeasible_remainder_raises_solvefailed(self):
        # A couple with only one table to sit at: couples separation is a hard
        # constraint, so the remainder solve is unsatisfiable. (The plan's
        # original "3 people / 5 tables" case is NOT infeasible - the solver
        # seats everyone and drops the empty tables, per TestSolveProgram.)
        couple = [
            {
                "id": 1,
                "name": "Alice",
                "religion": "X",
                "gender": "M",
                "partner": "Bob",
                "couple_id": 1,
                "linked_id": None,
                "is_facilitator": False,
                "keep_together": False,
            },
            {
                "id": 2,
                "name": "Bob",
                "religion": "X",
                "gender": "M",
                "partner": "Alice",
                "couple_id": 1,
                "linked_id": None,
                "is_facilitator": False,
                "keep_together": False,
            },
        ]
        frozen = [
            {
                "session": 1,
                "tables": {"0": [{"name": "Alice"}, {"name": "Bob"}]},
                "absentParticipants": [],
            }
        ]
        with pytest.raises(SolveFailed):
            solve_around_completed_sessions(
                participants=couple,
                num_tables=1,
                num_sessions=3,
                completed_through=1,
                frozen_sessions=frozen,
                absence_map={},
                max_time_seconds=5,
            )


class TestExtractPairingsFromSessions:
    def test_empty_seats_at_a_table_are_skipped(self):
        """A frozen/completed session can carry ``None`` seats; they are not people."""
        from api.services.program_solve import extract_pairings_from_sessions

        sessions = [
            {
                "session": 1,
                "tables": {"1": [{"name": "Alice"}, None, {"name": "Bob"}]},
            }
        ]

        assert extract_pairings_from_sessions(sessions, exclude_session=-1) == {
            ("Alice", "Bob"): 1
        }

    def test_a_pair_meeting_twice_is_counted_not_just_membership(self):
        """The count matters, not just whether they ever met: a pair's
        remaining hard-cap budget depends on how many times they've already
        spent it, not merely whether they've spent it at all."""
        from api.services.program_solve import extract_pairings_from_sessions

        sessions = [
            {"session": 1, "tables": {"1": [{"name": "Alice"}, {"name": "Bob"}]}},
            {"session": 2, "tables": {"1": [{"name": "Alice"}, {"name": "Bob"}]}},
        ]

        assert extract_pairings_from_sessions(sessions, exclude_session=-1) == {
            ("Alice", "Bob"): 2
        }
