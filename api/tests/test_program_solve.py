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
