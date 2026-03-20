import logging
from typing import Dict

logger = logging.getLogger(__name__)

def calculate_coastal_score(openeo_metadata: Dict, tide_level: float, task_type: str) -> Dict:
    """
    Aggregates metrics into a final 1-100 score and returns a detailed breakdown.
    """
    current_score = 100.0
    breakdown = {"initial_score": 100}
    
    # 1. Cloud Cover Penalty
    cloud_cover_percent = openeo_metadata.get('cloud_cover_aoi')
    if cloud_cover_percent is not None:
        penalty = cloud_cover_percent * 0.8
        current_score -= penalty
        breakdown["cloud_percent"] = round(cloud_cover_percent, 1)
        breakdown["cloud_penalty"] = round(penalty, 2)
    
    # 2. Sun Glint Penalty
    sun_elevation = openeo_metadata.get('sun_elevation')
    if sun_elevation is not None:
        penalty = 0
        if sun_elevation > 60:
            penalty = 20
        elif sun_elevation > 50:
            penalty = 10
        current_score -= penalty
        breakdown["sun_elevation"] = round(sun_elevation, 1)
        breakdown["sun_glint_penalty"] = penalty
            
    # 3. Snow / Ice Penalty
    snow_ice = openeo_metadata.get('snow_ice_percent')
    if snow_ice is not None:
        penalty = snow_ice * 1.5
        current_score -= penalty
        breakdown["snow_ice_percent"] = round(snow_ice, 1)
        breakdown["snow_ice_penalty"] = round(penalty, 2)
        
    # 4. Atmospheric Aerosols (AOT)
    aot = openeo_metadata.get('aot_mean')
    if aot is not None:
        penalty = max(0, (aot - 80) * 0.125)
        current_score -= penalty
        breakdown["aot_mean"] = round(aot, 1)
        breakdown["aerosol_penalty"] = round(penalty, 2)
        
    # 5. Turbidity / Brightness
    # Increased threshold to 800 and reduced slope (0.03) to be less aggressive.
    turbidity = openeo_metadata.get('turbidity_index') 
    if turbidity is not None:
        penalty = min(30, max(0, (turbidity - 800) * 0.03))
        current_score -= penalty
        breakdown["turbidity_index"] = round(turbidity, 1)
        breakdown["turbidity_penalty"] = round(penalty, 2)

    # 6. Tide Level Penalty (Task Specific)
    if task_type == "SDB":
        if tide_level > 0.5:
            penalty = min(25, (tide_level - 0.5) * 10)
            current_score -= penalty
            breakdown["tide_level"] = round(tide_level, 2)
            breakdown["tide_penalty"] = round(penalty, 2)
        
    final_score = max(1, min(100, int(current_score)))
    return {
        "final_score": final_score,
        "breakdown": breakdown
    }
