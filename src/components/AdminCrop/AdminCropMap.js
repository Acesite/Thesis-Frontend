import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
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

import AdminSidebar from "./AdminSideBar";
import SidebarToggleButton from "./MapControls/SidebarToggleButton";
import TagCropForm from "./TagCropForm";
import { IconButton } from "./Iconbutton.js";
import { CropOverviewCard } from "./Cropoverviewcard.js";
import { useSeasonComparison } from "./Useseasoncomparison.js";

import DefaultThumbnail from "../MapboxImages/map-default.png";
import SatelliteThumbnail from "../MapboxImages/map-satellite.png";
import DarkThumbnail from "../MapboxImages/map-dark.png";
import LightThumbnail from "../MapboxImages/map-light.png";
import BARANGAYS_FC from "../Barangays/barangays.json";

import {
  BAGO_CITY_BOUNDS,
  addPulseStylesOnce,
  isSoftDeletedCrop,
  isCropHarvested,
  passesTimelineFilter,
  buildPolygonsFromCrops,
  isInsideBounds,
  expandBoundsToIncludePoint,
  explainGeoError,
  strictDetectBarangayForGeometry,
} from "./Cropmaputils.js";

import {
  ensureCropPolygonLabelsLayer,
  ensureBarangayLayersOnMap,
  ensureUserAccuracyLayersOnMap,
  ensureTerrainOnMap,
  runWhenStyleReady,
  CROP_FILL_PAINT,
  USER_ACC_SOURCE,
} from "./Maplayerhelpers.js";

mapboxgl.accessToken =
  "pk.eyJ1Ijoid29tcHdvbXAtNjkiLCJhIjoiY204emxrOHkwMGJsZjJrcjZtZmN4YXdtNSJ9.LIMPvoBNtGuj4O36r3F72w";

// ─── Map style definitions ────────────────────────────────────────────────────
const mapStyles = {
  Default:   { url: "mapbox://styles/wompwomp-69/cm900xa91008j01t14w8u8i9d",  thumbnail: DefaultThumbnail },
  Satellite: { url: "mapbox://styles/wompwomp-69/cm96vey9z009001ri48hs8j5n",  thumbnail: SatelliteThumbnail },
  Dark:      { url: "mapbox://styles/wompwomp-69/cm96veqvt009101szf7g42jps",  thumbnail: DarkThumbnail },
  Light:     { url: "mapbox://styles/wompwomp-69/cm976c2u700ab01rc0cns2pe0",  thumbnail: LightThumbnail },
};

// ─── Highlight layer IDs ──────────────────────────────────────────────────────
const HILITE_SRC  = "selected-crop-highlight-src";
const HILITE_FILL = "selected-crop-highlight-fill";
const HILITE_LINE = "selected-crop-highlight-line";

const SIDEBAR_WIDTH = 500;
const PEEK = 1;

// ─────────────────────────────────────────────────────────────────────────────

function makeAccuracyCircle([lng, lat], accuracy) {
  const accNum = Number(accuracy);
  const safeAcc = Number.isFinite(accNum) ? accNum : 10;
  const radiusKm = Math.max(safeAcc, 10) / 1000;
  return turf.circle([lng, lat], radiusKm, { steps: 64, units: "kilometers" });
}

function getCropCenter(crop) {
  let coords = crop?.coordinates;
  if (!coords) return null;
  if (typeof coords === "string") {
    try { coords = JSON.parse(coords); } catch { return null; }
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

// ─────────────────────────────────────────────────────────────────────────────

const AdminCropMap = () => {
  addPulseStylesOnce();

  // ── Deep-link params ────────────────────────────────────────────────────────
  const locationState = useLocation().state || {};
  const [searchParams] = useSearchParams();
  const coerceNum = (val) => {
    if (val === null || val === undefined) return NaN;
    if (typeof val === "string" && val.trim() === "") return NaN;
    const n = Number(val);
    return Number.isFinite(n) ? n : NaN;
  };
  const target = {
    lat:      coerceNum(locationState.lat      ?? searchParams.get("lat")),
    lng:      coerceNum(locationState.lng      ?? searchParams.get("lng")),
    cropId:   String(locationState.cropId      ?? searchParams.get("cropId") ?? ""),
    cropName: locationState.cropName           ?? searchParams.get("cropName") ?? "",
    barangay: locationState.barangay           ?? searchParams.get("barangay") ?? "",
    zoom:     coerceNum(locationState.zoom     ?? searchParams.get("zoom")),
  };
  if (!Number.isFinite(target.zoom)) target.zoom = 16;

  // ── Map refs ────────────────────────────────────────────────────────────────
  const mapContainer = useRef(null);
  const map          = useRef(null);
  const markerRef    = useRef(null);
  const directionsRef = useRef(null);
  const drawRef      = useRef(null);

  const cropMarkerMapRef  = useRef(new Map());
  const selectedLabelRef  = useRef(null);
  const selectedHaloRef   = useRef(null);
  const hoverPopupRef     = useRef(null);
  const hoverLeaveTimerRef = useRef(null);
  const HILITE_ANIM_REF   = useRef(null);
  const hasDeepLinkedRef  = useRef(false);
  const savedMarkersRef   = useRef([]);

  // ── GPS refs ────────────────────────────────────────────────────────────────
  const userMarkerRef    = useRef(null);
  const userMarkerElRef  = useRef(null);
  const watchStopRef     = useRef(null);
  const compassStopRef   = useRef(null);

  // ── UI state ─────────────────────────────────────────────────────────────
  const [mapStyle, setMapStyle]               = useState(mapStyles.Default.url);
  const [showLayers, setShowLayers]           = useState(false);
  const [isSwitcherVisible, setIsSwitcherVisible] = useState(false);
  const [selectedBarangay, setSelectedBarangay]   = useState(null);
  const [isSidebarVisible, setIsSidebarVisible]   = useState(true);
  const [isDirectionsVisible]                 = useState(true);
  const [newTagLocation, setNewTagLocation]   = useState(null);
  const [isTagging, setIsTagging]             = useState(false);
  const [enlargedImage, setEnlargedImage]     = useState(null);
  const [hideCompareCard, setHideCompareCard] = useState(false);
  const [lockToBago, setLockToBago]           = useState(true);
  const [areMarkersVisible, setAreMarkersVisible] = useState(true);

  // ── Crop state ──────────────────────────────────────────────────────────────
  const [sidebarCrops, setSidebarCrops]       = useState([]);
  const [selectedCrop, setSelectedCrop]       = useState(null);
  const [selectedCropType, setSelectedCropType] = useState("All");
  const [cropTypes, setCropTypes]             = useState([]);
  const [selectedCropHistory, setSelectedCropHistory] = useState([]);
  const [activeHistoryId, setActiveHistoryId] = useState(null);

  // ── Filter state ────────────────────────────────────────────────────────────
  const initialHarvestFilter =
    locationState.harvestFilter ?? searchParams.get("harvestFilter") ?? "not_harvested";
  const [harvestFilter, setHarvestFilter]   = useState(initialHarvestFilter);
  const [timelineMode, setTimelineMode]     = useState("planted");
  const [timelineFrom, setTimelineFrom]     = useState("");
  const [timelineTo, setTimelineTo]         = useState("");

  // ── GPS state ───────────────────────────────────────────────────────────────
  const [userLoc, setUserLoc]       = useState(null);
  const [headingDeg, setHeadingDeg] = useState(null);

  // ── Season comparison (custom hook) ────────────────────────────────────────
  const season = useSeasonComparison(selectedCrop, selectedCropHistory, activeHistoryId);
  const { fieldHistory, currentSeasonRec } = season;

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function estimateAverageElevation(geom) {
    const m = map.current;
    if (!m || !geom || typeof m.queryTerrainElevation !== "function") return null;
    try {
      const feat = { type: "Feature", geometry: geom, properties: {} };
      const center = turf.centroid(feat);
      const [lng, lat] = center.geometry.coordinates;
      const raw = m.queryTerrainElevation({ lng, lat }, { exaggerated: false });
      if (typeof raw === "number" && Number.isFinite(raw)) return Number(raw.toFixed(1));
    } catch (err) {
      console.warn("estimateAverageElevation failed:", err);
    }
    return null;
  }

  // ── Layer callbacks (stable) ─────────────────────────────────────────────

  const ensureTerrain = useCallback(() => {
    ensureTerrainOnMap(map.current);
  }, []);

  const ensureBarangayLayers = useCallback(() => {
    ensureBarangayLayersOnMap(map.current, BARANGAYS_FC);
  }, []);

  const ensureUserAccuracyLayers = useCallback(() => {
    ensureUserAccuracyLayersOnMap(map.current);
  }, []);

  const updateUserAccuracyCircle = useCallback((lng, lat, acc) => {
    if (!map.current) return;
    ensureUserAccuracyLayersOnMap(map.current);
    const circle = makeAccuracyCircle([lng, lat], acc);
    map.current.getSource(USER_ACC_SOURCE)?.setData(circle);
  }, []);

  // ── GPS: set user marker ─────────────────────────────────────────────────

  const setUserMarker = useCallback((lng, lat, acc) => {
    if (!map.current) return;
    const nLng = Number(lng);
    const nLat = Number(lat);
    if (!Number.isFinite(nLng) || !Number.isFinite(nLat)) {
      toast.error("Invalid GPS coordinates."); return;
    }
    const m = map.current;
    if (!userMarkerElRef.current) {
      const el = document.createElement("div");
      el.style.cssText = "position:relative;width:26px;height:26px;border-radius:50%;border:2px solid rgba(37,99,235,0.55);background:rgba(37,99,235,0.10);box-shadow:0 0 4px rgba(37,99,235,0.35)";
      const tri = document.createElement("div");
      tri.style.cssText = "position:absolute;left:50%;top:50%;transform:translate(-50%,-55%);width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-bottom:12px solid #2563eb";
      el.appendChild(tri);
      userMarkerElRef.current = el;
      userMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat([nLng, nLat])
        .setPopup(new mapboxgl.Popup({ offset: 12 }).setText("You are here"))
        .addTo(m);
    } else {
      userMarkerRef.current.setLngLat([nLng, nLat]);
    }
    const safeAcc = Number.isFinite(Number(acc)) ? Number(acc) : 10;
    updateUserAccuracyCircle(nLng, nLat, safeAcc);
    m.easeTo({ center: [nLng, nLat], zoom: Math.max(m.getZoom(), 15), duration: 0, essential: true });
  }, [updateUserAccuracyCircle]);

  const handleFix = useCallback((glng, glat, accuracy) => {
    if (!map.current) return;
    const lng = Number(glng);
    const lat = Number(glat);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      toast.error("Invalid GPS coordinates from browser."); return;
    }
    const safeAcc = Number.isFinite(Number(accuracy)) ? Number(accuracy) : 10;
    if (lockToBago && !isInsideBounds([lng, lat], BAGO_CITY_BOUNDS)) {
      map.current.setMaxBounds(expandBoundsToIncludePoint(BAGO_CITY_BOUNDS, [lng, lat], 0.05));
      toast.info("You're outside Bago. Temporarily expanded bounds to include your location.");
    }
    setUserLoc({ lng, lat, acc: safeAcc });
    setUserMarker(lng, lat, safeAcc);
  }, [lockToBago, setUserMarker]);

  // ── Selection helpers ────────────────────────────────────────────────────

  const clearSelection = useCallback(() => {
    if (!map.current) return;
    if (HILITE_ANIM_REF.current) { clearInterval(HILITE_ANIM_REF.current); HILITE_ANIM_REF.current = null; }
    selectedLabelRef.current?.remove(); selectedLabelRef.current = null;
    selectedHaloRef.current?.remove();  selectedHaloRef.current  = null;
    if (map.current.getLayer(HILITE_FILL)) map.current.removeLayer(HILITE_FILL);
    if (map.current.getLayer(HILITE_LINE)) map.current.removeLayer(HILITE_LINE);
    if (map.current.getSource(HILITE_SRC)) map.current.removeSource(HILITE_SRC);
  }, []);

  const showMarkerChipAndHalo = useCallback((cropId, chipText = "Selected crop", color = "#10B981") => {
    if (!map.current) return;
    selectedLabelRef.current?.remove(); selectedLabelRef.current = null;
    selectedHaloRef.current?.remove();  selectedHaloRef.current  = null;

    const marker = cropMarkerMapRef.current.get(String(cropId));
    if (!marker) return;
    const at = marker.getLngLat();

    const chip = document.createElement("div");
    chip.className = "chip"; chip.textContent = chipText; chip.style.background = color;
    selectedLabelRef.current = new mapboxgl.Marker({ element: chip, anchor: "bottom", offset: [0, -42] })
      .setLngLat(at).addTo(map.current);

    const haloWrap = document.createElement("div");
    haloWrap.className = "pulse-wrapper";
    const ring = document.createElement("div");
    ring.className = "pulse-ring";
    const isGray = color === "#9CA3AF";
    ring.style.background = isGray ? "rgba(156,163,175,0.35)" : "rgba(16,185,129,0.35)";
    ring.style.boxShadow  = isGray ? "0 0 0 2px rgba(156,163,175,0.55) inset" : "0 0 0 2px rgba(16,185,129,0.55) inset";
    haloWrap.appendChild(ring);
    selectedHaloRef.current = new mapboxgl.Marker({ element: haloWrap, anchor: "center" })
      .setLngLat(at).addTo(map.current);

    try { marker.togglePopup(); } catch {}
  }, []);

  const highlightPolygon = useCallback((crop) => {
    if (!map.current || !crop) return;
    const harvested = isCropHarvested(crop);
    const color = harvested ? "#9CA3AF" : "#10B981";

    runWhenStyleReady(map.current, () => {
      let coords = crop.coordinates;
      if (typeof coords === "string") { try { coords = JSON.parse(coords); } catch { return; } }
      if (!Array.isArray(coords) || coords.length < 3) return;
      const first = coords[0]; const last = coords[coords.length - 1];
      if (JSON.stringify(first) !== JSON.stringify(last)) coords = [...coords, first];

      const feature = turf.polygon([coords], { id: crop.id, crop_name: crop.crop_name });
      const m = map.current;

      if (!m.getSource(HILITE_SRC)) {
        m.addSource(HILITE_SRC, { type: "geojson", data: { type: "FeatureCollection", features: [feature] } });
        m.addLayer({ id: HILITE_FILL, type: "fill",   source: HILITE_SRC, paint: { "fill-color": color, "fill-opacity": 0.18 } });
        m.addLayer({ id: HILITE_LINE, type: "line",   source: HILITE_SRC, paint: { "line-color": color, "line-width": 1.5, "line-opacity": 1 } });
      } else {
        m.getSource(HILITE_SRC).setData({ type: "FeatureCollection", features: [feature] });
        try { m.setPaintProperty(HILITE_FILL, "fill-color", color); m.setPaintProperty(HILITE_LINE, "line-color", color); } catch {}
      }

      if (HILITE_ANIM_REF.current) { clearInterval(HILITE_ANIM_REF.current); HILITE_ANIM_REF.current = null; }
      let w = 2, dir = +0.4;
      HILITE_ANIM_REF.current = setInterval(() => {
        if (!m.getLayer(HILITE_LINE)) return;
        w += dir;
        if (w >= 4) dir = -0.3; if (w <= 1) dir = +0.3;
        try { m.setPaintProperty(HILITE_LINE, "line-width", w); } catch {}
      }, 80);
    });
  }, []);

  const highlightSelection = useCallback((crop) => {
    if (!map.current || !crop) return;
    const harvested = isCropHarvested(crop);
    const color = harvested ? "#9CA3AF" : "#10B981";
    clearSelection();
    showMarkerChipAndHalo(crop.id, `${crop.crop_name}${crop.variety_name ? ` – ${crop.variety_name}` : ""}`, color);
    highlightPolygon(crop);
    const center = getCropCenter(crop);
    if (center) map.current.flyTo({ center, zoom: Math.max(map.current.getZoom(), 16), essential: true });
  }, [clearSelection, showMarkerChipAndHalo, highlightPolygon]);

  // ── Polygon loader ───────────────────────────────────────────────────────

  const loadPolygons = useCallback(async (cropsOverride = null) => {
    if (!map.current) return;
    let crops = cropsOverride;
    if (!crops) {
      const res = await axios.get("http://localhost:5000/api/crops");
      crops = (res.data || []).filter((c) => !isSoftDeletedCrop(c));
    } else {
      crops = crops.filter((c) => !isSoftDeletedCrop(c));
    }

    const fullData = buildPolygonsFromCrops(crops);

    if (map.current.getSource("crop-polygons")) {
      map.current.getSource("crop-polygons").setData(fullData);
      map.current.setPaintProperty("crop-polygons-layer", "fill-color", CROP_FILL_PAINT["fill-color"]);
      ensureCropPolygonLabelsLayer(map.current);
    } else {
      map.current.addSource("crop-polygons", { type: "geojson", data: fullData });
      map.current.addLayer({ id: "crop-polygons-layer", type: "fill",   source: "crop-polygons", paint: CROP_FILL_PAINT });
      map.current.addLayer({ id: "crop-polygons-outline", type: "line", source: "crop-polygons", paint: { "line-color": "#065F46", "line-width": 1 } });
    }
    ensureCropPolygonLabelsLayer(map.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Marker renderer ──────────────────────────────────────────────────────

  const renderSavedMarkers = useCallback(async () => {
    if (!map.current) return;
    try {
      const response = await axios.get("http://localhost:5000/api/crops");
      const crops = (response.data || []).filter((c) => !isSoftDeletedCrop(c));
      setSidebarCrops(crops);

      savedMarkersRef.current.forEach((m) => m.remove());
      savedMarkersRef.current = [];
      cropMarkerMapRef.current.clear();
      if (hoverPopupRef.current) { try { hoverPopupRef.current.remove(); } catch {} hoverPopupRef.current = null; }

      let filtered = selectedCropType === "All" ? crops : crops.filter((c) => c.crop_name === selectedCropType);
      if (harvestFilter === "harvested")    filtered = filtered.filter((c) => isCropHarvested(c));
      else if (harvestFilter === "not_harvested") filtered = filtered.filter((c) => !isCropHarvested(c));
      filtered = filtered.filter((c) => passesTimelineFilter(c, timelineMode, timelineFrom, timelineTo));

      for (const crop of filtered) {
        let coords = crop.coordinates;
        if (typeof coords === "string") { try { coords = JSON.parse(coords); } catch { continue; } }
        if (!Array.isArray(coords) || coords.length <= 2) continue;

        const first = coords[0], last = coords[coords.length - 1];
        if (JSON.stringify(first) !== JSON.stringify(last)) coords.push(first);

        const center = turf.centerOfMass(turf.polygon([coords])).geometry.coordinates;
        const isHarvestedFlag = isCropHarvested(crop);

        const marker = new mapboxgl.Marker({ color: isHarvestedFlag ? "#6B7280" : "#10B981" })
          .setLngLat(center).addTo(map.current);

        marker.getElement().addEventListener("click", () => {
          setSelectedCrop(crop); highlightSelection(crop); setIsSidebarVisible(true);setHideCompareCard(false);  
        });
        marker.getElement().addEventListener("mouseenter", () => {
          if (hoverLeaveTimerRef.current) { clearTimeout(hoverLeaveTimerRef.current); hoverLeaveTimerRef.current = null; }
          if (hoverPopupRef.current) { try { hoverPopupRef.current.remove(); } catch {} hoverPopupRef.current = null; }
        });

        cropMarkerMapRef.current.set(String(crop.id), marker);
        savedMarkersRef.current.push(marker);
      }
      ensureDeepLinkSelection();
    } catch (error) {
      console.error("Failed to load saved markers:", error);
    }
  }, [selectedCropType, harvestFilter, timelineMode, timelineFrom, timelineTo]); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshMapData = useCallback(async () => {
    try { await loadPolygons(); await renderSavedMarkers(); } catch (e) { console.error(e); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Mark harvested ───────────────────────────────────────────────────────

  const markHarvested = useCallback(async (cropId, harvestedDate = null) => {
    try {
      await axios.patch(`http://localhost:5000/api/crops/${cropId}/harvest`, harvestedDate ? { harvested_date: harvestedDate } : {});
      toast.success("Marked as harvested");
      await refreshMapData();
      setSelectedCrop((prev) =>
        prev && String(prev.id) === String(cropId)
          ? { ...prev, is_harvested: 1, harvested_date: harvestedDate || new Date().toISOString().slice(0, 10) }
          : prev
      );
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to mark harvested");
    }
  }, [refreshMapData]);

  // ── Barangay marker ──────────────────────────────────────────────────────

  const handleBarangaySelect = (barangayData) => {
    setSelectedBarangay(barangayData);
    if (markerRef.current) markerRef.current.remove();
    if (!map.current || !barangayData) return;

    const el = document.createElement("div");
    Object.assign(el.style, { width: "18px", height: "18px", borderRadius: "50%", backgroundColor: "#10B981", border: "3px solid white", boxShadow: "0 0 10px rgba(0,0,0,0.3)" });

    const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
      <div class="text-sm">
        <h3 class="font-bold text-green-600 text-base">${barangayData.name}</h3>
        ${barangayData.population ? `<p><strong>Population:</strong> ${barangayData.population}</p>` : ""}
        ${barangayData.crops ? `<p><strong>Crops:</strong> ${barangayData.crops.join(", ")}</p>` : ""}
      </div>
    `);

    markerRef.current = new mapboxgl.Marker(el)
      .setLngLat(barangayData.coordinates).setPopup(popup).addTo(map.current);
    markerRef.current.togglePopup();
  };

  const zoomToBarangay = (coordinates) => {
    map.current?.flyTo({ center: coordinates, zoom: 14, essential: true });
  };

  // ── Open tag form for existing crop ─────────────────────────────────────

  const openTagFormForExistingCrop = useCallback((crop) => {
    if (!crop) return;
    let coords = crop.coordinates;
    if (!coords) return;
    if (typeof coords === "string") { try { coords = JSON.parse(coords); } catch { return; } }
    if (!Array.isArray(coords) || coords.length < 3) return;

    const first = coords[0], last = coords[coords.length - 1];
    if (JSON.stringify(first) !== JSON.stringify(last)) coords = [...coords, first];

    const farmGeometry = { type: "Polygon", coordinates: [coords] };
    const center = getCropCenter({ ...crop, coordinates: coords }) || coords[0];

    let avgElevationM = crop.avg_elevation_m ?? crop.avgElevationM ?? crop.avg_elevation ?? crop.elevation ?? null;
    if (avgElevationM == null) { const approx = estimateAverageElevation(farmGeometry); if (approx != null) avgElevationM = approx; }

    const barangayName = crop.farmer_barangay || crop.barangay || selectedBarangay?.name || "";
    setSelectedBarangay((prev) => ({ ...(prev || {}), name: barangayName || prev?.name || "", coordinates: center }));
    setNewTagLocation({
      coordinates: coords, hectares: crop.estimated_hectares, farmGeometry, avgElevationM,
      farmerFirstName: crop.farmer_first_name || "", farmerLastName: crop.farmer_last_name || "",
      farmerMobile: crop.farmer_mobile || "", farmerBarangay: barangayName || "",
      farmerAddress: crop.farmer_address || "", tenureId: crop.tenure_id ?? crop.tenure ?? "",
      isAnonymousFarmer: crop.is_anonymous_farmer === 1 || crop.is_anonymous_farmer === "1" || crop.is_anonymous_farmer === true,
    });
    setIsTagging(true);
  }, [selectedBarangay]);

  // ── Deep-link selection ──────────────────────────────────────────────────

  const ensureDeepLinkSelection = useCallback(() => {
    if (!map.current || !target.cropId || !sidebarCrops.length) return;
    const hit = sidebarCrops.find((c) => String(c.id) === String(target.cropId));
    if (!hit) return;
    setSelectedCrop(hit); setIsSidebarVisible(true); highlightSelection(hit);
    const center = getCropCenter(hit);
    if (center) map.current.flyTo({ center, zoom: target.zoom ?? 17, essential: true });
    hasDeepLinkedRef.current = true;
  }, [sidebarCrops, target.cropId, target.zoom, highlightSelection]);

  useEffect(() => { if (!hasDeepLinkedRef.current) ensureDeepLinkSelection(); }, [ensureDeepLinkSelection]);

  // ── Fetch crop history ───────────────────────────────────────────────────

  useEffect(() => {
    if (!selectedCrop) { setSelectedCropHistory([]); setActiveHistoryId(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`http://localhost:5000/api/crops/${selectedCrop.id}/history`);
        if (!cancelled) {
          setSelectedCropHistory((Array.isArray(res.data) ? res.data : []).filter((r) => !isSoftDeletedCrop(r)));
          setActiveHistoryId(null);
        }
      } catch { if (!cancelled) { setSelectedCropHistory([]); setActiveHistoryId(null); } }
    })();
    return () => { cancelled = true; };
  }, [selectedCrop]);

  // ── Map init / style change ──────────────────────────────────────────────

  useEffect(() => {
    if (!map.current) {
      // ─ First mount ─
      const m = new mapboxgl.Map({
        container: mapContainer.current,
        style: mapStyle,
        center: [122.9616, 10.5074],
        zoom: 7,
      });
      map.current = m;
      if (lockToBago) m.setMaxBounds(BAGO_CITY_BOUNDS);

      axios.get("http://localhost:5000/api/crops/types").then((res) => setCropTypes(res.data));

      drawRef.current = new MapboxDraw({ displayControlsDefault: false, controls: { polygon: true, trash: true } });
      m.addControl(drawRef.current, "bottom-right");
      m.addControl(new mapboxgl.NavigationControl(), "bottom-right");

      m.on("load", async () => {
        ensureTerrain();

        if (!directionsRef.current && isDirectionsVisible) {
          const directions = new MapboxDirections({
            accessToken: mapboxgl.accessToken, unit: "metric", profile: "mapbox/driving",
            controls: { instructions: true, profileSwitcher: true },
          });
          directionsRef.current = directions;
          m.addControl(directions, "top-left");
        }

        try { await loadPolygons(); } catch (err) { console.error("Failed to load polygons:", err); }
        ensureUserAccuracyLayers();
        ensureBarangayLayers();
        await renderSavedMarkers();

        if (!hasDeepLinkedRef.current) {
          let focus = null;
          if (target.cropId && sidebarCrops.length) {
            const hit = sidebarCrops.find((c) => String(c.id) === String(target.cropId));
            if (hit) { setSelectedCrop(hit); highlightSelection(hit); setIsSidebarVisible(true); focus = getCropCenter(hit); }
          }
          if (!focus && Number.isFinite(target.lat) && Number.isFinite(target.lng)) focus = [target.lng, target.lat];
          if (focus) { hasDeepLinkedRef.current = true; m.flyTo({ center: focus, zoom: target.zoom, essential: true }); }
        }
      });

      m.on("click", "crop-polygons-layer", (e) => {
        const cropId = e.features[0]?.properties?.id;
        if (!cropId) return;
        const cropData = sidebarCrops.find((c) => String(c.id) === String(cropId));
        if (cropData && !isSoftDeletedCrop(cropData)) { setSelectedCrop(cropData); highlightSelection(cropData); setIsSidebarVisible(true); setHideCompareCard(false); }
      });

      const handleDrawAttempt = (feature) => {
        if (!feature?.geometry) return;
        if (feature.geometry.type !== "Polygon" && feature.geometry.type !== "MultiPolygon") return;
        const poly = feature.geometry;
        const detection = strictDetectBarangayForGeometry(poly, BARANGAYS_FC, turf);

        if (!detection) {
          try { drawRef.current?.delete(feature.id); } catch {}
          setIsTagging(false); setNewTagLocation(null);
          toast.error("The tagged area is outside of a single barangay boundary. Please draw entirely within one barangay.");
          return false;
        }

        const ring = poly.type === "Polygon" ? poly.coordinates?.[0] : poly.coordinates?.[0]?.[0];
        const hectares = +(turf.area({ type: "Feature", geometry: poly, properties: {} }) / 10000).toFixed(2);
        const avgElevationM = estimateAverageElevation(poly);

        setSelectedBarangay({ name: detection.name, coordinates: detection.centroid });
        setNewTagLocation({ coordinates: ring, hectares, farmGeometry: poly, avgElevationM });
        setIsTagging(true);
        return true;
      };

      m.on("draw.create", (e) => handleDrawAttempt(e.features?.[0]));
      m.on("draw.update", (e) => {
        const ok = handleDrawAttempt(e.features?.[0]);
        if (!ok) { try { drawRef.current?.delete(e.features?.[0]?.id); } catch {} }
      });

    } else {
      // ─ Style change only ─
      map.current.setStyle(mapStyle);
      map.current.once("style.load", async () => {
        ensureTerrain();
        ensureUserAccuracyLayers();
        ensureBarangayLayers();

        if (userLoc) {
          updateUserAccuracyCircle(userLoc.lng, userLoc.lat, userLoc.acc);
          userMarkerRef.current?.setLngLat([userLoc.lng, userLoc.lat]).addTo(map.current);
          if (typeof headingDeg === "number" && userMarkerElRef.current)
            userMarkerElRef.current.style.transform = `rotate(${headingDeg}deg)`;
        }

        await loadPolygons();
        await renderSavedMarkers();

        if (selectedCrop) {
          highlightSelection(selectedCrop);
        } else if (!hasDeepLinkedRef.current) {
          let focus = null;
          if (target.cropId && sidebarCrops.length) {
            const hit = sidebarCrops.find((c) => String(c.id) === String(target.cropId));
            if (hit) { setSelectedCrop(hit); highlightSelection(hit); setIsSidebarVisible(true); focus = getCropCenter(hit); }
          }
          if (!focus && Number.isFinite(target.lat) && Number.isFinite(target.lng)) focus = [target.lng, target.lat];
          if (focus) { hasDeepLinkedRef.current = true; map.current.flyTo({ center: focus, zoom: target.zoom, essential: true }); }
        }
        ensureDeepLinkSelection();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapStyle, lockToBago, ensureUserAccuracyLayers, ensureBarangayLayers, ensureTerrain, renderSavedMarkers, loadPolygons, highlightSelection]);

  // ── Re-render markers on filter change ──────────────────────────────────

  useEffect(() => {
    if (!map.current || !areMarkersVisible) return;
    renderSavedMarkers();
  }, [selectedCropType, harvestFilter, timelineMode, timelineFrom, timelineTo, areMarkersVisible, renderSavedMarkers]);

  // ── Max-bounds toggle ────────────────────────────────────────────────────

  useEffect(() => {
    if (!map.current) return;
    map.current.setMaxBounds(lockToBago ? BAGO_CITY_BOUNDS : null);
  }, [lockToBago]);

  // ── Polygon filter effect ────────────────────────────────────────────────

  useEffect(() => {
    const applyFilters = async () => {
      if (!map.current) return;
      try {
        let crops = sidebarCrops.length
          ? sidebarCrops.filter((c) => !isSoftDeletedCrop(c))
          : (await axios.get("http://localhost:5000/api/crops")).data.filter((c) => !isSoftDeletedCrop(c));

        let filtered = [...crops];
        if (selectedCropType !== "All")          filtered = filtered.filter((c) => c.crop_name === selectedCropType);
        if (harvestFilter === "harvested")        filtered = filtered.filter((c) => isCropHarvested(c));
        else if (harvestFilter === "not_harvested") filtered = filtered.filter((c) => !isCropHarvested(c));
        filtered = filtered.filter((c) => passesTimelineFilter(c, timelineMode, timelineFrom, timelineTo));

        await loadPolygons(filtered);
        ensureBarangayLayers();
      } catch (err) { console.error("Failed to filter polygons:", err); }
    };
    applyFilters();
  }, [selectedCropType, harvestFilter, timelineMode, timelineFrom, timelineTo, sidebarCrops, loadPolygons, ensureBarangayLayers]);

  // ── Cleanup ──────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      watchStopRef.current?.();
      userMarkerRef.current?.remove();
      compassStopRef.current?.();
      clearSelection();
      if (HILITE_ANIM_REF.current) { clearInterval(HILITE_ANIM_REF.current); HILITE_ANIM_REF.current = null; }
      if (hoverLeaveTimerRef.current) { clearTimeout(hoverLeaveTimerRef.current); hoverLeaveTimerRef.current = null; }
      if (hoverPopupRef.current) { try { hoverPopupRef.current.remove(); } catch {} hoverPopupRef.current = null; }
      try { map.current?.remove(); } catch (e) { console.warn("Error removing map:", e); }
      map.current = null;
      directionsRef.current = null;
    };
  }, [clearSelection]);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="relative h-full w-full">

      {/* GPS toolbar */}
      <div className="absolute top-4 right-4 z-50 flex items-center gap-2 bg-white/70 backdrop-blur rounded-xl p-2 shadow-md">
        <IconButton
          title="Locate me"
          active={false}
          onClick={async () => {
            if (!("geolocation" in navigator)) { toast.error("Geolocation not supported by this browser."); return; }
            try {
              const pos = await new Promise((res, rej) =>
                navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 })
              );
              const { longitude, latitude, accuracy } = pos.coords;
              const glng = Number(longitude), glat = Number(latitude);
              if (!Number.isFinite(glng) || !Number.isFinite(glat)) { toast.error("Browser returned invalid GPS coordinates."); return; }
              handleFix(glng, glat, accuracy);
            } catch (e) { toast.error(explainGeoError(e)); }
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2a1 1 0 0 1 1 1v1.06A8.004 8.004 0 0 1 19.94 11H21a1 1 0 1 1 0 2h-1.06A8.004 8.004 0 0 1 13 19.94V21a1 1 0 1 1-2 0v-1.06A8.004 8.004 0 0 1 4.06 13H3a1 1 0 1 1 0-2h1.06A8.004 8.004 0 0 1 11 4.06V3a1 1 0 0 1 1-1Zm0 4a6 6 0 1 0 .001 12.001A6 6 0 0 0 12 6Zm0 3.5a2.5 2.5 0 1 1 0 5.001A2.5 2.5 0 0 1 12 9.5Z" />
          </svg>
        </IconButton>
      </div>

      {/* Map canvas */}
      <div ref={mapContainer} className="h-full w-full" />

      {/* Crop overview card */}
      {currentSeasonRec && !hideCompareCard && (
        <CropOverviewCard
          season={season}
          onHide={() => setHideCompareCard(true)}
        />
      )}

      {/* Tag form */}
      {isTagging && newTagLocation && (
        <TagCropForm
          defaultLocation={{ ...newTagLocation, hectares: newTagLocation.hectares }}
          selectedBarangay={selectedBarangay?.name}
          barangaysFC={BARANGAYS_FC}
          farmGeometry={newTagLocation.farmGeometry}
          onCancel={() => { setIsTagging(false); setNewTagLocation(null); drawRef.current?.deleteAll(); }}
          onSave={async (formData) => {
            try {
              const adminId = localStorage.getItem("user_id");
              if (adminId) formData.append("admin_id", adminId);
              await axios.post("http://localhost:5000/api/crops", formData, { headers: { "Content-Type": "multipart/form-data" } });
              alert("Crop saved!");
              await loadPolygons();
              await renderSavedMarkers();
            } catch (error) {
              const msg = axios.isAxiosError(error)
                ? error.response?.data?.message || error.response?.data?.error || error.message || "Unknown server error"
                : "Unexpected error";
              alert(`Failed to save crop: ${msg}`);
            } finally {
              setIsTagging(false); setNewTagLocation(null); drawRef.current?.deleteAll();
            }
          }}
        />
      )}

      {/* Layer switcher (sidebar hidden) */}
      {!isSidebarVisible && (
        <button
          onClick={() => setIsSwitcherVisible(!isSwitcherVisible)}
          className="absolute bottom-6 left-4 w-20 h-20 rounded-xl shadow-md overflow-hidden z-30 bg-white border border-gray-300 hover:shadow-lg transition"
          title="Map layers"
        >
          <div className="w-full h-full relative">
            <img src={DefaultThumbnail} alt="Layers" className="w-full h-full object-cover" />
            <div className="absolute bottom-0 left-0 right-0 text-white text-xs font-semibold px-2 py-1 bg-black/60 text-center">Layers</div>
          </div>
        </button>
      )}

      {!isSidebarVisible && isSwitcherVisible && (
        <div className="absolute bottom-28 left-4 bg-white p-2 rounded-xl shadow-xl flex space-x-2 z-30">
          {Object.entries(mapStyles).map(([label, { url, thumbnail }]) => (
            <button
              key={label}
              onClick={() => { setMapStyle(url); setIsSwitcherVisible(false); }}
              className="w-16 h-16 rounded-md border border-gray-300 overflow-hidden relative hover:shadow-md"
              title={label}
            >
              <img src={thumbnail} alt={label} className="w-full h-full object-cover" />
              <div className="absolute bottom-0 w-full text-[10px] text-white text-center bg-black/60 py-[2px]">{label}</div>
            </button>
          ))}
        </div>
      )}

      {/* Marker toggle button */}
      {!isTagging && (
        <button
          onClick={() => {
            if (areMarkersVisible) {
              cropMarkerMapRef.current.forEach((m) => m.remove?.());
              if (hoverLeaveTimerRef.current) { clearTimeout(hoverLeaveTimerRef.current); hoverLeaveTimerRef.current = null; }
              if (hoverPopupRef.current) { try { hoverPopupRef.current.remove(); } catch {} hoverPopupRef.current = null; }
            } else {
              renderSavedMarkers();
            }
            setAreMarkersVisible(!areMarkersVisible);
            if (!areMarkersVisible) clearSelection();
          }}
          className="absolute bottom-[194px] right-[9px] z-50 bg-white border border-gray-300 rounded-[5px] w-8 h-8 flex items-center justify-center shadow-[0_0_8px_2px_rgba(0,0,0,0.15)]"
          title={areMarkersVisible ? "Hide Markers" : "Show Markers"}
        >
          <svg className="w-5 h-5 text-black" fill={!areMarkersVisible ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s6-5.686 6-10a6 6 0 10-12 0c0 4.314 6 10 6 10z" />
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
            harvestFilter={harvestFilter}
            setHarvestFilter={setHarvestFilter}
            timelineMode={timelineMode}
            setTimelineMode={setTimelineMode}
            timelineFrom={timelineFrom}
            setTimelineFrom={setTimelineFrom}
            timelineTo={timelineTo}
            setTimelineTo={setTimelineTo}
            onStartNewSeason={openTagFormForExistingCrop}
            onCropUpdated={(updated) => {
              setSelectedCrop(updated);
              setSidebarCrops((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
              if (isCropHarvested(updated)) setHarvestFilter("harvested");
              renderSavedMarkers();
            }}
            cropHistory={fieldHistory}
            onMarkHarvested={markHarvested}
            onHistorySelect={(rec) => { setActiveHistoryId(rec ? rec.id : null); setHideCompareCard(false); }}
            activeHistoryId={activeHistoryId}
          />
        )}
      </div>

      <ToastContainer position="top-center" autoClose={3000} hideProgressBar pauseOnHover theme="light" style={{ zIndex: 9999 }} />

      {enlargedImage && (
        <div className="fixed inset-0 bg-black bg-opacity-90 z-[9999] flex justify-center items-center" onClick={() => setEnlargedImage(null)}>
          <button onClick={(e) => { e.stopPropagation(); setEnlargedImage(null); }} className="absolute top-4 right-4 text-white text-2xl font-bold z-[10000] hover:text-red-400" title="Close">×</button>
          <img src={enlargedImage} alt="Fullscreen Crop" className="max-w-full max-h-full object-contain" />
        </div>
      )}
    </div>
  );
};

export default AdminCropMap;