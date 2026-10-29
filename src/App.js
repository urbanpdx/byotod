import "./App.css";
import { Map, Source, Layer } from "@vis.gl/react-maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useState, useRef } from "react";
import * as turf from "@turf/turf";
import ControlPanel from "./ControlPanel";
import { fetchJson } from "./fetchData";
import DuAcreModal from "./Modal";

function fetchGeo(url) {
  return fetchJson(url).catch((err) =>
    console.error("Could not load data", err),
  );
}
let geoBaseUrl = "";
if (!process.env.NODE_ENV || process.env.NODE_ENV === "development") {
  geoBaseUrl = "";
} else {
  geoBaseUrl = "https://pub-1f4604db6e3946ebbf68c33db047e266.r2.dev";
}

const TAXLOTS_URL = `${geoBaseUrl}/data/transit_taxlots_dissolved.parquet`;

// Some features have compound TYPE values like "BUS, Street Car" or "MAX/Street Car".
const matchesType = (featureType, types) =>
  featureType.split(/[,/]/).some((t) => types.includes(t.trim()));

export const RULE_COLORS = ["#1fc29f", "#5c8de0", "#9b5ce0", "#5ce07a"];

function App() {
  const [transitLines, setTransitLines] = useState(null);
  const [rawStops, setRawStops] = useState(null);
  const [isOpen, changeModalState] = useState(false);
  const [busRoutes, setBusRoutes] = useState(null);
  const [netCapacity, setNetCapacity] = useState(null);

  const [rules, setRules] = useState([
    {
      types: ["MAX", "Street Car", "WES", "FX"],
      industrial: false,
      sfr: true,
      minDensity: 60,
      distance: 0.5,
      id: window.crypto.randomUUID(),
    },
  ]);

  useEffect(() => {
    fetchGeo(`${geoBaseUrl}/data/transit_lines.geojson`).then(setTransitLines);
  }, []);

  useEffect(() => {
    fetchGeo(`${geoBaseUrl}/data/transit_stops.geojson`).then(setRawStops);
  }, []);

  useEffect(() => {
    fetchGeo(`${geoBaseUrl}/data/bus_routes.geojson`).then((json) => {
      const frequent = json.features.filter(
        (feature) => feature.properties.FREQUENT === "True",
      );
      setBusRoutes(turf.featureCollection(frequent));
    });
  }, []);

  const lines = useMemo(() => {
    if (!transitLines) return null;
    return {
      type: "FeatureCollection",
      features: transitLines.features.filter(
        (f) =>
          matchesType(f.properties.TYPE, rules.map((r) => r.types).flat()) &&
          f.properties.STATUS === "Existing",
      ),
    };
  }, [transitLines, rules]);

  const stops = useMemo(() => {
    if (!rawStops) return null;
    return turf.featureCollection(
      rawStops.features.filter((f) =>
        matchesType(f.properties.TYPE, rules.map((r) => r.types).flat()),
      ),
    );
  }, [rawStops, rules]);

  const fillColorExpression = useMemo(() => {
    const matchArgs = rules.flatMap((rule, i) => [
      rule.id,
      RULE_COLORS[i % RULE_COLORS.length],
    ]);
    return ["match", ["feature-state", "ruleId"], ...matchArgs, "#cccccc"];
  }, [rules]);

  const [taxlots, setTaxlots] = useState(null);

  const workerRef = useRef(null);
  const mapRef = useRef(null); // to reach the maplibre instance

  useEffect(() => {
    const worker = new Worker(new URL("./taxlotWorker.js", import.meta.url), {
      type: "module",
    });
    worker.onmessage = ({ data }) => {
      if (data.type === "DATA") {
        // Populate the source once and keep the reference stable so rule
        // changes never re-tile the geometry.
        setTaxlots((prev) => prev ?? turf.featureCollection(data.features));
      }
      if (data.type === "EVALUATED") {
        setNetCapacity(data.netCapacity);
        const map = mapRef.current?.getMap();
        if (!map) return;
        const apply = () => {
          map.removeFeatureState({ source: "taxlots" });
          for (const { id, ruleId } of data.data) {
            map.setFeatureState({ source: "taxlots", id }, { ruleId });
          }
        };
        // setFeatureState is a no-op until the source has loaded.
        if (map.getSource("taxlots") && map.isSourceLoaded("taxlots")) {
          apply();
        } else {
          map.once("idle", apply);
        }
      }
    };
    workerRef.current = worker;

    // Kick off the parse immediately so it overlaps the basemap load.
    worker.postMessage({ type: "LOAD", taxlotsUrl: TAXLOTS_URL });

    return () => worker.terminate();
  }, []);

  useEffect(() => {
    if (stops == null) return;

    workerRef.current.postMessage({
      type: "EVALUATE",
      taxlotsUrl: TAXLOTS_URL,
      rules,
    });
  }, [stops, rules]);

  return (
    <div className="App">
      <Map
        ref={mapRef}
        initialViewState={{
          latitude: 45.52,
          longitude: -122.68,
          zoom: 12,
        }}
        style={{ width: "100%", height: "100dvh" }}
        mapStyle="https://tiles.openfreemap.org/styles/positron"
      >
        {taxlots ? (
          <Source
            id="taxlots"
            type="geojson"
            data={taxlots}
            tolerance={0.5}
            buffer={64}
          >
            <Layer
              type="fill"
              paint={{
                "fill-color": fillColorExpression,
                "fill-opacity": [
                  "case",
                  ["to-boolean", ["feature-state", "ruleId"]],
                  0.5,
                  0,
                ],
              }}
            />
          </Source>
        ) : null}
        {busRoutes ? (
          <Source type="geojson" data={busRoutes}>
            <Layer
              type="line"
              paint={{
                "line-color": "#949494",
                "line-width": 1,
              }}
            />
          </Source>
        ) : null}
        {lines ? (
          <Source type="geojson" data={lines}>
            <Layer
              type="line"
              paint={{
                "line-color": "#000",
                "line-width": 4,
              }}
            />
          </Source>
        ) : null}
        {stops ? (
          <Source type="geojson" data={stops}>
            <Layer
              type="circle"
              paint={{
                "circle-radius": 4,
                "circle-color": "white",
                "circle-stroke-color": "black",
                "circle-stroke-width": 1,
              }}
            />
          </Source>
        ) : null}
      </Map>
      <ControlPanel
        openModal={() => changeModalState(true)}
        rules={rules}
        updateRules={setRules}
      />
      <DuAcreModal
        closeModal={() => changeModalState(false)}
        isOpen={isOpen}
      ></DuAcreModal>
      {netCapacity && (
        <div className="net-capacity">
          <p>
            <b>New Zoned Capacity: </b>+
            {Math.round(netCapacity).toLocaleString()} homes
          </p>
        </div>
      )}
    </div>
  );
}

export default App;
