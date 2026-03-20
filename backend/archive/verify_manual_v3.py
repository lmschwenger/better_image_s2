import pyTMD.io.FES
import pyTMD.constituents
import timescale.time
import datetime
import os
import glob
import numpy as np

def verify_manual_nan_fix():
    data_dir = os.path.abspath("data/fes2022b")
    model_files = glob.glob(os.path.join(data_dir, "*_fes2022.nc"))
    
    # Point in the Pacific
    lat, lon = 0.0, 200.0
    dt = datetime.datetime(2023, 11, 2, 2, 0, 0)
    
    print("Loading mfdataset...")
    ds = pyTMD.io.FES.open_mfdataset(model_files, group='z', format='netcdf')
    
    target_x = lon % 360
    target_y = lat
    
    constituents = list(ds.data_vars)
    amp = []
    ph = []
    
    print(f"Interpolating {len(constituents)} constituents with NaN handling...")
    for c in constituents:
        # 1. Try linear interpolation (higher precision)
        re_arr = ds[c].real.interp(x=target_x, y=target_y).values
        im_arr = ds[c].imag.interp(x=target_x, y=target_y).values
        
        # 2. Fallback to nearest if linear is NaN (coastal areas)
        if np.isnan(re_arr) or np.isnan(im_arr):
            print(f"Constituent {c} is NaN with linear interp, trying nearest...")
            re_arr = ds[c].real.interp(x=target_x, y=target_y, method='nearest').values
            im_arr = ds[c].imag.interp(x=target_x, y=target_y, method='nearest').values
            
        z_val = complex(re_arr + 1j * im_arr)
        amp.append(np.abs(z_val))
        p = np.degrees(np.angle(z_val))
        ph.append(p % 360)
        
    amp = np.array(amp)
    ph = np.array(ph)
    
    # Final check for total NaN
    if np.any(np.isnan(amp)):
        print("Still have NaNs after nearest fallback!")
        return

    print("Calculating arguments...")
    ts = timescale.time.Timescale().from_datetime(dt)
    mjd = float(ts.tide) + 48622.0
    pu, pf, G = pyTMD.constituents.arguments(mjd, constituents)
    
    # Flatten/cast
    pu = np.array(pu, dtype=np.float64).flatten()
    pf = np.array(pf, dtype=np.float64).flatten()
    G = np.array(G, dtype=np.float64).flatten()
    
    # Manual sum
    phase = np.radians(G) + pu - np.radians(ph)
    tide_val = np.sum(amp * pf * np.cos(phase))
    
    print(f"Manual Result (Fixed): {tide_val:.4f} m")

if __name__ == "__main__":
    verify_manual_nan_fix()
