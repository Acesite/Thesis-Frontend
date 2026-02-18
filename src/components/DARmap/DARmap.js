// src/components/AdminDAR/AdminDarMap.js
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
import { useLocation, useSearchParams } from "react-router-dom";

import DefaultThumbnail from "../MapboxImages/map-default.png";
import SatelliteThumbnail from "../MapboxImages/map-satellite.png";
import DarkThumbnail from "../MapboxImages/map-dark.png";
import LightThumbnail from "../MapboxImages/map-light.png";

import SidebarToggleButton from "./MapControls/SidebarToggleButton";
import BARANGAYS_FC from "../Barangays/barangays.json";

import DarSidebar from "./DARsidebar";
import TagDarForm from "./TagDarForm";

mapboxgl.accessToken =
  "pk.eyJ1Ijoid29tcHdvbXAtNjkiLCJhIjoiY204emxrOHkwMGJsZjJrcjZtZmN4YXdtNSJ9.LIMPvoBNtGuj4O36r3F72w";

const BAGO_CITY_BOUNDS = [
  [122.7333, 10.4958],
  [123.5, 10.6333],
];

/* ---------- tiny CSS for pulsing halo + chip ---------- */
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
function isSoftDeletedDar(rec) {
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
function getDarStatus(rec) {
  const raw = rec?.dar_status ?? rec?.status ?? rec?.award_status ?? "unknown";
  return String(raw || "unknown").toLowerCase();
}
function statusColor(status) {
  if (status === "awarded" || status === "approved") return "#10B981"; // green
  if (status === "pending") return "#F59E0B"; // amber
  if (status === "cancelled" || status === "revoked") return "#EF4444"; // red
  return "#3B82F6"; // blue
}

/* ---------- ID helper (dar table vs arb table) ---------- */
function getDarId(rec) {
  return rec.id ?? rec.arb_id ?? rec.dar_id ?? rec.cloa_id ?? rec.cloaNo ?? null;
}

/* ---------- coords helper (polygon or lat/lng fallback) ---------- */
function getRecordPolygonCoords(rec) {
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

/* ---------- geo helpers ---------- */
function explainGeoError(err) {
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
function startGeoWatch(onPos, onErr, opts) {
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
async function startCompass(onHeading) {
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

/* ---------- small UI button ---------- */
function IconButton({ title, active, onClick, children }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`w-9 h-9 grid place-items-center rounded-lg border transition shadow-sm ${
        active
          ? "bg-emerald-600 text-white border-emerald-600"
          : "bg-white text-gray-800 border-gray-300"
      } hover:shadow-md`}
    >
      {children}
    </button>
  );
}

/* ---------- barangay helpers ---------- */
function getBarangayName(props) {
  return props?.Barangay ?? props?.barangay ?? props?.NAME ?? props?.name ?? "";
}
function strictDetectBarangayForGeometry(geom, barangaysFC) {
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
function buildPolygonsFromDar(records = []) {
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

function getPolygonCenterFromCoords(coords) {
  if (!Array.isArray(coords) || coords.length < 3) return null;
  const first = coords[0];
  const last = coords[coords.length - 1];
  const ring = JSON.stringify(first) === JSON.stringify(last) ? coords : [...coords, first];
  const poly = turf.polygon([ring]);
  let pt = turf.centerOfMass(poly);
  if (!pt?.geometry?.coordinates) pt = turf.pointOnFeature(poly);
  return pt.geometry.coordinates;
}

/* ============================== PAGE ============================== */
const AdminDarMap = () => {
  addPulseStylesOnce();

  const locationState = useLocation().state || {};
  const [searchParams] = useSearchParams();

  const coerceNum = (val) => {
    if (val === null || val === undefined) return NaN;
    if (typeof val === "string" && val.trim() === "") return NaN;
    const n = Number(val);
    return Number.isFinite(n) ? n : NaN;
  };

  const target = {
    lat: coerceNum(locationState.lat ?? searchParams.get("lat")),
    lng: coerceNum(locationState.lng ?? searchParams.get("lng")),
    darId: String(locationState.darId ?? searchParams.get("darId") ?? ""),
    zoom: coerceNum(locationState.zoom ?? searchParams.get("zoom")),
  };
  if (!Number.isFinite(target.zoom)) target.zoom = 16;

  const mapContainer = useRef(null);
  const map = useRef(null);

  const directionsRef = useRef(null);
  const drawRef = useRef(null);

  const markerRef = useRef(null);
  const darMarkerMapRef = useRef(new Map());
  const savedMarkersRef = useRef([]);

  const selectedLabelRef = useRef(null);
  const selectedHaloRef = useRef(null);

  const hasDeepLinkedRef = useRef(false);

  const HILITE_SRC = "selected-dar-highlight-src";
  const HILITE_FILL = "selected-dar-highlight-fill";
  const HILITE_LINE = "selected-dar-highlight-line";
  const HILITE_ANIM_REF = useRef(null);

  const [mapStyle, setMapStyle] = useState(
    "mapbox://styles/wompwomp-69/cm900xa91008j01t14w8u8i9d"
  );

  const [showLayers, setShowLayers] = useState(false);
  const [isSwitcherVisible, setIsSwitcherVisible] = useState(false);

  const [selectedBarangay, setSelectedBarangay] = useState(null);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);

  const [sidebarDarRecords, setSidebarDarRecords] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);

  const [statusFilter, setStatusFilter] = useState("all");

  const userMarkerRef = useRef(null);
  const userMarkerElRef = useRef(null);
  const [userLoc, setUserLoc] = useState(null);
  const [tracking, setTracking] = useState(false);
  const watchStopRef = useRef(null);

  const [headingDeg, setHeadingDeg] = useState(null);
  const [compassOn, setCompassOn] = useState(false);
  const compassStopRef = useRef(null);
  const [rotateMapWithHeading, setRotateMapWithHeading] = useState(false);

  const [lockToBago, setLockToBago] = useState(true);

  const SIDEBAR_WIDTH = 500;
  const PEEK = 1;

  const mapStyles = {
    Default: {
      url: "mapbox://styles/wompwomp-69/cm900xa91008j01t14w8u8i9d",
      thumbnail: DefaultThumbnail,
    },
    Satellite: {
      url: "mapbox://styles/wompwomp-69/cm96vey9z009001ri48hs8j5n",
      thumbnail: SatelliteThumbnail,
    },
    Dark: {
      url: "mapbox://styles/wompwomp-69/cm96veqvt009101szf7g42jps",
      thumbnail: DarkThumbnail,
    },
    Light: {
      url: "mapbox://styles/wompwomp-69/cm976c2u700ab01rc0cns2pe0",
      thumbnail: LightThumbnail,
    },
  };

  const zoomToBarangay = (coordinates) => {
    if (map.current) map.current.flyTo({ center: coordinates, zoom: 14, essential: true });
  };

  const handleBarangaySelect = (barangayData) => {
    setSelectedBarangay(barangayData);
    if (markerRef.current) markerRef.current.remove();

    if (map.current && barangayData) {
      const el = document.createElement("div");
      el.className = "marker";
      el.style.width = "18px";
      el.style.height = "18px";
      el.style.borderRadius = "50%";
      el.style.backgroundColor = "#10B981";
      el.style.border = "3px solid white";
      el.style.boxShadow = "0 0 10px rgba(0,0,0,0.3)";

      const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
        <div class="text-sm">
          <h3 class="font-bold text-green-600 text-base">${barangayData.name}</h3>
          ${
            barangayData.population
              ? `<p><strong>Population:</strong> ${barangayData.population}</p>`
              : ""
          }
        </div>
      `);

      markerRef.current = new mapboxgl.Marker(el)
        .setLngLat(barangayData.coordinates)
        .setPopup(popup)
        .addTo(map.current);
      markerRef.current.togglePopup();
    }
  };

  /* ---------- terrain ---------- */
  const ensureTerrain = useCallback(() => {
    if (!map.current) return;
    const m = map.current;
    try {
      if (!m.getSource("mapbox-dem")) {
        m.addSource("mapbox-dem", {
          type: "raster-dem",
          url: "mapbox://mapbox.terrain-rgb",
          tileSize: 512,
          maxzoom: 14,
        });
      }
      m.setTerrain({ source: "mapbox-dem", exaggeration: 1 });
    } catch (err) {
      console.warn("DEM / terrain setup failed:", err);
    }
  }, []);

  /* ---------- barangay layers ---------- */
  const ensureBarangayLayers = useCallback(() => {
    if (!map.current) return;
    const m = map.current;
    if (!BARANGAYS_FC?.features?.length) return;

    if (!m.getSource("barangays-src")) {
      m.addSource("barangays-src", { type: "geojson", data: BARANGAYS_FC });
    }

    if (!m.getLayer("barangays-line")) {
      m.addLayer({
        id: "barangays-line",
        type: "line",
        source: "barangays-src",
        paint: { "line-color": "#1f2937", "line-width": 1, "line-opacity": 0.7 },
      });
    }

    if (!m.getLayer("barangays-labels")) {
      m.addLayer({
        id: "barangays-labels",
        type: "symbol",
        source: "barangays-src",
        layout: {
          "text-field": [
            "coalesce",
            ["get", "Barangay"],
            ["get", "barangay"],
            ["get", "NAME"],
            ["get", "name"],
            "",
          ],
          "symbol-placement": "point",
          "text-size": ["interpolate", ["linear"], ["zoom"], 10, 10, 12, 12, 14, 14, 16, 18],
          "text-font": ["Open Sans Semibold", "Arial Unicode MS Regular"],
          "text-allow-overlap": false,
        },
        paint: {
          "text-color": "#111827",
          "text-halo-color": "rgba(255,255,255,0.9)",
          "text-halo-width": 1.5,
          "text-halo-blur": 0.2,
        },
      });
    }
  }, []);

  /* ---------- selection cleanup ---------- */
  const clearSelection = useCallback(() => {
    if (!map.current) return;

    if (HILITE_ANIM_REF.current) {
      clearInterval(HILITE_ANIM_REF.current);
      HILITE_ANIM_REF.current = null;
    }

    selectedLabelRef.current?.remove();
    selectedLabelRef.current = null;
    selectedHaloRef.current?.remove();
    selectedHaloRef.current = null;

    if (map.current.getLayer(HILITE_FILL)) map.current.removeLayer(HILITE_FILL);
    if (map.current.getLayer(HILITE_LINE)) map.current.removeLayer(HILITE_LINE);
    if (map.current.getSource(HILITE_SRC)) map.current.removeSource(HILITE_SRC);
  }, []);

  const showMarkerChipAndHalo = useCallback((id, chipText, color = "#3B82F6") => {
    if (!map.current) return;

    selectedLabelRef.current?.remove();
    selectedLabelRef.current = null;
    selectedHaloRef.current?.remove();
    selectedHaloRef.current = null;

    const marker = darMarkerMapRef.current.get(String(id));
    if (!marker) return;
    const at = marker.getLngLat();

    const chip = document.createElement("div");
    chip.className = "chip";
    chip.textContent = chipText || "Selected parcel";
    chip.style.background = "#111827";

    selectedLabelRef.current = new mapboxgl.Marker({
      element: chip,
      anchor: "bottom",
      offset: [0, -42],
    })
      .setLngLat(at)
      .addTo(map.current);

    const haloWrap = document.createElement("div");
    haloWrap.className = "pulse-wrapper";
    const ring = document.createElement("div");
    ring.className = "pulse-ring";
    ring.style.background = "rgba(59,130,246,0.22)";
    ring.style.boxShadow = `0 0 0 2px ${color}55 inset`;

    haloWrap.appendChild(ring);

    selectedHaloRef.current = new mapboxgl.Marker({ element: haloWrap, anchor: "center" })
      .setLngLat(at)
      .addTo(map.current);
  }, []);

  const runWhenStyleReady = (cb) => {
    const m = map.current;
    if (!m) return;
    if (m.isStyleLoaded && m.isStyleLoaded()) {
      cb();
      return;
    }
    const onStyle = () => {
      if (m.isStyleLoaded && m.isStyleLoaded()) {
        m.off("styledata", onStyle);
        cb();
      }
    };
    m.on("styledata", onStyle);
  };

  const highlightPolygon = useCallback((rec) => {
    if (!map.current || !rec) return;

    const color = statusColor(getDarStatus(rec));
    const coords = getRecordPolygonCoords(rec);
    if (!coords) return;

    runWhenStyleReady(() => {
      const first = coords[0];
      const last = coords[coords.length - 1];
      const ring =
        JSON.stringify(first) === JSON.stringify(last) ? coords : [...coords, first];

      const feature = turf.polygon([ring], { id: getDarId(rec) });
      const m = map.current;

      if (!m.getSource(HILITE_SRC)) {
        m.addSource("selected-dar-highlight-src", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [feature] },
        });

        m.addLayer({
          id: "selected-dar-highlight-fill",
          type: "fill",
          source: "selected-dar-highlight-src",
          paint: { "fill-color": color, "fill-opacity": 0.18 },
        });

        m.addLayer({
          id: "selected-dar-highlight-line",
          type: "line",
          source: "selected-dar-highlight-src",
          paint: { "line-color": color, "line-width": 1.5, "line-opacity": 1 },
        });
      } else {
        m.getSource("selected-dar-highlight-src").setData({
          type: "FeatureCollection",
          features: [feature],
        });
        try {
          m.setPaintProperty("selected-dar-highlight-fill", "fill-color", color);
          m.setPaintProperty("selected-dar-highlight-line", "line-color", color);
        } catch {}
      }

      if (HILITE_ANIM_REF.current) {
        clearInterval(HILITE_ANIM_REF.current);
        HILITE_ANIM_REF.current = null;
      }
      let w = 2;
      let dir = +0.4;
      HILITE_ANIM_REF.current = setInterval(() => {
        if (!m.getLayer("selected-dar-highlight-line")) return;
        w += dir;
        if (w >= 4) dir = -0.3;
        if (w <= 1) dir = +0.3;
        try {
          m.setPaintProperty("selected-dar-highlight-line", "line-width", w);
        } catch {}
      }, 80);
    });
  }, []);

  const highlightSelection = useCallback(
    (rec) => {
      if (!map.current || !rec) return;

      clearSelection();

      const status = getDarStatus(rec);
      const color = statusColor(status);

      const cloa = rec.cloa_no ?? rec.cloaNo ?? "";
      const lot = rec.lot_no ?? rec.lotNo ?? "";
      const owner = rec.owner_name ?? rec.arb_name ?? rec.beneficiary_name ?? "";
      const label = owner ? owner : cloa ? `CLOA ${cloa}` : lot ? `Lot ${lot}` : "DAR Parcel";

      const id = getDarId(rec);

      if (id != null) {
        showMarkerChipAndHalo(id, label, color);
      }
      highlightPolygon(rec);

      const coords = getRecordPolygonCoords(rec);
      let center = coords ? getPolygonCenterFromCoords(coords) : null;

      if (!center) {
        const lng = Number(rec.longitude ?? rec.lng);
        const lat = Number(rec.latitude ?? rec.lat);
        if (Number.isFinite(lng) && Number.isFinite(lat)) center = [lng, lat];
      }

      if (center) {
        map.current.flyTo({
          center,
          zoom: Math.max(map.current.getZoom(), 16),
          essential: true,
        });
      }
    },
    [clearSelection, showMarkerChipAndHalo, highlightPolygon]
  );

  /* ---------- DAR polygons loader ---------- */
  const loadPolygons = useCallback(async (recordsOverride = null) => {
    if (!map.current) return;

    let records = recordsOverride;

    if (!records) {
      const res = await axios.get("http://localhost:5000/api/dar/arbs");
      const rows = res.data || [];
      records = rows.filter((r) => !isSoftDeletedDar(r));
    } else {
      records = (records || []).filter((r) => !isSoftDeletedDar(r));
    }

    const fullData = buildPolygonsFromDar(records);

    const paintStyle = {
      "fill-color": [
        "case",
        ["==", ["get", "status"], "awarded"],
        "#10B981",
        ["==", ["get", "status"], "pending"],
        "#F59E0B",
        ["==", ["get", "status"], "cancelled"],
        "#EF4444",
        "#3B82F6",
      ],
      "fill-opacity": 0.35,
    };

    if (map.current.getSource("dar-polygons")) {
      map.current.getSource("dar-polygons").setData(fullData);
      map.current.setPaintProperty(
        "dar-polygons-layer",
        "fill-color",
        paintStyle["fill-color"]
      );
    } else {
      map.current.addSource("dar-polygons", { type: "geojson", data: fullData });
      map.current.addLayer({
        id: "dar-polygons-layer",
        type: "fill",
        source: "dar-polygons",
        paint: paintStyle,
      });
      map.current.addLayer({
        id: "dar-polygons-outline",
        type: "line",
        source: "dar-polygons",
        paint: { "line-color": "#111827", "line-width": 1 },
      });
    }
  }, []);

  /* ---------- markers renderer ---------- */
  const renderSavedMarkers = useCallback(async () => {
    if (!map.current) return;

    try {
      const res = await axios.get("http://localhost:5000/api/dar/arbs");
      const allRows = res.data || [];
      let records = allRows.filter((r) => !isSoftDeletedDar(r));

      if (statusFilter !== "all") {
        records = records.filter((r) => getDarStatus(r) === statusFilter);
      }

      setSidebarDarRecords(records);

      savedMarkersRef.current.forEach((m) => m.remove());
      savedMarkersRef.current = [];
      darMarkerMapRef.current.clear();

      for (const rec of records) {
        const coords = getRecordPolygonCoords(rec);
        let center = coords ? getPolygonCenterFromCoords(coords) : null;

        if (!center) {
          const lng = Number(rec.longitude ?? rec.lng);
          const lat = Number(rec.latitude ?? rec.lat);
          if (Number.isFinite(lng) && Number.isFinite(lat)) {
            center = [lng, lat];
          }
        }

        if (!center) continue;

        const status = getDarStatus(rec);
        const color = statusColor(status);

        const marker = new mapboxgl.Marker({ color }).setLngLat(center).addTo(map.current);

        marker.getElement().addEventListener("click", () => {
          setSelectedRecord(rec);
          highlightSelection(rec);
          setIsSidebarVisible(true);
        });

        const id = getDarId(rec);
        if (id != null) {
          darMarkerMapRef.current.set(String(id), marker);
        }
        savedMarkersRef.current.push(marker);
      }

      if (!hasDeepLinkedRef.current && target.darId && records.length) {
        const hit = records.find((r) => String(getDarId(r)) === String(target.darId));
        if (hit) {
          setSelectedRecord(hit);
          setIsSidebarVisible(true);
          highlightSelection(hit);
          hasDeepLinkedRef.current = true;
        }
      }
    } catch (err) {
      console.error("Failed to load DAR markers:", err);
      toast.error("Failed to load DAR records.");
    }
  }, [statusFilter, target.darId, highlightSelection]);

  /* ---------- init map ---------- */
  useEffect(() => {
    if (!map.current) {
      const m = new mapboxgl.Map({
        container: mapContainer.current,
        style: mapStyle,
        center: [122.9616, 10.5074],
        zoom: 7,
      });
      map.current = m;

      if (lockToBago) m.setMaxBounds(BAGO_CITY_BOUNDS);

      drawRef.current = new MapboxDraw({
        displayControlsDefault: false,
        controls: { polygon: true, trash: true },
      });

      m.addControl(drawRef.current, "bottom-right");
      m.addControl(new mapboxgl.NavigationControl(), "bottom-right");

      m.on("load", async () => {
        ensureTerrain();
        ensureBarangayLayers();

        if (!directionsRef.current) {
          const directions = new MapboxDirections({
            accessToken: mapboxgl.accessToken,
            unit: "metric",
            profile: "mapbox/driving",
            controls: { instructions: true, profileSwitcher: true },
          });
          directionsRef.current = directions;
          m.addControl(directions, "top-left");
        }

        try {
          await loadPolygons();
          await renderSavedMarkers();
        } catch (e) {
          console.error(e);
        }

        if (!hasDeepLinkedRef.current) {
          let focus = null;
          if (Number.isFinite(target.lat) && Number.isFinite(target.lng))
            focus = [target.lng, target.lat];
          if (focus) {
            hasDeepLinkedRef.current = true;
            m.flyTo({ center: focus, zoom: target.zoom, essential: true });
          }
        }
      });

      m.on("click", "dar-polygons-layer", (e) => {
        const feature = e.features?.[0];
        const id = feature?.properties?.id;
        if (!id) return;

        const hit = sidebarDarRecords.find(
          (r) => String(getDarId(r)) === String(id)
        );
        if (hit && !isSoftDeletedDar(hit)) {
          setSelectedRecord(hit);
          highlightSelection(hit);
          setIsSidebarVisible(true);
        }
      });

      const handleDrawAttempt = (feature) => {
        if (!feature || !feature.geometry) return;
        if (feature.geometry.type !== "Polygon" && feature.geometry.type !== "MultiPolygon")
          return;

        const poly = feature.geometry;
        const detection = strictDetectBarangayForGeometry(poly, BARANGAYS_FC);

        if (!detection) {
          try {
            drawRef.current?.delete(feature.id);
          } catch {}
          toast.error(
            "The tagged area is outside of a single barangay boundary. Draw within one barangay."
          );
          return false;
        }

        const ring =
          poly.type === "Polygon" ? poly.coordinates?.[0] : poly.coordinates?.[0]?.[0];

        const area = turf.area({ type: "Feature", geometry: poly, properties: {} });
        const hectares = +(area / 10000).toFixed(2);

        setSelectedBarangay({ name: detection.name, coordinates: detection.centroid });

        setTagLocation({
          coordinates: ring,
          hectares,
          farmGeometry: poly,
        });
        setIsTagging(true);
        return true;
      };

      m.on("draw.create", (e) => {
        const feature = e.features?.[0];
        handleDrawAttempt(feature);
      });

      m.on("draw.update", (e) => {
        const feature = e.features?.[0];
        const ok = handleDrawAttempt(feature);
        if (!ok) {
          try {
            drawRef.current?.delete(feature.id);
          } catch {}
        }
      });
    } else {
      map.current.setStyle(mapStyle);
      map.current.once("style.load", async () => {
        ensureTerrain();
        ensureBarangayLayers();
        await loadPolygons();
        await renderSavedMarkers();
        if (selectedRecord) highlightSelection(selectedRecord);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    mapStyle,
    lockToBago,
    ensureTerrain,
    ensureBarangayLayers,
    loadPolygons,
    renderSavedMarkers,
    highlightSelection,
  ]);

  // lock toggle
  useEffect(() => {
    if (!map.current) return;
    if (lockToBago) map.current.setMaxBounds(BAGO_CITY_BOUNDS);
    else map.current.setMaxBounds(null);
  }, [lockToBago]);

  // cleanup
  useEffect(() => {
    return () => {
      watchStopRef.current?.();
      userMarkerRef.current?.remove();
      compassStopRef.current?.();
      clearSelection();

      if (HILITE_ANIM_REF.current) {
        clearInterval(HILITE_ANIM_REF.current);
        HILITE_ANIM_REF.current = null;
      }

      if (map.current) {
        try {
          map.current.remove();
        } catch {}
        map.current = null;
      }
      directionsRef.current = null;
    };
  }, [clearSelection]);

  /* ---------- tagging state ---------- */
  const [isTagging, setIsTagging] = useState(false);
  const [tagLocation, setTagLocation] = useState(null);

  /* ---------- GPS marker ---------- */
  const handleFix = useCallback(
    (glng, glat, accuracy) => {
      if (!map.current) return;

      const lng = Number(glng);
      const lat = Number(glat);
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
        toast.error("Invalid GPS coordinates from browser.");
        return;
      }

      const safeAcc = Number.isFinite(Number(accuracy)) ? Number(accuracy) : 10;

      if (lockToBago && !isInsideBounds([lng, lat], BAGO_CITY_BOUNDS)) {
        const expanded = expandBoundsToIncludePoint(BAGO_CITY_BOUNDS, [lng, lat], 0.05);
        map.current.setMaxBounds(expanded);
        toast.info("Outside Bago. Temporarily expanded bounds to include your location.");
      }

      setUserLoc({ lng, lat, acc: safeAcc });

      if (!userMarkerElRef.current) {
        const el = document.createElement("div");
        el.style.width = "16px";
        el.style.height = "16px";
        el.style.borderRadius = "50%";
        el.style.background = "#2563eb";
        el.style.border = "2px solid white";
        el.style.boxShadow = "0 0 8px rgba(37,99,235,0.45)";
        userMarkerElRef.current = el;

        userMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat([lng, lat])
          .setPopup(new mapboxgl.Popup({ offset: 12 }).setText("You are here"))
          .addTo(map.current);
      } else {
        userMarkerRef.current.setLngLat([lng, lat]);
      }

      map.current.easeTo({
        center: [lng, lat],
        zoom: Math.max(map.current.getZoom(), 15),
        duration: 0,
        essential: true,
      });
    },
    [lockToBago]
  );

  /* ============================== UI ============================== */
  return (
    <div className="relative h-full w-full">
      {/* GPS / toolbar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-white/70 backdrop-blur rounded-xl p-2 shadow-md">
        <IconButton
          title="Locate me"
          active={false}
          onClick={async () => {
            if (!("geolocation" in navigator)) {
              toast.error("Geolocation not supported by this browser.");
              return;
            }
            try {
              const pos = await new Promise((resolve, reject) =>
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                  enableHighAccuracy: true,
                  timeout: 15000,
                  maximumAge: 0,
                })
              );
              const { longitude, latitude, accuracy } = pos.coords;
              handleFix(Number(longitude), Number(latitude), accuracy);
            } catch (e) {
              toast.error(explainGeoError(e));
            }
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2a1 1 0 0 1 1 1v1.06A8.004 8.004 0 0 1 19.94 11H21a1 1 0 1 1 0 2h-1.06A8.004 8.004 0 0 1 13 19.94V21a1 1 0 1 1-2 0v-1.06A8.004 8.004 0 0 1 4.06 13H3a1 1 0 1 1 0-2h1.06A8.004 8.004 0 0 1 11 4.06V3a1 1 0 0 1 1-1Zm0 4a6 6 0 1 0 .001 12.001A6 6 0 0 0 12 6Zm0 3.5a2.5 2.5 0 1 1 0 5.001A2.5 2.5 0 0 1 12 9.5Z" />
          </svg>
        </IconButton>

        <IconButton
          title={tracking ? "Stop tracking" : "Start tracking"}
          active={tracking}
          onClick={() => {
            if (!("geolocation" in navigator)) {
              toast.error("Geolocation not supported.");
              return;
            }
            if (!tracking) {
              const stop = startGeoWatch(
                (pos) => {
                  const { longitude, latitude, accuracy, heading } = pos.coords;
                  handleFix(Number(longitude), Number(latitude), accuracy);
                  if (typeof heading === "number" && !Number.isNaN(heading)) {
                    setHeadingDeg(heading);
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
              watchStopRef.current?.();
              watchStopRef.current = null;
              setTracking(false);
              toast.info("Live tracking OFF");
            }
          }}
        >
          {tracking ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 8h3v8H8V8zm5 0h3v8h-3V8z" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7L8 5z" />
            </svg>
          )}
        </IconButton>

        <IconButton
          title={compassOn ? "Stop compass" : "Start compass"}
          active={compassOn}
          onClick={async () => {
            if (!compassOn) {
              try {
                compassStopRef.current = await startCompass((deg) => {
                  setHeadingDeg(deg);
                  if (rotateMapWithHeading && map.current) map.current.setBearing(deg);
                });
                setCompassOn(true);
                toast.success("Compass ON");
              } catch (e) {
                toast.error(e?.message || "Failed to start compass.");
              }
            } else {
              compassStopRef.current?.();
              compassStopRef.current = null;
              setCompassOn(false);
              toast.info("Compass OFF");
            }
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2a10 10 0 1 0 .001 20.001A10 10 0 0 0 12 2Zm3.7 6.3-2.6 6.5a1 1 0 0 1-.6.6l-6.5 2.6 2.6-6.5Z" />
          </svg>
        </IconButton>

        <IconButton
          title="Follow heading (rotate map)"
          active={rotateMapWithHeading}
          onClick={() => setRotateMapWithHeading((v) => !v)}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2 6 22l6-5 6 5-6-20z" />
          </svg>
        </IconButton>

        <IconButton
          title={lockToBago ? "Unlock map" : "Lock to Bago"}
          active={lockToBago}
          onClick={() => {
            setLockToBago((prev) => {
              const next = !prev;
              toast.info(
                next ? "Map locked to Bago City boundaries." : "Map unlocked. You can pan anywhere."
              );
              return next;
            });
          }}
        >
          {lockToBago ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17 8h-1V6a4 4 0 1 0-8 0v2H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2Zm-7-2a2 2 0 1 1 4 0v2h-4V6Z" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17 8h-1V6a4 4 0 0 0-7.33-2.4l1.5 1.32A2 2 0 0 1 13 6v2H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2Z" />
            </svg>
          )}
        </IconButton>
      </div>

      {/* Map */}
      <div ref={mapContainer} className="h-full w-full" />

      {/* Tag form (DAR) */}
      {isTagging && tagLocation && (
        <TagDarForm
          defaultLocation={{ ...tagLocation }}
          selectedBarangay={selectedBarangay?.name}
          barangaysFC={BARANGAYS_FC}
          farmGeometry={tagLocation.farmGeometry}
          onCancel={() => {
            setIsTagging(false);
            setTagLocation(null);
            drawRef.current?.deleteAll();
          }}
          onSave={async (formData) => {
            try {
              await axios.post("http://localhost:5000/api/dar/arbs", formData, {
                headers: { "Content-Type": "multipart/form-data" },
              });
              toast.success("DAR record saved!");
              await loadPolygons();
              await renderSavedMarkers();
            } catch (error) {
              const msg =
                error?.response?.data?.message ||
                error?.response?.data?.error ||
                error?.message ||
                "Unknown server error";
              toast.error(`Failed to save DAR record: ${msg}`);
            } finally {
              setIsTagging(false);
              setTagLocation(null);
              drawRef.current?.deleteAll();
            }
          }}
        />
      )}

      {/* Layers button (when sidebar hidden) */}
      {!isSidebarVisible && (
        <button
          onClick={() => setIsSwitcherVisible(!isSwitcherVisible)}
          className="absolute bottom-6 left-4 w-20 h-20 rounded-xl shadow-md overflow-hidden z-30 bg-white border border-gray-300 hover:shadow-lg transition"
          title="Map layers"
        >
          <div className="w-full h-full relative">
            <img src={DefaultThumbnail} alt="Layers" className="w-full h-full object-cover" />
            <div className="absolute bottom-0 left-0 right-0 text-white text-xs font-semibold px-2 py-1 bg-black/60 text-center">
              Layers
            </div>
          </div>
        </button>
      )}

      {!isSidebarVisible && isSwitcherVisible && (
        <div className="absolute bottom-28 left-4 bg-white p-2 rounded-xl shadow-xl flex space-x-2 z-30 transition-all duration-300">
          {Object.entries(mapStyles).map(([label, { url, thumbnail }]) => (
            <button
              key={label}
              onClick={() => {
                setMapStyle(url);
                setIsSwitcherVisible(false);
              }}
              className="w-16 h-16 rounded-md border border-gray-300 overflow-hidden relative hover:shadow-md"
              title={label}
            >
              <img src={thumbnail} alt={label} className="w-full h-full object-cover" />
              <div className="absolute bottom-0 w-full text-[10px] text-white text-center bg-black/60 py-[2px]">
                {label}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Sidebar toggle */}
      <SidebarToggleButton
        onClick={() => setIsSidebarVisible(!isSidebarVisible)}
        isSidebarVisible={isSidebarVisible}
        sidebarWidth={SIDEBAR_WIDTH}
        peek={PEEK}
      />

      {/* Sidebar with slide animation */}
      <div
        className={`absolute top-0 left-0 h-full z-40 bg-gray-50 border-r border-gray-200 transition-all duration-200 ease-in-out overflow-hidden ${
          isSidebarVisible ? "w-[500px]" : "w-0"
        }`}
      >
        <DarSidebar
          visible={isSidebarVisible}
          zoomToBarangay={zoomToBarangay}
          onBarangaySelect={handleBarangaySelect}
          records={sidebarDarRecords}
          selectedRecord={selectedRecord}
          onSelectRecord={(rec) => {
            setSelectedRecord(rec);
            highlightSelection(rec);
            setIsSidebarVisible(true);
          }}
          mapStyles={mapStyles}
          setMapStyle={setMapStyle}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          onRefresh={async () => {
            await loadPolygons();
            await renderSavedMarkers();
          }}
        />
      </div>

      <ToastContainer
        position="top-center"
        autoClose={3000}
        hideProgressBar
        pauseOnHover
        theme="light"
        style={{ zIndex: 9999 }}
      />
    </div>
  );
};

export default AdminDarMap;
