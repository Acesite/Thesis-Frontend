import React, { useMemo, useState } from "react";

import Footer from "../LandingPage/Footer";
import VotersNavbar from "../../components/NavBar/VotersNavbar";

const SUMMARY_CARDS = [
  {
    label: "Total Barangays",
    value: "61",
    sub: "Mapped voter barangays",
    tone: "emerald",
  },
  {
    label: "Total Precincts",
    value: "248",
    sub: "Registered clustered precincts",
    tone: "sky",
  },
  {
    label: "Encoded Households",
    value: "1,842",
    sub: "Latest household records",
    tone: "violet",
  },
  {
    label: "Candidates",
    value: "8",
    sub: "Mayor and Vice Mayor",
    tone: "amber",
  },
];

const BARANGAY_ROWS = [
  {
    barangay: "Taculing",
    precincts: 11,
    households: 146,
    voters: 582,
    trend: "+8%",
  },
  {
    barangay: "Mansilingan",
    precincts: 10,
    households: 131,
    voters: 531,
    trend: "+5%",
  },
  {
    barangay: "Singcang-Airport",
    precincts: 8,
    households: 115,
    voters: 487,
    trend: "+3%",
  },
  {
    barangay: "Estefania",
    precincts: 7,
    households: 98,
    voters: 410,
    trend: "+2%",
  },
  {
    barangay: "Alijis",
    precincts: 7,
    households: 92,
    voters: 393,
    trend: "+1%",
  },
  {
    barangay: "Villamonte",
    precincts: 6,
    households: 87,
    voters: 360,
    trend: "+1%",
  },
  {
    barangay: "Handumanan",
    precincts: 6,
    households: 81,
    voters: 341,
    trend: "+1%",
  },
  {
    barangay: "Sum-ag",
    precincts: 5,
    households: 76,
    voters: 315,
    trend: "0%",
  },
];

const CANDIDATE_ROWS = [
  {
    position: "Mayor",
    full_name: "Candidate A",
    party: "Sample Party",
    election_year: 2025,
  },
  {
    position: "Mayor",
    full_name: "Candidate B",
    party: "People First",
    election_year: 2025,
  },
  {
    position: "Vice Mayor",
    full_name: "Candidate C",
    party: "Unity Bloc",
    election_year: 2025,
  },
  {
    position: "Vice Mayor",
    full_name: "Candidate D",
    party: "Citizens Party",
    election_year: 2025,
  },
  {
    position: "Mayor",
    full_name: "Candidate E",
    party: "Local Reform",
    election_year: 2025,
  },
  {
    position: "Vice Mayor",
    full_name: "Candidate F",
    party: "Grassroots Alliance",
    election_year: 2025,
  },
];

const ACTIVITY_ROWS = [
  {
    title: "12 new households encoded",
    detail: "Barangay Mansilingan added new household records this week.",
    time: "10 mins ago",
  },
  {
    title: "Precinct clustering updated",
    detail: "Clustered precinct references were refreshed for the 2025 cycle.",
    time: "1 hour ago",
  },
  {
    title: "Candidate assignment review",
    detail: "Mayor support tags were checked across 4 barangays.",
    time: "Today",
  },
  {
    title: "Field validation completed",
    detail: "Barangay Estefania reached high completion in record review.",
    time: "Yesterday",
  },
];

const FILTER_OPTIONS = {
  year: ["2025", "2024", "2023"],
  position: ["All", "Mayor", "Vice Mayor"],
  barangay: ["All barangays", "Taculing", "Mansilingan", "Estefania"],
};

const toneClasses = {
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  sky: "bg-sky-50 text-sky-700 border-sky-200",
  violet: "bg-violet-50 text-violet-700 border-violet-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
};

const StatCard = ({ label, value, sub, tone = "emerald" }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div
      className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
        toneClasses[tone] || toneClasses.emerald
      }`}
    >
      {label}
    </div>
    <div className="mt-4 text-3xl font-bold text-slate-900">{value}</div>
    <p className="mt-2 text-sm text-slate-500">{sub}</p>
  </div>
);

const AdminVotersDashboard = () => {
  const [search, setSearch] = useState("");
  const [selectedYear, setSelectedYear] = useState("2025");
  const [selectedPosition, setSelectedPosition] = useState("All");
  const [selectedBarangay, setSelectedBarangay] =
    useState("All barangays");

  const filteredCandidates = useMemo(() => {
    const q = search.trim().toLowerCase();

    return CANDIDATE_ROWS.filter((item) => {
      const matchYear = String(item.election_year) === selectedYear;
      const matchPosition =
        selectedPosition === "All" || item.position === selectedPosition;
      const matchSearch =
        !q ||
        item.full_name.toLowerCase().includes(q) ||
        item.party.toLowerCase().includes(q);

      return matchYear && matchPosition && matchSearch;
    });
  }, [search, selectedYear, selectedPosition]);

  const filteredBarangays = useMemo(() => {
    if (selectedBarangay === "All barangays") return BARANGAY_ROWS;
    return BARANGAY_ROWS.filter((row) => row.barangay === selectedBarangay);
  }, [selectedBarangay]);

  return (
    <div className="flex min-h-screen flex-col bg-white font-poppins">
      {/* 👉 Navbar at the very top, full width */}
      <main className="flex-grow">
        <VotersNavbar />

        {/* Dashboard content container */}
        <div className="mx-auto max-w-7xl px-6 pb-10 pt-4">
          <div className="mb-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-[32px] leading-tight font-bold text-slate-900">
                Dashboard
                </h1>
                <p className="text-[15px] text-slate-600">
                  View household, barangay, precinct, and candidate
                  analytics in one organized admin dashboard layout.
                </p>
              </div>

              <div className="hidden md:flex items-center gap-2">
                <button className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
                  Export
                </button>
                <button className="rounded-full border border-emerald-600 bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700">
                  Open Map
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex flex-wrap gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    ELECTION YEAR
                  </span>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="h-10 min-w-[140px] rounded-full border border-slate-300 bg-white px-4 text-sm text-slate-700 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/70"
                  >
                    {FILTER_OPTIONS.year.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    POSITION
                  </span>
                  <select
                    value={selectedPosition}
                    onChange={(e) =>
                      setSelectedPosition(e.target.value)
                    }
                    className="h-10 min-w-[160px] rounded-full border border-slate-300 bg-white px-4 text-sm text-slate-700 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/70"
                  >
                    {FILTER_OPTIONS.position.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    BARANGAY
                  </span>
                  <select
                    value={selectedBarangay}
                    onChange={(e) =>
                      setSelectedBarangay(e.target.value)
                    }
                    className="h-10 min-w-[180px] rounded-full border border-slate-300 bg-white px-4 text-sm text-slate-700 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/70"
                  >
                    {FILTER_OPTIONS.barangay.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-end">
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    SEARCH CANDIDATES
                  </span>
                  <div className="relative">
                    <div className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 text-xs">
                      🔍
                    </div>
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search by name or party..."
                      className="h-10 w-72 rounded-full border border-slate-300 bg-slate-50 pl-10 pr-4 text-sm placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/70"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {SUMMARY_CARDS.map((card) => (
              <StatCard key={card.label} {...card} />
            ))}
          </section>

          <section className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Barangay Household Analytics
                  </h2>
                  <p className="text-sm text-slate-500">
                    Summary of households, precincts, and estimated
                    voters by barangay.
                  </p>
                </div>
                <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {filteredBarangays.length} records
                </div>
              </div>

              <div className="grid grid-cols-[minmax(0,1.1fr)_120px_120px_110px] items-center border-b border-slate-200 bg-slate-50 px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <div>BARANGAY</div>
                <div>PRECINCTS</div>
                <div>HOUSEHOLDS</div>
                <div>VOTERS</div>
              </div>

              <div className="divide-y divide-slate-200">
                {filteredBarangays.map((row) => (
                  <div
                    key={row.barangay}
                    className="grid grid-cols-[minmax(0,1.1fr)_120px_120px_110px] items-center px-6 py-4 text-sm hover:bg-slate-50 transition"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-slate-800">
                        Barangay {row.barangay}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        Recent trend {row.trend}
                      </div>
                    </div>
                    <div className="font-medium text-slate-700">
                      {row.precincts}
                    </div>
                    <div className="font-medium text-slate-700">
                      {row.households}
                    </div>
                    <div className="font-medium text-emerald-700">
                      {row.voters}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Quick Insights
                  </h2>
                  <p className="text-sm text-slate-500">
                    Simple analytics preview cards
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                    Top Barangay
                  </p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">
                    Taculing
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Highest current encoded household count
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Avg. Voters / Household
                  </p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">
                    4.2
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Based on current household records
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Coverage Rate
                  </p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">
                    74%
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Households with assigned precinct and barangay
                  </p>
                </div>
              </div>
            </div>
          </section>
      
        </div>
      </main>

      <div className="mt-5">
        <Footer />
      </div>
    </div>
  );
};

export default AdminVotersDashboard;