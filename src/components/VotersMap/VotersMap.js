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

const normalizeName = (name = "") =>
  String(name)
    .trim()
    .toLowerCase()
    .replace(/^brgy\.?\s*/i, "")
    .replace(/^barangay\s*/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const extractBrgyNumber = (name = "") => {
  const match = String(name).match(/\d+/);
  return match ? match[0] : "";
};

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

        const marker = new mapboxgl.Marker({ color: getMarkerColor(row) })
          .setLngLat([lng, lat])
          .setPopup(popup)
          .addTo(m);

        marker.getElement().addEventListener("click", (ev) => {
          ev.stopPropagation();
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
  }, []);

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

    if (!finalBarangayId) {
      console.log("barangayList:", barangayList);
      console.log("form.barangay_name:", form.barangay_name);
      console.log("matchedBarangay:", matchedBarangay);
      return toast.error("Barangay not set.");
    }

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

  useEffect(() => {
    axios
      .get(`${API}/barangays`)
      .then((res) => setBarangayList(Array.isArray(res.data) ? res.data : []))
      .catch((err) => console.error("Failed to load barangays", err));
  }, []);

  useEffect(() => {
    axios
      .get(`${API}/candidates?year=2025`)
      .then((res) => setCandidates(Array.isArray(res.data) ? res.data : []))
      .catch((err) => console.error("Failed to load candidates", err));
  }, []);

  useEffect(() => {
    const uid = getLoggedInUserId();
    if (uid) setCurrentUserId(uid);
  }, []);

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

      m.on("load", async () => {
        await renderHouseholdMarkers();
      });
    } else {
      const m = mapRef.current;
      m.setStyle(mapStyle);
      m.once("style.load", async () => {
        await renderHouseholdMarkers();
      });
    }
  }, [mapStyle, lockToBago, renderHouseholdMarkers]);

  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    if (lockToBago) m.setMaxBounds(BACOLOD_CITY_BOUNDS);
    else m.setMaxBounds(null);
  }, [lockToBago]);

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

      console.log("detectedName:", detectedName);
      console.log("matchedBarangay:", matchedBarangay);

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

      <SidebarToggleButton
        onClick={() => setIsSidebarVisible((v) => !v)}
        isSidebarVisible={isSidebarVisible}
        sidebarWidth={SIDEBAR_WIDTH}
        peek={SIDEBAR_PEEK}
      />

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
          onRefresh={renderHouseholdMarkers}
          mapStyles={{}}
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