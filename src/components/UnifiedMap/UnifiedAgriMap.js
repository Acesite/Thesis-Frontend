// src/components/UnifiedMap/UnifiedAgriMap.js
import React, { useState } from "react";
import AdminCropMap from "../AdminCrop/AdminCropMap"; // adjust path if needed
import CalamityFarmerMap from "../AdminCalamity/CalamityMap"; // adjust path
import { Sprout, CloudLightning, MapPin } from "lucide-react";

const UnifiedAgriMap = () => {
  const [activeTab, setActiveTab] = useState("crop"); // 'crop' | 'calamity'

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-50 overflow-hidden">
      {/* Top brand bar */}
      <header className="flex items-center justify-between px-6 py-3 border-b bg-white/95 backdrop-blur-sm shadow-sm">
        {/* Left: logo + title */}
        <div className="flex items-center gap-3 min-w-0">
        

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-base font-semibold text-slate-900 truncate">
                AgriGIS Unified Map
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50 px-2 py-[2px] text-[11px] font-semibold text-emerald-700">
                <MapPin className="h-3 w-3" />
                Bago City DA
              </span>
            </div>
            <p className="text-xs text-slate-500">
              One map for crop and calamity geotagging
            </p>
          </div>
        </div>

        {/* Right: mode toggle */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex flex-col items-end mr-1">
            <span className="text-[11px] font-medium text-slate-500 leading-tight">
              View mode
            </span>
            <span className="text-[10px] text-slate-400">
              Switch between crops and calamities
            </span>
          </div>

          <div className="inline-flex rounded-full bg-slate-100 p-[4px] text-xs">
            <button
              type="button"
              onClick={() => setActiveTab("crop")}
              className={`inline-flex items-center gap-1 px-3.5 py-[6px] rounded-full transition text-xs font-medium ${
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
              className={`inline-flex items-center gap-1 px-3.5 py-[6px] rounded-full transition text-xs font-medium ${
                activeTab === "calamity"
                  ? "bg-red-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <CloudLightning className="w-3.5 h-3.5" />
              Calamities
            </button>
          </div>
        </div>
      </header>

      {/* Map area */}
      <main className="flex-1 relative min-h-0">
        {activeTab === "crop" ? <AdminCropMap /> : <CalamityFarmerMap />}
      </main>
    </div>
  );
};  

export default UnifiedAgriMap;
