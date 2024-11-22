from fastapi import APIRouter, File, UploadFile, HTTPException, Form
import pandas as pd
from io import BytesIO

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
        data = pd.read_excel(BytesIO(contents))
        
        group_data[file.filename] = {
            "data": data,
            "numTables": numTables,
            "numSessions": numSessions,
        }

        return {"message": "File uploaded successfully", "columns": list(data.columns)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process file: {str(e)}")
