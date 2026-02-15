# Architecture

## Package Structure

```
frontend/           → React 18 + TypeScript SPA (CRA + craco)
api/                → FastAPI backend (Python 3.10+)
assignment_logic/   → Google OR-Tools CP-SAT constraint solver (local Poetry dep of api)
```

## Frontend Stack

- Tailwind CSS v3 + shadcn/ui (Radix primitives, `components.json` style: `default`, base color: `slate`)
- `@/` path alias → `src/` (configured in `craco.config.js` and `tsconfig.json`)
- shadcn/ui components live in `frontend/src/components/ui/`
- `lucide-react` for icons, `immer` for immutable updates
- React Context only (no Redux): `AuthContext` (Firebase user), `OrganizationContext` (current org in `localStorage`)

## Backend Stack

- Pydantic v2 (use `.model_dump()`, not `.dict()`)
- `slowapi` rate limiting (patched to no-op in tests via `conftest.py`)
- `pandas` + `openpyxl` for Excel processing
- Firestore as primary database, Redis/Upstash for legacy session storage

## Authentication Flow

1. Firebase email magic-link auth (no passwords) — `sendSignInLinkToEmail` → user clicks link → `signInWithEmailLink`
2. `authenticatedFetch()` adds `Authorization: Bearer <firebase-id-token>` to every request
3. Backend `get_current_user()` dependency (`api/src/api/middleware/auth.py`) verifies token via `firebase_admin.auth.verify_id_token()`
4. Organization access checked via `OrganizationContext` (frontend) and `require_session_access` (backend)
5. Admin access via `bb_admins/{email}` Firestore collection, checked by `require_bb_admin` in `api/src/api/routers/admin.py`

## Firestore Data Model

```
organizations/{orgId}/members/{userId}
organizations/{orgId}/invites/{inviteId}
organizations/{orgId}/roster/{participantId}
organizations/{orgId}/sessions/{sessionId}
organizations/{orgId}/results/{sessionId}/versions/{versionId}
bb_admins/{email}
```

## API Routers (registered in `api/src/api/main.py`)

| Router | Prefix |
|---|---|
| `upload.py` | `/api/upload` |
| `assignments.py` | `/api/assignments` |
| `admin.py` | own prefix |
| `invites.py` | own prefix |
| `user.py` | `/api/user` |
| `roster.py` | `/api/roster` |

## Frontend Routes (defined in `frontend/src/App.tsx`)

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
