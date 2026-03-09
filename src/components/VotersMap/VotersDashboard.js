import React, { useMemo, useState, useEffect } from "react";
import axios from "axios";
import Footer from "../LandingPage/Footer";
import VotersNavbar from "../../components/NavBar/VotersNavbar";

const API_BASE = "http://localhost:5000";

const toneClasses = {
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  sky: "bg-sky-50 text-sky-700 border-sky-200",
  violet: "bg-violet-50 text-violet-700 border-violet-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
};

const FILTER_OPTIONS = {
  year: ["2025", "2024", "2023"],
  position: ["All", "Mayor", "Vice Mayor"],
};

const CANDIDATE_ROWS = [
  { position: "Mayor", full_name: "Candidate A", party: "Sample Party", election_year: 2025 },
  { position: "Mayor", full_name: "Candidate B", party: "People First", election_year: 2025 },
  { position: "Vice Mayor", full_name: "Candidate C", party: "Unity Bloc", election_year: 2025 },
  { position: "Vice Mayor", full_name: "Candidate D", party: "Citizens Party", election_year: 2025 },
  { position: "Mayor", full_name: "Candidate E", party: "Local Reform", election_year: 2025 },
  { position: "Vice Mayor", full_name: "Candidate F", party: "Grassroots Alliance", election_year: 2025 },
];

const StatCard = ({ label, value, sub, tone = "emerald", loading }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${toneClasses[tone] || toneClasses.emerald}`}>
      {label}
    </div>
    <div className="mt-4 text-3xl font-bold text-slate-900">
      {loading ? (
        <div className="h-8 w-16 animate-pulse rounded-lg bg-slate-200" />
      ) : (
        value
      )}
    </div>
    <p className="mt-2 text-sm text-slate-500">{sub}</p>
  </div>
);

const SkeletonRow = () => (
  <div className="grid grid-cols-[minmax(0,1.1fr)_120px_120px_110px] items-center px-6 py-4 gap-4">
    {[1, 2, 3, 4].map((i) => (
      <div key={i} className="h-4 w-3/4 animate-pulse rounded bg-slate-200" />
    ))}
  </div>
);

const AdminVotersDashboard = () => {
  const [search, setSearch] = useState("");
  const [selectedYear, setSelectedYear] = useState("2025");
  const [selectedPosition, setSelectedPosition] = useState("All");
  const [selectedBarangay, setSelectedBarangay] = useState("All barangays");

  const [stats, setStats] = useState({
    totalBarangays: 0,
    totalPrecincts: 0,
    encodedHouseholds: 0,
  });
  const [barangayRows, setBarangayRows] = useState([]);
  const [insights, setInsights] = useState({
    topBarangay: "—",
    avgVotersPerHousehold: 0,
    coverageRate: 0,
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    Promise.all([
      axios.get(`${API_BASE}/api/managevoters/dashboard-stats`),
      axios.get(`${API_BASE}/api/managevoters/barangay-analytics`),
      axios.get(`${API_BASE}/api/managevoters/quick-insights`),
      axios.get(`${API_BASE}/api/managevoters/recent-activity`),
    ])
      .then(([statsRes, barangayRes, insightsRes, activityRes]) => {
        setStats(statsRes.data);
        setBarangayRows(barangayRes.data);
        setInsights(insightsRes.data);
        setRecentActivity(activityRes.data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Dashboard fetch error:", err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const barangayFilterOptions = useMemo(() => {
    const names = barangayRows.map((r) => r.barangay_name);
    return ["All barangays", ...names];
  }, [barangayRows]);

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
    if (selectedBarangay === "All barangays") return barangayRows;
    return barangayRows.filter((row) => row.barangay_name === selectedBarangay);
  }, [selectedBarangay, barangayRows]);

  const summaryCards = [
    {
      label: "Total Barangays",
      value: stats.totalBarangays.toLocaleString(),
      sub: "Mapped voter barangays",
      tone: "emerald",
    },
    {
      label: "Total Precincts",
      value: stats.totalPrecincts.toLocaleString(),
      sub: "Registered clustered precincts",
      tone: "sky",
    },
    {
      label: "Encoded Households",
      value: stats.encodedHouseholds.toLocaleString(),
      sub: "Latest household records",
      tone: "violet",
    },
    {
      label: "Candidates",
      value: CANDIDATE_ROWS.length.toString(),
      sub: "Mayor and Vice Mayor",
      tone: "amber",
    },
  ];

  const formatTimeAgo = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    if (diffMins < 60) return `${diffMins} mins ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    if (diffDays === 1) return "Yesterday";
    return `${diffDays} days ago`;
  };

  return (
    <div className="flex min-h-screen flex-col bg-white font-poppins">
      <main className="flex-grow">
        <VotersNavbar />

        <div className="mx-auto max-w-7xl px-6 pb-10 pt-4">
          {/* Header */}
          <div className="mb-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-[32px] leading-tight font-bold text-slate-900">
                  Dashboard
                </h1>
                <p className="text-[15px] text-slate-600">
                  View household, barangay, precinct, and candidate analytics in
                  one organized admin dashboard layout.
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

            {/* Filters */}
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
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    POSITION
                  </span>
                  <select
                    value={selectedPosition}
                    onChange={(e) => setSelectedPosition(e.target.value)}
                    className="h-10 min-w-[160px] rounded-full border border-slate-300 bg-white px-4 text-sm text-slate-700 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/70"
                  >
                    {FILTER_OPTIONS.position.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    BARANGAY
                  </span>
                  <select
                    value={selectedBarangay}
                    onChange={(e) => setSelectedBarangay(e.target.value)}
                    className="h-10 min-w-[180px] rounded-full border border-slate-300 bg-white px-4 text-sm text-slate-700 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/70"
                  >
                    {barangayFilterOptions.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
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

          {/* Error Banner */}
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              ⚠️ {error} — showing cached or empty data.
            </div>
          )}

          {/* Stat Cards */}
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((card) => (
              <StatCard key={card.label} {...card} loading={loading} />
            ))}
          </section>

          {/* Main Grid */}
          <section className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
            {/* Barangay Table */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Barangay Household Analytics
                  </h2>
                  <p className="text-sm text-slate-500">
                    Summary of households, precincts, and estimated voters by barangay.
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
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                ) : filteredBarangays.length === 0 ? (
                  <div className="px-6 py-10 text-center text-sm text-slate-400">
                    No barangay records found.
                  </div>
                ) : (
                  filteredBarangays.map((row) => (
                    <div
                      key={row.barangay_name}
                      className="grid grid-cols-[minmax(0,1.1fr)_120px_120px_110px] items-center px-6 py-4 text-sm hover:bg-slate-50 transition"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-slate-800">
                          Barangay {row.barangay_name}
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-500">
                          {row.households} households encoded
                        </div>
                      </div>
                      <div className="font-medium text-slate-700">
                        {row.precincts ?? "—"}
                      </div>
                      <div className="font-medium text-slate-700">
                        {Number(row.households).toLocaleString()}
                      </div>
                      <div className="font-medium text-emerald-700">
                        {Number(row.voters).toLocaleString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right Column */}
            <div className="flex flex-col gap-6">
              {/* Quick Insights */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-bold text-slate-900">Quick Insights</h2>
                <p className="text-sm text-slate-500">Live analytics from your database</p>

                <div className="mt-4 space-y-3">
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                      Top Barangay
                    </p>
                    {loading ? (
                      <div className="mt-2 h-7 w-32 animate-pulse rounded-lg bg-emerald-200" />
                    ) : (
                      <p className="mt-2 text-2xl font-bold text-slate-900">
                        {insights.topBarangay}
                      </p>
                    )}
                    <p className="mt-1 text-sm text-slate-600">
                      Highest current encoded household count
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Avg. Voters / Household
                    </p>
                    {loading ? (
                      <div className="mt-2 h-7 w-16 animate-pulse rounded-lg bg-slate-200" />
                    ) : (
                      <p className="mt-2 text-2xl font-bold text-slate-900">
                        {insights.avgVotersPerHousehold}
                      </p>
                    )}
                    <p className="mt-1 text-sm text-slate-600">
                      Based on current household records
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Coverage Rate
                    </p>
                    {loading ? (
                      <div className="mt-2 h-7 w-16 animate-pulse rounded-lg bg-slate-200" />
                    ) : (
                      <p className="mt-2 text-2xl font-bold text-slate-900">
                        {insights.coverageRate}%
                      </p>
                    )}
                    <p className="mt-1 text-sm text-slate-600">
                      Households with assigned precinct and barangay
                    </p>
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-bold text-slate-900">Recent Activity</h2>
                <p className="text-sm text-slate-500">Latest household record updates</p>

                <div className="mt-4 space-y-3">
                  {loading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="space-y-1.5 rounded-xl border border-slate-100 bg-slate-50 p-3">
                        <div className="h-3 w-3/4 animate-pulse rounded bg-slate-200" />
                        <div className="h-3 w-full animate-pulse rounded bg-slate-200" />
                        <div className="h-3 w-1/3 animate-pulse rounded bg-slate-200" />
                      </div>
                    ))
                  ) : recentActivity.length === 0 ? (
                    <p className="text-center text-sm text-slate-400 py-4">
                      No recent activity.
                    </p>
                  ) : (
                    recentActivity.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-slate-100 bg-slate-50 p-3"
                      >
                        <p className="text-sm font-semibold text-slate-800">
                          {item.family_leader_name ?? "Unknown"} — {item.barangay_name}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {item.voter_count} voter{item.voter_count !== 1 ? "s" : ""} in household
                        </p>
                        <p className="mt-1 text-[11px] text-slate-400">
                          {formatTimeAgo(item.updated_at)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Candidates Table */}
          <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Candidates</h2>
                <p className="text-sm text-slate-500">Filtered by year and position</p>
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {filteredCandidates.length} results
              </div>
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)_140px_180px_100px] items-center border-b border-slate-200 bg-slate-50 px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <div>FULL NAME</div>
              <div>POSITION</div>
              <div>PARTY</div>
              <div>YEAR</div>
            </div>

            <div className="divide-y divide-slate-200">
              {filteredCandidates.length === 0 ? (
                <div className="px-6 py-10 text-center text-sm text-slate-400">
                  No candidates match your filters.
                </div>
              ) : (
                filteredCandidates.map((row, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-[minmax(0,1fr)_140px_180px_100px] items-center px-6 py-4 text-sm hover:bg-slate-50 transition"
                  >
                    <div className="font-semibold text-slate-800">{row.full_name}</div>
                    <div>
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        row.position === "Mayor"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-sky-50 text-sky-700"
                      }`}>
                        {row.position}
                      </span>
                    </div>
                    <div className="text-slate-600">{row.party}</div>
                    <div className="text-slate-500">{row.election_year}</div>
                  </div>
                ))
              )}
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