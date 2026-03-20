import sys
import os
import datetime

# Add the parent directory to sys.path to allow importing from api.tides
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__))))

from api.tides import estimate_tide_fes2022

def test_integration():
    # Sydney
    lat, lon = -33.8688, 151.2093
    time_str = "2023-11-02 02:00:00"
    
    print(f"Testing real FES2022 integration for {lat}, {lon}...")
    
    try:
        tide_level = estimate_tide_fes2022(lat, lon, time_str)
        print(f"Final Tide Level: {tide_level} m")
        
        # Test cache/repeatability
        tide_level_2 = estimate_tide_fes2022(lat, lon, time_str)
        print(f"Second call (cached): {tide_level_2} m")
        
        if tide_level == tide_level_2:
            print("Consistency check passed.")
        else:
            print("Warning: Non-deterministic result!")

    except Exception as e:
        print(f"Integration test failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_integration()
