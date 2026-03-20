import urllib.request
import json

# Use the ID that worked before
item_id = "S2B_MSIL2A_20240104T094319_R036_T33SVV_20240104T130832"
url = f"https://planetarycomputer.microsoft.com/api/data/v1/item/tilejson.json?collection=sentinel-2-l2a&item={item_id}&assets=visual"

print(f"Fetching: {url}")

try:
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=10) as res:
        data = json.loads(res.read())
        print(json.dumps(data, indent=2))
except Exception as e:
    print(f"Error: {e}")
