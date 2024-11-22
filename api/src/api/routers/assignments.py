from fastapi import APIRouter, HTTPException
from assignment_logic.api_handler import handle_generate_assignments
from .upload import group_data

router = APIRouter()

@router.get("/")
def get_assignments(file_name: str):
    if file_name not in group_data:
        raise HTTPException(status_code=400, detail="No file uploaded for the given user ID.")
    
    try:
        # Retrieve the user's uploaded data
        data = group_data[file_name]
        
        # Generate assignments
        result = handle_generate_assignments(data)
        
        # Optionally clear the data after use
        del group_data[file_name]
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate assignments: {str(e)}")
