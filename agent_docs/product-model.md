# Product Model

The durable facts about who uses GroupBuilder and how it is meant to behave. Read this
before designing or changing user-facing behavior.

Full reasoning behind everything here lives in `docs/product/assignments-redesign-notes.md`
(2026-09). This file is the conclusion; that file is the argument.

---

## Who the user is

**The modal user runs one program, once, and never comes back.** A program facilitator is
handed a tool for a single seminar series and has no reason to return afterwards.

Consequences that should drive every design decision:

- No muscle memory is ever built. Nothing may depend on "they'll learn it the second time."
- Efficiency optimizations are near worthless. Legibility on first encounter is everything.
- Guardrails matter more than usual — a mistake does not get a second run to correct.
- Rich interactions are not discoverable by exploration when someone only explores once.
  They must be taught, labelled, or made obvious.

**Secondary audiences:**

- **Admins** (Mark's parents) create and name a program when they sell it, then invite a
  facilitator. Facilitators never create programs.
- **Multi-program facilitators** are power users. Design for the single-program case; make
  the multi-program case reachable.

**Standing assumption, not a verified fact:** one facilitator per program. The admins prefer
it and are anxious about multiple editors. This underpins the absence of concurrent-editing
handling and the relaxed treatment of link sharing. If multiple facilitators per program ever
happens, revisit both.

---

## Domain model

```
Program  (created by admin, named at sale time, one facilitator invited)
  └── Setup        — participants, rules, shape (table count, session count)
  └── Assignments  — ONE canonical plan, never a list of plans
        └── Versions  — every change creates one, labelled by the action that made it
        └── Sessions  — each is complete or upcoming
              └── Tables
```

There is exactly one Assignments per program. There is no gallery of past generations —
`/groups` was deliberately deleted.

**Rules** are:
- **Linked partners** — must sit together (1:1).
- **Couples** — must sit apart (existing solver behavior).
- **Keep-apart** — arbitrary pairs that must not sit together. Many-to-many, but expect 0–1
  per program; more than 2 means the program is already failing.

---

## Invariants

These are load-bearing. Breaking one reintroduces the failure mode that caused the 2026-09
redesign.

1. **The solver never runs without an explicit user action.** No auto-resolve, no silent
   rebalance, no "we fixed it for you." Marking someone absent removes them and leaves the
   gap. The app may point out a problem; changing the plan is always something the user
   pressed.

   **Absences are always maintained.** An absence is a fact about a session, not an option on
   a rebuild. It survives every shuffle and every rebuild, and is passed to the solver as
   input. There is no checkbox — offering the choice would ask a user to discard information
   they deliberately recorded. Removing a participant removes their absences with them.

2. **Completed sessions are never modified.** Completion is a prefix cursor — finished always
   means "everything up to here." This is the property that makes every rebuild safe, and it
   is why full regeneration could be removed entirely.

   **Completion is contiguous, and enforced as such.** Time runs in order, so only the next
   open session may be completed and only the most recently completed one may be reopened.
   Stored as `completed_through: int` on the Program document rather than a list, which makes
   a gap unrepresentable instead of merely refused. A program may never have fewer sessions
   than it has completed — the reduction is refused, so a completed session can never be
   stranded with nothing on screen to reopen it from. Confirmed 2026-09-07.

   **The overview puts completed sessions last.** Live sessions ascending, then a Completed
   label, then the completed prefix collapsed to one line each. The next meeting night is the
   first thing on the page. Rejected: strict numeric order with completed rows in place —
   collapsing a card reflows the page either way, so the two cost the same and arrival-state
   won.

   **A completed session is a snapshot, so later roster edits never reach it.** Deleting a
   participant who sat at a table on a finished night does not remove them from that night —
   the session still shows them, because they were there. Assignments store fully materialized
   people; the roster is never joined back in at read time. Removing a participant also clears
   their partner's `partner_id`, and that too leaves completed sessions untouched.

   This is the intended behavior, not an implementation accident. Roster edits therefore
   accumulate a deliberate drift against what completed sessions display, and that drift is the
   invariant working. Confirmed 2026-09-06.

3. **Flag contradictions; stay quiet about quality.** A plan that violates a stated rule is
   always flagged, attributed to the specific sessions involved, with a rebuild offered. A
   plan that is merely suboptimal (a table of 5 after an absence) is never flagged. This keeps
   the product's voice rare and therefore credible.

   Quality numbers are licensed in exactly two places: the person-tracking summary and an
   action's receipt in the banner. Both show the delta in **both** directions — a number that
   only ever appears as good news is decoration.

4. **Per-session actions live on the session; per-program actions live on Setup.**
   Session-scoped: mark absent, shuffle, drag-to-move, print, mark complete.
   Program-scoped: participants, linked partners, keep-apart, facilitator status, table and
   session counts — all behind the Setup lock.

5. **Every change creates a version.** Versions are the universal safety net, which is what
   makes silent overwrites (a shuffle discarding manual swaps) tolerable.

6. **Shuffle is scoped to one session.** It does not touch other sessions. Because the solver
   is aware of the whole set, re-solving one session against the real others is at worst
   quality-neutral — so predictability costs nothing.

7. **Print output is settled.** Roster and seating printing have strong user feedback. Do not
   redesign them.

   This covers what comes out of the printer. The **pre-print notices are in scope**: printing
   seating that violates a constraint, and printing while viewing a non-current version, each
   get a one-click notice. Neither blocks, and neither ever renders on the sheet.

---

## Things deliberately removed or rejected

| Thing | Status | Why |
|---|---|---|
| `/groups` — list of past generations | **Deleted** | Users treated it as an escape hatch instead of fixing the current plan |
| Full regeneration | **Deleted as a user action** | Shuffle covers wanting different results; Setup changes drive real rebuilds. Nothing was left for it to do |
| Edit mode on assignments | **Deleted** | Fiddling is one poke, not a session with a beginning and end |
| An "unseated" participant state | **Rejected** | "Absent" would be a lie about someone who is coming, and printing it embarrasses the coordinator in the room |
| Creating keep-apart from the seating view | **Rejected** | It is a program-level change, and click is already single-select highlight — there is no gesture for selecting two people |
| Auto-rebalancing after an absence | **Rejected** | Surprise motion an hour before an event is scarier than an unbalanced table |
| A permanent quick-start link in the header | **Rejected** | Competes with Help and splits the docs into two front doors |

---

## Vocabulary

Words carry guardrails here. The safe actions must never share a verb with a dangerous one.

| Term | Meaning |
|---|---|
| **Assignments** | The canonical plan. Not "Groups" — users say assignments |
| **Setup** | The locked page holding participants, rules and shape. Formerly "Roster" |
| **Shuffle** | Re-solve one session. Low stakes, globally aware |
| **Mark complete** | Freeze a session. Collapses it out of the working area |
| **Edit setup** | Open the setup lock |
| **Save and rebuild sessions** | Commit setup changes; rebuilds incomplete sessions only. The one action that cannot be undone |
| **History** | The version list |

**Retired:** "Regenerate" as a verb for anything safe. Users hear "refresh"; we meant
"destroy and rebuild."

---

## Solver notes

- Per-session solving is **globally aware** — it optimizes against every other session. This
  is the most valuable and least understood feature in the product. UI should prove it,
  loudly, after every change ("sessions 1–2 unchanged, 0 new repeats").
- **Several constraints are hard, and infeasibility is real.** Facilitator coverage, facilitator
  balance, at most one facilitator per religion per table (`group_builder.py:394–435`), couples
  separation (`:446`), and a spread limit of one on both religion and gender across tables in
  every session (`:342–383`). A skewed roster can be infeasible with no arithmetic tell, so
  the product **refuses rather than absorbing** — it never quietly produces a plan that breaks
  a rule the user typed. Counting checks catch only the obvious shortfalls; there is
  deliberately no feasibility pre-check.
- Repeat pairings are penalized over a **rolling window** (`pairing_window_size`, default 3)
  in `assignment_logic/src/assignment_logic/group_builder.py`. Nothing counts total meetings
  per pair, so a pair meeting in sessions 1, 4 and 5 is barely penalized. A superlinear
  **global** repeat penalty is planned to close that gap.
- **The rolling window stays when the global penalty lands.** The two measure different things:
  the window encodes *spacing* (sitting together two weeks running is worse than sessions 1 and
  5), the global term encodes *total exposure*. A global count cannot express spacing, so
  deleting the window would lose it. Weight the global term to dominate — superlinear growth
  means it swamps the window by the third meeting regardless of exact values.
- General keep-apart is new solver work. Couples separation already exists, so the mechanism
  is close at hand.
