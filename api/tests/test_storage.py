"""
Tests for the storage layer (api/storage.py).

Tests cover:
- InMemoryBackend functionality
- store_session / get_session / delete_session
- store_result / get_result (with versioning)
- get_result_versions
- result_exists / session_exists
- TTL behavior
- Version pruning (max 5 versions)
- REQUIRE_PERSISTENT_STORAGE enforcement
"""

import pytest
from api.storage import (
    InMemoryBackend,
    store_session,
    get_session,
    delete_session,
    session_exists,
    store_result,
    get_result,
    result_exists,
    get_result_versions,
    create_storage_backend,
    SESSION_TTL,
    RESULT_TTL,
    MAX_RESULT_VERSIONS,
)
from datetime import datetime, timedelta
import time
import os
from unittest.mock import patch


class TestInMemoryBackend:
    """Test suite for InMemoryBackend."""

    def test_set_and_get(self):
        """Test basic set and get operations."""
        backend = InMemoryBackend()
        backend.set("test_key", {"data": "value"})

        result = backend.get("test_key")
        assert result == {"data": "value"}

    def test_get_nonexistent(self):
        """Test getting nonexistent key returns None."""
        backend = InMemoryBackend()
        assert backend.get("nonexistent") is None

    def test_exists(self):
        """Test exists check."""
        backend = InMemoryBackend()
        backend.set("test_key", "value")

        assert backend.exists("test_key") is True
        assert backend.exists("nonexistent") is False

    def test_delete(self):
        """Test deletion."""
        backend = InMemoryBackend()
        backend.set("test_key", "value")

        backend.delete("test_key")
        assert backend.exists("test_key") is False
        assert backend.get("test_key") is None

    def test_delete_nonexistent(self):
        """Test deleting nonexistent key doesn't error."""
        backend = InMemoryBackend()
        backend.delete("nonexistent")  # Should not raise

    def test_ttl_expiry(self):
        """Test that keys with TTL expire."""
        backend = InMemoryBackend()
        backend.set("test_key", "value", ttl_seconds=1)

        # Should exist immediately
        assert backend.exists("test_key") is True
        assert backend.get("test_key") == "value"

        # Wait for expiry
        time.sleep(1.1)

        # Should be expired
        assert backend.exists("test_key") is False
        assert backend.get("test_key") is None

    def test_keys_pattern_matching(self):
        """Test keys method with pattern matching."""
        backend = InMemoryBackend()
        backend.set("session:123", "data1")
        backend.set("session:456", "data2")
        backend.set("result:789", "data3")

        # All keys
        all_keys = backend.keys("*")
        assert len(all_keys) == 3

        # Pattern match
        session_keys = backend.keys("session:*")
        assert len(session_keys) == 2
        assert "session:123" in session_keys
        assert "session:456" in session_keys

    def test_cleanup_expired_keys(self):
        """Test that _cleanup_expired removes old keys."""
        backend = InMemoryBackend()
        backend.set("key1", "value1", ttl_seconds=1)
        backend.set("key2", "value2")  # No expiry

        time.sleep(1.1)

        # Trigger cleanup
        backend._cleanup_expired()

        assert backend.exists("key1") is False
        assert backend.exists("key2") is True


class TestSessionStorage:
    """Test suite for session storage functions."""

    def test_store_and_get_session(self, mock_storage):
        """Test storing and retrieving session data."""
        session_id = "test-session-123"
        session_data = {
            "participant_dict": [{"id": 1, "name": "Alice"}],
            "num_tables": 2,
            "num_sessions": 3,
        }

        store_session(session_id, session_data)
        retrieved = get_session(session_id)

        assert retrieved == session_data

    def test_session_exists(self, mock_storage):
        """Test session_exists check."""
        session_id = "test-session-456"

        assert session_exists(session_id) is False

        store_session(session_id, {"data": "test"})

        assert session_exists(session_id) is True

    def test_delete_session(self, mock_storage):
        """Test session deletion."""
        session_id = "test-session-789"
        store_session(session_id, {"data": "test"})

        delete_session(session_id)

        assert session_exists(session_id) is False
        assert get_session(session_id) is None


class TestResultStorage:
    """Test suite for result storage functions (with versioning)."""

    def test_store_and_get_result(self, mock_storage):
        """Test storing and retrieving results."""
        session_id = "test-session-result"
        result_data = {
            "assignments": [{"session": 1, "tables": {}}],
            "metadata": {"solution_quality": "optimal"},
        }

        version_id = store_result(session_id, result_data)

        assert version_id == "v1"

        retrieved = get_result(session_id)
        assert retrieved["assignments"] == result_data["assignments"]
        assert retrieved["version_id"] == "v1"

    def test_store_multiple_versions(self, mock_storage):
        """Test storing multiple versions."""
        session_id = "test-session-versions"

        v1_id = store_result(session_id, {"assignments": "v1"})
        v2_id = store_result(session_id, {"assignments": "v2"})
        v3_id = store_result(session_id, {"assignments": "v3"})

        assert v1_id == "v1"
        assert v2_id == "v2"
        assert v3_id == "v3"

        # Latest should be v3
        latest = get_result(session_id)
        assert latest["version_id"] == "v3"

        # Can retrieve specific versions
        v1 = get_result(session_id, "v1")
        assert v1["version_id"] == "v1"

    def test_version_pruning(self, mock_storage):
        """Test that old versions are pruned after MAX_RESULT_VERSIONS."""
        session_id = "test-session-pruning"

        # Store MAX_RESULT_VERSIONS + 2 versions
        for i in range(MAX_RESULT_VERSIONS + 2):
            store_result(session_id, {"assignments": f"v{i+1}"})

        # Only last MAX_RESULT_VERSIONS should exist
        versions = get_result_versions(session_id)
        assert len(versions) <= MAX_RESULT_VERSIONS

        # First versions should be gone
        v1 = get_result(session_id, "v1")
        assert v1 is None

        # Latest versions should exist
        latest_version_num = MAX_RESULT_VERSIONS + 2
        latest = get_result(session_id, f"v{latest_version_num}")
        assert latest is not None

    def test_get_result_versions(self, mock_storage):
        """Test getting list of versions."""
        session_id = "test-session-version-list"

        store_result(session_id, {"assignments": "v1"})
        store_result(session_id, {"assignments": "v2"})

        versions = get_result_versions(session_id)

        assert len(versions) == 2
        # Should be sorted newest first
        assert versions[0]["version_id"] == "v2"
        assert versions[1]["version_id"] == "v1"

    def test_result_exists(self, mock_storage):
        """Test result_exists check."""
        session_id = "test-session-exists"

        assert result_exists(session_id) is False

        store_result(session_id, {"assignments": "test"})

        assert result_exists(session_id) is True

    def test_get_specific_version(self, mock_storage):
        """Test retrieving specific version."""
        session_id = "test-session-specific"

        store_result(session_id, {"assignments": "v1", "metadata": {"quality": "v1"}})
        store_result(session_id, {"assignments": "v2", "metadata": {"quality": "v2"}})

        v1 = get_result(session_id, "v1")
        assert v1["metadata"]["quality"] == "v1"

        v2 = get_result(session_id, "v2")
        assert v2["metadata"]["quality"] == "v2"

    def test_get_nonexistent_version(self, mock_storage):
        """Test getting nonexistent version returns None."""
        session_id = "test-session-nonexistent"

        store_result(session_id, {"assignments": "v1"})

        result = get_result(session_id, "v99")
        assert result is None


class TestStorageBackendSelection:
    """Test suite for create_storage_backend logic."""

    @patch.dict(os.environ, {}, clear=True)
    def test_default_in_memory(self):
        """Test that in-memory backend is used by default."""
        backend = create_storage_backend()
        assert isinstance(backend, InMemoryBackend)

    @patch.dict(os.environ, {"REQUIRE_PERSISTENT_STORAGE": "true"}, clear=True)
    def test_require_persistent_fails_without_config(self):
        """Test that REQUIRE_PERSISTENT_STORAGE=true fails without external storage."""
        with pytest.raises(RuntimeError) as exc_info:
            create_storage_backend()

        assert "REQUIRE_PERSISTENT_STORAGE is enabled" in str(exc_info.value)
        assert "no external storage configured" in str(exc_info.value)

    @patch.dict(os.environ, {
        "REQUIRE_PERSISTENT_STORAGE": "true",
        "UPSTASH_REDIS_REST_URL": "http://fake-url",
        "UPSTASH_REDIS_REST_TOKEN": "fake-token"
    }, clear=True)
    @patch('api.storage.UPSTASH_AVAILABLE', False)
    def test_require_persistent_fails_with_missing_library(self):
        """Test that REQUIRE_PERSISTENT_STORAGE=true fails when library not installed."""
        with pytest.raises(RuntimeError) as exc_info:
            create_storage_backend()

        assert "upstash-redis library not installed" in str(exc_info.value)

    @patch.dict(os.environ, {"REQUIRE_PERSISTENT_STORAGE": "false"}, clear=True)
    def test_require_persistent_false_allows_fallback(self):
        """Test that REQUIRE_PERSISTENT_STORAGE=false allows in-memory fallback."""
        backend = create_storage_backend()
        assert isinstance(backend, InMemoryBackend)

    @patch.dict(os.environ, {"REQUIRE_PERSISTENT_STORAGE": "TRUE"}, clear=True)
    def test_require_persistent_case_insensitive(self):
        """Test that REQUIRE_PERSISTENT_STORAGE is case-insensitive."""
        with pytest.raises(RuntimeError):
            create_storage_backend()
