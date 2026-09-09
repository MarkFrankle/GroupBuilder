"""Comparing the draft roster against the canonical one."""

from api.services.roster_diff import apply_renames, diff_rosters


def _canonical(
    name, religion="Other", gender="Other", facilitator=False, keep_apart=None
):
    return {
        "name": name,
        "religion": religion,
        "gender": gender,
        "partner": None,
        "is_facilitator": facilitator,
        "keep_together": False,
        "keep_apart": keep_apart or [],
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

    def test_a_like_for_like_replacement_is_treated_as_a_rename_on_purpose(self):
        """Ellen drops out, Priya joins, every mixing field the same.

        This reads as a rename, and that is the intended behaviour rather than a
        gap in the detection. Seating Priya in Ellen's chair preserves every
        constraint and the entire repeat structure, so a rebuild would destroy a
        working plan to arrive somewhere no better. Safe only because the
        endpoint refuses renames once any Session is complete - see the note in
        ``roster_diff``.
        """
        result = diff_rosters(
            canonical=[_canonical("Alice"), _canonical("Ellen")],
            draft=[_canonical("Alice"), _canonical("Priya")],
        )

        assert result.renames == {"Ellen": "Priya"}
        assert result.needs_rebuild is False

    def test_a_replacement_by_someone_different_does_need_a_rebuild(self):
        """The moment any mixing field differs it stops being a rename, because
        the plan's balance no longer holds."""
        result = diff_rosters(
            canonical=[_canonical("Alice"), _canonical("Ellen")],
            draft=[_canonical("Alice"), _canonical("Priya", religion="Muslim")],
        )

        assert result.renames == {}
        assert result.needs_rebuild is True

    def test_adding_a_keep_apart_pair_needs_a_rebuild(self):
        canonical = [_canonical("A"), _canonical("B")]
        draft = [_canonical("A", keep_apart=["B"]), _canonical("B", keep_apart=["A"])]

        diff = diff_rosters(canonical=canonical, draft=draft)

        assert diff.is_dirty is True
        assert diff.needs_rebuild is True

    def test_removing_a_keep_apart_pair_needs_a_rebuild(self):
        canonical = [
            _canonical("A", keep_apart=["B"]),
            _canonical("B", keep_apart=["A"]),
        ]
        draft = [_canonical("A"), _canonical("B")]

        assert diff_rosters(canonical=canonical, draft=draft).needs_rebuild is True

    def test_renaming_someone_inside_a_keep_apart_pair_is_still_a_rename(self):
        """The rule is untouched; only the spelling moved. Falling through to a
        rebuild here would destroy the plan over a typo fix, through the one
        action in the app that cannot be undone."""
        canonical = [
            _canonical("Kathrine", keep_apart=["B"]),
            _canonical("B", keep_apart=["Kathrine"]),
        ]
        draft = [
            _canonical("Katherine", keep_apart=["B"]),
            _canonical("B", keep_apart=["Katherine"]),
        ]

        diff = diff_rosters(canonical=canonical, draft=draft)

        assert diff.renames == {"Kathrine": "Katherine"}
        assert diff.is_dirty is True
        assert diff.needs_rebuild is False


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

    def test_a_rename_rewrites_keep_apart_on_other_participants(self):
        """The fast path writes ``apply_renames``' output straight back as the
        canonical ``participant_data``, so a rule left pointing at the old name
        would be a name nobody answers to."""
        participant_data = [
            {"name": "Ken Adler", "partner": None, "keep_apart": ["Bill"]},
            {"name": "Bill", "partner": None, "keep_apart": ["Ken Adler"]},
        ]

        _, renamed = apply_renames([], participant_data, {"Ken Adler": "Ken A."})

        by_name = {p["name"]: p for p in renamed}
        assert by_name["Ken A."]["keep_apart"] == ["Bill"]
        assert by_name["Bill"]["keep_apart"] == ["Ken A."]

    def test_leaves_the_input_untouched(self):
        """Callers hold the originals; mutating them in place would surprise."""
        assignments = [{"session": 1, "tables": {"1": [{"name": "Kathrine"}]}}]
        apply_renames(assignments, [], {"Kathrine": "Katherine"})
        assert assignments[0]["tables"]["1"][0]["name"] == "Kathrine"
