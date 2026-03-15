import logging
from typing import Dict

logger = logging.getLogger(__name__)

def calculate_coastal_score(openeo_metadata: Dict, tide_level: float, task_type: str) -> int:
    """
    Aggregates openEO pixel-level calculations and metadata into a final 1-100 score.
    """
    
    score = 100
    
    # 1. Cloud Cover Penalty
    cloud_cover_percent = openeo_metadata.get('cloud_cover_aoi')
    if cloud_cover_percent is not None:
        logger.info(f"Cloud Cover in AOI: {cloud_cover_percent}%")
        score -= (cloud_cover_percent * 0.8) # Up to 40 point penalty
    
    # 2. Sun Glint Penalty
    sun_elevation = openeo_metadata.get('sun_elevation')
    if sun_elevation is not None:
        # Very high sun elevation implies high glint risk over water
        if sun_elevation > 60:
            score -= 20
        elif sun_elevation > 50:
            score -= 10
            
    # 3. Snow / Ice Penalty
    # Snow on the shore or ice in water is catastrophic for these tasks
    snow_ice = openeo_metadata.get('snow_ice_percent')
    if snow_ice is not None and snow_ice > 1.0:
        logger.info(f"Snow/Ice detected: {snow_ice}%")
        score -= (snow_ice * 1.5) # Heavy penalty
        
    # 4. Atmospheric Aerosols (AOT)
    # AOT 100 is typically clear, > 200 is hazy, > 400 is very murky
    aot = openeo_metadata.get('aot_mean')
    if aot is not None:
        if aot > 300:
            score -= 25
        elif aot > 150:
            score -= 10
        
    # 5. Turbidity / Brightness (Optional if present)
    water_brightness = openeo_metadata.get('turbidity_index') 
    if water_brightness is not None:
        score -= (water_brightness * 20)
        
    # Bound score between 1 and 100
    final_score = max(1, min(100, int(score)))
    return final_score
