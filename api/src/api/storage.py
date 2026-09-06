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

    def delete_many(self, keys: list[str]) -> None:
        """Delete multiple keys efficiently (uses batch/pipeline if available)."""
        for key in keys:
            self.delete(key)

    def exists(self, key: str) -> bool:
        raise NotImplementedError

    def keys(self, pattern: str = "*") -> list[str]:
        raise NotImplementedError

    def expire(self, key: str, ttl_seconds: int) -> bool:
        """Refresh TTL on an existing key. Returns True if key exists and TTL was set."""
        raise NotImplementedError

    def incr(self, key: str) -> int:
        """Atomically increment a counter. Returns the new value."""
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

    def delete_many(self, keys: list[str]) -> None:
        """Delete multiple keys in a single batch operation."""
        if keys:
            self.client.delete(*keys)

    def exists(self, key: str) -> bool:
        return self.client.exists(key) > 0

    def keys(self, pattern: str = "*") -> list[str]:
        # Upstash REST returns list of strings directly
        result = self.client.keys(pattern)
        return result if result else []

    def expire(self, key: str, ttl_seconds: int) -> bool:
        """Refresh TTL on an existing key."""
        return self.client.expire(key, ttl_seconds) > 0

    def incr(self, key: str) -> int:
        """Atomically increment a counter."""
        return self.client.incr(key)


class RedisBackend(StorageBackend):
    """
    Redis-based storage with automatic JSON serialization and connection pooling.

    Connection pool settings can be configured via environment variables:
    - REDIS_POOL_MAX_CONNECTIONS: Maximum connections in pool (default: 10)
    - REDIS_POOL_TIMEOUT: Connection timeout in seconds (default: 5)
    """

    def __init__(self, redis_url: str):
        # Get pool configuration from environment
        max_connections = int(os.getenv("REDIS_POOL_MAX_CONNECTIONS", "10"))
        timeout = int(os.getenv("REDIS_POOL_TIMEOUT", "5"))

        # Create connection pool
        pool = redis.ConnectionPool.from_url(
            redis_url,
            max_connections=max_connections,
            socket_connect_timeout=timeout,
            socket_keepalive=True,
            decode_responses=True,
        )

        # Create client with connection pool
        self.client = redis.Redis(connection_pool=pool)
        self.pool = pool

        logger.info(
            f"Connected to Redis at {redis_url} "
            f"(pool: max_connections={max_connections}, timeout={timeout}s)"
        )

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

    def delete_many(self, keys: list[str]) -> None:
        """Delete multiple keys using Redis pipeline for efficiency."""
        if not keys:
            return
        with self.client.pipeline() as pipe:
            for key in keys:
                pipe.delete(key)
            pipe.execute()

    def exists(self, key: str) -> bool:
        return self.client.exists(key) > 0

    def keys(self, pattern: str = "*") -> list[str]:
        return [
            k.decode() if isinstance(k, bytes) else k for k in self.client.keys(pattern)
        ]

    def expire(self, key: str, ttl_seconds: int) -> bool:
        """Refresh TTL on an existing key."""
        return self.client.expire(key, ttl_seconds) > 0

    def incr(self, key: str) -> int:
        """Atomically increment a counter."""
        return self.client.incr(key)

    def close(self) -> None:
        """Close all connections in the pool."""
        if hasattr(self, "pool"):
            self.pool.disconnect()
            logger.info("Redis connection pool closed")


class InMemoryBackend(StorageBackend):
    """In-memory storage with TTL support (fallback when Redis unavailable)"""

    def __init__(self):
        self.data: dict[str, tuple[Any, Optional[datetime]]] = {}
        logger.warning("Using in-memory storage (data will be lost on restart)")

    def _cleanup_expired(self) -> None:
        """Remove expired keys"""
        current_time = datetime.now()
        expired_keys = [
            key
            for key, (_, expiry) in self.data.items()
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

    def expire(self, key: str, ttl_seconds: int) -> bool:
        """Refresh TTL on an existing key."""
        if key not in self.data:
            return False
        value, _ = self.data[key]
        expiry = datetime.now() + timedelta(seconds=ttl_seconds)
        self.data[key] = (value, expiry)
        return True

    def incr(self, key: str) -> int:
        """Atomically increment a counter."""
        if key in self.data:
            value, expiry = self.data[key]
            new_value = int(value) + 1
        else:
            new_value = 1
            expiry = None
        self.data[key] = (new_value, expiry)
        return new_value


def create_storage_backend() -> StorageBackend:
    """
    Create appropriate storage backend based on environment.
    Priority: Upstash REST (serverless-optimized) > Redis > In-memory

    Set REQUIRE_PERSISTENT_STORAGE=true in production to fail hard if external storage unavailable.
    """
    require_persistent = (
        os.getenv("REQUIRE_PERSISTENT_STORAGE", "false").lower() == "true"
    )

    # First try Upstash REST (best for serverless environments)
    upstash_url = os.getenv("UPSTASH_REDIS_REST_URL", "").strip()
    upstash_token = os.getenv("UPSTASH_REDIS_REST_TOKEN", "").strip()

    if upstash_url and upstash_token and UPSTASH_AVAILABLE:
        try:
            return UpstashRestBackend(upstash_url, upstash_token)
        except Exception as e:
            logger.error(f"Failed to connect to Upstash REST at {upstash_url}: {e}")
            if require_persistent:
                raise RuntimeError(
                    "REQUIRE_PERSISTENT_STORAGE is enabled but Upstash connection failed. "
                    "Cannot start with in-memory storage in production."
                ) from e
            logger.warning("Falling back to in-memory storage")
            return InMemoryBackend()
    elif upstash_url and upstash_token and not UPSTASH_AVAILABLE:
        error_msg = (
            "UPSTASH_REDIS_REST_URL set, but upstash-redis library not installed"
        )
        logger.warning(error_msg)
        if require_persistent:
            raise RuntimeError(
                f"{error_msg}. Cannot start with in-memory storage in production."
            )
        logger.warning("Falling back to in-memory storage")
        return InMemoryBackend()

    # Fall back to standard Redis protocol
    redis_url = os.getenv("REDIS_URL")
    if redis_url and REDIS_AVAILABLE:
        try:
            return RedisBackend(redis_url)
        except Exception as e:
            logger.error(f"Failed to connect to Redis at {redis_url}: {e}")
            if require_persistent:
                raise RuntimeError(
                    "REQUIRE_PERSISTENT_STORAGE is enabled but Redis connection failed. "
                    "Cannot start with in-memory storage in production."
                ) from e
            logger.warning("Falling back to in-memory storage")
            return InMemoryBackend()
    elif redis_url and not REDIS_AVAILABLE:
        error_msg = "REDIS_URL set, but redis library not installed"
        logger.warning(error_msg)
        if require_persistent:
            raise RuntimeError(
                f"{error_msg}. Cannot start with in-memory storage in production."
            )
        logger.warning("Falling back to in-memory storage")
        return InMemoryBackend()

    # No external storage configured
    if require_persistent:
        raise RuntimeError(
            "REQUIRE_PERSISTENT_STORAGE is enabled but no external storage configured. "
            "Set UPSTASH_REDIS_REST_URL/TOKEN or REDIS_URL."
        )

    logger.info("No external storage configured, using in-memory storage")
    return InMemoryBackend()


# Global storage instance
storage = create_storage_backend()
