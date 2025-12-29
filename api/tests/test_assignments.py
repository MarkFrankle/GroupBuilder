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
        "email": "test@example.com",
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

    @patch('api.routers.assignments.handle_generate_assignments')
    def test_generate_assignments_sends_email(self, mock_generate, client, mock_storage, sample_session_data, sample_assignments_result):
        """Test that email is sent when provided."""
        with patch('api.routers.assignments.send_magic_link_email') as mock_email:
            session_id = str(uuid.uuid4())
            sample_session_data["email"] = "user@example.com"
            mock_storage.data[f"session:{session_id}"] = sample_session_data
            mock_generate.return_value = sample_assignments_result

            response = client.get(f"/api/assignments/?session_id={session_id}")

            assert response.status_code == 200
            mock_email.assert_called_once()
            assert mock_email.call_args[1]["to_email"] == "user@example.com"


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
