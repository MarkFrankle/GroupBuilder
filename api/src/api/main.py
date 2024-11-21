from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routers import upload, assignments

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Frontend origin
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router, prefix="/upload", tags=["upload"])
app.include_router(assignments.router, prefix="/assignments", tags=["assignments"])

# Run with `uvicorn src.api.main:app --reload`
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

# Testing curl
# curl -X POST "http://127.0.0.1:8000/upload/?file_name=template" \
#      -H "Content-Type: multipart/form-data" \
#      -F "file=@./GroupBuilderTemplate.xlsx"
