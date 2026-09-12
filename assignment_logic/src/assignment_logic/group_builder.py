from collections import defaultdict
from itertools import combinations
from ortools.sat.python import cp_model
import logging
import os

logger = logging.getLogger(__name__)


class GroupBuilder:
    def __init__(
        self,
        participants,
        num_tables,
        num_sessions,
        historical_pairings=None,
        current_table_assignments=None,
        pairing_window_size=None,
        solver_num_workers=None,
        repeat_penalty_weight=None,
        overlap_penalty_weight=None,
        require_different_assignments=False,
        total_program_sessions=None,
        historical_meeting_counts=None,
        pairwise_cap=None,
        table_overlap_cap=None,
        historical_tables=None,
        absent_ids_by_session=None,
    ):
        """
        Initialize the GroupBuilder.

        Args:
            participants: List of participant dictionaries
            num_tables: Number of tables per session
            num_sessions: Number of sessions
            historical_pairings: Set of participant pairs from previous batches (optional)
            current_table_assignments: Dict mapping participant_id -> table_number for current assignments (optional)
                                       Used to require different table assignments when regenerating
            pairing_window_size: Window size for penalizing repeat pairings (default: 3 sessions)
            solver_num_workers: Number of parallel search workers for solver (default: 4)
            repeat_penalty_weight: Extra cost charged for a pair's third and later
                                   meetings, on top of the flat per-meeting cost.
                                   Higher means repeats are spread harder (default: 5)
            overlap_penalty_weight: Cost charged per person shared between any two
                                    tables (this solve's own tables, or a table from
                                    historical_tables), on top of the hard
                                    table_overlap_cap. The cap only forbids exceeding
                                    a ceiling; this term gives the solver a reason to
                                    prefer less overlap than that ceiling when a
                                    lower-overlap arrangement exists (default: 5)
            require_different_assignments: If True, enforces hard constraint that participants CANNOT be assigned
                                          to their previous tables (fails if impossible)
        """
        self.participants = participants
        self.tables = range(num_tables)
        self.sessions = range(num_sessions)
        self.religions = set(
            [participant["religion"] for participant in self.participants]
        )
        self.genders = set([participant["gender"] for participant in self.participants])
        self.facilitator_ids = [
            p["id"] for p in participants if p.get("is_facilitator", False)
        ]
        self.historical_pairings = (
            historical_pairings or set()
        )  # Pairings from previous batches
        self.current_table_assignments = (
            current_table_assignments or {}
        )  # Current table assignments to forbid
        self.require_different_assignments = (
            require_different_assignments  # Hard vs soft constraint
        )
        self.total_program_sessions = total_program_sessions or len(self.sessions)
        # Back-compat: a bare set of pairs means "met once each."
        raw_counts = historical_meeting_counts or {}
        if isinstance(raw_counts, set):
            raw_counts = {pair: 1 for pair in raw_counts}
        self.historical_meeting_counts = raw_counts
        # Not computed internally: compute_pairwise_cap's pigeonhole floor is
        # only a provable lower bound for fully symmetric rosters. A roster
        # with couples/linked pairs can make that exact floor infeasible, so
        # the caller (capacity_search.find_feasible_plan) escalates from the
        # floor rather than this class trusting it as a hard truth.
        self.pairwise_cap = pairwise_cap
        self.table_overlap_cap = table_overlap_cap
        self.historical_tables = historical_tables or []
        # 0-indexed session -> set of participant ids absent that session.
        # A missing key means nobody is absent that session. Absent people get
        # no table-assignment variable at all for that session - there is
        # nothing to seat, so nothing to patch after the fact. See
        # program_solve.solve_program for how the router-facing, 1-indexed,
        # name-based absence_map becomes this shape.
        self.absent_ids_by_session = absent_ids_by_session or {}

        # Configurable solver parameters (can be overridden by env vars or constructor args)
        self.pairing_window_size = pairing_window_size or int(
            os.getenv("SOLVER_PAIRING_WINDOW", "3")
        )
        self.solver_num_workers = solver_num_workers or int(
            os.getenv("SOLVER_NUM_WORKERS", "4")
        )
        self.repeat_penalty_weight = repeat_penalty_weight or int(
            os.getenv("SOLVER_REPEAT_PENALTY_WEIGHT", "5")
        )
        self.overlap_penalty_weight = overlap_penalty_weight or int(
            os.getenv("SOLVER_OVERLAP_PENALTY_WEIGHT", "5")
        )

    def _present(self, session):
        """Participants seated in this session (everyone minus that session's absences)."""
        absent = self.absent_ids_by_session.get(session, set())
        return [p for p in self.participants if p["id"] not in absent]

    def generate_assignments(self, max_time_seconds=120) -> dict:
        logger.info(
            f"Setting up model for {len(self.participants)} participants, "
            f"{len(self.tables)} tables, {len(self.sessions)} sessions"
        )
        self.setup_model()
        logger.info("Adding constraints to model")
        self._add_constraints_to_model()
        logger.info("Adding objective functions to model")
        self._add_objective_functions_to_model()
        logger.info("Adding symmetry breaking constraints")
        self._add_symmetry_breaking()
        logger.info("Running solver")
        return self._run_solver(max_time_seconds=max_time_seconds)

    def setup_model(self):
        self.model = cp_model.CpModel()

        # Decision variables
        # participant_table_assignments[(participant_id, session, table)] -> boolean
        # True if participant is sitting at that table in that session
        self.participant_table_assignments = {}
        for session in self.sessions:
            for participant in self._present(session):
                for table in self.tables:
                    self.participant_table_assignments[
                        (participant["id"], session, table)
                    ] = self.model.NewBoolVar(
                        f"assign_p{participant['id']}_s{session}_t{table}"
                    )

        # Log historical pairings tracking
        if self.historical_pairings:
            logger.info(
                f"Penalizing {len(self.historical_pairings)} historical pairings from previous batches"
            )

    def _add_constraints_to_model(self):
        # Each present participant sits at one table per session
        for s in self.sessions:
            for p in self._present(s):
                self.model.Add(
                    sum(
                        self.participant_table_assignments[(p["id"], s, t)]
                        for t in self.tables
                    )
                    == 1
                )

        # All tables are within 1 participant of all other tables
        max_participants = {}
        min_participants = {}

        for s in self.sessions:
            max_participants[s] = self.model.NewIntVar(
                0, len(self.participants), f"max_participants_s{s}"
            )
            min_participants[s] = self.model.NewIntVar(
                0, len(self.participants), f"min_participants_s{s}"
            )

            for t in self.tables:
                table_participant_count = sum(
                    self.participant_table_assignments[(p["id"], s, t)]
                    for p in self.participants
                )
                self.model.Add(max_participants[s] >= table_participant_count)
                self.model.Add(min_participants[s] <= table_participant_count)

            self.model.Add(max_participants[s] - min_participants[s] <= 1)

            # No table has more than one participant from a religion than any other table
        self._add_participant_attribute_distribution_constraint(
            "religion", self.religions
        )
        # No table has more than one participant from a religion than any other table
        self._add_participant_attribute_distribution_constraint("gender", self.genders)
        self._add_facilitator_constraints()

    def _add_participant_attribute_distribution_constraint(
        self, attribute_name, attribute_set
    ) -> None:
        max_participants_per_attribute = {}
        min_participants_per_attribute = {}

        for s in self.sessions:
            for attribute_value in attribute_set:
                max_participants_per_attribute[(s, attribute_value)] = (
                    self.model.NewIntVar(
                        0,
                        len(self.participants),
                        f"max_participants_{attribute_name}_s{s}_{attribute_name[0]}{attribute_value}",
                    )
                )
                min_participants_per_attribute[(s, attribute_value)] = (
                    self.model.NewIntVar(
                        0,
                        len(self.participants),
                        f"min_participants_{attribute_name}_s{s}_{attribute_name[0]}{attribute_value}",
                    )
                )

                for t in self.tables:
                    table_participant_count_per_attribute = sum(
                        self.participant_table_assignments[(p["id"], s, t)]
                        for p in self.participants
                        if p[attribute_name] == attribute_value
                    )
                    self.model.Add(
                        max_participants_per_attribute[(s, attribute_value)]
                        >= table_participant_count_per_attribute
                    )
                    self.model.Add(
                        min_participants_per_attribute[(s, attribute_value)]
                        <= table_participant_count_per_attribute
                    )

                self.model.Add(
                    max_participants_per_attribute[(s, attribute_value)]
                    - min_participants_per_attribute[(s, attribute_value)]
                    <= 1
                )

    def _add_facilitator_constraints(self):
        """Add facilitator-specific constraints: coverage and balance."""
        if not self.facilitator_ids:
            return

        num_facilitators = len(self.facilitator_ids)
        num_tables = len(self.tables)

        # Coverage: every table has at least one facilitator per session
        for s in self.sessions:
            for t in self.tables:
                self.model.Add(
                    sum(
                        self.participant_table_assignments[(f, s, t)]
                        for f in self.facilitator_ids
                    )
                    >= 1
                )

        # Balance: facilitators spread evenly (no table has >1 more than any other)
        min_per_table = num_facilitators // num_tables
        max_per_table = min_per_table + (1 if num_facilitators % num_tables != 0 else 0)
        for s in self.sessions:
            for t in self.tables:
                facilitator_count = sum(
                    self.participant_table_assignments[(f, s, t)]
                    for f in self.facilitator_ids
                )
                self.model.Add(facilitator_count >= min_per_table)
                self.model.Add(facilitator_count <= max_per_table)

        # Religion diversity: no two facilitators at the same table share a religion
        facilitator_religions = {}
        for p in self.participants:
            if p["id"] in self.facilitator_ids:
                religion = p["religion"]
                facilitator_religions.setdefault(religion, []).append(p["id"])

        for s in self.sessions:
            for t in self.tables:
                for religion, fac_ids in facilitator_religions.items():
                    if len(fac_ids) > 1:
                        # At most 1 facilitator of this religion per table
                        self.model.Add(
                            sum(
                                self.participant_table_assignments[(f, s, t)]
                                for f in fac_ids
                            )
                            <= 1
                        )

    def _add_objective_functions_to_model(self):
        # Separate couples as much as possible
        couples = defaultdict(list)
        for p in self.participants:
            if p["couple_id"]:
                couples[p["couple_id"]].append(p)

        for s in self.sessions:
            for t in self.tables:
                for group in couples.values():
                    self.model.Add(
                        sum(
                            self.participant_table_assignments[(p["id"], s, t)]
                            for p in group
                        )
                        <= 1
                    )

        # Keep linked partners at the same table
        linked = defaultdict(list)
        for p in self.participants:
            if p.get("linked_id"):
                linked[p["linked_id"]].append(p)

        for s in self.sessions:
            for group in linked.values():
                if len(group) == 2:
                    p1, p2 = group
                    for t in self.tables:
                        self.model.Add(
                            self.participant_table_assignments[(p1["id"], s, t)]
                            == self.participant_table_assignments[(p2["id"], s, t)]
                        )

        linked_pair_ids = {
            tuple(sorted((group[0]["id"], group[1]["id"])))
            for group in linked.values()
            if len(group) == 2
        }

        # Keep-apart pairs: the same shape as couples separation above, but
        # driven by an explicit rule rather than by a partnership. Hard, like
        # couples - the tool does not quietly produce a plan that breaks a rule
        # the user typed. Infeasible is refused upstream, not absorbed.
        #
        # The field is intended to be symmetric - Task 3 derives it from the
        # stored id-pair list on every freeze - but this code does not depend
        # on that, because it reads both directions. Sorted tuples dedupe the
        # two directions.
        name_to_id = {p["name"]: p["id"] for p in self.participants}
        keep_apart_pairs = set()
        for p in self.participants:
            for other_name in p.get("keep_apart") or []:
                other_id = name_to_id.get(other_name)
                # A rule naming someone no longer on the roster is dropped
                # rather than raising: the roster is the authority on who
                # exists, and the pair is retired with the person.
                if other_id is None or other_id == p["id"]:
                    continue
                keep_apart_pairs.add(tuple(sorted((p["id"], other_id))))

        for s in self.sessions:
            for t in self.tables:
                for a, b in keep_apart_pairs:
                    self.model.Add(
                        self.participant_table_assignments[(a, s, t)]
                        + self.participant_table_assignments[(b, s, t)]
                        <= 1
                    )

        # OPTIMIZED: Rolling window approach - penalize pairs meeting within N sessions
        # This balances sophistication with performance: better than "count all repeats",
        # simpler than complex session weighting, and matches user expectations
        # (meeting at sessions 1 & 2 is bad, but 1 & 6 is okay)

        penalty_count = 0
        for i, p1 in enumerate(self.participants):
            for p2 in self.participants[i + 1 :]:
                pair_key = tuple(
                    sorted([p1["id"], p2["id"]])
                )  # Canonical pair representation

                # For each session, track if this pair meets (across all tables)
                pair_meets_session = {}
                for s in self.sessions:
                    # Did they meet in session s? (at any table)
                    session_meeting_vars = []
                    for t in self.tables:
                        both_at_table = self.model.NewBoolVar(
                            f'both_{p1["id"]}_{p2["id"]}_s{s}_t{t}'
                        )
                        self.model.AddMultiplicationEquality(
                            both_at_table,
                            [
                                self.participant_table_assignments[(p1["id"], s, t)],
                                self.participant_table_assignments[(p2["id"], s, t)],
                            ],
                        )
                        session_meeting_vars.append(both_at_table)

                    # met_in_session = OR of all tables (did they meet at any table?)
                    pair_meets_session[s] = self.model.NewBoolVar(
                        f'pair_{p1["id"]}_{p2["id"]}_meets_s{s}'
                    )
                    self.model.AddMaxEquality(
                        pair_meets_session[s], session_meeting_vars
                    )

                    # HISTORY-AWARE: Penalize if this pair met in previous batches
                    if pair_key in self.historical_pairings:
                        penalty_count += pair_meets_session[s]

                # Penalize if they meet in sessions within pairing_window_size of each other
                for s1 in self.sessions:
                    for s2 in range(
                        s1 + 1,
                        min(s1 + self.pairing_window_size + 1, len(self.sessions)),
                    ):
                        # Penalty if they meet in both s1 and s2 (which are close together)
                        both_sessions = self.model.NewBoolVar(
                            f'penalty_{p1["id"]}_{p2["id"]}_s{s1}_s{s2}'
                        )
                        self.model.AddMultiplicationEquality(
                            both_sessions,
                            [pair_meets_session[s1], pair_meets_session[s2]],
                        )
                        penalty_count += both_sessions

                # HISTORICAL REPEAT: the rolling-window penalty above only
                # compares sessions *within this solve's own session range*
                # (self.sessions) - for a single-session regenerate that
                # range has exactly one session, so the window loop above
                # never executes and this pair's prior history outside this
                # solve is otherwise invisible to the objective. This term
                # gives the solver a reason to prefer not repeating a pair
                # even when nothing in this solve's own sessions is close
                # enough to compare, which is the common case for a
                # single-session shuffle. Weight escalates with how many
                # times they've already met, echoing repeat_penalty_weight's
                # documented "extra cost for third and later meetings"
                # (meeting once before -> this would be the 2nd meeting,
                # costs weight * 1; meeting twice before -> 3rd meeting,
                # costs weight * 2). Skipped for linked pairs, same as the
                # pairwise cap below - they're pinned together by a hard
                # constraint, so "repeat" isn't a meaningful idea for them.
                already_met = self.historical_meeting_counts.get(pair_key, 0)
                if already_met > 0 and pair_key not in linked_pair_ids:
                    for s in self.sessions:
                        penalty_count += (
                            self.repeat_penalty_weight
                            * already_met
                            * pair_meets_session[s]
                        )

                # TOTAL BUDGET: hard-cap how many times this pair can meet at
                # all, rather than merely penalizing repeats, when the caller
                # supplies a cap. The value is an external search parameter,
                # not derived here - capacity.compute_pairwise_cap's floor is
                # only a valid *lower bound* to start searching from, not a
                # guaranteed-achievable target once couples/linked pairs
                # reduce the roster's degrees of freedom. Skipped entirely
                # when pairwise_cap is None, same as table_overlap_cap.
                # Linked pairs are exempt - they're pinned together every
                # session by the hard constraint above, so "meetings" isn't
                # a meaningful budget for them.
                total_meetings = self.model.NewIntVar(
                    0, len(self.sessions), f'meetings_{p1["id"]}_{p2["id"]}'
                )
                self.model.Add(
                    total_meetings == sum(pair_meets_session[s] for s in self.sessions)
                )

                if self.pairwise_cap is not None and pair_key not in linked_pair_ids:
                    already_met = self.historical_meeting_counts.get(pair_key, 0)
                    remaining_budget = max(0, self.pairwise_cap - already_met)
                    self.model.Add(total_meetings <= remaining_budget)

        # VARIETY-SEEKING: Prevent or penalize same table assignments as current (when regenerating)
        if self.current_table_assignments:
            if self.require_different_assignments:
                # HARD CONSTRAINT: Participants MUST be assigned to different tables than before
                # Used when user explicitly regenerates a session - they want something different
                for p in self.participants:
                    p_id = p["id"]
                    if p_id in self.current_table_assignments:
                        current_table = self.current_table_assignments[p_id]
                        # Forbid assignment to same table in session 0 (only regenerating one session)
                        # Note: When regenerating, num_sessions=1, so we only check session 0
                        if 0 in self.sessions and current_table in self.tables:
                            self.model.Add(
                                self.participant_table_assignments[
                                    (p_id, 0, current_table)
                                ]
                                == 0
                            )
                logger.info(
                    f"Added HARD constraints: {len(self.current_table_assignments)} participants "
                    f"CANNOT be assigned to their previous tables"
                )

                # The per-participant constraint above only forbids each
                # person's own previous table *index* - it does nothing to
                # stop a whole table's membership from moving verbatim to a
                # different index, which reads as "nothing changed" even
                # though it technically satisfies the constraint. Forbid
                # each previous table's full membership from landing
                # together at any table in the new session.
                previous_tables = defaultdict(list)
                for p_id, table_number in self.current_table_assignments.items():
                    previous_tables[table_number].append(p_id)
                if 0 in self.sessions:
                    for members in previous_tables.values():
                        if len(members) < 2:
                            continue
                        for t in self.tables:
                            self.model.Add(
                                sum(
                                    self.participant_table_assignments[(p_id, 0, t)]
                                    for p_id in members
                                )
                                <= len(members) - 1
                            )
            else:
                # SOFT CONSTRAINT: Penalize same table assignments
                # This gives users the feeling that "something happened" when they click regenerate
                # Can be violated if the current assignment is actually optimal
                for p in self.participants:
                    p_id = p["id"]
                    if p_id in self.current_table_assignments:
                        current_table = self.current_table_assignments[p_id]
                        if 0 in self.sessions and current_table in self.tables:
                            penalty_count += self.participant_table_assignments[
                                (p_id, 0, current_table)
                            ]

        # WHOLE-TABLE OVERLAP: cap how many people any two tables can share,
        # whether both tables are in this solve (compared across every pair
        # of distinct sessions - same-session tables can't overlap, a person
        # sits at exactly one table per session) or one is from outside this
        # solve entirely (historical_tables, for single-session regeneration
        # against sessions this solve doesn't get to re-derive).
        #
        # The cap above is a pure ceiling - it forbids exceeding
        # table_overlap_cap but does nothing to prefer less overlap among
        # cap-compliant arrangements, the same gap the historical-repeat term
        # above fixes for pairwise meetings. overlap_penalty_weight charges a
        # per-shared-person cost on top of the cap so the solver has a real
        # reason to pick the lower-overlap arrangement when one exists.
        if self.table_overlap_cap is not None:
            for s1, s2 in combinations(self.sessions, 2):
                for t1 in self.tables:
                    for t2 in self.tables:
                        both_slots = []
                        for p in self.participants:
                            both = self.model.NewBoolVar(
                                f'overlap_{p["id"]}_s{s1}t{t1}_s{s2}t{t2}'
                            )
                            self.model.AddMultiplicationEquality(
                                both,
                                [
                                    self.participant_table_assignments[
                                        (p["id"], s1, t1)
                                    ],
                                    self.participant_table_assignments[
                                        (p["id"], s2, t2)
                                    ],
                                ],
                            )
                            both_slots.append(both)
                        self.model.Add(sum(both_slots) <= self.table_overlap_cap)
                        penalty_count += self.overlap_penalty_weight * sum(both_slots)

            for s in self.sessions:
                for t in self.tables:
                    for hist_table in self.historical_tables:
                        overlap_count = sum(
                            self.participant_table_assignments[(p["id"], s, t)]
                            for p in self.participants
                            if p["id"] in hist_table
                        )
                        self.model.Add(overlap_count <= self.table_overlap_cap)
                        penalty_count += self.overlap_penalty_weight * overlap_count

        self.model.Minimize(penalty_count)

    def _add_symmetry_breaking(self):
        """Break table symmetry by fixing first participant to first table in first session."""
        if (
            len(self.participants) > 0
            and len(self.sessions) > 0
            and len(self.tables) > 0
        ):
            first_participant_id = self.participants[0]["id"]
            self.model.Add(
                self.participant_table_assignments[(first_participant_id, 0, 0)] == 1
            )

    def _run_solver(self, max_time_seconds=120):
        import random

        self.solver = cp_model.CpSolver()

        self.solver.parameters.max_time_in_seconds = float(max_time_seconds)
        self.solver.parameters.num_search_workers = self.solver_num_workers
        self.solver.parameters.log_search_progress = False
        self.solver.parameters.random_seed = random.randint(0, 2**31 - 1)

        logger.info(
            f"Starting CP-SAT solver (max time: {max_time_seconds:.1f}s, {self.solver.parameters.num_search_workers} workers)"
        )
        status = self.solver.Solve(self.model)
        logger.info(
            f"Solver completed with status: {self.solver.StatusName(status)} "
            f"in {self.solver.WallTime():.2f}s"
        )

        if status in [cp_model.FEASIBLE, cp_model.OPTIMAL]:
            assignments = []

            for s in self.sessions:
                session_data = {"session": s + 1, "tables": defaultdict(list)}
                for t in self.tables:
                    for p in self.participants:
                        if self.solver.BooleanValue(
                            self.participant_table_assignments[(p["id"], s, t)]
                        ):
                            session_data["tables"][t + 1].append(
                                {
                                    "name": p["name"],
                                    "religion": p["religion"],
                                    "gender": p["gender"],
                                    "partner": p.get("partner"),
                                    "is_facilitator": p.get("is_facilitator", False),
                                    "keep_together": p.get("keep_together", False),
                                }
                            )
                # Convert defaultdict to a regular dict for JSON compatibility
                session_data["tables"] = dict(session_data["tables"])
                assignments.append(session_data)

            solution_quality = "optimal" if status == cp_model.OPTIMAL else "feasible"

            try:
                objective_value = self.solver.ObjectiveValue()
                if (
                    objective_value != objective_value
                    or objective_value == float("inf")
                    or objective_value == float("-inf")
                ):
                    objective_value = None
            except (RuntimeError, AttributeError):
                # ObjectiveValue() may not be available for all solution types
                objective_value = None

            return {
                "status": "success",
                "solution_quality": solution_quality,
                "total_deviation": objective_value,
                "solve_time": self.solver.WallTime(),
                "num_branches": self.solver.NumBranches(),
                "num_conflicts": self.solver.NumConflicts(),
                "assignments": assignments,
            }
        elif status == cp_model.INFEASIBLE:
            return {
                "status": "failure",
                "error": "No solution exists with the given constraints. Try fewer sessions or more tables.",
            }
        elif status == cp_model.MODEL_INVALID:
            return {
                "status": "failure",
                "error": "Internal error: Invalid constraint model.",
            }
        else:
            return {
                "status": "failure",
                "error": "Solver timed out or encountered an unknown error.",
            }


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

    data = [
        {
            "id": 1,
            "name": "John Doe",
            "religion": "Christian",
            "gender": "Male",
            "couple_id": 1,
        },
        {
            "id": 2,
            "name": "Jane Doe",
            "religion": "Christian",
            "gender": "Female",
            "couple_id": 1,
        },
        {
            "id": 3,
            "name": "Ali Hassan",
            "religion": "Muslim",
            "gender": "Male",
            "couple_id": None,
        },
        {
            "id": 4,
            "name": "Rachel Green",
            "religion": "Jewish",
            "gender": "Female",
            "couple_id": 2,
        },
        {
            "id": 5,
            "name": "Ross Green",
            "religion": "Jewish",
            "gender": "Male",
            "couple_id": 2,
        },
        {
            "id": 6,
            "name": "Chandler Bing",
            "religion": "other",
            "gender": "Male",
            "couple_id": None,
        },
        {
            "id": 7,
            "name": "Monica",
            "religion": "Muslim",
            "gender": "Female",
            "couple_id": None,
        },
        {
            "id": 8,
            "name": "Joey",
            "religion": "Jewish",
            "gender": "Male",
            "couple_id": None,
        },
        {
            "id": 9,
            "name": "Phoebe",
            "religion": "Christian",
            "gender": "Female",
            "couple_id": None,
        },
        {
            "id": 10,
            "name": "Akshay",
            "religion": "Muslim",
            "gender": "Male",
            "couple_id": None,
        },
    ]

    print("\n" + "=" * 60)
    print("TESTING SOLVER")
    print("=" * 60)

    gb = GroupBuilder(data, 4, 6)
    result = gb.generate_assignments()

    print("\n" + "=" * 60)
    print("RESULTS")
    print("=" * 60)
    print(f"Status: {result['status']}")
    if result["status"] == "success":
        print(f"Solution quality: {result['solution_quality']}")
        print(f"Total solve time: {result['solve_time']:.2f}s")
        print(f"Total branches: {result['num_branches']:,}")
        print(f"Total conflicts: {result['num_conflicts']:,}")
        print(f"Sessions generated: {len(result['assignments'])}")

    # Show first session as a sanity check
    if result["assignments"]:
        print(f"\nSession 1 preview:")
        for table_num, participants in result["assignments"][0]["tables"].items():
            print(f"  Table {table_num}: {', '.join(p['name'] for p in participants)}")
