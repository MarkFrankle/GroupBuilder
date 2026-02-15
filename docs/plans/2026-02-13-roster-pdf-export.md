# Roster PDF Export Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "Print Roster" option that renders a printable page with per-session roster tables (name + table number, sorted by last name) followed by per-session seating charts, with facilitators broken out into their own section.

**Architecture:** New `RosterPrintPage` component receives all assignment data via router state (same pattern as `SeatingChartPage`). Renders roster tables for all sessions first, then seating charts for all sessions. Uses `window.print()` with print CSS — no new dependencies, no backend changes.

**Tech Stack:** React + TypeScript, Tailwind CSS, existing `CircularTable` SVG component, existing print CSS infrastructure.

**Prerequisite:** PR #40 (facilitator support) must be merged to main first, then branch off main.

---

### Task 1: Add route and "Print Roster" menu item

**Files:**
- Modify: `frontend/src/App.tsx` (add route)
- Modify: `frontend/src/pages/TableAssignmentsPage.tsx` (add menu item + navigation handler)

**Step 1: Add the route in App.tsx**

After the `/table-assignments/seating` route, add:
```tsx
<Route path="/table-assignments/roster-print" element={<ProtectedRoute><RosterPrintPage /></ProtectedRoute>} />
```

Import at top: `import RosterPrintPage from './pages/RosterPrintPage'`

**Step 2: Add "Print Roster" to the dropdown menu in TableAssignmentsPage**

In the `<DropdownMenuContent>` block (around line 917), add after the "Download CSV" item:

```tsx
<DropdownMenuItem onClick={handlePrintRoster} disabled={editMode}>
  <Printer className="h-4 w-4 mr-2" />
  Print Roster
</DropdownMenuItem>
```

`Printer` is already imported.

**Step 3: Add the `handlePrintRoster` handler**

Near `handlePrintSeating` (around line 310), add:

```typescript
const handlePrintRoster = () => {
  const urlParams = new URLSearchParams(window.location.search)
  const sessionId = urlParams.get('session') || (window.history.state?.usr as any)?.sessionId
  navigate('/table-assignments/roster-print', {
    state: { assignments, sessionId }
  })
}
```

**Step 4: Create a stub RosterPrintPage so the app compiles**

Create `frontend/src/pages/RosterPrintPage.tsx` with a placeholder:

```tsx
import React from 'react'

const RosterPrintPage: React.FC = () => {
  return <div>TODO</div>
}

export default RosterPrintPage
```

**Step 5: Verify the app compiles**

Run: `cd frontend && CI=true npm run build`

**Step 6: Commit**

```
feat: add Print Roster route and menu item (stub page)
```

---

### Task 2: Build RosterPrintPage — roster tables section

**Files:**
- Create: `frontend/src/pages/RosterPrintPage.tsx`
- Create: `frontend/src/pages/__tests__/RosterPrintPage.test.tsx`

**Step 1: Write the tests**

Create `frontend/src/pages/__tests__/RosterPrintPage.test.tsx`:

```tsx
import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

// Mock apiClient to avoid auth issues
jest.mock('@/utils/apiClient', () => ({
  authenticatedFetch: (...args: any[]) => fetch(...args),
}))

// Mock CircularTable to avoid SVG complexity in tests
jest.mock('@/components/SeatingChart/CircularTable', () => {
  return function MockCircularTable({ tableNumber }: { tableNumber: number }) {
    return <div data-testid={`circular-table-${tableNumber}`}>Table {tableNumber}</div>
  }
})

import RosterPrintPage from '../RosterPrintPage'

const mockAssignments = [
  {
    session: 1,
    tables: {
      1: [
        { name: 'David Kim', religion: 'None', gender: 'M', partner: null, is_facilitator: false },
        { name: 'Sarah Adams', religion: 'None', gender: 'F', partner: null, is_facilitator: false },
      ],
      2: [
        { name: 'Rachel Green', religion: 'None', gender: 'F', partner: null, is_facilitator: false },
        { name: 'Mark Frank', religion: 'None', gender: 'M', partner: null, is_facilitator: true },
      ],
    },
    absentParticipants: [
      { name: 'Bob Smith', religion: 'None', gender: 'M', partner: null },
    ],
  },
]

const renderPage = (state: any) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: '/table-assignments/roster-print', state }]}>
      <Routes>
        <Route path="/table-assignments/roster-print" element={<RosterPrintPage />} />
      </Routes>
    </MemoryRouter>
  )

describe('RosterPrintPage', () => {
  it('renders no-data message when state is missing', () => {
    renderPage(null)
    expect(screen.getByText(/no data available/i)).toBeInTheDocument()
  })

  it('renders roster table sorted by last name', () => {
    renderPage({ assignments: mockAssignments, sessionId: 'test-123' })
    // Adams, Green, Kim sorted by last name (Frank is facilitator, separate section)
    const rows = screen.getAllByRole('row')
    // Header row + 3 participant rows + facilitator header + 1 facilitator row = varies
    // Just check names appear
    expect(screen.getByText('Sarah Adams')).toBeInTheDocument()
    expect(screen.getByText('Rachel Green')).toBeInTheDocument()
    expect(screen.getByText('David Kim')).toBeInTheDocument()
  })

  it('separates facilitators into their own section', () => {
    renderPage({ assignments: mockAssignments, sessionId: 'test-123' })
    expect(screen.getByText('Mark Frank')).toBeInTheDocument()
    expect(screen.getByText('Facilitators')).toBeInTheDocument()
  })

  it('shows absent participants', () => {
    renderPage({ assignments: mockAssignments, sessionId: 'test-123' })
    expect(screen.getByText(/Bob Smith/)).toBeInTheDocument()
  })

  it('shows table number for each participant', () => {
    renderPage({ assignments: mockAssignments, sessionId: 'test-123' })
    // Sarah Adams is at table 1
    const sarahRow = screen.getByText('Sarah Adams').closest('tr')
    expect(sarahRow).toHaveTextContent('1')
  })

  it('omits session prefix when only one session', () => {
    renderPage({ assignments: mockAssignments, sessionId: 'test-123' })
    expect(screen.queryByText('Session 1')).not.toBeInTheDocument()
    expect(screen.getByText('Roster')).toBeInTheDocument()
  })

  it('shows session prefix when multiple sessions', () => {
    const multi = [
      ...mockAssignments,
      { session: 2, tables: { 1: [{ name: 'Jane Doe', religion: 'None', gender: 'F', partner: null }] } },
    ]
    renderPage({ assignments: multi, sessionId: 'test-123' })
    expect(screen.getByText('Session 1 Roster')).toBeInTheDocument()
    expect(screen.getByText('Session 2 Roster')).toBeInTheDocument()
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `cd frontend && CI=true npm test -- --watchAll=false --testPathPattern="RosterPrintPage"`
Expected: FAIL (RosterPrintPage is a stub)

**Step 3: Implement RosterPrintPage**

Replace `frontend/src/pages/RosterPrintPage.tsx`:

```tsx
import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Printer } from 'lucide-react'
import { Assignment, Participant } from './TableAssignmentsPage'

interface LocationState {
  assignments: Assignment[]
  sessionId: string
}

interface RosterRow {
  name: string
  table: number
  is_facilitator: boolean
}

const sortByLastName = (a: string, b: string): number => {
  const lastA = a.split(' ').pop()?.toLowerCase() ?? ''
  const lastB = b.split(' ').pop()?.toLowerCase() ?? ''
  if (lastA !== lastB) return lastA.localeCompare(lastB)
  return a.toLowerCase().localeCompare(b.toLowerCase())
}

const RosterPrintPage: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as LocationState | null

  if (!state || !state.assignments) {
    return (
      <div className="container mx-auto p-8 max-w-4xl text-center">
        <h1 className="text-2xl font-bold mb-4">No Data Available</h1>
        <p className="text-gray-600 mb-6">Please return to the table assignments page and try again.</p>
        <Button onClick={() => navigate(-1)} variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Assignments
        </Button>
      </div>
    )
  }

  const { assignments } = state
  const multiSession = assignments.length > 1
  const dateStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  const buildRosterRows = (assignment: Assignment): RosterRow[] => {
    const rows: RosterRow[] = []
    for (const [tableNum, participants] of Object.entries(assignment.tables)) {
      for (const p of participants) {
        if (p) {
          rows.push({
            name: p.name,
            table: Number(tableNum),
            is_facilitator: p.is_facilitator ?? false,
          })
        }
      }
    }
    return rows.sort((a, b) => sortByLastName(a.name, b.name))
  }

  const renderRosterTable = (rows: RosterRow[]) => {
    const participants = rows.filter(r => !r.is_facilitator)
    const facilitators = rows.filter(r => r.is_facilitator)

    return (
      <>
        <table className="roster-table w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-gray-300">
              <th className="text-left py-2 px-3 font-semibold">Name</th>
              <th className="text-left py-2 px-3 font-semibold w-20">Table</th>
            </tr>
          </thead>
          <tbody>
            {participants.map((row) => (
              <tr key={row.name} className="border-b border-gray-200">
                <td className="py-1.5 px-3">{row.name}</td>
                <td className="py-1.5 px-3">{row.table}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {facilitators.length > 0 && (
          <>
            <h3 className="text-sm font-semibold text-gray-600 mt-4 mb-1">Facilitators</h3>
            <table className="roster-table w-full border-collapse text-sm">
              <tbody>
                {facilitators.map((row) => (
                  <tr key={row.name} className="border-b border-gray-200">
                    <td className="py-1.5 px-3">{row.name}</td>
                    <td className="py-1.5 px-3 w-20">{row.table}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header bar (hidden on print) */}
      <div className="no-print border-b bg-white sticky top-0 z-10">
        <div className="container mx-auto p-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Print Roster</h1>
          <div className="flex gap-2">
            <Button onClick={() => navigate(-1)} variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button onClick={() => window.print()} variant="default" size="sm">
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
          </div>
        </div>
      </div>

      {/* Roster sections */}
      <div className="container mx-auto p-8 max-w-3xl">
        {assignments.map((assignment) => {
          const rows = buildRosterRows(assignment)
          const absent = assignment.absentParticipants ?? []
          const title = multiSession ? `Session ${assignment.session} Roster` : 'Roster'

          return (
            <div key={assignment.session} className="roster-section mb-8">
              <div className="flex justify-between items-baseline mb-4">
                <h2 className="text-xl font-bold">{title}</h2>
                <span className="text-sm text-gray-500 print:text-black">{dateStr}</span>
              </div>

              {renderRosterTable(rows)}

              {absent.length > 0 && (
                <p className="text-sm text-gray-500 mt-3 print:text-black">
                  Absent: {absent.map(p => p.name).join(', ')}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default RosterPrintPage
```

**Step 4: Run tests to verify they pass**

Run: `cd frontend && CI=true npm test -- --watchAll=false --testPathPattern="RosterPrintPage"`
Expected: PASS

**Step 5: Run full test suite**

Run: `cd frontend && CI=true npm test -- --watchAll=false`
Expected: All tests pass

**Step 6: Commit**

```
feat: implement RosterPrintPage with roster tables and facilitator sections
```

---

### Task 3: Add seating charts section to RosterPrintPage

**Files:**
- Modify: `frontend/src/pages/RosterPrintPage.tsx` (add seating chart section after rosters)
- Modify: `frontend/src/pages/__tests__/RosterPrintPage.test.tsx` (add seating chart tests)

The seating charts require a server-side call to `POST /api/assignments/seating/{sessionId}?session={n}` for each session (same as "Print Seating"). The page fetches all sessions in parallel on mount.

**Step 1: Add tests for seating chart section**

Add to the test file:

```tsx
it('fetches and renders seating charts for each session', async () => {
  // Mock the seating API response
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      session: 1,
      tables: [
        { table_number: 1, seats: [{ position: 0, name: 'Sarah Adams', religion: 'None' }] },
      ],
    }),
  })

  renderPage({ assignments: mockAssignments, sessionId: 'test-123' })

  // Seating chart section should appear after fetch
  const table1 = await screen.findByTestId('circular-table-1')
  expect(table1).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `cd frontend && CI=true npm test -- --watchAll=false --testPathPattern="RosterPrintPage"`

**Step 3: Add seating chart fetching and rendering**

In `RosterPrintPage.tsx`, add state for seating data and fetch on mount:

```tsx
import CircularTable from '@/components/SeatingChart/CircularTable'
import { API_BASE_URL } from '@/config/api'
import { authenticatedFetch } from '@/utils/apiClient'
```

Add interfaces:

```tsx
interface SeatingTable {
  table_number: number
  seats: { position: number; name: string; religion: string; is_facilitator?: boolean }[]
}

interface SeatingData {
  session: number
  tables: SeatingTable[]
  absent_participants?: { name: string; religion: string }[]
}
```

Add state and effect inside the component (after the guard clause):

```tsx
const [seatingBySession, setSeatingBySession] = React.useState<Record<number, SeatingData>>({})

React.useEffect(() => {
  const fetchSeating = async () => {
    const results: Record<number, SeatingData> = {}
    await Promise.all(
      assignments.map(async (assignment) => {
        try {
          const response = await authenticatedFetch(
            `${API_BASE_URL}/api/assignments/seating/${state.sessionId}?session=${assignment.session}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ assignments: [assignment] }),
            }
          )
          if (response.ok) {
            results[assignment.session] = await response.json()
          }
        } catch {
          // Seating charts are supplementary — fail silently
        }
      })
    )
    setSeatingBySession(results)
  }
  fetchSeating()
}, [assignments, state.sessionId])
```

After the roster sections `</div>`, add the seating chart sections:

```tsx
{/* Seating chart sections */}
{Object.keys(seatingBySession).length > 0 && (
  <div className="container mx-auto p-8 max-w-4xl">
    {assignments.map((assignment) => {
      const seating = seatingBySession[assignment.session]
      if (!seating) return null
      const title = multiSession
        ? `Session ${assignment.session} Seating Chart`
        : 'Seating Chart'
      const gridCols = seating.tables.length >= 6
        ? 'lg:grid-cols-3 md:grid-cols-2'
        : 'md:grid-cols-2'

      return (
        <div key={`seating-${assignment.session}`} className="seating-section mb-8">
          <h2 className="text-xl font-bold mb-4">{title}</h2>
          <div className={`seating-grid grid grid-cols-1 ${gridCols} gap-6`}>
            {seating.tables.map((table) => (
              <CircularTable
                key={table.table_number}
                tableNumber={table.table_number}
                seats={table.seats}
              />
            ))}
          </div>
        </div>
      )
    })}
  </div>
)}
```

**Step 4: Run tests to verify they pass**

Run: `cd frontend && CI=true npm test -- --watchAll=false --testPathPattern="RosterPrintPage"`

**Step 5: Run full test suite**

Run: `cd frontend && CI=true npm test -- --watchAll=false`

**Step 6: Commit**

```
feat: add seating charts section to roster print page
```

---

### Task 4: Add print CSS for roster tables

**Files:**
- Modify: `frontend/src/styles/index.css` (add roster print styles)

**Step 1: Add print styles**

In the existing `@media print` block in `index.css`, add:

```css
/* Roster print styles */
.roster-section {
  page-break-after: always;
}

.roster-section:last-of-type {
  page-break-after: auto;
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
```

**Step 2: Verify build succeeds**

Run: `cd frontend && CI=true npm run build`

**Step 3: Commit**

```
feat: add print CSS for roster tables and page breaks
```

---

### Task 5: Manual QA and polish

**Step 1: Start the frontend dev server and verify the full flow**

1. Go to Table Assignments page with generated assignments
2. Click the `...` dropdown → "Print Roster"
3. Verify: roster tables render with participants sorted by last name, facilitators in separate section
4. Verify: seating charts load below the roster tables
5. Verify: `Ctrl+P` / Print button shows correct page breaks (each session's roster on its own page, seating charts after)
6. Verify: single-session shows "Roster" / "Seating Chart" (no "Session 1" prefix)

**Step 2: Fix any issues found during QA**

**Step 3: Run full test suite one final time**

Run: `cd frontend && CI=true npm test -- --watchAll=false`
Run: `cd frontend && CI=true npm run build`

**Step 4: Commit any final polish**

---

### Summary

| Task | What | Files |
|------|------|-------|
| 1 | Route + menu item (stub) | App.tsx, TableAssignmentsPage.tsx, RosterPrintPage.tsx (stub) |
| 2 | Roster tables with facilitator sections | RosterPrintPage.tsx, tests |
| 3 | Seating charts section | RosterPrintPage.tsx, tests |
| 4 | Print CSS | index.css |
| 5 | Manual QA | — |
