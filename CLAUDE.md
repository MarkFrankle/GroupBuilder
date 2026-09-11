# CLAUDE.md

## Workflow

- Don't commit to `main`. Feature branches only.
- When you learn something non-obvious (a gotcha, a pattern, a rake you stepped on), add it to this file if it's a short universal rule, or to the relevant `agent_docs/` file if it's detailed reference material.
- When finishing feature work that changes UI, review `frontend/src/pages/HelpPage.tsx` and update docs to match.
- Before committing frontend changes, run `npm run lint` and `npx tsc --noEmit` in `frontend/`. ESLint and Jest don't catch TypeScript type errors — only `tsc` does.
- When a user mentions a feature idea or wish, add it to `BACKLOG.md`. Don't plan or implement backlog items unless explicitly asked.
- **Use superpowers skills for planning.** Don't write ad-hoc plans — use the writing-plans skill and save to `docs/plans/`. The user prefers the deliberative back-and-forth of the skill workflow over "here's a plan, shall I start?"
- **When closing a feature branch**, update the corresponding plan in `docs/plans/` with a status line at the top: `**Status: Implemented** — merged PR #XX`.
- **No em-dashes in prose Claude writes** (docs, Help copy, commit messages, etc.). Reformulate with a period or a colon instead. Semicolons are also suspect. Prefer splitting into two sentences.

## Development Rules

- **Don't break what you didn't touch.** Run the full test suite for any package you modify before committing.
- **Stay in your lane.** Only modify files directly relevant to your current task.
- **Keep tests small and fast.** 4-8 items, 1-2 tables, 1 session. Solver tests under 5 seconds.
- **Reinstall `assignment_logic` after changing solver code.** Run `cd api && poetry run pip install -e ../assignment_logic`.
- **Solver tests need a roster with slack, and an optimum you can prove.** Religion and
  gender spread are *hard* constraints, so a mixed roster can pin down nearly every legal
  partition — 6 mixed people at 2 tables leaves only three — and the solver then has no
  freedom left to demonstrate the behaviour under test. Make everyone identical to isolate
  one objective term. Then pick a size whose best answer you can derive rather than guess:
  9 people at 3 tables over 4 sessions is the affine plane AG(2,3), where every pair meets
  exactly once.
- **Run `poetry run black src tests` before committing Python changes.**
- **The solver enforces two hard caps, not soft penalties: a pairwise-repeat cap and a
  whole-table overlap cap.** `assignment_logic/capacity.py` computes a pigeonhole *floor*
  for each (`compute_pairwise_cap`, `compute_overlap_lower_bound`) — a valid lower bound,
  but **not guaranteed achievable**, especially once couples/linked pairs/keep-apart rules
  reduce the roster's real degrees of freedom. `GroupBuilder` never trusts a floor as a hard
  constraint by itself — it only accepts `pairwise_cap`/`table_overlap_cap` as *external*
  constructor params (skipped when `None`). `capacity_search.find_feasible_plan` is the only
  thing that turns a floor into an enforced cap: it escalates pairwise cap (outer loop) and
  overlap cap (inner loop) from their floors, solving fresh each combination, until one
  succeeds or the search exhausts. `handle_generate_assignments` and the single-session
  shuffle (`regenerate_single_session`) both go through it now — there is no other path that
  hard-codes a computed cap.
- **The overlap-cap probe budget (`probe_seconds`, `max_pairwise_tries`, `max_overlap_tries`
  in `capacity_search.py`) is a first pass, not validated beyond the shapes in
  `docs/plans/2026-09-11-dual-cap-solver.md`'s Context section (laptop timings on the
  standard ~24-person BBT shape).** Never validated against Cloud Run directly. If solves
  start timing out in prod, this is the first place to look.
- **`historical_meeting_counts` must be real counts, not just membership.** A pair that met
  twice elsewhere has less remaining pairwise budget than a pair that met once; collapsing
  that down to a bare set of pairs under-restricts a downstream solve once a program's cap is
  above 1. `api/services/program_solve.extract_pairings_from_sessions` returns counts for
  this reason — don't reintroduce a `set()` at a call site that feeds a hard cap.
- **All buttons use `variant="outline"`.** This is the app's visual style — no filled/default buttons. Use `size="sm"` for toolbars, icon + label for actions.
- **The solver never runs without an explicit user action.** No auto-resolve, no silent rebalance. The app may flag a problem; changing the plan is always something the user pressed.
- **Never modify a completed session.** Completion freezes the past — every rebuild is scoped to incomplete sessions only.
- **Print output (roster + seating) is settled.** Strong user feedback; don't redesign it.
- **Run frontend tests through `npm test`, never `npx jest` directly.** The transform config
  comes from craco, so a bare `npx jest` fails every suite with "Cannot use import statement
  outside a module" — a config problem that looks like a code problem.
- **Mock `@/utils/apiClient` in frontend tests** — don't mock Firebase SDK internals. Example: `jest.mock('@/utils/apiClient', () => ({ authenticatedFetch: (...args) => fetch(...args) }))`

- **Importing anything from `App.tsx` in a test drags in the whole route tree.** `NavBar` is
  exported from `App.tsx`, so `NavBar.test.tsx` pulls in `RosterPage` → the ESM-only `uuid`
  package, which craco's Jest does not transform. Add `jest.mock('uuid', () => ({ v4: () =>
  'mock-uuid' }))` (as `RosterPage.test.tsx` already does). Mock `@/contexts/AuthContext`,
  `@/contexts/ProgramContext`, and `@/hooks/queries` so the render doesn't need providers.

- **`user-event` v13 cannot drive a Radix `Select` or `DropdownMenu`.** `userEvent.click` on an
  option leaves the trigger unchanged, even with `skipPointerEventsCheck`, and a synthesized
  `pointerUp` does not select either. Use `fireEvent.keyDown(trigger, { key: 'Enter' })` to open and
  `fireEvent.click(option)` to choose. **`fireEvent.click` on the trigger does not open either one** —
  confirmed for `DropdownMenu` in `SessionCard.test.tsx`, so reach for `keyDown` first rather than
  treating it as a fallback. Tests touching either need `Element.prototype.scrollIntoView` stubbed —
  Radix calls it on open. See `KeepApartSection.test.tsx` and `SessionCard.test.tsx`.
- **`userEvent.type` is slow enough to blow Jest's 5s timeout.** Seven characters means seven
  keystrokes, each with its own React state update. `RosterGrid.test.tsx` timed out on
  `userEvent.type(input, 'Charlie')`, and because the timeout aborts mid-`await`, teardown left React
  broken and the **next two tests** rendered `<body><div /></body>` — a failure that looks like a
  broken component and is really a corpse. Prefer `fireEvent.change(input, { target: { value } })`:
  inputs read `e.target.value` wholesale, so per-keystroke typing exercises nothing extra. That one
  swap took the suite from 33s to 7.5s. **But check what the value change is supposed to trigger** —
  `fireEvent.change` does not focus, so a commit hanging off blur needs an explicit `.focus()` first
  and a real click away to move focus out.
- **Don't interpolate into a Radix menu label you plan to query as one string.**
  `<DropdownMenuLabel>Seat {name} at…</DropdownMenuLabel>` renders three text nodes, so
  `getByText('Seat Cara at…')` fails with "the text is broken up by multiple elements". Use a single
  template literal in the component rather than weakening the test to a function matcher.
- **`aria-live="polite"` alone is not `role="status"`.** Only `<output>` implies that role, so
  `getByRole('status')` cannot find a bare `aria-live` div — add an explicit `role="status"` if you
  want to query the live region by role. Note `NoticeStrip` also renders `role="status"`, so a page
  can have two.
- **A Radix trigger's click bubbles.** Radix opens a `DropdownMenu` on *pointerdown* and
  does not stop the subsequent `click`, so a trigger inside a container with an `onClick`
  fires that container's handler too. Verified on `AssignmentsPage`: a mouse-open of the
  History menu clears `selectedName` via the page's click-outside dismissal; a
  keyboard-open (`keyDown` Enter) does not. Any trigger whose own rendering depends on that
  state needs `onPointerDown`/`onClick` `stopPropagation`.
- **To test that mouse path, dispatch a real `MouseEvent`.** jsdom has no `PointerEvent`, so
  `fireEvent.pointerDown(el, { button: 0 })` never delivers `button` and Radix ignores it. Use
  `fireEvent(el, new MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 }))`
  then `fireEvent.click(el)`. The keyboard open masks trigger-propagation bugs entirely — it
  hid a live one where the Mark present picker unmounted the instant it opened.
- **Anything stored as a roster document id must survive `POST /roster/discard`.** Discard
  deletes every roster document and rewrites it with fresh uuids, so ids are not durable.
  `partner_id` and the program-level `keep_apart` pairs are both resolved to names before the
  delete and re-resolved after. A third such field must do the same or it silently orphans.
- **The Assignments view-controls row uses `sticky top-14` — a hardcoded match to the condensed `ProgramHeader`'s explicit `h-14` (56px, chosen to fit the `h-9` action buttons). If the header's height class changes, this offset must change with it.**
- **`GET /api/roster/canonical` already returns each participant with `keep_apart` as a resolved list of *names*** (the backend resolves the id pairs at generate time and freezes them on the assignment set). Consumers that need keep-apart on the assignments side — e.g. `planCheck.ts` — read it straight off `useCanonicalRoster`; no `useKeepApart` + id→name resolution needed. `partner` on that payload is likewise a name.
- **`GET /api/roster/canonical` also returns `absent_sessions` per participant** — derived at
  request time from the current version's per-session `absentParticipants`, not stored on
  `participant_data`. The Roster page's locked "Away" column mirrors this; the dormant
  roster-document `absent_sessions` field is not read while a set exists and may drift.
- **`Participant.partner` is one field shared by two opposite rules.** Linked
  partners (`keep_together: true`) must sit together; couples (`keep_together:
  false`) must sit apart. Any check keyed off `partner` alone — without also
  reading `keep_together` — silently applies the wrong rule to half the field's
  users. `planCheck.ts`'s couple-violation and `hasCouples` checks both gate on
  `!keep_together` for this reason.
- **A multi-select popover with checkboxes: use `DropdownMenu` + `DropdownMenuCheckboxItem`,
  not a new Popover dep.** `@radix-ui/react-popover` isn't installed. Give each checkbox item
  `onSelect={e => e.preventDefault()}` or the menu closes on the first tick. Opens in tests
  with `fireEvent.keyDown(trigger, { key: 'Enter' })`; items are `role="menuitemcheckbox"`.
  See `AwayCell.tsx`.
## Build & Dev Commands

### Frontend (`frontend/`) — npm + CRA + craco

```bash
npm start                                          # Dev server (localhost:3000, proxies /api to :8000)
npm run build                                      # Production build
npm run lint                                       # ESLint (zero warnings allowed)
npx tsc --noEmit                                   # TypeScript type-check (lint doesn't catch type errors)
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

### Firebase Emulators — local dev without hitting production

```bash
firebase emulators:start --only auth,firestore --export-on-exit=./emulator-data --import=./emulator-data
```

Start emulators FIRST, then frontend + backend. Magic link emails appear in emulator UI at http://localhost:4000 (Auth tab). Backend auto-detects emulators via `FIRESTORE_EMULATOR_HOST` and `FIREBASE_AUTH_EMULATOR_HOST` env vars in `api/.env`.

## Architecture

Three independent packages (no monorepo tooling):
- `frontend/` — React 18 + TypeScript SPA (CRA + craco, Tailwind + shadcn/ui)
- `api/` — FastAPI backend (Python 3.10+, Firestore, Pydantic v2)
- `assignment_logic/` — OR-Tools CP-SAT constraint solver (local Poetry dep of `api`)

## Agent Docs (reference material for specific tasks)

| File | Read when... |
|---|---|
| `agent_docs/product-model.md` | changing user-facing behavior, UX decisions, who the user is, what's deliberately absent |
| `agent_docs/deployment.md` | deploying, debugging prod, Cloud Run, Netlify, env vars |
| `agent_docs/architecture.md` | adding routes, changing auth, data model, stack questions |

## Product Philosophy

GroupBuilder exists to make thoughtful group mixing effortless. Two things must work well: **intuitive UI** and **reliable assignments**. When they conflict, UI wins — a perfect algorithm that confuses volunteers fails the mission.

**Before adding or changing anything, ask:**
1. Does it serve the mission?
2. Is there a third use case demanding it? (YAGNI — resist configurability "just in case")
3. Does it maintain solver correctness? (The solver is stable, established code — don't regress it, but don't over-index on it either)
4. Will it confuse a non-technical event coordinator?
5. Can we test it?

If any answer is no, defer or reject.

**Anti-patterns to avoid:**
- Clever abstractions that save a few lines of code
- Configuration options no user has asked for
- Skipping tests because "it's a small change"
- Optimizing before profiling
- Technical jargon in user-facing error messages
- Features that require documentation to discover
- Error messages that don't tell the user how to fix the problem

