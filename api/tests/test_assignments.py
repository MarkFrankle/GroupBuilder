"""
Tests for the /api/assignments/ endpoints.

Tests cover:
- GET /api/assignments/ (generate assignments)
- POST /api/assignments/regenerate/{session_id}
- GET /api/assignments/results/{session_id}
- GET /api/assignments/results/{session_id}/versions
- GET /api/assignments/sessions/{session_id}/metadata
- POST /api/assignments/sessions/{session_id}/clone
"""

import pytest
from unittest.mock import patch, MagicMock
import uuid
from datetime import datetime


@pytest.fixture
def sample_session_data():
    """Sample session data for testing."""
    return {
        "participant_dict": [
            {"id": 1, "name": "Alice", "religion": "Christian", "gender": "Female", "couple_id": None},
            {"id": 2, "name": "Bob", "religion": "Jewish", "gender": "Male", "couple_id": None},
            {"id": 3, "name": "Charlie", "religion": "Muslim", "gender": "Male", "couple_id": None},
            {"id": 4, "name": "Diana", "religion": "Christian", "gender": "Female", "couple_id": None},
        ],
        "num_tables": 2,
        "num_sessions": 2,
        "filename": "test.xlsx",
        "created_at": datetime.now().isoformat()
    }


@pytest.fixture
def sample_assignments_result():
    """Sample successful assignment result."""
    return {
        "status": "success",
        "solution_quality": "optimal",
        "total_deviation": 0,
        "solve_time": 1.5,
        "num_branches": 100,
        "num_conflicts": 10,
        "assignments": [
            {
                "session": 1,
                "tables": {
                    "1": [
                        {"name": "Alice", "religion": "Christian", "gender": "Female", "partner": None},
                        {"name": "Bob", "religion": "Jewish", "gender": "Male", "partner": None}
                    ],
                    "2": [
                        {"name": "Charlie", "religion": "Muslim", "gender": "Male", "partner": None},
                        {"name": "Diana", "religion": "Christian", "gender": "Female", "partner": None}
                    ]
                }
            },
            {
                "session": 2,
                "tables": {
                    "1": [
                        {"name": "Charlie", "religion": "Muslim", "gender": "Male", "partner": None},
                        {"name": "Bob", "religion": "Jewish", "gender": "Male", "partner": None}
                    ],
                    "2": [
                        {"name": "Alice", "religion": "Christian", "gender": "Female", "partner": None},
                        {"name": "Diana", "religion": "Christian", "gender": "Female", "partner": None}
                    ]
                }
            }
        ]
    }


class TestGetAssignments:
    """Test suite for GET /api/assignments/ endpoint."""

    @patch('api.routers.assignments.handle_generate_assignments')
    def test_generate_assignments_success(self, mock_generate, client, mock_storage, sample_session_data, sample_assignments_result):
        """Test successful assignment generation."""
        session_id = str(uuid.uuid4())
        mock_storage.data[f"session:{session_id}"] = sample_session_data
        mock_generate.return_value = sample_assignments_result

        response = client.get(f"/api/assignments/?session_id={session_id}")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2  # 2 sessions
        assert data[0]["session"] == 1
        assert len(data[0]["tables"]) == 2

        # Verify result was stored
        assert f"result:{session_id}:latest" in mock_storage.data

    def test_generate_assignments_session_not_found(self, client, mock_storage):
        """Test that nonexistent session returns 404."""
        fake_session_id = str(uuid.uuid4())

        response = client.get(f"/api/assignments/?session_id={fake_session_id}")

        assert response.status_code == 404
        assert "Session not found" in response.json()["detail"]

    def test_generate_assignments_invalid_session_id(self, client, mock_storage):
        """Test that invalid session ID format returns 422."""
        invalid_ids = [
            "not-a-uuid",
            "12345",
            "../../etc/passwd",
            "x" * 100,
        ]

        for invalid_id in invalid_ids:
            response = client.get(f"/api/assignments/?session_id={invalid_id}")
            assert response.status_code == 422, f"Invalid ID '{invalid_id}' should return 422"

    @patch('api.routers.assignments.handle_generate_assignments')
    def test_generate_assignments_solver_failure(self, mock_generate, client, mock_storage, sample_session_data):
        """Test handling of solver failures."""
        session_id = str(uuid.uuid4())
        mock_storage.data[f"session:{session_id}"] = sample_session_data
        mock_generate.return_value = {
            "status": "failure",
            "error": "No feasible solution found"
        }

        response = client.get(f"/api/assignments/?session_id={session_id}")

        assert response.status_code == 400
        assert "No feasible solution" in response.json()["detail"]

class TestRegenerateAssignments:
    """Test suite for POST /api/assignments/regenerate/{session_id} endpoint."""

    @patch('api.routers.assignments.handle_generate_assignments')
    def test_regenerate_success(self, mock_generate, client, mock_storage, sample_session_data, sample_assignments_result):
        """Test successful regeneration."""
        session_id = str(uuid.uuid4())
        mock_storage.data[f"session:{session_id}"] = sample_session_data
        mock_generate.return_value = sample_assignments_result

        response = client.post(f"/api/assignments/regenerate/{session_id}")

        assert response.status_code == 200
        data = response.json()
        assert "assignments" in data
        assert "version_id" in data

    def test_regenerate_session_not_found(self, client, mock_storage):
        """Test regeneration of expired session."""
        fake_session_id = str(uuid.uuid4())

        response = client.post(f"/api/assignments/regenerate/{fake_session_id}")

        assert response.status_code == 404
        assert "Session expired" in response.json()["detail"]

    def test_regenerate_invalid_session_id(self, client):
        """Test regeneration with invalid session ID."""
        response = client.post("/api/assignments/regenerate/not-a-uuid")

        assert response.status_code == 422


class TestGetCachedResults:
    """Test suite for GET /api/assignments/results/{session_id} endpoint."""

    def test_get_results_success(self, client, mock_storage, sample_assignments_result):
        """Test retrieving cached results."""
        session_id = str(uuid.uuid4())
        mock_storage.data[f"result:{session_id}:latest"] = "v1"
        mock_storage.data[f"result:{session_id}:v1"] = {
            "assignments": sample_assignments_result["assignments"],
            "version_id": "v1",
            "created_at": 1234567890
        }

        response = client.get(f"/api/assignments/results/{session_id}")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2  # 2 sessions

    def test_get_results_specific_version(self, client, mock_storage, sample_assignments_result):
        """Test retrieving specific version."""
        session_id = str(uuid.uuid4())
        mock_storage.data[f"result:{session_id}:v2"] = {
            "assignments": sample_assignments_result["assignments"],
            "version_id": "v2",
            "created_at": 1234567890
        }
        # Need to set latest pointer for result_exists() check
        mock_storage.data[f"result:{session_id}:latest"] = "v2"

        response = client.get(f"/api/assignments/results/{session_id}?version=v2")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

    def test_get_results_not_found(self, client, mock_storage):
        """Test retrieving nonexistent results."""
        fake_session_id = str(uuid.uuid4())

        response = client.get(f"/api/assignments/results/{fake_session_id}")

        assert response.status_code == 404
        assert "Results not found or expired" in response.json()["detail"]

    def test_get_results_version_not_found(self, client, mock_storage):
        """Test retrieving nonexistent version."""
        session_id = str(uuid.uuid4())
        mock_storage.data[f"result:{session_id}:latest"] = "v1"
        # Don't store v1, so get should fail

        response = client.get(f"/api/assignments/results/{session_id}?version=v99")

        assert response.status_code == 404


class TestGetResultVersions:
    """Test suite for GET /api/assignments/results/{session_id}/versions endpoint."""

    def test_get_versions_success(self, client, mock_storage):
        """Test retrieving version list."""
        session_id = str(uuid.uuid4())
        versions = [
            {"version_id": "v1", "created_at": 1234567890, "solve_time": 1.5},
            {"version_id": "v2", "created_at": 1234567900, "solve_time": 2.0},
        ]
        mock_storage.data[f"result:{session_id}:versions"] = versions

        response = client.get(f"/api/assignments/results/{session_id}/versions")

        assert response.status_code == 200
        data = response.json()
        assert "versions" in data
        assert len(data["versions"]) == 2

    def test_get_versions_not_found(self, client, mock_storage):
        """Test retrieving versions for nonexistent session."""
        fake_session_id = str(uuid.uuid4())

        response = client.get(f"/api/assignments/results/{fake_session_id}/versions")

        assert response.status_code == 404


class TestGetSessionMetadata:
    """Test suite for GET /api/assignments/sessions/{session_id}/metadata endpoint."""

    def test_get_metadata_success(self, client, mock_storage, sample_session_data):
        """Test retrieving session metadata."""
        session_id = str(uuid.uuid4())
        mock_storage.data[f"session:{session_id}"] = sample_session_data

        response = client.get(f"/api/assignments/sessions/{session_id}/metadata")

        assert response.status_code == 200
        data = response.json()
        assert data["session_id"] == session_id
        assert data["filename"] == "test.xlsx"
        assert data["num_participants"] == 4
        assert data["num_tables"] == 2
        assert data["num_sessions"] == 2
        assert "has_results" in data

    def test_get_metadata_not_found(self, client, mock_storage):
        """Test retrieving metadata for nonexistent session."""
        fake_session_id = str(uuid.uuid4())

        response = client.get(f"/api/assignments/sessions/{fake_session_id}/metadata")

        assert response.status_code == 404


class TestCloneSession:
    """Test suite for POST /api/assignments/sessions/{session_id}/clone endpoint."""

    def test_clone_session_success(self, client, mock_storage, sample_session_data):
        """Test successful session cloning."""
        original_session_id = str(uuid.uuid4())
        mock_storage.data[f"session:{original_session_id}"] = sample_session_data

        response = client.post(
            f"/api/assignments/sessions/{original_session_id}/clone?num_tables=3&num_sessions=4"
        )

        assert response.status_code == 200
        data = response.json()
        assert "session_id" in data
        assert data["session_id"] != original_session_id

        # Verify new session was created
        new_session_id = data["session_id"]
        new_session = mock_storage.data[f"session:{new_session_id}"]
        assert new_session["num_tables"] == 3
        assert new_session["num_sessions"] == 4
        assert new_session["participant_dict"] == sample_session_data["participant_dict"]

    def test_clone_session_not_found(self, client, mock_storage):
        """Test cloning nonexistent session."""
        fake_session_id = str(uuid.uuid4())

        response = client.post(
            f"/api/assignments/sessions/{fake_session_id}/clone?num_tables=3&num_sessions=4"
        )

        assert response.status_code == 404

    def test_clone_invalid_num_tables(self, client, mock_storage, sample_session_data):
        """Test cloning with invalid num_tables."""
        session_id = str(uuid.uuid4())
        mock_storage.data[f"session:{session_id}"] = sample_session_data

        # Too low
        response = client.post(
            f"/api/assignments/sessions/{session_id}/clone?num_tables=0&num_sessions=3"
        )
        assert response.status_code == 422

        # Too high
        response = client.post(
            f"/api/assignments/sessions/{session_id}/clone?num_tables=11&num_sessions=3"
        )
        assert response.status_code == 422

    def test_clone_invalid_num_sessions(self, client, mock_storage, sample_session_data):
        """Test cloning with invalid num_sessions."""
        session_id = str(uuid.uuid4())
        mock_storage.data[f"session:{session_id}"] = sample_session_data

        # Too low
        response = client.post(
            f"/api/assignments/sessions/{session_id}/clone?num_tables=2&num_sessions=0"
        )
        assert response.status_code == 422

        # Too high
        response = client.post(
            f"/api/assignments/sessions/{session_id}/clone?num_tables=2&num_sessions=7"
        )
        assert response.status_code == 422

    def test_clone_not_enough_participants(self, client, mock_storage, sample_session_data):
        """Test cloning with more tables than participants."""
        session_id = str(uuid.uuid4())
        mock_storage.data[f"session:{session_id}"] = sample_session_data  # 4 participants

        response = client.post(
            f"/api/assignments/sessions/{session_id}/clone?num_tables=5&num_sessions=2"
        )

        assert response.status_code == 400
        assert "Not enough participants" in response.json()["detail"]


class TestRegenerateSingleSession:
    """Test suite for POST /api/assignments/regenerate/{session_id}/session/{session_number} endpoint."""

    @patch('api.routers.assignments.GroupBuilder')
    def test_regenerate_single_session_success(self, mock_builder_class, client, mock_storage, sample_session_data, sample_assignments_result):
        """Test successful single-session regeneration."""
        session_id = str(uuid.uuid4())
        version_id = "v_test123"

        # Setup: store session and existing results with proper versioning
        mock_storage.data[f"session:{session_id}"] = sample_session_data
        mock_storage.data[f"result:{session_id}:latest"] = version_id  # Latest pointer
        mock_storage.data[f"result:{session_id}:{version_id}"] = {  # Actual result
            "assignments": sample_assignments_result["assignments"],
            "metadata": {"solution_quality": "optimal", "solve_time": 1.5, "max_time_seconds": 120},
            "created_at": datetime.now().isoformat()
        }

        # Mock the solver to return new assignments for session 1
        mock_builder = MagicMock()
        mock_builder_class.return_value = mock_builder
        mock_builder.generate_assignments.return_value = {
            "status": "success",
            "solution_quality": "optimal",
            "solve_time": 2.0,
            "total_deviation": 5,
            "assignments": [{
                "session": 1,
                "tables": {
                    "1": [
                        {"name": "Charlie", "religion": "Muslim", "gender": "Male", "partner": None},
                        {"name": "Diana", "religion": "Christian", "gender": "Female", "partner": None}
                    ],
                    "2": [
                        {"name": "Alice", "religion": "Christian", "gender": "Female", "partner": None},
                        {"name": "Bob", "religion": "Jewish", "gender": "Male", "partner": None}
                    ]
                }
            }]
        }

        # Regenerate session 1
        response = client.post(
            f"/api/assignments/regenerate/{session_id}/session/1?max_time_seconds=60",
            json=[]  # No absent participants
        )

        assert response.status_code == 200
        data = response.json()

        # Verify response structure
        assert "assignments" in data
        assert "version_id" in data
        assert "session" in data
        assert data["session"] == 1
        assert "solve_time" in data
        assert "quality" in data
        assert "assignments_unchanged" in data

        # Verify session 1 was regenerated, session 2 unchanged
        assert len(data["assignments"]) == 2
        assert data["assignments"][0]["session"] == 1
        assert data["assignments"][1]["session"] == 2

        # Verify GroupBuilder was called with require_different_assignments=True
        mock_builder_class.assert_called()
        call_kwargs = mock_builder_class.call_args[1]
        assert call_kwargs["require_different_assignments"] == True
        assert call_kwargs["num_sessions"] == 1
        assert call_kwargs["current_table_assignments"] is not None

    @patch('api.routers.assignments.GroupBuilder')
    def test_regenerate_single_session_with_absent_participants(self, mock_builder_class, client, mock_storage, sample_session_data, sample_assignments_result):
        """Test single-session regeneration with absent participants."""
        session_id = str(uuid.uuid4())
        version_id = "v_test456"

        mock_storage.data[f"session:{session_id}"] = sample_session_data
        mock_storage.data[f"result:{session_id}:latest"] = version_id
        mock_storage.data[f"result:{session_id}:{version_id}"] = {
            "assignments": sample_assignments_result["assignments"],
            "metadata": {"solution_quality": "optimal"},
            "created_at": datetime.now().isoformat()
        }

        mock_builder = MagicMock()
        mock_builder_class.return_value = mock_builder
        mock_builder.generate_assignments.return_value = {
            "status": "success",
            "solution_quality": "optimal",
            "solve_time": 1.0,
            "total_deviation": 0,
            "assignments": [{
                "session": 1,
                "tables": {
                    "1": [{"name": "Charlie", "religion": "Muslim", "gender": "Male", "partner": None}],
                    "2": [{"name": "Diana", "religion": "Christian", "gender": "Female", "partner": None}]
                }
            }]
        }

        # Mark Alice and Bob as absent
        absent_participants = [
            {"name": "Alice", "religion": "Christian", "gender": "Female", "partner": None},
            {"name": "Bob", "religion": "Jewish", "gender": "Male", "partner": None}
        ]

        response = client.post(
            f"/api/assignments/regenerate/{session_id}/session/1",
            json=absent_participants
        )

        assert response.status_code == 200
        data = response.json()

        # Verify absent participants are stored in the session
        assert "absentParticipants" in data["assignments"][0]
        assert len(data["assignments"][0]["absentParticipants"]) == 2

        # Verify GroupBuilder was called with only 2 active participants
        mock_builder_class.assert_called()
        call_kwargs = mock_builder_class.call_args[1]
        assert len(call_kwargs["participants"]) == 2  # Only Charlie and Diana

    @patch('api.routers.assignments.GroupBuilder')
    def test_regenerate_single_session_fallback_when_impossible(self, mock_builder_class, client, mock_storage, sample_session_data, sample_assignments_result):
        """Test that fallback occurs when hard constraint makes problem infeasible."""
        session_id = str(uuid.uuid4())
        version_id = "v_test789"

        mock_storage.data[f"session:{session_id}"] = sample_session_data
        mock_storage.data[f"result:{session_id}:latest"] = version_id
        mock_storage.data[f"result:{session_id}:{version_id}"] = {
            "assignments": sample_assignments_result["assignments"],
            "metadata": {"solution_quality": "optimal"},
            "created_at": datetime.now().isoformat()
        }

        # First call (hard constraint) fails, second call (soft constraint) succeeds
        mock_builder_hard = MagicMock()
        mock_builder_soft = MagicMock()
        mock_builder_class.side_effect = [mock_builder_hard, mock_builder_soft]

        mock_builder_hard.generate_assignments.return_value = {"status": "failure", "error": "Infeasible"}
        mock_builder_soft.generate_assignments.return_value = {
            "status": "success",
            "solution_quality": "optimal",
            "solve_time": 1.0,
            "assignments": sample_assignments_result["assignments"][:1]  # Return session 1
        }

        response = client.post(f"/api/assignments/regenerate/{session_id}/session/1", json=[])

        assert response.status_code == 200
        data = response.json()

        # Verify assignments_unchanged flag is set
        assert data["assignments_unchanged"] == True

        # Verify GroupBuilder was called twice (hard then soft)
        assert mock_builder_class.call_count == 2

    def test_regenerate_single_session_not_found(self, client, mock_storage):
        """Test regeneration of expired session."""
        fake_session_id = str(uuid.uuid4())

        response = client.post(f"/api/assignments/regenerate/{fake_session_id}/session/1", json=[])

        assert response.status_code == 404
        assert "Session expired" in response.json()["detail"]

    def test_regenerate_single_session_invalid_session_number(self, client, mock_storage, sample_session_data, sample_assignments_result):
        """Test regeneration with invalid session number."""
        session_id = str(uuid.uuid4())
        version_id = "v_testABC"

        mock_storage.data[f"session:{session_id}"] = sample_session_data  # num_sessions = 2
        mock_storage.data[f"result:{session_id}:latest"] = version_id
        mock_storage.data[f"result:{session_id}:{version_id}"] = {
            "assignments": sample_assignments_result["assignments"],
            "metadata": {},
            "created_at": datetime.now().isoformat()
        }

        # Try to regenerate session 5 when only 2 sessions exist
        response = client.post(f"/api/assignments/regenerate/{session_id}/session/5", json=[])

        assert response.status_code == 400
        assert "Invalid session number" in response.json()["detail"]

    def test_regenerate_single_session_max_time_validation(self, client, mock_storage, sample_session_data, sample_assignments_result):
        """Test that max_time_seconds is validated (30-240 range)."""
        session_id = str(uuid.uuid4())
        version_id = "v_testDEF"

        mock_storage.data[f"session:{session_id}"] = sample_session_data
        mock_storage.data[f"result:{session_id}:latest"] = version_id
        mock_storage.data[f"result:{session_id}:{version_id}"] = {
            "assignments": sample_assignments_result["assignments"],
            "metadata": {},
            "created_at": datetime.now().isoformat()
        }

        # Too low
        response = client.post(f"/api/assignments/regenerate/{session_id}/session/1?max_time_seconds=10", json=[])
        assert response.status_code == 422  # Validation error

        # Too high
        response = client.post(f"/api/assignments/regenerate/{session_id}/session/1?max_time_seconds=300", json=[])
        assert response.status_code == 422

    @patch('api.routers.assignments.GroupBuilder')
    def test_regenerate_single_session_metadata_persistence(self, mock_builder_class, client, mock_storage, sample_session_data, sample_assignments_result):
        """Test that max_time_seconds and regenerated metadata are persisted correctly."""
        session_id = str(uuid.uuid4())
        version_id = "v_testGHI"

        mock_storage.data[f"session:{session_id}"] = sample_session_data
        mock_storage.data[f"result:{session_id}:latest"] = version_id
        mock_storage.data[f"result:{session_id}:{version_id}"] = {
            "assignments": sample_assignments_result["assignments"],
            "metadata": {"max_time_seconds": 120},
            "created_at": datetime.now().isoformat()
        }

        mock_builder = MagicMock()
        mock_builder_class.return_value = mock_builder
        mock_builder.generate_assignments.return_value = {
            "status": "success",
            "solution_quality": "optimal",
            "solve_time": 1.5,
            "total_deviation": 3,
            "assignments": sample_assignments_result["assignments"][:1]
        }

        response = client.post(f"/api/assignments/regenerate/{session_id}/session/1?max_time_seconds=60", json=[])

        assert response.status_code == 200

        # Verify metadata was stored with correct max_time_seconds
        # Get the new version_id that was created
        new_version_id = mock_storage.data[f"result:{session_id}:latest"]
        stored_result = mock_storage.data[f"result:{session_id}:{new_version_id}"]
        assert stored_result["metadata"]["max_time_seconds"] == 60
        assert stored_result["metadata"]["regenerated"] == True
        assert stored_result["metadata"]["regenerated_session"] == 1


class TestAuthProtection:
    """Tests for authentication and authorization on protected endpoints."""

    def test_get_results_requires_auth(self, client_with_auth):
        """Should return 401 if no auth token provided."""
        response = client_with_auth.get("/api/assignments/results/session123")
        assert response.status_code == 401

    def test_get_results_requires_session_access(self, client, monkeypatch):
        """Should return 403 if user doesn't have access to session."""
        # TODO: Implement when test infrastructure ready
        # Will need to mock auth to return a user
        # and mock firestore to deny access
        pass
