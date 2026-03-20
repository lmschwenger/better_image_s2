import pyTMD.io.FES
import pyTMD.constituents
import timescale.time
import datetime
import os
import glob
import numpy as np

def verify_manual():
    data_dir = os.path.abspath("data/fes2022b")
    model_files = glob.glob(os.path.join(data_dir, "*_fes2022.nc"))
    
    lat, lon = -33.8688, 151.2093
    dt = datetime.datetime(2023, 11, 2, 2, 0, 0)
    
    print("Loading mfdataset...")
    ds = pyTMD.io.FES.open_mfdataset(model_files, group='z', format='netcdf')
    
    print(f"Interpolating to ({lat}, {lon})...")
    point_ds = ds.interp(x=(lon % 360), y=lat)
    
    constituents = list(ds.data_vars)
    amp = []
    ph = []
    for c in constituents:
        z = complex(point_ds[c].values)
        amp.append(np.abs(z))
        p = np.degrees(np.angle(z))
        ph.append(p % 360)
        
    amp = np.array(amp)
    ph = np.array(ph)
    
    print("Calculating arguments...")
    ts = timescale.time.Timescale().from_datetime(dt)
    mjd = float(ts.tide) + 48622.0
    
    # pu (radians), pf (unitless), G (degrees)
    pu, pf, G = pyTMD.constituents.arguments(mjd, constituents)
    
    # Flatten inputs
    pu = pu.flatten()
    pf = pf.flatten()
    G = G.flatten()
    
    # Manual sum
    phase = np.radians(G) + pu - np.radians(ph)
    tide_val = np.sum(amp * pf * np.cos(phase))
    
    print(f"Manual Result: {tide_val:.4f} m")

if __name__ == "__main__":
    verify_manual()
