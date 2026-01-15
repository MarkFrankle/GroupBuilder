# Seating Charts Visualization Design

**Created:** 2026-01-14
**Feature:** Phase 2 - Circular Seating Charts for Printing
**Author:** Mark Frankle & Claude

---

## Overview

Generate printable circular seating charts showing participants positioned around tables with religions distributed evenly to prevent awkward clustering during interfaith dialogue sessions. This is a finishing touch after table assignments are finalized.

**Business Value:**
- Event organizers can print physical seating charts to place at tables
- Religions are visually distributed around circles (no clustering on one side)
- Supports day-of-event logistics (print per session as needed)
- Reduces confusion about where participants should sit

**Target Users:**
- Event facilitators for Building Bridges Together (BBT)
- Volunteer coordinators running multi-session interfaith dialogues

---

## User Workflow

1. User reviews and edits table assignments in Detailed view
2. When satisfied with assignments, user exits edit mode (if in edit mode)
3. Navigates to the desired session using session dropdown
4. Clicks **"Print Seating"** button in session control bar
5. Backend generates circular seat positions (distributing religions around tables)
6. Frontend displays print preview page with circular table visualizations in a grid
7. User reviews the layout
8. User prints directly from browser (Ctrl+P / Cmd+P)

**Output:**
One printed page per session showing all tables as circles with participant names positioned around the perimeter. Designed to be printed and physically placed at tables during the event. Only shows participant names (no religion/gender data visible to participants).

---

## Design Principles

- **Minimal editing**: Finishing touches only, not heavy interaction (no drag-and-drop)
- **Browser print**: Use native browser print functionality (no custom PDF generation yet)
- **Session-focused**: Print one session at a time (day-of logistics)
- **Mobile-friendly**: No drag-and-drop interactions
- **YAGNI**: Ship core functionality, defer advanced features (rotation, per-table regeneration)

---

## UI Changes to Table Assignments Page

### Current State
- Two view toggles (Compact/Detailed) on the left
- Session-specific actions (Edit, Regenerate) in the top bar
- Session heading ("Session 1") appears above tables
- Previous/Next buttons at the bottom of the page

### New Layout (Detailed View)

```
┌──────────────────────────────────────────────────────────────────┐
│  [Grid Icon] [List Icon]                        [...More Menu]   │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  Session 1 ▼                                                      │
│                                                                   │
│  [✏️ Edit] [🔄 Regenerate] [🖨️ Print Seating]    [◀ Prev] [Next ▶] │
└──────────────────────────────────────────────────────────────────┘

Table 1                                Table 2
[Current list view of participants]   [Current list view of participants]
```

### Changes

1. **Session dropdown** - Replaces the "Session 1" static heading, allows quick jumping between sessions without navigating
2. **Unified session control bar** - All session-specific actions + navigation in one horizontal bar
3. **New "Print Seating" button** - Appears alongside Edit and Regenerate
4. **Navigation moved up** - Previous/Next buttons now right-aligned in session bar (no more scrolling down to navigate)
5. **Bottom navigation removed** - Eliminates scroll-to-navigate pattern

### Button States

- **Print Seating**:
  - Enabled in Detailed view when NOT in edit mode
  - Disabled in edit mode (must finish editing first)
  - Disabled in Compact view
- **Edit/Regenerate**: Current behavior unchanged
- **Prev/Next**: Disabled at first/last session respectively

---

## Seating Chart Print Preview

### Route
`/table-assignments/seating?session={sessionId}&sessionNum={n}`

### Page Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  Session 3 Seating Chart                    [← Back] [🖨️ Print]  │
└──────────────────────────────────────────────────────────────────┘

Grid of tables (2 columns on letter paper):

     ╭─────────────╮              ╭─────────────╮
    │   Maria      │            │   Ahmed      │
  │                 │          │                 │
 Jo                  David    Sam                Li
  │                 │          │                 │
    │   Sarah      │            │   Rebecca    │
     ╰─────────────╯              ╰─────────────╯
         Table 1                      Table 2

     ╭─────────────╮
    │   Fatima     │
  │                 │
 Omar               Yuki
  │                 │
    │   Carlos     │
     ╰─────────────╯
         Table 3

Absent Participants: [List if any]
```

### Visual Elements

- **Circular table visualizations** - SVG circles with names positioned around the perimeter
- **Table numbers** - Centered below each circle
- **Grid layout** - Tables arranged in responsive grid (2 columns on standard letter paper)
- **Clean, printable design** - Large text, high contrast, black and white
- **Absent participants** - Simple comma-separated list (top or bottom of page, TBD during implementation)

### Controls (Hidden on Print)

- **Back button** - Returns to main assignments view
- **Print button** - Triggers `window.print()`

### Future Enhancements (Out of Scope for Phase 2.1)

- Per-table rotate clockwise/counter-clockwise
- Per-table regenerate arrangement
- These kept in mind for future iterations if users request them

---

## Backend API Design

### New Endpoint

```
POST /api/assignments/seating/{session_id}?session={n}
```

**Why POST?** We need to send the current assignment state (including localStorage edits) in the request body.

### Request Parameters

- `session_id` (path): The magic link session identifier
- `session` (query): Session number (1, 2, 3, etc.)

### Request Body

```json
{
  "assignments": [
    {
      "session": 3,
      "tables": {
        "1": [
          {"name": "Maria Santos", "religion": "Catholic", "gender": "Female", "partner": null},
          {"name": "David Cohen", "religion": "Jewish", "gender": "Male", "partner": "Sarah Cohen"},
          ...
        ],
        "2": [...]
      },
      "absentParticipants": [...]
    }
  ]
}
```

Frontend sends the complete current state including any localStorage edits.

### Response Format

```json
{
  "session": 3,
  "tables": [
    {
      "table_number": 1,
      "seats": [
        {
          "position": 0,
          "name": "Maria Santos",
          "religion": "Catholic"
        },
        {
          "position": 1,
          "name": "David Cohen",
          "religion": "Jewish"
        },
        {
          "position": 2,
          "name": "Ahmed Al-Rashid",
          "religion": "Muslim"
        }
        // ... more seats (positions 0-N around circle)
      ]
    },
    // ... more tables
  ],
  "absent_participants": [
    {"name": "John Doe", "religion": "Christian"}
  ]
}
```

### Backend Logic

1. **Extract session data** from request body
2. **For each table, run circular arrangement algorithm:**
   - Count religions at the table
   - Distribute positions to alternate religions as evenly as possible
   - Use greedy round-robin algorithm: place religions in alternating pattern
3. **Return positioned seat data** with `position` index for each participant

### Circular Arrangement Algorithm

**Goal:** Maximize distance between participants of the same religion around the circle.

**Example:**
```
Input:  Table with 2 Muslims, 2 Christians, 1 Jewish, 1 Hindu
Output: [Muslim, Christian, Jewish, Muslim, Christian, Hindu]
```

**Algorithm (Simplified Greedy Approach):**
1. Group participants by religion
2. Sort religions by count (largest groups first)
3. Distribute in round-robin fashion:
   - Place one from largest group
   - Place one from second-largest group
   - Continue cycling through groups
   - Skip groups that are exhausted

**Pseudocode:**
```python
def arrange_circular_seating(participants):
    # Group by religion
    religion_groups = defaultdict(list)
    for p in participants:
        religion_groups[p['religion']].append(p)

    # Sort by group size (largest first) for better distribution
    sorted_groups = sorted(religion_groups.values(), key=len, reverse=True)

    # Round-robin distribution
    result = []
    while any(len(group) > 0 for group in sorted_groups):
        for group in sorted_groups:
            if group:
                result.append(group.pop(0))

    # Assign position indices
    for i, participant in enumerate(result):
        participant['position'] = i

    return result
```

---

## Frontend Implementation

### Component Structure

```
TableAssignmentsPage.tsx (existing - modified)
  └─ Session dropdown + Print Seating button

SeatingChartPage.tsx (new)
  ├─ SeatingChartView.tsx (new)
  │   └─ CircularTable.tsx (new)
  └─ Print-specific CSS (@media print)
```

### Data Flow

1. **User clicks "Print Seating"** (in TableAssignmentsPage)
   - Frontend POSTs to `/api/assignments/seating/{sessionId}?session={n}`
   - Request body includes current `assignments` state (including localStorage edits)

2. **Backend responds with positioned seats**
   - Receives JSON with `tables[]` containing `seats[]` with `position` indices

3. **Frontend navigates to SeatingChartPage**
   - Route: `/table-assignments/seating?session={sessionId}&sessionNum={n}`
   - Passes positioned seat data via navigation state or refetches if needed
   - Renders grid of CircularTable components

4. **User clicks "Print" button**
   - Calls `window.print()`
   - Browser print dialog opens
   - CSS `@media print` rules apply print-friendly styling

### CircularTable Component

**Props:**
```typescript
interface CircularTableProps {
  tableNumber: number;
  seats: Array<{
    position: number;
    name: string;
    religion: string;
  }>;
}
```

**Rendering:**
- SVG element with circle shape
- Calculate position for each name using polar coordinates:
  ```typescript
  const totalSeats = seats.length;
  const angleStep = (2 * Math.PI) / totalSeats;

  seats.forEach(seat => {
    const angle = seat.position * angleStep - Math.PI / 2; // Start at top
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);

    // Render text element at (x, y)
    // Rotate text to be horizontal (not at angle)
  });
  ```

**Key Implementation Details:**
- Names should read horizontally (not rotated at angles around circle)
- Font size may need to scale based on table size (more people = smaller font)
- Consider letter paper dimensions: ~8.5" x 11" with 0.5" margins
- Grid should be 2 columns for most table counts

### Print Styling

```css
@media print {
  /* Hide UI controls */
  .no-print {
    display: none !important;
  }

  /* Page setup */
  @page {
    size: letter;
    margin: 0.5in;
  }

  /* Remove backgrounds and colors for print */
  body {
    background: white;
    color: black;
  }

  /* Grid layout for tables */
  .seating-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 2rem;
    page-break-inside: avoid;
  }

  /* Ensure circles are appropriately sized */
  .circular-table {
    width: 100%;
    max-width: 300px;
    height: auto;
    margin: 0 auto;
  }
}
```

---

## Testing Strategy

### Backend Tests (Python)

**File:** `api/tests/test_seating_arrangements.py`

```python
def test_circular_arrangement_distributes_religions():
    """Ensure religions are spread around the table"""
    table = [
        {"name": "A", "religion": "Christian", "gender": "F", "partner": None},
        {"name": "B", "religion": "Christian", "gender": "M", "partner": None},
        {"name": "C", "religion": "Muslim", "gender": "F", "partner": None},
        {"name": "D", "religion": "Muslim", "gender": "M", "partner": None},
    ]
    arranged = arrange_circular_seating(table)

    # Check that no two adjacent seats have the same religion
    for i in range(len(arranged)):
        next_i = (i + 1) % len(arranged)
        assert arranged[i]["religion"] != arranged[next_i]["religion"]

def test_handles_uneven_religion_distribution():
    """Handle tables with uneven distribution like 4 Christians, 1 Muslim"""
    table = [
        {"name": "A", "religion": "Christian", "gender": "F", "partner": None},
        {"name": "B", "religion": "Christian", "gender": "M", "partner": None},
        {"name": "C", "religion": "Christian", "gender": "F", "partner": None},
        {"name": "D", "religion": "Christian", "gender": "M", "partner": None},
        {"name": "E", "religion": "Muslim", "gender": "F", "partner": None},
    ]
    arranged = arrange_circular_seating(table)

    # Should distribute as best as possible
    # Muslim should not be adjacent to another Muslim (there's only one)
    assert len(arranged) == 5

def test_handles_single_religion_table():
    """If all participants are same religion, just return in order"""
    table = [
        {"name": "A", "religion": "Christian", "gender": "F", "partner": None},
        {"name": "B", "religion": "Christian", "gender": "M", "partner": None},
    ]
    arranged = arrange_circular_seating(table)

    # Should not crash, just return them
    assert len(arranged) == 2

def test_api_endpoint_returns_positioned_seats():
    """Test the full API endpoint"""
    # POST to /api/assignments/seating/{session_id}?session=1
    # Verify response structure matches spec
    pass
```

### Frontend Tests (React)

**File:** `frontend/src/pages/__tests__/SeatingChartPage.test.tsx`

```typescript
test('displays circular tables in grid layout', () => {
  const mockData = {
    session: 1,
    tables: [
      { table_number: 1, seats: [...] },
      { table_number: 2, seats: [...] },
      { table_number: 3, seats: [...] },
    ],
    absent_participants: []
  };

  render(<SeatingChartPage data={mockData} />);

  expect(screen.getAllByTestId('circular-table')).toHaveLength(3);
});

test('positions names around circle correctly', () => {
  // Verify SVG text elements are positioned at correct coordinates
  // Check that polar coordinate math is correct
});

test('Print Seating button disabled in edit mode', () => {
  render(<TableAssignmentsPage editMode={true} />);

  const printButton = screen.getByText('Print Seating');
  expect(printButton).toBeDisabled();
});

test('session dropdown allows quick navigation', () => {
  render(<TableAssignmentsPage assignments={mockData} />);

  const dropdown = screen.getByRole('combobox');
  fireEvent.change(dropdown, { target: { value: '3' } });

  expect(screen.getByText('Session 3')).toBeInTheDocument();
});
```

---

## Edge Cases

1. **Odd table sizes** (3, 5, 7 people)
   - Positions should still distribute evenly around circle
   - Algorithm handles any table size

2. **Single-person tables**
   - Just center the name in the circle
   - No complex positioning needed

3. **Very large tables** (10+ people)
   - Names might overlap if font is too large
   - Font scaling may be needed (implement if we encounter this)
   - Consider responsive font size based on table size

4. **All same religion at a table**
   - Algorithm should gracefully handle (no distribution possible)
   - Just arrange in input order

5. **Absent participants**
   - Display as comma-separated list on page (top or bottom, TBD)
   - Do not show in circular tables

6. **Session with no tables**
   - Shouldn't happen in normal flow
   - Show friendly error: "No tables found for this session"

7. **Empty localStorage edits**
   - If user never edited, send original backend data
   - No special handling needed

---

## Implementation Scope

### Phase 2.1 - Core Seating Charts (This Feature)

**In Scope:**
- ✅ Session dropdown for quick navigation
- ✅ Reorganized session control bar (actions + prev/next navigation)
- ✅ "Print Seating" button (disabled in edit mode)
- ✅ Backend endpoint: `POST /api/assignments/seating/{sessionId}`
- ✅ Circular arrangement algorithm (distribute religions)
- ✅ SeatingChartPage with SVG circular table visualizations
- ✅ Grid layout for multiple tables
- ✅ Browser print functionality with `@media print` CSS
- ✅ Absent participants list on printed page
- ✅ Tests for arrangement algorithm and UI components

**Out of Scope (Future Enhancements):**
- ❌ Per-table rotation controls (kept in mind for future)
- ❌ Per-table regeneration controls (kept in mind for future)
- ❌ Custom PDF generation (using browser print for now)
- ❌ Drag-and-drop seat editing
- ❌ Advanced font scaling for very large tables (handle if needed)
- ❌ "Print All Sessions" option (keeping single-session for Phase 2)
- ❌ Seating chart preview in main view (separate page only)

### Success Criteria

- Facilitators can print one session's seating charts in **<30 seconds**
- Religions are visibly distributed around tables (no clustering on one side)
- Charts are legible when printed on standard letter paper
- Absent participants are clearly indicated
- All tests pass (backend + frontend)
- UI reorganization improves navigation (session dropdown, unified controls)

### Open Questions for Implementation

1. **Absent list placement**: Top or bottom of page? (Decide during implementation)
2. **Table size on page**: How large should circles be? (Experiment with different sizes)
3. **Max tables per page**: If 6+ tables, does it get crowded? (Cross that bridge if we come to it)
4. **Font scaling**: Do we need dynamic font sizing for large tables? (Implement if needed)

---

## Dependencies

- Existing table assignment system (no changes required)
- Edit mode and localStorage persistence (leveraged, not modified)
- React Router (for new SeatingChartPage route)
- SVG rendering in React (standard, no new libraries needed)
- Browser print API (standard, widely supported)

---

## Risks and Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| SVG rendering inconsistent across browsers | Med | Low | Test on Chrome, Firefox, Safari; use standard SVG features only |
| Print layout breaks on different paper sizes | Med | Med | Focus on letter size initially; add A4 support if requested |
| Large tables (10+ people) have overlapping names | Med | Low | Implement font scaling if we encounter this; test with real data |
| Algorithm doesn't distribute religions well | High | Low | Thoroughly test with various religion distributions; algorithm is straightforward |
| Users want to edit seat positions immediately | Low | Med | We have rotation/regeneration features planned for future iteration |

---

## Notes

- This is a "finishing touch" feature - users have already done the hard work of table assignments
- Keeping scope minimal for Phase 2.1 to ship quickly
- Rotation and per-table regeneration are noted for future enhancement if users request
- Browser print is adequate for MVP; custom PDF generation can come later if needed
- Focus on Building Bridges Together's specific use case (round tables, interfaith dialogue)

---

**Next Steps:**
1. Create feature branch: `2-seating-charts-visualization`
2. Implement backend circular arrangement algorithm + endpoint
3. Write backend tests
4. Implement UI changes to TableAssignmentsPage (session dropdown, button reorganization)
5. Implement SeatingChartPage with CircularTable component
6. Add print styling
7. Write frontend tests
8. Manual testing with real BBT data
9. Create PR with demo screenshots
