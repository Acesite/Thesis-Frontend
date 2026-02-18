// src/components/AdminCalamity/CalamityRadiusForm.jsx
import React from "react";

const CalamityRadiusForm = ({
  show,
  radiusCenter,
  radiusMeters,
  calamityName,
  calamityType,
  calamityDescription,
  calamityDate,
  onChangeName,
  onChangeType,
  onChangeDescription,
  onChangeDate,
  onCancel,
  onSave,
}) => {
  // guard: if not visible or no radius yet, render nothing
  if (!show || !radiusCenter || radiusMeters == null) return null;

  return (
    <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-40 w-[320px] max-w-[95vw] rounded-xl bg-white/95 backdrop-blur shadow-lg border border-red-100 p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text--600">
          Save calamity radius
        </h3>
        <button
          type="button"
          className="text-xs text-gray-500 hover:text-gray-800"
          onClick={onCancel}
        >
          ✕
        </button>
      </div>

      <div className="space-y-2 text-xs">
        <div>
          <label className="block text-[11px] text-gray-600 mb-1">
            Calamity name
          </label>
          <input
            type="text"
            className="w-full border border-gray-300 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-red-400"
            value={calamityName}
            onChange={(e) => onChangeName(e.target.value)}
            placeholder="e.g. Typhoon, Flood"
          />
        </div>

        <div>
          <label className="block text-[11px] text-gray-600 mb-1">
            Type (optional)
          </label>
          <input
            type="text"
            className="w-full border border-gray-300 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-red-400"
            value={calamityType}
            onChange={(e) => onChangeType(e.target.value)}
            placeholder="e.g. Flood, Drought"
          />
        </div>

        <div>
          <label className="block text-[11px] text-gray-600 mb-1">
            Description (optional)
          </label>
          <textarea
            className="w-full border border-gray-300 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-red-400 resize-none"
            rows={2}
            value={calamityDescription}
            onChange={(e) => onChangeDescription(e.target.value)}
            placeholder="Short notes about this calamity"
          />
        </div>

        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-[11px] text-gray-600 mb-1">Date</label>
            <input
              type="date"
              className="w-full border border-gray-300 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-red-400"
              value={calamityDate}
              onChange={(e) => onChangeDate(e.target.value)}
            />
          </div>
          <div className="flex-1 text-[11px] text-gray-600">
            <div className="mb-1 font-medium">Summary</div>
            <div>Radius: {(radiusMeters / 1000).toFixed(2)} km</div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          className="px-3 py-1 rounded-md border border-gray-300 text-xs text-gray-700 hover:bg-gray-100"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="button"
          className="px-3 py-1 rounded-md bg-red-500 text-xs font-semibold text-white hover:bg-red-600"
          onClick={onSave}
        >
          Save
        </button>
      </div>
    </div>
  );
};

export default CalamityRadiusForm;
