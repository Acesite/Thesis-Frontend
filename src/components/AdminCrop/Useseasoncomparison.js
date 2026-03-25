// useSeasonComparison.js
import { useMemo } from "react";
import {
  yieldUnitMap,
  peso,
  readFarmgateDisplay,
  midFromDisplay,
  isSoftDeletedCrop,
} from "./Cropmaputils";

/**
 * Derives all season comparison data from selectedCrop + its history.
 * No side effects — pure derived state.
 */
export function useSeasonComparison(selectedCrop, selectedCropHistory, activeHistoryId) {
  // ── Sorted history (ascending by planted date) ───────────────────────────
  const fieldHistory = useMemo(() => {
    if (!Array.isArray(selectedCropHistory)) return [];
    return selectedCropHistory
      .slice()
      .sort((a, b) => {
        const da = new Date(a.date_planted || a.planted_date || a.created_at || 0);
        const db = new Date(b.date_planted || b.planted_date || b.created_at || 0);
        return da - db;
      });
  }, [selectedCropHistory]);

  // ── Timeline: history + selectedCrop merged & sorted ────────────────────
  const seasonTimeline = useMemo(() => {
    const list = [...fieldHistory];
    if (selectedCrop) {
      const exists = list.some((r) => String(r.id) === String(selectedCrop.id));
      if (!exists) list.push(selectedCrop);
    }
    return list.sort((a, b) => {
      const da = new Date(a.date_planted || a.planted_date || a.created_at || 0);
      const db = new Date(b.date_planted || b.planted_date || b.created_at || 0);
      return da - db;
    });
  }, [fieldHistory, selectedCrop]);

  // ── Season records ────────────────────────────────────────────────────────
  const currentSeasonRec = seasonTimeline.length
    ? seasonTimeline[seasonTimeline.length - 1]
    : null;

  const previousSeasonRec =
    seasonTimeline.length >= 2 ? seasonTimeline[seasonTimeline.length - 2] : null;

  const pickedHistoryRec =
    activeHistoryId != null
      ? seasonTimeline.find((h) => String(h.id) === String(activeHistoryId)) || null
      : null;

  const pastSeasonForOverview =
    pickedHistoryRec &&
    currentSeasonRec &&
    String(pickedHistoryRec.id) === String(currentSeasonRec.id)
      ? previousSeasonRec
      : pickedHistoryRec || previousSeasonRec;

  const hasPastSeason = !!pastSeasonForOverview;

  // ── Current season fields ─────────────────────────────────────────────────
  const croppingSystemLabel =
    currentSeasonRec?.cropping_system_label || currentSeasonRec?.cropping_system || null;

  const primaryCropName    = currentSeasonRec?.crop_name || "";
  const primaryVarietyName = currentSeasonRec?.variety_name || null;
  const primaryVolume      = currentSeasonRec?.estimated_volume ?? null;
  const primaryHectares    = currentSeasonRec?.estimated_hectares ?? currentSeasonRec?.hectares ?? null;
  const primaryPlantedDate = currentSeasonRec?.planted_date || null;
  const primaryHarvestOrEst =
    currentSeasonRec?.harvested_date || currentSeasonRec?.estimated_harvest || null;

  const primaryCropTypeId = currentSeasonRec?.crop_type_id ?? null;
  const primaryUnit =
    primaryCropTypeId && yieldUnitMap[primaryCropTypeId]
      ? yieldUnitMap[primaryCropTypeId]
      : currentSeasonRec?.yield_unit || "units";

  // ── Past season fields ────────────────────────────────────────────────────
  const pastCropName    = pastSeasonForOverview?.crop_name || null;
  const pastVarietyName = pastSeasonForOverview?.variety_name || null;
  const pastVolume      =
    pastSeasonForOverview?.estimated_volume != null ? pastSeasonForOverview.estimated_volume : null;
  const pastHectares    =
    pastSeasonForOverview?.hectares ?? pastSeasonForOverview?.estimated_hectares ?? null;
  const pastPlantedDate =
    pastSeasonForOverview?.date_planted || pastSeasonForOverview?.planted_date || null;
  const pastHarvestDate =
    pastSeasonForOverview?.date_harvested ||
    pastSeasonForOverview?.harvested_date ||
    pastSeasonForOverview?.estimated_harvest ||
    null;
  const pastCropTypeId = pastSeasonForOverview?.crop_type_id ?? null;
  const pastUnit =
    pastCropTypeId && yieldUnitMap[pastCropTypeId]
      ? yieldUnitMap[pastCropTypeId]
      : pastSeasonForOverview?.yield_unit || "units";

  // ── Farmgate values ───────────────────────────────────────────────────────
  const currentFarmgateDisplay = readFarmgateDisplay(currentSeasonRec);
  const pastFarmgateDisplay    = readFarmgateDisplay(pastSeasonForOverview);

  const safeCurrentMid = midFromDisplay(currentFarmgateDisplay);
  const safePastMid    = midFromDisplay(pastFarmgateDisplay);

  const currentFarmgateExact =
    safeCurrentMid != null && Number.isFinite(safeCurrentMid)
      ? `₱${peso(safeCurrentMid)}`
      : currentFarmgateDisplay || null;

  const pastFarmgateExact =
    safePastMid != null && Number.isFinite(safePastMid)
      ? `₱${peso(safePastMid)}`
      : pastFarmgateDisplay || null;

  // ── Delta calculation ─────────────────────────────────────────────────────
  const hasBothValues =
    !!currentFarmgateDisplay &&
    !!pastFarmgateDisplay &&
    Number.isFinite(safeCurrentMid) &&
    Number.isFinite(safePastMid) &&
    safePastMid !== 0;

  const valueDeltaPct = hasBothValues
    ? ((safeCurrentMid - safePastMid) / Math.abs(safePastMid)) * 100
    : null;

  const valueDeltaPctLabel =
    valueDeltaPct == null
      ? null
      : valueDeltaPct > 100
      ? "+100%+"
      : valueDeltaPct < -100
      ? "-100%+"
      : `${valueDeltaPct > 0 ? "+" : ""}${valueDeltaPct.toFixed(0)}%`;

  const absValueDeltaPctLabel =
    valueDeltaPct == null
      ? null
      : Math.abs(valueDeltaPct) > 100
      ? "100%+"
      : `${Math.abs(valueDeltaPct).toFixed(0)}%`;

  const currentHigher = hasBothValues && safeCurrentMid > safePastMid;
  const pastHigher    = hasBothValues && safePastMid > safeCurrentMid;
  const currentLower  = hasBothValues && safeCurrentMid < safePastMid;

  // ── Derived CSS class strings ─────────────────────────────────────────────
  const currentCardClasses =
    "rounded-xl border px-4 py-3 mb-3 " +
    (hasBothValues
      ? currentHigher
        ? "border-emerald-200 bg-emerald-50/70"
        : currentLower
        ? "border-red-200 bg-red-50/70"
        : "border-gray-200 bg-white"
      : "border-emerald-100 bg-emerald-50/40");

  const pastCardClasses = "rounded-xl border px-4 py-3 border-gray-200 bg-white";

  const currentPillClasses =
    "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold " +
    (currentHigher
      ? "bg-emerald-100 text-emerald-800"
      : currentLower
      ? "bg-red-100 text-red-700"
      : "bg-gray-100 text-gray-600");

  const currentValueColor =
    hasBothValues && currentHigher
      ? "text-emerald-800"
      : hasBothValues && currentLower
      ? "text-red-600"
      : "text-gray-900";

  const currentDeltaColor =
    hasBothValues && currentHigher
      ? "text-emerald-700"
      : hasBothValues && currentLower
      ? "text-red-600"
      : "text-gray-500";

  return {
    fieldHistory,
    seasonTimeline,
    currentSeasonRec,
    previousSeasonRec,
    pastSeasonForOverview,
    hasPastSeason,
    croppingSystemLabel,
    // current
    primaryCropName, primaryVarietyName, primaryVolume,
    primaryHectares, primaryPlantedDate, primaryHarvestOrEst,
    primaryUnit,
    // past
    pastCropName, pastVarietyName, pastVolume,
    pastHectares, pastPlantedDate, pastHarvestDate,
    pastUnit,
    // farmgate
    currentFarmgateDisplay, pastFarmgateDisplay,
    safeCurrentMid, safePastMid,
    currentFarmgateExact, pastFarmgateExact,
    // delta
    hasBothValues, valueDeltaPct, valueDeltaPctLabel, absValueDeltaPctLabel,
    currentHigher, pastHigher, currentLower,
    // css
    currentCardClasses, pastCardClasses, currentPillClasses,
    currentValueColor, currentDeltaColor,
  };
}