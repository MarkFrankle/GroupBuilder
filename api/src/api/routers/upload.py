from api.utils.dataframe_to_participant_dict import dataframe_to_participant_dict
from api.storage import store_session
from fastapi import APIRouter, File, UploadFile, HTTPException, Form
from io import BytesIO
import logging
import pandas as pd
import uuid
from datetime import datetime

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/")
async def upload_file(
    file: UploadFile = File(...),
    numTables: int = Form(...),
    numSessions: int = Form(...),
    email: str = Form(None),
):
    logger.info(f"Uploading file: {file.filename}, tables: {numTables}, sessions: {numSessions}")

    if numTables < 1 or numTables > 10:
        logger.warning(f"Invalid number of tables: {numTables}")
        raise HTTPException(status_code=400, detail="Number of tables must be between 1 and 10.")

    if numSessions < 1 or numSessions > 6:
        logger.warning(f"Invalid number of sessions: {numSessions}")
        raise HTTPException(status_code=400, detail="Number of sessions must be between 1 and 6.")

    if not file.filename.endswith((".xlsx", ".xls")):
        logger.warning(f"Invalid file format: {file.filename}")
        raise HTTPException(status_code=400, detail="Invalid file format. Please upload an Excel file.")

    try:
        contents = await file.read()
        participant_dataframe = pd.read_excel(BytesIO(contents))
        logger.info(f"Parsed Excel file with {len(participant_dataframe)} participants")

        required_columns = ['Name', 'Religion', 'Gender', 'Partner']
        missing_columns = [col for col in required_columns if col not in participant_dataframe.columns]
        if missing_columns:
            logger.warning(f"Missing required columns: {missing_columns}")
            raise HTTPException(
                status_code=400,
                detail=f"Excel file is missing required columns: {', '.join(missing_columns)}. "
                       f"Required columns are: {', '.join(required_columns)}"
            )

        num_participants = len(participant_dataframe)
        if num_participants < numTables:
            logger.warning(f"Not enough participants ({num_participants}) for {numTables} tables")
            raise HTTPException(
                status_code=400,
                detail=f"Not enough participants ({num_participants}) for {numTables} tables. "
                       f"Need at least {numTables} participants."
            )

        if num_participants > 200:
            logger.warning(f"Too many participants ({num_participants})")
            raise HTTPException(
                status_code=400,
                detail=f"Maximum 200 participants supported. You have {num_participants}."
            )

        participant_dict = dataframe_to_participant_dict(participant_dataframe)

        session_id = str(uuid.uuid4())

        store_session(session_id, {
            "participant_dict": participant_dict,
            "num_tables": numTables,
            "num_sessions": numSessions,
            "filename": file.filename,
            "email": email,
            "created_at": datetime.now().isoformat()
        })

        logger.info(f"Successfully stored data for {file.filename} with session ID: {session_id}")

        if email:
            logger.info(f"Email provided: {email}. Magic link will be sent after assignment generation.")

        return {
            "message": "File uploaded successfully",
            "session_id": session_id,
            "columns": list(participant_dataframe.columns)
        }
    except HTTPException:
        # Re-raise HTTP exceptions as-is (they already have user-friendly messages)
        raise
    except Exception as e:
        logger.error(f"Failed to process file {file.filename}: {str(e)}", exc_info=True)
        # Don't expose internal error details to user (could contain sensitive info)
        raise HTTPException(
            status_code=500,
            detail="Failed to process file. Please check that your file is a valid Excel file with the required columns."
        )
