// src/components/AdminCrop/CalamityImpactSidebar.jsx
import React, { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AgriGISLogo from "../../components/MapboxImages/AgriGIS.png";
import Button from "./MapControls/Button";
import clsx from "clsx";
import axios from "axios";

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : "—");
const fmt = (v) => (v ?? v === 0 ? v : "—");

const Section = ({ title, children }) => (
  <div className="rounded-xl border border-gray-200 bg-white p-4 mb-4">
    {title && (
      <h3 className="text-sm font-semibold text-gray-900 mb-3">{title}</h3>
    )}
    {children}
  </div>
);

const KV = ({ label, value }) => (
  <div className="flex flex-col">
    <dt className="text-xs uppercase tracking-wide text-gray-500">{label}</dt>
    <dd className="text-sm text-gray-900">{value}</dd>
  </div>
);

// same mapping you used in ManageCrop
const yieldUnitMap = {
  1: "sacks",
  2: "sacks",
  3: "bunches",
  4: "tons",
  5: "tons",
  6: "kg",
};

const CROPPING_SYSTEM_LABELS = {
  1: "Monocrop",
  2: "Intercropped (2 crops)",
  3: "Relay intercropping",
  4: "Strip intercropping",
  5: "Mixed cropping / Polyculture",
};

// Legend / crop chip colors
const CROP_COLORS = {
  Rice: "#facc15",
  Corn: "#fb923c",
  Banana: "#a3e635",
  Sugarcane: "#34d399",
  Cassava: "#60a5fa",
  Vegetables: "#f472b6",
};

const getCropColor = (name) => {
  if (!name) return null;
  const key = Object.keys(CROP_COLORS).find(
    (k) => k.toLowerCase() === String(name).toLowerCase()
  );
  return key ? CROP_COLORS[key] : null;
};

// 🔹 SAME helper as in AdminMapBox to ignore deleted/inactive crops
function isSoftDeletedCrop(crop) {
  if (!crop) return false;

  const yes = (v) =>
    v === 1 ||
    v === "1" ||
    v === true ||
    v === "true" ||
    v === "yes" ||
    v === "y";

  if (
    yes(crop.is_deleted) ||
    yes(crop.deleted) ||
    yes(crop.is_archived) ||
    yes(crop.archived) ||
    yes(crop.is_hidden) ||
    yes(crop.hidden)
  ) {
    return true;
  }

  const checkStatusStr = (val) => {
    if (typeof val !== "string") return false;
    const s = val.toLowerCase();
    return ["deleted", "archived", "inactive", "removed"].includes(s);
  };

  if (checkStatusStr(crop.status) || checkStatusStr(crop.record_status)) {
    return true;
  }

  return false;
}

/* ---------- Farmgate helpers (same logic as TagCropForm) ---------- */

const DEFAULT_KG_PER_SACK = 50;
const DEFAULT_KG_PER_BUNCH = 15;
const KG_PER_TON = 1000;

const peso = (n) => {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return x.toLocaleString(undefined, { maximumFractionDigits: 0 });
};

function normalizeName(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Return { low, high, unit:"kg", note } OR null if unknown */
function resolveFarmgateRangePerKg(cropTypeId, varietyNameRaw, vegCategoryRaw) {
  const v = normalizeName(varietyNameRaw);
  const veg = normalizeName(vegCategoryRaw);

  // BANANA (Farmgate 2025)
  if (String(cropTypeId) === "3") {
    if (v.includes("tinigib"))
      return { low: 20, high: 25, unit: "kg", note: "Banana Tinigib" };
    if (v.includes("lagkitan") || v.includes("lakatan"))
      return {
        low: 38,
        high: 45,
        unit: "kg",
        note: "Banana Lakatan/Lagkitan",
      };
    if (v.includes("saba"))
      return { low: 22, high: 26, unit: "kg", note: "Banana Saba" };
    if (v.includes("cavendish"))
      return { low: 18, high: 22, unit: "kg", note: "Banana Cavendish" };
    return { low: 20, high: 25, unit: "kg", note: "Banana (fallback range)" };
  }

  // RICE (Palay)
  if (String(cropTypeId) === "1") {
    if (v.includes("216"))
      return { low: 18, high: 23, unit: "kg", note: "Rice NSIC Rc 216" };
    if (v.includes("222"))
      return { low: 18, high: 23, unit: "kg", note: "Rice NSIC Rc 222" };
    if (v.includes("15"))
      return { low: 17, high: 22, unit: "kg", note: "Rice Rc 15" };
    if (v.includes("224"))
      return { low: 18, high: 23, unit: "kg", note: "Rice NSIC Rc 224" };
    if (v.includes("188"))
      return { low: 18, high: 23, unit: "kg", note: "Rice NSIC Rc 188" };
    return { low: 18, high: 23, unit: "kg", note: "Rice (fallback range)" };
  }

  // CORN
  if (String(cropTypeId) === "2") {
    if (v.includes("99-1793") || v.includes("99 1793"))
      return { low: 18, high: 22, unit: "kg", note: "Corn Phil 99-1793" };
    if (v.includes("2000-2569") || v.includes("2000 2569"))
      return { low: 18, high: 22, unit: "kg", note: "Corn Phil 2000-2569" };
    if (v.includes("co 0238") || v.includes("0238"))
      return { low: 18, high: 22, unit: "kg", note: "Corn Co 0238" };
    return { low: 18, high: 22, unit: "kg", note: "Corn (fallback range)" };
  }

  // CASSAVA
  if (String(cropTypeId) === "5") {
    if (v.includes("ku50") || v.includes("ku 50"))
      return { low: 30, high: 35, unit: "kg", note: "Cassava KU50" };
    if (v.includes("golden yellow"))
      return { low: 30, high: 35, unit: "kg", note: "Cassava Golden Yellow" };
    if (v.includes("rayong 5") || v.includes("rayong5"))
      return { low: 30, high: 35, unit: "kg", note: "Cassava Rayong 5" };
    return { low: 30, high: 35, unit: "kg", note: "Cassava (fallback range)" };
  }

  // SUGARCANE
  if (String(cropTypeId) === "4") {
    return { low: 1.8, high: 2.5, unit: "kg", note: "Sugarcane (all varieties)" };
  }

  // VEGETABLES
  if (String(cropTypeId) === "6") {
    if (veg === "leafy")
      return { low: 40, high: 60, unit: "kg", note: "Vegetables (leafy)" };
    if (veg === "fruiting")
      return { low: 35, high: 80, unit: "kg", note: "Vegetables (fruiting)" };
    if (veg === "gourd")
      return { low: 30, high: 60, unit: "kg", note: "Vegetables (gourd crops)" };
    return { low: 30, high: 80, unit: "kg", note: "Vegetables (general fallback)" };
  }

  return null;
}

/**
 * Convert volume (in app unit) → kg, then apply price per kg.
 * Returns { valueLow, valueHigh, kgTotal, priceLow, priceHigh, note } or null
 */
function computeFarmgateValueRange({
  cropTypeId,
  varietyName,
  vegCategory,
  volume,
  unit,
  kgPerSack,
  kgPerBunch,
}) {
  const vol = Number(volume);
  if (!Number.isFinite(vol) || vol <= 0) return null;

  const range = resolveFarmgateRangePerKg(cropTypeId, varietyName, vegCategory);
  if (!range) return null;

  let kgFactor = 1;
  if (unit === "kg") kgFactor = 1;
  else if (unit === "tons") kgFactor = KG_PER_TON;
  else if (unit === "sacks")
    kgFactor = Math.max(1, Number(kgPerSack) || DEFAULT_KG_PER_SACK);
  else if (unit === "bunches")
    kgFactor = Math.max(1, Number(kgPerBunch) || DEFAULT_KG_PER_BUNCH);

  const kgTotal = vol * kgFactor;
  const valueLow = kgTotal * range.low;
  const valueHigh = kgTotal * range.high;

  return {
    valueLow,
    valueHigh,
    kgTotal,
    priceLow: range.low,
    priceHigh: range.high,
    note: range.note,
  };
}

// 🔹 Optional colors for calamity severity text
const severityColorClass = (severity) => {
  if (!severity) return "text-gray-700";
  const s = String(severity).toLowerCase();
  if (s.includes("severe")) return "text-red-700";
  if (s.includes("high")) return "text-orange-700";
  if (s.includes("moderate")) return "text-amber-700";
  if (s.includes("low")) return "text-yellow-700";
  if (s.includes("outside")) return "text-gray-500";
  return "text-gray-700";
};

const CalamityImpactSidebar = ({
  visible,
  zoomToBarangay,
  onBarangaySelect,
  crops = [],
  selectedCrop,
  cropTypes = [],
  selectedCropType,
  setSelectedCropType,
  setEnlargedImage,
  onCropUpdated,
  harvestFilter,
  setHarvestFilter,
  timelineMode,
  setTimelineMode,
  timelineFrom,
  setTimelineFrom,
  timelineTo,
  setTimelineTo,
  onStartNewSeason,
  calamityHistory = [],
  cropHistory = [],
  selectedCropDamage,
  activeCalamityId,

  // 👉 add these two from parent
  onResolveCalamityImpact,
  resolvingImpact,
}) => {
  const [selectedBarangay, setSelectedBarangay] = useState("");
  const [barangayDetails, setBarangayDetails] = useState(null);
  const [showCropDropdown, setShowCropDropdown] = useState(false); // (kept in case you use later)
  const navigate = useNavigate();

  // NEW: calamity damage photos for this crop + calamity
  const [damagePhotos, setDamagePhotos] = useState([]);
  const [loadingDamagePhotos, setLoadingDamagePhotos] = useState(false);

  // back button handler
  const handleBackToCrops = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/AdminManageCrop");
    }
  };

  const isCropOutsideRadius =
    !selectedCropDamage ||
    selectedCropDamage.level === "outside" ||
    (typeof selectedCropDamage.severity === "string" &&
      selectedCropDamage.severity.toLowerCase().includes("outside")) ||
    (selectedCropDamage.percent != null && Number(selectedCropDamage.percent) <= 0) ||
    (selectedCropDamage.damagedAreaHa != null &&
      Number(selectedCropDamage.damagedAreaHa) <= 0);

  // barangay data
  const barangayCoordinates = {
    Abuanan: [122.9844, 10.5275],
    Alianza: [122.92424927088227, 10.471876805354725],
    Atipuluan: [122.94997254227323, 10.51054338526979],
    Bacong: [123.03026270744279, 10.520037893339277],
    Bagroy: [122.87467558102158, 10.47702885963125],
    Balingasag: [122.84330579876998, 10.528672212250575],
    Binubuhan: [122.98236293756698, 10.457428765280468],
    Busay: [122.8936085581886, 10.536447801424544],
    Calumangan: [122.8857773056537, 10.55943773159997],
    Caridad: [122.89676017560787, 10.484855427956782],
    Dulao: [122.94775786836688, 10.549767917490168],
    Ilijan: [123.04567999131407, 10.44537414453059],
    "Lag-asan": [122.84543167453091, 10.519843756585255],
    Mailum: [123.05148249170527, 10.469013722796765],
    "Ma-ao": [123.018102985426, 10.508962844307234],
    Malingin: [122.92533490443519, 10.51102316577104],
    Napoles: [122.86024955431672, 10.510195807139885],
    Pacol: [122.86326134780008, 10.48966963268301],
    Poblacion: [122.83378471878187, 10.535871883140523],
    Sagasa: [122.89592554988106, 10.465232192594353],
    Tabunan: [122.93868999567334, 10.570304584775227],
    Taloc: [122.9100707275183, 10.57850192116514],
  };

  const barangayInfo = {
    Abuanan: { crops: ["Banana", "Rice"] },
    Alianza: { crops: ["Sugarcane", "Corn"] },
    Atipuluan: { crops: ["Banana", "Rice"] },
    Bacong: { crops: ["Rice", "Sugarcane"] },
    Bagroy: { crops: ["Corn", "Cassava"] },
    Balingasag: { crops: ["Rice", "Banana"] },
    Binubuhan: { crops: ["Sugarcane", "Corn"] },
    Busay: { crops: ["Rice", "Vegetables"] },
    Calumangan: { crops: ["Banana", "Sugarcane"] },
    Caridad: { crops: ["Cassava", "Sugarcane"] },
    Dulao: { crops: ["Rice", "Banana"] },
    Ilijan: { crops: ["Sugarcane", "Rice"] },
    "Lag-asan": { crops: ["Banana", "Corn"] },
    Mailum: { crops: ["Cassava", "Sugarcane"] },
    "Ma-ao": { crops: ["Rice", "Corn"] },
    Malingin: { crops: ["Sugarcane", "Rice"] },
    Napoles: { crops: ["Corn", "Banana"] },
    Pacol: { crops: ["Rice", "Vegetables"] },
    Poblacion: { crops: ["Rice", "Sugarcane"] },
    Sagasa: { crops: ["Cassava", "Rice"] },
    Tabunan: { crops: ["Banana", "Cassava"] },
    Taloc: { crops: ["Sugarcane", "Rice"] },
    Talon: { crops: ["Rice", "Banana"] },
    Tinongan: { crops: ["Cassava", "Rice"] },
  };

  // helpers
  function isCropHarvested(crop) {
    if (!crop) return false;
    const props = crop.properties || crop;
    return (
      Number(props.is_harvested) === 1 ||
      props.is_harvested === true ||
      !!props.harvested_date
    );
  }

  const getHarvestYear = (crop) => {
    if (!crop) return null;
    const props = crop.properties || crop;
    const raw = props.harvested_date || props.estimated_harvest;
    if (!raw) return null;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return null;
    return d.getFullYear();
  };

  const normalizeCoordsKey = (crop) => {
    if (!crop || !crop.coordinates) return null;
    let coords = crop.coordinates;

    if (typeof coords === "string") {
      try {
        coords = JSON.parse(coords);
      } catch {
        return null;
      }
    }

    if (!Array.isArray(coords) || coords.length < 3) return null;

    let ring = coords.map((pt) => {
      const [lng, lat] = pt;
      const nLng = Number.isFinite(Number(lng)) ? Number(lng) : 0;
      const nLat = Number.isFinite(Number(lat)) ? Number(lat) : 0;
      return [Number(nLng.toFixed(6)), Number(nLat.toFixed(6))];
    });

    if (ring.length >= 2) {
      const first = ring[0];
      const last = ring[ring.length - 1];
      if (first[0] === last[0] && first[1] === last[1]) {
        ring = ring.slice(0, -1);
      }
    }

    return JSON.stringify(ring);
  };

  // field history from backend: past seasons for this polygon
  const fieldHistory = useMemo(() => {
    if (!Array.isArray(cropHistory) || !cropHistory.length) return [];

    return cropHistory
      .slice()
      .sort((a, b) => {
        const da = new Date(a.date_planted || a.planted_date || a.created_at || 0);
        const db = new Date(b.date_planted || b.planted_date || b.created_at || 0);
        return db - da;
      });
  }, [cropHistory]);

  // harvest history (global)
  const currentYear = new Date().getFullYear();

  const [historyYear, setHistoryYear] = useState(String(currentYear));
  const [historyMonthFrom, setHistoryMonthFrom] = useState("1");
  const [historyMonthTo, setHistoryMonthTo] = useState("12");

  // year comparison
  const [compareYearA, setCompareYearA] = useState(String(currentYear - 1));
  const [compareYearB, setCompareYearB] = useState(String(currentYear));

  const historyEnabled = timelineMode === "harvest" && harvestFilter === "harvested";

  const syncTimelineFromTo = (year, fromMonth, toMonth) => {
    if (!setTimelineFrom || !setTimelineTo) return;
    if (!year) {
      setTimelineFrom("");
      setTimelineTo("");
      return;
    }
    const pad = (m) => String(m).padStart(2, "0");
    setTimelineFrom(`${year}-${pad(fromMonth)}`);
    setTimelineTo(`${year}-${pad(toMonth)}`);
  };

  const handleHistoryToggle = (on) => {
    if (on) {
      setTimelineMode?.("harvest");
      setHarvestFilter?.("harvested");
      syncTimelineFromTo(historyYear, historyMonthFrom, historyMonthTo);
    } else {
      setTimelineMode?.("planted");
      setHarvestFilter?.("not_harvested");
      setTimelineFrom?.("");
      setTimelineTo?.("");
    }
  };

  const handleHistoryYearChange = (value) => {
    setHistoryYear(value);
    if (historyEnabled) {
      syncTimelineFromTo(value, historyMonthFrom, historyMonthTo);
    }
  };

  const handleHistoryMonthFromChange = (value) => {
    setHistoryMonthFrom(value);
    if (historyEnabled) {
      syncTimelineFromTo(historyYear, value, historyMonthTo);
    }
  };

  const handleHistoryMonthToChange = (value) => {
    setHistoryMonthTo(value);
    if (historyEnabled) {
      syncTimelineFromTo(historyYear, historyMonthFrom, value);
    }
  };

  const handleApplyYearToMap = (year) => {
    if (!year) return;
    setTimelineMode?.("harvest");
    setHarvestFilter?.("harvested");
    syncTimelineFromTo(year, 1, 12);
  };

  // derived secondary-crop info
  const secondaryCropTypeId = selectedCrop
    ? Number(selectedCrop.intercrop_crop_type_id) || null
    : null;

  const secondaryCropType =
    secondaryCropTypeId && cropTypes.length
      ? cropTypes.find((ct) => Number(ct.id) === secondaryCropTypeId)
      : null;

  const secondaryCropName = secondaryCropType
    ? secondaryCropType.name
    : secondaryCropTypeId
    ? `Crop #${secondaryCropTypeId}`
    : null;

  const secondaryVolume = selectedCrop?.intercrop_estimated_volume ?? null;
  const secondaryUnit = secondaryCropTypeId
    ? yieldUnitMap[secondaryCropTypeId] || "units"
    : null;

  const croppingSystemLabel = selectedCrop
    ? selectedCrop.intercrop_cropping_system ||
      CROPPING_SYSTEM_LABELS[Number(selectedCrop.cropping_system_id)] ||
      null
    : null;

  const isIntercroppedFlag =
    selectedCrop && (selectedCrop.is_intercropped === 1 || selectedCrop.is_intercropped === "1");

  const hasSecondaryCrop = !!secondaryCropTypeId || !!secondaryVolume || !!isIntercroppedFlag;

  // ELEVATION VALUE
  const avgElevation =
    selectedCrop &&
    (selectedCrop.avg_elevation ??
      selectedCrop.avg_elevation_m ??
      selectedCrop.elevation_m ??
      selectedCrop.elevation ??
      null);

  // TENURE display text
  const tenureDisplay =
    (selectedCrop && selectedCrop.tenure_name) ||
    (selectedCrop && selectedCrop.tenure_id != null
      ? `Tenure #${selectedCrop.tenure_id}`
      : null);

  /* ---------- Farmgate estimation for selected field (sidebar view) ---------- */

  const mainCropTypeId = selectedCrop ? selectedCrop.crop_type_id : null;
  const mainVarietyName = selectedCrop ? selectedCrop.variety_name || "" : "";
  const mainVolume = selectedCrop ? selectedCrop.estimated_volume : null;
  const mainUnit = mainCropTypeId ? yieldUnitMap[mainCropTypeId] || "units" : null;

  // If in the future you store veg categories per crop, read them here.
  const vegCategoryMain = selectedCrop?.veg_category_main || "";
  const vegCategorySecondary = selectedCrop?.veg_category_secondary || "";

  const secondaryVarietyName = selectedCrop ? selectedCrop.intercrop_variety_name || "" : "";

  const mainFarmgateSidebar =
    selectedCrop && mainCropTypeId && mainVolume != null
      ? computeFarmgateValueRange({
          cropTypeId: mainCropTypeId,
          varietyName: mainVarietyName,
          vegCategory: vegCategoryMain,
          volume: mainVolume,
          unit: mainUnit,
          kgPerSack: DEFAULT_KG_PER_SACK,
          kgPerBunch: DEFAULT_KG_PER_BUNCH,
        })
      : null;

  const secondaryFarmgateSidebar =
    selectedCrop && secondaryCropTypeId && secondaryVolume != null
      ? computeFarmgateValueRange({
          cropTypeId: secondaryCropTypeId,
          varietyName: secondaryVarietyName,
          vegCategory: vegCategorySecondary,
          volume: secondaryVolume,
          unit: secondaryUnit,
          kgPerSack: DEFAULT_KG_PER_SACK,
          kgPerBunch: DEFAULT_KG_PER_BUNCH,
        })
      : null;

  const totalFarmgateSidebar =
    mainFarmgateSidebar || secondaryFarmgateSidebar
      ? {
          low: (mainFarmgateSidebar?.valueLow || 0) + (secondaryFarmgateSidebar?.valueLow || 0),
          high: (mainFarmgateSidebar?.valueHigh || 0) + (secondaryFarmgateSidebar?.valueHigh || 0),
        }
      : null;

  // harvest-by-year stats (year vs year)
  const harvestedCropsForStats = Array.isArray(crops)
    ? crops.filter((c) => !isSoftDeletedCrop(c) && isCropHarvested(c))
    : [];

  const yearStats = {};
  for (const c of harvestedCropsForStats) {
    const y = getHarvestYear(c);
    if (!y) continue;
    const key = String(y);
    if (!yearStats[key]) {
      yearStats[key] = { count: 0, area: 0, volume: 0 };
    }
    yearStats[key].count += 1;
    yearStats[key].area += Number(c.estimated_hectares) || 0;
    yearStats[key].volume += Number(c.estimated_volume) || 0;
  }

  const yearOptions = Object.keys(yearStats).sort();

  const statsA = yearStats[compareYearA] || { count: 0, area: 0, volume: 0 };
  const statsB = yearStats[compareYearB] || { count: 0, area: 0, volume: 0 };

  const maxArea = Math.max(statsA.area, statsB.area, 0.0001);
  const maxVolume = Math.max(statsA.volume, statsB.volume, 0.0001);

  const formatNum = (n, digits = 2) =>
    Number(n || 0).toLocaleString(undefined, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });

  // handlers
  const handleBarangayChange = (e) => {
    const barangay = e.target.value;
    setSelectedBarangay(barangay);

    if (barangayCoordinates[barangay]) {
      const coordinates = barangayCoordinates[barangay];
      zoomToBarangay(coordinates);

      const details = barangayInfo[barangay] || {};
      setBarangayDetails({
        name: barangay,
        coordinates,
        crops: details.crops || [],
      });

      onBarangaySelect({ name: barangay, coordinates });
    }
  };

  const isHarvested = isCropHarvested(selectedCrop);

  const canMarkHarvestedNow = useMemo(() => {
    if (!selectedCrop || isHarvested) return false;

    const raw = selectedCrop.estimated_harvest;
    // If there is no estimated date, allow marking anytime
    if (!raw) return true;
    const est = new Date(raw);
    if (Number.isNaN(est.getTime())) return true;
    const today = new Date();
    est.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    return today > est;
  }, [selectedCrop, isHarvested]);

  const handleMarkHarvested = async () => {
    if (!selectedCrop) return;

    if (!canMarkHarvestedNow) {
      const msg = selectedCrop.estimated_harvest
        ? `You can only mark this crop as harvested after ${fmtDate(selectedCrop.estimated_harvest)}.`
        : "You cannot mark this crop as harvested yet.";
      alert(msg);
      return;
    }

    const ok = window.confirm("Mark this crop as harvested? This will set it as harvested today.");
    if (!ok) return;

    try {
      const res = await axios.patch(`http://localhost:5000/api/crops/${selectedCrop.id}/harvest`);

      const harvested_date = res.data.harvested_date || new Date().toISOString().slice(0, 10);

      const updated = {
        ...selectedCrop,
        is_harvested: 1,
        harvested_date,
      };

      if (onCropUpdated) onCropUpdated(updated);
    } catch (err) {
      console.error("Failed to mark harvested:", err);
      alert("Failed to mark this crop as harvested. Please try again.");
    }
  };

  // 🔹 Fetch calamity damage photos when calamity or crop changes
  useEffect(() => {
    if (!activeCalamityId || !selectedCrop || !selectedCrop.id) {
      setDamagePhotos([]);
      return;
    }

    const fetchDamagePhotos = async () => {
      try {
        setLoadingDamagePhotos(true);
        const res = await axios.get(
          `http://localhost:5000/api/calamityradius/${activeCalamityId}/photos`,
          {
            params: { crop_id: selectedCrop.id },
          }
        );
        setDamagePhotos(res.data || []);
      } catch (err) {
        console.error("Failed to fetch damage photos:", err);
        setDamagePhotos([]);
      } finally {
        setLoadingDamagePhotos(false);
      }
    };

    fetchDamagePhotos();
  }, [activeCalamityId, selectedCrop]);

  // 🔹 Resolve handler (calls parent; disabled if outside radius / missing ids)
  const canResolveImpact =
    !!onResolveCalamityImpact &&
    !!activeCalamityId &&
    !!selectedCrop?.id &&
    !isCropOutsideRadius &&
    !resolvingImpact;

  const handleResolveImpact = () => {
    if (!onResolveCalamityImpact) return;
    onResolveCalamityImpact({
      calamityId: activeCalamityId,
      cropId: selectedCrop?.id,
    });
  };

  // render
  return (
    <div
      className={clsx(
        "absolute top-0 left-0 h-full bg-gray-50 z-20 overflow-y-auto border-r border-gray-200",
        visible ? "w-[500px]" : "w-0 overflow-hidden"
      )}
    >
      <div className={clsx("transition-all", visible ? "px-6 py-6" : "px-0 py-0")}>
        {/* hero image */}
        <div className="mb-4">
          <div className="relative w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-50 aspect-[16/9]">
            {selectedCrop?.photos ? (
              <img
                src={`http://localhost:5000${JSON.parse(selectedCrop.photos)[0]}`}
                alt={`${selectedCrop?.crop_name || "Crop"} photo`}
                className="h-full w-full object-cover cursor-pointer"
                onClick={() =>
                  setEnlargedImage(
                    `http://localhost:5000${JSON.parse(selectedCrop.photos)[0]}`
                  )
                }
              />
            ) : (
              <div className="h-full w-full flex flex-col items-center justify-center gap-2">
                <img src={AgriGISLogo} alt="AgriGIS" className="h-10 opacity-70" />
                <p className="text-xs text-gray-500">
                  Select a field on the map to see details here.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 🔙 Back to Manage Crops */}
        <div className="mb-4">
          <button
            type="button"
            onClick={handleBackToCrops}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            title="Go back to Manage Crops"
          >
            ← Back
          </button>
        </div>

        {/* location */}
        <Section title="Location">
          <dl className="grid grid-cols-3 gap-3">
            <KV label="Region" value="Western Visayas" />
            <KV label="Province" value="Negros Occidental" />
            <KV label="Municipality" value="Bago City" />
          </dl>
        </Section>

        {/* selected field */}
        {selectedCrop && (
          <Section title="Selected field">
            <div className="space-y-4">
              {/* --- Field header + tags + harvest controls (same as before) --- */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">
                    {selectedCrop.crop_name || "Crop"}
                  </p>
                  <p className="text-xs text-gray-500">
                    {selectedCrop.variety_name || "— variety"}
                  </p>

                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedCrop.crop_name &&
                      (() => {
                        const cropColor = getCropColor(selectedCrop.crop_name);
                        const dotColor = cropColor || "#9CA3AF";
                        const borderColor = cropColor || "#e5e7eb";
                        const textColor = cropColor || "#374151";

                        return (
                          <span
                            className="inline-flex items-center gap-1 rounded-full border bg-white px-2.5 py-1 text-xs font-medium"
                            style={{ borderColor, color: textColor }}
                          >
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ backgroundColor: dotColor }}
                            />
                            {selectedCrop.crop_name}
                          </span>
                        );
                      })()}

                    {selectedCrop.estimated_hectares && (
                      <span className="inline-flex items-center gap-1 rounded-full border bg-white px-2.5 py-1 text-xs font-medium border-emerald-200 text-emerald-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        {Number(selectedCrop.estimated_hectares).toFixed(2)} ha
                      </span>
                    )}

                    {croppingSystemLabel && (
                      <span className="inline-flex items-center gap-1 rounded-full border bg-white px-2.5 py-1 text-xs font-medium border-gray-200 text-gray-700">
                        {croppingSystemLabel}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* --- 1. CALAMITY IMPACT (put this very near the top) --- */}
              {selectedCropDamage && (
                <div className="mt-1 rounded-xl border border-red-100 bg-red-50 px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
                      Calamity impact (current radius)
                    </p>
                    {selectedCropDamage.percent != null && (
                      <p className="text-xs font-semibold text-red-700">
                        {selectedCropDamage.percent}% damaged
                      </p>
                    )}
                  </div>

                  {/* 🔹 Resolve button */}
                  <button
                    type="button"
                    onClick={handleResolveImpact}
                    disabled={!canResolveImpact}
                    className={clsx(
                      "mt-2 inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                      "border-red-300 text-red-700 bg-white/80 hover:bg-white",
                      (!canResolveImpact || resolvingImpact) &&
                        "opacity-60 cursor-not-allowed"
                    )}
                    title={
                      isCropOutsideRadius
                        ? "This field is outside the active radius (no impact to resolve)."
                        : "Mark this field as resolved for this calamity"
                    }
                  >
                    {resolvingImpact ? "Resolving..." : "Resolve impact"}
                  </button>

                  <dl className="mt-2 grid grid-cols-2 gap-3 text-sm">
                    <KV
                      label="Impact level"
                      value={
                        <span
                          className={clsx(
                            "font-semibold",
                            severityColorClass(selectedCropDamage.severity)
                          )}
                        >
                          {selectedCropDamage.severity || "—"}
                        </span>
                      }
                    />
                    <KV
                      label="Damaged area (ha)"
                      value={
                        selectedCropDamage.damagedAreaHa != null
                          ? fmt(Number(selectedCropDamage.damagedAreaHa).toFixed(2))
                          : "—"
                      }
                    />
                    <KV
                      label="Damaged volume"
                      value={
                        selectedCropDamage.damagedVolume != null
                          ? `${fmt(selectedCropDamage.damagedVolume)}${
                              mainUnit ? ` ${mainUnit}` : ""
                            }`
                          : "—"
                      }
                    />
                    <KV
                      label="Est. loss value"
                      value={selectedCropDamage?.lossRange?.label || "—"}
                    />
                    <KV
                      label="Distance from center"
                      value={
                        !isCropOutsideRadius && selectedCropDamage.distanceMeters != null
                          ? `${fmt(Number(selectedCropDamage.distanceMeters).toFixed(2))} m`
                          : "—"
                      }
                    />
                  </dl>

                  <p className="mt-2 text-[11px] text-red-700/80">
                    Values are based on the currently active calamity radius on the map.
                  </p>
                </div>
              )}

              {/* --- 2. FIELD DETAILS (collapsible) --- */}
              <details open className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                <summary className="flex cursor-pointer items-center justify-between text-xs font-semibold uppercase tracking-wide text-gray-600">
                  <span>Field details</span>
                  <span className="text-[12px] text-gray-400 leading-none">▾</span>
                </summary>

                <div className="mt-3">
                  <dl className="grid grid-cols-2 gap-3">
                    <KV label="Hectares" value={fmt(selectedCrop.estimated_hectares)} />
                    <KV label="Est. volume" value={fmt(selectedCrop.estimated_volume)} />
                    <KV label="Planted date" value={fmtDate(selectedCrop.planted_date)} />
                    <KV label="Est. harvest" value={fmtDate(selectedCrop.estimated_harvest)} />
                    {avgElevation != null && <KV label="Avg elevation (m)" value={fmt(avgElevation)} />}
                    {croppingSystemLabel && (
                      <KV label="Cropping system" value={croppingSystemLabel} />
                    )}
                    {hasSecondaryCrop && (
                      <KV
                        label="Secondary crop"
                        value={
                          secondaryCropName
                            ? `${secondaryCropName}${
                                selectedCrop.intercrop_variety_name
                                  ? " · " + selectedCrop.intercrop_variety_name
                                  : ""
                              }`
                            : "—"
                        }
                      />
                    )}
                    {hasSecondaryCrop && secondaryVolume != null && (
                      <KV
                        label="Secondary volume"
                        value={
                          secondaryUnit
                            ? `${fmt(secondaryVolume)} ${secondaryUnit}`
                            : fmt(secondaryVolume)
                        }
                      />
                    )}
                    <KV label="Tagged by" value={fmt(selectedCrop.admin_name)} />
                    <KV label="Tagged on" value={fmtDate(selectedCrop.created_at)} />
                  </dl>

                  {selectedCrop.note?.trim() && (
                    <div className="pt-3 border-t border-gray-100 mt-3">
                      <dt className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                        Note
                      </dt>
                      <dd className="text-sm text-gray-900">{selectedCrop.note.trim()}</dd>
                    </div>
                  )}
                </div>
              </details>

              {/* --- 3. FARMER & TENURE (collapsible) --- */}
              {(selectedCrop.farmer_first_name ||
                selectedCrop.farmer_barangay ||
                selectedCrop.farmer_mobile ||
                selectedCrop.farmer_address ||
                tenureDisplay) && (
                <details className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                  <summary className="flex cursor-pointer items-center justify-between text-xs font-semibold uppercase tracking-wide text-gray-600">
                    <span>Farmer &amp; land tenure</span>
                    <span className="text-[12px] text-gray-400 leading-none">▾</span>
                  </summary>

                  <div className="mt-3">
                    <dl className="grid grid-cols-2 gap-3 text-sm">
                      {selectedCrop.farmer_first_name && (
                        <KV
                          label="Farmer name"
                          value={`${selectedCrop.farmer_first_name} ${
                            selectedCrop.farmer_last_name || ""
                          }`.trim()}
                        />
                      )}
                      {selectedCrop.farmer_mobile && (
                        <KV label="Mobile number" value={selectedCrop.farmer_mobile} />
                      )}
                      {selectedCrop.farmer_barangay && (
                        <KV label="Farmer barangay" value={selectedCrop.farmer_barangay} />
                      )}
                      {selectedCrop.farmer_address && (
                        <KV label="Full address" value={selectedCrop.farmer_address} />
                      )}
                      {tenureDisplay && <KV label="Land tenure" value={tenureDisplay} />}
                    </dl>
                  </div>
                </details>
              )}

              {/* --- 5. CALAMITY DAMAGE PHOTOS (collapsible) --- */}
              {activeCalamityId && (
                <details className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                  <summary className="flex cursor-pointer items-center justify-between text-xs font-semibold uppercase tracking-wide text-gray-600">
                    <span>Calamity damage photos</span>
                    <span className="flex items-center gap-1 text-[12px] text-gray-400 leading-none">
                      {damagePhotos?.length ? `(${damagePhotos.length})` : null}
                      <span>▾</span>
                    </span>
                  </summary>

                  <div className="mt-3">
                    {loadingDamagePhotos ? (
                      <p className="text-xs text-gray-500">Loading photos…</p>
                    ) : !damagePhotos.length ? (
                      <p className="text-xs text-gray-500">
                        No damage photos uploaded yet for this field in this calamity.
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {damagePhotos.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            className="group relative overflow-hidden rounded-md border border-gray-200 bg-gray-50 aspect-[4/3]"
                            onClick={() => setEnlargedImage(p.photo_url)}
                            title={p.caption || "View damage photo"}
                          >
                            <img
                              src={p.photo_url}
                              alt={p.caption || "Damage photo"}
                              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                              loading="lazy"
                            />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </details>
              )}
            </div>
          </Section>
        )}

        {calamityHistory.length > 0 && (
          <Section title="Calamity history for this field">
            <div className="space-y-2 text-sm">
              {calamityHistory.map((h) => (
                <div
                  key={`${h.calamity_id}-${h.created_at}`}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-gray-900">
                        {h.calamity_name || `Calamity #${h.calamity_id}`}
                      </p>
                      <p className="text-[11px] text-gray-500">
                        {h.calamity_type || "— type"} ·{" "}
                        {h.started_at
                          ? new Date(h.started_at).toLocaleDateString()
                          : "no start date"}
                      </p>
                    </div>

                    <span
                      className={clsx(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        h.is_resolved
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-red-50 text-red-700 border border-red-200"
                      )}
                    >
                      {h.is_resolved ? "Resolved" : "Active / Affected"}
                    </span>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                    <KV label="Severity" value={h.severity || "—"} />
                    <KV
                      label="Damage area (ha)"
                      value={h.damaged_area_ha != null ? Number(h.damaged_area_ha).toFixed(2) : "—"}
                    />
                    <KV
                      label="Damage volume"
                      value={
                        h.damaged_volume != null
                          ? `${h.damaged_volume}${h.base_unit ? ` ${h.base_unit}` : ""}`
                          : "—"
                      }
                    />
                    <KV
                      label="Est. loss value"
                      value={
                        h.loss_value_php != null ? `₱${Number(h.loss_value_php).toLocaleString()}` : "—"
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* map filters */}
        <Section title="Map filters">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
                Filter crop
              </label>
              <select
                className="w-full border border-gray-300 rounded-md px-2 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                value={selectedCropType}
                onChange={(e) => setSelectedCropType(e.target.value)}
              >
                <option value="All">All</option>
                {cropTypes.map((type) => (
                  <option key={type.id} value={type.name}>
                    {type.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
                Barangay
              </label>
              <select
                value={selectedBarangay}
                onChange={handleBarangayChange}
                className="w-full border border-gray-300 rounded-md px-2 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
              >
                <option value="">All barangays</option>
                {Object.keys(barangayCoordinates).map((brgy) => (
                  <option key={brgy} value={brgy}>
                    {brgy}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
                Harvest status
              </label>
              <select
                value={harvestFilter}
                onChange={(e) => setHarvestFilter(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-2 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
              >
                <option value="all">All</option>
                <option value="harvested">Harvested only</option>
                <option value="not_harvested">Not yet harvested</option>
              </select>
            </div>
          </div>
        </Section>

        {/* barangay overview */}
        {barangayDetails && (
          <Section title="Barangay overview">
            <div className="text-sm text-gray-900">
              <span className="font-medium">{barangayDetails.name}</span>
              <div className="mt-1">
                <span className="text-xs uppercase tracking-wide text-gray-500">
                  Common crops
                </span>
                <div className="text-sm">{barangayDetails.crops.join(", ") || "—"}</div>
              </div>
            </div>
          </Section>
        )}

        {/* photos by barangay (respect harvestFilter & ignore deleted) */}
        {barangayDetails && crops.length > 0 && (
          <Section title={`Photos from ${barangayDetails.name}`}>
            <div className="grid grid-cols-2 gap-2">
              {crops
                .filter((crop) => {
                  if (isSoftDeletedCrop(crop)) return false;

                  const sameBrgy =
                    crop.barangay?.toLowerCase() === barangayDetails.name.toLowerCase();

                  if (!sameBrgy) return false;

                  if (harvestFilter === "harvested") {
                    return isCropHarvested(crop);
                  }
                  if (harvestFilter === "not_harvested") {
                    return !isCropHarvested(crop);
                  }
                  return true;
                })
                .flatMap((crop, idx) => {
                  const photoArray = crop.photos ? JSON.parse(crop.photos) : [];
                  return photoArray.map((url, i) => (
                    <button
                      type="button"
                      key={`${idx}-${i}`}
                      className="group relative overflow-hidden rounded-lg border border-gray-200"
                      onClick={() => setEnlargedImage(`http://localhost:5000${url}`)}
                      title="View larger"
                    >
                      <img
                        src={`http://localhost:5000${url}`}
                        alt={`Crop ${idx}`}
                        className="h-24 w-full object-cover group-hover:opacity-90"
                      />
                    </button>
                  ));
                })}
            </div>
          </Section>
        )}

        {/* legend */}
        <Section title="Calamity severity (by distance)">
          <div className="text-xs text-gray-700">
            <ul className="space-y-1">
              <li className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-600" />
                <span>Severe (≈90% damage): 0–25% of radius</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-orange-500" />
                <span>High (≈60% damage): 25–50% of radius</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-yellow-400" />
                <span>Moderate (≈35% damage): 50–75% of radius</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-yellow-200" />
                <span>Low (≈15% damage): 75–100% of radius</span>
              </li>
            </ul>

            <p className="mt-2 text-[11px] text-gray-500">
              Each field&apos;s severity is based on distance from the calamity center
              inside this radius.
            </p>
          </div>
        </Section>

        {/* home button */}
        <div className="mt-5 flex gap-2">
          <Button to="/AdminLanding" variant="outline" size="md">
            Home
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CalamityImpactSidebar;
