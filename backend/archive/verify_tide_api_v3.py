import pyTMD.io
import pyTMD.compute
import datetime
import os
import glob
import numpy as np

def verify_custom_model():
    # User's path
    data_dir = os.path.abspath("data/fes2022b")
    # All .nc files in that folder
    model_files = sorted(glob.glob(os.path.join(data_dir, "*_fes2022.nc")))
    
    if not model_files:
        print("No .nc files found!")
        return

    # Define a custom model dictionary based on FES2022 database entry
    model_dict = {
        "format": "FES-netcdf",
        "name": "FES2022-Local",
        "projection": "EPSG:4326",
        "z": {
            "model_file": model_files,
            "units": "cm", 
            "variable": "tide_ocean"
        }
    }
    
    lat, lon = -33.8688, 151.2093
    dt = datetime.datetime(2023, 11, 2, 2, 0, 0)
    
    print(f"Loading custom model with {len(model_files)} constituents...")
    # We set verify=False because we already have absolute paths in model_file
    model = pyTMD.io.model(verify=False).from_dict(model_dict)
    
    print("Computing tide elevations...")
    try:
        tide = pyTMD.compute.tide_elevations(
            np.array([lon]), np.array([lat]), np.array([dt]),
            MODEL=model,
            EPSG=4326
        )
        print(f"Result: {tide[0]} m")
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    verify_custom_model()
