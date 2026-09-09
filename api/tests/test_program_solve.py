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
        # Note: 2 people at 5 tables is *not* infeasible - the solver happily
        # seats them at two tables and drops the empty ones. A zero-table
        # program is the smallest input the solver genuinely refuses.
        with pytest.raises(SolveFailed) as exc:
            solve_program(
                participants=_identical_people(2),
                num_tables=0,
                num_sessions=1,
                absence_map={},
                max_time_seconds=10,
            )
        assert "No solution exists" in str(exc.value)
