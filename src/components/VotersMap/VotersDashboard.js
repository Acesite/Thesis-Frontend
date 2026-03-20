import React, { useMemo, useState, useEffect, useCallback } from "react";
import axios from "axios";
import Footer from "../VotersMap/Footer";
import VotersNavbar from "../../components/NavBar/VotersNavbar";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";

const API_BASE = "http://localhost:5000";

const toneClasses = {
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  sky:     "bg-sky-50 text-sky-700 border-sky-200",
  violet:  "bg-violet-50 text-violet-700 border-violet-200",
  rose:    "bg-rose-50 text-rose-700 border-rose-200",
};

const FILTER_OPTIONS = {
  year:     ["2025", "2024", "2023"],
  position: ["All", "Mayor", "Vice Mayor"],
};

const CANDIDATE_ROWS = [
  { position: "mayor",      full_name: "Candidate A", party: "Sample Party",       election_year: 2025 },
  { position: "mayor",      full_name: "Candidate B", party: "People First",        election_year: 2025 },
  { position: "vice_mayor", full_name: "Candidate C", party: "Unity Bloc",          election_year: 2025 },
  { position: "vice_mayor", full_name: "Candidate D", party: "Citizens Party",      election_year: 2025 },
  { position: "mayor",      full_name: "Candidate E", party: "Local Reform",        election_year: 2025 },
  { position: "vice_mayor", full_name: "Candidate F", party: "Grassroots Alliance", election_year: 2025 },
];

const formatPosition = (pos) => {
  if (!pos) return "—";
  if (pos === "vice_mayor") return "Vice Mayor";
  if (pos === "mayor") return "Mayor";
  return pos;
};

const normalizePosition = (pos) => {
  if (!pos) return "";
  if (pos === "Vice Mayor") return "vice_mayor";
  if (pos === "Mayor") return "mayor";
  return pos.toLowerCase().replace(/\s+/g, "_");
};

// ── Custom Tooltip ─────────────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-lg text-xs">
      {label && <p className="font-semibold text-slate-700 mb-1.5 truncate max-w-[160px]">{label}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color || p.fill }} />
          <span className="text-slate-500">{p.name}:</span>
          <span className="font-bold text-slate-800">{Number(p.value).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
};

// ── Reusable Horizontal Bar Chart ──────────────────────────────────────────────
const HBarChart = ({ data, dataKey, height, yWidth = 100 }) => {
  if (!data?.length) return <p className="text-sm text-slate-400 py-10 text-center">No data yet.</p>;
  const chartH = height ?? Math.max(data.length * 48, 120);
  return (
    <ResponsiveContainer width="100%" height={chartH}>
      <BarChart data={data} layout="vertical" margin={{ left: 4, right: 52, top: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
        <XAxis type="number" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} tickFormatter={(v) => v.toLocaleString()} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#475569", fontWeight: 600 }} tickLine={false} axisLine={false} width={yWidth} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f8fafc" }} />
        <Bar dataKey={dataKey} radius={[0, 6, 6, 0]} maxBarSize={26}>
          {data.map((entry, i) => <Cell key={i} fill={entry.color ?? "#10b981"} />)}
          <LabelList dataKey={dataKey} position="right" style={{ fontSize: 11, fontWeight: 700, fill: "#64748b" }} formatter={(v) => Number(v).toLocaleString()} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

// ── UI Primitives ──────────────────────────────────────────────────────────────
const StatCard = ({ label, value, sub, tone = "emerald", loading }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${toneClasses[tone]}`}>{label}</div>
    <div className="mt-4 text-3xl font-bold text-slate-900">
      {loading ? <div className="h-8 w-16 animate-pulse rounded-lg bg-slate-200" /> : value}
    </div>
    <p className="mt-1.5 text-sm text-slate-500">{sub}</p>
  </div>
);

const ProgressBar = ({ label, value, total, color }) => {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="font-bold text-slate-900 tabular-nums">
          {value.toLocaleString()} <span className="text-slate-400 font-normal">({pct}%)</span>
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
};

const FilterSelect = ({ label, value, onChange, options }) => (
  <div className="flex items-center gap-2">
    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 shrink-0">{label}</span>
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="h-7 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-600 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300">
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);

const CardHeader = ({ title, subtitle, right }) => (
  <div className="flex items-start justify-between mb-5">
    <div>
      <h2 className="text-base font-bold text-slate-900">{title}</h2>
      {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
    </div>
    {right && <div className="shrink-0 ml-3">{right}</div>}
  </div>
);

const SectionHeading = ({ children }) => (
  <div className="flex items-center gap-3 mb-4 mt-8">
    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 shrink-0">{children}</h3>
    <div className="flex-1 h-px bg-slate-200" />
  </div>
);

const SkeletonBlock = ({ rows = 2 }) => (
  <div className="space-y-3">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="space-y-1.5">
        <div className="h-3.5 w-3/4 animate-pulse rounded bg-slate-100" />
        <div className="h-2 w-full animate-pulse rounded bg-slate-100" />
      </div>
    ))}
  </div>
);

const SkeletonChart = ({ height = 220 }) => (
  <div className="animate-pulse rounded-xl bg-slate-100 w-full" style={{ height }} />
);

// ── Page-level Tab Switcher ────────────────────────────────────────────────────
const PageTabs = ({ active, onChange }) => (
  <div className="flex rounded-xl bg-slate-100 p-1 gap-1">
    {[
      { id: "analytics",  label: "  Analytics"  },
      { id: "candidates", label: "  Candidates" },
    ].map((tab) => (
      <button
        key={tab.id}
        onClick={() => onChange(tab.id)}
        className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
          active === tab.id
            ? "bg-white text-slate-900 shadow-sm"
            : "text-slate-400 hover:text-slate-600"
        }`}
      >
        {tab.label}
      </button>
    ))}
  </div>
);

// ══════════════════════════════════════════════════════════════════════════════
// ANALYTICS VIEW
// ══════════════════════════════════════════════════════════════════════════════
const AnalyticsView = ({
  stats, barangayRows, insights, voteStandings,
  genderBreakdown, ageBreakdown, visitProgress,
  loading, standingsLoading, demographicsLoading,
  standingsYear, setStandingsYear,
  globalBarangayId, globalBarangayName, barangayOptions,
  handleGlobalBarangayChange,
}) => {
  const yearOptions = FILTER_OPTIONS.year.map((y) => ({ value: y, label: y }));
  const isFiltered  = globalBarangayId !== "";

  const mayorStandings     = useMemo(() => voteStandings.filter((c) => c.position === "mayor"), [voteStandings]);
  const viceMayorStandings = useMemo(() => voteStandings.filter((c) => c.position === "vice_mayor"), [voteStandings]);

  const mayorChartData = useMemo(() =>
    mayorStandings.map((c) => ({ name: c.full_name, Votes: Number(c.vote_count), color: c.color || "#10b981" })),
    [mayorStandings]);
  const viceMayorChartData = useMemo(() =>
    viceMayorStandings.map((c) => ({ name: c.full_name, Votes: Number(c.vote_count), color: c.color || "#0ea5e9" })),
    [viceMayorStandings]);
  const genderChartData = useMemo(() => [
    { name: "Male",   Voters: genderBreakdown.male,   color: "#3b82f6" },
    { name: "Female", Voters: genderBreakdown.female, color: "#ec4899" },
  ], [genderBreakdown]);
  const ageChartData = useMemo(() => [
    { name: "Youth (18–30)", Voters: ageBreakdown.Youth,  color: "#8b5cf6" },
    { name: "Adult (31–59)", Voters: ageBreakdown.Adult,  color: "#f59e0b" },
    { name: "Senior (60+)",  Voters: ageBreakdown.Senior, color: "#10b981" },
  ], [ageBreakdown]);
  const barangayChartData = useMemo(() =>
    [...barangayRows]
      .sort((a, b) => Number(b.voters) - Number(a.voters))
      .slice(0, 10)
      .map((r) => ({ name: r.barangay_name, Voters: Number(r.voters), color: "#10b981" })),
    [barangayRows]);

  const filteredBarangays = useMemo(() => {
    if (globalBarangayName === "All barangays") return barangayRows;
    return barangayRows.filter((r) => r.barangay_name === globalBarangayName);
  }, [globalBarangayName, barangayRows]);

  return (
    <>
      {/* Global Barangay Filter */}
      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-3.5 shadow-sm mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-slate-700">Barangay</span>
          <select
            value={globalBarangayId}
            onChange={(e) => handleGlobalBarangayChange(e.target.value)}
            className="h-8 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300 min-w-[200px]"
          >
            {barangayOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {isFiltered && (
            <button onClick={() => handleGlobalBarangayChange("")} className="text-xs text-slate-400 hover:text-slate-700 underline transition">
              Clear
            </button>
          )}
        </div>
        {isFiltered && (
          <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
            Showing: {globalBarangayName}
          </span>
        )}
        <p className="text-xs text-slate-400 hidden sm:block">Applies to Demographics and Barangay Analytics.</p>
      </div>

      {/* Overview */}
      <SectionHeading>Overview</SectionHeading>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Total Barangays"    value={stats.totalBarangays.toLocaleString()}     sub="Mapped voter barangays"   tone="emerald" loading={loading} />
        <StatCard label="Total Precincts"    value={stats.totalPrecincts.toLocaleString()}     sub="Registered precincts"     tone="sky"     loading={loading} />
        <StatCard label="Encoded Households" value={stats.encodedHouseholds.toLocaleString()}  sub="Latest household records" tone="violet"  loading={loading} />
        <StatCard label="Total Voters"       value={(stats.totalVoters || 0).toLocaleString()} sub="Across all households"    tone="rose"    loading={loading} />
      </div>
      <div className="grid grid-cols-3 gap-4 mt-4">
        {[
          { label: "Top Barangay",          value: insights.topBarangay,          color: "text-emerald-600" },
          { label: "Avg Voters / Household", value: insights.avgVotersPerHousehold, color: "text-sky-600" },
          { label: "Coverage Rate",          value: `${insights.coverageRate}%`,   color: "text-violet-600" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">{label}</span>
            {loading ? <div className="h-5 w-16 animate-pulse rounded bg-slate-100" /> : <span className={`text-lg font-black ${color}`}>{value}</span>}
          </div>
        ))}
      </div>

      {/* Vote Standings */}
      <SectionHeading>Vote Standings</SectionHeading>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <CardHeader
          title="Candidate Rankings"
          subtitle="Households per candidate based on encoded records"
          right={<FilterSelect label="Year" value={standingsYear} onChange={setStandingsYear} options={yearOptions} />}
        />
        <div className="grid sm:grid-cols-2 gap-8">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-600 mb-4">Mayor</p>
            {standingsLoading || loading
              ? <SkeletonChart height={Math.max((mayorChartData.length || 3) * 48, 144)} />
              : <HBarChart data={mayorChartData} dataKey="Votes" />}
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-sky-600 mb-4">Vice Mayor</p>
            {standingsLoading || loading
              ? <SkeletonChart height={Math.max((viceMayorChartData.length || 3) * 48, 144)} />
              : <HBarChart data={viceMayorChartData} dataKey="Votes" />}
          </div>
        </div>
      </div>

      {/* Demographics */}
      <SectionHeading>
        Demographics
        {isFiltered && (
          <span className="ml-2 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full normal-case tracking-normal">
            {globalBarangayName}
          </span>
        )}
      </SectionHeading>
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <CardHeader title="Visit Progress" subtitle="Household visitation rate"
            right={!loading && !demographicsLoading && (
              <span className="text-base font-bold text-emerald-600">{visitProgress.percentage}%</span>
            )}
          />
          {loading || demographicsLoading ? <SkeletonBlock rows={2} /> : (
            <div className="space-y-3">
              <ProgressBar label="Visited"     value={visitProgress.visited}     total={visitProgress.total} color="#10b981" />
              <ProgressBar label="Not Visited" value={visitProgress.not_visited} total={visitProgress.total} color="#f59e0b" />
              <p className="text-xs text-slate-400 pt-1">{visitProgress.total.toLocaleString()} total households</p>
            </div>
          )}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <CardHeader title="Gender Breakdown" subtitle={`${genderBreakdown.total.toLocaleString()} total voters`} />
          {loading || demographicsLoading ? <SkeletonChart height={112} /> : <HBarChart data={genderChartData} dataKey="Voters" height={112} yWidth={60} />}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <CardHeader title="Age Breakdown" subtitle={`${ageBreakdown.total.toLocaleString()} total voters`} />
          {loading || demographicsLoading ? <SkeletonChart height={160} /> : <HBarChart data={ageChartData} dataKey="Voters" height={160} yWidth={100} />}
        </div>
      </div>

      {/* Barangay Analytics */}
      <SectionHeading>Barangay Analytics</SectionHeading>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm mb-4">
        <CardHeader title="Top 10 Barangays by Voters" subtitle="Ranked by total registered voters across all households" />
        {loading ? <SkeletonChart height={250} /> : <HBarChart data={barangayChartData} dataKey="Voters" height={250} yWidth={120} />}
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div>
            <h2 className="text-base font-bold text-slate-900">All Barangays</h2>
            <p className="text-xs text-slate-400 mt-0.5">Households, precincts, and voters per barangay</p>
          </div>
          <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
            {filteredBarangays.length} {filteredBarangays.length === 1 ? "barangay" : "barangays"}
          </span>
        </div>
        <div className="grid grid-cols-[1fr_100px_110px_100px] text-xs font-bold uppercase tracking-wide text-slate-400 px-6 py-3 border-b border-slate-100 bg-slate-50">
          <div>Barangay</div><div>Precincts</div><div>Households</div><div>Voters</div>
        </div>
        <div className={`divide-y divide-slate-100 ${filteredBarangays.length > 8 ? "max-h-[440px] overflow-y-auto" : ""}`}>
          {loading
            ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="grid grid-cols-[1fr_100px_110px_100px] px-6 py-3.5 gap-4">
                  {[1,2,3,4].map((j) => <div key={j} className="h-3.5 animate-pulse rounded bg-slate-100" />)}
                </div>
              ))
            : filteredBarangays.length === 0
              ? <div className="px-6 py-10 text-center text-sm text-slate-400">No records found.</div>
              : filteredBarangays.map((row) => (
                  <div key={row.barangay_name} className="grid grid-cols-[1fr_100px_110px_100px] items-center px-6 py-3.5 text-sm hover:bg-slate-50 transition">
                    <div className="font-semibold text-slate-800 truncate">{row.barangay_name}</div>
                    <div className="text-slate-500">{row.precincts ?? "—"}</div>
                    <div className="text-slate-500">{Number(row.households).toLocaleString()}</div>
                    <div className="font-semibold text-emerald-600">{Number(row.voters).toLocaleString()}</div>
                  </div>
                ))
          }
        </div>
      </div>
    </>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// CANDIDATES VIEW
// ══════════════════════════════════════════════════════════════════════════════
const CandidatesView = ({ candidates, refreshCandidates }) => {
  const [search, setSearch]               = useState("");
  const [selectedYear, setSelectedYear]   = useState("2025");
  const [selectedPosition, setSelectedPosition] = useState("All");
  const [candidateForm, setCandidateForm] = useState({ full_name: "", position: "Mayor", party: "", election_year: "2025", color: "#10b981" });
  const [saving, setSaving]               = useState(false);
  const [successMsg, setSuccessMsg]       = useState("");

  const dataCandidates = candidates.length > 0 ? candidates : CANDIDATE_ROWS;

  const filteredCandidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return dataCandidates.filter((item) => {
      if (item.full_name === "Undecided") return false;
      return (
        String(item.election_year) === selectedYear &&
        (selectedPosition === "All" || normalizePosition(selectedPosition) === item.position) &&
        (!q || item.full_name?.toLowerCase().includes(q) || item.party?.toLowerCase().includes(q))
      );
    });
  }, [search, selectedYear, selectedPosition, dataCandidates]);

  const flash = (msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(""), 2500); };

  const addCandidate = async () => {
    if (!candidateForm.full_name || !candidateForm.position || !candidateForm.election_year) {
      alert("Please provide name, position and year."); return;
    }
    setSaving(true);
    try {
      await axios.post(`${API_BASE}/api/managevoters/candidates`, { ...candidateForm, position: normalizePosition(candidateForm.position) });
      setCandidateForm({ full_name: "", position: "Mayor", party: "", election_year: "2025", color: "#10b981" });
      await refreshCandidates();
      flash("Candidate added successfully.");
    } catch { alert("Failed to add candidate."); }
    finally { setSaving(false); }
  };

  const deleteCandidate = async (id) => {
    if (!id || !window.confirm("Delete this candidate?")) return;
    try {
      await axios.delete(`${API_BASE}/api/managevoters/candidates/${id}`);
      await refreshCandidates();
      flash("Candidate deleted.");
    } catch { alert("Failed to delete candidate."); }
  };

  const editCandidate = async (row) => {
    if (!row?.id) { alert("This is a sample candidate."); return; }
    const color = prompt("Color HEX (#xxxxxx)", row.color || "#10b981");
    const name  = prompt("Candidate Name", row.full_name); if (!name) return;
    const party = prompt("Party", row.party || "");
    try {
      await axios.put(`${API_BASE}/api/managevoters/candidates/${row.id}`, {
        full_name: name, position: normalizePosition(row.position), party, election_year: row.election_year, color,
      });
      await refreshCandidates();
      flash("Candidate updated.");
    } catch { alert("Failed to update candidate."); }
  };

  return (
    <>
      {/* ── Add Candidate Form ── */}
      <SectionHeading>Add Candidate</SectionHeading>

      {successMsg && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 flex items-center gap-2">
          <span>✅</span> {successMsg}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">New Candidate</h2>
            <p className="text-xs text-slate-400 mt-0.5">Fill in all fields then click Add</p>
          </div>
          <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full uppercase tracking-wide">
            {candidateForm.position}
          </span>
        </div>

        <div className="px-6 py-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Full Name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Full Name</label>
              <input
                placeholder="e.g. Juan dela Cruz"
                value={candidateForm.full_name}
                onChange={(e) => setCandidateForm({ ...candidateForm, full_name: e.target.value })}
                className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 transition"
              />
            </div>

            {/* Position */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Position</label>
              <select
                value={candidateForm.position}
                onChange={(e) => setCandidateForm({ ...candidateForm, position: e.target.value })}
                className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 transition bg-white"
              >
                <option value="Mayor">Mayor</option>
                <option value="Vice Mayor">Vice Mayor</option>
              </select>
            </div>

            {/* Party */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Party</label>
              <input
                placeholder="e.g. People First"
                value={candidateForm.party}
                onChange={(e) => setCandidateForm({ ...candidateForm, party: e.target.value })}
                className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 transition"
              />
            </div>

            {/* Year */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Election Year</label>
              <input
                type="number"
                placeholder="2025"
                value={candidateForm.election_year}
                onChange={(e) => setCandidateForm({ ...candidateForm, election_year: e.target.value })}
                className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 transition"
              />
            </div>

            {/* Color */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Bar Color</label>
              <div className="flex items-center gap-3 border border-slate-200 rounded-lg px-3 py-2 bg-white">
                <input
                  type="color"
                  value={candidateForm.color}
                  onChange={(e) => setCandidateForm({ ...candidateForm, color: e.target.value })}
                  className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
                />
                <span className="text-sm text-slate-500 font-mono">{candidateForm.color}</span>
              </div>
            </div>

            {/* Submit */}
            <div className="flex flex-col gap-1.5 justify-end">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide opacity-0 select-none">Action</label>
              <button
                onClick={addCandidate}
                disabled={saving}
                className="w-full bg-slate-900 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Adding…" : "+ Add Candidate"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Candidates Table ── */}
      <SectionHeading>All Candidates</SectionHeading>
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 flex-wrap gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Candidate List</h2>
            <p className="text-xs text-slate-400 mt-0.5">Filtered by year and position</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <FilterSelect label="Year"     value={selectedYear}     onChange={setSelectedYear}     options={FILTER_OPTIONS.year.map((y) => ({ value: y, label: y }))} />
            <FilterSelect label="Position" value={selectedPosition} onChange={setSelectedPosition} options={FILTER_OPTIONS.position.map((p) => ({ value: p, label: p }))} />
            <input
              type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or party…"
              className="h-7 w-44 rounded-lg border border-slate-200 bg-slate-50 pl-3 pr-3 text-xs placeholder:text-slate-400 outline-none focus:ring-1 focus:ring-slate-300"
            />
            <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">{filteredCandidates.length}</span>
          </div>
        </div>

        <div className="grid grid-cols-[1fr_130px_170px_90px_100px] text-xs font-bold uppercase tracking-wide text-slate-400 px-6 py-3 border-b border-slate-100 bg-slate-50">
          <div>Name</div><div>Position</div><div>Party</div><div>Year</div><div></div>
        </div>

        <div className="divide-y divide-slate-100">
          {filteredCandidates.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm text-slate-400">No candidates match your filters.</p>
              <p className="text-xs text-slate-300 mt-1">Try changing the year or position filter.</p>
            </div>
          ) : filteredCandidates.map((row, idx) => (
            <div key={row.id ?? idx} className="grid grid-cols-[1fr_130px_170px_90px_100px] items-center px-6 py-3.5 text-sm hover:bg-slate-50 transition">
              <div className="font-semibold text-slate-800 truncate">{row.full_name}</div>
              <div>
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${row.position === "mayor" ? "bg-emerald-50 text-emerald-700" : "bg-sky-50 text-sky-700"}`}>
                  {formatPosition(row.position)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-slate-600 truncate">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: row.color || "#ccc" }} />
                <span className="truncate">{row.party}</span>
              </div>
              <div className="text-slate-400">{row.election_year}</div>
              <div className="flex gap-3">
                <button onClick={() => editCandidate(row)} className="text-xs text-blue-500 hover:text-blue-700 font-medium">Edit</button>
                <button onClick={() => deleteCandidate(row.id)} className="text-xs text-red-400 hover:text-red-600 font-medium">Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ══════════════════════════════════════════════════════════════════════════════
const AdminVotersDashboard = () => {
  const [activeTab, setActiveTab] = useState("analytics");

  const [standingsYear, setStandingsYear]           = useState("2025");
  const [globalBarangayId, setGlobalBarangayId]     = useState("");
  const [globalBarangayName, setGlobalBarangayName] = useState("All barangays");

  const [stats, setStats]             = useState({ totalBarangays: 0, totalPrecincts: 0, encodedHouseholds: 0, totalVoters: 0 });
  const [barangayRows, setBarangayRows] = useState([]);
  const [insights, setInsights]       = useState({ topBarangay: "—", avgVotersPerHousehold: 0, coverageRate: 0 });
  const [candidates, setCandidates]   = useState([]);
  const [voteStandings, setVoteStandings]     = useState([]);
  const [genderBreakdown, setGenderBreakdown] = useState({ male: 0, female: 0, total: 0 });
  const [ageBreakdown, setAgeBreakdown]       = useState({ Youth: 0, Adult: 0, Senior: 0, Other: 0, total: 0 });
  const [visitProgress, setVisitProgress]     = useState({ visited: 0, not_visited: 0, total: 0, percentage: 0 });

  const [loading, setLoading]                         = useState(true);
  const [error, setError]                             = useState(null);
  const [standingsLoading, setStandingsLoading]       = useState(false);
  const [demographicsLoading, setDemographicsLoading] = useState(false);

  useEffect(() => {
    setLoading(true); setError(null);
    Promise.all([
      axios.get(`${API_BASE}/api/managevoters/dashboard-stats`),
      axios.get(`${API_BASE}/api/managevoters/barangay-analytics`),
      axios.get(`${API_BASE}/api/managevoters/quick-insights`),
      axios.get(`${API_BASE}/api/managevoters/candidates`),
      axios.get(`${API_BASE}/api/managevoters/vote-standings?year=2025`),
      axios.get(`${API_BASE}/api/managevoters/gender-breakdown`),
      axios.get(`${API_BASE}/api/managevoters/age-breakdown`),
      axios.get(`${API_BASE}/api/managevoters/visit-progress`),
    ])
      .then(([s, b, i, c, v, g, ag, vp]) => {
        setStats(s.data); setBarangayRows(b.data); setInsights(i.data);
        setCandidates(Array.isArray(c.data) ? c.data : []);
        setVoteStandings(Array.isArray(v.data) ? v.data : []);
        setGenderBreakdown(g.data); setAgeBreakdown(ag.data); setVisitProgress(vp.data);
        setLoading(false);
      })
      .catch((err) => { setError(err.message || "Failed to fetch data"); setLoading(false); });
  }, []);

  useEffect(() => {
    setStandingsLoading(true);
    axios.get(`${API_BASE}/api/managevoters/vote-standings?year=${standingsYear}`)
      .then((r) => setVoteStandings(Array.isArray(r.data) ? r.data : []))
      .catch(console.error).finally(() => setStandingsLoading(false));
  }, [standingsYear]);

  useEffect(() => {
    setDemographicsLoading(true);
    const q = globalBarangayId ? `?barangay_id=${globalBarangayId}` : "";
    Promise.all([
      axios.get(`${API_BASE}/api/managevoters/gender-breakdown${q}`),
      axios.get(`${API_BASE}/api/managevoters/age-breakdown${q}`),
      axios.get(`${API_BASE}/api/managevoters/visit-progress${q}`),
    ])
      .then(([g, ag, vp]) => { setGenderBreakdown(g.data); setAgeBreakdown(ag.data); setVisitProgress(vp.data); })
      .catch(console.error).finally(() => setDemographicsLoading(false));
  }, [globalBarangayId]);

  const barangayOptions = useMemo(() => [
    { value: "", label: "All barangays" },
    ...barangayRows.map((r) => ({ value: String(r.barangay_id ?? r.id ?? ""), label: r.barangay_name })),
  ], [barangayRows]);

  const handleGlobalBarangayChange = (value) => {
    const match = barangayRows.find((r) => String(r.barangay_id ?? r.id ?? "") === value);
    setGlobalBarangayId(value);
    setGlobalBarangayName(value === "" ? "All barangays" : match?.barangay_name ?? "All barangays");
  };

  const refreshCandidates = useCallback(async () => {
    const res = await axios.get(`${API_BASE}/api/managevoters/candidates`);
    setCandidates(Array.isArray(res.data) ? res.data : []);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 font-poppins flex flex-col">
      <VotersNavbar />

      <div className="max-w-7xl mx-auto w-full px-6 py-8 flex-grow">

        {/* ── Page Header with Tab Switcher ── */}
        <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
            <p className="text-sm text-slate-500 mt-1">
              Bacolod City voter analytics — households, candidates, and barangay data.
            </p>
          </div>
          <PageTabs active={activeTab} onChange={setActiveTab} />
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            ⚠️ {error}
          </div>
        )}

        {/* ── Tab Content ── */}
        {activeTab === "analytics" ? (
          <AnalyticsView
            stats={stats}
            barangayRows={barangayRows}
            insights={insights}
            voteStandings={voteStandings}
            genderBreakdown={genderBreakdown}
            ageBreakdown={ageBreakdown}
            visitProgress={visitProgress}
            loading={loading}
            standingsLoading={standingsLoading}
            demographicsLoading={demographicsLoading}
            standingsYear={standingsYear}
            setStandingsYear={setStandingsYear}
            globalBarangayId={globalBarangayId}
            globalBarangayName={globalBarangayName}
            barangayOptions={barangayOptions}
            handleGlobalBarangayChange={handleGlobalBarangayChange}
          />
        ) : (
          <CandidatesView
            candidates={candidates}
            refreshCandidates={refreshCandidates}
          />
        )}

      </div>

      <Footer />
    </div>
  );
};

export default AdminVotersDashboard;