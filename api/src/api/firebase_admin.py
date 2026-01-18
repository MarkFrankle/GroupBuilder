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
