// src/components/UnifiedMap/UnifiedAgriMap.js
import React, { useState, useEffect, useRef } from "react";
import AdminCropMap from "../AdminCrop/AdminCropMap"; // adjust path if needed
import CalamityFarmerMap from "../AdminCalamity/CalamityMap"; // adjust path
import { Sprout, CloudLightning, MapPin, Layers } from "lucide-react";

import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import * as turf from "@turf/turf";
import axios from "axios";

/* ---------- MAPBOX CONFIG ---------- */
mapboxgl.accessToken =
  "pk.eyJ1Ijoid29tcHdvbXAtNjkiLCJhIjoiY204emxrOHkwMGJsZjJrcjZtZmN4YXdtNSJ9.LIMPvoBNtGuj4O36r3F72w";

const BAGO_CITY_BOUNDS = [
  [122.7333, 10.4958],
  [123.5, 10.6333],
];

/* ---------- HELPERS (reuse, simplified from your maps) ---------- */

function isSoftDeletedCrop(crop) {
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
  ) {
    return true;
  }

  if (no(crop.is_active) || no(crop.active)) return true;

  const checkStatusStr = (val) => {
    if (typeof val !== "string") return false;
    const s = val.toLowerCase();
    return ["deleted", "archived", "inactive", "removed"].includes(s);
  };

  if (checkStatusStr(crop.status) || checkStatusStr(crop.record_status)) return true;

  return false;
}

function buildPolygonsFromCrops(crops = []) {
  const features = [];

  for (const crop of crops) {
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
    if (JSON.stringify(first) !== JSON.stringify(last)) coords = [...coords, first];

    const harvested =
      crop.is_harvested === 1 ||
      crop.is_harvested === "1" ||
      crop.is_harvested === true;

    features.push({
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [coords] },
      properties: {
        id: crop.id,
        crop_name: crop.crop_name,
        variety_name: crop.variety_name,
        barangay: crop.barangay || crop.farmer_barangay,
        is_harvested: harvested ? 1 : 0,
      },
    });
  }

  return { type: "FeatureCollection", features };
}

const calamityColorMap = {
  Flood: "#3b82f6",
  Earthquake: "#ef4444",
  Typhoon: "#8b5cf6",
  Landslide: "#f59e0b",
  Drought: "#f97316",
  Wildfire: "#dc2626",
};

/* ---------- helper: get polygon center like AdminCropMap ---------- */
function getPolygonCenterFromFeature(feature) {
  if (!feature?.geometry || feature.geometry.type !== "Polygon") return null;

  let ring = feature.geometry.coordinates?.[0];
  if (!Array.isArray(ring) || ring.length < 3) return null;

  const first = ring[0];
  const last = ring[ring.length - 1];
  if (JSON.stringify(first) !== JSON.stringify(last)) {
    ring = [...ring, first];
  }

  const center = turf.centerOfMass(turf.polygon([ring])).geometry.coordinates;
  return center; // [lng, lat]
}

/* ---------- NEW: Unified overlay map showing both layers ---------- */

const UnifiedOverlayMap = () => {
  const containerRef = useRef(null);
  const mapRef = useRef(null);

  const [showCrops, setShowCrops] = useState(true);
  const [showCalamities, setShowCalamities] = useState(true);

  // init map + load layers
  useEffect(() => {
    if (mapRef.current) return;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/wompwomp-69/cm900xa91008j01t14w8u8i9d",
      center: [122.9616, 10.5074],
      zoom: 13,
      maxBounds: BAGO_CITY_BOUNDS,
    });

    mapRef.current = map;

    map.on("load", async () => {
      try {
        // 1) CROPS
        const cropsRes = await axios.get("http://localhost:5000/api/crops");
        const rows = cropsRes.data || [];
        const crops = rows.filter((c) => !isSoftDeletedCrop(c));
        const cropFC = buildPolygonsFromCrops(crops);

        const baseColorByCrop = [
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

        const cropPaint = {
          "fill-color": [
            "case",
            ["==", ["get", "is_harvested"], 1],
            "#9CA3AF",
            baseColorByCrop,
          ],
          "fill-opacity": 0.45,
        };

        map.addSource("unified-crop-polygons", {
          type: "geojson",
          data: cropFC,
        });
        map.addLayer({
          id: "unified-crop-fill",
          type: "fill",
          source: "unified-crop-polygons",
          paint: cropPaint,
        });
        map.addLayer({
          id: "unified-crop-outline",
          type: "line",
          source: "unified-crop-polygons",
          paint: { "line-color": "#064e3b", "line-width": 1 },
        });

        // 2) CALAMITIES
        const calRes = await axios.get(
          "http://localhost:5000/api/calamities/polygons"
        );
        const calamityFC = calRes.data;

        const calamPaint = {
          "fill-color": [
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
          ],
          "fill-opacity": 0.38,
        };

        map.addSource("unified-calamity-polygons", {
          type: "geojson",
          data: calamityFC,
        });
        map.addLayer({
          id: "unified-calamity-fill",
          type: "fill",
          source: "unified-calamity-polygons",
          paint: calamPaint,
        });
        map.addLayer({
          id: "unified-calamity-outline",
          type: "line",
          source: "unified-calamity-polygons",
          paint: { "line-color": "#7f1d1d", "line-width": 2 },
        });

        map.addLayer({
          id: "unified-crop-outline",
          type: "line",
          source: "unified-crop-polygons",
          paint: { "line-color": "#064e3b", "line-width": 1 },
        });

        // Add markers at crop polygon centers using same logic as AdminCropMap
        cropFC.features.forEach((feature) => {
          try {
            const center = getPolygonCenterFromFeature(feature);
            if (!center) return;
            const [lng, lat] = center;

            const isHarvested = feature.properties.is_harvested === 1;
            const markerColor = isHarvested ? "#6B7280" : "#10B981";

            const popupHtml = `
              <div class="text-sm" style="min-width:220px">
                <h3 class='font-bold text-green-600'>${feature.properties.crop_name || 'Unknown Crop'}</h3>
                <p><strong>Variety:</strong> ${feature.properties.variety_name || "N/A"}</p>
                ${feature.properties.barangay ? `<p><strong>Barangay:</strong> ${feature.properties.barangay}</p>` : ''}
                <p style="margin-top:6px;">
                  <strong>Status:</strong> ${isHarvested ? "Harvested" : "Not harvested"}
                </p>
              </div>
            `;

            const popup = new mapboxgl.Popup({ offset: 15 }).setHTML(popupHtml);

            // ✅ match AdminCropMap: no anchor/offset, just color + centerOfMass
            const marker = new mapboxgl.Marker({
              color: markerColor,
            })
              .setLngLat([lng, lat])
              .setPopup(popup)
              .addTo(map);

            marker._cropData = feature.properties;
          } catch (err) {
            console.error("Error creating crop marker:", err);
          }
        });

        // 3) Fit to union of both layers
        const allFeatures = [
          ...(cropFC.features || []),
          ...((calamityFC && calamityFC.features) || []),
        ];
        if (allFeatures.length > 0) {
          const unionFC = { type: "FeatureCollection", features: allFeatures };
          const [minX, minY, maxX, maxY] = turf.bbox(unionFC);
          map.fitBounds(
            [
              [minX, minY],
              [maxX, maxY],
            ],
            { padding: 40, duration: 0 }
          );
        }
      } catch (err) {
        console.error("Unified overlay load failed:", err);
      }
    });

    return () => {
      try {
        map.remove();
      } catch {}
      mapRef.current = null;
    };
  }, []);

  // react to showCrops/showCalamities toggles
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const cropLayers = ["unified-crop-fill", "unified-crop-outline"];
    const calamLayers = ["unified-calamity-fill", "unified-calamity-outline"];

    cropLayers.forEach((id) => {
      if (!map.getLayer(id)) return;
      map.setLayoutProperty(id, "visibility", showCrops ? "visible" : "none");
    });

    calamLayers.forEach((id) => {
      if (!map.getLayer(id)) return;
      map.setLayoutProperty(id, "visibility", showCalamities ? "visible" : "none");
    });
  }, [showCrops, showCalamities]);

  return (
    <div className="h-full w-full relative">
      <div ref={containerRef} className="h-full w-full" />

      {/* Small layer legend / filter in combined mode */}
      <div className="absolute left-4 bottom-4 z-40 rounded-xl bg-white/90 shadow-md px-3 py-2 flex flex-col gap-2 text-xs">
        <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-700">
          <Layers className="w-3.5 h-3.5 text-slate-500" />
          <span>Layers</span>
        </div>

        <div className="flex gap-2 mt-1">
          <button
            type="button"
            onClick={() => setShowCrops((v) => !v)}
            className={`inline-flex items-center gap-1 px-2.5 py-[4px] rounded-full border text-[11px] font-medium ${
              showCrops
                ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                : "bg-white text-slate-600 border-slate-300 hover:text-slate-900"
            }`}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: "#10B981" }}
            />
            Crops
          </button>

          <button
            type="button"
            onClick={() => setShowCalamities((v) => !v)}
            className={`inline-flex items-center gap-1 px-2.5 py-[4px] rounded-full border text-[11px] font-medium ${
              showCalamities
                ? "bg-red-600 text-white border-red-600 shadow-sm"
                : "bg-white text-slate-600 border-slate-300 hover:text-slate-900"
            }`}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: "#ef4444" }}
            />
            Calamities
          </button>
        </div>

        <p className="mt-1 text-[10px] text-slate-500 max-w-[220px]">
          Use this combined view to see where crop areas overlap with hazard-affected
          zones.
        </p>
      </div>
    </div>
  );
};

/* ---------- MAIN UNIFIED CONTAINER WITH 3 MODES ---------- */

const UnifiedAgriMap = () => {
  const [activeTab, setActiveTab] = useState("crop"); // 'crop' | 'calamity' | 'both'

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
              One map for crop and calamity geotagging
            </p>
          </div>
        </div>

        {/* Right: mode toggle */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex flex-col items-end mr-1">
            <span className="text-[11px] font-medium text-slate-500 leading-tight">
              View mode
            </span>
            <span className="text-[10px] text-slate-400">
              Switch between crops, calamities, or both
            </span>
          </div>

          <div className="inline-flex rounded-full bg-slate-100 p-[4px] text-xs">
            {/* CROPS */}
            <button
              type="button"
              onClick={() => setActiveTab("crop")}
              className={`inline-flex items-center gap-1 px-3.5 py-[6px] rounded-full transition text-xs font-medium ${
                activeTab === "crop"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Sprout className="w-3.5 h-3.5" />
              Crops
            </button>

            {/* CALAMITIES */}
            <button
              type="button"
              onClick={() => setActiveTab("calamity")}
              className={`inline-flex items-center gap-1 px-3.5 py-[6px] rounded-full transition text-xs font-medium ${
                activeTab === "calamity"
                  ? "bg-red-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <CloudLightning className="w-3.5 h-3.5" />
              Calamities
            </button>

            {/* BOTH (NEW) */}
            {/* <button
              type="button"
              onClick={() => setActiveTab("both")}
              className={`inline-flex items-center gap-1 px-3.5 py-[6px] rounded-full transition text-xs font-medium ${
                activeTab === "both"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Both
            </button> */}
          </div>
        </div>
      </header>

      {/* Map area */}
      <main className="flex-1 relative min-h-0">
        {activeTab === "crop" && <AdminCropMap />}
        {activeTab === "calamity" && <CalamityFarmerMap />}
        {activeTab === "both" && <UnifiedOverlayMap />}
      </main>
    </div>
  );
};

export default UnifiedAgriMap;
