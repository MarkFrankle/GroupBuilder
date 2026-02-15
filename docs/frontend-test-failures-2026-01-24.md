# Frontend Test Failures - Authentication Issue

**Date:** 2026-01-24  
**Branch:** `4-multi-tenant-authentication`  
**Status:** 11 tests failing, 75 passing

## Summary

Frontend tests are failing because components now require Firebase authentication (introduced in commit `8d2fe7c`), but the test environment doesn't provide mocked authentication. All failing tests show the same symptom: components render "Not authenticated" error state instead of the expected UI.

## Symptoms

**Test Output:**
```
Test Suites: 2 failed, 4 passed, 6 total
Tests:       11 failed, 75 passed, 86 total
```

**Common Error Pattern:**
All 11 failures occur when tests try to find UI elements that should be rendered, but instead find only an error message:

```
Unable to find role="button" and name `/detailed view/i`

Rendered DOM:
<Alert variant="destructive">
  <AlertTitle>Error</AlertTitle>
  <AlertDescription>Not authenticated</AlertDescription>
</Alert>
<Button>Back to Home</Button>
```

**Failing Tests:**
- `TableAssignmentsPage.test.tsx` - 9 failures
- `SeatingChartPage.test.tsx` - 2 failures

## Root Cause

### Call Stack
1. Test renders component (e.g., `<TableAssignmentsPage />`)
2. Component's `useEffect` calls `authenticatedFetch()`
3. `authenticatedFetch()` calls `getCurrentUserToken()` from `services/firebase`
4. `getCurrentUserToken()` returns `null` (no `auth.currentUser` in test environment)
5. `authenticatedFetch()` throws `Error('Not authenticated')`
6. Component catches error and renders error UI instead of expected content

### Code References

**apiClient.ts:10-13** (`frontend/src/utils/apiClient.ts`):
```typescript
const token = await getCurrentUserToken();

if (!token) {
  throw new Error('Not authenticated');
}
```

**firebase.ts:104-108** (`frontend/src/services/firebase.ts`):
```typescript
export async function getCurrentUserToken(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;
  
  return await user.getIdToken();
}
```

**TableAssignmentsPage.tsx:234-252** (`frontend/src/pages/TableAssignmentsPage.tsx`):
```typescript
useEffect(() => {
  async function fetchAssignments() {
    try {
      const response = await authenticatedFetch(`/api/assignments/results/${sessionId}`)
      // ...
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred')
    }
  }
  fetchAssignments()
}, [])
```

## What Changed

**Commit:** `8d2fe7c` - "feat: implement multi-tenant architecture with organization-scoped sessions"

- Added Firebase authentication requirement to all API calls
- Created `authenticatedFetch()` utility that requires a Firebase token
- Updated page components to use `authenticatedFetch()` instead of plain `fetch()`
- No test infrastructure was added to provide mocked authentication

## Attempted Fixes (All Failed)

Following systematic debugging process, tried 3 approaches before stopping:

### Attempt 1: Mock Firebase SDK modules
```typescript
// In setupTests.ts
jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(() => ({})),
}));

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({
    currentUser: { /* mock user */ },
  })),
  // ... other Firebase auth functions
}));
```
**Result:** ❌ No effect - tests still fail the same way

### Attempt 2: Mock Firebase service with relative path
```typescript
// In setupTests.ts
jest.mock('./services/firebase', () => ({
  getCurrentUserToken: jest.fn(() => Promise.resolve('mock-token')),
  // ... other exports
}));
```
**Result:** ❌ No effect - tests still fail the same way

### Attempt 3: Mock Firebase service with path alias
```typescript
// In setupTests.ts
jest.mock('@/services/firebase', () => ({
  getCurrentUserToken: jest.fn(() => Promise.resolve('mock-token')),
  // ... other exports
}));
```
**Result:** ❌ No effect - tests still fail the same way

## Investigation Needed

The mocks don't seem to be applied. Possible reasons:

1. **Jest moduleNameMapper issue:** The `@/` path alias might not be configured for Jest
   - `tsconfig.json` has `"@/*": ["src/*"]`
   - May need corresponding Jest configuration in `craco.config.js` or `jest.config.js`

2. **Module hoisting issue:** Mocks in `setupTests.ts` might not be hoisted properly
   - Try moving mocks to individual test files
   - Or create a dedicated `__mocks__` directory

3. **Import timing:** Firebase module might be imported before mock is applied
   - Check if there's a circular dependency
   - Verify mock is actually being called (add `console.log` to mock)

4. **Wrong mock target:** Maybe should mock `apiClient.ts` directly instead of `firebase.ts`
   - Bypass Firebase entirely in tests
   - Mock `authenticatedFetch` to return successful responses

## Recommended Next Steps

1. **Verify mock is applied:** Add logging to mock to confirm it's actually being used
   ```typescript
   getCurrentUserToken: jest.fn(() => {
     console.log('MOCK CALLED');
     return Promise.resolve('mock-token');
   })
   ```

2. **Check Jest configuration:** Look for `moduleNameMapper` in Craco config
   ```javascript
   // Check craco.config.js for:
   jest: {
     configure: {
       moduleNameMapper: {
         '^@/(.*)$': '<rootDir>/src/$1'
       }
     }
   }
   ```

3. **Try alternative mock location:** Create `frontend/src/services/__mocks__/firebase.ts`
   - Jest automatically uses files in `__mocks__` directories
   - More explicit than `jest.mock()` calls

4. **Mock at API client level instead:**
   ```typescript
   jest.mock('@/utils/apiClient', () => ({
     authenticatedFetch: jest.fn((url) => 
       Promise.resolve({
         ok: true,
         json: () => Promise.resolve(/* mock data */),
       })
     ),
   }));
   ```

## Working Tests (for comparison)

These tests work because they don't use components that require authentication:
- `recentUploads.test.ts` - Pure utility function tests
- `CircularTable.test.tsx` - Isolated component, no API calls
- `CompactAssignments.test.tsx` - Pure UI component with props
- `LandingPage.test.tsx` - Likely doesn't call authenticated APIs

## Environment

- **Node version:** (check with `node --version`)
- **npm version:** (check with `npm --version`)
- **Test framework:** Jest via `craco test`
- **Testing library:** `@testing-library/react`

## Files to Review

1. `frontend/src/setupTests.ts` - Current test setup with attempted mocks
2. `frontend/src/utils/apiClient.ts` - Where "Not authenticated" is thrown
3. `frontend/src/services/firebase.ts` - Where `getCurrentUserToken()` returns null
4. `frontend/craco.config.js` - May need Jest configuration
5. `frontend/package.json` - Check for Jest config section
6. `frontend/src/pages/__tests__/TableAssignmentsPage.test.tsx` - Example failing test

## Expected Outcome

After fixing, tests should:
- Mock Firebase authentication successfully
- Provide a mock token to `authenticatedFetch()`
- Allow components to render normally
- Pass all existing assertions

The fix should be minimal and focused - just providing test infrastructure for the new auth requirement, not changing component behavior.
