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
- React Context only (no Redux): `AuthContext` (Firebase user), `ProgramContext` (current program in `localStorage`)

## Backend Stack

- Pydantic v2 (use `.model_dump()`, not `.dict()`)
- `slowapi` rate limiting (patched to no-op in tests via `conftest.py`)
- `pandas` + `openpyxl` for Excel processing
- Firestore is the only database for domain data. `api/src/api/storage.py` (Upstash/Redis/in-memory KV) survives solely to back the `/health` check — see `BACKLOG.md` for the proposal to delete it.

## Authentication Flow

1. Firebase email magic-link auth (no passwords) — `sendSignInLinkToEmail` → user clicks link → `signInWithEmailLink`
2. `authenticatedFetch()` adds `Authorization: Bearer <firebase-id-token>` to every request
3. Backend `get_current_user()` dependency (`api/src/api/middleware/auth.py`) verifies token via `firebase_admin.auth.verify_id_token()`
4. Program access checked via `ProgramContext` (frontend) and `validate_program_access` (backend, `api/src/api/dependencies.py`) — a `Depends` on **every** assignments and roster route. It calls `FirestoreService.is_active_member(user_id, program_id)` (two point reads: program doc + `members/{userId}`, including an `active` check) and raises a single, deliberately uninformative `403 Not a member of this program`.
5. Admin access via `bb_admins/{email}` Firestore collection, checked by `require_bb_admin` in `api/src/api/routers/admin.py`

## Firestore Data Model

**Naming rule:** a UUID identifies an *assignment set* (a generation lineage: a frozen
roster snapshot + shape, with a chain of versions). A small integer identifies a
*session* — a meeting night, the thing people attend. Never use "session" for the lineage.

```
organizations/{programId}
    current_assignment_set_id: str | null      # only this set is ever served
    members/{userId}
    invites/{inviteId}
    roster/{participantId}
    assignment_sets/{setId}
        assignment_set_id, created_by, created_at, filename,
        num_tables, num_sessions, participant_data     # frozen roster snapshot
        versions/{versionId}
            created_at, assignments, metadata
bb_admins/{email}
```

Older assignment sets remain in Firestore but are unreachable by design: every read
resolves through the program's `current_assignment_set_id`. Access goes through
`AssignmentSetStorage` (`api/src/api/services/assignment_set_storage.py`, provider
`get_assignment_set_storage()`).

## API Routers (registered in `api/src/api/main.py`)

| Router | Prefix |
|---|---|
| `upload.py` | `/api/upload` |
| `assignments.py` | `/api/assignments` |
| `admin.py` | own prefix |
| `invites.py` | own prefix |
| `user.py` | `/api/user` |
| `roster.py` | `/api/roster` |

### Assignments + roster routes

Every route below takes `?program_id=<id>` and is gated by `validate_program_access`.
`{session_number}` is a meeting-night integer, never a UUID.

| Method | Path |
|---|---|
| GET | `/api/assignments/` |
| POST | `/api/assignments/regenerate` |
| POST | `/api/assignments/regenerate/with_absences` |
| POST | `/api/assignments/regenerate/session/{session_number}` |
| GET | `/api/assignments/results` (optional `&version=<v>`) |
| GET | `/api/assignments/results/versions` |
| POST | `/api/assignments/results/save` |
| GET | `/api/assignments/metadata` |
| POST | `/api/assignments/seating/{session_number}` |
| GET | `/api/roster/` |
| POST | `/api/roster/generate` → `{"assignment_set_id": ...}` |
| PUT | `/api/roster/{participant_id}` |
| DELETE | `/api/roster/{participant_id}` |

## Frontend Routes (defined in `frontend/src/App.tsx`)

| Route | Component | Auth |
|---|---|---|
| `/login` | LoginPage | No |
| `/auth/verify` | AuthVerifyPage | No |
| `/invite/:token` | InviteAcceptPage | No |
| `/help` | HelpPage | No |
| `/legal` | LegalPage | No |
| `/select-program` | ProgramSelectorPage | Yes |
| `/` | LandingPage | Yes + Program |
| `/roster` | RosterPage | Yes + Program |
| `/table-assignments` | TableAssignmentsPage | Yes + Program |
| `/table-assignments/seating` | SeatingChartPage | Yes + Program |
| `/table-assignments/roster-print` | RosterPrintPage | Yes + Program |
| `/admin` | AdminDashboard | Yes |
| `/admin/help` | AdminHelpPage | Yes |
| `*` | NotFoundPage | No |

Assignment-bearing pages carry `?program=<id>` in the URL (previously `?session=<uuid>`).
A shared link is adopted only if the recipient is a member of that program.

## Frontend Data Hooks

`useAssignmentSetMetadata` (`hooks/queries/useAssignments.ts`), re-exported from
`hooks/queries/index.ts`. Query keys are scoped to `programId`, not to a lineage id.

There is no route or hook that lists a program's assignment sets. A Program has exactly
one reachable set — the one its `current_assignment_set_id` points at — and older sets
have no route and appear in no URL.
