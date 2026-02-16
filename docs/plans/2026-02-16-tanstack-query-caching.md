# TanStack Query Caching Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add client-side caching with TanStack Query so pages show cached data instantly on revisit, eliminating loading spinners on repeat navigation.

**Architecture:** Replace the manual `useState` + `useEffect` fetch pattern across all pages with `useQuery`/`useMutation` hooks. Create a thin hooks layer (`hooks/queries/`) wrapping existing fetch functions. Mutations invalidate relevant query keys so cached data stays fresh after writes.

**Tech Stack:** `@tanstack/react-query` v5, `@tanstack/react-query-devtools` (devDep)

---

### Task 1: Install TanStack Query and add QueryClientProvider

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/src/App.tsx:1-5,80-163`

**Step 1: Install dependencies**

Run: `cd frontend && npm install @tanstack/react-query && npm install -D @tanstack/react-query-devtools`

**Step 2: Add QueryClientProvider to App.tsx**

Add imports at top of `frontend/src/App.tsx`:
```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
```

Create client above the `App` component:
```tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,  // 2 min — data under 2 min old served from cache
      gcTime: 5 * 60 * 1000,     // 5 min — unused cache entries garbage collected
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})
```

Wrap the existing JSX in `App` component — `QueryClientProvider` goes **inside** `AuthProvider` and `OrganizationProvider` but **outside** `Router`:
```tsx
const App: React.FC = () => {
  return (
    <AuthProvider>
      <OrganizationProvider>
        <QueryClientProvider client={queryClient}>
          <Router>
            <NavBar />
            <Routes>
              {/* ... existing routes unchanged ... */}
            </Routes>
          </Router>
          <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
      </OrganizationProvider>
    </AuthProvider>
  )
}
```

**Step 3: Run lint**

Run: `cd frontend && npm run lint`
Expected: 0 warnings

**Step 4: Run tests**

Run: `cd frontend && CI=true npm test -- --watchAll=false`
Expected: All pass. Tests already mock `authenticatedFetch` globally — QueryClientProvider wrapping won't break anything since page tests render components directly without the App wrapper.

**Step 5: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/App.tsx
git commit -m "feat: add TanStack Query with QueryClientProvider"
```

---

### Task 2: Create query hooks for read operations

**Files:**
- Create: `frontend/src/hooks/queries/useRoster.ts`
- Create: `frontend/src/hooks/queries/useAssignments.ts`
- Create: `frontend/src/hooks/queries/useSessions.ts`
- Create: `frontend/src/hooks/queries/useAdmin.ts`
- Create: `frontend/src/hooks/queries/index.ts`

Each hook wraps an existing fetch function with `useQuery`. No new fetch logic — reuse what exists.

**Step 1: Create `useRoster.ts`**

```tsx
import { useQuery } from '@tanstack/react-query'
import { getRoster } from '@/api/roster'

export function useRoster() {
  return useQuery({
    queryKey: ['roster'],
    queryFn: getRoster,
  })
}
```

**Step 2: Create `useAssignments.ts`**

```tsx
import { useQuery } from '@tanstack/react-query'
import { authenticatedFetch } from '@/utils/apiClient'

export function useResultVersions(sessionId: string | null) {
  return useQuery({
    queryKey: ['versions', sessionId],
    queryFn: async () => {
      const response = await authenticatedFetch(`/api/assignments/results/${sessionId}/versions`)
      if (!response.ok) throw new Error('Failed to fetch versions')
      const data = await response.json()
      return data.versions || []
    },
    enabled: !!sessionId,
  })
}

export function useAssignmentResults(sessionId: string | null, version?: string) {
  return useQuery({
    queryKey: ['results', sessionId, version ?? 'latest'],
    queryFn: async () => {
      const versionQuery = version ? `?version=${version}` : ''
      const response = await authenticatedFetch(`/api/assignments/results/${sessionId}${versionQuery}`)
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Failed to fetch assignments')
      }
      return response.json()
    },
    enabled: !!sessionId,
  })
}

export function useSessionMetadata(sessionId: string | null) {
  return useQuery({
    queryKey: ['session-metadata', sessionId],
    queryFn: async () => {
      const response = await authenticatedFetch(`/api/assignments/sessions/${sessionId}/metadata`)
      if (!response.ok) throw new Error('Failed to fetch metadata')
      return response.json()
    },
    enabled: !!sessionId,
  })
}
```

**Step 3: Create `useSessions.ts`**

```tsx
import { useQuery } from '@tanstack/react-query'
import { authenticatedFetch } from '@/utils/apiClient'

export function useSessionsList(orgId: string | null) {
  return useQuery({
    queryKey: ['sessions', orgId],
    queryFn: async () => {
      const response = await authenticatedFetch(`/api/assignments/sessions?org_id=${orgId}`)
      if (!response.ok) throw new Error('Failed to load sessions')
      return response.json()
    },
    enabled: !!orgId,
  })
}
```

**Step 4: Create `useAdmin.ts`**

```tsx
import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '@/utils/apiClient'

interface Organization {
  id: string
  name: string
  created_at: number
  member_count: number
  active?: boolean
}

interface OrgDetails {
  id: string
  name: string
  created_at: number
  created_by: string
  members: any[]
  invites: any[]
}

export function useAdminOrganizations(showInactive: boolean) {
  return useQuery({
    queryKey: ['admin-organizations', showInactive],
    queryFn: () => apiRequest<Organization[]>(`/api/admin/organizations?show_inactive=${showInactive}`),
  })
}

export function useOrgDetails(orgId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['admin-org-details', orgId],
    queryFn: () => apiRequest<OrgDetails>(`/api/admin/organizations/${orgId}`),
    enabled: enabled && !!orgId,
  })
}
```

**Step 5: Create barrel export `index.ts`**

```tsx
export { useRoster } from './useRoster'
export { useResultVersions, useAssignmentResults, useSessionMetadata } from './useAssignments'
export { useSessionsList } from './useSessions'
export { useAdminOrganizations, useOrgDetails } from './useAdmin'
```

**Step 6: Run lint**

Run: `cd frontend && npm run lint`
Expected: 0 warnings

**Step 7: Commit**

```bash
git add frontend/src/hooks/
git commit -m "feat: add TanStack Query hooks for all read operations"
```

---

### Task 3: Create test utility for QueryClientProvider wrapper

**Files:**
- Create: `frontend/src/test-utils/queryWrapper.tsx`

Tests that render components using `useQuery` need a `QueryClientProvider`. Create a reusable wrapper.

**Step 1: Create the wrapper**

```tsx
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

export function createQueryWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  })

  return function QueryWrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )
  }
}
```

**Step 2: Commit**

```bash
git add frontend/src/test-utils/
git commit -m "test: add QueryClientProvider wrapper for tests"
```

---

### Task 4: Refactor PreviousGroupsPage to use TanStack Query

This is the simplest page — ideal to establish the pattern.

**Files:**
- Modify: `frontend/src/pages/PreviousGroupsPage.tsx`

**Step 1: Refactor the component**

Replace the manual `useState`/`useEffect` pattern with `useSessionsList`:

```tsx
import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, FolderOpen } from 'lucide-react'
import { useSessionsList } from '@/hooks/queries'
import { useOrganization } from '@/contexts/OrganizationContext'

// SessionSummary interface stays the same

const PreviousGroupsPage: React.FC = () => {
  const { currentOrg } = useOrganization()
  const navigate = useNavigate()
  const { data: sessions = [], isLoading, error } = useSessionsList(currentOrg?.id ?? null)

  // Rest of JSX unchanged — replace `loading` with `isLoading`, `error` string with `error?.message`
```

Key changes:
- Remove `useState` for `sessions`, `loading`, `error`
- Remove `useEffect` fetch block
- Remove `authenticatedFetch` import
- Add `useSessionsList` import
- Use `isLoading` instead of `loading`, `error?.message` instead of `error`

**Step 2: Run lint**

Run: `cd frontend && npm run lint`

**Step 3: Run tests**

Run: `cd frontend && CI=true npm test -- --watchAll=false`
Expected: All pass. PreviousGroupsPage has no dedicated test file, so nothing specific to update. The global mock of `authenticatedFetch` still works — `useQuery` calls the same fetch functions under the hood.

**Note:** Tests that render this component will now need the `QueryClientProvider` wrapper. If any test renders `PreviousGroupsPage`, update it to use `createQueryWrapper()`.

**Step 4: Commit**

```bash
git add frontend/src/pages/PreviousGroupsPage.tsx
git commit -m "refactor: migrate PreviousGroupsPage to TanStack Query"
```

---

### Task 5: Refactor RosterPage to use TanStack Query

**Files:**
- Modify: `frontend/src/pages/RosterPage.tsx`
- Modify: `frontend/src/pages/__tests__/RosterPage.test.tsx`

**Step 1: Refactor the component**

Replace the roster loading `useEffect` with `useRoster()`:

```tsx
const { data: participants = [], isLoading: loading, error: fetchError, refetch } = useRoster()
```

Keep local `participants` state for optimistic updates (the roster has inline editing). Pattern:
- Use `useRoster()` for initial data
- Keep `useState` for local optimistic mutations
- Sync local state from query data via `useEffect` when query data changes
- After mutation success, invalidate the query to refetch

**Alternatively** (simpler): since the roster page already does optimistic updates with local state, we can keep the local `participants` state but initialize it from the query, and invalidate on mutations to keep cache in sync. This minimizes the diff.

Changes:
- Remove the `useEffect` that calls `getRoster()` directly
- Add `useRoster()` hook call
- Initialize `participants` from query data
- Mutation callbacks already call the API — add `queryClient.invalidateQueries({ queryKey: ['roster'] })` in catch/finally of mutation handlers to keep cache in sync
- Remove `getRoster` import, add `useRoster` and `useQueryClient` imports

**Step 2: Update test**

The `RosterPage` test mocks `authenticatedFetch` directly. Since `useRoster()` calls `getRoster()` which calls `authenticatedFetch`, the mock chain still works. But the component now renders inside a `QueryClientProvider`. Update `renderPage`:

```tsx
import { createQueryWrapper } from '@/test-utils/queryWrapper'

const renderPage = () => {
  const QueryWrapper = createQueryWrapper()
  return render(
    <BrowserRouter>
      <QueryWrapper>
        <RosterPage />
      </QueryWrapper>
    </BrowserRouter>
  )
}
```

**Step 3: Run lint and tests**

Run: `cd frontend && npm run lint && CI=true npm test -- --watchAll=false`

**Step 4: Commit**

```bash
git add frontend/src/pages/RosterPage.tsx frontend/src/pages/__tests__/RosterPage.test.tsx
git commit -m "refactor: migrate RosterPage to TanStack Query"
```

---

### Task 6: Refactor AdminDashboard and ManageOrgModal to use TanStack Query

**Files:**
- Modify: `frontend/src/pages/admin/AdminDashboard.tsx`
- Modify: `frontend/src/pages/admin/ManageOrgModal.tsx`

**Step 1: Refactor AdminDashboard**

Replace `loadOrganizations` callback + `useEffect` with `useAdminOrganizations(showInactive)`:

```tsx
const { data: organizations = [], isLoading: loading, error: fetchError, refetch } = useAdminOrganizations(showInactive)
```

- Sort happens in render (or add `select` option to the query)
- `handleCreateSuccess` becomes `refetch()`
- `confirmDeleteOrg` calls the API then `refetch()`
- Remove `useState` for `organizations`, `loading`, `error` (keep others)
- Remove `useCallback`, `useEffect` for loading

**Step 2: Refactor ManageOrgModal**

Replace `loadOrgDetails` callback + `useEffect` with `useOrgDetails(orgId, open)`:

```tsx
const { data: orgDetails = null, isLoading: loading, error: fetchError, refetch } = useOrgDetails(orgId, open)
```

- Mutation handlers (`handleAddInvite`, `handleRevokeInvite`, `confirmRemoveMember`) call `refetch()` instead of `loadOrgDetails()`
- Remove `useState` for `orgDetails`, `loading` (keep `error` for mutation errors)

**Step 3: Run lint and tests**

Run: `cd frontend && npm run lint && CI=true npm test -- --watchAll=false`

**Step 4: Commit**

```bash
git add frontend/src/pages/admin/AdminDashboard.tsx frontend/src/pages/admin/ManageOrgModal.tsx
git commit -m "refactor: migrate admin pages to TanStack Query"
```

---

### Task 7: Refactor TableAssignmentsPage to use TanStack Query

This is the most complex page. The approach is conservative: use `useQuery` for the initial data load and version fetching, keep local state for edit mode and UI interactions.

**Files:**
- Modify: `frontend/src/pages/TableAssignmentsPage.tsx`
- Modify: `frontend/src/pages/__tests__/TableAssignmentsPage.test.tsx`

**Step 1: Refactor data loading**

Extract sessionId from URL once at top:
```tsx
const urlParams = new URLSearchParams(window.location.search)
const sessionId = urlParams.get('session') || (window.history.state?.usr as any)?.sessionId || null
const versionParam = urlParams.get('version') || undefined
```

Replace the main `useEffect` fetch with hooks:
```tsx
const { data: versionsData } = useResultVersions(sessionId)
const [currentVersion, setCurrentVersion] = useState<string>(versionParam ?? 'latest')
const { data: fetchedAssignments, isLoading: loading, error: fetchError } = useAssignmentResults(sessionId, currentVersion !== 'latest' ? currentVersion : undefined)
```

Keep local `assignments` state (needed for edit mode mutations — swaps, absent marking, undo):
```tsx
const [assignments, setAssignments] = useState<Assignment[]>([])

useEffect(() => {
  if (fetchedAssignments) {
    setAssignments(fetchedAssignments)
  }
}, [fetchedAssignments])
```

For `availableVersions`, derive from query:
```tsx
const availableVersions = versionsData ?? []
```

For version change, just update `currentVersion` state — the query will automatically refetch with the new key.

For mutations (regenerate all, regenerate session, save edits): after success, invalidate queries:
```tsx
const queryClient = useQueryClient()

// After regenerate/save:
queryClient.invalidateQueries({ queryKey: ['versions', sessionId] })
queryClient.invalidateQueries({ queryKey: ['results', sessionId] })
```

**Step 2: Fix unauthenticated fetch calls**

Replace raw `fetch` in `handlePrintSeating` and `handleRegenerateSession` with `authenticatedFetch`:

In `handlePrintSeating` (~line 258):
```tsx
// BEFORE: const response = await fetch(`${API_BASE_URL}/api/assignments/seating/...`)
// AFTER:
const response = await authenticatedFetch(`/api/assignments/seating/${sessionId}?session=${currentSession}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ assignments: [sessionAssignment] }),
})
```

In `handleRegenerateSession` (~line 433):
```tsx
// BEFORE: const response = await fetch(`${API_BASE_URL}/api/assignments/regenerate/...`)
// AFTER:
const response = await authenticatedFetch(`/api/assignments/regenerate/${sessionId}/session/${sessionNumber}?${queryParams}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(absentParticipants),
})
```

Remove the `API_BASE_URL` import if no longer used.

**Step 3: Update test**

Wrap test renders in `QueryClientProvider`:
```tsx
import { createQueryWrapper } from '@/test-utils/queryWrapper'

// In each describe block's render:
const QueryWrapper = createQueryWrapper()
render(
  <BrowserRouter>
    <QueryWrapper>
      <TableAssignmentsPage />
    </QueryWrapper>
  </BrowserRouter>
)
```

**Step 4: Run lint and tests**

Run: `cd frontend && npm run lint && CI=true npm test -- --watchAll=false`

**Step 5: Commit**

```bash
git add frontend/src/pages/TableAssignmentsPage.tsx frontend/src/pages/__tests__/TableAssignmentsPage.test.tsx
git commit -m "refactor: migrate TableAssignmentsPage to TanStack Query

Also fixes unauthenticated fetch calls in handlePrintSeating and
handleRegenerateSession to use authenticatedFetch."
```

---

### Task 8: Refactor LandingPage to use TanStack Query

**Files:**
- Modify: `frontend/src/pages/LandingPage.tsx`
- Modify: `frontend/src/pages/__tests__/LandingPage.test.tsx`

**Step 1: Refactor the component**

The LandingPage loads metadata for each recent upload in a loop. This maps to individual `useSessionMetadata` calls, but since the number is dynamic, use `useQueries`:

```tsx
import { useQueries } from '@tanstack/react-query'
import { authenticatedFetch } from '@/utils/apiClient'

const sessionIds = getRecentUploadIds()

const metadataQueries = useQueries({
  queries: sessionIds.map(sessionId => ({
    queryKey: ['session-metadata', sessionId],
    queryFn: async () => {
      const response = await authenticatedFetch(`/api/assignments/sessions/${sessionId}/metadata`)
      if (!response.ok) {
        removeRecentUpload(sessionId)
        throw new Error('Not found')
      }
      return response.json()
    },
  })),
})

const recentUploads = metadataQueries
  .filter(q => q.isSuccess && q.data)
  .map(q => q.data)
```

Remove the `useEffect` that loads recent uploads. The `useQueries` handles it declaratively.

For the versions dropdown on recent upload selection, keep the existing `handleRecentUploadSelect` as-is (it's an on-demand fetch, not a cache concern).

**Step 2: Update test**

Wrap renders in `QueryClientProvider`:
```tsx
import { createQueryWrapper } from '@/test-utils/queryWrapper'

const renderWithRouter = (component: React.ReactElement) => {
  const QueryWrapper = createQueryWrapper()
  return render(
    <BrowserRouter>
      <QueryWrapper>
        {component}
      </QueryWrapper>
    </BrowserRouter>
  )
}
```

**Step 3: Run lint and tests**

Run: `cd frontend && npm run lint && CI=true npm test -- --watchAll=false`

**Step 4: Commit**

```bash
git add frontend/src/pages/LandingPage.tsx frontend/src/pages/__tests__/LandingPage.test.tsx
git commit -m "refactor: migrate LandingPage to TanStack Query"
```

---

### Task 9: Final verification and cleanup

**Files:**
- Possibly modify: any files with unused imports after refactoring

**Step 1: Run full lint**

Run: `cd frontend && npm run lint`

**Step 2: Run full test suite**

Run: `cd frontend && CI=true npm test -- --watchAll=false`

**Step 3: Manual smoke test**

Run: `cd frontend && npm start`

Test the caching behavior:
1. Log in, navigate to Roster page — see loading spinner (first load)
2. Navigate to Groups page — see loading spinner (first load)
3. Navigate back to Roster — **should show data instantly, no spinner**
4. Navigate back to Groups — **should show data instantly, no spinner**
5. Edit a participant on Roster — data should update, cache invalidates
6. Open Table Assignments for a session — loads once, switching versions works
7. Admin dashboard — loads org list, managing an org shows details

**Step 4: Commit any cleanup**

```bash
git add -A
git commit -m "chore: cleanup unused imports after TanStack Query migration"
```

---

## Verification Summary

| Check | Command |
|---|---|
| Lint (zero warnings) | `cd frontend && npm run lint` |
| Tests | `cd frontend && CI=true npm test -- --watchAll=false` |
| Dev server | `cd frontend && npm start` |
| Cache works | Navigate between pages, see cached data on revisit |
| Mutations invalidate | Edit roster, regenerate assignments — fresh data appears |
| Auth bug fixed | Print Seating and Regenerate Session now send auth headers |
