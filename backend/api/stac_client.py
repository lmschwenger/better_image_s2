import urllib.request
import json
from pystac_client import Client
import logging
from shapely.geometry import shape

logger = logging.getLogger(__name__)

MPC_STAC_URL = "https://planetarycomputer.microsoft.com/api/stac/v1"

def fetch_aoi_stats(item_id: str, bbox: list) -> dict:
    """
    Fetches AOI-specific statistics for Aerosols (AOT) and land cover (SCL).
    SCL Classes: 8 (Medium Cloud), 9 (High Cloud), 10 (Thin Cirrus), 11 (Snow/Ice).
    """
    bbox_str = f"{bbox[0]},{bbox[1]},{bbox[2]},{bbox[3]}"
    res_stats = {"aot_mean": None, "cloud_percent": None, "snow_percent": None}
    
    # 1. Fetch AOT (Atmospheric Aerosol)
    aot_url = f"https://planetarycomputer.microsoft.com/api/data/v1/item/statistics?collection=sentinel-2-l2a&item={item_id}&assets=AOT&bbox={bbox_str}"
    try:
        req = urllib.request.Request(aot_url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=5) as res:
            data = json.loads(res.read())
            res_stats["aot_mean"] = data.get("AOT_b1", {}).get("mean")
    except Exception as e:
        logger.debug(f"AOT stats failed for {item_id}: {e}")

    # 2. Fetch SCL (Cloud/Snow Categorical)
    scl_url = f"https://planetarycomputer.microsoft.com/api/data/v1/item/statistics?collection=sentinel-2-l2a&item={item_id}&assets=SCL&bbox={bbox_str}&categorical=True"
    try:
        req = urllib.request.Request(scl_url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=5) as res:
            data = json.loads(res.read())
            scl_stats = data.get("SCL_b1", {})
            histogram = scl_stats.get("histogram", [[], []])
            counts = histogram[0]
            values = histogram[1]
            total_pixels = scl_stats.get("valid_pixels", 0)
            
            if total_pixels > 0:
                val_to_count = dict(zip(values, counts))
                # Clouds: 8 (Med), 9 (High), 10 (Cirrus)
                cloud_count = val_to_count.get(8.0, 0) + val_to_count.get(9.0, 0) + val_to_count.get(10.0, 0)
                # Snow: 11
                snow_count = val_to_count.get(11.0, 0)
                
                res_stats["cloud_percent"] = (cloud_count / total_pixels) * 100.0
                res_stats["snow_percent"] = (snow_count / total_pixels) * 100.0
    except Exception as e:
        logger.debug(f"SCL stats failed for {item_id}: {e}")
        
    return res_stats

def search_sentinel2_scenes(geojson_aoi: dict, start_date: str, end_date: str, max_items: int = 20):
    """
    Queries the Microsoft Planetary Computer STAC API for Sentinel-2 L2A imagery.
    Filters out scenes that do not cover at least 80% of the user-provided AOI.
    """
    logger.info(f"Querying MPC STAC API from {start_date} to {end_date}")
    
    if geojson_aoi.get("type") == "Feature":
        geojson_aoi = geojson_aoi["geometry"]
    
    aoi_shape = shape(geojson_aoi)
    aoi_area = aoi_shape.area
    
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
            # 1. Geometric Coverage check
            item_shape = shape(item.geometry)
            intersection = aoi_shape.intersection(item_shape)
            coverage = (intersection.area / aoi_area) * 100.0
            
            if coverage < 80.0:
                logger.info(f"Discarding item {item.id}: only {coverage:.1f}% AOI coverage.")
                continue

            props = item.properties
            assets = item.assets
            
            # Sun elevation fallback logic
            sun_elev = props.get("view:sun_elevation")
            if sun_elev is None and "s2:mean_solar_zenith" in props:
                sun_elev = 90.0 - props["s2:mean_solar_zenith"]
            
            # Fetch AOI-specific stats from Titiler service
            aoi_stats = fetch_aoi_stats(item.id, bbox)
            
            # Fallback to scene-wide properties if AOI-specific stats fail
            cloud_aoi = aoi_stats.get("cloud_percent")
            if cloud_aoi is None:
                cloud_aoi = props.get("eo:cloud_cover")
            
            snow_aoi = aoi_stats.get("snow_percent")
            if snow_aoi is None:
                snow_aoi = props.get("s2:snow_ice_percentage")
            
            # Generate a cropped thumbnail URL using the bbox endpoint
            bbox_str = f"{min_lon},{min_lat},{max_lon},{max_lat}"
            cropped_thumbnail_url = f"https://planetarycomputer.microsoft.com/api/data/v1/item/bbox/{bbox_str}.png?collection=sentinel-2-l2a&item={item.id}&assets=visual"
            
            scenes.append({
                "id": item.id,
                "cloud_cover_aoi": cloud_aoi,
                "sun_elevation": sun_elev,
                "snow_ice_percent": snow_aoi,
                "aot_mean": aoi_stats.get("aot_mean"),
                "datetime": props.get("datetime"),
                "thumbnail_url": cropped_thumbnail_url
            })
            
        logger.info(f"Retrieved {len(scenes)} high-coverage scenes from MPC.")
        return scenes
        
    except Exception as e:
        logger.error(f"Failed to query STAC API: {e}")
        return []

