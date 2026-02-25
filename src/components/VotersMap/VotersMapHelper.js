// src/components/AdminDAR/darMapHelpers.js
import * as turf from "@turf/turf";

/* ---------- tiny CSS for pulsing halo + chip ---------- */
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
    .pulse-ring { position: absolute; left: 50%; top: 50%; width: 44px; height: 44px; border-radius: 9999px;
      background: rgba(59,130,246,0.25); box-shadow: 0 0 0 2px rgba(59,130,246,0.45) inset;
      animation: pulseRing 1.8s ease-out infinite;
    }
    .chip { font-family: system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif; font-size: 12px; font-weight: 700;
      padding: 4px 8px; background: #111827; color: #fff; border-radius: 9999px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.25); transform: translate(-50%, -8px); white-space: nowrap;
    }
  `;
  document.head.appendChild(style);
};

/* ---------- helper: soft delete / inactive ---------- */
export function isSoftDeletedDar(rec) {
  if (!rec) return false;
  const yes = (v) =>
    v === 1 || v === "1" || v === true || v === "true" || v === "yes" || v === "y";
  const no = (v) =>
    v === 0 || v === "0" || v === false || v === "false" || v === "no";

  if (
    yes(rec.is_deleted) ||
    yes(rec.deleted) ||
    yes(rec.is_archived) ||
    yes(rec.archived) ||
    yes(rec.is_hidden) ||
    yes(rec.hidden)
  )
    return true;

  if (no(rec.is_active) || no(rec.active)) return true;

  const checkStatusStr = (val) => {
    if (typeof val !== "string") return false;
    const s = val.toLowerCase();
    return ["deleted", "archived", "inactive", "removed"].includes(s);
  };
  if (checkStatusStr(rec.status) || checkStatusStr(rec.record_status)) return true;

  return false;
}

/* ---------- DAR status helper ---------- */
export function getDarStatus(rec) {
  const raw = rec?.dar_status ?? rec?.status ?? rec?.award_status ?? "unknown";
  return String(raw || "unknown").toLowerCase();
}

export function statusColor(status) {
  if (status === "awarded" || status === "approved") return "#10B981"; // green
  if (status === "pending") return "#F59E0B"; // amber
  if (status === "cancelled" || status === "revoked") return "#EF4444"; // red
  return "#3B82F6"; // blue
}

/* ---------- ID helper (dar table vs arb table) ---------- */
export function getDarId(rec) {
  return rec.id ?? rec.arb_id ?? rec.dar_id ?? rec.cloa_id ?? rec.cloaNo ?? null;
}

/* ---------- coords helper (polygon or lat/lng fallback) ---------- */
export function getRecordPolygonCoords(rec) {
  // 1) Try polygon-like fields from DB
  let coords = rec.coordinates ?? rec.polygon ?? rec.boundary_coords ?? null;

  if (typeof coords === "string") {
    try {
      coords = JSON.parse(coords);
    } catch {
      coords = null;
    }
  }

  if (Array.isArray(coords) && coords.length >= 3) {
    return coords;
  }

  // 2) Fallback: build a tiny square polygon around lat/lng, if present
  const lng = Number(rec.longitude ?? rec.lng);
  const lat = Number(rec.latitude ?? rec.lat);

  if (Number.isFinite(lng) && Number.isFinite(lat)) {
    const offset = 0.0004; // ~40m, small visible square
    return [
      [lng - offset, lat - offset],
      [lng + offset, lat - offset],
      [lng + offset, lat + offset],
      [lng - offset, lat + offset],
      [lng - offset, lat - offset],
    ];
  }

  return null;
}

/* ---------- bounds helpers ---------- */
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

/* ---------- geo helpers ---------- */
export function explainGeoError(err) {
  if (!err) return "Unknown geolocation error.";
  switch (err.code) {
    case 1:
      return "Permission denied. Allow location for this site in your browser.";
    case 2:
      return "Position unavailable. Try near a window or check OS location services.";
    case 3:
      return "Timed out. Try again or increase the timeout.";
    default:
      return err.message || "Geolocation failed.";
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
  return () => {
    try {
      navigator.geolocation?.clearWatch?.(id);
    } catch {}
  };
}

/* ---------- device orientation ---------- */
function extractHeadingFromEvent(e) {
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
    "ondeviceorientationabsolute" in window
      ? "deviceorientationabsolute"
      : "deviceorientation";
  window.addEventListener(type, handler, { passive: true });
  return () => window.removeEventListener(type, handler);
}

/* ---------- barangay helpers ---------- */
export function getBarangayName(props) {
  return props?.Barangay ?? props?.barangay ?? props?.NAME ?? props?.name ?? "";
}

export function strictDetectBarangayForGeometry(geom, barangaysFC) {
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
      try {
        return turf.booleanPointInPolygon(turf.point(coord), g);
      } catch {
        return false;
      }
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

/* ---------- build polygons from DAR records ---------- */
export function buildPolygonsFromDar(records = []) {
  const features = [];

  for (const rec of records) {
    const coords = getRecordPolygonCoords(rec);
    if (!coords || !Array.isArray(coords) || coords.length < 3) continue;

    const first = coords[0];
    const last = coords[coords.length - 1];
    const ring = JSON.stringify(first) === JSON.stringify(last) ? coords : [...coords, first];

    const status = getDarStatus(rec);
    const id = getDarId(rec);

    features.push({
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [ring] },
      properties: {
        id,
        cloa_no: rec.cloa_no ?? rec.cloaNo ?? "",
        lot_no: rec.lot_no ?? rec.lotNo ?? "",
        owner_name: rec.owner_name ?? rec.arb_name ?? rec.beneficiary_name ?? "",
        barangay: rec.barangay ?? rec.farmer_barangay ?? "",
        area_ha: rec.area_ha ?? rec.hectares ?? rec.area ?? null,
        status,
        award_date: rec.award_date ?? rec.date_awarded ?? null,
      },
    });
  }

  return { type: "FeatureCollection", features };
}

export function getPolygonCenterFromCoords(coords) {
  if (!Array.isArray(coords) || coords.length < 3) return null;
  const first = coords[0];
  const last = coords[coords.length - 1];
  const ring = JSON.stringify(first) === JSON.stringify(last) ? coords : [...coords, first];
  const poly = turf.polygon([ring]);
  let pt = turf.centerOfMass(poly);
  if (!pt?.geometry?.coordinates) pt = turf.pointOnFeature(poly);
  return pt.geometry.coordinates;
}
