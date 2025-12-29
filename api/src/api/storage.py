"""
Storage abstraction layer supporting Upstash REST, Redis, and in-memory storage.
Automatically falls back to in-memory storage if external storage is unavailable.
"""

import json
import logging
import os
from datetime import datetime, timedelta
from typing import Optional, Any

logger = logging.getLogger(__name__)

# Try to import storage libraries, but gracefully fall back if not available
try:
    from upstash_redis import Redis as UpstashRedis
    UPSTASH_AVAILABLE = True
except ImportError:
    UPSTASH_AVAILABLE = False
    logger.debug("upstash-redis library not installed.")

try:
    import redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
    logger.debug("redis library not installed.")


class StorageBackend:
    """Abstract storage interface"""

    def set(self, key: str, value: Any, ttl_seconds: Optional[int] = None) -> None:
        raise NotImplementedError

    def get(self, key: str) -> Optional[Any]:
        raise NotImplementedError

    def delete(self, key: str) -> None:
        raise NotImplementedError

    def exists(self, key: str) -> bool:
        raise NotImplementedError

    def keys(self, pattern: str = "*") -> list[str]:
        raise NotImplementedError


class UpstashRestBackend(StorageBackend):
    """Upstash REST API storage (serverless-optimized, no persistent connections)"""

    def __init__(self, rest_url: str, rest_token: str):
        self.client = UpstashRedis(url=rest_url, token=rest_token)
        logger.info(f"Connected to Upstash REST at {rest_url}")

    def set(self, key: str, value: Any, ttl_seconds: Optional[int] = None) -> None:
        serialized = json.dumps(value)
        if ttl_seconds:
            self.client.setex(key, ttl_seconds, serialized)
        else:
            self.client.set(key, serialized)

    def get(self, key: str) -> Optional[Any]:
        data = self.client.get(key)
        if data is None:
            return None
        # Upstash REST client returns string directly
        if isinstance(data, str):
            return json.loads(data)
        return data

    def delete(self, key: str) -> None:
        self.client.delete(key)

    def exists(self, key: str) -> bool:
        return self.client.exists(key) > 0

    def keys(self, pattern: str = "*") -> list[str]:
        # Upstash REST returns list of strings directly
        result = self.client.keys(pattern)
        return result if result else []


class RedisBackend(StorageBackend):
    """Redis-based storage with automatic JSON serialization"""

    def __init__(self, redis_url: str):
        self.client = redis.from_url(redis_url, decode_responses=True)
        logger.info(f"Connected to Redis at {redis_url}")

    def set(self, key: str, value: Any, ttl_seconds: Optional[int] = None) -> None:
        serialized = json.dumps(value)
        if ttl_seconds:
            self.client.setex(key, ttl_seconds, serialized)
        else:
            self.client.set(key, serialized)

    def get(self, key: str) -> Optional[Any]:
        data = self.client.get(key)
        if data is None:
            return None
        return json.loads(data)

    def delete(self, key: str) -> None:
        self.client.delete(key)

    def exists(self, key: str) -> bool:
        return self.client.exists(key) > 0

    def keys(self, pattern: str = "*") -> list[str]:
        return [k.decode() if isinstance(k, bytes) else k for k in self.client.keys(pattern)]


class InMemoryBackend(StorageBackend):
    """In-memory storage with TTL support (fallback when Redis unavailable)"""

    def __init__(self):
        self.data: dict[str, tuple[Any, Optional[datetime]]] = {}
        logger.warning("Using in-memory storage (data will be lost on restart)")

    def _cleanup_expired(self) -> None:
        """Remove expired keys"""
        current_time = datetime.now()
        expired_keys = [
            key for key, (_, expiry) in self.data.items()
            if expiry and current_time > expiry
        ]
        for key in expired_keys:
            del self.data[key]

    def set(self, key: str, value: Any, ttl_seconds: Optional[int] = None) -> None:
        expiry = None
        if ttl_seconds:
            expiry = datetime.now() + timedelta(seconds=ttl_seconds)
        self.data[key] = (value, expiry)

    def get(self, key: str) -> Optional[Any]:
        self._cleanup_expired()
        if key not in self.data:
            return None
        value, expiry = self.data[key]
        if expiry and datetime.now() > expiry:
            del self.data[key]
            return None
        return value

    def delete(self, key: str) -> None:
        if key in self.data:
            del self.data[key]

    def exists(self, key: str) -> bool:
        self._cleanup_expired()
        return key in self.data

    def keys(self, pattern: str = "*") -> list[str]:
        self._cleanup_expired()
        if pattern == "*":
            return list(self.data.keys())
        # Simple pattern matching (only supports "*" wildcard)
        import fnmatch
        return [key for key in self.data.keys() if fnmatch.fnmatch(key, pattern)]


def create_storage_backend() -> StorageBackend:
    """
    Create appropriate storage backend based on environment.
    Priority: Upstash REST (serverless-optimized) > Redis > In-memory
    """
    # First try Upstash REST (best for serverless environments)
    upstash_url = os.getenv("UPSTASH_REDIS_REST_URL")
    upstash_token = os.getenv("UPSTASH_REDIS_REST_TOKEN")

    if upstash_url and upstash_token and UPSTASH_AVAILABLE:
        try:
            return UpstashRestBackend(upstash_url, upstash_token)
        except Exception as e:
            logger.error(f"Failed to connect to Upstash REST at {upstash_url}: {e}")
            logger.warning("Falling back to in-memory storage")
            return InMemoryBackend()
    elif upstash_url and upstash_token and not UPSTASH_AVAILABLE:
        logger.warning(f"UPSTASH_REDIS_REST_URL set, but upstash-redis library not installed")
        logger.warning("Falling back to in-memory storage")
        return InMemoryBackend()

    # Fall back to standard Redis protocol
    redis_url = os.getenv("REDIS_URL")
    if redis_url and REDIS_AVAILABLE:
        try:
            return RedisBackend(redis_url)
        except Exception as e:
            logger.error(f"Failed to connect to Redis at {redis_url}: {e}")
            logger.warning("Falling back to in-memory storage")
            return InMemoryBackend()
    elif redis_url and not REDIS_AVAILABLE:
        logger.warning(f"REDIS_URL set, but redis library not installed")
        logger.warning("Falling back to in-memory storage")
        return InMemoryBackend()

    # No external storage configured
    logger.info("No external storage configured, using in-memory storage")
    return InMemoryBackend()


# Global storage instance
storage = create_storage_backend()


# Convenience functions for session and result storage
SESSION_PREFIX = "session:"
RESULT_PREFIX = "result:"
RESULT_VERSIONS_SUFFIX = ":versions"
RESULT_LATEST_SUFFIX = ":latest"
SESSION_TTL = 3600  # 1 hour
RESULT_TTL = 30 * 24 * 3600  # 30 days
MAX_RESULT_VERSIONS = 5  # Keep last 5 versions


def store_session(session_id: str, data: dict) -> None:
    """Store upload session data (1 hour TTL)"""
    storage.set(f"{SESSION_PREFIX}{session_id}", data, SESSION_TTL)


def get_session(session_id: str) -> Optional[dict]:
    """Retrieve upload session data"""
    return storage.get(f"{SESSION_PREFIX}{session_id}")


def delete_session(session_id: str) -> None:
    """Delete upload session data"""
    storage.delete(f"{SESSION_PREFIX}{session_id}")


def session_exists(session_id: str) -> bool:
    """Check if session exists"""
    return storage.exists(f"{SESSION_PREFIX}{session_id}")


def store_result(session_id: str, data: dict, version_id: Optional[str] = None) -> str:
    """
    Store assignment results with versioning (30 day TTL).

    Args:
        session_id: The session ID
        data: Result data to store
        version_id: Optional version ID. If None, auto-increments.

    Returns:
        The version ID that was stored
    """
    import time

    # Get current versions list
    versions_key = f"{RESULT_PREFIX}{session_id}{RESULT_VERSIONS_SUFFIX}"
    versions = storage.get(versions_key) or []

    # Generate version ID if not provided
    if version_id is None:
        version_num = len(versions) + 1
        version_id = f"v{version_num}"

    # Add metadata to result
    result_with_metadata = {
        **data,
        "version_id": version_id,
        "created_at": time.time()
    }

    # Store the versioned result
    version_key = f"{RESULT_PREFIX}{session_id}:{version_id}"
    storage.set(version_key, result_with_metadata, RESULT_TTL)

    # Update versions list
    version_info = {
        "version_id": version_id,
        "created_at": result_with_metadata["created_at"],
        "solve_time": data.get("metadata", {}).get("solve_time"),
        "solution_quality": data.get("metadata", {}).get("solution_quality")
    }

    # Append new version
    versions.append(version_info)

    # Prune old versions (keep last MAX_RESULT_VERSIONS)
    if len(versions) > MAX_RESULT_VERSIONS:
        old_versions = versions[:-MAX_RESULT_VERSIONS]
        versions = versions[-MAX_RESULT_VERSIONS:]

        # Delete old version data
        for old_version in old_versions:
            old_version_key = f"{RESULT_PREFIX}{session_id}:{old_version['version_id']}"
            storage.delete(old_version_key)

    # Update versions list
    storage.set(versions_key, versions, RESULT_TTL)

    # Update latest pointer
    latest_key = f"{RESULT_PREFIX}{session_id}{RESULT_LATEST_SUFFIX}"
    storage.set(latest_key, version_id, RESULT_TTL)

    return version_id


def get_result(session_id: str, version_id: Optional[str] = None) -> Optional[dict]:
    """
    Retrieve assignment results.

    Args:
        session_id: The session ID
        version_id: Optional version ID. If None, returns latest.

    Returns:
        The result data, or None if not found
    """
    # If no version specified, get latest
    if version_id is None:
        latest_key = f"{RESULT_PREFIX}{session_id}{RESULT_LATEST_SUFFIX}"
        version_id = storage.get(latest_key)

        # Fallback to legacy non-versioned result
        if version_id is None:
            legacy_key = f"{RESULT_PREFIX}{session_id}"
            return storage.get(legacy_key)

    # Get versioned result
    version_key = f"{RESULT_PREFIX}{session_id}:{version_id}"
    return storage.get(version_key)


def get_result_versions(session_id: str) -> list[dict]:
    """
    Get list of all result versions for a session.

    Returns:
        List of version metadata dicts, sorted by creation time (newest first)
    """
    versions_key = f"{RESULT_PREFIX}{session_id}{RESULT_VERSIONS_SUFFIX}"
    versions = storage.get(versions_key) or []
    return list(reversed(versions))  # Newest first


def result_exists(session_id: str) -> bool:
    """Check if any result exists for this session"""
    # Check for latest pointer (new versioning system)
    latest_key = f"{RESULT_PREFIX}{session_id}{RESULT_LATEST_SUFFIX}"
    if storage.exists(latest_key):
        return True

    # Fallback to legacy non-versioned result
    legacy_key = f"{RESULT_PREFIX}{session_id}"
    return storage.exists(legacy_key)
