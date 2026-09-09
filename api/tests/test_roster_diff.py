"""Comparing the draft roster against the canonical one."""

from api.services.roster_diff import apply_renames, diff_rosters


def _canonical(name, religion="Other", gender="Other", facilitator=False):
    return {
        "name": name,
        "religion": religion,
        "gender": gender,
        "partner": None,
        "is_facilitator": facilitator,
        "keep_together": False,
    }


class TestDiffRosters:
    def test_identical_rosters_need_nothing(self):
        roster = [_canonical("Alice"), _canonical("Bob")]
        result = diff_rosters(canonical=roster, draft=roster)

        assert result.is_dirty is False
        assert result.needs_rebuild is False
        assert result.renames == {}

    def test_an_added_person_needs_a_rebuild(self):
        result = diff_rosters(
            canonical=[_canonical("Alice")],
            draft=[_canonical("Alice"), _canonical("Bob")],
        )

        assert result.is_dirty is True
        assert result.needs_rebuild is True

    def test_a_changed_attribute_needs_a_rebuild(self):
        result = diff_rosters(
            canonical=[_canonical("Alice", religion="Christian")],
            draft=[_canonical("Alice", religion="Jewish")],
        )

        assert result.needs_rebuild is True

    def test_a_rename_is_dirty_but_does_not_need_a_rebuild(self):
        """The whole point of the rename path: fixing a typo must not cost the plan."""
        result = diff_rosters(
            canonical=[_canonical("Kathrine"), _canonical("Bob")],
            draft=[_canonical("Katherine"), _canonical("Bob")],
        )

        assert result.is_dirty is True
        assert result.needs_rebuild is False
        assert result.renames == {"Kathrine": "Katherine"}

    def test_a_rename_plus_a_real_change_needs_a_rebuild(self):
        """When a rebuild is happening anyway it carries the new name for free."""
        result = diff_rosters(
            canonical=[_canonical("Kathrine")],
            draft=[_canonical("Katherine"), _canonical("Bob")],
        )

        assert result.needs_rebuild is True

    def test_two_simultaneous_renames_are_not_guessed_at(self):
        """Renames are only detected when exactly one person is unmatched on each
        side. Two at once is ambiguous, so it is treated as a rebuild rather than
        paired up by guesswork."""
        result = diff_rosters(
            canonical=[_canonical("Ann"), _canonical("Bert")],
            draft=[_canonical("Anne"), _canonical("Bertie")],
        )

        assert result.needs_rebuild is True
        assert result.renames == {}


class TestApplyRenames:
    def test_rewrites_names_seats_partners_and_absences(self):
        assignments = [
            {
                "session": 1,
                "tables": {
                    "1": [
                        {"name": "Kathrine", "partner": "Bob"},
                        {"name": "Bob", "partner": "Kathrine"},
                    ]
                },
                "absentParticipants": [{"name": "Kathrine"}],
            }
        ]
        participant_data = [
            {"name": "Kathrine", "partner": "Bob"},
            {"name": "Bob", "partner": "Kathrine"},
        ]

        new_assignments, new_participants = apply_renames(
            assignments, participant_data, {"Kathrine": "Katherine"}
        )

        seat_names = [p["name"] for p in new_assignments[0]["tables"]["1"]]
        assert seat_names == ["Katherine", "Bob"]
        assert new_assignments[0]["tables"]["1"][1]["partner"] == "Katherine"
        assert new_assignments[0]["absentParticipants"][0]["name"] == "Katherine"
        assert [p["name"] for p in new_participants] == ["Katherine", "Bob"]
        assert new_participants[1]["partner"] == "Katherine"

    def test_leaves_the_input_untouched(self):
        """Callers hold the originals; mutating them in place would surprise."""
        assignments = [{"session": 1, "tables": {"1": [{"name": "Kathrine"}]}}]
        apply_renames(assignments, [], {"Kathrine": "Katherine"})
        assert assignments[0]["tables"]["1"][0]["name"] == "Kathrine"
