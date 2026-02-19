// src/components/AdminDAR/AdminDarMap.js
import React, { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import MapboxDirections from "@mapbox/mapbox-gl-directions/dist/mapbox-gl-directions";
import "@mapbox/mapbox-gl-directions/dist/mapbox-gl-directions.css";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useLocation, useSearchParams } from "react-router-dom";
import * as turf from "@turf/turf";
import DefaultThumbnail from "../MapboxImages/map-default.png";
import SidebarToggleButton from "./MapControls/SidebarToggleButton";
import BARANGAYS_FC from "../Barangays/barangays.json";
import DarSidebar from "./DARsidebar";
import TagDarForm from "./TagDarForm";
import {
  addPulseStylesOnce,
  isSoftDeletedDar,
  getDarStatus,
  statusColor,
  getDarId,
  getRecordPolygonCoords,
  strictDetectBarangayForGeometry,
  buildPolygonsFromDar,
  getPolygonCenterFromCoords,
} from "./DarMapHelpers";

mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN || "";

const BAGO_CITY_BOUNDS = [
  [122.7333, 10.4958],
  [123.5, 10.6333],
];

const HILITE_SRC = "selected-dar-highlight-src";
const HILITE_FILL = "selected-dar-highlight-fill";
const HILITE_LINE = "selected-dar-highlight-line";

const SIDEBAR_WIDTH = 500;
const SIDEBAR_PEEK = 1;

const AdminDarMap = () => {
  // inject CSS for pulsing halo / chip once
  addPulseStylesOnce();

  const locationState = useLocation().state || {};
  const [searchParams] = useSearchParams();

  // --- parse deep-link params (lat/lng/darId/zoom) ---
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

  // --- map refs ---
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);

  const directionsRef = useRef(null);
  const drawRef = useRef(null);

  const barangayMarkerRef = useRef(null);

  const darMarkerMapRef = useRef(new Map());
  const savedMarkersRef = useRef([]);

  const selectedLabelMarkerRef = useRef(null);
  const selectedHaloMarkerRef = useRef(null);

  const hiliteAnimRef = useRef(null);
  const hasDeepLinkedRef = useRef(false);

  // --- sidebar / records ---
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [sidebarDarRecords, setSidebarDarRecords] = useState([]);
  const sidebarDarRecordsRef = useRef([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedBarangay, setSelectedBarangay] = useState(null);

  // keep ref in sync for polygon click handler
  useEffect(() => {
    sidebarDarRecordsRef.current = sidebarDarRecords;
  }, [sidebarDarRecords]);

  // --- map appearance ---
  const [mapStyle, setMapStyle] = useState(
    "mapbox://styles/wompwomp-69/cm900xa91008j01t14w8u8i9d"
  );
  const [isLayerSwitcherVisible, setIsLayerSwitcherVisible] = useState(false);
  const [lockToBago, setLockToBago] = useState(true);

  // --- tagging state ---
  const [isTagging, setIsTagging] = useState(false);
  const [tagLocation, setTagLocation] = useState(null);

  // ---------- helpers bound to this map instance ----------

  const runWhenStyleReady = (cb) => {
    const m = mapRef.current;
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

  const clearSelection = useCallback(() => {
    const m = mapRef.current;
    if (!m) return;

    if (hiliteAnimRef.current) {
      clearInterval(hiliteAnimRef.current);
      hiliteAnimRef.current = null;
    }

    selectedLabelMarkerRef.current?.remove();
    selectedLabelMarkerRef.current = null;

    selectedHaloMarkerRef.current?.remove();
    selectedHaloMarkerRef.current = null;

    if (m.getLayer(HILITE_FILL)) m.removeLayer(HILITE_FILL);
    if (m.getLayer(HILITE_LINE)) m.removeLayer(HILITE_LINE);
    if (m.getSource(HILITE_SRC)) m.removeSource(HILITE_SRC);
  }, []);

  const showMarkerChipAndHalo = useCallback((id, chipText, color = "#3B82F6") => {
    const m = mapRef.current;
    if (!m) return;

    selectedLabelMarkerRef.current?.remove();
    selectedLabelMarkerRef.current = null;
    selectedHaloMarkerRef.current?.remove();
    selectedHaloMarkerRef.current = null;

    const marker = darMarkerMapRef.current.get(String(id));
    if (!marker) return;

    const lngLat = marker.getLngLat();

    // chip
    const chip = document.createElement("div");
    chip.className = "chip";
    chip.textContent = chipText || "Selected parcel";
    chip.style.background = "#111827";

    selectedLabelMarkerRef.current = new mapboxgl.Marker({
      element: chip,
      anchor: "bottom",
      offset: [0, -42],
    })
      .setLngLat(lngLat)
      .addTo(m);

    // halo
    const haloWrap = document.createElement("div");
    haloWrap.className = "pulse-wrapper";
    const ring = document.createElement("div");
    ring.className = "pulse-ring";
    ring.style.background = "rgba(59,130,246,0.22)";
    ring.style.boxShadow = `0 0 0 2px ${color}55 inset`;
    haloWrap.appendChild(ring);

    selectedHaloMarkerRef.current = new mapboxgl.Marker({
      element: haloWrap,
      anchor: "center",
    })
      .setLngLat(lngLat)
      .addTo(m);
  }, []);

  const highlightPolygon = useCallback((rec) => {
    const m = mapRef.current;
    if (!m || !rec) return;

    const color = statusColor(getDarStatus(rec));
    const coords = getRecordPolygonCoords(rec);
    if (!coords) return;

    runWhenStyleReady(() => {
      const first = coords[0];
      const last = coords[coords.length - 1];
      const ring =
        JSON.stringify(first) === JSON.stringify(last) ? coords : [...coords, first];

      const feature = turf.polygon([ring], { id: getDarId(rec) });

      if (!m.getSource(HILITE_SRC)) {
        m.addSource(HILITE_SRC, {
          type: "geojson",
          data: { type: "FeatureCollection", features: [feature] },
        });

        m.addLayer({
          id: HILITE_FILL,
          type: "fill",
          source: HILITE_SRC,
          paint: {
            "fill-color": color,
            "fill-opacity": 0.18,
          },
        });

        m.addLayer({
          id: HILITE_LINE,
          type: "line",
          source: HILITE_SRC,
          paint: {
            "line-color": color,
            "line-width": 1.5,
            "line-opacity": 1,
          },
        });
      } else {
        m.getSource(HILITE_SRC).setData({
          type: "FeatureCollection",
          features: [feature],
        });
        try {
          m.setPaintProperty(HILITE_FILL, "fill-color", color);
          m.setPaintProperty(HILITE_LINE, "line-color", color);
        } catch {
          // ignore
        }
      }

      // pulse line thickness
      if (hiliteAnimRef.current) {
        clearInterval(hiliteAnimRef.current);
        hiliteAnimRef.current = null;
      }
      let w = 2;
      let dir = 0.4;
      hiliteAnimRef.current = setInterval(() => {
        if (!m.getLayer(HILITE_LINE)) return;
        w += dir;
        if (w >= 4) dir = -0.3;
        if (w <= 1) dir = 0.3;
        try {
          m.setPaintProperty(HILITE_LINE, "line-width", w);
        } catch {
          // ignore
        }
      }, 80);
    });
  }, []);

  const highlightSelection = useCallback(
    (rec) => {
      const m = mapRef.current;
      if (!m || !rec) return;

      clearSelection();

      const status = getDarStatus(rec);
      const color = statusColor(status);

      const cloa = rec.cloa_no ?? rec.cloaNo ?? "";
      const lot = rec.lot_no ?? rec.lotNo ?? "";
      const owner = rec.owner_name ?? rec.arb_name ?? rec.beneficiary_name ?? "";

      const label =
        owner || (cloa && `CLOA ${cloa}`) || (lot && `Lot ${lot}`) || "DAR Parcel";

      const id = getDarId(rec);
      if (id != null) {
        showMarkerChipAndHalo(id, label, color);
      }
      highlightPolygon(rec);

      // center map on polygon / point
      const coords = getRecordPolygonCoords(rec);
      let center = coords ? getPolygonCenterFromCoords(coords) : null;

      if (!center) {
        const lng = Number(rec.longitude ?? rec.lng);
        const lat = Number(rec.latitude ?? rec.lat);
        if (Number.isFinite(lng) && Number.isFinite(lat)) {
          center = [lng, lat];
        }
      }

      if (center) {
        m.flyTo({
          center,
          zoom: Math.max(m.getZoom(), 16),
          essential: true,
        });
      }
    },
    [clearSelection, showMarkerChipAndHalo, highlightPolygon]
  );

  // one function used by marker click, polygon click, sidebar click & deep-link
  const selectRecord = useCallback(
    (rec) => {
      if (!rec || isSoftDeletedDar(rec)) return;
      setSelectedRecord(rec);
      highlightSelection(rec);
      setIsSidebarVisible(true);
    },
    [highlightSelection]
  );

  // ---------- barangay helpers on map ----------

  const zoomToBarangay = (coordinates) => {
    const m = mapRef.current;
    if (!m || !coordinates) return;
    m.flyTo({ center: coordinates, zoom: 14, essential: true });
  };

  const handleBarangaySelect = (barangayData) => {
    setSelectedBarangay(barangayData);

    const m = mapRef.current;
    if (!m) return;

    if (barangayMarkerRef.current) {
      barangayMarkerRef.current.remove();
      barangayMarkerRef.current = null;
    }

    if (barangayData && barangayData.coordinates) {
      const el = document.createElement("div");
      el.style.width = "18px";
      el.style.height = "18px";
      el.style.borderRadius = "50%";
      el.style.backgroundColor = "#10B981";
      el.style.border = "3px solid white";
      el.style.boxShadow = "0 0 10px rgba(0,0,0,0.3)";

      const popupHtml = `
        <div class="text-sm">
          <h3 class="font-bold text-green-600 text-base">${barangayData.name}</h3>
        </div>
      `;

      const marker = new mapboxgl.Marker(el)
        .setLngLat(barangayData.coordinates)
        .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(popupHtml))
        .addTo(m);

      marker.togglePopup();
      barangayMarkerRef.current = marker;
      zoomToBarangay(barangayData.coordinates);
    }
  };

  // ---------- terrain & barangay layers ----------

  const ensureTerrain = useCallback(() => {
    const m = mapRef.current;
    if (!m) return;
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

  const ensureBarangayLayers = useCallback(() => {
    const m = mapRef.current;
    if (!m) return;
    if (!BARANGAYS_FC?.features?.length) return;

    if (!m.getSource("barangays-src")) {
      m.addSource("barangays-src", {
        type: "geojson",
        data: BARANGAYS_FC,
      });
    }

    if (!m.getLayer("barangays-line")) {
      m.addLayer({
        id: "barangays-line",
        type: "line",
        source: "barangays-src",
        paint: {
          "line-color": "#1f2937",
          "line-width": 1,
          "line-opacity": 0.7,
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

  // ---------- DAR polygons + markers ----------

  const loadPolygons = useCallback(
    async (recordsOverride = null) => {
      const m = mapRef.current;
      if (!m) return;

      let records = recordsOverride;

      if (!records) {
        const res = await axios.get("http://localhost:5000/api/dar/arbs");
        const allRows = res.data || [];
        records = allRows.filter((r) => !isSoftDeletedDar(r));
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

      if (m.getSource("dar-polygons")) {
        m.getSource("dar-polygons").setData(fullData);
        m.setPaintProperty("dar-polygons-layer", "fill-color", paintStyle["fill-color"]);
      } else {
        m.addSource("dar-polygons", { type: "geojson", data: fullData });

        m.addLayer({
          id: "dar-polygons-layer",
          type: "fill",
          source: "dar-polygons",
          paint: paintStyle,
        });

        m.addLayer({
          id: "dar-polygons-outline",
          type: "line",
          source: "dar-polygons",
          paint: {
            "line-color": "#111827",
            "line-width": 1,
          },
        });
      }
    },
    []
  );

  const renderSavedMarkers = useCallback(
    async () => {
      const m = mapRef.current;
      if (!m) return;

      try {
        const res = await axios.get("http://localhost:5000/api/dar/arbs");
        const allRows = res.data || [];
        let records = allRows.filter((r) => !isSoftDeletedDar(r));

        if (statusFilter !== "all") {
          records = records.filter((r) => getDarStatus(r) === statusFilter);
        }

        setSidebarDarRecords(records);

        // clear old markers
        savedMarkersRef.current.forEach((marker) => marker.remove());
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

          const marker = new mapboxgl.Marker({ color }).setLngLat(center).addTo(m);

          marker.getElement().addEventListener("click", () => {
            selectRecord(rec);
          });

          const id = getDarId(rec);
          if (id != null) {
            darMarkerMapRef.current.set(String(id), marker);
          }
          savedMarkersRef.current.push(marker);
        }

        // deep-link by darId once
        if (!hasDeepLinkedRef.current && target.darId && records.length) {
          const hit = records.find(
            (r) => String(getDarId(r)) === String(target.darId)
          );
          if (hit) {
            selectRecord(hit);
            hasDeepLinkedRef.current = true;
          }
        }
      } catch (err) {
        console.error("Failed to load DAR markers:", err);
        toast.error("Failed to load DAR records.");
      }
    },
    [statusFilter, target.darId, selectRecord]
  );

  // ---------- handle drawing polygons for tagging ----------

  const [selectedBarangayState, setSelectedBarangayState] = useState(null);

  const handleDrawAttempt = useCallback(
    (feature) => {
      if (!feature || !feature.geometry) return;
      const geom = feature.geometry;
      if (geom.type !== "Polygon" && geom.type !== "MultiPolygon") return;

      const detection = strictDetectBarangayForGeometry(geom, BARANGAYS_FC);

      if (!detection) {
        try {
          drawRef.current?.delete(feature.id);
        } catch {
          // ignore
        }
        toast.error(
          "The tagged area is outside of a single barangay boundary. Draw within one barangay."
        );
        return false;
      }

      const ring =
        geom.type === "Polygon" ? geom.coordinates?.[0] : geom.coordinates?.[0]?.[0];
      const area = turf.area({ type: "Feature", geometry: geom, properties: {} });
      const hectares = +(area / 10000).toFixed(2);

      setSelectedBarangayState({
        name: detection.name,
        coordinates: detection.centroid,
      });

      setTagLocation({
        coordinates: ring,
        hectares,
        farmGeometry: geom,
      });
      setIsTagging(true);
      return true;
    },
    []
  );

  // ---------- init map & react to style changes ----------

  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    if (!mapRef.current) {
      const m = new mapboxgl.Map({
        container,
        style: mapStyle,
        center: [122.9616, 10.5074],
        zoom: 7,
      });
      mapRef.current = m;

      if (lockToBago) {
        m.setMaxBounds(BAGO_CITY_BOUNDS);
      }

      // draw control
      const draw = new MapboxDraw({
        displayControlsDefault: false,
        controls: {
          polygon: true,
          trash: true,
        },
      });
      drawRef.current = draw;
      m.addControl(draw, "bottom-right");

      // nav + directions
      m.addControl(new mapboxgl.NavigationControl(), "bottom-right");

      m.on("load", async () => {
        ensureTerrain();
        ensureBarangayLayers();

        if (!directionsRef.current) {
          const directions = new MapboxDirections({
            accessToken: mapboxgl.accessToken,
            unit: "metric",
            profile: "mapbox/driving",
            controls: {
              instructions: true,
              profileSwitcher: true,
            },
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

        // initial deep-link focus by lat/lng
        if (!hasDeepLinkedRef.current) {
          let focus = null;
          if (Number.isFinite(target.lat) && Number.isFinite(target.lng)) {
            focus = [target.lng, target.lat];
          }
          if (focus) {
            hasDeepLinkedRef.current = true;
            m.flyTo({
              center: focus,
              zoom: target.zoom,
              essential: true,
            });
          }
        }
      });

      // click polygons
      m.on("click", "dar-polygons-layer", (e) => {
        const feature = e.features?.[0];
        const id = feature?.properties?.id;
        if (!id) return;

        const hit = sidebarDarRecordsRef.current.find(
          (r) => String(getDarId(r)) === String(id)
        );
        if (hit && !isSoftDeletedDar(hit)) {
          selectRecord(hit);
        }
      });

      // draw handlers
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
          } catch {
            // ignore
          }
        }
      });
    } else {
      const m = mapRef.current;
      m.setStyle(mapStyle);
      m.once("style.load", async () => {
        ensureTerrain();
        ensureBarangayLayers();
        await loadPolygons();
        await renderSavedMarkers();
        if (selectedRecord) highlightSelection(selectedRecord);
      });
    }
  }, [
    mapStyle,
    lockToBago,
    ensureTerrain,
    ensureBarangayLayers,
    loadPolygons,
    renderSavedMarkers,
    highlightSelection,
    handleDrawAttempt,
    target.lat,
    target.lng,
    target.zoom,
  ]);

  // keep lockToBago bounds in sync
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    if (lockToBago) {
      m.setMaxBounds(BAGO_CITY_BOUNDS);
    } else {
      m.setMaxBounds(null);
    }
  }, [lockToBago]);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      clearSelection();

      if (hiliteAnimRef.current) {
        clearInterval(hiliteAnimRef.current);
        hiliteAnimRef.current = null;
      }

      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch {
          // ignore
        }
        mapRef.current = null;
      }
      directionsRef.current = null;
    };
  }, [clearSelection]);

  // ---------- JSX ----------

  return (
    <div className="relative h-full w-full">
      {/* Map container */}
      <div ref={mapContainerRef} className="h-full w-full" />

      {/* Tag form (DAR) */}
      {isTagging && tagLocation && (
        <TagDarForm
          defaultLocation={{ ...tagLocation }}
          selectedBarangay={selectedBarangayState?.name}
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

      {/* Layers button when sidebar hidden */}
      {!isSidebarVisible && (
        <button
          onClick={() => setIsLayerSwitcherVisible((v) => !v)}
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
        <DarSidebar
          visible={isSidebarVisible}
          zoomToBarangay={zoomToBarangay}
          onBarangaySelect={handleBarangaySelect}
          records={sidebarDarRecords}
          selectedRecord={selectedRecord}
          onSelectRecord={selectRecord}
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
