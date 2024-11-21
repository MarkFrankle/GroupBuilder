from fastapi import APIRouter, HTTPException
from assignment_logic.api_handler import handle_generate_assignments
from .upload import uploaded_files

router = APIRouter()

@router.get("/")
def get_assignments(file_name: str):
    if file_name not in uploaded_files:
        raise HTTPException(status_code=400, detail="No file uploaded for the given user ID.")
    
    try:
        # Retrieve the user's uploaded data
        data = uploaded_files[file_name]
        
        # Generate assignments
        result = handle_generate_assignments({"participants": data.to_dict("records"), "sessions": 6})
        
        # Optionally clear the data after use
        del uploaded_files[file_name]
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate assignments: {str(e)}")
