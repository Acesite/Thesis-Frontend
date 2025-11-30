// components/User/TagCropForm.js
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
  // When error, force red; else use green theme
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
  {
    id: 1,
    title: "Crop & dates",
    subtitle: "Crop type, ecosystem, planting",
  },
  {
    id: 2,
    title: "Area & location",
    subtitle: "Cropping system, area, barangay",
  },
  {
    id: 3,
    title: "Farmer details",
    subtitle: "Owner / farmer information",
  },
];

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

  // detected barangay feature
  const [detectedBarangayName, setDetectedBarangayName] = useState("");
  const [detectedBarangayFeature, setDetectedBarangayFeature] = useState(null);

  // elevation (meters)
  const [avgElevation, setAvgElevation] = useState("");

  // Errors
  const [errors, setErrors] = useState({});

  /* ---------- DERIVED ---------- */

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

  // Try to detect barangay from farm polygon
  useEffect(() => {
    const res = detectBarangayFeature(farmGeometry, barangaysFC);
    if (res?.name) {
      setDetectedBarangayName(res.name);
      setDetectedBarangayFeature(res.feature || null);

      // Prefill Location barangay if empty
      setManualBarangay((cur) => cur || res.name);

      // Prefill Farmer barangay if empty
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

  // Default avg elevation from defaultLocation (meters)
  useEffect(() => {
    if (
      defaultLocation &&
      typeof defaultLocation.avgElevationM === "number" &&
      !Number.isNaN(defaultLocation.avgElevationM)
    ) {
      setAvgElevation(defaultLocation.avgElevationM.toFixed(1));
    }
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

  /* ---------- VALIDATION ---------- */

  const setFieldError = (field, message) =>
    setErrors((e) => ({ ...e, [field]: message || "" }));

  // Step 1: crop & dates
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

    if (estimatedHarvest) {
      const p = new Date(plantedDate);
      const eh = new Date(estimatedHarvest);
      if (plantedDate && eh < p) {
        newErr.estimatedHarvest =
          "Harvest date cannot be before planting date.";
      }
    }

    setErrors((prev) => ({ ...prev, ...newErr }));
    return Object.keys(newErr).length === 0;
  };

  // Step 2: area, cropping system, barangay
  const validateStep2 = () => {
    const newErr = {};

    const h = Number(hectares);
    if (!hectares || !Number.isFinite(h) || h <= 0) {
      newErr.hectares = "Area must be a number greater than 0.";
    }

    if (!manualBarangay) newErr.manualBarangay = "Please choose a barangay.";

    if ((croppingSystemId !== "1" || isIntercropped) && !interCropTypeId) {
      newErr.interCropTypeId = "Please select the secondary crop type.";
    }

    setErrors((prev) => ({ ...prev, ...newErr }));
    return Object.keys(newErr).length === 0;
  };

  // Step 3: farmer details
  const validateStep3 = () => {
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

    setErrors((prev) => ({ ...prev, ...newErr }));
    return Object.keys(newErr).length === 0;
  };

  const isStep1Valid = () =>
    selectedCropType &&
    plantedDate &&
    (!(ecosystems?.length > 0) || selectedEcosystem);

  const isStep2Valid = () =>
    hectares &&
    manualBarangay &&
    !((croppingSystemId !== "1" || isIntercropped) && !interCropTypeId);

  const isStep3Valid = () =>
    farmerFirstName &&
    farmerLastName &&
    farmerMobile &&
    farmerBarangay &&
    farmerAddress;

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

    // When moving from Area step to Farmer step, default farmer barangay
    if (currentStep === 2 && !farmerBarangay) {
      setFarmerBarangay(
        manualBarangay || detectedBarangayName || selectedBarangay || ""
      );
    }

    setCurrentStep((s) => Math.min(s + 1, STEPS.length));
  };

  const handleBack = () =>
    setCurrentStep((s) => Math.max(s - 1, 1));

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

    const ok1 = validateStep1();
    const ok2 = validateStep2();
    const ok3 = validateStep3();
    if (!(ok1 && ok2 && ok3)) return;

    setShowConfirmation(false);

    // Prefer caller-provided, else derive coordinates from farmGeometry
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

    // intercropping fields
    formData.append("cropping_system_id", croppingSystemId || "");
    formData.append("cropping_system", croppingSystemKey);
    formData.append("is_intercropped", isIntercropped ? "1" : "0");
    formData.append("intercrop_crop_type_id", interCropTypeId || "");
    formData.append("intercrop_variety_id", intercropVarietyId || "");
    formData.append(
      "intercrop_estimated_volume",
      secondaryEstimatedVolume || ""
    );
    formData.append(
      "intercrop_hectares",
      secondaryHectares || hectares || ""
    );

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
    setAvgElevation("");
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

  const getCroppingSystemLabel = () => {
    const idNum = Number(croppingSystemId);
    return CROPPING_SYSTEMS[idNum] || "Monocrop";
  };

  /* ---------- UI ---------- */

  const activeStepMeta = STEPS.find((s) => s.id === currentStep);
  const totalSteps = STEPS.length;

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
                  <p className="text-xs text-gray-400">
                    {activeStepMeta?.title}
                  </p>
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
                          isCurrent || isCompleted
                            ? "text-gray-900"
                            : "text-gray-400"
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
                {avgElevation && (
                  <Pill color="gray">{avgElevation} m elevation</Pill>
                )}
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
                              setFieldError("interCropTypeId", "");
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
                              label="Secondary crop type"
                              required
                              error={errors.interCropTypeId}
                            >
                              <Select
                                error={errors.interCropTypeId}
                                value={interCropTypeId}
                                onChange={(e) => {
                                  const id = parseInt(e.target.value);
                                  setInterCropTypeId(
                                    Number.isFinite(id) ? id : ""
                                  );
                                  setSecondaryVolumeTouched(false);
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

                          <Field
                            label="Secondary area (ha)"
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

                          {interCropTypeId && (
                            <Field
                              label={`Secondary est. yield ${
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
                  </Section>

                  {/* Area & Yield */}
                  <Section
                    title="Area & yield"
                    subtitle="Estimated coverage and production."
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Field
                        label="Area (ha)"
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
                        label={`Est. yield ${
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
                // Step 3: Farmer
                <div className="space-y-7 animate-fadeIn">
                  <Section
                    title="Farmer details"
                    subtitle="Information of the owner / farmer of this field."
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      
                      <Field
                        label="First name"
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
                        label="Last name"
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
                      label="Mobile number"
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
                        <option value="">Select barangay</option>
                        {mergedBarangays.map((bgy) => (
                          <option key={bgy} value={bgy}>
                            {bgy}
                          </option>
                        ))}
                      </Select>
                    </Field>

                    <Field
                      label="Complete address"
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
                        placeholder="House no., street, purok/sitio"
                        error={errors.farmerAddress}
                      />
                    </Field>
                  </Section>
                </div>
              )}

              {/* Step-level error (optional) */}
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
            {/* sticky header */}
            <div className="sticky top-0 z-10 px-6 py-5 border-b bg-white/95 backdrop-blur">
              <h3 className="text-xl font-bold text-gray-900">Review details</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                Please confirm before saving this tagged crop.
              </p>
            </div>

            <div className="p-6 max-h-[62vh] overflow-y-auto space-y-6">
              {/* Crop */}
              <section>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Crop information
                </h4>
                <div className="mt-3 rounded-xl border border-gray-200">
                  {[
                    ["Crop", getCropTypeName()],
                    ...(selectedVarietyId
                      ? [["Variety", getVarietyName()]]
                      : []),
                    ["Cropping system", getCroppingSystemLabel()],
                    ...(interCropTypeId
                      ? [
                          [
                            "Secondary crop",
                            cropTypes.find((c) => c.id === interCropTypeId)
                              ?.name || "—",
                          ],
                        ]
                      : []),
                    ...(intercropVarietyId
                      ? [
                          [
                            "Secondary variety",
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
                    ["Area", hectares ? `${hectares} ha` : "—"],
                    ...(avgElevation
                      ? [["Avg elevation", `${avgElevation} m`]]
                      : []),
                    ...(estimatedVolume
                      ? [
                          [
                            "Est. yield",
                            `${estimatedVolume} ${
                              yieldUnitMap[selectedCropType] || "units"
                            }`,
                          ],
                        ]
                      : []),
                    ...(secondaryEstimatedVolume && interCropTypeId
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
                              (e) => e.id === parseInt(selectedEcosystem)
                            )?.name || "—",
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

              {/* Farmer */}
              <section>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Farmer information
                </h4>
                <div className="mt-3 rounded-xl border border-gray-200">
                  {[
                    ["Name", `${farmerFirstName} ${farmerLastName}`.trim()],
                    ["Mobile", farmerMobile],
                    ["Barangay", farmerBarangay],
                    ["Address", farmerAddress],
                  ].map(([k, v], i, a) => (
                    <div
                      key={k}
                      className={`flex items-start justify-between px-4 py-3 ${
                        i < a.length - 1 ? "border-b border-gray-200" : ""
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

            {/* sticky footer */}
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
          from { opacity: 0; transform: translateY(6px);} 
          to { opacity: 1; transform: translateY(0);} 
        }
        .animate-fadeIn { animation: fadeIn 0.20s ease-out; }
      `}</style>
    </div>
  );
};

export default TagCropForm;
