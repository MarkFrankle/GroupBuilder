"""Shortfall detection: what is countably wrong before we bother the solver."""

import pytest

from api.services.roster_gate import ShortfallError, check_shortfalls


def _person(name, religion="Other", facilitator=False):
    return {"name": name, "religion": religion, "is_facilitator": facilitator}


class TestCheckShortfalls:
    def test_enough_people_and_no_facilitators_passes(self):
        """Zero facilitators is legal — the solver skips the whole block."""
        check_shortfalls([_person(f"P{i}") for i in range(8)], num_tables=4)

    def test_too_few_participants_names_how_many_to_add(self):
        with pytest.raises(ShortfallError) as exc:
            check_shortfalls([_person(f"P{i}") for i in range(6)], num_tables=4)
        assert str(exc.value) == "Add 2 more participants."

    def test_too_few_facilitators_names_the_arithmetic(self):
        people = [_person(f"F{i}", facilitator=True) for i in range(3)]
        people += [_person(f"P{i}") for i in range(9)]

        with pytest.raises(ShortfallError) as exc:
            check_shortfalls(people, num_tables=4)
        assert str(exc.value) == (
            "You have 3 facilitators and 4 tables — every table needs one."
        )

    def test_too_many_facilitators_of_one_religion(self):
        """The check most easily missed: it passes both others.

        Facilitator religion diversity allows at most one facilitator of a given
        religion per table, and balance forces some table to take two. So five
        Christian facilitators across four tables is infeasible before a single
        participant is considered.
        """
        people = [
            _person(f"F{i}", religion="Christian", facilitator=True) for i in range(5)
        ]
        people += [_person(f"P{i}") for i in range(15)]

        with pytest.raises(ShortfallError) as exc:
            check_shortfalls(people, num_tables=4)
        assert str(exc.value) == (
            "You have 5 Christian facilitators and 4 tables — "
            "no table can seat two facilitators of the same religion."
        )

    def test_participants_check_wins_when_several_are_short(self):
        """Order matters: name the most basic problem first."""
        with pytest.raises(ShortfallError) as exc:
            check_shortfalls([_person("F1", facilitator=True)], num_tables=4)
        assert "participants" in str(exc.value)
