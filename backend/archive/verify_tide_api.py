import pyTMD.io
import pyTMD.predict
import timescale.time
import datetime
import os
import glob
import numpy as np

def verify_3_0_api():
    data_dir = os.path.abspath("data/fes2022b")
    file_pattern = os.path.join(data_dir, "*_fes2022.nc")
    model_files = glob.glob(file_pattern)
    
    lat, lon = -33.8688, 151.2093
    dt = datetime.datetime(2023, 11, 2, 2, 0, 0)
    
    print("Reading harmonics...")
    amp, ph, constituents = pyTMD.io.FES.read_fes_file(
        model_files, lon, lat, 
        group='z', format='netcdf'
    )
    
    print("Predicting...")
    ts = timescale.time.Timescale().from_datetime(dt)
    # The time variable for pyTMD prediction is usually ts.tide
    tide = pyTMD.predict.drift(ts.tide, amp, ph, constituents)
    
    print(f"Result: {tide[0]} m")

if __name__ == "__main__":
    verify_3_0_api()
