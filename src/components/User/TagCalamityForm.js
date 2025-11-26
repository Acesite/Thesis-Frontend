// components/User/TagCalamityForm.js
import React, { useState, useEffect, useMemo } from "react";
/* GIS helpers + your barangays FeatureCollection */
import * as turf from "@turf/turf";
import BARANGAYS_FC from "../Barangays/barangays.json";

/* ---------- Small UI pieces (no logic) ---------- */
const Section = ({ title, subtitle, children }) => (
  <div>
    <div className="mb-3">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
    </div>
    {children}
  </div>
);

const Label = ({ children, required, htmlFor }) => (
  <label
    htmlFor={htmlFor}
    className="block text-sm font-medium text-gray-700 mb-1.5"
  >
    {children} {required && <span className="text-red-500">*</span>}
  </label>
);

const HelpText = ({ children, id }) => (
  <p id={id} className="mt-1 text-xs text-gray-500">
    {children}
  </p>
);

const ErrorText = ({ children }) => (
  <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
    {children}
  </div>
);

const InputBase =
  "w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600 disabled:bg-gray-50";
const SelectBase = InputBase;
const TextareaBase = `${InputBase} resize-none`;

const Spinner = () => (
  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
    />
  </svg>
);

const Pill = ({ color = "emerald", children }) => (
  <span
    className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-${color}-50 text-${color}-700 border border-${color}-200`}
  >
    <span className={`h-1.5 w-1.5 rounded-full bg-${color}-600`} />
    {children}
  </span>
);

/* ---------- Wizard steps meta ---------- */
const STEPS = [
  {
    id: 1,
    title: "Farmer details",
    subtitle: "Who owns / manages the affected field?",
  },
  { id: 2, title: "Incident details", subtitle: "What happened and where?" },
  {
    id: 3,
    title: "Crop & ecosystem",
    subtitle: "What crop and environment are affected?",
  },
  {
    id: 4,
    title: "Area & evidence",
    subtitle: "How large is the damage and proof?",
  },
];

/* ---------- Component ---------- */
const TagCalamityForm = ({
  defaultLocation,
  selectedBarangay,
  onCancel,
  onSave,
  setNewTagLocation,
}) => {
  const [currentStep, setCurrentStep] = useState(1);

  // calamity form state
  const [calamityType, setCalamityType] = useState("");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState([]);
  const [ecosystemId, setEcosystemId] = useState("");
  const [cropTypeId, setCropTypeId] = useState("");
  const [varietyId, setVarietyId] = useState("");
  const [affectedArea, setAffectedArea] = useState("");
  const [cropStage, setCropStage] = useState("");
  const [barangay, setBarangay] = useState(selectedBarangay || "");
  const [status, setStatus] = useState("Pending");
  const [severityLevel, setSeverityLevel] = useState("");

  // farmer form state (manual input)
  const [farmerFirstName, setFarmerFirstName] = useState("");
  const [farmerLastName, setFarmerLastName] = useState("");
  const [farmerMobile, setFarmerMobile] = useState("");
  const [farmerBarangay, setFarmerBarangay] = useState(selectedBarangay || "");
  const [farmerAddress, setFarmerAddress] = useState("");

  // dropdown data
  const [ecosystems, setEcosystems] = useState([]);
  const [allEcosystems, setAllEcosystems] = useState([]);
  const [crops, setCrops] = useState([]);
  const [varieties, setVarieties] = useState([]);

  // ui state
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [loadingVarieties, setLoadingVarieties] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [varietyError, setVarietyError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // derived — keep coords string (for chips, if needed)
  const coordStr = useMemo(() => {
    const c = defaultLocation?.coordinates;
    if (!c || !Array.isArray(c) || c.length < 2) return "";
    const [lng, lat] = c;
    return `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`;
  }, [defaultLocation]);

  // prefill area chip
  useEffect(() => {
    const ha = defaultLocation?.hectares;
    if (ha != null && !Number.isNaN(ha)) {
      const val = Number(ha).toFixed(2);
      setAffectedArea(val);
      setNewTagLocation?.((prev) => ({
        ...(prev || {}),
        hectares: Number(val),
      }));
    }
  }, [defaultLocation?.hectares, setNewTagLocation]);

  // auto-detect barangay from polygon -> set both incident barangay & farmer barangay default
  useEffect(() => {
    if (barangay || selectedBarangay) return;
    const ring = defaultLocation?.coordinates;
    if (!Array.isArray(ring) || ring.length < 3) return;
    try {
      const first = ring[0];
      const last = ring[ring.length - 1];
      const closedRing =
        JSON.stringify(first) === JSON.stringify(last) ? ring : [...ring, first];
      const poly = turf.polygon([closedRing]);
      let center = turf.centerOfMass(poly);
      if (!center?.geometry?.coordinates) center = turf.pointOnFeature(poly);

      const hit = (BARANGAYS_FC?.features || []).find((f) => {
        try {
          return turf.booleanPointInPolygon(center, f);
        } catch {
          return false;
        }
      });

      if (hit) {
        const props = hit.properties || {};
        const nameCandidate =
          props.barangay ||
          props.Barangay ||
          props.name ||
          props.NAME ||
          props.NAME_1 ||
          props.NAME_2 ||
          props.brgy_name ||
          props.BRGY_NAME;
        if (nameCandidate) {
          const nameStr = String(nameCandidate);
          setBarangay(nameStr);
          // default farmer barangay to same value (officer can still override)
          setFarmerBarangay((prev) => prev || nameStr);
        }
      }
    } catch (e) {
      console.warn("Barangay autofill failed:", e);
    }
  }, [defaultLocation?.coordinates, barangay, selectedBarangay]);

  // fetch dropdowns (ecosystems + crops)
  useEffect(() => {
    let abort = false;
    const run = async () => {
      setLoadingMeta(true);
      setFetchError("");
      try {
        const [ecosystemRes, cropRes] = await Promise.all([
          fetch("http://localhost:5000/api/calamities/ecosystems"),
          fetch("http://localhost:5000/api/calamities/crops"),
        ]);
        if (!ecosystemRes.ok || !cropRes.ok) throw new Error("Network error");
        const ecosystemData = await ecosystemRes.json();
        const cropData = await cropRes.json();
        if (abort) return;
        const ecosystemArray = Array.isArray(ecosystemData) ? ecosystemData : [];
        setAllEcosystems(ecosystemArray);
        setEcosystems(ecosystemArray);
        setCrops(Array.isArray(cropData) ? cropData : []);
      } catch {
        if (!abort) {
          setFetchError(
            "Unable to load dropdown data. Check your connection or try again."
          );
          setAllEcosystems([]);
          setEcosystems([]);
          setCrops([]);
        }
      } finally {
        if (!abort) setLoadingMeta(false);
      }
    };
    run();
    return () => {
      abort = true;
    };
  }, []);

  // fetch varieties + filter ecosystems by crop
  useEffect(() => {
    let abort = false;
    const fetchVar = async () => {
      setVarieties([]);
      setVarietyId("");
      setVarietyError("");

      if (!cropTypeId) {
        setEcosystems(allEcosystems);
        setEcosystemId("");
        return;
      }

      const filtered = allEcosystems.filter(
        (eco) => String(eco.crop_type_id) === String(cropTypeId)
      );
      setEcosystems(filtered);
      if (
        ecosystemId &&
        !filtered.find((eco) => String(eco.id) === String(ecosystemId))
      ) {
        setEcosystemId("");
      }

      setLoadingVarieties(true);
      try {
        const res = await fetch(
          `http://localhost:5000/api/calamities/crops/${cropTypeId}/varieties`
        );
        if (!res.ok) throw new Error("Network error while fetching varieties.");
        const data = await res.json();
        if (abort) return;
        setVarieties(Array.isArray(data) ? data : []);
      } catch {
        if (!abort) {
          setVarietyError("Unable to load varieties for the selected crop.");
          setVarieties([]);
        }
      } finally {
        if (!abort) setLoadingVarieties(false);
      }
    };

    fetchVar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cropTypeId, allEcosystems]);

  // photos
  const onPickPhotos = (fileList) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    const maxMB = 5;
    const validTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/heic",
      "image/heif",
    ];
    const invalid = files.find((f) => !validTypes.includes(f.type));
    if (invalid) {
      setSubmitError(
        "Unsupported image type. Please upload JPG, PNG, WEBP, or HEIC."
      );
      return;
    }
    const tooBig = files.find((f) => f.size > maxMB * 1024 * 1024);
    if (tooBig) {
      setSubmitError(
        `One or more images are too large. Max size is ${maxMB} MB each.`
      );
      return;
    }
    setSubmitError("");
    setPhotos((prev) => {
      const map = new Map(prev.map((p) => [p.name + ":" + p.size, p]));
      files.forEach((f) => map.set(f.name + ":" + f.size, f));
      return Array.from(map.values());
    });
  };
  const removePhotoAt = (idx) =>
    setPhotos((prev) => prev.filter((_, i) => i !== idx));

  /* ---------- Validation helpers per step ---------- */
  const step1Valid =
    farmerFirstName.trim() &&
    farmerLastName.trim() &&
    farmerBarangay.trim();

  const step2Valid =
    calamityType &&
    (barangay || selectedBarangay) &&
    cropStage &&
    status &&
    severityLevel &&
    description.trim().length > 0;

  const step3Valid =
    cropTypeId && ecosystemId && (varieties.length === 0 || varietyId);

  const step4Valid = affectedArea || defaultLocation?.hectares;

  const canSubmitAll = step1Valid && step2Valid && step3Valid && step4Valid;

  const canGoNextFromStep = (step) => {
    if (step === 1) return !!step1Valid;
    if (step === 2) return !!step2Valid;
    if (step === 3) return !!step3Valid;
    return true;
  };

  /* ---------- Helper for names in review modal ---------- */
  const getCropName = () => {
    const c = crops.find((c) => String(c.id) === String(cropTypeId));
    return c?.name || "—";
  };

  const getEcosystemName = () => {
    const e = ecosystems.find((e) => String(e.id) === String(ecosystemId));
    return e?.name || "—";
  };

  const getVarietyName = () => {
    const v = varieties.find((v) => String(v.id) === String(varietyId));
    return v?.name || "—";
  };

  /* ---------- Submit (final step) ---------- */
  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    setSubmitError("");

    const adminId = Number(
      localStorage.getItem("admin_id") || localStorage.getItem("user_id")
    );
    if (!adminId) {
      setSubmitError("No admin_id found. Please log in.");
      return;
    }
    if (!defaultLocation?.coordinates) {
      setSubmitError("Coordinates not found for this report.");
      return;
    }

    if (!canSubmitAll) {
      setSubmitError("Please complete all required fields before submitting.");
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      // calamity details
      formData.append("calamity_type", calamityType);
      formData.append("description", description.trim());
      formData.append("location", selectedBarangay || "Unknown");
      formData.append("barangay", barangay || selectedBarangay || "");
      formData.append("status", status);
      formData.append("severity_level", severityLevel);
      formData.append(
        "coordinates",
        JSON.stringify(defaultLocation.coordinates)
      );
      formData.append("admin_id", String(adminId));
      formData.append("ecosystem_id", ecosystemId);
      formData.append("crop_type_id", cropTypeId);
      formData.append("crop_variety_id", varietyId);
      formData.append(
        "affected_area",
        affectedArea || defaultLocation?.hectares || "0"
      );
      formData.append("crop_stage", cropStage);

      // farmer details (go to tbl_farmer_calamity)
      formData.append("farmer_first_name", farmerFirstName.trim());
      formData.append("farmer_last_name", farmerLastName.trim());
      formData.append("farmer_mobile_number", farmerMobile.trim());
      formData.append("farmer_barangay", farmerBarangay.trim());
      formData.append("farmer_full_address", farmerAddress.trim());

      photos.forEach((file) => formData.append("photos", file));

      await onSave(formData);
      // on success parent will usually close the form
    } catch (err) {
      console.error(err);
      setSubmitError("Something went wrong preparing your submission.");
      setIsSubmitting(false);
    }
  };

  /* ---------- Wizard navigation ---------- */
  const handleNext = () => {
    if (!canGoNextFromStep(currentStep)) {
      setSubmitError(
        "Please complete the required fields for this step before continuing."
      );
      return;
    }
    setSubmitError("");
    setCurrentStep((s) => Math.min(s + 1, STEPS.length));
  };

  const handleBack = () => {
    setSubmitError("");
    setCurrentStep((s) => Math.max(s - 1, 1));
  };

  /* ---------- Step content renderer ---------- */
  const renderStepContent = () => {
    if (currentStep === 1) {
      return (
        <Section
          title="Farmer details"
          subtitle="Encode the farmer information for this affected field."
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <Label htmlFor="farmer_first_name" required>
                First Name
              </Label>
              <input
                id="farmer_first_name"
                type="text"
                value={farmerFirstName}
                onChange={(e) => setFarmerFirstName(e.target.value)}
                placeholder="e.g., Juan"
                className={InputBase}
                required
              />
            </div>

            <div>
              <Label htmlFor="farmer_last_name" required>
                Last Name
              </Label>
              <input
                id="farmer_last_name"
                type="text"
                value={farmerLastName}
                onChange={(e) => setFarmerLastName(e.target.value)}
                placeholder="e.g., Dela Cruz"
                className={InputBase}
                required
              />
            </div>

            <div>
              <Label htmlFor="farmer_mobile">Mobile Number</Label>
              <input
                id="farmer_mobile"
                type="text"
                value={farmerMobile}
                onChange={(e) => setFarmerMobile(e.target.value)}
                placeholder="09XXXXXXXXX"
                className={InputBase}
              />
              <HelpText>Optional but recommended for follow-up.</HelpText>
            </div>

            <div>
              <Label htmlFor="farmer_barangay" required>
                Farmer Barangay
              </Label>
              <input
                id="farmer_barangay"
                type="text"
                value={farmerBarangay}
                onChange={(e) => setFarmerBarangay(e.target.value)}
                placeholder="e.g., Brgy. San Isidro"
                className={InputBase}
                required
              />
              <HelpText>
                Barangay of farmer’s residence / field owner.
              </HelpText>
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="farmer_address">Full Address</Label>
              <input
                id="farmer_address"
                type="text"
                value={farmerAddress}
                onChange={(e) => setFarmerAddress(e.target.value)}
                placeholder="House no., street, sitio / purok, barangay, city"
                className={InputBase}
              />
              <HelpText>
                Optional full address for master list / reports.
              </HelpText>
            </div>
          </div>
        </Section>
      );
    }

    if (currentStep === 2) {
      return (
        <Section
          title="Incident details"
          subtitle="Basic information about the calamity."
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <Label htmlFor="calamity" required>
                Calamity Type
              </Label>
              <select
                id="calamity"
                value={calamityType}
                onChange={(e) => setCalamityType(e.target.value)}
                className={SelectBase}
                required
              >
                <option value="">Select calamity type</option>
                <option value="Flood">Flood</option>
                <option value="Drought">Drought</option>
                <option value="Pest">Pest</option>
                <option value="Typhoon">Typhoon</option>
                <option value="Earthquake">Earthquake</option>
                <option value="Landslide">Landslide</option>
                <option value="Wildfire">Wildfire</option>
              </select>
              <HelpText>
                Choose the category that best matches the event.
              </HelpText>
            </div>

            <div>
              <Label htmlFor="barangay" required>
                Incident Barangay
              </Label>
              <input
                id="barangay"
                type="text"
                value={barangay}
                onChange={(e) => setBarangay(e.target.value)}
                placeholder="e.g., Brgy. San Isidro"
                className={InputBase}
                required
                aria-describedby="brgy-help"
              />
              <HelpText id="brgy-help">
                Barangay where the affected field is located.
              </HelpText>
            </div>

            <div>
              <Label htmlFor="stage" required>
                Crop Development Stage
              </Label>
              <select
                id="stage"
                value={cropStage}
                onChange={(e) => setCropStage(e.target.value)}
                className={SelectBase}
                required
              >
                <option value="">Select stage</option>
                <option value="Planted">Planted</option>
                <option value="Ripening">Ripening</option>
                <option value="Harvested">Harvested</option>
              </select>
              <HelpText>Pick the current stage of the affected crop.</HelpText>
            </div>

            <div>
              <Label htmlFor="status" required>
                Status
              </Label>
              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className={SelectBase}
                required
              >
                <option value="Pending">Pending</option>
                <option value="Verified">Verified</option>
                <option value="Resolved">Resolved</option>
                <option value="Rejected">Rejected</option>
              </select>
              <HelpText>Set by field officer during geotagging.</HelpText>
            </div>

            <div>
              <Label htmlFor="severity" required>
                Severity
              </Label>
              <select
                id="severity"
                value={severityLevel}
                onChange={(e) => setSeverityLevel(e.target.value)}
                className={SelectBase}
                required
              >
                <option value="">Select severity</option>
                <option value="Low">Low</option>
                <option value="Moderate">Moderate</option>
                <option value="High">High</option>
                <option value="Severe">Severe</option>
              </select>
              <HelpText>How intense is the incident right now?</HelpText>
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="desc" required>
                Description
              </Label>
              <textarea
                id="desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className={TextareaBase}
                placeholder="What happened? When did it start? Any visible damage or hazards?"
                required
              />
              <div className="flex justify-between">
                <HelpText>
                  Be concise and specific (e.g., depth of floodwater, wind
                  damage, pest symptoms).
                </HelpText>
                <p className="text-xs text-gray-400">
                  {description.length}/1000
                </p>
              </div>
            </div>
          </div>
        </Section>
      );
    }

    if (currentStep === 3) {
      return (
        <Section
          title="Crop & ecosystem"
          subtitle="These fields tailor recommendations and analysis."
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <Label htmlFor="crop" required>
                Crop Type
              </Label>
              <div className="relative">
                <select
                  id="crop"
                  value={cropTypeId}
                  onChange={(e) => setCropTypeId(e.target.value)}
                  className={SelectBase}
                  required
                  disabled={loadingMeta}
                >
                  <option value="">
                    {loadingMeta ? "Loading crop types..." : "Select crop type"}
                  </option>
                  {!loadingMeta && crops.length === 0 && (
                    <option value="" disabled>
                      No crop types found
                    </option>
                  )}
                  {crops.map((crop) => (
                    <option key={crop.id} value={crop.id}>
                      {crop.name}
                    </option>
                  ))}
                </select>
                {loadingMeta && (
                  <div className="absolute right-3 top-2.5 text-gray-400">
                    <Spinner />
                  </div>
                )}
              </div>
              {fetchError ? (
                <ErrorText>{fetchError}</ErrorText>
              ) : (
                <HelpText>Select the primary crop affected.</HelpText>
              )}
            </div>

            <div>
              <Label htmlFor="ecosystem" required>
                Ecosystem Type
              </Label>
              <select
                id="ecosystem"
                value={ecosystemId}
                onChange={(e) => setEcosystemId(e.target.value)}
                className={SelectBase}
                required
                disabled={!cropTypeId || loadingMeta}
              >
                <option value="">
                  {!cropTypeId ? "Select crop type first" : "Select ecosystem"}
                </option>
                {ecosystems.length === 0 && cropTypeId ? (
                  <option value="" disabled>
                    No ecosystem matches for this crop
                  </option>
                ) : (
                  ecosystems.map((eco) => (
                    <option key={eco.id} value={eco.id}>
                      {eco.name}
                    </option>
                  ))
                )}
              </select>
              {!cropTypeId ? (
                <HelpText>Please select a crop type first.</HelpText>
              ) : (
                <HelpText>
                  Filtered to ecosystems applicable to the selected crop.
                </HelpText>
              )}
            </div>

            {cropTypeId && (
              <div className="sm:col-span-2">
                <Label htmlFor="variety" required>
                  Crop Variety
                </Label>
                <div className="relative">
                  <select
                    id="variety"
                    value={varietyId}
                    onChange={(e) => setVarietyId(e.target.value)}
                    className={SelectBase}
                    required
                    disabled={loadingVarieties}
                  >
                    <option value="">
                      {loadingVarieties
                        ? "Loading varieties..."
                        : "Select crop variety"}
                    </option>
                    {!loadingVarieties && varieties.length === 0 && (
                      <option value="" disabled>
                        No varieties found
                      </option>
                    )}
                    {varieties.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                  {loadingVarieties && (
                    <div className="absolute right-3 top-2.5 text-gray-400">
                      <Spinner />
                    </div>
                  )}
                </div>
                {varietyError ? (
                  <ErrorText>{varietyError}</ErrorText>
                ) : (
                  <HelpText>
                    Choose the specific variety if available.
                  </HelpText>
                )}
              </div>
            )}
          </div>
        </Section>
      );
    }

    // Step 4
    return (
      <Section
        title="Area & evidence"
        subtitle="Estimate coverage and attach a clear photo if possible."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <Label htmlFor="area" required>
              Affected Area (ha)
            </Label>
            <input
              id="area"
              type="number"
              min="0"
              step="0.01"
              value={affectedArea ?? ""}
              onChange={(e) => {
                const value = e.target.value;
                setAffectedArea(value);
                const floatValue = parseFloat(value);
                if (!isNaN(floatValue)) {
                  setNewTagLocation?.((prev) => ({
                    ...prev,
                    hectares: floatValue,
                  }));
                }
              }}
              placeholder={
                defaultLocation?.hectares != null
                  ? Number(defaultLocation.hectares).toFixed(2)
                  : "0.00"
              }
              className={InputBase}
              required
              aria-describedby="area-help"
            />
            <HelpText id="area-help">
              If unsure, provide your best estimate. You can refine later.
            </HelpText>
          </div>

          <div>
            <Label htmlFor="photos">Photos</Label>
            <input
              id="photos"
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => onPickPhotos(e.target.files)}
              className="w-full text-sm text-gray-700 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border file:border-gray-300 file:text-sm file:font-medium file:bg-white file:text-gray-700 hover:file:bg-gray-50"
            />
            <HelpText>
              JPG/PNG/WEBP/HEIC up to 5MB each. You can select multiple.
            </HelpText>

            {photos.length > 0 && (
              <div className="mt-3 grid grid-cols-4 gap-3">
                {photos.map((f, idx) => (
                  <div key={idx} className="relative">
                    <img
                      src={URL.createObjectURL(f)}
                      alt={f.name}
                      className="h-20 w-full object-cover rounded-lg border"
                    />
                    <button
                      type="button"
                      onClick={() => removePhotoAt(idx)}
                      className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-6 h-6 text-xs flex items-center justify-center shadow"
                      title="Remove"
                    >
                      ×
                    </button>
                    <div className="mt-1 text-[11px] text-gray-600 truncate">
                      {f.name}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Section>
    );
  };

  const activeStepMeta = STEPS.find((s) => s.id === currentStep);
  const totalSteps = STEPS.length;

  return (
    <>
      <div className="fixed inset-0 bg-black/45 flex items-center justify-center z-50 p-4">
        <div className="max-w-2xl w-full">
          {/* Card clips rounded corners */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Make this the scroll container so sticky header is scoped to the card */}
            <div className="max-h-[92vh] overflow-y-auto [scrollbar-gutter:stable]">
              {/* Sticky header */}
              <div className="sticky top-0 z-10 px-6 py-5 bg-white/90 backdrop-blur border-b rounded-t-2xl supports-[backdrop-filter]:bg-white/80">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      Report Calamity
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                      Provide clear incident details for mapping and analysis.
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
              <form className="p-6 space-y-7">
                {/* Context chips — barangay + area + coords */}
                <div className="flex flex-wrap gap-2 mb-2">
                  {(barangay || selectedBarangay) && (
                    <Pill color="blue">{barangay || selectedBarangay}</Pill>
                  )}
                  {defaultLocation?.hectares && (
                    <Pill color="emerald">
                      {Number(defaultLocation.hectares).toFixed(2)} ha (from map)
                    </Pill>
                  )}
                  {/* if you want coords pill again, uncomment:
                  {coordStr && <Pill color="gray">{coordStr}</Pill>} */}
                </div>

                {/* Step content */}
                {renderStepContent()}

                {submitError && <ErrorText>{submitError}</ErrorText>}

                {/* Actions */}
                <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={onCancel}
                    className="px-4 py-2.5 border-2 border-gray-300 rounded-xl text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400"
                  >
                    Cancel
                  </button>

                  {currentStep > 1 && (
                    <button
                      type="button"
                      onClick={handleBack}
                      className="ml-auto px-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-300"
                    >
                      Back
                    </button>
                  )}

                  {currentStep < totalSteps && (
                    <button
                      type="button"
                      onClick={handleNext}
                      className="px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-600"
                    >
                      Next
                    </button>
                  )}

                  {currentStep === totalSteps && (
                    <button
                      type="button"
                      disabled={!canSubmitAll || isSubmitting}
                      onClick={() => {
                        if (!canSubmitAll) {
                          setSubmitError(
                            "Please complete all required fields before submitting."
                          );
                          return;
                        }
                        setSubmitError("");
                        setShowConfirmation(true);
                      }}
                      className={`px-4 py-2.5 inline-flex items-center justify-center gap-2 rounded-xl text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                        !canSubmitAll || isSubmitting
                          ? "bg-green-400 cursor-not-allowed"
                          : "bg-green-600 hover:bg-green-700 focus:ring-green-600"
                      }`}
                    >
                      {isSubmitting && <Spinner />}
                      {isSubmitting ? "Submitting..." : "Review & Submit"}
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* ---------- Review Modal ---------- */}
      {showConfirmation && (
        <div className="fixed inset-0 z-[60] bg-black/60 p-4 flex items-center justify-center">
          <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden">
            {/* header */}
            <div className="sticky top-0 z-10 px-6 py-5 border-b bg-white/95 backdrop-blur">
              <h3 className="text-xl font-bold text-gray-900">
                Review calamity report
              </h3>
              <p className="text-sm text-gray-500 mt-0.5">
                Please confirm the details before submitting.
              </p>
            </div>

            <div className="p-6 max-h-[62vh] overflow-y-auto space-y-6 text-sm">
              {/* Farmer info */}
              <section>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Farmer information
                </h4>
                <div className="mt-3 rounded-xl border border-gray-200">
                  {[
                    ["Name", `${farmerFirstName} ${farmerLastName}`.trim() || "—"],
                    ["Mobile", farmerMobile || "—"],
                    ["Barangay", farmerBarangay || "—"],
                    ["Full address", farmerAddress || "—"],
                  ].map(([k, v], i, a) => (
                    <div
                      key={k}
                      className={`flex items-start justify-between px-4 py-3 ${
                        i < a.length - 1 ? "border-b border-gray-200" : ""
                      }`}
                    >
                      <span className="text-gray-600">{k}</span>
                      <span className="font-semibold text-gray-900 text-right max-w-[60%] break-words">
                        {v}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              {/* Incident info */}
              <section>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Incident details
                </h4>
                <div className="mt-3 rounded-xl border border-gray-200">
                  {[
                    ["Calamity type", calamityType || "—"],
                    ["Incident barangay", barangay || selectedBarangay || "—"],
                    ["Crop stage", cropStage || "—"],
                    ["Status", status || "—"],
                    ["Severity", severityLevel || "—"],
                    ["Description", description || "—"],
                  ].map(([k, v], i, a) => (
                    <div
                      key={k}
                      className={`flex items-start justify-between px-4 py-3 ${
                        i < a.length - 1 ? "border-b border-gray-200" : ""
                      }`}
                    >
                      <span className="text-gray-600">{k}</span>
                      <span className="font-semibold text-gray-900 text-right max-w-[60%] break-words whitespace-pre-line">
                        {v}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              {/* Crop & ecosystem */}
              <section>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Crop & ecosystem
                </h4>
                <div className="mt-3 rounded-xl border border-gray-200">
                  {[
                    ["Crop type", getCropName()],
                    ["Ecosystem", getEcosystemName()],
                    ["Variety", getVarietyName()],
                  ].map(([k, v], i, a) => (
                    <div
                      key={k}
                      className={`flex items-center justify-between px-4 py-3 ${
                        i < a.length - 1 ? "border-b border-gray-200" : ""
                      }`}
                    >
                      <span className="text-gray-600">{k}</span>
                      <span className="font-semibold text-gray-900 text-right">
                        {v}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              {/* Area & evidence */}
              <section>
  <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
    Area & evidence
  </h4>
  <div className="mt-3 rounded-xl border border-gray-200">
    {[
      [
        "Affected area",
        (affectedArea ||
          (defaultLocation?.hectares != null
            ? Number(defaultLocation.hectares).toFixed(2)
            : "0")) + " ha",
      ],
    ].map(([k, v], i, a) => (
      <div
        key={k}
        className={`flex items-center justify-between px-4 py-3 ${
          i < a.length - 1 ? "border-b border-gray-200" : ""
        }`}
      >
        <span className="text-gray-600">{k}</span>
        <span className="font-semibold text-gray-900 text-right">
          {v}
        </span>
      </div>
    ))}
  </div>
</section>

            </div>

            {/* footer */}
            <div className="sticky bottom-0 z-10 px-6 py-4 bg-white/95 backdrop-blur border-t border-gray-200 flex gap-3">
              <button
                onClick={() => setShowConfirmation(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                Go back
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 px-4 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-sm font-semibold text-white transition disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              >
                {isSubmitting && <Spinner />}
                {isSubmitting ? "Submitting..." : "Confirm & Submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TagCalamityForm;
