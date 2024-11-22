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
        participants_dict, num_tables, num_sessions = group_data[file_name].values()
        
        # Generate assignments
        results = handle_generate_assignments(participants_dict, num_tables, num_sessions)
        
        # Optionally clear the data after use
        del group_data[file_name]
        
        if not results['success']:
            raise HTTPException(status_code=400, detail="No feasible solution found")

        return results['assignments']
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate assignments: {str(e)}")
