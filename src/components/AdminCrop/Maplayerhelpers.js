// mapLayerHelpers.js
// Pure Mapbox GL layer setup functions — no React, no state.
// Each function is idempotent (checks before adding).

// ─── Crop polygon labels ──────────────────────────────────────────────────────

export function ensureCropPolygonLabelsLayer(m) {
  if (!m) return;

  const LABEL_LAYER = "crop-polygons-labels";
  if (m.getLayer(LABEL_LAYER)) return;
  if (!m.getSource("crop-polygons")) return;

  const snExpr = [
    "let", "n", ["to-number", ["get", "id"]],
    [
      "concat", "SN-",
      [
        "case",
        ["<", ["var", "n"], 10], "000",
        ["<", ["var", "n"], 100], "00",
        ["<", ["var", "n"], 1000], "0",
        "",
      ],
      ["to-string", ["var", "n"]],
    ],
  ];

  m.addLayer({
    id: LABEL_LAYER,
    type: "symbol",
    source: "crop-polygons",
    minzoom: 11.5,
    layout: {
      "text-field": [
        "step", ["zoom"],
        snExpr,
        13,
        ["concat", ["coalesce", ["get", "crop_name"], "Crop"], " • ", snExpr],
      ],
      "symbol-placement": "point",
      "text-allow-overlap": false,
      "text-ignore-placement": false,
      "text-optional": true,
      "text-variable-anchor": ["top", "bottom", "left", "right"],
      "text-radial-offset": 0.8,
      "text-padding": 2,
      "text-size": ["interpolate", ["linear"], ["zoom"], 11.5, 9, 14, 12, 16, 14],
      "text-font": ["Open Sans Semibold", "Arial Unicode MS Regular"],
    },
    paint: {
      "text-color": ["case", ["==", ["get", "is_harvested"], 1], "#6B7280", "#111827"],
      "text-halo-color": "rgba(255,255,255,0.95)",
      "text-halo-width": 2,
      "text-halo-blur": 0.2,
      "text-opacity": ["interpolate", ["linear"], ["zoom"], 11.5, 0, 12.3, 1],
    },
  });

  try {
    if (m.getLayer("crop-polygons-outline")) m.moveLayer(LABEL_LAYER);
  } catch {}
}

// ─── Barangay layers ──────────────────────────────────────────────────────────

export function ensureBarangayLayersOnMap(m, BARANGAYS_FC) {
  if (!m || !BARANGAYS_FC?.features?.length) return;

  if (!m.getSource("barangays-src")) {
    m.addSource("barangays-src", { type: "geojson", data: BARANGAYS_FC });
  }

  if (!m.getLayer("barangays-line")) {
    m.addLayer({
      id: "barangays-line",
      type: "line",
      source: "barangays-src",
      paint: {
        "line-color": "#ffffff",
        "line-width": 2,
        "line-opacity": 0.9,
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
          ["get", "Barangay"], ["get", "barangay"],
          ["get", "NAME"], ["get", "name"], "",
        ],
        "symbol-placement": "point",
        "text-size": ["interpolate", ["linear"], ["zoom"], 10, 10, 12, 12, 14, 14, 16, 18],
        "text-font": ["Open Sans Semibold", "Arial Unicode MS Regular"],
        "text-allow-overlap": false,
      },
      paint: {
        "text-color": "#ffffff",
        "text-halo-color": "rgba(0,0,0,0.8)",
        "text-halo-width": 1.5,
        "text-halo-blur": 0.2,
      },
    });
  }

  try {
    if (m.getLayer("crop-polygons-outline")) m.moveLayer("barangays-labels");
  } catch {}
}

// ─── User accuracy ring ───────────────────────────────────────────────────────

export const USER_ACC_SOURCE = "user-accuracy-source";
export const USER_ACC_LAYER  = "user-accuracy-layer";
export const USER_ACC_OUTLINE = "user-accuracy-outline";

export function ensureUserAccuracyLayersOnMap(m) {
  if (!m) return;

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
}

// ─── Terrain (DEM) ────────────────────────────────────────────────────────────

export function ensureTerrainOnMap(m) {
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
}

// ─── Crop polygon fill + outline ──────────────────────────────────────────────

export const BASE_COLOR_BY_CROP = [
  "match", ["get", "crop_name"],
  "Rice",       "#facc15",
  "Corn",       "#fb923c",
  "Banana",     "#a3e635",
  "Sugarcane",  "#34d399",
  "Cassava",    "#60a5fa",
  "Vegetables", "#f472b6",
  "#10B981",
];

export const CROP_FILL_PAINT = {
  "fill-color": [
    "case",
    ["==", ["get", "is_harvested"], 1],
    "#9CA3AF",
    BASE_COLOR_BY_CROP,
  ],
  "fill-opacity": 0.4,
};

// ─── Style-ready helper ───────────────────────────────────────────────────────

export function runWhenStyleReady(m, cb) {
  if (!m) return;
  if (m.isStyleLoaded && m.isStyleLoaded()) { cb(); return; }
  const onStyle = () => {
    if (m.isStyleLoaded && m.isStyleLoaded()) {
      m.off("styledata", onStyle);
      cb();
    }
  };
  m.on("styledata", onStyle);
}