"""
Tests for the storage layer (api/storage.py).

Tests cover:
- InMemoryBackend functionality
- TTL behavior
- REQUIRE_PERSISTENT_STORAGE enforcement
"""

import pytest
from api.storage import (
    InMemoryBackend,
    create_storage_backend,
)
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

    @patch.dict(
        os.environ,
        {
            "REQUIRE_PERSISTENT_STORAGE": "true",
            "UPSTASH_REDIS_REST_URL": "http://fake-url",
            "UPSTASH_REDIS_REST_TOKEN": "fake-token",
        },
        clear=True,
    )
    @patch("api.storage.UPSTASH_AVAILABLE", False)
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
