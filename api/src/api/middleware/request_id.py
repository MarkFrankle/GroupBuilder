"""
Request ID middleware for tracking and debugging requests.

Generates a unique request ID for each incoming request, adds it to response headers,
and makes it available throughout the request lifecycle for logging.
"""

import logging
import uuid
from contextvars import ContextVar
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)

# Context variable to store request ID throughout the request lifecycle
request_id_context_var: ContextVar[str] = ContextVar("request_id", default="")


def get_request_id() -> str:
    """Get the current request ID from context."""
    return request_id_context_var.get()


class RequestIDMiddleware(BaseHTTPMiddleware):
    """
    Middleware that adds a unique request ID to each request.

    The request ID is:
    - Generated as a UUID4
    - Added to response headers as 'X-Request-ID'
    - Made available via get_request_id() for logging
    - Logged with each request
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Generate unique request ID
        request_id = str(uuid.uuid4())

        # Store in context variable for access throughout request
        request_id_context_var.set(request_id)

        # Also store in request state for route access
        request.state.request_id = request_id

        # Log incoming request with ID
        logger.info(
            f"[{request_id}] {request.method} {request.url.path} - "
            f"Client: {request.client.host if request.client else 'unknown'}"
        )

        try:
            # Process request
            response = await call_next(request)

            # Add request ID to response headers
            response.headers["X-Request-ID"] = request_id

            # Log response
            logger.info(f"[{request_id}] Response: {response.status_code}")

            return response

        except Exception as e:
            # Log errors with request ID
            logger.error(f"[{request_id}] Request failed: {str(e)}", exc_info=True)
            raise


class RequestIDLogFilter(logging.Filter):
    """
    Logging filter that adds request ID to log records.

    Usage:
        Add this filter to your logging handlers to automatically
        include request IDs in all log messages.
    """

    def filter(self, record: logging.LogRecord) -> bool:
        # Add request_id to the log record
        request_id = get_request_id()
        record.request_id = request_id if request_id else "-"
        return True
