import logging
from typing import Dict

logger = logging.getLogger(__name__)

def calculate_coastal_score(openeo_metadata: Dict, tide_level: float, task_type: str) -> int:
    """
    Aggregates openEO pixel-level calculations and metadata into a final 1-100 score.
    """
    
    score = 100
    
    # 1. Cloud Cover Penalty
    cloud_cover_percent = openeo_metadata.get('cloud_cover_aoi', 0.0)
    logger.info(f"Cloud Cover in AOI: {cloud_cover_percent}%")
    score -= (cloud_cover_percent * 0.8) # Up to 40 point penalty
    
    # 2. Sun Glint Penalty
    sun_elevation = openeo_metadata.get('sun_elevation', 45.0)
    # Very high sun elevation implies high glint risk over water
    if sun_elevation > 60:
        score -= 20
    elif sun_elevation > 50:
        score -= 10
        
    # 3. Turbidity / Brightness
    water_brightness = openeo_metadata.get('turbidity_index', 0.5) 
    # Assume 0.0 is very dark (good), 1.0 is very bright/turbid (bad)
    score -= (water_brightness * 20)
        
    # Bound score between 1 and 100
    final_score = max(1, min(100, int(score)))
    return final_score
