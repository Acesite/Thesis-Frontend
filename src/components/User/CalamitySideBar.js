// components/CalamitySidebar.jsx
import React, { useMemo, useState, useEffect } from "react";
import clsx from "clsx";
import AgriGISLogo from "../../components/MapboxImages/AgriGIS.png";
import Button from "./MapControls/Button";

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
      } catch {}
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
      } catch {}
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

  return (
    <div
      className={clsx(
        "absolute top-0 left-0 h-full bg-gray-50 z-20 overflow-y-auto border-r border-gray-200",
        visible ? "w-[500px]" : "w-0 overflow-hidden"
      )}
    >
      <div className={clsx("transition-all", visible ? "px-6 py-6" : "px-0 py-0")}>
        {/* Hero image / logo */}
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
              <div className="h-full w-full flex items-center justify-center">
                <img src={AgriGISLogo} alt="AgriGIS" className="h-12 opacity-70" />
              </div>
            )}
          </div>
        </div>

        {/* Location */}
        <Section title="Location">
          <dl className="grid grid-cols-3 gap-3">
            <KV label="Region" value="Western Visayas" />
            <KV label="Province" value="Negros Occidental" />
            <KV label="Municipality" value="Bago City" />
          </dl>
        </Section>

        {/* Filters */}
        <Section title="Filters">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
                Calamity Type
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
                <option value="">All</option>
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
        </Section>

        {/* Details */}
        {selectedCalamity && (
          <Section title="Report details">
            <div className="flex flex-wrap gap-2 mb-3">
              {selectedCalamity.location && (
                <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                  {selectedCalamity.location}
                </span>
              )}

              {selectedCalamity.status && (
                <span
  className={clsx(
    "inline-flex items-center justify-center text-xs px-3 py-1 rounded-full border",
    statusBadge(selectedCalamity.status).replace("text-", "border-")
  )}
>
  <span className={statusBadge(selectedCalamity.status).split(" ")[1]}>
    {selectedCalamity.status}
  </span>
</span>

              )}

              {severityValue && (
                <span
  className={clsx(
    "inline-flex items-center justify-center text-xs px-3 py-1 rounded-full border",
    severityBadge(severityValue).replace("text-", "border-")
  )}
  title="Severity"
>
  <span className={severityBadge(severityValue).split(" ")[1]}>f
    {severityValue}
  </span>
</span>

              )}

              {selectedCalamity.affected_area && (
                <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                  {fmtHa(selectedCalamity.affected_area)}
                </span>
              )}
            </div>

            <dl className="grid grid-cols-2 gap-4">
              <KV label="Calamity Type" value={fmt(selectedCalamity.calamity_type)} />
              <KV label="Crop Stage" value={fmt(selectedCalamity.crop_stage)} />
              <KV label="Crop Type" value={fmt(cropName(selectedCalamity.crop_type_id))} />
              <KV label="Ecosystem" value={fmt(ecoName(selectedCalamity.ecosystem_id))} />
              <KV label="Variety" value={fmt(varietyName(selectedCalamity.crop_variety_id))} />
              <KV label="Affected Area" value={fmtHa(selectedCalamity.affected_area)} />
              <KV
                label="Severity" 
                value={fmt(
                  selectedCalamity.severity_level || selectedCalamity.severity
                )}
              />
              <KV label="Location (Barangay)" value={fmt(selectedCalamity.location)} />
              <KV label="Reported By" value={fmt(adminFullName)} />
              <KV
                label="Reported"
                value={fmtDate(
                  selectedCalamity.date_reported || selectedCalamity.created_at
                )}
              />
              <div className="col-span-2">
                <span
                  className={clsx(
                    "inline-block px-2 py-1 rounded-full text-xs font-medium",
                    statusBadge(selectedCalamity.status || "Pending")
                  )}
                >
                  {selectedCalamity.status || "Pending"}
                </span>
              </div>
            </dl>

            <div className="mt-3">
              <div className="text-xs uppercase tracking-wide text-gray-500">
                Description
              </div>
              <p className="text-sm text-gray-900 mt-1">
                {selectedCalamity.description?.trim() || "—"}
              </p>
            </div>

            {photoUrls.length > 0 && (
              <div className="mt-4">
                <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                  Photos
                </div>
                <div className="grid grid-cols-3 gap-2">
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
                        alt={`${selectedCalamity.calamity_type || "Calamity"} ${idx + 1}`}
                        className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                        loading="lazy"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
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
