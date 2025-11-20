// AdminMapBox.jsx
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
import AdminSidebar from "./AdminSideBar";
import DefaultThumbnail from "../MapboxImages/map-default.png";
import SatelliteThumbnail from "../MapboxImages/map-satellite.png";
import DarkThumbnail from "../MapboxImages/map-dark.png";
import LightThumbnail from "../MapboxImages/map-light.png";
import SidebarToggleButton from "./MapControls/SidebarToggleButton";
import TagCropForm from "./TagCropForm";
import { useLocation, useSearchParams } from "react-router-dom";
import BARANGAYS_FC from "../Barangays/barangays.json";

mapboxgl.accessToken =
  "pk.eyJ1Ijoid29tcHdvbXAtNjkiLCJhIjoiY204emxrOHkwMGJsZjJrcjZtZmN4YXdtNSJ9.LIMPvoBNtGuj4O36r3F72w";

const BAGO_CITY_BOUNDS = [
  [122.7333, 10.4958],
  [123.5, 10.6333],
];

/* ---------- tiny CSS for pulsing halo + chip + hover popup ---------- */
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
  .pulse-ring { position: absolute; left: 50%; top: 50%; width: 44px; height: 44px; border-radius: 9999px; background: rgba(16,185,129,0.35); box-shadow: 0 0 0 2px rgba(16,185,129,0.55) inset; animation: pulseRing 1.8s ease-out infinite; }
  .chip { font-family: system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif; font-size: 12px; font-weight: 600; padding: 4px 8px; background: #111827; color: #fff; border-radius: 9999px; box-shadow: 0 1px 3px rgba(0,0,0,0.25); transform: translate(-50%, -8px); white-space: nowrap; }

  /* transparent shell for hover preview popup */
  .mapboxgl-popup.crop-hover-preview { pointer-events: none !important; }
  .mapboxgl-popup.crop-hover-preview .mapboxgl-popup-content {
    background: transparent !important;
    padding: 0 !important;
    box-shadow: none !important;
    border: none !important;
    border-radius: 0 !important;
  }
  .mapboxgl-popup.crop-hover-preview .mapboxgl-popup-tip { display: none !important; }
  `;
  document.head.appendChild(style);
};

/* ---------- hover preview helpers (image + card HTML) ---------- */
function resolveCropImageURL(crop) {
  let raw =
    crop?.thumbnail_url ||
    crop?.image_url ||
    crop?.photo_url ||
    crop?.image ||
    crop?.photo ||
    crop?.image_path ||
    null;

  if (!raw && crop?.photos) {
    try {
      const arr =
        typeof crop.photos === "string" ? JSON.parse(crop.photos) : crop.photos;
      if (Array.isArray(arr) && arr[0]) raw = arr[0];
    } catch {}
  }

  if (!raw) return null;

  if (
    /^(https?:)?\/\//i.test(raw) ||
    raw.startsWith("data:") ||
    raw.startsWith("blob:")
  )
    return raw;

  if (raw.startsWith("/")) return `http://localhost:5000${raw}`;
  return `http://localhost:5000/${raw}`;
}
function isCropHarvested(crop) {
  if (!crop) return false;
  return (
    Number(crop.is_harvested) === 1 ||
    crop.is_harvested === true ||
    !!crop.harvested_date
  );
}

function buildCropPreviewHTML(c) {
  const img = resolveCropImageURL(c);
  const name = c.crop_name || "Crop";
  const variety = c.variety_name || "";
  const barangay = c.barangay || c.farmer_barangay || "";
  const planted = c.planted_date
    ? new Date(c.planted_date).toLocaleDateString()
    : "";
  const harvest = c.estimated_harvest
    ? new Date(c.estimated_harvest).toLocaleDateString()
    : "";
  const hectares = c.estimated_hectares;
  const volume = c.estimated_volume;

  return `
    <div style="width:280px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
      <div style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 10px 25px rgba(0,0,0,.15);">
        ${
          img
            ? `<div style="width:100%;height:160px;overflow:hidden;position:relative;">
                 <img src="${img}" alt="${name}" referrerpolicy="no-referrer"
                      style="width:100%;height:100%;object-fit:cover;" />
               </div>`
            : `<div style="width:100%;height:160px;display:grid;place-items:center;
                           background:linear-gradient(135deg,#f3f4f6 0%,#e5e7eb 100%);
                           color:#9ca3af;">
                 <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" stroke-width="2">
                   <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                   <circle cx="8.5" cy="8.5" r="1.5"></circle>
                   <polyline points="21 15 16 10 5 21"></polyline>
                 </svg>
               </div>`
        }
        <div style="padding:12px;">
          <div style="font-weight:700;font-size:16px;color:#047857;margin-bottom:4px;">
            ${name}
          </div>
          ${
            variety
              ? `<div style="font-size:13px;color:#6b7280;margin-bottom:4px;">
                   Variety: <strong>${variety}</strong>
                 </div>`
              : ""
          }
          ${
            barangay
              ? `<div style="font-size:13px;color:#6b7280;margin-bottom:6px;display:flex;align-items:center;gap:4px;">
                   <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                        stroke="#6b7280" stroke-width="2">
                     <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                     <circle cx="12" cy="10" r="3"></circle>
                   </svg>
                   <span><strong>Barangay:</strong> ${barangay}</span>
                 </div>`
              : ""
          }
          <div style="font-size:12px;color:#4b5563;display:flex;flex-wrap:wrap;gap:6px;margin-top:4px;">
            ${
              hectares != null
                ? `<span>Area: <strong>${hectares}</strong> ha</span>`
                : ""
            }
            ${
              volume != null
                ? `<span>Est. volume: <strong>${volume}</strong></span>`
                : ""
            }
          </div>
          ${
            planted || harvest
              ? `<div style="font-size:12px;color:#6b7280;margin-top:6px;">
                   ${
                     planted
                       ? `<span>Planted: <strong>${planted}</strong></span>`
                       : ""
                   }
                   ${
                     planted && harvest ? " · " : ""
                   }${
                     harvest
                       ? `<span>Harvest: <strong>${harvest}</strong></span>`
                       : ""
                   }
                 </div>`
              : ""
          }
        </div>
      </div>
    </div>
  `;
}

/* ---------- accuracy circle ---------- */
function makeAccuracyCircle([lng, lat], accuracy) {
  const accNum = Number(accuracy);
  const safeAcc = Number.isFinite(accNum) ? accNum : 10;
  const radiusKm = Math.max(safeAcc, 10) / 1000;
  return turf.circle([lng, lat], radiusKm, { steps: 64, units: "kilometers" });
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

/* ---------- geolocation helpers ---------- */
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
    onErr?.({
      code: 2,
      message: "Geolocation watch not supported in this browser.",
    });
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

/* ---------- icon button ---------- */
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

const AdminMapBox = () => {
  addPulseStylesOnce();

  // deep-link target
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
    cropId: String(locationState.cropId ?? searchParams.get("cropId") ?? ""),
    cropName: locationState.cropName ?? searchParams.get("cropName") ?? "",
    barangay: locationState.barangay ?? searchParams.get("barangay") ?? "",
    zoom: coerceNum(locationState.zoom ?? searchParams.get("zoom")),
  };
  if (!Number.isFinite(target.zoom)) target.zoom = 16;

  const mapContainer = useRef(null);
  const map = useRef(null);
  const markerRef = useRef(null);
  const directionsRef = useRef(null);
  const drawRef = useRef(null);

  const cropMarkerMapRef = useRef(new Map());
  const selectedLabelRef = useRef(null);
  const selectedHaloRef = useRef(null);

  // NEW: hover popup refs
  const hoverPopupRef = useRef(null);
  const hoverLeaveTimerRef = useRef(null);

  const HILITE_SRC = "selected-crop-highlight-src";
  const HILITE_FILL = "selected-crop-highlight-fill";
  const HILITE_LINE = "selected-crop-highlight-line";

  const HILITE_ANIM_REF = useRef(null);
  const hasDeepLinkedRef = useRef(false);
  const savedMarkersRef = useRef([]);

  const [mapStyle, setMapStyle] = useState(
    "mapbox://styles/wompwomp-69/cm900xa91008j01t14w8u8i9d"
  );
  const [showLayers, setShowLayers] = useState(false);
  const [isSwitcherVisible, setIsSwitcherVisible] = useState(false);

  const [selectedBarangay, setSelectedBarangay] = useState(null);

  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [isDirectionsVisible, setIsDirectionsVisible] = useState(false);
  const [newTagLocation, setNewTagLocation] = useState(null);
  const [isTagging, setIsTagging] = useState(false);
  const [taggedData] = useState([]);

  const [sidebarCrops, setSidebarCrops] = useState([]);
  const [selectedCrop, setSelectedCrop] = useState(null);
  const [selectedCropType, setSelectedCropType] = useState("All");
  const [cropTypes, setCropTypes] = useState([]);
  const [areMarkersVisible, setAreMarkersVisible] = useState(true);
  const [enlargedImage, setEnlargedImage] = useState(null);
const [harvestFilter, setHarvestFilter] = useState("all");

  // GPS / heading
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
    if (map.current)
      map.current.flyTo({ center: coordinates, zoom: 14, essential: true });
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
          ${
            barangayData.crops
              ? `<p><strong>Crops:</strong> ${barangayData.crops.join(", ")}</p>`
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

  /* ---------- marker rendering WITH hover preview ---------- */
const renderSavedMarkers = useCallback(async () => {
  try {
    const response = await axios.get("http://localhost:5000/api/crops");
    const crops = response.data;
    setSidebarCrops(crops);

    // clear previous markers & hover popup
    savedMarkersRef.current.forEach((marker) => marker.remove());
    savedMarkersRef.current = [];
    cropMarkerMapRef.current.clear();
    if (hoverPopupRef.current) {
      try {
        hoverPopupRef.current.remove();
      } catch {}
      hoverPopupRef.current = null;
    }

    // 🔹 first filter by crop type
    const filteredByType =
      selectedCropType === "All"
        ? crops
        : crops.filter((c) => c.crop_name === selectedCropType);

    // 🔹 then filter by harvest status
    let filtered = filteredByType;
    if (harvestFilter === "harvested") {
      filtered = filtered.filter((c) => isCropHarvested(c));
    } else if (harvestFilter === "not_harvested") {
      filtered = filtered.filter((c) => !isCropHarvested(c));
    }

    for (const crop of filtered) {
      let coords = crop.coordinates;
      if (typeof coords === "string") {
        try {
          coords = JSON.parse(coords);
        } catch {
          continue;
        }
      }
      if (Array.isArray(coords) && coords.length > 2) {
        const first = coords[0];
        const last = coords[coords.length - 1];
        if (JSON.stringify(first) !== JSON.stringify(last)) coords.push(first);

        const center = turf.centerOfMass(turf.polygon([coords])).geometry
          .coordinates;

        // 🔹 use helper here too
        const isHarvested = isCropHarvested(crop);
        const marker = new mapboxgl.Marker({
          color: isHarvested ? "#6B7280" : "#10B981", // gray vs green
        })
          .setLngLat(center)
          .setPopup(
            new mapboxgl.Popup({ offset: 15 }).setHTML(`
              <div class="text-sm">
                <h3 class='font-bold text-green-600'>${crop.crop_name}</h3>
                <p><strong>Variety:</strong> ${crop.variety_name || "N/A"}</p>
              </div>
            `)
          )
          .addTo(map.current);

        // click = select crop
        marker.getElement().addEventListener("click", () => {
          setSelectedCrop(crop);
          highlightSelection(crop);
          setIsSidebarVisible(true);
        });

        // HOVER = fancy preview card
        marker.getElement().addEventListener("mouseenter", () => {
          if (hoverLeaveTimerRef.current) {
            clearTimeout(hoverLeaveTimerRef.current);
            hoverLeaveTimerRef.current = null;
          }
          try {
            hoverPopupRef.current?.remove();
          } catch {}
          const html = buildCropPreviewHTML(crop);
          const popup = new mapboxgl.Popup({
            closeButton: false,
            closeOnClick: false,
            closeOnMove: false,
            offset: 30,
            anchor: "top",
            className: "crop-hover-preview",
            maxWidth: "none",
          })
            .setLngLat(center)
            .setHTML(html)
            .addTo(map.current);

          setTimeout(() => {
            const el = popup.getElement();
            const content = el?.querySelector(".mapboxgl-popup-content");
            const tip = el?.querySelector(".mapboxgl-popup-tip");
            if (content) {
              content.style.background = "transparent";
              content.style.padding = "0";
              content.style.boxShadow = "none";
            }
            if (tip) tip.style.display = "none";
          }, 0);

          hoverPopupRef.current = popup;
        });

        marker.getElement().addEventListener("mouseleave", () => {
          hoverLeaveTimerRef.current = setTimeout(() => {
            if (hoverPopupRef.current) {
              try {
                hoverPopupRef.current.remove();
              } catch {}
              hoverPopupRef.current = null;
            }
          }, 140);
        });

        cropMarkerMapRef.current.set(String(crop.id), marker);
        savedMarkersRef.current.push(marker);
      }
    }

    ensureDeepLinkSelection();
  } catch (error) {
    console.error("Failed to load saved markers:", error);
  }
}, [selectedCropType, harvestFilter]); // ⬅️ include harvestFilter here


  const loadPolygons = useCallback(async (geojsonData = null, isFiltered = false) => {
    const res = await axios.get("http://localhost:5000/api/crops/polygons");
    const fullData = geojsonData || res.data;

   const baseColorByCrop = [
  "match",
  ["get", "crop_name"],
  "Rice", "#facc15",
  "Corn", "#fb923c",
  "Banana", "#a3e635",
  "Sugarcane", "#34d399",
  "Cassava", "#60a5fa",
  "Vegetables", "#f472b6",
  /* other */ "#10B981",
];

const paintStyle = {
  "fill-color": [
    "case",
    ["==", ["get", "is_harvested"], 1],
    "#9CA3AF",        // ✅ gray for harvested polygons
    baseColorByCrop   // normal color for not-yet-harvested
  ],
  "fill-opacity": 0.4,
};


    if (map.current.getSource("crop-polygons")) {
      map.current.getSource("crop-polygons").setData(fullData);
      map.current.setPaintProperty(
        "crop-polygons-layer",
        "fill-color",
        paintStyle["fill-color"]
      );
    } else {
      map.current.addSource("crop-polygons", {
        type: "geojson",
        data: fullData,
      });
      map.current.addLayer({
        id: "crop-polygons-layer",
        type: "fill",
        source: "crop-polygons",
        paint: paintStyle,
      });
      map.current.addLayer({
        id: "crop-polygons-outline",
        type: "line",
        source: "crop-polygons",
        paint: { "line-color": "#065F46", "line-width": 2 },
      });
    }
  }, []);

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
  }, []);

  // GPS accuracy ring
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
        id: USER_ACC_LAYER,
        type: "fill",
        source: USER_ACC_SOURCE,
        paint: { "fill-color": "#3b82f6", "fill-opacity": 0.15 },
      });
    }
    if (!m.getLayer(USER_ACC_OUTLINE)) {
      m.addLayer({
        id: USER_ACC_OUTLINE,
        type: "line",
        source: USER_ACC_SOURCE,
        paint: { "line-color": "#2563eb", "line-width": 2 },
      });
    }
  }, []);

  const updateUserAccuracyCircle = useCallback(
    (lng, lat, acc) => {
      if (!map.current) return;
      ensureUserAccuracyLayers();
      const circle = makeAccuracyCircle([lng, lat], acc);
      map.current.getSource(USER_ACC_SOURCE).setData(circle);
    },
    [ensureUserAccuracyLayers]
  );

  const setUserMarker = useCallback(
    (lng, lat, acc) => {
      if (!map.current) return;

      const nLng = Number(lng);
      const nLat = Number(lat);
      if (!Number.isFinite(nLng) || !Number.isFinite(nLat)) {
        console.error("Invalid coords in setUserMarker:", { lng, lat });
        toast.error("Invalid GPS coordinates.");
        return;
      }

      const m = map.current;

      if (!userMarkerElRef.current) {
        const el = document.createElement("div");
        el.style.position = "relative";
        el.style.width = "26px";
        el.style.height = "26px";
        el.style.borderRadius = "50%";
        el.style.border = "2px solid rgba(37,99,235,0.55)";
        el.style.background = "rgba(37,99,235,0.10)";
        el.style.boxShadow = "0 0 4px rgba(37,99,235,0.35)";

        const triangle = document.createElement("div");
        triangle.style.position = "absolute";
        triangle.style.left = "50%";
        triangle.style.top = "50%";
        triangle.style.transform = "translate(-50%, -55%)";
        triangle.style.width = "0";
        triangle.style.height = "0";
        triangle.style.borderLeft = "7px solid transparent";
        triangle.style.borderRight = "7px solid transparent";
        triangle.style.borderBottom = "12px solid #2563eb";

        el.appendChild(triangle);

        userMarkerElRef.current = el;

        userMarkerRef.current = new mapboxgl.Marker({
          element: el,
          anchor: "center",
        })
          .setLngLat([nLng, nLat])
          .setPopup(new mapboxgl.Popup({ offset: 12 }).setText("You are here"))
          .addTo(m);
      } else {
        userMarkerRef.current.setLngLat([nLng, nLat]);
      }

      const accNum = Number(acc);
      const safeAcc = Number.isFinite(accNum) ? accNum : 10;
      updateUserAccuracyCircle(nLng, nLat, safeAcc);

      m.easeTo({
        center: [nLng, nLat],
        zoom: Math.max(m.getZoom(), 15),
        duration: 0,
        essential: true,
      });
    },
    [updateUserAccuracyCircle]
  );

  const handleFix = useCallback(
    (glng, glat, accuracy) => {
      if (!map.current) return;

      const lng = Number(glng);
      const lat = Number(glat);

      if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
        console.error("Invalid coords in handleFix:", { glng, glat });
        toast.error("Invalid GPS coordinates from browser.");
        return;
      }

      const accNum = Number(accuracy);
      const safeAcc = Number.isFinite(accNum) ? accNum : 10;

      if (lockToBago && !isInsideBounds([lng, lat], BAGO_CITY_BOUNDS)) {
        const expanded = expandBoundsToIncludePoint(
          BAGO_CITY_BOUNDS,
          [lng, lat],
          0.05
        );
        map.current.setMaxBounds(expanded);
        toast.info(
          "You’re outside Bago. Temporarily expanded bounds to include your location."
        );
      }

      setUserLoc({ lng, lat, acc: safeAcc });
      setUserMarker(lng, lat, safeAcc);
    },
    [lockToBago, setUserMarker]
  );

  function getCropCenter(crop) {
    let coords = crop?.coordinates;
    if (!coords) return null;
    if (typeof coords === "string") {
      try {
        coords = JSON.parse(coords);
      } catch {
        return null;
      }
    }
    if (!Array.isArray(coords) || coords.length < 3) return null;
    const first = coords[0];
    const last = coords[coords.length - 1];
    if (JSON.stringify(first) !== JSON.stringify(last)) coords = [...coords, first];
    const poly = turf.polygon([coords]);
    let pt = turf.centerOfMass(poly);
    if (!pt?.geometry?.coordinates) pt = turf.pointOnFeature(poly);
    return pt.geometry.coordinates;
  }

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

  const showMarkerChipAndHalo = useCallback((cropId, chipText = "Selected crop") => {
    if (!map.current) return;

    selectedLabelRef.current?.remove();
    selectedLabelRef.current = null;
    selectedHaloRef.current?.remove();
    selectedHaloRef.current = null;

    const marker = cropMarkerMapRef.current.get(String(cropId));
    if (!marker) return;
    const at = marker.getLngLat();

    const chip = document.createElement("div");
    chip.className = "chip";
    chip.textContent = chipText;

    const chipMarker = new mapboxgl.Marker({
      element: chip,
      anchor: "bottom",
      offset: [0, -42],
    })
      .setLngLat(at)
      .addTo(map.current);
    selectedLabelRef.current = chipMarker;

    const haloWrap = document.createElement("div");
    haloWrap.className = "pulse-wrapper";
    const ring = document.createElement("div");
    ring.className = "pulse-ring";
    haloWrap.appendChild(ring);

    const haloMarker = new mapboxgl.Marker({
      element: haloWrap,
      anchor: "center",
    })
      .setLngLat(at)
      .addTo(map.current);
    selectedHaloRef.current = haloMarker;

    try {
      marker.togglePopup();
    } catch {}
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

  const highlightPolygon = useCallback((crop) => {
    if (!map.current || !crop) return;

    runWhenStyleReady(() => {
      let coords = crop.coordinates;
      if (typeof coords === "string") {
        try {
          coords = JSON.parse(coords);
        } catch {
          return;
        }
      }
      if (!Array.isArray(coords) || coords.length < 3) return;

      const first = coords[0];
      const last = coords[coords.length - 1];
      if (JSON.stringify(first) !== JSON.stringify(last)) coords = [...coords, first];
      const feature = turf.polygon([coords], {
        id: crop.id,
        crop_name: crop.crop_name,
      });

      const m = map.current;

      if (!m.getSource(HILITE_SRC)) {
        m.addSource(HILITE_SRC, {
          type: "geojson",
          data: { type: "FeatureCollection", features: [feature] },
        });
        m.addLayer({
          id: HILITE_FILL,
          type: "fill",
          source: HILITE_SRC,
          paint: { "fill-color": "#10B981", "fill-opacity": 0.18 },
        });
        m.addLayer({
          id: HILITE_LINE,
          type: "line",
          source: HILITE_SRC,
          paint: { "line-color": "#10B981", "line-width": 4, "line-opacity": 1 },
        });
      } else {
        m.getSource(HILITE_SRC).setData({
          type: "FeatureCollection",
          features: [feature],
        });
      }

      if (HILITE_ANIM_REF.current) {
        clearInterval(HILITE_ANIM_REF.current);
        HILITE_ANIM_REF.current = null;
      }
      let w = 4;
      let dir = +0.4;
      HILITE_ANIM_REF.current = setInterval(() => {
        if (!m.getLayer(HILITE_LINE)) return;
        w += dir;
        if (w >= 8) dir = -0.4;
        if (w <= 3) dir = +0.4;
        try {
          m.setPaintProperty(HILITE_LINE, "line-width", w);
        } catch {}
      }, 80);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const highlightSelection = useCallback(
    (crop) => {
      if (!map.current || !crop) return;
      clearSelection();
      showMarkerChipAndHalo(
        crop.id,
        `${crop.crop_name}${
          crop.variety_name ? ` – ${crop.variety_name}` : ""
        }`
      );
      highlightPolygon(crop);
      const center = getCropCenter(crop);
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

  const ensureDeepLinkSelection = useCallback(() => {
    if (!map.current) return;
    if (!target.cropId) return;
    if (!sidebarCrops.length) return;

    const hit = sidebarCrops.find(
      (c) => String(c.id) === String(target.cropId)
    );
    if (!hit) return;

    setSelectedCrop(hit);
    setIsSidebarVisible(true);
    highlightSelection(hit);

    const center = getCropCenter(hit);
    if (center) {
      map.current.flyTo({
        center,
        zoom: target.zoom ?? 17,
        essential: true,
      });
    }
    hasDeepLinkedRef.current = true;
  }, [sidebarCrops, target.cropId, target.zoom, highlightSelection]);

  useEffect(() => {
    if (!hasDeepLinkedRef.current) ensureDeepLinkSelection();
  }, [ensureDeepLinkSelection]);

  // init map
  useEffect(() => {
    if (!map.current) {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: mapStyle,
        center: [122.9616, 10.5074],
        zoom: 7,
      });

      if (lockToBago) map.current.setMaxBounds(BAGO_CITY_BOUNDS);

      axios
        .get("http://localhost:5000/api/crops/types")
        .then((res) => setCropTypes(res.data));

      drawRef.current = new MapboxDraw({
        displayControlsDefault: false,
        controls: { polygon: true, trash: true },
      });
      map.current.addControl(drawRef.current, "bottom-right");
      map.current.addControl(new mapboxgl.NavigationControl(), "bottom-right");

      map.current.on("load", async () => {
        try {
          const res = await axios.get(
            "http://localhost:5000/api/crops/polygons"
          );
          const geojson = res.data;

          if (map.current.getSource("crop-polygons")) {
            map.current.getSource("crop-polygons").setData(geojson);
          } else {
            map.current.addSource("crop-polygons", {
              type: "geojson",
              data: geojson,
            });
            map.current.addLayer({
              id: "crop-polygons-layer",
              type: "fill",
              source: "crop-polygons",
              paint: { "fill-color": "#10B981", "fill-opacity": 0.4 },
            });
            map.current.addLayer({
              id: "crop-polygons-outline",
              type: "line",
              source: "crop-polygons",
              paint: { "line-color": "#065F46", "line-width": 2 },
            });
          }
        } catch (err) {
          console.error(" Failed to load polygons:", err);
        }

        ensureUserAccuracyLayers();
        ensureBarangayLayers();
        await renderSavedMarkers();

        if (!hasDeepLinkedRef.current) {
          let focus = null;

          if (target.cropId && sidebarCrops.length) {
            const hit = sidebarCrops.find(
              (c) => String(c.id) === String(target.cropId)
            );
            if (hit) {
              setSelectedCrop(hit);
              highlightSelection(hit);
              setIsSidebarVisible(true);
              focus = getCropCenter(hit);
            }
          }
          if (
            !focus &&
            Number.isFinite(target.lat) &&
            Number.isFinite(target.lng)
          ) {
            focus = [target.lng, target.lat];
          }
          if (focus) {
            hasDeepLinkedRef.current = true;
            map.current.flyTo({
              center: focus,
              zoom: target.zoom,
              essential: true,
            });
          }
        }
      });

      map.current.on("click", "crop-polygons-layer", (e) => {
        const feature = e.features[0];
        const cropId = feature.properties?.id;
        if (!cropId) return;
        const cropData = sidebarCrops.find(
          (c) => String(c.id) === String(cropId)
        );
        if (cropData) {
          setSelectedCrop(cropData);
          highlightSelection(cropData);
          setIsSidebarVisible(true);
        }
      });

      const handleDrawAttempt = (feature) => {
        if (!feature || !feature.geometry) return;

        if (
          feature.geometry.type !== "Polygon" &&
          feature.geometry.type !== "MultiPolygon"
        )
          return;

        const poly = feature.geometry;
        const detection = strictDetectBarangayForGeometry(poly, BARANGAYS_FC);

        if (!detection) {
          try {
            drawRef.current?.delete(feature.id);
          } catch {}
          setIsTagging(false);
          setNewTagLocation(null);
          toast.error(
            "The tagged area is outside of a single barangay boundary. Please draw entirely within one barangay."
          );
          return false;
        }

        const ring =
          poly.type === "Polygon"
            ? poly.coordinates?.[0]
            : poly.coordinates?.[0]?.[0];

        const area = turf.area({
          type: "Feature",
          geometry: poly,
          properties: {},
        });
        const hectares = +(area / 10000).toFixed(2);

        setSelectedBarangay({
          name: detection.name,
          coordinates: detection.centroid,
        });
        setNewTagLocation({ coordinates: ring, hectares, farmGeometry: poly });
        setIsTagging(true);
        return true;
      };

      map.current.on("draw.create", (e) => {
        const feature = e.features?.[0];
        handleDrawAttempt(feature);
      });

      map.current.on("draw.update", (e) => {
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
        ensureUserAccuracyLayers();
        ensureBarangayLayers();
        if (userLoc) {
          updateUserAccuracyCircle(userLoc.lng, userLoc.lat, userLoc.acc);
          if (userMarkerRef.current)
            userMarkerRef.current
              .setLngLat([userLoc.lng, userLoc.lat])
              .addTo(map.current);
          if (typeof headingDeg === "number" && userMarkerElRef.current) {
            userMarkerElRef.current.style.transform = `rotate(${headingDeg}deg)`;
          }
        }
        await loadPolygons();
        await renderSavedMarkers();
        if (selectedCrop) {
          highlightSelection(selectedCrop);
        } else if (!hasDeepLinkedRef.current) {
          let focus = null;
          if (target.cropId && sidebarCrops.length) {
            const hit = sidebarCrops.find(
              (c) => String(c.id) === String(target.cropId)
            );
            if (hit) {
              setSelectedCrop(hit);
              highlightSelection(hit);
              setIsSidebarVisible(true);
              focus = getCropCenter(hit);
            }
          }
          if (
            !focus &&
            Number.isFinite(target.lat) &&
            Number.isFinite(target.lng)
          ) {
            focus = [target.lng, target.lat];
          }
          if (focus) {
            hasDeepLinkedRef.current = true;
            map.current.flyTo({
              center: focus,
              zoom: target.zoom,
              essential: true,
            });
          }
        }
        ensureDeepLinkSelection();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    mapStyle,
    lockToBago,
    ensureUserAccuracyLayers,
    ensureBarangayLayers,
    renderSavedMarkers,
    loadPolygons,
    highlightSelection,
  ]);

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

 useEffect(() => {
  const filterPolygonsByCrop = async () => {
    const res = await axios.get("http://localhost:5000/api/crops/polygons");
    const geojson = res.data;

    let features = geojson.features || [];

    // filter by crop type
    if (selectedCropType !== "All") {
      features = features.filter(
        (f) => f.properties?.crop_name === selectedCropType
      );
    }

    // filter by harvest status
    if (harvestFilter === "harvested") {
      features = features.filter((f) =>
        isCropHarvested(f.properties || f)
      );
    } else if (harvestFilter === "not_harvested") {
      features = features.filter(
        (f) => !isCropHarvested(f.properties || f)
      );
    }

    await loadPolygons(
      {
        ...geojson,
        features,
      },
      true
    );
  };

  if (map.current?.getSource("crop-polygons")) filterPolygonsByCrop();
}, [selectedCropType, harvestFilter, loadPolygons]); // ⬅️ add harvestFilter


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
      if (hoverLeaveTimerRef.current) {
        clearTimeout(hoverLeaveTimerRef.current);
        hoverLeaveTimerRef.current = null;
      }
      if (hoverPopupRef.current) {
        try {
          hoverPopupRef.current.remove();
        } catch {}
        hoverPopupRef.current = null;
      }
    };
  }, [clearSelection]);

  // ------------- UI -------------
  return (
    <div className="relative h-screen w-screen">
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

              const glng = Number(longitude);
              const glat = Number(latitude);

              if (!Number.isFinite(glng) || !Number.isFinite(glat)) {
                console.error("Invalid GPS coords from browser (once):", pos.coords);
                toast.error("Browser returned invalid GPS coordinates.");
                return;
              }

              handleFix(glng, glat, accuracy);
            } catch (e) {
              console.error(e);
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

                  const glng = Number(longitude);
                  const glat = Number(latitude);

                  if (!Number.isFinite(glng) || !Number.isFinite(glat)) {
                    console.error("Invalid GPS coords from browser (watch):", pos.coords);
                    return;
                  }

                  handleFix(glng, glat, accuracy);
                  if (typeof heading === "number" && !Number.isNaN(heading)) {
                    setHeadingDeg(heading);
                    if (userMarkerElRef.current)
                      userMarkerElRef.current.style.transform = `rotate(${heading}deg)`;
                    if (rotateMapWithHeading && map.current)
                      map.current.setBearing(heading);
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
                  if (userMarkerElRef.current)
                    userMarkerElRef.current.style.transform = `rotate(${deg}deg)`;
                  if (rotateMapWithHeading && map.current)
                    map.current.setBearing(deg);
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
            <path d="M12 2a10 10 0 1 0 .001 20.001A10 10 0 0 0 12 2Zm3.7 6.3-2.6 6.5a1 1 0 0 1-.6.6l-6.5 2.6 2.6-6.5a1 1 0 0 1 .6-.6l6.5-2.6Z" />
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
          onClick={() => setLockToBago((v) => !v)}
        >
          {lockToBago ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17 8h-1V6a4 4 0 1 0-8 0v2H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2Zm-7-2a2 2 0 1 1 4 0v2h-4V6Z" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17 8h-1V6a4 4 0 0 0-7.33-2.4l1.5 1.32A2 2 0 0 1 13 6v2H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2Z" />
            </svg>
          )}
        </IconButton>
      </div>

      {/* Map */}
      <div ref={mapContainer} className="h-full w-full" />

      {/* Tag form */}
      {isTagging && newTagLocation && (
        <TagCropForm
          defaultLocation={{
            ...newTagLocation,
            hectares: newTagLocation.hectares,
          }}
          selectedBarangay={selectedBarangay?.name}
          barangaysFC={BARANGAYS_FC}
          farmGeometry={newTagLocation.farmGeometry}
          onCancel={() => {
            setIsTagging(false);
            setNewTagLocation(null);
            drawRef.current?.deleteAll();
          }}
          onSave={async (formData) => {
            try {
              const adminId = localStorage.getItem("user_id");
              if (adminId) formData.append("admin_id", adminId);

              await axios.post("http://localhost:5000/api/crops", formData, {
                headers: { "Content-Type": "multipart/form-data" },
              });

              alert("Crop saved!");
              await loadPolygons();
              await renderSavedMarkers();
            } catch (error) {
              if (axios.isAxiosError(error)) {
                console.error(
                  "Error saving crop (response):",
                  error.response?.data || error.message
                );

                const msg =
                  error.response?.data?.message ||
                  error.response?.data?.error ||
                  error.message ||
                  "Unknown server error";

                alert(`Failed to save crop: ${msg}`);
              } else {
                console.error("Error saving crop (non-Axios):", error);
                alert("Failed to save crop (unexpected error).");
              }
            } finally {
              setIsTagging(false);
              setNewTagLocation(null);
              drawRef.current?.deleteAll();
            }
          }}
        />
      )}

      {/* Layers (when sidebar hidden) */}
      {!isSidebarVisible && (
        <button
          onClick={() => setIsSwitcherVisible(!isSwitcherVisible)}
          className="absolute bottom-6 left-4 w-20 h-20 rounded-xl shadow-md overflow-hidden z-30 bg-white border border-gray-300 hover:shadow-lg transition"
          title="Map layers"
        >
          <div className="w-full h-full relative">
            <img
              src={DefaultThumbnail}
              alt="Layers"
              className="w-full h-full object-cover"
            />
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
              <img
                src={thumbnail}
                alt={label}
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-0 w-full text-[10px] text-white text-center bg-black/60 py-[2px]">
                {label}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Marker toggle */}
      {!isTagging && (
        <button
          onClick={() => {
            if (areMarkersVisible) {
              cropMarkerMapRef.current.forEach((m) => m.remove?.());
              if (hoverLeaveTimerRef.current) {
                clearTimeout(hoverLeaveTimerRef.current);
                hoverLeaveTimerRef.current = null;
              }
              if (hoverPopupRef.current) {
                try {
                  hoverPopupRef.current.remove();
                } catch {}
                hoverPopupRef.current = null;
              }
            } else {
              renderSavedMarkers();
            }
            setAreMarkersVisible(!areMarkersVisible);
            if (!areMarkersVisible) {
              clearSelection();
            }
          }}
          className="absolute bottom-[194px] right-[9px] z-50 bg:white bg-white border border-gray-300 rounded-[5px] w-8 h-8 flex items-center justify-center shadow-[0_0_8px_2px_rgba(0,0,0,0.15)] "
          title={areMarkersVisible ? "Hide Markers" : "Show Markers"}
        >
          <svg
            className="w-5 h-5 text-black"
            fill={!areMarkersVisible ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 21s6-5.686 6-10a6 6 0 10-12 0c0 4.314 6 10 6 10z"
            />
            <circle cx="12" cy="11" r="2" fill="white" />
          </svg>
        </button>
      )}

      {/* Sidebar toggle */}
      <SidebarToggleButton
        onClick={() => setIsSidebarVisible(!isSidebarVisible)}
        isSidebarVisible={isSidebarVisible}
        sidebarWidth={SIDEBAR_WIDTH}
        peek={PEEK}
      />

      {/* Sidebar */}
      <div
        className={`absolute top-0 left-0 h-full z-40 bg-white border-r border-gray-200 transition-all duration-200 ease-in-out overflow-hidden ${
          isSidebarVisible ? "w-[500px] px-6 py-8" : "w-0 px-0 py-0"
        }`}
      >
      {isSidebarVisible && (
  <AdminSidebar
    mapStyles={mapStyles}
    setMapStyle={setMapStyle}
    showLayers={showLayers}
    setShowLayers={setShowLayers}
    zoomToBarangay={zoomToBarangay}
    onBarangaySelect={handleBarangaySelect}
    selectedBarangay={selectedBarangay}
    cropTypes={cropTypes}
    selectedCropType={selectedCropType}
    setSelectedCropType={setSelectedCropType}
    crops={sidebarCrops}
    selectedCrop={selectedCrop}
    setEnlargedImage={setEnlargedImage}
    visible={isSidebarVisible}
    // ⬇️ NEW
    harvestFilter={harvestFilter}
    setHarvestFilter={setHarvestFilter}
    onCropUpdated={(updated) => {
      setSelectedCrop(updated);
      setSidebarCrops((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c))
      );
      renderSavedMarkers();
    }}
  />
)}


      </div>

      <ToastContainer
        position="top-center"
        autoClose={3000}
        hideProgressBar
        pauseOnHover
        theme="light"
        style={{ zIndex: 9999 }}
      />

      {enlargedImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 z-[9999] flex justify-center items-center"
          onClick={() => setEnlargedImage(null)}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setEnlargedImage(null);
            }}
            className="absolute top-4 right-4 text-white text-2xl font-bold z-[10000] hover:text-red-400"
            title="Close"
          >
            ×
          </button>
          <img
            src={enlargedImage}
            alt="Fullscreen Crop"
            className="max-w-full max-h-full object-contain"
          />
        </div>
      )}
    </div>
  );
};

export default AdminMapBox;
