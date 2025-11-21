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

/* ---------- THEME (anchor to your look) ---------- */
const THEME = {
  primary: "green-600",
  primaryHover: "green-700",
  subtle: "green-100",
  text: "gray-900",
  subtext: "gray-600",
  border: "gray-200",
  panel: "white",
  overlay: "black/40",
};

/* ---------- CONFIG ---------- */
const STANDARD_MATURITY_DAYS = {
  1: 100,
  2: 110,
  3: 360,
  4: 365,
  5: 300,
  6: 60,
};
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

// NEW: lookup table for cropping system IDs
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

/* ---------- Geo helpers using your barangay GeoJSON ---------- */
function getBarangayName(props) {
  return (
    props?.Barangay ?? props?.barangay ?? props?.NAME ?? props?.name ?? ""
  );
}

function listBarangayNamesFromFC(barangaysFC) {
  const set = new Set();
  for (const f of barangaysFC?.features || []) {
    const n = getBarangayName(f.properties || {});
    if (n) set.add(String(n));
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
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

/* ---------- REUSABLE FIELD WRAPPERS ---------- */
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

const baseInputClasses =
  "w-full rounded-xl px-4 py-3 bg-white text-base focus:outline-none focus:ring-2";

function decorateClasses(hasError) {
  // When error, force red; else use theme
  return hasError
    ? ["border-2 border-red-500 focus:ring-red-500 focus:border-red-500"]
    : [
        `border-2 border-${THEME.border} focus:ring-${THEME.primary} focus:border-${THEME.primary}`,
      ];
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

/** Compact input with a right-side unit (reduces the big internal gap) */
const SuffixInput = ({ suffix, error, inputProps }) => (
  <div className="relative">
    <input
      {...inputProps}
      className={[
        baseInputClasses,
        "pr-12", // tighter right padding
        ...decorateClasses(!!error),
        inputProps?.className || "",
      ].join(" ")}
    />
    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 select-none">
      {suffix}
    </span>
  </div>
);

/* ---------- COMPONENT ---------- */
const TagCropForm = ({
  onCancel,
  onSave,
  defaultLocation,
  adminId,

  // NEW: pass your full Barangay FeatureCollection (Ma-ao, Taloc, Dulao, …)
  barangaysFC,

  // NEW: pass the drawn/edited farm polygon (GeoJSON Polygon or MultiPolygon)
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

  // NEW: secondary crop yield
  const [secondaryEstimatedVolume, setSecondaryEstimatedVolume] = useState("");
  const [secondaryVolumeTouched, setSecondaryVolumeTouched] = useState(false);
  // NEW: secondary crop area (ha)
  const [secondaryHectares, setSecondaryHectares] = useState("");

  // NEW: intercropping
  const [croppingSystemId, setCroppingSystemId] = useState("1");
  const [isIntercropped, setIsIntercropped] = useState(false);
  const [interCropTypeId, setInterCropTypeId] = useState("");
  const [intercropVarieties, setIntercropVarieties] = useState([]);
  const [intercropVarietyId, setIntercropVarietyId] = useState("");

  // Farmer
  const [farmerFirstName, setFarmerFirstName] = useState("");
  const [farmerLastName, setFarmerLastName] = useState("");
  const [farmerMobile, setFarmerMobile] = useState("");
  const [farmerBarangay, setFarmerBarangay] = useState("");
  const [farmerAddress, setFarmerAddress] = useState("");

  // Ecosystems
  const [ecosystems, setEcosystems] = useState([]);
  const [selectedEcosystem, setSelectedEcosystem] = useState("");

  // Review Modal
  const [showConfirmation, setShowConfirmation] = useState(false);

  // NEW: detected barangay feature
  const [detectedBarangayName, setDetectedBarangayName] = useState("");
  const [detectedBarangayFeature, setDetectedBarangayFeature] = useState(null);

  // NEW: elevation (meters)
  const [avgElevation, setAvgElevation] = useState("");

  // Errors
  const [errors, setErrors] = useState({});

  /* ---------- EFFECTS / DERIVED ---------- */

  // Build the dropdown list
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

  // Try to detect barangay from the farm polygon
  useEffect(() => {
    const res = detectBarangayFeature(farmGeometry, barangaysFC);
    if (res?.name) {
      setDetectedBarangayName(res.name);
      setDetectedBarangayFeature(res.feature || null);

      // Prefill the Location field (step 1) if empty
      setManualBarangay((cur) => cur || res.name);

      // Prefill Farmer Barangay (step 2) if empty
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

  // If user picks a Location barangay (Step 1), auto-fill Farmer barangay if still empty
  useEffect(() => {
    if (manualBarangay && !farmerBarangay) {
      setFarmerBarangay(manualBarangay);
    }
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

  const autoVolumeCandidate = useMemo(() => {
    const yph = yieldPerHectare[selectedCropType];
    const ha = Number(hectares);
    if (!yph || !Number.isFinite(ha) || ha <= 0) return "";
    return (yph * ha).toFixed(2);
  }, [selectedCropType, hectares]);

  // NEW: secondary auto volume candidate based on secondary crop type + secondary area (or full area if blank)
  const secondaryAutoVolumeCandidate = useMemo(() => {
    const yph = yieldPerHectare[interCropTypeId];
    const ha = Number(secondaryHectares || hectares);
    if (!yph || !Number.isFinite(ha) || ha <= 0) return "";
    return (yph * ha).toFixed(2);
  }, [interCropTypeId, hectares, secondaryHectares]);

  useEffect(() => {
    if (!harvestTouched) setEstimatedHarvest(autoHarvestCandidate || "");
  }, [autoHarvestCandidate, harvestTouched]);

  useEffect(() => {
    if (!volumeTouched) setEstimatedVolume(autoVolumeCandidate || "");
  }, [autoVolumeCandidate, volumeTouched]);

  // NEW: auto-fill secondary estimated volume if user hasn't touched it
  useEffect(() => {
    if (!secondaryVolumeTouched) {
      setSecondaryEstimatedVolume(secondaryAutoVolumeCandidate || "");
    }
  }, [secondaryAutoVolumeCandidate, secondaryVolumeTouched]);

  // Crop types
  useEffect(() => {
    fetch("http://localhost:5000/api/crops/types")
      .then((res) => res.json())
      .then((data) => setCropTypes(data))
      .catch((err) => console.error("Failed to load crop types:", err));
  }, []);

  // Default hectares from defaultLocation
  useEffect(() => {
    if (defaultLocation?.hectares) setHectares(defaultLocation.hectares);
  }, [defaultLocation]);

  // NEW: default avg elevation from defaultLocation (meters)
  useEffect(() => {
    if (
      defaultLocation &&
      typeof defaultLocation.avgElevationM === "number" &&
      !Number.isNaN(defaultLocation.avgElevationM)
    ) {
      setAvgElevation(defaultLocation.avgElevationM.toFixed(1));
    }
  }, [defaultLocation]);

  // (kept from earlier for safety)
  useEffect(() => {
    if (selectedBarangay && !manualBarangay) setManualBarangay(selectedBarangay);
  }, [selectedBarangay]); // eslint-disable-line

  // Varieties for selected crop
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

  // Varieties for SECOND (intercrop) crop
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

  /* ---------- VALIDATION ---------- */

  const setFieldError = (field, message) =>
    setErrors((e) => ({ ...e, [field]: message || "" }));

  const validateStep1 = () => {
    const newErr = {};

    if (!selectedCropType)
      newErr.selectedCropType = "Please select a crop type.";

    if ((ecosystems?.length || 0) > 0 && !selectedEcosystem) {
      newErr.selectedEcosystem = "Please select an ecosystem.";
    }

    if (!plantedDate) {
      newErr.plantedDate = "Please select the planting date.";
    }

    const h = Number(hectares);
    if (!hectares || !Number.isFinite(h) || h <= 0) {
      newErr.hectares = "Area must be a number greater than 0.";
    }

    if (estimatedHarvest) {
      const p = new Date(plantedDate);
      const eh = new Date(estimatedHarvest);
      if (plantedDate && eh < p) {
        newErr.estimatedHarvest =
          "Harvest date cannot be before planting date.";
      }
    }

    if (!manualBarangay) newErr.manualBarangay = "Please choose a barangay.";

    setErrors((prev) => ({ ...prev, ...newErr }));
    return Object.keys(newErr).length === 0;
  };

  const validateStep2 = () => {
    const newErr = {};

    if (!farmerFirstName.trim())
      newErr.farmerFirstName = "First name is required.";
    if (!farmerLastName.trim())
      newErr.farmerLastName = "Last name is required.";

    const phoneRegex = /^09\d{9}$/;
    if (!farmerMobile) {
      newErr.farmerMobile = "Mobile number is required.";
    } else if (!phoneRegex.test(farmerMobile)) {
      newErr.farmerMobile = "Use PH format: 09XXXXXXXXX.";
    }

    if (!farmerBarangay) newErr.farmerBarangay = "Please choose a barangay.";
    if (!farmerAddress.trim())
      newErr.farmerAddress = "Complete address is required.";

    if ((croppingSystemId !== "1" || isIntercropped) && !interCropTypeId) {
      newErr.interCropTypeId = "Please select the secondary crop type.";
    }

    setErrors((prev) => ({ ...prev, ...newErr }));
    return Object.keys(newErr).length === 0;
  };

  const isStep1Valid = () =>
    selectedCropType &&
    plantedDate &&
    hectares &&
    manualBarangay &&
    (!(ecosystems?.length > 0) || selectedEcosystem) &&
    // if intercropped → require secondary crop type
    !((croppingSystemId !== "1" || isIntercropped) && !interCropTypeId);

  const isStep2Valid = () =>
    farmerFirstName &&
    farmerLastName &&
    farmerMobile &&
    farmerBarangay &&
    farmerAddress;

  /* ---------- HANDLERS ---------- */
  const handleShowConfirmation = () => {
    const ok = validateStep2();
    if (!ok) return;
    setShowConfirmation(true);
  };

  const handleNext = () => {
    const ok = validateStep1();
    if (currentStep === 1 && ok) {
      // If farmer barangay still empty, mirror the chosen/detected one
      if (!farmerBarangay) {
        setFarmerBarangay(
          manualBarangay || detectedBarangayName || selectedBarangay || ""
        );
      }
      setCurrentStep(2);
    }
  };

  const handleBack = () => currentStep > 1 && setCurrentStep(currentStep - 1);

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

  const handleSubmit = async (e) => {
    e?.preventDefault?.();

    // Validate both steps before final submit
    const ok1 = validateStep1();
    const ok2 = validateStep2();
    if (!(ok1 && ok2)) return;

    setShowConfirmation(false);

    // Prefer caller-provided, else derive coordinates from farmGeometry (outer ring)
    const coordsFromDefault = defaultLocation?.coordinates || [];
    const coordsFromFarm =
      farmGeometry?.type === "Polygon"
        ? farmGeometry.coordinates?.[0] || []
        : farmGeometry?.type === "MultiPolygon"
        ? farmGeometry.coordinates?.[0]?.[0] || []
        : [];
    const farmCoords = coordsFromDefault.length ? coordsFromDefault : coordsFromFarm;
    const croppingSystemKey =
      CROPPING_SYSTEM_KEYS[croppingSystemId] || "monocrop";

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

    // NEW: intercropping fields
    formData.append("cropping_system_id", croppingSystemId || ""); // numeric (1..5) → stored in tbl_crops
    formData.append("cropping_system", croppingSystemKey); // string     → used for labels/descriptions
    formData.append("is_intercropped", isIntercropped ? "1" : "0");
    formData.append("intercrop_crop_type_id", interCropTypeId || "");
    formData.append("intercrop_variety_id", intercropVarietyId || "");
    formData.append(
      "intercrop_estimated_volume",
      secondaryEstimatedVolume || ""
    );
    // NEW: secondary area (ha) – if blank, fall back to full field area
    formData.append(
      "intercrop_hectares",
      secondaryHectares || hectares || ""
    );

    // keep your original coordinates field (not displayed in UI)
    formData.append("coordinates", JSON.stringify(farmCoords));

    // prefer manual selection; fall back to detection
    const finalBarangay =
      manualBarangay || detectedBarangayName || selectedBarangay || "";
    formData.append("barangay", finalBarangay);

    // include detected feature details
    formData.append("detected_barangay_name", detectedBarangayName || "");
    formData.append(
      "detected_barangay_feature_properties",
      JSON.stringify(detectedBarangayFeature?.properties || {})
    );
    formData.append(
      "detected_barangay_feature_geometry",
      JSON.stringify(detectedBarangayFeature?.geometry || {})
    );

    // 🔹 include average elevation (meters, optional)
    formData.append("avg_elevation_m", avgElevation || "");

    if (adminId) formData.append("admin_id", String(adminId));

    formData.append("farmer_first_name", farmerFirstName || "");
    formData.append("farmer_last_name", farmerLastName || "");
    formData.append("farmer_mobile", farmerMobile || "");
    formData.append("farmer_barangay", farmerBarangay || "");
    formData.append("full_address", farmerAddress || "");

    if (photos) {
      for (let i = 0; i < photos.length; i++) formData.append("photos", photos[i]);
    }

    await onSave(formData);

    // Reset
    setCurrentStep(1);
    setHectares("");
    setSelectedCropType("");
    setSelectedVarietyId("");
    setPlantedDate("");
    setManualBarangay(finalBarangay || "");
    setEstimatedHarvest("");
    setHarvestTouched(false);
    setEstimatedVolume("");
    setVolumeTouched(false);
    setSecondaryEstimatedVolume("");
    setSecondaryVolumeTouched(false);
    setSecondaryHectares("");
    setNote("");
    setPhotos(null);
    setFarmerFirstName("");
    setFarmerLastName("");
    setFarmerMobile("");
    setFarmerBarangay("");
    setFarmerAddress("");
    setSelectedEcosystem("");
    setAvgElevation(""); // 🔹 reset elevation
    setErrors({});
  };

  const getCropTypeName = () => {
    const crop = cropTypes.find((c) => c.id === selectedCropType);
    return crop ? crop.name : "—";
  };
  const getVarietyName = () => {
    const variety = dynamicVarieties.find(
      (v) => v.id === parseInt(selectedVarietyId)
    );
    return variety ? variety.name : "—";
  };

  // NEW: label helper for cropping system (uses CROPPING_SYSTEMS so it's not unused)
  const getCroppingSystemLabel = () => {
    const idNum = Number(croppingSystemId);
    return CROPPING_SYSTEMS[idNum] || "Monocrop";
  };

  /* ---------- UI ---------- */
  return (
    <div
      className={`fixed inset-0 bg-${THEME.overlay} backdrop-blur-sm z-50 flex items-center justify-center p-4`}
    >
      <div
        className={`bg-${THEME.panel} rounded-2xl shadow-2xl w-full max-w-2xl max-h-[86vh] overflow-hidden flex flex-col`}
      >
        {/* Header (STICKY) */}
        <div
          className={`sticky top-0 z-10 px-6 md:px-8 pt-6 pb-4 bg-white/95 backdrop-blur border-b`}
        >
          <h2
            className={`text-xl md:text-2xl font-bold text-${THEME.text} text-center`}
          >
            Tag Crop
          </h2>

          {/* Stepper */}
          <div className="mt-3 mx-auto w-full max-w-sm">
            <div className="flex items-center justify-center gap-2 md:gap-3">
              <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${
                  currentStep === 1
                    ? `bg-${THEME.subtle} text-${THEME.primary}`
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                <span
                  className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
                    currentStep === 1
                      ? `bg-${THEME.primary} text-white`
                      : "bg-gray-300 text-gray-600"
                  }`}
                >
                  1
                </span>
                <span className="text-sm font-semibold">Crop</span>
              </div>

              <div className="h-px w-8 bg-gray-200" />

              <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${
                  currentStep === 2
                    ? `bg-${THEME.subtle} text-${THEME.primary}`
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                <span
                  className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
                    currentStep === 2
                      ? `bg-${THEME.primary} text-white`
                      : "bg-gray-300 text-gray-600"
                  }`}
                >
                  2
                </span>
                <span className="text-sm font-semibold">Farmer</span>
              </div>
            </div>
            <div className="mt-3 h-1 rounded bg-gray-100">
              <div
                className={`h-1 rounded bg-${THEME.primary} transition-all duration-300 ${
                  currentStep === 1 ? "w-1/2" : "w-full"
                }`}
              />
            </div>
            <p className="mt-2 text-center text-sm text-gray-500">
              {currentStep === 1 ? "Enter crop details" : "Enter farmer details"}
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 md:px-8 pb-3">
          <form onSubmit={handleSubmit} ref={formRef} className="space-y-2">
            {currentStep === 1 && (
              <div className="space-y-6 animate-fadeIn">
                {/* Section: Crop Basics */}
                <h5 className="text-xs font-semibold tracking-wider text-gray-500 uppercase">
                  Crop Basics
                </h5>

                <div className="space-y-4">
                  <Field
                    label="Crop Type"
                    required
                    error={errors.selectedCropType}
                  >
                    <Select
                      error={errors.selectedCropType}
                      required
                      value={selectedCropType}
                      onChange={(e) => {
                        const id = parseInt(e.target.value);
                        setSelectedCropType(Number.isFinite(id) ? id : "");
                        setSelectedVarietyId("");
                        setFieldError("selectedCropType", "");
                      }}
                      onBlur={() => {
                        if (!selectedCropType)
                          setFieldError(
                            "selectedCropType",
                            "Please select a crop type."
                          );
                      }}
                    >
                      <option value="">Select Crop Type</option>
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
                        <option value="">Select Ecosystem</option>
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
                      <option value="">Select Variety (Optional)</option>
                      {dynamicVarieties.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>

                <div className="my-2 h-px bg-gray-100" />

                {/* Section: Dates */}
                <h5 className="text-xs font-semibold tracking-wider text-gray-500 uppercase">
                  Dates
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field
                    label="Date Planted"
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
                        // if harvest already set, re-check ordering
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
                    label="Est. Harvest"
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

                <div className="my-2 h-px bg-gray-100" />

                {/* Section: Cropping System / Intercropping */}
                <h5 className="text-xs font-semibold tracking-wider text-gray-500 uppercase">
                  Cropping System
                </h5>

                <div className="space-y-4">
                  <Field label="Cropping System" required>
                    <Select
                      value={croppingSystemId}
                      onChange={(e) => {
                        const value = e.target.value; // "1".."5"
                        setCroppingSystemId(value);

                        if (value === "1") {
                          // Monocrop → no secondary crop
                          setIsIntercropped(false);
                          setInterCropTypeId("");
                          setIntercropVarietyId("");
                          setSecondaryVolumeTouched(false);
                          setSecondaryEstimatedVolume("");
                          setSecondaryHectares("");
                          setFieldError("interCropTypeId", "");
                        } else {
                          // Any of 2,3,4,5 = some kind of intercropping
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

                  <Field label="Is this field intercropped?">
                    <div className="flex items-center gap-2">
                      <input
                        id="isIntercropped"
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                        checked={isIntercropped}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setIsIntercropped(checked);
                          if (!checked && croppingSystemId === "1") {
                            setInterCropTypeId("");
                            setIntercropVarietyId("");
                            setSecondaryVolumeTouched(false);
                            setSecondaryEstimatedVolume("");
                            setSecondaryHectares("");
                            setFieldError("interCropTypeId", "");
                          }
                        }}
                      />
                      <label
                        htmlFor="isIntercropped"
                        className="text-sm text-gray-600 select-none"
                      >
                        Yes, there is a second crop in this area.
                      </label>
                    </div>
                  </Field>

                  {(croppingSystemId !== "1" || isIntercropped) && (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Field
                          label="Secondary Crop Type"
                          required
                          error={errors.interCropTypeId}
                        >
                          <Select
                            error={errors.interCropTypeId}
                            value={interCropTypeId}
                            onChange={(e) => {
                              const id = parseInt(e.target.value);
                              setInterCropTypeId(Number.isFinite(id) ? id : "");
                              setSecondaryVolumeTouched(false); // let auto-calc refresh for new crop
                              setFieldError(
                                "interCropTypeId",
                                Number.isFinite(id)
                                  ? ""
                                  : "Please select the secondary crop type."
                              );
                            }}
                            onBlur={() => {
                              if (!interCropTypeId) {
                                setFieldError(
                                  "interCropTypeId",
                                  "Please select the secondary crop type."
                                );
                              }
                            }}
                          >
                            <option value="">
                              Select Secondary Crop Type
                            </option>
                            {cropTypes.map((type) => (
                              <option key={type.id} value={type.id}>
                                {type.name}
                              </option>
                            ))}
                          </Select>
                        </Field>

                        <Field label="Secondary Variety">
                          <Select
                            value={intercropVarietyId}
                            onChange={(e) =>
                              setIntercropVarietyId(e.target.value)
                            }
                          >
                            <option value="">Select Variety (Optional)</option>
                            {intercropVarieties.map((v) => (
                              <option key={v.id} value={v.id}>
                                {v.name}
                              </option>
                            ))}
                          </Select>
                        </Field>
                      </div>

                      {/* NEW: Secondary Area */}
                      <Field
                        label="Secondary Area (ha)"
                        hint="How much of this field is planted with the secondary crop."
                      >
                        <SuffixInput
                          suffix="ha"
                          inputProps={{
                            type: "number",
                            min: "0",
                            step: "0.01",
                            value: secondaryHectares,
                            onChange: (e) =>
                              setSecondaryHectares(e.target.value),
                            placeholder: hectares || "0.00",
                            className: "text-right",
                          }}
                        />
                      </Field>

                      {/* Secondary Est. Yield */}
                      {interCropTypeId && (
                        <Field
                          label={`Secondary Est. Yield ${
                            yieldUnitMap[interCropTypeId]
                              ? `(${yieldUnitMap[interCropTypeId]})`
                              : ""
                          }`}
                          hint="Auto-calculated from area × typical yield; you can override."
                        >
                          <SuffixInput
                            suffix={yieldUnitMap[interCropTypeId] || "units"}
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
                      )}
                    </>
                  )}
                </div>

                <div className="my-2 h-px bg-gray-100" />

                {/* Section: Area & Yield */}
                <h5 className="text-xs font-semibold tracking-wider text-gray-500 uppercase">
                  Area &amp; Yield
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Area (ha)" required error={errors.hectares}>
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
                            !e.target.value || !Number.isFinite(v) || v <= 0
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
                    label={`Est. Yield ${
                      yieldUnitMap[selectedCropType]
                        ? `(${yieldUnitMap[selectedCropType]})`
                        : ""
                    }`}
                    hint="We estimate from area × typical yield. You can override."
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

                {/* NEW: elevation display */}
                <Field
                  label="Avg Elevation (m)"
                  hint="Approximate from terrain data (optional, read-only)."
                >
                  <SuffixInput
                    suffix="m"
                    inputProps={{
                      type: "number",
                      readOnly: true,
                      value: avgElevation,
                      placeholder: "Auto from map",
                      className: "text-right bg-gray-50 cursor-not-allowed",
                    }}
                  />
                </Field>

                <div className="my-2 h-px bg-gray-100" />

                {/* Section: Location & Notes */}
                <h5 className="text-xs font-semibold tracking-wider text-gray-500 uppercase">
                  Location &amp; Notes
                </h5>
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
                      <option value="">Select Barangay</option>
                      {mergedBarangays.map((bgy) => (
                        <option key={bgy} value={bgy}>
                          {bgy}
                        </option>
                      ))}
                    </Select>
                    {(detectedBarangayName || selectedBarangay) &&
                      manualBarangay ===
                        (detectedBarangayName || selectedBarangay) && (
                        <div
                          className={`mt-1 inline-flex items-center gap-2 text-xs px-2 py-1 rounded-full bg-${THEME.subtle} text-${THEME.primary}`}
                        >
                          Auto-filled from map
                        </div>
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
                    hint={`JPG/PNG/WebP up to ${MAX_PHOTO_MB}MB each (max ${MAX_PHOTO_COUNT} files)`}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handlePhotosChange}
                      className={[
                        "w-full border-2 rounded-xl px-4 py-3 bg-white text-base cursor-pointer",
                        `border-${THEME.border}`,
                        "file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:font-medium",
                        `file:bg-${THEME.subtle} file:text-${THEME.primary}`,
                        `hover:file:bg-${THEME.subtle}`,
                      ].join(" ")}
                    />
                  </Field>
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-6 animate-fadeIn">
                <h5 className="text-xs font-semibold tracking-wider text-gray-500 uppercase">
                  Farmer Details
                </h5>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field
                    label="First Name"
                    required
                    error={errors.farmerFirstName}
                  >
                    <Input
                      type="text"
                      required
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
                        if (!farmerFirstName.trim())
                          setFieldError(
                            "farmerFirstName",
                            "First name is required."
                          );
                      }}
                      placeholder="Juan"
                      error={errors.farmerFirstName}
                    />
                  </Field>

                  <Field
                    label="Last Name"
                    required
                    error={errors.farmerLastName}
                  >
                    <Input
                      type="text"
                      required
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
                        if (!farmerLastName.trim())
                          setFieldError(
                            "farmerLastName",
                            "Last name is required."
                          );
                      }}
                      placeholder="Dela Cruz"
                      error={errors.farmerLastName}
                    />
                  </Field>
                </div>

                <Field
                  label="Mobile Number"
                  required
                  error={errors.farmerMobile}
                >
                  <Input
                    type="text"
                    required
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
                      const ok = /^09\d{9}$/.test(farmerMobile);
                      if (!ok)
                        setFieldError(
                          "farmerMobile",
                          "Use PH format: 09XXXXXXXXX."
                        );
                    }}
                    placeholder="09123456789"
                    error={errors.farmerMobile}
                  />
                </Field>

                <Field
                  label="Barangay"
                  required
                  error={errors.farmerBarangay}
                >
                  <Select
                    error={errors.farmerBarangay}
                    required
                    value={farmerBarangay}
                    onChange={(e) => {
                      setFarmerBarangay(e.target.value);
                      setFieldError("farmerBarangay", "");
                    }}
                    onBlur={() => {
                      if (!farmerBarangay)
                        setFieldError(
                          "farmerBarangay",
                          "Please choose a barangay."
                        );
                    }}
                  >
                    <option value="">Select Barangay</option>
                    {mergedBarangays.map((bgy) => (
                      <option key={bgy} value={bgy}>
                        {bgy}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field
                  label="Complete Address"
                  required
                  error={errors.farmerAddress}
                >
                  <Input
                    type="text"
                    required
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
                      if (!farmerAddress.trim())
                        setFieldError(
                          "farmerAddress",
                          "Complete address is required."
                        );
                    }}
                    placeholder="House No., Street, Purok/Sitio"
                    error={errors.farmerAddress}
                  />
                </Field>
              </div>
            )}
          </form>
        </div>

        {/* Footer (STICKY) */}
        <div className="sticky bottom-0 z-10 px-6 md:px-8 py-4 bg-white/95 backdrop-blur border-t border-gray-200 flex justify-between items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 text-gray-600 hover:text-gray-800 font-medium transition"
          >
            Cancel
          </button>

          <div className="flex gap-3">
            {currentStep > 1 && (
              <button
                type="button"
                onClick={handleBack}
                className="flex items-center gap-2 px-5 py-2.5 bg-white border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition font-medium"
              >
                <ArrowLeft size={18} /> Back
              </button>
            )}

            {currentStep < 2 ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={!isStep1Valid()}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-white font-medium transition disabled:opacity-40 disabled:cursor-not-allowed bg-${THEME.primary} hover:bg-${THEME.primaryHover}`}
              >
                Next <ArrowRight size={18} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleShowConfirmation}
                disabled={!isStep2Valid()}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-white font-medium transition disabled:opacity-40 disabled:cursor-not-allowed bg-${THEME.primary} hover:bg-${THEME.primaryHover}`}
              >
                <SaveIcon size={18} /> Save
              </button>
            )}
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
            {/* sticky header */}
            <div className="sticky top-0 z-10 px-6 py-5 border-b bg-white/95 backdrop-blur">
              <h3 className="text-xl font-bold text-gray-900">
                Review Details
              </h3>
              <p className="text-sm text-gray-500 mt-0.5">
                Please verify before saving.
              </p>
            </div>

            <div className="p-6 max-h-[62vh] overflow-y-auto">
              {/* Crop */}
              <section>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Crop Information
                </h4>
                <div className="mt-3 rounded-xl border">
                  {[
                    ["Crop", getCropTypeName()],
                    ...(selectedVarietyId
                      ? [["Variety", getVarietyName()]]
                      : []),
                    ["Cropping System", getCroppingSystemLabel()],
                    ...(interCropTypeId
                      ? [
                          [
                            "Secondary Crop",
                            cropTypes.find((c) => c.id === interCropTypeId)
                              ?.name || "—",
                          ],
                        ]
                      : []),
                    ...(intercropVarietyId
                      ? [
                          [
                            "Secondary Variety",
                            intercropVarieties.find(
                              (v) => v.id === parseInt(intercropVarietyId)
                            )?.name || "—",
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
                    ["Area", `${hectares} ha`],
                    ...(avgElevation
                      ? [["Avg Elevation", `${avgElevation} m`]]
                      : []),
                    ...(estimatedVolume
                      ? [
                          [
                            "Estimated Yield",
                            `${estimatedVolume} ${
                              yieldUnitMap[selectedCropType] || "units"
                            }`,
                          ],
                        ]
                      : []),
                    ...(secondaryEstimatedVolume && interCropTypeId
                      ? [
                          [
                            "Secondary Estimated Yield",
                            `${secondaryEstimatedVolume} ${
                              yieldUnitMap[interCropTypeId] || "units"
                            }`,
                          ],
                        ]
                      : []),
                    [
                      "Location",
                      manualBarangay || detectedBarangayName || "—",
                    ],
                    ...(selectedCropType && ecosystems.length > 0
                      ? [
                          [
                            "Ecosystem",
                            ecosystems.find(
                              (e) => e.id === parseInt(selectedEcosystem)
                            )?.name || "—",
                          ],
                        ]
                      : []),
                  ].map(([k, v], i, a) => (
                    <div
                      key={k}
                      className={`flex items-center justify-between px-4 py-3 ${
                        i < a.length - 1 ? "border-b" : ""
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

              {/* Farmer */}
              <section className="mt-6">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Farmer Information
                </h4>
                <div className="mt-3 rounded-xl border">
                  {[
                    ["Name", `${farmerFirstName} ${farmerLastName}`],
                    ["Mobile", farmerMobile],
                    ["Barangay", farmerBarangay],
                    ["Address", farmerAddress],
                  ].map(([k, v], i, a) => (
                    <div
                      key={k}
                      className={`flex items-start justify-between px-4 py-3 ${
                        i < a.length - 1 ? "border-b" : ""
                      }`}
                    >
                      <span className="text-sm text-gray-600">{k}</span>
                      <span className="text-sm font-semibold text-gray-900 text-right max-w-[60%]">
                        {v}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {/* sticky footer */}
            <div className="sticky bottom-0 z-10 px-6 py-4 bg-white/95 backdrop-blur border-t flex gap-3">
              <button
                onClick={() => setShowConfirmation(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border text-gray-700 hover:bg-gray-50 transition"
              >
                Go Back
              </button>
              <button
                onClick={handleSubmit}
                className={`flex-1 px-4 py-2.5 rounded-xl bg-${THEME.primary} hover:bg-${THEME.primaryHover} text-white font-semibold transition`}
              >
                Confirm &amp; Save
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px);} to { opacity: 1; transform: translateY(0);} }
        .animate-fadeIn { animation: fadeIn 0.20s ease-out; }
      `}</style>
    </div>
  );
};

export default TagCropForm;
