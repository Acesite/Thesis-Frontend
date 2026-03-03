// src/components/Voters/VotersMap.js
import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import SidebarToggleButton from "../VotersMap/MapControls/SidebarToggleButton";
import VotersSidebar from "./VotersSidebar";

import BARANGAYS_FC from "../Barangays/barangays.json";

// helpers
import {
  getBrgyName,
  detectBarangayForPoint,
  MarkCircleIcon,
  clearMarkers as clearMarkersHelper,
  clearTempMarker as clearTempMarkerHelper,
  addTempMarker,
  getMarkerColor,
  validateCounts,
} from "./VotersMapHelper";

mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN || "";

const BAGO_CITY_BOUNDS = [
  [122.7333, 10.4958],
  [123.5, 10.6333],
];

const SIDEBAR_WIDTH = 500;
const SIDEBAR_PEEK = 1;

const API = "http://localhost:5000/api/voters";

export default function VotersMap() {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);

  const savedMarkersRef = useRef([]);
  const householdMarkerMapRef = useRef(new Map()); // householdId -> marker
  const tempMarkerRef = useRef(null);

  const [householdRecords, setHouseholdRecords] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);

  const [isSidebarVisible, setIsSidebarVisible] = useState(true);

  const [mapStyle, setMapStyle] = useState(
    "mapbox://styles/wompwomp-69/cm900xa91008j01t14w8u8i9d"
  );
  const [lockToBago, setLockToBago] = useState(true);

  // ✅ Barangays loaded from backend (with id, name, etc.)
  const [barangayList, setBarangayList] = useState([]);

  // 🔐 Logged-in user id from localStorage
  const [currentUserId, setCurrentUserId] = useState(null);

  // ✅ dropdown: prefer DB barangays, fallback to GeoJSON if DB is empty
  const barangayOptions = useMemo(() => {
    if (barangayList.length) {
      const set = new Set();
      for (const b of barangayList) {
        if (b.barangay_name) set.add(b.barangay_name.trim());
      }
      return Array.from(set).sort((a, b) => a.localeCompare(b));
    }

    // fallback: use GeoJSON names when table is empty
    const set = new Set();
    for (const f of BARANGAYS_FC?.features || []) {
      const name = getBrgyName(f?.properties || "");
      if (name) set.add(name.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [barangayList]);

  // tagging/modal state
  const [isTagging, setIsTagging] = useState(false);
  const [tagLngLat, setTagLngLat] = useState(null);

  // mark tool
  const [isMarkMode, setIsMarkMode] = useState(false);

  const [form, setForm] = useState({
    barangay_id: "", // ✅ NEW
    barangay_name: "",
    precinct_id: "", // optional input (string)
    purok: "",
    sitio: "",
    eligible_voters: 0,
    voting_for_us: 0,
    undecided: 0,
    not_supporting: 0,
    notes: "",
  });

  const setField = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const clearMarkers = useCallback(() => {
    clearMarkersHelper(savedMarkersRef, householdMarkerMapRef);
  }, []);

  const clearTempMarker = useCallback(() => {
    clearTempMarkerHelper(tempMarkerRef);
  }, []);

  const resetForm = useCallback(() => {
    setForm({
      barangay_id: "",
      barangay_name: "",
      precinct_id: "",
      purok: "",
      sitio: "",
      eligible_voters: 0,
      voting_for_us: 0,
      undecided: 0,
      not_supporting: 0,
      notes: "",
    });
  }, []);

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

      clearMarkers();

      for (const row of rows) {
        const lng = Number(row.lng);
        const lat = Number(row.lat);
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;

        const color = getMarkerColor(row);

        const popup = new mapboxgl.Popup({ offset: 18 }).setHTML(`
          <div style="font-size:12px">
            <div style="font-weight:700;margin-bottom:6px">Household #${row.id}</div>
            <div><b>Barangay:</b> ${row.barangay_name ?? "-"}</div>
            <div><b>Precinct:</b> ${row.precinct_no ?? "-"}</div>
            <hr style="margin:6px 0"/>
            <div><b>Eligible:</b> ${row.eligible_voters ?? 0}</div>
            <div><b>For us:</b> ${row.voting_for_us ?? 0}</div>
            <div><b>Undecided:</b> ${row.undecided ?? 0}</div>
            <div><b>Not supporting:</b> ${row.not_supporting ?? 0}</div>
          </div>
        `);

        const marker = new mapboxgl.Marker({ color })
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
  }, [clearMarkers]);

  const handleCloseModal = () => {
    setIsTagging(false);
    setTagLngLat(null);
    clearTempMarker();
    // Mark mode stays ON
  };

  const handleSave = async () => {
    if (!tagLngLat) return;

    const errMsg = validateCounts(form);
    if (errMsg) return toast.error(errMsg);

    // ✅ this is where your “Barangay not set.” comes from
    if (!form.barangay_id) return toast.error("Barangay not set.");

    // ✅ must have a logged-in user
    if (!currentUserId) {
      toast.error("No logged-in user detected. Please log in again.");
      return;
    }

    try {
      await axios.post(`${API}/households`, {
        ...form,
        barangay_id: form.barangay_id,
        barangay_name: form.barangay_name,
        precinct_id: form.precinct_id ? String(form.precinct_id) : null,
        lat: tagLngLat.lat,
        lng: tagLngLat.lng,
        encoded_by: currentUserId, // 🔥 use logged-in user's id
      });

      toast.success("Household saved!");
      setIsTagging(false);
      setTagLngLat(null);
      clearTempMarker();

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

  // ✅ Load barangays from backend (id + name)
  useEffect(() => {
    axios
      .get(`${API}/barangays`)
      .then((res) => {
        setBarangayList(Array.isArray(res.data) ? res.data : []);
      })
      .catch((err) => {
        console.error("Failed to load barangays", err);
      });
  }, []);

  // 🔐 Load current user id from localStorage once
  useEffect(() => {
    let uid = null;

    const adminUserJson = localStorage.getItem("adminUser");
    if (adminUserJson) {
      try {
        const adminUser = JSON.parse(adminUserJson);
        uid = adminUser.user_id || adminUser.id || null;
      } catch (e) {
        console.error("Failed to parse adminUser from localStorage", e);
      }
    }

    if (!uid) {
      const rawId =
        localStorage.getItem("user_id") || localStorage.getItem("admin_id");
      if (rawId) {
        const n = Number(rawId);
        if (Number.isFinite(n)) uid = n;
      }
    }

    if (uid) setCurrentUserId(uid);
  }, []);

  // init map
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

      if (lockToBago) m.setMaxBounds(BAGO_CITY_BOUNDS);

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

  // lock bounds sync
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    if (lockToBago) m.setMaxBounds(BAGO_CITY_BOUNDS);
    else m.setMaxBounds(null);
  }, [lockToBago]);

  // ✅ Map click only when Mark Mode ON + auto-detect barangay from GeoJSON
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;

    const handleMapClick = (e) => {
      if (!isMarkMode) return;

      const clickedOnMarker =
        e.originalEvent?.target?.closest?.(".mapboxgl-marker");
      if (clickedOnMarker) return;

      addTempMarker(m, tempMarkerRef, e.lngLat.lng, e.lngLat.lat);

      setTagLngLat(e.lngLat);
      setIsTagging(true);
      resetForm();

      const brgy = detectBarangayForPoint(
        e.lngLat.lng,
        e.lngLat.lat,
        BARANGAYS_FC
      );

      if (brgy) {
        // map detected name -> barangay in DB to get id
        const match = barangayList.find(
          (b) =>
            b.barangay_name &&
            b.barangay_name.trim().toLowerCase() === brgy.trim().toLowerCase()
        );

        if (match) {
          setForm((prev) => ({
            ...prev,
            barangay_name: match.barangay_name,
            barangay_id: match.id,
          }));
        } else {
          // keep detected name; let user fix via dropdown
          setForm((prev) => ({
            ...prev,
            barangay_name: brgy,
            barangay_id: "",
          }));
        }
      } else {
        toast.info("No barangay detected for this location.");
      }
    };

    m.on("click", handleMapClick);
    return () => m.off("click", handleMapClick);
  }, [isMarkMode, resetForm, barangayList]);

  // cleanup
  useEffect(() => {
    return () => {
      clearMarkers();
      clearTempMarker();
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch {}
        mapRef.current = null;
      }
    };
  }, [clearMarkers, clearTempMarker]);

  return (
    <div className="relative h-full w-full">
      <div ref={mapContainerRef} className="h-full w-full" />

      {/* Mark tool button */}
      <div className="absolute bottom-[118px] right-[10px] z-50 flex flex-col items-end">
        <button
          type="button"
          onClick={() => {
            setIsMarkMode((prev) => {
              const next = !prev;
              if (!next) {
                setIsTagging(false);
                setTagLngLat(null);
                clearTempMarker?.();
              }
              return next;
            });
          }}
          className={[
            "w-[29px] h-[29px] rounded-md border shadow-sm flex items-center justify-center mb-2 ",
            "bg-white hover:bg-gray-50 active:bg-gray-100 transition",
            isMarkMode
              ? "border-red-500 ring-1.5 ring-red-200"
              : "border-gray-200",
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

      {/* Sidebar toggle */}
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
          onRefresh={renderHouseholdMarkers}
          mapStyles={{}}
        />
      </div>

      {/* Modal */}
      {isTagging && tagLngLat && (
        <div className="absolute inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 p-3">
          <div className="w-full max-w-xl bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <div className="font-semibold">Tag Household Voters</div>
                <div className="text-xs text-gray-600">
                  Lat: {tagLngLat.lat.toFixed(6)} | Lng:{" "}
                  {tagLngLat.lng.toFixed(6)}
                </div>
              </div>
              <button
                className="text-sm px-3 py-1 border rounded"
                onClick={handleCloseModal}
              >
                Close
              </button>
            </div>

            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold">Barangay</label>
                <select
                  value={form.barangay_name}
                  onChange={(e) => {
                    const name = e.target.value;
                    const match = barangayList.find(
                      (b) =>
                        b.barangay_name &&
                        b.barangay_name.trim().toLowerCase() ===
                          name.trim().toLowerCase()
                    );

                    setForm((prev) => ({
                      ...prev,
                      barangay_name: name,
                      barangay_id: match ? match.id : "",
                    }));
                  }}
                  className="w-full border rounded px-2 py-2 text-sm"
                >
                  <option value="">Select barangay</option>
                  {barangayOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>

                {form.barangay_name && (
                  <div className="text-[11px] text-gray-500 mt-1">
                    Detected/Selected: {form.barangay_name}
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold">Precinct</label>
                <input
                  value={form.precinct_id}
                  onChange={(e) => setField("precinct_id", e.target.value)}
                  className="w-full border rounded px-2 py-2 text-sm"
                  placeholder="optional"
                />
              </div>

              <div>
                <label className="text-xs font-semibold">Purok</label>
                <input
                  value={form.purok}
                  onChange={(e) => setField("purok", e.target.value)}
                  className="w-full border rounded px-2 py-2 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold">Sitio</label>
                <input
                  value={form.sitio}
                  onChange={(e) => setField("sitio", e.target.value)}
                  className="w-full border rounded px-2 py-2 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold">Eligible voters</label>
                <input
                  type="number"
                  value={form.eligible_voters}
                  onChange={(e) =>
                    setField("eligible_voters", Number(e.target.value))
                  }
                  className="w-full border rounded px-2 py-2 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold">Voting for us</label>
                <input
                  type="number"
                  value={form.voting_for_us}
                  onChange={(e) =>
                    setField("voting_for_us", Number(e.target.value))
                  }
                  className="w-full border rounded px-2 py-2 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold">Undecided</label>
                <input
                  type="number"
                  value={form.undecided}
                  onChange={(e) =>
                    setField("undecided", Number(e.target.value))
                  }
                  className="w-full border rounded px-2 py-2 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold">Not supporting</label>
                <input
                  type="number"
                  value={form.not_supporting}
                  onChange={(e) =>
                    setField("not_supporting", Number(e.target.value))
                  }
                  className="w-full border rounded px-2 py-2 text-sm"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-semibold">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setField("notes", e.target.value)}
                  className="w-full border rounded px-2 py-2 text-sm"
                  rows={3}
                />
              </div>
            </div>

            <div className="p-4 border-t flex gap-2 justify-end">
              <button
                className="px-4 py-2 border rounded"
                onClick={handleCloseModal}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded bg-black text-white"
                onClick={handleSave}
              >
                Save Household
              </button>
            </div>
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