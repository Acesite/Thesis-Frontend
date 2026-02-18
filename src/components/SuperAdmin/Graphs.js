// components/SuperAdmin/Graphs.jsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from "recharts";
import SuperAdminNav from "../NavBar/SuperAdminSideBar";
import Footer from "../LandingPage/Footer";

/* =========================
   API BASE
========================= */
const API_BASE = "http://localhost:5000";

/* ---------- COLORS ---------- */
const COLOR_BY_CROP = {
  Rice: "#F59E0B",
  Corn: "#FB923C",
  Banana: "#10B981",
  Sugarcane: "#34D399",
  Cassava: "#3B82F6",
  Vegetables: "#F472B6",
};
const FALLBACK_COLORS = [
  "#10B981",
  "#3B82F6",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#14B8A6",
];
const CALAMITY_COLORS = [
  "#EF4444",
  "#F59E0B",
  "#10B981",
  "#3B82F6",
  "#8B5CF6",
  "#14B8A6",
  "#FB7185",
  "#22D3EE",
];

const DEFAULT_CALAMITY_TYPES = [
  "Flood",
  "Landslide",
  "Fire",
  "Typhoon",
  "Earthquake",
  "Others",
];

const fmt = (n, opts = {}) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: 2, ...opts }).format(
    n
  );

const fmtPHP = (n) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(Number(n) || 0);

/* ---------- ESTIMATED VALUE DEFAULTS ---------- */
const PRICE_PER_KG_BY_CROP = {
  Rice: 20,
  Corn: 16,
  Banana: 12,
  Sugarcane: 2.2,
  Cassava: 6,
  Vegetables: 30,
};

const YIELD_KG_PER_HA_BY_CROP = {
  Rice: 4000,
  Corn: 3500,
  Banana: 12000,
  Sugarcane: 60000,
  Cassava: 15000,
  Vegetables: 8000,
};

/* ---------- Safe field getters (CROPS) ---------- */
const getBarangayName = (crop) =>
  (crop.barangay && crop.barangay.trim()) ||
  crop.farmer_barangay ||
  crop.barangay_name ||
  crop.brgy_name ||
  "Unknown";

const getPlantedDate = (crop) => {
  const v =
    crop.date_planted ||
    crop.planted_at ||
    crop.created_at ||
    crop.dateCreated ||
    crop.createdAt ||
    null;
  const d = v ? new Date(v) : null;
  return d && !isNaN(d.getTime()) ? d : null;
};

/* ---------- helpers ---------- */
const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const pad2 = (n) => String(n).padStart(2, "0");
const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const getCropType = (c) =>
  (c.crop_name || c.crop_type || c.crop_type_name || "Unknown")
    .toString()
    .trim() || "Unknown";

const getVarietyName = (c) =>
  (c.variety_name ||
    c.variety ||
    c.crop_variety ||
    c.varietyName ||
    c.variety_type ||
    "Unknown")
    .toString()
    .trim() || "Unknown";

const getAreaHa = (c) =>
  toNum(c.area_ha ?? c.estimated_hectares ?? c.hectares ?? c.area ?? 0);

const getExpectedYield = (c) =>
  toNum(
    c.total_expected_yield ??
      c.expected_yield ??
      c.expected_yield_kg ??
      c.estimated_yield ??
      c.yield_estimate ??
      0
  );

/* ---------- Estimated Value helpers ---------- */
const getPricePerKg = (c) =>
  toNum(
    c.price_per_kg ??
      c.farmgate_price ??
      c.priceKg ??
      c.price_kg ??
      PRICE_PER_KG_BY_CROP[getCropType(c)] ??
      0
  );

const getYieldKgPerHa = (c) =>
  toNum(
    c.yield_kg_per_ha ??
      c.expected_yield_per_ha ??
      c.yieldPerHa ??
      c.yield_per_hectare ??
      YIELD_KG_PER_HA_BY_CROP[getCropType(c)] ??
      0
  );

const getExpectedYieldKg = (c) => {
  const direct = toNum(getExpectedYield(c));
  if (direct > 0) return direct;

  const area = toNum(getAreaHa(c));
  const yph = toNum(getYieldKgPerHa(c));
  if (area > 0 && yph > 0) return area * yph;

  return 0;
};

const getEstimatedValuePHP = (c) => {
  const yieldKg = getExpectedYieldKg(c);
  const price = getPricePerKg(c);
  return yieldKg > 0 && price > 0 ? yieldKg * price : 0;
};

/* =========================
   IMPACTS (tbl_calamity_crop_impacts)
========================= */

/** type from impacts join (calamity_type) */
const getImpactType = (r) =>
  (r.calamity_type || r.type || r.incident_type || "Others").toString().trim() ||
  "Others";

/** date priority: started_at > created_at > updated_at */
const getImpactDate = (r) => {
  const v = r.started_at || r.created_at || r.updated_at || null;
  const d = v ? new Date(v) : null;
  return d && !isNaN(d.getTime()) ? d : null;
};

/** damaged area ha:
 * 1) damaged_area_ha
 * 2) damage_fraction * base_area_ha (if available)
 */
const getImpactDamagedAreaHa = (r) => {
  const direct = toNum(r.damaged_area_ha);
  if (direct > 0) return direct;

  const frac = toNum(r.damage_fraction);
  const base = toNum(r.base_area_ha);
  if (frac > 0 && base > 0) return frac * base;

  return 0;
};

/** loss value php (flex fields) */
const getImpactLossPHP = (r) =>
  toNum(r.loss_value_php ?? r.total_loss_php ?? r.loss_value ?? r.loss ?? 0);

/** Month key */
const toMonthKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

/* ---------- Crop name from impact row (may include variety) ---------- */
const getImpactCropName = (r) => {
  const v =
    (r.crop_name && String(r.crop_name).trim()) ||
    (r.crop_type && String(r.crop_type).trim()) ||
    "";
  return v || "Unknown";
};

/* ✅ Normalize crop name so dropdown will NOT show/require varieties.
   Example: "Rice - NSIC Rc222" -> "Rice", "Rice (Rc222)" -> "Rice"
*/
const normalizeCropBase = (name) => {
  const s = String(name || "").trim();
  if (!s) return "Unknown";
  const a = s.split(" - ")[0];
  const b = a.split(" (")[0];
  const c = b.split("(")[0];
  return c.trim() || "Unknown";
};

/* ---------------- REPORT EXPORT (CSV + PDF) ---------------- */
const REPORT_COLUMNS = [
  "Year",
  "Quarter",
  "Crop",
  "Variety",
  "Total Area (ha)",
  "Number of Records",
  "Top Variety",
  "Top Variety Area (ha)",
  "Estimated Crop Value (PHP)",
];

const safeNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const quarterOfDate = (d) => Math.floor(d.getMonth() / 3) + 1;

const downloadCSV = (rows, filename, columns) => {
  if (!rows?.length) return;
  const header = columns || Object.keys(rows[0] || {});
  const csv = [header, ...rows.map((r) => header.map((h) => r[h] ?? ""))]
    .map((row) => row.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// kept (even if unused)
const downloadXLSX = (rows, filename) => {
  if (!rows?.length) return;

  const ordered = rows.map((r) => {
    const o = {};
    REPORT_COLUMNS.forEach((c) => (o[c] = r[c] ?? ""));
    return o;
  });

  const ws = XLSX.utils.json_to_sheet(ordered, { header: REPORT_COLUMNS });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Report");

  ws["!cols"] = REPORT_COLUMNS.map((c) => ({
    wch: Math.max(16, c.length + 2),
  }));
  XLSX.writeFile(wb, filename);
};

const downloadPDFGeneric = async (rows, filename, title, columns) => {
  if (!rows?.length) return;

  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const cols = columns || Object.keys(rows[0] || {});
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

  doc.setFontSize(14);
  doc.text(title || "Report", 40, 32);

  const head = [cols];
  const body = rows.map((r) => cols.map((c) => r[c] ?? ""));

  autoTable(doc, {
    head,
    body,
    startY: 50,
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fontStyle: "bold" },
    margin: { left: 40, right: 40 },
  });

  doc.save(filename);
};

function Graphs() {
  useEffect(() => {
    const root = document.documentElement;
    const prev = root.style.overflowY;
    root.style.overflowY = "scroll";
    return () => {
      root.style.overflowY = prev;
    };
  }, []);

  /* ---------- Data (Crops) ---------- */
  const [allCrops, setAllCrops] = useState([]);
  const [loading, setLoading] = useState(true);

  /* ---------- Data (Impacts) from tbl_calamity_crop_impacts ---------- */
  const [impacts, setImpacts] = useState([]);
  const [calLoading, setCalLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    axios
      .get(`${API_BASE}/api/managecrops`)
      .then((res) => setAllCrops(res.data || []))
      .catch((err) => console.error("Failed to fetch crops:", err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setCalLoading(true);
    axios
      .get(`${API_BASE}/api/impacts`)
      .then((res) => setImpacts(Array.isArray(res.data) ? res.data : []))
      .catch((err) => {
        console.error("Failed to fetch impacts:", err);
        setImpacts([]);
      })
      .finally(() => setCalLoading(false));
  }, []);

  /* ---------- Filters ---------- */
  const [selectedBarangay, setSelectedBarangay] = useState("all");
  const [selectedCrop, setSelectedCrop] = useState("all");
  const [selectedYear, setSelectedYear] = useState("all");
  const [metric, setMetric] = useState("count");

  // ✅ Calamity filters (NO more "damage area/incidents" buttons)
  const [selectedCalamityType, setSelectedCalamityType] = useState("all");
  const [selectedCalamityCrop, setSelectedCalamityCrop] = useState("all"); // ✅ NEW: crop-type only

  const [tab, setTab] = useState("crops");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [reportPeriod, setReportPeriod] = useState("quarterly"); // crops report
  const [calReportPeriod, setCalReportPeriod] = useState("quarterly"); // ✅ calamity report

  /* ---------- OPTIONS ---------- */
  const barangays = useMemo(() => {
    const set = new Set(
      allCrops
        .map((c) => getBarangayName(c))
        .filter((b) => b && b !== "Unknown")
    );
    return ["all", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [allCrops]);

  // ✅ crop types only (NO varieties)
  const crops = useMemo(() => {
    const set = new Set(allCrops.map((c) => getCropType(c)).filter(Boolean));
    return ["all", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [allCrops]);

  const years = useMemo(() => {
    const set = new Set();
    for (const c of allCrops) {
      const d = getPlantedDate(c);
      if (d) set.add(d.getFullYear());
    }
    for (const r of impacts) {
      const d = getImpactDate(r);
      if (d) set.add(d.getFullYear());
    }
    const list = Array.from(set).sort((a, b) => b - a);
    return ["all", ...list];
  }, [allCrops, impacts]);

  /* ---------- CropId -> Crop Map (infer barangay/cropname for impacts) ---------- */
  const cropById = useMemo(() => {
    const m = new Map();
    for (const c of allCrops) {
      const id = c.id ?? c.crop_id ?? c.cropId ?? null;
      if (id != null) m.set(String(id), c);
    }
    return m;
  }, [allCrops]);

  const getImpactBarangay = (r) => {
    const direct =
      (r.barangay && String(r.barangay).trim()) ||
      (r.brgy_name && String(r.brgy_name).trim()) ||
      (r.barangay_name && String(r.barangay_name).trim());
    if (direct) return direct;

    const crop = cropById.get(String(r.crop_id));
    return crop ? getBarangayName(crop) : "Unknown";
  };

  const getImpactCropBase = (r) => {
    const direct = normalizeCropBase(getImpactCropName(r));
    if (direct && direct !== "Unknown") return direct;

    const crop = cropById.get(String(r.crop_id));
    return crop ? normalizeCropBase(getCropType(crop)) : "Unknown";
  };

  /* ---------- FILTERED CROPS ---------- */
  const filtered = useMemo(() => {
    return allCrops.filter((c) => {
      if (selectedBarangay !== "all" && getBarangayName(c) !== selectedBarangay)
        return false;

      if (selectedCrop !== "all" && getCropType(c) !== selectedCrop) return false;

      const d = getPlantedDate(c);
      if (selectedYear !== "all") {
        if (!d) return false;
        if (d.getFullYear() !== Number(selectedYear)) return false;
      }
      return true;
    });
  }, [allCrops, selectedBarangay, selectedCrop, selectedYear]);

  const totalCrops = filtered.length;

  /* ---------- Estimated Crop Value (₱) ---------- */
  const {
    totalEstimatedValue,
    avgEstimatedValue,
    topCropByValue,
    valueByCropData,
  } = useMemo(() => {
    const map = new Map();
    let total = 0;

    for (const c of filtered) {
      const crop = getCropType(c);
      const val = getEstimatedValuePHP(c);
      total += val;
      map.set(crop, (map.get(crop) || 0) + val);
    }

    const arr = Array.from(map.entries())
      .map(([crop_type, totalValue]) => ({ crop_type, totalValue }))
      .sort((a, b) => b.totalValue - a.totalValue);

    return {
      totalEstimatedValue: total,
      avgEstimatedValue: filtered.length ? total / filtered.length : 0,
      topCropByValue: arr[0]?.crop_type || "—",
      valueByCropData: arr,
    };
  }, [filtered]);

  const hasValueData = useMemo(
    () => valueByCropData.some((r) => Number(r.totalValue) > 0),
    [valueByCropData]
  );

  /* ---------- Crop KPIs & charts ---------- */
  const { totalHectares, avgArea, top5Barangays } = useMemo(() => {
    const map = new Map();
    let totalHa = 0;

    for (const c of filtered) {
      const bg = getBarangayName(c);
      const ha = getAreaHa(c);
      totalHa += ha;

      const rec = map.get(bg) || { barangay: bg, crops: 0, hectares: 0 };
      rec.crops += 1;
      rec.hectares += ha;
      map.set(bg, rec);
    }

    const arr = Array.from(map.values())
      .filter((r) => r.barangay !== "Unknown")
      .sort((a, b) => b.hectares - a.hectares);

    return {
      totalHectares: totalHa,
      avgArea: totalCrops ? totalHa / totalCrops : 0,
      top5Barangays: arr.slice(0, 5),
    };
  }, [filtered, totalCrops]);

  const { mostPlanted, topBarangay } = useMemo(() => {
    if (!filtered.length) return { mostPlanted: "—", topBarangay: "—" };
    const cropCount = {};
    const barangayCount = {};
    for (const c of filtered) {
      const cn = getCropType(c);
      const bg = getBarangayName(c);
      cropCount[cn] = (cropCount[cn] || 0) + 1;
      barangayCount[bg] = (barangayCount[bg] || 0) + 1;
    }
    const mostPlanted =
      Object.entries(cropCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
    const topBarangay =
      Object.entries(barangayCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
    return { mostPlanted, topBarangay };
  }, [filtered]);

  const chartData = useMemo(() => {
    const map = new Map();
    for (const c of filtered) {
      const key = getCropType(c);
      const val = metric === "area" ? getAreaHa(c) : 1;
      map.set(key, (map.get(key) || 0) + val);
    }
    return Array.from(map.entries())
      .map(([crop_type, total]) => ({ crop_type, total }))
      .sort((a, b) => b.total - a.total);
  }, [filtered, metric]);

  /* ---------- Top Varieties ---------- */
  const TOP_VARIETY_LIMIT = 10;
  const topVarietiesData = useMemo(() => {
    const map = new Map();

    for (const c of filtered) {
      const variety = getVarietyName(c);
      if (!variety || variety === "Unknown") continue;

      const area = getAreaHa(c);
      const rec = map.get(variety) || { variety, area: 0, count: 0 };
      rec.area += area;
      rec.count += 1;
      map.set(variety, rec);
    }

    const rows = Array.from(map.values());

    rows.sort((a, b) => {
      const av = metric === "area" ? a.area : a.count;
      const bv = metric === "area" ? b.area : b.count;
      return bv - av;
    });

    return rows.slice(0, TOP_VARIETY_LIMIT).map((r) => ({
      variety: r.variety,
      value: metric === "area" ? r.area : r.count,
      area: r.area,
      count: r.count,
    }));
  }, [filtered, metric]);

  /* ---------- Crop → Top Variety Summary Table ---------- */
  const cropTopVarietyTable = useMemo(() => {
    const cropMap = new Map();

    for (const c of filtered) {
      const crop = getCropType(c);
      const area = getAreaHa(c);
      const variety = getVarietyName(c);

      const rec =
        cropMap.get(crop) || {
          crop,
          totalArea: 0,
          records: 0,
          varietyArea: new Map(),
        };

      rec.totalArea += area;
      rec.records += 1;

      if (variety && variety !== "Unknown") {
        rec.varietyArea.set(variety, (rec.varietyArea.get(variety) || 0) + area);
      }

      cropMap.set(crop, rec);
    }

    const rows = Array.from(cropMap.values()).map((r) => {
      let topVariety = "—";
      let topVarietyArea = 0;

      if (r.varietyArea.size) {
        const best = Array.from(r.varietyArea.entries()).sort(
          (a, b) => b[1] - a[1]
        )[0];
        topVariety = best?.[0] ?? "—";
        topVarietyArea = best?.[1] ?? 0;
      }

      return {
        crop: r.crop,
        totalArea: r.totalArea,
        records: r.records,
        topVariety,
        topVarietyArea,
      };
    });

    rows.sort((a, b) => b.totalArea - a.totalArea);
    return rows;
  }, [filtered]);

  /* ---------- On-screen crops report ---------- */
  const activeReportYear = useMemo(() => {
    if (selectedYear !== "all") return Number(selectedYear);
    const latest = years.find((y) => y !== "all");
    return Number(latest || new Date().getFullYear());
  }, [selectedYear, years]);

  const cropReportData = useMemo(() => {
    const getVal = (c) => (metric === "area" ? getAreaHa(c) : 1);

    if (reportPeriod === "annually") {
      const map = new Map();
      for (const c of filtered) {
        const d = getPlantedDate(c);
        if (!d) continue;
        const y = d.getFullYear();
        map.set(y, (map.get(y) || 0) + getVal(c));
      }
      return Array.from(map.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([year, total]) => ({
          key: String(year),
          label: String(year),
          total,
        }));
    }

    if (reportPeriod === "quarterly") {
      const buckets = [
        { key: `Q1-${activeReportYear}`, label: `Q1 ${activeReportYear}`, total: 0 },
        { key: `Q2-${activeReportYear}`, label: `Q2 ${activeReportYear}`, total: 0 },
        { key: `Q3-${activeReportYear}`, label: `Q3 ${activeReportYear}`, total: 0 },
        { key: `Q4-${activeReportYear}`, label: `Q4 ${activeReportYear}`, total: 0 },
      ];
      const idx = new Map(buckets.map((b) => [b.key, b]));

      for (const c of filtered) {
        const d = getPlantedDate(c);
        if (!d) continue;
        if (d.getFullYear() !== activeReportYear) continue;

        const q = Math.floor(d.getMonth() / 3) + 1;
        const key = `Q${q}-${activeReportYear}`;
        const b = idx.get(key);
        if (b) b.total += getVal(c);
      }
      return buckets;
    }

    const buckets = MONTHS_SHORT.map((m, i) => ({
      key: `${activeReportYear}-${pad2(i + 1)}`,
      label: `${m} ${activeReportYear}`,
      total: 0,
    }));
    const idx = new Map(buckets.map((b) => [b.key, b]));

    for (const c of filtered) {
      const d = getPlantedDate(c);
      if (!d) continue;
      if (d.getFullYear() !== activeReportYear) continue;
      const key = `${activeReportYear}-${pad2(d.getMonth() + 1)}`;
      const b = idx.get(key);
      if (b) b.total += getVal(c);
    }
    return buckets;
  }, [filtered, metric, reportPeriod, activeReportYear]);

  /* =========================
     CALAMITY (from impacts table)
     ✅ Crop filter is crop-type only (normalized), not variety
  ========================= */
  const filteredImpacts = useMemo(() => {
    return (impacts || []).filter((r) => {
      if (selectedBarangay !== "all") {
        if (getImpactBarangay(r) !== selectedBarangay) return false;
      }

      if (selectedYear !== "all") {
        const d = getImpactDate(r);
        if (!d) return false;
        if (d.getFullYear() !== Number(selectedYear)) return false;
      }

      if (selectedCalamityType !== "all") {
        if (getImpactType(r) !== selectedCalamityType) return false;
      }

      if (selectedCalamityCrop !== "all") {
        if (getImpactCropBase(r) !== selectedCalamityCrop) return false;
      }

      return true;
    });
  }, [
    impacts,
    selectedBarangay,
    selectedYear,
    selectedCalamityType,
    selectedCalamityCrop,
    cropById,
  ]);

  const calamityTypes = useMemo(() => {
    const fromData = filteredImpacts.map((r) => getImpactType(r)).filter(Boolean);
    const set = new Set([...DEFAULT_CALAMITY_TYPES, ...fromData]);
    return ["all", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [filteredImpacts]);

  // ✅ calamity crop dropdown = crop TYPES ONLY (NO varieties)
  const calamityCrops = useMemo(() => crops, [crops]);

  const calSummary = useMemo(() => {
    const byTypeMap = new Map();
    let totalArea = 0;
    let totalLoss = 0;

    const cropSet = new Set();
    const calamitySet = new Set();

    for (const r of filteredImpacts) {
      const t = getImpactType(r);
      const area = getImpactDamagedAreaHa(r);
      const loss = getImpactLossPHP(r);

      totalArea += area;
      totalLoss += loss;

      if (r.crop_id != null) cropSet.add(String(r.crop_id));
      if (r.calamity_id != null) calamitySet.add(String(r.calamity_id));

      const rec = byTypeMap.get(t) || {
        calamity_type: t,
        total_area: 0,
        incidents: 0,
        total_loss: 0,
      };
      rec.total_area += area;
      rec.incidents += 1;
      rec.total_loss += loss;
      byTypeMap.set(t, rec);
    }

    const byType = Array.from(byTypeMap.values()).sort(
      (a, b) => b.total_area - a.total_area
    );

    return {
      totalAffectedArea: totalArea,
      totalLossValue: totalLoss,
      affectedCrops: cropSet.size,
      calamityCount: calamitySet.size,
      byType,
    };
  }, [filteredImpacts]);

  const calamityByTypeChart = useMemo(() => {
    const rows = (calSummary.byType || []).map((r) => ({
      type: r.calamity_type,
      area: Number(r.total_area || 0),
      incidents: Number(r.incidents || 0),
      loss: Number(r.total_loss || 0),
    }));

    if (!rows.length) {
      const types =
        selectedCalamityType === "all"
          ? DEFAULT_CALAMITY_TYPES
          : [selectedCalamityType];
      return types.map((t) => ({ type: t, area: 0, incidents: 0, loss: 0 }));
    }

    return rows;
  }, [calSummary, selectedCalamityType]);

  /* =========================
     ✅ CALAMITY REPORT (Quarterly / Yearly / Annual + Download CSV/PDF)
  ========================= */
  const activeCalReportYear = useMemo(() => {
    if (selectedYear !== "all") return Number(selectedYear);
    const latest = years.find((y) => y !== "all");
    return Number(latest || new Date().getFullYear());
  }, [selectedYear, years]);

  const calamityReportRows = useMemo(() => {
    const add = (key, label, inc, area, loss, map) => {
      const rec = map.get(key) || {
        key,
        Period: label,
        Incidents: 0,
        "Damaged Area (ha)": 0,
        "Total Loss (PHP)": 0,
      };
      rec.Incidents += inc;
      rec["Damaged Area (ha)"] += area;
      rec["Total Loss (PHP)"] += loss;
      map.set(key, rec);
    };

    // yearly
    if (calReportPeriod === "yearly") {
      const map = new Map();
      for (const r of filteredImpacts) {
        const d = getImpactDate(r);
        if (!d) continue;
        const y = d.getFullYear();
        add(
          String(y),
          String(y),
          1,
          getImpactDamagedAreaHa(r),
          getImpactLossPHP(r),
          map
        );
      }
      return Array.from(map.values())
        .sort((a, b) => String(a.Period).localeCompare(String(b.Period)))
        .map((r) => ({
          ...r,
          Incidents: Number(r.Incidents || 0),
          "Damaged Area (ha)": Number(toNum(r["Damaged Area (ha)"]).toFixed(4)),
          "Total Loss (PHP)": Number(toNum(r["Total Loss (PHP)"]).toFixed(2)),
        }));
    }

    // quarterly (4 buckets for active year)
    if (calReportPeriod === "quarterly") {
      const buckets = [
        { key: `Q1-${activeCalReportYear}`, Period: `Q1 ${activeCalReportYear}` },
        { key: `Q2-${activeCalReportYear}`, Period: `Q2 ${activeCalReportYear}` },
        { key: `Q3-${activeCalReportYear}`, Period: `Q3 ${activeCalReportYear}` },
        { key: `Q4-${activeCalReportYear}`, Period: `Q4 ${activeCalReportYear}` },
      ];
      const map = new Map(
        buckets.map((b) => [
          b.key,
          { ...b, Incidents: 0, "Damaged Area (ha)": 0, "Total Loss (PHP)": 0 },
        ])
      );

      for (const r of filteredImpacts) {
        const d = getImpactDate(r);
        if (!d) continue;
        if (d.getFullYear() !== activeCalReportYear) continue;
        const q = Math.floor(d.getMonth() / 3) + 1;
        const key = `Q${q}-${activeCalReportYear}`;
        add(
          key,
          `Q${q} ${activeCalReportYear}`,
          1,
          getImpactDamagedAreaHa(r),
          getImpactLossPHP(r),
          map
        );
      }

      return buckets.map((b) => {
        const r = map.get(b.key) || {
          ...b,
          Incidents: 0,
          "Damaged Area (ha)": 0,
          "Total Loss (PHP)": 0,
        };
        return {
          ...r,
          Incidents: Number(r.Incidents || 0),
          "Damaged Area (ha)": Number(toNum(r["Damaged Area (ha)"]).toFixed(4)),
          "Total Loss (PHP)": Number(toNum(r["Total Loss (PHP)"]).toFixed(2)),
        };
      });
    }

    // annual (months of active year)
    const monthBuckets = MONTHS_SHORT.map((m, i) => {
      const key = `${activeCalReportYear}-${pad2(i + 1)}`;
      return {
        key,
        Period: `${m} ${activeCalReportYear}`,
        Incidents: 0,
        "Damaged Area (ha)": 0,
        "Total Loss (PHP)": 0,
      };
    });
    const map = new Map(monthBuckets.map((b) => [b.key, { ...b }]));

    for (const r of filteredImpacts) {
      const d = getImpactDate(r);
      if (!d) continue;
      if (d.getFullYear() !== activeCalReportYear) continue;
      const key = `${activeCalReportYear}-${pad2(d.getMonth() + 1)}`;
      add(
        key,
        `${MONTHS_SHORT[d.getMonth()]} ${activeCalReportYear}`,
        1,
        getImpactDamagedAreaHa(r),
        getImpactLossPHP(r),
        map
      );
    }

    return monthBuckets.map((b) => {
      const r = map.get(b.key) || b;
      return {
        ...r,
        Incidents: Number(r.Incidents || 0),
        "Damaged Area (ha)": Number(toNum(r["Damaged Area (ha)"]).toFixed(4)),
        "Total Loss (PHP)": Number(toNum(r["Total Loss (PHP)"]).toFixed(2)),
      };
    });
  }, [filteredImpacts, calReportPeriod, activeCalReportYear]);

  const CAL_REPORT_COLUMNS = [
    "Period",
    "Incidents",
    "Damaged Area (ha)",
    "Total Loss (PHP)",
  ];

  const exportCalamityCSV = () => {
    const rows = (calamityReportRows || []).map((r) => ({
      Period: r.Period,
      Incidents: r.Incidents,
      "Damaged Area (ha)": r["Damaged Area (ha)"],
      "Total Loss (PHP)": r["Total Loss (PHP)"],
    }));
    downloadCSV(rows, "Calamity_Report.csv", CAL_REPORT_COLUMNS);
  };

  const exportCalamityPDF = async () => {
    const rows = (calamityReportRows || []).map((r) => ({
      Period: r.Period,
      Incidents: r.Incidents,
      "Damaged Area (ha)": r["Damaged Area (ha)"],
      "Total Loss (PHP)": r["Total Loss (PHP)"],
    }));
    await downloadPDFGeneric(
      rows,
      "Calamity_Report.pdf",
      "Calamity Report",
      CAL_REPORT_COLUMNS
    );
  };

  /* ---------- Actions ---------- */
  const resetFilters = () => {
    setSelectedBarangay("all");
    setSelectedCrop("all");
    setSelectedYear("all");
    setMetric("count");

    setSelectedCalamityType("all");
    setSelectedCalamityCrop("all");

    setReportPeriod("quarterly");
    setCalReportPeriod("quarterly");
  };

  const exportTop5CSV = () => {
    if (!top5Barangays.length) return;
    const header = ["Barangay", "Crops", "Area (ha)"];
    const rows = top5Barangays.map((r) => [
      r.barangay,
      r.crops,
      Number(r.hectares).toFixed(2),
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    const yr = selectedYear === "all" ? "all-years" : selectedYear;
    const brgy =
      selectedBarangay === "all"
        ? "all-brgys"
        : selectedBarangay.replace(/\s+/g, "_");
    const crop =
      selectedCrop === "all" ? "all-crops" : selectedCrop.replace(/\s+/g, "_");

    a.href = url;
    a.download = `top5-barangays-${yr}-${brgy}-${crop}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportTop5PDF = async () => {
    if (!top5Barangays.length) return;

    const columns = ["Barangay", "Crops", "Area (ha)"];
    const rows = top5Barangays.map((r) => ({
      Barangay: r.barangay,
      Crops: Number(r.crops || 0),
      "Area (ha)": Number(Number(r.hectares || 0).toFixed(4)),
    }));

    const yr = selectedYear === "all" ? "all-years" : selectedYear;
    const brgy =
      selectedBarangay === "all"
        ? "all-brgys"
        : selectedBarangay.replace(/\s+/g, "_");
    const crop =
      selectedCrop === "all" ? "all-crops" : selectedCrop.replace(/\s+/g, "_");

    await downloadPDFGeneric(
      rows,
      `top5-barangays-${yr}-${brgy}-${crop}.pdf`,
      "Top Barangays by Planted Area",
      columns
    );
  };

  const buildReportRows = (periodType) => {
    const group = new Map();
    const topMap = new Map();

    for (const c of filtered) {
      const d = getPlantedDate(c);
      if (!d) continue;

      const year = d.getFullYear();
      const quarter = `Q${quarterOfDate(d)}`;

      let periodKey = "";
      let outQuarter = "";

      if (periodType === "quarterly") {
        periodKey = `${year}-${quarter}`;
        outQuarter = quarter;
      } else {
        periodKey = `${year}`;
        outQuarter = "";
      }

      const crop = getCropType(c);
      const variety = getVarietyName(c);

      const area = safeNum(getAreaHa(c));
      const estValue = safeNum(getEstimatedValuePHP(c));

      const key = `${periodKey}||${crop}||${variety}`;

      const rec =
        group.get(key) || {
          Year: year,
          Quarter: outQuarter,
          Crop: crop,
          Variety: variety,
          "Total Area (ha)": 0,
          "Number of Records": 0,
          "Top Variety": "",
          "Top Variety Area (ha)": 0,
          "Estimated Crop Value (PHP)": 0,
        };

      rec["Total Area (ha)"] += area;
      rec["Number of Records"] += 1;
      rec["Estimated Crop Value (PHP)"] += estValue;

      group.set(key, rec);

      const topKey = `${periodKey}||${crop}`;
      const vm = topMap.get(topKey) || new Map();
      vm.set(variety, (vm.get(variety) || 0) + area);
      topMap.set(topKey, vm);
    }

    const topByPeriodCrop = new Map();
    for (const [k, vm] of topMap.entries()) {
      let bestVar = "Unknown";
      let bestArea = 0;
      for (const [v, a] of vm.entries()) {
        if (a > bestArea) {
          bestArea = a;
          bestVar = v;
        }
      }
      topByPeriodCrop.set(k, { bestVar, bestArea });
    }

    const rows = Array.from(group.values()).map((r) => {
      const periodKey =
        periodType === "quarterly" ? `${r.Year}-${r.Quarter}` : `${r.Year}`;
      const topKey = `${periodKey}||${r.Crop}`;
      const best = topByPeriodCrop.get(topKey) || {
        bestVar: "Unknown",
        bestArea: 0,
      };

      return {
        ...r,
        "Top Variety": best.bestVar,
        "Top Variety Area (ha)": Number(best.bestArea.toFixed(4)),
        "Total Area (ha)": Number(r["Total Area (ha)"].toFixed(4)),
        "Estimated Crop Value (PHP)": Number(
          r["Estimated Crop Value (PHP)"].toFixed(2)
        ),
      };
    });

    const qNum = (q) => (q ? Number(String(q).replace("Q", "")) : 0);
    rows.sort((a, b) => {
      if (a.Year !== b.Year) return a.Year - b.Year;
      if (periodType === "quarterly") {
        const aq = qNum(a.Quarter);
        const bq = qNum(b.Quarter);
        if (aq !== bq) return aq - bq;
      }
      if (a.Crop !== b.Crop) return a.Crop.localeCompare(b.Crop);
      return a.Variety.localeCompare(b.Variety);
    });

    return rows.map((r) => {
      const out = {};
      REPORT_COLUMNS.forEach((c) => (out[c] = r[c] ?? ""));
      return out;
    });
  };

  const exportQuarterlyCSV = () =>
    downloadCSV(
      buildReportRows("quarterly"),
      "Crop_Report_Quarterly.csv",
      REPORT_COLUMNS
    );
  const exportQuarterlyPDF = async () =>
    await downloadPDFGeneric(
      buildReportRows("quarterly"),
      "Crop_Report_Quarterly.pdf",
      "Crop Report - Quarterly",
      REPORT_COLUMNS
    );

  const exportYearlyCSV = () =>
    downloadCSV(buildReportRows("yearly"), "Crop_Report_Yearly.csv", REPORT_COLUMNS);
  const exportYearlyPDF = async () =>
    await downloadPDFGeneric(
      buildReportRows("yearly"),
      "Crop_Report_Yearly.pdf",
      "Crop Report - Yearly",
      REPORT_COLUMNS
    );

  const exportAnnualCSV = () =>
    downloadCSV(
      buildReportRows("annual"),
      "Crop_Report_Annual.csv",
      REPORT_COLUMNS
    );
  const exportAnnualPDF = async () =>
    await downloadPDFGeneric(
      buildReportRows("annual"),
      "Crop_Report_Annual.pdf",
      "Crop Report - Annual",
      REPORT_COLUMNS
    );

  const exportSelectedCSV = () => {
    if (reportPeriod === "quarterly") return exportQuarterlyCSV();
    if (reportPeriod === "yearly") return exportYearlyCSV();
    return exportAnnualCSV();
  };

  const exportSelectedPDF = async () => {
    if (reportPeriod === "quarterly") return exportQuarterlyPDF();
    if (reportPeriod === "yearly") return exportYearlyPDF();
    return exportAnnualPDF();
  };

  const topVarTitle =
    metric === "area"
      ? "Top Crop Varieties by Area (ha)"
      : "Top Crop Varieties by Count";

  return (
    <div className="flex flex-col min-h-screen bg-white font-poppins">
      <SuperAdminNav onCollapsedChange={setSidebarCollapsed} />

      <main
        className={`ml-0 pt-8 md:pt-10 pr-0 md:pr-8 flex-1 transition-all duration-200 ${
          sidebarCollapsed ? "md:ml-[72px]" : "md:ml-64"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-[48vh]">
          {/* Title */}
          <div className="mb-4">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-green-700">
              Crops & Calamity Overview
            </h1>
            <p className="text-gray-600 mt-1">
              KPIs, charts, filters, and downloadable summarized reports.
            </p>
          </div>

          {/* Tabs */}
          <div className="mb-4 flex gap-2 flex-wrap">
            <TabButton active={tab === "crops"} onClick={() => setTab("crops")}>
              Crops
            </TabButton>
            <TabButton
              active={tab === "calamity"}
              onClick={() => setTab("calamity")}
            >
              Calamity
            </TabButton>
            <TabButton
              active={tab === "rankings"}
              onClick={() => setTab("rankings")}
            >
              Rankings
            </TabButton>

            <button
              onClick={resetFilters}
              className="ml-auto text-sm px-3 py-2 rounded-md border border-gray-300 hover:bg-gray-50"
            >
              Reset
            </button>
          </div>

          {/* Filter Bar */}
          <Card className="mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <FilterField label="Barangay">
                <select
                  className="w-full border rounded-md px-3 py-2"
                  value={selectedBarangay}
                  onChange={(e) => setSelectedBarangay(e.target.value)}
                >
                  {barangays.map((bg) => (
                    <option key={bg} value={bg}>
                      {bg === "all" ? "All" : bg}
                    </option>
                  ))}
                </select>
              </FilterField>

              <FilterField label="Year">
                <select
                  className="w-full border rounded-md px-3 py-2"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y === "all" ? "All" : y}
                    </option>
                  ))}
                </select>
              </FilterField>

              {/* CROPS TAB filters */}
              {tab === "crops" && (
                <>
                  <FilterField label="Crop">
                    <select
                      className="w-full border rounded-md px-3 py-2"
                      value={selectedCrop}
                      onChange={(e) => setSelectedCrop(e.target.value)}
                    >
                      {crops.map((c) => (
                        <option key={c} value={c}>
                          {c === "all" ? "All" : c}
                        </option>
                      ))}
                    </select>
                  </FilterField>

                  <FilterField label="Crop Metric">
                    <div className="inline-flex border rounded-md overflow-hidden">
                      <button
                        onClick={() => setMetric("count")}
                        className={`px-3 py-2 text-sm ${
                          metric === "count"
                            ? "bg-green-600 text-white"
                            : "bg-white text-gray-700"
                        }`}
                      >
                        Count
                      </button>
                      <button
                        onClick={() => setMetric("area")}
                        className={`px-3 py-2 text-sm ${
                          metric === "area"
                            ? "bg-green-600 text-white"
                            : "bg-white text-gray-700"
                        }`}
                      >
                        Area (ha)
                      </button>
                    </div>
                  </FilterField>
                </>
              )}

              {/* CALAMITY TAB filters (NO metric buttons, crop-type only) */}
              {tab === "calamity" && (
                <>
                  <FilterField label="Calamity Type">
                    <select
                      className="w-full border rounded-md px-3 py-2"
                      value={selectedCalamityType}
                      onChange={(e) => setSelectedCalamityType(e.target.value)}
                    >
                      {calamityTypes.map((t) => (
                        <option key={t} value={t}>
                          {t === "all" ? "All" : t}
                        </option>
                      ))}
                    </select>
                  </FilterField>

                  <FilterField label="Crop Filter (Type only)">
                    <select
                      className="w-full border rounded-md px-3 py-2"
                      value={selectedCalamityCrop}
                      onChange={(e) => setSelectedCalamityCrop(e.target.value)}
                    >
                      {calamityCrops.map((c) => (
                        <option key={c} value={c}>
                          {c === "all" ? "All" : c}
                        </option>
                      ))}
                    </select>
                  </FilterField>

                  <div className="lg:col-span-2 text-xs text-gray-500 flex items-center">
                    Source: <b className="ml-1">{API_BASE}/api/impacts</b>
                    {calLoading ? " • Loading..." : ` • Rows: ${impacts.length}`}
                  </div>
                </>
              )}
            </div>
          </Card>

          {/* ===================== CROPS TAB ===================== */}
          {tab === "crops" && (
            <>
              <Section title="Key Metrics">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                  <Kpi
                    title="Total Crops"
                    value={fmt(totalCrops, { maximumFractionDigits: 0 })}
                    subtitle={
                      selectedBarangay === "all" ? "All barangays" : selectedBarangay
                    }
                  />
                  <Kpi title="Most Planted Crops" value={mostPlanted} subtitle="by count" />
                  <Kpi title="Most Planted Barangay" value={topBarangay} subtitle="by count" />
                  <Kpi
                    title="Mapped Area"
                    value={`${fmt(totalHectares)} ha`}
                    subtitle={`Avg / crop: ${fmt(avgArea)} ha`}
                  />
                </div>
              </Section>

              <Section title="Estimated Crop Value (₱)">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <Card className="lg:col-span-1">
                    <CardTitle>Value Snapshot</CardTitle>
                    <div className="grid grid-cols-1 gap-3">
                      <Kpi
                        title="Total Estimated Value"
                        value={fmtPHP(totalEstimatedValue)}
                        subtitle="expected yield × price"
                      />
                      <Kpi
                        title="Avg Value per Record"
                        value={fmtPHP(avgEstimatedValue)}
                        subtitle="average across filtered records"
                      />
                      <Kpi
                        title="Top Crop by Value"
                        value={topCropByValue}
                        subtitle="highest total ₱"
                      />
                      <div className="text-xs text-gray-500 mt-2">
                        If DB has no yield/price fields, it uses defaults.
                      </div>
                    </div>
                  </Card>

                  <Card className="lg:col-span-2">
                    <CardTitle>Estimated Value by Crop</CardTitle>

                    {loading ? (
                      <ChartSkeleton />
                    ) : !hasValueData ? (
                      <EmptyChart message="No estimated value available." />
                    ) : (
                      <div className="h-[320px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={valueByCropData}
                            margin={{ top: 10, right: 16, left: 0, bottom: 10 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                            <XAxis dataKey="crop_type" tickMargin={8} />
                            <YAxis tickFormatter={(v) => fmtPHP(v)} />
                            <Tooltip
                              formatter={(value) => fmtPHP(value)}
                              labelFormatter={(label) => `Crop: ${label}`}
                            />
                            <Bar dataKey="totalValue" radius={[6, 6, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    <CardFooter>
                      {selectedYear !== "all" ? `Year: ${selectedYear}` : "All years"}
                      {selectedBarangay !== "all" ? ` • Barangay: ${selectedBarangay}` : ""}
                      {selectedCrop !== "all" ? ` • Crop: ${selectedCrop}` : ""}
                    </CardFooter>
                  </Card>
                </div>
              </Section>

              <Section title="Distribution and Varieties & Crop Leaders">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardTitle>Distribution</CardTitle>

                    {loading ? (
                      <ChartSkeleton />
                    ) : chartData.length === 0 ? (
                      <EmptyChart message="No data for this filter." />
                    ) : (
                      <div className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={chartData}
                              dataKey="total"
                              nameKey="crop_type"
                              cx="50%"
                              cy="50%"
                              innerRadius={55}
                              outerRadius={90}
                              paddingAngle={2}
                              labelLine={false}
                              label={({ name, percent }) =>
                                `${name} ${(percent * 100).toFixed(0)}%`
                              }
                            >
                              {chartData.map((d, i) => (
                                <Cell
                                  key={i}
                                  fill={
                                    COLOR_BY_CROP[d.crop_type] ||
                                    FALLBACK_COLORS[i % FALLBACK_COLORS.length]
                                  }
                                />
                              ))}
                            </Pie>
                            <Tooltip
                              content={<NiceTooltip suffix={metric === "area" ? " ha" : ""} />}
                            />
                            <Legend verticalAlign="bottom" height={36} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    <CardFooter>
                      Metric: {metric === "area" ? "Area" : "Count"}
                    </CardFooter>
                  </Card>

                  <Card>
                    <CardTitle>Varieties & Crop Leaders</CardTitle>

                    <div className="mb-6">
                      <div className="text-sm font-semibold text-gray-700 mb-2">
                        {topVarTitle}
                      </div>

                      {loading ? (
                        <ChartSkeleton />
                      ) : topVarietiesData.length === 0 ? (
                        <EmptyChart message="No variety data for this filter." />
                      ) : (
                        <div className="h-[280px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={topVarietiesData}
                              margin={{ top: 8, right: 16, left: 0, bottom: 24 }}
                            >
                              <XAxis
                                dataKey="variety"
                                interval={0}
                                tickMargin={10}
                                angle={-20}
                                textAnchor="end"
                                height={60}
                              />
                              <YAxis
                                tickFormatter={(v) =>
                                  metric === "area"
                                    ? fmt(v)
                                    : fmt(v, { maximumFractionDigits: 0 })
                                }
                              />
                              <Tooltip
                                content={<NiceTooltip suffix={metric === "area" ? " ha" : ""} />}
                              />
                              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                                {topVarietiesData.map((_, i) => (
                                  <Cell
                                    key={i}
                                    fill={FALLBACK_COLORS[i % FALLBACK_COLORS.length]}
                                  />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="text-sm font-semibold text-gray-700 mb-2">
                        Crop → Top Variety Summary
                      </div>

                      {loading ? (
                        <ChartSkeleton />
                      ) : cropTopVarietyTable.length === 0 ? (
                        <EmptyChart message="No crop/variety summary for this filter." />
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-sm">
                            <thead>
                              <tr className="text-left text-gray-600 border-b">
                                <th className="py-2 pr-4">Crop</th>
                                <th className="py-2 pr-4">Total Area (ha)</th>
                                <th className="py-2 pr-4"># Records</th>
                                <th className="py-2 pr-4">Top Variety</th>
                                <th className="py-2 pr-4">Top Variety Area (ha)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {cropTopVarietyTable.map((r) => (
                                <tr
                                  key={r.crop}
                                  className="border-b last:border-0 hover:bg-gray-50/60"
                                >
                                  <td className="py-2 pr-4">{r.crop}</td>
                                  <td className="py-2 pr-4">{fmt(r.totalArea)} ha</td>
                                  <td className="py-2 pr-4">
                                    {fmt(r.records, { maximumFractionDigits: 0 })}
                                  </td>
                                  <td className="py-2 pr-4">{r.topVariety}</td>
                                  <td className="py-2 pr-4">{fmt(r.topVarietyArea)} ha</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </Card>
                </div>
              </Section>

              <Section title="Crops Report (Quarterly / Yearly / Annual)">
                <Card>
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
                    <div>
                      <div className="text-base font-semibold text-gray-800">
                        Report Period
                      </div>
                      <div className="text-sm text-gray-500">
                        Metric: {metric === "area" ? "Area (ha)" : "Count"} • Export
                        includes “Estimated Crop Value (PHP)”.
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <div className="inline-flex border rounded-md overflow-hidden">
                        <button
                          onClick={() => setReportPeriod("quarterly")}
                          className={`px-3 py-2 text-sm ${
                            reportPeriod === "quarterly"
                              ? "bg-green-600 text-white"
                              : "bg-white text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          Quarterly
                        </button>
                        <button
                          onClick={() => setReportPeriod("yearly")}
                          className={`px-3 py-2 text-sm ${
                            reportPeriod === "yearly"
                              ? "bg-green-600 text-white"
                              : "bg-white text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          Yearly
                        </button>
                        <button
                          onClick={() => setReportPeriod("annually")}
                          className={`px-3 py-2 text-sm ${
                            reportPeriod === "annually"
                              ? "bg-green-600 text-white"
                              : "bg-white text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          Annual
                        </button>
                      </div>

                      <button
                        onClick={exportSelectedCSV}
                        disabled={!filtered.length}
                        className="px-3 py-2 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Download CSV
                      </button>

                      <button
                        onClick={exportSelectedPDF}
                        disabled={!filtered.length}
                        className="px-3 py-2 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Download PDF
                      </button>
                    </div>
                  </div>

                  {!cropReportData.length ? (
                    <EmptyChart message="No crop report data for this filter." />
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={cropReportData}
                            margin={{ top: 10, right: 16, left: 0, bottom: 10 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                            <XAxis dataKey="label" tickMargin={8} />
                            <YAxis tickFormatter={(v) => fmt(v)} />
                            <Tooltip
                              content={<NiceTooltip suffix={metric === "area" ? " ha" : ""} />}
                            />
                            <Bar dataKey="total" radius={[6, 6, 0, 0]} fill="#16A34A" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="text-left text-gray-600 border-b">
                              <th className="py-2 pr-4">Period</th>
                              <th className="py-2 pr-4">
                                {metric === "area" ? "Area (ha)" : "Count"}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {cropReportData.map((r) => (
                              <tr
                                key={r.key}
                                className="border-b last:border-0 hover:bg-gray-50/60"
                              >
                                <td className="py-2 pr-4">{r.label}</td>
                                <td className="py-2 pr-4">
                                  {metric === "area"
                                    ? `${fmt(r.total)} ha`
                                    : fmt(r.total, { maximumFractionDigits: 0 })}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </Card>
              </Section>
            </>
          )}

          {/* ===================== CALAMITY TAB ===================== */}
          {tab === "calamity" && (
            <>
              <Section title="Key Metrics (from tbl_calamity_crop_impacts)">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                  <Kpi
                    title="Total Damaged Area"
                    value={`${fmt(calSummary.totalAffectedArea)} ha`}
                    subtitle={selectedBarangay === "all" ? "All barangays" : selectedBarangay}
                  />
                  <Kpi title="Total Loss Value" value={fmtPHP(calSummary.totalLossValue)} />
                  <Kpi
                    title="Affected Crops"
                    value={fmt(calSummary.affectedCrops, { maximumFractionDigits: 0 })}
                  />
                  <Kpi
                    title="Impact Records"
                    value={fmt(filteredImpacts.length, { maximumFractionDigits: 0 })}
                  />
                </div>

                <div className="mt-3 text-xs text-gray-500">
                  Data source: <b>GET {API_BASE}/api/impacts</b> (tbl_calamity_crop_impacts)
                  {calLoading ? " • Loading..." : ` • Loaded rows: ${impacts.length}`}
                  {selectedCalamityCrop !== "all" ? ` • Crop: ${selectedCalamityCrop}` : ""}
                </div>
              </Section>

              <Section title="By Calamity Type (Damaged Area)">
                <Card>
                  {calLoading ? (
                    <ChartSkeleton />
                  ) : (
                    <div className="h-[260px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={calamityByTypeChart}
                          margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                          <XAxis dataKey="type" tickMargin={8} />
                          <YAxis tickFormatter={(v) => fmt(v)} />
                          <Tooltip content={<NiceTooltip suffix=" ha" />} />
                          <Bar dataKey="area" radius={[6, 6, 0, 0]}>
                            {calamityByTypeChart.map((_, i) => (
                              <Cell
                                key={i}
                                fill={CALAMITY_COLORS[i % CALAMITY_COLORS.length]}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  <CardFooter>
                    {selectedYear !== "all" ? `Year: ${selectedYear}` : "All years"}
                    {selectedBarangay !== "all" ? ` • Barangay: ${selectedBarangay}` : ""}
                    {selectedCalamityType !== "all" ? ` • Type: ${selectedCalamityType}` : ""}
                    {selectedCalamityCrop !== "all" ? ` • Crop: ${selectedCalamityCrop}` : ""}
                  </CardFooter>
                </Card>
              </Section>

              {/* ✅ Requested: Quarterly / Yearly / Annual + Download CSV/PDF (Calamity) */}
              <Section title="Calamity Report (Quarterly / Yearly / Annual)">
                <Card>
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
                    <div>
                      <div className="text-base font-semibold text-gray-800">
                        Report Period
                      </div>
                      <div className="text-sm text-gray-500">
                        Includes: Incidents, Damaged Area (ha), Total Loss (PHP)
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <div className="inline-flex border rounded-md overflow-hidden">
                        <button
                          onClick={() => setCalReportPeriod("quarterly")}
                          className={`px-3 py-2 text-sm ${
                            calReportPeriod === "quarterly"
                              ? "bg-green-600 text-white"
                              : "bg-white text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          Quarterly
                        </button>
                        <button
                          onClick={() => setCalReportPeriod("yearly")}
                          className={`px-3 py-2 text-sm ${
                            calReportPeriod === "yearly"
                              ? "bg-green-600 text-white"
                              : "bg-white text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          Yearly
                        </button>
                        <button
                          onClick={() => setCalReportPeriod("annually")}
                          className={`px-3 py-2 text-sm ${
                            calReportPeriod === "annually"
                              ? "bg-green-600 text-white"
                              : "bg-white text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          Annual
                        </button>
                      </div>

                      <button
                        onClick={exportCalamityCSV}
                        disabled={!calamityReportRows.length}
                        className="px-3 py-2 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Download CSV
                      </button>

                      <button
                        onClick={exportCalamityPDF}
                        disabled={!calamityReportRows.length}
                        className="px-3 py-2 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Download PDF
                      </button>
                    </div>
                  </div>

                  {!calamityReportRows.length ? (
                    <EmptyChart message="No calamity report data for this filter." />
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={calamityReportRows}
                            margin={{ top: 10, right: 16, left: 0, bottom: 10 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                            <XAxis dataKey="Period" tickMargin={8} />
                            <YAxis tickFormatter={(v) => fmt(v)} />
                            <Tooltip
                              content={({ active, payload, label }) => {
                                if (!active || !payload?.length) return null;
                                const row = payload[0].payload;
                                return (
                                  <div className="rounded-md border border-gray-200 bg-white px-3 py-2 shadow-sm">
                                    <div className="text-sm font-medium text-gray-900">
                                      {label}
                                    </div>
                                    <div className="text-sm text-gray-700">
                                      Incidents:{" "}
                                      <b>{fmt(row.Incidents, { maximumFractionDigits: 0 })}</b>
                                    </div>
                                    <div className="text-sm text-gray-700">
                                      Damaged Area: <b>{fmt(row["Damaged Area (ha)"])} ha</b>
                                    </div>
                                    <div className="text-sm text-gray-700">
                                      Total Loss: <b>{fmtPHP(row["Total Loss (PHP)"])}</b>
                                    </div>
                                  </div>
                                );
                              }}
                            />
                            <Legend />
                            <Line type="monotone" dataKey="Incidents" dot={false} />
                            <Line type="monotone" dataKey="Damaged Area (ha)" dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="text-left text-gray-600 border-b">
                              <th className="py-2 pr-4">Period</th>
                              <th className="py-2 pr-4">Incidents</th>
                              <th className="py-2 pr-4">Damaged Area (ha)</th>
                              <th className="py-2 pr-4">Total Loss (PHP)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {calamityReportRows.map((r) => (
                              <tr
                                key={r.key}
                                className="border-b last:border-0 hover:bg-gray-50/60"
                              >
                                <td className="py-2 pr-4">{r.Period}</td>
                                <td className="py-2 pr-4">
                                  {fmt(r.Incidents, { maximumFractionDigits: 0 })}
                                </td>
                                <td className="py-2 pr-4">
                                  {fmt(r["Damaged Area (ha)"])} ha
                                </td>
                                <td className="py-2 pr-4">{fmtPHP(r["Total Loss (PHP)"])}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </Card>
              </Section>
            </>
          )}

          {/* ===================== RANKINGS TAB ===================== */}
          {tab === "rankings" && (
            <Section title="Top Barangays by Planted Area">
              <div className="flex items-center justify-between mb-3 text-sm text-gray-500">
                <div>
                  {selectedYear !== "all" ? `Year: ${selectedYear}` : "All years"}
                  {selectedCrop !== "all" ? ` • Crop: ${selectedCrop}` : ""}
                  {selectedBarangay !== "all" ? ` • Barangay: ${selectedBarangay}` : ""}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={exportTop5CSV}
                    disabled={!top5Barangays.length}
                    className="px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Download CSV
                  </button>

                  <button
                    onClick={exportTop5PDF}
                    disabled={!top5Barangays.length}
                    className="px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Download PDF
                  </button>
                </div>
              </div>

              <Card>
                {!top5Barangays.length ? (
                  <EmptyChart message="No data for this filter." />
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="text-left text-gray-600 border-b">
                            <th className="py-2 pr-4">Barangay</th>
                            <th className="py-2 pr-4">Crops</th>
                            <th className="py-2 pr-4">Area (ha)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {top5Barangays.map((r) => (
                            <tr
                              key={r.barangay}
                              className="border-b last:border-0 hover:bg-gray-50/60"
                            >
                              <td className="py-2 pr-4">{r.barangay}</td>
                              <td className="py-2 pr-4">
                                {fmt(r.crops, { maximumFractionDigits: 0 })}
                              </td>
                              <td className="py-2 pr-4">{fmt(r.hectares)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="h-64 mt-6">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={top5Barangays}
                          layout="vertical"
                          margin={{ top: 10, right: 16, left: 0, bottom: 8 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                          <XAxis type="number" tickFormatter={(v) => fmt(v)} />
                          <YAxis type="category" dataKey="barangay" width={120} />
                          <Tooltip content={<NiceTooltip suffix=" ha" />} />
                          <Bar dataKey="hectares" radius={[0, 6, 6, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </>
                )}
              </Card>
            </Section>
          )}
        </div>
      </main>

      <FooterWrapper sidebarCollapsed={sidebarCollapsed} />
    </div>
  );
}

export default Graphs;

/* ---------- UI bits ---------- */
function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 text-sm rounded-md border ${
        active
          ? "border-green-600 text-green-700 bg-green-50"
          : "border-gray-300 text-gray-700 hover:bg-gray-50"
      }`}
    >
      {children}
    </button>
  );
}
function FilterField({ label, children }) {
  return (
    <div>
      <label className="block text-sm text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}
function Section({ title, children }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-gray-800 mb-3">{title}</h2>
      {children}
    </section>
  );
}
function Kpi({ title, value, subtitle }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm h-full min-h-[110px]">
      <div className="text-sm text-gray-600">{title}</div>
      <div className="mt-1 text-3xl font-semibold text-gray-900">{value}</div>
      {subtitle && <div className="text-sm text-gray-500 mt-1">{subtitle}</div>}
    </div>
  );
}
function Card({ children, className = "" }) {
  return (
    <div
      className={`rounded-xl border border-gray-200 bg-white p-5 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}
function CardTitle({ children }) {
  return (
    <h3 className="text-base font-semibold text-gray-800 mb-3">{children}</h3>
  );
}
function CardFooter({ children }) {
  return <div className="mt-2 text-xs text-gray-500">{children}</div>;
}
function EmptyChart({ message }) {
  return (
    <div className="h-[220px] flex items-center justify-center text-gray-500 text-sm border border-dashed border-gray-300 rounded-lg">
      {message}
    </div>
  );
}
function ChartSkeleton() {
  return <div className="h-[220px] animate-pulse rounded-lg bg-gray-100" />;
}
function NiceTooltip({ active, payload, label, suffix = "" }) {
  if (!active || !payload?.length) return null;
  const val = payload[0].value;
  return (
    <div className="rounded-md border border-gray-200 bg-white px-3 py-2 shadow-sm">
      {label && <div className="text-sm font-medium text-gray-900">{label}</div>}
      <div className="text-sm text-gray-700">
        {fmt(val)}
        {suffix}
      </div>
    </div>
  );
}
function FooterWrapper({ sidebarCollapsed }) {
  return (
    <div
      className={`mt-10 ml-0 border-t border-gray-100 transition-all duration-200 ${
        sidebarCollapsed ? "md:ml-[72px]" : "md:ml-64"
      }`}
    >
      <Footer />
    </div>
  );
}
