import logging

logger = logging.getLogger(__name__)

def estimate_tide_fes2022(lat: float, lon: float, time_str: str) -> float:
    """
    Estimates the tidal level using the FES2022 global tidal model.
    In a full production implementation, this would either query a 
    pre-processed FES2022 xarray dataset (NetCDF) or an external tidal API.
    
    For now, it returns a mock tide level generated deterministically
    based on the input coordinates and time.
    """
    logger.info(f"FES2022 Tide calculation requested for {lat}, {lon} at {time_str}")
    
    # Pseudo-random but deterministic tide between -1.5m and 1.5m
    # based on the hash of coordinates and time.
    seed_str = f"{lat}_{lon}_{time_str}"
    tide_hash = hash(seed_str) % 300
    mock_tide_level = (tide_hash / 100.0) - 1.5
    
    return round(mock_tide_level, 2)
