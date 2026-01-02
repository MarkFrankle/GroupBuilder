"""
Pytest configuration and shared fixtures for API tests.
"""

import os
import pytest
from fastapi.testclient import TestClient
from io import BytesIO
import pandas as pd
from unittest.mock import MagicMock, patch

# Patch slowapi BEFORE any imports to disable rate limiting in tests
_original_limit = None

def _no_op_decorator(*args, **kwargs):
    """No-op decorator that returns the function unchanged."""
    def decorator(func):
        return func
    return decorator

# Patch it at module level before app import
import slowapi
slowapi.Limiter.limit = _no_op_decorator


@pytest.fixture
def client():
    """Create a test client for the FastAPI application with rate limiting disabled."""
    from api.main import app
    return TestClient(app)


@pytest.fixture
def client_with_rate_limiting():
    """Create a test client with rate limiting enabled for rate limit tests."""
    # Note: Rate limiting tests are currently skipped due to test isolation issues
    # This fixture is kept for documentation purposes
    from api.main import app
    return TestClient(app)


@pytest.fixture
def mock_storage():
    """Mock the storage backend to avoid needing Redis/Upstash in tests."""
    with patch('api.storage.storage') as mock:
        # Set up mock to behave like a storage backend
        mock.data = {}

        def mock_set(key, value, ttl=None):
            mock.data[key] = value

        def mock_get(key):
            return mock.data.get(key)

        def mock_exists(key):
            return key in mock.data

        def mock_delete(key):
            if key in mock.data:
                del mock.data[key]

        def mock_delete_many(keys):
            for key in keys:
                if key in mock.data:
                    del mock.data[key]

        def mock_expire(key, ttl_seconds):
            # In real storage, this extends TTL. For mock, just return success if key exists
            return key in mock.data

        def mock_incr(key):
            # Atomic increment - simulate counter behavior
            if key in mock.data:
                mock.data[key] = int(mock.data[key]) + 1
            else:
                mock.data[key] = 1
            return mock.data[key]

        mock.set = mock_set
        mock.get = mock_get
        mock.exists = mock_exists
        mock.delete = mock_delete
        mock.delete_many = mock_delete_many
        mock.expire = mock_expire
        mock.incr = mock_incr

        yield mock


@pytest.fixture
def sample_excel_file():
    """Create a valid sample Excel file for testing."""
    data = {
        'Name': ['Alice Johnson', 'Bob Smith', 'Charlie Davis', 'Diana Prince'],
        'Religion': ['Christian', 'Jewish', 'Muslim', 'Christian'],
        'Gender': ['Female', 'Male', 'Male', 'Female'],
        'Partner': ['Bob Smith', 'Alice Johnson', '', 'N/A']
    }
    df = pd.DataFrame(data)

    # Write to BytesIO
    buffer = BytesIO()
    df.to_excel(buffer, index=False, engine='openpyxl')
    buffer.seek(0)

    return buffer


@pytest.fixture
def sample_excel_file_large():
    """Create an Excel file with many participants (100)."""
    data = {
        'Name': [f'Person {i}' for i in range(100)],
        'Religion': ['Christian', 'Jewish', 'Muslim', 'Other'] * 25,
        'Gender': ['Male', 'Female'] * 50,
        'Partner': [''] * 100
    }
    df = pd.DataFrame(data)

    buffer = BytesIO()
    df.to_excel(buffer, index=False, engine='openpyxl')
    buffer.seek(0)

    return buffer


@pytest.fixture
def sample_excel_file_too_many():
    """Create an Excel file with too many participants (201)."""
    data = {
        'Name': [f'Person {i}' for i in range(201)],
        'Religion': ['Christian'] * 201,
        'Gender': ['Male'] * 201,
        'Partner': [''] * 201
    }
    df = pd.DataFrame(data)

    buffer = BytesIO()
    df.to_excel(buffer, index=False, engine='openpyxl')
    buffer.seek(0)

    return buffer


@pytest.fixture
def sample_excel_file_missing_columns():
    """Create an Excel file with missing required columns."""
    data = {
        'Name': ['Alice', 'Bob'],
        'Religion': ['Christian', 'Jewish'],
        # Missing 'Gender' and 'Partner'
    }
    df = pd.DataFrame(data)

    buffer = BytesIO()
    df.to_excel(buffer, index=False, engine='openpyxl')
    buffer.seek(0)

    return buffer


@pytest.fixture
def huge_file():
    """Create a file larger than 10MB for testing file size limits."""
    # Create a buffer with > 10MB of data
    buffer = BytesIO(b'x' * (11 * 1024 * 1024))  # 11MB
    return buffer
