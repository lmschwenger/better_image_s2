import urllib.request
import json
import traceback

req = urllib.request.Request('https://planetarycomputer.microsoft.com/api/stac/v1/search?collections=sentinel-2-l2a&limit=1', headers={'User-Agent': 'Mozilla/5.0'})
data = json.loads(urllib.request.urlopen(req).read())
item = data['features'][0]
item_id = item['id']
bbox = item['bbox']

# Try /item/crop
crop_url = f"https://planetarycomputer.microsoft.com/api/data/v1/item/crop/{bbox[0]},{bbox[1]},{bbox[2]},{bbox[3]}.png?collection=sentinel-2-l2a&item={item_id}&assets=visual&asset_bidx=visual%7C1%2C2%2C3"
print("Testing:", crop_url)

try:
    res = urllib.request.urlopen(urllib.request.Request(crop_url))
    print("Success! Code:", res.getcode())
except Exception as e:
    print("Failed /item/crop:", e)
    if hasattr(e, 'read'):
        print(e.read().decode())

# Try /item/preview.png with bbox parameter
crop_url2 = f"https://planetarycomputer.microsoft.com/api/data/v1/item/preview.png?collection=sentinel-2-l2a&item={item_id}&bbox={bbox[0]},{bbox[1]},{bbox[2]},{bbox[3]}&assets=visual"
print("Testing:", crop_url2)

try:
    res = urllib.request.urlopen(urllib.request.Request(crop_url2))
    print("Success! Code:", res.getcode())
except Exception as e:
    print("Failed /item/preview.png with bbox:", e)
    if hasattr(e, 'read'):
        print(e.read().decode())
