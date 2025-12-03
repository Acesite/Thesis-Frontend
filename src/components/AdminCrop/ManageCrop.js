// pages/AdminCrop/ManageCrop.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AOS from "aos";
import "aos/dist/aos.css";
import axios from "axios";
import AdminNav from "../NavBar/AdminNavbar";
import Footer from "../LandingPage/Footer";

/* ---------- CONFIG ---------- */
const colorByCrop = {
  Rice: "#facc15",
  Corn: "#fb923c",
  Banana: "#a3e635",
  Sugarcane: "#34d399",
  Cassava: "#60a5fa",
  Vegetables: "#f472b6",
};

const SORT_OPTIONS = [
  { value: "harvest_desc", label: "Harvest: Newest" },
  { value: "harvest_asc", label: "Harvest: Oldest" },
  { value: "volume_desc", label: "Volume: High → Low" },
  { value: "volume_asc", label: "Volume: Low → High" },
];

const yieldUnitMap = {
  1: "sacks",
  2: "sacks",
  3: "bunches",
  4: "tons",
  5: "tons",
  6: "kg",
};

/* ---------- CONFIG ---------- */
const STANDARD_MATURITY_DAYS = {
  1: 100, // Rice
  2: 110, // Corn
  3: 360, // Banana
  4: 365, // Sugarcane
  5: 300, // Cassava
  6: 60,  // Vegetables
};


/* ---------- UTILS ---------- */
const nf2 = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
const fmtNum = (v) =>
  v === null || v === undefined || v === "" ? "N/A" : nf2.format(Number(v));
const fmtDate = (date) => {
  if (!date) return "N/A";
  const t = new Date(date);
  return isNaN(t.getTime())
    ? "N/A"
    : t.toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
};

/* ---------- PAGE ---------- */
const ManageCrop = () => {
  const navigate = useNavigate();

  const [crops, setCrops] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [editingCrop, setEditingCrop] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [activeActionId, setActiveActionId] = useState(null);

  const [cropTypes, setCropTypes] = useState([]);
  const [varieties, setVarieties] = useState([]);
  const [interVarieties, setInterVarieties] = useState([]);

  // ADD: tenure options
  const [tenures, setTenures] = useState([]);

  const [selectedCropTypeId, setSelectedCropTypeId] = useState(null);
  const [search, setSearch] = useState("");

  const [sort, setSort] = useState("harvest_desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [pendingDelete, setPendingDelete] = useState(null);

  const [viewingCrop, setViewingCrop] = useState(null);

  // NEW: harvest status filter (all / harvested / not_harvested)
  const [harvestFilter, setHarvestFilter] = useState("all");

  useEffect(() => {
    AOS.init({ duration: 400, once: true });
    (async () => {
      try {
        setIsLoading(true);
        const [cropsRes, typesRes] = await Promise.all([
          axios.get("http://localhost:5000/api/managecrops"),
          axios.get("http://localhost:5000/api/crops/types"),
        ]);
        setCrops(cropsRes.data || []);
        setCropTypes(typesRes.data || []);
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // ADD: fetch tenure list on mount (separate effect; no edits to your fetch above)
 // ADD: fetch tenure list on mount (normalized to {id,name})
useEffect(() => {
  (async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/crops/tenures");
      const raw = Array.isArray(res.data) ? res.data : [];

      // normalize to { id, name }
      const list = raw
        .map((r) => ({
          id: r.id ?? r.tenure_id ?? null,
          name: r.name ?? r.tenure_name ?? "",
        }))
        .filter((r) => r.id && r.name);

      setTenures(list);
    } catch (e) {
      console.warn("Tenure endpoint not ready — using fallback.");
      setTenures([
        { id: 1, name: "Landowner" },
        { id: 2, name: "Tenant Farmer" },
        { id: 3, name: "Leaseholder" },
        { id: 4, name: "Sharecropper" },
      ]);
    }
  })();
}, []);


  useEffect(() => {
    if (editForm.crop_type_id) {
      axios
        .get(
          `http://localhost:5000/api/crops/varieties/${editForm.crop_type_id}`
        )
        .then((res) => setVarieties(res.data))
        .catch((err) => console.error("Failed to load varieties:", err));
    } else {
      setVarieties([]);
    }
  }, [editForm.crop_type_id]);

  useEffect(() => {
    if (editForm.intercrop_crop_type_id) {
      axios
        .get(
          `http://localhost:5000/api/crops/varieties/${editForm.intercrop_crop_type_id}`
        )
        .then((res) => setInterVarieties(res.data))
        .catch((err) =>
          console.error("Failed to load secondary varieties:", err)
        );
    } else {
      setInterVarieties([]);
    }
  }, [editForm.intercrop_crop_type_id]);

  const fetchCrops = async () => {
    try {
      setIsLoading(true);
      const res = await axios.get("http://localhost:5000/api/managecrops");
      setCrops(res.data || []);
    } catch (e) {
      console.error("Error fetching crops:", e);
    } finally {
      setIsLoading(false);
    }
  };

  /* ------- filter + search + harvest status ------- */
  const filtered = useMemo(() => {
    // 1) by crop type
    const byType = crops.filter(
      (c) => !selectedCropTypeId || c.crop_type_id === selectedCropTypeId
    );

    // 2) by harvest status
    const byStatus = byType.filter((c) => {
      const isHarvested =
        c.is_harvested === 1 ||
        c.is_harvested === "1" ||
        c.is_harvested === true;
      if (harvestFilter === "harvested") return isHarvested;
      if (harvestFilter === "not_harvested") return !isHarvested;
      return true; // "all"
    });

    // 3) search text
    if (!search.trim()) return byStatus;
    const q = search.toLowerCase();

    return byStatus.filter((c) =>
      [
        c.crop_name,
        c.variety_name,
        c.crop_barangay,
        c.farmer_first_name,
        c.farmer_last_name,
        c.farmer_mobile,
        c.farmer_barangay,
        c.farmer_address,
        c.note,
        // include tenure in search
        c.tenure_name,
        // secondary crop fields
        c.intercrop_crop_name,
        c.intercrop_variety_name,
        c.intercrop_cropping_system,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [crops, selectedCropTypeId, search, harvestFilter]);

  /* ------- sort ------- */
  const sorted = useMemo(() => {
    const arr = [...filtered];
    const toTime = (d) => {
      if (!d) return null;
      const t = new Date(d).getTime();
      return Number.isNaN(t) ? null : t;
    };
    switch (sort) {
      case "harvest_asc":
        arr.sort(
          (a, b) =>
            (toTime(a.estimated_harvest) ?? Infinity) -
            (toTime(b.estimated_harvest) ?? Infinity)
        );
        break;
      case "harvest_desc":
        arr.sort(
          (a, b) =>
            (toTime(b.estimated_harvest) ?? -Infinity) -
            (toTime(a.estimated_harvest) ?? -Infinity)
        );
        break;
      case "volume_asc":
        arr.sort(
          (a, b) =>
            (Number(a.estimated_volume) || 0) -
            (Number(b.estimated_volume) || 0)
        );
        break;
      case "volume_desc":
        arr.sort(
          (a, b) =>
            (Number(b.estimated_volume) || 0) -
            (Number(a.estimated_volume) || 0)
        );
        break;
      default:
        break;
    }
    return arr;
  }, [filtered, sort]);

  useEffect(() => {
    setPage(1);
  }, [selectedCropTypeId, search, sort, pageSize, harvestFilter]);

  /* ------- pagination ------- */
  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  const pageItems = sorted.slice(start, start + pageSize);

  const handleEdit = (crop) => {
    const initialName = [crop.farmer_first_name, crop.farmer_last_name]
      .filter(Boolean)
      .join(" ")
      .trim();

    const isIntercropped =
      crop.is_intercropped === 1 ||
      crop.is_intercropped === "1" ||
      crop.is_intercropped === true;

    setEditingCrop(crop);
    setEditForm({
      ...crop,
      crop_type_id: crop.crop_type_id || "",
      variety_id: crop.variety_id || "",
      farmer_id: crop.farmer_id ? String(crop.farmer_id) : "",
      planted_date: crop.planted_date || "",
      estimated_harvest: crop.estimated_harvest || "",
      estimated_volume: crop.estimated_volume || "",
      estimated_hectares: crop.estimated_hectares || "",
      note: crop.note || "",
      barangay: crop.crop_barangay || "",
      farmer_full_name: initialName || "",
      farmer_first_name: crop.farmer_first_name || "",
      farmer_last_name: crop.farmer_last_name || "",
      // NEW: show these in Edit
      farmer_mobile: crop.farmer_mobile || "",
      farmer_address: crop.farmer_address || "",
      // ADD: tenure id
      tenure_id: crop.farmer_tenure_id || "",

      // harvest status + actual date (NEW)
      is_harvested:
        crop.is_harvested === 1 ||
        crop.is_harvested === "1" ||
        crop.is_harvested === true
          ? 1
          : 0,
      harvested_date: crop.harvested_date || "",

      // intercropping fields
      is_intercropped: isIntercropped ? 1 : 0,
      intercrop_crop_type_id: crop.intercrop_crop_type_id || "",
      intercrop_variety_id: crop.intercrop_variety_id || "",
      intercrop_estimated_volume: crop.intercrop_estimated_volume || "",
      intercrop_cropping_system: crop.intercrop_cropping_system || "",
      intercrop_cropping_description:
        crop.intercrop_cropping_description || "",
    });
  };

  const handleEditChange = (e) => {
  const { name, value, type, checked } = e.target;
  const val = type === "checkbox" ? (checked ? 1 : 0) : value;

  // Special case: planted_date → auto-calc estimated_harvest based on crop_type_id
  if (name === "planted_date") {
    const plantedYMD = val;
    const days =
      STANDARD_MATURITY_DAYS[Number(editForm.crop_type_id)] || null;

    setEditForm((prev) => ({
      ...prev,
      planted_date: plantedYMD,
      // only auto-fill if we have a configured maturity; otherwise leave as-is
      ...(days
        ? { estimated_harvest: addDaysYMD(plantedYMD, days) }
        : {}),
    }));
    return;
  }

  // If crop type changes and we already have a planted_date, re-calc estimate
  if (name === "crop_type_id") {
    const nextCropTypeId = Number(val);
    const days = STANDARD_MATURITY_DAYS[nextCropTypeId] || null;

    setEditForm((prev) => ({
      ...prev,
      crop_type_id: val,
      ...(prev.planted_date && days
        ? { estimated_harvest: addDaysYMD(prev.planted_date, days) }
        : {}),
    }));
    return;
  }

  // Normal path
  setEditForm((prev) => ({ ...prev, [name]: val }));
};


  const handleUpdate = async () => {
    try {
      // 1) If a farmer is linked and something changed, update farmer first
      const hasFarmer = !!editForm.farmer_id;
      const nameChanged =
        (editingCrop?.farmer_first_name || "") !==
          (editForm.farmer_first_name || "") ||
        (editingCrop?.farmer_last_name || "") !==
          (editForm.farmer_last_name || "");

      const contactChanged =
        (editingCrop?.farmer_mobile || "") !==
          (editForm?.farmer_mobile || "") ||
        (editingCrop?.farmer_address || "") !==
          (editForm?.farmer_address || "");

      const tenureChanged =
        (editingCrop?.tenure_id || "") !== (editForm?.tenure_id || "");

      if (hasFarmer && (nameChanged || contactChanged || tenureChanged)) {
        await axios.put(
          `http://localhost:5000/api/managecrops/farmer/${editForm.farmer_id}`,
          {
            first_name: editForm.farmer_first_name || "",
            last_name: editForm.farmer_last_name || "",
            mobile: editForm.farmer_mobile || "",
            address: editForm.farmer_address || "",
            // ADD: tenure id goes with farmer update
            tenure_id: editForm.tenure_id || null,
          }
        );
      }

      // 2) Update crop (don’t re-link farmer here)
      const payload = { ...editForm };

      // keep only crop fields in payload
      delete payload.farmer_full_name;
      delete payload.farmer_id;
      delete payload.farmer_first_name;
      delete payload.farmer_last_name;
      delete payload.farmer_mobile;
      delete payload.farmer_address;
      delete payload.tenure_id; // tenure belongs to farmer, not crop

      // normalize harvested flag
      payload.is_harvested = Number(editForm.is_harvested) === 1 ? 1 : 0;

      // if not harvested, drop any date
      if (payload.is_harvested !== 1) {
        payload.harvested_date = null;
      }

      const { data } = await axios.put(
        `http://localhost:5000/api/managecrops/${editingCrop.id}`,
        payload
      );

      await fetchCrops();
      setEditingCrop(null);

      alert(
        data?.message ||
          (nameChanged || contactChanged || tenureChanged
            ? "Farmer and crop updated."
            : "Crop updated.")
      );
    } catch (err) {
      console.error("Update error:", err);
      alert(err?.response?.data?.message || "Failed to update.");
    }
  };

  /* ------- delete with confirm ------- */
  const confirmDelete = async () => {
    try {
      await axios.delete(
        `http://localhost:5000/api/managecrops/${pendingDelete.id}`
      );
      setCrops((prev) => prev.filter((c) => c.id !== pendingDelete.id));
      setPendingDelete(null);
      alert("Crop deleted successfully!");
    } catch (err) {
      console.error("Delete error:", err);
      alert("Failed to delete crop.");
    }
  };

  /* ------- derived for viewing modal ------- */
  const viewingIsHarvested =
    !!viewingCrop &&
    (viewingCrop.is_harvested === 1 ||
      viewingCrop.is_harvested === "1" ||
      viewingCrop.is_harvested === true);

  const viewingHarvestLabel = viewingCrop
    ? viewingIsHarvested
      ? `Harvested on ${fmtDate(viewingCrop.harvested_date)}`
      : "Not yet harvested"
    : "";

  /* ---------- RENDER ---------- */
  return (
    <div className="flex flex-col min-h-screen bg-white font-poppins">
      <AdminNav />

      <main className="ml-[115px] pt-[92px] pr-8 flex-grow">
        <div className="max-w-7xl mx-auto px-6">
          <div className="mb-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-[34px] leading-tight font-bold text-slate-900">
                  Crop Management
                </h1>
                <p className="text-[15px] text-slate-600">
                  View, filter, and update crop records from field officers.
                </p>
              </div>
            </div>

            {/* Tools Row */}
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
              {/* Crop type chips */}
              <div className="flex flex-wrap gap-2">
                <Chip
                  active={!selectedCropTypeId}
                  onClick={() => setSelectedCropTypeId(null)}
                >
                  All crops
                </Chip>
                {cropTypes.map((t) => (
                  <Chip
                    key={t.id}
                    active={selectedCropTypeId === t.id}
                    onClick={() =>
                      setSelectedCropTypeId(
                        selectedCropTypeId === t.id ? null : t.id
                      )
                    }
                  >
                    {t.name}
                  </Chip>
                ))}
              </div>

              {/* Search + sort + harvest filter */}
              <div className="flex flex-wrap items-end gap-3 md:ml-auto md:justify-end">
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
                        placeholder="Search…"
                        className="h-10 w-72 rounded-full border border-slate-300 bg-slate-50 pl-10 pr-4 text-sm
                                   placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none
                                   focus:ring-2 focus:ring-emerald-500/70"
                      />
                    </div>
                  </div>
                </div>

                {/* Sort + Harvest filters with pill style like search */}
                <div className="flex items-end gap-3">
                  {/* Sort */}
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                      Sort
                    </span>

                    <div className="relative">
                      {/* icon pill */}
                      <div className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 text-xs">
                        ⇅
                      </div>

                      <select
                        className="h-10 w-56 rounded-full border border-slate-300 bg-slate-50 pl-10 pr-4 text-sm
                                   appearance-none placeholder:text-slate-400 focus:border-emerald-500
                                   focus:outline-none focus:ring-2 focus:ring-emerald-500/70"
                        value={sort}
                        onChange={(e) => setSort(e.target.value)}
                      >
                        {SORT_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>

                      {/* dropdown arrow */}
                      <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                        ▾
                      </div>
                    </div>
                  </div>

                  {/* Harvest status */}
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                      Harvest status
                    </span>

                    <div className="relative">
                      {/* icon pill */}
                      <div className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 text-xs">
                        🌾
                      </div>

                      <select
                        className="h-10 w-48 rounded-full border border-slate-300 bg-slate-50 pl-10 pr-4 text-sm
                                   appearance-none placeholder:text-slate-400 focus:border-emerald-500
                                   focus:outline-none focus:ring-2 focus:ring-emerald-500/70"
                        value={harvestFilter}
                        onChange={(e) => setHarvestFilter(e.target.value)}
                      >
                        <option value="all">All status</option>
                        <option value="harvested">Harvested only</option>
                        <option value="not_harvested">Not yet harvested</option>
                      </select>

                      {/* dropdown arrow */}
                      <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                        ▾
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Grid of cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {isLoading ? (
              Array.from({ length: pageSize }).map((_, i) => (
                <SkeletonCard key={i} />
              ))
            ) : pageItems.length > 0 ? (
              pageItems.map((crop) => {
                const color = colorByCrop[crop.crop_name] || "#16a34a";
                const isHarvested =
                  crop.is_harvested === 1 ||
                  crop.is_harvested === "1" ||
                  crop.is_harvested === true;

                const harvestStatusLabel = isHarvested
                  ? `Harvested on ${fmtDate(crop.harvested_date)}`
                  : "Not yet harvested";

                return (
                  <div
                    key={crop.id}
                    className="rounded-2xl border border-slate-200 bg-white p-5 hover:shadow-sm transition relative"
                    data-aos="fade-up"
                  >
               {/* Actions */}
<div className="absolute top-3 right-3">
  <button
    aria-label="More actions"
    aria-expanded={activeActionId === crop.id}
    onClick={() =>
      setActiveActionId((id) => (id === crop.id ? null : crop.id))
    }
    className="h-8 w-8 grid place-items-center rounded-full text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
  >
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <circle cx="5" cy="10" r="1.6" />
      <circle cx="10" cy="10" r="1.6" />
      <circle cx="15" cy="10" r="1.6" />
    </svg>
  </button>

  {/* Click-away overlay (covers the whole viewport). Clicking it closes the menu. */}
  {activeActionId === crop.id && (
    <div
      className="fixed inset-0 z-40"
      onClick={() => setActiveActionId(null)}
      aria-hidden="true"
    />
  )}

  {/* Dropdown menu (above the overlay) */}
  {activeActionId === crop.id && (
    <div
      className="absolute right-0 mt-2 w-36 bg-white border rounded-xl shadow-xl z-50 overflow-hidden"
      onClick={(e) => e.stopPropagation()} // keep clicks inside from closing the menu
    >
      <button
        onClick={() => {
          setActiveActionId(null);
          handleEdit(crop);
        }}
        className="block w-full px-4 py-2 text-sm text-left hover:bg-slate-50"
      >
        Edit
      </button>
      <button
        onClick={() => {
          setActiveActionId(null);
          setPendingDelete(crop);
        }}
        className="block w-full px-4 py-2 text-sm text-left text-red-600 hover:bg-red-50"
      >
        Delete
      </button>
    </div>
  )}
</div>


                    {/* Header */}
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <h3 className="text-[20px] font-semibold text-slate-900">
                        {crop.crop_name}
                      </h3>
                    </div>
                    {crop.variety_name && (
                      <div className="mt-0.5 text-[13px] text-slate-500">
                        {crop.variety_name}
                      </div>
                    )}

                    <div
                      className={`mt-2 inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium border ${
                        isHarvested
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                          : "bg-amber-50 text-amber-800 border-amber-200"
                      }`}
                    >
                      {harvestStatusLabel}
                    </div>

                    {/* Meta (crop info) */}
                    <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2">
                      <Stat label="Planted" value={fmtDate(crop.planted_date)} />
                      <Stat
                        label="Estimated Harvest"
                        value={fmtDate(crop.estimated_harvest)}
                      />
                      <Stat
                        label="Estimated Volume"
                        value={`${fmtNum(crop.estimated_volume)} ${
                          yieldUnitMap[crop.crop_type_id] || "units"
                        }`}
                      />
                      <Stat
                        label="Hectares"
                        value={fmtNum(crop.estimated_hectares)}
                      />
                      <Stat
                        label="Avg elevation (m)"
                        value={`${fmtNum(crop.avg_elevation_m)} m`}
                      />
                      <Stat
                        label="Barangay (Crop)"
                        value={crop.crop_barangay || "N/A"}
                      />
                      {/* Tenure */}
                      <Stat label="Tenure" value={crop.tenure_name || "N/A"} />
                      <Stat
                        label="Map"
                        value={
                          <button
                            className="text-emerald-700 hover:underline"
                            onClick={() =>
                              navigate("/AdminMap", {
                                state: {
                                  cropId: String(crop.id),
                                  zoom: 17,
                                },
                              })
                            }
                            title="Open in Admin Map"
                          >
                            View location ↗
                          </button>
                        }
                      />
                    </div>

                    {/* Secondary crop (if any) */}
                    {crop.intercrop_crop_name && (
                      <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-2">
                        <div className="text-[11px] uppercase tracking-wide text-emerald-700">
                          Secondary crop
                        </div>
                        <div className="text-[14px] font-medium text-emerald-900">
                          {crop.intercrop_crop_name}
                          {crop.intercrop_variety_name
                            ? ` · ${crop.intercrop_variety_name}`
                            : ""}
                        </div>
                        <div className="mt-0.5 text-[12px] text-emerald-800">
                          {crop.intercrop_estimated_volume ? (
                            <>
                              Est. yield:{" "}
                              {fmtNum(crop.intercrop_estimated_volume)}{" "}
                              {yieldUnitMap[crop.intercrop_crop_type_id] ||
                                "units"}
                            </>
                          ) : (
                            "No estimated yield recorded"
                          )}
                        </div>
                        {crop.intercrop_cropping_system && (
                          <div className="mt-0.5 text-[11px] text-emerald-700/80">
                            {crop.intercrop_cropping_system}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Notes */}
                    <NoteClamp text={crop.note} className="mt-3" />

                    {/* Footer (with View all on the right) */}
                    <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-100">
                      <div className="text-[12px] text-slate-500">
                        Tagged by{" "}
                        <span className="text-slate-700">
                          {crop.tagger_first_name && crop.tagger_last_name
                            ? `${crop.tagger_first_name} ${crop.tagger_last_name}`
                            : crop.tagger_email || "N/A"}
                        </span>
                      </div>

                      <button
                        onClick={() => setViewingCrop(crop)}
                        className="text-sm font-medium text-emerald-700 hover:underline"
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
                  setSelectedCropTypeId(null);
                  setSearch("");
                  setHarvestFilter("all");
                }}
              />
            )}
          </div>

          {/* Pagination */}
          {!isLoading && (
            <div className="mt-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="text-sm text-slate-600">
                Showing{" "}
                <span className="font-medium">
                  {total === 0 ? 0 : start + 1}
                </span>
                {"–"}
                <span className="font-medium">
                  {Math.min(start + pageSize, total)}
                </span>{" "}
                of <span className="font-medium">{total}</span>
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
                  <PageBtn
                    disabled={page === 1}
                    onClick={() => setPage(1)}
                    aria="First"
                  >
                    «
                  </PageBtn>
                  <PageBtn
                    disabled={page === 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    aria="Previous"
                  >
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
                  <PageBtn
                    disabled={page === totalPages}
                    onClick={() => setPage(totalPages)}
                    aria="Last"
                  >
                    »
                  </PageBtn>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
{editingCrop && (
  <div
    className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-start md:items-center justify-center p-3 md:p-4 lg:p-6 overflow-y-auto"
    onClick={() => setEditingCrop(null)}
  >
    <div
      className="w-full max-w-[95vw] md:max-w-3xl lg:max-w-4xl xl:max-w-5xl max-h-[94vh] overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5"
      onClick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
    >
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-slate-100 px-5 md:px-6 lg:px-8 py-3 md:py-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 md:h-9 md:w-9 grid place-items-center rounded-full bg-emerald-50 text-emerald-700">
              🌱
            </div>
            <div>
              <h3 className="text-[16px] md:text-[18px] font-semibold text-slate-900">
                Edit Crop Details
              </h3>
              <p className="text-[12px] md:text-[13px] text-slate-500">
                Changes apply when you click <span className="font-medium">Update</span>.
              </p>
            </div>
          </div>
          <button
            onClick={() => setEditingCrop(null)}
            className="p-2 -m-2 rounded-md text-slate-500 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            aria-label="Close"
            title="Close"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 md:px-6 lg:px-8 py-5 md:py-6 overflow-y-auto max-h-[calc(94vh-120px)] space-y-6">
        {/* Crop details */}
        <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 md:p-5">
          <div className="mb-3">
            <h4 className="text-sm md:text-[15px] font-semibold text-slate-900">Crop details</h4>
            <p className="text-[11px] md:text-[12px] text-slate-500">Select crop and variety, then enter field measurements.</p>
          </div>

          {/* 1 → 2 → 3 columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Crop Type */}
            <div className="lg:col-span-1">
              <label className="block text-xs font-medium text-slate-600 mb-1">Crop type</label>
              <select
                name="crop_type_id"
                value={editForm.crop_type_id}
                onChange={handleEditChange}
                className="w-full h-10 md:h-11 border border-slate-300 rounded-lg px-3 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
              >
                <option value="">— Select crop —</option>
                {cropTypes.map((type) => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </select>
            </div>

            {/* Variety */}
            <div className="lg:col-span-1">
              <label className="block text-xs font-medium text-slate-600 mb-1">Variety</label>
              <select
                name="variety_id"
                value={editForm.variety_id || ""}
                onChange={handleEditChange}
                className="w-full h-10 md:h-11 border border-slate-300 rounded-lg px-3 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
              >
                <option value="">— Select variety —</option>
                {varieties.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>

            {/* Planted date */}
            <div className="lg:col-span-1">
              <label className="block text-xs font-medium text-slate-600 mb-1">Planted date</label>
              <input
                type="date"
                name="planted_date"
                value={(editForm.planted_date || "").toString().split("T")[0] || ""}
                onChange={handleEditChange}
                className="w-full h-10 md:h-11 border border-slate-300 rounded-lg px-3 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Estimated harvest auto-fills based on crop maturity.
              </p>
            </div>

            {/* Estimated harvest */}
            <div className="lg:col-span-1">
              <label className="block text-xs font-medium text-slate-600 mb-1">Estimated harvest</label>
              <input
                type="date"
                name="estimated_harvest"
                value={(editForm.estimated_harvest || "").toString().split("T")[0] || ""}
                onChange={handleEditChange}
                className="w-full h-10 md:h-11 border border-slate-300 rounded-lg px-3 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
              />
              <p className="mt-1 text-[11px] text-slate-500">You can still adjust this date manually.</p>
            </div>

            {/* Volume */}
            <div className="lg:col-span-1">
              <label className="block text-xs font-medium text-slate-600 mb-1">Estimated volume</label>
              <div className="relative">
                <input
                  name="estimated_volume"
                  value={editForm.estimated_volume || ""}
                  onChange={handleEditChange}
                  inputMode="decimal"
                  placeholder="e.g., 300"
                  className="w-full h-10 md:h-11 border border-slate-300 rounded-lg px-3 pr-16 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-500">
                  {yieldUnitMap[editForm.crop_type_id] || "units"}
                </span>
              </div>
            </div>

            {/* Hectares */}
            <div className="lg:col-span-1">
              <label className="block text-xs font-medium text-slate-600 mb-1">Estimated hectares</label>
              <input
                name="estimated_hectares"
                value={editForm.estimated_hectares || ""}
                onChange={handleEditChange}
                inputMode="decimal"
                placeholder="e.g., 3.50"
                className="w-full h-10 md:h-11 border border-slate-300 rounded-lg px-3 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
              />
            </div>

            {/* Barangay (span two cols on lg for nicer line length) */}
            <div className="md:col-span-2 lg:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Barangay (crop)</label>
              <input
                name="barangay"
                value={editForm.barangay || ""}
                onChange={handleEditChange}
                placeholder="e.g., Pacol"
                className="w-full h-10 md:h-11 border border-slate-300 rounded-lg px-3 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
              />
            </div>
          </div>
        </section>

        {/* Harvest */}
        <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 md:p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h4 className="text-sm md:text-[15px] font-semibold text-slate-900">Harvest</h4>
              <p className="text-[11px] md:text-[12px] text-slate-500">Track actual harvest status and date.</p>
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                id="is_harvested"
                type="checkbox"
                name="is_harvested"
                checked={Number(editForm.is_harvested) === 1}
                onChange={handleEditChange}
                className="h-4 w-4 md:h-5 md:w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
              />
              <span>Mark as harvested</span>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Harvested on</label>
              <input
                type="date"
                name="harvested_date"
                disabled={Number(editForm.is_harvested) !== 1}
                value={(editForm.harvested_date || "").toString().split("T")[0] || ""}
                onChange={handleEditChange}
                className={`w-full h-10 md:h-11 border rounded-lg px-3 focus:outline-none focus:ring-2 focus:ring-emerald-600 ${
                  Number(editForm.is_harvested) !== 1
                    ? "bg-slate-100 border-slate-200 text-slate-400"
                    : "border-slate-300 bg-white"
                }`}
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Enable by checking <span className="font-medium">Mark as harvested</span>.
              </p>
            </div>
          </div>
        </section>

        {/* Farmer */}
        <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 md:p-5">
          <div className="mb-3">
            <h4 className="text-sm md:text-[15px] font-semibold text-slate-900">Farmer</h4>
            <p className="text-[11px] md:text-[12px] text-slate-500">Update the farmer’s contact and tenure.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">First name</label>
              <input
                name="farmer_first_name"
                value={editForm.farmer_first_name || ""}
                onChange={handleEditChange}
                placeholder="e.g., Juan"
                className="w-full h-10 md:h-11 border border-slate-300 rounded-lg px-3 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Last name</label>
              <input
                name="farmer_last_name"
                value={editForm.farmer_last_name || ""}
                onChange={handleEditChange}
                placeholder="e.g., Dela Cruz"
                className="w-full h-10 md:h-11 border border-slate-300 rounded-lg px-3 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Mobile</label>
              <input
                name="farmer_mobile"
                value={editForm.farmer_mobile || ""}
                onChange={handleEditChange}
                placeholder="e.g., 0919…"
                className="w-full h-10 md:h-11 border border-slate-300 rounded-lg px-3 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
              />
            </div>

            <div className="md:col-span-2 lg:col-span-3">
              <label className="block text-xs font-medium text-slate-600 mb-1">Full address</label>
              <input
                name="farmer_address"
                value={editForm.farmer_address || ""}
                onChange={handleEditChange}
                placeholder="e.g., Purok Kamatis, Ma-ao"
                className="w-full h-10 md:h-11 border border-slate-300 rounded-lg px-3 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
              />
            </div>

            <div className="md:col-span-2 lg:col-span-3">
              <label className="block text-xs font-medium text-slate-600 mb-1">Tenure</label>
              <select
                name="tenure_id"
                value={editForm.tenure_id || ""}
                onChange={handleEditChange}
                className="w-full h-10 md:h-11 border border-slate-300 rounded-lg px-3 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
              >
                <option value="">— Select tenure —</option>
                {tenures.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <div className="mt-1 text-[11px] md:text-[12px] text-slate-500 flex flex-wrap gap-x-4">
                <span>Current: {editingCrop?.tenure_name || "N/A"}</span>
                {editForm.farmer_id ? (
                  <span>
                    {/* Linked ID: <span className="font-medium">{editForm.farmer_id}</span> */}
                  </span>
                ) : (
                  <span>No farmer linked</span>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Intercropping */}
        <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 md:p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h4 className="text-sm md:text-[15px] font-semibold text-slate-900">Intercropping (secondary crop)</h4>
              <p className="text-[11px] md:text-[12px] text-slate-500">Optional secondary crop on the same field.</p>
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                name="is_intercropped"
                checked={Number(editForm.is_intercropped) === 1}
                onChange={handleEditChange}
                className="h-4 w-4 md:h-5 md:w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
              />
              <span>Field is intercropped</span>
            </label>
          </div>

          {Number(editForm.is_intercropped) === 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Secondary crop type */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Secondary crop type</label>
                <select
                  name="intercrop_crop_type_id"
                  value={editForm.intercrop_crop_type_id || ""}
                  onChange={handleEditChange}
                  className="w-full h-10 md:h-11 border border-slate-300 rounded-lg px-3 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
                >
                  <option value="">— Select crop —</option>
                  {cropTypes.map((type) => (
                    <option key={type.id} value={type.id}>{type.name}</option>
                  ))}
                </select>
              </div>

              {/* Secondary variety */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Secondary variety</label>
                <select
                  name="intercrop_variety_id"
                  value={editForm.intercrop_variety_id || ""}
                  onChange={handleEditChange}
                  className="w-full h-10 md:h-11 border border-slate-300 rounded-lg px-3 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
                >
                  <option value="">— Select variety —</option>
                  {interVarieties.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>

              {/* Secondary estimated volume */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Secondary estimated volume</label>
                <div className="relative">
                  <input
                    name="intercrop_estimated_volume"
                    value={editForm.intercrop_estimated_volume || ""}
                    onChange={handleEditChange}
                    inputMode="decimal"
                    placeholder="e.g., 100"
                    className="w-full h-10 md:h-11 border border-slate-300 rounded-lg px-3 pr-16 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-500">
                    {yieldUnitMap[editForm.intercrop_crop_type_id] || "units"}
                  </span>
                </div>
              </div>

              {/* Cropping system label */}
              <div className="md:col-span-1 lg:col-span-1">
                <label className="block text-xs font-medium text-slate-600 mb-1">Cropping system (label)</label>
                <select
                  name="intercrop_cropping_system"
                  value={editForm.intercrop_cropping_system || ""}
                  onChange={handleEditChange}
                  className="w-full h-10 md:h-11 border border-slate-300 rounded-lg px-3 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
                >
                  <option value="">— Select cropping system —</option>
                  <option value="Strip intercropping">Strip intercropping</option>
                  <option value="Relay intercropping">Relay intercropping</option>
                  <option value="Mixed intercropping">Mixed intercropping</option>
                  <option value="Row intercropping">Row intercropping</option>
                  <option value="Alley cropping">Alley cropping</option>
                  <option value="Others">Others</option>
                </select>
              </div>

              {/* Cropping description (span two for breathing room) */}
              <div className="md:col-span-2 lg:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Intercrop description</label>
                <textarea
                  name="intercrop_cropping_description"
                  value={editForm.intercrop_cropping_description || ""}
                  onChange={handleEditChange}
                  rows={2}
                  placeholder="Describe pattern, row distance, relay schedule, etc."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
                />
              </div>
            </div>
          )}
        </section>

        {/* Notes */}
        <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 md:p-5">
          <div className="mb-3">
            <h4 className="text-sm md:text-[15px] font-semibold text-slate-900">Notes</h4>
            <p className="text-[11px] md:text-[12px] text-slate-500">Optional internal notes about this crop.</p>
          </div>
          <textarea
            name="note"
            value={editForm.note || ""}
            onChange={handleEditChange}
            rows={3}
            placeholder="Optional notes for this crop…"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
          />
        </section>
      </div>

      {/* Footer */}
      <div className="sticky bottom-0 z-10 bg-white/90 backdrop-blur border-t border-slate-100 px-5 md:px-6 lg:px-8 py-3 md:py-4">
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setEditingCrop(null)}
            className="px-4 h-10 md:h-11 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleUpdate}
            className="px-4 h-10 md:h-11 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-600"
          >
            Update
          </button>
        </div>
      </div>
    </div>
  </div>
)}

      {/* View All Modal */}
      {viewingCrop && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-start md:items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white p-6 md:p-8 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl relative">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">
                  {viewingCrop.crop_name}
                  {viewingCrop.variety_name
                    ? ` · ${viewingCrop.variety_name}`
                    : ""}
                </h3>
                <p className="text-sm text-slate-500">
                  {viewingCrop.crop_barangay || "—"}
                </p>
              </div>
              <button
                onClick={() => setViewingCrop(null)}
                className="p-2 -m-2 rounded-md hover:bg-slate-50 text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                aria-label="Close"
                title="Close"
              >
                ✕
              </button>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 mb-4">
              <div className="text-[11px] tracking-wide text-slate-500 uppercase mb-2">
                Farmer
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                <Stat
                  label="Name"
                  value={
                    viewingCrop.farmer_first_name || viewingCrop.farmer_last_name
                      ? `${viewingCrop.farmer_first_name || ""} ${
                          viewingCrop.farmer_last_name || ""
                        }`.trim()
                      : "N/A"
                  }
                />
                <Stat
                  label="Mobile"
                  value={viewingCrop.farmer_mobile || "N/A"}
                />
                <Stat
                  label="Barangay"
                  value={viewingCrop.farmer_barangay || "N/A"}
                />
                <Stat
                  label="Full Address"
                  value={
                    <span className="break-words">
                      {viewingCrop.farmer_address || "N/A"}
                    </span>
                  }
                />
                {/* Tenure in modal */}
                <Stat label="Tenure" value={viewingCrop.tenure_name || "N/A"} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
              <Stat label="Planted" value={fmtDate(viewingCrop.planted_date)} />
              <Stat
                label="Harvest"
                value={fmtDate(viewingCrop.estimated_harvest)}
              />
              <Stat
                label="Volume"
                value={`${fmtNum(viewingCrop.estimated_volume)} ${
                  yieldUnitMap[viewingCrop.crop_type_id] || "units"
                }`}
              />
              <Stat
                label="Hectares"
                value={fmtNum(viewingCrop.estimated_hectares)}
              />
              <Stat label="Harvest status" value={viewingHarvestLabel} />
            </div>

            {/* Secondary crop in modal */}
            {viewingCrop.intercrop_crop_name && (
              <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/70 p-4">
                <div className="text-[11px] uppercase tracking-wide text-emerald-700 mb-1">
                  Secondary crop
                </div>
                <div className="text-[14px] font-semibold text-emerald-900">
                  {viewingCrop.intercrop_crop_name}
                  {viewingCrop.intercrop_variety_name
                    ? ` · ${viewingCrop.intercrop_variety_name}`
                    : ""}
                </div>
                <div className="mt-1 text-[13px] text-emerald-900">
                  {viewingCrop.intercrop_estimated_volume ? (
                    <>
                      Est. yield:{" "}
                      {fmtNum(viewingCrop.intercrop_estimated_volume)}{" "}
                      {yieldUnitMap[viewingCrop.intercrop_crop_type_id] ||
                        "units"}
                    </>
                  ) : (
                    "No estimated yield recorded"
                  )}
                </div>
                {viewingCrop.intercrop_cropping_system && (
                  <div className="mt-1 text-[12px] text-emerald-700/80">
                    {viewingCrop.intercrop_cropping_system}
                  </div>
                )}
                {viewingCrop.intercrop_cropping_description && (
                  <p className="mt-2 text-[13px] text-emerald-900/90">
                    {viewingCrop.intercrop_cropping_description}
                  </p>
                )}
              </div>
            )}

            {viewingCrop.note && viewingCrop.note.trim() && (
              <div className="mt-4">
                <div className="text-[11px] uppercase tracking-wide text-slate-500">
                  Note
                </div>
                <p className="text-[14px] text-slate-700 whitespace-pre-wrap">
                  {viewingCrop.note}
                </p>
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setViewingCrop(null)}
                className="px-4 py-2 rounded-md border border-slate-300 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      {pendingDelete && (
        <ConfirmDialog
          title="Delete crop"
          message={`This will permanently delete "${pendingDelete.crop_name}" in ${
            pendingDelete.crop_barangay || "—"
          }.`}
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
    <div className="text-[11px] uppercase tracking-wide text-slate-500">
      {label}
    </div>
    <div className="text-[14px] text-slate-900">{value}</div>
  </div>
);
function addDaysYMD(ymd, days) {
  if (!ymd || !days) return "";
  const d = new Date(ymd);
  if (isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + Number(days));
  // return YYYY-MM-DD
  return d.toISOString().slice(0, 10);
}

function NoteClamp({ text, className = "" }) {
  const [expanded, setExpanded] = useState(false);
  if (!text || !text.trim()) return null;
  const needsToggle = text.length > 140;
  return (
    <div className={className}>
      <div className="text-[11px] uppercase tracking-wide text-slate-500">
        Note
      </div>
      <p
        className={`text-[14px] text-slate-700 ${
          expanded ? "" : "line-clamp-3"
        }`}
        style={
          !expanded
            ? {
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }
            : {}
        }
      >
        {text}
      </p>
      {needsToggle && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-[12px] text-emerald-700 hover:underline"
        >
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
    <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-start md:items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl p-6">
        <h4 className="text-lg font-semibold text-slate-900">{title}</h4>
        <p className="mt-2 text-sm text-slate-700">{message}</p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-md border border-slate-300 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700"
          >
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
  <div className="col-span-full rounded-2xl border border-dashed border-slate-300 p-10 text-center">
    <h4 className="text-lg font-semibold text-slate-900">No crops found</h4>
    <p className="mt-1 text-slate-600">
      Try adjusting the filters or your search.
    </p>
    <button
      onClick={onClear}
      className="mt-4 inline-flex items-center px-3 py-2 rounded-md border border-slate-300 hover:bg-slate-50"
    >
      Clear filters
    </button>
  </div>
);

export default ManageCrop;
