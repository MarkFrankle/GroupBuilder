"""Authentication middleware for Firebase tokens."""
from fastapi import Header, HTTPException, status
from typing import Optional
from pydantic import BaseModel
from ..firebase_admin import verify_firebase_token
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
