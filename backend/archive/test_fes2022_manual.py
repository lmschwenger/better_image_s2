import pyTMD.io.FES
import os
import glob
import numpy as np
import datetime

def test_manual_loading():
    data_dir = os.path.abspath("data/fes2022b")
    file_pattern = os.path.join(data_dir, "*_fes2022.nc")
    model_files = glob.glob(file_pattern)
    
    if not model_files:
        print(f"No files found in {data_dir} matching {file_pattern}")
        return

    print(f"Found {len(model_files)} constituent files.")
    
    # Sydney
    lat, lon = -33.8688, 151.2093
    time_str = "2023-11-02 02:00:00"
    dt = datetime.datetime.strptime(time_str, "%Y-%m-%d %H:%M:%S")
    
    # Convert time to modified julian days (pyTMD format)
    # pyTMD treats days as days since 1992-01-01T00:00:00
    t = (dt - datetime.datetime(1992, 1, 1)).total_seconds() / 86400.0
    
    try:
        print("Opening multidataset...")
        # group='z' for elevations
        ds = pyTMD.io.FES.open_mfdataset(model_files, group='z', format='netcdf')
        
        # interpolate to point
        # ds.interpolate expects lon, lat
        # This part depends on the pyTMD version. In 3.x it might be different.
        
        print("Model loaded successfully.")
        # print(ds.constituents)
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_manual_loading()
