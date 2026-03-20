import pyTMD.io
import pyTMD.compute
import datetime
import os
import numpy as np

def verify_3_0_highlevel():
    data_dir = os.path.abspath("data/fes2022b")
    
    lat, lon = -33.8688, 151.2093
    dt = datetime.datetime(2023, 11, 2, 2, 0, 0)
    
    print(f"Defining model with directory: {data_dir}")
    
    try:
        # In pyTMD 3.0, pyTMD.io.model() is a factory/helper
        # We need to specify the format and directory
        # The FES method returns a model definition
        model = pyTMD.io.model(directory=data_dir, format='netcdf', compressed=False).FES(version='FES2022')
        
        print("Computing tide elevations...")
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
    verify_3_0_highlevel()
