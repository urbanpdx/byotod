import { zoneInfo } from "./zoneInfo";
import { fetchParquet } from "./fetchData";

const transitTypeToField = {
  MAX: "dist_max_mi",
  "Street Car": "dist_streetcar_mi",
  BUS: "dist_bus_mi",
  WES: "dist_wes_mi",
  FX: "dist_fx_mi",
};

let featuresPromise = null;

function loadFeatures(url) {
  featuresPromise ??= fetchParquet(url).then((rows) =>
    rows.map(({ geometry, ...properties }, index) => ({
      type: "Feature",
      id: index,
      properties: { ...properties },
      geometry,
    })),
  );
  return featuresPromise;
}

onmessage = async ({ data }) => {
  if (data.type === "LOAD") {
    // Phase 1: parse the geometry and hand it to the map source. Fired once
    // on mount so the parse overlaps with the basemap load.
    const features = await loadFeatures(data.taxlotsUrl);
    postMessage({ type: "DATA", features });
    return;
  }

  // Phase 2: evaluate the rules against the (memoized) features and return
  // only the per-feature match list — the geometry never crosses again.
  const features = await loadFeatures(data.taxlotsUrl);
  let rules = data.rules.sort((a, b) => b.minDensity - a.minDensity);
  let netCapacity = 0;

  const lowDensityZones = {};
  const lowDensityZoneClasses = {};
  rules.forEach((rule) => {
    lowDensityZoneClasses[rule.id] = [];
    if (rule.industrial) {
      lowDensityZoneClasses[rule.id].push("IND");
    }
    if (rule.sfr) {
      lowDensityZoneClasses[rule.id].push("SFR");
    }
    lowDensityZones[rule.id] = Object.entries(zoneInfo)
      .filter(([zone, { maxDensity }]) => maxDensity <= rule.minDensity)
      .map(([zone]) => zone);
  });

  const filtered = [];
  for (const feature of features) {
    let netDensity = 0;
    for (const rule of rules) {
      if (
        !lowDensityZoneClasses[rule.id].includes(
          feature.properties.ZONEGEN_CL,
        ) &&
        !lowDensityZones[rule.id].includes(feature.properties.ZONE_CLASS)
      ) {
        continue;
      }

      const stopDistance = Math.min(
        ...rule.types.map(
          (type) => feature.properties[transitTypeToField[type]],
        ),
      );
      if (stopDistance < rule.distance) {
        if (feature.properties.ZONEGEN_CL === "SFR") {
          netDensity = rule.minDensity - 10;
        } else if (
          Object.keys(zoneInfo).includes(feature.properties.ZONE_CLASS)
        ) {
          netDensity =
            rule.minDensity -
            zoneInfo[feature.properties.ZONE_CLASS].maxDensity;
        } else {
          netDensity = rule.minDensity;
        }

        filtered.push({ id: feature.id, ruleId: rule.id });
        netCapacity += netDensity * feature.properties.area_acres;

        break;
      }
    }
  }

  postMessage({ type: "EVALUATED", data: filtered, done: true, netCapacity });
};
