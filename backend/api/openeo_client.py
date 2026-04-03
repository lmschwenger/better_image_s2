import openeo
from openeo.rest.auth.auth import BearerAuth
import logging
import json

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# NOTE: The actual Copernicus / openEO connection URL can be configured here.
OPENEO_URL = "https://openeo.dataspace.copernicus.eu"

def connect_openeo_with_token(access_token: str):
    """Connects to OpenEO CDSE using an existing OIDC access token."""
    try:
        connection = openeo.connect(OPENEO_URL)
        connection.auth = BearerAuth(access_token)
        logger.info("Connected to openEO with Bearer token")
        return connection
    except Exception as e:
        logger.error(f"Failed to connect to openEO: {e}")
        return None

def trigger_download_job(connection, geojson_aoi, date_list, out_format="GeoTIFF"):
    """
    Constructs an OpenEO graph to load specific date ranges for an AOI and exports it.
    Since OpenEO uses temporal extents, we take the min and max date from the selection,
    or we could trigger multiple jobs. Here we trigger one job encompassing the bounds.
    """
    if not date_list:
        raise ValueError("No dates provided")
        
    start_date = min(date_list)
    end_date = max(date_list)
    
    # Increase end_date by 1 day to make it inclusive for openEO
    import datetime
    end_dt = datetime.datetime.strptime(end_date, "%Y-%m-%d") + datetime.timedelta(days=1)
    end_date_inclusive = end_dt.strftime("%Y-%m-%d")
    
    logger.info(f"Triggering OpenEO job from {start_date} to {end_date_inclusive}")
    
    # Load collection
    datacube = connection.load_collection(
        "SENTINEL_2_L2A",
        spatial_extent=geojson_aoi['geometry'] if 'geometry' in geojson_aoi else geojson_aoi,
        temporal_extent=[start_date, end_date_inclusive],
        bands=["B02", "B03", "B04", "B08", "SCL"] # Common bands
    )
    
    # Save Result (NetCDF or GeoTIFF)
    datacube = datacube.save_result(format=out_format)
    
    # Create and start the batch job
    job = connection.create_job(datacube.flat_graph(), title="Coastal Sentinel App Download")
    job.start()
    
    return {
        "job_id": job.job_id,
        "status": "created",
        "message": "OpenEO batch job created. It may take some time to process.",
    }
