from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy.orm import Session
import os
import io
import logging

# Import modularized components
from api.tides import estimate_tide_fes2022
from api.scoring import calculate_coastal_score
from api.database import engine, Base, get_db
from api.models import User, Job
from api.auth import (
    create_access_token,
    get_current_user, require_user
)
from api.oidc import oauth, config

# Create database tables on startup
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Coastal S2 App API")

# Authlib requires SessionMiddleware to track OAuth state (CSRF PROTECTION)
app.add_middleware(
    SessionMiddleware, 
    secret_key=config("SESSION_SECRET", default="coastal-session-secret-change-in-prod"),
    session_cookie="coastal_session",
    same_site="lax",
    https_only=False,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Pydantic Models ───

class AOIQuery(BaseModel):
    geojson: dict
    start_date: str
    end_date: str
    task_type: str  # "SDB", "Coastline", or "General"

# ─── Auth Endpoints (OIDC) ───

def get_auth_redirect_uri(request: Request, provider: str) -> str:
    """Helper to consistently generate redirect URIs, handling proxies and localhost."""
    redirect_uri = request.url_for('auth_callback', provider=provider)
    if "localhost" in str(request.base_url) or "127.0.0.1" in str(request.base_url):
        redirect_uri = str(redirect_uri).replace("127.0.0.1", "localhost")
    if os.environ.get("RENDER"):
        redirect_uri = str(redirect_uri).replace("http://", "https://")
    return str(redirect_uri)

@app.get("/")
def read_root():
    return {"message": "Coastal S2 Processing API Initialized"}

@app.get("/api/auth/login/{provider}")
async def login_oidc(provider: str, request: Request):
    """
    Redirects the user to Google or GitHub login page.
    """
    # CRITICAL: Normalize 127.0.0.1 to localhost to ensure cookie domain consistency
    if "127.0.0.1" in str(request.base_url):
        new_url = str(request.url).replace("127.0.0.1", "localhost")
        from fastapi.responses import RedirectResponse
        return RedirectResponse(url=new_url)

    client = oauth.create_client(provider)
    if not client:
        raise HTTPException(status_code=404, detail=f"Provider {provider} not found")
    
    redirect_uri = get_auth_redirect_uri(request, provider)
    
    print(f"--- OIDC DEBUG --- Redirecting to {provider} via {redirect_uri}")
    return await client.authorize_redirect(request, redirect_uri)

@app.get("/api/auth/callback/{provider}", name="auth_callback")
async def auth_callback(provider: str, request: Request, db: Session = Depends(get_db)):
    """
    Callback URL that Google/GitHub redirects back to.
    """
    client = oauth.create_client(provider)
    if not client:
        print(f"--- OIDC DEBUG --- Provider {provider} not found in callback")
        raise HTTPException(status_code=404, detail="Invalid provider")
    
    print(f"--- OIDC DEBUG --- Callback Cookies: {request.cookies}")
    print(f"--- OIDC DEBUG --- Callback Session: {request.session}")
    
    # Regenerate the SAME redirect_uri used in the first step
    redirect_uri = get_auth_redirect_uri(request, provider)

    try:
        print(f"--- OIDC DEBUG --- Fetching token for {provider} using redirect_uri={redirect_uri}")
        token = await client.authorize_access_token(request)
        user_info = token.get('userinfo')
        
        # GitHub doesn't always provide 'userinfo' via OpenID Connect by default
        if not user_info:
            print(f"--- OIDC DEBUG --- No userinfo in token, fetching manually for {provider}")
            resp = await client.get('user', token=token)
            user_info = resp.json()
            
        print(f"--- OIDC DEBUG --- Received userinfo: {user_info}")
            
        email = user_info.get('email')
        name = user_info.get('name') or user_info.get('login') or (email.split('@')[0] if email else "OIDC User")
        
        if not email:
            # Fallback for GitHub if email is private
            if provider == 'github':
                print("--- OIDC DEBUG --- Email private on GitHub, fetching emails manually")
                emails_resp = await client.get('user/emails', token=token)
                emails = emails_resp.json()
                primary_email = next((e['email'] for e in emails if e['primary']), emails[0]['email'] if emails else None)
                email = primary_email

        if not email:
            raise HTTPException(status_code=400, detail="OAuth provider did not return an email.")
    except Exception as e:
        print(f"--- OIDC DEBUG --- ERROR IN CALLBACK: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Authentication error: {str(e)}")

    # Find or Create User
    user = db.query(User).filter(User.email == email).first()
    if not user:
        # For OIDC users, we don't need a hashed password
        user = User(
            email=email,
            display_name=name
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    
    # Generate our app's JWT token
    app_token = create_access_token({"sub": str(user.id)})
    
    import json
    import urllib.parse
    
    user_data = json.dumps({
        "id": user.id,
        "email": user.email,
        "display_name": user.display_name,
        "is_unlimited": user.is_unlimited
    })
    encoded_user = urllib.parse.quote(user_data)
    
    # Redirect back to the frontend with the token in the URL
    frontend_url = config("FRONTEND_URL", default="http://localhost:5173")
    redirect_url = f"{frontend_url}/?token={app_token}&user={encoded_user}"
    
    return RedirectResponse(url=redirect_url)

@app.get("/api/me")
def get_me(user: User = Depends(require_user)):
    return {
        "id": user.id, 
        "email": user.email, 
        "display_name": user.display_name,
        "free_credits": user.free_credits,
        "purchased_credits": user.purchased_credits,
        "is_unlimited": user.is_unlimited
    }

# ─── Jobs Endpoints ───

@app.get("/api/jobs")
def list_jobs(user: User = Depends(require_user), db: Session = Depends(get_db)):
    """List all jobs for the authenticated user."""
    jobs = db.query(Job).filter(Job.user_id == user.id).order_by(Job.created_at.desc()).all()
    return [
        {
            "id": j.id,
            "task_type": j.task_type,
            "start_date": j.start_date,
            "end_date": j.end_date,
            "aoi_geojson": j.aoi_geojson,
            "result_count": j.result_count,
            "created_at": j.created_at.isoformat() if j.created_at else None,
        }
        for j in jobs
    ]

@app.get("/api/jobs/{job_id}")
def get_job(job_id: int, user: User = Depends(require_user), db: Session = Depends(get_db)):
    """Load a specific job with full results."""
    job = db.query(Job).filter(Job.id == job_id, Job.user_id == user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return {
        "id": job.id,
        "task_type": job.task_type,
        "start_date": job.start_date,
        "end_date": job.end_date,
        "aoi_geojson": job.aoi_geojson,
        "results": job.results,
        "result_count": job.result_count,
        "created_at": job.created_at.isoformat() if job.created_at else None,
    }

@app.delete("/api/jobs/{job_id}")
def delete_job(job_id: int, user: User = Depends(require_user), db: Session = Depends(get_db)):
    """Delete a specific job."""
    job = db.query(Job).filter(Job.id == job_id, Job.user_id == user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    db.delete(job)
    db.commit()
    return {"status": "success"}

# ─── Main Query Endpoint ───

@app.post("/api/query")
def process_aoi(
    query: AOIQuery,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    # 1. Check if user has enough credits (skip if unlimited)
    if not user.is_unlimited and (user.free_credits + user.purchased_credits < 1):
        raise HTTPException(status_code=402, detail="Payment Required: Insufficient credits.")
        
    try:
        # 2. Deduct credit (skip if unlimited)
        if not user.is_unlimited:
            if user.free_credits > 0:
                user.free_credits -= 1
            else:
                user.purchased_credits -= 1
            db.commit()
        
        # 3. Process the heavy workload with log capture
        from api.stac_client import search_sentinel2_scenes
        
        log_buffer = io.StringIO()
        log_handler = logging.StreamHandler(log_buffer)
        log_handler.setLevel(logging.INFO)
        # We target the root logger or specific loggers to capture all diagnostic output
        root_logger = logging.getLogger()
        root_logger.addHandler(log_handler)
        
        try:
            real_scenes = search_sentinel2_scenes(query.geojson["geometry"], query.start_date, query.end_date, max_items=50)
            
            coords_list = query.geojson["geometry"]["coordinates"][0]
            # Calculate naive center
            lon = sum(c[0] for c in coords_list) / len(coords_list)
            lat = sum(c[1] for c in coords_list) / len(coords_list)
            
            # Calculate appropriate zoom level based on geographic extent
            min_lon = min(c[0] for c in coords_list)
            max_lon = max(c[0] for c in coords_list)
            min_lat = min(c[1] for c in coords_list)
            max_lat = max(c[1] for c in coords_list)
            
            width = max_lon - min_lon
            height = max_lat - min_lat
            max_dim = max(width, height)
            
            # Heuristic zoom level mapping based on degree span
            if max_dim > 2.0:
                zoom = 8
            elif max_dim > 0.5:
                zoom = 10
            elif max_dim > 0.1:
                zoom = 12
            elif max_dim > 0.02:
                zoom = 14
            else:
                zoom = 15
                
            import json
            import urllib.parse
            
            results = []
            
            # Build polygon GeoJSON string for Copernicus
            geom_str = json.dumps(query.geojson["geometry"])
            encoded_geom = urllib.parse.quote(geom_str)
            
            for scene in real_scenes:
                scene_datetime = scene.get('datetime')
                formatted_date = scene_datetime.split('T')[0]
                        
                tide_level = estimate_tide_fes2022(lat, lon, str(formatted_date))
                
                score = calculate_coastal_score(
                    openeo_metadata={
                        'cloud_cover_aoi': scene['cloud_cover_aoi'],
                        'sun_elevation': scene['sun_elevation'],
                        'snow_ice_percent': scene['snow_ice_percent'],
                        'aot_mean': scene['aot_mean']
                    },
                    tide_level=tide_level,
                    task_type=query.task_type
                )
                
                obs_start = f"{formatted_date}T00:00:00.000Z"
                obs_end = f"{formatted_date}T23:59:59.999Z"
                copernicus_url = f"https://browser.dataspace.copernicus.eu/?zoom={zoom}&lat={lat}&lng={lon}&themeId=DEFAULT-THEME&datasetId=S2_L2A_CDAS&fromTime={obs_start}&toTime={obs_end}&geometry={encoded_geom}"
                
                thumbnail_url = scene.get('thumbnail_url')
                
                results.append({
                    "scene_id": scene['id'],
                    "datetime": formatted_date,
                    "score": score,
                    "tide_level": tide_level,
                    "cloud_cover": scene['cloud_cover_aoi'],
                    "copernicus_url": copernicus_url,
                    "thumbnail_url": thumbnail_url
                })
                
            results = sorted(results, key=lambda x: x['score'], reverse=True)
            
            # Create the job record
            job = Job(
                user_id=user.id,
                task_type=query.task_type,
                start_date=query.start_date,
                end_date=query.end_date,
                aoi_geojson=query.geojson,
                results=results,
                result_count=len(results),
                logs=log_buffer.getvalue()
            )
            db.add(job)
            db.commit()
            db.refresh(job)
            
            return {
                "status": "success", 
                "metadata": {
                    "requested_aoi": query.geojson,
                    "task_type": query.task_type,
                    "job_id": job.id
                },
                "scored_images": results
            }
            
        finally:
            root_logger.removeHandler(log_handler)
            log_buffer.close()
            
    except Exception as e:
        # If the Sentinel API fails or code crashes, rollback the database
        db.rollback()
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Processing failed. Credit securely refunded. Error: {str(e)}")

@app.get("/api/jobs/{job_id}/logs")
def get_job_logs(job_id: int, current_user: User = Depends(require_user), db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id, Job.user_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"logs": job.logs}
