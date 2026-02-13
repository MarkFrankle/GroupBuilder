# CLAUDE.md

## Workflow

**Upon making changes to the project that change or add to the truth of this document, update this document**

- Always make sure you're on the right branch for the right job. Don't commit to `main`. Feature branches are the way.

## Development Rules

- **Don't break what you didn't touch.** Run the FULL test suite for any package you modify before committing. If a pre-existing test fails, you have a regression — fix it without modifying the pre-existing test.
- **Stay in your lane.** Only modify files and code directly relevant to your current task. Don't delete, refactor, or "improve" code from other features or tasks.
- **Keep tests small and fast.** Unit tests should use minimal data (4-8 items, 1-2 tables, 1 session). Don't use production-scale data in unit tests. If the solver is involved, it should finish in under 5 seconds.
- **Solver tests are not benchmarks.** Test constraint correctness with small problems, not solve quality with large ones. Solve quality testing belongs in CI regression checks, not the unit test suite.
- **Reinstall `assignment_logic` after changing solver code.** It's a local Poetry path dependency of `api`. Editing source files does NOT update the installed package — run `cd api && poetry run pip install -e ../assignment_logic` after changes.

## Tool Preferences

The claude-memory plugin is there to use

## Build & Dev Commands

### Frontend (`frontend/`) — npm + CRA + craco

```bash
npm start                                          # Dev server (localhost:3000, proxies /api to :8000)
npm run build                                      # Production build
npm run lint                                       # ESLint (zero warnings allowed)
CI=true npm test -- --watchAll=false                # All tests (CI mode)
npm test -- --watchAll=false --testPathPattern="RosterPage"  # Single test file
npm test -- --watchAll=false --testNamePattern="should save" # Single test by name
```

### Backend API (`api/`) — Poetry + FastAPI

```bash
poetry run uvicorn src.api.main:app --reload       # Dev server (localhost:8000)
poetry run pytest --cov=src --cov-report=term-missing  # All tests with coverage
poetry run pytest tests/test_roster.py -v          # Single test file
poetry run pytest tests/test_roster.py::TestGetRoster::test_returns_empty_list -v  # Single test
poetry run black --check src tests                 # Format check (CI)
```

### Assignment Logic (`assignment_logic/`) — Poetry

```bash
poetry run pytest tests/ -v                        # All tests
poetry run black src/ && poetry run flake8 src/ && poetry run mypy src/  # Format + lint + types
```

## Architecture

**Three independent packages** (no monorepo tooling):

```
frontend/           → React 18 + TypeScript SPA (CRA + craco)
api/                → FastAPI backend (Python 3.10+)
assignment_logic/   → Google OR-Tools CP-SAT constraint solver (local Poetry dep of api)
```

### Frontend → Backend Connection

- Dev: `frontend/package.json` `"proxy": "http://localhost:8000"` proxies `/api/*` calls
- Prod: `REACT_APP_API_BASE_URL` env var
- All API calls go through `authenticatedFetch()` in `frontend/src/utils/apiClient.ts` which injects a Firebase Bearer token

### Authentication Flow

1. Firebase email magic-link auth (no passwords) — `sendSignInLinkToEmail` → user clicks link → `signInWithEmailLink`
2. `authenticatedFetch()` adds `Authorization: Bearer <firebase-id-token>` to every request
3. Backend `get_current_user()` dependency (`api/src/api/middleware/auth.py`) verifies token via `firebase_admin.auth.verify_id_token()`
4. Organization access checked via `OrganizationContext` (frontend) and `require_session_access` (backend)

### State Management

React Context only (no Redux):
- `AuthContext` — Firebase user, loading, signOut
- `OrganizationContext` — current org persisted to `localStorage` key `groupbuilder_current_org`

### Frontend Stack

- Tailwind CSS v3 + shadcn/ui (Radix primitives, `components.json` style: `default`, base color: `slate`)
- `@/` path alias → `src/` (configured in `craco.config.js` and `tsconfig.json`)
- shadcn/ui components live in `frontend/src/components/ui/`
- `lucide-react` for icons, `immer` for immutable updates

### Backend Stack

- Pydantic v2 (use `.model_dump()`, not `.dict()`)
- `slowapi` rate limiting (patched to no-op in tests via `conftest.py`)
- `pandas` + `openpyxl` for Excel processing
- Firestore as primary database, Redis/Upstash for legacy session storage

### Firestore Data Model

```
organizations/{orgId}/members/{userId}
organizations/{orgId}/invites/{inviteId}
organizations/{orgId}/roster/{participantId}
organizations/{orgId}/sessions/{sessionId}
organizations/{orgId}/results/{sessionId}/versions/{versionId}
bb_admins/{email}
```

### API Routers (registered in `api/src/api/main.py`)

| Router | Prefix |
|---|---|
| `upload.py` | `/api/upload` |
| `assignments.py` | `/api/assignments` |
| `admin.py` | own prefix |
| `invites.py` | own prefix |
| `user.py` | `/api/user` |
| `roster.py` | `/api/roster` |

### Routes (defined in `frontend/src/App.tsx`)

| Route | Component | Auth |
|---|---|---|
| `/login` | LoginPage | No |
| `/auth/verify` | AuthVerifyPage | No |
| `/invite/:token` | InviteAcceptPage | No |
| `/select-organization` | OrganizationSelectorPage | Yes |
| `/` | LandingPage | Yes + Org |
| `/roster` | RosterPage | Yes + Org |
| `/admin` | AdminDashboard | Yes |
| `/table-assignments` | TableAssignmentsPage | Yes + Org |
| `/table-assignments/seating` | SeatingChartPage | Yes + Org |

## CI Gotchas

- **Frontend build fails on ESLint warnings** (`CI=true` treats warnings as errors). Fix `react-hooks/exhaustive-deps` violations.
- **Backend CI** runs `poetry run pytest --cov` and `poetry run black --check src tests`.

## Test Infrastructure

- **Backend**: `conftest.py` provides `MockFirestoreClient` (in-memory), patches auth via `mock_auth` fixture, overrides `_get_org_id` dependency. Rate limiting is patched to no-op.
- **Frontend**: Jest (not vitest). Mock `@/utils/apiClient` module directly — don't mock Firebase SDK internals.

## Environment Setup

**Frontend** (`frontend/.env`, checked in): `REACT_APP_FIREBASE_API_KEY`, `REACT_APP_FIREBASE_AUTH_DOMAIN`, `REACT_APP_FIREBASE_PROJECT_ID`

**Backend** (`api/.env`, gitignored): `FIREBASE_SERVICE_ACCOUNT_PATH=../firebase-service-account.json`, `FIREBASE_PROJECT_ID=group-builder-backend`. The service account JSON file lives at repo root (gitignored).

## Deployment

- **Backend**: Google Cloud Run (`deploy.sh`, `Dockerfile`). Firebase project: `group-builder-backend`
- **Frontend**: Firebase Hosting (`firebase.json`, `.firebaserc`)
