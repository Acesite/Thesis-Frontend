// ─── Constants ───────────────────────────────────────────────────────────────

export const BAGO_CITY_BOUNDS = [
  [122.7333, 10.4958],
  [123.5, 10.6333],
];

export const yieldUnitMap = {
  1: "sacks",
  2: "sacks",
  3: "bunches",
  4: "tons",
  5: "tons",
  6: "kg",
};

// ─── Formatting ───────────────────────────────────────────────────────────────

export const peso = (n) => {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return x.toLocaleString(undefined, { maximumFractionDigits: 0 });
};

export const formatNum = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
};

// ─── Farmgate helpers ─────────────────────────────────────────────────────────

export function readFarmgateDisplay(obj) {
  if (!obj) return null;

  const rawDisplay =
    obj.est_farmgate_value_display ??
    obj.estFarmgateValueDisplay ??
    obj.farmgate_value_display ??
    obj.farmgateValueDisplay ??
    null;

  if (typeof rawDisplay === "string" && rawDisplay.trim())
    return rawDisplay.trim();

  const low =
    obj.est_farmgate_value_low ??
    obj.estFarmgateValueLow ??
    obj.farmgate_value_low ??
    obj.farmgateValueLow ??
    null;

  const high =
    obj.est_farmgate_value_high ??
    obj.estFarmgateValueHigh ??
    obj.farmgate_value_high ??
    obj.farmgateValueHigh ??
    null;

  const lo = Number(low);
  const hi = Number(high);

  if (Number.isFinite(lo) && Number.isFinite(hi)) {
    return `₱${peso(lo)} – ₱${peso(hi)}`;
  }

  return null;
}

export function readFarmgateMid(obj) {
  if (!obj) return null;

  const low =
    obj.est_farmgate_value_low ??
    obj.estFarmgateValueLow ??
    obj.farmgate_value_low ??
    obj.farmgateValueLow ??
    null;

  const high =
    obj.est_farmgate_value_high ??
    obj.estFarmgateValueHigh ??
    obj.farmgate_value_high ??
    obj.farmgateValueHigh ??
    null;

  const lo = Number(low);
  const hi = Number(high);

  if (Number.isFinite(lo) && Number.isFinite(hi)) return (lo + hi) / 2;

  const display = readFarmgateDisplay(obj);
  if (!display) return null;

  const normalized = String(display)
    .replace(/\u00A0/g, " ")
    .replace(/[–—]/g, "-")
    .trim();

  const matches = normalized.match(/\d[\d,]*(?:\.\d+)?/g);
  if (!matches) return null;

  const nums = matches
    .map((s) => Number(s.replace(/,/g, "")))
    .filter((n) => Number.isFinite(n));

  if (!nums.length) return null;
  if (nums.length === 1) return nums[0];
  return (nums[0] + nums[nums.length - 1]) / 2;
}

export function midFromDisplay(display) {
  if (!display) return null;

  const normalized = String(display)
    .replace(/\u00A0/g, " ")
    .replace(/[–—]/g, "-")
    .replace(/₱/g, "")
    .trim();

  const matches = normalized.match(/\d[\d,]*(?:\.\d+)?/g);
  if (!matches) return null;

  const nums = matches
    .map((s) => Number(s.replace(/,/g, "")))
    .filter((n) => Number.isFinite(n));

  if (!nums.length) return null;
  if (nums.length === 1) return nums[0];
  return (nums[0] + nums[nums.length - 1]) / 2;
}

// ─── Crop status helpers ──────────────────────────────────────────────────────

export function isSoftDeletedCrop(crop) {
  if (!crop) return false;

  const yes = (v) =>
    v === 1 || v === "1" || v === true || v === "true" || v === "yes" || v === "y";

  const no = (v) =>
    v === 0 || v === "0" || v === false || v === "false" || v === "no";

  if (
    yes(crop.is_deleted) ||
    yes(crop.deleted) ||
    yes(crop.is_archived) ||
    yes(crop.archived) ||
    yes(crop.is_hidden) ||
    yes(crop.hidden)
  ) return true;

  if (no(crop.is_active) || no(crop.active)) return true;

  const checkStatusStr = (val) => {
    if (typeof val !== "string") return false;
    const s = val.toLowerCase();
    return ["deleted", "archived", "inactive", "removed"].includes(s);
  };

  if (checkStatusStr(crop.status) || checkStatusStr(crop.record_status)) return true;

  return false;
}

export function isCropHarvested(crop) {
  if (!crop) return false;

  const v =
    crop.is_harvested ?? crop.harvested ?? crop.isHarvested ?? crop.is_harvest ?? null;

  if (v === 1 || v === "1" || v === true || v === "true" || v === "yes" || v === "y")
    return true;

  const d =
    crop.harvested_date ?? crop.date_harvested ?? crop.harvest_date ?? crop.harvestDate ?? null;

  if (typeof d === "string" && d.trim() !== "") return true;

  return false;
}

// ─── Timeline filter ──────────────────────────────────────────────────────────

export function passesTimelineFilter(obj, mode, from, to) {
  const hasFilter = !!from || !!to;
  if (!hasFilter) return true;

  const props = obj.properties || obj;

  let raw;
  if (mode === "harvest") {
    raw = props.harvested_date || props.estimated_harvest;
  } else {
    raw = props.planted_date;
  }

  if (!raw) return false;

  const value = String(raw).slice(0, 7);
  if (from && value < from) return false;
  if (to && value > to) return false;
  return true;
}

// ─── GeoJSON builder ──────────────────────────────────────────────────────────

export function buildPolygonsFromCrops(crops = []) {
  const features = [];

  for (const crop of crops) {
    let coords = crop.coordinates;
    if (!coords) continue;

    if (typeof coords === "string") {
      try { coords = JSON.parse(coords); } catch { continue; }
    }
    if (!Array.isArray(coords) || coords.length < 3) continue;

    const first = coords[0];
    const last = coords[coords.length - 1];
    if (JSON.stringify(first) !== JSON.stringify(last)) coords = [...coords, first];

    const harvested =
      crop.is_harvested === 1 || crop.is_harvested === "1" || crop.is_harvested === true;

    const estDisplay = readFarmgateDisplay(crop);

    features.push({
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [coords] },
      properties: {
        id: crop.id,
        crop_name: crop.crop_name,
        variety_name: crop.variety_name,
        barangay: crop.barangay || crop.farmer_barangay,
        is_harvested: harvested ? 1 : 0,
        harvested_date: crop.harvested_date,
        planted_date: crop.planted_date,
        estimated_harvest: crop.estimated_harvest,
        estimated_hectares: crop.estimated_hectares,
        estimated_volume: crop.estimated_volume,
        est_farmgate_value_low: crop.est_farmgate_value_low ?? null,
        est_farmgate_value_high: crop.est_farmgate_value_high ?? null,
        est_farmgate_value_display: estDisplay ?? null,
      },
    });
  }

  return { type: "FeatureCollection", features };
}

// ─── Turf / geo helpers ───────────────────────────────────────────────────────

export function makeAccuracyCircle([lng, lat], accuracy) {
  const accNum = Number(accuracy);
  const safeAcc = Number.isFinite(accNum) ? accNum : 10;
  const radiusKm = Math.max(safeAcc, 10) / 1000;
  // NOTE: turf must be imported by the caller; this is a thin wrapper
  // We export the params so callers can use turf.circle directly
  return { center: [lng, lat], radiusKm };
}

export function isInsideBounds([lng, lat], bounds) {
  const [[minLng, minLat], [maxLng, maxLat]] = bounds;
  return lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat;
}

export function expandBoundsToIncludePoint(bounds, [lng, lat], pad = 0.05) {
  const [[minLng, minLat], [maxLng, maxLat]] = bounds;
  return [
    [Math.min(minLng, lng) - pad, Math.min(minLat, lat) - pad],
    [Math.max(maxLng, lng) + pad, Math.max(maxLat, lat) + pad],
  ];
}

// ─── Geolocation helpers ──────────────────────────────────────────────────────

export function explainGeoError(err) {
  if (!err) return "Unknown geolocation error.";
  switch (err.code) {
    case 1: return "Permission denied. Allow location for this site in your browser.";
    case 2: return "Position unavailable. Try near a window or check OS location services.";
    case 3: return "Timed out. Try again or increase the timeout.";
    default: return err.message || "Geolocation failed.";
  }
}

export function startGeoWatch(onPos, onErr, opts) {
  if (
    !("geolocation" in navigator) ||
    typeof navigator.geolocation.watchPosition !== "function"
  ) {
    onErr?.({ code: 2, message: "Geolocation watch not supported in this browser." });
    return () => {};
  }
  const id = navigator.geolocation.watchPosition(onPos, onErr, opts);
  return () => { try { navigator.geolocation?.clearWatch?.(id); } catch {} };
}

// ─── Device orientation ───────────────────────────────────────────────────────

export function extractHeadingFromEvent(e) {
  if (typeof e.webkitCompassHeading === "number") return e.webkitCompassHeading;
  if (typeof e.alpha === "number") return (360 - e.alpha + 360) % 360;
  return null;
}

export async function startCompass(onHeading) {
  try {
    if (
      typeof DeviceOrientationEvent !== "undefined" &&
      typeof DeviceOrientationEvent.requestPermission === "function"
    ) {
      const p = await DeviceOrientationEvent.requestPermission();
      if (p !== "granted") throw new Error("Compass permission denied.");
    }
  } catch {}
  const handler = (e) => {
    const h = extractHeadingFromEvent(e);
    if (h != null && !Number.isNaN(h)) onHeading(h);
  };
  const type =
    "ondeviceorientationabsolute" in window ? "deviceorientationabsolute" : "deviceorientation";
  window.addEventListener(type, handler, { passive: true });
  return () => window.removeEventListener(type, handler);
}

// ─── Barangay helpers ─────────────────────────────────────────────────────────

export function getBarangayName(props) {
  return props?.Barangay ?? props?.barangay ?? props?.NAME ?? props?.name ?? "";
}

export function strictDetectBarangayForGeometry(geom, barangaysFC, turf) {
  if (!geom || !barangaysFC?.features?.length) return null;
  if (!(geom.type === "Polygon" || geom.type === "MultiPolygon")) return null;

  const farmFeat = { type: "Feature", properties: {}, geometry: geom };
  const center = turf.centroid(farmFeat);
  const centerPt = center.geometry;

  for (const f of barangaysFC.features) {
    const g = f.geometry;
    if (!g) continue;
    if (!turf.booleanPointInPolygon(centerPt, g)) continue;

    const ring =
      geom.type === "Polygon"
        ? geom.coordinates?.[0] || []
        : geom.coordinates?.[0]?.[0] || [];

    const allInside = ring.every((coord) => {
      try { return turf.booleanPointInPolygon(turf.point(coord), g); }
      catch { return false; }
    });
    if (!allInside) continue;

    return {
      name: getBarangayName(f.properties || {}),
      feature: f,
      centroid: center.geometry.coordinates,
    };
  }
  return null;
}

// ─── CSS pulse styles ─────────────────────────────────────────────────────────

export const addPulseStylesOnce = () => {
  if (document.getElementById("pulse-style")) return;
  const style = document.createElement("style");
  style.id = "pulse-style";
  style.innerHTML = `
  @keyframes pulseRing {
    0%   { transform: translate(-50%, -50%) scale(0.8); opacity: .65; }
    70%  { transform: translate(-50%, -50%) scale(1.4); opacity: 0; }
    100% { transform: translate(-50%, -50%) scale(1.4); opacity: 0; }
  }
  .pulse-wrapper { position: relative; width: 0; height: 0; pointer-events: none; }
  .pulse-ring { position: absolute; left: 50%; top: 50%; width: 44px; height: 44px; border-radius: 9999px; background: rgba(16,185,129,0.35); box-shadow: 0 0 0 2px rgba(16,185,129,0.55) inset; animation: pulseRing 1.8s ease-out infinite; }
  .chip { font-family: system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif; font-size: 12px; font-weight: 600; padding: 4px 8px; background: #111827; color: #fff; border-radius: 9999px; box-shadow: 0 1px 3px rgba(0,0,0,0.25); transform: translate(-50%, -8px); white-space: nowrap; }
  `;
  document.head.appendChild(style);
};