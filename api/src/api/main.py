from dotenv import load_dotenv
load_dotenv()

from api.routers import upload, assignments
from api.middleware import RequestIDMiddleware, RequestIDLogFilter
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import logging
import os

# Configure logging with request ID support
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - [%(request_id)s] - %(message)s'
)
logger = logging.getLogger(__name__)

# Add request ID filter to root logger
for handler in logging.root.handlers:
    handler.addFilter(RequestIDLogFilter())

# Initialize rate limiter
# Default: 10 requests per minute per IP for expensive operations
# Can be overridden per-endpoint
limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])

app = FastAPI()
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

logger.info("Starting GroupBuilder API")

# Add request ID middleware (before CORS to track all requests)
app.add_middleware(RequestIDMiddleware)

# Get allowed origins from environment or use defaults
allowed_origins = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:3000,https://group-builder.netlify.app"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

logger.info(f"CORS enabled for origins: {allowed_origins}")

app.include_router(upload.router, prefix="/api/upload", tags=["upload"])
app.include_router(assignments.router, prefix="/api/assignments", tags=["assignments"])


@app.on_event("shutdown")
async def shutdown_event():
    """Clean up resources on shutdown."""
    from api.storage import storage
    if hasattr(storage, 'close'):
        logger.info("Closing storage connections...")
        storage.close()


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
