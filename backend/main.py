from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List

# Import modularized components
from api.tides import estimate_tide_fes2022
from api.scoring import calculate_coastal_score

app = FastAPI(title="Coastal S2 App API")

app.add_middleware(
    CORSMiddleware,
    # In production, you'd replace "*" with your Vercel URL
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AOIQuery(BaseModel):
    geojson: dict
    start_date: str
    end_date: str
    task_type: str # "SDB", "Coastline", or "General"

@app.get("/")
def read_root():
    return {"message": "Coastal S2 Processing API Initialized"}

@app.post("/api/query")
def process_aoi(query: AOIQuery):
    # 1. Connect and Search Real CDSE STAC API
    from api.stac_client import search_sentinel2_scenes
    # Increased max_items to 50 to give the scoring engine more options than just the 10 most recent
    real_scenes = search_sentinel2_scenes(query.geojson["geometry"], query.start_date, query.end_date, max_items=50)
    
    # Extract representative coordinate from GeoJSON for tide calc
    coords = query.geojson["geometry"]["coordinates"][0][0]
    lon, lat = coords[0], coords[1]
    
    import json
    import urllib.parse
    
    results = []
    
    # Encode the GeoJSON geometry for the URL
    geom_str = json.dumps(query.geojson["geometry"])
    encoded_geom = urllib.parse.quote(geom_str)
    
    for scene in real_scenes:
        # Extract full date mapping
        scene_datetime = scene.get('datetime')
        if scene_datetime:
            formatted_date = scene_datetime.split('T')[0]
        else:
            try:
                date_str = scene['id'].split('_')[2][:8] # "20231015"
                formatted_date = f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:]}"
            except Exception:
                formatted_date = "2023-10-15"
                
        # 2. Estimate FES2022 Tide level for the specific scene date
        tide_level = estimate_tide_fes2022(lat, lon, str(formatted_date))
        
        # 3. Score the real scene metadata using the dedicated algorithm
        score = calculate_coastal_score(
            openeo_metadata={
                'cloud_cover_aoi': scene['cloud_cover_aoi'],
                'sun_elevation': scene['sun_elevation'],
                'turbidity_index': scene['turbidity_index']
            },
            tide_level=tide_level,
            task_type=query.task_type
        )
        
        # Build Copernicus Browser URL
        obs_start = f"{formatted_date}T00:00:00.000Z"
        obs_end = f"{formatted_date}T23:59:59.999Z"
        copernicus_url = f"https://browser.dataspace.copernicus.eu/?zoom=11&lat={lat}&lng={lon}&themeId=DEFAULT-THEME&datasetId=S2_L2A_CDAS&fromTime={obs_start}&toTime={obs_end}&geometry={encoded_geom}"
        
        results.append({
            "scene_id": scene['id'],
            "score": score,
            "tide_level": tide_level,
            "cloud_cover": scene['cloud_cover_aoi'],
            "thumbnail_url": copernicus_url
        })
        
    # Sort highest top score
    results = sorted(results, key=lambda x: x['score'], reverse=True)
        
    return {
        "status": "success", 
        "metadata": {
            "requested_aoi": query.geojson,
            "task_type": query.task_type
        },
        "scored_images": results
    }
