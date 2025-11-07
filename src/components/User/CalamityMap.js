// components/User/CalamityFarmerMap.jsx
import React, { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import MapboxDirections from "@mapbox/mapbox-gl-directions/dist/mapbox-gl-directions";
import "@mapbox/mapbox-gl-directions/dist/mapbox-gl-directions.css";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import * as turf from "@turf/turf";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import CalamitySidebar from "./CalamitySideBar";
import DefaultThumbnail from "../MapboxImages/map-default.png";
import SatelliteThumbnail from "../MapboxImages/map-satellite.png";
import DarkThumbnail from "../MapboxImages/map-dark.png";
import LightThumbnail from "../MapboxImages/map-light.png";
import SidebarToggleButton from "./MapControls/SidebarToggleButton";
import TagCalamityForm from "./TagCalamityForm";
import { useLocation, useSearchParams } from "react-router-dom";
import BARANGAYS_FC from "../Barangays/barangays.json";

mapboxgl.accessToken =
  "pk.eyJ1Ijoid29tcHdvbXAtNjkiLCJhIjoiY204emxrOHkwMGJsZjJrcjZtZmN4YXdtNSJ9.LIMPvoBNtGuj4O36r3F72w";

/** --------- constants --------- **/
const API_BASE = "http://localhost:5000";
const INIT_CENTER = [122.9616, 10.5074];
const INIT_ZOOM = 13;
const BAGO_CITY_BOUNDS = [
  [122.7333, 10.4958],
  [123.5, 10.6333],
];

/** --------- tiny CSS for pulsing halo + chip + custom hover popup --------- **/
const addPulseStylesOnce = () => {
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
  .pulse-ring { position: absolute; left: 50%; top: 50%; width: 44px; height: 44px;
    border-radius: 9999px; background: rgba(239,68,68,0.35);
    box-shadow: 0 0 0 2px rgba(239,68,68,0.55) inset; animation: pulseRing 1.8s ease-out infinite; }
  .chip { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
    font-size: 12px; font-weight: 600; padding: 4px 8px; background: #111827; color: #fff;
    border-radius: 9999px; box-shadow: 0 1px 3px rgba(0,0,0,0.25); transform: translate(-50%, -8px); white-space: nowrap; }

  /* Remove default Mapbox popup shell for our hover card */
  .mapboxgl-popup.calamity-hover-preview { pointer-events: none !important; }
  .mapboxgl-popup.calamity-hover-preview .mapboxgl-popup-content {
    background: transparent !important; padding: 0 !important; box-shadow: none !important; border: none !important; border-radius: 0 !important;
  }
  .mapboxgl-popup.calamity-hover-preview .mapboxgl-popup-tip { display: none !important; }
  `;
  document.head.appendChild(style);
};

/** --------- image + hover card builder --------- **/
function resolveImageURL(calamity) {
  // Prefer your "photos" (JSON string/array) first
  let raw =
    calamity?.thumbnail_url ||
    calamity?.image_url ||
    calamity?.photo_url ||
    calamity?.image ||
    calamity?.photo ||
    calamity?.image_path ||
    null;

  // Try calamity.photos (array or JSON) as fallback
  if (!raw && calamity?.photos) {
    try {
      const arr = typeof calamity.photos === "string" ? JSON.parse(calamity.photos) : calamity.photos;
      if (Array.isArray(arr) && arr[0]) raw = arr[0];
    } catch {}
  }

  if (!raw) return null;

  if (/^(https?:)?\/\//i.test(raw) || raw.startsWith("data:") || raw.startsWith("blob:")) return raw;
  if (raw.startsWith("/")) return `${API_BASE}${raw}`;
  return `${API_BASE}/${raw}`;
}

function buildPreviewHTML(c) {
  const img = resolveImageURL(c);
  const type = c.calamity_type || c.type || "Incident";
  const sev = c.severity_level || c.severity || "N/A";
  const barangay = c.barangay || c.location_name || "";
  const notes = c.notes || c.description || "";

  const sevColors = {
    Severe:   { bg: "#fecaca", text: "#7f1d1d" },
    High:     { bg: "#fee2e2", text: "#991b1b" },
    Moderate: { bg: "#fef3c7", text: "#92400e" },
    Medium:   { bg: "#fef3c7", text: "#92400e" }, // alias
    Low:      { bg: "#dbeafe", text: "#1e40af" },
  };
  const sevColor = sevColors[sev] || { bg: "#f3f4f6", text: "#374151" };

  return `
    <div style="width: 280px; font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;">
      <div style="background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 10px 25px rgba(0,0,0,.15);">
        ${
          img
            ? `<div style="width:100%; height:160px; overflow:hidden; position:relative;">
                 <img src="${img}" alt="${type}" referrerpolicy="no-referrer" style="width:100%; height:100%; object-fit:cover;" />
                 <div style="position:absolute; top:8px; right:8px; font-size:11px; font-weight:600; background:${sevColor.bg}; color:${sevColor.text}; padding:4px 10px; border-radius:12px;">${sev}</div>
               </div>`
            : `<div style="width:100%; height:160px; display:grid; place-items:center; background:linear-gradient(135deg,#f3f4f6 0%,#e5e7eb 100%); color:#9ca3af; position:relative;">
                 <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                   <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                   <circle cx="8.5" cy="8.5" r="1.5"></circle>
                   <polyline points="21 15 16 10 5 21"></polyline>
                 </svg>
                 <div style="position:absolute; top:8px; right:8px; font-size:11px; font-weight:600; background:${sevColor.bg}; color:${sevColor.text}; padding:4px 10px; border-radius:12px;">${sev}</div>
               </div>`
        }
        <div style="padding:12px;">
          <div style="font-weight:700; font-size:16px; color:#b91c1c; margin-bottom:8px; display:flex; align-items:center; gap:6px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#b91c1c">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
            </svg>
            ${type}
          </div>
          ${
            barangay
              ? `<div style="font-size:13px; color:#6b7280; margin-bottom:8px; display:flex; align-items:center; gap:4px;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                    <circle cx="12" cy="10" r="3"></circle>
                  </svg>
                  <strong>Barangay:</strong>&nbsp;${barangay}
                </div>`
              : ""
          }
          ${
            notes
              ? `<div style="font-size:12px; color:#4b5563; line-height:1.4; max-height:2.8em; overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; border-left:3px solid #e5e7eb; padding-left:8px; margin-top:8px;">
                  ${String(notes).slice(0, 160)}${String(notes).length > 160 ? "…" : ""}
                 </div>`
              : ""
          }
        </div>
      </div>
    </div>
  `;
}

/** --------- GPS helpers --------- **/
function makeAccuracyCircle([lng, lat], accuracy) {
  const radiusKm = Math.max(accuracy, 10) / 1000;
  return turf.circle([lng, lat], radiusKm, { steps: 64, units: "kilometers" });
}
function explainGeoError(err) {
  if (!err) return "Unknown geolocation error.";
  switch (err.code) { case 1: return "Permission denied. Allow location for this site in your browser.";
    case 2: return "Position unavailable. Try near a window or check OS location services.";
    case 3: return "Timed out. Try again or increase the timeout.";
    default: return err.message || "Geolocation failed."; }
}
function startGeoWatch(onPos, onErr, opts) {
  if (!("geolocation" in navigator) || typeof navigator.geolocation.watchPosition !== "function") {
    onErr?.({ code: 2, message: "Geolocation watch not supported in this browser." });
    return () => {};
  }
  const id = navigator.geolocation.watchPosition(onPos, onErr, opts);
  return () => { try { navigator.geolocation?.clearWatch?.(id); } catch {} };
}
function extractHeadingFromEvent(e) {
  if (typeof e.webkitCompassHeading === "number") return e.webkitCompassHeading;
  if (typeof e.alpha === "number") return (360 - e.alpha + 360) % 360;
  return null;
}
async function startCompass(onHeading) {
  try {
    if (typeof DeviceOrientationEvent !== "undefined" &&
        typeof DeviceOrientationEvent.requestPermission === "function") {
      const p = await DeviceOrientationEvent.requestPermission();
      if (p !== "granted") throw new Error("Compass permission denied.");
    }
  } catch {}
  const handler = (e) => { const h = extractHeadingFromEvent(e); if (h != null && !Number.isNaN(h)) onHeading(h); };
  const type = "ondeviceorientationabsolute" in window ? "deviceorientationabsolute" : "deviceorientation";
  window.addEventListener(type, handler, { passive: true });
  return () => window.removeEventListener(type, handler);
}
function IconButton({ title, active, onClick, children }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`w-9 h-9 grid place-items-center rounded-lg border transition shadow-sm ${
        active ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-gray-800 border-gray-300"
      } hover:shadow-md`}
    >
      {children}
    </button>
  );
}

/** --------- bounds helpers ---------- **/
function isInsideBounds([lng, lat], bounds) {
  const [[minLng, minLat], [maxLng, maxLat]] = bounds;
  return lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat;
}
function expandBoundsToIncludePoint(bounds, [lng, lat], pad = 0.05) {
  const [[minLng, minLat], [maxLng, maxLat]] = bounds;
  return [
    [Math.min(minLng, lng) - pad, Math.min(minLat, lat) - pad],
    [Math.max(maxLng, lng) + pad, Math.max(maxLat, lat) + pad],
  ];
}

/* ---------- Barangay helpers (strict) ---------- */
function getBarangayName(props) {
  return props?.Barangay ?? props?.barangay ?? props?.NAME ?? props?.name ?? "";
}
function strictDetectBarangayForGeometry(geom, barangaysFC) {
  if (!geom || !barangaysFC?.features?.length) return null;
  if (!(geom.type === "Polygon" || geom.type === "MultiPolygon")) return null;

  const feat = { type: "Feature", properties: {}, geometry: geom };
  const center = turf.centroid(feat).geometry;

  for (const f of barangaysFC.features) {
    const g = f.geometry;
    if (!g) continue;
    if (!turf.booleanPointInPolygon(center, g)) continue;
    const ring =
      geom.type === "Polygon" ? (geom.coordinates?.[0] || []) : (geom.coordinates?.[0]?.[0] || []);
    const allInside = ring.every((coord) => {
      try { return turf.booleanPointInPolygon(turf.point(coord), g); } catch { return false; }
    });
    if (!allInside) continue;
    return {
      name: getBarangayName(f.properties || {}),
      centroid: turf.centroid(f).geometry.coordinates,
      feature: f,
    };
  }
  return null;
}

const CalamityFarmerMap = () => {
  addPulseStylesOnce();

  const mapContainer = useRef(null);
  const map = useRef(null);
  const markerRef = useRef(null);
  const directionsRef = useRef(null);
  const drawRef = useRef(null);

  const [mapStyle, setMapStyle] = useState("mapbox://styles/wompwomp-69/cm900xa91008j01t14w8u8i9d");
  const [showLayers, setShowLayers] = useState(false);
  const [isSwitcherVisible, setIsSwitcherVisible] = useState(false);
  const [selectedBarangay, setSelectedBarangay] = useState(null);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [isDirectionsVisible, setIsDirectionsVisible] = useState(false);
  const [newTagLocation, setNewTagLocation] = useState(null);
  const [isTagging, setIsTagging] = useState(false);
  const [taggedData] = useState([]);
  const [sidebarCalamities, setSidebarCalamities] = useState([]);
  const [selectedCalamity, setSelectedCalamity] = useState(null);
  const [selectedCalamityType, setSelectedCalamityType] = useState("All");
  const [calamityTypes, setCalamityTypes] = useState([]);
  const [areMarkersVisible, setAreMarkersVisible] = useState(true);
  const savedMarkersRef = useRef([]);
  const [enlargedImage, setEnlargedImage] = useState(null);

  // NEW: hover card state like your reference file
  const hoverPopupRef = useRef(null);
  const hoverLeaveTimerRef = useRef(null);

  // Deep-link target
  const locationState = useLocation().state || {};
  const [searchParams] = useSearchParams();
  const coerceNum = (v) => {
    if (v === null || v === undefined) return NaN;
    if (typeof v === "string" && v.trim() === "") return NaN;
    const n = Number(v);
    return Number.isFinite(n) ? n : NaN;
  };
  const target = {
    lat: coerceNum(locationState.lat ?? searchParams.get("lat")),
    lng: coerceNum(locationState.lng ?? searchParams.get("lng")),
    incidentId: String(locationState.incidentId ?? searchParams.get("incidentId") ?? ""),
    incidentType: locationState.incidentType ?? searchParams.get("incidentType") ?? "",
    barangay: locationState.barangay ?? searchParams.get("barangay") ?? "",
    zoom: coerceNum(locationState.zoom ?? searchParams.get("zoom")),
  };
  if (!Number.isFinite(target.zoom)) target.zoom = 16;

  const [lockToBago, setLockToBago] = useState(true);

  const SIDEBAR_WIDTH = 500;
  const PEEK = 1;

  const calamityColorMap = {
    Flood: "#3b82f6",
    Earthquake: "#ef4444",
    Typhoon: "#8b5cf6",
    Landslide: "#f59e0b",
    Drought: "#f97316",
    Wildfire: "#dc2626",
  };

  const mapStyles = {
    Default: { url: "mapbox://styles/wompwomp-69/cm900xa91008j01t14w8u8i9d", thumbnail: DefaultThumbnail },
    Satellite: { url: "mapbox://styles/wompwomp-69/cm96vey9z009001ri48hs8j5n", thumbnail: SatelliteThumbnail },
    Dark: { url: "mapbox://styles/wompwomp-69/cm96veqvt009101szf7g42jps", thumbnail: DarkThumbnail },
    Light: { url: "mapbox://styles/wompwomp-69/cm976c2u700ab01rc0cns2pe0", thumbnail: LightThumbnail },
  };

  const zoomToBarangay = (coordinates) => { map.current?.flyTo({ center: coordinates, zoom: 14, essential: true }); };

  const handleBarangaySelect = (barangayData) => {
    setSelectedBarangay(barangayData);
    markerRef.current?.remove();

    if (map.current && barangayData) {
      const el = document.createElement("div");
      el.className = "marker";
      el.style.width = "18px";
      el.style.height = "18px";
      el.style.borderRadius = "50%";
      el.style.backgroundColor = "#ef4444";
      el.style.border = "3px solid white";
      el.style.boxShadow = "0 0 10px rgba(0, 0, 0, 0.3)";

      // (Coordinates intentionally omitted from popup content)
      const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
        <div class="text-sm">
          <h3 class="font-bold text-red-600 text-base">${barangayData.name}</h3>
          ${barangayData.population ? `<p><strong>Population:</strong> ${barangayData.population}</p>` : ""}
          ${barangayData.hazards ? `<p><strong>Hazards:</strong> ${barangayData.hazards.join(", ")}</p>` : ""}
        </div>
      `);

      markerRef.current = new mapboxgl.Marker(el).setLngLat(barangayData.coordinates).setPopup(popup).addTo(map.current);
      markerRef.current.togglePopup();
    }
  };

  // id -> marker for anchoring chip/halo
  const calamityMarkerMapRef = useRef(new Map());
  const selectedLabelRef = useRef(null);
  const selectedHaloRef = useRef(null);
  const hasDeepLinkedRef = useRef(false);

  const HILITE_SRC  = "selected-calamity-highlight-src";
  const HILITE_FILL = "selected-calamity-highlight-fill";
  const HILITE_LINE = "selected-calamity-highlight-line";

  // NEW: line glow animation timer
  const HILITE_ANIM_REF = useRef(null);

  /** -------- highlight helpers -------- **/
  const runWhenStyleReady = useCallback((cb) => {
    const m = map.current; if (!m) return;
    if (m.isStyleLoaded && m.isStyleLoaded()) { cb(); return; }
    const onStyle = () => { if (m.isStyleLoaded && m.isStyleLoaded()) { m.off("styledata", onStyle); cb(); } };
    m.on("styledata", onStyle);
  }, []);

  function waitForPolygonsReady(m) {
    return new Promise((resolve) => {
      if (!m) return resolve();
      const ready = () =>
        m.isStyleLoaded()
        && !!m.getSource("calamity-polygons")
        && !!m.getLayer("calamity-polygons-layer");
      if (ready()) return resolve();
      const onIdle = () => {
        if (ready()) { m.off("idle", onIdle); resolve(); }
      };
      m.on("idle", onIdle);
    });
  }

  const clearSelection = useCallback(() => {
    if (!map.current) return;
    if (HILITE_ANIM_REF.current) { clearInterval(HILITE_ANIM_REF.current); HILITE_ANIM_REF.current = null; }
    selectedLabelRef.current?.remove(); selectedLabelRef.current = null;
    selectedHaloRef.current?.remove();  selectedHaloRef.current  = null;
    if (map.current.getLayer(HILITE_FILL)) map.current.removeLayer(HILITE_FILL);
    if (map.current.getLayer(HILITE_LINE)) map.current.removeLayer(HILITE_LINE);
    if (map.current.getSource(HILITE_SRC)) map.current.removeSource(HILITE_SRC);
  }, []);

  const showMarkerChipAndHalo = useCallback((id, text = "Selected incident") => {
    if (!map.current) return;
    selectedLabelRef.current?.remove(); selectedLabelRef.current = null;
    selectedHaloRef.current?.remove();  selectedHaloRef.current  = null;

    const marker = calamityMarkerMapRef.current.get(String(id));
    if (!marker) return;
    const at = marker.getLngLat();

    const chip = document.createElement("div");
    chip.className = "chip";
    chip.textContent = text;
    const chipMarker = new mapboxgl.Marker({ element: chip, anchor: "bottom", offset: [0, -42] })
      .setLngLat(at).addTo(map.current);
    selectedLabelRef.current = chipMarker;

    const haloWrap = document.createElement("div");
    haloWrap.className = "pulse-wrapper";
    const ring = document.createElement("div");
    ring.className = "pulse-ring";
    haloWrap.appendChild(ring);
    const haloMarker = new mapboxgl.Marker({ element: haloWrap, anchor: "center" })
      .setLngLat(at).addTo(map.current);
    selectedHaloRef.current = haloMarker;

    try { marker.togglePopup(); } catch {}
  }, []);

  const getCalamityCenter = useCallback((item) => {
    let coords = item?.coordinates;
    if (!coords) return null;
    if (typeof coords === "string") { try { coords = JSON.parse(coords); } catch { return null; } }
    if (!Array.isArray(coords) || coords.length < 3) return null;
    const first = coords[0], last = coords[coords.length - 1];
    if (JSON.stringify(first) !== JSON.stringify(last)) coords = [...coords, first];
    const poly = turf.polygon([coords]);
    let pt = turf.centerOfMass(poly);
    if (!pt?.geometry?.coordinates) pt = turf.pointOnFeature(poly);
    return pt.geometry.coordinates; // [lng, lat]
  }, []);

  const highlightPolygon = useCallback((item) => {
    if (!map.current || !item) return;
    runWhenStyleReady(() => {
      let coords = item.coordinates;
      if (typeof coords === "string") { try { coords = JSON.parse(coords); } catch { return; } }
      if (!Array.isArray(coords) || coords.length < 3) return;
      const first = coords[0], last = coords[coords.length - 1];
      if (JSON.stringify(first) !== JSON.stringify(last)) coords = [...coords, first];
      const feature = turf.polygon([coords], { id: item.calamity_id ?? item.id, calamity_type: item.calamity_type });

      const m = map.current;

      if (!m.getSource(HILITE_SRC)) {
        m.addSource(HILITE_SRC, { type: "geojson", data: { type: "FeatureCollection", features: [feature] } });
        m.addLayer({ id: HILITE_FILL, type: "fill", source: HILITE_SRC,
          paint: { "fill-color": "#ef4444", "fill-opacity": 0.15 } });
        m.addLayer({ id: HILITE_LINE, type: "line", source: HILITE_SRC,
          paint: { "line-color": "#ef4444", "line-width": 4, "line-opacity": 1 } });
      } else {
        m.getSource(HILITE_SRC).setData({ type: "FeatureCollection", features: [feature] });
      }

      // glowing/breathing outline
      if (HILITE_ANIM_REF.current) { clearInterval(HILITE_ANIM_REF.current); HILITE_ANIM_REF.current = null; }
      let w = 4, dir = +0.4;
      HILITE_ANIM_REF.current = setInterval(() => {
        if (!m.getLayer(HILITE_LINE)) return;
        w += dir;
        if (w >= 8) dir = -0.4;
        if (w <= 3) dir = +0.4;
        try { m.setPaintProperty(HILITE_LINE, "line-width", w); } catch {}
      }, 80);
    });
  }, [runWhenStyleReady]);

  const highlightSelection = useCallback((item) => {
    if (!map.current || !item) return;
    clearSelection();
    const label = `${item.calamity_type || "Incident"}${item.severity_level ? ` – ${item.severity_level}` : ""}`;
    const id = item.calamity_id ?? item.id;
    showMarkerChipAndHalo(id, label);
    highlightPolygon(item);
    const center = getCalamityCenter(item);
    if (center) map.current.flyTo({ center, zoom: Math.max(map.current.getZoom(), 16), essential: true });
  }, [clearSelection, showMarkerChipAndHalo, highlightPolygon, getCalamityCenter]);

  /** -------- calamity polygons -------- **/
  const handlePolyClick = useCallback((e) => {
    if (!e.features?.length) return;
    const feature = e.features[0];
    const polyId = String(feature.properties?.id ?? "");
    const calam = sidebarCalamities.find((c) => String(c.calamity_id ?? c.id) === polyId);
    if (calam) {
      setSelectedCalamity(calam);
      highlightSelection(calam);
      setIsSidebarVisible(true);
    }
    try {
      const coords = feature.geometry?.coordinates?.[0];
      if (Array.isArray(coords) && coords.length > 2) {
        const center = turf.centerOfMass(turf.polygon([coords])).geometry.coordinates;
        map.current.easeTo({ center, zoom: Math.max(map.current.getZoom(), 13) });
      }
    } catch {}
  }, [highlightSelection, sidebarCalamities]);

  const handlePolyEnter = useCallback(() => { map.current && (map.current.getCanvas().style.cursor = "pointer"); }, []);
  const handlePolyLeave = useCallback(() => { map.current && (map.current.getCanvas().style.cursor = ""); }, []);

  const attachPolygonInteractivity = useCallback(() => {
    if (!map.current?.getLayer("calamity-polygons-layer")) return;
    map.current.off("click", "calamity-polygons-layer", handlePolyClick);
    map.current.off("mouseenter", "calamity-polygons-layer", handlePolyEnter);
    map.current.off("mouseleave", "calamity-polygons-layer", handlePolyLeave);
    map.current.on("click", "calamity-polygons-layer", handlePolyClick);
    map.current.on("mouseenter", "calamity-polygons-layer", handlePolyEnter);
    map.current.on("mouseleave", "calamity-polygons-layer", handlePolyLeave);
  }, [handlePolyClick, handlePolyEnter, handlePolyLeave]);

  const loadPolygons = useCallback(async (geojsonData = null, isFiltered = false) => {
    const res = await axios.get(`${API_BASE}/api/calamities/polygons`);
    const fullData = geojsonData || res.data;

    const paintStyle = isFiltered
      ? {
          "fill-color": [
            "match",
            ["get", "calamity_type"],
            "Flood", "#3b82f6",
            "Earthquake", "#ef4444",
            "Typhoon", "#8b5cf6",
            "Landslide", "#f59e0b",
            "Drought", "#f97316",
            "Wildfire", "#dc2626",
            "#ef4444"
          ],
          "fill-opacity": 0.4,
        }
      : { "fill-color": "#ef4444", "fill-opacity": 0.4 };

    if (map.current.getSource("calamity-polygons")) {
      map.current.getSource("calamity-polygons").setData(fullData);
      map.current.setPaintProperty("calamity-polygons-layer", "fill-color", paintStyle["fill-color"]);
    } else {
      map.current.addSource("calamity-polygons", { type: "geojson", data: fullData });
      map.current.addLayer({
        id: "calamity-polygons-layer",
        type: "fill",
        source: "calamity-polygons",
        paint: paintStyle,
      });
      map.current.addLayer({
        id: "calamity-polygons-outline",
        type: "line",
        source: "calamity-polygons",
        paint: { "line-color": "#7f1d1d", "line-width": 2 },
      });
    }
    attachPolygonInteractivity();
  }, [attachPolygonInteractivity]);

  /** -------- markers with HOVER CARD (like your sample) -------- **/
  const renderSavedMarkers = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE}/api/calamities`);
      const calamities = response.data;
      setSidebarCalamities(calamities);

      // clear previous
      savedMarkersRef.current.forEach((marker) => marker.remove());
      savedMarkersRef.current = [];
      calamityMarkerMapRef.current.clear();
      if (hoverPopupRef.current) { try { hoverPopupRef.current.remove(); } catch {} hoverPopupRef.current = null; }

      const filtered = selectedCalamityType === "All"
        ? calamities
        : calamities.filter(calamity => calamity.calamity_type === selectedCalamityType);

      if (filtered.length === 0) {
        toast.info("No Calamities Found .", { position: "top-center", autoClose: 3000, hideProgressBar: true, theme: "light" });
        return;
      }

      filtered.forEach((calamity) => {
        let coords = calamity.coordinates;
        if (typeof coords === "string") { try { coords = JSON.parse(coords); } catch { return; } }
        if (Array.isArray(coords) && coords.length > 2) {
          const first = coords[0];
          const last = coords[coords.length - 1];
          if (JSON.stringify(first) !== JSON.stringify(last)) coords.push(first);

          const center = turf.centerOfMass(turf.polygon([coords])).geometry.coordinates;

          const marker = new mapboxgl.Marker({ color: calamityColorMap[calamity.calamity_type] || "#ef4444" })
            .setLngLat(center)
            .setPopup(new mapboxgl.Popup({ offset: 15 }).setHTML(`
                <div class="text-sm">
                  <h3 class='font-bold text-red-600'>${calamity.calamity_type}</h3>
                  <p><strong>Severity:</strong> ${calamity.severity_level || "N/A"}</p>
                </div>
              `)
            )
            .addTo(map.current);

          marker.getElement().addEventListener("click", () => {
            setSelectedCalamity(calamity);
            highlightSelection(calamity);
            setIsSidebarVisible(true);
          });

          // HOVER CARD exactly like your reference
          marker.getElement().addEventListener("mouseenter", () => {
            if (hoverLeaveTimerRef.current) { clearTimeout(hoverLeaveTimerRef.current); hoverLeaveTimerRef.current = null; }
            try { hoverPopupRef.current?.remove(); } catch {}
            const html = buildPreviewHTML(calamity);
            const popup = new mapboxgl.Popup({
              closeButton: false,
              closeOnClick: false,
              closeOnMove: false,
              offset: 30,
              anchor: "top",
              className: "calamity-hover-preview",
              maxWidth: "none",
            })
              .setLngLat(center)
              .setHTML(html)
              .addTo(map.current);

            // double-ensure the shell is transparent
            setTimeout(() => {
              const el = popup.getElement();
              const content = el?.querySelector(".mapboxgl-popup-content");
              const tip = el?.querySelector(".mapboxgl-popup-tip");
              if (content) { content.style.background = "transparent"; content.style.padding = "0"; content.style.boxShadow = "none"; }
              if (tip) tip.style.display = "none";
            }, 0);

            hoverPopupRef.current = popup;
          });

          marker.getElement().addEventListener("mouseleave", () => {
            hoverLeaveTimerRef.current = setTimeout(() => {
              if (hoverPopupRef.current) { try { hoverPopupRef.current.remove(); } catch {} hoverPopupRef.current = null; }
            }, 140);
          });

          const calId = String(calamity.calamity_id ?? calamity.id);
          calamityMarkerMapRef.current.set(calId, marker);
          savedMarkersRef.current.push(marker);
        }
      });
    } catch (error) {
      console.error("Failed to load saved markers:", error);
    }
  }, [selectedCalamityType, highlightSelection]);

  /** -------- GPS + heading -------- **/
  const userMarkerRef = useRef(null);
  const userMarkerElRef = useRef(null);
  const [userLoc, setUserLoc] = useState(null);
  const [tracking, setTracking] = useState(false);
  const watchStopRef = useRef(null);

  const [headingDeg, setHeadingDeg] = useState(null);
  const [compassOn, setCompassOn] = useState(false);
  const compassStopRef = useRef(null);
  const [rotateMapWithHeading, setRotateMapWithHeading] = useState(false);

  const USER_ACC_SOURCE = "user-accuracy-source";
  const USER_ACC_LAYER = "user-accuracy-layer";
  const USER_ACC_OUTLINE = "user-accuracy-outline";

  const ensureUserAccuracyLayers = useCallback(() => {
    if (!map.current) return;
    const m = map.current;

    if (!m.getSource(USER_ACC_SOURCE)) {
      m.addSource(USER_ACC_SOURCE, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
    }
    if (!m.getLayer(USER_ACC_LAYER)) {
      m.addLayer({
        id: "user-accuracy-layer",
        type: "fill",
        source: "user-accuracy-source",
        paint: { "fill-color": "#3b82f6", "fill-opacity": 0.15 },
      });
    }
    if (!m.getLayer(USER_ACC_OUTLINE)) {
      m.addLayer({
        id: "user-accuracy-outline",
        type: "line",
        source: "user-accuracy-source",
        paint: { "line-color": "#2563eb", "line-width": 2 },
      });
    }
  }, []);

  const updateUserAccuracyCircle = useCallback((lng, lat, acc) => {
    if (!map.current) return;
    ensureUserAccuracyLayers();
    const circle = makeAccuracyCircle([lng, lat], acc);
    map.current.getSource(USER_ACC_SOURCE).setData(circle);
  }, [ensureUserAccuracyLayers]);

  const setUserMarker = useCallback((lng, lat, acc) => {
    if (!map.current) return;
    const m = map.current;

    if (!userMarkerElRef.current) {
      const el = document.createElement("div");
      el.style.width = "36px";
      el.style.height = "36px";
      el.style.borderRadius = "50%";
      el.style.position = "relative";
      el.style.boxShadow = "0 0 0 3px rgba(59,130,246,0.25)";
      el.style.background = "rgba(59,130,246,0.10)";

      const arrow = document.createElement("div");
      arrow.style.position = "absolute";
      arrow.style.left = "50%";
      arrow.style.top = "50%";
      arrow.style.transform = "translate(-50%, -65%)";
      arrow.style.width = "0";
      arrow.style.height = "0";
      arrow.style.borderLeft = "8px solid transparent";
      arrow.style.borderRight = "8px solid transparent";
      arrow.style.borderBottom = "16px solid #2563eb";
      arrow.style.filter = "drop-shadow(0 1px 2px rgba(0,0,0,0.3))";
      el.appendChild(arrow);

      userMarkerElRef.current = el;

      if (!userMarkerRef.current) {
        userMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat([lng, lat])
          .setPopup(new mapboxgl.Popup({ offset: 12 }).setText("You are here"))
          .addTo(m);
      } else {
        userMarkerRef.current.setElement(el);
      }
    }

    userMarkerRef.current.setLngLat([lng, lat]);
    updateUserAccuracyCircle(lng, lat, acc);

    if (typeof headingDeg === "number" && userMarkerElRef.current) {
      userMarkerElRef.current.style.transform = `rotate(${headingDeg}deg)`;
    }

    m.easeTo({ center: [lng, lat], zoom: Math.max(m.getZoom(), 15), duration: 0, essential: true });

    if (rotateMapWithHeading && typeof headingDeg === "number") {
      m.setBearing(headingDeg);
    }
  }, [headingDeg, rotateMapWithHeading, updateUserAccuracyCircle]);

  const handleFix = useCallback((glng, glat, accuracy) => {
    if (!map.current) return;

    if (lockToBago && !isInsideBounds([glng, glat], BAGO_CITY_BOUNDS)) {
      const expanded = expandBoundsToIncludePoint(BAGO_CITY_BOUNDS, [glng, glat], 0.05);
      map.current.setMaxBounds(expanded);
      toast.info("You’re outside Bago. Temporarily expanded bounds to include your location.");
    }

    setUserLoc({ lng: glng, lat: glat, acc: accuracy });
    setUserMarker(glng, glat, accuracy);
  }, [lockToBago, setUserMarker]);

  /** --- optional barangay outlines --- */
  const ensureBarangayLayers = useCallback(() => {
    if (!map.current) return;
    if (!BARANGAYS_FC?.features?.length) return;

    const m = map.current;
    if (!m.getSource("barangays-src")) {
      m.addSource("barangays-src", { type: "geojson", data: BARANGAYS_FC });
    }
    if (!m.getLayer("barangays-line")) {
      m.addLayer({
        id: "barangays-line",
        type: "line",
        source: "barangays-src",
        paint: { "line-color": "#1f2937", "line-width": 1.5, "line-opacity": 0.7 },
      });
    }
  }, []);

  /** -------- map init / lifecycle -------- **/
  useEffect(() => {
    if (!map.current) {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: mapStyle,
        center: INIT_CENTER,
        zoom: INIT_ZOOM,
        maxBounds: BAGO_CITY_BOUNDS,
      });

      axios.get(`${API_BASE}/api/calamities/types`).then((res) => setCalamityTypes(res.data));
      map.current.addControl(new mapboxgl.NavigationControl(), "bottom-right");

      drawRef.current = new MapboxDraw({ displayControlsDefault: false, controls: { polygon: true, trash: true } });
      map.current.addControl(drawRef.current, "bottom-right");

      map.current.on("load", async () => {
        try {
          const res = await axios.get(`${API_BASE}/api/calamities/polygons`);
          const geojson = res.data;

          if (map.current.getSource("calamity-polygons")) {
            map.current.getSource("calamity-polygons").setData(geojson);
          } else {
            map.current.addSource("calamity-polygons", { type: "geojson", data: geojson });
            map.current.addLayer({
              id: "calamity-polygons-layer",
              type: "fill",
              source: "calamity-polygons",
              paint: { "fill-color": "#ef4444", "fill-opacity": 0.4 },
            });
            map.current.addLayer({
              id: "calamity-polygons-outline",
              type: "line",
              source: "calamity-polygons",
              paint: { "line-color": "#7f1d1d", "line-width": 2 },
            });
          }
        } catch (err) { console.error(" Failed to load polygons:", err); }

        ensureUserAccuracyLayers();
        ensureBarangayLayers();
        attachPolygonInteractivity();
        await renderSavedMarkers();

        // ✅ initial deep-link focus (once) with source/layer readiness
        if (!hasDeepLinkedRef.current) {
          await waitForPolygonsReady(map.current);

          let didHighlight = false;

          if (target.incidentId && sidebarCalamities.length) {
            const hit = sidebarCalamities.find(
              (c) => String(c.calamity_id ?? c.id) === String(target.incidentId)
            );
            if (hit) {
              setSelectedCalamity(hit);
              highlightSelection(hit);
              setIsSidebarVisible(true);
              const center = getCalamityCenter(hit);
              if (center) map.current.flyTo({ center, zoom: target.zoom, essential: true });
              didHighlight = true;
            }
          }

          if (!didHighlight && Number.isFinite(target.lat) && Number.isFinite(target.lng)) {
            map.current.flyTo({ center: [target.lng, target.lat], zoom: target.zoom, essential: true });
          }

          if (didHighlight) hasDeepLinkedRef.current = true;
        }

        /** ---- ENFORCE barangay boundary on draw ---- */
        const handleDrawAttempt = (feature) => {
          if (!feature?.geometry) return;
          if (feature.geometry.type !== "Polygon" && feature.geometry.type !== "MultiPolygon") return;

          const poly = feature.geometry;
          const detection = strictDetectBarangayForGeometry(poly, BARANGAYS_FC);

          if (!detection) {
            try { drawRef.current?.delete(feature.id); } catch {}
            setIsTagging(false);
            setNewTagLocation(null);
            toast.error("The tagged area must be entirely inside a single barangay. Please redraw within one barangay.");
            return false;
          }

          const ring = poly.type === "Polygon" ? poly.coordinates?.[0] : poly.coordinates?.[0]?.[0];
          const area = turf.area({ type: "Feature", geometry: poly, properties: {} });
          const hectares = +(area / 10000).toFixed(2);

          setSelectedBarangay({ name: detection.name, coordinates: detection.centroid });
          setNewTagLocation({ coordinates: ring, hectares });
          setIsTagging(true);
          return true;
        };

        map.current.on("draw.create", (e) => handleDrawAttempt(e.features?.[0]));
        map.current.on("draw.update", (e) => {
          const ok = handleDrawAttempt(e.features?.[0]);
          if (!ok) { try { drawRef.current?.delete(e.features?.[0]?.id); } catch {} }
        });
      });
    } else {
      map.current.setStyle(mapStyle);
      map.current.once("style.load", async () => {
        ensureUserAccuracyLayers();
        ensureBarangayLayers();
        if (userLoc) {
          updateUserAccuracyCircle(userLoc.lng, userLoc.lat, userLoc.acc);
          userMarkerRef.current?.setLngLat([userLoc.lng, userLoc.lat]).addTo(map.current);
          if (typeof headingDeg === "number" && userMarkerElRef.current) {
            userMarkerElRef.current.style.transform = `rotate(${headingDeg}deg)`;
          }
        }
        await loadPolygons();
        await renderSavedMarkers();
        attachPolygonInteractivity();

        if (selectedCalamity) {
          highlightSelection(selectedCalamity);
        } else if (!hasDeepLinkedRef.current && target.incidentId && sidebarCalamities.length) {
          const hit = sidebarCalamities.find(c => String(c.calamity_id ?? c.id) === String(target.incidentId));
          if (hit) {
            setSelectedCalamity(hit);
            highlightSelection(hit);
            setIsSidebarVisible(true);
            const center = getCalamityCenter(hit) ||
              (Number.isFinite(target.lng) && Number.isFinite(target.lat) ? [target.lng, target.lat] : null);
            if (center) { hasDeepLinkedRef.current = true; map.current.flyTo({ center, zoom: target.zoom, essential: true }); }
          }
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapStyle, ensureUserAccuracyLayers, ensureBarangayLayers, loadPolygons, renderSavedMarkers, highlightSelection]);

  // ✅ Deep-link after data ready
  useEffect(() => {
    if (!map.current || hasDeepLinkedRef.current || !target.incidentId || !sidebarCalamities.length) return;
    runWhenStyleReady(async () => {
      await waitForPolygonsReady(map.current);
      const hit = sidebarCalamities.find(c => String(c.calamity_id ?? c.id) === String(target.incidentId));
      if (!hit) return;

      setSelectedCalamity(hit);
      highlightSelection(hit);
      setIsSidebarVisible(true);

      const center = getCalamityCenter(hit) ||
        (Number.isFinite(target.lng) && Number.isFinite(target.lat) ? [target.lng, target.lat] : null);
      if (center) map.current.flyTo({ center, zoom: target.zoom ?? 16, essential: true });
      hasDeepLinkedRef.current = true;
    });
  }, [sidebarCalamities, target.incidentId, target.lat, target.lng, target.zoom, highlightSelection, runWhenStyleReady, getCalamityCenter]);

  // lock toggle
  useEffect(() => {
    if (!map.current) return;
    if (lockToBago) {
      map.current.setMaxBounds(BAGO_CITY_BOUNDS);
      toast.info("Map locked to Bago City boundaries.");
    } else {
      map.current.setMaxBounds(null);
      toast.info("Map unlocked. You can pan anywhere.");
    }
  }, [lockToBago]);

  useEffect(() => { if (map.current) renderSavedMarkers(); }, [selectedCalamityType, renderSavedMarkers]);

  useEffect(() => {
    const filterPolygonsByCalamity = async () => {
      const res = await axios.get(`${API_BASE}/api/calamities/polygons`);
      const geojson = res.data;
      if (selectedCalamityType === "All") {
        await loadPolygons(geojson, true);
      } else {
        const filtered = {
          ...geojson,
          features: geojson.features.filter((f) => f.properties.calamity_type === selectedCalamityType),
        };
        await loadPolygons(filtered, true);
      }
    };
    if (map.current?.getSource("calamity-polygons")) filterPolygonsByCalamity();
  }, [selectedCalamityType, loadPolygons]);

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === "Escape") setEnlargedImage(null); };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  // Cleanup GPS + selection + animation + hover popup
  useEffect(() => {
    return () => {
      try {
        watchStopRef.current?.();
        userMarkerRef.current?.remove();
        compassStopRef.current?.();
        if (HILITE_ANIM_REF.current) { clearInterval(HILITE_ANIM_REF.current); HILITE_ANIM_REF.current = null; }
        hoverPopupRef.current?.remove();
        clearSelection();
      } catch {}
    };
  }, [clearSelection]);

  return (
    <div className="relative h-screen w-screen">
      {/* GPS toolbar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-white/70 backdrop-blur rounded-xl p-2 shadow-md">
        {/* Locate me */}
        <IconButton
          title="Locate me"
          active={false}
          onClick={async () => {
            if (!("geolocation" in navigator)) { toast.error("Geolocation not supported by this browser."); return; }
            try {
              const pos = await new Promise((resolve, reject) =>
                navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 })
              );
              const { longitude: glng, latitude: glat, accuracy } = pos.coords;
              handleFix(glng, glat, accuracy);
            } catch (e) { toast.error(explainGeoError(e)); }
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2a1 1 0 0 1 1 1v1.06A8.004 8.004 0 0 1 19.94 11H21a1 1 0 1 1 0 2h-1.06A8.004 8.004 0 0 1 13 19.94V21a1 1 0 1 1-2 0v-1.06A8.004 8.004 0 0 1 4.06 13H3a1 1 0 1 1 0-2h1.06A8.004 8.004 0 0 1 11 4.06V3a1 1 0 0 1 1-1Zm0 4a6 6 0 1 0 .001 12.001A6 6 0 0 0 12 6Zm0 3.5a2.5 2.5 0 1 1 0 5.001A2.5 2.5 0 0 1 12 9.5Z" />
          </svg>
        </IconButton>

        {/* Live tracking */}
        <IconButton
          title={tracking ? "Stop tracking" : "Start tracking"}
          active={tracking}
          onClick={() => {
            if (!("geolocation" in navigator)) { toast.error("Geolocation not supported."); return; }
            if (!tracking) {
              const stop = startGeoWatch(
                (pos) => {
                  const { longitude: glng, latitude: glat, accuracy, heading } = pos.coords;
                  handleFix(glng, glat, accuracy);
                  if (typeof heading === "number" && !Number.isNaN(heading)) {
                    setHeadingDeg(heading);
                    if (userMarkerElRef.current) userMarkerElRef.current.style.transform = `rotate(${heading}deg)`;
                    if (rotateMapWithHeading && map.current) map.current.setBearing(heading);
                  }
                },
                (err) => toast.error(explainGeoError(err)),
                { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
              );
              watchStopRef.current = stop;
              setTracking(true);
              toast.success("Live tracking ON");
            } else {
              watchStopRef.current?.(); watchStopRef.current = null;
              setTracking(false);
              toast.info("Live tracking OFF");
            }
          }}
        >
          {tracking ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 8h3v8H8V8zm5 0h3v8h-3V8z" /></svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7L8 5z" /></svg>
          )}
        </IconButton>

        {/* Compass toggle */}
        <IconButton
          title={compassOn ? "Stop compass" : "Start compass"}
          active={compassOn}
          onClick={async () => {
            if (!compassOn) {
              try {
                const stop = await startCompass((deg) => {
                  setHeadingDeg(deg);
                  if (userMarkerElRef.current) userMarkerElRef.current.style.transform = `rotate(${deg}deg)`;
                  if (rotateMapWithHeading && map.current) map.current.setBearing(deg);
                });
                compassStopRef.current = stop;
                setCompassOn(true);
                toast.success("Compass ON");
              } catch (e) { toast.error(e?.message || "Failed to start compass."); }
            } else {
              compassStopRef.current?.(); compassStopRef.current = null;
              setCompassOn(false);
              toast.info("Compass OFF");
            }
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2a10 10 0 1 0 .001 20.001A10 10 0 0 0 12 2Zm3.7 6.3-2.6 6.5a1 1 0 0 1-.6.6l-6.5 2.6 2.6-6.5a1 1 0 0 1 .6-.6l6.5-2.6Z" />
          </svg>
        </IconButton>

        {/* Follow heading */}
        <IconButton title="Follow heading (rotate map)" active={rotateMapWithHeading} onClick={() => setRotateMapWithHeading((v) => !v)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 6 22l6-5 6 5-6-20z" /></svg>
        </IconButton>

        {/* Lock to Bago */}
        <IconButton title={lockToBago ? "Unlock map" : "Lock to Bago"} active={lockToBago} onClick={() => setLockToBago((v) => !v)}>
          {lockToBago ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17 8h-1V6a4 4 0 1 0-8 0v2H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2Zm-7-2a2 2 0 1 1 4 0v2h-4V6Z" /></svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17 8h-1V6a4 4 0 0 0-7.33-2.4l1.5 1.32A2 2 0 0 1 13 6v2H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2Z" /></svg>
          )}
        </IconButton>
      </div>

      {/* Map */}
      <div ref={mapContainer} className="h-full w-full" />

      {isTagging && newTagLocation && (
        <TagCalamityForm
          defaultLocation={{ ...newTagLocation, hectares: newTagLocation.hectares }}
          setNewTagLocation={setNewTagLocation}
          selectedBarangay={selectedBarangay?.name}
          onCancel={() => {
            setIsTagging(false);
            setNewTagLocation(null);
            drawRef.current?.deleteAll();
          }}
          onSave={async (formData) => {
            let savedCalamity;
            try {
              const response = await axios.post(`${API_BASE}/api/calamities`, formData, { headers: { "Content-Type": "multipart/form-data" } });
              savedCalamity = response.data;
            } catch (error) {
              console.error("Create failed:", error);
              toast.error(error.response?.data?.error || "Failed to save calamity.", { position: "top-center", autoClose: 3000, hideProgressBar: true, theme: "light" });
              setIsTagging(false); setNewTagLocation(null); drawRef.current?.deleteAll();
              return;
            }

            setSidebarCalamities((prev) => [...prev, savedCalamity]);

            try {
              const coords = Array.isArray(savedCalamity.coordinates) ? savedCalamity.coordinates : JSON.parse(savedCalamity.coordinates);
              if (map.current && Array.isArray(coords)) {
                const center = turf.centerOfMass(turf.polygon([coords])).geometry.coordinates;
                const marker = new mapboxgl.Marker({ color: calamityColorMap[savedCalamity.calamity_type] || "#ef4444" })
                  .setLngLat(center)
                  .setPopup(new mapboxgl.Popup({ offset: 15 }).setHTML(`
                      <div class="text-sm">
                        <h3 class='font-bold text-red-600'>${savedCalamity.calamity_type}</h3>
                        <p><strong>Severity:</strong> ${savedCalamity.severity_level || "N/A"}</p>
                      </div>
                    `)
                  )
                  .addTo(map.current);
                savedMarkersRef.current.push(marker);
              }
            } catch {}

            try { await loadPolygons(); } catch {}

            toast.success("Calamity saved successfully!", { position: "top-center", autoClose: 3000, hideProgressBar: true, theme: "light" });

            setIsTagging(false);
            setNewTagLocation(null);
            drawRef.current?.deleteAll();
          }}
        />
      )}

      <div
        style={{ position: "absolute", left: isSidebarVisible ? "480px" : "0px", top: "50%", transform: "translateY(-50%)", zIndex: 10 }}
      ></div>

      <SidebarToggleButton
        onClick={() => setIsSidebarVisible(!isSidebarVisible)}
        isSidebarVisible={isSidebarVisible}
        sidebarWidth={SIDEBAR_WIDTH}
        peek={PEEK}
      />

      {!isSidebarVisible && (
        <button
          onClick={() => {
            if (directionsRef.current) { map.current.removeControl(directionsRef.current); directionsRef.current = null; }
            else {
              const directions = new MapboxDirections({ accessToken: mapboxgl.accessToken, unit: "metric", profile: "mapbox/driving", controls: { inputs: true, instructions: true } });
              map.current.addControl(directions, "top-right");
              directionsRef.current = directions;
            }
            setIsDirectionsVisible(!isDirectionsVisible);
          }}
          className="absolute top-4 left-16 bg-white border border-gray-300 rounded-full w-10 h-10 flex items-center justify-center shadow-md hover:shadow-lg z-50"
        >
          <svg className="w-5 h-5 text-gray-800" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {!isSidebarVisible && (
        <>
          <button
            onClick={() => setIsSwitcherVisible(!isSwitcherVisible)}
            className="absolute bottom-6 left-4 w-20 h-20 rounded-xl shadow-md overflow-hidden z-30 bg-white border border-gray-300 hover:shadow-lg transition"
          >
            <div className="w-full h-full relative">
              <img src={DefaultThumbnail} alt="Layers" className="w-full h-full object-cover" />
              <div className="absolute bottom-0 left-0 right-0 text-white text-xs font-semibold px-2 py-1 bg-black/60 text-center">
                Layers
              </div>
            </div>
          </button>

          {isSwitcherVisible && (
            <div className="absolute bottom-28 left-4 bg-white p-2 rounded-xl shadow-xl flex space-x-2 z-30 transition-all duration-300">
              {Object.entries(mapStyles).map(([label, { url, thumbnail }]) => (
                <button
                  key={label}
                  onClick={() => { setMapStyle(url); setIsSwitcherVisible(false); }}
                  className="w-16 h-16 rounded-md border border-gray-300 overflow-hidden relative hover:shadow-md"
                >
                  <img src={thumbnail} alt={label} className="w-full h-full object-cover" />
                  <div className="absolute bottom-0 w-full text-[10px] text-white text-center bg-black bg-opacity-60 py-[2px]">
                    {label}
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {!isTagging && (
        <button
          onClick={() => {
            if (areMarkersVisible) {
              savedMarkersRef.current.forEach(marker => marker.remove());
              hoverPopupRef.current?.remove();
              hoverPopupRef.current = null;
            } else {
              renderSavedMarkers();
            }
            setAreMarkersVisible(!areMarkersVisible);
            if (!areMarkersVisible) clearSelection();
          }}
          className="absolute bottom-[194px] right-[9px] z-50 bg:white bg-white border border-gray-300 rounded-[5px] w-8 h-8 flex items-center justify-center shadow-[0_0_8px_2px_rgba(0,0,0,0.15)] "
          title={areMarkersVisible ? "Hide Markers" : "Show Markers"}
        >
          <svg className="w-5 h-5 text-black" fill={!areMarkersVisible ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s6-5.686 6-10a6 6 0 10-12 0c0 4.314 6 10 6 10z" />
            <circle cx="12" cy="11" r="2" fill="white" />
          </svg>
        </button>
      )}

      <div
        className={`absolute top-0 left-0 h-full z-40 bg-white border-r border-gray-200 transition-all duration-200 ease-in-out overflow-hidden ${
          isSidebarVisible ? "w-[500px] px-6 py-8" : "w-0 px-0 py-0"
        }`}
      >
        {isSidebarVisible && (
          <CalamitySidebar
            mapStyles={mapStyles}
            setMapStyle={setMapStyle}
            showLayers={showLayers}
            setShowLayers={setShowLayers}
            zoomToBarangay={zoomToBarangay}
            onBarangaySelect={handleBarangaySelect}
            selectedBarangay={selectedBarangay}
            calamityTypes={calamityTypes}
            selectedCalamityType={selectedCalamityType}
            setSelectedCalamityType={setSelectedCalamityType}
            calamities={sidebarCalamities}
            selectedCalamity={selectedCalamity}
            setEnlargedImage={setEnlargedImage}
            visible={isSidebarVisible}
          />
        )}
      </div>

      <ToastContainer position="top-center" autoClose={3000} hideProgressBar pauseOnHover theme="light" style={{ zIndex: 9999 }} />

      {enlargedImage && (
        <div className="fixed inset-0 bg-black bg-opacity-90 z-[9999] flex justify-center items-center animate-fadeIn" onClick={() => setEnlargedImage(null)}>
          <button
            onClick={(e) => { e.stopPropagation(); setEnlargedImage(null); }}
            className="absolute top-4 right-4 text-white text-2xl font-bold z-[10000] hover:text-red-400"
            title="Close"
          >
            ×
          </button>
          <img src={enlargedImage} alt="Fullscreen Calamity" className="max-w-full max-h-full object-contain" />
        </div>
      )}
    </div>
  );
};

export default CalamityFarmerMap;
