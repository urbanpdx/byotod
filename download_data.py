"""Download the RLIS source datasets that generate_dataset.py reads into data/.

The ArcGIS download code is copied from ../data/scripts/download.py.
"""

import json
import random
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests

DATA_DIR = Path(__file__).parent / "data"

# Portal items, by RLIS Discovery item ID. Each has a single layer, so it saves
# as data/<slugified name>.geojson.
ITEMS = [
    # Taxlots (Public): lots only. The downloadable taxlots zip also carries
    # streets, rights of way, railroads and water as polygons, under a dozen
    # different TLID spellings, which show up on the map as street-shaped lots.
    {"name": "taxlots", "item_id": "b3cabe5845ec47eab61c54e0c631313c"},
    {"name": "zoning", "item_id": "f7eb5e81c0b947ca96d62af048a54b11"},
    {"name": "rail_transit_stations", "item_id": "da48cbde1e314e0686d31c97965a2e21"},
    {"name": "rail_transit", "item_id": "36542b1c7e9d4c9584229ffd9f22500e"},
    {"name": "bus_routes", "item_id": "5460fbcadcc8408cadd9083b7e60a04a"},
    {"name": "bus_stops", "item_id": "2bd6d9d121c04ded9cf3cc13df97db22"},
]


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")


# requests' `timeout` is a connect timeout plus a *gap-between-bytes* read
# timeout, not a bound on the whole call: a server dribbling out a large page
# one chunk every few seconds resets it forever. REQUEST_DEADLINE is the real
# ceiling, covering the body read and every retry.
REQUEST_TIMEOUT = (10, 30)
REQUEST_DEADLINE = 180
MAX_RETRIES = 8
MAX_BACKOFF = 20
MAX_WORKERS = 8
DEFAULT_PAGE_SIZE = 1000

# Hub serves a prebuilt export of a whole layer. When it has to build one first
# it answers Pending for a while, so poll rather than treating that as failure.
HUB_DOWNLOAD_API = "https://hub.arcgis.com/api/download/v1/items"
HUB_BUILD_DEADLINE = 600
HUB_POLL_INTERVAL = 5


def retry_after_seconds(header: str | None) -> float | None:
    """Seconds from a Retry-After header. The spec also allows an HTTP date,
    which these servers don't send, so anything non-numeric falls back to
    exponential backoff."""
    try:
        return max(0.0, float(header))
    except (TypeError, ValueError):
        return None


def request_json(url: str, params: dict) -> dict:
    """Under a burst of paged queries these servers answer with a 503 or an HTML
    error page about as often as with JSON, so back off and ask again."""
    deadline = time.monotonic() + REQUEST_DEADLINE
    for attempt in range(MAX_RETRIES):
        retry_after = None
        try:
            with requests.get(url, params=params, timeout=REQUEST_TIMEOUT,
                              stream=True) as response:
                if response.status_code in (429, 503):
                    retry_after = retry_after_seconds(
                        response.headers.get("Retry-After")
                    )
                response.raise_for_status()
                body = bytearray()
                for chunk in response.iter_content(1 << 16):
                    body += chunk
                    if time.monotonic() > deadline:
                        raise requests.RequestException(
                            f"response still arriving after {REQUEST_DEADLINE}s"
                        )
            payload = json.loads(body)
            # ArcGIS reports throttling and server faults as a 200 carrying an
            # error object, which raise_for_status sails straight past.
            if "error" in payload:
                raise requests.RequestException(str(payload["error"]))
            return payload
        except (requests.RequestException, ValueError):
            if attempt == MAX_RETRIES - 1:
                raise
            delay = retry_after if retry_after is not None else min(2 ** attempt, MAX_BACKOFF)
            # Jitter, so concurrent workers stop re-firing as a single burst.
            delay *= 0.5 + random.random()
            if time.monotonic() + delay > deadline:
                raise
            time.sleep(delay)


def download_arcgis(entry: dict, dest: Path) -> None:
    base_url = entry["url"].rstrip("/")
    where = entry.get("where", "1=1")
    out_fields = entry.get("out_fields", "*")

    total = request_json(f"{base_url}/query", {
        "where": where,
        "returnCountOnly": "true",
        "f": "json",
    })["count"]
    meta = request_json(base_url, {"f": "json"})
    page_size = meta.get("maxRecordCount") or DEFAULT_PAGE_SIZE
    # Offset paging is only coherent against a fixed sort. Without one the
    # server may order pages differently as rows are added underneath, and a
    # continually-updated layer quietly loses its most recent records.
    order_by = meta.get("objectIdField") or "OBJECTID"

    def fetch_page(offset):
        return request_json(f"{base_url}/query", {
            "where": where,
            "outFields": out_fields,
            "orderByFields": order_by,
            "resultOffset": offset,
            "resultRecordCount": page_size,
            "f": "geojson",
        }).get("features", [])

    if total <= page_size:
        print(f"  {total} features (single page)")
        features = fetch_page(0)
    else:
        n_pages = -(-total // page_size)
        print(f"  {total} features, {page_size} per page — fetching {n_pages} pages in parallel...")
        pages = {}
        # Not a `with` block: its shutdown waits for every queued page, so one
        # failed page would sit through the rest of the queue's retry budget
        # before surfacing the traceback.
        executor = ThreadPoolExecutor(max_workers=MAX_WORKERS)
        try:
            futures = {executor.submit(fetch_page, o): o
                       for o in range(0, total, page_size)}
            for done, future in enumerate(as_completed(futures), 1):
                pages[futures[future]] = future.result()
                print(f"\r  {done}/{n_pages} pages", end="", flush=True)
            print()
        finally:
            executor.shutdown(wait=False, cancel_futures=True)

        features = [f for _, batch in sorted(pages.items()) for f in batch]

    geojson = {
        "type": "FeatureCollection",
        "features": features,
    }
    dest.write_text(json.dumps(geojson), encoding="utf-8")


def write_stream(response, dest: Path) -> None:
    """Streamed to disk rather than read whole: a bulk layer export runs to
    hundreds of MB, and buffering one in memory reads as a hang long before it
    reads as an error."""
    with open(dest, "wb") as f:
        for chunk in response.iter_content(1 << 20):
            f.write(chunk)


def stream_to_file(url: str, dest: Path) -> None:
    with requests.get(url, timeout=REQUEST_TIMEOUT, stream=True) as response:
        response.raise_for_status()
        write_stream(response, dest)


def item_layers(item_id: str, portal: str) -> tuple:
    """(service_url, [(layer_id, layer_name), ...]) for a portal item.

    Two shapes turn up here. A *hosted* feature service on ArcGIS Online
    enumerates its own layers from 0. An item that merely *references* another
    server carries the layer ID in its own URL — `.../MapServer/1415` — and
    that trailing ID, not a 0-based index, is what identifies the layer
    downstream."""
    meta = request_json(f"{portal}/sharing/rest/content/items/{item_id}", {"f": "json"})
    url = (meta.get("url") or "").rstrip("/")
    if not url:
        raise ValueError(f"Item {item_id} has no service URL")

    trailing = re.search(r"/(\d+)$", url)
    if trailing:
        return url.rsplit("/", 1)[0], [(int(trailing.group(1)), meta.get("title", ""))]

    layers = request_json(f"{url}/layers", {"f": "json"}).get("layers", [])
    if not layers:
        raise ValueError(f"Item {item_id} has no feature layers")
    return url, [(l["id"], l.get("name", str(l["id"]))) for l in layers]


def download_hub_bulk(item_id: str, layer_id: int, dest: Path) -> bool:
    """Fetch a whole layer as one prebuilt file — what the web UI's download
    button does — instead of walking it a page at a time. Hub may need to build
    the export first, hence the poll.

    Returns False when Hub can't produce a file for this layer, leaving the
    caller to fall back to paging."""
    deadline = time.monotonic() + HUB_BUILD_DEADLINE
    while time.monotonic() < deadline:
        response = requests.get(
            f"{HUB_DOWNLOAD_API}/{item_id}/geojson",
            params={"redirect": "false", "layers": layer_id, "spatialRefId": 4326},
            timeout=REQUEST_TIMEOUT,
        )
        if response.status_code >= 400:
            return False
        info = response.json()
        status = info.get("status")
        if status == "Completed":
            stream_to_file(info["resultUrl"], dest)
            return True
        if status not in ("Pending", "InProgress"):
            return False
        time.sleep(HUB_POLL_INTERVAL)
    return False


def download_arcgis_item(entry: dict, dest_dir: Path) -> list:
    item_id = entry["item_id"]
    portal = entry.get("portal", "https://www.arcgis.com")
    service_url, layers = item_layers(item_id, portal)

    slug = slugify(entry["name"])
    out_files = []
    for layer_id, layer_name in layers:
        if len(layers) == 1:
            dest = dest_dir / f"{slug}.geojson"
        else:
            dest = dest_dir / f"{slug}_{slugify(layer_name)}.geojson"

        # A `where` filter has to be applied server-side, and the bulk export is
        # always the whole layer — so those entries still page.
        if not entry.get("where") and download_hub_bulk(item_id, layer_id, dest):
            print(f"  layer {layer_id}: bulk download, {dest.stat().st_size / 1e6:.1f} MB")
        else:
            print(f"  layer {layer_id}: no bulk export available, paging")
            download_arcgis({**entry, "url": f"{service_url}/{layer_id}"}, dest)
        out_files.append(dest)

    return out_files


if __name__ == "__main__":
    DATA_DIR.mkdir(exist_ok=True)
    for entry in ITEMS:
        print(f"Downloading '{entry['name']}'...")
        for path in download_arcgis_item(entry, DATA_DIR):
            print(f"  Saved to {path.name}")
