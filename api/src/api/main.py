# import debugpy
from api.routers import upload, assignments
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

# debugpy.listen(("0.0.0.0", 5678))
# print("Waiting for debugger to attach...")
# debugpy.wait_for_client()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://group-builder.netlify.app/"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router, prefix="/api/upload", tags=["upload"])
app.include_router(assignments.router, prefix="/api/assignments", tags=["assignments"])


# Run with `poetry run uvicorn src.api.main:app --reload`
if __name__ == "__main__":
    # if os.getenv("DEBUGPY_ENABLE") == "1":
    #     debugpy.listen(("0.0.0.0", 5678))
    #     print("Waiting for debugger to attach...")
    #     debugpy.wait_for_client()
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

# Testing curl
# curl -X POST "http://127.0.0.1:8000/upload/?file_name=template" \
#      -H "Content-Type: multipart/form-data" \
#      -F "file=@./GroupBuilderTemplate.xlsx"
