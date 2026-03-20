import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import clsx from "clsx";

import Button from "../AdminCrop/MapControls/Button";
import BARANGAYS from "../VotersMap/Data/Barangays";
import { BACOLOD_PRECINCTS } from "./Data/BacolodPrecints";

const fmt = (v) => (v ?? v === 0 ? v : "—");
const getHouseholdId = (rec) => rec?.id ?? rec?.household_id ?? null;

const Divider = () => <div className="border-t border-gray-100 my-5" />;

const Label = ({ children }) => (
  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">
    {children}
  </p>
);

const KV = ({ label, value }) => (
  <div className="flex items-start justify-between gap-2 py-2 border-b border-gray-50 last:border-0">
    <dt className="text-xs text-gray-400 shrink-0">{label}</dt>
    <dd className="text-xs font-semibold text-gray-800 text-right break-words">{value}</dd>
  </div>
);

const ColorByPill = ({ label, active, color, onClick }) => (
  <button
    onClick={onClick}
    className={[
      "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all",
      active
        ? "bg-gray-900 border-gray-900 text-white"
        : "bg-white border-gray-200 text-gray-600 hover:border-gray-400",
    ].join(" ")}
  >
    <span
      className="w-2 h-2 rounded-full flex-shrink-0"
      style={{ backgroundColor: active ? "#fff" : color }}
    />
    {label}
  </button>
);

// ── Sidebar ───────────────────────────────────────────────────────────────────

export default function VotersSidebar({
  visible,
  zoomToLocation,
  onBarangaySelect,
  records = [],
  selectedRecord,
  onSelectRecord,
  onRefresh,
  onFilterChange,
  onColorByChange,
  candidates = [],
}) {
  const navigate = useNavigate();

  const [selectedBarangay, setSelectedBarangay] = useState("");
  const [selectedPrecinct, setSelectedPrecinct] = useState("");
  const [colorBy, setColorBy] = useState("none");

  const barangayOptions = useMemo(
    () => [...BARANGAYS].sort((a, b) => a.localeCompare(b)),
    []
  );

  const filteredRecords = useMemo(() => {
    let out = Array.isArray(records) ? records.slice() : [];
    if (selectedBarangay) {
      const brgy = selectedBarangay.toLowerCase();
      out = out.filter(
        (r) => String(r?.barangay_name || r?.barangay || "").toLowerCase() === brgy
      );
    }
    if (selectedPrecinct) {
      out = out.filter(
        (r) => String(r?.precinct_no ?? r?.precinct_id ?? "") === selectedPrecinct
      );
    }
    return out;
  }, [records, selectedBarangay, selectedPrecinct]);

  const totals = useMemo(() => {
    let households = 0, voterCount = 0;
    for (const r of filteredRecords) {
      households += 1;
      voterCount += Number(r?.voter_count || 0);
    }
    return { households, voterCount };
  }, [filteredRecords]);

  const selectedId = getHouseholdId(selectedRecord);

  const mayorCandidates     = useMemo(() => candidates.filter((c) => c.position === "mayor"), [candidates]);
  const viceMayorCandidates = useMemo(() => candidates.filter((c) => c.position === "vice_mayor"), [candidates]);

  const activeLegend = useMemo(() => {
    if (colorBy === "mayor") return mayorCandidates;
    if (colorBy === "vice_mayor") return viceMayorCandidates;
    return [];
  }, [colorBy, mayorCandidates, viceMayorCandidates]);

  const handleBarangayChange = (e) => {
    const barangay = e.target.value;
    setSelectedBarangay(barangay);
    setSelectedPrecinct("");
    onBarangaySelect?.(barangay ? { name: barangay } : null);
    onFilterChange?.({ barangay, precinct: "" });
  };

  const handlePrecinctChange = (e) => {
    const precinct = e.target.value;
    setSelectedPrecinct(precinct);
    onFilterChange?.({ barangay: selectedBarangay, precinct });
  };

  const handleColorBy = (value) => {
    const next = colorBy === value ? "none" : value;
    setColorBy(next);
    onColorByChange?.(next);
  };

  const isFiltered = selectedBarangay || selectedPrecinct;

  return (
    <div className={clsx("h-full w-full bg-white overflow-y-auto flex flex-col", visible ? "block" : "hidden")}>

      {/* ── Logo Area ── */}
     <div className="flex items-center justify-center border-b border-gray-100 px-5 py-3">
<img src="/images/logo vista.png" alt="VISTA" className="h-45 w-auto object-contain" />
        <div className="flex flex-col items-center gap-1">
        </div>
      </div>

      <div className="px-5 py-6 flex-1">

        {/* ── Location ── */}
        <Label>Location</Label>
        <div className="grid grid-cols-3 gap-2 mb-1">
          {[["Region", "NIR"], ["Province", "Negros Occ"], ["City", "Bacolod City"]].map(([k, v]) => (
            <div key={k} className="rounded-lg bg-gray-50 px-3 py-2 text-center">
              <p className="text-[10px] text-gray-400">{k}</p>
              <p className="text-xs font-semibold text-gray-800 mt-0.5">{v}</p>
            </div>
          ))}
        </div>

        <Divider />

        {/* ── Household Details ── */}
        {selectedRecord && (
          <>
            <Label>Household Details</Label>
            <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 mb-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-sm font-bold text-gray-900">
                    Household #{fmt(selectedId)}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {fmt(selectedRecord.barangay_name)}
                    {(selectedRecord.precinct_no ?? selectedRecord.precinct_id)
                      ? ` · Precinct ${fmt(selectedRecord.precinct_no ?? selectedRecord.precinct_id)}`
                      : ""}
                  </p>
                </div>
                <span className={[
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border",
                  selectedRecord.is_visited
                    ? "bg-green-50 text-green-700 border-green-200"
                    : "bg-yellow-50 text-yellow-700 border-yellow-200",
                ].join(" ")}>
                  {selectedRecord.is_visited ? "Visited" : "Not visited"}
                </span>
              </div>

              <dl className="space-y-0">
                <KV label="Family Leader"   value={fmt(selectedRecord.family_leader_name)} />
                <KV label="Voters"          value={fmt(selectedRecord.voter_count)} />
                <KV label="Age"             value={fmt(selectedRecord.family_leader_age)} />
                <KV label="Gender"          value={fmt(selectedRecord.family_leader_gender)} />
                <KV label="Purok"           value={fmt(selectedRecord.purok)} />
                <KV label="Sitio"           value={fmt(selectedRecord.sitio)} />
                <KV label="Mayor Vote"      value={fmt(selectedRecord.mayor_vote)} />
                <KV label="Vice Mayor Vote" value={fmt(selectedRecord.vice_mayor_vote)} />
              </dl>

              {selectedRecord.notes && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-[10px] text-gray-400 mb-1">Notes</p>
                  <p className="text-xs text-gray-700">{selectedRecord.notes}</p>
                </div>
              )}
            </div>
            <Divider />
          </>
        )}

        {/* ── Color Markers By ── */}
        <Label>Color Markers By</Label>
        <div className="flex flex-wrap gap-2 mb-3">
          <ColorByPill label="Mayor"      active={colorBy === "mayor"}      color="#6366f1" onClick={() => handleColorBy("mayor")} />
          <ColorByPill label="Vice Mayor" active={colorBy === "vice_mayor"} color="#f59e0b" onClick={() => handleColorBy("vice_mayor")} />
          {colorBy !== "none" && (
            <button
              onClick={() => handleColorBy("none")}
              className="px-3 py-1.5 rounded-full border border-gray-200 text-xs text-gray-400 hover:text-gray-600 transition bg-white"
            >
              Reset
            </button>
          )}
        </div>

        {activeLegend.length > 0 && (
          <div className="space-y-1.5 mb-1">
            {activeLegend
              .filter((c) => c.full_name !== "Undecided")
              .map((c) => (
                <div key={c.id} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.color || "#6b7280" }} />
                  <span className="text-xs font-medium text-gray-700">{c.full_name}</span>
                  <span className="text-[10px] text-gray-400 ml-auto">{c.party}</span>
                </div>
              ))}
          </div>
        )}

        <Divider />

        {/* ── Map Filters ── */}
        <Label>Map Filters</Label>
        <div className="space-y-3">
          <div>
            <p className="text-xs text-gray-500 mb-1">Barangay</p>
            <select
              value={selectedBarangay}
              onChange={handleBarangayChange}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:ring-1 focus:ring-purple-400 focus:border-purple-400 outline-none"
            >
              <option value="">All barangays</option>
              {barangayOptions.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          <div>
            <p className="text-xs text-gray-500 mb-1">Precinct</p>
            <select
              value={selectedPrecinct}
              onChange={handlePrecinctChange}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:ring-1 focus:ring-purple-400 focus:border-purple-400 outline-none"
            >
              <option value="">All precincts</option>
              {BACOLOD_PRECINCTS.map((district, dIndex) => (
                <optgroup key={district.district} label={district.district.replace("📌 ", "")}>
                  {district.schools.map((school, sIndex) => {
                    const [start, end] = school.range;
                    const precincts = [];
                    for (let p = start; p <= end; p++) {
                      const code = `${String(dIndex + 1).padStart(2, "0")}${String(p).padStart(2, "0")}A`;
                      precincts.push(<option key={code} value={p}>{code}</option>);
                    }
                    return (
                      <React.Fragment key={sIndex}>
                        <option disabled>🏫 {school.name} ({start}–{end})</option>
                        {precincts}
                      </React.Fragment>
                    );
                  })}
                </optgroup>
              ))}
            </select>
          </div>
        </div>

        {/* Filter summary */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-gray-50 px-3 py-2 text-center">
            <p className="text-[10px] text-gray-400">Households</p>
            <p className="text-sm font-bold text-gray-900 mt-0.5">{totals.households}</p>
          </div>
          <div className="rounded-lg bg-gray-50 px-3 py-2 text-center">
            <p className="text-[10px] text-gray-400">Total Voters</p>
            <p className="text-sm font-bold text-gray-900 mt-0.5">{totals.voterCount}</p>
          </div>
        </div>

        {isFiltered && (
          <button
            onClick={() => {
              setSelectedBarangay("");
              setSelectedPrecinct("");
              onFilterChange?.({ barangay: "", precinct: "" });
              onBarangaySelect?.(null);
            }}
            className="mt-2 w-full text-xs text-purple-600 hover:text-purple-800 underline text-center transition"
          >
            Clear filters
          </button>
        )}

        <Divider />

        {/* ── Navigation ── */}
        <Button to="/AdminLanding" variant="outline" size="md">
          Home
        </Button>

      </div>
    </div>
  );
}