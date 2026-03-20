import logging
import os
import glob
import datetime
import numpy as np
import pyTMD.io.FES
import pyTMD.predict
import timescale.time
import fsspec

logger = logging.getLogger(__name__)

# Global state to keep the model loaded in memory for performance
_FES_DATASET = None
# Default to local path, but can be overridden by environment variable
_FES_DATA_PATH = os.getenv("FES2022_DATA_PATH", os.path.join(os.path.dirname(__file__), "..", "data", "fes2022b"))

def _get_fes_dataset():
    """Lazily loads the FES2022b dataset from local or remote storage."""
    global _FES_DATASET
    if _FES_DATASET is not None:
        return _FES_DATASET
    
    try:
        logger.info(f"Looking for FES2022b data at: {_FES_DATA_PATH}")
        
        # Use fsspec to list files (works for s3://, r2://, or local)
        fs, path = fsspec.core.url_to_fs(_FES_DATA_PATH)
        
        # Search for .nc files
        if fs.isfile(path):
             model_files = [path]
        else:
             # Find all fes2022.nc files in the directory
             all_files = fs.ls(path)
             model_files = [f if f.startswith(fs.protocol) else f"{fs.protocol[0] if isinstance(fs.protocol, (list, tuple)) else fs.protocol}://{f}" 
                            for f in all_files if f.endswith("_fes2022.nc")]
             
             # If local, ls might not return protocol
             if not fs.protocol or fs.protocol == 'file':
                 model_files = sorted(glob.glob(os.path.join(_FES_DATA_PATH, "*_fes2022.nc")))

        if not model_files:
            logger.warning(f"FES2022 data not found. Make sure NetCDF files are at {_FES_DATA_PATH}")
            return None
        
        logger.info(f"Loading {len(model_files)} FES2022b files (Remote: {bool(fs.protocol and fs.protocol != 'file')})...")
        
        # open_mfdataset handles the constituents as a single virtual dataset
        # We pass the filesystem object to xarray if it's remote
        storage_options = {}
        if fs.protocol and fs.protocol != 'file':
            # For R2/S3, you might need endpoint_url for R2
            if "r2.cloudflarestorage.com" in _FES_DATA_PATH or os.getenv("S3_ENDPOINT_URL"):
                 storage_options["endpoint_url"] = os.getenv("S3_ENDPOINT_URL")
            
            _FES_DATASET = pyTMD.io.FES.open_mfdataset(
                model_files, 
                group='z', 
                format='netcdf',
                engine='netcdf4',
                storage_options=storage_options
            )
        else:
            _FES_DATASET = pyTMD.io.FES.open_mfdataset(model_files, group='z', format='netcdf')
        
        # Ensure units are in meters
        _FES_DATASET = _FES_DATASET.tmd.to_default_units()
        
        return _FES_DATASET
    except Exception as e:
        logger.error(f"Failed to load FES2022 dataset from {_FES_DATA_PATH}: {e}")
        return None

def estimate_tide_fes2022(lat: float, lon: float, time_str: str) -> float:
    """
    Estimates the tidal level using the FES2022b global tidal model constituents.
    """
    logger.info(f"FES2022 Tide calculation requested for {lat}, {lon} at {time_str}")
    
    try:
        # Load or retrieve dataset
        ds = _get_fes_dataset()
        if ds is None:
            return 0.0
        
        # 1. Parse time
        try:
            # Handle ISO format from OpenEO (e.g. 2023-11-02T02:00:00Z)
            dt = datetime.datetime.fromisoformat(time_str.replace('Z', '+00:00'))
        except ValueError:
            dt = datetime.datetime.strptime(time_str, "%Y-%m-%d")
            
        # 2. Prepare timescale object (pyTMD 3.0 ecosystem)
        ts = timescale.time.Timescale().from_datetime(dt)
        
        # 3. Perform prediction
        # FES2022b uses 'x' for longitude (0-360) and 'y' for latitude (-90 to 90)
        target_x = lon % 360
        target_y = lat
        
        # constituents names from dataset
        constituents = list(ds.data_vars)
        amp = []
        ph = []
        
        # Decompose complex constituent values (amp * exp(i*phase))
        # We x-interp real and imag separately to avoid complex64 bugs in xarray
        for c in constituents:
            # Try linear interpolation first
            re_val = ds[c].real.interp(x=target_x, y=target_y).values
            im_val = ds[c].imag.interp(x=target_x, y=target_y).values
            
            # Fallback to nearest neighbor if on the coastline (NaN in FES mask)
            if np.isnan(re_val) or np.isnan(im_val):
                re_val = ds[c].real.interp(x=target_x, y=target_y, method='nearest').values
                im_val = ds[c].imag.interp(x=target_x, y=target_y, method='nearest').values
            
            # If still NaN (point is deep inland or far from grid), return 0.0
            if np.isnan(re_val) or np.isnan(im_val):
                logger.warning(f"FES2022 point ({lat}, {lon}) is outside the ocean grid mask. Setting to 0.0")
                return 0.0
            
            z = complex(re_val + 1j * im_val)
            
            # Scale from cm to meters if needed (FES2022 default is cm)
            scale = 0.01 if ds[c].attrs.get('units') == 'cm' else 1.0
            
            amp.append(np.abs(z) * scale)
            # pyTMD expects phase in degrees [0, 360]
            p = np.degrees(np.angle(z))
            ph.append(p % 360)
            
        amp = np.array(amp, dtype=np.float64)
        ph = np.array(ph, dtype=np.float64)
        
        # 4. Predict
        # timescale.time is part of pyTMD's new ecosystem
        ts = timescale.time.Timescale().from_datetime(dt)
        mjd = float(ts.tide) + 48622.0
        
        # Get nodal corrections (pu, pf) and astronomical arguments (G)
        # pu is in radians, pf is unitless factor, G is in degrees
        pu, pf, G = pyTMD.constituents.arguments(mjd, constituents)
        
        # Flatten and ensure float64
        pu = np.array(pu, dtype=np.float64).flatten()
        pf = np.array(pf, dtype=np.float64).flatten()
        G = np.array(G, dtype=np.float64).flatten()
        
        # Calculate harmonic sum: H = sum( pf * amp * cos(radians(G) + pu - radians(ph)) )
        phase = np.radians(G) + pu - np.radians(ph)
        tide_sum = np.sum(amp * pf * np.cos(phase))
        
        logger.info(f"FES2022 Success: {tide_sum:.3f}m at ({lat}, {lon})")
        return round(float(tide_sum), 3)

    except Exception as e:
        logger.error(f"FES2022 real-time prediction failed: {e}. setting to 0.0")
        return 0.0

