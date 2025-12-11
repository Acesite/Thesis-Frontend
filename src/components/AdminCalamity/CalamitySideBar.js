// components/CalamitySidebar.jsx
import React, { useMemo, useState, useEffect } from "react";
import clsx from "clsx";
import AgriGISLogo from "../../components/MapboxImages/AgriGIS.png";
import Button from "./MapControls/Button";
import { useNavigate } from "react-router-dom";
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : "—");
const fmt = (v) => (v ?? v === 0 ? v : "—");
const fmtHa = (v) => (v || v === 0 ? Number(v).toFixed(2) + " ha" : "—");

const Section = ({ title, children }) => (
  <div className="rounded-xl border border-gray-200 bg-white p-4 mb-4">
    {title && <h3 className="text-sm font-semibold text-gray-900 mb-3">{title}</h3>}
    {children}
  </div>
);

const KV = ({ label, value }) => (
  <div className="flex flex-col">
    <dt className="text-xs uppercase tracking-wide text-gray-500">{label}</dt>
    <dd className="text-sm text-gray-900 break-words">{value}</dd>
  </div>
);

// Fixed list used by the Calamity Type filter
const CALAMITY_FILTERS = [
  "Flood",
  "Earthquake",
  "Typhoon",
  "Landslide",
  "Drought",
  "Wildfire",
  "Pest",
];

// Legend colors
const CALAMITY_COLORS = {
  Flood: "#3b82f6",
  Earthquake: "#ef4444",
  Typhoon: "#8b5cf6",
  Landslide: "#f59e0b",
  Drought: "#f97316",
  Wildfire: "#dc2626",
  Pest: "#16a34a",
};

/* ✅ Your provided barangay coordinates (Mapbox uses [lng, lat]) */
const BARANGAY_COORDS = {
  Abuanan: [122.9931029999093, 10.524206390699248],
  Alianza: [122.92988862768476, 10.47340168422538],
  Atipuluan: [122.9562576950126, 10.510953164592365],
  Bacong: [123.03441588617568, 10.518873221163915],
  Bagroy: [122.87236817323469, 10.477025471408794],
  Balingasag: [122.84582810383534, 10.531277226745061],
  Binubuhan: [123.00741197236749, 10.457215434189976],
  Busay: [122.88838003856415, 10.53684669218299],
  Calumangan: [122.8770489430554, 10.559875025008566],
  Caridad: [122.90583327034744, 10.481478383788584],
  Dulao: [122.95143518662286, 10.54852750565594],
  Ilijan: [123.0551933861205, 10.452616250029052],
  "Lag-asan": [122.83944999966644, 10.52329196247021],
  Mailum: [123.04961976326507, 10.46172003496254],
  "Ma-ao": [122.99162485502836, 10.489108815179577],
  Malingin: [122.91732682101116, 10.49342702997562],
  Napoles: [122.8977005416998, 10.512649251194247],
  Pacol: [122.86745725376312, 10.494317122191205],
  Poblacion: [122.83607481992988, 10.537613805073846],
  Sagasa: [122.89308125259942, 10.469662308087592],
  Tabunan: [122.93749999344345, 10.576637884752756],
  Taloc: [122.90937045803548, 10.57850192116514],
};

// Status badge classes
const statusBadge = (status) => {
  const map = {
    Pending: "bg-yellow-200 text-yellow-800",
    Verified: "bg-green-200 text-green-800",
    Resolved: "bg-blue-200 text-blue-800",
    Rejected: "bg-red-200 text-red-800",
  };
  return map[status] || "bg-gray-200 text-gray-800";
};

// Severity badge classes (includes “Severe”)
const severityBadge = (severity) => {
  const map = {
    Low: "bg-emerald-200 text-emerald-800",
    Moderate: "bg-amber-200 text-amber-800",
    High: "bg-red-200 text-red-800",
    Severe: "bg-red-300 text-red-900",
  };
  return map[severity] || "bg-gray-200 text-gray-800";
};

// Optional: a list for status filtering
const STATUS_FILTERS = ["Pending", "Verified", "Resolved", "Rejected"];

/* ✅ Helper: normalize barangay to a plain string */
const normalizeBarangayName = (v) => {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && typeof v.name === "string") return v.name;
  return "";
};

const CalamitySidebar = ({
  visible,
  setEnlargedImage,

  zoomToBarangay,
  onBarangaySelect,

  calamityTypes = [],
  selectedCalamityType = "All",
  setSelectedCalamityType = () => {},

  calamities = [],
  selectedCalamity = null,

  selectedBarangay: selectedBarangayProp = "",
}) => {
  const [selectedBarangay, setSelectedBarangay] = useState(
    normalizeBarangayName(selectedBarangayProp)
  );
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [cropMap, setCropMap] = useState({});
  const [ecosystemMap, setEcosystemMap] = useState({});
  const [varietyMap, setVarietyMap] = useState({});

  // NEW: farmer info state
  const [farmerInfo, setFarmerInfo] = useState(null);
  const [farmerLoading, setFarmerLoading] = useState(false);
  const [farmerError, setFarmerError] = useState("");
 const navigate = useNavigate();
  // ✅ New: back button handler
  const handleBackToCalamity = () => {
    if (window.history.length > 1) {
      navigate(-1); // go back to previous page (e.g., /ManageCrops)
    } else {
      navigate("/AdminManageCalamity"); // fallback if opened directly
    }
  };

  // lookups
  useEffect(() => {
    let abort = false;
    (async () => {
      try {
        const [ecoRes, cropRes] = await Promise.all([
          fetch("http://localhost:5000/api/calamities/ecosystems"),
          fetch("http://localhost:5000/api/calamities/crops"),
        ]);
        const ecoData = (await ecoRes.json()) || [];
        const cropData = (await cropRes.json()) || [];
        if (abort) return;
        const cm = {};
        cropData.forEach((c) => (cm[String(c.id)] = c.name));
        setCropMap(cm);
        const em = {};
        ecoData.forEach((e) => (em[String(e.id)] = e.name));
        setEcosystemMap(em);
      } catch {
        // silent
      }
    })();
    return () => {
      abort = true;
    };
  }, []);

  // varieties for selected calamity
  useEffect(() => {
    let abort = false;
    const cropTypeId = selectedCalamity?.crop_type_id;
    if (!cropTypeId) return;
    (async () => {
      try {
        const res = await fetch(
          `http://localhost:5000/api/calamities/crops/${cropTypeId}/varieties`
        );
        const data = (await res.json()) || [];
        if (abort) return;
        const vm = {};
        data.forEach((v) => (vm[String(v.id)] = v.name));
        setVarietyMap(vm);
      } catch {
        // silent
      }
    })();
    return () => {
      abort = true;
    };
  }, [selectedCalamity?.crop_type_id]);

  // sync preselected barangay from parent (normalize to string)
  useEffect(() => {
    const next = normalizeBarangayName(selectedBarangayProp);
    if (next !== normalizeBarangayName(selectedBarangay)) {
      setSelectedBarangay(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBarangayProp]);

  const handleBarangayChange = (e) => {
    const brgy = e.target.value; // string
    setSelectedBarangay(brgy);
    if (BARANGAY_COORDS[brgy]) {
      const coordinates = BARANGAY_COORDS[brgy]; // [lng, lat]
      zoomToBarangay?.(coordinates);
      onBarangaySelect?.({ name: brgy, coordinates });
    }
  };

  // 🔥 NEW: fetch farmer info when selectedCalamity changes
  useEffect(() => {
    setFarmerInfo(null);
    setFarmerError("");

    const id = selectedCalamity?.calamity_id || selectedCalamity?.id;
    if (!id) return;

    let abort = false;
    const run = async () => {
      try {
        setFarmerLoading(true);
        const res = await fetch(
          `http://localhost:5000/api/calamities/${id}/farmer`
        );

        if (!res.ok) {
          if (res.status === 404) {
            if (!abort) {
              setFarmerInfo(null);
              setFarmerError("");
            }
          } else {
            if (!abort) {
              setFarmerInfo(null);
              setFarmerError("Failed to load farmer info.");
            }
          }
          return;
        }

        const data = await res.json();
        if (abort) return;
        setFarmerInfo(data || null);
      } catch (err) {
        if (!abort) {
          setFarmerInfo(null);
          setFarmerError("Failed to load farmer info.");
        }
      } finally {
        if (!abort) setFarmerLoading(false);
      }
    };

    run();
    return () => {
      abort = true;
    };
  }, [selectedCalamity?.calamity_id, selectedCalamity?.id]);

  // filter list by type + barangay + status (robust lower-casing)
  const filteredCalamities = useMemo(() => {
    const byType =
      selectedCalamityType === "All"
        ? calamities
        : calamities.filter((c) => c.calamity_type === selectedCalamityType);

    const selectedBarangayStr = normalizeBarangayName(selectedBarangay);
    const byBarangay = selectedBarangayStr
      ? byType.filter(
          (c) =>
            String(c.location || "").toLowerCase() ===
            selectedBarangayStr.toLowerCase()
        )
      : byType;

    const byStatus =
      selectedStatus === "All"
        ? byBarangay
        : byBarangay.filter((c) => (c.status || "Pending") === selectedStatus);

    return byStatus;
  }, [calamities, selectedCalamityType, selectedBarangay, selectedStatus]);

  const totalCount = Array.isArray(calamities) ? calamities.length : 0;
  const filteredCount = filteredCalamities.length;

  // Build full list of photo URLs (multi-photo support + robust fallback)
  const photoUrls = useMemo(() => {
    if (!selectedCalamity) return [];

    const base = "http://localhost:5000";
    const urls = new Set();

    const pushUrl = (raw) => {
      if (!raw) return;
      let p = String(raw).trim();
      if (!p) return;

      // accept csv like "a.jpg, b.jpg"
      if (p.includes(",") && !p.startsWith("[") && !p.startsWith("{")) {
        p.split(",").forEach((part) => pushUrl(part));
        return;
      }

      // if it's JSON array inside a string, parse
      if ((p.startsWith("[") && p.endsWith("]")) || (p.startsWith('"') && p.endsWith('"'))) {
        try {
          const parsed = JSON.parse(p);
          if (Array.isArray(parsed)) {
            parsed.forEach((x) => pushUrl(x));
            return;
          }
        } catch {
          /* ignore and continue as a single path */
        }
      }

      // normalize leading slashes and make absolute
      if (!/^https?:\/\//i.test(p)) {
        p = p.startsWith("/") ? `${base}${p}` : `${base}/${p}`;
      }

      urls.add(p);
    };

    if (Array.isArray(selectedCalamity.photos)) {
      selectedCalamity.photos.forEach(pushUrl);
    } else if (selectedCalamity.photos) {
      pushUrl(selectedCalamity.photos);
    }

    if (urls.size === 0 && selectedCalamity.photo) {
      pushUrl(selectedCalamity.photo);
    }

    return Array.from(urls);
  }, [selectedCalamity]);

  const heroImg = photoUrls.length > 0 ? photoUrls[0] : null;

  const cropName = (id) => (id ? cropMap[String(id)] || `#${id}` : "—");
  const ecoName = (id) => (id ? ecosystemMap[String(id)] || `#${id}` : "—");
  const varietyName = (id) => (id ? varietyMap[String(id)] || `#${id}` : "—");

  // Admin full name helper (supports backend + localStorage fallback)
  const adminFullName = useMemo(() => {
    const sc = selectedCalamity || {};

    if (sc.admin_full_name && String(sc.admin_full_name).trim())
      return sc.admin_full_name;

    if (sc.admin_name && String(sc.admin_name).trim()) return sc.admin_name;
    const first = sc.admin_first_name || sc.first_name;
    const last = sc.admin_last_name || sc.last_name;
    if ((first || last) && String(first || last).trim()) {
      return [first, last].filter(Boolean).join(" ").trim();
    }

    if (typeof window !== "undefined") {
      const lsAdminFull = localStorage.getItem("admin_full_name");
      const lsFull = localStorage.getItem("full_name");
      const lsFirst = localStorage.getItem("first_name");
      const lsLast = localStorage.getItem("last_name");

      if (lsAdminFull && lsAdminFull.trim()) return lsAdminFull.trim();
      if (lsFull && lsFull.trim()) return lsFull.trim();
      const joined = [lsFirst, lsLast].filter(Boolean).join(" ").trim();
      if (joined) return joined;
    }

    return sc.admin_id ? `Admin #${sc.admin_id}` : "—";
  }, [selectedCalamity]);

  // Robust severity value (handles severity_level or legacy severity)
  const severityValue = useMemo(() => {
    const raw =
      selectedCalamity?.severity_level ?? selectedCalamity?.severity ?? null;
    if (!raw) return null;
    const s = String(raw).trim();
    if (!s) return null;
    const cap = s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
    if (["Low", "Moderate", "High", "Severe"].includes(cap)) return cap;
    return s;
  }, [selectedCalamity]);

  // ✅ Combine farmer from backend + any inline "farmer" field from calamity (future-proof)
  const farmerData = useMemo(() => {
    if (selectedCalamity?.farmer) return selectedCalamity.farmer;
    return farmerInfo;
  }, [selectedCalamity, farmerInfo]);

  const farmerFullName = useMemo(() => {
    if (!farmerData) return null;
    const first =
      farmerData.first_name || farmerData.farmer_first_name || "";
    const last =
      farmerData.last_name || farmerData.farmer_last_name || "";
    const full = [first, last].filter(Boolean).join(" ").trim();
    return full || null;
  }, [farmerData]);

  return (
    <div
      className={clsx(
        "absolute top-0 left-0 h-full bg-gray-50 z-20 overflow-y-auto border-r border-gray-200",
        visible ? "w-[500px]" : "w-0 overflow-hidden"
      )}
    >
      <div className={clsx("transition-all", visible ? "px-6 py-6" : "px-0 py-0")}>
        {/* Hero image / placeholder */}
        <div className="mb-4">
          <div className="relative w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-50 aspect-[16/9]">
            {heroImg ? (
              <img
                src={heroImg}
                alt="Calamity"
                className="h-full w-full object-cover cursor-pointer"
                onClick={() => setEnlargedImage?.(heroImg)}
              />
            ) : (
              <div className="h-full w-full flex flex-col items-center justify-center gap-2">
                <img src={AgriGISLogo} alt="AgriGIS" className="h-12 opacity-70" />
                <p className="text-xs text-gray-500">
                  Select a calamity marker on the map to see details here.
                </p>
              </div>
            )}
          </div>
        </div>

         {/* 🔙 Back to Manage Crops */}
        <div className="mb-4">
          <button
            type="button"
            onClick={handleBackToCalamity}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            title="Go back to Manage Crops"
          >
            ← Back 
          </button>
        </div>

        {/* Location (static) */}
        <Section title="Location">
          <dl className="grid grid-cols-3 gap-3">
            <KV label="Region" value="Western Visayas" />
            <KV label="Province" value="Negros Occidental" />
            <KV label="Municipality" value="Bago City" />
          </dl>
        </Section>

        {/* Map filters */}
        <Section title="Map filters">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
                Calamity type
              </label>
              <select
                className="w-full border border-gray-300 rounded-md px-2 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                value={selectedCalamityType}
                onChange={(e) => setSelectedCalamityType?.(e.target.value)}
              >
                <option value="All">All</option>
                {CALAMITY_FILTERS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
                Barangay
              </label>
              <select
                value={normalizeBarangayName(selectedBarangay)}
                onChange={handleBarangayChange}
                className="w-full border border-gray-300 rounded-md px-2 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
              >
                <option value="">All barangays</option>
                {Object.keys(BARANGAY_COORDS).map((brgy) => (
                  <option key={brgy} value={brgy}>
                    {brgy}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
                Status
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-2 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
              >
                <option value="All">All</option>
                {STATUS_FILTERS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 🔢 Filter summary */}
          <p className="mt-3 text-[11px] text-gray-500">
            Showing <span className="font-semibold text-gray-800">{filteredCount}</span>{" "}
            of <span className="font-semibold text-gray-800">{totalCount}</span>{" "}
            incident{totalCount === 1 ? "" : "s"} matching filters
          </p>
        </Section>

        {/* Selected report (details + photos + farmer info) */}
        {selectedCalamity && (
          <Section title="Selected report">
            {/* Top chips: barangay, type, status, severity, area */}
            <div className="flex flex-wrap gap-2 mb-4">
              {selectedCalamity.location && (
                <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                  {selectedCalamity.location}
                </span>
              )}

              {selectedCalamity.calamity_type && (
                <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-800 border border-gray-300">
                  {selectedCalamity.calamity_type}
                </span>
              )}

              {selectedCalamity.status && (
                <span
                  className={clsx(
                    "inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border",
                    statusBadge(selectedCalamity.status)
                  )}
                >
                  {selectedCalamity.status}
                </span>
              )}

              {severityValue && (
                <span
                  className={clsx(
                    "inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border",
                    severityBadge(severityValue)
                  )}
                >
                  Severity: {severityValue}
                </span>
              )}

              {selectedCalamity.affected_area && (
                <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                  {fmtHa(selectedCalamity.affected_area)}
                </span>
              )}
            </div>

            {/* Key fields */}
            <dl className="grid grid-cols-2 gap-4">
              <KV label="Calamity type" value={fmt(selectedCalamity.calamity_type)} />
              <KV label="Crop stage" value={fmt(selectedCalamity.crop_stage)} />
              <KV
                label="Crop type"
                value={fmt(cropName(selectedCalamity.crop_type_id))}
              />
              <KV
                label="Ecosystem"
                value={fmt(ecoName(selectedCalamity.ecosystem_id))}
              />
              <KV
                label="Variety"
                value={fmt(varietyName(selectedCalamity.crop_variety_id))}
              />
              <KV label="Affected area" value={fmtHa(selectedCalamity.affected_area)} />
              <KV
                label="Severity"
                value={fmt(
                  selectedCalamity.severity_level || selectedCalamity.severity
                )}
              />
              <KV
                label="Location (barangay)"
                value={fmt(selectedCalamity.location)}
              />
              <KV label="Reported by" value={fmt(adminFullName)} />
              <KV
                label="Reported on"
                value={fmtDate(
                  selectedCalamity.date_reported || selectedCalamity.created_at
                )}
              />
            </dl>

            {/* Description */}
            <div className="mt-4">
              <div className="text-xs uppercase tracking-wide text-gray-500">
                Description
              </div>
              <p className="text-sm text-gray-900 mt-1">
                {selectedCalamity.description?.trim() || "—"}
              </p>
            </div>

            {/* Photos */}
            {photoUrls.length > 0 &&
              (() => {
                const n = photoUrls.length;
                const isSingle = n === 1;

                return (
                  <div className="mt-4">
                    <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                      Photos
                    </div>

                    {isSingle ? (
                      <button
                        type="button"
                        className="group relative block overflow-hidden rounded-lg border border-gray-200 bg-gray-50 aspect-[16/9] w-full"
                        onClick={() => setEnlargedImage?.(photoUrls[0])}
                        title="View photo"
                      >
                        <img
                          src={photoUrls[0]}
                          alt={`${selectedCalamity?.calamity_type || "Calamity"} 1`}
                          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.01]"
                          loading="lazy"
                        />
                      </button>
                    ) : (
                      <div
                        className="grid gap-2"
                        style={{
                          gridTemplateColumns:
                            n === 2
                              ? "repeat(2, 1fr)"
                              : "repeat(auto-fill, minmax(110px, 1fr))",
                        }}
                      >
                        {photoUrls.map((url, idx) => (
                          <button
                            key={idx}
                            type="button"
                            className="group relative block overflow-hidden rounded-md border border-gray-200 bg-gray-50 aspect-square"
                            onClick={() => setEnlargedImage?.(url)}
                            title={`View photo ${idx + 1}`}
                          >
                            <img
                              src={url}
                              alt={`${selectedCalamity?.calamity_type || "Calamity"} ${
                                idx + 1
                              }`}
                              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                              loading="lazy"
                            />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

            {/* Farmer info embedded */}
            <div className="mt-4 rounded-lg border border-gray-100 bg-gray-50 px-3 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
                Farmer details
              </p>

              {farmerLoading && (
                <p className="text-xs text-gray-500">Loading farmer info…</p>
              )}

              {!farmerLoading && farmerError && (
                <p className="text-xs text-red-600">{farmerError}</p>
              )}

              {!farmerLoading && !farmerError && !farmerData && (
                <p className="text-xs text-gray-500">
                  No farmer information encoded for this calamity.
                </p>
              )}

              {farmerData && (
                <dl className="grid grid-cols-2 gap-4 mt-1">
                  <KV
                    label="Farmer name"
                    value={fmt(farmerFullName || "—")}
                  />
                  <KV
                    label="Mobile number"
                    value={fmt(
                      farmerData.mobile_number ||
                        farmerData.farmer_mobile_number
                    )}
                  />
                  <KV
                    label="Farmer barangay"
                    value={fmt(
                      farmerData.barangay || farmerData.farmer_barangay
                    )}
                  />
                  <KV
                    label="Full address"
                    value={fmt(
                      farmerData.full_address ||
                        farmerData.farmer_full_address
                    )}
                  />
                </dl>
              )}
            </div>
          </Section>
        )}

        {/* Legend */}
        <Section title="Legend">
          <details className="text-sm">
            <summary className="cursor-pointer select-none text-gray-900">
              Show colors
            </summary>
            <ul className="mt-2 space-y-1">
              {Object.entries(CALAMITY_COLORS).map(([label, color]) => (
                <li key={label} className="flex items-center">
                  <span
                    className="inline-block w-3.5 h-3.5 rounded-full mr-2"
                    style={{ backgroundColor: color }}
                  />
                  {label}
                </li>
              ))}
            </ul>
          </details>
        </Section>

        {/* Home */}
        <div className="mt-5">
          <Button to="/AdminLanding" variant="outline" size="md">
            Home
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CalamitySidebar;
