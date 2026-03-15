import urllib.request
import json
from pystac_client import Client
import logging

logger = logging.getLogger(__name__)

MPC_STAC_URL = "https://planetarycomputer.microsoft.com/api/stac/v1"

def fetch_aoi_stats(item_id: str, bbox: list) -> dict:
    """
    Fetches AOI-specific statistics for Aerosols (AOT) and land cover (SCL).
    SCL Classes: 8 (Medium Cloud), 9 (High Cloud), 10 (Thin Cirrus), 11 (Snow/Ice).
    """
    bbox_str = f"{bbox[0]},{bbox[1]},{bbox[2]},{bbox[3]}"
    assets = "AOT,SCL"
    stats_url = f"https://planetarycomputer.microsoft.com/api/data/v1/item/statistics?collection=sentinel-2-l2a&item={item_id}&assets={assets}&bbox={bbox_str}&categorical=True"
    
    try:
        req = urllib.request.Request(stats_url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as res:
            data = json.loads(res.read())
            
            # 1. AOT Mean
            aot_mean = data.get("AOT_b1", {}).get("mean")
            
            # 2. SCL specific percentages (categorical)
            scl_stats = data.get("SCL_b1", {})
            histogram = scl_stats.get("histogram", [[], []])
            counts = histogram[0]
            values = histogram[1]
            total_pixels = scl_stats.get("valid_pixels", 0)
            
            res_stats = {
                "aot_mean": aot_mean,
                "cloud_percent": 0.0,
                "snow_percent": 0.0
            }
            
            if total_pixels > 0:
                val_to_count = dict(zip(values, counts))
                # Clouds: 8 (Med), 9 (High), 10 (Cirrus)
                cloud_count = val_to_count.get(8.0, 0) + val_to_count.get(9.0, 0) + val_to_count.get(10.0, 0)
                # Snow: 11
                snow_count = val_to_count.get(11.0, 0)
                
                res_stats["cloud_percent"] = (cloud_count / total_pixels) * 100.0
                res_stats["snow_percent"] = (snow_count / total_pixels) * 100.0
                
            return res_stats
            
    except Exception as e:
        logger.warning(f"Failed to fetch AOI stats for {item_id}: {e}")
        return {"aot_mean": None, "cloud_percent": None, "snow_percent": None}

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
            
            # Fetch AOI-specific stats from Titiler service
            aoi_stats = fetch_aoi_stats(item.id, bbox)
            
            scenes.append({
                "id": item.id,
                "cloud_cover_aoi": aoi_stats.get("cloud_percent"),
                "sun_elevation": sun_elev,
                "snow_ice_percent": aoi_stats.get("snow_percent"),
                "aot_mean": aoi_stats.get("aot_mean"),
                "datetime": props.get("datetime"),
                "thumbnail_url": assets.get("rendered_preview").href if "rendered_preview" in assets else None
            })
            
        logger.info(f"Retrieved {len(scenes)} scenes from MPC.")
        return scenes
        
    except Exception as e:
        logger.error(f"Failed to query STAC API: {e}")
        return []

