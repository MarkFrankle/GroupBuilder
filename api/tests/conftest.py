"""
Pytest configuration and shared fixtures for API tests.
"""

import os
# Set environment variable to disable rate limiting before importing app
os.environ['TESTING'] = 'true'

import pytest
from fastapi.testclient import TestClient
from io import BytesIO
import pandas as pd
from unittest.mock import MagicMock, patch


@pytest.fixture
def client():
    """Create a test client for the FastAPI application with rate limiting disabled."""
    # Rate limiting is disabled via TESTING=true env var set at top of conftest
    from api.main import app

    # Clear any existing rate limiter state before test
    if hasattr(app.state, 'limiter') and hasattr(app.state.limiter, '_storage'):
        try:
            app.state.limiter._storage.storage.clear()
        except:
            pass

    yield TestClient(app)

    # Clear rate limiter state after test
    if hasattr(app.state, 'limiter') and hasattr(app.state.limiter, '_storage'):
        try:
            app.state.limiter._storage.storage.clear()
        except:
            pass


@pytest.fixture
def client_with_rate_limiting():
    """Create a test client with rate limiting enabled for rate limit tests."""
    # For rate limiting tests, we need to reimport with TESTING=false
    # Save current modules to restore later
    import sys
    saved_modules = {}
    modules_to_reload = [
        'api.main',
        'api.routers.upload',
        'api.routers.assignments'
    ]

    for mod_name in modules_to_reload:
        if mod_name in sys.modules:
            saved_modules[mod_name] = sys.modules[mod_name]
            del sys.modules[mod_name]

    # Temporarily disable TESTING mode
    old_val = os.environ.get('TESTING')
    os.environ['TESTING'] = 'false'

    try:
        # Import with rate limiting enabled
        from api.main import app

        # Clear any existing rate limiter state before test
        if hasattr(app.state.limiter, '_storage'):
            app.state.limiter._storage.storage.clear()

        yield TestClient(app)

        # Clear rate limiter state after test
        if hasattr(app.state.limiter, '_storage'):
            app.state.limiter._storage.storage.clear()
    finally:
        # Restore environment
        if old_val is not None:
            os.environ['TESTING'] = old_val
        else:
            os.environ['TESTING'] = 'true'

        # Restore original modules
        for mod_name in modules_to_reload:
            if mod_name in sys.modules:
                del sys.modules[mod_name]
        sys.modules.update(saved_modules)


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

        mock.set = mock_set
        mock.get = mock_get
        mock.exists = mock_exists
        mock.delete = mock_delete
        mock.delete_many = mock_delete_many

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
