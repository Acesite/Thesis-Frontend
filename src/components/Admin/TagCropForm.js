import React, { useEffect, useRef, useState, useMemo } from "react";
import { SaveIcon, ArrowRight, ArrowLeft } from "lucide-react";

// Turf for spatial checks
import centroid from "@turf/centroid";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point as turfPoint, polygon as turfPolygon, multiPolygon as turfMultiPolygon } from "@turf/helpers";

/* ---------- CONFIG ---------- */
const STANDARD_MATURITY_DAYS = { 1: 100, 2: 110, 3: 360, 4: 365, 5: 300, 6: 60 };
const yieldUnitMap = { 1: "sacks", 2: "sacks", 3: "bunches", 4: "tons", 5: "tons", 6: "kg" };
const yieldPerHectare = { 1: 80, 2: 85.4, 3: 150, 4: 80, 5: 70, 6: 100 };

// Fallback list (used only if `availableBarangays` prop or `barangaysFC` isn’t provided)
const DEFAULT_BARANGAYS = [
  "Abuanan","Alianza","Atipuluan","Bacong","Bagroy","Balingasag","Binubuhan","Busay",
  "Calumangan","Caridad","Dulao","Ilijan","Lag-asan","Mailum","Ma-ao","Malingin",
  "Napoles","Pacol","Poblacion","Sagasa","Tabunan","Taloc"
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
    props?.Barangay ??
    props?.barangay ??
    props?.NAME ??
    props?.name ??
    ""
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
  if (!(farmGeometry.type === "Polygon" || farmGeometry.type === "MultiPolygon")) return;

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
  selectedBarangay,          // initial inferred barangay (optional)
  availableBarangays,        // array of names (optional; auto-built from barangaysFC if provided)
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

  /* ---------- EFFECTS / DERIVED ---------- */

  // Build the dropdown list:
  // 1) prefer explicit availableBarangays
  // 2) else derive from barangaysFC
  // 3) else fallback constant
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
      setManualBarangay((cur) => cur || res.name); // fill only if empty
    }
  }, [farmGeometry, barangaysFC]);

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

  useEffect(() => {
    if (!harvestTouched) setEstimatedHarvest(autoHarvestCandidate || "");
  }, [autoHarvestCandidate, harvestTouched]);

  useEffect(() => {
    if (!volumeTouched) setEstimatedVolume(autoVolumeCandidate || "");
  }, [autoVolumeCandidate, volumeTouched]);

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

  // If caller gave an already-inferred barangay, set it (without overwriting detections)
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

  /* ---------- VALIDATION ---------- */
  const isStep1Valid = () =>
    selectedCropType &&
    plantedDate &&
    hectares &&
    manualBarangay &&
    (!ecosystems.length || selectedEcosystem);

  const isStep2Valid = () =>
    farmerFirstName && farmerLastName && farmerMobile && farmerBarangay && farmerAddress;

  /* ---------- HANDLERS ---------- */
  const handleShowConfirmation = () => {
    if (!isStep2Valid()) return;
    setShowConfirmation(true);
  };
  const handleNext = () => {
    if (currentStep === 1 && isStep1Valid()) setCurrentStep(2);
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

    const formData = new FormData();
    formData.append("ecosystem_id", selectedEcosystem || "");
    formData.append("crop_type_id", selectedCropType);
    formData.append("variety_id", selectedVarietyId || "");
    formData.append("plantedDate", plantedDate || "");
    formData.append("estimatedHarvest", estimatedHarvest || "");
    formData.append("estimatedVolume", estimatedVolume || "");
    formData.append("estimatedHectares", hectares || "");
    formData.append("note", note || "");

    // keep your original coordinates field
    formData.append("coordinates", JSON.stringify(farmCoords));

    // prefer manual selection; fall back to detection
    const finalBarangay = manualBarangay || detectedBarangayName || selectedBarangay || "";
    formData.append("barangay", finalBarangay);

    // NEW: include detected feature details (from your GeoJSON)
    formData.append("detected_barangay_name", detectedBarangayName || "");
    formData.append(
      "detected_barangay_feature_properties",
      JSON.stringify(detectedBarangayFeature?.properties || {})
    );
    formData.append(
      "detected_barangay_feature_geometry",
      JSON.stringify(detectedBarangayFeature?.geometry || {})
    );

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
    setNote("");
    setPhotos(null);
    setFarmerFirstName("");
    setFarmerLastName("");
    setFarmerMobile("");
    setFarmerBarangay("");
    setFarmerAddress("");
    setSelectedEcosystem("");
  };

  const getCropTypeName = () => {
    const crop = cropTypes.find((c) => c.id === selectedCropType);
    return crop ? crop.name : "—";
  };
  const getVarietyName = () => {
    const variety = dynamicVarieties.find((v) => v.id === parseInt(selectedVarietyId));
    return variety ? variety.name : "—";
  };

  /* ---------- UI ---------- */
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[86vh] overflow-hidden flex flex-col">
        {/* Header (STICKY) */}
        <div className="sticky top-0 z-10 px-8 pt-6 pb-4 bg-white/95 backdrop-blur border-b">
          <h2 className="text-2xl font-bold text-gray-900 text-center">Tag Crop</h2>

          {/* Stepper + progress */}
          <div className="mt-4 mx-auto w-full max-w-sm">
            <div className="flex items-center justify-center gap-3">
              <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${
                  currentStep === 1 ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-400"
                }`}
              >
                <span
                  className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
                    currentStep === 1 ? "bg-green-600 text-white" : "bg-gray-300 text-gray-600"
                  }`}
                >
                  1
                </span>
                <span className="text-sm font-semibold">Crop Details</span>
              </div>

              <div className="h-px w-8 bg-gray-200" />

              <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${
                  currentStep === 2 ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-400"
                }`}
              >
                <span
                  className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
                    currentStep === 2 ? "bg-green-600 text-white" : "bg-gray-300 text-gray-600"
                  }`}
                >
                  2
                </span>
                <span className="text-sm font-semibold">Farmer Info</span>
              </div>
            </div>
            <div className="mt-3 h-1 rounded bg-gray-100">
              <div
                className={`h-1 rounded bg-green-500 transition-all duration-300 ${
                  currentStep === 1 ? "w-1/2" : "w-full"
                }`}
              />
            </div>
            <p className="mt-2 text-center text-sm text-gray-500">
              {currentStep === 1 ? "Enter basic crop information" : "Enter farmer details"}
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-8 pb-2">
          <form onSubmit={handleSubmit} ref={formRef} className="space-y-2">
            {currentStep === 1 && (
              <div className="space-y-6 animate-fadeIn">
                {/* Section: Crop Basics */}
                <h5 className="text-xs font-semibold tracking-wider text-gray-500 uppercase">
                  Crop Basics
                </h5>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Crop Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={selectedCropType}
                      onChange={(e) => {
                        const id = parseInt(e.target.value);
                        setSelectedCropType(Number.isFinite(id) ? id : "");
                        setSelectedVarietyId("");
                      }}
                      className="w-full border-2 border-gray-200 px-4 py-3 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white transition text-base"
                    >
                      <option value="">Select Crop Type</option>
                      {cropTypes.map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedCropType && ecosystems.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Ecosystem <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={selectedEcosystem}
                        onChange={(e) => setSelectedEcosystem(e.target.value)}
                        className="w-full border-2 border-gray-200 px-4 py-3 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white transition text-base"
                      >
                        <option value="">Select Ecosystem</option>
                        {ecosystems.map((ecosystem) => (
                          <option key={ecosystem.id} value={ecosystem.id}>
                            {ecosystem.name}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-xs text-gray-500">
                        Required for reporting and maps.
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Variety</label>
                    <select
                      value={selectedVarietyId}
                      onChange={(e) => setSelectedVarietyId(e.target.value)}
                      className="w-full border-2 border-gray-200 px-4 py-3 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white transition text-base"
                    >
                      <option value="">Select Variety (Optional)</option>
                      {dynamicVarieties.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="my-2 h-px bg-gray-100" />

                {/* Section: Dates */}
                <h5 className="text-xs font-semibold tracking-wider text-gray-500 uppercase">Dates</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Date Planted <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={plantedDate}
                      onChange={(e) => setPlantedDate(e.target.value)}
                      className="w-full border-2 border-gray-200 px-4 py-3 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white transition text-base"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Est. Harvest</label>
                    <input
                      type="date"
                      value={estimatedHarvest}
                      onChange={(e) => {
                        setHarvestTouched(true);
                        setEstimatedHarvest(e.target.value);
                      }}
                      className="w-full border-2 border-gray-200 px-4 py-3 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white transition text-base"
                    />
                  </div>
                </div>

                <div className="my-2 h-px bg-gray-100" />

                {/* Section: Area & Yield */}
                <h5 className="text-xs font-semibold tracking-wider text-gray-500 uppercase">
                  Area &amp; Yield
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Area (ha) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      value={hectares}
                      onChange={(e) => setHectares(e.target.value)}
                      placeholder="0.00"
                      className="w-full border-2 border-gray-200 px-4 py-3 pr-14 rounded-lg text-right focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white transition text-base"
                    />
                    <span className="absolute right-3 bottom-3 text-sm text-gray-500">ha</span>
                  </div>

                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Est. Yield{" "}
                      {yieldUnitMap[selectedCropType] ? `(${yieldUnitMap[selectedCropType]})` : ""}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={estimatedVolume}
                      onChange={(e) => {
                        setVolumeTouched(true);
                        setEstimatedVolume(e.target.value);
                      }}
                      placeholder="Auto-calculated"
                      className="w-full border-2 border-gray-200 px-4 py-3 pr-20 rounded-lg text-right focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white transition text-base"
                    />
                    <span className="absolute right-3 bottom-3 text-sm text-gray-500">
                      {yieldUnitMap[selectedCropType] || "units"}
                    </span>
                  </div>
                </div>

                <div className="my-2 h-px bg-gray-100" />

                {/* Section: Location & Notes */}
                <h5 className="text-xs font-semibold tracking-wider text-gray-500 uppercase">
                  Location &amp; Notes
                </h5>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Barangay <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={manualBarangay}
                      onChange={(e) => setManualBarangay(e.target.value)}
                      className="w-full border-2 border-gray-200 px-4 py-3 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white transition text-base"
                    >
                      <option value="">Select Barangay</option>
                      {mergedBarangays.map((bgy) => (
                        <option key={bgy} value={bgy}>
                          {bgy}
                        </option>
                      ))}
                    </select>
                    {(detectedBarangayName || selectedBarangay) &&
                      manualBarangay === (detectedBarangayName || selectedBarangay) && (
                        <p className="mt-1 text-xs text-green-600">Auto-filled from map.</p>
                      )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
                    <textarea
                      rows="3"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Any observations or notes..."
                      className="w-full border-2 border-gray-200 px-4 py-3 rounded-lg resize-none focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white transition text-base"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Photos</label>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handlePhotosChange}
                      className="w-full border-2 border-gray-200 px-4 py-3 rounded-lg bg-white text-base file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:font-medium file:bg-green-50 file:text-green-700 hover:file:bg-green-100 cursor-pointer"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      JPG/PNG/WebP up to {MAX_PHOTO_MB}MB each (max {MAX_PHOTO_COUNT} files)
                    </p>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-6 animate-fadeIn">
                <h5 className="text-xs font-semibold tracking-wider text-gray-500 uppercase">
                  Farmer Details
                </h5>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      First Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={farmerFirstName}
                      onChange={(e) => setFarmerFirstName(e.target.value)}
                      placeholder="Juan"
                      className="w-full border-2 border-gray-200 px-4 py-3 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white transition text-base"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Last Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={farmerLastName}
                      onChange={(e) => setFarmerLastName(e.target.value)}
                      placeholder="Dela Cruz"
                      className="w-full border-2 border-gray-200 px-4 py-3 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white transition text-base"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Mobile Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    inputMode="numeric"
                    pattern="^09\\d{9}$"
                    title="Use PH format: 09XXXXXXXXX"
                    value={farmerMobile}
                    onChange={(e) => setFarmerMobile(e.target.value)}
                    placeholder="09123456789"
                    className="w-full border-2 border-gray-200 px-4 py-3 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white transition text-base"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Barangay <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={farmerBarangay}
                    onChange={(e) => setFarmerBarangay(e.target.value)}
                    className="w-full border-2 border-gray-200 px-4 py-3 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white transition text-base"
                  >
                    <option value="">Select Barangay</option>
                    {mergedBarangays.map((bgy) => (
                      <option key={bgy} value={bgy}>
                        {bgy}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Complete Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={farmerAddress}
                    onChange={(e) => setFarmerAddress(e.target.value)}
                    placeholder="House No., Street, Purok/Sitio"
                    className="w-full border-2 border-gray-200 px-4 py-3 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white transition text-base"
                  />
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Footer (STICKY) */}
        <div className="sticky bottom-0 z-10 px-8 py-5 bg-white/95 backdrop-blur border-t border-gray-200 flex justify-between items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2.5 text-gray-600 hover:text-gray-800 font-medium transition"
          >
            Cancel
          </button>

          <div className="flex gap-3">
            {currentStep > 1 && (
              <button
                type="button"
                onClick={handleBack}
                className="flex items-center gap-2 px-6 py-2.5 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
              >
                <ArrowLeft size={18} /> Back
              </button>
            )}

            {currentStep < 2 ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={!isStep1Valid()}
                className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-green-600"
              >
                Next <ArrowRight size={18} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleShowConfirmation}
                disabled={!isStep2Valid()}
                className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-green-600"
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
              <h3 className="text-xl font-bold text-gray-900">Review Details</h3>
              <p className="text-sm text-gray-500 mt-0.5">Please verify before saving.</p>
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
                    ...(selectedVarietyId ? [["Variety", getVarietyName()]] : []),
                    ["Planted", plantedDate ? new Date(plantedDate).toLocaleDateString() : "—"],
                    ...(estimatedHarvest ? [["Harvest", new Date(estimatedHarvest).toLocaleDateString()]] : []),
                    ["Area", `${hectares} ha`],
                    ...(estimatedVolume ? [["Estimated Yield", `${estimatedVolume} ${yieldUnitMap[selectedCropType]}`]] : []),
                    ["Location", manualBarangay || detectedBarangayName || "—"],
                    ...(selectedCropType && ecosystems.length > 0
                      ? [["Ecosystem", ecosystems.find((e) => e.id === parseInt(selectedEcosystem))?.name || "—"]]
                      : []),
                  ].map(([k, v], i, a) => (
                    <div key={k} className={`flex items-center justify-between px-4 py-3 ${i < a.length - 1 ? "border-b" : ""}`}>
                      <span className="text-sm text-gray-600">{k}</span>
                      <span className="text-sm font-semibold text-gray-900 text-right">{v}</span>
                    </div>
                  ))}
                </div>

                {/* Show detected feature summary */}
                {(detectedBarangayName || detectedBarangayFeature) && (
                  <div className="mt-3 text-xs text-gray-600">
                    <div><span className="font-semibold">Detected Barangay:</span> {detectedBarangayName || "—"}</div>
                    <div className="mt-1">
                      <span className="font-semibold">Feature properties:</span>{" "}
                      <code className="break-all">{JSON.stringify(detectedBarangayFeature?.properties || {}, null, 0)}</code>
                    </div>
                  </div>
                )}
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
                    <div key={k} className={`flex items-start justify-between px-4 py-3 ${i < a.length - 1 ? "border-b" : ""}`}>
                      <span className="text-sm text-gray-600">{k}</span>
                      <span className="text-sm font-semibold text-gray-900 text-right max-w-[60%]">{v}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {/* sticky footer */}
            <div className="sticky bottom-0 z-10 px-6 py-4 bg-white/95 backdrop-blur border-t flex gap-3">
              <button
                onClick={() => setShowConfirmation(false)}
                className="flex-1 px-4 py-2.5 rounded-lg border text-gray-700 hover:bg-gray-50 transition"
              >
                Go Back
              </button>
              <button
                onClick={handleSubmit}
                className="flex-1 px-4 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold transition"
              >
                Confirm &amp; Save
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px);} to { opacity: 1; transform: translateY(0);} }
        .animate-fadeIn { animation: fadeIn 0.25s ease-out; }
      `}</style>
    </div>
  );
};

export default TagCropForm;