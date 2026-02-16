# CLAUDE.md

## Workflow

- Don't commit to `main`. Feature branches only.
- When you learn something non-obvious (a gotcha, a pattern, a rake you stepped on), update the relevant `agent_docs/` file. If no file fits, update this file.
- When finishing feature work that changes UI, review `frontend/src/pages/HelpPage.tsx` and update docs to match.
- Before committing frontend changes, run `npm run lint` in `frontend/`.
- When a user mentions a feature idea or wish, add it to `BACKLOG.md`. Don't plan or implement backlog items unless explicitly asked.

## Development Rules

- **Don't break what you didn't touch.** Run the full test suite for any package you modify before committing.
- **Stay in your lane.** Only modify files directly relevant to your current task.
- **Keep tests small and fast.** 4-8 items, 1-2 tables, 1 session. Solver tests under 5 seconds.
- **Reinstall `assignment_logic` after changing solver code.** Run `cd api && poetry run pip install -e ../assignment_logic`.
- **Run `poetry run black src tests` before committing Python changes.**

## Build & Dev Commands

### Frontend (`frontend/`) — npm + CRA + craco

```bash
npm start                                          # Dev server (localhost:3000, proxies /api to :8000)
npm run build                                      # Production build
npm run lint                                       # ESLint (zero warnings allowed)
CI=true npm test -- --watchAll=false                # All tests (CI mode)
```

### Backend API (`api/`) — Poetry + FastAPI

```bash
poetry run uvicorn src.api.main:app --reload       # Dev server (localhost:8000)
poetry run pytest --cov=src --cov-report=term-missing  # All tests with coverage
poetry run black --check src tests                 # Format check (CI fails on this)
```

### Assignment Logic (`assignment_logic/`) — Poetry

```bash
poetry run pytest tests/ -v                        # All tests
```

## Architecture

Three independent packages (no monorepo tooling):
- `frontend/` — React 18 + TypeScript SPA (CRA + craco, Tailwind + shadcn/ui)
- `api/` — FastAPI backend (Python 3.10+, Firestore, Pydantic v2)
- `assignment_logic/` — OR-Tools CP-SAT constraint solver (local Poetry dep of `api`)

## Agent Docs (read before starting work)

| File | Read when... |
|---|---|
| `agent_docs/deployment.md` | deploying, debugging prod, Cloud Run, Netlify, env vars |
| `agent_docs/architecture.md` | adding routes, changing auth, data model, stack questions |
| `agent_docs/testing.md` | writing or debugging tests, CI failures |
| `agent_docs/frontend_design.md` | adding or modifying UI components, buttons, dialogs |

## Tool Preferences

The claude-memory plugin is there to use.
