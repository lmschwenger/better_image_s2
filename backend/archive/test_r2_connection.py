import os
import logging
import fsspec
from api.tides import _get_fes_dataset, _FES_DATA_PATH

# Setup logging to see what's happening
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_r2_connection():
    print("--- FES2022b R2 Connection Test ---")
    print(f"Target Path: {_FES_DATA_PATH}")
    
    # 1. Check if S3 credentials are set
    keys = ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "S3_ENDPOINT_URL"]
    missing = [k for k in keys if not os.getenv(k)]
    
    if missing:
        print(f"WARNING: Missing environment variables: {', '.join(missing)}")
        print("Test may fail if these are required for your bucket.")
    
    # 2. Try to list files directly via fsspec
    try:
        print("\nAttempting to list files via fsspec...")
        fs, path = fsspec.core.url_to_fs(_FES_DATA_PATH)
        files = fs.ls(path)
        nc_files = [f for f in files if f.endswith("_fes2022.nc")]
        
        print(f"Successfully connected to bucket!")
        print(f"Total files found: {len(files)}")
        print(f"Constituent files found: {len(nc_files)}")
        
        if len(nc_files) == 34:
            print("SUCCESS: All 34 constituents detected.")
        else:
            print(f"HINT: Expected 34 constituents, found {len(nc_files)}. Check your folder structure.")
            
    except Exception as e:
        print(f"FAILED to connect to R2: {e}")
        return

    # 3. Try the actual dataset loading logic
    print("\nTriggering _get_fes_dataset() lazy-loader...")
    ds = _get_fes_dataset()
    
    if ds is not None:
        print("SUCCESS: Dataset loaded into xarray successfully!")
        print(f"Variables found: {list(ds.data_vars)[:5]}... (and others)")
    else:
        print("FAILED: Dataset loader returned None. Check logs above.")

if __name__ == "__main__":
    test_r2_connection()
