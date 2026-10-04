"""Upload drafts on the Program document."""

import pytest

from api.services.roster_draft_storage import RosterDraftStorage

PROGRAM = "test_org_id"


@pytest.fixture
def storage(client):
    return RosterDraftStorage()


def test_drafts_round_trip(storage):
    draft = {"id": "d1", "name": "Grace", "religion": None, "gender": "Female"}
    storage.write_drafts(PROGRAM, [draft])
    assert storage.get_drafts(PROGRAM) == [draft]


def test_no_drafts_by_default(storage):
    assert storage.get_drafts(PROGRAM) == []


def test_junk_entries_are_ignored(storage):
    storage.write_drafts(PROGRAM, [{"name": "no id"}, {"id": "d1", "name": "Grace"}])
    assert [d["id"] for d in storage.get_drafts(PROGRAM)] == ["d1"]
