from pystac_client import Client
import logging

logger = logging.getLogger(__name__)

CDSE_STAC_URL = "https://catalogue.dataspace.copernicus.eu/stac"

def search_sentinel2_scenes(geojson_aoi: dict, start_date: str, end_date: str, max_items: int = 20):
    """
    Queries the real Copernicus Data Space Ecosystem STAC API for Sentinel-2 L2A imagery.
    Accepts either a raw GeoJSON Geometry or a GeoJSON Feature (defensively unwraps).
    """
    logger.info(f"Querying CDSE STAC API from {start_date} to {end_date}")
    
    # Defensively unwrap a Feature object to its geometry
    if geojson_aoi.get("type") == "Feature":
        geojson_aoi = geojson_aoi["geometry"]
    
    try:
        client = Client.open(CDSE_STAC_URL)
        
        # Calculate bounding box from GeoJSON coordinates
        coords = geojson_aoi["coordinates"][0]
        min_lon = min(c[0] for c in coords)
        max_lon = max(c[0] for c in coords)
        min_lat = min(c[1] for c in coords)
        max_lat = max(c[1] for c in coords)
        bbox = [min_lon, min_lat, max_lon, max_lat]
        
        # We search specifically for Sentinel-2 Level-2A (Bottom of Atmosphere) products
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
            # Extract standard Sentinel-2 STAC properties
            # If a property is missing, we provide a safe fallback based on the app's scoring ranges
            scenes.append({
                "id": item.id,
                "cloud_cover_aoi": props.get("eo:cloud_cover", 0.0), # Assuming total cloud cover as proxy for AOI
                "sun_elevation": props.get("view:sun_elevation", 45.0),
                "turbidity_index": 0.5, # STAC doesn't provide turbidity; we return a neutral mock value
                "datetime": props.get("datetime"),
                "thumbnail_url": assets.get("thumbnail").href if "thumbnail" in assets else None
            })
            
        logger.info(f"Retrieved {len(scenes)} scenes from CDSE.")
        return scenes
        
    except Exception as e:
        logger.error(f"Failed to query STAC API: {e}")
        return []

