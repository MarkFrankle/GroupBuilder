"""
Pytest configuration and shared fixtures for API tests.
"""

import os
import pytest
from fastapi.testclient import TestClient
from io import BytesIO
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


# Mock Firestore client for tests
class MockFirestoreDocumentReference:
    """Mock Firestore document reference."""

    def __init__(self, doc_id, collection):
        self.id = doc_id
        self._collection = collection
        self.reference = self
        self.parent = collection
        self._subcollections = {}

    def set(self, data, merge=False):
        """Set document data."""
        if merge and self.id in self._collection._documents:
            existing = self._collection._documents[self.id]
            existing.update(data)
        else:
            self._collection._documents[self.id] = data

    def delete(self):
        """Delete document data."""
        self._collection._documents.pop(self.id, None)

    def get(self):
        """Get document."""
        return MockFirestoreDocument(
            self.id,
            self._collection._documents.get(self.id),
            exists=self.id in self._collection._documents,
            doc_ref=self,
        )

    def collection(self, name):
        """Get subcollection."""
        if name not in self._subcollections:
            self._subcollections[name] = MockFirestoreCollection(name, parent_ref=self)
        return self._subcollections[name]


class MockFirestoreDocument:
    """Mock Firestore document."""

    def __init__(self, doc_id, data=None, exists=True, doc_ref=None):
        self.id = doc_id
        self._data = data or {}
        self.exists = exists
        self.reference = doc_ref or MockFirestoreDocumentReference(doc_id, None)
        # Set parent.parent.id for organization lookup
        if doc_ref and doc_ref.parent and hasattr(doc_ref.parent, "_parent_ref"):
            self.reference.parent.parent = doc_ref.parent._parent_ref
            if self.reference.parent.parent:
                self.reference.parent.parent.id = self.reference.parent.parent.id

    def to_dict(self):
        return self._data.copy()

    def get(self):
        return self


class MockFirestoreCollection:
    """Mock Firestore collection."""

    def __init__(self, collection_name, parent_ref=None):
        self.collection_name = collection_name
        self._documents = {}
        self._document_refs = {}  # Cache document references
        self._parent_ref = parent_ref
        self.parent = parent_ref

    def document(self, doc_id):
        """Get document reference (cached)."""
        if doc_id not in self._document_refs:
            self._document_refs[doc_id] = MockFirestoreDocumentReference(doc_id, self)
        return self._document_refs[doc_id]

    def stream(self):
        """Stream all documents."""
        docs = []
        for doc_id, data in self._documents.items():
            # Get the document reference to access subcollections
            doc_ref = self.document(doc_id)
            doc = MockFirestoreDocument(doc_id, data, exists=True, doc_ref=doc_ref)
            docs.append(doc)
        return docs

    def where(self, field, op, value):
        """Query filter."""
        query = MagicMock()
        query.limit = lambda n: query
        query.order_by = lambda *args, **kwargs: query
        query.stream = lambda: []
        return query

    def order_by(self, field, direction="ASCENDING"):
        """Order by filter - returns documents from this collection."""
        parent_collection = self
        sort_field = field
        sort_direction = direction

        class OrderedQuery:
            def __init__(self, collection, field, direction):
                self.collection = collection
                self.field = field
                self.direction = direction
                self._limit_count = None

            def limit(self, count):
                self._limit_count = count
                return self

            def stream(self):
                """Return documents from the collection, sorted by field."""
                docs = []
                for doc_id, data in self.collection._documents.items():
                    doc_ref = self.collection.document(doc_id)
                    doc = MockFirestoreDocument(
                        doc_id, data, exists=True, doc_ref=doc_ref
                    )
                    docs.append(doc)

                # Sort documents by the specified field
                def get_sort_key(doc):
                    data = doc.to_dict()
                    value = data.get(self.field)
                    # Handle datetime objects
                    if hasattr(value, "timestamp"):
                        return value.timestamp()
                    return value if value is not None else 0

                docs.sort(key=get_sort_key, reverse=(self.direction == "DESCENDING"))

                # Apply limit if specified
                if self._limit_count:
                    docs = docs[: self._limit_count]
                return docs

        return OrderedQuery(parent_collection, sort_field, sort_direction)


class MockFirestoreClient:
    """Mock Firestore client for testing."""

    def __init__(self):
        self._collections = {}

    def collection(self, collection_name):
        """Get or create collection."""
        if collection_name not in self._collections:
            self._collections[collection_name] = MockFirestoreCollection(
                collection_name
            )
        return self._collections[collection_name]

    def collection_group(self, collection_name):
        """Mock collection group query - searches all subcollections with this name."""

        class CollectionGroupQuery:
            def __init__(self, client, collection_name):
                self.client = client
                self.collection_name = collection_name
                self._where_field = None
                self._where_value = None
                self._limit_count = None

            def where(self, field, op, value):
                """Add where filter."""
                self._where_field = field
                self._where_value = value
                return self

            def limit(self, count):
                """Add limit."""
                self._limit_count = count
                return self

            def stream(self):
                """Execute query and return matching documents."""
                results = []

                # Search through all collections for subcollections with this name
                def search_collection(col_ref, path_parts=[]):
                    # Check documents in this collection for subcollections
                    for doc_id, doc_ref in col_ref._document_refs.items():
                        # Check if this document has the named subcollection
                        if collection_name in doc_ref._subcollections:
                            subcol = doc_ref._subcollections[collection_name]
                            # Search documents in the subcollection
                            for sub_doc_id, sub_doc_data in subcol._documents.items():
                                # Apply where filter if specified
                                if self._where_field:
                                    if (
                                        sub_doc_data.get(self._where_field)
                                        == self._where_value
                                    ):
                                        sub_doc_ref = subcol.document(sub_doc_id)
                                        results.append(
                                            MockFirestoreDocument(
                                                sub_doc_id,
                                                sub_doc_data,
                                                exists=True,
                                                doc_ref=sub_doc_ref,
                                            )
                                        )
                                else:
                                    # No filter, include all
                                    sub_doc_ref = subcol.document(sub_doc_id)
                                    results.append(
                                        MockFirestoreDocument(
                                            sub_doc_id,
                                            sub_doc_data,
                                            exists=True,
                                            doc_ref=sub_doc_ref,
                                        )
                                    )

                        # Recursively search deeper subcollections
                        for subcol_name, subcol_ref in doc_ref._subcollections.items():
                            search_collection(
                                subcol_ref, path_parts + [doc_id, subcol_name]
                            )

                # Start search from all top-level collections
                for col_name, col_ref in self.client._collections.items():
                    search_collection(col_ref, [col_name])

                # Apply limit if specified
                if self._limit_count:
                    results = results[: self._limit_count]

                return results

        return CollectionGroupQuery(self, collection_name)


# Patch get_firestore_client at module level
_mock_firestore_client = MockFirestoreClient()


def _get_mock_firestore_client():
    """Return mock Firestore client for tests."""
    return _mock_firestore_client


# Patch before importing the app
import api.firebase_admin

api.firebase_admin.get_firestore_client = _get_mock_firestore_client


@pytest.fixture
def client():
    """Create a test client for the FastAPI application with rate limiting disabled."""
    from api.main import app
    from api.middleware.auth import require_session_access, get_current_user, AuthUser

    # Mock auth to return a test user for all requests
    async def mock_auth():
        return AuthUser(
            user_id="test_user", email="test@example.com", email_verified=True
        )

    from api.routers.roster import _get_org_id

    # Override both auth dependencies
    app.dependency_overrides[require_session_access] = mock_auth
    app.dependency_overrides[get_current_user] = mock_auth
    app.dependency_overrides[_get_org_id] = lambda: "test_org_id"

    # Set up test organization in mock Firestore
    _mock_firestore_client._collections.clear()  # Clear any existing data
    orgs_collection = _mock_firestore_client.collection("organizations")

    # Create test organization
    test_org_ref = orgs_collection.document("test_org_id")
    test_org_ref.set(
        {
            "name": "Test Organization",
            "active": True,
            "created_at": "2024-01-01T00:00:00Z",
        }
    )

    # Add test user as member of organization
    member_ref = test_org_ref.collection("members").document("test_user")
    member_ref.set(
        {
            "email": "test@example.com",
            "role": "facilitator",
            "joined_at": "2024-01-01T00:00:00Z",
        }
    )

    client = TestClient(app)

    yield client

    # Clean up overrides after test
    app.dependency_overrides.clear()


@pytest.fixture
def client_with_auth():
    """Create a test client WITHOUT auth bypass for testing auth protection."""
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
    with patch("api.storage.storage") as mock:
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
def huge_file():
    """Create a file larger than 10MB for testing file size limits."""
    # Create a buffer with > 10MB of data
    buffer = BytesIO(b"x" * (11 * 1024 * 1024))  # 11MB
    return buffer


@pytest.fixture
def add_session_to_firestore():
    """Fixture that returns a function to add sessions to mock Firestore."""

    def _add_session(session_id: str, session_data: dict, org_id: str = "test_org_id"):
        """Helper to add a session to mock Firestore.

        Args:
            session_id: Session UUID
            session_data: Dict with keys: participant_dict/participant_data, num_tables, num_sessions, filename
            org_id: Organization ID (default: test_org_id)
        """
        from api.services.session_storage import SessionStorage

        storage = SessionStorage()

        # Convert participant_dict to participant_data if needed (test fixture compatibility)
        participant_data = session_data.get("participant_data") or session_data.get(
            "participant_dict"
        )

        storage.save_session(
            org_id=org_id,
            session_id=session_id,
            user_id="test_user",
            participant_data=participant_data,
            filename=session_data.get("filename", "test.xlsx"),
            num_tables=session_data["num_tables"],
            num_sessions=session_data["num_sessions"],
        )

    return _add_session


@pytest.fixture
def add_results_to_firestore():
    """Fixture that returns a function to add results to mock Firestore."""

    def _add_results(
        session_id: str,
        version_id: str,
        assignments: dict,
        metadata: dict = None,
        org_id: str = "test_org_id",
    ):
        """Helper to add results to mock Firestore.

        Args:
            session_id: Session UUID
            version_id: Version identifier (e.g., "v1")
            assignments: Assignment data
            metadata: Result metadata
            org_id: Organization ID (default: test_org_id)
        """
        from api.services.session_storage import SessionStorage
        from datetime import datetime, timezone

        storage = SessionStorage()

        if metadata is None:
            metadata = {"solution_quality": "optimal", "solve_time": 1.5}

        storage.save_results(
            session_id=session_id,
            version_id=version_id,
            assignments=assignments,
            metadata=metadata,
            org_id=org_id,
        )

    return _add_results
