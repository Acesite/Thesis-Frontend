// src/components/Voters/VotersMap.js
import React, { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// Reuse your existing sidebar toggle button component
import SidebarToggleButton from "../VotersMap/MapControls/SidebarToggleButton";

// ✅ NEW: sidebar component
import VotersSidebar from "./VotersSidebar";

mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN || "";

// Same bounds pattern you used
const BAGO_CITY_BOUNDS = [
  [122.7333, 10.4958],
  [123.5, 10.6333],
];

const SIDEBAR_WIDTH = 500;
const SIDEBAR_PEEK = 1;

const API = "http://localhost:5000/api/voters";

const VotersMap = () => {
  // --- map refs ---
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);

  // markers
  const savedMarkersRef = useRef([]);
  const householdMarkerMapRef = useRef(new Map()); // householdId -> marker

  // ✅ NEW: records + selection for sidebar
  const [householdRecords, setHouseholdRecords] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);

  // --- sidebar ---
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);

  // --- map appearance ---
  const [mapStyle, setMapStyle] = useState(
    "mapbox://styles/wompwomp-69/cm900xa91008j01t14w8u8i9d"
  );
  const [lockToBago, setLockToBago] = useState(true);

  // --- data for dropdowns ---
  const [barangays, setBarangays] = useState([]);
  const [precincts, setPrecincts] = useState([]);

  // --- tagging state ---
  const [isTagging, setIsTagging] = useState(false);
  const [tagLngLat, setTagLngLat] = useState(null);

  const [form, setForm] = useState({
    barangay_id: "",
    precinct_id: "",
    purok: "",
    sitio: "",
    eligible_voters: 0,
    voting_for_us: 0,
    undecided: 0,
    not_supporting: 0,
    notes: "",
  });

  // ---------- helpers ----------
  const clearMarkers = useCallback(() => {
    savedMarkersRef.current.forEach((m) => m.remove());
    savedMarkersRef.current = [];
    householdMarkerMapRef.current.clear();
  }, []);

  const getMarkerColor = (row) => {
    const eligible = Number(row.eligible_voters || 0);
    const yes = Number(row.voting_for_us || 0);
    if (eligible <= 0) return "#3B82F6";
    const ratio = yes / eligible;
    if (ratio >= 0.6) return "#10B981";
    if (ratio >= 0.3) return "#F59E0B";
    return "#EF4444";
  };

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

      // open marker popup if exists
      const marker = householdMarkerMapRef.current.get(String(rec.id));
      if (marker) marker.togglePopup();
    },
    [zoomToLocation]
  );

  const loadBarangays = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/barangays`);
      setBarangays(res.data || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load barangays.");
    }
  }, []);

  const loadPrecinctsByBarangay = useCallback(async (barangayId) => {
    if (!barangayId) {
      setPrecincts([]);
      return;
    }
    try {
      const res = await axios.get(`${API}/precincts`, {
        params: { barangay_id: barangayId },
      });
      setPrecincts(res.data || []);
    } catch (err) {
      console.error(err);
      setPrecincts([]);
    }
  }, []);

  const renderHouseholdMarkers = useCallback(async () => {
    const m = mapRef.current;
    if (!m) return;

    try {
      const res = await axios.get(`${API}/households`);
      const rows = res.data || [];

      // ✅ keep records for sidebar list
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

        // ✅ click marker selects record and shows sidebar details
        marker.getElement().addEventListener("click", (ev) => {
          ev.stopPropagation();
          setIsSidebarVisible(true);
          setSelectedRecord(row);
        });

        householdMarkerMapRef.current.set(String(row.id), marker);
        savedMarkersRef.current.push(marker);
      }
    } catch (err) {
      console.error("Failed to load households:", err);
      toast.error("Failed to load household voter markers.");
    }
  }, [clearMarkers]);

  // ---------- form helpers ----------
  const setField = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const validateCounts = () => {
    const eligible = Number(form.eligible_voters || 0);
    const sum =
      Number(form.voting_for_us || 0) +
      Number(form.undecided || 0) +
      Number(form.not_supporting || 0);

    if (eligible < 0) return "Eligible voters cannot be negative.";
    if (sum > eligible)
      return "For us + Undecided + Not supporting must be <= Eligible voters.";
    return null;
  };

  const handleSave = async () => {
    if (!tagLngLat) return;

    const errMsg = validateCounts();
    if (errMsg) return toast.error(errMsg);

    if (!form.barangay_id) return toast.error("Please select a barangay.");

    try {
      await axios.post(`${API}/households`, {
        ...form,
        barangay_id: Number(form.barangay_id),
        precinct_id: form.precinct_id ? Number(form.precinct_id) : null,
        lat: tagLngLat.lat,
        lng: tagLngLat.lng,
      });

      toast.success("Household saved!");
      setIsTagging(false);
      setTagLngLat(null);

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

  // ---------- init map & react to style changes ----------
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
        await loadBarangays();
        await renderHouseholdMarkers();
      });

      // click map = start tagging a household dot
      m.on("click", (e) => {
        setTagLngLat(e.lngLat);
        setIsTagging(true);

        // reset form each tag
        setForm({
          barangay_id: "",
          precinct_id: "",
          purok: "",
          sitio: "",
          eligible_voters: 0,
          voting_for_us: 0,
          undecided: 0,
          not_supporting: 0,
          notes: "",
        });
        setPrecincts([]);
      });
    } else {
      const m = mapRef.current;
      m.setStyle(mapStyle);
      m.once("style.load", async () => {
        await renderHouseholdMarkers();
      });
    }
  }, [mapStyle, lockToBago, loadBarangays, renderHouseholdMarkers]);

  // keep lock bounds in sync
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    if (lockToBago) m.setMaxBounds(BAGO_CITY_BOUNDS);
    else m.setMaxBounds(null);
  }, [lockToBago]);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      clearMarkers();
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch {
          // ignore
        }
        mapRef.current = null;
      }
    };
  }, [clearMarkers]);

  // ---------- JSX ----------
  return (
    <div className="relative h-full w-full">
      {/* Map container */}
      <div ref={mapContainerRef} className="h-full w-full" />

      {/* Sidebar toggle */}
      <SidebarToggleButton
        onClick={() => setIsSidebarVisible((v) => !v)}
        isSidebarVisible={isSidebarVisible}
        sidebarWidth={SIDEBAR_WIDTH}
        peek={SIDEBAR_PEEK}
      />

      {/* ✅ Sidebar panel (same pattern as DAR) */}
      <div
        className={`absolute top-0 left-0 h-full z-40 bg-gray-50 border-r border-gray-200 transition-all duration-200 ease-in-out overflow-hidden ${
          isSidebarVisible ? "w-[500px]" : "w-0"
        }`}
      >
        <VotersSidebar
          visible={isSidebarVisible}
          zoomToLocation={zoomToLocation}
          onBarangaySelect={() => {}}
          records={householdRecords}
          selectedRecord={selectedRecord}
          onSelectRecord={selectRecord}
          setMapStyle={setMapStyle}
          onRefresh={renderHouseholdMarkers}
          mapStyles={{}}
        />
      </div>

      {/* Tag modal */}
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
                onClick={() => {
                  setIsTagging(false);
                  setTagLngLat(null);
                }}
              >
                Close
              </button>
            </div>

            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold">Barangay</label>
                <select
                  value={form.barangay_id}
                  onChange={(e) => {
                    const v = e.target.value;
                    setField("barangay_id", v);
                    setField("precinct_id", "");
                    loadPrecinctsByBarangay(v ? Number(v) : 0);
                  }}
                  className="w-full border rounded px-2 py-2 text-sm"
                >
                  <option value="">Select barangay</option>
                  {barangays.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.barangay_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold">Precinct</label>
                <select
                  value={form.precinct_id}
                  onChange={(e) => setField("precinct_id", e.target.value)}
                  className="w-full border rounded px-2 py-2 text-sm"
                >
                  <option value="">Select precinct (optional)</option>
                  {precincts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.precinct_no}
                      {p.clustered_precinct_no
                        ? ` (${p.clustered_precinct_no})`
                        : ""}
                    </option>
                  ))}
                </select>
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
                onClick={() => {
                  setIsTagging(false);
                  setTagLngLat(null);
                }}
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
        autoClose={3000}
        hideProgressBar
        pauseOnHover
        theme="light"
        style={{ zIndex: 9999 }}
      />
    </div>
  );
};

export default VotersMap;