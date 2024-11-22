from api.utils.dataframe_to_participant_dict import dataframe_to_participant_dict
from fastapi import APIRouter, File, UploadFile, HTTPException, Form
from io import BytesIO
import pandas as pd

router = APIRouter()

group_data = {}

@router.post("/")
async def upload_file(
    file: UploadFile = File(...),
    numTables: int = Form(...),
    numSessions: int = Form(...),
):
    # Ensure file is an Excel file
    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Invalid file format. Please upload an Excel file.")
    
    try:
        contents = await file.read()
        participant_dataframe = pd.read_excel(BytesIO(contents))
        participant_dict = dataframe_to_participant_dict(participant_dataframe)
        
        group_data[file.filename] = {
            "participant_dict": participant_dict,
            "num_tables": numTables,
            "num_sessions": numSessions,
        }

        return {"message": "File uploaded successfully", "columns": list(participant_dataframe.columns)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process file: {str(e)}")
