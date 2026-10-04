# CLAUDE.md

GroupBuilder makes thoughtful group mixing effortless for non-technical event coordinators.
When intuitive UI and solver cleverness conflict, UI wins.

## Agent docs

Read the relevant one before starting. Detailed gotchas live there, not here.

| File | Read when... |
|---|---|
| `agent_docs/product-model.md` | changing user-facing behavior, UX decisions, who the user is, what's deliberately absent |
| `agent_docs/architecture.md` | adding routes, changing auth, data model, API payloads, layout couplings |
| `agent_docs/frontend-testing.md` | writing or debugging any frontend test (Radix, user-event, mocking) |
| `agent_docs/solver.md` | touching `assignment_logic/` or anything that feeds it, or writing solver tests |
| `agent_docs/deployment.md` | deploying, debugging prod, Cloud Run, Netlify, env vars |

## Before committing

- **Frontend:** `npm run lint` and `npx tsc --noEmit` in `frontend/`. ESLint and Jest don't catch type errors. Run tests with `npm test`, never `npx jest`.
- **Python:** `poetry run black src tests`. CI fails on formatting.
- **Solver changes:** reinstall into the API venv with `cd api && poetry run pip install -e ../assignment_logic`, or the API keeps running the stale copy.
- **UI changes:** review `frontend/src/pages/HelpPage.tsx` and update it to match.

## Product invariants

Detail and reasoning in `product-model.md`.

- **The solver never runs without an explicit user action.** No auto-resolve, no silent rebalance.
- **Never modify a completed session.** Every rebuild is scoped to incomplete sessions.
- **Print output (roster + seating) is settled.** Don't redesign it.
- **All buttons use `variant="outline"`.** `size="sm"` in toolbars, icon + label for actions.

## Silent traps

Each of these fails with no error and no failing test.

- **`Participant.partner` serves two opposite rules.** Linked partners (`keep_together: true`) sit together. Couples (`keep_together: false`) sit apart. A check on `partner` that doesn't also read `keep_together` applies the wrong rule to half its users.
- **Anything that builds sessions must refuse while `roster_drafts` is non-empty.** Drafts are uploaded people not yet on the roster, so building around them silently leaves them out. `generate_from_roster` checks it. A new build path must too.
- **Anything stored as a roster document id must survive `POST /roster/discard`.** Discard rewrites every roster document with a fresh uuid. `partner_id` and the program-level `keep_apart` pairs resolve to names before the delete and back after. A new id-holding field must do the same or it orphans.
- **Name uniqueness goes through `_name_key` (backend) / `nameKey` (frontend), never a raw `==`.** Both trim, collapse spaces and lowercase, and must stay in step.
- **`historical_meeting_counts` must be real counts, not a set of pairs.** Collapsing them under-restricts any solve whose repeat cap is above 1. See `solver.md`.

## Commands

```bash
# frontend/ (CRA + craco)
npm start                                  # localhost:3000, proxies /api to :8000
npm run lint                               # zero warnings allowed
npx tsc --noEmit
CI=true npm test -- --watchAll=false

# api/ (Poetry + FastAPI)
poetry run uvicorn src.api.main:app --reload       # localhost:8000
poetry run pytest --cov=src --cov-report=term-missing
poetry run black --check src tests

# assignment_logic/ (Poetry)
poetry run pytest tests/ -v

# repo root: Firebase emulators. Start these first, then frontend and backend.
firebase emulators:start --only auth,firestore --export-on-exit=./emulator-data --import=./emulator-data
```

Magic-link emails appear in the emulator UI at http://localhost:4000 (Auth tab). The backend picks up the emulators from `FIRESTORE_EMULATOR_HOST` and `FIREBASE_AUTH_EMULATOR_HOST` in `api/.env`.
