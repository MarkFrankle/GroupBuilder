# Roster Management Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an in-app spreadsheet-style roster editor so organizers can manage participants without Excel, with file import as a shortcut that populates the same UI.

**Architecture:** New `/api/roster/` backend router with CRUD endpoints backed by Firestore `organizations/{orgId}/roster/{participantId}` subcollection. New `/roster` frontend page with an editable HTML table grid. Landing page simplified to a hub linking to roster management or Excel import.

**Tech Stack:** FastAPI + Firestore (backend), React + TypeScript + Tailwind + shadcn/ui components (frontend), pytest + React Testing Library (tests)

---

## Task 1: Roster Firestore Service — GET and PUT

**Files:**
- Create: `api/src/api/services/roster_service.py`
- Test: `api/tests/test_roster_service.py`

**Step 1: Write failing tests for get_roster and upsert_participant**

```python
# api/tests/test_roster_service.py
import pytest
from unittest.mock import MagicMock, patch
from api.services.roster_service import RosterService


@pytest.fixture
def mock_db():
    """Create a mock Firestore client."""
    return MagicMock()


@pytest.fixture
def service(mock_db):
    return RosterService(mock_db)


class TestGetRoster:
    def test_returns_empty_list_for_new_org(self, service, mock_db):
        mock_db.collection.return_value.document.return_value.collection.return_value.stream.return_value = []
        result = service.get_roster("org_1")
        assert result == []

    def test_returns_participants(self, service, mock_db):
        mock_doc = MagicMock()
        mock_doc.id = "p1"
        mock_doc.to_dict.return_value = {
            "name": "Alice", "religion": "Christian",
            "gender": "Female", "partner_id": None,
        }
        mock_db.collection.return_value.document.return_value.collection.return_value.stream.return_value = [mock_doc]

        result = service.get_roster("org_1")
        assert len(result) == 1
        assert result[0]["id"] == "p1"
        assert result[0]["name"] == "Alice"


class TestUpsertParticipant:
    def test_creates_new_participant(self, service, mock_db):
        doc_ref = MagicMock()
        mock_db.collection.return_value.document.return_value.collection.return_value.document.return_value = doc_ref

        result = service.upsert_participant("org_1", "p1", {
            "name": "Alice", "religion": "Christian",
            "gender": "Female", "partner_id": None,
        })
        doc_ref.set.assert_called_once()
        call_data = doc_ref.set.call_args[0][0]
        assert call_data["name"] == "Alice"
        assert "updated_at" in call_data

    def test_rejects_invalid_religion(self, service):
        with pytest.raises(ValueError, match="religion"):
            service.upsert_participant("org_1", "p1", {
                "name": "Alice", "religion": "Pastafarian",
                "gender": "Female", "partner_id": None,
            })

    def test_rejects_invalid_gender(self, service):
        with pytest.raises(ValueError, match="gender"):
            service.upsert_participant("org_1", "p1", {
                "name": "Alice", "religion": "Christian",
                "gender": "Robot", "partner_id": None,
            })

    def test_rejects_empty_name(self, service):
        with pytest.raises(ValueError, match="name"):
            service.upsert_participant("org_1", "p1", {
                "name": "", "religion": "Christian",
                "gender": "Female", "partner_id": None,
            })
```

**Step 2: Run tests to verify they fail**

Run: `cd /Users/markfrankle/Dev/repos/GroupBuilder/api && python -m pytest tests/test_roster_service.py -v`
Expected: ModuleNotFoundError for `api.services.roster_service`

**Step 3: Implement RosterService**

```python
# api/src/api/services/roster_service.py
from datetime import datetime, timezone
from typing import Optional

VALID_RELIGIONS = {"Christian", "Jewish", "Muslim", "Other"}
VALID_GENDERS = {"Male", "Female", "Other"}

_roster_service: Optional["RosterService"] = None


class RosterService:
    def __init__(self, db=None):
        if db is None:
            from api.firebase_admin import get_firestore_client
            db = get_firestore_client()
        self.db = db

    def _roster_collection(self, org_id: str):
        return self.db.collection("organizations").document(org_id).collection("roster")

    def get_roster(self, org_id: str) -> list[dict]:
        docs = self._roster_collection(org_id).stream()
        participants = []
        for doc in docs:
            data = doc.to_dict()
            data["id"] = doc.id
            participants.append(data)
        return participants

    def upsert_participant(self, org_id: str, participant_id: str, data: dict) -> dict:
        name = data.get("name", "").strip()
        if not name:
            raise ValueError("name must not be empty")

        religion = data.get("religion", "")
        if religion not in VALID_RELIGIONS:
            raise ValueError(f"Invalid religion: {religion}. Must be one of {VALID_RELIGIONS}")

        gender = data.get("gender", "")
        if gender not in VALID_GENDERS:
            raise ValueError(f"Invalid gender: {gender}. Must be one of {VALID_GENDERS}")

        now = datetime.now(timezone.utc)
        doc_data = {
            "name": name,
            "religion": religion,
            "gender": gender,
            "partner_id": data.get("partner_id"),
            "updated_at": now,
        }

        doc_ref = self._roster_collection(org_id).document(participant_id)
        # Use set with merge to create or update
        doc_ref.set(doc_data, merge=True)

        doc_data["id"] = participant_id
        return doc_data

    def delete_participant(self, org_id: str, participant_id: str):
        self._roster_collection(org_id).document(participant_id).delete()

    def get_participant(self, org_id: str, participant_id: str) -> Optional[dict]:
        doc = self._roster_collection(org_id).document(participant_id).get()
        if not doc.exists:
            return None
        data = doc.to_dict()
        data["id"] = doc.id
        return data


def get_roster_service() -> RosterService:
    global _roster_service
    if _roster_service is None:
        _roster_service = RosterService()
    return _roster_service
```

**Step 4: Run tests to verify they pass**

Run: `cd /Users/markfrankle/Dev/repos/GroupBuilder/api && python -m pytest tests/test_roster_service.py -v`
Expected: All PASS

**Step 5: Commit**

```bash
git add api/src/api/services/roster_service.py api/tests/test_roster_service.py
git commit -m "feat: add RosterService with get/upsert/delete for Firestore roster"
```

---

## Task 2: Roster API Router — CRUD Endpoints

**Files:**
- Create: `api/src/api/routers/roster.py`
- Modify: `api/src/api/main.py` (add router registration)
- Test: `api/tests/test_roster.py`

**Step 1: Write failing tests for CRUD endpoints**

```python
# api/tests/test_roster.py
import pytest


class TestGetRoster:
    def test_returns_empty_roster(self, client):
        response = client.get("/api/roster/")
        assert response.status_code == 200
        assert response.json() == {"participants": []}

    def test_returns_participants(self, client):
        # Create a participant first
        client.put("/api/roster/p1", json={
            "name": "Alice", "religion": "Christian",
            "gender": "Female", "partner_id": None,
        })
        response = client.get("/api/roster/")
        assert response.status_code == 200
        data = response.json()
        assert len(data["participants"]) == 1
        assert data["participants"][0]["name"] == "Alice"


class TestUpsertParticipant:
    def test_creates_participant(self, client):
        response = client.put("/api/roster/p1", json={
            "name": "Alice", "religion": "Christian",
            "gender": "Female", "partner_id": None,
        })
        assert response.status_code == 200
        assert response.json()["name"] == "Alice"

    def test_updates_participant(self, client):
        client.put("/api/roster/p1", json={
            "name": "Alice", "religion": "Christian",
            "gender": "Female", "partner_id": None,
        })
        response = client.put("/api/roster/p1", json={
            "name": "Alice Updated", "religion": "Jewish",
            "gender": "Female", "partner_id": None,
        })
        assert response.status_code == 200
        assert response.json()["name"] == "Alice Updated"

    def test_rejects_invalid_data(self, client):
        response = client.put("/api/roster/p1", json={
            "name": "", "religion": "Christian",
            "gender": "Female", "partner_id": None,
        })
        assert response.status_code == 400


class TestDeleteParticipant:
    def test_deletes_participant(self, client):
        client.put("/api/roster/p1", json={
            "name": "Alice", "religion": "Christian",
            "gender": "Female", "partner_id": None,
        })
        response = client.delete("/api/roster/p1")
        assert response.status_code == 200

        # Verify it's gone
        roster = client.get("/api/roster/")
        assert len(roster.json()["participants"]) == 0

    def test_clears_partner_on_delete(self, client):
        # Create Alice and Bob as partners
        client.put("/api/roster/p1", json={
            "name": "Alice", "religion": "Christian",
            "gender": "Female", "partner_id": "p2",
        })
        client.put("/api/roster/p2", json={
            "name": "Bob", "religion": "Christian",
            "gender": "Male", "partner_id": "p1",
        })
        # Delete Alice
        client.delete("/api/roster/p1")
        # Bob's partner should be cleared
        roster = client.get("/api/roster/")
        bob = [p for p in roster.json()["participants"] if p["name"] == "Bob"][0]
        assert bob["partner_id"] is None
```

**Step 2: Run tests to verify they fail**

Run: `cd /Users/markfrankle/Dev/repos/GroupBuilder/api && python -m pytest tests/test_roster.py -v`
Expected: 404 — router not registered

**Step 3: Implement the router**

```python
# api/src/api/routers/roster.py
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from slowapi import Limiter
from slowapi.util import get_remote_address

from api.middleware.auth import get_current_user, AuthUser
from api.services.roster_service import RosterService, get_roster_service
from api.services.firestore_service import FirestoreService, get_firestore_service

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


class ParticipantData(BaseModel):
    name: str
    religion: str
    gender: str
    partner_id: Optional[str] = None


async def _get_org_id(
    user: AuthUser = Depends(get_current_user),
    firestore_service: FirestoreService = Depends(get_firestore_service),
) -> str:
    orgs = firestore_service.get_user_organizations(user.user_id)
    if not orgs:
        raise HTTPException(status_code=403, detail="User has no organization")
    return orgs[0]["id"]


@router.get("/")
@limiter.limit("30/minute")
async def get_roster(
    request: Request,
    org_id: str = Depends(_get_org_id),
    roster_service: RosterService = Depends(get_roster_service),
):
    participants = roster_service.get_roster(org_id)
    return {"participants": participants}


@router.put("/{participant_id}")
@limiter.limit("60/minute")
async def upsert_participant(
    request: Request,
    participant_id: str,
    data: ParticipantData,
    org_id: str = Depends(_get_org_id),
    roster_service: RosterService = Depends(get_roster_service),
):
    try:
        result = roster_service.upsert_participant(org_id, participant_id, data.model_dump())
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{participant_id}")
@limiter.limit("30/minute")
async def delete_participant(
    request: Request,
    participant_id: str,
    org_id: str = Depends(_get_org_id),
    roster_service: RosterService = Depends(get_roster_service),
):
    # Clear partner references before deleting
    participant = roster_service.get_participant(org_id, participant_id)
    if participant and participant.get("partner_id"):
        partner = roster_service.get_participant(org_id, participant["partner_id"])
        if partner and partner.get("partner_id") == participant_id:
            roster_service.upsert_participant(org_id, participant["partner_id"], {
                **partner, "partner_id": None
            })

    roster_service.delete_participant(org_id, participant_id)
    return {"status": "deleted"}
```

**Step 4: Register the router in main.py**

Add to `api/src/api/main.py` after the existing router includes (around line 61):

```python
from api.routers import roster
# ... after existing includes:
app.include_router(roster.router, prefix="/api/roster", tags=["roster"])
```

**Step 5: Run tests to verify they pass**

Run: `cd /Users/markfrankle/Dev/repos/GroupBuilder/api && python -m pytest tests/test_roster.py -v`
Expected: All PASS

Note: The `client` fixture from `conftest.py` sets up a mock Firestore with `test_org_id` and a member for `test_user`. The `_get_org_id` dependency calls `firestore_service.get_user_organizations()` which queries the mock. If tests fail because org lookup doesn't work with the mock, you may need to override `_get_org_id` in the test fixture:

```python
# Add to conftest.py or test file
from api.routers.roster import _get_org_id
app.dependency_overrides[_get_org_id] = lambda: "test_org_id"
```

**Step 6: Commit**

```bash
git add api/src/api/routers/roster.py api/src/api/main.py api/tests/test_roster.py
git commit -m "feat: add roster CRUD API endpoints"
```

---

## Task 3: Roster Import Endpoint (Excel → Roster)

**Files:**
- Modify: `api/src/api/routers/roster.py`
- Modify: `api/tests/test_roster.py`

**Step 1: Write failing test for import**

```python
# Add to api/tests/test_roster.py
import io
import pandas as pd


class TestImportRoster:
    def _make_excel(self, participants):
        df = pd.DataFrame(participants)
        buffer = io.BytesIO()
        df.to_excel(buffer, index=False)
        buffer.seek(0)
        return buffer

    def test_imports_excel_file(self, client):
        excel = self._make_excel([
            {"Name": "Alice", "Religion": "Christian", "Gender": "Female", "Partner": ""},
            {"Name": "Bob", "Religion": "Jewish", "Gender": "Male", "Partner": ""},
        ])
        response = client.post(
            "/api/roster/import",
            files={"file": ("roster.xlsx", excel, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["participants"]) == 2

    def test_imports_with_partners(self, client):
        excel = self._make_excel([
            {"Name": "Alice", "Religion": "Christian", "Gender": "Female", "Partner": "Bob"},
            {"Name": "Bob", "Religion": "Jewish", "Gender": "Male", "Partner": "Alice"},
        ])
        response = client.post(
            "/api/roster/import",
            files={"file": ("roster.xlsx", excel, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        )
        assert response.status_code == 200
        participants = response.json()["participants"]
        alice = [p for p in participants if p["name"] == "Alice"][0]
        bob = [p for p in participants if p["name"] == "Bob"][0]
        assert alice["partner_id"] == bob["id"]
        assert bob["partner_id"] == alice["id"]

    def test_rejects_missing_columns(self, client):
        excel = self._make_excel([{"Name": "Alice", "Religion": "Christian"}])
        response = client.post(
            "/api/roster/import",
            files={"file": ("roster.xlsx", excel, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        )
        assert response.status_code == 400

    def test_clears_existing_roster_on_import(self, client):
        # Add a participant first
        client.put("/api/roster/p1", json={
            "name": "OldPerson", "religion": "Christian",
            "gender": "Female", "partner_id": None,
        })
        # Import replaces
        excel = self._make_excel([
            {"Name": "NewPerson", "Religion": "Jewish", "Gender": "Male", "Partner": ""},
        ])
        response = client.post(
            "/api/roster/import",
            files={"file": ("roster.xlsx", excel, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        )
        assert response.status_code == 200
        roster = client.get("/api/roster/")
        names = [p["name"] for p in roster.json()["participants"]]
        assert "NewPerson" in names
        assert "OldPerson" not in names
```

**Step 2: Run tests to verify they fail**

Run: `cd /Users/markfrankle/Dev/repos/GroupBuilder/api && python -m pytest tests/test_roster.py::TestImportRoster -v`
Expected: 404 or 405 — endpoint doesn't exist yet

**Step 3: Implement the import endpoint**

Add to `api/src/api/routers/roster.py`:

```python
import uuid
import pandas as pd
from fastapi import UploadFile, File

REQUIRED_COLUMNS = {"Name", "Religion", "Gender", "Partner"}


@router.post("/import")
@limiter.limit("10/minute")
async def import_roster(
    request: Request,
    file: UploadFile = File(...),
    org_id: str = Depends(_get_org_id),
    roster_service: RosterService = Depends(get_roster_service),
):
    # Validate file
    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="File must be .xlsx or .xls")

    contents = await file.read()
    try:
        df = pd.read_excel(io.BytesIO(contents))
    except Exception:
        raise HTTPException(status_code=400, detail="Could not parse Excel file")

    # Check required columns
    missing = REQUIRED_COLUMNS - set(df.columns)
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing columns: {', '.join(missing)}")

    # Clear existing roster
    existing = roster_service.get_roster(org_id)
    for p in existing:
        roster_service.delete_participant(org_id, p["id"])

    # Import participants (first pass: create without partners)
    name_to_id = {}
    participants = []
    for _, row in df.iterrows():
        name = str(row["Name"]).strip()
        if not name or name == "nan":
            continue
        pid = str(uuid.uuid4())
        religion = str(row.get("Religion", "Other")).strip()
        if religion == "nan" or religion not in ("Christian", "Jewish", "Muslim", "Other"):
            religion = "Other"
        gender = str(row.get("Gender", "Other")).strip()
        if gender == "nan" or gender not in ("Male", "Female", "Other"):
            gender = "Other"

        roster_service.upsert_participant(org_id, pid, {
            "name": name, "religion": religion,
            "gender": gender, "partner_id": None,
        })
        name_to_id[name] = pid
        participants.append({"id": pid, "name": name, "religion": religion,
                             "gender": gender, "partner_id": None})

    # Second pass: link partners
    for _, row in df.iterrows():
        name = str(row["Name"]).strip()
        partner_name = str(row.get("Partner", "")).strip()
        if not partner_name or partner_name == "nan" or partner_name == "":
            continue
        if name in name_to_id and partner_name in name_to_id:
            pid = name_to_id[name]
            partner_pid = name_to_id[partner_name]
            # Update both sides
            p = [x for x in participants if x["id"] == pid][0]
            p["partner_id"] = partner_pid
            roster_service.upsert_participant(org_id, pid, {**p})

    # Refresh to get final state
    final = roster_service.get_roster(org_id)
    return {"participants": final}
```

Add `import io` to the top of the file.

**Step 4: Run tests to verify they pass**

Run: `cd /Users/markfrankle/Dev/repos/GroupBuilder/api && python -m pytest tests/test_roster.py -v`
Expected: All PASS

**Step 5: Commit**

```bash
git add api/src/api/routers/roster.py api/tests/test_roster.py
git commit -m "feat: add Excel import endpoint for roster"
```

---

## Task 4: Generate Assignments from Roster

**Files:**
- Modify: `api/src/api/routers/roster.py`
- Modify: `api/tests/test_roster.py`

This endpoint reads the roster, converts it to the solver's participant format, creates a session, and returns the session_id so the frontend can call the existing `/api/assignments/` endpoint.

**Step 1: Write failing test**

```python
# Add to api/tests/test_roster.py
class TestCreateSessionFromRoster:
    def test_creates_session(self, client):
        # Add participants
        client.put("/api/roster/p1", json={
            "name": "Alice", "religion": "Christian",
            "gender": "Female", "partner_id": None,
        })
        client.put("/api/roster/p2", json={
            "name": "Bob", "religion": "Jewish",
            "gender": "Male", "partner_id": None,
        })

        response = client.post("/api/roster/generate", json={
            "num_tables": 1, "num_sessions": 1,
        })
        assert response.status_code == 200
        data = response.json()
        assert "session_id" in data

    def test_rejects_empty_roster(self, client):
        response = client.post("/api/roster/generate", json={
            "num_tables": 1, "num_sessions": 1,
        })
        assert response.status_code == 400

    def test_rejects_too_few_participants(self, client):
        client.put("/api/roster/p1", json={
            "name": "Alice", "religion": "Christian",
            "gender": "Female", "partner_id": None,
        })
        response = client.post("/api/roster/generate", json={
            "num_tables": 3, "num_sessions": 1,
        })
        assert response.status_code == 400
```

**Step 2: Run tests to verify they fail**

Run: `cd /Users/markfrankle/Dev/repos/GroupBuilder/api && python -m pytest tests/test_roster.py::TestCreateSessionFromRoster -v`
Expected: 404/405

**Step 3: Implement generate endpoint**

Add to `api/src/api/routers/roster.py`:

```python
from api.services.session_storage import SessionStorage
from pydantic import Field


class GenerateRequest(BaseModel):
    num_tables: int = Field(ge=1, le=10)
    num_sessions: int = Field(ge=1, le=6)


def _roster_to_participant_list(participants: list[dict]) -> list[dict]:
    """Convert roster docs to the solver's expected participant dict format."""
    # Build id-to-name map for partner resolution
    id_to_name = {p["id"]: p["name"] for p in participants}

    result = []
    for i, p in enumerate(participants):
        partner_name = None
        if p.get("partner_id") and p["partner_id"] in id_to_name:
            partner_name = id_to_name[p["partner_id"]]
        result.append({
            "id": i + 1,
            "name": p["name"],
            "religion": p["religion"],
            "gender": p["gender"],
            "partner": partner_name,
            "couple_id": None,
        })

    # Assign couple IDs (same logic as dataframe_to_participant_dict)
    couple_map = {}
    next_couple_id = 1
    for p in result:
        if p["partner"]:
            key = tuple(sorted([p["name"], p["partner"]]))
            if key not in couple_map:
                couple_map[key] = next_couple_id
                next_couple_id += 1
            p["couple_id"] = couple_map[key]

    return result


@router.post("/generate")
@limiter.limit("10/minute")
async def generate_from_roster(
    request: Request,
    data: GenerateRequest,
    user: AuthUser = Depends(get_current_user),
    org_id: str = Depends(_get_org_id),
    roster_service: RosterService = Depends(get_roster_service),
):
    participants = roster_service.get_roster(org_id)
    if not participants:
        raise HTTPException(status_code=400, detail="Roster is empty")

    if len(participants) < data.num_tables:
        raise HTTPException(
            status_code=400,
            detail=f"Need at least {data.num_tables} participants for {data.num_tables} tables"
        )

    participant_list = _roster_to_participant_list(participants)

    session_id = str(uuid.uuid4())
    storage = SessionStorage()
    storage.save_session(
        org_id=org_id,
        session_id=session_id,
        participant_data=participant_list,
        num_tables=data.num_tables,
        num_sessions=data.num_sessions,
        filename="roster",
        created_by=user.user_id,
    )

    return {"session_id": session_id, "message": "Session created from roster"}
```

**Step 4: Run tests to verify they pass**

Run: `cd /Users/markfrankle/Dev/repos/GroupBuilder/api && python -m pytest tests/test_roster.py -v`
Expected: All PASS

**Step 5: Run all backend tests to check for regressions**

Run: `cd /Users/markfrankle/Dev/repos/GroupBuilder/api && python -m pytest -v`
Expected: All existing tests still pass

**Step 6: Commit**

```bash
git add api/src/api/routers/roster.py api/tests/test_roster.py
git commit -m "feat: add generate-from-roster endpoint"
```

---

## Task 5: Frontend Types and API Client for Roster

**Files:**
- Create: `frontend/src/types/roster.ts`
- Create: `frontend/src/api/roster.ts`
- Test: `frontend/src/api/__tests__/roster.test.ts`

**Step 1: Write the types**

```typescript
// frontend/src/types/roster.ts
export interface RosterParticipant {
  id: string;
  name: string;
  religion: "Christian" | "Jewish" | "Muslim" | "Other";
  gender: "Male" | "Female" | "Other";
  partner_id: string | null;
}

export type Religion = RosterParticipant["religion"];
export type Gender = RosterParticipant["gender"];

export const RELIGIONS: Religion[] = ["Christian", "Jewish", "Muslim", "Other"];
export const GENDERS: Gender[] = ["Male", "Female", "Other"];
```

**Step 2: Write failing tests for the API client**

```typescript
// frontend/src/api/__tests__/roster.test.ts
import { getRoster, upsertParticipant, deleteParticipant, generateFromRoster } from '@/api/roster';
import { authenticatedFetch } from '@/utils/apiClient';

jest.mock('@/utils/apiClient');
const mockFetch = authenticatedFetch as jest.MockedFunction<typeof authenticatedFetch>;

describe('roster API', () => {
  beforeEach(() => jest.clearAllMocks());

  test('getRoster calls GET /api/roster/', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ participants: [] }),
    } as Response);

    const result = await getRoster();
    expect(mockFetch).toHaveBeenCalledWith('/api/roster/');
    expect(result).toEqual([]);
  });

  test('upsertParticipant calls PUT with data', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'p1', name: 'Alice' }),
    } as Response);

    await upsertParticipant('p1', {
      name: 'Alice', religion: 'Christian',
      gender: 'Female', partner_id: null,
    });
    expect(mockFetch).toHaveBeenCalledWith('/api/roster/p1', expect.objectContaining({
      method: 'PUT',
    }));
  });

  test('deleteParticipant calls DELETE', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) } as Response);
    await deleteParticipant('p1');
    expect(mockFetch).toHaveBeenCalledWith('/api/roster/p1', expect.objectContaining({
      method: 'DELETE',
    }));
  });

  test('generateFromRoster calls POST /api/roster/generate', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ session_id: 'abc' }),
    } as Response);

    const result = await generateFromRoster(3, 2);
    expect(mockFetch).toHaveBeenCalledWith('/api/roster/generate', expect.objectContaining({
      method: 'POST',
    }));
    expect(result).toBe('abc');
  });
});
```

**Step 3: Run tests to verify they fail**

Run: `cd /Users/markfrankle/Dev/repos/GroupBuilder/frontend && npx craco test --watchAll=false --testPathPattern='api/__tests__/roster'`
Expected: Cannot find module `@/api/roster`

**Step 4: Implement the API client**

```typescript
// frontend/src/api/roster.ts
import { authenticatedFetch } from '@/utils/apiClient';
import { RosterParticipant } from '@/types/roster';

export async function getRoster(): Promise<RosterParticipant[]> {
  const response = await authenticatedFetch('/api/roster/');
  if (!response.ok) {
    throw new Error(`Failed to fetch roster: ${response.status}`);
  }
  const data = await response.json();
  return data.participants;
}

export async function upsertParticipant(
  participantId: string,
  data: Omit<RosterParticipant, 'id'>
): Promise<RosterParticipant> {
  const response = await authenticatedFetch(`/api/roster/${participantId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(`Failed to save participant: ${response.status}`);
  }
  return response.json();
}

export async function deleteParticipant(participantId: string): Promise<void> {
  const response = await authenticatedFetch(`/api/roster/${participantId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(`Failed to delete participant: ${response.status}`);
  }
}

export async function importRoster(file: File): Promise<RosterParticipant[]> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await authenticatedFetch('/api/roster/import', {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) {
    throw new Error(`Failed to import roster: ${response.status}`);
  }
  const data = await response.json();
  return data.participants;
}

export async function generateFromRoster(
  numTables: number,
  numSessions: number
): Promise<string> {
  const response = await authenticatedFetch('/api/roster/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ num_tables: numTables, num_sessions: numSessions }),
  });
  if (!response.ok) {
    throw new Error(`Failed to generate: ${response.status}`);
  }
  const data = await response.json();
  return data.session_id;
}
```

**Step 5: Run tests to verify they pass**

Run: `cd /Users/markfrankle/Dev/repos/GroupBuilder/frontend && npx craco test --watchAll=false --testPathPattern='api/__tests__/roster'`
Expected: All PASS

**Step 6: Commit**

```bash
git add frontend/src/types/roster.ts frontend/src/api/roster.ts frontend/src/api/__tests__/roster.test.ts
git commit -m "feat: add roster types and API client"
```

---

## Task 6: Roster Grid Component

**Files:**
- Create: `frontend/src/components/RosterGrid/RosterGrid.tsx`
- Test: `frontend/src/components/RosterGrid/__tests__/RosterGrid.test.tsx`

This is the core spreadsheet-style grid. It's a controlled component — parent provides participants and callbacks.

**Step 1: Write failing tests**

```typescript
// frontend/src/components/RosterGrid/__tests__/RosterGrid.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RosterGrid } from '../RosterGrid';
import { RosterParticipant } from '@/types/roster';

const alice: RosterParticipant = {
  id: 'p1', name: 'Alice', religion: 'Christian', gender: 'Female', partner_id: null,
};
const bob: RosterParticipant = {
  id: 'p2', name: 'Bob', religion: 'Jewish', gender: 'Male', partner_id: null,
};

describe('RosterGrid', () => {
  const defaultProps = {
    participants: [alice, bob],
    onUpdate: jest.fn(),
    onDelete: jest.fn(),
    onAdd: jest.fn(),
  };

  test('renders all participants as rows', () => {
    render(<RosterGrid {...defaultProps} />);
    expect(screen.getByDisplayValue('Alice')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Bob')).toBeInTheDocument();
  });

  test('renders column headers', () => {
    render(<RosterGrid {...defaultProps} />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Religion')).toBeInTheDocument();
    expect(screen.getByText('Gender')).toBeInTheDocument();
    expect(screen.getByText('Partner')).toBeInTheDocument();
  });

  test('renders an empty row at the bottom', () => {
    render(<RosterGrid {...defaultProps} />);
    // There should be 3 name inputs: Alice, Bob, and the empty row
    const nameInputs = screen.getAllByPlaceholderText('Name');
    expect(nameInputs).toHaveLength(3);
    expect(nameInputs[2]).toHaveValue('');
  });

  test('shows participant count', () => {
    render(<RosterGrid {...defaultProps} />);
    expect(screen.getByText('2 participants')).toBeInTheDocument();
  });

  test('calls onUpdate when name is changed and blurred', async () => {
    render(<RosterGrid {...defaultProps} />);
    const nameInput = screen.getByDisplayValue('Alice');
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Alicia');
    fireEvent.blur(nameInput);
    expect(defaultProps.onUpdate).toHaveBeenCalledWith('p1', expect.objectContaining({
      name: 'Alicia',
    }));
  });

  test('calls onAdd when typing in the empty row', async () => {
    render(<RosterGrid {...defaultProps} />);
    const emptyNameInputs = screen.getAllByPlaceholderText('Name');
    const emptyRow = emptyNameInputs[2]; // the perpetual empty row
    await userEvent.type(emptyRow, 'Charlie');
    fireEvent.blur(emptyRow);
    expect(defaultProps.onAdd).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Charlie',
    }));
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd /Users/markfrankle/Dev/repos/GroupBuilder/frontend && npx craco test --watchAll=false --testPathPattern='RosterGrid'`
Expected: Cannot find module

**Step 3: Implement RosterGrid**

```tsx
// frontend/src/components/RosterGrid/RosterGrid.tsx
import { useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Trash2 } from 'lucide-react';
import { RosterParticipant, Religion, Gender, RELIGIONS, GENDERS } from '@/types/roster';

interface RosterGridProps {
  participants: RosterParticipant[];
  onUpdate: (id: string, data: Omit<RosterParticipant, 'id'>) => void;
  onDelete: (id: string) => void;
  onAdd: (data: Omit<RosterParticipant, 'id'>) => void;
}

interface EmptyRowState {
  name: string;
  religion: Religion;
  gender: Gender;
  partner_id: string | null;
}

const EMPTY_ROW: EmptyRowState = {
  name: '', religion: 'Other', gender: 'Other', partner_id: null,
};

export function RosterGrid({ participants, onUpdate, onDelete, onAdd }: RosterGridProps) {
  const [editingNames, setEditingNames] = useState<Record<string, string>>({});
  const [emptyRow, setEmptyRow] = useState<EmptyRowState>({ ...EMPTY_ROW });

  const handleNameChange = (id: string, value: string) => {
    setEditingNames(prev => ({ ...prev, [id]: value }));
  };

  const handleNameBlur = (participant: RosterParticipant) => {
    const newName = editingNames[participant.id];
    if (newName !== undefined && newName !== participant.name) {
      onUpdate(participant.id, {
        name: newName,
        religion: participant.religion,
        gender: participant.gender,
        partner_id: participant.partner_id,
      });
    }
    setEditingNames(prev => {
      const next = { ...prev };
      delete next[participant.id];
      return next;
    });
  };

  const handleFieldChange = (
    participant: RosterParticipant,
    field: 'religion' | 'gender' | 'partner_id',
    value: string,
  ) => {
    const partnerValue = field === 'partner_id' ? (value === 'none' ? null : value) : participant.partner_id;
    onUpdate(participant.id, {
      name: editingNames[participant.id] ?? participant.name,
      religion: field === 'religion' ? value as Religion : participant.religion,
      gender: field === 'gender' ? value as Gender : participant.gender,
      partner_id: partnerValue,
    });
  };

  const handleEmptyRowBlur = useCallback(() => {
    if (emptyRow.name.trim()) {
      onAdd({
        name: emptyRow.name.trim(),
        religion: emptyRow.religion,
        gender: emptyRow.gender,
        partner_id: emptyRow.partner_id,
      });
      setEmptyRow({ ...EMPTY_ROW });
    }
  }, [emptyRow, onAdd]);

  const duplicateNames = new Set<string>();
  const nameCounts: Record<string, number> = {};
  for (const p of participants) {
    nameCounts[p.name] = (nameCounts[p.name] || 0) + 1;
    if (nameCounts[p.name] > 1) duplicateNames.add(p.name);
  }

  return (
    <div>
      <div className="text-sm text-muted-foreground mb-2">
        {participants.length} participant{participants.length !== 1 ? 's' : ''}
      </div>
      <div className="w-full overflow-auto border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Name</TableHead>
              <TableHead className="w-[150px]">Religion</TableHead>
              <TableHead className="w-[120px]">Gender</TableHead>
              <TableHead className="w-[200px]">Partner</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {participants.map(p => {
              const currentName = editingNames[p.id] ?? p.name;
              const hasError = !currentName.trim() || duplicateNames.has(p.name);

              return (
                <TableRow key={p.id} className="group">
                  <TableCell className="p-1">
                    <Input
                      placeholder="Name"
                      value={currentName}
                      onChange={e => handleNameChange(p.id, e.target.value)}
                      onBlur={() => handleNameBlur(p)}
                      className={hasError ? 'border-red-500' : ''}
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <Select value={p.religion} onValueChange={v => handleFieldChange(p, 'religion', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {RELIGIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="p-1">
                    <Select value={p.gender} onValueChange={v => handleFieldChange(p, 'gender', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {GENDERS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="p-1">
                    <Select
                      value={p.partner_id ?? 'none'}
                      onValueChange={v => handleFieldChange(p, 'partner_id', v)}
                    >
                      <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {participants
                          .filter(other => other.id !== p.id)
                          .map(other => (
                            <SelectItem key={other.id} value={other.id}>{other.name}</SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="p-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => onDelete(p.id)}
                      aria-label={`Delete ${p.name}`}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {/* Perpetual empty row */}
            <TableRow>
              <TableCell className="p-1">
                <Input
                  placeholder="Name"
                  value={emptyRow.name}
                  onChange={e => setEmptyRow(prev => ({ ...prev, name: e.target.value }))}
                  onBlur={handleEmptyRowBlur}
                />
              </TableCell>
              <TableCell className="p-1">
                <Select value={emptyRow.religion} onValueChange={v => setEmptyRow(prev => ({ ...prev, religion: v as Religion }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RELIGIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell className="p-1">
                <Select value={emptyRow.gender} onValueChange={v => setEmptyRow(prev => ({ ...prev, gender: v as Gender }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GENDERS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell className="p-1">
                <span className="text-sm text-muted-foreground px-3">—</span>
              </TableCell>
              <TableCell className="p-1"></TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
```

**Step 4: Run tests to verify they pass**

Run: `cd /Users/markfrankle/Dev/repos/GroupBuilder/frontend && npx craco test --watchAll=false --testPathPattern='RosterGrid'`
Expected: All PASS

**Step 5: Commit**

```bash
git add frontend/src/components/RosterGrid/
git commit -m "feat: add RosterGrid spreadsheet component"
```

---

## Task 7: Roster Page

**Files:**
- Create: `frontend/src/pages/RosterPage.tsx`
- Modify: `frontend/src/App.tsx` (add route)
- Test: `frontend/src/pages/__tests__/RosterPage.test.tsx`

**Step 1: Write failing tests**

```typescript
// frontend/src/pages/__tests__/RosterPage.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { RosterPage } from '../RosterPage';
import { authenticatedFetch } from '@/utils/apiClient';

jest.mock('@/utils/apiClient');
const mockFetch = authenticatedFetch as jest.MockedFunction<typeof authenticatedFetch>;

const renderPage = () => render(<BrowserRouter><RosterPage /></BrowserRouter>);

describe('RosterPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: empty roster
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ participants: [] }),
    } as Response);
  });

  test('renders page title', async () => {
    renderPage();
    expect(screen.getByText('Roster')).toBeInTheDocument();
  });

  test('loads and displays participants', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        participants: [
          { id: 'p1', name: 'Alice', religion: 'Christian', gender: 'Female', partner_id: null },
        ],
      }),
    } as Response);

    renderPage();
    await waitFor(() => {
      expect(screen.getByDisplayValue('Alice')).toBeInTheDocument();
    });
  });

  test('renders table and session selectors', async () => {
    renderPage();
    expect(screen.getByText('Number of Tables')).toBeInTheDocument();
    expect(screen.getByText('Number of Sessions')).toBeInTheDocument();
  });

  test('renders generate button', async () => {
    renderPage();
    expect(screen.getByRole('button', { name: /Generate Assignments/i })).toBeInTheDocument();
  });

  test('shows saving indicator', async () => {
    renderPage();
    // The saving indicator should exist in some form
    await waitFor(() => {
      expect(screen.getByText(/saved|saving/i)).toBeInTheDocument();
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd /Users/markfrankle/Dev/repos/GroupBuilder/frontend && npx craco test --watchAll=false --testPathPattern='RosterPage'`
Expected: Cannot find module

**Step 3: Implement RosterPage**

```tsx
// frontend/src/pages/RosterPage.tsx
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { RosterGrid } from '@/components/RosterGrid/RosterGrid';
import { RosterParticipant } from '@/types/roster';
import {
  getRoster, upsertParticipant, deleteParticipant as apiDeleteParticipant,
  generateFromRoster,
} from '@/api/roster';
import { fetchWithRetry } from '@/utils/fetchWithRetry';
import { API_BASE_URL } from '@/config/api';
import { MAX_TABLES, MAX_SESSIONS } from '@/config/constants';
import { AlertCircle, Loader2 } from 'lucide-react';

type SaveStatus = 'saved' | 'saving' | 'error';

export function RosterPage() {
  const navigate = useNavigate();
  const [participants, setParticipants] = useState<RosterParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [error, setError] = useState<string | null>(null);
  const [numTables, setNumTables] = useState('1');
  const [numSessions, setNumSessions] = useState('1');
  const [generating, setGenerating] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');

  // Load roster on mount
  useEffect(() => {
    getRoster()
      .then(data => setParticipants(data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleUpdate = useCallback(async (id: string, data: Omit<RosterParticipant, 'id'>) => {
    setSaveStatus('saving');
    // Optimistic update
    setParticipants(prev => prev.map(p => p.id === id ? { ...p, ...data } : p));

    // Handle partner auto-linking
    const oldParticipant = participants.find(p => p.id === id);
    const oldPartnerId = oldParticipant?.partner_id;
    const newPartnerId = data.partner_id;

    try {
      await upsertParticipant(id, data);

      // If partner changed, update the old and new partners
      if (oldPartnerId !== newPartnerId) {
        // Clear old partner's link
        if (oldPartnerId) {
          const oldPartner = participants.find(p => p.id === oldPartnerId);
          if (oldPartner && oldPartner.partner_id === id) {
            await upsertParticipant(oldPartnerId, { ...oldPartner, partner_id: null });
            setParticipants(prev => prev.map(p =>
              p.id === oldPartnerId ? { ...p, partner_id: null } : p
            ));
          }
        }
        // Set new partner's link back
        if (newPartnerId) {
          const newPartner = participants.find(p => p.id === newPartnerId);
          if (newPartner) {
            await upsertParticipant(newPartnerId, { ...newPartner, partner_id: id });
            setParticipants(prev => prev.map(p =>
              p.id === newPartnerId ? { ...p, partner_id: id } : p
            ));
          }
        }
      }

      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    }
  }, [participants]);

  const handleDelete = useCallback(async (id: string) => {
    setSaveStatus('saving');
    setParticipants(prev => prev.filter(p => p.id !== id));
    try {
      await apiDeleteParticipant(id);
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    }
  }, []);

  const handleAdd = useCallback(async (data: Omit<RosterParticipant, 'id'>) => {
    const newId = uuidv4();
    const newParticipant: RosterParticipant = { id: newId, ...data };
    setSaveStatus('saving');
    setParticipants(prev => [...prev, newParticipant]);
    try {
      await upsertParticipant(newId, data);
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    }
  }, []);

  const handleGenerate = async () => {
    setError(null);
    setGenerating(true);
    setLoadingMessage('Creating session from roster...');
    try {
      const sessionId = await generateFromRoster(
        parseInt(numTables), parseInt(numSessions)
      );
      setLoadingMessage('Generating assignments...');
      const response = await fetchWithRetry(
        `${API_BASE_URL}/api/assignments/?session_id=${sessionId}&max_time_seconds=120`
      );
      if (!response.ok) throw new Error('Assignment generation failed');
      const assignments = await response.json();
      navigate(`/table-assignments?session=${sessionId}`, {
        state: { assignments, sessionId },
      });
    } catch (err: any) {
      setError(err.message || 'Failed to generate assignments');
      setGenerating(false);
      setLoadingMessage('');
    }
  };

  const canGenerate = participants.length >= parseInt(numTables) && participants.length > 0;

  if (loading) {
    return (
      <div className="container mx-auto p-4 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Roster</CardTitle>
              <CardDescription>Manage your participants</CardDescription>
            </div>
            <span className="text-sm text-muted-foreground">
              {saveStatus === 'saving' && 'Saving...'}
              {saveStatus === 'saved' && 'Saved'}
              {saveStatus === 'error' && 'Save failed'}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <RosterGrid
            participants={participants}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            onAdd={handleAdd}
          />

          <div className="flex space-x-4">
            <div className="flex-1">
              <Label htmlFor="num-tables">Number of Tables</Label>
              <Select value={numTables} onValueChange={setNumTables}>
                <SelectTrigger id="num-tables">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: MAX_TABLES }, (_, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label htmlFor="num-sessions">Number of Sessions</Label>
              <Select value={numSessions} onValueChange={setNumSessions}>
                <SelectTrigger id="num-sessions">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: MAX_SESSIONS }, (_, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {generating && loadingMessage && (
            <Alert>
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertTitle>Generating</AlertTitle>
              <AlertDescription>{loadingMessage}</AlertDescription>
            </Alert>
          )}

          <Button
            className="w-full"
            onClick={handleGenerate}
            disabled={!canGenerate || generating}
          >
            {generating ? 'Generating...' : 'Generate Assignments'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 4: Check if `MAX_TABLES` and `MAX_SESSIONS` constants exist**

Look in `frontend/src/config/constants.ts` or similar. If they don't exist, check `LandingPage.tsx` for where they're defined (they may be inline as `10` and `6`). If inline, create:

```typescript
// frontend/src/config/constants.ts
export const MAX_TABLES = 10;
export const MAX_SESSIONS = 6;
```

Also check if `uuid` is a dependency. If not:

Run: `cd /Users/markfrankle/Dev/repos/GroupBuilder/frontend && npm install uuid && npm install -D @types/uuid`

**Step 5: Add route to App.tsx**

Add the import and route to `frontend/src/App.tsx`. Add after the existing `/` route:

```tsx
import { RosterPage } from './pages/RosterPage';

// Inside Routes, add:
<Route path="/roster" element={<ProtectedRoute><RosterPage /></ProtectedRoute>} />
```

**Step 6: Run tests to verify they pass**

Run: `cd /Users/markfrankle/Dev/repos/GroupBuilder/frontend && npx craco test --watchAll=false --testPathPattern='RosterPage'`
Expected: All PASS

**Step 7: Commit**

```bash
git add frontend/src/pages/RosterPage.tsx frontend/src/pages/__tests__/RosterPage.test.tsx frontend/src/App.tsx frontend/src/config/constants.ts
git commit -m "feat: add RosterPage with grid, config, and generate"
```

---

## Task 8: Simplify Landing Page

**Files:**
- Modify: `frontend/src/pages/LandingPage.tsx`
- Modify: `frontend/src/pages/__tests__/LandingPage.test.tsx`

The landing page becomes a hub with two cards: "Manage Roster" and "Import from Excel".

**Step 1: Write/update tests for the new landing page**

```typescript
// Replace or add to frontend/src/pages/__tests__/LandingPage.test.tsx
// Add these tests (keep existing tests that still apply):

describe('Landing Page - Hub', () => {
  test('renders Manage Roster card', () => {
    renderWithRouter(<LandingPage />);
    expect(screen.getByText('Manage Roster')).toBeInTheDocument();
  });

  test('renders Import from Excel card', () => {
    renderWithRouter(<LandingPage />);
    expect(screen.getByText('Import from Excel')).toBeInTheDocument();
  });

  test('Manage Roster links to /roster', () => {
    renderWithRouter(<LandingPage />);
    const link = screen.getByText('Manage Roster').closest('a');
    expect(link).toHaveAttribute('href', '/roster');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd /Users/markfrankle/Dev/repos/GroupBuilder/frontend && npx craco test --watchAll=false --testPathPattern='LandingPage'`
Expected: FAIL — "Manage Roster" not found

**Step 3: Rewrite LandingPage**

Replace the contents of `LandingPage.tsx` with a simplified hub. Keep the existing imports for recent uploads and file handling but restructure the JSX. The key changes:

- Remove the "How it works" section
- Remove the inline file upload form, table/session selects, and generate button
- Add two Card components side by side: "Manage Roster" (links to `/roster`) and "Import from Excel" (file picker that calls the import API then redirects to `/roster`)
- Keep the "Download Template" link
- Keep the Recent Uploads section for accessing past results

The full implementation should:
1. Keep `useNavigate`, `useState` for file/error/loading
2. The "Manage Roster" card is a simple `<Link to="/roster">` wrapped card
3. The "Import from Excel" card has a file input. On file selection, call `importRoster(file)` from `@/api/roster`, then `navigate('/roster')`
4. Keep the recent uploads section (with the existing Select + view results flow)

**Step 4: Run tests to verify they pass**

Run: `cd /Users/markfrankle/Dev/repos/GroupBuilder/frontend && npx craco test --watchAll=false --testPathPattern='LandingPage'`
Expected: New tests PASS. Some old tests may need updating/removing since the upload form is gone from this page.

**Step 5: Run all frontend tests**

Run: `cd /Users/markfrankle/Dev/repos/GroupBuilder/frontend && npx craco test --watchAll=false`
Expected: All PASS (update any broken tests from the landing page refactor)

**Step 6: Commit**

```bash
git add frontend/src/pages/LandingPage.tsx frontend/src/pages/__tests__/LandingPage.test.tsx
git commit -m "refactor: simplify LandingPage to hub with roster and import cards"
```

---

## Task 9: Navigation Link

**Files:**
- Modify: `frontend/src/App.tsx` (or wherever the nav/header is rendered)

**Step 1: Add a "Roster" link to the app header/navigation**

Look at how the current app renders its header. In `LandingPage.tsx` the header is inside the Card. There may not be a persistent nav bar. If there isn't one, add a minimal one to `App.tsx` inside the Router (but outside Routes) that shows "Roster" and "Home" links when the user is authenticated.

Check `App.tsx` for any existing nav component. If none exists, add a simple one:

```tsx
// Inside App.tsx, within Router but above Routes:
function NavBar() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <nav className="border-b px-4 py-2 flex gap-4 text-sm">
      <Link to="/" className="text-muted-foreground hover:text-foreground">Home</Link>
      <Link to="/roster" className="text-muted-foreground hover:text-foreground">Roster</Link>
    </nav>
  );
}
```

**Step 2: Verify manually that navigation works**

Run: `cd /Users/markfrankle/Dev/repos/GroupBuilder/frontend && npm start`
Check: clicking "Roster" nav link goes to `/roster`, clicking "Home" goes to `/`

**Step 3: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: add persistent navigation bar with Roster link"
```

---

## Task 10: Integration Test — Full Flow

**Files:**
- Modify: `api/tests/test_roster.py`

**Step 1: Write an integration test for the full roster → generate flow**

```python
# Add to api/tests/test_roster.py
class TestFullFlow:
    def test_create_roster_and_generate(self, client):
        """Create participants via API, then generate assignments."""
        # Add 6 participants (enough for 2 tables)
        for i in range(6):
            response = client.put(f"/api/roster/p{i}", json={
                "name": f"Person{i}",
                "religion": ["Christian", "Jewish", "Muslim"][i % 3],
                "gender": ["Male", "Female"][i % 2],
                "partner_id": None,
            })
            assert response.status_code == 200

        # Verify roster
        roster = client.get("/api/roster/")
        assert len(roster.json()["participants"]) == 6

        # Generate
        response = client.post("/api/roster/generate", json={
            "num_tables": 2, "num_sessions": 2,
        })
        assert response.status_code == 200
        assert "session_id" in response.json()
```

**Step 2: Run the test**

Run: `cd /Users/markfrankle/Dev/repos/GroupBuilder/api && python -m pytest tests/test_roster.py::TestFullFlow -v`
Expected: PASS

**Step 3: Run full test suite (backend + frontend)**

Run: `cd /Users/markfrankle/Dev/repos/GroupBuilder/api && python -m pytest -v`
Run: `cd /Users/markfrankle/Dev/repos/GroupBuilder/frontend && npx craco test --watchAll=false`
Expected: All PASS

**Step 4: Commit**

```bash
git add api/tests/test_roster.py
git commit -m "test: add full-flow integration test for roster"
```

---

## Task 11: Firestore Security Rules

**Files:**
- Modify: `firestore.rules`

**Step 1: Add rules for the roster subcollection**

Check the existing `firestore.rules` for the pattern used by other subcollections under `organizations/{orgId}` (like `sessions`, `members`). Add a matching rule for `roster`:

```
match /organizations/{orgId}/roster/{participantId} {
  allow read, write: if request.auth != null
    && exists(/databases/$(database)/documents/organizations/$(orgId)/members/$(request.auth.uid));
}
```

This allows roster read/write only for authenticated users who are members of the org — same pattern as sessions.

**Step 2: Commit**

```bash
git add firestore.rules
git commit -m "feat: add Firestore security rules for roster collection"
```

---

## Summary of Tasks

| # | Task | Backend/Frontend | New Files |
|---|------|-----------------|-----------|
| 1 | RosterService (Firestore CRUD) | Backend | `roster_service.py`, test |
| 2 | Roster API Router (HTTP endpoints) | Backend | `roster.py` router, test |
| 3 | Excel Import Endpoint | Backend | (modify router + test) |
| 4 | Generate from Roster Endpoint | Backend | (modify router + test) |
| 5 | Frontend Types + API Client | Frontend | `types/roster.ts`, `api/roster.ts`, test |
| 6 | RosterGrid Component | Frontend | `RosterGrid.tsx`, test |
| 7 | RosterPage (full page) | Frontend | `RosterPage.tsx`, test |
| 8 | Simplify Landing Page | Frontend | (modify existing) |
| 9 | Navigation Link | Frontend | (modify App.tsx) |
| 10 | Integration Test | Backend | (modify test) |
| 11 | Firestore Security Rules | Infra | (modify rules) |
