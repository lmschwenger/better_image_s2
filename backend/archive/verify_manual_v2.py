import pyTMD.io.FES
import pyTMD.constituents
import timescale.time
import datetime
import os
import glob
import numpy as np

def verify_manual_v2():
    data_dir = os.path.abspath("data/fes2022b")
    model_files = glob.glob(os.path.join(data_dir, "*_fes2022.nc"))
    
    lat, lon = -33.8688, 151.2093
    dt = datetime.datetime(2023, 11, 2, 2, 0, 0)
    
    print("Loading mfdataset...")
    ds = pyTMD.io.FES.open_mfdataset(model_files, group='z', format='netcdf')
    
    # Coordinates in FES2022b
    # x: 0-360, y: -90-90
    target_x = lon % 360
    target_y = lat
    
    constituents = list(ds.data_vars)
    amp = []
    ph = []
    
    print(f"Interpolating {len(constituents)} constituents separately...")
    for c in constituents:
        # Interpolate real and imag separately to avoid complex64 xarray bug
        # This is very robust
        re = ds[c].real.interp(x=target_x, y=target_y).values
        im = ds[c].imag.interp(x=target_x, y=target_y).values
        
        z_val = complex(re + 1j * im)
        amp.append(np.abs(z_val))
        p = np.degrees(np.angle(z_val))
        ph.append(p % 360)
        
    amp = np.array(amp)
    ph = np.array(ph)
    
    print("Calculating arguments...")
    ts = timescale.time.Timescale().from_datetime(dt)
    mjd = float(ts.tide) + 48622.0
    
    # pu (radians), pf (unitless), G (degrees)
    pu, pf, G = pyTMD.constituents.arguments(mjd, constituents)
    
    # Flatten/cast to float64
    pu = np.array(pu, dtype=np.float64).flatten()
    pf = np.array(pf, dtype=np.float64).flatten()
    G = np.array(G, dtype=np.float64).flatten()
    
    # Manual sum
    phase = np.radians(G) + pu - np.radians(ph)
    tide_val = np.sum(amp * pf * np.cos(phase))
    
    print(f"Manual Result v2: {tide_val:.4f} m")

if __name__ == "__main__":
    verify_manual_v2()
Line:1
