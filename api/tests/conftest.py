"""
Pytest configuration and shared fixtures for API tests.
"""

import pytest
from fastapi.testclient import TestClient
from io import BytesIO
import pandas as pd
from unittest.mock import MagicMock, patch


def _no_op_limit(*args, **kwargs):
    """No-op decorator for disabling rate limiting."""
    def decorator(func):
        return func
    return decorator


@pytest.fixture
def client():
    """Create a test client for the FastAPI application with rate limiting disabled."""
    # Import routers to patch their limiters
    from api.main import app
    from api.routers import upload, assignments

    # Patch the limiters in each router
    with patch.object(upload.limiter, 'limit', _no_op_limit), \
         patch.object(assignments.limiter, 'limit', _no_op_limit):
        yield TestClient(app)


@pytest.fixture
def client_with_rate_limiting():
    """Create a test client with rate limiting enabled for rate limit tests."""
    from api.main import app
    # Use the actual limiter for rate limiting tests (no patching)
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

        mock.set = mock_set
        mock.get = mock_get
        mock.exists = mock_exists
        mock.delete = mock_delete

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
