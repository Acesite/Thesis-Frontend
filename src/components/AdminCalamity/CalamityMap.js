
// src/components/AdminCalamity/CalamityMap.js
import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import MapboxDirections from "@mapbox/mapbox-gl-directions/dist/mapbox-gl-directions";
import "@mapbox/mapbox-gl-directions/dist/mapbox-gl-directions.css";
import * as turf from "@turf/turf";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import CalamityImpactSidebar from "../AdminCalamity/CalamityImpactSidebar";
import DefaultThumbnail from "../MapboxImages/map-default.png";
import SatelliteThumbnail from "../MapboxImages/map-satellite.png";
import DarkThumbnail from "../MapboxImages/map-dark.png";
import LightThumbnail from "../MapboxImages/map-light.png";
import SidebarToggleButton from "./MapControls/SidebarToggleButton";
import { useLocation, useSearchParams } from "react-router-dom";
import BARANGAYS_FC from "../Barangays/barangays.json";
import CalamityRadiusForm from "./CalamityRadiusForm";

mapboxgl.accessToken =
  "pk.eyJ1Ijoid29tcHdvbXAtNjkiLCJhIjoiY204emxrOHkwMGJsZjJrcjZtZmN4YXdtNSJ9.LIMPvoBNtGuj4O36r3F72w";

const BAGO_CITY_BOUNDS = [
  [122.7333, 10.4958],
  [123.5, 10.6333],
];

// Severity band metadata for the calamity radius
const RADIUS_BAND_META = {
  severe: {
    label: "Severe zone",
    radiusRange: "0–25% of radius",
    damagePct: 90,
  },
  high: {
    label: "High zone",
    radiusRange: "25–50% of radius",
    damagePct: 60,
  },
  moderate: {
    label: "Moderate zone",
    radiusRange: "50–75% of radius",
    damagePct: 35,
  },
  low: {
    label: "Low zone",
    radiusRange: "75–100% of radius",
    damagePct: 15,
  },
};


/* ---------- Shared farmgate helpers (copied from TagCropForm) ---------- */

const CALAMITY_DEFAULT_KG_PER_SACK = 50;
const CALAMITY_DEFAULT_KG_PER_BUNCH = 15;
const CALAMITY_KG_PER_TON = 1000;

function calamityNormalizeName(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function calamityPeso(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return x.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

/**
 * Same price logic as TagCropForm.resolveFarmgateRange
 */
function calamityResolveFarmgateRange(
  cropTypeId,
  varietyNameRaw,
  vegCategoryRaw
) {
  const v = calamityNormalizeName(varietyNameRaw);
  const veg = calamityNormalizeName(vegCategoryRaw);

  // BANANA
  if (String(cropTypeId) === "3") {
    if (v.includes("tinigib"))
      return { low: 70, high: 90, unit: "kg", note: "Banana Tinigib" };
    if (v.includes("lagkitan") || v.includes("lakatan"))
      return {
        low: v.includes("lagkitan") ? 80 : 90,
        high: v.includes("lagkitan") ? 100 : 110,
        unit: "kg",
        note: v.includes("lagkitan") ? "Banana Lagkitan" : "Banana Lakatan",
      };
    if (v.includes("saba"))
      return { low: 45, high: 55, unit: "kg", note: "Banana Saba" };
    if (v.includes("cavendish"))
      return { low: 120, high: 150, unit: "kg", note: "Banana Cavendish" };
    return { low: 70, high: 110, unit: "kg", note: "Banana (fallback range)" };
  }

  // RICE (Palay)
  if (String(cropTypeId) === "1") {
    if (v.includes("216"))
      return { low: 18, high: 22, unit: "kg", note: "Rice NSIC Rc 216" };
    if (v.includes("222"))
      return { low: 18, high: 22, unit: "kg", note: "Rice Rc 222" };
    if (v.includes("15"))
      return { low: 18, high: 22, unit: "kg", note: "Rice Rc 15" };
    if (v.includes("224"))
      return { low: 18, high: 22, unit: "kg", note: "Rice NSIC Rc 224" };
    if (v.includes("188"))
      return { low: 18, high: 22, unit: "kg", note: "Rice NSIC Rc 188" };
    return { low: 18, high: 22, unit: "kg", note: "Rice (fallback range)" };
  }

  // CORN
  if (String(cropTypeId) === "2") {
    return { low: 18, high: 22, unit: "kg", note: "Corn (fallback range)" };
  }

  // SUGARCANE (₱ per ton)
  if (String(cropTypeId) === "4") {
    return { low: 2200, high: 2700, unit: "ton", note: "Sugarcane (₱/ton)" };
  }

  // CASSAVA (₱ per kg)
  if (String(cropTypeId) === "5") {
    if (v.includes("ku50") || v.includes("ku 50"))
      return { low: 8, high: 12, unit: "kg", note: "Cassava KU50" };
    if (v.includes("golden yellow"))
      return { low: 8, high: 12, unit: "kg", note: "Cassava Golden Yellow" };
    if (v.includes("rayong 5") || v.includes("rayong5"))
      return { low: 8, high: 12, unit: "kg", note: "Cassava Rayong 5" };
    return { low: 8, high: 12, unit: "kg", note: "Cassava (fallback range)" };
  }

  // VEGETABLES
  if (String(cropTypeId) === "6") {
    if (veg === "leafy")
      return { low: 40, high: 60, unit: "kg", note: "Vegetables (leafy)" };
    if (veg === "fruiting")
      return { low: 35, high: 80, unit: "kg", note: "Vegetables (fruiting)" };
    if (veg === "gourd")
      return { low: 30, high: 60, unit: "kg", note: "Vegetables (gourd crops)" };
    return {
      low: 30,
      high: 80,
      unit: "kg",
      note: "Vegetables (general fallback)",
    };
  }

  return null;
}

/**
 * Same as TagCropForm.computeFarmgateValueRange, but with damaged volume.
 */
function calamityComputeFarmgateValueRange({
  cropTypeId,
  varietyName,
  vegCategory,
  volume, // DAMAGED volume
  unit, // "kg" | "tons" | "sacks" | "bunches"
  kgPerSack,
  kgPerBunch,
  userPriceLow,
  userPriceHigh,
}) {
  const vol = Number(volume);
  if (!Number.isFinite(vol) || vol <= 0) return null;

  const baseRange = calamityResolveFarmgateRange(
    cropTypeId,
    varietyName,
    vegCategory
  );
  if (!baseRange) return null;

  const priceLow = Number(userPriceLow);
  const priceHigh = Number(userPriceHigh);

  const finalPriceLow =
    Number.isFinite(priceLow) && priceLow > 0 ? priceLow : baseRange.low;
  const finalPriceHigh =
    Number.isFinite(priceHigh) && priceHigh > 0 ? priceHigh : baseRange.high;

  const priceUnit = baseRange.unit; // "kg" or "ton"

  // convert damaged volume -> kg
  let kgFactor = 1;
  if (unit === "kg") kgFactor = 1;
  else if (unit === "tons") kgFactor = CALAMITY_KG_PER_TON;
  else if (unit === "sacks")
    kgFactor = Math.max(1, Number(kgPerSack) || CALAMITY_DEFAULT_KG_PER_SACK);
  else if (unit === "bunches")
    kgFactor = Math.max(1, Number(kgPerBunch) || CALAMITY_DEFAULT_KG_PER_BUNCH);

  const kgTotal = vol * kgFactor;

  let qty = kgTotal;
  let qtyUnit = "kg";
  if (priceUnit === "ton") {
    qty = kgTotal / CALAMITY_KG_PER_TON;
    qtyUnit = "ton";
  }

  const valueLow = qty * finalPriceLow;
  const valueHigh = qty * finalPriceHigh;

  return {
    valueLow,
    valueHigh,
    qty,
    qtyUnit,
    priceLow: finalPriceLow,
    priceHigh: finalPriceHigh,
    priceUnit,
  };
}

/**
 * Same yield units as TagCropForm.yieldUnitMap
 * (if your DB already has a unit column, you can just use that instead)
 */
const CALAMITY_YIELD_UNIT_MAP = {
  1: "sacks", // rice
  2: "sacks", // corn
  3: "bunches", // banana
  4: "tons", // sugarcane
  5: "tons", // cassava
  6: "kg", // vegetables
};

// --- Approximate PH farmgate prices (Php per kg) ---
const FARMGATE_PRICE_PER_KG_PHP = {
  Rice: {
    _default: 22,
    "NSIC Rc 216": 22,
    "Rc 222": 22,
    "Rc 15": 22,
    "Rc 224": 22,
    "Rc 188": 22,
    "Phil 99-1793": 22,
    "Phil 2000-2569": 22,
    "Co 0238": 22,
  },
  Corn: {
    _default: 15,
    Tinigib: 15,
    Lagkitan: 16,
  },
  Banana: {
    _default: 20,
    Lakatan: 22,
    Saba: 15,
    Cavendish: 18,
  },
  Sugarcane: {
    _default: 2.5,
  },
  Cassava: {
    _default: 6,
    KU50: 6,
    "Golden Yellow": 6.5,
    "Rayong 5": 6,
  },
  Vegetables: {
    _default: 30,
  },
};

const UNIT_TO_KG_FACTOR = {
  kg: 1,
  kilo: 1,
  kilos: 1,
  kilogram: 1,
  kilograms: 1,
  sack: 50,
  sacks: 50,
  cavan: 50,
  cavans: 50,
  ton: 1000,
  tons: 1000,
  tonne: 1000,
  tonnes: 1000,
  t: 1000,
  bunch: 10,
  bunches: 10,
  bundle: 5,
  bundles: 5,
  unit: 1,
  units: 1,
};

/* ======================================================================
   ✅ EMBEDDED TagCropForm-style PRICE RANGE (LOW-HIGH)
   ====================================================================== */
const TAGCROP_PRICE_RANGE_PHP = {
  Rice: {
    unit: "kg",
    _default: { low: 22, high: 24 },
    "NSIC Rc 216": { low: 22, high: 24 },
    "Rc 222": { low: 22, high: 24 },
    "Rc 15": { low: 22, high: 24 },
    "Rc 224": { low: 22, high: 24 },
    "Rc 188": { low: 22, high: 24 },
    "Phil 99-1793": { low: 22, high: 24 },
    "Phil 2000-2569": { low: 22, high: 24 },
    "Co 0238": { low: 22, high: 24 },
  },

  Corn: {
    unit: "kg",
    _default: { low: 15, high: 17 },
    Tinigib: { low: 15, high: 17 },
    Lagkitan: { low: 16, high: 18 },
  },

  Banana: {
    unit: "kg",
    _default: { low: 18, high: 22 },
    Lakatan: { low: 20, high: 24 },
    Saba: { low: 12, high: 15 },
    Cavendish: { low: 16, high: 19 },
  },

  // IMPORTANT: Sugarcane usually Php per TON in forms
  Sugarcane: {
    unit: "ton",
    _default: { low: 2000, high: 2600 },
  },

  Cassava: {
    unit: "kg",
    _default: { low: 6, high: 8 },
    KU50: { low: 6, high: 8 },
    "Golden Yellow": { low: 6.5, high: 9 },
    "Rayong 5": { low: 6, high: 8 },
  },

  Vegetables: {
    unit: "kg",
    _default: { low: 25, high: 35 },
  },
};

const KG_PER_TON = 1000;
const DEFAULT_KG_PER_SACK = 50;
const DEFAULT_KG_PER_BUNCH = 15;

function getPriceRangeEmbedded(cropName, varietyName) {
  if (!cropName) return null;

  const cropKey = String(cropName).trim();
  const varietyKey = varietyName ? String(varietyName).trim() : "";

  const entry = TAGCROP_PRICE_RANGE_PHP[cropKey];
  if (!entry) return null;

  const unit = entry.unit || "kg";

  const pick = (obj) => {
    if (!obj) return null;
    const low = Number(obj.low);
    const high = Number(obj.high);
    if (!Number.isFinite(low) || low <= 0) return null;
    if (!Number.isFinite(high) || high <= 0) return { low, high: low, unit };
    return { low, high, unit };
  };

  if (varietyKey && entry[varietyKey]) {
    const r = pick(entry[varietyKey]);
    if (r) return r;
  }

  if (entry._default) {
    const r = pick(entry._default);
    if (r) return r;
  }

  return null;
}

function volumeToKg(damagedVolume, yieldUnit, cropName) {
  const v = Number(damagedVolume);
  if (!Number.isFinite(v) || v <= 0) return 0;

  let unitKey = String(yieldUnit || "units").toLowerCase();

  let factor = UNIT_TO_KG_FACTOR[unitKey];
  if (factor == null) factor = 1;

  if (
    unitKey === "sack" ||
    unitKey === "sacks" ||
    unitKey === "cavan" ||
    unitKey === "cavans"
  ) {
    factor = DEFAULT_KG_PER_SACK;
  }
  if (unitKey === "bunch" || unitKey === "bunches") {
    factor = DEFAULT_KG_PER_BUNCH;
  }

  return v * Number(factor);
}

function formatCurrencyRangePHP(low, high) {
  const lo = Number(low);
  const hi = Number(high);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return "—";

  const fmt = (n) =>
    "₱" +
    n.toLocaleString("en-PH", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });

  if (Math.abs(lo - hi) < 0.01) return fmt(lo);
  return `${fmt(lo)} – ${fmt(hi)}`;
}

function computeLossRangePHP({ cropName, varietyName, damagedVolume, yieldUnit }) {
  const range = getPriceRangeEmbedded(cropName, varietyName);
  if (!range) return null;

  const kg = volumeToKg(damagedVolume, yieldUnit, cropName);
  if (!kg || kg <= 0) return null;

  const qty = range.unit === "ton" ? kg / KG_PER_TON : kg;
  const low = qty * range.low;
  const high = qty * range.high;

  if (!Number.isFinite(low) || !Number.isFinite(high)) return null;

  return { low, high };
}
/* ====================================================================== */

function getFarmgatePricePerKg(cropName, varietyName) {
  if (!cropName) return null;

  const cropKey = String(cropName).trim();
  const varietyKey = varietyName ? String(varietyName).trim() : "";

  const entry = FARMGATE_PRICE_PER_KG_PHP[cropKey];
  if (!entry) return null;

  if (typeof entry === "number") return entry;

  if (varietyKey && entry[varietyKey] != null) {
    return entry[varietyKey];
  }

  if (entry._default != null) return entry._default;

  return null;
}

/* ---------- tiny CSS for pulsing halo + chip + hover popup ---------- */
const addPulseStylesOnce = () => {
  if (document.getElementById("pulse-style")) return;
  const style = document.createElement("style");
  style.id = "pulse-style";
  style.innerHTML = `
  @keyframes pulseRing {
    0%   { transform: translate(-50%, -50%) scale(0.8); opacity: .65; }
    70%  { transform: translate(-50%, -50%) scale(1.4); opacity: 0; }
    100% { transform: translate(-50%, -50%) scale(1.4); opacity: 0; }
  }
  .pulse-wrapper { position: relative; width: 0; height: 0; pointer-events: none; }
  .pulse-ring { position: absolute; left: 50%; top: 50%; width: 44px; height: 44px; border-radius: 9999px; background: rgba(16,185,129,0.35); box-shadow: 0 0 0 2px rgba(16,185,129,0.55) inset; animation: pulseRing 1.8s ease-out infinite; }
  .chip { font-family: system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif; font-size: 12px; font-weight: 600; padding: 4px 8px; background: #111827; color: #fff; border-radius: 9999px; box-shadow: 0 1px 3px rgba(0,0,0,0.25); transform: translate(-50%, -8px); white-space: nowrap; }

  .mapboxgl-popup.crop-hover-preview { pointer-events: none !important; }
  .mapboxgl-popup.crop-hover-preview .mapboxgl-popup-content {
    background: transparent !important;
    padding: 0 !important;
    box-shadow: none !important;
    border: none !important;
    border-radius: 0 !important;
  }
  .mapboxgl-popup.crop-hover-preview .mapboxgl-popup-tip { display: none !important; }
  `;
  document.head.appendChild(style);
};

/* ---------- helper: detect soft-deleted / inactive crops ---------- */
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

/* ---------- hover preview helpers ---------- */
function resolveCropImageURL(crop) {
  let raw =
    crop?.thumbnail_url ||
    crop?.image_url ||
    crop?.photo_url ||
    crop?.image ||
    crop?.photo ||
    crop?.image_path ||
    null;

  if (!raw && crop?.photos) {
    try {
      const arr =
        typeof crop.photos === "string" ? JSON.parse(crop.photos) : crop.photos;
      if (Array.isArray(arr) && arr[0]) raw = arr[0];
    } catch {}
  }

  if (!raw) return null;

  if (
    /^(https?:)?\/\//i.test(raw) ||
    raw.startsWith("data:") ||
    raw.startsWith("blob:")
  )
    return raw;

  if (raw.startsWith("/")) return `http://localhost:5000${raw}`;
  return `http://localhost:5000/${raw}`;
}

function isCropHarvested(crop) {
  if (!crop) return false;
  const props = crop.properties || crop;
  return (
    Number(props.is_harvested) === 1 ||
    props.is_harvested === true ||
    !!props.harvested_date
  );
}

function buildCropPreviewHTML(c) {
  const img = resolveCropImageURL(c);
  const name = c.crop_name || "Crop";
  const variety = c.variety_name || "";
  const barangay = c.barangay || c.farmer_barangay || "";
  const planted = c.planted_date
    ? new Date(c.planted_date).toLocaleDateString()
    : "";
  const harvest = c.estimated_harvest
    ? new Date(c.estimated_harvest).toLocaleDateString()
    : "";
  const hectares = c.estimated_hectares;
  const volume = c.estimated_volume;

  return `
    <div style="width:280px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
      <div style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 10px 25px rgba(0,0,0,.15);">
        ${
          img
            ? `<div style="width:100%;height:160px;overflow:hidden;position:relative;">
                 <img src="${img}" alt="${name}" referrerpolicy="no-referrer"
                      style="width:100%;height:100%;object-fit:cover;" />
               </div>`
            : `<div style="width:100%;height:160px;display:grid;place-items:center;
                           background:linear-gradient(135deg,#f3f4f6 0%,#e5e7eb 100%);
                           color:#9ca3af;">
                 <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" stroke-width="2">
                   <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                   <circle cx="8.5" cy="8.5" r="1.5"></circle>
                   <polyline points="21 15 16 10 5 21"></polyline>
                 </svg>
               </div>`
        }
        <div style="padding:12px;">
          <div style="font-weight:700;font-size:16px;color:#047857;margin-bottom:4px;">
            ${name}
          </div>
          ${
            variety
              ? `<div style="font-size:13px;color:#6b7280;margin-bottom:4px;">
                   Variety: <strong>${variety}</strong>
                 </div>`
              : ""
          }
          ${
            barangay
              ? `<div style="font-size:13px;color:#6b7280;margin-bottom:6px;display:flex;align-items:center;gap:4px;">
                   <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                        stroke="#6b7280" stroke-width="2">
                     <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                     <circle cx="12" cy="10" r="3"></circle>
                   </svg>
                   <span><strong>Barangay:</strong> ${barangay}</span>
                 </div>`
              : ""
          }
          <div style="font-size:12px;color:#4b5563;display:flex;flex-wrap:wrap;gap:6px;margin-top:4px;">
            ${
              hectares != null
                ? `<span>Area: <strong>${hectares}</strong> ha</span>`
                : ""
            }
            ${
              volume != null
                ? `<span>Est. volume: <strong>${volume}</strong></span>`
                : ""
            }
          </div>
          ${
            planted || harvest
              ? `<div style="font-size:12px;color:#6b7280;margin-top:6px;">
                   ${
                     planted
                       ? `<span>Planted: <strong>${planted}</strong></span>`
                       : ""
                   }
                   ${planted && harvest ? " · " : ""}${
                   harvest
                     ? `<span>Harvest: <strong>${harvest}</strong></span>`
                     : ""
                 }
                 </div>`
              : ""
          }
        </div>
      </div>
    </div>
  `;
}

/* ---------- timeline helper ---------- */
function passesTimelineFilter(obj, mode, from, to) {
  const hasFilter = !!from || !!to;
  if (!hasFilter) return true;

  const props = obj.properties || obj;

  let raw;
  if (mode === "harvest") {
    raw = props.harvested_date || props.estimated_harvest;
  } else {
    raw = props.planted_date;
  }

  if (!raw) return false;

  const value = String(raw).slice(0, 7);
  if (from && value < from) return false;
  if (to && value > to) return false;
  return true;
}

/* ---------- coordinates normalization ---------- */
function getCropRing(crop) {
  if (!crop) return null;

  let geom = crop.geometry || crop.geojson || crop.polygon || null;

  if (!geom && crop.coordinates && !Array.isArray(crop.coordinates)) {
    geom = crop.coordinates;
  }

  if (typeof geom === "string") {
    try {
      geom = JSON.parse(geom);
    } catch {
      geom = null;
    }
  }

  if (geom && typeof geom === "object" && !Array.isArray(geom)) {
    if (geom.type === "Polygon") {
      const ring = geom.coordinates && geom.coordinates[0];
      if (Array.isArray(ring) && ring.length >= 3) return ring;
    }
    if (geom.type === "MultiPolygon") {
      const ring =
        geom.coordinates &&
        Array.isArray(geom.coordinates[0]) &&
        Array.isArray(geom.coordinates[0][0])
          ? geom.coordinates[0][0]
          : null;
      if (Array.isArray(ring) && ring.length >= 3) return ring;
    }
  }

  let coords = crop.coordinates || crop.coords || null;
  if (!coords) return null;

  if (typeof coords === "string") {
    try {
      coords = JSON.parse(coords);
    } catch {
      return null;
    }
  }

  if (
    Array.isArray(coords) &&
    coords.length > 0 &&
    Array.isArray(coords[0]) &&
    Array.isArray(coords[0][0])
  ) {
    coords = coords[0];
  }

  if (!Array.isArray(coords) || coords.length < 3) return null;
  return coords;
}

function buildPolygonsFromCrops(crops = []) {
  const features = [];

  for (const crop of crops) {
    const ring = getCropRing(crop);
    if (!ring) continue;

    let coords = ring;
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      coords = [...ring, first];
    }

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
        harvested_date: crop.harvested_date,
        planted_date: crop.planted_date,
        estimated_harvest: crop.estimated_harvest,
        estimated_hectares: crop.estimated_hectares,
        estimated_volume: crop.estimated_volume,
      },
    });
  }

  return { type: "FeatureCollection", features };
}

/* ---------- accuracy circle ---------- */
function makeAccuracyCircle([lng, lat], accuracy) {
  const accNum = Number(accuracy);
  const safeAcc = Number.isFinite(accNum) ? accNum : 10;
  const radiusKm = Math.max(safeAcc, 10) / 1000;
  return turf.circle([lng, lat], radiusKm, { steps: 64, units: "kilometers" });
}

/* ---------- bounds helpers ---------- */
function isInsideBounds([lng, lat], bounds) {
  const [[minLng, minLat], [maxLng, maxLat]] = bounds;
  return lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat;
}
function expandBoundsToIncludePoint(bounds, [lng, lat], pad = 0.05) {
  const [[minLng, minLat], [maxLng, maxLat]] = bounds;
  return [
    [Math.min(minLng, lng) - pad, Math.min(minLat, lat) - pad],
    [Math.max(maxLng, lng) + pad, Math.max(maxLat, lat) + pad],
  ];
}

/* ---------- geolocation helpers ---------- */
function explainGeoError(err) {
  if (!err) return "Unknown geolocation error.";
  switch (err.code) {
    case 1:
      return "Permission denied. Allow location for this site in your browser.";
    case 2:
      return "Position unavailable. Try near a window or check OS location services.";
    case 3:
      return "Timed out. Try again or increase the timeout.";
    default:
      return err.message || "Geolocation failed.";
  }
}
function startGeoWatch(onPos, onErr, opts) {
  if (
    !("geolocation" in navigator) ||
    typeof navigator.geolocation.watchPosition !== "function"
  ) {
    onErr?.({
      code: 2,
      message: "Geolocation watch not supported in this browser.",
    });
    return () => {};
  }
  const id = navigator.geolocation.watchPosition(onPos, onErr, opts);
  return () => {
    try {
      navigator.geolocation?.clearWatch?.(id);
    } catch {}
  };
}

/* ---------- device orientation ---------- */
function extractHeadingFromEvent(e) {
  if (typeof e.webkitCompassHeading === "number") return e.webkitCompassHeading;
  if (typeof e.alpha === "number") return (360 - e.alpha + 360) % 360;
  return null;
}
async function startCompass(onHeading) {
  try {
    if (
      typeof DeviceOrientationEvent !== "undefined" &&
      typeof DeviceOrientationEvent.requestPermission === "function"
    ) {
      const p = await DeviceOrientationEvent.requestPermission();
      if (p !== "granted") throw new Error("Compass permission denied.");
    }
  } catch {}
  const handler = (e) => {
    const h = extractHeadingFromEvent(e);
    if (h != null && !Number.isNaN(h)) onHeading(h);
  };
  const type =
    "ondeviceorientationabsolute" in window
      ? "deviceorientationabsolute"
      : "deviceorientation";
  window.addEventListener(type, handler, { passive: true });
  return () => window.removeEventListener(type, handler);
}

/* ---------- icon button ---------- */
function IconButton({ title, active, onClick, children }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`w-9 h-9 grid place-items-center rounded-lg border transition shadow-sm ${
        active
          ? "bg-emerald-600 text-white border-emerald-600"
          : "bg-white text-gray-800 border-gray-300"
      } hover:shadow-md`}
    >
      {children}
    </button>
  );
}

/* ---------- barangay helpers ---------- */
function getBarangayName(props) {
  return props?.Barangay ?? props?.barangay ?? props?.NAME ?? props?.name ?? "";
}
function strictDetectBarangayForGeometry(geom, barangaysFC) {
  if (!geom || !barangaysFC?.features?.length) return null;
  if (!(geom.type === "Polygon" || geom.type === "MultiPolygon")) return null;

  const farmFeat = { type: "Feature", properties: {}, geometry: geom };
  const center = turf.centroid(farmFeat);
  const centerPt = center.geometry;

  for (const f of barangaysFC.features) {
    const g = f.geometry;
    if (!g) continue;
    if (!turf.booleanPointInPolygon(centerPt, g)) continue;

    const ring =
      geom.type === "Polygon"
        ? geom.coordinates?.[0] || []
        : geom.coordinates?.[0]?.[0] || [];
    const allInside = ring.every((coord) => {
      try {
        return turf.booleanPointInPolygon(turf.point(coord), g);
      } catch {
        return false;
      }
    });
    if (!allInside) continue;

    return {
      name: getBarangayName(f.properties || {}),
      feature: f,
      centroid: center.geometry.coordinates,
    };
  }
  return null;
}

const formatNum = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
};

const formatCurrency = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return (
    "₱" +
    num.toLocaleString("en-PH", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
  );
};

// ---------- crop center helper ----------
function getCropCenter(crop) {
  const ring = getCropRing(crop);
  if (!ring) return null;

  let coords = ring;
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    coords = [...ring, first];
  }

  const poly = turf.polygon([coords]);
  let pt = turf.centerOfMass(poly);
  if (!pt?.geometry?.coordinates) pt = turf.pointOnFeature(poly);
  return pt.geometry.coordinates;
}

// ---------- estimate average elevation (center-based) ----------
function estimateAverageElevation(geom, mapInstance) {
  const m = mapInstance;
  if (!m || !geom) return null;
  if (typeof m.queryTerrainElevation !== "function") return null;

  try {
    const feat = { type: "Feature", geometry: geom, properties: {} };
    const center = turf.centroid(feat);
    const [lng, lat] = center.geometry.coordinates;
    const raw = m.queryTerrainElevation({ lng, lat }, { exaggerated: false });
    if (typeof raw === "number" && Number.isFinite(raw)) {
      return Number(raw.toFixed(1));
    }
  } catch (err) {
    console.warn("estimateAverageElevation failed:", err);
  }
  return null;
}

const CalamityMap = () => {
  addPulseStylesOnce();

  // deep-link target
  const locationState = useLocation().state || {};
  const [searchParams] = useSearchParams();
  const coerceNum = (val) => {
    if (val === null || val === undefined) return NaN;
    if (typeof val === "string" && val.trim() === "") return NaN;
    const n = Number(val);
    return Number.isFinite(n) ? n : NaN;
  };
  const target = {
    lat: coerceNum(locationState.lat ?? searchParams.get("lat")),
    lng: coerceNum(locationState.lng ?? searchParams.get("lng")),
    cropId: String(locationState.cropId ?? searchParams.get("cropId") ?? ""),
    cropName: locationState.cropName ?? searchParams.get("cropName") ?? "",
    barangay: locationState.barangay ?? searchParams.get("barangay") ?? "",
    zoom: coerceNum(locationState.zoom ?? searchParams.get("zoom")),
  };
  if (!Number.isFinite(target.zoom)) target.zoom = 16;

  const mapContainer = useRef(null);
  const map = useRef(null);
  const markerRef = useRef(null);
  const directionsRef = useRef(null);

  const cropMarkerMapRef = useRef(new Map());
  const selectedLabelRef = useRef(null);
  const selectedHaloRef = useRef(null);

  const hoverPopupRef = useRef(null);
  const hoverLeaveTimerRef = useRef(null);
  const radiusHoverPopupRef = useRef(null);

  const HILITE_SRC = "selected-crop-highlight-src";
  const HILITE_FILL = "selected-crop-highlight-fill";
  const HILITE_LINE = "selected-crop-highlight-line";

  const HILITE_ANIM_REF = useRef(null);
  const hasDeepLinkedRef = useRef(false);
  const savedMarkersRef = useRef([]);

  const [mapStyle, setMapStyle] = useState(
    "mapbox://styles/wompwomp-69/cm900xa91008j01t14w8u8i9d"
  );
  const [showLayers, setShowLayers] = useState(false);
  const [isSwitcherVisible, setIsSwitcherVisible] = useState(false);
  const [selectedBarangay, setSelectedBarangay] = useState(null);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [isDirectionsVisible] = useState(true);
  const [newTagLocation, setNewTagLocation] = useState(null);
  const [isTagging, setIsTagging] = useState(false);
  const [taggedData] = useState([]);
  const [sidebarCrops, setSidebarCrops] = useState([]);
  const [selectedCrop, setSelectedCrop] = useState(null);
  const [selectedCropType, setSelectedCropType] = useState("All");
  const [cropTypes, setCropTypes] = useState([]);
  const [areMarkersVisible, setAreMarkersVisible] = useState(true);
  const [enlargedImage, setEnlargedImage] = useState(null);
    const [resolvingImpact, setResolvingImpact] = useState(false);
    const [calamityHistory, setCalamityHistory] = useState([]);
const [resolvedCropIds, setResolvedCropIds] = useState([]);



  const initialHarvestFilter =
    locationState.harvestFilter ??
    searchParams.get("harvestFilter") ??
    "not_harvested";

  const [harvestFilter, setHarvestFilter] = useState(initialHarvestFilter);

  // radius drawing state
  const [isDrawingRadius, setIsDrawingRadius] = useState(false);

  // state + refs so map click handler always has latest radius
  const [radiusMetersState, _setRadiusMeters] = useState(null);
  const [radiusCenterState, _setRadiusCenter] = useState(null);
  const radiusMetersRef = useRef(null);
  const radiusCenterRef = useRef(null);

  const radiusMeters = radiusMetersState;
  const radiusCenter = radiusCenterState;

  const setRadiusMeters = useCallback((val) => {
    radiusMetersRef.current = val;
    _setRadiusMeters(val);
  }, []);

  const setRadiusCenter = useCallback((val) => {
    radiusCenterRef.current = val;
    _setRadiusCenter(val);
  }, []);

  const radiusGeoRef = useRef(null);       // last main circle FC
  const radiusBandsGeoRef = useRef(null);

  const isDrawingRadiusRef = useRef(false);
  const dragCenterRef = useRef(null);
  const dragActiveRef = useRef(false);

  // 🔴 active calamity and saving states
  const [activeCalamityId, setActiveCalamityId] = useState(null);
  // full metadata of the currently active calamity radius
  const [activeCalamity, setActiveCalamity] = useState(null);
  const [isUploadingDamagePhoto, setIsUploadingDamagePhoto] = useState(false);
  const [isSavingImpact, setIsSavingImpact] = useState(false);

  // calamity radius meta to save
  const [calamityName, setCalamityName] = useState("");
  const [calamityType, setCalamityType] = useState("");
  const [calamityDescription, setCalamityDescription] = useState("");
  const [calamityDate, setCalamityDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [showCalamityForm, setShowCalamityForm] = useState(false);

  // timeline filter (global)
  const [timelineMode, setTimelineMode] = useState("planted");
  const [timelineFrom, setTimelineFrom] = useState("");
  const [timelineTo, setTimelineTo] = useState("");
  const [hideCompareCard, setHideCompareCard] = useState(false);

  const [selectedCropHistory, setSelectedCropHistory] = useState([]);

  // GPS / heading
  const userMarkerRef = useRef(null);
  const userMarkerElRef = useRef(null);
  const [userLoc, setUserLoc] = useState(null);
  const [tracking, setTracking] = useState(false);
  const watchStopRef = useRef(null);

  const [headingDeg, setHeadingDeg] = useState(null);
  const [compassOn, setCompassOn] = useState(false);
  const compassStopRef = useRef(null);
  const [rotateMapWithHeading, setRotateMapWithHeading] = useState(false);

  const [lockToBago, setLockToBago] = useState(true);

  const SIDEBAR_WIDTH = 500;
  const PEEK = 1;

  const normalizeCoordsKey = useCallback((crop) => {
    const ringRaw = getCropRing(crop);
    if (!ringRaw) return null;

    let ring = ringRaw;

    if (ring.length >= 2) {
      const first = ring[0];
      const last = ring[ring.length - 1];
      if (first[0] === last[0] && first[1] === last[1]) {
        ring = ring.slice(0, ring.length - 1);
      }
    }

    ring = ring.map((pt) => {
      const [lng, lat] = pt;
      const nLng = Number.isFinite(Number(lng)) ? Number(lng) : 0;
      const nLat = Number.isFinite(Number(lat)) ? Number(lat) : 0;
      return [Number(nLng.toFixed(6)), Number(nLat.toFixed(6))];
    });

    return JSON.stringify(ring);
  }, []);
// ✅ Find the impact record for the *selected crop* under the *active calamity*
const activeImpactRecord = useMemo(() => {
  if (!activeCalamityId || !Array.isArray(calamityHistory)) return null;

  return calamityHistory.find((row) => {
    const rid =
      row.calamity_radius_id ??
      row.calamityRadiusId ??
      row.radius_id ??
      row.calamity_id ??
      row.calamityId ??
      row.calamityradius_id;

    return String(rid) === String(activeCalamityId);
  });
}, [activeCalamityId, calamityHistory]);

// ✅ Determine if that saved impact is already resolved
const activeImpactIsResolved = useMemo(() => {
  const r = activeImpactRecord;
  if (!r) return false;

  const status = String(r.status || "").toLowerCase();
  const resolvedFlag =
    r.is_resolved === 1 ||
    r.is_resolved === "1" ||
    r.is_resolved === true ||
    r.resolved === 1 ||
    r.resolved === "1" ||
    r.resolved === true;

  const resolvedDate = !!(r.resolved_at || r.resolvedAt);

  return resolvedFlag || resolvedDate || status === "resolved";
}, [activeImpactRecord]);

  const fieldHistory = useMemo(() => {
    if (!Array.isArray(selectedCropHistory)) return [];
    return selectedCropHistory
      .slice()
      .sort((a, b) => {
        const da = new Date(
          a.date_planted || a.planted_date || a.created_at || 0
        );
        const db = new Date(
          b.date_planted || b.planted_date || b.created_at || 0
        );
        return da - db;
      });
  }, [selectedCropHistory]);

  const lastSeason = fieldHistory.length
    ? fieldHistory[fieldHistory.length - 1]
    : null;

  const hasPastSeason = !!lastSeason;

  const croppingSystemLabel =
    selectedCrop?.cropping_system_label || selectedCrop?.cropping_system || null;

  const primaryCropName = selectedCrop?.crop_name || "";
  const primaryVarietyName = selectedCrop?.variety_name || null;
  const primaryVolume = selectedCrop?.estimated_volume ?? null;
  const primaryUnit = selectedCrop?.yield_unit || "units";
  const primaryHectares =
    selectedCrop?.estimated_hectares ?? selectedCrop?.hectares ?? null;
  const primaryPlantedDate = selectedCrop?.planted_date || null;
  const primaryHarvestOrEst =
    selectedCrop?.harvested_date || selectedCrop?.estimated_harvest || null;

  const primaryPricePerUnit = useMemo(() => {
    if (!primaryCropName) return null;

    const perKg = getFarmgatePricePerKg(primaryCropName, primaryVarietyName);
    if (perKg == null) return null;

    const unitKey = String(primaryUnit || "units").toLowerCase();
    const factorKg =
      UNIT_TO_KG_FACTOR[unitKey] != null ? UNIT_TO_KG_FACTOR[unitKey] : 1;

    return perKg * factorKg;
  }, [primaryCropName, primaryVarietyName, primaryUnit]);

  const pastCropName = lastSeason?.crop_name || null;
  const pastVarietyName = lastSeason?.variety_name || null;
  const pastVolume =
    lastSeason?.estimated_volume != null ? lastSeason.estimated_volume : null;
  const pastUnit = lastSeason?.yield_unit || "units";
  const pastHectares =
    lastSeason?.hectares ?? lastSeason?.estimated_hectares ?? null;
  const pastPlantedDate =
    lastSeason?.date_planted || lastSeason?.planted_date || null;
  const pastHarvestDate =
    lastSeason?.date_harvested ||
    lastSeason?.harvested_date ||
    lastSeason?.estimated_harvest ||
    null;

  const hasBothVolumes = primaryVolume != null && pastVolume != null;
  const volumeDelta = hasBothVolumes ? primaryVolume - pastVolume : null;
  const volumeDeltaPct =
    hasBothVolumes && pastVolume !== 0
      ? ((primaryVolume - pastVolume) / Math.abs(pastVolume)) * 100
      : null;

  const volumeDeltaPctLabel =
    volumeDeltaPct != null
      ? `${volumeDeltaPct > 0 ? "+" : ""}${volumeDeltaPct.toFixed(0)}%`
      : null;
    
  const selectedCropDamage = useMemo(() => {
    if (!selectedCrop || !radiusCenter || !radiusMeters) return null;

    const center = getCropCenter(selectedCrop);
    if (!center) return null;

    const dKm = turf.distance(center, radiusCenter, { units: "kilometers" });
    const dMeters = dKm * 1000;
    const r = Number(radiusMeters);

    let severity = "Outside calamity radius";
    let level = "outside";
    let damageFraction = 0;

    if (dMeters <= r) {
      const ratio = dMeters / r;

      if (ratio <= 0.25) {
        severity = "Severe";
        level = "severe";
        damageFraction = 0.9;
      } else if (ratio <= 0.5) {
        severity = "High";
        level = "high";
        damageFraction = 0.6;
      } else if (ratio <= 0.75) {
        severity = "Moderate";
        level = "moderate";
        damageFraction = 0.35;
      } else {
        severity = "Low";
        level = "low";
        damageFraction = 0.15;
      }
    }

    const primaryHectaresLocal = Number(
      selectedCrop.estimated_hectares || selectedCrop.estimatedHectares || 0
    );
    const primaryVolumeLocal = Number(
      selectedCrop.estimated_volume || selectedCrop.estimatedVolume || 0
    );

    const damagedAreaHa =
      primaryHectaresLocal > 0 ? primaryHectaresLocal * damageFraction : null;
    const damagedVolume =
      primaryVolumeLocal > 0 ? primaryVolumeLocal * damageFraction : null;

    const cropTypeId = selectedCrop.crop_type_id || selectedCrop.cropTypeId;
    const varietyName =
      selectedCrop.variety_name || selectedCrop.varietyName || "";
    const vegCategory =
      selectedCrop.veg_category_main ||
      selectedCrop.veg_category ||
      "";

    const unit =
      selectedCrop.yield_unit ||
      CALAMITY_YIELD_UNIT_MAP[cropTypeId] ||
      "kg";

    const kgPerSack =
      selectedCrop.kg_per_sack ||
      selectedCrop.kgPerSack ||
      CALAMITY_DEFAULT_KG_PER_SACK;

    const kgPerBunch =
      selectedCrop.kg_per_bunch ||
      selectedCrop.kgPerBunch ||
      CALAMITY_DEFAULT_KG_PER_BUNCH;

    const userPriceLow =
      selectedCrop.main_price_low || selectedCrop.mainPriceLow || undefined;
    const userPriceHigh =
      selectedCrop.main_price_high || selectedCrop.mainPriceHigh || undefined;

    let lossRange = null;
    let lossValueMid = null;

    if (damagedVolume && cropTypeId) {
      const range = calamityComputeFarmgateValueRange({
        cropTypeId,
        varietyName,
        vegCategory,
        volume: damagedVolume,
        unit,
        kgPerSack,
        kgPerBunch,
        userPriceLow,
        userPriceHigh,
      });

      if (range) {
        lossRange = {
          low: range.valueLow,
          high: range.valueHigh,
          label: `₱${calamityPeso(range.valueLow)} – ₱${calamityPeso(
            range.valueHigh
          )}`,
        };
        lossValueMid = (range.valueLow + range.valueHigh) / 2;
      }
    }

    return {
      severity,
      level,
      distanceMeters: dMeters,
      radiusMeters: r,
      damageFraction,
      percent: damageFraction * 100,

      damagedAreaHa,
      damagedVolume,

      lossRange,
      lossValueMid,
    };
  }, [selectedCrop, radiusCenter, radiusMeters]);
  const isCropOutsideRadius =
  !selectedCropDamage ||
  selectedCropDamage.level === "outside" ||
  selectedCropDamage.damageFraction <= 0;

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

  const zoomToBarangay = (coordinates) => {
    if (map.current)
      map.current.flyTo({ center: coordinates, zoom: 14, essential: true });
  };

  const handleBarangaySelect = (barangayData) => {
    setSelectedBarangay(barangayData);
    if (markerRef.current) markerRef.current.remove();

    if (map.current && barangayData) {
      const el = document.createElement("div");
      el.className = "marker";
      el.style.width = "18px";
      el.style.height = "18px";
      el.style.borderRadius = "50%";
      el.style.backgroundColor = "#10B981";
      el.style.border = "3px solid white";
      el.style.boxShadow = "0 0 10px rgba(0,0,0,0.3)";

      const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
        <div class="text-sm">
          <h3 class="font-bold text-green-600 text-base">${barangayData.name}</h3>
          ${
            barangayData.population
              ? `<p><strong>Population:</strong> ${barangayData.population}</p>`
              : ""
          }
          ${
            barangayData.crops
              ? `<p><strong>Crops:</strong> ${barangayData.crops.join(", ")}</p>`
              : ""
          }
        </div>
      `);

      markerRef.current = new mapboxgl.Marker(el)
        .setLngLat(barangayData.coordinates)
        .setPopup(popup)
        .addTo(map.current);
      markerRef.current.togglePopup();
    }
  };

  /* ---------- TERRAIN helper (DEM + terrain) ---------- */
  const ensureTerrain = useCallback(() => {
    if (!map.current) return;
    const m = map.current;
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

const handleResolveCalamityImpact = async () => {
  // 0) basic guards
  if (!selectedCrop || !selectedCrop.id) {
    toast.info("Select a crop first.");
    return;
  }

  if (!activeCalamityId) {
    toast.info("Select an active calamity radius first (click an orange circle).");
    return;
  }

  if (!activeImpactRecord) {
    toast.info(
      "No saved impact found for this crop under the active calamity. Click “Save impact” first."
    );
    return;
  }

  if (activeImpactIsResolved) {
    toast.info("This impact is already resolved.");
    return;
  }

  const ok = window.confirm(
    "Mark this field as resolved for this calamity? This means the damage has been processed or cleared."
  );
  if (!ok) return;

  try {
    setResolvingImpact(true);

    // 1) update DB (mark this crop's impact as resolved)
    await axios.patch(
      `http://localhost:5000/api/calamityradius/${activeCalamityId}/impact/resolve`,
      { crop_id: selectedCrop.id }
    );

    toast.success("Calamity impact marked as resolved.");

    // 2) refresh history for this crop (for the sidebar card)
    try {
      const res = await axios.get(
        `http://localhost:5000/api/calamityradius/crop/${selectedCrop.id}/history`
      );
      setCalamityHistory(res.data || []);
    } catch (e) {
      console.warn("Resolve ok, but failed to refresh history:", e);
    }

    const idStr = String(selectedCrop.id);

    // 3) remember this crop as resolved (for filtering) + persist to localStorage
    setResolvedCropIds((prev) => {
      const existing = prev.map((id) => String(id));
      if (existing.includes(idStr)) return prev;

      const next = [...prev, selectedCrop.id];

      try {
        const nextForStorage = Array.from(
          new Set(next.map((id) => String(id)))
        );
        localStorage.setItem(
          "agri_resolved_crop_ids",
          JSON.stringify(nextForStorage)
        );
      } catch (e) {
        console.warn("Failed to persist resolved crop IDs:", e);
      }

      return next;
    });

    // 4) remove marker for this crop (so the pin disappears immediately)
    const marker = cropMarkerMapRef.current.get(idStr);
    if (marker) {
      marker.remove();
      cropMarkerMapRef.current.delete(idStr);

      // also drop it from the list of all markers
      savedMarkersRef.current = savedMarkersRef.current.filter(
        (m) => m !== marker
      );
    }

    // 5) remove this crop from the sidebar list
    setSidebarCrops((prev) => prev.filter((c) => String(c.id) !== idStr));

    // 6) clear highlight and close card
    clearSelection();
    setSelectedCrop(null);

    // 7) keep the calamity radius visible (multi-band circle)
    if (radiusCenter && radiusMeters) {
      updateRadiusCircle(radiusCenter, radiusMeters);
    }
    reapplyActiveRadius();

    // 8) 🔴 SAFETY NET: fully rebuild markers from API using updated resolvedCropIds
    //    This guarantees that even after a hard page refresh + resolve,
    //    any stray marker for this crop will be dropped.
    if (areMarkersVisible) {
      try {
        await renderSavedMarkers();
      } catch (e) {
        console.warn("Failed to refresh markers after resolve:", e);
      }
    }
  } catch (err) {
    console.error("Failed to resolve calamity impact:", err);
    toast.error(
      err?.response?.data?.message || "Failed to resolve impact. Please try again."
    );
  } finally {
    setResolvingImpact(false);
  }
};


  const refreshMapData = useCallback(async () => {
    try {
      await loadPolygons();
      await renderSavedMarkers();
    } catch (e) {
      console.error(e);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const markHarvested = useCallback(
    async (cropId, harvestedDate = null) => {
      try {
        const body = harvestedDate ? { harvested_date: harvestedDate } : {};
        await axios.patch(
          `http://localhost:5000/api/crops/${cropId}/harvest`,
          body
        );
        toast.success("Marked as harvested");
        await refreshMapData();
        setSelectedCrop((prev) =>
          prev && String(prev.id) === String(cropId)
            ? {
                ...prev,
                is_harvested: 1,
                harvested_date:
                  harvestedDate || new Date().toISOString().slice(0, 10),
              }
            : prev
        );
      } catch (e) {
        console.error(e);
        toast.error(e?.response?.data?.message || "Failed to mark harvested");
      }
    },
    [refreshMapData]
  );

  const loadPreviousSeasons = useCallback(async (cropId) => {
    try {
      const { data } = await axios.get(
        `http://localhost:5000/api/crops/${cropId}/history`
      );
      setSelectedCropHistory(Array.isArray(data) ? data : []);
      toast.success("Previous seasons loaded");
    } catch (e) {
      console.error(e);
      toast.error("Failed to load previous seasons");
    }
  }, []);

 // ---------- marker rendering WITH hover preview ----------
const renderSavedMarkers = useCallback(async () => {
  if (!map.current) return;

  try {
    const response = await axios.get("http://localhost:5000/api/crops");

    const allRows = response.data || [];
    let crops = allRows.filter((c) => !isSoftDeletedCrop(c));

    // ✅ ALWAYS read the latest resolved IDs from localStorage
    let resolvedIdsFromStorage = [];
    try {
      const raw = localStorage.getItem("agri_resolved_crop_ids");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          resolvedIdsFromStorage = parsed;
        }
      }
    } catch (e) {
      console.warn("Failed to read resolved crop IDs from localStorage:", e);
    }

    if (resolvedIdsFromStorage.length) {
      const resolvedSet = new Set(
        resolvedIdsFromStorage.map((id) => String(id))
      );
      crops = crops.filter((c) => !resolvedSet.has(String(c.id)));
    }

    setSidebarCrops(crops);

    // Clear existing markers + hover popup
    savedMarkersRef.current.forEach((marker) => marker.remove());
    savedMarkersRef.current = [];
    cropMarkerMapRef.current.clear();
    if (hoverPopupRef.current) {
      try {
        hoverPopupRef.current.remove();
      } catch {}
      hoverPopupRef.current = null;
    }

    // Apply filters (type, harvest, timeline)
    const filteredByType =
      selectedCropType === "All"
        ? crops
        : crops.filter((c) => c.crop_name === selectedCropType);

    let filtered = filteredByType;

    if (harvestFilter === "harvested") {
      filtered = filtered.filter((c) => isCropHarvested(c));
    } else if (harvestFilter === "not_harvested") {
      filtered = filtered.filter((c) => !isCropHarvested(c));
    }

    filtered = filtered.filter((c) =>
      passesTimelineFilter(c, timelineMode, timelineFrom, timelineTo)
    );

    // Create markers
    for (const crop of filtered) {
      const center = getCropCenter(crop);
      if (!center) continue;

      const isHarvestedFlag = isCropHarvested(crop);

      const popupHtml = `
        <div class="text-sm" style="min-width:220px">
          <h3 class='font-bold text-green-600'>${crop.crop_name}</h3>
          <p><strong>Variety:</strong> ${crop.variety_name || "N/A"}</p>
          <p style="margin-top:6px;">
            <strong>Status:</strong> ${
              isHarvestedFlag ? "Harvested" : "Not harvested"
            }
          </p>
        </div>
      `;

      const popup = new mapboxgl.Popup({ offset: 15 }).setHTML(popupHtml);

      const marker = new mapboxgl.Marker({
        color: isHarvestedFlag ? "#6B7280" : "#10B981",
      })
        .setLngLat(center)
        .setPopup(popup)
        .addTo(map.current);

      // Click → select crop + highlight
      marker.getElement().addEventListener("click", () => {
        setSelectedCrop(crop);
        highlightSelection(crop);
        setIsSidebarVisible(true);
      });

      // Hover → big preview card
      marker.getElement().addEventListener("mouseenter", () => {
        if (hoverLeaveTimerRef.current) {
          clearTimeout(hoverLeaveTimerRef.current);
          hoverLeaveTimerRef.current = null;
        }
        try {
          hoverPopupRef.current?.remove();
        } catch {}

        const html = buildCropPreviewHTML(crop);
        const hoverPopup = new mapboxgl.Popup({
          closeButton: false,
          closeOnClick: false,
          closeOnMove: false,
          offset: 30,
          anchor: "top",
          className: "crop-hover-preview",
          maxWidth: "none",
        })
          .setLngLat(center)
          .setHTML(html)
          .addTo(map.current);

        setTimeout(() => {
          const el = hoverPopup.getElement();
          const content = el?.querySelector(".mapboxgl-popup-content");
          const tip = el?.querySelector(".mapboxgl-popup-tip");
          if (content) {
            content.style.background = "transparent";
            content.style.padding = "0";
            content.style.boxShadow = "none";
          }
          if (tip) tip.style.display = "none";
        }, 0);

        hoverPopupRef.current = hoverPopup;
      });

      marker.getElement().addEventListener("mouseleave", () => {
        hoverLeaveTimerRef.current = setTimeout(() => {
          if (hoverPopupRef.current) {
            try {
              hoverPopupRef.current.remove();
            } catch {}
            hoverPopupRef.current = null;
          }
        }, 140);
      });

      cropMarkerMapRef.current.set(String(crop.id), marker);
      savedMarkersRef.current.push(marker);
    }

    ensureDeepLinkSelection();
  } catch (error) {
    console.error("Failed to load saved markers:", error);
  }
}, [
  selectedCropType,
  harvestFilter,
  timelineMode,
  timelineFrom,
  timelineTo,
]);


  /* ---------- polygon loader with harvested color ---------- */
  const loadPolygons = useCallback(
    async (cropsOverride = null) => {
      if (!map.current) return;

      let crops = cropsOverride;

      if (!crops) {
        const res = await axios.get("http://localhost:5000/api/crops");
        const rows = res.data || [];
        crops = rows.filter((c) => !isSoftDeletedCrop(c));
      } else {
        crops = (crops || []).filter((c) => !isSoftDeletedCrop(c));
      }

      const fullData = buildPolygonsFromCrops(crops);

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

      const paintStyle = {
        "fill-color": [
          "case",
          ["==", ["get", "is_harvested"], 1],
          "#9CA3AF",
          baseColorByCrop,
        ],
        "fill-opacity": 0.4,
      };

      if (map.current.getSource("crop-polygons")) {
        map.current.getSource("crop-polygons").setData(fullData);
        map.current.setPaintProperty(
          "crop-polygons-layer",
          "fill-color",
          paintStyle["fill-color"]
        );
      } else {
        map.current.addSource("crop-polygons", {
          type: "geojson",
          data: fullData,
        });
        map.current.addLayer({
          id: "crop-polygons-layer",
          type: "fill",
          source: "crop-polygons",
          paint: paintStyle,
        });
        map.current.addLayer({
          id: "crop-polygons-outline",
          type: "line",
          source: "crop-polygons",
          paint: { "line-color": "#065F46", "line-width": 1 },
        });
      }
    },
    []
  );

  const ensureBarangayLayers = useCallback(() => {
    if (!map.current) return;
    const m = map.current;
    if (!BARANGAYS_FC?.features?.length) return;

    if (!m.getSource("barangays-src")) {
      m.addSource("barangays-src", { type: "geojson", data: BARANGAYS_FC });
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

    try {
      if (m.getLayer("crop-polygons-outline")) {
        m.moveLayer("barangays-labels");
      }
    } catch {}
  }, []);

  // GPS accuracy ring
  const USER_ACC_SOURCE = "user-accuracy-source";
  const USER_ACC_LAYER = "user-accuracy-layer";
  const USER_ACC_OUTLINE = "user-accuracy-outline";

  const ensureUserAccuracyLayers = useCallback(() => {
    if (!map.current) return;
    const m = map.current;

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
  }, []);

  const updateUserAccuracyCircle = useCallback(
    (lng, lat, acc) => {
      if (!map.current) return;
      ensureUserAccuracyLayers();
      const circle = makeAccuracyCircle([lng, lat], acc);
      map.current.getSource(USER_ACC_SOURCE).setData(circle);
    },
    [ensureUserAccuracyLayers]
  );

  const setUserMarker = useCallback(
    (lng, lat, acc) => {
      if (!map.current) return;

      const nLng = Number(lng);
      const nLat = Number(lat);
      if (!Number.isFinite(nLng) || !Number.isFinite(nLat)) {
        console.error("Invalid coords in setUserMarker:", { lng, lat });
        toast.error("Invalid GPS coordinates.");
        return;
      }

      const m = map.current;

      if (!userMarkerElRef.current) {
        const el = document.createElement("div");
        el.style.position = "relative";
        el.style.width = "26px";
        el.style.height = "26px";
        el.style.borderRadius = "50%";
        el.style.border = "2px solid rgba(37,99,235,0.55)";
        el.style.background = "rgba(37,99,235,0.10)";
        el.style.boxShadow = "0 0 4px rgba(37,99,235,0.35)";

        const triangle = document.createElement("div");
        triangle.style.position = "absolute";
        triangle.style.left = "50%";
        triangle.style.top = "50%";
        triangle.style.transform = "translate(-50%, -55%)";
        triangle.style.width = "0";
        triangle.style.height = "0";
        triangle.style.borderLeft = "7px solid transparent";
        triangle.style.borderRight = "7px solid transparent";
        triangle.style.borderBottom = "12px solid #2563eb";

        el.appendChild(triangle);

        userMarkerElRef.current = el;

        userMarkerRef.current = new mapboxgl.Marker({
          element: el,
          anchor: "center",
        })
          .setLngLat([nLng, nLat])
          .setPopup(new mapboxgl.Popup({ offset: 12 }).setText("You are here"))
          .addTo(m);
      } else {
        userMarkerRef.current.setLngLat([nLng, nLat]);
      }

      const accNum = Number(acc);
      const safeAcc = Number.isFinite(accNum) ? accNum : 10;
      updateUserAccuracyCircle(nLng, nLat, safeAcc);

      m.easeTo({
        center: [nLng, nLat],
        zoom: Math.max(m.getZoom(), 15),
        duration: 0,
        essential: true,
      });
    },
    [updateUserAccuracyCircle]
  );

  const handleFix = useCallback(
    (glng, glat, accuracy) => {
      if (!map.current) return;

      const lng = Number(glng);
      const lat = Number(glat);

      if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
        console.error("Invalid coords in handleFix:", { glng, glat });
        toast.error("Invalid GPS coordinates from browser.");
        return;
      }

      const accNum = Number(accuracy);
      const safeAcc = Number.isFinite(accNum) ? accNum : 10;

      if (lockToBago && !isInsideBounds([lng, lat], BAGO_CITY_BOUNDS)) {
        const expanded = expandBoundsToIncludePoint(
          BAGO_CITY_BOUNDS,
          [lng, lat],
          0.05
        );
        map.current.setMaxBounds(expanded);
        toast.info(
          "You’re outside Bago. Temporarily expanded bounds to include your location."
        );
      }

      setUserLoc({ lng, lat, acc: safeAcc });
      setUserMarker(lng, lat, safeAcc);
    },
    [lockToBago, setUserMarker]
  );

  const openTagFormForExistingCrop = useCallback(
    (crop) => {
      if (!crop) return;

      const ring = getCropRing(crop);
      if (!ring) return;

      let coords = ring;
      const first = ring[0];
      const last = ring[ring.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) {
        coords = [...ring, first];
      }

      const farmGeometry = {
        type: "Polygon",
        coordinates: [coords],
      };

      const center =
        getCropCenter({ ...crop, coordinates: coords }) || coords[0];

      let avgElevationM =
        crop.avg_elevation_m ??
        crop.avgElevationM ??
        crop.avg_elevation ??
        crop.elevation ??
        null;

      if (avgElevationM == null) {
        const approx = estimateAverageElevation(farmGeometry, map.current);
        if (approx != null) avgElevationM = approx;
      }

      const barangayName =
        crop.farmer_barangay ||
        crop.barangay ||
        (selectedBarangay?.name ?? "");

      setSelectedBarangay((prev) => ({
        ...(prev || {}),
        name: barangayName || prev?.name || "",
        coordinates: center,
      }));

      setNewTagLocation({
        coordinates: coords,
        hectares: crop.estimated_hectares,
        farmGeometry,
        avgElevationM,
        farmerFirstName: crop.farmer_first_name || "",
        farmerLastName: crop.farmer_last_name || "",
        farmerMobile: crop.farmer_mobile || "",
        farmerBarangay: barangayName || "",
        farmerAddress: crop.farmer_address || "",
        tenureId: crop.tenure_id ?? crop.tenure ?? "",
        isAnonymousFarmer:
          crop.is_anonymous_farmer === 1 ||
          crop.is_anonymous_farmer === "1" ||
          crop.is_anonymous_farmer === true,
      });

      setIsTagging(true);
    },
    [selectedBarangay]
  );

  const clearSelection = useCallback(() => {
    if (!map.current) return;

    if (HILITE_ANIM_REF.current) {
      clearInterval(HILITE_ANIM_REF.current);
      HILITE_ANIM_REF.current = null;
    }

    selectedLabelRef.current?.remove();
    selectedLabelRef.current = null;
    selectedHaloRef.current?.remove();
    selectedHaloRef.current = null;

    if (map.current.getLayer(HILITE_FILL)) map.current.removeLayer(HILITE_FILL);
    if (map.current.getLayer(HILITE_LINE)) map.current.removeLayer(HILITE_LINE);
    if (map.current.getSource(HILITE_SRC)) map.current.removeSource(HILITE_SRC);
  }, []);

  const showMarkerChipAndHalo = useCallback(
    (cropId, chipText = "Selected crop", color = "#10B981") => {
      if (!map.current) return;

      selectedLabelRef.current?.remove();
      selectedLabelRef.current = null;
      selectedHaloRef.current?.remove();
      selectedHaloRef.current = null;

      const marker = cropMarkerMapRef.current.get(String(cropId));
      if (!marker) return;
      const at = marker.getLngLat();

      const chip = document.createElement("div");
      chip.className = "chip";
      chip.textContent = chipText;
      chip.style.background = color;

      selectedLabelRef.current = new mapboxgl.Marker({
        element: chip,
        anchor: "bottom",
        offset: [0, -42],
      })
        .setLngLat(at)
        .addTo(map.current);

      const haloWrap = document.createElement("div");
      haloWrap.className = "pulse-wrapper";
      const ring = document.createElement("div");
      ring.className = "pulse-ring";
      ring.style.background =
        color === "#9CA3AF"
          ? "rgba(156,163,175,0.35)"
          : "rgba(16,185,129,0.35)";
      ring.style.boxShadow =
        color === "#9CA3AF"
          ? "0 0 0 2px rgba(156,163,175,0.55) inset"
          : "0 0 0 2px rgba(16,185,129,0.55) inset";

      haloWrap.appendChild(ring);

      selectedHaloRef.current = new mapboxgl.Marker({
        element: haloWrap,
        anchor: "center",
      })
        .setLngLat(at)
        .addTo(map.current);

      try {
        marker.togglePopup();
      } catch {}
    },
    []
  );

  const runWhenStyleReady = (cb) => {
    const m = map.current;
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

  const highlightPolygon = useCallback((crop) => {
    if (!map.current || !crop) return;

    const harvested = isCropHarvested(crop);
    const color = harvested ? "#9CA3AF" : "#10B981";

    runWhenStyleReady(() => {
      const ring = getCropRing(crop);
      if (!ring) return;

      let coords = ring;
      const first = ring[0];
      const last = ring[ring.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) {
        coords = [...ring, first];
      }

      const feature = turf.polygon([coords], {
        id: crop.id,
        crop_name: crop.crop_name,
      });
      const m = map.current;

      if (!m.getSource("selected-crop-highlight-src")) {
        m.addSource("selected-crop-highlight-src", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [feature] },
        });

        m.addLayer({
          id: "selected-crop-highlight-fill",
          type: "fill",
          source: "selected-crop-highlight-src",
          paint: { "fill-color": color, "fill-opacity": 0.18 },
        });

        m.addLayer({
          id: "selected-crop-highlight-line",
          type: "line",
          source: "selected-crop-highlight-src",
          paint: {
            "line-color": color,
            "line-width": 1.5,
            "line-opacity": 1,
          },
        });
      } else {
        m.getSource("selected-crop-highlight-src").setData({
          type: "FeatureCollection",
          features: [feature],
        });

        try {
          m.setPaintProperty("selected-crop-highlight-fill", "fill-color", color);
          m.setPaintProperty("selected-crop-highlight-line", "line-color", color);
        } catch {}
      }

      if (HILITE_ANIM_REF.current) {
        clearInterval(HILITE_ANIM_REF.current);
        HILITE_ANIM_REF.current = null;
      }
      let w = 2;
      let dir = +0.4;
      HILITE_ANIM_REF.current = setInterval(() => {
        if (!m.getLayer("selected-crop-highlight-line")) return;
        w += dir;
        if (w >= 4) dir = -0.3;
        if (w <= 1) dir = +0.3;
        try {
          m.setPaintProperty("selected-crop-highlight-line", "line-width", w);
        } catch {}
      }, 80);
    });
  }, []);

  const highlightSelection = useCallback(
    (crop) => {
      if (!map.current || !crop) return;

      const harvested = isCropHarvested(crop);
      const color = harvested ? "#9CA3AF" : "#10B981";

      clearSelection();
      showMarkerChipAndHalo(
        crop.id,
        `${crop.crop_name}${
          crop.variety_name ? ` – ${crop.variety_name}` : ""
        }`,
        color
      );
      highlightPolygon(crop);

      const center = getCropCenter(crop);
      if (center) {
        map.current.flyTo({
          center,
          zoom: Math.max(map.current.getZoom(), 16),
          essential: true,
        });
      }
    },
    [clearSelection, showMarkerChipAndHalo, highlightPolygon]
  );

  const ensureDeepLinkSelection = useCallback(() => {
    if (!map.current) return;
    if (!target.cropId) return;
    if (!sidebarCrops.length) return;

    const hit = sidebarCrops.find((c) => String(c.id) === String(target.cropId));
    if (!hit) return;

    setSelectedCrop(hit);
    setIsSidebarVisible(true);
    highlightSelection(hit);

    const center = getCropCenter(hit);
    if (center) {
      map.current.flyTo({
        center,
        zoom: target.zoom ?? 17,
        essential: true,
      });
    }
    hasDeepLinkedRef.current = true;
  }, [sidebarCrops, target.cropId, target.zoom, highlightSelection]);

  // Radius layers + drawing
  const RADIUS_SRC = "calamity-radius-src";
  const RADIUS_FILL = "calamity-radius-fill";
  const RADIUS_OUTLINE = "calamity-radius-outline";

  // Saved calamity radii (from database)
  const SAVED_CALAMITY_SRC = "saved-calamity-radius-src";
  const SAVED_CALAMITY_FILL = "saved-calamity-radius-fill";
  const SAVED_CALAMITY_OUTLINE = "saved-calamity-radius-outline";
    // Concentric severity bands inside the radius
  const RADIUS_BANDS_SRC = "calamity-radius-bands-src";
  const RADIUS_BANDS_FILL = "calamity-radius-bands-fill";


 const ensureRadiusLayers = useCallback(() => {
  if (!map.current) return;
  const m = map.current;

  // GeoJSON source for the "active" radius
  if (!m.getSource(RADIUS_SRC)) {
    m.addSource(RADIUS_SRC, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
  }

  // Soft translucent fill
  if (!m.getLayer(RADIUS_FILL)) {
    m.addLayer({
      id: RADIUS_FILL,
      type: "fill",
      source: RADIUS_SRC,
      paint: {
        // very soft red, we keep opacity at 1 because alpha is in the rgba()
        "fill-color": "rgba(239,68,68,0.08)", // red-500 @ 8%
        "fill-outline-color": "rgba(248,113,113,0.9)", // red-400 outline
        "fill-opacity": 1,
      },
    });
  }

  // Clean dashed outline
  if (!m.getLayer(RADIUS_OUTLINE)) {
    m.addLayer({
      id: RADIUS_OUTLINE,
      type: "line",
      source: RADIUS_SRC,
      paint: {
        "line-color": "rgba(248,113,113,0.95)", // red-400
        "line-width": 2.5,
        "line-dasharray": [2, 1.5],             // dashed ring
        "line-blur": 0.2,
      },
    });
  }
}, []);


const ensureSavedCalamityLayers = useCallback(() => {
  if (!map.current) return;
  const m = map.current;

  if (!m.getSource(SAVED_CALAMITY_SRC)) {
    m.addSource(SAVED_CALAMITY_SRC, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
  }

  // Subtle orange disks for saved calamities
  if (!m.getLayer(SAVED_CALAMITY_FILL)) {
    m.addLayer({
      id: SAVED_CALAMITY_FILL,
      type: "fill",
      source: SAVED_CALAMITY_SRC,
      paint: {
        "fill-color": "rgba(249,115,22,0.10)",   // orange-500 @ 10%
        "fill-outline-color": "rgba(249,115,22,0.9)",
        "fill-opacity": 1,
      },
    });
  }

  // Orange dashed outline so saved radii are distinguishable
  if (!m.getLayer(SAVED_CALAMITY_OUTLINE)) {
    m.addLayer({
      id: SAVED_CALAMITY_OUTLINE,
      type: "line",
      source: SAVED_CALAMITY_SRC,
      paint: {
        "line-color": "rgba(249,115,22,0.95)",   // orange-500
        "line-width": 2,
        "line-dasharray": [3, 2],
        "line-opacity": 0.9,
      },
    });
  }
}, []);


    const ensureRadiusBandsLayers = useCallback(() => {
  if (!map.current) return;
  const m = map.current;

  if (!m.getSource(RADIUS_BANDS_SRC)) {
    m.addSource(RADIUS_BANDS_SRC, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
  }

  if (!m.getLayer(RADIUS_BANDS_FILL)) {
    m.addLayer({
      id: RADIUS_BANDS_FILL,
      type: "fill",
      source: RADIUS_BANDS_SRC,
      paint: {
        // Pastel, semi-transparent rings from center → outside
        "fill-color": [
          "match",
          ["get", "band"],
          "severe",
          "rgba(239,68,68,0.35)",   // red-500
          "high",
          "rgba(249,115,22,0.28)",  // orange-500
          "moderate",
          "rgba(250,204,21,0.22)",  // yellow-400
          "low",
          "rgba(187,247,208,0.18)", // green-100
          "rgba(0,0,0,0)",
        ],
        "fill-opacity": 0.6,
      },
    });
  }
}, []);

const setActiveCalamityFromFeature = useCallback(
  (feature) => {
    if (!feature) return;
    const props = feature.properties || {};

    const center = [Number(props.center_lng), Number(props.center_lat)];
    const rMeters = Number(props.radius_meters);
    if (
      !Number.isFinite(center[0]) ||
      !Number.isFinite(center[1]) ||
      !Number.isFinite(rMeters)
    ) {
      return;
    }

    const idNum = Number(props.id);

    setActiveCalamityId(idNum);
    setActiveCalamity(props);
    setRadiusCenter(center);
    setRadiusMeters(rMeters);

    // 🔴 NEW: clear selectedCrop if it’s outside this radius
    setSelectedCrop((prev) => {
      if (!prev) return prev;
      const cCenter = getCropCenter(prev);
      if (!cCenter) return null;

      const dKm = turf.distance(cCenter, center, { units: "kilometers" });
      const dMeters = dKm * 1000;
      if (dMeters > rMeters) {
        return null; // outside → deselect
      }
      return prev; // still inside → keep
    });
  },
  [setRadiusCenter, setRadiusMeters]
);


  const loadSavedCalamityRadii = useCallback(async () => {
    if (!map.current) return;

    try {
      const res = await axios.get("http://localhost:5000/api/calamityradius");
      const rows = Array.isArray(res.data) ? res.data : [];

      ensureSavedCalamityLayers();

      const features = rows
        .filter(
          (row) =>
            row.center_lng != null &&
            row.center_lat != null &&
            row.radius_meters != null
        )
        .map((row) => {
          const center = [Number(row.center_lng), Number(row.center_lat)];
          const radiusKm = Number(row.radius_meters) / 1000;

          const circle = turf.circle(center, radiusKm, {
            steps: 80,
            units: "kilometers",
          });

          circle.properties = {
            id: row.id,
            name: row.name,
            type: row.type,
            description: row.description,
            center_lng: row.center_lng,
            center_lat: row.center_lat,
            radius_meters: row.radius_meters,
            started_at: row.started_at,
            ended_at: row.ended_at,
          };

          return circle;
        });

      const fc = {
        type: "FeatureCollection",
        features,
      };

     // after you build `features` and `fc`:
map.current.getSource(SAVED_CALAMITY_SRC).setData(fc);

// choose one feature as the default active calamity
if (features.length) {
  // example: pick highest id as latest; adjust if your API already sorts
  const latest = features.reduce((best, f) => {
    const id = Number(f.properties?.id) || 0;
    const bestId = Number(best?.properties?.id) || 0;
    return id > bestId ? f : best;
  }, features[0]);

  setActiveCalamityFromFeature(latest);
}


    } catch (err) {
      console.error("Failed to load calamity radii:", err);
      toast.error("Failed to load saved calamity areas");
    }
  }, [ensureSavedCalamityLayers, setRadiusCenter, setRadiusMeters, setActiveCalamityFromFeature,]);


// FINAL radius: dashed outline + 4 severity bands (no extra solid fill)
const updateRadiusCircle = useCallback(
  (centerLngLat, radiusM) => {
    if (!map.current || !centerLngLat || !radiusM) return;

    const m = map.current;
    const radiusKm = radiusM / 1000;

    ensureRadiusLayers();
    ensureRadiusBandsLayers();

    // main outline circle
    const circle = turf.circle(centerLngLat, radiusKm, {
      steps: 80,
      units: "kilometers",
    });

    const circleFC = {
      type: "FeatureCollection",
      features: [circle],
    };

    // cache + apply
    radiusGeoRef.current = circleFC;
    m.getSource(RADIUS_SRC).setData(circleFC);

    // hide base fill – we only want dashed outline + bands
    try {
      m.setPaintProperty(RADIUS_FILL, "fill-color", "rgba(0,0,0,0)");
      m.setPaintProperty(RADIUS_FILL, "fill-opacity", 0);
    } catch {}

    const r = radiusKm;
    if (!Number.isFinite(r) || r <= 0) {
      const emptyFC = { type: "FeatureCollection", features: [] };
      radiusBandsGeoRef.current = emptyFC;
      if (m.getSource(RADIUS_BANDS_SRC)) {
        m.getSource(RADIUS_BANDS_SRC).setData(emptyFC);
      }
      return;
    }

    const makeBand = (outerKm, bandName) => {
      const outer = turf.circle(centerLngLat, outerKm, {
        steps: 80,
        units: "kilometers",
      });
      outer.properties = { band: bandName };
      return outer;
    };

    const low = makeBand(r, "low");
    const moderate = makeBand(r * 0.75, "moderate");
    const high = makeBand(r * 0.5, "high");
    const severe = makeBand(r * 0.25, "severe");

    const bandsFC = {
      type: "FeatureCollection",
      features: [low, moderate, high, severe],
    };

    radiusBandsGeoRef.current = bandsFC;
    m.getSource(RADIUS_BANDS_SRC).setData(bandsFC);
  },q
  [ensureRadiusLayers, ensureRadiusBandsLayers]
);



// Plain circle used ONLY while drawing (no severity bands yet)
const updatePlainRadiusCircle = useCallback(
  (centerLngLat, radiusM) => {
    if (!map.current || !centerLngLat || !radiusM) return;

    const m = map.current;
    const radiusKm = radiusM / 1000;

    // ensure main radius layers exist
    ensureRadiusLayers();

    const circle = turf.circle(centerLngLat, radiusKm, {
      steps: 80,
      units: "kilometers",
    });

    // update main radius source
    m.getSource(RADIUS_SRC).setData({
      type: "FeatureCollection",
      features: [circle],
    });

    // show soft red fill while drawing
    try {
      m.setPaintProperty(
        RADIUS_FILL,
        "fill-color",
        "rgba(239,68,68,0.15)" // red-500 @ 15%
      );
      m.setPaintProperty(RADIUS_FILL, "fill-opacity", 1);
    } catch {}

    // clear severity bands while drawing
    if (m.getSource(RADIUS_BANDS_SRC)) {
      m.getSource(RADIUS_BANDS_SRC).setData({
        type: "FeatureCollection",
        features: [],
      });
    }
  },
  [ensureRadiusLayers]
);


 const handleRadiusMouseDown = useCallback(
  (e) => {
    if (!isDrawingRadiusRef.current || !map.current) return;
    e.preventDefault();
    const center = [e.lngLat.lng, e.lngLat.lat];
    dragActiveRef.current = true;
    dragCenterRef.current = center;
    setRadiusCenter(center);
    setRadiusMeters(0);

    // plain circle while starting the drag
    updatePlainRadiusCircle(center, 1);
  },
  [updatePlainRadiusCircle, setRadiusCenter, setRadiusMeters]
);

 const handleRadiusMouseMove = useCallback(
  (e) => {
    if (!dragActiveRef.current || !dragCenterRef.current || !map.current)
      return;
    const center = dragCenterRef.current;
    const current = [e.lngLat.lng, e.lngLat.lat];
    const distKm = turf.distance(center, current, { units: "kilometers" });
    const meters = distKm * 1000;
    setRadiusMeters(meters);

    // still drawing → plain circle only
    updatePlainRadiusCircle(center, meters);
  },
  [updatePlainRadiusCircle, setRadiusMeters]
);

  const handleRadiusMouseUp = useCallback(() => {
    if (!dragActiveRef.current) return;
    dragActiveRef.current = false;
    isDrawingRadiusRef.current = false;
    setIsDrawingRadius(false);

    setShowCalamityForm(true);
  }, []);

 const handleDeleteActiveCalamity = useCallback(async () => {
  if (!activeCalamityId) {
    toast.error("No active calamity radius selected.");
    return;
  }

  const confirmed = window.confirm(
    "Delete this calamity radius and all linked damage records/photos?"
  );
  if (!confirmed) return;

  try {
    // 1) Delete from backend
    await axios.delete(
      `http://localhost:5000/api/calamityradius/${activeCalamityId}`
    );

    toast.success("Calamity radius deleted.");

    // 2) Clear active radius state
    setActiveCalamityId(null);
    setActiveCalamity(null);
    setRadiusCenter(null);
    setRadiusMeters(null);
    radiusCenterRef.current = null;
    radiusMetersRef.current = null;

    // 3) Remove radius graphics from the map
    if (map.current) {
      const m = map.current;
      try {
        if (m.getSource(RADIUS_SRC)) {
          m.getSource(RADIUS_SRC).setData({
            type: "FeatureCollection",
            features: [],
          });
        }
        if (m.getSource(RADIUS_BANDS_SRC)) {
          m.getSource(RADIUS_BANDS_SRC).setData({
            type: "FeatureCollection",
            features: [],
          });
        }
      } catch (e) {
        console.warn("Failed to clear radius layers after delete:", e);
      }
    }

    // 4) Clear resolved crop tracking so polygons + markers reappear
    setResolvedCropIds([]);
    try {
      localStorage.removeItem("agri_resolved_crop_ids");
    } catch (e) {
      console.warn("Failed to clear resolved crop IDs from storage:", e);
    }

    // 5) Reload base crop polygons and markers (now without any resolved filter)
    await loadPolygons();
    if (areMarkersVisible) {
      await renderSavedMarkers();
    }

    // 6) Reload remaining saved calamity radii (orange disks), if any
    await loadSavedCalamityRadii();
  } catch (err) {
    console.error("Failed to delete calamity radius:", err);
    const msg =
      err?.response?.data?.message ||
      err?.message ||
      "Failed to delete calamity radius.";
    toast.error(msg);
  }
}, [
  activeCalamityId,
  areMarkersVisible,
  loadPolygons,
  renderSavedMarkers,
  loadSavedCalamityRadii,
]);


   const handleSaveCalamityRadius = useCallback(async () => {
    try {
      if (!radiusCenter || !radiusMeters) {
        toast.error("Draw a radius first.");
        return;
      }
      if (!calamityName.trim()) {
        toast.error("Please enter a calamity name.");
        return;
      }

      const adminId = localStorage.getItem("user_id");

      const res = await axios.post("http://localhost:5000/api/calamityradius", {
        name: calamityName.trim(),
        type: calamityType.trim() || null,
        description: calamityDescription.trim() || null,
        center_lng: radiusCenter[0],
        center_lat: radiusCenter[1],
        radius_meters: Math.round(radiusMeters),
        started_at: calamityDate || null,
        admin_id: adminId || null,
      });

      toast.success("Calamity radius saved.");

      // reload all saved calamities (orange circles)
      await loadSavedCalamityRadii();

      // mark the just-saved calamity as active
      if (res.data?.id) {
        const idNum = Number(res.data.id);
        setActiveCalamityId(idNum);
        setActiveCalamity({
          id: idNum,
          name: calamityName.trim(),
          type: calamityType.trim() || null,
          description: calamityDescription.trim() || null,
          center_lng: radiusCenter[0],
          center_lat: radiusCenter[1],
          radius_meters: Math.round(radiusMeters),
          started_at: calamityDate || null,
        });
      }

      // reset form fields only
      setCalamityName("");
      setCalamityType("");
      setCalamityDescription("");
      setCalamityDate(new Date().toISOString().slice(0, 10));
      setShowCalamityForm(false);

      // IMPORTANT:
      // do NOT clear radiusCenter / radiusMeters or the RADIUS_SRC source.
      // We stay in "view" mode so the multi-band circle remains on the map.
      isDrawingRadiusRef.current = false;
      setIsDrawingRadius(false);
    } catch (err) {
      console.error("Failed to save calamity radius:", err);
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err.message ||
        "Failed to save calamity radius.";
      toast.error(msg);
    }
  }, [
    radiusCenter,
    radiusMeters,
    calamityName,
    calamityType,
    calamityDescription,
    calamityDate,
    loadSavedCalamityRadii,
  ]);

  // ✅ Force-reapply the currently active radius (outline + bands) after any re-render / data refresh
const reapplyActiveRadius = useCallback(() => {
  const m = map.current;
  const c = radiusCenterRef.current;
  const r = radiusMetersRef.current;

  if (!m || !c || !r) return;

  // Ensure layers exist, then redraw using the last known values
  runWhenStyleReady(() => {
    ensureRadiusLayers();
    ensureRadiusBandsLayers();
    updateRadiusCircle(c, r);
  });
}, [ensureRadiusLayers, ensureRadiusBandsLayers, updateRadiusCircle]);

  // 🔴 photo upload handler (crop + calamity)
  const handleDamagePhotoUpload = useCallback(
    async (file) => {
      if (!file) return;
      if (!selectedCrop) {
        toast.error("Select a crop first.");
        return;
      }
      if (!activeCalamityId) {
        toast.error("Click an orange calamity circle first.");
        return;
      }
      if (
      !selectedCropDamage ||
      selectedCropDamage.level === "outside" ||
      selectedCropDamage.damageFraction <= 0
    ) {
      toast.error("This field is outside the active calamity radius.");
      return;
    }

      try {
        setIsUploadingDamagePhoto(true);

        const formData = new FormData();
        formData.append("photo", file);
        formData.append("crop_id", selectedCrop.id);
        formData.append(
          "caption",
          `Damage proof for ${selectedCrop.crop_name || "crop"}`
        );

        await axios.post(
          `http://localhost:5000/api/calamityradius/${activeCalamityId}/photo`,
          formData,
          {
            headers: { "Content-Type": "multipart/form-data" },
          }
        );

        toast.success("Damage photo uploaded.");
      } catch (err) {
        console.error(err);
        toast.error(
          err?.response?.data?.message || "Failed to upload damage photo."
        );
      } finally {
        setIsUploadingDamagePhoto(false);
      }
    },
    [selectedCrop, activeCalamityId]
  );

  // 🔴 save impact handler (crop + calamity)
  const handleSaveDamageImpact = useCallback(async () => {
    if (!selectedCrop) {
      toast.error("Select a crop first.");
      return;
    }
    if (!activeCalamityId) {
      toast.error("Click an orange calamity circle first.");
      return;
    }
    if (!selectedCropDamage) {
      toast.error("No damage data to save.");
      return;
    }
 if (
    !selectedCropDamage ||
    selectedCropDamage.level === "outside" ||
    selectedCropDamage.damageFraction <= 0
  ) {
    toast.error("This field is outside the active calamity radius.");
    return;
  }
    try {
      setIsSavingImpact(true);

      await axios.post(
        `http://localhost:5000/api/calamityradius/${activeCalamityId}/impact`,
        {
          crop_id: selectedCrop.id,
          severity: selectedCropDamage.severity,
          level: selectedCropDamage.level,
          distance_meters: selectedCropDamage.distanceMeters,
          damage_fraction: selectedCropDamage.damageFraction,
          damaged_area_ha: selectedCropDamage.damagedAreaHa,
          damaged_volume: selectedCropDamage.damagedVolume,
          loss_value_php: selectedCropDamage.lossValueMid,
          base_area_ha: primaryHectares,
          base_volume: primaryVolume,
          base_unit: primaryUnit,
        }
      );

      toast.success("Damage assessment saved.");
    } catch (err) {
      console.error(err);
      toast.error(
        err?.response?.data?.message || "Failed to save damage assessment."
      );
    } finally {
      setIsSavingImpact(false);
    }
  }, [
    selectedCrop,
    activeCalamityId,
    selectedCropDamage,
    primaryHectares,
    primaryVolume,
    primaryUnit,
  ]);

  // 🔁 Load resolved crop IDs from localStorage on first mount
useEffect(() => {
  try {
    const raw = localStorage.getItem("agri_resolved_crop_ids");
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      // Normalize to string IDs, avoid duplicates
      const unique = Array.from(
        new Set(parsed.map((id) => String(id)))
      );
      setResolvedCropIds(unique);
    }
  } catch (e) {
    console.warn("Failed to load resolved crop IDs from localStorage:", e);
  }
}, []);


  useEffect(() => {
  if (!map.current) return;

  // While dragging, we only want the plain circle (no bands yet)
  if (isDrawingRadiusRef.current) return;

  const m = map.current;

  if (!radiusCenter || !radiusMeters) {
    // clear drawn circle + bands when radius is cleared
    if (m.getSource(RADIUS_SRC)) {
      m.getSource(RADIUS_SRC).setData({
        type: "FeatureCollection",
        features: [],
      });
    }
    if (m.getSource(RADIUS_BANDS_SRC)) {
      m.getSource(RADIUS_BANDS_SRC).setData({
        type: "FeatureCollection",
        features: [],
      });
    }
    return;
  }

  // Finished drawing → circle + severity bands
  updateRadiusCircle(radiusCenter, radiusMeters);
}, [radiusCenter, radiusMeters, updateRadiusCircle]);

// ✅ When resolving a crop triggers marker/polygon refresh, keep radius visible
useEffect(() => {
  reapplyActiveRadius();
}, [resolvedCropIds, reapplyActiveRadius]);


  // fetch backend crop history for selected crop
  useEffect(() => {
    if (!selectedCrop) {
      setSelectedCropHistory([]);
      return;
    }

    let cancelled = false;

    const fetchHistory = async () => {
      try {
        const res = await axios.get(
          `http://localhost:5000/api/crops/${selectedCrop.id}/history`
        );
        if (!cancelled) {
          const rows = Array.isArray(res.data) ? res.data : [];
          const cleaned = rows.filter((r) => !isSoftDeletedCrop(r));
          setSelectedCropHistory(cleaned);
        }
      } catch (err) {
        console.error("Failed to fetch crop history:", err);
        if (!cancelled) setSelectedCropHistory([]);
      }
    };

    fetchHistory();
    return () => {
      cancelled = true;
    };
  }, [selectedCrop]);

  // 🔁 Whenever Mapbox reloads style/layers, reapply last radius + bands
useEffect(() => {
  if (!map.current) return;
  const m = map.current;

  const reapplyRadius = () => {
    if (!radiusCenterRef.current || !radiusMetersRef.current) return;

    ensureRadiusLayers();
    ensureRadiusBandsLayers();

    // main circle
    if (radiusGeoRef.current && m.getSource(RADIUS_SRC)) {
      try {
        m.getSource(RADIUS_SRC).setData(radiusGeoRef.current);
      } catch {}
    } else {
      updateRadiusCircle(radiusCenterRef.current, radiusMetersRef.current);
    }

    // bands
    if (radiusBandsGeoRef.current && m.getSource(RADIUS_BANDS_SRC)) {
      try {
        m.getSource(RADIUS_BANDS_SRC).setData(radiusBandsGeoRef.current);
      } catch {}
    }
  };

  // styledata fires after style / layers are refreshed
  m.on("styledata", reapplyRadius);
  return () => m.off("styledata", reapplyRadius);
}, [ensureRadiusLayers, ensureRadiusBandsLayers, updateRadiusCircle]);


  // init map
  useEffect(() => {
    if (!map.current) {
      const m = new mapboxgl.Map({
        container: mapContainer.current,
        style: mapStyle,
        center: [122.9616, 10.5074],
        zoom: 7,
      });
      map.current = m;
      if (lockToBago) m.setMaxBounds(BAGO_CITY_BOUNDS);

      axios
        .get("http://localhost:5000/api/crops/types")
        .then((res) => setCropTypes(res.data));

      m.addControl(new mapboxgl.NavigationControl(), "bottom-right");

      m.on("mousedown", handleRadiusMouseDown);
      m.on("mousemove", handleRadiusMouseMove);
      m.on("mouseup", handleRadiusMouseUp);
      m.on("mouseleave", handleRadiusMouseUp);

     

      m.on("load", async () => {
        ensureTerrain();

        if (!directionsRef.current && isDirectionsVisible) {
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
        } catch (err) {
          console.error("Failed to load polygons:", err);
        }

        ensureUserAccuracyLayers();
        ensureBarangayLayers();
        ensureRadiusLayers();
        ensureSavedCalamityLayers();
        await renderSavedMarkers();
        await loadSavedCalamityRadii();
        // Clicking any orange calamity circle should make it active
m.on("click", SAVED_CALAMITY_FILL, (e) => {
  const feat = e.features && e.features[0];
  if (!feat) return;
  setActiveCalamityFromFeature(feat);
});

m.on("click", SAVED_CALAMITY_OUTLINE, (e) => {
  const feat = e.features && e.features[0];
  if (!feat) return;
  setActiveCalamityFromFeature(feat);
});

// Optional: show pointer cursor on hover
m.on("mouseenter", SAVED_CALAMITY_FILL, () => {
  m.getCanvas().style.cursor = "pointer";
});
m.on("mouseleave", SAVED_CALAMITY_FILL, () => {
  m.getCanvas().style.cursor = "";
});
m.on("mouseenter", SAVED_CALAMITY_OUTLINE, () => {
  m.getCanvas().style.cursor = "pointer";
});
m.on("mouseleave", SAVED_CALAMITY_OUTLINE, () => {
  m.getCanvas().style.cursor = "";
});


        if (!hasDeepLinkedRef.current) {
          let focus = null;

          if (target.cropId && sidebarCrops.length) {
            const hit = sidebarCrops.find(
              (c) => String(c.id) === String(target.cropId)
            );
            if (hit) {
              setSelectedCrop(hit);
              highlightSelection(hit);
              setIsSidebarVisible(true);
              focus = getCropCenter(hit);
            }
          }

          if (
            !focus &&
            Number.isFinite(target.lat) &&
            Number.isFinite(target.lng)
          ) {
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

      m.on("click", "crop-polygons-layer", (e) => {
        const feature = e.features[0];
        const cropId = feature.properties?.id;
        if (!cropId) return;
        const cropData = sidebarCrops.find(
          (c) => String(c.id) === String(cropId)
        );
        if (cropData && !isSoftDeletedCrop(cropData)) {
          setSelectedCrop(cropData);
          highlightSelection(cropData);
          setIsSidebarVisible(true);
        }
      });

     
    } else {
      map.current.setStyle(mapStyle);
      map.current.once("style.load", async () => {
        ensureTerrain();

        ensureUserAccuracyLayers();
        ensureBarangayLayers();
        ensureRadiusLayers();
        ensureSavedCalamityLayers();
          ensureRadiusBandsLayers();

        if (userLoc) {
          updateUserAccuracyCircle(userLoc.lng, userLoc.lat, userLoc.acc);
          if (userMarkerRef.current)
            userMarkerRef.current
              .setLngLat([userLoc.lng, userLoc.lat])
              .addTo(map.current);
          if (typeof headingDeg === "number" && userMarkerElRef.current) {
            userMarkerElRef.current.style.transform = `rotate(${headingDeg}deg)`;
          }
        }
        await loadPolygons();
        await renderSavedMarkers();
        await loadSavedCalamityRadii();
        if (selectedCrop) {
          highlightSelection(selectedCrop);
        } else if (!hasDeepLinkedRef.current) {
          let focus = null;
          if (target.cropId && sidebarCrops.length) {
            const hit = sidebarCrops.find(
              (c) => String(c.id) === String(target.cropId)
            );
            if (hit) {
              setSelectedCrop(hit);
              highlightSelection(hit);
              setIsSidebarVisible(true);
              focus = getCropCenter(hit);
            }
          }
          if (
            !focus &&
            Number.isFinite(target.lat) &&
            Number.isFinite(target.lng)
          ) {
            focus = [target.lng, target.lat];
          }
          if (focus) {
            hasDeepLinkedRef.current = true;
            map.current.flyTo({
              center: focus,
              zoom: target.zoom,
              essential: true,
            });
          }
        }
        ensureDeepLinkSelection();
      });
    }
  }, [
    mapStyle,
    lockToBago,
    ensureUserAccuracyLayers,
    ensureBarangayLayers,
    ensureTerrain,
    renderSavedMarkers,
    loadPolygons,
    highlightSelection,
    handleRadiusMouseDown,
    handleRadiusMouseMove,
    handleRadiusMouseUp,
    ensureRadiusLayers,
    ensureSavedCalamityLayers,
    loadSavedCalamityRadii,
  ]);

   useEffect(() => {
  if (!map.current) return;
  if (!radiusCenter || !radiusMeters) return;

  const m = map.current;
  const canvas = m.getCanvas();
  if (!canvas) return;

  const handleCanvasClick = (evt) => {
    const rect = canvas.getBoundingClientRect();
    const x = evt.clientX - rect.left;
    const y = evt.clientY - rect.top;
    const point = [x, y];

    // Distance of click from calamity center
    const lngLat = m.unproject(point);
    const clickCoord = [lngLat.lng, lngLat.lat];

    const dKm = turf.distance(radiusCenter, clickCoord, {
      units: "kilometers",
    });
    const dMeters = dKm * 1000;

    // Outside the radius → let Mapbox / Directions behave normally.
    if (dMeters > radiusMeters) {
      return;
    }
    // Inside the radius: we only care about crop polygons.
    const features = m.queryRenderedFeatures(point, {
      layers: ["crop-polygons-layer"],
    });

    // No crop polygon under click → swallow the click.
    if (!features.length) {
      evt.stopPropagation();
      evt.preventDefault();
      return;
    }

    const cropFeat = features[0];
    const cropId = cropFeat.properties && cropFeat.properties.id;
    if (!cropId) {
      evt.stopPropagation();
      evt.preventDefault();
      return;
    }

    const cropData = sidebarCrops.find(
      (c) => String(c.id) === String(cropId)
    );

    if (cropData && !isSoftDeletedCrop(cropData)) {
      evt.stopPropagation();
      evt.preventDefault();
      setSelectedCrop(cropData);
      highlightSelection(cropData);
      setIsSidebarVisible(true);
    } else {
      evt.stopPropagation();
      evt.preventDefault();
    }
  };

  // capture phase so we run before Mapbox/Directions
  canvas.addEventListener("click", handleCanvasClick, true);

  return () => {
    canvas.removeEventListener("click", handleCanvasClick, true);
  };
}, [
  radiusCenter,
  radiusMeters,
  sidebarCrops,
  highlightSelection,
  setIsSidebarVisible,
]);

useEffect(() => {
  if (!selectedCrop || !selectedCrop.id) {
    setCalamityHistory([]);
    return;
  }

  const fetchHistory = async () => {
    try {
      const res = await axios.get(
        `http://localhost:5000/api/calamityradius/crop/${selectedCrop.id}/history`
      );
      setCalamityHistory(res.data || []);
    } catch (err) {
      console.error("Failed to fetch calamity history:", err);
      setCalamityHistory([]);
    }
  };

  fetchHistory();
}, [selectedCrop]);

useEffect(() => {
  if (!map.current) return;
  const m = map.current;

  const handleMove = (e) => {
    // No active radius → no tooltip
    if (!radiusCenterRef.current || !radiusMetersRef.current) {
      if (radiusHoverPopupRef.current) {
        try {
          radiusHoverPopupRef.current.remove();
        } catch {}
        radiusHoverPopupRef.current = null;
      }
      m.getCanvas().style.cursor = "";
      return;
    }

    // Check what we are hovering – only care about the bands layer
    const features = m.queryRenderedFeatures(e.point, {
      layers: [RADIUS_BANDS_FILL],
    });

    if (!features.length) {
      if (radiusHoverPopupRef.current) {
        try {
          radiusHoverPopupRef.current.remove();
        } catch {}
        radiusHoverPopupRef.current = null;
      }
      m.getCanvas().style.cursor = "";
      return;
    }

    const band = features[0].properties?.band;
    const meta = band && RADIUS_BAND_META[band];
    if (!meta) return;

    m.getCanvas().style.cursor = "pointer";

    // Create popup if needed
    if (!radiusHoverPopupRef.current) {
      radiusHoverPopupRef.current = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 18,
        className: "radius-band-hover-popup",
      }).addTo(m);
    }

    const html = `
      <div style="
        font-family: system-ui, -apple-system, Segoe UI, sans-serif;
        font-size: 11px;
      ">
        <div style="font-weight:600;margin-bottom:2px;">${meta.label}</div>
        <div style="color:#4b5563;">${meta.radiusRange}</div>
        <div style="color:#b91c1c;font-weight:600;margin-top:2px;">
          ≈ ${meta.damagePct}% estimated damage
        </div>
      </div>
    `;

    radiusHoverPopupRef.current.setLngLat(e.lngLat).setHTML(html);
  };

  const handleLeave = () => {
    if (radiusHoverPopupRef.current) {
      try {
        radiusHoverPopupRef.current.remove();
      } catch {}
      radiusHoverPopupRef.current = null;
    }
    m.getCanvas().style.cursor = "";
  };

  m.on("mousemove", handleMove);
  m.on("mouseleave", handleLeave);

  return () => {
    m.off("mousemove", handleMove);
    m.off("mouseleave", handleLeave);
    if (radiusHoverPopupRef.current) {
      try {
        radiusHoverPopupRef.current.remove();
      } catch {}
      radiusHoverPopupRef.current = null;
    }
  };
}, []);


  useEffect(() => {
    if (!hasDeepLinkedRef.current) ensureDeepLinkSelection();
  }, [ensureDeepLinkSelection]);

  useEffect(() => {
  if (!map.current) return;
  if (!areMarkersVisible) return;
  renderSavedMarkers();
}, [
  selectedCropType,
  harvestFilter,
  timelineMode,
  timelineFrom,
  timelineTo,
  areMarkersVisible,
  renderSavedMarkers,
  resolvedCropIds,   // 🔴 add this so markers refresh after resolve
]);


  useEffect(() => {
    if (!map.current) return;
    if (lockToBago) {
      map.current.setMaxBounds(BAGO_CITY_BOUNDS);
    } else {
      map.current.setMaxBounds(null);
    }
  }, [lockToBago]);

  useEffect(() => {
  const applyPolygonFilters = async () => {
    if (!map.current) return;

    try {
      let crops = sidebarCrops;

      if (!crops || !crops.length) {
        const res = await axios.get("http://localhost:5000/api/crops");
        const rows = res.data || [];
        crops = rows.filter((c) => !isSoftDeletedCrop(c));
      } else {
        crops = crops.filter((c) => !isSoftDeletedCrop(c));
      }

      let filtered = [...crops];

      // 🔴 DROP RESOLVED CROPS FROM POLYGONS
      if (resolvedCropIds.length) {
        const resolvedSet = new Set(resolvedCropIds.map((id) => String(id)));
        filtered = filtered.filter((c) => !resolvedSet.has(String(c.id)));
      }

      if (selectedCropType !== "All") {
        filtered = filtered.filter((c) => c.crop_name === selectedCropType);
      }

      if (harvestFilter === "harvested") {
        filtered = filtered.filter((c) => isCropHarvested(c));
      } else if (harvestFilter === "not_harvested") {
        filtered = filtered.filter((c) => !isCropHarvested(c));
      }

      filtered = filtered.filter((c) =>
        passesTimelineFilter(c, timelineMode, timelineFrom, timelineTo)
      );

      await loadPolygons(filtered);
      ensureBarangayLayers();
    } catch (err) {
      console.error("Failed to filter polygons:", err);
    }
  };

  applyPolygonFilters();
}, [
  selectedCropType,
  harvestFilter,
  timelineMode,
  timelineFrom,
  timelineTo,
  sidebarCrops,
  loadPolygons,
  ensureBarangayLayers,
  resolvedCropIds,   // ✅ ALSO IMPORTANT HERE
]);



  useEffect(() => {
    return () => {
      watchStopRef.current?.();
      userMarkerRef.current?.remove();
      compassStopRef.current?.();
      clearSelection();

      if (HILITE_ANIM_REF.current) {
        clearInterval(HILITE_ANIM_REF.current);
        HILITE_ANIM_REF.current = null;
      }

      if (hoverLeaveTimerRef.current) {
        clearTimeout(hoverLeaveTimerRef.current);
        hoverLeaveTimerRef.current = null;
      }

      if (hoverPopupRef.current) {
        try {
          hoverPopupRef.current.remove();
        } catch {}
        hoverPopupRef.current = null;
      }

      if (map.current) {
        try {
          map.current.remove();
        } catch (e) {
          console.warn("Error removing map:", e);
        }
        map.current = null;
      }

      directionsRef.current = null;
    };
  }, [clearSelection]);

  return (
    <div className="relative h-full w-full">
      {/* GPS / toolbar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-white/70 backdrop-blur rounded-xl p-2 shadow-md">
        <IconButton
          title="Locate me"
          active={false}
          onClick={async () => {
            if (!("geolocation" in navigator)) {
              toast.error("Geolocation not supported by this browser.");
              return;
            }
            try {
              const pos = await new Promise((resolve, reject) =>
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                  enableHighAccuracy: true,
                  timeout: 15000,
                  maximumAge: 0,
                })
              );
              const { longitude, latitude, accuracy } = pos.coords;

              const glng = Number(longitude);
              const glat = Number(latitude);

              if (!Number.isFinite(glng) || !Number.isFinite(glat)) {
                console.error(
                  "Invalid GPS coords from browser (once):",
                  pos.coords
                );
                toast.error("Browser returned invalid GPS coordinates.");
                return;
              }

              handleFix(glng, glat, accuracy);
            } catch (e) {
              console.error(e);
              toast.error(explainGeoError(e));
            }
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2a1 1 0 0 1 1 1v1.06A8.004 8.004 0 0 1 19.94 11H21a1 1 0 1 1 0 2h-1.06A8.004 8.004 0 0 1 13 19.94V21a1 1 0 1 1-2 0v-1.06A8.004 8.004 0 0 1 4.06 13H3a1 1 0 1 1 0-2h1.06A8.004 8.004 0 0 1 11 4.06V3a1 1 0 0 1 1-1Zm0 4a6 6 0 1 0 .001 12.001A6 6 0 0 0 12 6Zm0 3.5a2.5 2.5 0 1 1 0 5.001A2.5 2.5 0 0 1 12 9.5Z" />
          </svg>
        </IconButton>

        <IconButton
          title={tracking ? "Stop tracking" : "Start tracking"}
          active={tracking}
          onClick={() => {
            if (!("geolocation" in navigator)) {
              toast.error("Geolocation not supported.");
              return;
            }
            if (!tracking) {
              const stop = startGeoWatch(
                (pos) => {
                  const { longitude, latitude, accuracy, heading } = pos.coords;

                  const glng = Number(longitude);
                  const glat = Number(latitude);

                  if (!Number.isFinite(glng) || !Number.isFinite(glat)) {
                    console.error(
                      "Invalid GPS coords from browser (watch):",
                      pos.coords
                    );
                    return;
                  }

                  handleFix(glng, glat, accuracy);
                  if (typeof heading === "number" && !Number.isNaN(heading)) {
                    setHeadingDeg(heading);
                    if (userMarkerElRef.current)
                      userMarkerElRef.current.style.transform = `rotate(${heading}deg)`;
                    if (rotateMapWithHeading && map.current)
                      map.current.setBearing(heading);
                  }
                },
                (err) => toast.error(explainGeoError(err)),
                { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
              );
              watchStopRef.current = stop;
              setTracking(true);
              toast.success("Live tracking ON");
            } else {
              watchStopRef.current?.();
              watchStopRef.current = null;
              setTracking(false);
              toast.info("Live tracking OFF");
            }
          }}
        >
          {tracking ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 8h3v8H8V8zm5 0h3v8h-3V8z" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7L8 5z" />
            </svg>
          )}
        </IconButton>

        <IconButton
          title={compassOn ? "Stop compass" : "Start compass"}
          active={compassOn}
          onClick={async () => {
            if (!compassOn) {
              try {
                compassStopRef.current = await startCompass((deg) => {
                  setHeadingDeg(deg);
                  if (userMarkerElRef.current)
                    userMarkerElRef.current.style.transform = `rotate(${deg}deg)`;
                  if (rotateMapWithHeading && map.current)
                    map.current.setBearing(deg);
                });
                setCompassOn(true);
                toast.success("Compass ON");
              } catch (e) {
                toast.error(e?.message || "Failed to start compass.");
              }
            } else {
              compassStopRef.current?.();
              compassStopRef.current = null;
              setCompassOn(false);
              toast.info("Compass OFF");
            }
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2a10 10 0 1 0 .001 20.001A10 10 0 0 0 12 2Zm3.7 6.3-2.6 6.5a1 1 0 0 1-.6.6l-6.5 2.6 2.6-6.5Z" />
          </svg>
        </IconButton>

        <IconButton
          title="Follow heading (rotate map)"
          active={rotateMapWithHeading}
          onClick={() => setRotateMapWithHeading((v) => !v)}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2 6 22l6-5 6 5-6-20z" />
          </svg>
        </IconButton>

        <IconButton
          title={lockToBago ? "Unlock map" : "Lock to Bago"}
          active={lockToBago}
          onClick={() => {
            setLockToBago((prev) => {
              const next = !prev;
              if (next) {
                toast.info("Map locked to Bago City boundaries.");
              } else {
                toast.info("Map unlocked. You can pan anywhere.");
              }
              return next;
            });
          }}
        >
          {lockToBago ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17 8h-1V6a4 4 0 1 0-8 0v2H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2Zm-7-2a2 2 0 1 1 4 0v2h-4V6Z" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17 8h-1V6a4 4 0 0 0-7.33-2.4l1.5 1.32A2 2 0 0 1 13 6v2H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2Z" />
            </svg>
          )}
        </IconButton>
      </div>
      {activeCalamityId && (
  <div className="absolute top-4 right-4 z-50 max-w-xs rounded-xl bg-white/90 px-3 py-2 shadow-md border border-red-100">
    <div className="flex items-start justify-between gap-2">
      <div>
        <p className="text-[11px] font-semibold text-red-700 uppercase tracking-wide">
          Active calamity radius
        </p>
        <p className="text-[12px] font-semibold text-gray-900">
          {activeCalamity?.name || "Unnamed calamity"}
        </p>
        <p className="text-[11px] text-gray-500">
          {activeCalamity?.type && <span>{activeCalamity.type}</span>}
          {activeCalamity?.type &&
          (activeCalamity?.started_at || activeCalamity?.radius_meters)
            ? " · "
            : null}
          {activeCalamity?.started_at && (
            <span>
              {new Date(activeCalamity.started_at).toLocaleDateString()}
            </span>
          )}
          {activeCalamity?.radius_meters && (
            <>
              {" · "}
              <span>
                {(Number(activeCalamity.radius_meters) / 1000).toFixed(2)} km
                radius
              </span>
            </>
          )}
        </p>
      </div>

      <button
        type="button"
        onClick={handleDeleteActiveCalamity}
        className="ml-2 text-[11px] font-semibold text-red-600 hover:text-red-700 hover:underline"
      >
        Delete
      </button>
    </div>
  </div>
)}


      {/* Map */}
      <div ref={mapContainer} className="h-full w-full" />

      {selectedCrop && !hideCompareCard && (
        <div className="absolute right-4 top-24 z-40 w-[290px] md:w-[320px]">
          <div className="relative rounded-xl border border-emerald-100 bg-white/95 backdrop-blur px-4 py-3 shadow-md">
            <button
              type="button"
              onClick={() => setHideCompareCard(true)}
              className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-gray-200 text-[11px] font-bold text-gray-700 hover:bg-gray-300"
              title="Hide comparison"
            >
              ×
            </button>

            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
                  Crop overview
                </p>
                {croppingSystemLabel && (
                  <p className="text-[11px] text-gray-500">
                    {croppingSystemLabel}
                  </p>
                )}
              </div>

              {hasPastSeason && hasBothVolumes && (
                <div className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-800">
                  {volumeDeltaPctLabel ?? ""}
                </div>
              )}
            </div>

            {/* current season */}
            <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-2 mb-3">
              <p className="text-[11px] font-semibold text-emerald-900">
                Current season
              </p>
              <p className="text-sm font-semibold text-gray-900">
                {primaryCropName || "—"}
              </p>
              {primaryVarietyName && (
                <p className="text-[11px] text-gray-500">
                  Variety: {primaryVarietyName}
                </p>
              )}

              <div className="mt-2 space-y-1 text-[11px] text-gray-700">               
              </div>

            {/* --- CALAMITY IMPACT + DAMAGE DOC SECTION (clean UI) --- */}
{selectedCropDamage && (
  <div className="mt-3 rounded-lg border border-red-100 bg-red-50/70 px-3 py-2 space-y-2">
    {/* Header: calamity name + pill with severity */}
    <div className="flex items-start justify-between gap-2">
      <div>
        {(activeCalamity || calamityName || calamityType || calamityDate) && (
          <>
            <p className="text-[11px] font-semibold text-red-700">
              {activeCalamity?.name || calamityName || "Calamity"}
            </p>
            <p className="text-[10px] text-gray-600">
              {/* type */}
              {activeCalamity?.type || calamityType ? (
                <span>{activeCalamity?.type || calamityType}</span>
              ) : (
                <span className="italic text-gray-400">Type not set</span>
              )}

              {/* date */}
              {(activeCalamity?.started_at || calamityDate) && (
                <>
                  {" · "}
                  <span>
                    {new Date(
                      activeCalamity?.started_at || calamityDate
                    ).toLocaleDateString()}
                  </span>
                </>
              )}
            </p>
          </>
        )}
      </div>

      <span className="inline-flex items-center rounded-full bg-white px-2 py-[2px] text-[11px] font-semibold text-red-700 shadow-sm">
        {selectedCropDamage.severity} (
        {Math.round(selectedCropDamage.percent)}%)
      </span>
    </div>

    {/* Quick stats: area / volume / loss */}
    <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-gray-700">
      <div className="flex flex-col">
        <span className="text-gray-500">Est. damaged area</span>
        <span className="font-semibold">
          {selectedCropDamage.damagedAreaHa != null
            ? `${formatNum(selectedCropDamage.damagedAreaHa)} ha`
            : "—"}
        </span>
      </div>

      <div className="flex flex-col">
        <span className="text-gray-500">Est. damaged volume</span>
        <span className="font-semibold">
          {selectedCropDamage.damagedVolume != null
            ? `${formatNum(selectedCropDamage.damagedVolume)} ${primaryUnit}`
            : "—"}
        </span>
      </div>

      <div className="flex flex-col col-span-2">
        <span className="text-gray-500">Est. loss value</span>
        <span className="font-semibold text-gray-900">
          {selectedCropDamage?.lossRange?.label || "—"}
        </span>
      </div>
    </div>

        {/* Damage documentation: upload + save in one neat block */}
    <div className="mt-2 rounded-md bg-white/80 px-3 py-2 space-y-2">
      <p className="text-[11px] font-semibold text-gray-800">
        Damage documentation
      </p>
      <p className="text-[11px] text-gray-500">
        Attach a field photo and save this assessment to the calamity report.
      </p>

      {!activeCalamityId && (
        <p className="text-[10px] text-red-500">
          Tip: click an orange calamity circle on the map first.
        </p>
      )}

     {!activeCalamityId && (
  <p className="text-[10px] text-red-500">
    Tip: click an orange calamity circle on the map first.
  </p>
)}

{isCropOutsideRadius && (
  <p className="text-[10px] text-gray-500 mt-1">
    This field is outside the active calamity radius.
    Select a field inside the radius to attach damage documentation.
  </p>
)}

{!isCropOutsideRadius && (
  <div className="mt-1 flex gap-2">
    {/* Upload photo button */}
    <label
      className={`flex-1 inline-flex items-center justify-center px-3 py-1.5 rounded-md text-[11px] font-semibold
                  border border-emerald-600 text-emerald-700 hover:bg-emerald-50
                  ${
                    (!activeCalamityId || isUploadingDamagePhoto) &&
                    "opacity-60 cursor-not-allowed"
                  }`}
    >
      {isUploadingDamagePhoto ? "Uploading..." : "Upload photo"}
      <input
        type="file"
        accept="image/*"
        className="hidden"
        disabled={!activeCalamityId || isUploadingDamagePhoto}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            handleDamagePhotoUpload(file);
            e.target.value = "";
          }
        }}
      />
    </label>

    {/* Save impact button */}
    <button
      type="button"
      onClick={handleSaveDamageImpact}
      disabled={!activeCalamityId || isSavingImpact}
      className="px-3 py-1.5 rounded-md text-[11px] font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {isSavingImpact ? "Saving..." : "Save impact"}
    </button>
  </div>
)}


      

    </div>

  </div>
)}             
            </div>

            {/* past season */}
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <p className="text-[11px] font-semibold text-gray-800">
                Previous season
              </p>

              {hasPastSeason ? (
                <>
                  <p className="text-sm font-semibold text-gray-900">
                    {pastCropName}
                  </p>
                  {pastVarietyName && (
                    <p className="text-[11px] text-gray-500">
                      Variety: {pastVarietyName}
                    </p>
                  )}

                  <div className="mt-2 space-y-1 text-[11px] text-gray-700">
                    <div className="flex justify-between">
                      <span>Area</span>
                      <span className="font-semibold">
                        {pastHectares != null
                          ? `${formatNum(pastHectares)} ha`
                          : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Volume</span>
                      <span className="font-semibold">
                        {pastVolume != null
                          ? `${formatNum(pastVolume)} ${pastUnit}`
                          : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Planted</span>
                      <span className="font-semibold">
                        {pastPlantedDate
                          ? new Date(pastPlantedDate).toLocaleDateString()
                          : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Harvest</span>
                      <span className="font-semibold">
                        {pastHarvestDate
                          ? new Date(pastHarvestDate).toLocaleDateString()
                          : "—"}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <p className="mt-1 text-[11px] text-gray-500">
                  No past season recorded for this field.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Calamity radius save card */}
      <CalamityRadiusForm
        show={showCalamityForm}
        radiusCenter={radiusCenter}
        radiusMeters={radiusMeters}
        calamityName={calamityName}
        calamityType={calamityType}
        calamityDescription={calamityDescription}
        calamityDate={calamityDate}
        onChangeName={setCalamityName}
        onChangeType={setCalamityType}
        onChangeDescription={setCalamityDescription}
        onChangeDate={setCalamityDate}
        onCancel={() => setShowCalamityForm(false)}
        onSave={handleSaveCalamityRadius}
      />

      {/* Radius live label */}
      {radiusMeters != null && radiusCenter && (
 <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 rounded-full bg-white/95 px-3 py-1 shadow text-[11px] text-gray-700 flex flex-col items-center"> 
  Radius: {(radiusMeters / 1000).toFixed(2)} km
        </div>
      )}

      {/* Layers (when sidebar hidden) */}
      {!isSidebarVisible && (
        <button
          onClick={() => setIsSwitcherVisible(!isSwitcherVisible)}
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

      {!isSidebarVisible && isSwitcherVisible && (
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

      {/* Radius draw tool */}
      {!isTagging && (
        <button
          onClick={() => {
            const next = !isDrawingRadius;
            setIsDrawingRadius(next);
            isDrawingRadiusRef.current = next;
            dragCenterRef.current = null;
            dragActiveRef.current = false;

            if (!next) {
              if (map.current && map.current.getSource(RADIUS_SRC)) {
                map.current.getSource(RADIUS_SRC).setData({
                  type: "FeatureCollection",
                  features: [],
                });
              }
              setRadiusMeters(null);
              setRadiusCenter(null);
              setShowCalamityForm(false);
            }
          }}
          className={`absolute bottom-[155px] right-[9px] z-50 border rounded-[5px] w-8 h-8 flex items-center justify-center shadow-[0_0_8px_2px_rgba(0,0,0,0.15)] ${
            isDrawingRadius
              ? "bg-red-500 border-red-600"
              : "bg-white border-gray-300"
          }`}
          title="Draw radius (click & drag)"
        >
          <svg
            viewBox="0 0 24 24"
            className="w-5 h-5"
            fill="none"
            stroke={isDrawingRadius ? "#ffffff" : "#b91c1c"}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="5" fill="#fecaca" />
          </svg>
        </button>
      )}

      {/* Marker toggle */}
      {!isTagging && (
        <button
          onClick={() => {
            if (areMarkersVisible) {
              cropMarkerMapRef.current.forEach((m) => m.remove?.());
              if (hoverLeaveTimerRef.current) {
                clearTimeout(hoverLeaveTimerRef.current);
                hoverLeaveTimerRef.current = null;
              }
              if (hoverPopupRef.current) {
                try {
                  hoverPopupRef.current.remove();
                } catch {}
                hoverPopupRef.current = null;
              }
            } else {
              renderSavedMarkers();
            }
            setAreMarkersVisible(!areMarkersVisible);
            if (!areMarkersVisible) {
              clearSelection();
            }
          }}
          className="absolute bottom-[120px] right-[9px] z-50 bg:white bg-white border border-gray-300 rounded-[5px] w-8 h-8 flex items-center justify-center shadow-[0_0_8px_2px_rgba(0,0,0,0.15)]"
          title={areMarkersVisible ? "Hide Markers" : "Show Markers"}
        >
          <svg
            className="w-5 h-5 text-black"
            fill={!areMarkersVisible ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 21s6-5.686 6-10a6 6 0 10-12 0c0 4.314 6 10 6 10z"
            />
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
          <CalamityImpactSidebar
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
  cropHistory={selectedCropHistory}       
  calamityHistory={calamityHistory}
  selectedCropDamage={selectedCropDamage}
  activeCalamityId={activeCalamityId}
  onResolveCalamityImpact={handleResolveCalamityImpact}  
  resolvingImpact={resolvingImpact}     
  activeImpactRecord={activeImpactRecord}
activeImpactIsResolved={activeImpactIsResolved}                 
  onCropUpdated={(updated) => {
    setSelectedCrop(updated);
    setSidebarCrops((prev) =>
      prev.map((c) => (c.id === updated.id ? updated : c))
    );
    if (isCropHarvested(updated)) {
      setHarvestFilter("harvested");
    }
    renderSavedMarkers();
  }}
/>

        )}
      </div>

      <ToastContainer
        position="top-center"
        autoClose={3000}
        hideProgressBar
        pauseOnHover
        theme="light"
        style={{ zIndex: 9999 }}
      />

      {enlargedImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 z-[9999] flex justify-center items-center"
          onClick={() => setEnlargedImage(null)}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setEnlargedImage(null);
            }}
            className="absolute top-4 right-4 text-white text-2xl font-bold z-[10000] hover:text-red-400"
            title="Close"
          >
            ×
          </button>
          <img
            src={enlargedImage}
            alt="Fullscreen Crop"
            className="max-w-full max-h-full object-contain"
          />
        </div>
      )}
    </div>
  );
};

export default CalamityMap;
