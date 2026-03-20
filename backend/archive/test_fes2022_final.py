import pyTMD.io.FES
import pyTMD.predict
import timescale.time
import datetime
import os
import glob
import numpy as np
import xarray as xr

def manual_summation():
    data_dir = os.path.abspath("data/fes2022b")
    # Constituents
    file_pattern = os.path.join(data_dir, "*_fes2022.nc")
    model_files = glob.glob(file_pattern)
    
    if not model_files:
        print("No model files found!")
        return

    lat, lon = -33.8688, 151.2093
    dt = datetime.datetime(2023, 11, 2, 2, 0, 0)
    
    print(f"Opening {len(model_files)} files...")
    # In pyTMD 3.0, use FESDataset or open_fes_dataset
    # I'll try to use open_mfdataset which I saw in dir()
    ds = pyTMD.io.FES.open_mfdataset(model_files, group='z', format='netcdf')
    
    # Verify constituents
    print(f"Constituents: {ds.constituents}")
    
    # Interpolate amplitudes and phases to point
    # FES models use lat/lon as 'lat' and 'lon' (decimal degrees)
    print("Interpolating harmonics to point...")
    # This might vary. Often it's ds.interp(lon=lon, lat=lat) if it's an xarray dataset
    point_ds = ds.interp(lon=lon, lat=lat)
    
    amp = point_ds.amplitude.values
    ph = point_ds.phase.values
    constituents = ds.constituents
    
    print("Predicting...")
    ts = timescale.time.Timescale().from_datetime(dt)
    tide = pyTMD.predict.drift(ts.tide, amp, ph, constituents)
    
    print(f"Result: {tide[0]} m")

if __name__ == "__main__":
    manual_summation()
