import numpy as np
import pyTMD.compute
import pyTMD.io
import datetime
import os

def test_tide():
    # Sydney Coordinates
    lat, lon = -33.8688, 151.2093
    # Use a specific time
    time_str = "2023-11-02 02:00:00"
    dt = datetime.datetime.strptime(time_str, "%Y-%m-%d %H:%M:%S")
    
    # Path to data
    data_dir = os.path.abspath("data/fes2022b")
    
    # FES2022b constituents (standard set)
    constituents = [
        '2n2', 'eps2', 'j1', 'k1', 'k2', 'l2', 'lambda2', 'm2', 'm3', 'm4',
        'm6', 'm8', 'mf', 'mks2', 'mm', 'mn4', 'ms4', 'msf', 'msqm', 'mtm',
        'mu2', 'n2', 'n4', 'nu2', 'o1', 'p1', 'q1', 'r2', 's1', 's2', 's4',
        'sa', 'ssa', 't2'
    ]
    
    print(f"Loading FES2022 model from {data_dir}...")
    
    try:
        # We use compute.tide_elevations which takes lat, lon, time, and model info
        # For FES2022, we usually need to specify the format and files
        # Alternatively, we can use the low-level io.FES to read and then predict
        
        tide = pyTMD.compute.tide_elevations(
            np.array([lon]), np.array([lat]), np.array([dt]),
            DIRECTORY=data_dir,
            MODEL='FES2022',
            GZIP=False,
            DEFINITION_FILE=None # We will let it find the files based on MODEL name
        )
        
        print(f"Computed Tide for {time_str} at {lat}, {lon}: {tide[0]:.4f} m")
        
    except Exception as e:
        print(f"Error computing tide: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_tide()
