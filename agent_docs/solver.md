# Solver

Implementation notes for `assignment_logic/` and the API code that feeds it. For what the
solver is *for* and which constraints are hard, see the Solver notes in `product-model.md`.

After changing solver code, reinstall it into the API's venv:
`cd api && poetry run pip install -e ../assignment_logic`. Otherwise the API keeps running the
stale copy: the source looks right and the behavior doesn't change. `inspect.getsource()` from
the API's venv shows what is actually installed.

## The two hard caps

**The solver enforces two hard caps, not soft penalties: a pairwise-repeat cap and a
whole-table overlap cap.** `assignment_logic/src/assignment_logic/capacity.py` computes a
pigeonhole *floor* for each (`compute_pairwise_cap`, `compute_overlap_lower_bound`). Each floor
is a valid lower bound but **not guaranteed achievable**, especially once couples, linked pairs
and keep-apart rules reduce the roster's real degrees of freedom.

`GroupBuilder` never trusts a floor as a hard constraint by itself. It only accepts
`pairwise_cap`/`table_overlap_cap` as *external* constructor params (skipped when `None`).
`capacity_search.find_feasible_plan` is the only thing that turns a floor into an enforced cap.
It escalates the pairwise cap (outer loop) and the overlap cap (inner loop) from their floors,
solving fresh for each combination, until one succeeds or the search exhausts.
`handle_generate_assignments` and the single-session shuffle (`regenerate_single_session`) both
go through it. There is no other path that hard-codes a computed cap.

**The probe budget is a first pass.** `probe_seconds`, `max_pairwise_tries` and
`max_overlap_tries` in `capacity_search.py` have not been validated beyond the shapes in
`docs/plans/2026-09-11-dual-cap-solver.md`'s Context section (laptop timings on the standard
~24-person BBT shape). They have never been validated against Cloud Run directly. If solves
start timing out in prod, look here first.

## Historical meeting counts

**`historical_meeting_counts` must be real counts, not just membership.** A pair that met twice
elsewhere has less remaining pairwise budget than a pair that met once. Collapsing that down to
a bare set of pairs under-restricts a downstream solve once a program's cap is above 1.
`extract_pairings_from_sessions` in `api/src/api/services/program_solve.py` returns counts for
this reason. Don't reintroduce a `set()` at a call site that feeds a hard cap.

## Symmetry breaking and shuffles

**`_add_symmetry_breaking` is only valid when every table is interchangeable.** It pins one
participant to table 0. A single-session shuffle passes `current_table_assignments`, which
breaks that symmetry: strict mode forbids each person their table number, and soft mode charges
for keeping it. With the pin on, the strict shuffle was infeasible whenever the pinned person
already sat at table 0 (always true for session 1 of a fresh plan), and the soft fallback
returned the same groups renumbered. `generate_assignments` now skips the pin whenever there are
current tables. Any new per-table input (a cost or constraint tied to a table index) must skip it
too.

"Different seating" means different groups, never different table numbers.
`_add_forbidden_table_constraints` forbids each current group, plus every group in
`forbidden_tables`, from sitting together again, in both modes. The shuffle endpoint passes
every table the session has had in the assignment set, so repeated presses don't flip between
two seatings.

## Writing solver tests

Keep them under 5 seconds: 4 to 8 people, 1 or 2 tables, 1 session is the usual shape.

**Solver tests need a roster with slack, and an optimum you can prove.** Religion and gender
spread are *hard* constraints, so a mixed roster can pin down nearly every legal partition (6
mixed people at 2 tables leaves only three), and the solver then has no freedom left to
demonstrate the behaviour under test. Make everyone identical to isolate one objective term.
Then pick a size whose best answer you can derive rather than guess: 9 people at 3 tables over
4 sessions is the affine plane AG(2,3), where every pair meets exactly once.
