# Multi-Tenant Authentication Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement Firebase Auth + Firestore multi-tenancy to replace security-by-obscurity with org-scoped access control

**Architecture:** Firebase Auth handles identity (passwordless magic links), Firestore stores organizations/memberships/sessions, FastAPI middleware enforces authorization, React frontend integrates Firebase Auth SDK

**Tech Stack:**
- Backend: FastAPI + firebase-admin + google-cloud-firestore
- Frontend: React + firebase (client SDK) + react-router-dom
- Infrastructure: Firebase Auth + Firestore (free tier)
- Email: SendGrid (already configured)

---

## Phase 1: Firebase Setup & Backend Dependencies

### Task 1.1: Create Firebase Project (Manual Setup)

**Manual steps (not code):**

**Step 1: Create Firebase project**
1. Go to https://console.firebase.google.com/
2. Click "Add project"
3. Project name: `groupbuilder-prod`
4. Disable Google Analytics (not needed)
5. Click "Create project"

**Step 2: Enable Firebase Authentication**
1. In Firebase console → Authentication → Get started
2. Go to "Sign-in method" tab
3. Enable "Email/Password" provider
4. Enable "Email link (passwordless sign-in)"
5. Save

**Step 3: Create Firestore database**
1. In Firebase console → Firestore Database → Create database
2. Start in **test mode** (security rules will be added later)
3. Choose location: `us-central1` (same as Cloud Run)
4. Click "Enable"

**Step 4: Generate service account key**
1. Go to Project Settings → Service Accounts
2. Click "Generate new private key"
3. Save as `firebase-service-account.json` (DO NOT commit to git)
4. Add to `.gitignore`: `firebase-service-account.json`

**Step 5: Get Firebase config for frontend**
1. Go to Project Settings → General
2. Under "Your apps", click "</>" (Web app)
3. Register app name: `groupbuilder-web`
4. Copy the `firebaseConfig` object (save for Task 4.1)

**Step 6: Update environment variables**

Add to `.env` (backend):
```
FIREBASE_PROJECT_ID=groupbuilder-prod
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
```

Add to `frontend/.env`:
```
REACT_APP_FIREBASE_API_KEY=<from config>
REACT_APP_FIREBASE_AUTH_DOMAIN=<from config>
REACT_APP_FIREBASE_PROJECT_ID=<from config>
```

**Step 7: Update .gitignore**

```bash
echo "firebase-service-account.json" >> .gitignore
git add .gitignore
git commit -m "chore: ignore Firebase service account key"
```

---

### Task 1.2: Add Firebase Dependencies to Backend

**Files:**
- Modify: `api/pyproject.toml`

**Step 1: Add Firebase Admin SDK dependency**

Edit `api/pyproject.toml`, add to `[tool.poetry.dependencies]`:

```toml
firebase-admin = "^6.5.0"
google-cloud-firestore = "^2.16.0"
```

**Step 2: Install dependencies**

Run:
```bash
cd api && poetry install
```

Expected: Successfully installs firebase-admin and google-cloud-firestore

**Step 3: Commit**

```bash
git add api/pyproject.toml api/poetry.lock
git commit -m "chore: add Firebase Admin SDK dependencies"
```

---

### Task 1.3: Initialize Firebase Admin SDK

**Files:**
- Create: `api/src/api/firebase_admin.py`
- Modify: `api/src/api/main.py`

**Step 1: Write Firebase initialization module**

Create `api/src/api/firebase_admin.py`:

```python
"""Firebase Admin SDK initialization."""
import os
import firebase_admin
from firebase_admin import credentials, firestore, auth
from typing import Optional

_firestore_client: Optional[firestore.Client] = None


def initialize_firebase():
    """Initialize Firebase Admin SDK.

    Called once at application startup.
    """
    # Get service account path from environment
    service_account_path = os.getenv(
        "FIREBASE_SERVICE_ACCOUNT_PATH",
        "./firebase-service-account.json"
    )

    # Initialize Firebase app
    cred = credentials.Certificate(service_account_path)
    firebase_admin.initialize_app(cred)

    # Initialize Firestore client
    global _firestore_client
    _firestore_client = firestore.client()

    print(f"✅ Firebase Admin SDK initialized with project: {cred.project_id}")


def get_firestore_client() -> firestore.Client:
    """Get initialized Firestore client.

    Returns:
        Firestore client instance

    Raises:
        RuntimeError: If Firebase not initialized
    """
    if _firestore_client is None:
        raise RuntimeError("Firebase not initialized. Call initialize_firebase() first.")
    return _firestore_client


def verify_firebase_token(id_token: str) -> dict:
    """Verify Firebase ID token and return decoded claims.

    Args:
        id_token: Firebase ID token from Authorization header

    Returns:
        Decoded token claims including user_id

    Raises:
        auth.InvalidIdTokenError: If token is invalid
        auth.ExpiredIdTokenError: If token is expired
    """
    decoded_token = auth.verify_id_token(id_token)
    return decoded_token
```

**Step 2: Add Firebase initialization to FastAPI startup**

Edit `api/src/api/main.py`, add to startup event:

Find the app initialization section and add:

```python
from .firebase_admin import initialize_firebase

@app.on_event("startup")
async def startup_event():
    """Initialize services on startup."""
    initialize_firebase()
    # ... existing startup code
```

**Step 3: Test Firebase initialization**

Run:
```bash
cd api && poetry run uvicorn api.main:app --reload
```

Expected: Console shows "✅ Firebase Admin SDK initialized with project: groupbuilder-prod"

**Step 4: Commit**

```bash
git add api/src/api/firebase_admin.py api/src/api/main.py
git commit -m "feat: initialize Firebase Admin SDK on startup"
```

---

## Phase 2: Backend Auth Middleware

### Task 2.1: Create Auth Middleware

**Files:**
- Create: `api/src/api/middleware/auth.py`
- Create: `api/tests/test_auth_middleware.py`

**Step 1: Write test for missing Authorization header**

Create `api/tests/test_auth_middleware.py`:

```python
"""Tests for auth middleware."""
import pytest
from fastapi import FastAPI, Depends
from fastapi.testclient import TestClient
from api.middleware.auth import get_current_user, AuthUser


@pytest.fixture
def test_app():
    """Create test FastAPI app."""
    app = FastAPI()

    @app.get("/protected")
    async def protected_route(user: AuthUser = Depends(get_current_user)):
        return {"user_id": user.user_id, "email": user.email}

    return app


def test_missing_authorization_header(test_app):
    """Should return 401 if Authorization header missing."""
    client = TestClient(test_app)
    response = client.get("/protected")

    assert response.status_code == 401
    assert response.json() == {"detail": "Authorization header missing"}


def test_invalid_authorization_format(test_app):
    """Should return 401 if Authorization header not 'Bearer <token>'."""
    client = TestClient(test_app)
    response = client.get(
        "/protected",
        headers={"Authorization": "InvalidFormat"}
    )

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid authorization header format"}
```

**Step 2: Run test to verify it fails**

Run:
```bash
cd api && poetry run pytest tests/test_auth_middleware.py -v
```

Expected: FAIL - ImportError or module not found

**Step 3: Implement auth middleware**

Create `api/src/api/middleware/auth.py`:

```python
"""Authentication middleware for Firebase tokens."""
from fastapi import Header, HTTPException, status
from typing import Optional
from pydantic import BaseModel
from .firebase_admin import verify_firebase_token
from firebase_admin import auth as firebase_auth


class AuthUser(BaseModel):
    """Authenticated user information."""
    user_id: str
    email: str
    email_verified: bool


async def get_current_user(
    authorization: Optional[str] = Header(None)
) -> AuthUser:
    """Extract and verify Firebase token from Authorization header.

    Args:
        authorization: Authorization header value (Bearer <token>)

    Returns:
        AuthUser with verified user information

    Raises:
        HTTPException: 401 if token missing, invalid, or expired
    """
    # Check Authorization header exists
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header missing"
        )

    # Parse Bearer token
    parts = authorization.split(" ")
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header format"
        )

    token = parts[1]

    # Verify Firebase token
    try:
        decoded_token = verify_firebase_token(token)
        return AuthUser(
            user_id=decoded_token["uid"],
            email=decoded_token.get("email", ""),
            email_verified=decoded_token.get("email_verified", False)
        )
    except firebase_auth.InvalidIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Firebase token"
        )
    except firebase_auth.ExpiredIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Firebase token expired"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token verification failed: {str(e)}"
        )
```

**Step 4: Run tests to verify they pass**

Run:
```bash
cd api && poetry run pytest tests/test_auth_middleware.py -v
```

Expected: PASS (2 tests)

**Step 5: Commit**

```bash
git add api/src/api/middleware/auth.py api/tests/test_auth_middleware.py
git commit -m "feat: add Firebase auth middleware with token verification"
```

---

### Task 2.2: Create Firestore Service Layer

**Files:**
- Create: `api/src/api/services/firestore_service.py`
- Create: `api/tests/test_firestore_service.py`

**Step 1: Write test for getting user organizations**

Create `api/tests/test_firestore_service.py`:

```python
"""Tests for Firestore service layer."""
import pytest
from api.services.firestore_service import FirestoreService


@pytest.fixture
def firestore_service():
    """Create FirestoreService instance for testing."""
    # Note: This will use test Firestore instance
    return FirestoreService()


def test_get_user_organizations_empty(firestore_service, monkeypatch):
    """Should return empty list if user has no orgs."""
    # Mock Firestore query to return empty results
    def mock_query(*args, **kwargs):
        class MockQuery:
            def get(self):
                return []
        return MockQuery()

    monkeypatch.setattr(
        firestore_service.db.collection("organizations"),
        "where",
        mock_query
    )

    orgs = firestore_service.get_user_organizations("user123")
    assert orgs == []


def test_check_user_can_access_session_false(firestore_service):
    """Should return False if user not in session's org."""
    # This test will fail until we implement the method
    result = firestore_service.check_user_can_access_session(
        user_id="user123",
        session_id="session456"
    )
    assert result is False
```

**Step 2: Run test to verify it fails**

Run:
```bash
cd api && poetry run pytest tests/test_firestore_service.py::test_check_user_can_access_session_false -v
```

Expected: FAIL - ImportError or method not found

**Step 3: Implement Firestore service layer**

Create `api/src/api/services/firestore_service.py`:

```python
"""Firestore service layer for organization and session access."""
from typing import List, Optional, Dict, Any
from google.cloud.firestore_v1 import Client, CollectionReference
from ..firebase_admin import get_firestore_client


class FirestoreService:
    """Service layer for Firestore operations."""

    def __init__(self):
        """Initialize with Firestore client."""
        self.db: Client = get_firestore_client()

    def get_user_organizations(self, user_id: str) -> List[Dict[str, Any]]:
        """Get all organizations a user belongs to.

        Args:
            user_id: Firebase user ID

        Returns:
            List of organization documents with id and data
        """
        orgs = []

        # Query all organizations
        orgs_ref = self.db.collection("organizations")
        org_docs = orgs_ref.stream()

        for org_doc in org_docs:
            # Check if user is a member of this org
            member_ref = org_doc.reference.collection("members").document(user_id)
            member_doc = member_ref.get()

            if member_doc.exists:
                orgs.append({
                    "id": org_doc.id,
                    **org_doc.to_dict()
                })

        return orgs

    def check_user_can_access_session(
        self,
        user_id: str,
        session_id: str
    ) -> bool:
        """Check if user has access to a session.

        Args:
            user_id: Firebase user ID
            session_id: Session UUID

        Returns:
            True if user belongs to session's organization
        """
        # Get all organizations user belongs to
        user_orgs = self.get_user_organizations(user_id)
        user_org_ids = {org["id"] for org in user_orgs}

        if not user_org_ids:
            return False

        # Find which org owns this session
        # Use collection group query to search across all orgs
        sessions_ref = self.db.collection_group("sessions")
        session_query = sessions_ref.where("__name__", "==", session_id).limit(1)
        session_docs = list(session_query.stream())

        if not session_docs:
            return False

        session_doc = session_docs[0]
        # Get org ID from parent reference
        org_id = session_doc.reference.parent.parent.id

        return org_id in user_org_ids

    def get_session_organization_id(self, session_id: str) -> Optional[str]:
        """Get the organization ID that owns a session.

        Args:
            session_id: Session UUID

        Returns:
            Organization ID or None if session not found
        """
        sessions_ref = self.db.collection_group("sessions")
        session_query = sessions_ref.where("__name__", "==", session_id).limit(1)
        session_docs = list(session_query.stream())

        if not session_docs:
            return None

        session_doc = session_docs[0]
        return session_doc.reference.parent.parent.id
```

**Step 4: Run tests to verify they pass**

Run:
```bash
cd api && poetry run pytest tests/test_firestore_service.py -v
```

Expected: PASS (requires Firestore emulator or mocking - may skip for now)

**Step 5: Commit**

```bash
git add api/src/api/services/firestore_service.py api/tests/test_firestore_service.py
git commit -m "feat: add Firestore service layer for org/session access control"
```

---

### Task 2.3: Add Authorization Dependency

**Files:**
- Modify: `api/src/api/middleware/auth.py`
- Modify: `api/tests/test_auth_middleware.py`

**Step 1: Write test for session authorization**

Add to `api/tests/test_auth_middleware.py`:

```python
from api.middleware.auth import require_session_access


def test_require_session_access_forbidden(test_app, monkeypatch):
    """Should return 403 if user doesn't have access to session."""
    # Mock get_current_user to return a user
    async def mock_get_current_user():
        return AuthUser(
            user_id="user123",
            email="test@example.com",
            email_verified=True
        )

    # Mock FirestoreService to return False for access check
    class MockFirestoreService:
        def check_user_can_access_session(self, user_id, session_id):
            return False

    monkeypatch.setattr(
        "api.middleware.auth.get_current_user",
        mock_get_current_user
    )
    monkeypatch.setattr(
        "api.middleware.auth.FirestoreService",
        lambda: MockFirestoreService()
    )

    client = TestClient(test_app)
    # Add route that uses require_session_access
    from fastapi import Depends

    @test_app.get("/session/{session_id}")
    async def session_route(
        session_id: str,
        user: AuthUser = Depends(require_session_access)
    ):
        return {"message": "Access granted"}

    response = client.get("/session/session456")
    assert response.status_code == 403
    assert "Access denied" in response.json()["detail"]
```

**Step 2: Run test to verify it fails**

Run:
```bash
cd api && poetry run pytest tests/test_auth_middleware.py::test_require_session_access_forbidden -v
```

Expected: FAIL - require_session_access not defined

**Step 3: Implement session authorization dependency**

Add to `api/src/api/middleware/auth.py`:

```python
from fastapi import Depends, Path
from ..services.firestore_service import FirestoreService


async def require_session_access(
    session_id: str = Path(..., description="Session ID from URL"),
    user: AuthUser = Depends(get_current_user)
) -> AuthUser:
    """Require that the current user has access to the specified session.

    Args:
        session_id: Session ID from path parameter
        user: Current authenticated user

    Returns:
        AuthUser if access granted

    Raises:
        HTTPException: 403 if user doesn't have access to session
    """
    firestore_service = FirestoreService()

    has_access = firestore_service.check_user_can_access_session(
        user_id=user.user_id,
        session_id=session_id
    )

    if not has_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied to session {session_id}"
        )

    return user
```

**Step 4: Run tests to verify they pass**

Run:
```bash
cd api && poetry run pytest tests/test_auth_middleware.py -v
```

Expected: PASS (all tests)

**Step 5: Commit**

```bash
git add api/src/api/middleware/auth.py api/tests/test_auth_middleware.py
git commit -m "feat: add session-level authorization dependency"
```

---

## Phase 3: Protect Existing API Endpoints

### Task 3.1: Add Auth to Assignment Results Endpoint

**Files:**
- Modify: `api/src/api/routers/assignments.py`
- Modify: `api/tests/test_assignments.py`

**Step 1: Write test for protected endpoint**

Add to `api/tests/test_assignments.py`:

```python
def test_get_results_requires_auth(client):
    """Should return 401 if no auth token provided."""
    response = client.get("/api/assignments/results/session123")
    assert response.status_code == 401


def test_get_results_requires_session_access(client, monkeypatch):
    """Should return 403 if user doesn't have access to session."""
    # Mock auth to return a user
    # Mock firestore to deny access
    # (Implementation depends on test setup)
    pass  # TODO: Implement when test infrastructure ready
```

**Step 2: Run test to verify it fails**

Run:
```bash
cd api && poetry run pytest tests/test_assignments.py::test_get_results_requires_auth -v
```

Expected: FAIL - Currently returns 200 or 404, not 401

**Step 3: Add auth to get_results endpoint**

Edit `api/src/api/routers/assignments.py`:

Find the `get_results` function and add auth dependency:

```python
from fastapi import Depends
from ..middleware.auth import require_session_access, AuthUser

@router.get("/results/{session_id}")
async def get_results(
    session_id: str,
    version_id: str | None = None,
    user: AuthUser = Depends(require_session_access)  # ADD THIS
):
    """Get assignment results for a session.

    Now requires authentication and org membership.
    """
    # ... existing implementation
```

**Step 4: Run tests**

Run:
```bash
cd api && poetry run pytest tests/test_assignments.py::test_get_results_requires_auth -v
```

Expected: PASS

**Step 5: Commit**

```bash
git add api/src/api/routers/assignments.py api/tests/test_assignments.py
git commit -m "feat: protect assignment results endpoint with auth"
```

---

### Task 3.2: Add Auth to Other Protected Endpoints

**Files:**
- Modify: `api/src/api/routers/assignments.py`
- Modify: `api/src/api/routers/upload.py`

**Step 1: Add auth to generate_assignments endpoint**

Edit `api/src/api/routers/assignments.py`:

```python
@router.post("/generate")
async def generate_assignments(
    request: GenerateAssignmentsRequest,
    user: AuthUser = Depends(get_current_user)  # ADD THIS
):
    """Generate new assignments.

    Associates session with user's organization.
    """
    # TODO: Save session to user's org in Firestore
    # ... existing implementation
```

**Step 2: Add auth to upload endpoint**

Edit `api/src/api/routers/upload.py`:

```python
from ..middleware.auth import get_current_user, AuthUser

@router.post("/")
async def upload_file(
    file: UploadFile = File(...),
    user: AuthUser = Depends(get_current_user)  # ADD THIS
):
    """Upload participant file.

    Now requires authentication.
    """
    # ... existing implementation
```

**Step 3: Test manually**

Run:
```bash
cd api && poetry run uvicorn api.main:app --reload
```

Try accessing endpoints without auth:
```bash
curl http://localhost:8000/api/assignments/results/test123
```

Expected: 401 Unauthorized

**Step 4: Commit**

```bash
git add api/src/api/routers/assignments.py api/src/api/routers/upload.py
git commit -m "feat: protect upload and generate endpoints with auth"
```

---

## Phase 4: Frontend Auth Integration

### Task 4.1: Add Firebase SDK to Frontend

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/src/services/firebase.ts`

**Step 1: Install Firebase SDK**

Run:
```bash
cd frontend && npm install firebase
```

**Step 2: Create Firebase config and initialization**

Create `frontend/src/services/firebase.ts`:

```typescript
/**
 * Firebase client SDK initialization and auth helpers
 */
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

/**
 * Send magic link to user's email
 */
export async function sendMagicLink(email: string): Promise<void> {
  const actionCodeSettings = {
    // URL to redirect to after email link click
    url: window.location.origin + '/auth/verify',
    handleCodeInApp: true,
  };

  await sendSignInLinkToEmail(auth, email, actionCodeSettings);

  // Save email to localStorage for verification step
  window.localStorage.setItem('emailForSignIn', email);
}

/**
 * Complete sign-in with email link
 */
export async function completeMagicLinkSignIn(
  emailLink: string
): Promise<User> {
  if (!isSignInWithEmailLink(auth, emailLink)) {
    throw new Error('Invalid sign-in link');
  }

  // Get email from localStorage
  let email = window.localStorage.getItem('emailForSignIn');

  if (!email) {
    // Prompt user to enter email if not found
    email = window.prompt('Please provide your email for confirmation');
  }

  if (!email) {
    throw new Error('Email required for sign-in');
  }

  const result = await signInWithEmailLink(auth, email, emailLink);

  // Clear email from storage
  window.localStorage.removeItem('emailForSignIn');

  return result.user;
}

/**
 * Sign out current user
 */
export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

/**
 * Get current user's ID token for API requests
 */
export async function getCurrentUserToken(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;

  return await user.getIdToken();
}

/**
 * Subscribe to auth state changes
 */
export function onAuthChange(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

export { auth };
```

**Step 3: Update package.json**

Run:
```bash
git add frontend/package.json frontend/package-lock.json frontend/src/services/firebase.ts
git commit -m "feat: add Firebase client SDK and auth helpers"
```

---

### Task 4.2: Create Auth Context Provider

**Files:**
- Create: `frontend/src/contexts/AuthContext.tsx`
- Modify: `frontend/src/App.tsx`

**Step 1: Create auth context**

Create `frontend/src/contexts/AuthContext.tsx`:

```typescript
/**
 * Auth context provider for managing user authentication state
 */
import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { onAuthChange, signOut as firebaseSignOut } from '../services/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Subscribe to auth state changes
    const unsubscribe = onAuthChange((user) => {
      setUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signOut = async () => {
    await firebaseSignOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

**Step 2: Wrap app with AuthProvider**

Edit `frontend/src/App.tsx`:

```typescript
import { AuthProvider } from './contexts/AuthContext';

function App() {
  return (
    <AuthProvider>
      {/* existing app content */}
    </AuthProvider>
  );
}
```

**Step 3: Commit**

```bash
git add frontend/src/contexts/AuthContext.tsx frontend/src/App.tsx
git commit -m "feat: add auth context provider for user state management"
```

---

### Task 4.3: Create Login Page

**Files:**
- Create: `frontend/src/pages/LoginPage.tsx`
- Create: `frontend/src/pages/AuthVerifyPage.tsx`
- Modify: `frontend/src/App.tsx`

**Step 1: Create login page component**

Create `frontend/src/pages/LoginPage.tsx`:

```typescript
/**
 * Login page with magic link email input
 */
import React, { useState } from 'react';
import { sendMagicLink } from '../services/firebase';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await sendMagicLink(email);
      setSent(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send magic link');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full p-8 space-y-4">
          <h1 className="text-2xl font-bold text-center">Check your email</h1>
          <p className="text-center text-gray-600">
            We've sent a sign-in link to <strong>{email}</strong>
          </p>
          <p className="text-sm text-center text-gray-500">
            Click the link in the email to sign in. The link expires in 60 minutes.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="max-w-md w-full p-8 space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold">GroupBuilder</h1>
          <p className="text-gray-600">
            Sign in to create balanced and diverse groups
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-2">
              Email address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border rounded-md"
              placeholder="your@email.com"
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full"
          >
            {loading ? 'Sending...' : 'Send me a login link'}
          </Button>
        </form>

        <p className="text-xs text-center text-gray-500">
          By signing in, you agree to our terms of service and privacy policy.
        </p>
      </Card>
    </div>
  );
}
```

**Step 2: Create email verification page**

Create `frontend/src/pages/AuthVerifyPage.tsx`:

```typescript
/**
 * Email link verification page
 */
import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { completeMagicLinkSignIn } from '../services/firebase';
import { Card } from '../components/ui/card';

export function AuthVerifyPage() {
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const completeSignIn = async () => {
      try {
        await completeMagicLinkSignIn(window.location.href);

        // Check if there's a redirect URL
        const params = new URLSearchParams(location.search);
        const redirect = params.get('redirect') || '/';

        navigate(redirect);
      } catch (err: any) {
        setError(err.message || 'Failed to sign in');
      }
    };

    completeSignIn();
  }, [navigate, location]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full p-8 space-y-4">
          <h1 className="text-2xl font-bold text-center text-red-600">
            Sign-in failed
          </h1>
          <p className="text-center text-gray-600">{error}</p>
          <a href="/login" className="block text-center text-blue-600 hover:underline">
            Try again
          </a>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="max-w-md w-full p-8 space-y-4">
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
        <p className="text-center text-gray-600">Signing you in...</p>
      </Card>
    </div>
  );
}
```

**Step 3: Add routes to App.tsx**

Edit `frontend/src/App.tsx`:

```typescript
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { AuthVerifyPage } from './pages/AuthVerifyPage';
import { useAuth } from './contexts/AuthContext';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/verify" element={<AuthVerifyPage />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                {/* Existing home page */}
              </ProtectedRoute>
            }
          />

          {/* Add other protected routes */}
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
```

**Step 4: Test login flow**

Run:
```bash
cd frontend && npm start
```

Navigate to http://localhost:3000/login
Enter email, verify magic link sent

**Step 5: Commit**

```bash
git add frontend/src/pages/LoginPage.tsx frontend/src/pages/AuthVerifyPage.tsx frontend/src/App.tsx
git commit -m "feat: add login page with magic link authentication"
```

---

### Task 4.4: Add Auth Token to API Requests

**Files:**
- Create: `frontend/src/utils/apiClient.ts`
- Modify: `frontend/src/pages/TableAssignmentsPage.tsx` (example)

**Step 1: Create authenticated API client**

Create `frontend/src/utils/apiClient.ts`:

```typescript
/**
 * API client with automatic Firebase token injection
 */
import { getCurrentUserToken } from '../services/firebase';

export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getCurrentUserToken();

  if (!token) {
    throw new Error('Not authenticated');
  }

  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${token}`);

  return fetch(url, {
    ...options,
    headers,
  });
}

/**
 * Wrapper for authenticated API calls with JSON response
 */
export async function apiRequest<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await authenticatedFetch(url, options);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}
```

**Step 2: Replace fetch calls with authenticated client**

Example in a component:

```typescript
import { apiRequest } from '../utils/apiClient';

// Instead of:
// const response = await fetch(`/api/assignments/results/${sessionId}`);

// Use:
const data = await apiRequest<AssignmentResults>(
  `/api/assignments/results/${sessionId}`
);
```

**Step 3: Commit**

```bash
git add frontend/src/utils/apiClient.ts
git commit -m "feat: add authenticated API client with token injection"
```

---

## Phase 5: Firestore Data Migration

### Task 5.1: Create Session Storage Service

**Files:**
- Create: `api/src/api/services/session_storage.py`
- Modify: `api/src/api/routers/upload.py`

**Step 1: Create Firestore session storage service**

Create `api/src/api/services/session_storage.py`:

```python
"""Session storage service using Firestore instead of Redis."""
from typing import Dict, Any, Optional, List
from datetime import datetime
from ..firebase_admin import get_firestore_client


class SessionStorage:
    """Store sessions in Firestore organized by organization."""

    def __init__(self):
        self.db = get_firestore_client()

    def save_session(
        self,
        org_id: str,
        session_id: str,
        user_id: str,
        participant_data: Dict[str, Any],
        filename: str,
        num_tables: int,
        num_sessions: int
    ) -> None:
        """Save session to organization's sessions collection.

        Args:
            org_id: Organization ID
            session_id: Session UUID
            user_id: User who created session
            participant_data: Participant dictionary
            filename: Original filename
            num_tables: Number of tables
            num_sessions: Number of sessions
        """
        session_ref = (
            self.db.collection("organizations")
            .document(org_id)
            .collection("sessions")
            .document(session_id)
        )

        session_ref.set({
            "created_by": user_id,
            "created_at": datetime.utcnow(),
            "filename": filename,
            "num_tables": num_tables,
            "num_sessions": num_sessions,
            "participant_data": participant_data,
        })

    def get_session(
        self,
        session_id: str
    ) -> Optional[Dict[str, Any]]:
        """Get session data by ID (searches across all orgs).

        Args:
            session_id: Session UUID

        Returns:
            Session data or None if not found
        """
        # Use collection group query
        sessions_ref = self.db.collection_group("sessions")
        query = sessions_ref.where("__name__", "==", session_id).limit(1)
        docs = list(query.stream())

        if not docs:
            return None

        return docs[0].to_dict()

    def save_results(
        self,
        org_id: str,
        session_id: str,
        version_id: str,
        assignments: Dict[str, Any],
        metadata: Dict[str, Any]
    ) -> None:
        """Save assignment results.

        Args:
            org_id: Organization ID
            session_id: Session UUID
            version_id: Version identifier
            assignments: Assignment data
            metadata: Result metadata (solve time, etc.)
        """
        result_ref = (
            self.db.collection("organizations")
            .document(org_id)
            .collection("results")
            .document(session_id)
            .collection("versions")
            .document(version_id)
        )

        result_ref.set({
            "created_at": datetime.utcnow(),
            "assignments": assignments,
            "metadata": metadata,
        })

    def get_results(
        self,
        session_id: str,
        version_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Get assignment results.

        Args:
            session_id: Session UUID
            version_id: Specific version or latest if None

        Returns:
            Results data or None if not found
        """
        # Find session's org first
        sessions_ref = self.db.collection_group("sessions")
        query = sessions_ref.where("__name__", "==", session_id).limit(1)
        session_docs = list(query.stream())

        if not session_docs:
            return None

        session_doc = session_docs[0]
        org_id = session_doc.reference.parent.parent.id

        # Get results
        results_ref = (
            self.db.collection("organizations")
            .document(org_id)
            .collection("results")
            .document(session_id)
            .collection("versions")
        )

        if version_id:
            result_doc = results_ref.document(version_id).get()
            if not result_doc.exists:
                return None
            return result_doc.to_dict()
        else:
            # Get latest version
            query = results_ref.order_by("created_at", direction="DESCENDING").limit(1)
            docs = list(query.stream())
            if not docs:
                return None
            return docs[0].to_dict()
```

**Step 2: Commit**

```bash
git add api/src/api/services/session_storage.py
git commit -m "feat: add Firestore session storage service"
```

---

## Phase 6: Admin Panel

### Task 6.1: Create Admin Routes (Backend)

**Files:**
- Create: `api/src/api/routers/admin.py`
- Modify: `api/src/api/main.py`

**Step 1: Create admin router with org creation**

Create `api/src/api/routers/admin.py`:

```python
"""Admin routes for organization management."""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from typing import List
from datetime import datetime, timedelta
from ..middleware.auth import get_current_user, AuthUser
from ..firebase_admin import get_firestore_client
import secrets

router = APIRouter(prefix="/api/admin", tags=["admin"])


class CreateOrgRequest(BaseModel):
    """Request to create a new organization."""
    name: str
    facilitator_emails: List[EmailStr]


class OrganizationResponse(BaseModel):
    """Organization summary."""
    id: str
    name: str
    created_at: datetime
    member_count: int


async def require_bb_admin(user: AuthUser = Depends(get_current_user)) -> AuthUser:
    """Require that user is a Building Bridges admin.

    Raises:
        HTTPException: 403 if user is not BB admin
    """
    db = get_firestore_client()
    admin_ref = db.collection("bb_admins").document(user.user_id)
    admin_doc = admin_ref.get()

    if not admin_doc.exists:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )

    return user


@router.post("/organizations", response_model=dict)
async def create_organization(
    request: CreateOrgRequest,
    user: AuthUser = Depends(require_bb_admin)
):
    """Create new organization and send invites.

    Returns:
        Created org ID and invite status
    """
    db = get_firestore_client()

    # Create organization document
    org_ref = db.collection("organizations").document()
    org_ref.set({
        "name": request.name,
        "created_at": datetime.utcnow(),
        "created_by": user.user_id,
    })

    # Create invite records
    invites = []
    for email in request.facilitator_emails:
        invite_token = secrets.token_urlsafe(32)
        invite_ref = org_ref.collection("invites").document()
        invite_ref.set({
            "email": email,
            "token": invite_token,
            "created_at": datetime.utcnow(),
            "expires_at": datetime.utcnow() + timedelta(days=7),
            "status": "pending",
        })

        # TODO: Send invite email via SendGrid
        invites.append({
            "email": email,
            "invite_link": f"{os.getenv('FRONTEND_URL')}/invite/{invite_token}"
        })

    return {
        "org_id": org_ref.id,
        "invites": invites
    }


@router.get("/organizations", response_model=List[OrganizationResponse])
async def list_organizations(
    user: AuthUser = Depends(require_bb_admin)
):
    """List all organizations (admin only)."""
    db = get_firestore_client()

    orgs = []
    org_docs = db.collection("organizations").stream()

    for org_doc in org_docs:
        org_data = org_doc.to_dict()

        # Count members
        members = org_doc.reference.collection("members").stream()
        member_count = sum(1 for _ in members)

        orgs.append({
            "id": org_doc.id,
            "name": org_data["name"],
            "created_at": org_data["created_at"],
            "member_count": member_count,
        })

    return orgs
```

**Step 2: Register admin router**

Edit `api/src/api/main.py`:

```python
from .routers import admin

app.include_router(admin.router)
```

**Step 3: Commit**

```bash
git add api/src/api/routers/admin.py api/src/api/main.py
git commit -m "feat: add admin API endpoints for org management"
```

---

### Task 6.2: Create Admin Frontend

**Files:**
- Create: `frontend/src/pages/admin/AdminDashboard.tsx`
- Create: `frontend/src/pages/admin/CreateOrgModal.tsx`

Due to length constraints, I'll provide the structure:

**Step 1: Create admin dashboard page**

Create `frontend/src/pages/admin/AdminDashboard.tsx` with:
- List of organizations
- "+ Create Organization" button
- Member counts
- "Manage" links

**Step 2: Create org creation modal**

Create `frontend/src/pages/admin/CreateOrgModal.tsx` with:
- Series name input
- Facilitator emails textarea
- Form validation
- Success confirmation

**Step 3: Add admin routes to App.tsx**

```typescript
<Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
```

**Step 4: Commit**

```bash
git add frontend/src/pages/admin/
git commit -m "feat: add admin panel UI for org creation"
```

---

## Phase 7: Testing & Deployment

### Task 7.1: End-to-End Testing

**Manual test checklist:**

1. ✅ Admin can create organization
2. ✅ Facilitator receives invite email
3. ✅ Facilitator can sign in via magic link
4. ✅ Facilitator can upload file and generate assignments
5. ✅ Facilitator can view their org's sessions
6. ✅ Facilitator from different org gets 403 on other org's sessions
7. ✅ Admin can view all organizations
8. ✅ Admin can add/remove members

### Task 7.2: Deploy to Production

**Manual deployment steps:**

1. Set Firebase environment variables in Cloud Run
2. Deploy backend with new dependencies
3. Deploy frontend with Firebase config
4. Test production login flow
5. Create first real organization for Building Bridges

---

## Summary

This plan implements:
- ✅ Firebase Auth for passwordless authentication
- ✅ Firestore for multi-tenant data storage
- ✅ Backend auth middleware and authorization
- ✅ Frontend login flow with magic links
- ✅ Admin panel for org management
- ✅ Session-level access control

**Estimated effort:** 4-5 weeks for complete implementation

**Next steps after completion:**
1. Add Firestore security rules
2. Implement SendGrid invite email templates
3. Add migration banner for old sessions
4. Beta test with first Building Bridges series

---

**Plan complete! Ready for implementation.**
