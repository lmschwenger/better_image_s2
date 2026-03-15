import urllib.request
import json
from pystac_client import Client
import logging

logger = logging.getLogger(__name__)

MPC_STAC_URL = "https://planetarycomputer.microsoft.com/api/stac/v1"

def fetch_aot_stats(item_id: str, bbox: list) -> float:
    """
    Fetches the mean Aerosol Optical Thickness (AOT) for the AOI from MPC Titiler.
    """
    bbox_str = f"{bbox[0]},{bbox[1]},{bbox[2]},{bbox[3]}"
    stats_url = f"https://planetarycomputer.microsoft.com/api/data/v1/item/statistics?collection=sentinel-2-l2a&item={item_id}&assets=AOT&bbox={bbox_str}"
    
    try:
        req = urllib.request.Request(stats_url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as res:
            data = json.loads(res.read())
            # MPC returns statistics per asset/band
            return data.get("AOT_b1", {}).get("mean")
    except Exception as e:
        logger.warning(f"Failed to fetch AOT stats for {item_id}: {e}")
        return None

def search_sentinel2_scenes(geojson_aoi: dict, start_date: str, end_date: str, max_items: int = 20):
    """
    Queries the Microsoft Planetary Computer STAC API for Sentinel-2 L2A imagery.
    """
    logger.info(f"Querying MPC STAC API from {start_date} to {end_date}")
    
    if geojson_aoi.get("type") == "Feature":
        geojson_aoi = geojson_aoi["geometry"]
    
    try:
        client = Client.open(MPC_STAC_URL)
        
        coords = geojson_aoi["coordinates"][0]
        min_lon = min(c[0] for c in coords)
        max_lon = max(c[0] for c in coords)
        min_lat = min(c[1] for c in coords)
        max_lat = max(c[1] for c in coords)
        bbox = [min_lon, min_lat, max_lon, max_lat]
        
        search = client.search(
            collections=["sentinel-2-l2a"],
            bbox=bbox, 
            datetime=f"{start_date}/{end_date}",
            max_items=max_items,
            sortby=[{"field": "eo:cloud_cover", "direction": "asc"}]
        )
        
        items = list(search.items())
        scenes = []
        
        for item in items:
            props = item.properties
            assets = item.assets
            
            # Sun elevation fallback logic
            sun_elev = props.get("view:sun_elevation")
            if sun_elev is None and "s2:mean_solar_zenith" in props:
                sun_elev = 90.0 - props["s2:mean_solar_zenith"]
            
            # Fetch AOT stats (atmospheric aerosol levels)
            aot_mean = fetch_aot_stats(item.id, bbox)
            
            scenes.append({
                "id": item.id,
                "cloud_cover_aoi": props.get("eo:cloud_cover"),
                "sun_elevation": sun_elev,
                "snow_ice_percent": props.get("s2:snow_ice_percentage"),
                "aot_mean": aot_mean,
                "datetime": props.get("datetime"),
                "thumbnail_url": assets.get("rendered_preview").href if "rendered_preview" in assets else None
            })
            
        logger.info(f"Retrieved {len(scenes)} scenes from MPC.")
        return scenes
        
    except Exception as e:
        logger.error(f"Failed to query STAC API: {e}")
        return []

