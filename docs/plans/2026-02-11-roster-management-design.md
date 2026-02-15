# Roster Management UI Design

## Problem

The current workflow requires organizers to prepare an Excel file offline with exact column names (Name, Religion, Gender, Partner), upload it, and download results as CSV. User testing with BBT organizers identified this file round-trip as the primary friction point. Non-technical volunteers find Excel formatting error-prone and tedious.

## Solution

An in-app spreadsheet-style roster editor as the primary way to manage participant data. File upload becomes an "import" shortcut that populates the same roster UI.

## User Flow

```
Landing Page (/)
├── "Manage Roster" card → /roster
└── "Import from Excel" card → parses file → saves to roster → redirects to /roster

Roster Page (/roster)
├── Editable grid (Name, Religion, Gender, Partner)
├── Table/session config controls
└── "Generate Assignments" → /table-assignments?session=<id>
```

Upload is no longer a separate path — it's a shortcut to populate the roster. The roster page is always the hub before generating.

## Pages

### Landing Page (`/`) — simplified hub

- Header + tagline (kept)
- Two action cards side by side:
  - **"Manage Roster"** — navigates to `/roster`. Shows participant count if roster exists (e.g. "24 participants")
  - **"Import from Excel"** — file picker, parses Excel, saves participants to org roster, redirects to `/roster`
- "Download Template" link stays for offline prep
- Recent uploads section stays for accessing past results

### Roster Page (`/roster`) — new core page

- Spreadsheet-style editable grid
- Below the grid: Number of Tables, Number of Sessions dropdowns + "Generate Assignments" button + Advanced Options
- "Roster" link added to app navigation

### All other pages unchanged

- `/table-assignments` — results
- `/table-assignments/seating` — seating charts
- `/admin` — admin dashboard

## Grid Component

### Columns

| Column   | Input Type | Values |
|----------|-----------|--------|
| Name     | Free text | Any string |
| Religion | Dropdown  | Christian, Jewish, Muslim, Other |
| Gender   | Dropdown  | Male, Female, Other |
| Partner  | Dropdown  | Other participants by name |

### Behavior

- **Perpetual empty row**: the last row is always empty. Typing into it creates a participant and a new empty row appears below.
- **Tab navigation**: tab moves between cells left-to-right, then to the next row.
- **Delete**: small trash icon appears on row hover (right side).
- **Partner auto-linking**: selecting a partner auto-sets the reciprocal relationship. Clearing one clears both.
- **Auto-save on blur**: each cell edit fires a debounced PUT to the API. Subtle "Saving..." / "Saved" indicator.

### Validation

- Red outline on empty Name (for non-empty rows) or duplicate Name
- Participant count displayed (e.g. "24 participants")
- "Generate Assignments" button disabled with tooltip if validation errors or participant count < table count

### Explicitly excluded

- No drag-to-reorder rows
- No column resizing
- No sorting or filtering
- No multi-select or bulk operations
- No undo/redo beyond browser-native

## Data Model

### Firestore: roster subcollection

```
organizations/{orgId}/roster/{participantId}
  - name: string
  - religion: "Christian" | "Jewish" | "Muslim" | "Other"
  - gender: "Male" | "Female" | "Other"
  - partner_id: string | null  (references another roster/{id} doc)
  - created_at: timestamp
  - updated_at: timestamp
```

Individual documents per participant rather than a single array — enables granular Firestore real-time listeners and avoids concurrent edit conflicts.

### Session snapshots

When "Generate Assignments" is clicked, the backend reads from the roster collection, converts to the existing participant dict format, and feeds it into the solver. Session documents still store a snapshot of participant data at generation time (existing behavior preserved).

## API

### New endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/roster/` | Returns the org's full roster |
| `PUT` | `/api/roster/{participant_id}` | Upsert a single participant |
| `DELETE` | `/api/roster/{participant_id}` | Remove a participant |
| `POST` | `/api/roster/import` | Parse Excel file, save to org roster, return updated roster |

### Modified endpoints

- `POST /api/upload/` — deprecated in favor of `/api/roster/import`

### Unchanged endpoints

- All `/api/assignments/*` endpoints — the solver reads from roster at generation time and creates sessions as before

## Implementation Notes

- The grid should be built with plain HTML table + controlled inputs (no heavy library like AG Grid needed for 4 columns and ~30 rows)
- Firestore `onSnapshot` listeners can power real-time sync if multiple users edit simultaneously, but this is not required for MVP
- The existing `dataframe_to_participant_dict()` utility can be reused by the import endpoint
- Partner validation (mutual linking) moves from upload-time to the grid UI — the backend should still validate on generation
