# Design Doc: Facilitator Support

**Date:** 2026-02-12
**Status:** Draft

---

## Problem

Each seminar program has facilitators (typically 6 for tri-faith, 4 for bi-faith — 2 per faith community). Facilitators sit at tables alongside participants but the solver has no concept of them today. This means:

- No guarantee every table gets a facilitator
- No tracking of facilitator-participant repeat pairings across sessions
- No way to identify facilitators in the UI
- No facilitator-aware editing (they're treated identically to participants)

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Facilitator identification | Boolean `is_facilitator` field on participant | Simplest model; facilitators are participants with a flag |
| Every table gets a facilitator | Hard constraint | Absolutely required per program rules |
| Facilitator balance across tables | Even distribution | Same approach as participant balance (no table has >1 more facilitator than another) |
| Facilitator-participant repeat lockout | 3-session rolling window (same as participant-participant) | Consistency; may need relaxing later — noted as tuning point |
| Facilitator-facilitator repeat penalty | Soft objective, low priority | With few facilitators and many tables, rarely relevant |
| Same-table facilitator religion diversity | Hard constraint — no two facilitators at the same table share a religion | Ensures faith representation at each table |
| Edit mode: facilitator swapping | Facilitators only swap with facilitators | Maintains the constraint that every table has facilitator coverage |

## Data Model

### Firestore

Add `is_facilitator: boolean` to roster documents:

```
organizations/{orgId}/roster/{participantId}
  ├── name: string
  ├── religion: string
  ├── gender: string
  ├── partner_id: string | null
  ├── is_facilitator: boolean    ← NEW (default: false)
  └── updated_at: timestamp
```

### Solver Input

Participant dicts gain `is_facilitator`:

```python
{
    "id": 1,
    "name": "Alice Apple",
    "religion": "Christian",
    "gender": "Female",
    "partner": null,
    "couple_id": null,
    "is_facilitator": true     # NEW
}
```

### Pydantic Model

`ParticipantData` adds `is_facilitator: bool = False`.

### Excel Template

New "Facilitator" column after Partner. Accepts Yes/No, Y/N, or blank (defaults to No). Old templates without this column still work — all participants default to non-facilitator.

### Backward Compatibility

- Old Firestore documents without `is_facilitator`: default to `false`
- Old Excel files without Facilitator column: all participants are non-facilitators
- Old session data: assignments page renders normally with no facilitator display

## Solver Constraints & Objectives

### New Hard Constraints

1. **Facilitator coverage** — Every table in every session has at least one facilitator.

2. **Facilitator balance** — Facilitators spread evenly across tables. No table has more than 1 extra facilitator compared to any other table (same pattern as participant balance).

3. **Facilitator-participant repeat lockout** — Within the rolling window (default 3 sessions), a participant cannot be paired with the same facilitator. Uses the same mechanism as existing participant-participant lockout. This window size is a known tuning point — with only N facilitators rotating across N tables, the math gets tight and may need relaxing to 2 or 1.

4. **Facilitator religion diversity per table** — No two facilitators assigned to the same table in any session share the same religion. Ensures each table gets facilitators from different faith communities.

### New Soft Objective (Low Priority)

5. **Facilitator-facilitator repeat penalty** — When two facilitators end up at the same table, penalize if they were together within the window. Low weight relative to other objectives.

### Implementation Approach

Add a `_add_facilitator_constraints()` method to `group_builder.py` that:
- Identifies facilitator IDs from the participant list
- Adds coverage and balance constraints (same pattern as demographic balance)
- Adds religion diversity constraint for facilitator pairs at same table

Facilitator-participant pairing penalties integrate into the existing `_add_repeat_penalty()` method since facilitators are participants — their pairwise interactions are already tracked. The only change is ensuring the penalty applies equally to facilitator-participant pairs.

Historical pairings (used for incremental solving across batches) naturally include facilitator-participant pairs since facilitators are participants. No special handling needed.

### Performance Impact

The facilitator coverage constraint actually *helps* the solver by pruning the search space — partitioning N facilitators across N tables locks down ~20% of assignments immediately. The additional penalty terms (~33% more pairwise terms) are offset by this pruning effect. Solve quality should be comparable or slightly better than today.

### Validation (Pre-Solver)

At generate time: reject if `num_tables > num_facilitators`. Error message: "Need at least N facilitators for N tables (have M)."

## UI: Roster Page

### Roster Grid

- New checkbox column "Facilitator" in the roster grid
- No special validation on toggle (facilitator religion constraints are enforced by the solver, not the roster)
- Generate button validates `num_facilitators >= num_tables` before calling the API

## UI: Assignments Page

### Compact/Overview View

Below each table title, a subtitle line with facilitator names:

```
Table 1
Facilitators: Alice Apple, Bob Barker

  [Diane Frankle] [Fatima Al-Rashid] [Kenji Tanaka] ...
```

Facilitator name chips are visually distinct (bold or subtle icon).

### Detail View

- Facilitators sorted to top of each table, visually separated from regular participants
- Each facilitator gets a "Facilitator" tag alongside their religion/gender tags
- Stats bar format: `5 people · 1 facilitator · 2F/3M · 3 religions`
- Facilitator count shown in red when 0

### Validation Summary

New constraint line: "All tables have facilitators" with green check / red X (consistent with existing couple/religion/gender checks).

### Edit Mode

- Facilitator slots appear at the top of each table, separated from participant slots
- Number of facilitator slots per table = `ceil(num_facilitators / num_tables)` (e.g., 2 slots each for 6 facilitators / 4 tables)
- Tables with fewer facilitators show empty facilitator slots
- Clicking a facilitator highlights only: other facilitators (to swap) and empty facilitator slots (to move)
- Regular participants cannot interact with facilitator slots and vice versa
- Marking a facilitator absent: allowed. The affected table shows red 0-facilitator count in stats bar

## UI: Seating Charts

### Table Title

Table badge gains a subtitle line with facilitator short names:

```
      [Table 1]
  Alice A. · Bob B.
```

### Seated Positions

Facilitators appear in their seated positions around the circle with visually distinct boxes (bold text or filled background). No forced positioning — the existing religion-based round-robin layout places them naturally.

## UI: Export

CSV export is being replaced by PDF roster export (PR #38). The PDF export design will need a facilitator indicator added when that feature is built — noted as a future concern, not part of this work.

## Files to Modify

### assignment_logic/

| File | Change |
|---|---|
| `src/assignment_logic/group_builder.py` | Add `_add_facilitator_constraints()`, update repeat penalty to handle facilitator-participant pairs, add facilitator-facilitator soft penalty |

### api/

| File | Change |
|---|---|
| `src/api/services/roster_service.py` | Persist `is_facilitator` field |
| `src/api/routers/roster.py` | Pass `is_facilitator` through to solver; validate facilitator count >= num_tables at generate time |
| `src/api/routers/upload.py` | Parse Facilitator column from Excel |
| `src/api/utils/dataframe_to_participant_dict.py` | Handle Facilitator column, default to false if missing |

### frontend/

| File | Change |
|---|---|
| `src/types/roster.ts` | Add `is_facilitator` to participant type |
| `src/components/RosterGrid/RosterGrid.tsx` | Add Facilitator checkbox column; validate count at generate |
| `src/pages/TableAssignmentsPage.tsx` | Facilitator subtitle in compact view; facilitator count in stats; validation summary line |
| `src/components/TableAssignments/TableAssignments.tsx` | Facilitator tag, sort facilitators to top, facilitator-only swap logic in edit mode, facilitator slot rendering |
| `src/components/SeatingChart/CircularTable.tsx` | Facilitator subtitle in table title; bold/distinct facilitator boxes |
| `src/pages/SeatingChartPage.tsx` | Pass facilitator data through to CircularTable |

### Tests

| File | Change |
|---|---|
| `assignment_logic/tests/` | New tests for facilitator constraints (coverage, balance, repeat lockout, religion diversity) |
| `api/tests/test_roster.py` | Test `is_facilitator` field persistence and validation |
| `api/tests/test_upload.py` | Test Excel parsing with/without Facilitator column |
| `frontend/src/components/RosterGrid/__tests__/` | Test facilitator checkbox and generate validation |
| `frontend/src/pages/__tests__/TableAssignmentsPage.test.tsx` | Test facilitator display and edit mode restrictions |
