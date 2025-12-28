from api.utils.dataframe_to_participant_dict import dataframe_to_participant_dict
from fastapi import APIRouter, File, UploadFile, HTTPException, Form
from io import BytesIO
import logging
import pandas as pd
import uuid
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)
router = APIRouter()

# Store data with session IDs instead of filenames to prevent collisions
# Structure: {session_id: {data: {...}, created_at: datetime}}
group_data = {}

# Clean up old sessions (> 1 hour)
def cleanup_old_sessions():
    current_time = datetime.now()
    expired_sessions = [
        sid for sid, data in group_data.items()
        if current_time - data.get('created_at', current_time) > timedelta(hours=1)
    ]
    for sid in expired_sessions:
        del group_data[sid]
        logger.info(f"Cleaned up expired session: {sid}")

@router.post("/")
async def upload_file(
    file: UploadFile = File(...),
    numTables: int = Form(...),
    numSessions: int = Form(...),
):
    logger.info(f"Uploading file: {file.filename}, tables: {numTables}, sessions: {numSessions}")

    # Validate input parameters
    if numTables < 1 or numTables > 50:
        logger.warning(f"Invalid number of tables: {numTables}")
        raise HTTPException(status_code=400, detail="Number of tables must be between 1 and 50.")

    if numSessions < 1 or numSessions > 20:
        logger.warning(f"Invalid number of sessions: {numSessions}")
        raise HTTPException(status_code=400, detail="Number of sessions must be between 1 and 20.")

    # Ensure file is an Excel file
    if not file.filename.endswith((".xlsx", ".xls")):
        logger.warning(f"Invalid file format: {file.filename}")
        raise HTTPException(status_code=400, detail="Invalid file format. Please upload an Excel file.")

    try:
        contents = await file.read()
        participant_dataframe = pd.read_excel(BytesIO(contents))
        logger.info(f"Parsed Excel file with {len(participant_dataframe)} participants")

        # Validate required columns
        required_columns = ['Name', 'Religion', 'Gender', 'Partner']
        missing_columns = [col for col in required_columns if col not in participant_dataframe.columns]
        if missing_columns:
            logger.warning(f"Missing required columns: {missing_columns}")
            raise HTTPException(
                status_code=400,
                detail=f"Excel file is missing required columns: {', '.join(missing_columns)}. "
                       f"Required columns are: {', '.join(required_columns)}"
            )

        # Validate minimum participants
        num_participants = len(participant_dataframe)
        if num_participants < numTables:
            logger.warning(f"Not enough participants ({num_participants}) for {numTables} tables")
            raise HTTPException(
                status_code=400,
                detail=f"Not enough participants ({num_participants}) for {numTables} tables. "
                       f"Need at least {numTables} participants."
            )

        participant_dict = dataframe_to_participant_dict(participant_dataframe)

        # Generate unique session ID
        session_id = str(uuid.uuid4())

        # Clean up old sessions before adding new one
        cleanup_old_sessions()

        # Store data with session ID and timestamp
        group_data[session_id] = {
            "data": {
                "participant_dict": participant_dict,
                "num_tables": numTables,
                "num_sessions": numSessions,
            },
            "created_at": datetime.now(),
            "filename": file.filename
        }

        logger.info(f"Successfully stored data for {file.filename} with session ID: {session_id}")
        return {
            "message": "File uploaded successfully",
            "session_id": session_id,
            "columns": list(participant_dataframe.columns)
        }
    except Exception as e:
        logger.error(f"Failed to process file {file.filename}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to process file: {str(e)}")
