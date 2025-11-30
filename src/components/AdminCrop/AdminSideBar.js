import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import AgriGISLogo from "../../components/MapboxImages/AgriGIS.png";
import Button from "./MapControls/Button";
import clsx from "clsx";
import axios from "axios";

// ─────────────────────────────────────────────────────────────
// Utilities & small UI primitives
// ─────────────────────────────────────────────────────────────
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

  const no = (v) =>
    v === 0 ||
    v === "0" ||
    v === false ||
    v === "false" ||
    v === "no";

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

const AdminSideBar = ({
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

  cropHistory = [],
}) => {
  const [selectedBarangay, setSelectedBarangay] = useState("");
  const [barangayDetails, setBarangayDetails] = useState(null);
  const [showCropDropdown, setShowCropDropdown] = useState(false);
  const navigate = useNavigate();

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
        const da = new Date(
          a.date_planted || a.planted_date || a.created_at || 0
        );
        const db = new Date(
          b.date_planted || b.planted_date || b.created_at || 0
        );
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

  const historyEnabled =
    timelineMode === "harvest" && harvestFilter === "harvested";

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
    selectedCrop &&
    (selectedCrop.is_intercropped === 1 ||
      selectedCrop.is_intercropped === "1");

  const hasSecondaryCrop =
    !!secondaryCropTypeId || !!secondaryVolume || !!isIntercroppedFlag;

  // 🔹 ELEVATION VALUE (uses any available field name)
  const avgElevation =
    selectedCrop &&
    (selectedCrop.avg_elevation ??
      selectedCrop.avg_elevation_m ??
      selectedCrop.elevation_m ??
      selectedCrop.elevation ??
      null);

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

  const handleMarkHarvested = async () => {
    if (!selectedCrop) return;

    const ok = window.confirm(
      "Mark this crop as harvested? This will set it as harvested today."
    );
    if (!ok) return;

    try {
      const res = await axios.patch(
        `http://localhost:5000/api/crops/${selectedCrop.id}/harvest`
      );

      const harvested_date =
        res.data.harvested_date || new Date().toISOString().slice(0, 10);

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

  // render
  return (
    <div
      className={clsx(
        "absolute top-0 left-0 h-full bg-gray-50 z-20 overflow-y-auto border-r border-gray-200",
        visible ? "w-[500px]" : "w-0 overflow-hidden"
      )}
    >
      <div
        className={clsx(
          "transition-all",
          visible ? "px-6 py-6" : "px-0 py-0"
        )}
      >
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

                <div className="flex flex-col items-end gap-1">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500">
                    Harvest status
                  </p>
                  <p
                    className={clsx(
                      "text-xs font-semibold",
                      isHarvested ? "text-emerald-700" : "text-amber-700"
                    )}
                  >
                    {isHarvested
                      ? `Harvested (${fmtDate(selectedCrop.harvested_date)})`
                      : "Not yet harvested"}
                  </p>

                  {!isHarvested && (
                    <button
                      type="button"
                      onClick={handleMarkHarvested}
                      className="mt-1 inline-flex items-center rounded-md border border-green-600 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50"
                    >
                      Mark as harvested
                    </button>
                  )}

                  {isHarvested && onStartNewSeason && (
                    <button
                      type="button"
                      onClick={() => onStartNewSeason(selectedCrop)}
                      className="mt-1 inline-flex items-center rounded-md border border-emerald-600 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                    >
                      Reuse field (new season)
                    </button>
                  )}
                </div>
              </div>

              <dl className="grid grid-cols-2 gap-3">
                <KV label="Hectares" value={fmt(selectedCrop.estimated_hectares)} />
                <KV label="Est. volume" value={fmt(selectedCrop.estimated_volume)} />
                <KV label="Planted date" value={fmtDate(selectedCrop.planted_date)} />
                <KV
                  label="Est. harvest"
                  value={fmtDate(selectedCrop.estimated_harvest)}
                />

                {/* 🔹 NEW: elevation display */}
                {avgElevation != null && (
                  <KV
                    label="Avg elevation (m)"
                    value={fmt(avgElevation)}
                  />
                )}

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
                <div className="pt-2 border-t border-gray-100">
                  <dt className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                    Note
                  </dt>
                  <dd className="text-sm text-gray-900">
                    {selectedCrop.note.trim()}
                  </dd>
                </div>
              )}

              {(selectedCrop.farmer_first_name ||
                selectedCrop.farmer_barangay ||
                selectedCrop.farmer_mobile ||
                selectedCrop.farmer_address) && (
                <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">
                    Farmer details
                  </p>
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
                      <KV
                        label="Farmer barangay"
                        value={selectedCrop.farmer_barangay}
                      />
                    )}
                    {selectedCrop.farmer_address && (
                      <KV
                        label="Full address"
                        value={selectedCrop.farmer_address}
                      />
                    )}
                  </dl>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* field history for this polygon */}
        {selectedCrop && fieldHistory.length > 0 && (
          <Section title="Field history for this area">
            <p className="mb-2 text-xs text-gray-500">
              Past crops recorded on this same field (newest first).
            </p>
            <ol className="space-y-2 text-xs">
              {fieldHistory.map((h) => (
                <li
                  key={h.id}
                  className="flex items-start justify-between rounded-lg border border-gray-100 bg-white px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {h.crop_name || "Crop"}
                      {h.variety_name ? ` · ${h.variety_name}` : ""}
                    </p>
                    <p className="text-[11px] text-gray-500">
                      Planted: {fmtDate(h.date_planted || h.planted_date)}
                      {(h.date_harvested ||
                        h.harvested_date ||
                        h.estimated_harvest) && (
                        <>
                          {" "}
                          · Harvested:{" "}
                          {fmtDate(
                            h.date_harvested ||
                              h.harvested_date ||
                              h.estimated_harvest
                          )}
                        </>
                      )}
                    </p>
                  </div>
                  {h.estimated_volume != null && (
                    <p className="ml-3 text-[11px] text-gray-700 whitespace-nowrap">
                      <span className="font-semibold">
                        {fmt(h.estimated_volume)}
                      </span>{" "}
                      {yieldUnitMap[h.crop_type_id] || "units"}
                    </p>
                  )}
                </li>
              ))}
            </ol>
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

        {/* harvest history (time filter) */}
        <Section title="Harvest history on map">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-700">
              Filter map by harvested date
            </span>
            <label className="inline-flex items-center gap-1 text-xs text-gray-600">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 rounded border-gray-300"
                checked={historyEnabled}
                onChange={(e) => handleHistoryToggle(e.target.checked)}
              />
              <span>{historyEnabled ? "On" : "Off"}</span>
            </label>
          </div>

          {historyEnabled ? (
            <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
              <div className="col-span-3">
                <label className="mb-1 block text-[11px] font-medium text-gray-600">
                  Year
                </label>
                <select
                  className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5"
                  value={historyYear}
                  onChange={(e) => handleHistoryYearChange(e.target.value)}
                >
                  {Array.from({ length: 6 }).map((_, i) => {
                    const y = currentYear - i;
                    return (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-gray-600">
                  From
                </label>
                <select
                  className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5"
                  value={historyMonthFrom}
                  onChange={(e) => handleHistoryMonthFromChange(e.target.value)}
                >
                  {Array.from({ length: 12 }).map((_, i) => (
                    <option key={i + 1} value={String(i + 1)}>
                      {i + 1}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-gray-600">
                  To
                </label>
                <select
                  className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5"
                  value={historyMonthTo}
                  onChange={(e) => handleHistoryMonthToChange(e.target.value)}
                >
                  {Array.from({ length: 12 }).map((_, i) => (
                    <option key={i + 1} value={String(i + 1)}>
                      {i + 1}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <p className="mt-1 text-xs text-gray-500">
              Turn on to limit the map to fields harvested within a specific year
              and month range.
            </p>
          )}
        </Section>

        {/* year vs year analytics */}
        <Section title="Harvest analytics (year vs year)">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-800">
              Compare harvested fields
            </span>
            {yearOptions.length > 0 && (
              <span className="text-[10px] text-gray-500">
                Based on harvested fields only
              </span>
            )}
          </div>

          {!yearOptions.length ? (
            <p className="text-xs text-gray-500">
              No harvested crops recorded yet for comparison.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block mb-1 font-medium text-gray-600">
                    Year A
                  </label>
                  <select
                    className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5"
                    value={compareYearA}
                    onChange={(e) => setCompareYearA(e.target.value)}
                  >
                    {yearOptions.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block mb-1 font-medium text-gray-600">
                    Year B
                  </label>
                  <select
                    className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5"
                    value={compareYearB}
                    onChange={(e) => setCompareYearB(e.target.value)}
                  >
                    {yearOptions.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => handleApplyYearToMap(compareYearA)}
                  className="flex-1 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-2 py-1.5 text-[11px] font-medium text-gray-700 hover:bg-gray-50"
                >
                  Show {compareYearA} on map
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyYearToMap(compareYearB)}
                  className="flex-1 inline-flex items-center justify-center rounded-md border border-emerald-500 bg-emerald-50 px-2 py-1.5 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100"
                >
                  Show {compareYearB} on map
                </button>
              </div>

              <div className="mt-4 space-y-3 text-xs">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-gray-700">
                      Fields harvested
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-[11px] text-gray-500 mb-1">
                        {compareYearA}
                      </div>
                      <div className="text-sm font-semibold text-gray-900">
                        {statsA.count}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-gray-500 mb-1">
                        {compareYearB}
                      </div>
                      <div className="text-sm font-semibold text-gray-900">
                        {statsB.count}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-gray-700">
                      Total area harvested (ha)
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] text-gray-500">
                          {compareYearA}
                        </span>
                        <span className="text-[11px] font-semibold text-gray-900">
                          {formatNum(statsA.area)}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{
                            width: `${(statsA.area / maxArea) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] text-gray-500">
                          {compareYearB}
                        </span>
                        <span className="text-[11px] font-semibold text-gray-900">
                          {formatNum(statsB.area)}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-600"
                          style={{
                            width: `${(statsB.area / maxArea) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-gray-700">
                      Total estimated volume
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] text-gray-500">
                          {compareYearA}
                        </span>
                        <span className="text-[11px] font-semibold text-gray-900">
                          {formatNum(statsA.volume)}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-sky-500"
                          style={{
                            width: `${(statsA.volume / maxVolume) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] text-gray-500">
                          {compareYearB}
                        </span>
                        <span className="text-[11px] font-semibold text-gray-900">
                          {formatNum(statsB.volume)}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-sky-600"
                          style={{
                            width: `${(statsB.volume / maxVolume) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
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
                <div className="text-sm">
                  {barangayDetails.crops.join(", ") || "—"}
                </div>
              </div>
            </div>
          </Section>
        )}

        {/* photos of selected crop */}
        {selectedCrop?.photos &&
          (() => {
            const toArray = (inp) => {
              if (Array.isArray(inp)) return inp;
              if (typeof inp !== "string") return [];
              const s = inp.trim();
              if (!s) return [];
              try {
                const parsed = JSON.parse(s);
                if (Array.isArray(parsed)) return parsed;
              } catch {}
              return s.includes(",")
                ? s
                    .split(",")
                    .map((x) => x.trim())
                    .filter(Boolean)
                : [s];
            };

            const makeUrl = (u) =>
              /^https?:\/\//i.test(u)
                ? u
                : `http://localhost:5000${u.startsWith("/") ? "" : "/"}${u}`;

            const photoList = toArray(selectedCrop.photos).map(makeUrl);
            const n = photoList.length;
            if (n === 0) return null;

            const isSingle = n === 1;

            return (
              <Section title={`Photos of ${selectedCrop.crop_name || "Crop"}`}>
                {isSingle ? (
                  <button
                    type="button"
                    className="group relative block overflow-hidden rounded-lg border border-gray-200 bg-gray-50 aspect-[16/9] w-full"
                    onClick={() => setEnlargedImage(photoList[0])}
                    title="View photo"
                  >
                    <img
                      src={photoList[0]}
                      alt="Photo 1"
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
                    {photoList.map((url, i) => (
                      <button
                        type="button"
                        key={i}
                        className="group relative overflow-hidden rounded-md border border-gray-200 bg-gray-50 aspect-square"
                        onClick={() => setEnlargedImage(url)}
                        title={`View photo ${i + 1}`}
                      >
                        <img
                          src={url}
                          alt={`Photo ${i + 1}`}
                          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                          loading="lazy"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </Section>
            );
          })()}

        {/* photos by barangay (respect harvestFilter & ignore deleted) */}
        {barangayDetails && crops.length > 0 && (
          <Section title={`Photos from ${barangayDetails.name}`}>
            <div className="grid grid-cols-2 gap-2">
              {crops
                .filter((crop) => {
                  if (isSoftDeletedCrop(crop)) return false;

                  const sameBrgy =
                    crop.barangay?.toLowerCase() ===
                    barangayDetails.name.toLowerCase();

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
                      onClick={() =>
                        setEnlargedImage(`http://localhost:5000${url}`)
                      }
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
        <Section title="Legend">
          <details className="text-sm">
            <summary className="cursor-pointer select-none text-gray-900">
              Show colors
            </summary>
            <ul className="mt-2 space-y-1">
              {Object.entries({
                ...CROP_COLORS,
                "Harvested field": "#9CA3AF",
              }).map(([label, color]) => (
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

        {/* home button */}
        <div className="mt-5">
          <Button to="/AdminLanding" variant="outline" size="md">
            Home
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AdminSideBar;
