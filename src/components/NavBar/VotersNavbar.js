import React from "react";
import { Users, MapPin } from "lucide-react";
import { Link } from "react-router-dom";

const VotersNavbar = () => {
  return (
    <header className="w-full bg-gray-100 border-b border-gray-200">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">

        {/* ── LEFT SIDE — Logo + VISTA branding ── */}
        <div className="flex items-center gap-3">
          <div className="leading-tight">
            <p className="text-green-800 font-black text-base tracking-wide leading-none">
              VISTA
            </p>
            <p className="text-gray-400 text-[10px] leading-none mt-0.5">
              Voter Insights &amp; Spatial Tracking Analytics
            </p>
          </div>
        </div>

        {/* ── RIGHT SIDE — Nav links ── */}
        <div className="flex items-center gap-6">
          <Link
            to="/VotersDashboard"
            className="text-lg font-medium text-gray-900 hover:text-emerald-700 transition"
          >
            Dashboard
          </Link>

          <Link
            to="/UnifiedAgriMap"
            className="flex items-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
          >
            <Users size={16} />
            Voters
          </Link>
        </div>

      </div>
    </header>
  );
};

export default VotersNavbar;