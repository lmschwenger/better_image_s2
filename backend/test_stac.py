import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from api.stac_client import search_sentinel2_scenes

test_geojson = {
    "type": "Polygon",
    "coordinates": [[
        [-81.9, 24.4],
        [-81.7, 24.4],
        [-81.7, 24.6],
        [-81.9, 24.6],
        [-81.9, 24.4]
    ]]
}

try:
    results = search_sentinel2_scenes(test_geojson, "2023-10-01", "2023-10-31", max_items=2)
    print("Found items:", len(results))
    for r in results:
        print(f"{r['id']} - Cloud: {r['cloud_cover_aoi']} - Date: {r['datetime']}")
except Exception as e:
    print(f"Error occurred: {e}")
