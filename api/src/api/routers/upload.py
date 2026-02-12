from typing import Optional
from api.utils.dataframe_to_participant_dict import dataframe_to_participant_dict
from api.services.session_storage import SessionStorage
from api.services.firestore_service import FirestoreService, get_firestore_service
from fastapi import APIRouter, File, UploadFile, HTTPException, Form, Request, Depends
from api.middleware.auth import get_current_user, AuthUser
from io import BytesIO
from slowapi import Limiter
from slowapi.util import get_remote_address
import logging
import pandas as pd
import uuid
from datetime import datetime
import os

logger = logging.getLogger(__name__)
router = APIRouter()
limiter = Limiter(key_func=get_remote_address)

# Configuration constants
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB in bytes
MAX_PARTICIPANTS = 200

@router.post("/")
@limiter.limit("10/minute")  # Limit expensive file uploads
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    numTables: int = Form(..., ge=1, le=10),
    numSessions: int = Form(..., ge=1, le=6),
    orgId: Optional[str] = Form(None, description="Organization ID (auto-selects if user has only one org)"),
    user: AuthUser = Depends(get_current_user),
    firestore_service: FirestoreService = Depends(get_firestore_service)
):
    logger.info(f"Uploading file: {file.filename}, tables: {numTables}, sessions: {numSessions}")

    # Validate file extension
    if not file.filename.endswith((".xlsx", ".xls")):
        logger.warning(f"Invalid file format: {file.filename}")
        raise HTTPException(status_code=400, detail="Invalid file format. Please upload an Excel file.")

    try:
        # Read file with size limit
        contents = await file.read()

        # Check file size
        if len(contents) > MAX_FILE_SIZE:
            logger.warning(f"File too large: {len(contents)} bytes (max: {MAX_FILE_SIZE})")
            raise HTTPException(
                status_code=400,
                detail=f"File size ({len(contents) / 1024 / 1024:.1f}MB) exceeds maximum allowed size (10MB)."
            )

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

        if num_participants > MAX_PARTICIPANTS:
            logger.warning(f"Too many participants ({num_participants})")
            raise HTTPException(
                status_code=400,
                detail=f"Maximum {MAX_PARTICIPANTS} participants supported. You have {num_participants}."
            )

        participant_dict = dataframe_to_participant_dict(participant_dataframe)

        # Get user's organizations
        user_orgs = firestore_service.get_user_organizations(user.user_id)
        
        if not user_orgs:
            logger.error(f"User {user.email} has no organizations")
            raise HTTPException(
                status_code=403,
                detail="You are not a member of any organization. Please contact your administrator."
            )
        
        user_org_ids = {org["id"] for org in user_orgs}
        
        # Validate or auto-select organization
        if orgId:
            # Validate user is a member of the specified org
            if orgId not in user_org_ids:
                logger.warning(f"User {user.email} attempted upload to unauthorized org {orgId}")
                raise HTTPException(
                    status_code=403,
                    detail="You are not a member of this organization."
                )
            org_id = orgId
        else:
            # Auto-select first organization
            org_id = user_orgs[0]["id"]
        
        logger.info(f"User {user.email} uploading to organization {org_id}")

        session_id = str(uuid.uuid4())

        # Use Firestore SessionStorage instead of Redis
        session_storage = SessionStorage()
        session_storage.save_session(
            org_id=org_id,
            session_id=session_id,
            user_id=user.user_id,
            participant_data=participant_dict,
            filename=file.filename,
            num_tables=numTables,
            num_sessions=numSessions
        )

        logger.info(f"Successfully stored data for {file.filename} with session ID: {session_id} in org {org_id}")

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
