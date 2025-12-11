// pages/AdminCrop/SuperManageCrop.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AOS from "aos";
import "aos/dist/aos.css";
import axios from "axios";
import SuperAdminNav from "../NavBar/SuperAdminNav";
import Footer from "../LandingPage/Footer";
import {
  Search,
  Filter as FilterIcon,
  X,
  ChevronDown,
  Calendar,
  TrendingUp,
  Package,
  CheckCircle2,
  Clock,
} from "lucide-react";

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
const SuperAdminManageCrop = () => {
  const navigate = useNavigate();

  const [crops, setCrops] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [editingCrop, setEditingCrop] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [activeActionId, setActiveActionId] = useState(null);

  const [cropTypes, setCropTypes] = useState([]);
  const [varieties, setVarieties] = useState([]);
  const [interVarieties, setInterVarieties] = useState([]);

  // Tenure options
  const [tenures, setTenures] = useState([]);

  const [selectedCropTypeId, setSelectedCropTypeId] = useState(null);
  const [search, setSearch] = useState("");

  const [sort, setSort] = useState("harvest_desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [pendingDelete, setPendingDelete] = useState(null);

  const [viewingCrop, setViewingCrop] = useState(null);

  // Harvest status filter (all / harvested / not_harvested)
  const [harvestFilter, setHarvestFilter] = useState("all");

  // ---------- NEW: Filter UI extra state ----------
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState(0);

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

  // Tenure list (normalized)
  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get("http://localhost:5000/api/crops/tenures");
        const raw = Array.isArray(res.data) ? res.data : [];
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
        .get(`http://localhost:5000/api/crops/varieties/${editForm.crop_type_id}`)
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
        .catch((err) => console.error("Failed to load secondary varieties:", err));
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

  /* ------- NEW: derived stats for Filter UI ------- */
  const harvestStats = useMemo(() => {
    let harvested = 0;
    let notHarvested = 0;
    crops.forEach((c) => {
      const isHarvested =
        c.is_harvested === 1 ||
        c.is_harvested === "1" ||
        c.is_harvested === true;
      if (isHarvested) harvested += 1;
      else notHarvested += 1;
    });
    return {
      all: crops.length,
      harvested,
      notHarvested,
    };
  }, [crops]);

  const cropTypeStats = useMemo(() => {
    const counts = {};
    crops.forEach((c) => {
      if (!c.crop_type_id) return;
      counts[c.crop_type_id] = (counts[c.crop_type_id] || 0) + 1;
    });

    return cropTypes.map((t) => ({
      id: t.id,
      name: t.name,
      color: colorByCrop[t.name] || "#22c55e",
      count: counts[t.id] || 0,
    }));
  }, [crops, cropTypes]);

  const sortOptionsUI = [
    { value: "harvest_desc", label: "Harvest: Newest First", icon: Calendar },
    { value: "harvest_asc", label: "Harvest: Oldest First", icon: Calendar },
    { value: "volume_desc", label: "Volume: High to Low", icon: TrendingUp },
    { value: "volume_asc", label: "Volume: Low to High", icon: TrendingUp },
  ];

  const harvestOptionsUI = [
    {
      value: "all",
      label: "All Crops",
      icon: Package,
      count: harvestStats.all,
    },
    {
      value: "harvested",
      label: "Harvested",
      icon: CheckCircle2,
      count: harvestStats.harvested,
    },
    {
      value: "not_harvested",
      label: "Growing",
      icon: Clock,
      count: harvestStats.notHarvested,
    },
  ];

  // Active filters badge count
  useEffect(() => {
    let count = 0;
    if (search) count++;
    if (selectedCropTypeId) count++;
    if (sort !== "harvest_desc") count++;
    if (harvestFilter !== "all") count++;
    setActiveFilters(count);
  }, [search, selectedCropTypeId, sort, harvestFilter]);

  /* ------- filter + search + harvest status ------- */
  const filtered = useMemo(() => {
    const byType = crops.filter(
      (c) => !selectedCropTypeId || c.crop_type_id === selectedCropTypeId
    );

    const byStatus = byType.filter((c) => {
      const isHarvested =
        c.is_harvested === 1 ||
        c.is_harvested === "1" ||
        c.is_harvested === true;
      if (harvestFilter === "harvested") return isHarvested;
      if (harvestFilter === "not_harvested") return !isHarvested;
      return true;
    });

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
        c.tenure_name,
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
      farmer_mobile: crop.farmer_mobile || "",
      farmer_address: crop.farmer_address || "",
      tenure_id: crop.farmer_tenure_id || "",

      is_harvested:
        crop.is_harvested === 1 ||
        crop.is_harvested === "1" ||
        crop.is_harvested === true
          ? 1
          : 0,
      harvested_date: crop.harvested_date || "",

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

    if (name === "planted_date") {
      const plantedYMD = val;
      const days =
        STANDARD_MATURITY_DAYS[Number(editForm.crop_type_id)] || null;

      setEditForm((prev) => ({
        ...prev,
        planted_date: plantedYMD,
        ...(days ? { estimated_harvest: addDaysYMD(plantedYMD, days) } : {}),
      }));
      return;
    }

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

    setEditForm((prev) => ({ ...prev, [name]: val }));
  };

  const handleUpdate = async () => {
    try {
      const hasFarmer = !!editForm.farmer_id;
      const nameChanged =
        (editingCrop?.farmer_first_name || "") !==
          (editForm.farmer_first_name || "") ||
        (editingCrop?.farmer_last_name || "") !==
          (editForm.farmer_last_name || "");

      const contactChanged =
        (editingCrop?.farmer_mobile || "") !== (editForm?.farmer_mobile || "") ||
        (editingCrop?.farmer_address || "") !== (editForm?.farmer_address || "");

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
            tenure_id: editForm.tenure_id || null,
          }
        );
      }

      const payload = { ...editForm };
      delete payload.farmer_full_name;
      delete payload.farmer_id;
      delete payload.farmer_first_name;
      delete payload.farmer_last_name;
      delete payload.farmer_mobile;
      delete payload.farmer_address;
      delete payload.tenure_id;

      payload.is_harvested = Number(editForm.is_harvested) === 1 ? 1 : 0;
      if (payload.is_harvested !== 1) payload.harvested_date = null;

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

 const confirmDelete = async () => {
  try {
    const currentAdminId = getCurrentUserId();
    console.log("[DELETE] Current admin ID:", currentAdminId); // ✅ Add this
    console.log("[DELETE] Deleting crop:", pendingDelete.id); // ✅ Add this
    
    await axios.delete(
      `http://localhost:5000/api/managecrops/${pendingDelete.id}`,
      {
        data: { deleted_by: currentAdminId },
        headers: { "X-User-Id": currentAdminId || "" }
      }
    );
    
    await fetchCrops();
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
      <SuperAdminNav />

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

            {/* ---------- NEW: FilterUI-style Filters (copied from Admin) ---------- */}
            <div className="mt-2">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 space-y-4">
                  {/* Top Row: Search + Filter Toggle + Reset */}
                  <div className="flex gap-3">
                    {/* Search */}
                    <div className="flex-1 relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search by farmer, barangay, crop variety..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full h-12 pl-12 pr-12 rounded-xl border border-slate-200 bg-slate-50/50 
                          focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 
                          transition-all outline-none text-sm"
                      />
                      {search && (
                        <button
                          onClick={() => setSearch("")}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Filter Toggle */}
                    <button
                      onClick={() => setIsFilterOpen((v) => !v)}
                      className={`h-12 px-5 rounded-xl border transition-all font-medium text-sm flex items-center gap-2 whitespace-nowrap ${
                        isFilterOpen
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : activeFilters > 0
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <FilterIcon className="w-4 h-4" />
                      Filters
                      {activeFilters > 0 && (
                        <span
                          className={`min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center text-xs font-semibold ${
                            isFilterOpen ? "bg-white/20" : "bg-emerald-600 text-white"
                          }`}
                        >
                          {activeFilters}
                        </span>
                      )}
                      <ChevronDown
                        className={`w-4 h-4 transition-transform ${
                          isFilterOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    {/* Reset Button */}
                    {activeFilters > 0 && (
                      <button
                        onClick={() => {
                          setSearch("");
                          setSelectedCropTypeId(null);
                          setSort("harvest_desc");
                          setHarvestFilter("all");
                        }}
                        className="h-12 px-5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 
                          transition-all font-medium text-sm flex items-center gap-2 whitespace-nowrap"
                      >
                        <X className="w-4 h-4" />
                        Reset
                      </button>
                    )}
                  </div>

                  {/* Expandable Filter Panel */}
                  <div
                    className={`grid transition-all duration-300 ease-in-out ${
                      isFilterOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="pt-4 border-t border-slate-100 space-y-6">
                        {/* Crop Type Filter */}
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3">
                            Crop Type
                          </label>
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => setSelectedCropTypeId(null)}
                              className={`px-4 py-2.5 rounded-xl border font-medium text-sm transition-all ${
                                selectedCropTypeId === null
                                  ? "bg-slate-900 text-white border-slate-900 shadow-md"
                                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                              }`}
                            >
                              All Crops{" "}
                              <span className="text-xs opacity-70 ml-1.5">
                                ({harvestStats.all})
                              </span>
                            </button>
                            {cropTypeStats.map((crop) => (
                              <button
                                key={crop.id}
                                onClick={() => setSelectedCropTypeId(crop.id)}
                                className={`px-4 py-2.5 rounded-xl border font-medium text-sm transition-all flex items-center gap-2 ${
                                  selectedCropTypeId === crop.id
                                    ? "border-2 shadow-md scale-105"
                                    : "bg-white border-slate-200 hover:border-slate-300 hover:scale-105"
                                }`}
                                style={
                                  selectedCropTypeId === crop.id
                                    ? {
                                        backgroundColor: `${crop.color}20`,
                                        borderColor: crop.color,
                                        color: crop.color,
                                      }
                                    : {}
                                }
                              >
                                <span
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: crop.color }}
                                />
                                {crop.name}
                                <span className="text-xs opacity-60">({crop.count})</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Two Columns: Harvest Status + Sort */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Harvest Status */}
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3">
                              Harvest Status
                            </label>
                            <div className="space-y-2">
                              {harvestOptionsUI.map((option) => {
                                const Icon = option.icon;
                                return (
                                  <button
                                    key={option.value}
                                    onClick={() => setHarvestFilter(option.value)}
                                    className={`w-full px-4 py-3 rounded-xl border text-left transition-all flex items-center gap-3 ${
                                      harvestFilter === option.value
                                        ? "bg-emerald-50 border-emerald-500 text-emerald-900 shadow-sm"
                                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
                                    }`}
                                  >
                                    <div
                                      className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                                        harvestFilter === option.value
                                          ? "bg-emerald-500 text-white"
                                          : "bg-slate-100 text-slate-500"
                                      }`}
                                    >
                                      <Icon className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1">
                                      <div className="font-medium text-sm">{option.label}</div>
                                      <div className="text-xs text-slate-500 mt-0.5">
                                        {option.count} crops
                                      </div>
                                    </div>
                                    {harvestFilter === option.value && (
                                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Sort Options */}
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3">
                              Sort By
                            </label>
                            <div className="space-y-2">
                              {sortOptionsUI.map((option) => {
                                const Icon = option.icon;
                                return (
                                  <button
                                    key={option.value}
                                    onClick={() => setSort(option.value)}
                                    className={`w-full px-4 py-3 rounded-xl border text-left transition-all flex items-center gap-3 ${
                                      sort === option.value
                                        ? "bg-slate-900 border-slate-900 text-white shadow-sm"
                                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
                                    }`}
                                  >
                                    <div
                                      className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                                        sort === option.value
                                          ? "bg-white/20"
                                          : "bg-slate-100 text-slate-500"
                                      }`}
                                    >
                                      <Icon className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1">
                                      <div className="font-medium text-sm">{option.label}</div>
                                    </div>
                                    {sort === option.value && <CheckCircle2 className="w-5 h-5" />}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Active Filters Summary (chips) */}
                  {activeFilters > 0 && !isFilterOpen && (
                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-slate-600 font-medium">
                        Active filters:
                      </span>
                      {search && (
                        <span className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium flex items-center gap-2">
                          Search: "{search}"
                          <button onClick={() => setSearch("")} className="hover:text-slate-900">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      )}
                      {selectedCropTypeId && (
                        <span
                          className="px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2"
                          style={{
                            backgroundColor: `${
                              cropTypeStats.find((c) => c.id === selectedCropTypeId)?.color
                            }20`,
                            color:
                              cropTypeStats.find((c) => c.id === selectedCropTypeId)?.color ||
                              "#16a34a",
                          }}
                        >
                          {cropTypeStats.find((c) => c.id === selectedCropTypeId)?.name}
                          <button
                            onClick={() => setSelectedCropTypeId(null)}
                            className="hover:opacity-70"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      )}
                      {harvestFilter !== "all" && (
                        <span className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-medium flex items-center gap-2">
                          {harvestOptionsUI.find((h) => h.value === harvestFilter)?.label}
                          <button
                            onClick={() => setHarvestFilter("all")}
                            className="hover:text-emerald-900"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      )}
                      {sort !== "harvest_desc" && (
                        <span className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium flex items-center gap-2">
                          {sortOptionsUI.find((s) => s.value === sort)?.label ??
                            SORT_OPTIONS.find((s) => s.value === sort)?.label}
                          <button onClick={() => setSort("harvest_desc")} className="hover:text-slate-900">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
            {/* ---------- END Filter UI ---------- */}
          </div>

          {/* Grid of cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {isLoading ? (
              Array.from({ length: pageSize }).map((_, i) => <SkeletonCard key={i} />)
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

                      {activeActionId === crop.id && (
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setActiveActionId(null)}
                          aria-hidden="true"
                        />
                      )}

                      {activeActionId === crop.id && (
                        <div
                          className="absolute right-0 mt-2 w-36 bg-white border rounded-xl shadow-xl z-50 overflow-hidden"
                          onClick={(e) => e.stopPropagation()}
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
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                      <h3 className="text-[20px] font-semibold text-slate-900">{crop.crop_name}</h3>
                    </div>
                    {crop.variety_name && (
                      <div className="mt-0.5 text-[13px] text-slate-500">{crop.variety_name}</div>
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

                    {/* Meta */}
                    <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2">
                      <Stat label="Planted" value={fmtDate(crop.planted_date)} />
                      <Stat label="Estimated Harvest" value={fmtDate(crop.estimated_harvest)} />
                      <Stat
                        label="Estimated Volume"
                        value={`${fmtNum(crop.estimated_volume)} ${
                          yieldUnitMap[crop.crop_type_id] || "units"
                        }`}
                      />
                      <Stat label="Hectares" value={fmtNum(crop.estimated_hectares)} />
                      <Stat label="Avg elevation (m)" value={`${fmtNum(crop.avg_elevation_m)} m`} />
                      <Stat label="Barangay (Crop)" value={crop.crop_barangay || "N/A"} />
                      <Stat label="Tenure" value={crop.tenure_name || "N/A"} />
                      <Stat
                        label="Map"
                        value={
                          <button
                            className="text-emerald-700 hover:underline"
                            onClick={() =>
                              navigate("/SuperAdminMap", {
                                state: { cropId: String(crop.id), zoom: 17 },
                              })
                            }
                            title="Open in Admin Map"
                          >
                            View location ↗
                          </button>
                        }
                      />
                    </div>

                    {/* Secondary crop */}
                    {crop.intercrop_crop_name && (
                      <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-2">
                        <div className="text-[11px] uppercase tracking-wide text-emerald-700">
                          Secondary crop
                        </div>
                        <div className="text-[14px] font-medium text-emerald-900">
                          {crop.intercrop_crop_name}
                          {crop.intercrop_variety_name ? ` · ${crop.intercrop_variety_name}` : ""}
                        </div>
                        <div className="mt-0.5 text-[12px] text-emerald-800">
                          {crop.intercrop_estimated_volume ? (
                            <>
                              Est. yield: {fmtNum(crop.intercrop_estimated_volume)}{" "}
                              {yieldUnitMap[crop.intercrop_crop_type_id] || "units"}
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

                    {/* Footer */}
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
                <span className="font-medium">{total === 0 ? 0 : start + 1}</span>
                {"–"}
                <span className="font-medium">{Math.min(start + pageSize, total)}</span>{" "}
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
                  <PageBtn disabled={page === 1} onClick={() => setPage(1)} aria="First">
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
                  <p className="text-[11px] md:text-[12px] text-slate-500">
                    Select crop and variety, then enter field measurements.
                  </p>
                </div>

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
                        <option key={type.id} value={type.id}>
                          {type.name}
                        </option>
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
                        <option key={v.id} value={v.id}>
                          {v.name}
                        </option>
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

                  {/* Barangay */}
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
                    <p className="text-[11px] md:text-[12px] text-slate-500">
                      Track actual harvest status and date.
                    </p>
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
                  <p className="text-[11px] md:text-[12px] text-slate-500">
                    Update the farmer’s contact and tenure.
                  </p>
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
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                    <div className="mt-1 text-[11px] md:text-[12px] text-slate-500 flex flex-wrap gap-x-4">
                      <span>Current: {editingCrop?.tenure_name || "N/A"}</span>
                      {editForm.farmer_id ? <span /> : <span>No farmer linked</span>}
                    </div>
                  </div>
                </div>
              </section>

              {/* Intercropping */}
              <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 md:p-5">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h4 className="text-sm md:text-[15px] font-semibold text-slate-900">
                      Intercropping (secondary crop)
                    </h4>
                    <p className="text-[11px] md:text-[12px] text-slate-500">
                      Optional secondary crop on the same field.
                    </p>
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
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Secondary crop type
                      </label>
                      <select
                        name="intercrop_crop_type_id"
                        value={editForm.intercrop_crop_type_id || ""}
                        onChange={handleEditChange}
                        className="w-full h-10 md:h-11 border border-slate-300 rounded-lg px-3 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
                      >
                        <option value="">— Select crop —</option>
                        {cropTypes.map((type) => (
                          <option key={type.id} value={type.id}>
                            {type.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Secondary variety
                      </label>
                      <select
                        name="intercrop_variety_id"
                        value={editForm.intercrop_variety_id || ""}
                        onChange={handleEditChange}
                        className="w-full h-10 md:h-11 border border-slate-300 rounded-lg px-3 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
                      >
                        <option value="">— Select variety —</option>
                        {interVarieties.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Secondary estimated volume
                      </label>
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

                    <div className="md:col-span-1 lg:col-span-1">
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Cropping system (label)
                      </label>
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

                    <div className="md:col-span-2 lg:col-span-2">
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Intercrop description
                      </label>
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
                  <p className="text-[11px] md:text-[12px] text-slate-500">
                    Optional internal notes about this crop.
                  </p>
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
                  {viewingCrop.variety_name ? ` · ${viewingCrop.variety_name}` : ""}
                </h3>
                <p className="text-sm text-slate-500">{viewingCrop.crop_barangay || "—"}</p>
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
              <div className="text-[11px] tracking-wide text-slate-500 uppercase mb-2">Farmer</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                <Stat
                  label="Name"
                  value={
                    viewingCrop.farmer_first_name || viewingCrop.farmer_last_name
                      ? `${viewingCrop.farmer_first_name || ""} ${viewingCrop.farmer_last_name || ""}`.trim()
                      : "N/A"
                  }
                />
                <Stat label="Mobile" value={viewingCrop.farmer_mobile || "N/A"} />
                <Stat label="Barangay" value={viewingCrop.farmer_barangay || "N/A"} />
                <Stat
                  label="Full Address"
                  value={<span className="break-words">{viewingCrop.farmer_address || "N/A"}</span>}
                />
                <Stat label="Tenure" value={viewingCrop.tenure_name || "N/A"} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
              <Stat label="Planted" value={fmtDate(viewingCrop.planted_date)} />
              <Stat label="Harvest" value={fmtDate(viewingCrop.estimated_harvest)} />
              <Stat
                label="Volume"
                value={`${fmtNum(viewingCrop.estimated_volume)} ${
                  yieldUnitMap[viewingCrop.crop_type_id] || "units"
                }`}
              />
              <Stat label="Hectares" value={fmtNum(viewingCrop.estimated_hectares)} />
              <Stat label="Harvest status" value={viewingHarvestLabel} />
            </div>

            {viewingCrop.intercrop_crop_name && (
              <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/70 p-4">
                <div className="text-[11px] uppercase tracking-wide text-emerald-700 mb-1">
                  Secondary crop
                </div>
                <div className="text-[14px] font-semibold text-emerald-900">
                  {viewingCrop.intercrop_crop_name}
                  {viewingCrop.intercrop_variety_name ? ` · ${viewingCrop.intercrop_variety_name}` : ""}
                </div>
                <div className="mt-1 text-[13px] text-emerald-900">
                  {viewingCrop.intercrop_estimated_volume ? (
                    <>
                      Est. yield: {fmtNum(viewingCrop.intercrop_estimated_volume)}{" "}
                      {yieldUnitMap[viewingCrop.intercrop_crop_type_id] || "units"}
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
                <div className="text-[11px] uppercase tracking-wide text-slate-500">Note</div>
                <p className="text-[14px] text-slate-700 whitespace-pre-wrap">{viewingCrop.note}</p>
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
    <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
    <div className="text-[14px] text-slate-900">{value}</div>
  </div>
);

function getCurrentUserId() {
  try {
    const keys = ["adminUser", "user", "authUser", "sessionUser", "loggedInUser"];
    for (const k of keys) {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const obj = JSON.parse(raw);
      if (obj?.id) return obj.id;
      if (obj?.user?.id) return obj.user.id;
      if (obj?.user_id) return obj.user_id;
    }
  } catch {}
  return null;
}

function addDaysYMD(ymd, days) {
  if (!ymd || !days) return "";
  const d = new Date(ymd);
  if (isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + Number(days));
  return d.toISOString().slice(0, 10);
}

function NoteClamp({ text, className = "" }) {
  const [expanded, setExpanded] = useState(false);
  if (!text || !text.trim()) return null;
  const needsToggle = text.length > 140;
  return (
    <div className={className}>
      <div className="text-[11px] uppercase tracking-wide text-slate-500">Note</div>
      <p
        className={`text-[14px] text-slate-700 ${expanded ? "" : "line-clamp-3"}`}
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
  <div className="col-span-full rounded-2xl border border-dashed border-slate-300 p-10 text-center">
    <h4 className="text-lg font-semibold text-slate-900">No crops found</h4>
    <p className="mt-1 text-slate-600">Try adjusting the filters or your search.</p>
    <button
      onClick={onClear}
      className="mt-4 inline-flex items-center px-3 py-2 rounded-md border border-slate-300 hover:bg-slate-50"
    >
      Clear filters
    </button>
  </div>
);

export default SuperAdminManageCrop;
