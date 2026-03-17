// src/components/VotersMap/VotersMap.js
import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import SidebarToggleButton from "../VotersMap/MapControls/SidebarToggleButton";
import VotersSidebar from "./VotersSidebar";
import TagVotersForm from "./TagVotersForm";
import BARANGAYS_FC from "./Data/Bacolodgeojson";

// ✅ Map style thumbnails
import DefaultThumbnail from "../MapboxImages/map-default.png";
import SatelliteThumbnail from "../MapboxImages/map-satellite.png";
import DarkThumbnail from "../MapboxImages/map-dark.png";
import LightThumbnail from "../MapboxImages/map-light.png";

import {
  DEFAULT_HOUSEHOLD_FORM,
  validateHouseholdForm,
  getLoggedInUserId,
  buildBarangayOptions,
  detectBarangayForPoint,
  MarkCircleIcon,
  clearMarkers,
  clearTempMarker,
  addTempMarker,
  getMarkerColor,
  buildHouseholdPopupHTML,
} from "./VotersMapHelper";

mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN || "";

const BACOLOD_CITY_BOUNDS = [
  [122.87, 10.59],
  [123.03, 10.72],
];

const SIDEBAR_WIDTH = 500;
const SIDEBAR_PEEK = 1;
const API = "http://localhost:5000/api/voters";
const MANAGE_API = "http://localhost:5000/api/managevoters";

const normalizeName = (name = "") =>
  String(name)
    .trim()
    .toLowerCase()
    .replace(/^brgy\.?\s*/i, "")
    .replace(/^barangay\s*/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function buildBarangayLookup(barangayList = []) {
  const map = new Map();
  for (const b of barangayList) {
    if (!b?.id || !b?.barangay_name) continue;
    const raw = String(b.barangay_name).trim();
    const normalized = normalizeName(raw);
    map.set(normalized, b);
  }
  return map;
}

function findBarangayMatch(lookup, detectedName = "") {
  if (!lookup || !detectedName) return null;
  const normalized = normalizeName(detectedName);
  if (lookup.has(normalized)) return lookup.get(normalized);
  for (const [, value] of lookup.entries()) {
    const candidate = normalizeName(value?.barangay_name || "");
    if (!candidate) continue;
    if (candidate === normalized) return value;
    if (candidate.includes(normalized)) return value;
    if (normalized.includes(candidate)) return value;
  }
  return null;
}

export default function VotersMap() {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);

  const savedMarkersRef = useRef([]);
  const householdMarkerMapRef = useRef(new Map());
  const tempMarkerRef = useRef(null);

  // ✅ Ref to track active filter without causing re-renders
  const activeFilterRef = useRef({ barangay: "", precinct: "" });

  const [householdRecords, setHouseholdRecords] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [mapStyle, setMapStyle] = useState(
    "mapbox://styles/wompwomp-69/cmm5q9kl7000l01so1g8m6tpx"
  );
  const [lockToBago, setLockToBago] = useState(true);
  const [barangayList, setBarangayList] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);

  // ✅ Map style switcher
  const [isSwitcherVisible, setIsSwitcherVisible] = useState(false);

  // ✅ Map styles definition
  const mapStyles = {
    Default: {
      url: "mapbox://styles/wompwomp-69/cmm5q9kl7000l01so1g8m6tpx",
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

  // ✅ Track readiness of map and candidates separately
  const [mapReady, setMapReady] = useState(false);
  const [candidatesReady, setCandidatesReady] = useState(false);
  const [activeFilter, setActiveFilter] = useState({ barangay: "", precinct: "" });

  const barangayLookup = useMemo(
    () => buildBarangayLookup(barangayList),
    [barangayList]
  );

  const barangayOptions = useMemo(
    () => buildBarangayOptions(barangayList, BARANGAYS_FC),
    [barangayList]
  );

  const mayorOptions = useMemo(
    () => candidates.filter((c) => c.position === "mayor"),
    [candidates]
  );

  const viceMayorOptions = useMemo(
    () => candidates.filter((c) => c.position === "vice_mayor"),
    [candidates]
  );

  const [isTagging, setIsTagging] = useState(false);
  const [tagLngLat, setTagLngLat] = useState(null);
  const [isMarkMode, setIsMarkMode] = useState(false);

  const [form, setForm] = useState(DEFAULT_HOUSEHOLD_FORM);
  const setField = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const zoomToLocation = useCallback((lngLatArr) => {
    const m = mapRef.current;
    if (!m || !Array.isArray(lngLatArr)) return;
    m.flyTo({ center: lngLatArr, zoom: 17, essential: true });
  }, []);

  const selectRecord = useCallback(
    (rec) => {
      if (!rec) return;
      setSelectedRecord(rec);
      const lng = Number(rec.lng);
      const lat = Number(rec.lat);
      if (Number.isFinite(lng) && Number.isFinite(lat)) {
        zoomToLocation([lng, lat]);
      }
      const marker = householdMarkerMapRef.current.get(String(rec.id));
      if (marker) marker.togglePopup();
    },
    [zoomToLocation]
  );

  const ensureBarangayLayers = useCallback(() => {
  const m = mapRef.current;
  if (!m || !BARANGAYS_FC?.features?.length) return;

  // source
  if (!m.getSource("barangays-src")) {
    m.addSource("barangays-src", {
      type: "geojson",
      data: BARANGAYS_FC,
    });
  }

  // ✅ Fill layer — subtle tint so boundaries are easy to spot
  if (!m.getLayer("barangays-fill")) {
    m.addLayer({
      id: "barangays-fill",
      type: "fill",
      source: "barangays-src",
      paint: {
        "fill-color": "#10b981",   // emerald green tint
        "fill-opacity": 0.08,      // very subtle — adjust 0.05–0.15
      },
    });
  }

  // ✅ Thicker boundary line
  if (!m.getLayer("barangays-line")) {
    m.addLayer({
      id: "barangays-line",
      type: "line",
      source: "barangays-src",
      paint: {
        "line-color": "#10b981",   // matching green
        "line-width": 2,           // thicker than before
        "line-opacity": 0.9,
      },
    });
  }

  // name labels
  if (!m.getLayer("barangays-labels")) {
    m.addLayer({
      id: "barangays-labels",
      type: "symbol",
      source: "barangays-src",
      layout: {
        "text-field": [
          "coalesce",
          ["get", "barangay_name"],
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
          10, 10,
          12, 12,
          14, 14,
          16, 18,
        ],
        "text-font": ["Open Sans Semibold", "Arial Unicode MS Regular"],
        "text-allow-overlap": false,
      },
      paint: {
        "text-color": "#ffffff",              // ✅ white text for satellite
        "text-halo-color": "rgba(0,0,0,0.8)", // ✅ dark halo for contrast
        "text-halo-width": 1.5,
        "text-halo-blur": 0.2,
      },
    });
  }
}, []);

  // ✅ Apply filter to markers
  const applyMarkerFilter = useCallback(
    ({ barangay, precinct }) => {
      activeFilterRef.current = { barangay, precinct };
      setActiveFilter({ barangay, precinct });

      for (const [id, marker] of householdMarkerMapRef.current.entries()) {
        const row = householdRecords.find((r) => String(r.id) === id);
        if (!row) continue;

        const matchBarangay =
          !barangay ||
          String(row.barangay_name || "").toLowerCase() ===
            barangay.toLowerCase();

        const matchPrecinct =
          !precinct ||
          String(row.precinct_no ?? row.precinct_id ?? "") === precinct;

        marker.getElement().style.display =
          matchBarangay && matchPrecinct ? "block" : "none";
      }
    },
    [householdRecords]
  );

  // ✅ renderHouseholdMarkers only depends on candidates
  const renderHouseholdMarkers = useCallback(async () => {
    const m = mapRef.current;
    if (!m) return;

    try {
      const res = await axios.get(`${API}/households`);
      const rows = Array.isArray(res.data) ? res.data : [];
      setHouseholdRecords(rows);

      clearMarkers(savedMarkersRef, householdMarkerMapRef);

      for (const row of rows) {
        const lng = Number(row.lng);
        const lat = Number(row.lat);
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;

        const popup = new mapboxgl.Popup({ offset: 18 }).setHTML(
          buildHouseholdPopupHTML(row)
        );

        const el = document.createElement("div");
        el.className = "marker-dot";
        el.style.backgroundColor = getMarkerColor(row, candidates);

        // ✅ Re-apply current filter from ref
        const { barangay, precinct } = activeFilterRef.current;
        const matchBarangay =
          !barangay ||
          String(row.barangay_name || "").toLowerCase() ===
            barangay.toLowerCase();
        const matchPrecinct =
          !precinct ||
          String(row.precinct_no ?? row.precinct_id ?? "") === precinct;
        el.style.display = matchBarangay && matchPrecinct ? "block" : "none";

        const marker = new mapboxgl.Marker(el)
          .setLngLat([lng, lat])
          .setPopup(popup)
          .addTo(m);

        el.addEventListener("click", (ev) => {
          ev.stopPropagation();
          savedMarkersRef.current.forEach((mk) => {
            mk.getElement().classList.remove("active");
          });
          el.classList.add("active");
          setIsSidebarVisible(true);
          setSelectedRecord(row);
        });

        householdMarkerMapRef.current.set(String(row.id), marker);
        savedMarkersRef.current.push(marker);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load household voter markers.");
    }
  }, [candidates]);

  const handleCloseForm = () => {
    setIsTagging(false);
    setTagLngLat(null);
    clearTempMarker(tempMarkerRef);
  };

  const handleSave = async () => {
    if (!tagLngLat) return;

    const errMsg = validateHouseholdForm(form);
    if (errMsg) return toast.error(errMsg);

    const matchedBarangay = findBarangayMatch(barangayLookup, form.barangay_name);
    const finalBarangayId = form.barangay_id || matchedBarangay?.id || "";
    const finalBarangayName =
      matchedBarangay?.barangay_name || form.barangay_name || "";

    if (!finalBarangayId) return toast.error("Barangay not set.");

    if (!currentUserId) {
      toast.error("No logged-in user detected. Please log in again.");
      return;
    }

    try {
      await axios.post(`${API}/households`, {
        ...form,
        barangay_id: finalBarangayId,
        barangay_name: finalBarangayName,
        precinct_id: form.precinct_id ? String(form.precinct_id) : null,
        lat: tagLngLat.lat,
        lng: tagLngLat.lng,
        encoded_by: currentUserId,
        is_visited: 1,
      });

      toast.success("Household saved!");
      handleCloseForm();
      await renderHouseholdMarkers();
    } catch (error) {
      const msg =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        "Unknown server error";
      toast.error(`Failed to save household: ${msg}`);
    }
  };

  // Load barangays
  useEffect(() => {
    axios
      .get(`${API}/barangays`)
      .then((res) => setBarangayList(Array.isArray(res.data) ? res.data : []))
      .catch((err) => console.error("Failed to load barangays", err));
  }, []);

  // ✅ Load candidates from correct endpoint
  useEffect(() => {
    axios
      .get(`${MANAGE_API}/candidates`)
      .then((res) => {
        setCandidates(Array.isArray(res.data) ? res.data : []);
        setCandidatesReady(true);
      })
      .catch((err) => {
        console.error("Failed to load candidates", err);
        setCandidatesReady(true);
      });
  }, []);

  // Load current user
  useEffect(() => {
    const uid = getLoggedInUserId();
    if (uid) setCurrentUserId(uid);
  }, []);

  // ✅ Map init — only signals mapReady, does NOT render markers directly
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    if (!mapRef.current) {
      const m = new mapboxgl.Map({
        container,
        style: mapStyle,
        center: [122.9616, 10.5074],
        zoom: 12,
      });
      mapRef.current = m;

      if (lockToBago) m.setMaxBounds(BACOLOD_CITY_BOUNDS);
      m.addControl(new mapboxgl.NavigationControl(), "bottom-right");

      // ✅ Just signal ready
      m.on("load", () => setMapReady(true));
    } else {
      const m = mapRef.current;
      setMapReady(false); // reset while style reloads
      m.setStyle(mapStyle);
      m.once("style.load", () => setMapReady(true));
    }
  }, [mapStyle, lockToBago]);

  // ✅ Render markers + barangay layers when BOTH map AND candidates are ready
  useEffect(() => {
    if (!mapReady || !candidatesReady) return;
    ensureBarangayLayers(); // ✅ re-add borders/labels after every style load
    renderHouseholdMarkers();
  }, [mapReady, candidatesReady, renderHouseholdMarkers, ensureBarangayLayers]);

  // Bounds lock toggle
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    if (lockToBago) m.setMaxBounds(BACOLOD_CITY_BOUNDS);
    else m.setMaxBounds(null);
  }, [lockToBago]);

  // Map click for mark mode
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;

    const handleMapClick = (e) => {
      if (!isMarkMode) return;

      const clickedOnMarker = e.originalEvent?.target?.closest?.(".mapboxgl-marker");
      if (clickedOnMarker) return;

      addTempMarker(m, tempMarkerRef, e.lngLat.lng, e.lngLat.lat);
      setTagLngLat(e.lngLat);
      setIsTagging(true);

      const detectedName = detectBarangayForPoint(
        e.lngLat.lng,
        e.lngLat.lat,
        BARANGAYS_FC
      );

      const matchedBarangay = findBarangayMatch(barangayLookup, detectedName);

      setForm({
        ...DEFAULT_HOUSEHOLD_FORM,
        barangay_name: matchedBarangay?.barangay_name || detectedName || "",
        barangay_id: matchedBarangay?.id || "",
      });

      if (!detectedName) {
        toast.info("No barangay detected for this location.");
      }
    };

    m.on("click", handleMapClick);
    return () => m.off("click", handleMapClick);
  }, [isMarkMode, barangayLookup]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearMarkers(savedMarkersRef, householdMarkerMapRef);
      clearTempMarker(tempMarkerRef);
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch {}
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <div className="relative h-full w-full">
      <div ref={mapContainerRef} className="h-full w-full" />

      {/* Mark mode button */}
      <div className="absolute bottom-[118px] right-[10px] z-50 flex flex-col items-end">
        <button
          type="button"
          onClick={() => {
            setIsMarkMode((prev) => {
              const next = !prev;
              if (!next) {
                setIsTagging(false);
                setTagLngLat(null);
                clearTempMarker(tempMarkerRef);
              }
              return next;
            });
          }}
          className={[
            "w-[29px] h-[29px] rounded-md border shadow-sm flex items-center justify-center mb-2",
            "bg-white hover:bg-gray-50 active:bg-gray-100 transition",
            isMarkMode ? "border-red-500 ring-1.5 ring-red-200" : "border-gray-200",
          ].join(" ")}
          title={isMarkMode ? "Mark Mode: ON" : "Mark Mode: OFF"}
        >
          <MarkCircleIcon active={isMarkMode} />
        </button>

        {isMarkMode && (
          <div className="bg-white px-3 py-2 rounded-lg shadow border text-xs text-gray-700 w-[200px]">
            Mark Mode is ON. Click the map to drop a mark and open the form.
          </div>
        )}
      </div>

      {/* ✅ Layer switcher button — shows when sidebar is hidden */}
      {!isSidebarVisible && (
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
              Layers
            </div>
          </div>
        </button>
      )}

      {/* ✅ Layer switcher panel */}
      {!isSidebarVisible && isSwitcherVisible && (
        <div className="absolute bottom-28 left-4 bg-white p-2 rounded-xl shadow-xl flex space-x-2 z-30">
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

      <SidebarToggleButton
        onClick={() => setIsSidebarVisible((v) => !v)}
        isSidebarVisible={isSidebarVisible}
        sidebarWidth={SIDEBAR_WIDTH}
        peek={SIDEBAR_PEEK}
      />

      {/* Sidebar */}
      <div
        className={`absolute top-0 left-0 h-full z-40 bg-gray-50 border-r border-gray-200 transition-all duration-200 ease-in-out overflow-hidden ${
          isSidebarVisible ? "w-[500px]" : "w-0"
        }`}
      >
        <VotersSidebar
          visible={isSidebarVisible}
          zoomToLocation={zoomToLocation}
          records={householdRecords}
          selectedRecord={selectedRecord}
          onSelectRecord={selectRecord}
          setMapStyle={setMapStyle}
          mapStyles={mapStyles}
          onRefresh={renderHouseholdMarkers}
          onFilterChange={applyMarkerFilter}
          candidates={candidates}
        />
      </div>

      {isTagging && tagLngLat && (
        <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="w-[420px] max-w-[95vw] pointer-events-auto">
            <TagVotersForm
              visible={isTagging && !!tagLngLat}
              tagLngLat={tagLngLat}
              form={form}
              setForm={setForm}
              setField={setField}
              barangayList={barangayList}
              barangayOptions={barangayOptions}
              mayorOptions={mayorOptions}
              viceMayorOptions={viceMayorOptions}
              onClose={handleCloseForm}
              onSave={handleSave}
            />
          </div>
        </div>
      )}

      <ToastContainer
        position="top-center"
        autoClose={2500}
        hideProgressBar
        pauseOnHover
        theme="light"
        style={{ zIndex: 9999 }}
      />
    </div>
  );
}