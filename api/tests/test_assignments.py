"""
Tests for the /api/assignments/ endpoints.

Tests cover:
- GET /api/assignments/ (generate assignments)
- POST /api/assignments/regenerate
- GET /api/assignments/results
- GET /api/assignments/results/versions
- GET /api/assignments/metadata

Every route is program-scoped: the program's current assignment set is the one
served, so requests carry ``program_id`` and never a lineage UUID.
"""

import copy

import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime


@pytest.fixture
def sample_set_data():
    """Sample assignment set data for testing."""
    return {
        "participant_dict": [
            {
                "id": 1,
                "name": "Alice",
                "religion": "Christian",
                "gender": "Female",
                "couple_id": None,
            },
            {
                "id": 2,
                "name": "Bob",
                "religion": "Jewish",
                "gender": "Male",
                "couple_id": None,
            },
            {
                "id": 3,
                "name": "Charlie",
                "religion": "Muslim",
                "gender": "Male",
                "couple_id": None,
            },
            {
                "id": 4,
                "name": "Diana",
                "religion": "Christian",
                "gender": "Female",
                "couple_id": None,
            },
        ],
        "num_tables": 2,
        "num_sessions": 2,
        "filename": "test.xlsx",
        "created_at": datetime.now().isoformat(),
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
                        {
                            "name": "Alice",
                            "religion": "Christian",
                            "gender": "Female",
                            "partner": None,
                        },
                        {
                            "name": "Bob",
                            "religion": "Jewish",
                            "gender": "Male",
                            "partner": None,
                        },
                    ],
                    "2": [
                        {
                            "name": "Charlie",
                            "religion": "Muslim",
                            "gender": "Male",
                            "partner": None,
                        },
                        {
                            "name": "Diana",
                            "religion": "Christian",
                            "gender": "Female",
                            "partner": None,
                        },
                    ],
                },
            },
            {
                "session": 2,
                "tables": {
                    "1": [
                        {
                            "name": "Charlie",
                            "religion": "Muslim",
                            "gender": "Male",
                            "partner": None,
                        },
                        {
                            "name": "Bob",
                            "religion": "Jewish",
                            "gender": "Male",
                            "partner": None,
                        },
                    ],
                    "2": [
                        {
                            "name": "Alice",
                            "religion": "Christian",
                            "gender": "Female",
                            "partner": None,
                        },
                        {
                            "name": "Diana",
                            "religion": "Christian",
                            "gender": "Female",
                            "partner": None,
                        },
                    ],
                },
            },
        ],
    }


PROGRAM = "test_org_id"
OTHER_PROGRAM = "other_org_id"


class TestGetAssignments:
    """Test suite for GET /api/assignments/ endpoint."""

    @patch("api.routers.assignments.handle_generate_assignments")
    def test_generate_assignments_success(
        self,
        mock_generate,
        client,
        sample_set_data,
        sample_assignments_result,
        add_assignment_set_to_firestore,
    ):
        """Test successful assignment generation."""
        add_assignment_set_to_firestore(sample_set_data)
        mock_generate.return_value = sample_assignments_result

        response = client.get(f"/api/assignments/?program_id={PROGRAM}")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2  # 2 sessions
        assert data[0]["session"] == 1
        assert len(data[0]["tables"]) == 2

    def test_generate_assignments_no_assignment_set(self, client):
        """A program with no assignment set returns 404."""
        response = client.get(f"/api/assignments/?program_id={OTHER_PROGRAM}")

        assert response.status_code == 404
        assert "no assignments yet" in response.json()["detail"]

    def test_dangling_assignment_set_pointer_is_a_500(
        self, client, sample_set_data, add_assignment_set_to_firestore, caplog
    ):
        """A program pointing at a deleted assignment set is corrupt data, not a 404.

        The user cannot fix this by generating, so it must return 500 *and* leave
        the program and set ids in the logs for whoever answers the support call.
        """
        import logging

        from api.firebase_admin import get_firestore_client

        set_id = add_assignment_set_to_firestore(sample_set_data)

        # Delete the set document but leave current_assignment_set_id pointing at it.
        get_firestore_client().collection("organizations").document(PROGRAM).collection(
            "assignment_sets"
        ).document(set_id).delete()

        with caplog.at_level(logging.ERROR, logger="api.routers.assignments"):
            response = client.get(f"/api/assignments/?program_id={PROGRAM}")

        assert response.status_code == 500
        assert "contact support" in response.json()["detail"]
        assert PROGRAM in caplog.text
        assert set_id in caplog.text

    @patch("api.routers.assignments.handle_generate_assignments")
    def test_generate_assignments_solver_failure(
        self,
        mock_generate,
        client,
        sample_set_data,
        add_assignment_set_to_firestore,
    ):
        """Test handling of solver failures."""
        add_assignment_set_to_firestore(sample_set_data)
        mock_generate.return_value = {
            "status": "failure",
            "error": "No feasible solution found",
        }

        response = client.get(f"/api/assignments/?program_id={PROGRAM}")

        assert response.status_code == 400
        assert "No feasible solution" in response.json()["detail"]


class TestRegenerateAssignments:
    """Test suite for POST /api/assignments/regenerate endpoint."""

    @patch("api.routers.assignments.handle_generate_assignments")
    def test_regenerate_success(
        self,
        mock_generate,
        client,
        sample_set_data,
        sample_assignments_result,
        add_assignment_set_to_firestore,
    ):
        """Test successful regeneration."""
        add_assignment_set_to_firestore(sample_set_data)
        mock_generate.return_value = sample_assignments_result

        response = client.post(f"/api/assignments/regenerate?program_id={PROGRAM}")

        assert response.status_code == 200
        data = response.json()
        assert "assignments" in data
        assert "version_id" in data

    def test_regenerate_no_assignment_set(self, client):
        """Regenerating a program with no assignment set returns 404."""
        response = client.post(
            f"/api/assignments/regenerate?program_id={OTHER_PROGRAM}"
        )

        assert response.status_code == 404
        assert "no assignments yet" in response.json()["detail"]


class TestGetCachedResults:
    """Test suite for GET /api/assignments/results endpoint."""

    def test_get_results_success(
        self,
        client,
        sample_assignments_result,
        add_assignment_set_to_firestore,
        add_version_to_firestore,
        sample_set_data,
    ):
        """Test retrieving cached results."""
        set_id = add_assignment_set_to_firestore(sample_set_data)
        add_version_to_firestore(set_id, "v1", sample_assignments_result["assignments"])

        response = client.get(f"/api/assignments/results?program_id={PROGRAM}")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2  # 2 sessions

    def test_get_results_specific_version(
        self,
        client,
        sample_assignments_result,
        add_assignment_set_to_firestore,
        add_version_to_firestore,
        sample_set_data,
    ):
        """Test retrieving specific version."""
        set_id = add_assignment_set_to_firestore(sample_set_data)
        add_version_to_firestore(set_id, "v2", sample_assignments_result["assignments"])

        response = client.get(
            f"/api/assignments/results?program_id={PROGRAM}&version=v2"
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

    def test_get_results_not_found(
        self, client, sample_set_data, add_assignment_set_to_firestore
    ):
        """An assignment set with no versions yet returns 404."""
        add_assignment_set_to_firestore(sample_set_data)

        response = client.get(f"/api/assignments/results?program_id={PROGRAM}")

        assert response.status_code == 404
        assert "Results not found" in response.json()["detail"]

    def test_get_results_version_not_found(
        self, client, sample_set_data, add_assignment_set_to_firestore
    ):
        """Test retrieving nonexistent version."""
        add_assignment_set_to_firestore(sample_set_data)

        response = client.get(
            f"/api/assignments/results?program_id={PROGRAM}&version=v99"
        )

        assert response.status_code == 404
        assert "Version v99 not found" in response.json()["detail"]


class TestGetResultVersions:
    """Test suite for GET /api/assignments/results/versions endpoint."""

    def test_get_versions_success(
        self,
        client,
        add_assignment_set_to_firestore,
        add_version_to_firestore,
        sample_set_data,
        sample_assignments_result,
    ):
        """Test retrieving version list."""
        set_id = add_assignment_set_to_firestore(sample_set_data)
        add_version_to_firestore(
            set_id,
            "v1",
            sample_assignments_result["assignments"],
            {"solve_time": 1.5},
        )
        add_version_to_firestore(
            set_id,
            "v2",
            sample_assignments_result["assignments"],
            {"solve_time": 2.0},
        )

        response = client.get(f"/api/assignments/results/versions?program_id={PROGRAM}")

        assert response.status_code == 200
        data = response.json()
        assert "versions" in data
        assert len(data["versions"]) == 2
        # Newest first: every read path in the app depends on this ordering.
        assert [v["version_id"] for v in data["versions"]] == ["v2", "v1"]

    def test_get_versions_not_found(self, client):
        """Test retrieving versions for a program with no assignment set."""
        response = client.get(
            f"/api/assignments/results/versions?program_id={OTHER_PROGRAM}"
        )

        assert response.status_code == 404


class TestSaveEditedAssignments:
    """Test suite for POST /api/assignments/results/save endpoint."""

    def test_save_success(
        self,
        client,
        sample_set_data,
        sample_assignments_result,
        add_assignment_set_to_firestore,
    ):
        """Manual edits are stored as a new version."""
        add_assignment_set_to_firestore(sample_set_data)

        response = client.post(
            f"/api/assignments/results/save?program_id={PROGRAM}",
            json={"assignments": sample_assignments_result["assignments"]},
        )

        assert response.status_code == 200
        assert response.json()["version_id"] == "v1"

    def test_save_requires_assignments(
        self, client, sample_set_data, add_assignment_set_to_firestore
    ):
        """An empty payload is rejected."""
        add_assignment_set_to_firestore(sample_set_data)

        response = client.post(
            f"/api/assignments/results/save?program_id={PROGRAM}", json={}
        )

        assert response.status_code == 400


class TestListAssignmentSets:
    """The Previous Groups shim is gone; the route must 404."""

    def test_route_is_gone(self, client):
        """GET /assignment_sets no longer exists."""
        response = client.get(f"/api/assignments/assignment_sets?program_id={PROGRAM}")

        assert response.status_code == 404


class TestAssignmentSetMetadata:
    """Test suite for GET /api/assignments/metadata endpoint."""

    def test_get_metadata_success(
        self, client, sample_set_data, add_assignment_set_to_firestore
    ):
        """Test retrieving assignment set metadata."""
        set_id = add_assignment_set_to_firestore(sample_set_data)

        response = client.get(f"/api/assignments/metadata?program_id={PROGRAM}")

        assert response.status_code == 200
        data = response.json()
        assert data["assignment_set_id"] == set_id
        assert data["filename"] == "test.xlsx"
        assert data["num_participants"] == 4
        assert data["num_tables"] == 2
        assert data["num_sessions"] == 2
        assert data["has_results"] is False

    def test_get_metadata_not_found(self, client):
        """Test retrieving metadata for a program with no assignment set."""
        response = client.get(f"/api/assignments/metadata?program_id={OTHER_PROGRAM}")

        assert response.status_code == 404


class TestRegenerateAllWithAbsences:
    """Test suite for POST /api/assignments/regenerate/with_absences."""

    @staticmethod
    def _single_session_result(status):
        result = {"status": status}
        if status == "success":
            result.update(
                {
                    "solution_quality": "optimal",
                    "solve_time": 1.0,
                    "total_deviation": 0,
                    "assignments": [
                        {
                            "session": 1,
                            "tables": {
                                "1": [{"name": "Charlie"}],
                                "2": [{"name": "Diana"}],
                            },
                        }
                    ],
                }
            )
        return result

    @staticmethod
    def _latest_version(set_id):
        from api.services.assignment_set_storage import AssignmentSetStorage

        storage = AssignmentSetStorage()
        versions = storage.list_versions(PROGRAM, set_id)
        return storage.get_version(PROGRAM, set_id, versions[0]["version_id"])

    @patch("api.routers.assignments.GroupBuilder")
    @patch("api.routers.assignments.handle_generate_assignments")
    def test_absences_recorded_and_stale_metrics_dropped(
        self,
        mock_generate,
        mock_builder_class,
        client,
        sample_set_data,
        sample_assignments_result,
        add_assignment_set_to_firestore,
    ):
        """A re-solved session records its absences and voids the full-solve metrics."""
        set_id = add_assignment_set_to_firestore(sample_set_data)
        mock_generate.return_value = sample_assignments_result

        mock_builder = MagicMock()
        mock_builder_class.return_value = mock_builder
        mock_builder.generate_assignments.return_value = self._single_session_result(
            "success"
        )

        response = client.post(
            f"/api/assignments/regenerate/with_absences?program_id={PROGRAM}",
            json=[
                {
                    "session_number": 1,
                    "absent_participants": [{"name": "Alice"}],
                }
            ],
        )

        assert response.status_code == 200

        stored = self._latest_version(set_id)
        assert stored["assignments"][0]["absentParticipants"] == [{"name": "Alice"}]

        # The full-solve quality numbers describe assignments that no longer
        # exist, so they must not be reported alongside the saved ones.
        metadata = stored["metadata"]
        assert metadata["solution_quality"] is None
        assert metadata["solve_time"] is None
        assert metadata["total_deviation"] is None
        assert metadata["regenerated"] is True

    @patch("api.routers.assignments.GroupBuilder")
    @patch("api.routers.assignments.handle_generate_assignments")
    def test_absences_survive_a_failed_resolve(
        self,
        mock_generate,
        mock_builder_class,
        client,
        sample_set_data,
        sample_assignments_result,
        add_assignment_set_to_firestore,
    ):
        """When the per-session re-solve fails, the absence record is still kept."""
        set_id = add_assignment_set_to_firestore(sample_set_data)
        mock_generate.return_value = sample_assignments_result

        mock_builder = MagicMock()
        mock_builder_class.return_value = mock_builder
        mock_builder.generate_assignments.return_value = self._single_session_result(
            "infeasible"
        )

        response = client.post(
            f"/api/assignments/regenerate/with_absences?program_id={PROGRAM}",
            json=[
                {
                    "session_number": 1,
                    "absent_participants": [{"name": "Alice"}],
                }
            ],
        )

        assert response.status_code == 200

        # Tables keep the all-present layout, but the absence must not be lost.
        stored = self._latest_version(set_id)
        assert stored["assignments"][0]["absentParticipants"] == [{"name": "Alice"}]


class TestRegenerateSingleSession:
    """Test suite for POST /api/assignments/regenerate/session/{session_number}."""

    @patch("api.routers.assignments.GroupBuilder")
    def test_regenerate_single_session_success(
        self,
        mock_builder_class,
        client,
        sample_set_data,
        sample_assignments_result,
        add_assignment_set_to_firestore,
        add_version_to_firestore,
    ):
        """Test successful single-session regeneration."""
        set_id = add_assignment_set_to_firestore(sample_set_data)
        add_version_to_firestore(
            set_id,
            "v1",
            sample_assignments_result["assignments"],
            {"solution_quality": "optimal", "solve_time": 1.5, "max_time_seconds": 120},
        )

        # Mock the solver to return new assignments for session 1
        mock_builder = MagicMock()
        mock_builder_class.return_value = mock_builder
        mock_builder.generate_assignments.return_value = {
            "status": "success",
            "solution_quality": "optimal",
            "solve_time": 2.0,
            "total_deviation": 5,
            "assignments": [
                {
                    "session": 1,
                    "tables": {
                        "1": [
                            {
                                "name": "Charlie",
                                "religion": "Muslim",
                                "gender": "Male",
                                "partner": None,
                            },
                            {
                                "name": "Diana",
                                "religion": "Christian",
                                "gender": "Female",
                                "partner": None,
                            },
                        ],
                        "2": [
                            {
                                "name": "Alice",
                                "religion": "Christian",
                                "gender": "Female",
                                "partner": None,
                            },
                            {
                                "name": "Bob",
                                "religion": "Jewish",
                                "gender": "Male",
                                "partner": None,
                            },
                        ],
                    },
                }
            ],
        }

        response = client.post(
            f"/api/assignments/regenerate/session/1"
            f"?program_id={PROGRAM}&max_time_seconds=60",
            json=[],  # No absent participants
        )

        assert response.status_code == 200
        data = response.json()

        # Verify response structure
        assert "assignments" in data
        assert "version_id" in data
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
        assert call_kwargs["require_different_assignments"] is True
        assert call_kwargs["num_sessions"] == 1
        assert call_kwargs["current_table_assignments"] is not None

    @patch("api.routers.assignments.GroupBuilder")
    def test_regenerate_single_session_with_absent_participants(
        self,
        mock_builder_class,
        client,
        sample_set_data,
        sample_assignments_result,
        add_assignment_set_to_firestore,
        add_version_to_firestore,
    ):
        """Test single-session regeneration with absent participants."""
        set_id = add_assignment_set_to_firestore(sample_set_data)
        add_version_to_firestore(
            set_id,
            "v1",
            sample_assignments_result["assignments"],
            {"solution_quality": "optimal"},
        )

        mock_builder = MagicMock()
        mock_builder_class.return_value = mock_builder
        mock_builder.generate_assignments.return_value = {
            "status": "success",
            "solution_quality": "optimal",
            "solve_time": 1.0,
            "total_deviation": 0,
            "assignments": [
                {
                    "session": 1,
                    "tables": {
                        "1": [
                            {
                                "name": "Charlie",
                                "religion": "Muslim",
                                "gender": "Male",
                                "partner": None,
                            }
                        ],
                        "2": [
                            {
                                "name": "Diana",
                                "religion": "Christian",
                                "gender": "Female",
                                "partner": None,
                            }
                        ],
                    },
                }
            ],
        }

        # Mark Alice and Bob as absent
        absent_participants = [
            {
                "name": "Alice",
                "religion": "Christian",
                "gender": "Female",
                "partner": None,
            },
            {"name": "Bob", "religion": "Jewish", "gender": "Male", "partner": None},
        ]

        response = client.post(
            f"/api/assignments/regenerate/session/1?program_id={PROGRAM}",
            json=absent_participants,
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

    @patch("api.routers.assignments.GroupBuilder")
    def test_regenerate_single_session_fallback_when_impossible(
        self,
        mock_builder_class,
        client,
        sample_set_data,
        sample_assignments_result,
        add_assignment_set_to_firestore,
        add_version_to_firestore,
    ):
        """Test that fallback occurs when hard constraint makes problem infeasible."""
        set_id = add_assignment_set_to_firestore(sample_set_data)
        add_version_to_firestore(
            set_id,
            "v1",
            sample_assignments_result["assignments"],
            {"solution_quality": "optimal"},
        )

        # First call (hard constraint) fails, second call (soft constraint) succeeds
        mock_builder_hard = MagicMock()
        mock_builder_soft = MagicMock()
        mock_builder_class.side_effect = [mock_builder_hard, mock_builder_soft]

        mock_builder_hard.generate_assignments.return_value = {
            "status": "failure",
            "error": "Infeasible",
        }
        mock_builder_soft.generate_assignments.return_value = {
            "status": "success",
            "solution_quality": "optimal",
            "solve_time": 1.0,
            "assignments": sample_assignments_result["assignments"][
                :1
            ],  # Return session 1
        }

        response = client.post(
            f"/api/assignments/regenerate/session/1?program_id={PROGRAM}", json=[]
        )

        assert response.status_code == 200
        data = response.json()

        # Verify assignments_unchanged flag is set
        assert data["assignments_unchanged"] is True

        # Verify GroupBuilder was called twice (hard then soft)
        assert mock_builder_class.call_count == 2

    def test_regenerate_single_session_no_assignment_set(self, client):
        """Regenerating in a program with no assignment set returns 404."""
        response = client.post(
            f"/api/assignments/regenerate/session/1?program_id={OTHER_PROGRAM}", json=[]
        )

        assert response.status_code == 404
        assert "no assignments yet" in response.json()["detail"]

    def test_regenerate_single_session_invalid_session_number(
        self, client, sample_set_data, add_assignment_set_to_firestore
    ):
        """Test regeneration with an out-of-range session number."""
        add_assignment_set_to_firestore(sample_set_data)

        # Try to regenerate session 5 when only 2 sessions exist
        response = client.post(
            f"/api/assignments/regenerate/session/5?program_id={PROGRAM}", json=[]
        )

        assert response.status_code == 400
        assert "There is no session 5" in response.json()["detail"]
        assert "sessions 1 through 2" in response.json()["detail"]

    def test_regenerate_single_session_max_time_validation(
        self, client, sample_set_data, add_assignment_set_to_firestore
    ):
        """Test that max_time_seconds is validated (30-240 range)."""
        add_assignment_set_to_firestore(sample_set_data)

        # Too low
        response = client.post(
            f"/api/assignments/regenerate/session/1"
            f"?program_id={PROGRAM}&max_time_seconds=10",
            json=[],
        )
        assert response.status_code == 422  # Validation error

        # Too high
        response = client.post(
            f"/api/assignments/regenerate/session/1"
            f"?program_id={PROGRAM}&max_time_seconds=300",
            json=[],
        )
        assert response.status_code == 422

    @patch("api.routers.assignments.GroupBuilder")
    def test_regenerate_single_session_metadata_persistence(
        self,
        mock_builder_class,
        client,
        sample_set_data,
        sample_assignments_result,
        add_assignment_set_to_firestore,
        add_version_to_firestore,
    ):
        """Test that max_time_seconds and regenerated metadata are persisted correctly."""
        set_id = add_assignment_set_to_firestore(sample_set_data)
        add_version_to_firestore(
            set_id,
            "v1",
            sample_assignments_result["assignments"],
            metadata={"max_time_seconds": 120},
        )

        mock_builder = MagicMock()
        mock_builder_class.return_value = mock_builder
        mock_builder.generate_assignments.return_value = {
            "status": "success",
            "solution_quality": "optimal",
            "solve_time": 1.5,
            "total_deviation": 3,
            "assignments": sample_assignments_result["assignments"][:1],
        }

        response = client.post(
            f"/api/assignments/regenerate/session/1"
            f"?program_id={PROGRAM}&max_time_seconds=60",
            json=[],
        )

        assert response.status_code == 200

        # Verify metadata was stored with correct max_time_seconds
        from api.services.assignment_set_storage import AssignmentSetStorage

        storage = AssignmentSetStorage()

        versions = storage.list_versions(PROGRAM, set_id)
        assert len(versions) >= 2  # Original + regenerated
        latest_version = versions[0]  # Sorted newest first

        stored_result = storage.get_version(
            PROGRAM, set_id, latest_version["version_id"]
        )
        assert stored_result["metadata"]["max_time_seconds"] == 60
        assert stored_result["metadata"]["regenerated"] is True
        assert stored_result["metadata"]["regenerated_session"] == 1


class TestAuthProtection:
    """Tests for authentication and authorization on protected endpoints."""

    def test_get_results_requires_auth(self, client_with_auth):
        """Should return 401 if no auth token provided."""
        response = client_with_auth.get(
            f"/api/assignments/results?program_id={PROGRAM}"
        )
        assert response.status_code == 401
        assert "Authorization header missing" in response.json()["detail"]

    def test_get_results_requires_program_membership(self, client, client_with_auth):
        """Should return 403 if the user is not a member of the program.

        Uses the ``client`` fixture only to seed the mock Firestore program and
        membership; the request itself goes through ``client_with_auth`` so the
        real ``validate_program_access`` runs.
        """
        from api.main import app
        from api.dependencies import validate_program_access
        from api.middleware.auth import get_current_user, AuthUser

        async def mock_user():
            return AuthUser(
                user_id="stranger", email="stranger@test.com", email_verified=True
            )

        # The ``client`` fixture overrides the authorization gate app-wide; drop
        # that override so the real membership check runs for this request.
        app.dependency_overrides.pop(validate_program_access, None)
        app.dependency_overrides[get_current_user] = mock_user

        try:
            response = client_with_auth.get(
                f"/api/assignments/results?program_id={PROGRAM}"
            )
            assert response.status_code == 403
            assert response.json()["detail"] == "Not a member of this program"
        finally:
            app.dependency_overrides.pop(get_current_user, None)

    def test_generate_requires_auth(self, client_with_auth):
        """Should return 401 if no auth token for generate."""
        response = client_with_auth.get(
            "/api/assignments/", params={"program_id": PROGRAM}
        )
        assert response.status_code == 401
        assert "Authorization header missing" in response.json()["detail"]


class TestSessionCompletion:
    """Test suite for the /api/assignments/completion routes."""

    def test_starts_empty(
        self, client, sample_set_data, add_assignment_set_to_firestore
    ):
        add_assignment_set_to_firestore(sample_set_data)

        response = client.get(f"/api/assignments/completion?program_id={PROGRAM}")

        assert response.status_code == 200
        assert response.json() == {"completed_through": 0}

    def test_mark_complete(
        self, client, sample_set_data, add_assignment_set_to_firestore
    ):
        add_assignment_set_to_firestore(sample_set_data)

        response = client.post(f"/api/assignments/completion/1?program_id={PROGRAM}")

        assert response.status_code == 200
        assert response.json() == {"completed_through": 1}

        # The completion must actually persist, not just come back in the response.
        readback = client.get(f"/api/assignments/completion?program_id={PROGRAM}")
        assert readback.json() == {"completed_through": 1}

    def test_mark_complete_is_idempotent(
        self, client, sample_set_data, add_assignment_set_to_firestore
    ):
        add_assignment_set_to_firestore(sample_set_data)
        client.post(f"/api/assignments/completion/1?program_id={PROGRAM}")

        response = client.post(f"/api/assignments/completion/1?program_id={PROGRAM}")

        assert response.status_code == 200
        assert response.json() == {"completed_through": 1}

    def test_completing_in_order_succeeds(
        self, client, sample_set_data, add_assignment_set_to_firestore
    ):
        """sample_set_data has num_sessions == 2, so this is the boundary too."""
        add_assignment_set_to_firestore(sample_set_data)

        client.post(f"/api/assignments/completion/1?program_id={PROGRAM}")
        response = client.post(f"/api/assignments/completion/2?program_id={PROGRAM}")

        assert response.status_code == 200
        assert response.json() == {"completed_through": 2}

    def test_completing_out_of_order_is_refused(
        self, client, sample_set_data, add_assignment_set_to_firestore
    ):
        """Time is linear: session 2 cannot finish before session 1 has."""
        add_assignment_set_to_firestore(sample_set_data)

        response = client.post(f"/api/assignments/completion/2?program_id={PROGRAM}")

        assert response.status_code == 400
        assert "Session 1 is still open" in response.json()["detail"]

    def test_reopen_when_not_complete_is_a_no_op(
        self, client, sample_set_data, add_assignment_set_to_firestore
    ):
        add_assignment_set_to_firestore(sample_set_data)

        response = client.delete(f"/api/assignments/completion/1?program_id={PROGRAM}")

        assert response.status_code == 200
        assert response.json() == {"completed_through": 0}

    def test_reopen(self, client, sample_set_data, add_assignment_set_to_firestore):
        add_assignment_set_to_firestore(sample_set_data)
        client.post(f"/api/assignments/completion/1?program_id={PROGRAM}")

        response = client.delete(f"/api/assignments/completion/1?program_id={PROGRAM}")

        assert response.status_code == 200
        assert response.json() == {"completed_through": 0}

    def test_reopening_out_of_order_is_refused(
        self, client, sample_set_data, add_assignment_set_to_firestore
    ):
        """Reopening below the latest completed Session would leave a gap."""
        add_assignment_set_to_firestore(sample_set_data)
        client.post(f"/api/assignments/completion/1?program_id={PROGRAM}")
        client.post(f"/api/assignments/completion/2?program_id={PROGRAM}")

        response = client.delete(f"/api/assignments/completion/1?program_id={PROGRAM}")

        assert response.status_code == 400
        assert "Reopen Session 2 first" in response.json()["detail"]

    def test_session_beyond_the_program_is_rejected(
        self, client, sample_set_data, add_assignment_set_to_firestore
    ):
        """sample_set_data has num_sessions == 2."""
        add_assignment_set_to_firestore(sample_set_data)

        response = client.post(f"/api/assignments/completion/5?program_id={PROGRAM}")

        assert response.status_code == 400
        assert "sessions 1 through 2" in response.json()["detail"]

    def test_requires_an_assignment_set(self, client):
        response = client.get(f"/api/assignments/completion?program_id={OTHER_PROGRAM}")

        assert response.status_code == 404

    def test_shuffle_refuses_on_a_completed_session(
        self, client, sample_set_data, add_assignment_set_to_firestore
    ):
        add_assignment_set_to_firestore(sample_set_data)
        client.post(f"/api/assignments/completion/1?program_id={PROGRAM}")

        response = client.post(
            f"/api/assignments/regenerate/session/1?program_id={PROGRAM}", json=[]
        )

        assert response.status_code == 409
        assert "Session 1 is marked complete" in response.json()["detail"]

    def test_shuffle_allowed_on_an_open_session(
        self, client, sample_set_data, add_assignment_set_to_firestore
    ):
        """A completed session 1 must not freeze session 2.

        The proof is a 404, not a 200: the freeze did not fire, so the handler
        ran on to look for a stored version, which this fixture has never saved.
        """
        add_assignment_set_to_firestore(sample_set_data)
        client.post(f"/api/assignments/completion/1?program_id={PROGRAM}")

        response = client.post(
            f"/api/assignments/regenerate/session/2?program_id={PROGRAM}", json=[]
        )

        assert response.status_code == 404

    def test_full_regeneration_refuses_when_a_session_is_complete(
        self, client, sample_set_data, add_assignment_set_to_firestore
    ):
        add_assignment_set_to_firestore(sample_set_data)
        client.post(f"/api/assignments/completion/1?program_id={PROGRAM}")

        response = client.post(f"/api/assignments/regenerate?program_id={PROGRAM}")

        assert response.status_code == 409
        assert "Session 1" in response.json()["detail"]

    def test_regenerate_with_absences_refuses_when_a_session_is_complete(
        self, client, sample_set_data, add_assignment_set_to_firestore
    ):
        add_assignment_set_to_firestore(sample_set_data)
        client.post(f"/api/assignments/completion/1?program_id={PROGRAM}")

        response = client.post(
            f"/api/assignments/regenerate/with_absences?program_id={PROGRAM}", json=[]
        )

        assert response.status_code == 409

    def test_refusal_names_several_completed_sessions_readably(
        self, client, sample_set_data, add_assignment_set_to_firestore
    ):
        """Two completed sessions must read as a plural sentence, not a list glued
        onto a singular verb."""
        add_assignment_set_to_firestore(sample_set_data)
        client.post(f"/api/assignments/completion/1?program_id={PROGRAM}")
        client.post(f"/api/assignments/completion/2?program_id={PROGRAM}")

        response = client.post(f"/api/assignments/regenerate?program_id={PROGRAM}")

        assert response.status_code == 409
        detail = response.json()["detail"]
        assert "Sessions 1 and 2 are already complete" in detail
        assert "reopen" in detail.lower()

    @patch("api.routers.assignments.handle_generate_assignments")
    def test_full_regeneration_still_runs_when_nothing_is_complete(
        self,
        mock_generate,
        client,
        sample_set_data,
        sample_assignments_result,
        add_assignment_set_to_firestore,
    ):
        """The guard must block only frozen programs, never every rebuild."""
        add_assignment_set_to_firestore(sample_set_data)
        mock_generate.return_value = sample_assignments_result

        response = client.post(f"/api/assignments/regenerate?program_id={PROGRAM}")

        assert response.status_code == 200
        assert mock_generate.called

    def _save_body(self, assignments):
        return {"assignments": assignments, "based_on_version": "v1"}

    @staticmethod
    def _with_swapped_tables(assignments, session_number):
        """Copy the array with one session's two tables swapped."""
        modified = copy.deepcopy(assignments)
        for entry in modified:
            if entry["session"] == session_number:
                entry["tables"]["1"], entry["tables"]["2"] = (
                    entry["tables"]["2"],
                    entry["tables"]["1"],
                )
        return modified

    def test_save_refuses_when_a_completed_session_changed(
        self,
        client,
        sample_set_data,
        sample_assignments_result,
        add_assignment_set_to_firestore,
        add_version_to_firestore,
    ):
        set_id = add_assignment_set_to_firestore(sample_set_data)
        stored = sample_assignments_result["assignments"]
        add_version_to_firestore(set_id, "v1", stored)
        client.post(f"/api/assignments/completion/1?program_id={PROGRAM}")

        response = client.post(
            f"/api/assignments/results/save?program_id={PROGRAM}",
            json=self._save_body(self._with_swapped_tables(stored, 1)),
        )

        assert response.status_code == 409
        assert "Session 1" in response.json()["detail"]

    def test_save_allowed_when_only_open_sessions_changed(
        self,
        client,
        sample_set_data,
        sample_assignments_result,
        add_assignment_set_to_firestore,
        add_version_to_firestore,
    ):
        """An untouched completed session must survive the Firestore round trip."""
        set_id = add_assignment_set_to_firestore(sample_set_data)
        stored = sample_assignments_result["assignments"]
        add_version_to_firestore(set_id, "v1", stored)
        client.post(f"/api/assignments/completion/1?program_id={PROGRAM}")

        response = client.post(
            f"/api/assignments/results/save?program_id={PROGRAM}",
            json=self._save_body(self._with_swapped_tables(stored, 2)),
        )

        assert response.status_code == 200

    def test_save_refuses_when_a_completed_session_is_dropped(
        self,
        client,
        sample_set_data,
        sample_assignments_result,
        add_assignment_set_to_firestore,
        add_version_to_firestore,
    ):
        """An omission still changes what the program says happened that night."""
        set_id = add_assignment_set_to_firestore(sample_set_data)
        stored = sample_assignments_result["assignments"]
        add_version_to_firestore(set_id, "v1", stored)
        client.post(f"/api/assignments/completion/1?program_id={PROGRAM}")

        without_session_1 = [e for e in copy.deepcopy(stored) if e["session"] != 1]
        response = client.post(
            f"/api/assignments/results/save?program_id={PROGRAM}",
            json=self._save_body(without_session_1),
        )

        assert response.status_code == 409
        assert "Session 1" in response.json()["detail"]

    def test_save_unaffected_when_nothing_is_complete(
        self,
        client,
        sample_set_data,
        sample_assignments_result,
        add_assignment_set_to_firestore,
        add_version_to_firestore,
    ):
        set_id = add_assignment_set_to_firestore(sample_set_data)
        stored = sample_assignments_result["assignments"]
        add_version_to_firestore(set_id, "v1", stored)

        response = client.post(
            f"/api/assignments/results/save?program_id={PROGRAM}",
            json=self._save_body(self._with_swapped_tables(stored, 1)),
        )

        assert response.status_code == 200

    def test_save_refuses_a_duplicated_completed_session_entry(
        self,
        client,
        sample_set_data,
        sample_assignments_result,
        add_assignment_set_to_firestore,
        add_version_to_firestore,
    ):
        """A tampered entry cannot hide behind a second, matching one.

        The array is written verbatim and rendered in order, so a duplicate
        session number would otherwise let the altered past be the one shown.
        """
        set_id = add_assignment_set_to_firestore(sample_set_data)
        stored = sample_assignments_result["assignments"]
        add_version_to_firestore(set_id, "v1", stored)
        client.post(f"/api/assignments/completion/1?program_id={PROGRAM}")

        tampered = self._with_swapped_tables(stored, 1)
        unchanged_session_1 = copy.deepcopy([e for e in stored if e["session"] == 1][0])
        body = [e for e in tampered if e["session"] == 1]
        body.append(unchanged_session_1)
        body += [copy.deepcopy(e) for e in stored if e["session"] != 1]

        response = client.post(
            f"/api/assignments/results/save?program_id={PROGRAM}",
            json=self._save_body(body),
        )

        assert response.status_code == 400
        assert "Reload the page" in response.json()["detail"]

    def test_save_refuses_a_malformed_entry(
        self,
        client,
        sample_set_data,
        sample_assignments_result,
        add_assignment_set_to_firestore,
        add_version_to_firestore,
    ):
        """A session-less entry must never reach storage."""
        set_id = add_assignment_set_to_firestore(sample_set_data)
        stored = sample_assignments_result["assignments"]
        add_version_to_firestore(set_id, "v1", stored)

        body = copy.deepcopy(stored) + [{"tables": {}}]
        response = client.post(
            f"/api/assignments/results/save?program_id={PROGRAM}",
            json=self._save_body(body),
        )

        assert response.status_code == 400

    def test_session_count_of_zero_is_corrupt_data(
        self, client, sample_set_data, add_assignment_set_to_firestore
    ):
        """ "Sessions 1 through 0" is not something a coordinator can act on."""
        add_assignment_set_to_firestore({**sample_set_data, "num_sessions": 0})

        response = client.post(f"/api/assignments/completion/1?program_id={PROGRAM}")

        assert response.status_code == 500
        assert "contact support" in response.json()["detail"].lower()

    def test_marking_complete_is_still_range_checked(
        self, client, sample_set_data, add_assignment_set_to_firestore
    ):
        """The asymmetry is deliberate — only the DELETE skips the check."""
        add_assignment_set_to_firestore({**sample_set_data, "num_sessions": 2})

        response = client.post(f"/api/assignments/completion/6?program_id={PROGRAM}")

        assert response.status_code == 400

    def test_a_completed_program_cannot_be_bricked(
        self, client, sample_set_data, add_assignment_set_to_firestore
    ):
        """Regression for the whole finding: complete, rebuild, recover.

        Before the guard, a roster regeneration with fewer sessions left the
        program with completion state it could neither honour nor clear.
        """
        add_assignment_set_to_firestore({**sample_set_data, "num_sessions": 6})
        client.post(f"/api/assignments/completion/6?program_id={PROGRAM}")

        for i in range(4):
            client.put(
                f"/api/roster/p{i}?program_id={PROGRAM}",
                json={
                    "name": f"Person{i}",
                    "religion": ["Christian", "Jewish", "Muslim"][i % 3],
                    "gender": ["Male", "Female"][i % 2],
                    "partner_id": None,
                },
            )

        # 1. The rebuild that used to strand the program is refused outright.
        rebuild = client.post(
            f"/api/roster/generate?program_id={PROGRAM}",
            json={"num_tables": 1, "num_sessions": 3},
        )
        assert rebuild.status_code == 409

        # 2. And if a program is already stranded, reopening frees it.
        add_assignment_set_to_firestore({**sample_set_data, "num_sessions": 2})
        assert (
            client.delete(
                f"/api/assignments/completion/6?program_id={PROGRAM}"
            ).status_code
            == 200
        )

        # 3. With nothing frozen, rebuilding works again.
        recovered = client.post(
            f"/api/roster/generate?program_id={PROGRAM}",
            json={"num_tables": 1, "num_sessions": 3},
        )
        assert recovered.status_code == 200
