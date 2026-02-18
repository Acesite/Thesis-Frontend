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

/* ---------- BARANGAY HELPERS ---------- */
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

const MAX_FILE_MB = 10;
const MAX_FILE_COUNT = 10;

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

/* ---------- SMALL UI PIECES (recycled) ---------- */
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

/* ---------- WIZARD STEPS (simpler for DAR) ---------- */
const STEPS = [
  { id: 1, title: "Parcel & location", subtitle: "CLOA, lot, area, barangay" },
  { id: 2, title: "Beneficiary & notes", subtitle: "Owner, status, remarks" },
];

const darStatusOptions = [
  { value: "awarded", label: "Awarded" },
  { value: "pending", label: "Pending" },
  { value: "cancelled", label: "Cancelled" },
  { value: "revoked", label: "Revoked" },
];

/* ---------- COMPONENT ---------- */
const TagDarForm = ({
  onCancel,
  onSave,
  defaultLocation,
  selectedBarangay,
  barangaysFC,
  farmGeometry,
}) => {
  const formRef = useRef(null);
  const [currentStep, setCurrentStep] = useState(1);

  // Basic parcel fields
  const [cloaNo, setCloaNo] = useState("");
  const [lotNo, setLotNo] = useState("");
  const [titleNo, setTitleNo] = useState("");
  const [areaHa, setAreaHa] = useState("");
  const [manualBarangay, setManualBarangay] = useState("");
  const [awardDate, setAwardDate] = useState("");
  const [darStatus, setDarStatus] = useState("awarded");
  const [parcelRemarks, setParcelRemarks] = useState("");

  // Beneficiary / ARB (table fields)
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [extensionName, setExtensionName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [civilStatus, setCivilStatus] = useState("");
  const [householdSize, setHouseholdSize] = useState("");
  const [yearsTilling, setYearsTilling] = useState("");
  const [tinNumber, setTinNumber] = useState("");
  const [affidavitLandles, setAffidavitLandles] = useState(false);

  // (kept for compatibility, but not used for DB)
  const [ownerName, setOwnerName] = useState("");
  const [occupantName, setOccupantName] = useState("");

  const [beneficiaryRemarks, setBeneficiaryRemarks] = useState("");

  // Files
  const [files, setFiles] = useState(null);

  // Detected barangay
  const [detectedBarangayName, setDetectedBarangayName] = useState("");
  const [detectedBarangayFeature, setDetectedBarangayFeature] = useState(null);

  // Validation errors
  const [errors, setErrors] = useState({});

  /* ---------- DERIVED ---------- */
  const availableFromFC = useMemo(
    () => (barangaysFC ? listBarangayNamesFromFC(barangaysFC) : []),
    [barangaysFC]
  );

  const mergedBarangays = useMemo(() => {
    const base =
      Array.isArray(availableFromFC) && availableFromFC.length
        ? availableFromFC
        : DEFAULT_BARANGAYS;

    const uniq = new Set(base.map((b) => String(b)));
    const inferredTop = (detectedBarangayName || selectedBarangay || "").trim();
    return inferredTop && !uniq.has(inferredTop) ? [inferredTop, ...base] : base;
  }, [availableFromFC, detectedBarangayName, selectedBarangay]);

  /* ---------- PREFILL FROM LOCATION ---------- */

  // Default area from drawn polygon
  useEffect(() => {
    if (defaultLocation?.hectares) {
      setAreaHa(String(defaultLocation.hectares));
    }
  }, [defaultLocation]);

  // Try to detect barangay from farmGeometry
  useEffect(() => {
    const res = detectBarangayFeature(farmGeometry, barangaysFC);
    if (res?.name) {
      setDetectedBarangayName(res.name);
      setDetectedBarangayFeature(res.feature || null);

      setManualBarangay((cur) => cur || res.name);
    }
  }, [farmGeometry, barangaysFC]);

  // Use selectedBarangay from parent as fallback
  useEffect(() => {
    if (selectedBarangay) {
      setManualBarangay((cur) => cur || selectedBarangay);
    }
  }, [selectedBarangay]);

  const setFieldError = (field, message) =>
    setErrors((e) => ({ ...e, [field]: message || "" }));

  /* ---------- VALIDATION ---------- */

  const validateStep1 = () => {
    const newErr = {};

    const h = Number(areaHa);
    if (!areaHa || !Number.isFinite(h) || h <= 0) {
      newErr.areaHa = "Area (hectares) must be a number greater than 0.";
    }

    if (!manualBarangay) {
      newErr.manualBarangay = "Please choose a barangay.";
    }

    setErrors((prev) => ({ ...prev, ...newErr }));
    return Object.keys(newErr).length === 0;
  };

  const validateStep2 = () => {
    const newErr = {};

    if (!firstName.trim()) newErr.firstName = "First name is required.";
    if (!lastName.trim()) newErr.lastName = "Last name is required.";
    if (!civilStatus) newErr.civilStatus = "Please select civil status.";
    if (!householdSize || Number(householdSize) <= 0) {
      newErr.householdSize = "Household size must be greater than 0.";
    }
    if (yearsTilling && Number(yearsTilling) < 0) {
      newErr.yearsTilling = "Years tilling cannot be negative.";
    }

    setErrors((prev) => ({ ...prev, ...newErr }));
    return Object.keys(newErr).length === 0;
  };

  const isStep1Valid = () => {
    const h = Number(areaHa);
    return areaHa && Number.isFinite(h) && h > 0 && manualBarangay;
  };

  const isStep2Valid = () => {
    return (
      firstName.trim() &&
      lastName.trim() &&
      civilStatus &&
      householdSize &&
      Number(householdSize) > 0
    );
  };

  /* ---------- HANDLERS ---------- */

  const handleNext = () => {
    let ok = true;
    if (currentStep === 1) ok = validateStep1();
    if (!ok) return;

    setCurrentStep((s) => Math.min(s + 1, STEPS.length));
  };

  const handleBack = () => setCurrentStep((s) => Math.max(s - 1, 1));

  const handleFilesChange = (e) => {
    const fileList = Array.from(e.target.files || []);
    if (fileList.length > MAX_FILE_COUNT) {
      alert(`Please select up to ${MAX_FILE_COUNT} files.`);
      return;
    }
    const tooBig = fileList.find((f) => f.size > MAX_FILE_MB * 1024 * 1024);
    if (tooBig) {
      alert(`Each file must be ≤ ${MAX_FILE_MB}MB.`);
      return;
    }
    setFiles(e.target.files);
  };

  const [showConfirmation, setShowConfirmation] = useState(false);

  const handleShowConfirmation = () => {
    const ok1 = validateStep1();
    const ok2 = validateStep2();
    if (!(ok1 && ok2)) return;
    setShowConfirmation(true);
  };

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    const ok1 = validateStep1();
    const ok2 = validateStep2();
    if (!(ok1 && ok2)) return;

    setShowConfirmation(false);

    const coordsFromDefault = defaultLocation?.coordinates || [];
    const coordsFromFarm =
      farmGeometry?.type === "Polygon"
        ? farmGeometry.coordinates?.[0] || []
        : farmGeometry?.type === "MultiPolygon"
        ? farmGeometry.coordinates?.[0]?.[0] || []
        : [];

    const finalCoords = coordsFromDefault.length ? coordsFromDefault : coordsFromFarm;

    const finalBarangay = manualBarangay || detectedBarangayName || selectedBarangay || "";

    const formData = new FormData();
    formData.append("coordinates", JSON.stringify(finalCoords));
    formData.append("barangay", finalBarangay);

    formData.append("cloa_no", cloaNo || "");
    formData.append("lot_no", lotNo || "");
    formData.append("title_no", titleNo || "");
    formData.append("area_ha", areaHa || "");

    formData.append("award_date", awardDate || "");
    formData.append("dar_status", darStatus || "");

    // Beneficiary / ARB (table fields)
    formData.append("first_name", firstName || "");
    formData.append("middle_name", middleName || "");
    formData.append("last_name", lastName || "");
    formData.append("extension_name", extensionName || "");
    formData.append("birth_date", birthDate || "");
    formData.append("civil_status", civilStatus || "");
    formData.append("household_size", householdSize || "");
    formData.append("years_tilling", yearsTilling || "");
    formData.append("tin_number", tinNumber || "");
    formData.append("affidavit_landles", affidavitLandles ? "1" : "0");

    // latitude / longitude from polygon centroid
    let lat = "";
    let lng = "";
    try {
      if (
        farmGeometry &&
        (farmGeometry.type === "Polygon" || farmGeometry.type === "MultiPolygon")
      ) {
        const farmFeature = {
          type: "Feature",
          geometry: farmGeometry,
          properties: {},
        };
        const c = centroid(farmFeature);
        if (c?.geometry?.coordinates) {
          [lng, lat] = c.geometry.coordinates;
        }
      }
    } catch (err) {
      // ignore
    }
    formData.append("latitude", lat);
    formData.append("longitude", lng);

    // legacy owner / remarks fields
    formData.append("owner_name", ownerName || "");
    formData.append("occupant_name", occupantName || "");

    formData.append("parcel_remarks", parcelRemarks || "");
    formData.append("beneficiary_remarks", beneficiaryRemarks || "");

    formData.append("detected_barangay_name", detectedBarangayName || "");
    formData.append(
      "detected_barangay_feature_properties",
      JSON.stringify(detectedBarangayFeature?.properties || {})
    );
    formData.append(
      "detected_barangay_feature_geometry",
      JSON.stringify(detectedBarangayFeature?.geometry || {})
    );

    if (files) {
      for (let i = 0; i < files.length; i++) {
        formData.append("attachments", files[i]);
      }
    }

    await onSave(formData);

    // Reset local state (map will also close the form)
    setCurrentStep(1);
    setCloaNo("");
    setLotNo("");
    setTitleNo("");
    setAreaHa("");
    setManualBarangay(finalBarangay || "");
    setAwardDate("");
    setDarStatus("awarded");
    setParcelRemarks("");

    setFirstName("");
    setMiddleName("");
    setLastName("");
    setExtensionName("");
    setBirthDate("");
    setCivilStatus("");
    setHouseholdSize("");
    setYearsTilling("");
    setTinNumber("");
    setAffidavitLandles(false);
    setOwnerName("");
    setOccupantName("");
    setBeneficiaryRemarks("");
    setFiles(null);
    setErrors({});
  };

  const activeStepMeta = STEPS.find((s) => s.id === currentStep);
  const totalSteps = STEPS.length;

  const fullNamePreview = [firstName, middleName, lastName, extensionName]
    .filter(Boolean)
    .join(" ");

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
                    Tag DAR Parcel
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Encode CLOA and beneficiary details for this mapped parcel.
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
                {fullNamePreview && <Pill color="gray">{fullNamePreview}</Pill>}
              </div>

              {/* Step contents */}
              {currentStep === 1 && (
                <div className="space-y-7 animate-fadeIn">
                  <Section
                    title="Parcel details"
                    subtitle="CLOA, lot, title, and area from this mapped polygon."
                  >
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Field label="CLOA number">
                          <Input
                            type="text"
                            value={cloaNo}
                            onChange={(e) => {
                              setCloaNo(e.target.value);
                              setFieldError("cloaNo", "");
                            }}
                            placeholder="e.g. CLOA-12345"
                            error={errors.cloaNo}
                          />
                        </Field>

                        <Field label="Lot number">
                          <Input
                            type="text"
                            value={lotNo}
                            onChange={(e) => setLotNo(e.target.value)}
                            placeholder="e.g. Lot 12-B"
                          />
                        </Field>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Field label="Title number">
                          <Input
                            type="text"
                            value={titleNo}
                            onChange={(e) => setTitleNo(e.target.value)}
                            placeholder="Optional"
                          />
                        </Field>

                        <Field
                          label="Area (hectares)"
                          required
                          error={errors.areaHa}
                        >
                          <SuffixInput
                            suffix="ha"
                            error={errors.areaHa}
                            inputProps={{
                              type: "number",
                              min: "0",
                              step: "0.01",
                              required: true,
                              value: areaHa,
                              onChange: (e) => {
                                setAreaHa(e.target.value);
                                const v = Number(e.target.value);
                                setFieldError(
                                  "areaHa",
                                  !e.target.value || !Number.isFinite(v) || v <= 0
                                    ? "Area (hectares) must be a number greater than 0."
                                    : ""
                                );
                              },
                              placeholder: "0.00",
                              className: "text-right",
                            }}
                          />
                        </Field>
                      </div>
                    </div>
                  </Section>

                  <Section
                    title="Location & award"
                    subtitle="Barangay and award details for this parcel."
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

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Field label="Award date">
                          <Input
                            type="date"
                            value={awardDate}
                            onChange={(e) => setAwardDate(e.target.value)}
                          />
                        </Field>

                        <Field label="DAR status">
                          <Select
                            value={darStatus}
                            onChange={(e) => setDarStatus(e.target.value)}
                          >
                            {darStatusOptions.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </Select>
                        </Field>
                      </div>

                      <Field label="Parcel remarks">
                        <Textarea
                          rows={3}
                          value={parcelRemarks}
                          onChange={(e) => setParcelRemarks(e.target.value)}
                          placeholder="Any notes about this parcel (e.g., overlaps, boundary issues, partial cancellation)..."
                        />
                      </Field>
                    </div>
                  </Section>
                </div>
              )}

              {currentStep === 2 && (
                <div className="space-y-7 animate-fadeIn">
                  <Section
                    title="Beneficiary / owner"
                    subtitle="Agrarian Reform Beneficiary (ARB) or current occupant of this parcel."
                  >
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Field label="First name" required error={errors.firstName}>
                          <Input
                            type="text"
                            value={firstName}
                            onChange={(e) => {
                              setFirstName(e.target.value);
                              setFieldError("firstName", "");
                            }}
                            placeholder="e.g. Juan"
                            error={errors.firstName}
                          />
                        </Field>

                        <Field label="Middle name">
                          <Input
                            type="text"
                            value={middleName}
                            onChange={(e) => setMiddleName(e.target.value)}
                            placeholder="Optional"
                          />
                        </Field>

                        <Field label="Last name" required error={errors.lastName}>
                          <Input
                            type="text"
                            value={lastName}
                            onChange={(e) => {
                              setLastName(e.target.value);
                              setFieldError("lastName", "");
                            }}
                            placeholder="e.g. Dela Cruz"
                            error={errors.lastName}
                          />
                        </Field>

                        <Field label="Extension (Jr., Sr., III)">
                          <Input
                            type="text"
                            value={extensionName}
                            onChange={(e) => setExtensionName(e.target.value)}
                            placeholder="Optional"
                          />
                        </Field>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Field label="Birth date">
                          <Input
                            type="date"
                            value={birthDate}
                            onChange={(e) => setBirthDate(e.target.value)}
                          />
                        </Field>

                        <Field
                          label="Civil status"
                          required
                          error={errors.civilStatus}
                        >
                          <Select
                            value={civilStatus}
                            onChange={(e) => {
                              setCivilStatus(e.target.value);
                              setFieldError("civilStatus", "");
                            }}
                            error={errors.civilStatus}
                          >
                            <option value="">Select</option>
                            <option value="single">Single</option>
                            <option value="married">Married</option>
                            <option value="widowed">Widowed</option>
                            <option value="separated">Separated</option>
                          </Select>
                        </Field>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Field
                          label="Household size"
                          required
                          error={errors.householdSize}
                        >
                          <Input
                            type="number"
                            min="1"
                            value={householdSize}
                            onChange={(e) => {
                              setHouseholdSize(e.target.value);
                              setFieldError("householdSize", "");
                            }}
                            error={errors.householdSize}
                            placeholder="e.g. 5"
                          />
                        </Field>

                        <Field label="Years tilling the land" error={errors.yearsTilling}>
                          <Input
                            type="number"
                            min="0"
                            value={yearsTilling}
                            onChange={(e) => {
                              setYearsTilling(e.target.value);
                              setFieldError("yearsTilling", "");
                            }}
                            error={errors.yearsTilling}
                            placeholder="e.g. 10"
                          />
                        </Field>

                        <Field label="TIN (optional)">
                          <Input
                            type="text"
                            value={tinNumber}
                            onChange={(e) => setTinNumber(e.target.value)}
                            placeholder="e.g. 123-456-789"
                          />
                        </Field>
                      </div>

                      <div className="flex items-center gap-2 mt-2">
                        <input
                          id="affidavit_landles"
                          type="checkbox"
                          checked={affidavitLandles}
                          onChange={(e) => setAffidavitLandles(e.target.checked)}
                          className="h-4 w-4 text-green-600 border-gray-300 rounded"
                        />
                        <label
                          htmlFor="affidavit_landles"
                          className="text-sm text-gray-700 cursor-pointer"
                        >
                          Has affidavit as landless?
                        </label>
                      </div>

                      <Field label="Beneficiary / status remarks">
                        <Textarea
                          rows={3}
                          value={beneficiaryRemarks}
                          onChange={(e) => setBeneficiaryRemarks(e.target.value)}
                          placeholder="Notes about payment status, lease arrangements, pending transfer, etc."
                        />
                      </Field>
                    </div>
                  </Section>

                  <Section
                    title="Attachments"
                    subtitle={`Optional supporting files (max ${MAX_FILE_COUNT} files, up to ${MAX_FILE_MB}MB each).`}
                  >
                    <Field label="Upload attachments">
                      <input
                        type="file"
                        multiple
                        onChange={handleFilesChange}
                        className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 bg-white text-sm cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:font-medium file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                      />
                    </Field>
                  </Section>
                </div>
              )}

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
                  disabled={currentStep === 1 && !isStep1Valid()}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-600 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next <ArrowRight size={18} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleShowConfirmation}
                  disabled={!isStep2Valid()}
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
              <h3 className="text-xl font-bold text-gray-900">Review DAR parcel</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                Please confirm before saving this tagged DAR parcel.
              </p>
            </div>

            <div className="p-6 max-h-[62vh] overflow-y-auto space-y-6">
              <section>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Parcel information
                </h4>
                <div className="mt-3 rounded-xl border border-gray-200">
                  {[
                    ["CLOA number", cloaNo || "—"],
                    ["Lot number", lotNo || "—"],
                    ["Title number", titleNo || "—"],
                    ["Area (ha)", areaHa ? `${areaHa} ha` : "—"],
                    [
                      "Barangay",
                      manualBarangay || detectedBarangayName || selectedBarangay || "—",
                    ],
                    [
                      "Award date",
                      awardDate ? new Date(awardDate).toLocaleDateString() : "—",
                    ],
                    [
                      "DAR status",
                      darStatusOptions.find((d) => d.value === darStatus)?.label ||
                        "—",
                    ],
                    ["Parcel remarks", parcelRemarks || "—"],
                  ].map(([k, v], i, a) => (
                    <div
                      key={k}
                      className={`flex items-start justify-between px-4 py-3 ${
                        i < a.length - 1 ? "border-b border-gray-200" : ""
                      }`}
                    >
                      <span className="text-sm text-gray-600">{k}</span>
                      <span className="text-sm font-semibold text-gray-900 text-right max-w-[60%] break-words">
                        {v}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Beneficiary information
                </h4>
                <div className="mt-3 rounded-xl border border-gray-200">
                  {[
                    [
                      "Name",
                      fullNamePreview || ownerName || "—",
                    ],
                    [
                      "Birth date",
                      birthDate ? new Date(birthDate).toLocaleDateString() : "—",
                    ],
                    ["Civil status", civilStatus || "—"],
                    ["Household size", householdSize || "—"],
                    ["Years tilling", yearsTilling || "—"],
                    ["TIN", tinNumber || "—"],
                    ["Affidavit as landless", affidavitLandles ? "Yes" : "No"],
                    ["Beneficiary remarks", beneficiaryRemarks || "—"],
                  ].map(([k, v], i, a) => (
                    <div
                      key={k}
                      className={`flex items-start justify-between px-4 py-3 ${
                        i < a.length - 1 ? "border-gray-200 border-b" : ""
                      }`}
                    >
                      <span className="text-sm text-gray-600">{k}</span>
                      <span className="text-sm font-semibold text-gray-900 text-right max-w-[60%] break-words">
                        {v}
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

export default TagDarForm;
