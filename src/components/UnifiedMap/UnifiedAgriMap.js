// src/components/UnifiedAgriMap.jsx
import React, { useState } from "react";
import AdminCropMap from "../AdminCrop/AdminCropMap"; // adjust path if needed
import CalamityFarmerMap from "../AdminCalamity/CalamityMap"; // adjust path
import { Sprout, CloudLightning } from "lucide-react";

const UnifiedAgriMap = () => {
  const [activeTab, setActiveTab] = useState("crop"); // 'crop' | 'calamity'

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-50">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-3 border-b bg-white shadow-sm">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 font-bold">
            AG
          </div>
          <div>
            <h1 className="text-sm font-semibold text-slate-900">
              AgriGIS Unified Map
            </h1>
            <p className="text-xs text-slate-500">
              One map for crop and calamity geotagging
            </p>
          </div>
        </div>

        {/* Mode toggle */}
        <div className="inline-flex rounded-full bg-slate-100 p-[4px] text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("crop")}
            className={`inline-flex items-center gap-1 px-3 py-[6px] rounded-full transition text-xs font-medium ${
              activeTab === "crop"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Sprout className="w-3.5 h-3.5" />
            Crops
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("calamity")}
            className={`inline-flex items-center gap-1 px-3 py-[6px] rounded-full transition text-xs font-medium ${
              activeTab === "calamity"
                ? "bg-red-600 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <CloudLightning className="w-3.5 h-3.5" />
            Calamities
          </button>
        </div>
      </header>

      {/* Map area */}
      <main className="flex-1 relative">
        {activeTab === "crop" ? (
          <AdminCropMap />
        ) : (
          <CalamityFarmerMap />
        )}
      </main>
    </div>
  );
};

export default UnifiedAgriMap;
