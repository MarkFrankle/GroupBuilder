"""
Tests for the /api/upload/ endpoint.

Tests cover:
- Valid file uploads
- File size limits
- Parameter validation (numTables, numSessions)
- Missing columns
- Invalid file formats
- Edge cases
"""

import pytest
from io import BytesIO


class TestUploadEndpoint:
    """Test suite for file upload endpoint."""

    def test_valid_upload(self, client, mock_storage, sample_excel_file):
        """Test successful file upload with valid data."""
        response = client.post(
            "/api/upload/",
            files={"file": ("test.xlsx", sample_excel_file, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            data={"numTables": "2", "numSessions": "3"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "File uploaded successfully"
        assert "session_id" in data
        assert "columns" in data
        assert "Name" in data["columns"]
        assert "Religion" in data["columns"]

    def test_file_too_large(self, client, mock_storage):
        """Test that files larger than 10MB are rejected."""
        # Create a file larger than 10MB
        large_file = BytesIO(b'x' * (11 * 1024 * 1024))  # 11MB

        response = client.post(
            "/api/upload/",
            files={"file": ("large.xlsx", large_file, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            data={"numTables": "2", "numSessions": "3"}
        )

        assert response.status_code == 400
        assert "exceeds maximum allowed size" in response.json()["detail"]
        assert "11.0MB" in response.json()["detail"] or "10MB" in response.json()["detail"]

    def test_invalid_file_format(self, client, mock_storage):
        """Test that non-Excel files are rejected."""
        txt_file = BytesIO(b"This is not an Excel file")

        response = client.post(
            "/api/upload/",
            files={"file": ("test.txt", txt_file, "text/plain")},
            data={"numTables": "2", "numSessions": "3"}
        )

        assert response.status_code == 400
        assert "Invalid file format" in response.json()["detail"]

    def test_missing_required_columns(self, client, mock_storage, sample_excel_file_missing_columns):
        """Test that files with missing required columns are rejected."""
        response = client.post(
            "/api/upload/",
            files={"file": ("test.xlsx", sample_excel_file_missing_columns, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            data={"numTables": "2", "numSessions": "3"}
        )

        assert response.status_code == 400
        detail = response.json()["detail"]
        assert "missing required columns" in detail.lower()
        assert "Gender" in detail or "Partner" in detail

    def test_num_tables_too_low(self, client, mock_storage, sample_excel_file):
        """Test that numTables < 1 is rejected."""
        response = client.post(
            "/api/upload/",
            files={"file": ("test.xlsx", sample_excel_file, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            data={"numTables": "0", "numSessions": "3"}
        )

        assert response.status_code == 422  # FastAPI validation error

    def test_num_tables_too_high(self, client, mock_storage, sample_excel_file):
        """Test that numTables > 10 is rejected."""
        response = client.post(
            "/api/upload/",
            files={"file": ("test.xlsx", sample_excel_file, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            data={"numTables": "11", "numSessions": "3"}
        )

        assert response.status_code == 422  # FastAPI validation error

    def test_num_sessions_too_low(self, client, mock_storage, sample_excel_file):
        """Test that numSessions < 1 is rejected."""
        response = client.post(
            "/api/upload/",
            files={"file": ("test.xlsx", sample_excel_file, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            data={"numTables": "2", "numSessions": "0"}
        )

        assert response.status_code == 422  # FastAPI validation error

    def test_num_sessions_too_high(self, client, mock_storage, sample_excel_file):
        """Test that numSessions > 6 is rejected."""
        response = client.post(
            "/api/upload/",
            files={"file": ("test.xlsx", sample_excel_file, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            data={"numTables": "2", "numSessions": "7"}
        )

        assert response.status_code == 422  # FastAPI validation error

    def test_not_enough_participants_for_tables(self, client, mock_storage, sample_excel_file):
        """Test that having fewer participants than tables is rejected."""
        # sample_excel_file has 4 participants
        response = client.post(
            "/api/upload/",
            files={"file": ("test.xlsx", sample_excel_file, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            data={"numTables": "5", "numSessions": "3"}  # 5 tables but only 4 participants
        )

        assert response.status_code == 400
        assert "Not enough participants" in response.json()["detail"]

    def test_too_many_participants(self, client, mock_storage, sample_excel_file_too_many):
        """Test that files with > 200 participants are rejected."""
        response = client.post(
            "/api/upload/",
            files={"file": ("test.xlsx", sample_excel_file_too_many, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            data={"numTables": "5", "numSessions": "3"}
        )

        assert response.status_code == 400
        detail = response.json()["detail"]
        assert "Maximum 200 participants" in detail
        assert "201" in detail

    def test_large_valid_file(self, client, mock_storage, sample_excel_file_large):
        """Test that files with many participants (but under limit) work."""
        response = client.post(
            "/api/upload/",
            files={"file": ("test.xlsx", sample_excel_file_large, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            data={"numTables": "10", "numSessions": "6"}
        )

        assert response.status_code == 200
        data = response.json()
        assert "session_id" in data

    def test_boundary_values(self, client, mock_storage, sample_excel_file):
        """Test boundary values for numTables and numSessions."""
        # Min values
        response = client.post(
            "/api/upload/",
            files={"file": ("test.xlsx", sample_excel_file, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            data={"numTables": "1", "numSessions": "1"}
        )
        assert response.status_code == 200

        # Max values
        sample_excel_file.seek(0)  # Reset file pointer
        response = client.post(
            "/api/upload/",
            files={"file": ("test.xlsx", sample_excel_file, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            data={"numTables": "10", "numSessions": "6"}
        )
        # This might fail due to not enough participants, but validation should pass
        assert response.status_code in [200, 400]  # Either succeeds or fails on participant count

    def test_missing_file(self, client, mock_storage):
        """Test that request without a file is rejected."""
        response = client.post(
            "/api/upload/",
            data={"numTables": "2", "numSessions": "3"}
        )

        assert response.status_code == 422  # FastAPI validation error

    def test_missing_num_tables(self, client, mock_storage, sample_excel_file):
        """Test that request without numTables is rejected."""
        response = client.post(
            "/api/upload/",
            files={"file": ("test.xlsx", sample_excel_file, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            data={"numSessions": "3"}
        )

        assert response.status_code == 422  # FastAPI validation error

    def test_missing_num_sessions(self, client, mock_storage, sample_excel_file):
        """Test that request without numSessions is rejected."""
        response = client.post(
            "/api/upload/",
            files={"file": ("test.xlsx", sample_excel_file, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            data={"numTables": "2"}
        )

        assert response.status_code == 422  # FastAPI validation error

    def test_session_id_format(self, client, mock_storage, sample_excel_file):
        """Test that returned session_id is a valid UUID."""
        import uuid

        response = client.post(
            "/api/upload/",
            files={"file": ("test.xlsx", sample_excel_file, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            data={"numTables": "2", "numSessions": "3"}
        )

        assert response.status_code == 200
        session_id = response.json()["session_id"]

        # Verify it's a valid UUID
        try:
            uuid.UUID(session_id)
        except ValueError:
            pytest.fail(f"session_id '{session_id}' is not a valid UUID")

    def test_session_stored_correctly(self, client, mock_storage, sample_excel_file):
        """Test that session data is stored with correct structure."""
        response = client.post(
            "/api/upload/",
            files={"file": ("test.xlsx", sample_excel_file, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            data={"numTables": "2", "numSessions": "3"}
        )

        assert response.status_code == 200
        session_id = response.json()["session_id"]

        # Check that data was stored
        stored_data = mock_storage.get(f"session:{session_id}")
        assert stored_data is not None
        assert "participant_dict" in stored_data
        assert "num_tables" in stored_data
        assert "num_sessions" in stored_data
        assert "filename" in stored_data
        assert "created_at" in stored_data
        assert stored_data["num_tables"] == 2
        assert stored_data["num_sessions"] == 3
