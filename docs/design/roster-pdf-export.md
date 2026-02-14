# Design Doc: Roster PDF Export

**Author:** Claude
**Date:** 2026-02-12
**Status:** Draft

---

## Problem

After generating table assignments, facilitators need a printable document they can bring to the event. Currently the only export is a raw CSV. Users want a formatted, print-ready output that includes:

1. A **roster** (alphabetical name list with table assignments) for each session
2. **Seating charts** (circular table diagrams) for each session

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Seating charts included? | Always | One-stop printout; no extra toggle needed |
| Name format | "First Last" | Matches existing display |
| Sort order | Alphabetical by last name | Natural for check-in scanning |
| Date on printout | Auto-populated current date | Event context without user input |
| Layout | Rosters first, then charts | See below |

### Layout: Rosters First, Charts After

The printout is structured as two logical sections:

```
Page 1:   Session 1 Roster (name table)
Page 2:   Session 2 Roster (name table)
...
Page N:   Session 1 Seating Chart (circular diagrams)
Page N+1: Session 2 Seating Chart (circular diagrams)
...
```

Each section starts on a new page (`page-break-before`).

**Why this order:**
- Clean separation — rosters are the "must have," charts are supplementary
- Power users can use the browser print dialog's page-range selector to exclude charts entirely (e.g., print pages 1-3 of 6)
- No custom "include charts?" checkbox needed in the UI

## Roster Table Format

Each session's roster is a simple table, sorted by last name:

```
Session 1                              February 12, 2026
─────────────────────────────────────────────────────────
 Name                  Table
─────────────────────────────────────────────────────────
 Sarah Adams             2
 Michael Chen            1
 Rachel Green            3
 David Kim               1
 ...
─────────────────────────────────────────────────────────
 Absent: (none)
```

Columns:
- **Name** — "First Last", sorted by last-name token (split on last space)
- **Table** — table number for that session

That's it. Religion/gender/partner are internal solver inputs, not useful on a printed check-in sheet.

### Absent Participants

If a session has absent participants (marked absent via the edit UI), they appear in a footer line below the table: `Absent: Jane Doe, Bob Smith`

## Seating Chart Format

Reuses the existing `CircularTable` SVG component. Each session gets a page with a grid of circular table diagrams (2-3 columns depending on table count), matching the current `SeatingChartPage` layout.

The only difference from the existing seating chart page: the charts are rendered inline in the print view rather than on a separate route.

## Entry Point

New menu item in the existing dropdown on `TableAssignmentsPage`:

```
 [...]  Dropdown Menu
  ├── Download CSV          (existing)
  ├── Print Roster          ← NEW
  ├── Regenerate All Sessions
  └── Clear
```

Clicking "Print Roster" navigates to a new `/roster-print` route (similar to how "Print Seating" navigates to `/seating-chart`). The new page:

1. Receives all assignment data + session ID via router state (same pattern as `SeatingChartPage`)
2. Renders the full printable document (rosters + charts)
3. Auto-triggers `window.print()` or shows a Print button

## Implementation Approach

### No New Dependencies

Use `window.print()` with print-specific CSS, exactly like the existing seating chart feature. No PDF library needed — the browser's "Save as PDF" covers that use case natively.

### New Files

| File | Purpose |
|---|---|
| `frontend/src/pages/RosterPrintPage.tsx` | New page component — renders the printable roster + seating charts |
| `frontend/src/pages/__tests__/RosterPrintPage.test.tsx` | Tests |

### Modified Files

| File | Change |
|---|---|
| `frontend/src/App.tsx` | Add `/roster-print` route |
| `frontend/src/pages/TableAssignmentsPage.tsx` | Add "Print Roster" menu item + handler that navigates to the new route with assignment data |

### No Backend Changes

All data needed (assignments, participant names, table numbers) is already available on the frontend in the `assignments` state on `TableAssignmentsPage`. The print page just reformats it.

## RosterPrintPage Component Structure

```tsx
RosterPrintPage
├── Header bar (no-print): Back button, Print button
├── For each session (roster section):
│   ├── Print header: "Session N" + date
│   └── <table>: Name | Table (sorted by last name)
│       └── Footer: Absent participants (if any)
├── Page break
└── For each session (seating chart section):
    ├── Print header: "Session N Seating Chart"
    └── Grid of <CircularTable /> components
```

### Sorting Logic

```typescript
const sortByLastName = (a: string, b: string): number => {
  const lastA = a.split(' ').pop()?.toLowerCase() ?? ''
  const lastB = b.split(' ').pop()?.toLowerCase() ?? ''
  if (lastA !== lastB) return lastA.localeCompare(lastB)
  return a.toLowerCase().localeCompare(b.toLowerCase())
}
```

### Data Flow

```
TableAssignmentsPage
  │
  │  navigate('/roster-print', { state: { assignments, sessionId } })
  │
  ▼
RosterPrintPage
  │
  │  // Build roster rows from assignments
  │  assignments.forEach(session => {
  │    Object.entries(session.tables).forEach(([tableNum, participants]) => {
  │      // flatten into { name, table } rows
  │    })
  │    // sort by last name
  │  })
  │
  │  // Fetch seating data for charts (same API call as existing Print Seating)
  │  POST /api/assignments/seating/{sessionId}?session={n}
  │
  ▼
  Render & print
```

**Note:** The seating chart section requires the same API call currently used by "Print Seating" (`/api/assignments/seating/{sessionId}?session={n}`), since the circular seat positions are computed server-side. The page will need to fetch this for each session on mount.

Alternatively, we can pass seating data for all sessions at once if we add a batch endpoint or make parallel requests on page load. Parallel fetches per session is simplest and consistent with the existing pattern.

## Print CSS

Extend the existing print styles:

```css
@media print {
  .no-print { display: none !important; }

  .roster-section {
    page-break-after: always;
  }

  .seating-section {
    page-break-before: always;
  }

  .roster-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11pt;
  }

  .roster-table th,
  .roster-table td {
    padding: 4px 8px;
    border-bottom: 1px solid #ccc;
    text-align: left;
  }
}
```

## Edge Cases

| Case | Behavior |
|---|---|
| Single session | No "Session N" prefix — just "Roster" and "Seating Chart" |
| No absent participants | Omit the absent footer entirely |
| Very long names | Truncate at ~30 chars with ellipsis (same as CircularTable) |
| Many tables (6+) | 3-column grid for charts (existing logic) |
| Page refresh on print page | Show "No data available, go back" (same as SeatingChartPage) |

## Out of Scope

- Custom header/event name input (can add later)
- Religion/gender columns on the roster (internal data, not for printed sheets)
- Saving as a named PDF file (browser "Save as PDF" handles this)
- Backend PDF generation
