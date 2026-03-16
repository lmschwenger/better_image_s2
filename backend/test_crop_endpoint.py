import urllib.request
import urllib.error

# Testing the new endpoint format implemented in stac_client.py
item_id = "S2C_MSIL2A_20260316T110821_R137_T38XMN_20260316T143609"
bbox = "54.0,24.0,54.1,24.1"

# The new URL pattern
url = f"https://planetarycomputer.microsoft.com/api/data/v1/item/bbox/{bbox}.png?collection=sentinel-2-l2a&item={item_id}&assets=visual"

print(f"Testing URL: {url}")

try:
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=10) as res:
        print(f"Status: {res.status}")
        print(f"Content-Type: {res.getheader('Content-Type')}")
        if res.status == 200:
            print("SUCCESS: Endpoint returned 200 OK and an image.")
except urllib.error.HTTPError as e:
    print(f"HTTP Error: {e.code} - {e.reason}")
    print(e.read().decode())
except Exception as e:
    print(f"Error: {e}")
