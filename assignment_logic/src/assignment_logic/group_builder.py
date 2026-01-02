from collections import defaultdict
from ortools.sat.python import cp_model
import logging
import os

logger = logging.getLogger(__name__)


class GroupBuilder:
    def __init__(self, participants, num_tables, num_sessions, locked_assignments=None, historical_pairings=None,
                 current_table_assignments=None, pairing_window_size=None, solver_num_workers=None,
                 require_different_assignments=False):
        """
        Initialize the GroupBuilder.

        Args:
            participants: List of participant dictionaries
            num_tables: Number of tables per session
            num_sessions: Number of sessions
            locked_assignments: Pre-assigned participant placements (optional)
            historical_pairings: Set of participant pairs from previous batches (optional)
            current_table_assignments: Dict mapping participant_id -> table_number for current assignments (optional)
                                       Used to require different table assignments when regenerating
            pairing_window_size: Window size for penalizing repeat pairings (default: 3 sessions)
            solver_num_workers: Number of parallel search workers for solver (default: 4)
            require_different_assignments: If True, enforces hard constraint that participants CANNOT be assigned
                                          to their previous tables (fails if impossible)
        """
        self.participants = participants
        self.tables = range(num_tables)
        self.sessions = range(num_sessions)
        self.religions = set([participant["religion"] for participant in self.participants])
        self.genders = set([participant["gender"] for participant in self.participants])
        self.locked_assignments = locked_assignments or {}
        self.historical_pairings = historical_pairings or set()  # Pairings from previous batches
        self.current_table_assignments = current_table_assignments or {}  # Current table assignments to forbid
        self.require_different_assignments = require_different_assignments  # Hard vs soft constraint

        # Configurable solver parameters (can be overridden by env vars or constructor args)
        self.pairing_window_size = pairing_window_size or int(os.getenv("SOLVER_PAIRING_WINDOW", "3"))
        self.solver_num_workers = solver_num_workers or int(os.getenv("SOLVER_NUM_WORKERS", "4"))

    def generate_assignments(self, max_time_seconds=120) -> dict:
        logger.info(f"Setting up model for {len(self.participants)} participants, "
                   f"{len(self.tables)} tables, {len(self.sessions)} sessions")
        self.setup_model()
        logger.info("Adding constraints to model")
        self._add_constraints_to_model()
        logger.info("Adding objective functions to model")
        self._add_objective_functions_to_model()
        logger.info("Adding symmetry breaking constraints")
        self._add_symmetry_breaking()
        logger.info("Running solver")
        return self._run_solver(max_time_seconds=max_time_seconds)

    def _calculate_batch_timeouts(self, total_sessions: int, batch_size: int, max_time_seconds: float) -> list[float]:
        """
        Calculate timeout allocation for each batch.
        First batch gets 50% of time (typically hardest), rest distributed evenly.
        """
        num_batches = (total_sessions + batch_size - 1) // batch_size  # Ceiling division

        if num_batches == 1:
            return [max_time_seconds]

        first_batch_time = max_time_seconds * 0.5
        remaining_time = max_time_seconds - first_batch_time
        other_batch_time = remaining_time / (num_batches - 1)
        return [first_batch_time] + [other_batch_time] * (num_batches - 1)

    def _track_historical_pairings(self, assignment: dict, batch_start: int, batch_end: int,
                                    historical_pairings: set) -> None:
        """
        Track all pairings from newly solved sessions for future batch constraints.
        """
        session_idx = assignment["session"] - 1  # Convert to 0-indexed

        # Only track pairings from newly solved sessions (not locked ones)
        if batch_start <= session_idx < batch_end:
            for table_num, participants in assignment["tables"].items():
                # Get all pairs at this table
                for i, p1_data in enumerate(participants):
                    for p2_data in participants[i+1:]:
                        p1_id = next(p["id"] for p in self.participants if p["name"] == p1_data["name"])
                        p2_id = next(p["id"] for p in self.participants if p["name"] == p2_data["name"])
                        pair_key = tuple(sorted([p1_id, p2_id]))
                        historical_pairings.add(pair_key)

    def _lock_batch_assignments(self, assignment: dict, locked: dict) -> None:
        """
        Lock participant assignments for all sessions to prevent changes in future batches.
        """
        session_idx = assignment["session"] - 1  # Convert to 0-indexed

        for table_num, participants in assignment["tables"].items():
            table_idx = table_num - 1  # Convert to 0-indexed
            for p_data in participants:
                # Find participant ID from name
                participant_id = next(
                    p["id"] for p in self.participants
                    if p["name"] == p_data["name"]
                )
                locked[(participant_id, session_idx, table_idx)] = True

                # Also lock this participant to NOT be at other tables
                for other_table in self.tables:
                    if other_table != table_idx:
                        locked[(participant_id, session_idx, other_table)] = False

    def generate_assignments_incremental(self, batch_size=2, max_time_seconds=120) -> dict:
        """
        Generate assignments incrementally by solving sessions in batches.
        This dramatically reduces solve time by breaking the problem into smaller pieces.

        Args:
            batch_size: Number of sessions to solve at a time (default: 2)
            max_time_seconds: Total time budget to distribute across all batches (default: 120)

        Returns:
            dict: Same format as generate_assignments()
        """
        all_assignments = []
        locked = {}
        historical_pairings = set()  # Track ALL pairings from previous batches
        total_sessions = len(self.sessions)
        total_solve_time = 0
        total_branches = 0
        total_conflicts = 0

        # Calculate timeout distribution
        batch_timeouts = self._calculate_batch_timeouts(total_sessions, batch_size, max_time_seconds)
        num_batches = len(batch_timeouts)

        logger.info(f"Starting incremental solve: {len(self.participants)} participants, "
                   f"{len(self.tables)} tables, {total_sessions} sessions "
                   f"(batch size: {batch_size}, {num_batches} batches, "
                   f"timeout: {max_time_seconds}s total)")
        logger.info(f"Batch timeouts: {', '.join(f'{t:.1f}s' for t in batch_timeouts)}")

        for batch_idx, batch_start in enumerate(range(0, total_sessions, batch_size)):
            batch_end = min(batch_start + batch_size, total_sessions)
            batch_timeout = batch_timeouts[batch_idx]

            logger.info(f"=== Batch {batch_idx + 1}/{num_batches}: "
                       f"Sessions {batch_start + 1}-{batch_end} "
                       f"({batch_start} locked, {batch_end - batch_start} free, "
                       f"{len(historical_pairings)} historical pairings, "
                       f"timeout: {batch_timeout:.1f}s) ===")

            # Create a new GroupBuilder for sessions 0 through batch_end
            # This includes all previous sessions (locked) plus current batch (free)
            gb = GroupBuilder(
                self.participants,
                len(self.tables),
                batch_end,  # Only model up to end of current batch
                locked_assignments=locked,
                historical_pairings=historical_pairings
            )

            result = gb.generate_assignments(max_time_seconds=batch_timeout)

            if result["status"] != "success":
                logger.error(f"Batch {batch_idx + 1} failed: {result.get('error', 'Unknown error')}")
                return result

            # Accumulate stats
            batch_time = result.get("solve_time", 0)
            batch_branches = result.get("num_branches", 0)
            batch_conflicts = result.get("num_conflicts", 0)
            batch_quality = result.get("solution_quality", "unknown")
            batch_deviation = result.get("total_deviation")

            total_solve_time += batch_time
            total_branches += batch_branches
            total_conflicts += batch_conflicts

            # Extract assignments for this batch only (not the locked ones we already have)
            batch_assignments = [
                a for a in result["assignments"]
                if batch_start <= a["session"] - 1 < batch_end
            ]
            all_assignments.extend(batch_assignments)

            # Enhanced logging with full solver stats
            deviation_str = f"deviation: {batch_deviation}" if batch_deviation is not None else "deviation: N/A"
            logger.info(f"Batch {batch_idx + 1} complete: "
                       f"{batch_quality.upper()} in {batch_time:.2f}s | "
                       f"{deviation_str} | "
                       f"{batch_branches:,} branches | "
                       f"{batch_conflicts:,} conflicts")

            # Lock ALL sessions we've solved so far AND track historical pairings
            for assignment in result["assignments"]:
                self._track_historical_pairings(assignment, batch_start, batch_end, historical_pairings)
                self._lock_batch_assignments(assignment, locked)

        logger.info(f"Incremental solve complete: {total_solve_time:.2f}s total "
                   f"({total_branches:,} branches, {total_conflicts:,} conflicts, "
                   f"{len(historical_pairings)} unique pairings tracked)")

        # Return combined results
        return {
            "status": "success",
            "solution_quality": "incremental",
            "total_deviation": None,  # Not meaningful across incremental batches
            "solve_time": total_solve_time,
            "num_branches": total_branches,
            "num_conflicts": total_conflicts,
            "assignments": all_assignments,
        }

    def setup_model(self):
        self.model = cp_model.CpModel()

        # Decision variables
        # participant_table_assignments[(participant_id, session, table)] -> boolean
        # True if participant is sitting at that table in that session
        self.participant_table_assignments = {}
        for participant in self.participants:
            for session in self.sessions:
                for table in self.tables:
                    self.participant_table_assignments[(participant["id"], session, table)] = self.model.NewBoolVar(
                        f"assign_p{participant['id']}_s{session}_t{table}"
                    )

        # Apply locked assignments from previous batches
        self._apply_locked_assignments()

        # Log historical pairings tracking
        if self.historical_pairings:
            logger.info(f"Penalizing {len(self.historical_pairings)} historical pairings from previous batches")

    def _add_constraints_to_model(self):
        # Each participants sits at one table per session
        for p in self.participants:
            for s in self.sessions:
                self.model.Add(sum(self.participant_table_assignments[(p["id"], s, t)] for t in self.tables) == 1)

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
                    self.participant_table_assignments[(p["id"], s, t)] for p in self.participants
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

    def _add_objective_functions_to_model(self):
        # Separate couples as much as possible
        couples = defaultdict(list)
        for p in self.participants:
            if p["couple_id"]:
                couples[p["couple_id"]].append(p)

        for s in self.sessions:
            for t in self.tables:
                for group in couples.values():
                    self.model.Add(sum(self.participant_table_assignments[(p["id"], s, t)] for p in group) <= 1)

        # OPTIMIZED: Rolling window approach - penalize pairs meeting within N sessions
        # This balances sophistication with performance: better than "count all repeats",
        # simpler than complex session weighting, and matches user expectations
        # (meeting at sessions 1 & 2 is bad, but 1 & 6 is okay)

        penalty_count = 0
        for i, p1 in enumerate(self.participants):
            for p2 in self.participants[i+1:]:
                pair_key = tuple(sorted([p1["id"], p2["id"]]))  # Canonical pair representation

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
                            [self.participant_table_assignments[(p1["id"], s, t)], self.participant_table_assignments[(p2["id"], s, t)]]
                        )
                        session_meeting_vars.append(both_at_table)

                    # met_in_session = OR of all tables (did they meet at any table?)
                    pair_meets_session[s] = self.model.NewBoolVar(
                        f'pair_{p1["id"]}_{p2["id"]}_meets_s{s}'
                    )
                    self.model.AddMaxEquality(pair_meets_session[s], session_meeting_vars)

                    # HISTORY-AWARE: Penalize if this pair met in previous batches
                    if pair_key in self.historical_pairings:
                        penalty_count += pair_meets_session[s]

                # Penalize if they meet in sessions within pairing_window_size of each other
                for s1 in self.sessions:
                    for s2 in range(s1 + 1, min(s1 + self.pairing_window_size + 1, len(self.sessions))):
                        # Penalty if they meet in both s1 and s2 (which are close together)
                        both_sessions = self.model.NewBoolVar(
                            f'penalty_{p1["id"]}_{p2["id"]}_s{s1}_s{s2}'
                        )
                        self.model.AddMultiplicationEquality(
                            both_sessions,
                            [pair_meets_session[s1], pair_meets_session[s2]]
                        )
                        penalty_count += both_sessions

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
                            self.model.Add(self.participant_table_assignments[(p_id, 0, current_table)] == 0)
                logger.info(f"Added HARD constraints: {len(self.current_table_assignments)} participants "
                           f"CANNOT be assigned to their previous tables")
            else:
                # SOFT CONSTRAINT: Penalize same table assignments
                # This gives users the feeling that "something happened" when they click regenerate
                # Can be violated if the current assignment is actually optimal
                for p in self.participants:
                    p_id = p["id"]
                    if p_id in self.current_table_assignments:
                        current_table = self.current_table_assignments[p_id]
                        if 0 in self.sessions and current_table in self.tables:
                            penalty_count += self.participant_table_assignments[(p_id, 0, current_table)]

        self.model.Minimize(penalty_count)

    def _add_symmetry_breaking(self):
        """Break table symmetry by fixing first participant to first table in first session."""
        if len(self.participants) > 0 and len(self.sessions) > 0 and len(self.tables) > 0:
            first_participant_id = self.participants[0]["id"]
            self.model.Add(self.participant_table_assignments[(first_participant_id, 0, 0)] == 1)

    def _apply_locked_assignments(self):
        """Fix variables for locked sessions based on pre-assigned seating."""
        if not self.locked_assignments:
            return

        locked_count = 0
        for (p_id, s, t), value in self.locked_assignments.items():
            if (p_id, s, t) in self.participant_table_assignments:
                self.model.Add(self.participant_table_assignments[(p_id, s, t)] == (1 if value else 0))
                if value:
                    locked_count += 1

        if locked_count > 0:
            logger.info(f"Applied {locked_count} locked assignments from previous batches")

    def _run_solver(self, max_time_seconds=120):
        self.solver = cp_model.CpSolver()

        self.solver.parameters.max_time_in_seconds = float(max_time_seconds)
        self.solver.parameters.num_search_workers = self.solver_num_workers
        self.solver.parameters.log_search_progress = False

        logger.info(f"Starting CP-SAT solver (max time: {max_time_seconds:.1f}s, {self.solver.parameters.num_search_workers} workers)")
        status = self.solver.Solve(self.model)
        logger.info(f"Solver completed with status: {self.solver.StatusName(status)} "
                   f"in {self.solver.WallTime():.2f}s")

        if status in [cp_model.FEASIBLE, cp_model.OPTIMAL]:
            assignments = []

            for s in self.sessions:
                session_data = {"session": s + 1, "tables": defaultdict(list)}
                for t in self.tables:
                    for p in self.participants:
                        if self.solver.BooleanValue(self.participant_table_assignments[(p["id"], s, t)]):
                            session_data["tables"][t + 1].append(
                                {
                                    "name": p["name"],
                                    "religion": p["religion"],
                                    "gender": p["gender"],
                                    "partner": p.get("partner"),
                                }
                            )
                # Convert defaultdict to a regular dict for JSON compatibility
                session_data["tables"] = dict(session_data["tables"])
                assignments.append(session_data)

            solution_quality = "optimal" if status == cp_model.OPTIMAL else "feasible"

            try:
                objective_value = self.solver.ObjectiveValue()
                if objective_value != objective_value or objective_value == float('inf') or objective_value == float('-inf'):
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
                "error": "No solution exists with the given constraints. Try fewer sessions or more tables."
            }
        elif status == cp_model.MODEL_INVALID:
            return {
                "status": "failure",
                "error": "Internal error: Invalid constraint model."
            }
        else:
            return {
                "status": "failure",
                "error": "Solver timed out or encountered an unknown error."
            }


if __name__ == "__main__":
    # Set up logging to see the incremental progress
    logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')

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

    print("\n" + "="*60)
    print("TESTING INCREMENTAL SOLVER")
    print("="*60)

    gb = GroupBuilder(data, 4, 6)
    result = gb.generate_assignments_incremental(batch_size=2)

    print("\n" + "="*60)
    print("RESULTS")
    print("="*60)
    print(f"Status: {result['status']}")
    print(f"Solution quality: {result['solution_quality']}")
    print(f"Total solve time: {result['solve_time']:.2f}s")
    print(f"Total branches: {result['num_branches']:,}")
    print(f"Total conflicts: {result['num_conflicts']:,}")
    print(f"Sessions generated: {len(result['assignments'])}")

    # Show first session as a sanity check
    if result['assignments']:
        print(f"\nSession 1 preview:")
        for table_num, participants in result['assignments'][0]['tables'].items():
            print(f"  Table {table_num}: {', '.join(p['name'] for p in participants)}")
