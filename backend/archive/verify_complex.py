import pyTMD.io.FES
import pyTMD.predict
import timescale.time
import datetime
import os
import glob
import numpy as np
import xarray as xr

def verify_complex_decomposition():
    data_dir = os.path.abspath("data/fes2022b")
    model_files = glob.glob(os.path.join(data_dir, "*_fes2022.nc"))
    
    lat, lon = -33.8688, 151.2093
    dt = datetime.datetime(2023, 11, 2, 2, 0, 0)
    
    print("Loading mfdataset...")
    ds = pyTMD.io.FES.open_mfdataset(model_files, group='z', format='netcdf')
    
    print(f"Interpolating to ({lat}, {lon})...")
    # xarray interp
    point_ds = ds.interp(lon=lon, lat=lat)
    
    constituents = list(ds.data_vars)
    amp = []
    ph = []
    
    for c in constituents:
        z = point_ds[c].values
        # z is usually a 0-d array
        z_val = complex(z)
        amp.append(np.abs(z_val))
        # pyTMD usually expects phase in degrees [0, 360]
        p = np.degrees(np.angle(z_val))
        ph.append(p % 360)
        
    amp = np.array(amp)
    ph = np.array(ph)
    
    print(f"Extracted {len(constituents)} constituents.")
    # Example: print M2
    if 'm2' in constituents:
        idx = constituents.index('m2')
        print(f"M2: amp={amp[idx]:.4f}, ph={ph[idx]:.2f}")
    
    print("Predicting...")
    ts = timescale.time.Timescale().from_datetime(dt)
    tide = pyTMD.predict.drift(ts.tide, amp, ph, constituents)
    
    print(f"Result: {tide[0]} m")

if __name__ == "__main__":
    verify_complex_decomposition()
