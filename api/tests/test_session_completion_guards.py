"""Tests for the shared refusal guards in session_completion_guards."""


class TestRefuseIfNotAccepted:
    def test_passes_for_an_accepted_set(self, client):
        from api.services.assignment_set_storage import AssignmentSetStorage
        from api.services.session_completion_guards import refuse_if_not_accepted

        storage = AssignmentSetStorage()
        set_id = storage.create_set(
            program_id="test_org_id",
            user_id="u",
            participant_data=[{"id": 1, "name": "A", "religion": "X", "gender": "M"}],
            filename="r",
            num_tables=1,
            num_sessions=3,
        )
        refuse_if_not_accepted(storage, "test_org_id", set_id)  # no raise

    def test_raises_409_for_a_provisional_set(self, client):
        import pytest
        from fastapi import HTTPException
        from api.services.assignment_set_storage import AssignmentSetStorage
        from api.services.session_completion_guards import refuse_if_not_accepted

        storage = AssignmentSetStorage()
        set_id = storage.create_set(
            program_id="test_org_id",
            user_id="u",
            participant_data=[{"id": 1, "name": "A", "religion": "X", "gender": "M"}],
            filename="r",
            num_tables=1,
            num_sessions=3,
            accepted=False,
            previous_set_id="old",
        )
        with pytest.raises(HTTPException) as exc:
            refuse_if_not_accepted(storage, "test_org_id", set_id)
        assert exc.value.status_code == 409
        assert "Accept or undo" in exc.value.detail
