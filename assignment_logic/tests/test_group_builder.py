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


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
