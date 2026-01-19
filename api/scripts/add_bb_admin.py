#!/usr/bin/env python3
"""
Bootstrap script to add Building Bridges admin users.

This script adds a user to the bb_admins collection in Firestore,
which grants them access to the /admin panel.

Usage:
    poetry run python scripts/add_bb_admin.py user@example.com
"""
import sys
import os
from datetime import datetime

# Add src to path so we can import api modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from api.firebase_admin import initialize_firebase, get_firestore_client


def add_bb_admin(email: str) -> None:
    """Add a user as a Building Bridges admin.

    Args:
        email: Email address of the user to add as admin
    """
    # Initialize Firebase
    print("🔥 Initializing Firebase...")
    initialize_firebase()

    db = get_firestore_client()

    # Note: We use email as the document ID so it's easy to find/update
    # When the user signs in with Firebase Auth, we'll need to update
    # this document with their Firebase UID
    admin_ref = db.collection("bb_admins").document(email)

    # Check if already exists
    admin_doc = admin_ref.get()
    if admin_doc.exists:
        print(f"⚠️  {email} is already a BB admin")
        existing_data = admin_doc.to_dict()
        print(f"   Added: {existing_data.get('created_at')}")
        return

    # Add as admin
    admin_ref.set({
        "email": email,
        "created_at": datetime.utcnow(),
        "created_by": "bootstrap_script",
        "active": True,
    })

    print(f"✅ Added {email} as BB admin")
    print(f"   They can now access /admin panel after signing in")


def main():
    if len(sys.argv) < 2:
        print("Usage: poetry run python scripts/add_bb_admin.py user@example.com")
        sys.exit(1)

    email = sys.argv[1]

    # Basic email validation
    if "@" not in email or "." not in email:
        print(f"❌ Invalid email: {email}")
        sys.exit(1)

    add_bb_admin(email)


if __name__ == "__main__":
    main()
