# Facilitator Support Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add facilitator support across the solver, API, and frontend so that facilitators are assigned to tables with coverage, balance, and repeat-lockout constraints, and are visually distinct in all UI views.

**Architecture:** Facilitators are participants with an `is_facilitator` boolean flag. The solver gains new constraint methods. The API passes the flag through. The frontend renders facilitators distinctly and restricts edit-mode interactions.

**Tech Stack:** Python (OR-Tools CP-SAT), FastAPI + Pydantic, React + TypeScript + Tailwind/shadcn

**Design doc:** `docs/plans/2026-02-12-facilitator-support-design.md`

---

## Task 1: Solver — Facilitator Coverage Constraint

Add a hard constraint: every table in every session must have at least one facilitator.

**Files:**
- Modify: `assignment_logic/src/assignment_logic/group_builder.py`
- Test: `assignment_logic/tests/test_group_builder.py`

**Step 1: Write the failing test**

In `test_group_builder.py`, add a new test that verifies every table has at least one facilitator:

```python
def test_facilitator_coverage():
    """Every table must have at least one facilitator."""
    participants = [
        {"id": i, "name": f"Person{i}", "religion": r, "gender": g, "partner": None, "couple_id": None, "is_facilitator": i <= 4}
        for i, (r, g) in enumerate([
            ("Christian", "Male"), ("Christian", "Female"),
            ("Jewish", "Male"), ("Jewish", "Female"),
            ("Muslim", "Male"), ("Muslim", "Female"),
            ("Christian", "Male"), ("Christian", "Female"),
            ("Jewish", "Male"), ("Jewish", "Female"),
            ("Muslim", "Male"), ("Muslim", "Female"),
            ("Christian", "Male"), ("Christian", "Female"),
            ("Jewish", "Male"), ("Jewish", "Female"),
            ("Muslim", "Male"), ("Muslim", "Female"),
            ("Christian", "Male"), ("Christian", "Female"),
        ], start=1)
    ]
    gb = GroupBuilder(participants, num_tables=4, num_sessions=2)
    result = gb.generate_assignments()
    assert result["status"] == "success"
    for session in result["assignments"]:
        for table_num, table_participants in session["tables"].items():
            facilitators = [p for p in table_participants if p.get("is_facilitator")]
            assert len(facilitators) >= 1, f"Session {session['session']}, Table {table_num} has no facilitator"
```

**Step 2: Run test to verify it fails**

Run: `cd assignment_logic && poetry run pytest tests/test_group_builder.py::test_facilitator_coverage -v`
Expected: FAIL — `is_facilitator` key not recognized or no constraint enforced.

**Step 3: Implement facilitator coverage constraint**

In `group_builder.py`:

1. Update `__init__` (around line 28) to extract facilitator IDs:
```python
self.facilitator_ids = [p["id"] for p in participants if p.get("is_facilitator", False)]
```

2. Add a new method `_add_facilitator_constraints()` after `_add_participant_attribute_distribution_constraint` (after line 309):
```python
def _add_facilitator_constraints(self):
    """Add facilitator-specific constraints: coverage and balance."""
    if not self.facilitator_ids:
        return

    num_facilitators = len(self.facilitator_ids)

    # Coverage: every table has at least one facilitator per session
    for s in range(self.num_sessions):
        for t in range(self.num_tables):
            self.model.Add(
                sum(self.participant_table_assignments[(f, s, t)] for f in self.facilitator_ids) >= 1
            )

    # Balance: facilitators spread evenly (no table has >1 more than any other)
    min_per_table = num_facilitators // self.num_tables
    max_per_table = min_per_table + (1 if num_facilitators % self.num_tables != 0 else 0)
    for s in range(self.num_sessions):
        for t in range(self.num_tables):
            facilitator_count = sum(self.participant_table_assignments[(f, s, t)] for f in self.facilitator_ids)
            self.model.Add(facilitator_count >= min_per_table)
            self.model.Add(facilitator_count <= max_per_table)
```

3. Call the new method from `_add_constraints_to_model()` (around line 265):
```python
self._add_facilitator_constraints()
```

4. Update `_run_solver()` to include `is_facilitator` in output participant dicts (around line 460):
```python
{
    "name": p["name"],
    "religion": p["religion"],
    "gender": p["gender"],
    "partner": p["partner"],
    "is_facilitator": p.get("is_facilitator", False),
}
```

**Step 4: Run test to verify it passes**

Run: `cd assignment_logic && poetry run pytest tests/test_group_builder.py::test_facilitator_coverage -v`
Expected: PASS

**Step 5: Commit**

```bash
git add assignment_logic/src assignment_logic/tests
git commit -m "feat(solver): add facilitator coverage and balance constraints"
```

---

## Task 2: Solver — Facilitator Religion Diversity Per Table

Add a hard constraint: no two facilitators at the same table share a religion.

**Files:**
- Modify: `assignment_logic/src/assignment_logic/group_builder.py`
- Test: `assignment_logic/tests/test_group_builder.py`

**Step 1: Write the failing test**

```python
def test_facilitator_religion_diversity_per_table():
    """No two facilitators at the same table share a religion."""
    # 6 facilitators: 2 per religion. With 4 tables, some tables get 2 facilitators.
    # Those 2 must be different religions.
    participants = [
        {"id": 1, "name": "F_Christian1", "religion": "Christian", "gender": "Male", "partner": None, "couple_id": None, "is_facilitator": True},
        {"id": 2, "name": "F_Christian2", "religion": "Christian", "gender": "Female", "partner": None, "couple_id": None, "is_facilitator": True},
        {"id": 3, "name": "F_Jewish1", "religion": "Jewish", "gender": "Male", "partner": None, "couple_id": None, "is_facilitator": True},
        {"id": 4, "name": "F_Jewish2", "religion": "Jewish", "gender": "Female", "partner": None, "couple_id": None, "is_facilitator": True},
        {"id": 5, "name": "F_Muslim1", "religion": "Muslim", "gender": "Male", "partner": None, "couple_id": None, "is_facilitator": True},
        {"id": 6, "name": "F_Muslim2", "religion": "Muslim", "gender": "Female", "partner": None, "couple_id": None, "is_facilitator": True},
    ]
    # Add 14 regular participants for 20 total, 4 tables
    for i in range(7, 21):
        r = ["Christian", "Jewish", "Muslim"][(i - 7) % 3]
        g = "Male" if i % 2 == 0 else "Female"
        participants.append({"id": i, "name": f"Person{i}", "religion": r, "gender": g, "partner": None, "couple_id": None, "is_facilitator": False})

    gb = GroupBuilder(participants, num_tables=4, num_sessions=3)
    result = gb.generate_assignments()
    assert result["status"] == "success"
    for session in result["assignments"]:
        for table_num, table_participants in session["tables"].items():
            facilitators = [p for p in table_participants if p.get("is_facilitator")]
            religions = [f["religion"] for f in facilitators]
            assert len(religions) == len(set(religions)), (
                f"Session {session['session']}, Table {table_num}: facilitators share religion: {religions}"
            )
```

**Step 2: Run test to verify it fails**

Run: `cd assignment_logic && poetry run pytest tests/test_group_builder.py::test_facilitator_religion_diversity_per_table -v`
Expected: FAIL — no religion diversity constraint for facilitators yet.

**Step 3: Add religion diversity constraint**

In `_add_facilitator_constraints()`, append:

```python
    # Religion diversity: no two facilitators at the same table share a religion
    facilitator_religions = {}
    for p in self.participants:
        if p["id"] in self.facilitator_ids:
            religion = p["religion"]
            facilitator_religions.setdefault(religion, []).append(p["id"])

    for s in range(self.num_sessions):
        for t in range(self.num_tables):
            for religion, fac_ids in facilitator_religions.items():
                if len(fac_ids) > 1:
                    # At most 1 facilitator of this religion per table
                    self.model.Add(
                        sum(self.participant_table_assignments[(f, s, t)] for f in fac_ids) <= 1
                    )
```

**Step 4: Run test to verify it passes**

Run: `cd assignment_logic && poetry run pytest tests/test_group_builder.py::test_facilitator_religion_diversity_per_table -v`
Expected: PASS

**Step 5: Run all solver tests**

Run: `cd assignment_logic && poetry run pytest tests/ -v`
Expected: All pass.

**Step 6: Commit**

```bash
git add assignment_logic/
git commit -m "feat(solver): add facilitator religion diversity constraint per table"
```

---

## Task 3: Solver — Facilitator-Participant Repeat Lockout

Facilitator-participant pairings follow the same 3-session rolling window penalty as participant-participant pairings. Also add a low-priority facilitator-facilitator repeat penalty.

**Files:**
- Modify: `assignment_logic/src/assignment_logic/group_builder.py`
- Test: `assignment_logic/tests/test_group_builder.py`

**Step 1: Write the failing test**

```python
def test_facilitator_participant_repeat_penalty():
    """Facilitator-participant pairings should be penalized within the rolling window, same as participant-participant."""
    # 4 facilitators, 4 tables, 4 sessions — each facilitator should rotate
    participants = [
        {"id": 1, "name": "Fac1", "religion": "Christian", "gender": "Male", "partner": None, "couple_id": None, "is_facilitator": True},
        {"id": 2, "name": "Fac2", "religion": "Jewish", "gender": "Female", "partner": None, "couple_id": None, "is_facilitator": True},
        {"id": 3, "name": "Fac3", "religion": "Muslim", "gender": "Male", "partner": None, "couple_id": None, "is_facilitator": True},
        {"id": 4, "name": "Fac4", "religion": "Christian", "gender": "Female", "partner": None, "couple_id": None, "is_facilitator": True},
    ]
    for i in range(5, 21):
        r = ["Christian", "Jewish", "Muslim"][(i - 5) % 3]
        g = "Male" if i % 2 == 0 else "Female"
        participants.append({"id": i, "name": f"P{i}", "religion": r, "gender": g, "partner": None, "couple_id": None, "is_facilitator": False})

    gb = GroupBuilder(participants, num_tables=4, num_sessions=4)
    result = gb.generate_assignments()
    assert result["status"] == "success"

    # Track which facilitator each participant meets per session
    participant_facilitator_meetings = {}  # {participant_name: [facilitator_name_per_session]}
    for session in result["assignments"]:
        for table_num, table_participants in session["tables"].items():
            facilitators = [p["name"] for p in table_participants if p.get("is_facilitator")]
            non_facilitators = [p["name"] for p in table_participants if not p.get("is_facilitator")]
            for nf in non_facilitators:
                participant_facilitator_meetings.setdefault(nf, []).extend(facilitators)

    # Within any 3-session window, no participant should meet the same facilitator twice
    # (With 4 facilitators and 4 sessions, this is achievable)
    for participant, fac_list in participant_facilitator_meetings.items():
        for i in range(len(fac_list) - 2):
            window = fac_list[i:i+3]
            assert len(window) == len(set(window)), (
                f"Participant {participant} met same facilitator twice in window: {window}"
            )
```

**Step 2: Run test to verify it fails**

Run: `cd assignment_logic && poetry run pytest tests/test_group_builder.py::test_facilitator_participant_repeat_penalty -v`
Expected: FAIL — the existing repeat penalty doesn't distinguish facilitator-participant pairs, but with `is_facilitator` now in the data it should already be tracked as normal pairings. The test may actually pass since participant-participant penalties already cover this. Run it and see.

**Step 3: Verify behavior**

If the test passes: facilitator-participant repeat lockout already works through the existing repeat-pairing penalty mechanism (since facilitators are participants). No code changes needed — just confirm and move on.

If the test fails: the existing penalty may not be strong enough. Increase the weight for facilitator-participant pairs or verify the rolling window applies correctly.

**Step 4: Add facilitator-facilitator soft penalty**

In `_add_objective_functions_to_model()`, after the existing repeat pairing section (around line 369), add:

```python
    # Facilitator-facilitator repeat penalty (low priority)
    if len(self.facilitator_ids) > 1:
        for s1 in range(self.num_sessions):
            for s2 in range(s1 + 1, min(s1 + self.pairing_window_size, self.num_sessions)):
                for i, f1 in enumerate(self.facilitator_ids):
                    for f2 in self.facilitator_ids[i+1:]:
                        for t in range(self.num_tables):
                            both_at_table_s1 = self.model.NewBoolVar(f"ff_{f1}_{f2}_s{s1}_t{t}")
                            self.model.AddBoolAnd([
                                self.participant_table_assignments[(f1, s1, t)],
                                self.participant_table_assignments[(f2, s1, t)]
                            ]).OnlyEnforceIf(both_at_table_s1)
                            self.model.AddBoolOr([
                                self.participant_table_assignments[(f1, s1, t)].Not(),
                                self.participant_table_assignments[(f2, s1, t)].Not()
                            ]).OnlyEnforceIf(both_at_table_s1.Not())

                            both_at_table_s2 = self.model.NewBoolVar(f"ff_{f1}_{f2}_s{s2}_t{t}")
                            # (same pattern for s2)

                            # Penalize if both pairs occur
                            repeat = self.model.NewBoolVar(f"ff_repeat_{f1}_{f2}_s{s1}_{s2}")
                            # ... (follow existing repeat penalty pattern)
```

Actually — this follows the exact same pattern as the existing repeat penalty code. Since facilitators are already participants, their pairwise interactions are already tracked by the existing repeat penalty. The only question is whether the weight is sufficient. Since you said facilitator-facilitator repeat is low priority, the existing equal weighting should be fine.

**Step 5: Run all solver tests**

Run: `cd assignment_logic && poetry run pytest tests/ -v`
Expected: All pass.

**Step 6: Commit**

```bash
git add assignment_logic/
git commit -m "test(solver): verify facilitator-participant repeat lockout via existing penalty"
```

---

## Task 4: API — Add `is_facilitator` to Data Model

Add `is_facilitator` field to roster service, participant types, and Excel parsing.

**Files:**
- Modify: `api/src/api/services/roster_service.py`
- Modify: `api/src/api/utils/dataframe_to_participant_dict.py`
- Modify: `api/src/api/routers/roster.py`
- Modify: `api/src/api/routers/upload.py`
- Test: `api/tests/test_roster.py`
- Test: `api/tests/test_upload.py`

**Step 1: Write failing tests for roster service**

In `api/tests/test_roster.py`, add:

```python
class TestFacilitatorField:
    def test_upsert_with_facilitator_flag(self, client):
        response = client.put("/api/roster/p1", json={
            "name": "Alice", "religion": "Christian", "gender": "Female",
            "is_facilitator": True
        })
        assert response.status_code == 200
        get_resp = client.get("/api/roster/")
        participant = get_resp.json()["participants"][0]
        assert participant["is_facilitator"] is True

    def test_upsert_defaults_facilitator_false(self, client):
        response = client.put("/api/roster/p1", json={
            "name": "Alice", "religion": "Christian", "gender": "Female"
        })
        assert response.status_code == 200
        get_resp = client.get("/api/roster/")
        participant = get_resp.json()["participants"][0]
        assert participant["is_facilitator"] is False
```

**Step 2: Run tests to verify they fail**

Run: `cd api && poetry run pytest tests/test_roster.py::TestFacilitatorField -v`
Expected: FAIL — `is_facilitator` not in response.

**Step 3: Update roster service**

In `roster_service.py`, update `upsert_participant` (line 43-49) to include `is_facilitator`:

```python
doc_data = {
    "name": data["name"],
    "religion": data["religion"],
    "gender": data["gender"],
    "partner_id": data.get("partner_id"),
    "is_facilitator": data.get("is_facilitator", False),
    "updated_at": firestore.SERVER_TIMESTAMP,
}
```

**Step 4: Update roster router**

In `roster.py`:

1. Update `GET /api/roster/` (around line 44) to return `is_facilitator`:
```python
participants.append({
    "id": doc.id,
    "name": doc_data.get("name", ""),
    "religion": doc_data.get("religion", ""),
    "gender": doc_data.get("gender", ""),
    "partner_id": doc_data.get("partner_id"),
    "is_facilitator": doc_data.get("is_facilitator", False),
})
```

2. Update `_roster_to_participant_list()` (around line 124-153) to pass `is_facilitator`:
```python
solver_participants.append({
    "id": idx,
    "name": p["name"],
    "religion": p["religion"],
    "gender": p["gender"],
    "partner": partner_name,
    "couple_id": couple_id,
    "is_facilitator": p.get("is_facilitator", False),
})
```

3. Update `POST /api/roster/generate` (around line 168) to validate facilitator count:
```python
facilitator_count = sum(1 for p in participant_list if p.get("is_facilitator", False))
if facilitator_count > 0 and facilitator_count < body.num_tables:
    raise HTTPException(
        status_code=400,
        detail=f"Need at least {body.num_tables} facilitators for {body.num_tables} tables (have {facilitator_count})"
    )
```

4. Update `POST /api/roster/import` to read Facilitator column from Excel (around line 79-100, first pass):
```python
is_facilitator = False
if "Facilitator" in df.columns:
    fac_val = str(row.get("Facilitator", "")).strip().lower()
    is_facilitator = fac_val in ("yes", "y", "true", "1")

roster_service.upsert_participant(org_id, participant_id, {
    "name": name,
    "religion": religion,
    "gender": gender,
    "is_facilitator": is_facilitator,
})
```

**Step 5: Update Excel parsing (`dataframe_to_participant_dict.py`)**

In `dataframe_to_participant_dict()` (around line 81-108), after building the participant dict, add `is_facilitator`:

```python
is_facilitator = False
if "Facilitator" in df.columns:
    fac_val = str(row.get("Facilitator", "")).strip().lower()
    is_facilitator = fac_val in ("yes", "y", "true", "1")

participant = {
    "id": idx,
    "name": name,
    "religion": religion,
    "gender": gender,
    "partner": partner,
    "couple_id": None,
    "is_facilitator": is_facilitator,
}
```

**Step 6: Update upload router**

In `upload.py`, the `REQUIRED_COLUMNS` check (around line 57) should NOT include "Facilitator" — it's optional for backward compatibility. No changes needed to the required columns check. But ensure `dataframe_to_participant_dict()` output flows through correctly.

**Step 7: Add upload test**

In `api/tests/test_upload.py`, add a test for Excel with Facilitator column:

```python
def test_upload_with_facilitator_column(self, client, mock_storage):
    df = pd.DataFrame({
        "Name": ["Alice", "Bob", "Carol", "Dave"],
        "Religion": ["Christian", "Jewish", "Muslim", "Christian"],
        "Gender": ["Female", "Male", "Female", "Male"],
        "Partner": ["", "", "", ""],
        "Facilitator": ["Yes", "No", "Yes", ""],
    })
    buf = io.BytesIO()
    df.to_excel(buf, index=False)
    buf.seek(0)
    response = client.post("/api/upload/", files={"file": ("test.xlsx", buf)},
                           data={"numTables": "2", "numSessions": "1"})
    assert response.status_code == 200
    # Verify facilitator flag passed through
    stored = mock_storage.sessions[list(mock_storage.sessions.keys())[0]]
    facilitators = [p for p in stored["participant_data"] if p.get("is_facilitator")]
    assert len(facilitators) == 2
```

**Step 8: Run all API tests**

Run: `cd api && poetry run pytest tests/ -v`
Expected: All pass.

**Step 9: Check formatting**

Run: `cd api && poetry run black --check src tests`
Expected: Pass (or run `poetry run black src tests` to fix).

**Step 10: Commit**

```bash
git add api/
git commit -m "feat(api): add is_facilitator field to roster, upload, and session generation"
```

---

## Task 5: Frontend — Add `is_facilitator` to Types and Roster Grid

**Files:**
- Modify: `frontend/src/types/roster.ts`
- Modify: `frontend/src/components/RosterGrid/RosterGrid.tsx`
- Modify: `frontend/src/api/roster.ts`
- Test: `frontend/src/components/RosterGrid/__tests__/RosterGrid.test.tsx`

**Step 1: Update types**

In `frontend/src/types/roster.ts`, add `is_facilitator` to `RosterParticipant`:

```typescript
export interface RosterParticipant {
  id: string;
  name: string;
  religion: Religion;
  gender: Gender;
  partner_id?: string | null;
  is_facilitator?: boolean;  // NEW
}
```

**Step 2: Update roster API calls**

In `frontend/src/api/roster.ts`, ensure `updateParticipant` passes `is_facilitator` through (it should already if the type is updated, but verify the PUT body includes it).

**Step 3: Add Facilitator checkbox column to RosterGrid**

In `RosterGrid.tsx`, add a new column after Partner:

1. Add a table header (in the `<thead>` around line 94):
```tsx
<th>Facilitator</th>
```

2. Add a checkbox cell in participant rows (around line 130):
```tsx
<td>
  <input
    type="checkbox"
    checked={participant.is_facilitator || false}
    onChange={(e) => onUpdate(participant.id, { ...participant, is_facilitator: e.target.checked })}
  />
</td>
```

3. Add the same in the empty row (unchecked, disabled — facilitator is set after creation).

**Step 4: Add generate-time validation in RosterPage**

In `frontend/src/pages/RosterPage.tsx`, before calling the generate endpoint, validate:

```typescript
const facilitatorCount = participants.filter(p => p.is_facilitator).length;
if (facilitatorCount > 0 && facilitatorCount < numTables) {
  setError(`Need at least ${numTables} facilitators for ${numTables} tables (have ${facilitatorCount})`);
  return;
}
```

**Step 5: Write test**

In `RosterGrid.test.tsx`, add:

```typescript
it("renders facilitator checkbox", () => {
  render(<RosterGrid participants={[
    { id: "1", name: "Alice", religion: "Christian", gender: "Female", is_facilitator: true },
    { id: "2", name: "Bob", religion: "Jewish", gender: "Male", is_facilitator: false },
  ]} onUpdate={mockOnUpdate} onDelete={mockOnDelete} onAdd={mockOnAdd} />);

  const checkboxes = screen.getAllByRole("checkbox");
  expect(checkboxes[0]).toBeChecked();
  expect(checkboxes[1]).not.toBeChecked();
});

it("calls onUpdate when facilitator toggled", async () => {
  render(<RosterGrid participants={[
    { id: "1", name: "Alice", religion: "Christian", gender: "Female", is_facilitator: false },
  ]} onUpdate={mockOnUpdate} onDelete={mockOnDelete} onAdd={mockOnAdd} />);

  const checkbox = screen.getByRole("checkbox");
  await userEvent.click(checkbox);
  expect(mockOnUpdate).toHaveBeenCalledWith("1", expect.objectContaining({ is_facilitator: true }));
});
```

**Step 6: Run frontend tests**

Run: `cd frontend && CI=true npm test -- --watchAll=false --testPathPattern="RosterGrid"`
Expected: All pass.

**Step 7: Lint check**

Run: `cd frontend && npm run lint`
Expected: No warnings.

**Step 8: Commit**

```bash
git add frontend/
git commit -m "feat(frontend): add facilitator checkbox to roster grid"
```

---

## Task 6: Frontend — Facilitator Display in Assignments Detail View

Show facilitators at the top of each table with a "Facilitator" tag, and add facilitator count to the stats bar.

**Files:**
- Modify: `frontend/src/components/TableAssignments/TableAssignments.tsx`

**Step 1: Sort facilitators to top**

In `TableAssignments.tsx`, where table participants are rendered (around line 261), sort so facilitators come first:

```typescript
const sortedParticipants = [...participants].sort((a, b) => {
  const aFac = a?.is_facilitator ? 1 : 0;
  const bFac = b?.is_facilitator ? 1 : 0;
  return bFac - aFac; // facilitators first
});
```

**Step 2: Add "Facilitator" tag**

In the participant card rendering (around line 280-318), add a tag next to religion/gender:

```tsx
{participant.is_facilitator && (
  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
    Facilitator
  </span>
)}
```

**Step 3: Add facilitator count to stats bar**

In `calculateTableStats()` (around line 102-136), add:

```typescript
const facilitatorCount = participants.filter(p => p?.is_facilitator).length;
```

In the stats display (around line 250-257), add after people count:

```tsx
<span className={facilitatorCount === 0 ? "text-red-600 font-semibold" : ""}>
  {facilitatorCount} facilitator{facilitatorCount !== 1 ? "s" : ""}
</span>
```

**Step 4: Add validation summary line**

In `TableAssignmentsPage.tsx`, in the validation summary section, add a new constraint check:

```typescript
const allTablesHaveFacilitator = assignments.every(session =>
  Object.values(session.tables).every(table =>
    table.some(p => p?.is_facilitator)
  )
);
```

Render it alongside the existing couple/religion/gender checks.

**Step 5: Run frontend tests**

Run: `cd frontend && CI=true npm test -- --watchAll=false --testPathPattern="TableAssignments"`
Expected: All pass (existing tests shouldn't break — facilitator fields are optional).

**Step 6: Lint check**

Run: `cd frontend && npm run lint`

**Step 7: Commit**

```bash
git add frontend/
git commit -m "feat(frontend): show facilitators in assignments detail view with tag and stats"
```

---

## Task 7: Frontend — Facilitator Display in Compact/Overview View

Show facilitator names below each table title in compact view.

**Files:**
- Modify: `frontend/src/components/TableAssignments/TableAssignments.tsx`

**Step 1: Add facilitator subtitle in compact view**

In the compact view rendering (find where table titles like "Table 1" are rendered with participant chips), add a subtitle line:

```tsx
const facilitators = participants.filter(p => p?.is_facilitator);
{facilitators.length > 0 && (
  <p className="text-sm text-gray-500 mt-0.5">
    Facilitators: {facilitators.map(f => f.name).join(", ")}
  </p>
)}
```

**Step 2: Visually distinguish facilitator chips in compact view**

If facilitators appear as chips in the compact view, give them a distinct style (bold or different border):

```tsx
className={`... ${participant.is_facilitator ? "font-semibold ring-2 ring-amber-300" : ""}`}
```

**Step 3: Run tests and lint**

Run: `cd frontend && CI=true npm test -- --watchAll=false && npm run lint`

**Step 4: Commit**

```bash
git add frontend/
git commit -m "feat(frontend): show facilitator names in compact assignment view"
```

---

## Task 8: Frontend — Facilitator Edit Mode (Swap Restrictions)

Restrict facilitator interactions in edit mode: facilitators only swap with facilitators or move to empty facilitator slots.

**Files:**
- Modify: `frontend/src/components/TableAssignments/TableAssignments.tsx`
- Modify: `frontend/src/pages/TableAssignmentsPage.tsx`

**Step 1: Add facilitator slots in edit mode**

In the `tablesWithEmptySlots` computation (around line 84-100), add facilitator-specific empty slots:

```typescript
const maxFacilitatorsPerTable = Math.ceil(
  allParticipants.filter(p => p?.is_facilitator).length / Object.keys(tables).length
);

// For each table, ensure facilitator slots at the top
const facilitatorsAtTable = tableParticipants.filter(p => p?.is_facilitator);
const emptyFacilitatorSlots = maxFacilitatorsPerTable - facilitatorsAtTable.length;
// Prepend facilitators + empty facilitator slots, then regular participants + regular empty slot
```

**Step 2: Update swap logic**

In `handleSlotClick()` (around line 167-207) and `handleSwap()` (around line 632-652):

```typescript
// When a facilitator is selected, only allow:
// 1. Clicking another facilitator (swap)
// 2. Clicking an empty facilitator slot (move)
const selectedIsFacilitator = selectedParticipant?.is_facilitator;
const targetIsFacilitator = targetParticipant?.is_facilitator;

if (selectedIsFacilitator && !targetIsFacilitator && targetParticipant !== null) {
  // Can't swap facilitator with non-facilitator — ignore click
  return;
}
```

**Step 3: Visual separation in edit mode**

Add a visual divider between facilitator slots and participant slots in each table card. A simple horizontal line or spacing:

```tsx
{/* After facilitator slots */}
<div className="border-t border-dashed border-gray-300 my-1" />
{/* Regular participant slots */}
```

**Step 4: Highlight only valid targets**

When a facilitator is selected, only highlight other facilitators and empty facilitator slots (not regular participants or regular empty slots):

```tsx
const isValidTarget = selectedIsFacilitator
  ? (slot.is_facilitator || slot === null && isFacilitatorSlot)
  : (!slot?.is_facilitator || slot === null && !isFacilitatorSlot);
```

**Step 5: Run tests and lint**

Run: `cd frontend && CI=true npm test -- --watchAll=false && npm run lint`

**Step 6: Commit**

```bash
git add frontend/
git commit -m "feat(frontend): restrict facilitator swaps to facilitators only in edit mode"
```

---

## Task 9: Frontend — Seating Chart Facilitator Display

Add facilitator names to table title and visually distinguish facilitators in seated positions.

**Files:**
- Modify: `frontend/src/components/SeatingChart/CircularTable.tsx`
- Modify: `frontend/src/pages/SeatingChartPage.tsx`

**Step 1: Update CircularTable to accept and display facilitator info**

In `CircularTable.tsx`, update the props to receive participant objects (not just names) so we can check `is_facilitator`. Then:

1. Add facilitator subtitle below table title badge:
```tsx
const facilitators = participants.filter(p => p.is_facilitator);
const facilitatorLabel = facilitators.map(f => shortenName(f.name)).join(" · ");

{/* Below the table badge */}
{facilitatorLabel && (
  <text x={centerX} y={45} textAnchor="middle" className="text-sm" fill="#666">
    {facilitatorLabel}
  </text>
)}
```

2. Style facilitator name boxes differently (bold text, slightly different fill):
```tsx
<text
  fontWeight={participant.is_facilitator ? "bold" : "normal"}
  // ... existing positioning
>
```

**Step 2: Update SeatingChartPage to pass full participant data**

In `SeatingChartPage.tsx`, ensure the participant data (including `is_facilitator`) is passed through to `CircularTable`. Check how participant data currently flows — it may need the full object instead of just names.

**Step 3: Run tests and lint**

Run: `cd frontend && CI=true npm test -- --watchAll=false && npm run lint`

**Step 4: Commit**

```bash
git add frontend/
git commit -m "feat(frontend): show facilitators in seating chart title and with bold styling"
```

---

## Task 10: Integration Testing & Polish

End-to-end verification and cleanup.

**Files:**
- All modified files

**Step 1: Run full backend test suite**

Run: `cd api && poetry run pytest tests/ -v --cov=src --cov-report=term-missing`
Expected: All pass, no regressions.

**Step 2: Run full frontend test suite**

Run: `cd frontend && CI=true npm test -- --watchAll=false`
Expected: All pass.

**Step 3: Run frontend build**

Run: `cd frontend && CI=true npm run build`
Expected: Build succeeds with no ESLint warnings.

**Step 4: Run backend formatting**

Run: `cd api && poetry run black --check src tests`
Expected: Pass.

**Step 5: Manual smoke test (if dev servers available)**

1. Start backend: `cd api && poetry run uvicorn src.api.main:app --reload`
2. Start frontend: `cd frontend && npm start`
3. Test: Upload Excel with Facilitator column → Generate → Verify facilitator display in all views

**Step 6: Final commit if any polish needed**

```bash
git add -A
git commit -m "test: integration tests and polish for facilitator support"
```
