// src/components/UnifiedMap/UnifiedAgriMap.js
import React, { useState, useEffect, useRef } from "react";
import AdminCropMap from "../AdminCrop/AdminCropMap"; // adjust path if needed
import CalamityFarmerMap from "../AdminCalamity/CalamityMap"; // adjust path
import { Sprout, CloudLightning, MapPin, Layers } from "lucide-react";
import { NavLink } from "react-router-dom";

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

/* ---------- HELPERS ---------- */
function isSoftDeletedCrop(crop) {
  if (!crop) return false;

  const yes = (v) =>
    v === 1 ||
    v === "1" ||
    v === true ||
    v === "true" ||
    v === "yes" ||
    v === "y";
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

  if (checkStatusStr(crop.status) || checkStatusStr(crop.record_status))
    return true;

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
    if (JSON.stringify(first) !== JSON.stringify(last))
      coords = [...coords, first];

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

function getPolygonCenterFromFeature(feature) {
  if (!feature?.geometry || feature.geometry.type !== "Polygon") return null;

  let ring = feature.geometry.coordinates?.[0];
  if (!Array.isArray(ring) || ring.length < 3) return null;

  const first = ring[0];
  const last = ring[ring.length - 1];
  if (JSON.stringify(first) !== JSON.stringify(last)) ring = [...ring, first];

  const center = turf.centerOfMass(turf.polygon([ring])).geometry.coordinates;
  return center;
}

/* ---------- Unified overlay map showing both layers ---------- */
const UnifiedOverlayMap = () => {
  const containerRef = useRef(null);
  const mapRef = useRef(null);

  const [showCrops, setShowCrops] = useState(true);
  const [showCalamities, setShowCalamities] = useState(true);

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
          "#10B981",
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

        // crop markers
        cropFC.features.forEach((feature) => {
          try {
            const center = getPolygonCenterFromFeature(feature);
            if (!center) return;
            const [lng, lat] = center;

            const isHarvested = feature.properties.is_harvested === 1;
            const markerColor = isHarvested ? "#6B7280" : "#10B981";

            const popupHtml = `
              <div class="text-sm" style="min-width:220px">
                <h3 class='font-bold text-green-600'>${feature.properties.crop_name || "Unknown Crop"}</h3>
                <p><strong>Variety:</strong> ${feature.properties.variety_name || "N/A"}</p>
                ${
                  feature.properties.barangay
                    ? `<p><strong>Barangay:</strong> ${feature.properties.barangay}</p>`
                    : ""
                }
                <p style="margin-top:6px;">
                  <strong>Status:</strong> ${isHarvested ? "Harvested" : "Not harvested"}
                </p>
              </div>
            `;

            new mapboxgl.Marker({ color: markerColor })
              .setLngLat([lng, lat])
              .setPopup(new mapboxgl.Popup({ offset: 15 }).setHTML(popupHtml))
              .addTo(map);
          } catch (err) {
            console.error("Error creating crop marker:", err);
          }
        });

        // fit bounds
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

      <div className="absolute left-4 bottom-4 z-40 rounded-lg bg-white/95 border border-slate-200 shadow-sm px-3 py-2 text-xs">
        <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-700 mb-2">
          <Layers className="w-3.5 h-3.5 text-slate-500" />
          <span>Layers</span>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowCrops((v) => !v)}
            className={`px-3 py-1 rounded-md border text-[11px] font-medium transition ${
              showCrops
                ? "bg-emerald-600 text-white border-emerald-600"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            }`}
          >
            Crops
          </button>

          <button
            type="button"
            onClick={() => setShowCalamities((v) => !v)}
            className={`px-3 py-1 rounded-md border text-[11px] font-medium transition ${
              showCalamities
                ? "bg-red-600 text-white border-red-600"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            }`}
          >
            Calamities
          </button>
        </div>

        <p className="mt-2 text-[10px] text-slate-500 max-w-[220px]">
          Toggle layers to compare crops and hazard zones.
        </p>
      </div>
    </div>
  );
};

/* ---------- MAIN PAGE ---------- */
const UnifiedAgriMap = () => {
  const [activeTab, setActiveTab] = useState("crop"); // crop | calamity | both

  const navLinks = [
    { to: "/AdminLanding", label: "Home", end: true },
    { to: "/AdminManageCrop", label: "Crops" },
    { to: "/AdminManageCalamity", label: "Calamity" },
    { to: "/AdminGlossary", label: "Glossary" },
  ];

  return (
    // ✅ add font-poppins here so everything inside uses Poppins
    <div className="h-screen w-screen flex flex-col bg-slate-50 overflow-hidden font-poppins">
      <header className="flex items-center justify-between px-6 py-3 border-b bg-white">
        {/* Left brand */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-sm sm:text-base font-semibold text-slate-900 truncate">
                AgriGIS
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50 px-2 py-[2px] text-[11px] font-semibold text-emerald-700">
                <MapPin className="h-3 w-3" />
                Bago City
              </span>
            </div>
            <p className="hidden sm:block text-xs text-slate-500">
              Unified crop & calamity mapping
            </p>
          </div>
        </div>

        {/* Right: links + toggle */}
        <div className="flex items-center gap-6">
          {/* ✅ Navbar links (same style as your sample) */}
          <nav className="hidden lg:flex space-x-6">
            {navLinks.map((l) => (
              <NavLink
                key={l.label}
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  `tracking-wide font-light hover:text-green-700 ${
                    isActive ? "text-green-700 font-light" : "text-black"
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>

          {/* Crop/Calamity toggle (only changes map view here) */}
          <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-[3px] text-xs">
            <button
              type="button"
              onClick={() => setActiveTab("crop")}
              className={`inline-flex items-center gap-1 px-3 py-[6px] rounded-full transition text-xs font-medium ${
                activeTab === "crop"
                  ? "bg-emerald-600 text-white"
                  : "text-slate-700 hover:text-slate-900"
              }`}
            >
              <Sprout className="w-3.5 h-3.5" />
              Crops
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("calamity")}
              className={`inline-flex items-center gap-1 px-3 py-[6px] rounded-full transition text-xs font-medium ${
                activeTab === "calamity"
                  ? "bg-red-600 text-white"
                  : "text-slate-700 hover:text-slate-900"
              }`}
            >
              <CloudLightning className="w-3.5 h-3.5" />
              Calamities
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 relative min-h-0">
        {activeTab === "crop" && <AdminCropMap />}
        {activeTab === "calamity" && <CalamityFarmerMap />}
        {activeTab === "both" && <UnifiedOverlayMap />}
      </main>
    </div>
  );
};

export default UnifiedAgriMap;
