// CropOverviewCard.jsx
import React from "react";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { formatNum } from "./Cropmaputils";

export function CropOverviewCard({ onHide, season }) {
  const {
    croppingSystemLabel,
    hasPastSeason,
    hasBothValues,
    valueDeltaPct,
    valueDeltaPctLabel,
    absValueDeltaPctLabel,
    currentHigher,
    currentLower,
    pastHigher,
    currentCardClasses,
    pastCardClasses,
    currentPillClasses,
    currentValueColor,
    currentDeltaColor,
    // current
    primaryCropName,
    primaryVarietyName,
    primaryVolume,
    primaryHectares,
    primaryPlantedDate,
    primaryHarvestOrEst,
    primaryUnit,
    currentFarmgateExact,
    // past
    pastCropName,
    pastVarietyName,
    pastVolume,
    pastHectares,
    pastPlantedDate,
    pastHarvestDate,
    pastUnit,
    pastFarmgateExact,
  } = season;

  return (
    <div className="absolute top-28 right-[90px] z-40 w-[320px]">
      <div className="relative rounded-md border border-emerald-100 bg-white/95 backdrop-blur px-4 py-3 shadow-md max-h-[78vh] overflow-hidden flex flex-col">
        {/* Close button */}
        <button
          type="button"
          onClick={onHide}
          className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-gray-200 text-[11px] font-bold text-gray-700 hover:bg-gray-300"
          title="Hide comparison"
        >
          ×
        </button>

        {/* Header */}
        <div className="mb-2 flex items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
              Crop overview
            </p>
            {croppingSystemLabel && (
              <p className="text-[11px] text-gray-500">{croppingSystemLabel}</p>
            )}
          </div>

          {hasPastSeason && hasBothValues && (
            <div
              className={
                "inline-flex max-w-[90px] items-center justify-center truncate rounded-full px-2 py-1 text-[10px] font-semibold " +
                (valueDeltaPct > 0
                  ? "bg-emerald-50 text-emerald-800"
                  : valueDeltaPct < 0
                  ? "bg-red-50 text-red-700"
                  : "bg-gray-100 text-gray-600")
              }
              title={valueDeltaPctLabel ?? ""}
            >
              {valueDeltaPctLabel ?? ""}
            </div>
          )}
        </div>

        {/* Scrollable body */}
        <div className="mt-2 overflow-y-auto pr-1" style={{ maxHeight: "68vh" }}>

          {/* ── Current season card ── */}
          <div className={currentCardClasses}>
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold text-emerald-900">Current Season</p>

              {hasBothValues && (
                <span className={currentPillClasses}>
                  {currentHigher ? (
                    <ArrowUpRight className="h-3 w-3" />
                  ) : currentLower ? (
                    <ArrowDownRight className="h-3 w-3" />
                  ) : (
                    <Minus className="h-3 w-3" />
                  )}
                  {absValueDeltaPctLabel}
                </span>
              )}
            </div>

            <p className="mt-0.5 text-sm font-semibold text-gray-900">
              {primaryCropName || "—"}
            </p>
            {primaryVarietyName && (
              <p className="text-[11px] text-gray-500">Variety: {primaryVarietyName}</p>
            )}

            <div className="mt-2 space-y-1 text-[11px] text-gray-700">
              <Row label="Area"    value={primaryHectares != null ? `${formatNum(primaryHectares)} ha` : "—"} />
              <Row label="Volume"  value={primaryVolume   != null ? `${formatNum(primaryVolume)} ${primaryUnit}` : "—"} />
              <Row label="Planted" value={primaryPlantedDate  ? new Date(primaryPlantedDate).toLocaleDateString()  : "—"} />
              <Row label="Harvest" value={primaryHarvestOrEst ? new Date(primaryHarvestOrEst).toLocaleDateString() : "—"} />

              {currentFarmgateExact && (
                <div className="flex justify-between pt-1 border-t border-emerald-100 mt-1">
                  <span>Est. crop value</span>
                  <div className="flex flex-col items-end">
                    <span className={`font-semibold ${hasPastSeason && hasBothValues ? currentValueColor : "text-emerald-800"}`}>
                      {currentFarmgateExact}
                    </span>
                    {hasPastSeason && (
                      <span className={`mt-0.5 inline-flex items-center gap-1 text-[10px] font-semibold ${hasBothValues ? currentDeltaColor : "text-gray-500"}`} />
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Previous season card ── */}
          <div className="mt-3">
            <div className={pastCardClasses}>
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold text-gray-800">Previous season</p>

                {hasPastSeason && (
                  <span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-semibold text-gray-700">
                    {pastPlantedDate
                      ? new Date(pastPlantedDate).toLocaleDateString()
                      : pastHarvestDate
                      ? new Date(pastHarvestDate).toLocaleDateString()
                      : "Selected record"}
                  </span>
                )}
              </div>

              {hasPastSeason ? (
                <>
                  <p className="mt-0.5 text-sm font-semibold text-gray-900">{pastCropName}</p>
                  {pastVarietyName && (
                    <p className="text-[11px] text-gray-500">Variety: {pastVarietyName}</p>
                  )}
                  <div className="mt-2 space-y-1 text-[11px] text-gray-700">
                    <Row label="Area"    value={pastHectares != null ? `${formatNum(pastHectares)} ha` : "—"} />
                    <Row label="Volume"  value={pastVolume   != null ? `${formatNum(pastVolume)} ${pastUnit}` : "—"} />
                    <Row label="Planted" value={pastPlantedDate  ? new Date(pastPlantedDate).toLocaleDateString()  : "—"} />
                    <Row label="Harvest" value={pastHarvestDate  ? new Date(pastHarvestDate).toLocaleDateString()  : "—"} />

                    {pastFarmgateExact && (
                      <div className="flex justify-between pt-1 border-t border-gray-200 mt-1">
                        <span>Est. crop value</span>
                        <span
                          className={
                            "font-semibold " +
                            (hasBothValues
                              ? pastHigher ? "text-emerald-800" : "text-gray-900"
                              : "text-emerald-800")
                          }
                        >
                          {pastFarmgateExact}
                        </span>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <p className="mt-1 text-[11px] text-gray-500">
                  No past season recorded for this field.
                </p>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── tiny shared row ──────────────────────────────────────────────────────────
function Row({ label, value }) {
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}