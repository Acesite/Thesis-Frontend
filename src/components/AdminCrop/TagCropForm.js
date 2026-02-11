import React, { useEffect, useRef, useState, useMemo } from "react";
import { SaveIcon, ArrowRight, ArrowLeft } from "lucide-react";

// Turf for spatial checks
import centroid from "@turf/centroid";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import {
  point as turfPoint,
  polygon as turfPolygon,
  multiPolygon as turfMultiPolygon,
} from "@turf/helpers";

/* ---------- CONFIG ---------- */
const STANDARD_MATURITY_DAYS = {
  1: 100, // rice
  2: 110, // corn
  3: 360, // banana
  4: 365, // sugarcane
  5: 300, // cassava
  6: 60, // vegetables
};;

const yieldUnitMap = {
  1: "sacks",
  2: "sacks",
  3: "bunches",
  4: "tons",
  5: "tons",
  6: "kg",
};

const yieldPerHectare = {
  1: 80,
  2: 85.4,
  3: 150,
  4: 80,
  5: 70,
  6: 100,
};

// lookup table for cropping system IDs
const CROPPING_SYSTEMS = {
  1: "Monocrop",
  2: "Intercropped (2 crops)",
  3: "Relay intercropping",
  4: "Strip intercropping",
  5: "Mixed cropping / Polyculture",
};

// matches backend CROPPING_META / CROPPING_SYSTEM_IDS keys
const CROPPING_SYSTEM_KEYS = {
  "1": "monocrop",
  "2": "intercrop",
  "3": "relay",
  "4": "strip",
  "5": "mixed",
};

// Fallback list (used only if `availableBarangays` prop or `barangaysFC` isn’t provided)
const DEFAULT_BARANGAYS = [
  "Abuanan",
  "Alianza",
  "Atipuluan",
  "Bacong",
  "Bagroy",
  "Balingasag",
  "Binubuhan",
  "Busay",
  "Calumangan",
  "Caridad",
  "Dulao",
  "Ilijan",
  "Lag-asan",
  "Mailum",
  "Ma-ao",
  "Malingin",
  "Napoles",
  "Pacol",
  "Poblacion",
  "Sagasa",
  "Tabunan",
  "Taloc",
];

const MAX_PHOTO_MB = 10;
const MAX_PHOTO_COUNT = 10;

function addDaysToISO(dateStr, days) {
  if (!dateStr || !days) return "";
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + Number(days));
  return d.toISOString().slice(0, 10);
}

/* ---------- Farmgate / value estimation (2025) ---------- */

// Default conversion settings (editable in UI)
const DEFAULT_KG_PER_SACK = 50; // dry palay / corn sack assumption
const DEFAULT_KG_PER_BUNCH = 15; // bunch varies; make configurable
const KG_PER_TON = 1000;

function peso(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return x.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function normalizeName(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Single input price => internal range (±spreadPct%)
 * Used to remove Low/High boxes while keeping a min–max estimate.
 */
function singlePriceToRange(price, spreadPct = 10) {
  const p = Number(price);
  if (!Number.isFinite(p) || p <= 0) return null;
  const spread = p * (spreadPct / 100);
  return { low: Math.max(0, p - spread), high: p + spread };
}
function formatUnitPrice(low, high, unit) {
  const lo = Number(low);
  const hi = Number(high);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return "";

  // If low and high are the same (or almost), show only one price
  if (almostEqual(lo, hi)) {
    return `₱${lo.toFixed(0)}/${unit}`;
  }

  // Otherwise show the range
  return `₱${lo.toFixed(0)}–₱${hi.toFixed(0)}/${unit}`;
}

/**
 * Return { low, high, unit:"kg"|"ton", note } OR null if unknown.
 * Prices updated per your provided bases (2025 estimate).
 */
function resolveFarmgateRange(cropTypeId, varietyNameRaw, vegCategoryRaw) {
  const v = normalizeName(varietyNameRaw);
  const veg = normalizeName(vegCategoryRaw);

  // 🍌 BANANA (₱ per kg – 2025 estimate)
  if (String(cropTypeId) === "3") {
    if (v.includes("tinigib"))
      return { low: 70, high: 90, unit: "kg", note: "Banana Tinigib" };
    if (v.includes("lagkitan") || v.includes("lakatan"))
      return {
        low: v.includes("lagkitan") ? 80 : 90,
        high: v.includes("lagkitan") ? 100 : 110,
        unit: "kg",
        note: v.includes("lagkitan")
          ? "Banana Lagkitan"
          : "Banana Lakatan",
      };
    if (v.includes("saba"))
      return { low: 45, high: 55, unit: "kg", note: "Banana Saba" };
    if (v.includes("cavendish"))
      return { low: 120, high: 150, unit: "kg", note: "Banana Cavendish" };

    // fallback banana
    return { low: 70, high: 110, unit: "kg", note: "Banana (fallback range)" };
  }

  // 🍚 RICE (Palay – ₱ per kg, farmgate 2025)
  if (String(cropTypeId) === "1") {
    // (NSIC / Rc varieties usually share the same market price)
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

  // 🌾 CORN (not provided in your bases; keep conservative fallback)
  if (String(cropTypeId) === "2") {
    return { low: 18, high: 22, unit: "kg", note: "Corn (fallback range)" };
  }

  // 🌱 SUGARCANE (₱ per ton, farmgate 2025) — you provided this set
  // Note: You listed “Sugarcane Varieties” with Phil/Co codes; we match by variety text but range is same.
  if (String(cropTypeId) === "4") {
    return { low: 2200, high: 2700, unit: "ton", note: "Sugarcane (₱/ton)" };
  }

  // 🌾 CASSAVA (₱ per kg, fresh root – 2025)
  if (String(cropTypeId) === "5") {
    if (v.includes("ku50") || v.includes("ku 50"))
      return { low: 8, high: 12, unit: "kg", note: "Cassava KU50" };
    if (v.includes("golden yellow"))
      return { low: 8, high: 12, unit: "kg", note: "Cassava Golden Yellow" };
    if (v.includes("rayong 5") || v.includes("rayong5"))
      return { low: 8, high: 12, unit: "kg", note: "Cassava Rayong 5" };
    return { low: 8, high: 12, unit: "kg", note: "Cassava (fallback range)" };
  }

  // 🥬 VEGETABLES (keep your previous general categories)
  if (String(cropTypeId) === "6") {
    if (veg === "leafy")
      return { low: 40, high: 60, unit: "kg", note: "Vegetables (leafy)" };
    if (veg === "fruiting")
      return { low: 35, high: 80, unit: "kg", note: "Vegetables (fruiting)" };
    if (veg === "gourd")
      return { low: 30, high: 60, unit: "kg", note: "Vegetables (gourd crops)" };
    return { low: 30, high: 80, unit: "kg", note: "Vegetables (general fallback)" };
  }

  return null;
}

/**
 * Convert volume (in app unit) → kg, then apply price.
 * If price is per ton, uses ton quantity.
 *
 * Returns:
 * {
 *  valueLow, valueHigh,
 *  qty, qtyUnit,              // qty in kg or ton depending on priceUnit
 *  priceLow, priceHigh, priceUnit,
 *  note
 * }
 */
function computeFarmgateValueRange({
  cropTypeId,
  varietyName,
  vegCategory,
  volume,
  unit, // app yield unit: kg | tons | sacks | bunches
  kgPerSack,
  kgPerBunch,
  userPriceLow,
  userPriceHigh,
}) {
  const vol = Number(volume);
  if (!Number.isFinite(vol) || vol <= 0) return null;

  const baseRange = resolveFarmgateRange(cropTypeId, varietyName, vegCategory);
  if (!baseRange) return null;

  // Allow override using the user's single “desired price” (internally low/high)
  const priceLow = Number(userPriceLow);
  const priceHigh = Number(userPriceHigh);

  const finalPriceLow = Number.isFinite(priceLow) && priceLow > 0 ? priceLow : baseRange.low;
  const finalPriceHigh =
    Number.isFinite(priceHigh) && priceHigh > 0 ? priceHigh : baseRange.high;

  const priceUnit = baseRange.unit; // "kg" or "ton"

  // Convert app volume -> kg
  let kgFactor = 1;
  if (unit === "kg") kgFactor = 1;
  else if (unit === "tons") kgFactor = KG_PER_TON;
  else if (unit === "sacks")
    kgFactor = Math.max(1, Number(kgPerSack) || DEFAULT_KG_PER_SACK);
  else if (unit === "bunches")
    kgFactor = Math.max(1, Number(kgPerBunch) || DEFAULT_KG_PER_BUNCH);

  const kgTotal = vol * kgFactor;

  // Quantity used for pricing
  let qty = kgTotal;
  let qtyUnit = "kg";
  if (priceUnit === "ton") {
    qty = kgTotal / KG_PER_TON;
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
    note: baseRange.note,
  };
}

/* ---------- Geo helpers using your barangay GeoJSON ---------- */
function getBarangayName(props) {
  return props?.Barangay ?? props?.barangay ?? props?.NAME ?? props?.name ?? "";
}

function listBarangayNamesFromFC(barangaysFC) {
  const set = new Set();
  for (const f of barangaysFC?.features || []) {
    const n = getBarangayName(f.properties || {});
    if (n) set.add(String(n));
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
  
}

function exactFromRange(low, high) {
  const lo = Number(low);
  const hi = Number(high);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return null;

  // If they are basically the same, just use that
  if (almostEqual(lo, hi)) return lo;

  // Otherwise use the midpoint (this matches your 1,127,000 example)
  return (lo + hi) / 2;
}


/** Returns { name, feature } if centroid of farmGeometry is inside a barangay polygon */
function detectBarangayFeature(farmGeometry, barangaysFC) {
  if (!farmGeometry || !barangaysFC?.features?.length) return;
  if (!(farmGeometry.type === "Polygon" || farmGeometry.type === "MultiPolygon"))
    return;

  const farmFeature = { type: "Feature", geometry: farmGeometry, properties: {} };
  const c = centroid(farmFeature);
  const p = turfPoint(c.geometry.coordinates);

  for (const f of barangaysFC.features) {
    const g = f.geometry;
    if (!g) continue;

    const poly =
      g.type === "Polygon"
        ? turfPolygon(g.coordinates)
        : g.type === "MultiPolygon"
        ? turfMultiPolygon(g.coordinates)
        : null;

    if (!poly) continue;

    if (booleanPointInPolygon(p, poly)) {
      return {
        name: getBarangayName(f.properties || {}),
        feature: f,
      };
    }
  }
  return;
}

/* ---------- SMALL UI PIECES ---------- */
const Section = ({ title, subtitle, children }) => (
  <div>
    <div className="mb-3">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
    </div>
    {children}
  </div>
);

const Field = ({ label, required, hint, error, children }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1.5">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {children}
    {hint ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}
    {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
  </div>
);

const ErrorText = ({ children }) => (
  <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
    {children}
  </div>
);

const baseInputClasses =
  "w-full rounded-xl px-4 py-3 bg-white text-sm focus:outline-none focus:ring-2";

function decorateClasses(hasError) {
  return hasError
    ? ["border-2 border-red-500 focus:ring-red-500 focus:border-red-500"]
    : ["border-2 border-gray-200 focus:ring-green-600 focus:border-green-600"];
}

const Input = ({ error, className, ...props }) => (
  <input
    {...props}
    className={[baseInputClasses, ...decorateClasses(!!error), className || ""].join(
      " "
    )}
  />
);

const Select = ({ error, className, ...props }) => (
  <select
    {...props}
    className={[baseInputClasses, ...decorateClasses(!!error), className || ""].join(
      " "
    )}
  />
);

const Textarea = ({ error, className, ...props }) => (
  <textarea
    {...props}
    className={[
      baseInputClasses,
      "resize-none",
      ...decorateClasses(!!error),
      className || "",
    ].join(" ")}
  />
);

/** Compact input with right-side unit */
const SuffixInput = ({ suffix, error, inputProps }) => (
  <div className="relative">
    <input
      {...inputProps}
      className={[
        baseInputClasses,
        "pr-12",
        ...decorateClasses(!!error),
        inputProps?.className || "",
      ].join(" ")}
    />
    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 select-none">
      {suffix}
    </span>
  </div>
);

const Pill = ({ color = "emerald", children }) => {
  const colorMap = {
    emerald: {
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      border: "border-emerald-200",
      dot: "bg-emerald-600",
    },
    blue: {
      bg: "bg-blue-50",
      text: "text-blue-700",
      border: "border-blue-200",
      dot: "bg-blue-600",
    },
    gray: {
      bg: "bg-gray-100",
      text: "text-gray-700",
      border: "border-gray-200",
      dot: "bg-gray-500",
    },
  };
  const c = colorMap[color] || colorMap.emerald;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full ${c.bg} ${c.text} border ${c.border}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {children}
    </span>
  );
};

/* ---------- WIZARD STEPS ---------- */
const STEPS = [
  { id: 1, title: "Crop & dates", subtitle: "Crop type, ecosystem, planting" },
  { id: 2, title: "Area & location", subtitle: "Cropping system, area, barangay" },
  { id: 3, title: "Farmer details", subtitle: "Owner / farmer information" },
];

/* ---------- HELPERS ---------- */
function clampPct(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}
function round2(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 100) / 100;
}
function almostEqual(a, b, eps = 0.01) {
  return Math.abs(Number(a) - Number(b)) <= eps;
}

/* ---------- COMPONENT ---------- */
const TagCropForm = ({
  onCancel,
  onSave,
  defaultLocation,
  adminId,

  // full Barangay FeatureCollection
  barangaysFC,

  // drawn/edited farm polygon (GeoJSON Polygon or MultiPolygon)
  farmGeometry,

  // (kept for backward compatibility)
  selectedBarangay, // initial inferred barangay (optional)
  availableBarangays, // array of names (optional; auto-built from barangaysFC if provided)
}) => {
  const formRef = useRef(null);
  const [currentStep, setCurrentStep] = useState(1);

  // Crop
  const [hectares, setHectares] = useState("");
  const [cropTypes, setCropTypes] = useState([]);
  const [selectedCropType, setSelectedCropType] = useState("");
  const [dynamicVarieties, setDynamicVarieties] = useState([]);
  const [selectedVarietyId, setSelectedVarietyId] = useState("");
  const [manualBarangay, setManualBarangay] = useState("");
  const [plantedDate, setPlantedDate] = useState("");
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState(null);

  const [estimatedHarvest, setEstimatedHarvest] = useState("");
  const [harvestTouched, setHarvestTouched] = useState(false);
  const [estimatedVolume, setEstimatedVolume] = useState("");
  const [volumeTouched, setVolumeTouched] = useState(false);

  // Secondary crop yield + area
  const [secondaryEstimatedVolume, setSecondaryEstimatedVolume] = useState("");
  const [secondaryVolumeTouched, setSecondaryVolumeTouched] = useState(false);
  const [secondaryHectares, setSecondaryHectares] = useState("");

  // Intercropping
  const [croppingSystemId, setCroppingSystemId] = useState("1");
  const [isIntercropped, setIsIntercropped] = useState(false);
  const [interCropTypeId, setInterCropTypeId] = useState("");
  const [intercropVarieties, setIntercropVarieties] = useState([]);
  const [intercropVarietyId, setIntercropVarietyId] = useState("");

  // Land usage percentages (main vs secondary)
  const [mainLandPct, setMainLandPct] = useState("100");
  const [secondaryLandPct, setSecondaryLandPct] = useState("0");

  // Relay crop dates (ONLY shown/required in Step 2 when Relay system)
  const [relayPlantedDate, setRelayPlantedDate] = useState("");
  const [relayEstimatedHarvest, setRelayEstimatedHarvest] = useState("");
  const [relayHarvestTouched, setRelayHarvestTouched] = useState(false);

  // Farmer
  const [farmerFirstName, setFarmerFirstName] = useState("");
  const [farmerLastName, setFarmerLastName] = useState("");
  const [farmerMobile, setFarmerMobile] = useState("");
  const [farmerBarangay, setFarmerBarangay] = useState("");
  const [farmerAddress, setFarmerAddress] = useState("");

  // Farmer privacy
  const [isAnonymousFarmer, setIsAnonymousFarmer] = useState(false);

  // Tenure
  const [tenureTypes, setTenureTypes] = useState([]);
  const [selectedTenureId, setSelectedTenureId] = useState("");

  // Ecosystems
  const [ecosystems, setEcosystems] = useState([]);
  const [selectedEcosystem, setSelectedEcosystem] = useState("");

  // Review Modal
  const [showConfirmation, setShowConfirmation] = useState(false);

  // detected barangay feature
  const [detectedBarangayName, setDetectedBarangayName] = useState("");
  const [detectedBarangayFeature, setDetectedBarangayFeature] = useState(null);

  // elevation (meters)
  const [avgElevation, setAvgElevation] = useState("");

  // Farmgate / value estimation UI settings
  const [vegCategoryMain, setVegCategoryMain] = useState(""); // leafy | fruiting | gourd
  const [vegCategorySecondary, setVegCategorySecondary] = useState("");
  const [kgPerSack, setKgPerSack] = useState(String(DEFAULT_KG_PER_SACK));
  const [kgPerBunch, setKgPerBunch] = useState(String(DEFAULT_KG_PER_BUNCH));

  // Single desired price inputs (no low/high boxes)
  const [mainPrice, setMainPrice] = useState("");
  const [secondaryPrice, setSecondaryPrice] = useState("");

  // Errors
  const [errors, setErrors] = useState({});

  /* ---------- DERIVED ---------- */

  // Are we in any intercropping mode?
  const isIntercropMode = useMemo(
    () => croppingSystemId !== "1" || isIntercropped,
    [croppingSystemId, isIntercropped]
  );

  const isRelayMode = useMemo(() => String(croppingSystemId) === "3", [croppingSystemId]);

  // hectares numeric
  const hectaresNum = useMemo(() => {
    const ha = Number(hectares);
    return Number.isFinite(ha) ? ha : 0;
  }, [hectares]);

  const mainLandPctNum = useMemo(() => clampPct(mainLandPct), [mainLandPct]);
  const secondaryLandPctNum = useMemo(
    () => clampPct(secondaryLandPct),
    [secondaryLandPct]
  );

  // computed land usage in hectares
  const mainHectaresUsed = useMemo(() => {
    if (!hectaresNum || hectaresNum <= 0) return 0;
    if (!isIntercropMode) return hectaresNum;
    return round2(hectaresNum * (mainLandPctNum / 100));
  }, [hectaresNum, isIntercropMode, mainLandPctNum]);

  const secondaryHectaresUsed = useMemo(() => {
    if (!hectaresNum || hectaresNum <= 0) return 0;
    if (!isIntercropMode) return 0;
    return round2(hectaresNum * (secondaryLandPctNum / 100));
  }, [hectaresNum, isIntercropMode, secondaryLandPctNum]);

  // Keep secondaryHectares state in sync
  useEffect(() => {
    if (!isIntercropMode) {
      setSecondaryHectares("");
      setMainLandPct("100");
      setSecondaryLandPct("0");
      return;
    }
    if (hectaresNum <= 0) {
      setSecondaryHectares("");
      return;
    }
    setSecondaryHectares(String(secondaryHectaresUsed.toFixed(2)));
  }, [isIntercropMode, hectaresNum, secondaryHectaresUsed]);

  // When switching into intercropped: default 50/50 (only if still at monocrop defaults)
  useEffect(() => {
    if (!isIntercropMode) return;
    const m = clampPct(mainLandPct);
    const s = clampPct(secondaryLandPct);
    const sum = m + s;

    if ((almostEqual(m, 100) && almostEqual(s, 0)) || almostEqual(sum, 0)) {
      setMainLandPct("50");
      setSecondaryLandPct("50");
    } else if (!almostEqual(sum, 100)) {
      const ratio = sum > 0 ? m / sum : 0.5;
      const newM = round2(ratio * 100);
      const newS = round2(100 - newM);
      setMainLandPct(String(newM));
      setSecondaryLandPct(String(newS));
    }
  }, [isIntercropMode]); // intentionally only on toggle

  // Build barangay dropdown list
  const availableFromFC = useMemo(
    () => (barangaysFC ? listBarangayNamesFromFC(barangaysFC) : []),
    [barangaysFC]
  );

  const mergedBarangays = useMemo(() => {
    const base =
      Array.isArray(availableBarangays) && availableBarangays.length
        ? availableBarangays
        : availableFromFC.length
        ? availableFromFC
        : DEFAULT_BARANGAYS;

    const uniq = new Set(base.map((b) => String(b)));
    const inferredTop = (detectedBarangayName || selectedBarangay || "").trim();
    return inferredTop && !uniq.has(inferredTop) ? [inferredTop, ...base] : base;
  }, [availableBarangays, availableFromFC, detectedBarangayName, selectedBarangay]);

  // Prefill farmer details when reusing previous season
  useEffect(() => {
    if (!defaultLocation) return;

    setFarmerFirstName(
      (cur) =>
        cur ||
        defaultLocation.farmerFirstName ||
        defaultLocation.farmer_first_name ||
        ""
    );
    setFarmerLastName(
      (cur) =>
        cur ||
        defaultLocation.farmerLastName ||
        defaultLocation.farmer_last_name ||
        ""
    );
    setFarmerMobile(
      (cur) =>
        cur || defaultLocation.farmerMobile || defaultLocation.farmer_mobile || ""
    );
    setFarmerBarangay(
      (cur) =>
        cur ||
        defaultLocation.farmerBarangay ||
        defaultLocation.farmer_barangay ||
        defaultLocation.barangay ||
        ""
    );
    setFarmerAddress(
      (cur) =>
        cur ||
        defaultLocation.farmerAddress ||
        defaultLocation.farmer_address ||
        defaultLocation.completeAddress ||
        defaultLocation.complete_address ||
        ""
    );

    const tenureRaw =
      defaultLocation.tenureId ??
      defaultLocation.tenure_id ??
      defaultLocation.tenure;
    if (tenureRaw != null && tenureRaw !== "")
      setSelectedTenureId((cur) => cur || String(tenureRaw));

    const anon =
      defaultLocation.isAnonymousFarmer ?? defaultLocation.is_anonymous_farmer;
    if (anon === 1 || anon === "1" || anon === true || anon === "true")
      setIsAnonymousFarmer(true);
  }, [defaultLocation]);

  // Try to detect barangay from farm polygon
  useEffect(() => {
    const res = detectBarangayFeature(farmGeometry, barangaysFC);
    if (res?.name) {
      setDetectedBarangayName(res.name);
      setDetectedBarangayFeature(res.feature || null);

      setManualBarangay((cur) => cur || res.name);
      setFarmerBarangay((cur) => cur || res.name);
    }
  }, [farmGeometry, barangaysFC]);

  // If caller gave an already-inferred barangay, set it (without overwriting user edits)
  useEffect(() => {
    if (selectedBarangay) {
      setManualBarangay((cur) => cur || selectedBarangay);
      setFarmerBarangay((cur) => cur || selectedBarangay);
    }
  }, [selectedBarangay]);

  // If user picks a Location barangay, auto-fill Farmer barangay if still empty
  useEffect(() => {
    if (manualBarangay && !farmerBarangay) setFarmerBarangay(manualBarangay);
  }, [manualBarangay, farmerBarangay]);

  // Load ecosystems for selected crop
  useEffect(() => {
    if (selectedCropType) {
      fetch(`http://localhost:5000/api/crops/ecosystems/${selectedCropType}`)
        .then((res) => res.json())
        .then((data) => setEcosystems(data))
        .catch((err) => console.error("Failed to load ecosystems:", err));
    } else {
      setEcosystems([]);
      setSelectedEcosystem("");
    }
  }, [selectedCropType]);

  const autoHarvestCandidate = useMemo(() => {
    const days = STANDARD_MATURITY_DAYS[selectedCropType] || 0;
    return addDaysToISO(plantedDate, days);
  }, [plantedDate, selectedCropType]);

  // Relay crop auto-harvest candidate (based on relay planted date + secondary crop maturity)
  const autoRelayHarvestCandidate = useMemo(() => {
    const days = STANDARD_MATURITY_DAYS[interCropTypeId] || 0;
    return addDaysToISO(relayPlantedDate, days);
  }, [relayPlantedDate, interCropTypeId]);

  // Main yield auto-calc uses MAIN hectares used (percentage-aware)
  const autoVolumeCandidate = useMemo(() => {
    const yph = yieldPerHectare[selectedCropType];
    const ha = isIntercropMode ? mainHectaresUsed : hectaresNum;
    if (!yph || !Number.isFinite(ha) || ha <= 0) return "";
    return (yph * ha).toFixed(2);
  }, [selectedCropType, hectaresNum, isIntercropMode, mainHectaresUsed]);

  // Secondary yield auto-calc uses SECONDARY hectares used (percentage-aware)
  const secondaryAutoVolumeCandidate = useMemo(() => {
    const yph = yieldPerHectare[interCropTypeId];
    const ha = secondaryHectaresUsed;
    if (!yph || !Number.isFinite(ha) || ha <= 0) return "";
    return (yph * ha).toFixed(2);
  }, [interCropTypeId, secondaryHectaresUsed]);

  useEffect(() => {
    if (!harvestTouched) setEstimatedHarvest(autoHarvestCandidate || "");
  }, [autoHarvestCandidate, harvestTouched]);

  useEffect(() => {
    if (!relayHarvestTouched) setRelayEstimatedHarvest(autoRelayHarvestCandidate || "");
  }, [autoRelayHarvestCandidate, relayHarvestTouched]);

  useEffect(() => {
    if (!volumeTouched) setEstimatedVolume(autoVolumeCandidate || "");
  }, [autoVolumeCandidate, volumeTouched]);

  useEffect(() => {
    if (!secondaryVolumeTouched)
      setSecondaryEstimatedVolume(secondaryAutoVolumeCandidate || "");
  }, [secondaryAutoVolumeCandidate, secondaryVolumeTouched]);

  // Crop types
  useEffect(() => {
    fetch("http://localhost:5000/api/crops/types")
      .then((res) => res.json())
      .then((data) => setCropTypes(data))
      .catch((err) => console.error("Failed to load crop types:", err));
  }, []);

  // Tenure types
  useEffect(() => {
    fetch("http://localhost:5000/api/crops/tenure-types")
      .then((res) => res.json())
      .then((data) => setTenureTypes(data))
      .catch((err) => console.error("Failed to load tenure types:", err));
  }, []);

  // Default hectares from defaultLocation
  useEffect(() => {
    if (defaultLocation?.hectares) setHectares(defaultLocation.hectares);
  }, [defaultLocation]);

  // Default avg elevation
  useEffect(() => {
    if (!defaultLocation) return;
    const raw =
      defaultLocation.avgElevationM ??
      defaultLocation.avgElevation ??
      defaultLocation.elevation;
    const num = Number(raw);
    if (Number.isFinite(num)) setAvgElevation(num.toFixed(1));
  }, [defaultLocation]);

  // varieties for selected crop
  useEffect(() => {
    if (!selectedCropType) {
      setDynamicVarieties([]);
      setSelectedVarietyId("");
      return;
    }
    fetch(`http://localhost:5000/api/crops/varieties/${selectedCropType}`)
      .then((res) => res.json())
      .then((data) => setDynamicVarieties(data))
      .catch((err) => console.error("Failed to load varieties:", err));
  }, [selectedCropType]);

  // varieties for secondary (intercrop) crop
  useEffect(() => {
    if (!interCropTypeId) {
      setIntercropVarieties([]);
      setIntercropVarietyId("");
      return;
    }
    fetch(`http://localhost:5000/api/crops/varieties/${interCropTypeId}`)
      .then((res) => res.json())
      .then((data) => setIntercropVarieties(data))
      .catch((err) => console.error("Failed to load intercrop varieties:", err));
  }, [interCropTypeId]);

  // If crop switches away from Vegetables, clear category
  useEffect(() => {
    if (String(selectedCropType) !== "6") setVegCategoryMain("");
  }, [selectedCropType]);

  useEffect(() => {
    if (String(interCropTypeId) !== "6") setVegCategorySecondary("");
  }, [interCropTypeId]);

  /* ---------- VALUE ESTIMATION (computed) ---------- */

  const mainVarietyName = useMemo(() => {
    const v = dynamicVarieties.find((x) => String(x.id) === String(selectedVarietyId));
    return v?.name || "";
  }, [dynamicVarieties, selectedVarietyId]);

  const secondaryVarietyName = useMemo(() => {
    const v = intercropVarieties.find((x) => String(x.id) === String(intercropVarietyId));
    return v?.name || "";
  }, [intercropVarieties, intercropVarietyId]);

  const mainUnit = yieldUnitMap[selectedCropType] || "units";
  const secondaryUnit = yieldUnitMap[interCropTypeId] || "units";

  // only show the conversion inputs that are actually needed
  const needsKgPerSack = useMemo(
    () => [mainUnit, secondaryUnit].includes("sacks"),
    [mainUnit, secondaryUnit]
  );
  const needsKgPerBunch = useMemo(
    () => [mainUnit, secondaryUnit].includes("bunches"),
    [mainUnit, secondaryUnit]
  );
  const needsKgPerTon = useMemo(
    () => [mainUnit, secondaryUnit].includes("tons"),
    [mainUnit, secondaryUnit]
  );

  const bunchLabel = useMemo(() => {
    const mainIsBanana = String(selectedCropType) === "3";
    const secIsBanana = String(interCropTypeId) === "3";
    if (mainIsBanana || secIsBanana) return "Kg per banana bunchs";
    return "Kg per bunch";
  }, [selectedCropType, interCropTypeId]);

  const conversionSummary = useMemo(() => {
    const parts = [];
    if (needsKgPerSack) parts.push(`Sack=${kgPerSack || DEFAULT_KG_PER_SACK}kg`);
    if (needsKgPerBunch) parts.push(`Bunch=${kgPerBunch || DEFAULT_KG_PER_BUNCH}kg`);
    if (needsKgPerTon) parts.push("Ton=1000kg");
    if (parts.length === 0) return "No conversion (kg-based)";
    return parts.join(", ");
  }, [needsKgPerSack, needsKgPerBunch, needsKgPerTon, kgPerSack, kgPerBunch]);

  // Convert single desired price to internal range (±0% because you want exact desired)
  const mainPriceRange = useMemo(() => singlePriceToRange(mainPrice, 0), [mainPrice]);
  const secondaryPriceRange = useMemo(
    () => singlePriceToRange(secondaryPrice, 0),
    [secondaryPrice]
  );

  const mainFarmgate = useMemo(() => {
    if (!selectedCropType) return null;
    return computeFarmgateValueRange({
      cropTypeId: selectedCropType,
      varietyName: mainVarietyName,
      vegCategory: vegCategoryMain,
      volume: estimatedVolume,
      unit: mainUnit,
      kgPerSack,
      kgPerBunch,
      userPriceLow: mainPriceRange?.low,
      userPriceHigh: mainPriceRange?.high,
    });
  }, [
    selectedCropType,
    mainVarietyName,
    vegCategoryMain,
    estimatedVolume,
    mainUnit,
    kgPerSack,
    kgPerBunch,
    mainPriceRange,
  ]);

  const secondaryFarmgate = useMemo(() => {
    if (!interCropTypeId) return null;
    if (!secondaryEstimatedVolume) return null;
    return computeFarmgateValueRange({
      cropTypeId: interCropTypeId,
      varietyName: secondaryVarietyName,
      vegCategory: vegCategorySecondary,
      volume: secondaryEstimatedVolume,
      unit: secondaryUnit,
      kgPerSack,
      kgPerBunch,
      userPriceLow: secondaryPriceRange?.low,
      userPriceHigh: secondaryPriceRange?.high,
    });
  }, [
    interCropTypeId,
    secondaryVarietyName,
    vegCategorySecondary,
    secondaryEstimatedVolume,
    secondaryUnit,
    kgPerSack,
    kgPerBunch,
    secondaryPriceRange,
  ]);

  // Monocrop => main only; Intercrop => main + secondary
  const displayFarmgate = useMemo(() => {
    if (!mainFarmgate) return null;

    if (!isIntercropMode) {
      return { low: mainFarmgate.valueLow, high: mainFarmgate.valueHigh };
    }

    const low = (mainFarmgate?.valueLow || 0) + (secondaryFarmgate?.valueLow || 0);
    const high = (mainFarmgate?.valueHigh || 0) + (secondaryFarmgate?.valueHigh || 0);

    if (!Number.isFinite(low) || !Number.isFinite(high)) return null;
    if (low <= 0 && high <= 0) return null;
    return { low, high };
  }, [isIntercropMode, mainFarmgate, secondaryFarmgate]);

  const mainFarmgateExact = useMemo(() => {
  if (!mainFarmgate) return null;
  return exactFromRange(mainFarmgate.valueLow, mainFarmgate.valueHigh);
}, [mainFarmgate]);

const secondaryFarmgateExact = useMemo(() => {
  if (!secondaryFarmgate) return null;
  return exactFromRange(
    secondaryFarmgate.valueLow,
    secondaryFarmgate.valueHigh
  );
}, [secondaryFarmgate]);

const totalFarmgateExact = useMemo(() => {
  if (!displayFarmgate) return null;
  return exactFromRange(displayFarmgate.low, displayFarmgate.high);
}, [displayFarmgate]);


  // Single-value display for main farmgate (use midpoint of range)
const mainFarmgateSingleValue = useMemo(() => {
  if (!mainFarmgate) return null;
  const lo = Number(mainFarmgate.valueLow);
  const hi = Number(mainFarmgate.valueHigh);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return null;

  // if already effectively the same (e.g. you entered an exact price)
  if (almostEqual(lo, hi)) return lo;

  // otherwise use midpoint as single estimate
  return (lo + hi) / 2;
}, [mainFarmgate]);

// Same idea for secondary farmgate (if you also want no range there)
const secondaryFarmgateSingleValue = useMemo(() => {
  if (!secondaryFarmgate) return null;
  const lo = Number(secondaryFarmgate.valueLow);
  const hi = Number(secondaryFarmgate.valueHigh);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return null;

  if (almostEqual(lo, hi)) return lo;
  return (lo + hi) / 2;
}, [secondaryFarmgate]);


  /* ---------- VALIDATION ---------- */

  const setFieldError = (field, message) =>
    setErrors((e) => ({ ...e, [field]: message || "" }));

  // Step 1
  const validateStep1 = () => {
    const newErr = {};

    if (!selectedCropType) newErr.selectedCropType = "Please select a crop type.";

    if ((ecosystems?.length || 0) > 0 && !selectedEcosystem) {
      newErr.selectedEcosystem = "Please select an ecosystem.";
    }

    if (!plantedDate) newErr.plantedDate = "Please select the planting date.";

    if (estimatedHarvest) {
      const p = new Date(plantedDate);
      const eh = new Date(estimatedHarvest);
      if (plantedDate && eh < p)
        newErr.estimatedHarvest = "Harvest date cannot be before planting date.";
    }

    setErrors((prev) => ({ ...prev, ...newErr }));
    return Object.keys(newErr).length === 0;
  };

  // Step 2
  const validateStep2 = () => {
    const newErr = {};

    const h = Number(hectares);
    if (!hectares || !Number.isFinite(h) || h <= 0) {
      newErr.hectares = "Area must be a number greater than 0.";
    }

    if (!manualBarangay) newErr.manualBarangay = "Please choose a barangay.";

    if (isIntercropMode && !interCropTypeId) {
      newErr.interCropTypeId = "Please select the secondary crop type.";
    }

    // Validate land usage percentages for intercropped
    if (isIntercropMode) {
      const m = clampPct(mainLandPct);
      const s = clampPct(secondaryLandPct);
      const sum = m + s;

      if (!almostEqual(sum, 100)) {
        newErr.landPct = "Main % + Secondary % must equal 100%.";
      }
      if (m <= 0) newErr.mainLandPct = "Main crop % must be greater than 0.";
      if (s <= 0) newErr.secondaryLandPct = "Secondary crop % must be greater than 0.";
    }

    // Relay only: require relay planted date + validate relay harvest
    if (isRelayMode) {
      if (!relayPlantedDate)
        newErr.relayPlantedDate = "Please select relay crop planted date.";
      if (relayEstimatedHarvest && relayPlantedDate) {
        const rp = new Date(relayPlantedDate);
        const rh = new Date(relayEstimatedHarvest);
        if (rh < rp)
          newErr.relayEstimatedHarvest =
            "Relay harvest cannot be before relay planted date.";
      }
    }

    setErrors((prev) => ({ ...prev, ...newErr }));
    return Object.keys(newErr).length === 0;
  };

  // Step 3
  const validateStep3 = () => {
    const newErr = {};

    if (!isAnonymousFarmer) {
      if (!farmerFirstName.trim()) newErr.farmerFirstName = "First name is required.";
      if (!farmerLastName.trim()) newErr.farmerLastName = "Last name is required.";

      const phoneRegex = /^09\d{9}$/;
      if (!farmerMobile) newErr.farmerMobile = "Mobile number is required.";
      else if (!phoneRegex.test(farmerMobile))
        newErr.farmerMobile = "Use PH format: 09XXXXXXXXX.";

      if (!farmerBarangay) newErr.farmerBarangay = "Please choose a barangay.";
      if (!farmerAddress.trim()) newErr.farmerAddress = "Complete address is required.";
      if (!selectedTenureId) newErr.tenure = "Please choose land tenure type.";
    }

    setErrors((prev) => ({ ...prev, ...newErr }));
    return Object.keys(newErr).length === 0;
  };

  const isStep1Valid = () =>
    selectedCropType && plantedDate && (!(ecosystems?.length > 0) || selectedEcosystem);

  const isStep2Valid = () => {
    const baseOk = hectares && manualBarangay && !(isIntercropMode && !interCropTypeId);
    if (!baseOk) return false;

    if (isIntercropMode) {
      const m = clampPct(mainLandPct);
      const s = clampPct(secondaryLandPct);
      if (!(almostEqual(m + s, 100) && m > 0 && s > 0)) return false;
    }

    if (isRelayMode) {
      if (!relayPlantedDate) return false;
      if (relayEstimatedHarvest && relayPlantedDate) {
        const rp = new Date(relayPlantedDate);
        const rh = new Date(relayEstimatedHarvest);
        if (rh < rp) return false;
      }
    }
    return true;
  };

  const isStep3Valid = () =>
    isAnonymousFarmer ||
    (farmerFirstName &&
      farmerLastName &&
      farmerMobile &&
      farmerBarangay &&
      farmerAddress &&
      selectedTenureId);

  /* ---------- HANDLERS ---------- */

  const handleShowConfirmation = () => {
    const ok = validateStep3();
    if (!ok) return;
    setShowConfirmation(true);
  };

  const handleNext = () => {
    let ok = true;
    if (currentStep === 1) ok = validateStep1();
    else if (currentStep === 2) ok = validateStep2();
    if (!ok) return;

    if (currentStep === 2 && !farmerBarangay) {
      setFarmerBarangay(manualBarangay || detectedBarangayName || selectedBarangay || "");
    }

    setCurrentStep((s) => Math.min(s + 1, STEPS.length));
  };

  const handleBack = () => setCurrentStep((s) => Math.max(s - 1, 1));

  const handlePhotosChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > MAX_PHOTO_COUNT) {
      alert(`Please select up to ${MAX_PHOTO_COUNT} photos.`);
      return;
    }
    const tooBig = files.find((f) => f.size > MAX_PHOTO_MB * 1024 * 1024);
    if (tooBig) {
      alert(`Each photo must be ≤ ${MAX_PHOTO_MB}MB.`);
      return;
    }
    setPhotos(e.target.files);
  };

  // Percentage change handlers (keep total 100)
  const handleMainPctChange = (val) => {
    const m = clampPct(val);
    const s = round2(100 - m);
    setMainLandPct(String(m));
    setSecondaryLandPct(String(s));
    setFieldError("landPct", "");
    setFieldError("mainLandPct", "");
    setFieldError("secondaryLandPct", "");
  };

  const handleSecondaryPctChange = (val) => {
    const s = clampPct(val);
    const m = round2(100 - s);
    setSecondaryLandPct(String(s));
    setMainLandPct(String(m));
    setFieldError("landPct", "");
    setFieldError("mainLandPct", "");
    setFieldError("secondaryLandPct", "");
  };

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    const ok1 = validateStep1();
    const ok2 = validateStep2();
    const ok3 = validateStep3();
    if (!(ok1 && ok2 && ok3)) return;

    setShowConfirmation(false);

    const coordsFromDefault = defaultLocation?.coordinates || [];
    const coordsFromFarm =
      farmGeometry?.type === "Polygon"
        ? farmGeometry.coordinates?.[0] || []
        : farmGeometry?.type === "MultiPolygon"
        ? farmGeometry.coordinates?.[0]?.[0] || []
        : [];
    const farmCoords = coordsFromDefault.length ? coordsFromDefault : coordsFromFarm;

    const croppingSystemKey = CROPPING_SYSTEM_KEYS[croppingSystemId] || "monocrop";
    const formData = new FormData();

    // main crop
    formData.append("ecosystem_id", selectedEcosystem || "");
    formData.append("crop_type_id", String(selectedCropType || ""));
    formData.append("variety_id", selectedVarietyId || "");
    formData.append("plantedDate", plantedDate || "");
    formData.append("estimatedHarvest", estimatedHarvest || "");
    formData.append("estimatedVolume", estimatedVolume || "");
    formData.append("estimatedHectares", hectares || "");
    formData.append("note", note || "");

    // intercropping fields
    formData.append("cropping_system_id", croppingSystemId || "");
    formData.append("cropping_system", croppingSystemKey);
    formData.append("is_intercropped", isIntercropped ? "1" : "0");
    formData.append("intercrop_crop_type_id", interCropTypeId || "");
    formData.append("intercrop_variety_id", intercropVarietyId || "");
    formData.append("intercrop_estimated_volume", secondaryEstimatedVolume || "");

    // Relay-specific dates (ONLY meaningful when croppingSystemId === "3")
    formData.append("relay_planted_date", isRelayMode ? relayPlantedDate || "" : "");
    formData.append(
      "relay_estimated_harvest",
      isRelayMode ? relayEstimatedHarvest || "" : ""
    );

    // percentage-based land usage + computed hectares per crop
    const finalMainPct = isIntercropMode ? clampPct(mainLandPct) : 100;
    const finalSecondaryPct = isIntercropMode ? clampPct(secondaryLandPct) : 0;

    formData.append("main_land_pct", String(finalMainPct));
    formData.append("secondary_land_pct", String(finalSecondaryPct));
    formData.append("main_hectares_used", String(round2(mainHectaresUsed)));
    formData.append("intercrop_hectares", String(round2(secondaryHectaresUsed)));

    // Conversion settings + desired prices (single input)
    formData.append("kg_per_sack", String(kgPerSack || ""));
    formData.append("kg_per_bunch", String(kgPerBunch || ""));
    formData.append("main_desired_price", String(mainPrice || ""));
    formData.append("secondary_desired_price", String(secondaryPrice || ""));

    // keep your existing fields
    const mRange = singlePriceToRange(mainPrice, 0);
    const sRange = singlePriceToRange(secondaryPrice, 0);
    formData.append("main_price_low", mRange?.low ? String(mRange.low) : "");
    formData.append("main_price_high", mRange?.high ? String(mRange.high) : "");
    formData.append("secondary_price_low", sRange?.low ? String(sRange.low) : "");
    formData.append("secondary_price_high", sRange?.high ? String(sRange.high) : "");

    formData.append("coordinates", JSON.stringify(farmCoords));

    const finalBarangay =
      manualBarangay || detectedBarangayName || selectedBarangay || "";
    formData.append("barangay", finalBarangay);

    formData.append("detected_barangay_name", detectedBarangayName || "");
    formData.append(
      "detected_barangay_feature_properties",
      JSON.stringify(detectedBarangayFeature?.properties || {})
    );
    formData.append(
      "detected_barangay_feature_geometry",
      JSON.stringify(detectedBarangayFeature?.geometry || {})
    );

    // avg elevation (meters, optional)
    formData.append("avg_elevation_m", avgElevation || "");

    if (adminId) formData.append("admin_id", String(adminId));

     let totalDisplay = "";
    if (totalFarmgateExact != null) {
      const v = Number(totalFarmgateExact);
      if (Number.isFinite(v) && v > 0) {
        // peso(v) = "623,250" → prepend "₱"
        totalDisplay = `₱${peso(v)}`;
      }
    }
    formData.append("est_farmgate_value_display", totalDisplay);

    // Farmer privacy
    formData.append("is_anonymous_farmer", isAnonymousFarmer ? "1" : "0");
    formData.append("farmer_first_name", isAnonymousFarmer ? "" : farmerFirstName || "");
    formData.append("farmer_last_name", isAnonymousFarmer ? "" : farmerLastName || "");
    formData.append("farmer_mobile", isAnonymousFarmer ? "" : farmerMobile || "");
    formData.append("farmer_barangay", isAnonymousFarmer ? "" : farmerBarangay || "");
    formData.append("full_address", isAnonymousFarmer ? "" : farmerAddress || "");
    formData.append("tenure_id", isAnonymousFarmer ? "" : selectedTenureId || "");

    if (photos) {
      for (let i = 0; i < photos.length; i++) formData.append("photos", photos[i]);
    }

    await onSave(formData);

    // Reset
    setCurrentStep(1);
    setHectares("");
    setSelectedCropType("");
    setSelectedVarietyId("");
    setSelectedEcosystem("");
    setPlantedDate("");
    setManualBarangay(finalBarangay || "");
    setEstimatedHarvest("");
    setHarvestTouched(false);
    setEstimatedVolume("");
    setVolumeTouched(false);
    setSecondaryEstimatedVolume("");
    setSecondaryVolumeTouched(false);
    setSecondaryHectares("");
    setCroppingSystemId("1");
    setIsIntercropped(false);
    setInterCropTypeId("");
    setIntercropVarietyId("");
    setMainLandPct("100");
    setSecondaryLandPct("0");

    setRelayPlantedDate("");
    setRelayEstimatedHarvest("");
    setRelayHarvestTouched(false);

    setNote("");
    setPhotos(null);
    setFarmerFirstName("");
    setFarmerLastName("");
    setFarmerMobile("");
    setFarmerBarangay("");
    setFarmerAddress("");
    setAvgElevation("");
    setSelectedTenureId("");
    setIsAnonymousFarmer(false);
    setVegCategoryMain("");
    setVegCategorySecondary("");
    setKgPerSack(String(DEFAULT_KG_PER_SACK));
    setKgPerBunch(String(DEFAULT_KG_PER_BUNCH));
    setMainPrice("");
    setSecondaryPrice("");
    setErrors({});
  };

  const getCropTypeName = () => {
    const crop = cropTypes.find((c) => String(c.id) === String(selectedCropType));
    return crop ? crop.name : "—";
  };
  const getVarietyName = () => {
    const variety = dynamicVarieties.find(
      (v) => String(v.id) === String(selectedVarietyId)
    );
    return variety ? variety.name : "—";
  };
  const getCroppingSystemLabel = () => {
    const idNum = Number(croppingSystemId);
    return CROPPING_SYSTEMS[idNum] || "Monocrop";
  };
  const getTenureLabel = () => {
    const t = tenureTypes.find((x) => String(x.id) === String(selectedTenureId));
    return t ? t.name : "—";
  };
  const getSecondaryCropTypeName = () => {
    const crop = cropTypes.find((c) => String(c.id) === String(interCropTypeId));
    return crop ? crop.name : "—";
  };
  const getSecondaryVarietyName = () => {
    const variety = intercropVarieties.find(
      (v) => String(v.id) === String(intercropVarietyId)
    );
    return variety ? variety.name : "—";
  };

  /* ---------- UI ---------- */

  const activeStepMeta = STEPS.find((s) => s.id === currentStep);
  const totalSteps = STEPS.length;

  // Helper labels for pricing unit
  const mainPriceUnitLabel = mainFarmgate?.priceUnit === "ton" ? "₱/ton" : "₱/kg";
  const secondaryPriceUnitLabel =
    secondaryFarmgate?.priceUnit === "ton" ? "₱/ton" : "₱/kg";

  return (
    <div className="fixed inset-0 bg-black/45 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="max-h-[80vh] lg:max-h-[78vh] overflow-y-auto [scrollbar-gutter:stable]">
            {/* Sticky header */}
            <div className="sticky top-0 z-10 px-6 py-5 bg-white/90 backdrop-blur border-b rounded-t-2xl supports-[backdrop-filter]:bg-white/80">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-gray-900">
                    Tag Crop
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Encode crop and farmer details for this mapped field.
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-gray-500">
                    Step {currentStep} of {totalSteps}
                  </p>
                  <p className="text-xs text-gray-400">{activeStepMeta?.title}</p>
                </div>
              </div>

              {/* Stepper */}
              <ol className="mt-4 flex items-center gap-3 text-xs font-medium text-gray-500">
                {STEPS.map((step, index) => {
                  const isCurrent = step.id === currentStep;
                  const isCompleted = step.id < currentStep;
                  return (
                    <li key={step.id} className="flex items-center gap-2">
                      <div
                        className={[
                          "flex h-6 w-6 items-center justify-center rounded-full border text-[11px]",
                          isCompleted
                            ? "bg-green-600 border-green-600 text-white"
                            : isCurrent
                            ? "bg-green-50 border-green-600 text-green-700"
                            : "bg-gray-100 border-gray-300 text-gray-500",
                        ].join(" ")}
                      >
                        {step.id}
                      </div>
                      <span
                        className={
                          isCurrent || isCompleted ? "text-gray-900" : "text-gray-400"
                        }
                      >
                        {step.title}
                      </span>
                      {index < STEPS.length - 1 && (
                        <span className="h-px w-6 bg-gray-200" />
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>

            {/* Body */}
            <form onSubmit={handleSubmit} ref={formRef} className="p-6 space-y-7">
              {/* Context chips */}
              <div className="flex flex-wrap gap-2 mb-2">
                {(manualBarangay || detectedBarangayName || selectedBarangay) && (
                  <Pill color="blue">
                    {manualBarangay || detectedBarangayName || selectedBarangay}
                  </Pill>
                )}
                {defaultLocation?.hectares && (
                  <Pill color="emerald">
                    {Number(defaultLocation.hectares).toFixed(2)} ha (from map)
                  </Pill>
                )}
                {avgElevation && <Pill color="gray">{avgElevation} m elevation</Pill>}
              </div>

              {/* Step contents */}
              {currentStep === 1 && (
                <div className="space-y-7 animate-fadeIn">
                  {/* Crop Basics */}
                  <Section
                    title="Crop basics"
                    subtitle="Main crop planted in this mapped field."
                  >
                    <div className="space-y-4">
                      <Field
                        label="Crop type"
                        required
                        error={errors.selectedCropType}
                      >
                        <Select
                          error={errors.selectedCropType}
                          required
                          value={selectedCropType}
                          onChange={(e) => {
                            const id = parseInt(e.target.value, 10);
                            const next = Number.isFinite(id) ? id : "";
                            setSelectedCropType(next);
                            setSelectedVarietyId("");
                            setSelectedEcosystem("");
                            setVegCategoryMain("");
                            setHarvestTouched(false);
                            setEstimatedHarvest("");
                            setVolumeTouched(false);
                            setEstimatedVolume("");
                            setFieldError("selectedCropType", "");
                            setFieldError("selectedEcosystem", "");
                          }}
                          onBlur={() => {
                            if (!selectedCropType)
                              setFieldError(
                                "selectedCropType",
                                "Please select a crop type."
                              );
                          }}
                        >
                          <option value="">Select crop type</option>
                          {cropTypes.map((type) => (
                            <option key={type.id} value={type.id}>
                              {type.name}
                            </option>
                          ))}
                        </Select>
                      </Field>

                      {selectedCropType && ecosystems.length > 0 && (
                        <Field
                          label="Ecosystem"
                          required
                          hint="Required for reporting and maps."
                          error={errors.selectedEcosystem}
                        >
                          <Select
                            error={errors.selectedEcosystem}
                            value={selectedEcosystem}
                            onChange={(e) => {
                              setSelectedEcosystem(e.target.value);
                              setFieldError("selectedEcosystem", "");
                            }}
                            onBlur={() => {
                              if (!selectedEcosystem)
                                setFieldError(
                                  "selectedEcosystem",
                                  "Please select an ecosystem."
                                );
                            }}
                          >
                            <option value="">Select ecosystem</option>
                            {ecosystems.map((ecosystem) => (
                              <option key={ecosystem.id} value={ecosystem.id}>
                                {ecosystem.name}
                              </option>
                            ))}
                          </Select>
                        </Field>
                      )}

                      <Field label="Variety">
                        <Select
                          value={selectedVarietyId}
                          onChange={(e) => setSelectedVarietyId(e.target.value)}
                        >
                          <option value="">Select variety (optional)</option>
                          {dynamicVarieties.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name}
                            </option>
                          ))}
                        </Select>
                      </Field>

                      {/* Vegetables category (main) */}
                      {String(selectedCropType) === "6" && (
                        <Field
                          label="Vegetable category (for farmgate estimate)"
                          hint="Used to estimate farmgate value. You can refine later."
                        >
                          <Select
                            value={vegCategoryMain}
                            onChange={(e) => setVegCategoryMain(e.target.value)}
                          >
                            <option value="">Select category (recommended)</option>
                            <option value="leafy">
                              Leafy vegetables (₱40–₱60 /kg)
                            </option>
                            <option value="fruiting">
                              Fruiting vegetables (₱35–₱80 /kg)
                            </option>
                            <option value="gourd">
                              Gourd crops (₱30–₱60 /kg)
                            </option>
                          </Select>
                        </Field>
                      )}
                    </div>
                  </Section>

                  {/* Dates */}
                  <Section
                    title="Planting & harvest"
                    subtitle="Timeline of this crop cycle."
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Field
                        label="Date planted"
                        required
                        error={errors.plantedDate}
                      >
                        <Input
                          type="date"
                          required
                          value={plantedDate}
                          onChange={(e) => {
                            setPlantedDate(e.target.value);
                            setFieldError("plantedDate", "");
                            if (estimatedHarvest) {
                              const p = new Date(e.target.value);
                              const h = new Date(estimatedHarvest);
                              setFieldError(
                                "estimatedHarvest",
                                h < p
                                  ? "Harvest date cannot be before planting date."
                                  : ""
                              );
                            }
                          }}
                          onBlur={() => {
                            if (!plantedDate)
                              setFieldError(
                                "plantedDate",
                                "Please select the planting date."
                              );
                          }}
                          error={errors.plantedDate}
                        />
                      </Field>

                      <Field
                        label="Estimated harvest"
                        hint="Auto-fills based on crop maturity; you can override."
                        error={errors.estimatedHarvest}
                      >
                        <Input
                          type="date"
                          value={estimatedHarvest}
                          onChange={(e) => {
                            setHarvestTouched(true);
                            setEstimatedHarvest(e.target.value);
                            if (plantedDate) {
                              const p = new Date(plantedDate);
                              const h = new Date(e.target.value);
                              setFieldError(
                                "estimatedHarvest",
                                h < p
                                  ? "Harvest date cannot be before planting date."
                                  : ""
                              );
                            }
                          }}
                          onBlur={() => {
                            if (estimatedHarvest && plantedDate) {
                              const p = new Date(plantedDate);
                              const h = new Date(estimatedHarvest);
                              if (h < p)
                                setFieldError(
                                  "estimatedHarvest",
                                  "Harvest date cannot be before planting date."
                                );
                            }
                          }}
                          error={errors.estimatedHarvest}
                        />
                      </Field>
                    </div>
                  </Section>
                </div>
              )}

              {currentStep === 2 && (
                <div className="space-y-7 animate-fadeIn">
                  {/* Cropping System */}
                  <Section
                    title="Cropping system"
                    subtitle="Indicate if the field is monocrop or intercropped."
                  >
                    <div className="space-y-4">
                      <Field label="Cropping system" required>
                        <Select
                          value={croppingSystemId}
                          onChange={(e) => {
                            const value = e.target.value;
                            setCroppingSystemId(value);

                            if (value === "1") {
                              setIsIntercropped(false);
                              setInterCropTypeId("");
                              setIntercropVarietyId("");
                              setSecondaryVolumeTouched(false);
                              setSecondaryEstimatedVolume("");
                              setSecondaryHectares("");
                              setVegCategorySecondary("");
                              setMainLandPct("100");
                              setSecondaryLandPct("0");

                              // Relay dates cleared when leaving relay
                              setRelayPlantedDate("");
                              setRelayEstimatedHarvest("");
                              setRelayHarvestTouched(false);

                              setFieldError("interCropTypeId", "");
                              setFieldError("landPct", "");
                              setFieldError("mainLandPct", "");
                              setFieldError("secondaryLandPct", "");
                              setFieldError("relayPlantedDate", "");
                              setFieldError("relayEstimatedHarvest", "");
                            } else {
                              setIsIntercropped(true);
                            }
                          }}
                        >
                          <option value="1">Monocrop</option>
                          <option value="2">Intercropped (2 crops)</option>
                          <option value="3">Relay intercropping</option>
                          <option value="4">Strip intercropping</option>
                          <option value="5">Mixed cropping / Polyculture</option>
                        </Select>
                      </Field>

                      {/* MAIN + SECONDARY block */}
                      {isIntercropMode && (
                        <div className="rounded-2xl border border-gray-200 bg-white p-5">
                          {/* Main crop header */}
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-gray-900">
                                Main crop (editable)
                              </p>
                              <p className="text-xs text-gray-500 mt-0.5">
                                You can review and change the main crop here
                                without going back to Step 1.
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 space-y-5">
                          {/* Main crop type + variety */}
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  <Field
    label="Main crop type"
    required
    error={errors.selectedCropType}
  >
    <Select
      error={errors.selectedCropType}
      required
      value={selectedCropType}
      onChange={(e) => {
        const id = parseInt(e.target.value, 10);
        const next = Number.isFinite(id) ? id : "";
        setSelectedCropType(next);
        setSelectedVarietyId("");
        setSelectedEcosystem("");
        setVegCategoryMain("");

        setVolumeTouched(false);
        setEstimatedVolume("");
        setHarvestTouched(false);
        setEstimatedHarvest("");

        setFieldError(
          "selectedCropType",
          next ? "" : "Please select a crop type."
        );
        setFieldError("selectedEcosystem", "");
      }}
      onBlur={() => {
        if (!selectedCropType)
          setFieldError(
            "selectedCropType",
            "Please select a crop type."
          );
      }}
    >
      <option value="">Select crop type</option>
      {cropTypes.map((type) => (
        <option key={type.id} value={type.id}>
          {type.name}
        </option>
      ))}
    </Select>
  </Field>

  <Field label="Main variety">
    <Select
      value={selectedVarietyId}
      onChange={(e) =>
        setSelectedVarietyId(e.target.value)
      }
    >
      <option value="">Select variety (optional)</option>
      {dynamicVarieties.map((v) => (
        <option key={v.id} value={v.id}>
          {v.name}
        </option>
      ))}
    </Select>
  </Field>
</div>

{/* Relay: main crop dates just under type/variety */}
{isRelayMode && (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
    <Field
      label="Main crop planted date"
      required
      error={errors.plantedDate}
    >
      <Input
        type="date"
        required
        value={plantedDate}
        onChange={(e) => {
          setPlantedDate(e.target.value);
          setFieldError("plantedDate", "");
          if (estimatedHarvest) {
            const p = new Date(e.target.value);
            const h = new Date(estimatedHarvest);
            setFieldError(
              "estimatedHarvest",
              h < p
                ? "Harvest date cannot be before planting date."
                : ""
            );
          }
        }}
        onBlur={() => {
          if (!plantedDate)
            setFieldError(
              "plantedDate",
              "Please select the planting date."
            );
        }}
        error={errors.plantedDate}
      />
    </Field>

    <Field
      label="Main crop estimated harvest"
      hint="Auto-fills based on crop maturity; you can override."
      error={errors.estimatedHarvest}
    >
      <Input
        type="date"
        value={estimatedHarvest}
        onChange={(e) => {
          setHarvestTouched(true);
          setEstimatedHarvest(e.target.value);
          if (plantedDate) {
            const p = new Date(plantedDate);
            const h = new Date(e.target.value);
            setFieldError(
              "estimatedHarvest",
              h < p
                ? "Harvest date cannot be before planting date."
                : ""
            );
          }
        }}
        onBlur={() => {
          if (estimatedHarvest && plantedDate) {
            const p = new Date(plantedDate);
            const h = new Date(estimatedHarvest);
            if (h < p)
              setFieldError(
                "estimatedHarvest",
                "Harvest date cannot be before planting date."
              );
          }
        }}
        error={errors.estimatedHarvest}
      />
    </Field>
  </div>
)}


                            {/* Land % errors */}
                            {(errors.landPct ||
                              errors.mainLandPct ||
                              errors.secondaryLandPct) && (
                              <ErrorText>
                                {errors.landPct ||
                                  errors.mainLandPct ||
                                  errors.secondaryLandPct}
                              </ErrorText>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <Field
                                label="Main crop land"
                                required
                                error={errors.mainLandPct}
                              >
                                <SuffixInput
                                  suffix="%"
                                  error={errors.mainLandPct}
                                  inputProps={{
                                    type: "number",
                                    min: "0",
                                    max: "100",
                                    step: "0.1",
                                    value: mainLandPct,
                                    onChange: (e) =>
                                      handleMainPctChange(e.target.value),
                                    onBlur: () => {
                                      const m = clampPct(mainLandPct);
                                      const s = clampPct(secondaryLandPct);
                                      if (!almostEqual(m + s, 100))
                                        setFieldError(
                                          "landPct",
                                          "Main % + Secondary % must equal 100%."
                                        );
                                      if (m <= 0)
                                        setFieldError(
                                          "mainLandPct",
                                          "Main crop % must be greater than 0."
                                        );
                                    },
                                    className: "text-right",
                                  }}
                                />
                              </Field>

                              <Field
                                label="Main crop est. yield"
                                hint={
                                  yieldUnitMap[selectedCropType]
                                    ? `Unit: ${yieldUnitMap[selectedCropType]}`
                                    : ""
                                }
                              >
                                <SuffixInput
                                  suffix={yieldUnitMap[selectedCropType] || "units"}
                                  inputProps={{
                                    type: "number",
                                    min: "0",
                                    step: "0.1",
                                    value: estimatedVolume,
                                    onChange: (e) => {
                                      setVolumeTouched(true);
                                      setEstimatedVolume(e.target.value);
                                    },
                                    placeholder: "Auto-calculated",
                                    className: "text-right",
                                  }}
                                />
                              </Field>
                            </div>

                            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                              <Field
                                label="Main hectares used (computed)"
                                hint="Auto = total ha × main %"
                              >
                                <SuffixInput
                                  suffix="ha"
                                  inputProps={{
                                    type: "text",
                                    readOnly: true,
                                    value:
                                      hectaresNum > 0
                                        ? mainHectaresUsed.toFixed(2)
                                        : "",
                                    placeholder: "0.00",
                                    className:
                                      "text-right bg-white cursor-not-allowed",
                                  }}
                                />
                              </Field>
                            </div>

                            {/* Vegetables category (main) */}
                            {String(selectedCropType) === "6" && (
                              <Field
                                label="Main vegetable category (for farmgate estimate)"
                                hint="Used to estimate farmgate value for the main crop."
                              >
                                <Select
                                  value={vegCategoryMain}
                                  onChange={(e) =>
                                    setVegCategoryMain(e.target.value)
                                  }
                                >
                                  <option value="">
                                    Select category (recommended)
                                  </option>
                                  <option value="leafy">
                                    Leafy vegetables (₱40–₱60 /kg)
                                  </option>
                                  <option value="fruiting">
                                    Fruiting vegetables (₱35–₱80 /kg)
                                  </option>
                                  <option value="gourd">
                                    Gourd crops (₱30–₱60 /kg)
                                  </option>
                                </Select>
                              </Field>
                            )}

                            {/* SECONDARY CROP block */}
                            <div className="pt-1">
                              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
                                Secondary crop
                              </p>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  <Field
    label="Secondary crop type"
    required
    error={errors.interCropTypeId}
  >
    <Select
      error={errors.interCropTypeId}
      value={interCropTypeId}
      onChange={(e) => {
        const id = parseInt(e.target.value, 10);
        const next = Number.isFinite(id) ? id : "";
        setInterCropTypeId(next);
        setSecondaryVolumeTouched(false);
        setSecondaryEstimatedVolume("");

        // reset relay harvest auto when crop changes
        setRelayHarvestTouched(false);

        setFieldError(
          "interCropTypeId",
          next
            ? ""
            : "Please select the secondary crop type."
        );
      }}
      onBlur={() => {
        if (!interCropTypeId)
          setFieldError(
            "interCropTypeId",
            "Please select the secondary crop type."
          );
      }}
    >
      <option value="">
        Select secondary crop type
      </option>
      {cropTypes.map((type) => (
        <option key={type.id} value={type.id}>
          {type.name}
        </option>
      ))}
    </Select>
  </Field>

  <Field label="Secondary variety">
    <Select
      value={intercropVarietyId}
      onChange={(e) =>
        setIntercropVarietyId(e.target.value)
      }
    >
      <option value="">
        Select variety (optional)
      </option>
      {intercropVarieties.map((v) => (
        <option key={v.id} value={v.id}>
          {v.name}
        </option>
      ))}
    </Select>
  </Field>
</div>

{/* Relay: secondary crop dates just under secondary type/variety */}
{isRelayMode && (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
    <Field
      label="Secondary crop planted date"
      required
      error={errors.relayPlantedDate}
    >
      <Input
        type="date"
        value={relayPlantedDate}
        onChange={(e) => {
          setRelayPlantedDate(e.target.value);
          setFieldError("relayPlantedDate", "");

          // validate harvest if already set
          if (relayEstimatedHarvest) {
            const rp = new Date(e.target.value);
            const rh = new Date(relayEstimatedHarvest);
            setFieldError(
              "relayEstimatedHarvest",
              rh < rp
                ? "Relay harvest cannot be before relay planted date."
                : ""
            );
          }

          // auto-harvest will update if not touched
          setRelayHarvestTouched(false);
        }}
        onBlur={() => {
          if (!relayPlantedDate)
            setFieldError(
              "relayPlantedDate",
              "Please select relay crop planted date."
            );
        }}
        error={errors.relayPlantedDate}
      />
    </Field>

    <Field
      label="Secondary crop estimated harvest"
      hint="Auto-fills based on relay crop maturity; you can override."
      error={errors.relayEstimatedHarvest}
    >
      <Input
        type="date"
        value={relayEstimatedHarvest}
        onChange={(e) => {
          setRelayHarvestTouched(true);
          setRelayEstimatedHarvest(e.target.value);

          if (relayPlantedDate) {
            const rp = new Date(relayPlantedDate);
            const rh = new Date(e.target.value);
            setFieldError(
              "relayEstimatedHarvest",
              rh < rp
                ? "Relay harvest cannot be before relay planted date."
                : ""
            );
          }
        }}
        onBlur={() => {
          if (relayEstimatedHarvest && relayPlantedDate) {
            const rp = new Date(relayPlantedDate);
            const rh = new Date(relayEstimatedHarvest);
            if (rh < rp)
              setFieldError(
                "relayEstimatedHarvest",
                "Relay harvest cannot be before relay planted date."
              );
          }
        }}
        error={errors.relayEstimatedHarvest}
      />
    </Field>
  </div>
)}


                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                <Field
                                  label="Secondary crop land"
                                  required
                                  error={errors.secondaryLandPct}
                                >
                                  <SuffixInput
                                    suffix="%"
                                    error={errors.secondaryLandPct}
                                    inputProps={{
                                      type: "number",
                                      min: "0",
                                      max: "100",
                                      step: "0.1",
                                      value: secondaryLandPct,
                                      onChange: (e) =>
                                        handleSecondaryPctChange(e.target.value),
                                      onBlur: () => {
                                        const m = clampPct(mainLandPct);
                                        const s = clampPct(secondaryLandPct);
                                        if (!almostEqual(m + s, 100))
                                          setFieldError(
                                            "landPct",
                                            "Main % + Secondary % must equal 100%."
                                          );
                                        if (s <= 0)
                                          setFieldError(
                                            "secondaryLandPct",
                                            "Secondary crop % must be greater than 0."
                                          );
                                      },
                                      className: "text-right",
                                    }}
                                  />
                                </Field>

                                <Field
                                  label="Secondary crop est. yield"
                                  hint={
                                    yieldUnitMap[interCropTypeId]
                                      ? `Unit: ${yieldUnitMap[interCropTypeId]}`
                                      : ""
                                  }
                                >
                                  <SuffixInput
                                    suffix={
                                      yieldUnitMap[interCropTypeId] || "units"
                                    }
                                    inputProps={{
                                      type: "number",
                                      min: "0",
                                      step: "0.1",
                                      value: secondaryEstimatedVolume,
                                      onChange: (e) => {
                                        setSecondaryVolumeTouched(true);
                                        setSecondaryEstimatedVolume(e.target.value);
                                      },
                                      placeholder: "Auto-calculated",
                                      className: "text-right",
                                    }}
                                  />
                                </Field>
                              </div>

                              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 mt-4">
                                <Field
                                  label="Secondary hectares used (computed)"
                                  hint="Auto = total ha × secondary %"
                                >
                                  <SuffixInput
                                    suffix="ha"
                                    inputProps={{
                                      type: "text",
                                      readOnly: true,
                                      value:
                                        hectaresNum > 0
                                          ? secondaryHectaresUsed.toFixed(2)
                                          : "",
                                      placeholder: "0.00",
                                      className:
                                        "text-right bg-white cursor-not-allowed",
                                    }}
                                  />
                                </Field>
                              </div>

                              {/* Vegetables category (secondary) */}
                              {String(interCropTypeId) === "6" && (
                                <Field
                                  label="Secondary vegetable category (for farmgate estimate)"
                                  hint="Used to estimate farmgate value for the secondary crop."
                                >
                                  <Select
                                    value={vegCategorySecondary}
                                    onChange={(e) =>
                                      setVegCategorySecondary(e.target.value)
                                    }
                                  >
                                    <option value="">
                                      Select category (recommended)
                                    </option>
                                    <option value="leafy">
                                      Leafy vegetables (₱40–₱60 /kg)
                                    </option>
                                    <option value="fruiting">
                                      Fruiting vegetables (₱35–₱80 /kg)
                                    </option>
                                    <option value="gourd">
                                      Gourd crops (₱30–₱60 /kg)
                                    </option>
                                  </Select>
                                </Field>
                              )}
                            </div>

                            {/* MAIN ECOSYSTEM below secondary crop */}
                            {selectedCropType && ecosystems.length > 0 && (
                              <Field
                                label="Main ecosystem"
                                required
                                error={errors.selectedEcosystem}
                                hint="Required for reporting and maps."
                              >
                                <Select
                                  error={errors.selectedEcosystem}
                                  value={selectedEcosystem}
                                  onChange={(e) => {
                                    setSelectedEcosystem(e.target.value);
                                    setFieldError("selectedEcosystem", "");
                                  }}
                                  onBlur={() => {
                                    if (!selectedEcosystem)
                                      setFieldError(
                                        "selectedEcosystem",
                                        "Please select an ecosystem."
                                      );
                                  }}
                                >
                                  <option value="">Select ecosystem</option>
                                  {ecosystems.map((eco) => (
                                    <option key={eco.id} value={eco.id}>
                                      {eco.name}
                                    </option>
                                  ))}
                                </Select>
                              </Field>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </Section>

                  {/* Area & yield */}
                  <Section
                    title="Area & yield"
                    subtitle="Estimated coverage and production."
                  >
                    {/* Row 1: Total area (left) + Average elevation (right) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Field
                        label="Total area (ha)"
                        required
                        error={errors.hectares}
                      >
                        <SuffixInput
                          suffix="ha"
                          error={errors.hectares}
                          inputProps={{
                            type: "number",
                            min: "0",
                            step: "0.01",
                            required: true,
                            value: hectares,
                            onChange: (e) => {
                              setHectares(e.target.value);
                              const v = Number(e.target.value);
                              setFieldError(
                                "hectares",
                                !e.target.value ||
                                  !Number.isFinite(v) ||
                                  v <= 0
                                  ? "Area must be a number greater than 0."
                                  : ""
                              );
                            },
                            placeholder: "0.00",
                            className: "text-right",
                          }}
                        />
                      </Field>

                      <Field
                        label="Average elevation (m)"
                        hint="Optional, auto-estimated from terrain."
                      >
                        <SuffixInput
                          suffix="m"
                          inputProps={{
                            type: "number",
                            readOnly: true,
                            value: avgElevation,
                            placeholder: "Auto from map",
                            className:
                              "text-right bg-gray-50 cursor-not-allowed",
                          }}
                        />
                      </Field>
                    </div>

                    {/* Row 2: MONOCROP ONLY - yield stays below */}
                    {!isIntercropMode && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <Field
                          label={`Main est. yield ${
                            yieldUnitMap[selectedCropType]
                              ? `(${yieldUnitMap[selectedCropType]})`
                              : ""
                          }`}
                          hint="Estimated from area × typical yield; you can override."
                        >
                          <SuffixInput
                            suffix={yieldUnitMap[selectedCropType] || "units"}
                            inputProps={{
                              type: "number",
                              min: "0",
                              step: "0.1",
                              value: estimatedVolume,
                              onChange: (e) => {
                                setVolumeTouched(true);
                                setEstimatedVolume(e.target.value);
                              },
                              placeholder: "Auto-calculated",
                              className: "text-right",
                            }}
                          />
                        </Field>
                      </div>
                    )}
                  </Section>



                  {/* Estimated farmgate value (PHP) — match screenshot style */}
                 {/* Estimated farmgate value (PHP) — follow screenshot layout */}
<Section
  title="Estimated farmgate value (PHP)"
  subtitle="Based on 2025 farmgate ranges and your estimated yield. Conversions and prices are adjustable."
>
  <div className="space-y-4">
    {/* 1. TOP CARD: conversion settings (single bordered card) */}
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* LEFT: specific conversion input (banana bunch / sack / ton / none) */}
        {needsKgPerBunch ? (
          <Field
            label={bunchLabel}
            hint="Used when unit is bunches (typically banana)."
          >
            <SuffixInput
              suffix="kg"
              inputProps={{
                type: "number",
                min: "1",
                step: "1",
                value: kgPerBunch,
                onChange: (e) => setKgPerBunch(e.target.value),
                className: "text-right",
              }}
            />
          </Field>
        ) : needsKgPerSack ? (
          <Field
            label="Kg per sack"
            hint="Used when unit is sacks (typically rice/corn)."
          >
            <SuffixInput
              suffix="kg"
              inputProps={{
                type: "number",
                min: "1",
                step: "1",
                value: kgPerSack,
                onChange: (e) => setKgPerSack(e.target.value),
                className: "text-right",
              }}
            />
          </Field>
        ) : needsKgPerTon ? (
          <Field
            label="Ton conversion"
            hint="Fixed conversion for tons."
          >
            <SuffixInput
              suffix="kg"
              inputProps={{
                type: "text",
                readOnly: true,
                value: "1000",
                className: "text-right bg-gray-50 cursor-not-allowed",
              }}
            />
          </Field>
        ) : (
          <Field
            label="Conversion"
            hint="No conversion needed (kg-based)."
          >
            <Input
              value="Not required"
              readOnly
              className="bg-gray-50 cursor-not-allowed text-right"
            />
          </Field>
        )}

        {/* RIGHT: conversion summary display */}
        <Field
          label="Conversion used"
          hint="Auto based on selected crop units."
        >
          <Input
            value={conversionSummary}
            readOnly
            className="bg-gray-50 cursor-not-allowed"
          />
        </Field>
      </div>
    </div>

    {/* 2. MAIN CROP CARD (its own bordered div, like in screenshot) */}
    <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">Main Crop</p>
          <p className="text-xs text-gray-500">Desired price and value estimate.</p>
        </div>
        <p className="text-xs text-gray-500">{getCropTypeName()}</p>
      </div>

    <Field
  label={`Desired price (${mainPriceUnitLabel})`}
  hint="Total value is based directly on this price. Leave blank to use standard farmgate range."
>

        <div className="relative">
          <input
            type="number"
            min="0"
            step="0.01"
            value={mainPrice}
            onChange={(e) => setMainPrice(e.target.value)}
            placeholder="e.g. 90"
            className={[
              baseInputClasses,
              "pr-16",
              ...decorateClasses(false),
              "text-right",
            ].join(" ")}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 select-none">
            {mainPriceUnitLabel}
          </span>
        </div>
      </Field>

      {/* INNER CARD: main crop value (matches “Total Estimated Crop Value” box) */}
      <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
        <p className="text-sm font-medium text-gray-800 mb-1">
          Total Estimated Crop Value
        </p>
       <p className="text-lg font-bold text-gray-900">
  {mainFarmgateSingleValue != null
    ? `₱${peso(mainFarmgateSingleValue)}`
    : "—"}
</p>

        <p className="text-xs text-gray-500 mt-1">
          {mainFarmgate
  ? `${mainFarmgate.qty.toLocaleString(undefined, {
      maximumFractionDigits: 0,
    })} ${mainFarmgate.qtyUnit} × ${formatUnitPrice(
      mainFarmgate.priceLow,
      mainFarmgate.priceHigh,
      mainFarmgate.priceUnit
    )}`
  : "Fill yield (and optional desired price) to estimate value."}

        </p>
      </div>
    </div>

    {/* 3. SECONDARY CROP CARD (separate bordered div like screenshot) */}
    {isIntercropMode && (
      <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">Secondary Crop</p>
            <p className="text-xs text-gray-500">
              Optional – only if you encoded a secondary crop.
            </p>
          </div>
          <p className="text-xs text-gray-500">
            {getSecondaryCropTypeName()}
          </p>
        </div>

       <Field
  label={`Desired price (${secondaryPriceUnitLabel})`}
  hint="Total value is based directly on this price. Leave blank to use standard farmgate range."
>

          <div className="relative">
            <input
              type="number"
              min="0"
              step="0.01"
              value={secondaryPrice}
              onChange={(e) => setSecondaryPrice(e.target.value)}
              placeholder="e.g. 22"
              className={[
                baseInputClasses,
                "pr-16",
                ...decorateClasses(false),
                "text-right",
              ].join(" ")}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 select-none">
              {secondaryPriceUnitLabel}
            </span>
          </div>
        </Field>

        <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm font-medium text-gray-800 mb-1">
            Total Estimated Crop Value
          </p>
          <p className="text-lg font-bold text-gray-900">
  {secondaryFarmgateSingleValue != null
    ? `₱${peso(secondaryFarmgateSingleValue)}`
    : "—"}
</p>

          <p className="text-xs text-gray-500 mt-1">
            {secondaryFarmgate
              ? `${secondaryFarmgate.qty.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })} ${secondaryFarmgate.qtyUnit} × ₱${secondaryFarmgate.priceLow.toFixed(
                  0
                )}–₱${secondaryFarmgate.priceHigh.toFixed(0)}/${
                  secondaryFarmgate.priceUnit
                }`
              : "Fill secondary yield (and optional price) to estimate value."}
          </p>
        </div>
      </div>
    )}

    {/* 4. TOTAL CROP VALUE CARD (bottom separate bordered div) */}
  
  </div>
</Section>


                  {/* Location & Notes */}
                  <Section
                    title="Location & notes"
                    subtitle="Where this field is located and any observations."
                  >
                    <div className="space-y-4">
                      <Field
                        label="Barangay"
                        required
                        error={errors.manualBarangay}
                      >
                        <Select
                          error={errors.manualBarangay}
                          required
                          value={manualBarangay}
                          onChange={(e) => {
                            setManualBarangay(e.target.value);
                            setFieldError("manualBarangay", "");
                          }}
                          onBlur={() => {
                            if (!manualBarangay)
                              setFieldError(
                                "manualBarangay",
                                "Please choose a barangay."
                              );
                          }}
                        >
                          <option value="">Select barangay</option>
                          {mergedBarangays.map((bgy) => (
                            <option key={bgy} value={bgy}>
                              {bgy}
                            </option>
                          ))}
                        </Select>

                        {(detectedBarangayName || selectedBarangay) &&
                          manualBarangay ===
                            (detectedBarangayName || selectedBarangay) && (
                            <span className="mt-1 inline-flex items-center gap-2 text-xs px-2 py-1 rounded-full bg-green-50 text-green-700 border border-green-200">
                              <span className="h-1.5 w-1.5 rounded-full bg-green-600" />
                              Auto-filled from map
                            </span>
                          )}
                      </Field>

                      <Field label="Notes">
                        <Textarea
                          rows={3}
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="Any observations or notes..."
                        />
                      </Field>

                      <Field
                        label="Photos"
                        hint={`JPG/PNG/WEBP up to ${MAX_PHOTO_MB}MB each (max ${MAX_PHOTO_COUNT} files)`}
                      >
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handlePhotosChange}
                          className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 bg-white text-sm cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:font-medium file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                        />
                      </Field>
                    </div>
                  </Section>
                </div>
              )}

              {currentStep === 3 && (
                <div className="space-y-7 animate-fadeIn">
                  <Section
                    title="Farmer details"
                    subtitle="Information of the owner / farmer of this field."
                  >
                    {/* Anonymous toggle */}
                    <div className="mb-4 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-3">
                      <label className="flex items-start gap-3 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                          checked={isAnonymousFarmer}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setIsAnonymousFarmer(checked);

                            if (checked) {
                              setErrors((prev) => ({
                                ...prev,
                                farmerFirstName: "",
                                farmerLastName: "",
                                farmerMobile: "",
                                farmerBarangay: "",
                                farmerAddress: "",
                                tenure: "",
                              }));
                            }
                          }}
                        />
                        <span>
                          <span className="font-medium">
                            Farmer prefers not to share personal details
                          </span>
                          <span className="block text-xs text-gray-500 mt-0.5">
                            If checked, name, mobile number, address, and tenure
                            will not be required.
                          </span>
                        </span>
                      </label>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Field
                        label="First name"
                        required={!isAnonymousFarmer}
                        error={errors.farmerFirstName}
                      >
                        <Input
                          type="text"
                          required={!isAnonymousFarmer}
                          disabled={isAnonymousFarmer}
                          value={farmerFirstName}
                          onChange={(e) => {
                            setFarmerFirstName(e.target.value);
                            setFieldError(
                              "farmerFirstName",
                              e.target.value.trim()
                                ? ""
                                : "First name is required."
                            );
                          }}
                          onBlur={() => {
                            if (!isAnonymousFarmer && !farmerFirstName.trim())
                              setFieldError(
                                "farmerFirstName",
                                "First name is required."
                              );
                          }}
                          placeholder="Juan"
                          error={errors.farmerFirstName}
                          className={
                            isAnonymousFarmer
                              ? "bg-gray-50 cursor-not-allowed"
                              : ""
                          }
                        />
                      </Field>

                      <Field
                        label="Last name"
                        required={!isAnonymousFarmer}
                        error={errors.farmerLastName}
                      >
                        <Input
                          type="text"
                          required={!isAnonymousFarmer}
                          disabled={isAnonymousFarmer}
                          value={farmerLastName}
                          onChange={(e) => {
                            setFarmerLastName(e.target.value);
                            setFieldError(
                              "farmerLastName",
                              e.target.value.trim()
                                ? ""
                                : "Last name is required."
                            );
                          }}
                          onBlur={() => {
                            if (!isAnonymousFarmer && !farmerLastName.trim())
                              setFieldError(
                                "farmerLastName",
                                "Last name is required."
                              );
                          }}
                          placeholder="Dela Cruz"
                          error={errors.farmerLastName}
                          className={
                            isAnonymousFarmer
                              ? "bg-gray-50 cursor-not-allowed"
                              : ""
                          }
                        />
                      </Field>
                    </div>

                    <Field
                      label="Mobile number"
                      required={!isAnonymousFarmer}
                      error={errors.farmerMobile}
                    >
                      <Input
                        type="text"
                        required={!isAnonymousFarmer}
                        disabled={isAnonymousFarmer}
                        inputMode="numeric"
                        pattern="^09\\d{9}$"
                        title="Use PH format: 09XXXXXXXXX"
                        value={farmerMobile}
                        onChange={(e) => {
                          setFarmerMobile(e.target.value);
                          const ok = /^09\d{9}$/.test(e.target.value);
                          setFieldError(
                            "farmerMobile",
                            ok ? "" : "Use PH format: 09XXXXXXXXX."
                          );
                        }}
                        onBlur={() => {
                          if (isAnonymousFarmer) return;
                          const ok = /^09\d{9}$/.test(farmerMobile);
                          if (!ok)
                            setFieldError(
                              "farmerMobile",
                              "Use PH format: 09XXXXXXXXX."
                            );
                        }}
                        placeholder="09123456789"
                        error={errors.farmerMobile}
                        className={
                          isAnonymousFarmer
                            ? "bg-gray-50 cursor-not-allowed"
                            : ""
                        }
                      />
                    </Field>

                    <Field
                      label="Barangay"
                      required={!isAnonymousFarmer}
                      error={errors.farmerBarangay}
                    >
                      <Select
                        error={errors.farmerBarangay}
                        required={!isAnonymousFarmer}
                        disabled={isAnonymousFarmer}
                        value={farmerBarangay}
                        onChange={(e) => {
                          setFarmerBarangay(e.target.value);
                          setFieldError("farmerBarangay", "");
                        }}
                        onBlur={() => {
                          if (!isAnonymousFarmer && !farmerBarangay)
                            setFieldError(
                              "farmerBarangay",
                              "Please choose a barangay."
                            );
                        }}
                        className={
                          isAnonymousFarmer
                            ? "bg-gray-50 cursor-not-allowed"
                            : ""
                        }
                      >
                        <option value="">Select barangay</option>
                        {mergedBarangays.map((bgy) => (
                          <option key={bgy} value={bgy}>
                            {bgy}
                          </option>
                        ))}
                      </Select>
                    </Field>

                    {/* Land tenure */}
                    <Field
                      label="Land tenure type"
                      required={!isAnonymousFarmer}
                      error={errors.tenure}
                    >
                      <Select
                        error={errors.tenure}
                        value={selectedTenureId}
                        disabled={isAnonymousFarmer}
                        onChange={(e) => {
                          setSelectedTenureId(e.target.value);
                          setFieldError("tenure", "");
                        }}
                        onBlur={() => {
                          if (!isAnonymousFarmer && !selectedTenureId)
                            setFieldError(
                              "tenure",
                              "Please choose land tenure type."
                            );
                        }}
                        className={
                          isAnonymousFarmer
                            ? "bg-gray-50 cursor-not-allowed"
                            : ""
                        }
                      >
                        <option value="">Select tenure type</option>
                        {tenureTypes.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </Select>
                    </Field>

                    <Field
                      label="Complete address"
                      required={!isAnonymousFarmer}
                      error={errors.farmerAddress}
                    >
                      <Input
                        type="text"
                        required={!isAnonymousFarmer}
                        disabled={isAnonymousFarmer}
                        value={farmerAddress}
                        onChange={(e) => {
                          setFarmerAddress(e.target.value);
                          setFieldError(
                            "farmerAddress",
                            e.target.value.trim()
                              ? ""
                              : "Complete address is required."
                          );
                        }}
                        onBlur={() => {
                          if (!isAnonymousFarmer && !farmerAddress.trim())
                            setFieldError(
                              "farmerAddress",
                              "Complete address is required."
                            );
                        }}
                        placeholder="House no., street, purok/sitio"
                        error={errors.farmerAddress}
                        className={
                          isAnonymousFarmer
                            ? "bg-gray-50 cursor-not-allowed"
                            : ""
                        }
                      />
                    </Field>
                  </Section>
                </div>
              )}

              {/* Step-level error */}
              {errors._form && <ErrorText>{errors._form}</ErrorText>}
            </form>
          </div>

          {/* Footer (sticky) */}
          <div className="sticky bottom-0 z-10 px-6 py-4 bg-white/95 backdrop-blur border-t border-gray-200 flex justify-between items-center gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>

            <div className="flex gap-3">
              {currentStep > 1 && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="flex items-center gap-2 px-5 py-2.5 bg-white border-2 border-gray-300 text-sm font-medium text-gray-700 rounded-xl hover:bg-gray-50 transition"
                >
                  <ArrowLeft size={18} /> Back
                </button>
              )}

              {currentStep < totalSteps ? (
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={
                    (currentStep === 1 && !isStep1Valid()) ||
                    (currentStep === 2 && !isStep2Valid())
                  }
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-600 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next <ArrowRight size={18} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleShowConfirmation}
                  disabled={!isStep3Valid()}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-600 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <SaveIcon size={18} /> Save
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ---------- Review Modal ---------- */}
      {showConfirmation && (
        <div
          className="fixed inset-0 z-[60] bg-black/60 p-4 flex items-center justify-center"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="sticky top-0 z-10 px-6 py-5 border-b bg-white/95 backdrop-blur">
              <h3 className="text-xl font-bold text-gray-900">Review details</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                Please confirm before saving this tagged crop.
              </p>
            </div>

            <div className="p-6 max-h-[62vh] overflow-y-auto space-y-6">
              <section>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Crop information
                </h4>
                <div className="mt-3 rounded-xl border border-gray-200">
                  {[
                    ["Crop", getCropTypeName()],
                    ...(selectedVarietyId ? [["Variety", getVarietyName()]] : []),
                    ...(String(selectedCropType) === "6" && vegCategoryMain
                      ? [["Vegetable category", vegCategoryMain]]
                      : []),
                    ["Cropping system", getCroppingSystemLabel()],
                    ...(isIntercropMode
                      ? [
                          [
                            "Main land %",
                            `${clampPct(mainLandPct)}% (${mainHectaresUsed.toFixed(
                              2
                            )} ha)`,
                          ],
                          [
                            "Secondary land %",
                            `${clampPct(
                              secondaryLandPct
                            )}% (${secondaryHectaresUsed.toFixed(2)} ha)`,
                          ],
                        ]
                      : []),
                    ...(isIntercropMode && interCropTypeId
                      ? [["Secondary crop", getSecondaryCropTypeName()]]
                      : []),
                    ...(isIntercropMode && intercropVarietyId
                      ? [["Secondary variety", getSecondaryVarietyName()]]
                      : []),
                    ...(isRelayMode && relayPlantedDate
                      ? [
                          [
                            "Relay planted",
                            new Date(relayPlantedDate).toLocaleDateString(),
                          ],
                        ]
                      : []),
                    ...(isRelayMode && relayEstimatedHarvest
                      ? [
                          [
                            "Relay harvest",
                            new Date(relayEstimatedHarvest).toLocaleDateString(),
                          ],
                        ]
                      : []),
                    [
                      "Planted",
                      plantedDate
                        ? new Date(plantedDate).toLocaleDateString()
                        : "—",
                    ],
                    ...(estimatedHarvest
                      ? [
                          [
                            "Harvest",
                            new Date(estimatedHarvest).toLocaleDateString(),
                          ],
                        ]
                      : []),
                    ["Total area", hectares ? `${hectares} ha` : "—"],
                    ...(avgElevation
                      ? [["Avg elevation", `${avgElevation} m`]]
                      : []),
                    ...(estimatedVolume
                      ? [
                          [
                            "Main est. yield",
                            `${estimatedVolume} ${
                              yieldUnitMap[selectedCropType] || "units"
                            }`,
                          ],
                        ]
                      : []),
                    ...(isIntercropMode &&
                    secondaryEstimatedVolume &&
                    interCropTypeId
                      ? [
                          [
                            "Secondary est. yield",
                            `${secondaryEstimatedVolume} ${
                              yieldUnitMap[interCropTypeId] || "units"
                            }`,
                          ],
                        ]
                      : []),
                    [
                      "Barangay",
                      manualBarangay || detectedBarangayName || "—",
                    ],
                    ...(selectedCropType && ecosystems.length > 0
                      ? [
                          [
                            "Ecosystem",
                            ecosystems.find(
                              (e) =>
                                String(e.id) === String(selectedEcosystem)
                            )?.name || "—",
                          ],
                        ]
                      : []),
                    ...(mainFarmgateExact != null
  ? [
      [
        "Main farmgate value (PHP)",
        `₱${peso(mainFarmgateExact)}`,
      ],
    ]
  : []),

...(isIntercropMode && secondaryFarmgateExact != null
  ? [
      [
        "Secondary farmgate value (PHP)",
        `₱${peso(secondaryFarmgateExact)}`,
      ],
    ]
  : []),

...(totalFarmgateExact != null
  ? [
      [
        "Total crop value (PHP)",
        `₱${peso(totalFarmgateExact)}`,
      ],
    ]
  : []),

                    ["Conversion used", conversionSummary],
                    ...(mainPrice
                      ? [
                          [
                            "Main desired price",
                            `${mainPrice} ${mainPriceUnitLabel}`,
                          ],
                        ]
                      : []),
                    ...(secondaryPrice
                      ? [
                          [
                            "Secondary desired price",
                            `${secondaryPrice} ${secondaryPriceUnitLabel}`,
                          ],
                        ]
                      : []),
                  ].map(([k, v], i, a) => (
                    <div
                      key={k}
                      className={`flex items-center justify-between px-4 py-3 ${
                        i < a.length - 1 ? "border-b border-gray-200" : ""
                      }`}
                    >
                      <span className="text-sm text-gray-600">{k}</span>
                      <span className="text-sm font-semibold text-gray-900 text-right">
                        {v}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Farmer information
                </h4>
                <div className="mt-3 rounded-xl border border-gray-200">
                  {[
                    [
                      "Name",
                      isAnonymousFarmer
                        ? "Anonymous farmer"
                        : `${farmerFirstName} ${farmerLastName}`.trim(),
                    ],
                    ["Mobile", isAnonymousFarmer ? "—" : farmerMobile],
                    ["Barangay", isAnonymousFarmer ? "—" : farmerBarangay],
                    ["Land tenure", isAnonymousFarmer ? "—" : getTenureLabel()],
                    ["Address", isAnonymousFarmer ? "—" : farmerAddress],
                  ].map(([k, v], i, a) => (
                    <div
                      key={k}
                      className={`flex items-start justify-between px-4 py-3 ${
                        i < a.length - 1 ? "border-gray-200 border-b" : ""
                      }`}
                    >
                      <span className="text-sm text-gray-600">{k}</span>
                      <span className="text-sm font-semibold text-gray-900 text-right max-w-[60%] break-words">
                        {v || "—"}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div className="sticky bottom-0 z-10 px-6 py-4 bg-white/95 backdrop-blur border-t border-gray-200 flex gap-3">
              <button
                onClick={() => setShowConfirmation(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                Go back
              </button>
              <button
                onClick={handleSubmit}
                className="flex-1 px-4 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-sm font-semibold text-white transition"
              >
                Confirm &amp; Save
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn { animation: fadeIn 0.20s ease-out; }
      `}</style>
    </div>
  );
};

export default TagCropForm;
