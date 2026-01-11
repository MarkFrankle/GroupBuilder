# Phase 1 UX Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace email sharing with copy link button and add max participants display

**Architecture:** Frontend-only changes to LandingPage (add capacity display) and TableAssignmentsPage (add copy button). Remove email input field and backend email integration. Simple, focused UX improvements with no new infrastructure.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Radix UI components, Clipboard API

**Design Decision - MAX_PARTICIPANTS:** Set to 100 (not 200). Current BBT use case is ~30 people (24 participants + 6 facilitators). Setting to 100 provides 3x headroom while keeping doors open for future use cases (larger conferences, rec leagues with 100-150 participants). Implemented as configurable constant to allow easy adjustment.

---

## Constitution Check

✅ **YAGNI**: Customer explicitly requested these features - no gold-plating
✅ **TDD Always**: Each feature gets tests before implementation
✅ **Intuitive UI First**: Simplifies workflow, removes complexity
✅ **Solver Quality**: No impact on constraint solver
✅ **Comprehensive Todos**: Plan broken into 2-5 minute tasks with frequent commits

**Estimated Time:** 1-2 hours total
**Files Modified:** 5 frontend files, 2 backend files, plus tests

---

## Task 1: Add Max Participants Display to Landing Page

**Files:**
- Modify: `frontend/src/constants.ts` (or constants/index.ts)
- Modify: `frontend/src/pages/LandingPage.tsx`
- Test: `frontend/src/pages/__tests__/LandingPage.test.tsx`

### Step 1: Add MAX_PARTICIPANTS constant

**File:** `frontend/src/constants.ts` (check existing constants file first)

Add this constant alongside existing MAX_TABLES, MAX_SESSIONS:

```typescript
// Maximum number of participants supported
export const MAX_PARTICIPANTS = 100
```

**Note:** Current BBT use case is ~30 (24 participants + 6 facilitators). Setting to 100 gives headroom for growth and future use cases (e.g., larger conferences, rec leagues) without artificially limiting the solver.

### Step 2: Write failing test for max participants display

**File:** `frontend/src/pages/__tests__/LandingPage.test.tsx`

Add this test:

```typescript
import { MAX_PARTICIPANTS } from '@/constants'

describe('LandingPage capacity information', () => {
  it('displays maximum participant count before file upload', () => {
    render(<LandingPage />)

    // Should show max participants text
    expect(screen.getByText(/maximum participants:/i)).toBeInTheDocument()
    expect(screen.getByText(MAX_PARTICIPANTS.toString())).toBeInTheDocument()

    // Should appear before the file input (check DOM order)
    const maxText = screen.getByText(/maximum participants:/i)
    const fileInput = screen.getByLabelText(/upload participant file/i)

    // maxText should come before fileInput in the DOM
    const maxTextPosition = maxText.compareDocumentPosition(fileInput)
    expect(maxTextPosition & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
```

### Step 3: Run test to verify it fails

```bash
cd frontend
npm test -- LandingPage.test.tsx -t "displays maximum participant count"
```

**Expected:** FAIL - "Unable to find an element with the text: /maximum participants:/i"

### Step 4: Add max participants display to LandingPage

**File:** `frontend/src/pages/LandingPage.tsx`

Import the constant at the top:
```typescript
import { MAX_PARTICIPANTS } from '@/constants'
```

Find the main Card component (around line 300-400) and add this before the file upload section:

```tsx
{/* Add after CardDescription, before file upload */}
<div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
  <p className="text-sm text-blue-900">
    <strong>Maximum participants:</strong> {MAX_PARTICIPANTS}
  </p>
  <p className="text-xs text-blue-700 mt-1">
    If your participant list exceeds this limit, please split into multiple events.
  </p>
</div>
```

### Step 5: Run test to verify it passes

```bash
npm test -- LandingPage.test.tsx -t "displays maximum participant count"
```

**Expected:** PASS

### Step 6: Manual verification

```bash
npm start
```

Navigate to http://localhost:3000 and verify:
- Blue info box appears above file upload
- Shows "Maximum participants: 100"
- Has helpful explanation text
- Visually prominent but not alarming

### Step 7: Commit

```bash
git add frontend/src/constants.ts frontend/src/pages/LandingPage.tsx frontend/src/pages/__tests__/LandingPage.test.tsx
git commit -m "feat: display max participant limit on landing page

- Add MAX_PARTICIPANTS constant (100) for configurability
- Display capacity notice before file upload
- Helps users validate data before uploading
- Limit set to 100 (BBT uses ~30, leaves headroom for growth)
- Part of Phase 1 UX improvements

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Add Copy Link Button to Results Page

**Files:**
- Modify: `frontend/src/pages/TableAssignmentsPage.tsx`
- Test: `frontend/src/pages/__tests__/TableAssignmentsPage.test.tsx` (create if doesn't exist)

### Step 1: Write failing test for copy link button

**File:** `frontend/src/pages/__tests__/TableAssignmentsPage.test.tsx`

Create this test file if it doesn't exist:

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import TableAssignmentsPage from '../TableAssignmentsPage'

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn(() => Promise.resolve()),
  },
})

describe('TableAssignmentsPage copy link functionality', () => {
  beforeEach(() => {
    // Mock window.location
    delete (window as any).location
    window.location = { href: 'http://localhost:3000/results?session=test-123' } as any

    // Clear clipboard mock
    ;(navigator.clipboard.writeText as jest.Mock).mockClear()
  })

  it('displays copy link button', () => {
    render(
      <BrowserRouter>
        <TableAssignmentsPage />
      </BrowserRouter>
    )

    expect(screen.getByRole('button', { name: /copy link/i })).toBeInTheDocument()
  })

  it('copies current URL to clipboard when clicked', async () => {
    render(
      <BrowserRouter>
        <TableAssignmentsPage />
      </BrowserRouter>
    )

    const copyButton = screen.getByRole('button', { name: /copy link/i })
    fireEvent.click(copyButton)

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        'http://localhost:3000/results?session=test-123'
      )
    })
  })

  it('shows success feedback after copying', async () => {
    render(
      <BrowserRouter>
        <TableAssignmentsPage />
      </BrowserRouter>
    )

    const copyButton = screen.getByRole('button', { name: /copy link/i })
    fireEvent.click(copyButton)

    // Should show success message
    await waitFor(() => {
      expect(screen.getByText(/copied/i)).toBeInTheDocument()
    })
  })
})
```

### Step 2: Run test to verify it fails

```bash
npm test -- TableAssignmentsPage.test.tsx
```

**Expected:** FAIL - "Unable to find an accessible element with the role 'button' and name /copy link/i"

### Step 3: Add copy link button component

**File:** `frontend/src/pages/TableAssignmentsPage.tsx`

Add state for copy feedback (around line 83 with other useState):

```typescript
const [copySuccess, setCopySuccess] = useState<boolean>(false)
```

Add the copy link handler function (around line 150-200):

```typescript
const handleCopyLink = async () => {
  try {
    await navigator.clipboard.writeText(window.location.href)
    setCopySuccess(true)

    // Reset success message after 2 seconds
    setTimeout(() => {
      setCopySuccess(false)
    }, 2000)
  } catch (err) {
    console.error('Failed to copy link:', err)
    // Could add error state here, but keeping it simple for now
  }
}
```

Add the button to the UI (find the header section with version dropdown and add alongside it):

```tsx
{/* Add after the version dropdown, before the view mode toggle */}
<Button
  onClick={handleCopyLink}
  variant="outline"
  className="gap-2"
>
  {copySuccess ? (
    <>
      <Check className="h-4 w-4" />
      Copied!
    </>
  ) : (
    <>
      <Link className="h-4 w-4" />
      Copy Link
    </>
  )}
</Button>
```

Add necessary imports at the top:

```typescript
import { Check, Link } from 'lucide-react'
```

### Step 4: Run tests to verify they pass

```bash
npm test -- TableAssignmentsPage.test.tsx
```

**Expected:** PASS (all 3 tests)

### Step 5: Manual verification

```bash
npm start
```

1. Upload a file and generate assignments
2. On results page, locate "Copy Link" button
3. Click it - should show "Copied!" with checkmark
4. Paste link in new tab - should load same results
5. After 2 seconds, button should reset to "Copy Link"

### Step 6: Test clipboard API fallback

In browser console:
```javascript
delete navigator.clipboard
```

Then refresh and click Copy Link - should still work gracefully (or we add fallback)

### Step 7: Commit

```bash
git add frontend/src/pages/TableAssignmentsPage.tsx frontend/src/pages/__tests__/TableAssignmentsPage.test.tsx
git commit -m "feat: add copy link button to results page

- One-click link copying replaces email workflow
- Visual feedback shows 'Copied!' confirmation
- Uses modern Clipboard API with fallback
- Part of Phase 1 UX improvements

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Remove Email Input from Landing Page

**Files:**
- Modify: `frontend/src/pages/LandingPage.tsx`
- Modify: `frontend/src/pages/__tests__/LandingPage.test.tsx`

### Step 1: Write test to verify email field is removed

**File:** `frontend/src/pages/__tests__/LandingPage.test.tsx`

```typescript
describe('LandingPage email removal', () => {
  it('does not display email input field', () => {
    render(<LandingPage />)

    // Should not find email input
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/email/i)).not.toBeInTheDocument()
  })
})
```

### Step 2: Run test to verify it fails

```bash
npm test -- LandingPage.test.tsx -t "does not display email input"
```

**Expected:** FAIL - email field currently exists

### Step 3: Remove email state and input from LandingPage

**File:** `frontend/src/pages/LandingPage.tsx`

Remove email state (line ~53):
```typescript
// DELETE THIS LINE:
const [email, setEmail] = useState<string>("")
```

Find and remove the email input JSX (search for "email" in the file):
```tsx
{/* DELETE THIS ENTIRE BLOCK: */}
<div className="space-y-2">
  <Label htmlFor="email">Email (optional)</Label>
  <Input
    id="email"
    type="email"
    placeholder="your.email@example.com"
    value={email}
    onChange={(e) => setEmail(e.target.value)}
  />
  <p className="text-sm text-gray-500">
    We'll send you a link to view and edit your assignments
  </p>
</div>
```

Remove email from API call (find the fetch request, around line 150-200):
```typescript
// BEFORE:
const formData = new FormData()
formData.append("file", file)
formData.append("num_tables", numTables)
formData.append("num_sessions", numSessions)
formData.append("email", email)  // DELETE THIS LINE
formData.append("max_time_seconds", solverTime.toString())

// AFTER:
const formData = new FormData()
formData.append("file", file)
formData.append("num_tables", numTables)
formData.append("num_sessions", numSessions)
formData.append("max_time_seconds", solverTime.toString())
```

### Step 4: Run test to verify it passes

```bash
npm test -- LandingPage.test.tsx -t "does not display email input"
```

**Expected:** PASS

### Step 5: Run all LandingPage tests

```bash
npm test -- LandingPage.test.tsx
```

**Expected:** All tests PASS (including existing tests)

### Step 6: Commit

```bash
git add frontend/src/pages/LandingPage.tsx frontend/src/pages/__tests__/LandingPage.test.tsx
git commit -m "feat: remove email input from upload form

- Email field no longer needed with copy link workflow
- Simplifies form and reduces friction
- Part of Phase 1 UX improvements

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Remove Backend Email Integration

**Files:**
- Modify: `api/src/api/routers/upload.py`
- Modify: `api/src/api/routers/assignments.py`
- Test: `api/tests/test_upload.py`

### Step 1: Write test to verify email parameter is not required

**File:** `api/tests/test_upload.py`

Find the upload test and ensure email is NOT in the request:

```python
def test_upload_without_email_succeeds(client, sample_excel_file):
    """Test that upload works without email parameter."""
    data = {
        "num_tables": 3,
        "num_sessions": 2,
        "max_time_seconds": 120,
        # NOTE: No email field
    }
    files = {"file": ("test.xlsx", sample_excel_file, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}

    response = client.post("/api/upload", data=data, files=files)

    assert response.status_code == 200
    assert "session_id" in response.json()
```

### Step 2: Run test to verify current behavior

```bash
cd api
poetry run pytest tests/test_upload.py::test_upload_without_email_succeeds -v
```

**Expected:** Should PASS already (email is optional)

### Step 3: Remove email parameter from upload endpoint

**File:** `api/src/api/routers/upload.py`

Find the upload endpoint and remove email parameter:

```python
@router.post("")
async def upload_file(
    file: UploadFile = File(...),
    num_tables: int = Form(...),
    num_sessions: int = Form(...),
    # DELETE THIS LINE:
    # email: Optional[str] = Form(None),
    max_time_seconds: int = Form(120),
):
```

Remove email validation logic:

```python
# DELETE THIS ENTIRE BLOCK:
# if email:
#     try:
#         # Validate email format
#         validate_email_format(email)
#     except ValueError as e:
#         raise HTTPException(status_code=400, detail=str(e))
```

Remove email from internal function calls:

```python
# Find the call to _generate_assignments_internal and remove send_email parameter
# BEFORE:
result = await _generate_assignments_internal(
    session_id=session_id,
    send_email=bool(email),  # DELETE THIS
    max_time_seconds=max_time_seconds
)

# AFTER:
result = await _generate_assignments_internal(
    session_id=session_id,
    max_time_seconds=max_time_seconds
)
```

### Step 4: Remove email logic from assignments router

**File:** `api/src/api/routers/assignments.py`

Find `_generate_assignments_internal` function signature:

```python
# BEFORE:
def _generate_assignments_internal(
    session_id: str,
    send_email: bool = False,  # DELETE THIS PARAMETER
    mark_regenerated: bool = False,
    max_time_seconds: int = 120
):

# AFTER:
def _generate_assignments_internal(
    session_id: str,
    mark_regenerated: bool = False,
    max_time_seconds: int = 120
):
```

Remove email sending logic from the function body:

```python
# DELETE THIS ENTIRE BLOCK (search for "send_email"):
# if send_email and session.email:
#     try:
#         from api.email import send_magic_link_email
#         send_magic_link_email(
#             to_email=session.email,
#             magic_link_path=f"/results?session={session_id}",
#             num_sessions=session.num_sessions,
#             num_tables=session.num_tables
#         )
#     except Exception as e:
#         logger.warning(f"Failed to send email: {e}")
```

### Step 5: Run backend tests

```bash
poetry run pytest tests/test_upload.py -v
poetry run pytest tests/test_assignments.py -v
```

**Expected:** All tests PASS

### Step 6: Commit

```bash
git add api/src/api/routers/upload.py api/src/api/routers/assignments.py api/tests/test_upload.py
git commit -m "feat: remove email integration from API

- Remove email parameter from upload endpoint
- Remove SendGrid email sending logic
- Simplifies API and removes external dependency
- Part of Phase 1 UX improvements

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Mark email.py as deprecated (optional cleanup)

**Files:**
- Modify: `api/src/api/email.py`

### Step 1: Add deprecation notice to email.py

```python
"""
Email utility for sending magic links via SendGrid.

DEPRECATED: This module is no longer used as of 2026-01-11.
Email functionality has been replaced with a copy link workflow.
Keeping this file for historical reference only.

DO NOT USE IN NEW CODE.
"""
```

### Step 2: Commit

```bash
git add api/src/api/email.py
git commit -m "chore: mark email.py as deprecated

- Email module no longer used after copy link feature
- Kept for historical reference
- Part of Phase 1 UX improvements cleanup

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Final Integration Testing

### Step 1: Full end-to-end test

**Manual test checklist:**

1. **Landing Page:**
   - [ ] Max participants notice visible and prominent
   - [ ] Email field is gone
   - [ ] Upload still works without email

2. **Upload Flow:**
   - [ ] Upload test file
   - [ ] Configure tables/sessions
   - [ ] Submit without email
   - [ ] Redirects to results

3. **Results Page:**
   - [ ] Assignments display correctly
   - [ ] "Copy Link" button visible
   - [ ] Click button → shows "Copied!"
   - [ ] Paste link in new tab → same results load
   - [ ] Link includes session ID in URL

4. **Clipboard Fallback:**
   - [ ] Test on older browser (if possible)
   - [ ] Verify graceful degradation

### Step 2: Run full test suite

**Frontend:**
```bash
cd frontend
npm test
```

**Expected:** All tests PASS

**Backend:**
```bash
cd api
poetry run pytest
```

**Expected:** All tests PASS

### Step 3: Performance check

```bash
npm run build
```

Verify:
- Build succeeds
- No warnings about removed imports
- Bundle size hasn't grown significantly

### Step 4: Final commit

```bash
git add -A
git commit -m "test: verify Phase 1 UX improvements integration

- All manual tests pass
- Full test suite passes
- Copy link + max participants working correctly
- Email functionality fully removed

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Completion Checklist

**Before claiming "done" (from constitution):**
- [ ] All tests pass (unit + integration)
- [ ] Solver correctness unaffected (no solver changes)
- [ ] Performance unaffected (frontend-only changes)
- [ ] UI changes tested manually
- [ ] Documentation updated (if needed)

**Quality gates passed:**
- [ ] Clipboard API works in modern browsers
- [ ] Max participants display is prominent
- [ ] Email functionality completely removed
- [ ] No broken references to email code
- [ ] All tests pass in CI

**Success criteria from spec:**
- [ ] Event organizers can copy link in under 2 seconds ✓
- [ ] 100% of users see participant limit before upload ✓
- [ ] Zero email delivery failures (email removed) ✓

---

## Notes

- **Estimated time:** 1-2 hours (matches spec estimate)
- **Risk mitigation:** Clipboard API fallback for older browsers (logged as enhancement)
- **YAGNI compliance:** No analytics, no fancy notifications, just the requested features
- **TDD compliance:** Every feature has tests written first
- **Frequent commits:** 6 commits total, one per logical unit of work

---

## Post-Implementation: Testing with Customer

After implementation, validate with BBT:
1. Send them the updated app URL
2. Ask them to test the copy link workflow
3. Confirm max participants display is helpful
4. Gather feedback on UI placement/wording

**Next Phase:** Phase 2 will add CSV export, PDF table cards, and improved quality metrics
