"""The sentence shown when a version cannot be promoted."""
from api.services.version_promotion import roster_change_reason


def _people(*names):
    return [{"name": n} for n in names]


def test_additions_only():
    reason = roster_change_reason(
        old_participants=_people("Alice", "Bob"),
        current_participants=_people("Alice", "Bob", "Carol"),
        change_date="Mar 6",
    )

    assert reason == (
        "This version predates your roster change on Mar 6 — "
        "it seats 2 of your 3 participants."
    )


def test_removals_only():
    reason = roster_change_reason(
        old_participants=_people("Alice", "Bob", "Carol"),
        current_participants=_people("Alice", "Bob"),
        change_date="Mar 6",
    )

    assert reason == (
        "This version predates your roster change on Mar 6 — "
        "it seats 2 of your 2 participants, and 1 person who has since left."
    )


def test_additions_and_removals():
    reason = roster_change_reason(
        old_participants=_people("Alice", "Bob", "Carol"),
        current_participants=_people("Alice", "Dave", "Erin"),
        change_date="Mar 6",
    )

    assert reason == (
        "This version predates your roster change on Mar 6 — "
        "it seats 1 of your 3 participants, and 2 people who have since left."
    )


def test_no_roster_difference_still_names_the_change():
    """A set boundary can exist without the roster moving — the table count may
    have changed. The sentence must not claim a person count is the reason."""
    reason = roster_change_reason(
        old_participants=_people("Alice", "Bob"),
        current_participants=_people("Alice", "Bob"),
        change_date="Mar 6",
    )

    assert reason == "This version predates your setup change on Mar 6."
