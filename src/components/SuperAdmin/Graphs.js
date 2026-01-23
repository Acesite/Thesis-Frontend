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

const fmt = (n, opts = {}) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: 2, ...opts }).format(
    n
  );

/* ---------- Safe field getters ---------- */
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

/* ---------- CSV/report helpers (aggregated, no GPS, no personal data) ---------- */
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
  (c.crop_name || c.crop_type || "Unknown").trim() || "Unknown";

// Variety + Area helpers (safe)
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

// Location defaults (AgriGIS context). If your DB has these fields, it uses them.
// NOTE: No GPS coordinates are exported.
const getRegion = (c) => (c.region || c.region_name || "VI").trim();
const getProvince = (c) =>
  (c.province || c.province_name || "Negros Occidental").trim();
const getMunicipality = (c) =>
  (c.municipality || c.city || c.municipality_name || "Bago City").trim();

// Yield (optional in your DB): uses any available field; otherwise 0
const getExpectedYield = (c) =>
  toNum(
    c.total_expected_yield ??
      c.expected_yield ??
      c.expected_yield_kg ??
      c.estimated_yield ??
      c.yield_estimate ??
      0
  );

// Estimated harvest (optional): format as "Mon YYYY" or as a range
const getEstimatedHarvestDate = (c) => {
  const v =
    c.estimated_harvest ||
    c.expected_harvest_date ||
    c.harvest_date ||
    c.date_harvest ||
    c.harvest_at ||
    null;
  const d = v ? new Date(v) : null;
  return d && !isNaN(d.getTime()) ? d : null;
};

const formatHarvest = (d) =>
  d ? `${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}` : "";

/* ---------------- NEW: Period-specific Crop Report Export (CSV + XLSX) ---------------- */
/**
 * Output requirements supported:
 * - 3 distinct files (Quarterly / Yearly / Annual)
 * - Each file downloadable as CSV and XLSX
 * - Consistent column names across all files
 * - Aggregation:
 *   Quarterly: Year + Quarter
 *   Yearly: Year (year totals)
 *   Annual: Year (consolidated summary per year; same grouping as Yearly but separate file)
 * - Included fields:
 *   Crop, Variety, Total Area (ha) SUM(area_ha), Number of Records COUNT(*),
 *   Top Variety (by total area) per Crop+Period, Top Variety Area (ha)
 */
const REPORT_COLUMNS = [
  "Year",
  "Quarter",
  "Crop",
  "Variety",
  "Total Area (ha)",
  "Number of Records",
  "Top Variety",
  "Top Variety Area (ha)",
];

const safeNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const quarterOfDate = (d) => Math.floor(d.getMonth() / 3) + 1;

const downloadCSV = (rows, filename) => {
  if (!rows?.length) return;

  const header = REPORT_COLUMNS;

  const csv = [header, ...rows.map((r) => header.map((h) => r[h] ?? ""))]
    .map((row) =>
      row.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(",")
    )
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

  // Optional: widen columns a bit
  ws["!cols"] = REPORT_COLUMNS.map((c) => ({
    wch: Math.max(14, c.length + 2),
  }));

  XLSX.writeFile(wb, filename);
};

function Graphs() {
  /* ---------- Page/scroll stability so footer doesn't jump ---------- */
  useEffect(() => {
    const root = document.documentElement;
    const prev = root.style.overflowY;
    root.style.overflowY = "scroll";
    return () => {
      root.style.overflowY = prev;
    };
  }, []);

  /* ---------- Data ---------- */
  const [allCrops, setAllCrops] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    axios
      .get("http://localhost:5000/api/managecrops")
      .then((res) => setAllCrops(res.data || []))
      .catch((err) => console.error("Failed to fetch crops:", err))
      .finally(() => setLoading(false));
  }, []);

  /* ---------- Calamity API ---------- */
  const [calLoading, setCalLoading] = useState(false);
  const [calSummary, setCalSummary] = useState({
    totalAffectedArea: 0,
    affectedFarmers: 0,
    byType: [],
  });
  const [calTimeline, setCalTimeline] = useState([]);

  /* ---------- Filters ---------- */
  const [selectedBarangay, setSelectedBarangay] = useState("all");
  const [selectedCrop, setSelectedCrop] = useState("all");
  const [selectedYear, setSelectedYear] = useState("all");
  const [metric, setMetric] = useState("count"); // crops: 'count' | 'area'

  const [calMetric, setCalMetric] = useState("area"); // calamity: 'area' | 'incidents'
  const [selectedCalamityType, setSelectedCalamityType] = useState("all");

  const [tab, setTab] = useState("crops"); // 'crops' | 'calamity' | 'rankings'

  // sidebar collapsed state for SuperAdminNav
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  /* ---------- Crops Report Period ---------- */
  // This remains for on-screen chart/table only; exports are now separate buttons/files.
  const [reportPeriod, setReportPeriod] = useState("quarterly"); // 'quarterly' | 'yearly' | 'annually'

  /* ---------- Options ---------- */
  const barangays = useMemo(() => {
    const set = new Set(
      allCrops
        .map((c) => getBarangayName(c))
        .filter((b) => b && b !== "Unknown")
    );
    return ["all", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [allCrops]);

  const crops = useMemo(() => {
    const set = new Set(
      allCrops.map((c) => (c.crop_name || "").trim()).filter(Boolean)
    );
    return ["all", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [allCrops]);

  const years = useMemo(() => {
    const set = new Set();
    for (const c of allCrops) {
      const d = getPlantedDate(c);
      if (d) set.add(d.getFullYear());
    }
    const list = Array.from(set).sort((a, b) => b - a);
    return ["all", ...list];
  }, [allCrops]);

  /* ---------- Filtered crops ---------- */
  const filtered = useMemo(() => {
    return allCrops.filter((c) => {
      if (
        selectedBarangay !== "all" &&
        getBarangayName(c) !== selectedBarangay
      )
        return false;
      if (selectedCrop !== "all" && getCropType(c) !== selectedCrop)
        return false;

      const d = getPlantedDate(c);
      if (selectedYear !== "all") {
        if (!d) return false;
        if (d.getFullYear() !== Number(selectedYear)) return false;
      }
      return true;
    });
  }, [allCrops, selectedBarangay, selectedCrop, selectedYear]);

  const totalCrops = filtered.length;

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

  /* ---------- Visual — Top 5–10 Varieties ---------- */
  const TOP_VARIETY_LIMIT = 10;

  const topVarietiesData = useMemo(() => {
    const map = new Map(); // variety -> { variety, area, count }

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

  /* ---------- Table — Crop → Top Variety Summary ---------- */
  const cropTopVarietyTable = useMemo(() => {
    const cropMap = new Map(); // crop -> summary

    for (const c of filtered) {
      const crop = getCropType(c);
      const area = getAreaHa(c);
      const variety = getVarietyName(c);

      const rec =
        cropMap.get(crop) || {
          crop,
          totalArea: 0,
          records: 0,
          varietyArea: new Map(), // variety -> totalArea
        };

      rec.totalArea += area;
      rec.records += 1;

      if (variety && variety !== "Unknown") {
        rec.varietyArea.set(
          variety,
          (rec.varietyArea.get(variety) || 0) + area
        );
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

  /* ---------- On-screen report (existing) ---------- */
  const activeReportYear = useMemo(() => {
    if (selectedYear !== "all") return Number(selectedYear);
    const latest = years.find((y) => y !== "all");
    return Number(latest || new Date().getFullYear());
  }, [selectedYear, years]);

  const cropReportData = useMemo(() => {
    const getVal = (c) => (metric === "area" ? getAreaHa(c) : 1);

    if (reportPeriod === "annually") {
      const map = new Map(); // year -> total
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

        const q = Math.floor(d.getMonth() / 3) + 1; // 1..4
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

  /* ---------- Calamity calls ---------- */
  useEffect(() => {
    setCalLoading(true);
    const params = {};
    if (selectedBarangay !== "all") params.barangay = selectedBarangay;
    if (selectedYear !== "all") params.year = selectedYear;
    axios
      .get("http://localhost:5000/api/graphs/calamity/summary", { params })
      .then((res) =>
        setCalSummary(
          res.data || { totalAffectedArea: 0, affectedFarmers: 0, byType: [] }
        )
      )
      .catch(() =>
        setCalSummary({ totalAffectedArea: 0, affectedFarmers: 0, byType: [] })
      )
      .finally(() => setCalLoading(false));
  }, [selectedBarangay, selectedYear]);

  useEffect(() => {
    const params = {};
    if (selectedBarangay !== "all") params.barangay = selectedBarangay;
    if (selectedYear !== "all") params.year = selectedYear;
    if (selectedCalamityType !== "all") params.type = selectedCalamityType;
    axios
      .get("http://localhost:5000/api/graphs/calamity/timeline", { params })
      .then((res) => setCalTimeline(Array.isArray(res.data) ? res.data : []))
      .catch(() => setCalTimeline([]));
  }, [selectedBarangay, selectedYear, selectedCalamityType]);

  const calamityTypes = useMemo(() => {
    const set = new Set(
      (calSummary.byType || []).map((t) => t.calamity_type || "Unknown")
    );
    return ["all", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [calSummary]);

  const calamityByTypeChart = useMemo(() => {
    return (calSummary.byType || [])
      .filter(
        (r) =>
          selectedCalamityType === "all" ||
          (r.calamity_type || "Unknown") === selectedCalamityType
      )
      .map((r) => ({
        type: r.calamity_type || "Unknown",
        area: Number(r.total_area || 0),
        incidents: Number(r.incidents || 0),
      }));
  }, [calSummary, selectedCalamityType]);

  const monthsOfYear = (y) =>
    Array.from({ length: 12 }, (_, i) =>
      `${y}-${String(i + 1).padStart(2, "0")}`
    );

  const last12Months = () => {
    const out = [];
    const d = new Date();
    for (let i = 11; i >= 0; i--) {
      const dt = new Date(d.getFullYear(), d.getMonth() - i, 1);
      out.push(
        `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`
      );
    }
    return out;
  };

  const calamityTimelineFilled = useMemo(() => {
    const idx = new Map((calTimeline || []).map((r) => [String(r.month), r]));
    const months =
      selectedYear === "all" ? last12Months() : monthsOfYear(Number(selectedYear));
    return months.map((m) => {
      const row = idx.get(m);
      return {
        month: m,
        incidents: Number(row?.incidents || 0),
        area: Number(row?.area || 0),
      };
    });
  }, [calTimeline, selectedYear]);

  /* ---------- Actions ---------- */
  const resetFilters = () => {
    setSelectedBarangay("all");
    setSelectedCrop("all");
    setSelectedYear("all");
    setMetric("count");
    setCalMetric("area");
    setSelectedCalamityType("all");
    setReportPeriod("quarterly");
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

  /* ---------- NEW: Build period-specific report rows ---------- */
  const buildReportRows = (periodType) => {
    // Group by: Period + Crop + Variety
    const group = new Map(); // key: periodKey||crop||variety -> agg
    // For Top Variety: Period + Crop -> Map(variety -> area)
    const topMap = new Map(); // key: periodKey||crop -> Map

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
        // Yearly and Annual are both per year (separate files; same grouping)
        periodKey = `${year}`;
        outQuarter = "";
      }

      const crop = getCropType(c);
      const variety = getVarietyName(c);
      const area = safeNum(getAreaHa(c));

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
        };

      rec["Total Area (ha)"] += area;
      rec["Number of Records"] += 1;
      group.set(key, rec);

      const topKey = `${periodKey}||${crop}`;
      const vm = topMap.get(topKey) || new Map();
      vm.set(variety, (vm.get(variety) || 0) + area);
      topMap.set(topKey, vm);
    }

    // Compute top variety for each Period+Crop
    const topByPeriodCrop = new Map(); // key -> {variety, area}
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

    // Attach top variety fields
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
      };
    });

    // Sort: Year asc, Quarter Q1..Q4, Crop, Variety
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

    // Ensure all columns exist
    return rows.map((r) => {
      const out = {};
      REPORT_COLUMNS.forEach((c) => (out[c] = r[c] ?? ""));
      return out;
    });
  };

  /* ---------- NEW: Export 3 distinct files (CSV and XLSX) ---------- */
  const exportQuarterlyCSV = () => {
    const rows = buildReportRows("quarterly");
    downloadCSV(rows, "Crop_Report_Quarterly.csv");
  };
  const exportQuarterlyXLSX = () => {
    const rows = buildReportRows("quarterly");
    downloadXLSX(rows, "Crop_Report_Quarterly.xlsx");
  };

  const exportYearlyCSV = () => {
    const rows = buildReportRows("yearly");
    downloadCSV(rows, "Crop_Report_Yearly.csv");
  };
  const exportYearlyXLSX = () => {
    const rows = buildReportRows("yearly");
    downloadXLSX(rows, "Crop_Report_Yearly.xlsx");
  };

  const exportAnnualCSV = () => {
    const rows = buildReportRows("annual");
    downloadCSV(rows, "Crop_Report_Annual.csv");
  };
  const exportAnnualXLSX = () => {
    const rows = buildReportRows("annual");
    downloadXLSX(rows, "Crop_Report_Annual.xlsx");
  };

  /* ---------- Render ---------- */
  const valueLabel = metric === "area" ? "Hectares" : "Total";
  const suffix = metric === "area" ? " ha" : "";
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
              Simple, clear snapshots with filters, KPIs, charts, and downloadable
              summarized reports.
            </p>
          </div>

          {/* Tabs */}
          <div className="mb-4 flex gap-2">
            <TabButton active={tab === "crops"} onClick={() => setTab("crops")}>
              Crops
            </TabButton>
            <TabButton active={tab === "calamity"} onClick={() => setTab("calamity")}>
              Calamity
            </TabButton>
            <TabButton active={tab === "rankings"} onClick={() => setTab("rankings")}>
              Rankings
            </TabButton>
            <button
              onClick={resetFilters}
              className="ml-auto text-sm px-3 py-2 rounded-md border border-gray-300 hover:bg-gray-50"
            >
              Reset
            </button>
          </div>

          {/* Filter Bar (adapts to tab) */}
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

              {tab === "calamity" && (
                <>
                  <FilterField label="Calamity Metric">
                    <div className="inline-flex border rounded-md overflow-hidden">
                      <button
                        onClick={() => setCalMetric("area")}
                        className={`px-3 py-2 text-sm ${
                          calMetric === "area"
                            ? "bg-green-600 text-white"
                            : "bg-white text-gray-700"
                        }`}
                      >
                        Area (ha)
                      </button>
                      <button
                        onClick={() => setCalMetric("incidents")}
                        className={`px-3 py-2 text-sm ${
                          calMetric === "incidents"
                            ? "bg-green-600 text-white"
                            : "bg-white text-gray-700"
                        }`}
                      >
                        Incidents
                      </button>
                    </div>
                  </FilterField>

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
                </>
              )}
            </div>
          </Card>

          {/* CROPS TAB */}
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

              {/* ✅ Distribution + Varieties & Crop Leaders side-by-side */}
              <Section title="Distribution and Varieties & Crop Leaders">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* LEFT: Distribution (Pie only) */}
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
                            <Tooltip content={<NiceTooltip suffix={suffix} />} />
                            <Legend verticalAlign="bottom" height={36} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    <CardFooter>Metric: {valueLabel}</CardFooter>
                  </Card>

                  {/* RIGHT: Varieties & Crop Leaders */}
                  <Card>
                    <CardTitle>Varieties & Crop Leaders</CardTitle>

                    {/* Variety bar */}
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
                                label={{
                                  value: metric === "area" ? "Area (ha)" : "Count",
                                  angle: -90,
                                  position: "insideLeft",
                                }}
                              />
                              <Tooltip
                                content={
                                  <NiceTooltip suffix={metric === "area" ? " ha" : ""} />
                                }
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

                      <div className="mt-2 text-xs text-gray-500">
                        Showing top {TOP_VARIETY_LIMIT} varieties by{" "}
                        {metric === "area" ? "Area (ha)" : "Count"}.
                      </div>
                    </div>

                    {/* Crop → Top Variety table */}
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
                          <div className="mt-3 text-xs text-gray-500">
                            Sorted by Total Area (ha) descending. Top Variety is based on the
                            highest total planted area per crop.
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                </div>
              </Section>

              {/* CROPS REPORT */}
              <Section title="Crops Report (Quarterly / Yearly / Annual)">
                <Card>
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
                    <div>
                      <div className="text-base font-semibold text-gray-800">
                        Report Period
                      </div>
                      <div className="text-sm text-gray-500">
                        {reportPeriod === "annually"
                          ? "Year-by-year summary"
                          : reportPeriod === "quarterly"
                          ? `Quarterly breakdown for ${activeReportYear}`
                          : `Monthly breakdown for ${activeReportYear}`}{" "}
                        • Metric: {metric === "area" ? "Area (ha)" : "Count"} • Export
                        generates distinct files per period.
                      </div>
                    </div>

                    {/* ✅ NEW: 3 separate exports (CSV + XLSX) */}
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

                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={exportQuarterlyCSV}
                          disabled={!filtered.length}
                          className="px-3 py-2 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                          title="Download Quarterly CSV"
                        >
                          Quarterly CSV
                        </button>
                        <button
                          onClick={exportQuarterlyXLSX}
                          disabled={!filtered.length}
                          className="px-3 py-2 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                          title="Download Quarterly Excel"
                        >
                          Quarterly XLSX
                        </button>

                        <button
                          onClick={exportYearlyCSV}
                          disabled={!filtered.length}
                          className="px-3 py-2 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                          title="Download Yearly CSV"
                        >
                          Yearly CSV
                        </button>
                        <button
                          onClick={exportYearlyXLSX}
                          disabled={!filtered.length}
                          className="px-3 py-2 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                          title="Download Yearly Excel"
                        >
                          Yearly XLSX
                        </button>

                        <button
                          onClick={exportAnnualCSV}
                          disabled={!filtered.length}
                          className="px-3 py-2 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                          title="Download Annual CSV"
                        >
                          Annual CSV
                        </button>
                        <button
                          onClick={exportAnnualXLSX}
                          disabled={!filtered.length}
                          className="px-3 py-2 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                          title="Download Annual Excel"
                        >
                          Annual XLSX
                        </button>
                      </div>
                    </div>
                  </div>

                  {!cropReportData.length ? (
                    <EmptyChart message="No crop report data for this filter." />
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Chart (total by period) */}
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
                              content={
                                <NiceTooltip suffix={metric === "area" ? " ha" : ""} />
                              }
                            />
                            <Bar dataKey="total" radius={[6, 6, 0, 0]} fill="#16A34A" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Table (total by period) */}
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

                        <div className="mt-3 text-xs text-gray-500">
                          Exports create separate files with columns: Year, Quarter, Crop,
                          Variety, Total Area (ha), Number of Records, Top Variety, Top Variety
                          Area (ha). Data is period-specific without manual filtering.
                        </div>
                      </div>
                    </div>
                  )}
                </Card>
              </Section>
            </>
          )}

          {/* CALAMITY TAB */}
          {tab === "calamity" && (
            <>
              <Section title="Key Metrics">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                  <Kpi
                    title="Total Affected Area"
                    value={`${fmt(calSummary.totalAffectedArea)} ha`}
                    subtitle={
                      selectedBarangay === "all" ? "All barangays" : selectedBarangay
                    }
                  />
                  <Kpi
                    title="Affected Farmers"
                    value={fmt(calSummary.affectedFarmers, { maximumFractionDigits: 0 })}
                    subtitle={selectedYear === "all" ? "All years" : `Year ${selectedYear}`}
                  />
                </div>
              </Section>

              <Section
                title={`By Calamity Type (${calMetric === "area" ? "Area" : "Incidents"})`}
              >
                <Card>
                  {calLoading ? (
                    <ChartSkeleton />
                  ) : !calSummary.byType.length ? (
                    <EmptyChart message="No calamity data for this filter." />
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
                          <Tooltip
                            content={
                              <NiceTooltip suffix={calMetric === "area" ? " ha" : ""} />
                            }
                          />
                          <Bar
                            dataKey={calMetric === "area" ? "area" : "incidents"}
                            radius={[6, 6, 0, 0]}
                          >
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
                  </CardFooter>
                </Card>
              </Section>

              <Section title="Incidents Over Time (Monthly)">
                <Card>
                  {!calamityTimelineFilled.length ? (
                    <EmptyChart message="No calamity timeline data." />
                  ) : (
                    <div className="h-[260px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={calamityTimelineFilled}
                          margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                          <XAxis dataKey="month" />
                          <YAxis
                            tickFormatter={(v) => fmt(v)}
                            label={{
                              value: calMetric === "area" ? "Area (ha)" : "Incidents",
                              angle: -90,
                              position: "insideLeft",
                            }}
                          />
                          <Tooltip
                            content={
                              <NiceTooltip suffix={calMetric === "area" ? " ha" : ""} />
                            }
                          />
                          <Line
                            type="monotone"
                            dataKey={calMetric === "area" ? "area" : "incidents"}
                            stroke="#EF4444"
                            strokeWidth={2}
                            dot
                            activeDot={{ r: 5 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  <CardFooter>
                    {selectedYear !== "all" ? `Year: ${selectedYear}` : "Last 12 months"}
                    {selectedBarangay !== "all" ? ` • Barangay: ${selectedBarangay}` : ""}
                    {selectedCalamityType !== "all" ? ` • Type: ${selectedCalamityType}` : ""}
                  </CardFooter>
                </Card>
              </Section>
            </>
          )}

          {/* RANKINGS TAB */}
          {tab === "rankings" && (
            <Section title="Top Barangays by Planted Area">
              <div className="flex items-center justify-between mb-3 text-sm text-gray-500">
                <div>
                  {selectedYear !== "all" ? `Year: ${selectedYear}` : "All years"}
                  {selectedCrop !== "all" ? ` • Crop: ${selectedCrop}` : ""}
                  {selectedBarangay !== "all" ? ` • Barangay: ${selectedBarangay}` : ""}
                </div>
                <button
                  onClick={exportTop5CSV}
                  disabled={!top5Barangays.length}
                  className="px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  title={top5Barangays.length ? "Download CSV" : "No data to export"}
                >
                  Download CSV
                </button>
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

/* ---------- UI bits (simple & consistent) ---------- */
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
    <div className={`rounded-xl border border-gray-200 bg-white p-5 shadow-sm ${className}`}>
      {children}
    </div>
  );
}
function CardTitle({ children }) {
  return <h3 className="text-base font-semibold text-gray-800 mb-3">{children}</h3>;
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
