# Testing

## Backend (`api/`)

- `conftest.py` provides `MockFirestoreClient` (in-memory), patches auth via `mock_auth` fixture, overrides `_get_org_id` dependency
- Rate limiting is patched to no-op in tests
- Run: `poetry run pytest --cov=src --cov-report=term-missing`

## Frontend (`frontend/`)

- Jest (not vitest), CRA + craco
- Run: `CI=true npm test -- --watchAll=false`
- Mock `@/utils/apiClient` module directly — don't mock Firebase SDK internals
- Example: `jest.mock('@/utils/apiClient', () => ({ authenticatedFetch: (...args) => fetch(...args) }))`

## CI Pipeline (`.github/workflows/ci.yml`)

- **Frontend**: install → test → build (`CI=true`) → lint (`--max-warnings 0`)
- **Backend**: install → test with coverage → `black --check src tests`
- **Assignment Logic**: install → test with coverage
- Both lint and black checks **fail the build**
- Frontend build also fails on ESLint warnings due to `CI=true`

## Gotchas

- Run `poetry run black src tests` before committing Python changes
- `assignment_logic` is a local Poetry path dependency — editing its source does NOT update the installed package in api's venv. Run `cd api && poetry run pip install -e ../assignment_logic` after changes
