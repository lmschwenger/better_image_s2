from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Dict, Any

from api.database import get_db
from api.models import User
from api.auth import require_user
from api.openeo_client import connect_openeo_with_token, trigger_download_job

router = APIRouter()

class DownloadRequest(BaseModel):
    aoi_geojson: Dict[str, Any]
    dates: List[str]

@router.post("/api/download-scenes")
def download_scenes(
    req: DownloadRequest, 
    user: User = Depends(require_user),
    db: Session = Depends(get_db)
):
    """
    Triggers an OpenEO batch job to download Sentinel-2 data.
    Requires the user to have authenticated with Copernicus and stored their access token.
    """
    if not user.copernicus_access_token:
        raise HTTPException(
            status_code=403, 
            detail="User is not authenticated with Copernicus. Please connect your account first."
        )
    
    # 1. Connect to OpenEO using user's access token
    connection = connect_openeo_with_token(user.copernicus_access_token)
    if not connection:
        raise HTTPException(
            status_code=500, 
            detail="Failed to connect to OpenEO using the stored token. Token might be expired."
        )
    
    # 2. Trigger the job
    try:
        job_info = trigger_download_job(connection, req.aoi_geojson, req.dates)
        return job_info
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OpenEO job creation failed: {str(e)}")
