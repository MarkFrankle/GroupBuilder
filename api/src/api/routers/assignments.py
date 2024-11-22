from fastapi import APIRouter, HTTPException
from assignment_logic.api_handler import handle_generate_assignments
from .upload import group_data

router = APIRouter()

cached_results = {}

@router.get("/")
def get_assignments(file_name: str):
    if file_name not in group_data:
        raise HTTPException(status_code=400, detail="No file uploaded for the given user ID.")
    
    try:
        participants_dict, num_tables, num_sessions = group_data[file_name].values()
        
        results = handle_generate_assignments(participants_dict, num_tables, num_sessions)
        
        del group_data[file_name]
        
        if results['status'] != 'success':
            raise HTTPException(status_code=400, detail="No feasible solution found")

        cached_results['assignments'] = results['assignments']
        return results['assignments']
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate assignments: {str(e)}")

@router.get("/results")
async def get_cached_results():
    if 'assignments' not in cached_results:
        raise HTTPException(status_code=404, detail="No cached results available")
    return cached_results['assignments']
