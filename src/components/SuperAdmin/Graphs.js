// components/SuperAdmin/Graphs.jsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
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

const getCropType = (c) => (c.crop_name || c.crop_type || "Unknown").trim() || "Unknown";

// Location defaults (AgriGIS context). If your DB has these fields, it uses them.
// NOTE: No GPS coordinates are exported.
const getRegion = (c) => (c.region || c.region_name || "VI").trim();
const getProvince = (c) => (c.province || c.province_name || "Negros Occidental").trim();
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

export default function Graphs() {
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

  /* ---------- NEW: Crops Report Period ---------- */
  // Quarterly = Q1-Q4 in a selected year (or latest year if "All")
  // Yearly    = month-by-month in a selected year (or latest year if "All")
  // Annually  = year-by-year across all years in filtered data
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
      if (
        selectedCrop !== "all" &&
        (c.crop_name || "").trim() !== selectedCrop
      )
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
      const ha = parseFloat(c.estimated_hectares || 0) || 0;
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
      const cn = c.crop_name || "Unknown";
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
      const key = c.crop_name || "Unknown";
      const val =
        metric === "area" ? parseFloat(c.estimated_hectares || 0) || 0 : 1;
      map.set(key, (map.get(key) || 0) + val);
    }
    return Array.from(map.entries())
      .map(([crop_type, total]) => ({ crop_type, total }))
      .sort((a, b) => b.total - a.total);
  }, [filtered, metric]);

  /* ---------- CROPS REPORT (Quarterly / Yearly / Annually) ---------- */
  const activeReportYear = useMemo(() => {
    if (selectedYear !== "all") return Number(selectedYear);
    const latest = years.find((y) => y !== "all");
    return Number(latest || new Date().getFullYear());
  }, [selectedYear, years]);

  const reportTypeLabel = useMemo(() => {
    if (reportPeriod === "quarterly") return "Quarterly";
    if (reportPeriod === "yearly") return "Yearly";
    return "Annual"; // reportPeriod === "annually"
  }, [reportPeriod]);

  const periodCoveredLabel = useMemo(() => {
    if (reportPeriod === "annually") {
      const ys = [];
      for (const c of filtered) {
        const d = getPlantedDate(c);
        if (d) ys.push(d.getFullYear());
      }
      if (!ys.length) return "—";
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      return minY === maxY ? `Year ${minY}` : `${minY}–${maxY}`;
    }
    return `Year ${activeReportYear}`;
  }, [filtered, reportPeriod, activeReportYear]);

  // Chart/table: summarized by period only (clean and readable in UI)
  const cropReportData = useMemo(() => {
    const getVal = (c) =>
      metric === "area" ? toNum(c.estimated_hectares ?? 0) : 1;

    // Annually (year-by-year)
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

    // Quarterly (Q1-Q4 in active year)
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

    // Yearly (month-by-month in active year)
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

  // CSV: aggregated rows (time + crop + location), NOT raw records
  const cropReportCsvRows = useMemo(() => {
    const group = new Map();

    const quarterOf = (d) => Math.floor(d.getMonth() / 3) + 1;
    const monthRangeLabel = (q) => {
      if (q === 1) return "Jan–Mar";
      if (q === 2) return "Apr–Jun";
      if (q === 3) return "Jul–Sep";
      return "Oct–Dec";
    };

    const includeThisRecord = (planted) => {
      if (!planted) return false;
      if (reportPeriod === "annually") return true;
      return planted.getFullYear() === activeReportYear;
    };

    const periodKeyOf = (d) => {
      const y = d.getFullYear();
      if (reportPeriod === "annually") return String(y);
      if (reportPeriod === "quarterly") return `${y}-Q${quarterOf(d)}`;
      return `${y}-${pad2(d.getMonth() + 1)}`; // yearly (monthly)
    };

    const periodLabelOf = (d) => {
      const y = d.getFullYear();
      if (reportPeriod === "annually") return String(y);
      if (reportPeriod === "quarterly") return `Q${quarterOf(d)} ${y}`;
      return `${MONTHS_SHORT[d.getMonth()]} ${y}`;
    };

    for (const c of filtered) {
      const planted = getPlantedDate(c);
      if (!includeThisRecord(planted)) continue;

      const periodKey = periodKeyOf(planted);
      const periodLabel = periodLabelOf(planted);

      const cropType = getCropType(c);
      const barangay = getBarangayName(c);

      const region = getRegion(c);
      const province = getProvince(c);
      const municipality = getMunicipality(c);

      const areaHa = toNum(c.estimated_hectares ?? c.area_ha ?? c.hectares ?? 0);
      const expectedYield = getExpectedYield(c);

      const harvestDate = getEstimatedHarvestDate(c);

      // Grouped summary: period + crop + barangay (clean, useful, non-raw)
      const key = `${periodKey}||${cropType}||${barangay}`;

      const rec =
        group.get(key) || {
          Report_Type: reportTypeLabel,
          Period_Covered: periodCoveredLabel,
          Date_Generated: "",

          Period_Key: periodKey,
          Period_Label: periodLabel,
          Year: planted.getFullYear(),

          Quarter: reportPeriod === "quarterly" ? `Q${quarterOf(planted)}` : "",
          Month_Range: reportPeriod === "quarterly" ? monthRangeLabel(quarterOf(planted)) : "",

          Crop_Type: cropType,

          Region: region, // optional
          Province: province,
          Municipality: municipality,
          Barangay: barangay,

          Total_Plantings: 0,
          Total_Area_Planted_ha: 0,
          Total_Expected_Yield: 0,

          Estimated_Harvest: "",

          Percentage_Contribution: "",
          Rank: "",

          _harvestMin: null,
          _harvestMax: null,
        };

      rec.Total_Plantings += 1;
      rec.Total_Area_Planted_ha += areaHa;
      rec.Total_Expected_Yield += expectedYield;

      if (harvestDate) {
        rec._harvestMin = rec._harvestMin
          ? new Date(Math.min(rec._harvestMin.getTime(), harvestDate.getTime()))
          : harvestDate;
        rec._harvestMax = rec._harvestMax
          ? new Date(Math.max(rec._harvestMax.getTime(), harvestDate.getTime()))
          : harvestDate;
      }

      group.set(key, rec);
    }

    const rows = Array.from(group.values());

    // Finalize Estimated_Harvest as a range (if available)
    for (const r of rows) {
      if (r._harvestMin && r._harvestMax) {
        const a = formatHarvest(r._harvestMin);
        const b = formatHarvest(r._harvestMax);
        r.Estimated_Harvest = a === b ? a : `${a} – ${b}`;
      } else {
        r.Estimated_Harvest = "";
      }
      delete r._harvestMin;
      delete r._harvestMax;
    }

    // Optional: Rank + Percentage Contribution per Period
    // Ranking basis:
    // - If metric === area -> rank by Total_Area_Planted_ha
    // - Else rank by Total_Plantings
    const rankField =
      metric === "area" ? "Total_Area_Planted_ha" : "Total_Plantings";

    const byPeriod = new Map();
    for (const r of rows) {
      const p = r.Period_Key;
      const arr = byPeriod.get(p) || [];
      arr.push(r);
      byPeriod.set(p, arr);
    }

    for (const [p, arr] of byPeriod.entries()) {
      const total = arr.reduce((s, r) => s + toNum(r[rankField]), 0) || 0;

      arr.sort((a, b) => toNum(b[rankField]) - toNum(a[rankField]));
      arr.forEach((r, i) => {
        r.Rank = i + 1;
        r.Percentage_Contribution =
          total > 0 ? ((toNum(r[rankField]) / total) * 100).toFixed(2) : "0.00";
      });
    }

    // Sort output for a clean CSV (Period, then Rank)
    rows.sort((a, b) => {
      if (a.Period_Key !== b.Period_Key) return a.Period_Key.localeCompare(b.Period_Key);
      return (Number(a.Rank) || 0) - (Number(b.Rank) || 0);
    });

    return rows;
  }, [
    filtered,
    reportTypeLabel,
    periodCoveredLabel,
    reportPeriod,
    activeReportYear,
    metric,
  ]);

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
    Array.from({ length: 12 }, (_, i) => `${y}-${String(i + 1).padStart(2, "0")}`);
  const last12Months = () => {
    const out = [];
    const d = new Date();
    for (let i = 11; i >= 0; i--) {
      const dt = new Date(d.getFullYear(), d.getMonth() - i, 1);
      out.push(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`);
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

  // CSV export for crops report (clean summarized + time + crop + location)
  const exportCropReportCSV = () => {
    if (!cropReportCsvRows.length) return;

    const dateGenerated = new Date().toISOString();

    // Required columns (clean + analyzable; no GPS; no personal data)
    const header = [
      "Report_Type",
      "Period_Covered",
      "Date_Generated",

      "Year",
      "Quarter",
      "Month_Range",
      "Period_Label",

      "Crop_Type",

      "Region",
      "Province",
      "Municipality",
      "Barangay",

      "Total_Plantings",
      "Total_Area_Planted_ha",
      "Total_Expected_Yield",
      "Estimated_Harvest",

      "Percentage_Contribution",
      "Rank",
    ];

    const rows = cropReportCsvRows.map((r) => {
      const out = {
        ...r,
        Date_Generated: dateGenerated,
      };

      // keep Region optional; empty string is okay
      return header.map((k) => out[k] ?? "");
    });

    const csv = [header, ...rows]
      .map((row) =>
        row.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    const brgy =
      selectedBarangay === "all"
        ? "all-brgys"
        : selectedBarangay.replace(/\s+/g, "_");
    const crop =
      selectedCrop === "all" ? "all-crops" : selectedCrop.replace(/\s+/g, "_");

    const periodName =
      reportPeriod === "annually" ? "annual" : reportPeriod; // quarterly/yearly/annual
    const yr =
      reportPeriod === "annually" ? periodCoveredLabel.replace(/\s+/g, "_") : String(activeReportYear);

    a.href = url;
    a.download = `crop-report-${periodName}-${yr}-${brgy}-${crop}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  /* ---------- Render ---------- */
  const valueLabel = metric === "area" ? "Hectares" : "Total";
  const suffix = metric === "area" ? " ha" : "";

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
              Simple, clear snapshots with filters, KPIs, charts, and downloadable summarized reports.
            </p>
          </div>

          {/* Tabs */}
          <div className="mb-4 flex gap-2">
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
                      selectedBarangay === "all"
                        ? "All barangays"
                        : selectedBarangay
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

              <Section title="Distribution">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardTitle>By Crop (Bar)</CardTitle>
                    {loading ? (
                      <ChartSkeleton />
                    ) : chartData.length === 0 ? (
                      <EmptyChart message="No data for this filter." />
                    ) : (
                      <div className="h-[260px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={chartData}
                            margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                            <XAxis dataKey="crop_type" tickMargin={8} />
                            <YAxis tickFormatter={(v) => fmt(v)} />
                            <Tooltip content={<NiceTooltip suffix={suffix} />} />
                            <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                              {chartData.map((d, i) => (
                                <Cell
                                  key={i}
                                  fill={
                                    COLOR_BY_CROP[d.crop_type] ||
                                    FALLBACK_COLORS[i % FALLBACK_COLORS.length]
                                  }
                                />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                    <CardFooter>Metric: {valueLabel}</CardFooter>
                  </Card>

                  <Card>
                    <CardTitle>By Crop (Pie)</CardTitle>
                    {loading ? (
                      <ChartSkeleton />
                    ) : chartData.length === 0 ? (
                      <EmptyChart message="No data for this filter." />
                    ) : (
                      <div className="h-[260px]">
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
                        • Metric: {metric === "area" ? "Area (ha)" : "Count"} • CSV is aggregated (no raw records).
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
                        onClick={exportCropReportCSV}
                        disabled={!cropReportCsvRows.length}
                        className="px-3 py-2 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        title={
                          cropReportCsvRows.length
                            ? "Download summarized CSV"
                            : "No data to export"
                        }
                      >
                        Download CSV
                      </button>
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
                            <Tooltip content={<NiceTooltip suffix={metric === "area" ? " ha" : ""} />} />
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
                          CSV includes: Report Type, Period Covered, Date Generated, time fields (Year/Quarter/Month Range),
                          Crop Type, GIS location (Region/Province/Municipality/Barangay), totals (Plantings/Area/Yield),
                          Estimated Harvest (if available), plus % contribution and ranking — and excludes GPS + personal farmer data.
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
                      selectedBarangay === "all"
                        ? "All barangays"
                        : selectedBarangay
                    }
                  />
                  <Kpi
                    title="Affected Farmers"
                    value={fmt(calSummary.affectedFarmers, { maximumFractionDigits: 0 })}
                    subtitle={
                      selectedYear === "all" ? "All years" : `Year ${selectedYear}`
                    }
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
                          <Tooltip content={<NiceTooltip suffix={calMetric === "area" ? " ha" : ""} />} />
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
                          <Tooltip content={<NiceTooltip suffix={calMetric === "area" ? " ha" : ""} />} />
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
