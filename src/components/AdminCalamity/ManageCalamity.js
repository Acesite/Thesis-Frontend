// pages//AdminManageCalamity.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import AOS from "aos";
import "aos/dist/aos.css";
import axios from "axios";
import AdminNav from "../NavBar/AdminNavbar";
import Footer from "../LandingPage/Footer";

/* ---------- CONFIG ---------- */
const colorByIncident = {
  Flood: "#60a5fa",
  Landslide: "#b45309",
  Fire: "#ef4444",
  Typhoon: "#22c55e",
  Earthquake: "#a3a3a3",
  Others: "#8b5cf6",
};

const CROP_STAGES = ["Planted", "Ripening", "Harvested"];

const SORT_OPTIONS = [
  { value: "reported_desc", label: "Reported: Newest" },
  { value: "reported_asc", label: "Reported: Oldest" },
  { value: "severity_desc", label: "Severity: High → Low" },
  { value: "severity_asc", label: "Severity: Low → High" },
];

/* ---------- UTILS ---------- */
const nf2 = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
const fmtNum = (v) =>
  v === null || v === undefined || v === "" ? "N/A" : nf2.format(Number(v));
const fmtDate = (date) => {
  if (!date) return "N/A";
  const t = new Date(date);
  return isNaN(t.getTime())
    ? "N/A"
    : t.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
};

/* ---------- datetime-local helpers ---------- */
const pad2 = (n) => String(n).padStart(2, "0");
const toDatetimeLocalValue = (d) => {
  if (!d) return "";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}T${pad2(
    dt.getHours()
  )}:${pad2(dt.getMinutes())}`;
};
const fromDatetimeLocalToISO = (val) => {
  if (!val) return null;
  const dt = new Date(val);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString();
};

/* ---------- CALAMITY UI HELPERS ---------- */
const fmtStr = (v) => (v || v === 0 ? String(v) : "N/A");
const fmtHa = (v) => (v || v === 0 ? `${Number(v).toFixed(2)} ha` : "N/A");

const statusBadge = (status) => {
  const map = {
    Pending: "bg-yellow-100 text-yellow-800 border border-yellow-200",
    Verified: "bg-green-100 text-green-800 border border-green-200",
    Resolved: "bg-blue-100 text-blue-800 border border-blue-200",
    Rejected: "bg-red-100 text-red-800 border border-red-200",
  };
  return map[status || ""] || "bg-gray-100 text-gray-800 border border-gray-200";
};

const severityBadge = (sevText) => {
  const map = {
    Low: "bg-emerald-100 text-emerald-800 border border-emerald-200",
    Moderate: "bg-amber-100 text-amber-800 border border-amber-200",
    High: "bg-red-100 text-red-800 border border-red-200",
    Severe: "bg-red-200 text-red-900 border border-red-300",
  };
  return map[sevText || ""] || "bg-gray-100 text-gray-800 border border-gray-200";
};

/* ---------- SMALL UI PRIMS ---------- */
const Chip = ({ active, children, onClick }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1.5 rounded-full border text-sm transition ${
      active
        ? "bg-emerald-600 text-white border-emerald-600"
        : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
    }`}
  >
    {children}
  </button>
);

const Stat = ({ label, value }) => (
  <div>
    <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
    <div className="text-[14px] text-slate-900">{value}</div>
  </div>
);

function NoteClamp({ text, className = "" }) {
  const [expanded, setExpanded] = useState(false);
  if (!text || !text.toString().trim()) return null;
  const needsToggle = text.length > 140;
  return (
    <div className={className}>
      <div className="text-[11px] uppercase tracking-wide text-slate-500">Description</div>
      <p
        className={`text-[14px] text-slate-700 ${expanded ? "" : "line-clamp-3"}`}
        style={
          !expanded
            ? { display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }
            : {}
        }
      >
        {text}
      </p>
      {needsToggle && (
        <button onClick={() => setExpanded((v) => !v)} className="mt-1 text-[12px] text-emerald-700 hover:underline">
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

function PageBtn({ children, disabled, onClick, aria }) {
  return (
    <button
      aria-label={aria}
      disabled={disabled}
      onClick={onClick}
      className={`px-2.5 py-1.5 rounded-md border text-sm ${
        disabled
          ? "text-slate-400 border-slate-200 cursor-not-allowed"
          : "text-slate-700 border-slate-300 hover:bg-slate-50 focus:ring-2 focus:ring-emerald-600"
      }`}
    >
      {children}
    </button>
  );
}

function ConfirmDialog({ title, message, onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-center justify-center">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b">
          <h4 className="text-base font-semibold text-slate-900">{title}</h4>
        </div>
        <div className="px-4 sm:px-6 py-4">
          <p className="text-sm text-slate-700">{message}</p>
        </div>
        <div className="px-4 sm:px-6 py-4 border-t flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 rounded-md border border-slate-300 hover:bg-slate-50">
            Cancel
          </button>
          <button onClick={onConfirm} className="px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700">
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

const SkeletonCard = () => (
  <div className="rounded-2xl border border-slate-200 p-5 animate-pulse">
    <div className="h-4 w-24 bg-slate-200 rounded mb-2" />
    <div className="h-6 w-36 bg-slate-200 rounded mb-4" />
    <div className="grid grid-cols-2 gap-3">
      <div className="h-3 w-28 bg-slate-200 rounded" />
      <div className="h-3 w-28 bg-slate-200 rounded" />
      <div className="h-3 w-24 bg-slate-200 rounded" />
      <div className="h-3 w-24 bg-slate-200 rounded" />
    </div>
    <div className="mt-4 h-20 bg-slate-100 rounded" />
  </div>
);

const EmptyState = ({ onClear }) => (
  <div className="col-span-full rounded-2xl border border-dashed border-slate-300 p-8 sm:p-10 text-center">
    <h4 className="text-lg font-semibold text-slate-900">No incidents foun hellod</h4>
    <p className="mt-1 text-slate-600">Try adjusting the filters or your search.</p>
    <button
      onClick={onClear}
      className="mt-4 inline-flex items-center px-3 py-2 rounded-md border border-slate-300 hover:bg-slate-50"
    >
      Clear filters
    </button>
  </div>
);

/* ---------- PAGE ---------- */
const ManageCalamity = () => {
  const navigate = useNavigate();

  const [incidents, setIncidents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [editingIncident, setEditingIncident] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [activeActionId, setActiveActionId] = useState(null);

  const [incidentTypes, setIncidentTypes] = useState([]);
  const [selectedType, setSelectedType] = useState(null);
  const [search, setSearch] = useState("");

  const [sort, setSort] = useState("reported_desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [pendingDelete, setPendingDelete] = useState(null);

  const [viewingIncident, setViewingIncident] = useState(null);

  // Lookups
  const [cropTypes, setCropTypes] = useState([]);
  const [varieties, setVarieties] = useState([]);
  const [ecosystems, setEcosystems] = useState([]);

  // Farmers “View all”
  const [farmersModal, setFarmersModal] = useState(null); // { incident, farmers, loading }

  // Edit modal → farmer panel
  const [editFarmer, setEditFarmer] = useState(null);
  const [isEditingFarmer, setIsEditingFarmer] = useState(false);
  const [editFarmerDraft, setEditFarmerDraft] = useState(null);

  // Close kebab on outside click / Escape
  const pageRef = useRef(null);
  useEffect(() => {
    const onDown = (e) => {
      if (!activeActionId) return;
      const el = e.target;
      const insideMenu = el.closest?.("[data-kebab-menu='true']");
      const isButton = el.closest?.("[data-kebab-trigger='true']");
      if (!insideMenu && !isButton) setActiveActionId(null);
    };
    const onEsc = (e) => {
      if (e.key === "Escape") setActiveActionId(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [activeActionId]);

  useEffect(() => {
    AOS.init({ duration: 400, once: true });

    (async () => {
      try {
        setIsLoading(true);
        const [incRes, typesRes] = await Promise.all([
          axios.get("http://localhost:5000/api/managecalamities"),
          axios.get("http://localhost:5000/api/managecalamities/types").catch(() => ({ data: [] })),
        ]);
        setIncidents(incRes.data || []);
        setIncidentTypes(typesRes.data || []);
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    })();

    (async () => {
      try {
        const [ct, cv, eco] = await Promise.all([
          axios.get("http://localhost:5000/api/managecalamities/crop-types").catch(() => ({ data: [] })),
          axios.get("http://localhost:5000/api/managecalamities/crop-varieties").catch(() => ({ data: [] })),
          axios.get("http://localhost:5000/api/managecalamities/ecosystems").catch(() => ({ data: [] })),
        ]);
        setCropTypes(Array.isArray(ct.data) ? ct.data : []);
        setVarieties(Array.isArray(cv.data) ? cv.data : []);
        setEcosystems(Array.isArray(eco.data) ? eco.data : []);
      } catch {}
    })();
  }, []);

  const fetchIncidents = async () => {
    try {
      setIsLoading(true);
      const res = await axios.get("http://localhost:5000/api/managecalamities");
      setIncidents(res.data || []);
    } catch (e) {
      console.error("Error fetching incidents:", e);
    } finally {
      setIsLoading(false);
    }
  };

  /* ------- farmers modal loader ------- */
  const openFarmersModal = async (incident) => {
    const id = String(incident.id);
    try {
      setFarmersModal({ incident, farmers: [], loading: true });
      const { data } = await axios.get(`http://localhost:5000/api/managecalamities/${id}/farmers`);
      setFarmersModal({
        incident,
        farmers: Array.isArray(data) ? data : [],
        loading: false,
      });
    } catch (e) {
      console.error("Load farmers failed:", e);
      setFarmersModal({ incident, farmers: [], loading: false });
    }
  };

  /* ------- filter + search ------- */
  const filtered = useMemo(() => {
    const byType = incidents.filter((c) => {
      const t = c.calamity_type || c.incident_type || c.type_name;
      return !selectedType || t === selectedType;
    });
    if (!search.trim()) return byType;
    const q = search.toLowerCase();
    return byType.filter((c) =>
      [
        c.calamity_type,
        c.incident_type,
        c.type_name,
        c.status,
        c.barangay,
        c.location,
        c.description,
        c.crop_stage,
        c.ecosystem_name,
        c.crop_type_name,
        c.variety_name,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [incidents, selectedType, search]);

  /* ------- sort ------- */
  const sorted = useMemo(() => {
    const arr = [...filtered];
    const toTime = (d) => {
      if (!d) return null;
      const t = new Date(d).getTime();
      return Number.isNaN(t) ? null : t;
    };
    const toSeverityNum = (sevText, numericFallback) => {
      const s = String(sevText || "").toLowerCase();
      if (s === "severe") return 6;
      if (s === "high") return 5;
      if (s === "moderate") return 3;
      if (s === "low") return 1;
      return Number(numericFallback) || 0;
    };
    switch (sort) {
      case "reported_asc":
        arr.sort(
          (a, b) =>
            (toTime(a.date_reported || a.reported_at) ?? Infinity) -
            (toTime(b.date_reported || b.reported_at) ?? Infinity)
        );
        break;
      case "reported_desc":
        arr.sort(
          (a, b) =>
            (toTime(b.date_reported || b.reported_at) ?? -Infinity) -
            (toTime(a.date_reported || a.reported_at) ?? -Infinity)
        );
        break;
      case "severity_asc":
        arr.sort(
          (a, b) =>
            toSeverityNum(a.severity_level || a.severity_text, a.severity) -
            toSeverityNum(b.severity_level || b.severity_text, b.severity)
        );
        break;
      case "severity_desc":
        arr.sort(
          (a, b) =>
            toSeverityNum(b.severity_level || b.severity_text, b.severity) -
            toSeverityNum(a.severity_level || a.severity_text, a.severity)
        );
        break;
      default:
        break;
    }
    return arr;
  }, [filtered, sort]);

  useEffect(() => {
    setPage(1);
  }, [selectedType, search, sort, pageSize]);

  /* ------- pagination ------- */
  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  const pageItems = sorted.slice(start, start + pageSize);

  /* ------- edit/update ------- */
  const handleEdit = async (incident) => {
    const latest = incident;
    setEditingIncident(latest);

    const reportedRaw = latest.date_reported || latest.reported_at || latest.created_at || null;

    setEditForm({
      ...latest,
      incident_type: latest.calamity_type || latest.incident_type || latest.type_name || "",
      severity_text: latest.severity_level || latest.severity_text || "",
      severity: latest.severity || 0,
      status: latest.status || "",
      barangay: latest.barangay || latest.location || "",
      reported_at: reportedRaw || "",
      reported_at_input: toDatetimeLocalValue(reportedRaw),

      // removed lat/long from edit form (edit modal no coordinates)
      note: latest.description || latest.note || "",
      affected_area: latest.affected_area ?? "",
      crop_stage: latest.crop_stage ?? "",

      crop_type_id: latest.crop_type_id ?? "",
      crop_variety_id: latest.crop_variety_id ?? "",
      ecosystem_id: latest.ecosystem_id ?? "",

      crop_type_name: latest.crop_type_name ?? "",
      ecosystem_name: latest.ecosystem_name ?? "",
      variety_name: latest.variety_name ?? "",
    });

    // load 1st linked farmer for the panel
    try {
      const { data } = await axios.get(
        `http://localhost:5000/api/managecalamities/${String(latest.id)}/farmers`
      );
      const arr = Array.isArray(data) ? data : [];
      const f0 = arr[0] || null;
      setEditFarmer(f0);
      setEditFarmerDraft(
        f0
          ? {
              first_name: f0.first_name || "",
              last_name: f0.last_name || "",
              mobile_number: f0.mobile_number || "",
              barangay: f0.barangay || "",
              full_address: f0.full_address || "",
            }
          : null
      );
      setIsEditingFarmer(false);
    } catch (e) {
      setEditFarmer(null);
      setEditFarmerDraft(null);
      setIsEditingFarmer(false);
    }
  };

  const coerceNum = (v) => {
    if (v === "" || v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  /* ------- dependent dropdowns helpers ------- */
  const filteredVarieties = useMemo(() => {
    if (!Array.isArray(varieties)) return [];
    const ct = editForm?.crop_type_id;
    if (!ct) return [];
    return varieties.filter((v) => String(v.crop_type_id) === String(ct));
  }, [varieties, editForm?.crop_type_id]);

  const filteredEcosystems = useMemo(() => {
    if (!Array.isArray(ecosystems)) return [];
    const ct = editForm?.crop_type_id;
    if (!ct) return [];
    return ecosystems.filter((e) => String(e.crop_type_id) === String(ct));
  }, [ecosystems, editForm?.crop_type_id]);

  const handleEditChange = (e) => {
    const { name, value } = e.target;

    if (name === "reported_at_input") {
      return setEditForm((prev) => ({
        ...prev,
        reported_at_input: value,
        reported_at: fromDatetimeLocalToISO(value) || value,
      }));
    }

    if (name === "crop_type_id") {
      return setEditForm((prev) => {
        const next = { ...prev, crop_type_id: value };
        const ecoValid = filteredEcosystems.some((el) => String(el.id) === String(prev.ecosystem_id));
        const varValid = filteredVarieties.some((v) => String(v.id) === String(prev.crop_variety_id));
        if (!ecoValid) next.ecosystem_id = "";
        if (!varValid) next.crop_variety_id = "";
        return next;
      });
    }

    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleUpdate = async () => {
    try {
      const payload = {
        incident_type: editForm.incident_type || null,
        status: editForm.status || null,
        severity_text: editForm.severity_text || null,
        severity: coerceNum(editForm.severity),
        reported_at:
          editForm.reported_at || fromDatetimeLocalToISO(editForm.reported_at_input) || null,
        barangay: editForm.barangay || null,

        // coordinates deliberately NOT sent (removed from edit modal)
        affected_area: coerceNum(editForm.affected_area),
        crop_stage: editForm.crop_stage || null,

        crop_type_id: coerceNum(editForm.crop_type_id),
        crop_variety_id: coerceNum(editForm.crop_variety_id),
        ecosystem_id: coerceNum(editForm.ecosystem_id),

        note: editForm.note || null,
      };

      await axios.put(`http://localhost:5000/api/managecalamities/${editingIncident.id}`, payload);
      await fetchIncidents();
      setEditingIncident(null);
      alert("Incident updated successfully!");
    } catch (err) {
      console.error("Update error:", err);
      alert("Failed to update incident.");
    }
  };

  /* farmer edit in edit modal */
  const saveFarmerChanges = async () => {
    if (!editingIncident || !editFarmer || !editFarmerDraft) return;
    try {
      const url = `http://localhost:5000/api/managecalamities/${String(
        editingIncident.id
      )}/farmers/${String(editFarmer.farmer_id)}`;
      const payload = {
        first_name: editFarmerDraft.first_name?.trim() || null,
        last_name: editFarmerDraft.last_name?.trim() || null,
        mobile_number: editFarmerDraft.mobile_number?.trim() || null,
        barangay: editFarmerDraft.barangay?.trim() || null,
        full_address: editFarmerDraft.full_address?.trim() || null,
      };
      const { data } = await axios.put(url, payload);
      setEditFarmer(data || payload);
      setIsEditingFarmer(false);
      alert("Farmer credentials updated.");
    } catch (e) {
      console.error("Save farmer failed:", e);
      alert("Failed to update farmer credentials.");
    }
  };

  /* ------- delete with confirm ------- */
  const confirmDelete = async () => {
    try {
      await axios.delete(`http://localhost:5000/api/managecalamities/${pendingDelete.id}`);
      setIncidents((prev) => prev.filter((c) => c.id !== pendingDelete.id));
      setPendingDelete(null);
      alert("Incident deleted successfully!");
    } catch (err) {
      console.error("Delete error:", err);
      alert("Failed to delete incident.");
    }
  };

  /* ---------- RENDER ---------- */
  return (
    <div ref={pageRef} className="flex flex-col min-h-screen bg-white font-poppins">
      <AdminNav />

      <main className="ml-0 md:ml-[115px] pt-20 md:pt-[92px] pr-0 md:pr-8 flex-grow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="mb-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-[26px] sm:text-[32px] leading-tight font-bold text-slate-900">Calamity hello   Management</h1>
                <p className="text-[14px] sm:text-[15px] text-slate-600">View, filter, and update reported incidents.</p>
              </div>
            </div>

            {/* Tools Row */}
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <Chip active={!selectedType} onClick={() => setSelectedType(null)}>
                  All
                </Chip>
                {incidentTypes.length > 0
                  ? incidentTypes.map((t, idx) => (
                      <Chip
                        key={`${t.name || t.id || "type"}-${idx}`}
                        active={selectedType === (t.name || t.id)}
                        onClick={() =>
                          setSelectedType(selectedType === (t.name || t.id) ? null : t.name || t.id)
                        }
                      >
                        {t.name || t.label || "Type"}
                      </Chip>
                    ))
                  : Object.entries(colorByIncident).map(([k], idx) => (
                      <Chip
                        key={`${k}-${idx}`}
                        active={selectedType === k}
                        onClick={() => setSelectedType(selectedType === k ? null : k)}
                      >
                        {k}
                      </Chip>
                    ))}
              </div>

              <div className="flex items-end">
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                    Search
                  </span>

                  <div className="relative">
                    {/* icon pill */}
                    <div className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 text-xs">
                      🔍︎
                    </div>

                    <input
                      id="glossary-search"
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search by term…"
                      className="h-10 w-[min(18rem,80vw)] sm:w-72 rounded-full border border-slate-300 bg-slate-50 pl-10 pr-4 text-sm
                                 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none
                                 focus:ring-2 focus:ring-emerald-500/70"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Grid of cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {isLoading ? (
              Array.from({ length: pageSize }).map((_, i) => <SkeletonCard key={i} />)
            ) : pageItems.length > 0 ? (
              pageItems.map((inc) => {
                const type = inc.calamity_type || inc.incident_type || inc.type_name || "Others";
                const color = colorByIncident[type] || "#16a34a";
                const hasCoords = inc.latitude && inc.longitude;

                return (
                  <div
                    key={inc.id}
                    className="rounded-2xl border border-slate-200 bg-white p-5 hover:shadow-sm transition relative"
                    data-aos="fade-up"
                  >
                    {/* Header — title left, badges + kebab right */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                        <h3 className="text-[18px] sm:text-[20px] font-semibold text-slate-900 truncate">{type}</h3>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {inc.status && (
                          <span className={`px-2.5 py-1 rounded-full text-xs ${statusBadge(inc.status)}`}>
                            {inc.status}
                          </span>
                        )}
                        {(inc.severity_level || inc.severity_text) && (
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs ${severityBadge(
                              inc.severity_level || inc.severity_text
                            )}`}
                          >
                            {inc.severity_level || inc.severity_text}
                          </span>
                        )}

                        <div className="relative">
                          <button
                            data-kebab-trigger="true"
                            aria-label="More actions"
                            aria-expanded={activeActionId === inc.id}
                            onClick={() => setActiveActionId(id => (id === inc.id ? null : inc.id))}
                            className="h-8 w-8 grid place-items-center rounded-full text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                          >
                            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                              <circle cx="5" cy="10" r="1.6" />
                              <circle cx="10" cy="10" r="1.6" />
                              <circle cx="15" cy="10" r="1.6" />
                            </svg>
                          </button>

                          {activeActionId === inc.id && (
                            <div
                              data-kebab-menu="true"
                              className="absolute right-0 mt-2 w-36 rounded-xl bg-white border border-slate-200 shadow-xl ring-1 ring-black/5 z-50 overflow-hidden"
                            >
                              <button
                                onClick={() => {
                                  setActiveActionId(null);
                                  handleEdit(inc);
                                }}
                                className="block w-full px-4 py-2 text-sm text-left hover:bg-slate-50"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => {
                                  setActiveActionId(null);
                                  setPendingDelete(inc);
                                }}
                                className="block w-full px-4 py-2 text-sm text-left text-red-600 hover:bg-red-50"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Meta */}
                    <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2">
                      <Stat label="Reported" value={fmtDate(inc.date_reported || inc.reported_at)} />
                      <Stat label="Location (Barangay)" value={fmtStr(inc.location || inc.barangay)} />
                      <Stat label="Affected Area" value={fmtHa(inc.affected_area)} />
                      <Stat label="Crop Stage" value={fmtStr(inc.crop_stage)} />
                      <Stat label="Crop Type" value={inc.crop_type_name || inc.crop_type || inc.crop_type_id} />
                      <Stat label="Ecosystem" value={inc.ecosystem_name || inc.ecosystem || inc.ecosystem_id} />
                      <Stat label="Variety" value={inc.variety_name || inc.variety || inc.crop_variety_id} />
                      <Stat
                        label="Map"
                        value={
                          hasCoords ? (
                            <button
                              className="text-emerald-700 hover:underline"
                              onClick={() =>
                                navigate("/CalamityFarmerMap", {
                                  state: {
                                    incidentId: String(inc.id),
                                    incidentType: type,
                                    barangay: inc.barangay || inc.location || "",
                                    lat: Number(inc.latitude),
                                    lng: Number(inc.longitude),
                                    zoom: 16,
                                  },
                                })
                              }
                              title="Open in Admin Map"
                            >
                              View location ↗
                            </button>
                          ) : (
                            "N/A"
                          )
                        }
                      />
                    </div>

                    <NoteClamp text={inc.description || inc.note} className="mt-3" />

                    {/* Footer row (status + View all) */}
                    <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-100">
                      <div className="text-[12px] text-slate-500">
                        Status:&nbsp;<span className="text-slate-700">{inc.status || "Pending"}</span>
                      </div>

                      {/* View all button -> opens modal with farmers */}
                      <button
                        onClick={() => openFarmersModal(inc)}
                        className="text-[13px] font-medium text-emerald-700 hover:underline"
                      >
                        View all
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <EmptyState
                onClear={() => {
                  setSelectedType(null);
                  setSearch("");
                }}
              />
            )}
          </div>

          {/* Pagination */}
          {!isLoading && (
            <div className="mt-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="text-sm text-slate-600">
                Showing <span className="font-medium">{total === 0 ? 0 : start + 1}</span>–
                <span className="font-medium">{Math.min(start + pageSize, total)}</span> of{" "}
                <span className="font-medium">{total}</span>
              </div>

              <div className="flex items-center gap-3">
                <select
                  className="border border-slate-300 px-2 py-1 rounded-md"
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                >
                  {[8, 12, 16, 24].map((n) => (
                    <option key={n} value={n}>
                      {n} per page
                    </option>
                  ))}
                </select>

                <div className="inline-flex items-center gap-1">
                  <PageBtn disabled={page === 1} onClick={() => setPage(1)} aria="First">
                    «
                  </PageBtn>
                  <PageBtn disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))} aria="Previous">
                    ‹
                  </PageBtn>
                  <span className="px-3 text-sm text-slate-700">
                    Page {page} of {totalPages}
                  </span>
                  <PageBtn
                    disabled={page === totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    aria="Next"
                  >
                    ›
                  </PageBtn>
                  <PageBtn disabled={page === totalPages} onClick={() => setPage(totalPages)} aria="Last">
                    »
                  </PageBtn>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* EDIT MODAL — COMPACT (no coordinates fields) */}
      {editingIncident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="sticky top-0 flex items-center justify-between border-b px-4 sm:px-5 py-3 bg-white">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Edit Incident Details</h3>
                <p className="text-xs text-slate-600">Provide clear details so responders can act quickly.</p>
              </div>
              <button
                onClick={() => setEditingIncident(null)}
                aria-label="Close"
                className="h-8 w-8 grid place-items-center rounded-md text-slate-600 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="max-h-[78vh] overflow-auto px-4 sm:px-5 py-5 space-y-6">
              {/* Incident details */}
              <section>
                <h4 className="text-sm font-semibold text-slate-900">Incident details</h4>
                <p className="mt-0.5 text-[11px] text-slate-500">Basic information about the calamity.</p>

                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label htmlFor="incident_type" className="text-xs font-medium text-slate-700">
                      Calamity Type <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="incident_type"
                      name="incident_type"
                      value={editForm.incident_type || ""}
                      onChange={handleEditChange}
                      placeholder="Select calamity type"
                      className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>

                  <div>
                    <label htmlFor="barangay" className="text-xs font-medium text-slate-700">
                      Barangay <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="barangay"
                      name="barangay"
                      value={editForm.barangay || ""}
                      onChange={handleEditChange}
                      placeholder="e.g., Brgy. San Isidro"
                      className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>

                  <div>
                  <label htmlFor="crop_stage" className="text-xs font-medium text-slate-700">
  Crop Development Stage <span className="text-red-500">*</span>
</label>
<select
  id="crop_stage"
  name="crop_stage"
  value={editForm.crop_stage || ""}
  onChange={handleEditChange}
  className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
>
  <option value="">Select stage</option>
  {CROP_STAGES.map((s) => (
    <option key={s} value={s}>
      {s}
    </option>
  ))}
</select>

                  </div>

                  <div>
                    <label htmlFor="status" className="text-xs font-medium text-slate-700">
                      Status <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="status"
                      name="status"
                      value={editForm.status || ""}
                      onChange={handleEditChange}
                      className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    >
                      <option value="">Pending</option>
                      <option value="Pending">Pending</option>
                      <option value="Verified">Verified</option>
                      <option value="Resolved">Resolved</option>
                      <option value="Rejected">Rejected</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="severity_text" className="text-xs font-medium text-slate-700">
                      Severity <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="severity_text"
                      name="severity_text"
                      value={editForm.severity_text || ""}
                      onChange={handleEditChange}
                      className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    >
                      <option value="">Select severity</option>
                      <option value="Low">Low</option>
                      <option value="Moderate">Moderate</option>
                      <option value="High">High</option>
                      <option value="Severe">Severe</option>
                    </select>
                    <p className="mt-1 text-[11px] text-slate-500">How intense is the incident?</p>
                  </div>

                  <div>
                    <label htmlFor="reported_at_input" className="text-xs font-medium text-slate-700">
                      Reported at <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="reported_at_input"
                      type="datetime-local"
                      name="reported_at_input"
                      value={editForm.reported_at_input || ""}
                      onChange={handleEditChange}
                      className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>

                  {/* Description full width */}
                  <div className="md:col-span-2">
                    <label htmlFor="note" className="text-xs font-medium text-slate-700">
                      Description <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      id="note"
                      name="note"
                      value={editForm.note || ""}
                      onChange={handleEditChange}
                      placeholder="What happened? Any visible damage or hazards?"
                      className="mt-1 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      maxLength={1000}
                    />
                    <div className="mt-1 flex justify-between text-[11px] text-slate-500">
                      <span>Be concise and specific.</span>
                      <span>{(editForm.note?.length || 0)}/1000</span>
                    </div>
                  </div>
                </div>
              </section>

              {/* Farmer card (editable) */}
              <section>
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                      Farmer
                    </div>
                    {editFarmer && (
                      <button
                        type="button"
                        onClick={() => setIsEditingFarmer((v) => !v)}
                        className="text-[12px] text-emerald-700 hover:underline"
                      >
                        {isEditingFarmer ? "Cancel" : "Edit"}
                      </button>
                    )}
                  </div>

                  {!editFarmer ? (
                    <div className="mt-2 text-sm text-slate-600">No linked farmer or still loading…</div>
                  ) : !isEditingFarmer ? (
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                      <Stat
                        label="Name"
                        value={
                          editFarmer.full_name ||
                          [editFarmer.first_name, editFarmer.last_name].filter(Boolean).join(" ") ||
                          "N/A"
                        }
                      />
                      <Stat label="Mobile" value={editFarmer.mobile_number || "N/A"} />
                      <Stat label="Barangay" value={editFarmer.barangay || "N/A"} />
                      <Stat label="Full Address" value={editFarmer.full_address || "N/A"} />
                    </div>
                  ) : (
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-slate-700">First name</label>
                        <input
                          className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                          value={editFarmerDraft?.first_name || ""}
                          onChange={(e) =>
                            setEditFarmerDraft((p) => ({ ...p, first_name: e.target.value }))
                          }
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-700">Last name</label>
                        <input
                          className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                          value={editFarmerDraft?.last_name || ""}
                          onChange={(e) =>
                            setEditFarmerDraft((p) => ({ ...p, last_name: e.target.value }))
                          }
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-700">Mobile</label>
                        <input
                          className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                          value={editFarmerDraft?.mobile_number || ""}
                          onChange={(e) =>
                            setEditFarmerDraft((p) => ({ ...p, mobile_number: e.target.value }))
                          }
                          placeholder="09xxxxxxxxx"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-700">Barangay</label>
                        <input
                          className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                          value={editFarmerDraft?.barangay || ""}
                          onChange={(e) => setEditFarmerDraft((p) => ({ ...p, barangay: e.target.value }))}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-xs font-medium text-slate-700">Full address</label>
                        <input
                          className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                          value={editFarmerDraft?.full_address || ""}
                          onChange={(e) =>
                            setEditFarmerDraft((p) => ({ ...p, full_address: e.target.value }))
                          }
                        />
                      </div>

                      <div className="md:col-span-2 flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setIsEditingFarmer(false);
                            setEditFarmerDraft(
                              editFarmer
                                ? {
                                    first_name: editFarmer.first_name || "",
                                    last_name: editFarmer.last_name || "",
                                    mobile_number: editFarmer.mobile_number || "",
                                    barangay: editFarmer.barangay || "",
                                    full_address: editFarmer.full_address || "",
                                  }
                                : null
                            );
                          }}
                          className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={saveFarmerChanges}
                          className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                        >
                          Save farmer
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* Crop & ecosystem */}
              <section>
                <h4 className="text-sm font-semibold text-slate-900">Crop &amp; ecosystem</h4>
                <p className="mt-0.5 text-[11px] text-slate-500">These fields tailor recommendations and analysis.</p>

                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  {/* Crop Type */}
                  <div>
                    <label className="text-xs font-medium text-slate-700">
                      Crop Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="crop_type_id"
                      value={editForm.crop_type_id ?? ""}
                      onChange={handleEditChange}
                      className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    >
                      <option value="">Select crop type</option>
                      {cropTypes.map((t) => (
                        <option key={t.id} value={String(t.id)}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-[11px] text-slate-500">Primary crop affected.</p>
                  </div>

                  {/* Ecosystem (filtered by crop type) */}
                  <div>
                    <label className="text-xs font-medium text-slate-700">
                      Ecosystem Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="ecosystem_id"
                      value={editForm.ecosystem_id ?? ""}
                      onChange={handleEditChange}
                      disabled={!editForm.crop_type_id || filteredEcosystems.length === 0}
                      className={`mt-1 h-10 w-full rounded-md border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 ${
                        !editForm.crop_type_id || filteredEcosystems.length === 0
                          ? "border-slate-200 bg-slate-50 text-slate-400"
                          : "border-slate-300"
                      }`}
                    >
                      {!editForm.crop_type_id ? (
                        <option value="">Select crop type first</option>
                      ) : filteredEcosystems.length === 0 ? (
                        <option value="">No ecosystems for selected crop</option>
                      ) : (
                        <>
                          <option value="">Select ecosystem</option>
                          {filteredEcosystems.map((e) => (
                            <option key={e.id} value={String(e.id)}>
                              {e.name}
                            </option>
                          ))}
                        </>
                      )}
                    </select>
                    <p className="mt-1 text-[11px] text-slate-500">Pick after crop type.</p>
                  </div>

                  {/* Variety (depends on crop type) */}
                  <div className="md:col-span-2">
                    <label className="text-xs font-medium text-slate-700">Variety</label>
                    <select
                      name="crop_variety_id"
                      value={editForm.crop_variety_id ?? ""}
                      onChange={handleEditChange}
                      disabled={!editForm.crop_type_id || filteredVarieties.length === 0}
                      className={`mt-1 h-10 w-full rounded-md border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 ${
                        !editForm.crop_type_id || filteredVarieties.length === 0
                          ? "border-slate-200 bg-slate-50 text-slate-400"
                          : "border-slate-300"
                      }`}
                    >
                      {!editForm.crop_type_id ? (
                        <option value="">Select crop type first</option>
                      ) : filteredVarieties.length === 0 ? (
                        <option value="">No varieties for selected crop</option>
                      ) : (
                        <>
                          <option value="">Select variety</option>
                          {filteredVarieties.map((v) => (
                            <option key={v.id} value={String(v.id)}>
                              {v.name}
                            </option>
                          ))}
                        </>
                      )}
                    </select>
                  </div>
                </div>
              </section>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t bg-white px-4 sm:px-5 py-3">
              <button
                onClick={() => setEditingIncident(null)}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdate}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              >
                Update
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW MODAL (incident quick view) */}
      {viewingIncident && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-center items-center z-50">
          <div className="bg-white p-5 sm:p-6 md:p-8 rounded-2xl w-full max-w-2xl shadow-2xl relative">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg sm:text-xl font-semibold text-slate-900">
                  {viewingIncident.calamity_type ||
                    viewingIncident.incident_type ||
                    viewingIncident.type_name ||
                    "Incident"}
                  {viewingIncident.status ? ` · ${viewingIncident.status}` : ""}
                </h3>
                <p className="text-sm text-slate-500">
                  {viewingIncident.location || viewingIncident.barangay || "—"} ·{" "}
                  {viewingIncident.severity_level || viewingIncident.severity_text || "—"}
                </p>
              </div>
              <button
                onClick={() => setViewingIncident(null)}
                className="p-2 -m-2 rounded-md hover:bg-slate-50 text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                aria-label="Close"
                title="Close"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
              <Stat label="Reported" value={fmtDate(viewingIncident.date_reported || viewingIncident.reported_at)} />
              <Stat label="Affected Area" value={fmtHa(viewingIncident.affected_area)} />
              <Stat label="Crop Stage" value={fmtStr(viewingIncident.crop_stage)} />
              <Stat label="Crop Type" value={fmtStr(viewingIncident.crop_type_name || viewingIncident.crop_type_id)} />
              <Stat label="Ecosystem" value={fmtStr(viewingIncident.ecosystem_name || viewingIncident.ecosystem_id)} />
              <Stat label="Variety" value={fmtStr(viewingIncident.variety_name || viewingIncident.crop_variety_id)} />
              <Stat label="Latitude" value={viewingIncident.latitude ? fmtNum(viewingIncident.latitude) : "N/A"} />
              <Stat label="Longitude" value={viewingIncident.longitude ? fmtNum(viewingIncident.longitude) : "N/A"} />
            </div>

            {renderPhotoStrip(viewingIncident)}

            {(viewingIncident.description || viewingIncident.note) && (
              <div className="mt-4">
                <div className="text-[11px] uppercase tracking-wide text-slate-500">Description</div>
                <p className="text-[14px] text-slate-700 whitespace-pre-wrap">
                  {viewingIncident.description || viewingIncident.note}
                </p>
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button onClick={() => setViewingIncident(null)} className="px-4 py-2 rounded-md border border-slate-300 hover:bg-slate-50">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW-ALL MODAL — farmers list (clean) */}
      {farmersModal &&
        (() => {
          const inc = farmersModal.incident || {};
          const type = inc.calamity_type || inc.incident_type || inc.type_name || "Incident";
          const locationText = inc.location || inc.barangay || "—";

          const KV = ({ label, value, className = "" }) => (
            <div className={className}>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
              <div className="text-[14px] text-slate-900">{value ?? "N/A"}</div>
            </div>
          );

          return (
            <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-start md:items-center justify-center p-4 overflow-y-auto">
              <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl p-5 sm:p-6 md:p-8 relative">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-[20px] sm:text-[22px] font-semibold text-slate-900">
                      {type}
                      {inc.variety_name ? ` · ${inc.variety_name}` : ""}
                    </h3>
                    <p className="text-sm text-slate-500">{locationText}</p>
                  </div>
                  <button
                    onClick={() => setFarmersModal(null)}
                    className="p-2 -m-2 rounded-md text-slate-600 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    aria-label="Close"
                    title="Close"
                  >
                    ✕
                  </button>
                </div>

                {/* FARMER section */}
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 md:p-5">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 mb-3">
                    Farmer
                  </div>

                  {farmersModal.loading ? (
                    <div className="text-sm text-slate-600">Loading farmer details…</div>
                  ) : (farmersModal.farmers || []).length === 0 ? (
                    <div className="text-sm text-slate-600">No linked farmers for this incident.</div>
                  ) : (
                    (() => {
                      const f = farmersModal.farmers[0] || {};
                      const fullName =
                        f.full_name ||
                        [f.first_name, f.last_name].filter(Boolean).join(" ").trim() ||
                        "N/A";
                      return (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                          <KV label="Name" value={fullName} />
                          <KV label="Mobile" value={f.mobile_number || f.contact_no || "N/A"} />
                          <KV label="Barangay" value={f.barangay || "N/A"} />
                          <KV label="Full Address" value={f.full_address || f.address || "N/A"} />
                        </div>
                      );
                    })()
                  )}
                </div>

                {/* Divider */}
                <div className="mt-5 mb-3 h-px bg-slate-200" />

                {/* Meta rows */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                  <KV label="Reported" value={fmtDate(inc.date_reported || inc.reported_at)} />
                  <KV label="Severity" value={inc.severity_level || inc.severity_text || "N/A"} />
                  <KV label="Status" value={inc.status || "Pending"} />
                  <KV
                    label="Affected Area"
                    value={inc.affected_area ? `${Number(inc.affected_area).toFixed(2)} ha` : "N/A"}
                  />
                  <KV label="Crop Type" value={inc.crop_type_name || inc.crop_type_id || "N/A"} />
                  <KV label="Ecosystem" value={inc.ecosystem_name || inc.ecosystem_id || "N/A"} />
                  <KV label="Variety" value={inc.variety_name || inc.crop_variety_id || "N/A"} />
                  <KV
                    label="Coordinates"
                    value={
                      inc.latitude != null && inc.longitude != null
                        ? `${Number(inc.latitude).toFixed(5)}, ${Number(inc.longitude).toFixed(5)}`
                        : "N/A"
                    }
                  />
                </div>

                {/* Optional note/description */}
                {(inc.description || inc.note) && (
                  <div className="mt-4">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                      Description
                    </div>
                    <p className="text-[14px] text-slate-700 whitespace-pre-wrap">
                      {inc.description || inc.note}
                    </p>
                  </div>
                )}

                {/* Footer */}
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => setFarmersModal(null)}
                    className="px-4 py-2 rounded-md border border-slate-300 hover:bg-slate-50"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      {/* CONFIRM DELETE */}
      {pendingDelete && (
        <ConfirmDialog
          title="Delete incident"
          message={`This will permanently delete "${
            pendingDelete.calamity_type || pendingDelete.incident_type || pendingDelete.type_name || "Incident"
          }" in ${pendingDelete.barangay || pendingDelete.location || "—"}.`}
          onCancel={() => setPendingDelete(null)}
          onConfirm={confirmDelete}
        />
      )}

      <div className="mt-5">
        <Footer />
      </div>
    </div>
  );
};

/* ---------- HELPERS ---------- */
function renderPhotoStrip(item) {
  const urls = new Set();

  const push = (raw) => {
    if (!raw) return;
    let p = String(raw).trim();
    if (!p) return;
    if (p.includes(",") && !p.startsWith("[") && !p.startsWith("{")) {
      p.split(",").forEach((part) => push(part));
      return;
    }
    if (!/^https?:\/\//i.test(p)) {
      const base = "http://localhost:5000";
      p = p.startsWith("/") ? `${base}${p}` : `${base}/${p}`;
    }
    urls.add(p);
  };

  if (Array.isArray(item?.photos)) item.photos.forEach(push);
  else if (item?.photos) push(item.photos);
  if (urls.size === 0 && item?.photo) push(item.photo);

  const photos = Array.from(urls);
  if (!photos.length) return null;

  return (
    <div className="mt-4">
      <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-2">Photos</div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {photos.map((url, idx) => (
          <a key={idx} href={url} target="_blank" rel="noreferrer" className="shrink-0">
            <img src={url} alt={`evidence-${idx}`} className="h-20 w-28 object-cover rounded-lg border border-slate-200" />
          </a>
        ))}
      </div>
    </div>
  );
}

export default ManageCalamity;
