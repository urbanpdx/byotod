# BYOTOD

There are two components to this repo:

- A Python data pipeline that pre-processes public GIS data into a compressed parquet data file
- A React.js frontend that renders the BYOTOD interface

## The Data

To generate the data file for BYOTOD, you will need `uv` and Python 3.12 installed. Run `make` to download the source data and generate the data file. Simplifying and disssolving the dataset takes at least a minute or two depending on your hardware.

BYOTOD uses a couple of Metro open datasets:

- [Taxlots (Public)](https://rlisdiscovery.oregonmetro.gov/datasets/b3cabe5845ec47eab61c54e0c631313c/about)
- [Zoning](https://rlisdiscovery.oregonmetro.gov/datasets/drcMetro::zoning/about)
- [Rail Transit Stations](https://rlisdiscovery.oregonmetro.gov/datasets/drcMetro::rail-transit-stations/about)
- [Rail Transit](https://rlisdiscovery.oregonmetro.gov/datasets/drcMetro::rail-transit/about)
- [TriMet Bus System (routes)](https://rlisdiscovery.oregonmetro.gov/datasets/drcMetro::trimet-bus-system-routes/about)
- [TriMet Bus System (stops)](https://rlisdiscovery.oregonmetro.gov/datasets/drcMetro::trimet-bus-system-stops/about)

The algorithm to generate the data is pretty simple:

1. Join the taxlots dataset with the zoning dataset to get a Metro zone classification for each taxlot
2. Compute how far each taxlot is from the nearest streetcar, bus, MAX, WES, and FX line stop. This saves the frontend from having to do a costly operation in real-time while the user is adjusting settings.
   1. For upcoming FX lines on TV highway and 82nd avenue, we use the existing bus line on that route (the 57 and 72, respectively)
3. Now, you have a dataset that you could load into a frontend application and do all the calculations BYOTOD needs. But we also apply a couple techniques to optimize the file size so it's fast to download on the web:
   1. Round the stop distance fields to the nearest quarter mile (this reduces the cardinality of the dataset by a lot, which comes in handy for a later step)
   2. Drop taxlots that are more than a mile from any transit stop
   3. `simplify` the geometry of the data, which reduces redundant vertices in complex shapes
   4. `dissolve` the dataset, so that adjacent lots with the same transit stop distances and zoning are combined into the same shape (this does not work _unless_ you round the distance fields)
   5. [Hilbert sort](https://en.wikipedia.org/wiki/Hilbert_curve) the data so that physically adjacent lots are next to each other in the dataset
4. Finally, we use parquet because it makes for smaller file sizes than geojson

## The frontend

BYOTOD's frontend uses React, originally via create react app. In production it is deployed via Netlify. To start it locally, run `npm run start`.

For hardware accelerated map rendering we use MapLibre GL JS, which does most of the hard work.
