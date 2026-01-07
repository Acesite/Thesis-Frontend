// src/components/UnifiedMap/UnifiedAgriMap.js
import React, { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import axios from "axios";
import * as turf from "@turf/turf";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Sprout, CloudLightning, MapPin } from "lucide-react";
import DefaultThumbnail from "../MapboxImages/map-default.png";
import SatelliteThumbnail from "../MapboxImages/map-satellite.png";
import DarkThumbnail from "../MapboxImages/map-dark.png";
import LightThumbnail from "../MapboxImages/map-light.png";
import BARANGAYS_FC from "../Barangays/barangays.json";

mapboxgl.accessToken =
  "pk.eyJ1Ijoid29tcHdvbXAtNjkiLCJhIjoiY204emxrOHkwMGJsZjJrcjZtZmN4YXdtNSJ9.LIMPvoBNtGuj4O36r3F72w";

const API_BASE = "http://localhost:5000";
const BAGO_CITY_BOUNDS = [
  [122.7333, 10.4958],
  [123.5, 10.6333],
];

/* ---------- small helpers ---------- */
function buildCropPolygonsFromRows(rows = []) {
  const features = [];

  for (const crop of rows) {
    let coords = crop.coordinates;
    if (!coords) continue;

    if (typeof coords === "string") {
      try {
        coords = JSON.parse(coords);
      } catch {
        continue;
      }
    }

    if (!Array.isArray(coords) || coords.length < 3) continue;

    const first = coords[0];
    const last = coords[coords.length - 1];
    if (JSON.stringify(first) !== JSON.stringify(last)) {
      coords = [...coords, first];
    }

    features.push({
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [coords] },
      properties: {
        id: crop.id,
        crop_name: crop.crop_name || "Crop",
        variety_name: crop.variety_name || "",
        barangay: crop.barangay || crop.farmer_barangay || "",
        is_harvested:
          Number(crop.is_harvested) === 1 ||
          crop.is_harvested === true ||
          !!crop.harvested_date
            ? 1
            : 0,
      },
    });
  }

  return { type: "FeatureCollection", features };
}

const cropBaseColorExpr = [
  "match",
  ["get", "crop_name"],
  "Rice",
  "#facc15",
  "Corn",
  "#fb923c",
  "Banana",
  "#a3e635",
  "Sugarcane",
  "#34d399",
  "Cassava",
  "#60a5fa",
  "Vegetables",
  "#f472b6",
  /* other */ "#10B981",
];

const calamityColorMap = {
  Flood: "#3b82f6",
  Earthquake: "#ef4444",
  Typhoon: "#8b5cf6",
  Landslide: "#f59e0b",
  Drought: "#f97316",
  Wildfire: "#dc2626",
};

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

const UnifiedAgriMap = () => {
  const mapContainer = useRef(null);
  const map = useRef(null);

  const [mapStyle, setMapStyle] = useState(
    "mapbox://styles/wompwomp-69/cm900xa91008j01t14w8u8i9d"
  );

  const [showCrops, setShowCrops] = useState(true);
  const [showCalamities, setShowCalamities] = useState(true);
  const [isSwitcherVisible, setIsSwitcherVisible] = useState(false);

  const [lockToBago, setLockToBago] = useState(true);

  const [cropCount, setCropCount] = useState(0);
  const [calamityCount, setCalamityCount] = useState(0);

  const CROP_SRC = "unified-crop-polygons";
  const CROP_FILL = "unified-crop-fill";
  const CROP_LINE = "unified-crop-outline";

  const CAL_SRC = "unified-calamity-polygons";
  const CAL_FILL = "unified-calamity-fill";
  const CAL_LINE = "unified-calamity-outline";

  /* ---------- barangay borders + labels ---------- */
  const ensureBarangayLayers = useCallback(() => {
    if (!map.current) return;
    if (!BARANGAYS_FC?.features?.length) return;
    const m = map.current;

    if (!m.getSource("barangays-src")) {
      m.addSource("barangays-src", { type: "geojson", data: BARANGAYS_FC });
    }

    if (!m.getLayer("barangays-casing")) {
      m.addLayer({
        id: "barangays-casing",
        type: "line",
        source: "barangays-src",
        paint: {
          "line-color": "#9CA3AF",
          "line-opacity": 0.9,
          "line-blur": 1.2,
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            10,
            2.0,
            12,
            3.0,
            14,
            4.0,
            16,
            6.0,
            18,
            9.0,
          ],
        },
      });
    }

    if (!m.getLayer("barangays-line")) {
      m.addLayer({
        id: "barangays-line",
        type: "line",
        source: "barangays-src",
        paint: {
          "line-color": "#065f46",
          "line-opacity": 0.95,
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            10,
            1.2,
            12,
            1.8,
            14,
            2.6,
            16,
            3.6,
            18,
            5.5,
          ],
        },
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
          "text-size": [
            "interpolate",
            ["linear"],
            ["zoom"],
            10,
            10,
            12,
            12,
            14,
            14,
            16,
            18,
          ],
          "text-font": ["Open Sans Semibold", "Arial Unicode MS Regular"],
          "text-allow-overlap": true,
          "text-ignore-placement": true,
        },
        paint: {
          "text-color": "#0b3b2e",
          "text-halo-color": "rgba(255,255,255,0.98)",
          "text-halo-width": 2.0,
          "text-halo-blur": 0.4,
        },
      });
    }

    try {
      const layers = m.getStyle()?.layers || [];
      const topId = layers[layers.length - 1]?.id;
      if (topId) m.moveLayer("barangays-labels", topId);
    } catch {}
  }, []);

  /* ---------- load crops polygons ---------- */
  const loadCropPolygons = useCallback(async () => {
    if (!map.current) return;
    const m = map.current;

    try {
      const res = await axios.get(`${API_BASE}/api/crops`);
      const rows = res.data || [];
      const fc = buildCropPolygonsFromRows(rows);
      setCropCount(fc.features.length);

      const fillColor = [
        "case",
        ["==", ["get", "is_harvested"], 1],
        "#9CA3AF",
        cropBaseColorExpr,
      ];

      if (!m.getSource(CROP_SRC)) {
        m.addSource(CROP_SRC, { type: "geojson", data: fc });

        m.addLayer({
          id: CROP_FILL,
          type: "fill",
          source: CROP_SRC,
          paint: {
            "fill-color": fillColor,
            "fill-opacity": 0.38,
          },
        });

        m.addLayer({
          id: CROP_LINE,
          type: "line",
          source: CROP_SRC,
          paint: {
            "line-color": "#065F46",
            "line-width": 1.4,
          },
        });

        m.on("click", CROP_FILL, (e) => {
          const f = e.features?.[0];
          if (!f) return;
          const { crop_name, variety_name, barangay, is_harvested } =
            f.properties || {};

          const html = `
            <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; font-size: 13px;">
              <div style="font-weight: 700; color:#047857; margin-bottom:4px;">${crop_name ||
                "Crop"}</div>
              ${
                variety_name
                  ? `<div style="color:#4b5563;">Variety: <strong>${variety_name}</strong></div>`
                  : ""
              }
              ${
                barangay
                  ? `<div style="color:#4b5563;">Barangay: <strong>${barangay}</strong></div>`
                  : ""
              }
              <div style="margin-top:4px; color:#6b7280;">
                Status: <strong>${
                  Number(is_harvested) === 1 ? "Harvested" : "Not harvested"
                }</strong>
              </div>
            </div>
          `;

          const center = turf
            .centerOfMass(f)
            .geometry.coordinates.slice(0, 2);

          new mapboxgl.Popup({ offset: 16 })
            .setLngLat(center)
            .setHTML(html)
            .addTo(m);
        });

        m.on("mouseenter", CROP_FILL, () => {
          m.getCanvas().style.cursor = "pointer";
        });
        m.on("mouseleave", CROP_FILL, () => {
          m.getCanvas().style.cursor = "";
        });
      } else {
        m.getSource(CROP_SRC).setData(fc);
      }
    } catch (err) {
      console.error("Failed to load crop polygons:", err);
      toast.error("Failed to load crop polygons.");
    }
  }, []);

  /* ---------- load calamity polygons ---------- */
  const loadCalamityPolygons = useCallback(async () => {
    if (!map.current) return;
    const m = map.current;

    try {
      const res = await axios.get(`${API_BASE}/api/calamities/polygons`);
      const geojson = res.data;
      const features = geojson?.features || [];
      setCalamityCount(features.length);

      const fillColor = [
        "match",
        ["get", "calamity_type"],
        "Flood",
        calamityColorMap.Flood,
        "Earthquake",
        calamityColorMap.Earthquake,
        "Typhoon",
        calamityColorMap.Typhoon,
        "Landslide",
        calamityColorMap.Landslide,
        "Drought",
        calamityColorMap.Drought,
        "Wildfire",
        calamityColorMap.Wildfire,
        "#ef4444",
      ];

      if (!m.getSource(CAL_SRC)) {
        m.addSource(CAL_SRC, { type: "geojson", data: geojson });

        m.addLayer({
          id: CAL_FILL,
          type: "fill",
          source: CAL_SRC,
          paint: {
            "fill-color": fillColor,
            "fill-opacity": 0.35,
          },
        });

        m.addLayer({
          id: CAL_LINE,
          type: "line",
          source: CAL_SRC,
          paint: {
            "line-color": "#7f1d1d",
            "line-width": 2,
          },
        });

        m.on("click", CAL_FILL, (e) => {
          const f = e.features?.[0];
          if (!f) return;
          const props = f.properties || {};
          const type = props.calamity_type || "Incident";
          const sev = props.severity_level || props.severity || "N/A";
          const barangay = props.barangay || props.location_name || "";

          const html = `
            <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; font-size: 13px;">
              <div style="font-weight: 700; color:#b91c1c; margin-bottom:4px;">${type}</div>
              <div style="color:#4b5563;">Severity: <strong>${sev}</strong></div>
              ${
                barangay
                  ? `<div style="color:#4b5563;">Barangay: <strong>${barangay}</strong></div>`
                  : ""
              }
            </div>
          `;

          const center = turf
            .centerOfMass(f)
            .geometry.coordinates.slice(0, 2);

          new mapboxgl.Popup({ offset: 16 })
            .setLngLat(center)
            .setHTML(html)
            .addTo(m);
        });

        m.on("mouseenter", CAL_FILL, () => {
          m.getCanvas().style.cursor = "pointer";
        });
        m.on("mouseleave", CAL_FILL, () => {
          m.getCanvas().style.cursor = "";
        });
      } else {
        m.getSource(CAL_SRC).setData(geojson);
      }
    } catch (err) {
      console.error("Failed to load calamity polygons:", err);
      toast.error("Failed to load calamity polygons.");
    }
  }, []);

  /* ---------- visibility toggles ---------- */
  useEffect(() => {
    if (!map.current) return;
    const m = map.current;

    if (m.getLayer(CROP_FILL)) {
      m.setLayoutProperty(CROP_FILL, "visibility", showCrops ? "visible" : "none");
    }
    if (m.getLayer(CROP_LINE)) {
      m.setLayoutProperty(CROP_LINE, "visibility", showCrops ? "visible" : "none");
    }
  }, [showCrops]);

  useEffect(() => {
    if (!map.current) return;
    const m = map.current;

    if (m.getLayer(CAL_FILL)) {
      m.setLayoutProperty(
        CAL_FILL,
        "visibility",
        showCalamities ? "visible" : "none"
      );
    }
    if (m.getLayer(CAL_LINE)) {
      m.setLayoutProperty(
        CAL_LINE,
        "visibility",
        showCalamities ? "visible" : "none"
      );
    }
  }, [showCalamities]);

  /* ---------- map init ---------- */
  useEffect(() => {
    if (map.current) return;

    const m = new mapboxgl.Map({
      container: mapContainer.current,
      style: mapStyle,
      center: [122.9616, 10.5074],
      zoom: 12.5,
    });

    map.current = m;
    if (lockToBago) m.setMaxBounds(BAGO_CITY_BOUNDS);

    m.addControl(new mapboxgl.NavigationControl(), "bottom-right");

    m.on("load", async () => {
      ensureBarangayLayers();
      await loadCropPolygons();
      await loadCalamityPolygons();
    });

    return () => {
      try {
        m.remove();
      } catch {}
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- handle style changes (base map) ---------- */
  useEffect(() => {
    if (!map.current) return;
    const m = map.current;

    m.setStyle(mapStyle);
    m.once("style.load", async () => {
      ensureBarangayLayers();
      await loadCropPolygons();
      await loadCalamityPolygons();

      // re-apply visibility states after style swap
      if (m.getLayer(CROP_FILL)) {
        m.setLayoutProperty(
          CROP_FILL,
          "visibility",
          showCrops ? "visible" : "none"
        );
      }
      if (m.getLayer(CROP_LINE)) {
        m.setLayoutProperty(
          CROP_LINE,
          "visibility",
          showCrops ? "visible" : "none"
        );
      }
      if (m.getLayer(CAL_FILL)) {
        m.setLayoutProperty(
          CAL_FILL,
          "visibility",
          showCalamities ? "visible" : "none"
        );
      }
      if (m.getLayer(CAL_LINE)) {
        m.setLayoutProperty(
          CAL_LINE,
          "visibility",
          showCalamities ? "visible" : "none"
        );
      }
    });
  }, [mapStyle, ensureBarangayLayers, loadCropPolygons, loadCalamityPolygons, showCrops, showCalamities]);

  /* ---------- lock/unlock Bago bounds ---------- */
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

  /* ---------- UI ---------- */
  return (
    <div className="h-screen w-screen flex flex-col bg-slate-50 overflow-hidden">
      {/* Top brand bar */}
      <header className="flex items-center justify-between px-6 py-3 border-b bg-white/95 backdrop-blur-sm shadow-sm">
        {/* Left: title */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-base font-semibold text-slate-900 truncate">
                AgriGIS Unified Map
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50 px-2 py-[2px] text-[11px] font-semibold text-emerald-700">
                <MapPin className="h-3 w-3" />
                Bago City DA
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Combined view for crop areas and calamity-affected fields
            </p>
          </div>
        </div>

        {/* Right: toggles */}
        <div className="flex items-center gap-4">
          <div className="hidden md:flex flex-col items-end mr-1">
            <span className="text-[11px] font-medium text-slate-500 leading-tight">
              Layers
            </span>
            <span className="text-[10px] text-slate-400">
              Toggle crops and calamities on the same map
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Crops toggle */}
            <button
              type="button"
              onClick={() => setShowCrops((v) => !v)}
              className={`inline-flex items-center gap-1 rounded-full px-3.5 py-[6px] text-xs font-medium border transition ${
                showCrops
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                  : "bg-white text-slate-600 border-slate-200 hover:text-slate-900"
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: "#10B981" }}
              />
              <Sprout className="w-3.5 h-3.5" />
              <span>Crops</span>
              <span className="text-[10px] opacity-80">
                {cropCount ? `(${cropCount})` : ""}
              </span>
            </button>

            {/* Calamities toggle */}
            <button
              type="button"
              onClick={() => setShowCalamities((v) => !v)}
              className={`inline-flex items-center gap-1 rounded-full px-3.5 py-[6px] text-xs font-medium border transition ${
                showCalamities
                  ? "bg-red-600 text-white border-red-600 shadow-sm"
                  : "bg-white text-slate-600 border-slate-200 hover:text-slate-900"
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: "#ef4444" }}
              />
              <CloudLightning className="w-3.5 h-3.5" />
              <span>Calamities</span>
              <span className="text-[10px] opacity-80">
                {calamityCount ? `(${calamityCount})` : ""}
              </span>
            </button>

            {/* Lock toggle */}
            <button
              type="button"
              onClick={() => setLockToBago((v) => !v)}
              className="inline-flex items-center gap-1 rounded-full px-3 py-[6px] text-[10px] font-medium border border-slate-200 bg-white hover:bg-slate-50"
            >
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                {lockToBago ? (
                  <path d="M17 8h-1V6a4 4 0 1 0-8 0v2H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2Zm-7-2a2 2 0 1 1 4 0v2h-4V6Z" />
                ) : (
                  <path d="M17 8h-1V6a4 4 0 0 0-7.33-2.4l1.5 1.32A2 2 0 0 1 13 6v2H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2Z" />
                )}
              </svg>
              <span>{lockToBago ? "Lock to Bago" : "Unlock map"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Map area */}
      <main className="flex-1 relative min-h-0">
        <div ref={mapContainer} className="h-full w-full" />

        {/* Base map style switcher (when needed) */}
        <button
          onClick={() => setIsSwitcherVisible((v) => !v)}
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
              Basemap
            </div>
          </div>
        </button>

        {isSwitcherVisible && (
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

        {/* Legend */}
        <div className="absolute bottom-4 right-4 bg-white/95 backdrop-blur rounded-xl shadow-md px-3 py-2 text-[11px] text-slate-600 space-y-1">
          <div className="font-semibold text-[11px] text-slate-800 mb-1">
            Layer legend
          </div>
          <div className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-sm border border-emerald-700"
              style={{ backgroundColor: "#10B981" }}
            />
            <span>Crops (by crop type, grey = harvested)</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-sm border border-red-700"
              style={{ backgroundColor: "#ef4444" }}
            />
            <span>Calamities (by incident type)</span>
          </div>
        </div>
      </main>

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

export default UnifiedAgriMap;
