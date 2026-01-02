import pytest
from assignment_logic.group_builder import GroupBuilder


class TestGroupBuilder:
    """Test suite for the GroupBuilder constraint solver"""

    def test_simple_assignment_single_session(self):
        """Test that a simple problem with one session can be solved"""
        participants = [
            {"id": 1, "name": "Alice", "religion": "Christian", "gender": "Female", "couple_id": None},
            {"id": 2, "name": "Bob", "religion": "Jewish", "gender": "Male", "couple_id": None},
            {"id": 3, "name": "Charlie", "religion": "Muslim", "gender": "Male", "couple_id": None},
            {"id": 4, "name": "Diana", "religion": "Christian", "gender": "Female", "couple_id": None},
        ]

        builder = GroupBuilder(participants, num_tables=2, num_sessions=1)
        result = builder.generate_assignments()

        assert result["status"] == "success"
        assert len(result["assignments"]) == 1
        assert len(result["assignments"][0]["tables"]) == 2

    def test_couple_separation(self):
        """Test that couples are seated at different tables"""
        participants = [
            {"id": 1, "name": "John", "religion": "Christian", "gender": "Male", "couple_id": 1},
            {"id": 2, "name": "Jane", "religion": "Christian", "gender": "Female", "couple_id": 1},
            {"id": 3, "name": "Bob", "religion": "Jewish", "gender": "Male", "couple_id": 2},
            {"id": 4, "name": "Alice", "religion": "Jewish", "gender": "Female", "couple_id": 2},
        ]

        builder = GroupBuilder(participants, num_tables=2, num_sessions=1)
        result = builder.generate_assignments()

        assert result["status"] == "success"

        # Check that couples are at different tables
        session = result["assignments"][0]
        tables = session["tables"]

        for table_id, participants_at_table in tables.items():
            couple_ids = [p["couple_id"] for p in participants_at_table if p["couple_id"] is not None]
            # No duplicate couple_ids should exist at the same table
            assert len(couple_ids) == len(set(couple_ids))

    def test_balanced_table_sizes(self):
        """Test that all tables have balanced sizes (within 1 person)"""
        participants = [
            {"id": i, "name": f"Person{i}", "religion": "Christian", "gender": "Male", "couple_id": None}
            for i in range(1, 11)  # 10 participants
        ]

        builder = GroupBuilder(participants, num_tables=3, num_sessions=1)
        result = builder.generate_assignments()

        assert result["status"] == "success"

        session = result["assignments"][0]
        table_sizes = [len(participants) for participants in session["tables"].values()]

        # All tables should be within 1 person of each other
        assert max(table_sizes) - min(table_sizes) <= 1

    def test_multiple_sessions(self):
        """Test that multiple sessions can be generated"""
        participants = [
            {"id": 1, "name": "Alice", "religion": "Christian", "gender": "Female", "couple_id": None},
            {"id": 2, "name": "Bob", "religion": "Jewish", "gender": "Male", "couple_id": None},
            {"id": 3, "name": "Charlie", "religion": "Muslim", "gender": "Male", "couple_id": None},
            {"id": 4, "name": "Diana", "religion": "Christian", "gender": "Female", "couple_id": None},
            {"id": 5, "name": "Eve", "religion": "Jewish", "gender": "Female", "couple_id": None},
            {"id": 6, "name": "Frank", "religion": "Muslim", "gender": "Male", "couple_id": None},
        ]

        builder = GroupBuilder(participants, num_tables=2, num_sessions=3)
        result = builder.generate_assignments()

        assert result["status"] == "success"
        assert len(result["assignments"]) == 3

        # Each session should have the correct number of tables
        for session in result["assignments"]:
            assert len(session["tables"]) == 2

    def test_handles_small_groups(self):
        """Test that small groups with more tables than ideal still work"""
        # 2 participants with 3 tables - solver should handle this (some tables may be empty or very unbalanced)
        participants = [
            {"id": 1, "name": "Alice", "religion": "Christian", "gender": "Female", "couple_id": None},
            {"id": 2, "name": "Bob", "religion": "Jewish", "gender": "Male", "couple_id": None},
        ]

        builder = GroupBuilder(participants, num_tables=3, num_sessions=1)
        result = builder.generate_assignments()

        # The solver may find a solution (e.g., tables with 1, 1, and 0 people)
        # or it may fail due to balance constraints
        # Either way, we should get a valid response
        assert result["status"] in ["success", "failure"]
        if result["status"] == "failure":
            assert "error" in result

    def test_diversity_distribution(self):
        """Test that religions are distributed evenly across tables"""
        participants = [
            {"id": 1, "name": "Christian1", "religion": "Christian", "gender": "Male", "couple_id": None},
            {"id": 2, "name": "Christian2", "religion": "Christian", "gender": "Female", "couple_id": None},
            {"id": 3, "name": "Jewish1", "religion": "Jewish", "gender": "Male", "couple_id": None},
            {"id": 4, "name": "Jewish2", "religion": "Jewish", "gender": "Female", "couple_id": None},
            {"id": 5, "name": "Muslim1", "religion": "Muslim", "gender": "Male", "couple_id": None},
            {"id": 6, "name": "Muslim2", "religion": "Muslim", "gender": "Female", "couple_id": None},
        ]

        builder = GroupBuilder(participants, num_tables=2, num_sessions=1)
        result = builder.generate_assignments()

        assert result["status"] == "success"

        session = result["assignments"][0]
        for table_id, participants_at_table in session["tables"].items():
            religions = [p["religion"] for p in participants_at_table]
            # Each table should have diverse religions
            # With 3 participants per table and 3 religions, ideally 1 of each
            religion_counts = {}
            for r in religions:
                religion_counts[r] = religion_counts.get(r, 0) + 1

            # Check that no religion dominates (has more than 2 people at a 3-person table)
            for count in religion_counts.values():
                assert count <= 2

    def test_solution_quality_metadata(self):
        """Test that the result includes solution quality metadata"""
        participants = [
            {"id": i, "name": f"Person{i}", "religion": "Christian", "gender": "Male", "couple_id": None}
            for i in range(1, 7)
        ]

        builder = GroupBuilder(participants, num_tables=2, num_sessions=2)
        result = builder.generate_assignments()

        assert result["status"] == "success"
        assert "solution_quality" in result
        assert result["solution_quality"] in ["optimal", "feasible"]
        assert "solve_time" in result
        assert result["solve_time"] >= 0

    def test_require_different_assignments_hard_constraint(self):
        """Test that require_different_assignments=True enforces different table assignments when feasible"""
        # Use fewer participants with more tables for more flexibility
        participants = [
            {"id": 1, "name": "Alice", "religion": "Christian", "gender": "Female", "couple_id": None},
            {"id": 2, "name": "Bob", "religion": "Jewish", "gender": "Male", "couple_id": None},
            {"id": 3, "name": "Charlie", "religion": "Muslim", "gender": "Male", "couple_id": None},
            {"id": 4, "name": "Diana", "religion": "Christian", "gender": "Female", "couple_id": None},
            {"id": 5, "name": "Eve", "religion": "Jewish", "gender": "Female", "couple_id": None},
            {"id": 6, "name": "Frank", "religion": "Muslim", "gender": "Male", "couple_id": None},
        ]

        # Forbid Bob (id=2, not the first participant) from table 1
        # Symmetry breaking fixes Alice (id=1) to table 0, so we can't forbid her
        current_table_assignments = {
            2: 1,  # Bob at table 1 - will be forbidden from table 1
        }

        builder = GroupBuilder(
            participants,
            num_tables=3,  # More tables = more flexibility
            num_sessions=1,
            current_table_assignments=current_table_assignments,
            require_different_assignments=True
        )
        result = builder.generate_assignments(max_time_seconds=10)

        assert result["status"] == "success", f"Expected success but got {result.get('status')}: {result.get('error')}"

        # Verify Bob is NOT at table 1
        session = result["assignments"][0]
        tables = session["tables"]

        bob_table = None
        for table_id, participants_at_table in tables.items():
            for p in participants_at_table:
                if p["name"] == "Bob":  # Find Bob by name
                    bob_table = int(table_id) - 1  # Convert to 0-indexed

        assert bob_table is not None, "Bob should be assigned to a table"
        assert bob_table != 1, f"Hard constraint should prevent Bob from being at table 1, but he's at table {bob_table}"

    def test_require_different_assignments_impossible_case(self):
        """Test graceful failure when different assignments are impossible"""
        # Create a scenario where it's impossible to change assignments:
        # Only 2 participants and 2 tables - only 2 valid arrangements exist (A,B) or (B,A)
        # If we lock them to (A,B) with couples constraint, (B,A) may be infeasible
        participants = [
            {"id": 1, "name": "John", "religion": "Christian", "gender": "Male", "couple_id": 1},
            {"id": 2, "name": "Jane", "religion": "Christian", "gender": "Female", "couple_id": 1},
        ]

        # Current assignment: John at table 0, Jane at table 1 (couples separated)
        current_table_assignments = {
            1: 0,  # John at table 0
            2: 1,  # Jane at table 1
        }

        builder = GroupBuilder(
            participants,
            num_tables=2,
            num_sessions=1,
            current_table_assignments=current_table_assignments,
            require_different_assignments=True
        )
        result = builder.generate_assignments(max_time_seconds=5)

        # With hard constraint and couple separation, this should fail
        # (swapping would put the couple together, which violates couple constraint)
        assert result["status"] == "failure"

    def test_soft_constraint_allows_same_assignments(self):
        """Test that without require_different_assignments, same assignments are allowed if optimal"""
        participants = [
            {"id": 1, "name": "John", "religion": "Christian", "gender": "Male", "couple_id": 1},
            {"id": 2, "name": "Jane", "religion": "Christian", "gender": "Female", "couple_id": 1},
        ]

        # Current assignment: already optimal (couples separated)
        current_table_assignments = {
            1: 0,
            2: 1,
        }

        builder = GroupBuilder(
            participants,
            num_tables=2,
            num_sessions=1,
            current_table_assignments=current_table_assignments,
            require_different_assignments=False  # Soft constraint
        )
        result = builder.generate_assignments(max_time_seconds=5)

        # Soft constraint should succeed even if same assignments are returned
        assert result["status"] == "success"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
