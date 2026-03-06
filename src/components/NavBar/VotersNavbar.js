import React from "react";
import { Users, MapPin } from "lucide-react";
import { Link } from "react-router-dom";

const VotersNavbar = () => {
  return (
    // full-width header bar
    <header className="w-full bg-gray-100 border-b border-gray-200">
      {/* same inner container as dashboard */}
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        {/* LEFT SIDE */}
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-gray-900">Voter</h1>

          <div className="flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700">
            <MapPin size={14} />
            Bacolod City
          </div>
        </div>

        {/* RIGHT SIDE */}
        <div className="flex items-center gap-6">
          {/* Dashboard link */}
          <Link
            to="/VotersDashboard"
            className="text-lg font-medium text-gray-900 hover:text-emerald-700 transition"
          >
            Dashboard
          </Link>

          {/* Voters button link */}
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