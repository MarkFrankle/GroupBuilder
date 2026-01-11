# Testing Documentation

Comprehensive test suites for the GroupBuilder application.

## Overview

**Test Coverage Goals:** 70%+ across all components

**Test Framework:**
- **Backend:** pytest + FastAPI TestClient
- **Frontend:** Jest + React Testing Library

---

## Backend Tests

### Location
```
api/tests/
├── conftest.py              # Shared fixtures and test configuration
├── test_upload.py           # Upload endpoint tests (20 test cases)
├── test_assignments.py      # Assignments endpoint tests (25 test cases)
└── test_storage.py          # Storage layer tests (15 test cases)
```

### Running Backend Tests

```bash
cd api

# Run all tests
poetry run pytest

# Run with coverage report
poetry run pytest --cov=src/api --cov-report=html

# Run specific test file
poetry run pytest tests/test_upload.py

# Run specific test
poetry run pytest tests/test_upload.py::TestUploadEndpoint::test_valid_upload

# Run with verbose output
poetry run pytest -v

# Run and stop on first failure
poetry run pytest -x
```

### Backend Test Coverage

#### Upload Endpoint Tests (`test_upload.py`)
✅ **20 test cases covering:**
- Valid file uploads
- Email validation (5 invalid formats tested)
- File size limits (10MB max)
- Parameter validation (numTables: 1-10, numSessions: 1-6)
- Missing required columns
- Invalid file formats
- Too many participants (>200)
- Not enough participants for tables
- Session ID format validation
- Session data storage verification

#### Assignments Endpoint Tests (`test_assignments.py`)
✅ **25 test cases covering:**
- GET /api/assignments/ (generate)
- POST /api/assignments/regenerate/{session_id}
- GET /api/assignments/results/{session_id}
- GET /api/assignments/results/{session_id}/versions
- GET /api/assignments/sessions/{session_id}/metadata
- POST /api/assignments/sessions/{session_id}/clone
- Session ID validation across all endpoints
- Error handling (404, 400, 422)
- Email sending integration
- Version management

#### Storage Layer Tests (`test_storage.py`)
✅ **15 test cases covering:**
- InMemoryBackend CRUD operations
- TTL expiry behavior
- Pattern matching (keys with wildcards)
- Session storage functions
- Result versioning (automatic v1, v2, v3...)
- Version pruning (max 5 versions kept)
- get_result_versions (sorted newest first)
- REQUIRE_PERSISTENT_STORAGE enforcement
- Storage backend selection logic

---

## Frontend Tests

### Location
```
frontend/src/
├── utils/__tests__/
│   └── recentUploads.test.ts         # Utility tests (20 test cases)
├── components/CompactAssignments/__tests__/
│   └── CompactAssignments.test.tsx   # Component tests (25 test cases)
└── pages/__tests__/
    └── LandingPage.test.tsx          # Page tests (20 test cases)
```

### Running Frontend Tests

```bash
cd frontend

# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test recentUploads.test

# Run in watch mode (interactive)
npm test -- --watch

# Run and update snapshots
npm test -- -u
```

### Frontend Test Coverage

#### Utility Tests (`recentUploads.test.ts`)
✅ **20 test cases covering:**
- Saving upload IDs to localStorage
- Getting recent upload IDs
- Removing specific uploads
- Clearing all uploads
- Duplicate handling (moves to front)
- MAX_RECENT_UPLOADS limit (10)
- Error handling (quota exceeded, corrupted data)
- Integration workflows

#### CompactAssignments Component Tests (`CompactAssignments.test.tsx`)
✅ **25 test cases covering:**
- Rendering all sessions and participants
- Person highlighting across sessions
- Highlight message display
- Toggle highlight on click
- Person details in tooltips
- Partner information for couples
- Consistent colors for same person
- Empty state handling
- Table sorting (numerical)
- Button accessibility
- Hover states

#### LandingPage Component Tests (`LandingPage.test.tsx`)
✅ **20 test cases covering:**
- Main UI elements rendering
- Advanced Options toggle
- File upload handling
- Form submission validation
- Loading states
- Error display
- Navigation on success
- Recent uploads display
- Recent uploads cleanup (expired sessions)
- Default values
- Accessibility (labels, keyboard navigation)

---

## Test Fixtures & Mocks

### Backend Fixtures (conftest.py)

**`client`** - FastAPI TestClient for making HTTP requests
```python
def test_my_endpoint(client):
    response = client.get("/api/assignments/")
    assert response.status_code == 200
```

**`mock_storage`** - In-memory storage mock (no Redis required)
```python
def test_with_storage(mock_storage):
    mock_storage.set("key", "value")
    assert mock_storage.get("key") == "value"
```

**`sample_excel_file`** - Valid 4-participant Excel file
```python
def test_upload(client, sample_excel_file):
    response = client.post(
        "/api/upload/",
        files={"file": ("test.xlsx", sample_excel_file, "application/...")},
        data={"numTables": "2", "numSessions": "3"}
    )
```

**Other fixtures:**
- `sample_excel_file_large` - 100 participants
- `sample_excel_file_too_many` - 201 participants (over limit)
- `sample_excel_file_missing_columns` - Invalid file
- `huge_file` - 11MB file (over limit)

### Frontend Mocks

**localStorage mock:**
```typescript
// Automatically mocked in all tests
localStorage.setItem('key', 'value')
localStorage.getItem('key')
```

**fetch mock:**
```typescript
global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ data: 'value' })
})
```

**react-router-dom mock:**
```typescript
const mockNavigate = jest.fn()
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}))
```

---

## Running All Tests

### Quick Test (Backend + Frontend)

```bash
# From project root
cd api && poetry run pytest && cd ../frontend && npm test -- --watchAll=false
```

### CI/CD Integration

Both test suites are designed to run in CI environments:

**Backend:**
```bash
cd api
poetry install
poetry run pytest --cov --cov-report=xml
```

**Frontend:**
```bash
cd frontend
npm ci
npm test -- --coverage --watchAll=false
```

---

## Test Statistics

### Current Coverage

| Area | Test Files | Test Cases | Status |
|------|-----------|-----------|--------|
| Backend API | 3 | 60 | ✅ Complete |
| Frontend Utils | 1 | 20 | ✅ Complete |
| Frontend Components | 2 | 45 | ✅ Complete |
| **Total** | **6** | **125** | **✅ Complete** |

### Before vs After

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Backend Tests | 0 files | 3 files | +3 |
| Frontend Tests | 1 file (boilerplate) | 3 files | +2 useful |
| Total Test Cases | ~7 (solver only) | 125 | +1,685% |
| API Coverage | 0% | ~70% (estimated) | +70% |
| Frontend Coverage | <5% | ~60% (estimated) | +55% |

---

## Writing New Tests

### Backend Test Template

```python
"""Tests for [feature name]."""

import pytest

class Test[FeatureName]:
    """Test suite for [feature]."""

    def test_success_case(self, client, mock_storage):
        """Test successful operation."""
        response = client.get("/api/endpoint/")
        assert response.status_code == 200

    def test_error_case(self, client):
        """Test error handling."""
        response = client.get("/api/endpoint/?invalid=param")
        assert response.status_code == 400
```

### Frontend Test Template

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import MyComponent from '../MyComponent'

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />)
    expect(screen.getByText('Expected Text')).toBeInTheDocument()
  })

  it('handles user interaction', () => {
    render(<MyComponent />)
    const button = screen.getByRole('button')
    fireEvent.click(button)
    expect(screen.getByText('Updated Text')).toBeInTheDocument()
  })
})
```

---

## Debugging Tests

### Backend Debugging

**Print debug info:**
```python
def test_debug(client, mock_storage, capsys):
    response = client.get("/api/endpoint/")
    print(f"Response: {response.json()}")  # Use pytest -s to see output
    print(f"Storage: {mock_storage.data}")
```

**Use pytest debugger:**
```bash
poetry run pytest --pdb  # Drop into debugger on failure
```

### Frontend Debugging

**Use screen.debug():**
```typescript
render(<MyComponent />)
screen.debug()  // Prints entire DOM
screen.debug(screen.getByRole('button'))  // Prints specific element
```

**Check what's rendered:**
```typescript
const { container } = render(<MyComponent />)
console.log(container.innerHTML)
```

---

## Common Issues & Solutions

### Backend

**Issue:** Tests fail with "No module named 'api'"
```bash
# Solution: Run from api directory
cd api
poetry run pytest
```

**Issue:** Storage tests fail with real Redis
```bash
# Solution: Ensure mock_storage fixture is used
def test_my_feature(mock_storage):  # ← Add this parameter
    ...
```

### Frontend

**Issue:** "Cannot find module '@/components/...'"
```bash
# Solution: Check jest.config.js has correct moduleNameMapper
# Should map '@/*' to '<rootDir>/src/*'
```

**Issue:** Tests timeout
```typescript
// Solution: Use waitFor for async operations
await waitFor(() => {
  expect(screen.getByText('Loaded')).toBeInTheDocument()
})
```

---

## Next Steps

**Priority 1 - Increase Coverage:**
- [ ] Add tests for email.py (SendGrid mocking)
- [ ] Add tests for TableAssignmentsPage component
- [ ] Add integration tests (full user flows)

**Priority 2 - Test Infrastructure:**
- [ ] Set up GitHub Actions CI
- [ ] Add coverage reporting (Codecov)
- [ ] Add pre-commit hooks for test running

**Priority 3 - Advanced Testing:**
- [ ] E2E tests with Playwright/Cypress
- [ ] Load testing for solver (large participant counts)
- [ ] Visual regression testing (Percy/Chromatic)

---

## Resources

**Backend Testing:**
- [Pytest Documentation](https://docs.pytest.org/)
- [FastAPI Testing Guide](https://fastapi.tiangolo.com/tutorial/testing/)

**Frontend Testing:**
- [React Testing Library](https://testing-library.com/react)
- [Jest Documentation](https://jestjs.io/docs/getting-started)

**General:**
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
