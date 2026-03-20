import sys
import os
from pystac_client import Client
import json

MPC_STAC_URL = "https://planetarycomputer.microsoft.com/api/stac/v1"

try:
    client = Client.open(MPC_STAC_URL)
    search = client.search(
        collections=["sentinel-2-l2a"],
        max_items=1
    )
    items = list(search.items())
    if items:
        item = items[0]
        preview_asset = item.assets.get("rendered_preview")
        if preview_asset:
            print(json.dumps(preview_asset.to_dict(), indent=2))
        else:
            print("No rendered_preview asset found.")
    else:
        print("No items found.")
except Exception as e:
    print(f"Error: {e}")
