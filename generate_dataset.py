from pathlib import Path

import geopandas as gpd
import shapely

from zone_class_density import DU_PER_ACRE

# EPSG:2269 (Oregon North, feet) for all the measuring; reprojected to lon/lat
# for MapLibre on the way out.
CRS_FT = "EPSG:2269"
FEET_PER_MILE = 5280
SQFT_PER_ACRE = 43560
BAND_FT = 1320  # quarter mile
SIMPLIFY_TOLERANCE_FT = 20
OUTPUT = Path("public/data/transit_taxlots_dissolved.parquet")

print("loading data")
taxlots   = gpd.read_file("data/taxlots.geojson").to_crs(CRS_FT)
zoning    = gpd.read_file("data/zoning.geojson").to_crs(CRS_FT)
stations  = gpd.read_file("data/rail_transit_stations.geojson").to_crs(CRS_FT)
bus_stops = gpd.read_file("data/bus_stops.geojson").to_crs(CRS_FT)

existing_stations = stations[stations["STATUS"] == "Existing"]
freq_bus_stops = bus_stops[bus_stops["FREQUENT"] == "True"]
fx_stops = freq_bus_stops[
    (freq_bus_stops["RTE_DESC"] == "FX2-Division")
    | (freq_bus_stops["ROUTE"] == "57")
    | ((freq_bus_stops["ROUTE"] == "72") & freq_bus_stops["LOCATION"].str.contains("82nd", na=False))
]
stops_by_column = {
    "dist_bus_mi": freq_bus_stops,
    "dist_max_mi": existing_stations[existing_stations["TYPE"] == "MAX"],
    "dist_streetcar_mi": existing_stations[existing_stations["TYPE"] == "Street Car"],
    "dist_wes_mi": existing_stations[existing_stations["TYPE"] == "WES"],
    "dist_fx_mi": fx_stops,
}
distance_cols = list(stops_by_column)
zone_cols = ["ZONE_CLASS", "ZONEGEN_CL"]

print("joining data")
lots = taxlots[["geometry"]].sjoin(zoning[zone_cols + ["geometry"]]).drop(columns="index_right")
lots["du_per_acre"] = lots["ZONE_CLASS"].map(DU_PER_ACRE).round().astype("Int32")
lots["area_acres"] = lots.area / SQFT_PER_ACRE

for col, stops in stops_by_column.items():
    lots = lots.sjoin_nearest(stops[["geometry"]], how="left", distance_col=col).drop(
        columns="index_right"
    )
# A lot touching two zones, or equidistant from two stops, joins more than once.
lots = lots[~lots.index.duplicated()]

# Keep only lots within a mile of some stop.
near_transit = lots[distance_cols].min(axis=1) <= FEET_PER_MILE
print(f"  dropping {(~near_transit).sum()} lots over 1 mile from any stop")
lots = lots[near_transit]

# Band distances to quarter miles so lots can be grouped, capped at a mile.
# Floored, so a band's value is its near edge: a lot 0.6 mi out reads 0.5 and
# fails the worker's `distance < 0.5` test, as it should.
lots[distance_cols] = (
    (lots[distance_cols] // BAND_FT * BAND_FT).clip(upper=FEET_PER_MILE) / FEET_PER_MILE
)

print("dissolving by distance band and zone")
# Snapped to a 1 ft grid first so near-coincident lot edges merge cleanly.
lots.geometry = shapely.set_precision(lots.geometry.values, 1.0)
dissolved = lots.dissolve(
    by=distance_cols + zone_cols + ["du_per_acre"],
    aggfunc={"area_acres": "sum"},
    dropna=False,
).reset_index()
print(f"  {len(lots)} lots -> {len(dissolved)} polygons")

# Simplified after the union rather than lot by lot: per-lot simplifying leaves
# jagged holes wherever neighbouring lots no longer meet, and the union keeps
# all of their vertices, for about 2.3x the file size.
dissolved.geometry = dissolved.simplify(tolerance=SIMPLIFY_TOLERANCE_FT)

# MapLibre only takes lon/lat. Snap to a 1e-5 degree grid (about 3 ft here) to
# strip the high-entropy mantissa bits that keep the WKB from compressing.
dissolved = dissolved.to_crs("EPSG:4326")
dissolved.geometry = shapely.set_precision(dissolved.geometry.values, 1e-5)
dissolved = dissolved[~dissolved.geometry.is_empty]

# Order rows along a Hilbert curve so spatially adjacent polygons are adjacent
# in the file and their coordinates compress against each other.
dissolved = dissolved.iloc[dissolved.hilbert_distance().argsort()]

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
dissolved.to_parquet(
    OUTPUT,
    index=False,
    compression="zstd",
    compression_level=15,
    # A few dozen zone codes repeated across every row.
    use_dictionary=zone_cols,
)
print(f"saved {OUTPUT}")
