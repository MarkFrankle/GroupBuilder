from dotenv import load_dotenv
load_dotenv()

from api.routers import upload, assignments
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
import os

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI()

logger.info("Starting GroupBuilder API")

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


# Run with `poetry run uvicorn src.api.main:app --reload`
if __name__ == "__main__":
    # if os.getenv("DEBUGPY_ENABLE") == "1":
    #     debugpy.listen(("0.0.0.0", 5678))
    #     print("Waiting for debugger to attach...")
    #     debugpy.wait_for_client()
    import uvicorn
    port = int(os.environ.get("PORT", 8000))  # Default to 8000 if $PORT is not set
    uvicorn.run(app, host="0.0.0.0", port=port)


# Testing curl
# curl -X POST "http://127.0.0.1:8000/upload/?file_name=template" \
#      -H "Content-Type: multipart/form-data" \
#      -F "file=@./GroupBuilderTemplate.xlsx"
