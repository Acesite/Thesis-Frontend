import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import clsx from "clsx";

import Button from "../AdminCrop/MapControls/Button";
import BARANGAYS from "../VotersMap/Data/Barangays";
import { BACOLOD_PRECINCTS } from "./Data/BacolodPrecints";

const fmt = (v) => (v ?? v === 0 ? v : "—");
const getHouseholdId = (rec) => rec?.id ?? rec?.household_id ?? null;

const Section = ({ title, children }) => (
  <div className="rounded-xl border border-gray-200 bg-white p-4 mb-4">
    {title && (
      <h3 className="text-sm font-semibold text-gray-900 mb-3">{title}</h3>
    )}
    {children}
  </div>
);

const KV = ({ label, value }) => (
  <div className="flex flex-col">
    <dt className="text-xs uppercase tracking-wide text-gray-500">{label}</dt>
    <dd className="text-sm text-gray-900 break-words">{value}</dd>
  </div>
);

// ── Color-by pill button ──────────────────────────────────────────────────────
const ColorByPill = ({ label, active, color, onClick }) => (
  <button
    onClick={onClick}
    className={[
      "flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-all",
      active
        ? "bg-gray-900 border-gray-900 text-white shadow"
        : "bg-white border-gray-200 text-gray-600 hover:border-gray-400",
    ].join(" ")}
  >
    <span
      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
      style={{ backgroundColor: active ? "#fff" : color }}
    />
    {label}
  </button>
);

export default function VotersSidebar({
  visible,
  zoomToLocation,
  onBarangaySelect,
  records = [],
  selectedRecord,
  onSelectRecord,
  onRefresh,
  onFilterChange,
  onColorByChange, // ✅ new — notifies VotersMap which position to color by
  candidates = [],
}) {
  const navigate = useNavigate();

  const [selectedBarangay, setSelectedBarangay] = useState("");
  const [selectedPrecinct, setSelectedPrecinct] = useState("");
  const [colorBy, setColorBy] = useState("none"); // "none" | "mayor" | "vice_mayor"

  const barangayOptions = useMemo(() => {
    return [...BARANGAYS].sort((a, b) => a.localeCompare(b));
  }, []);

  const filteredRecords = useMemo(() => {
    let out = Array.isArray(records) ? records.slice() : [];

    if (selectedBarangay) {
      const brgy = selectedBarangay.toLowerCase();
      out = out.filter(
        (r) =>
          String(r?.barangay_name || r?.barangay || "").toLowerCase() === brgy
      );
    }

    if (selectedPrecinct) {
      out = out.filter(
        (r) =>
          String(r?.precinct_no ?? r?.precinct_id ?? "") === selectedPrecinct
      );
    }

    return out;
  }, [records, selectedBarangay, selectedPrecinct]);

  const totals = useMemo(() => {
    let households = 0;
    let voterCount = 0;
    for (const r of filteredRecords) {
      households += 1;
      voterCount += Number(r?.voter_count || 0);
    }
    return { households, voterCount };
  }, [filteredRecords]);

  const selectedId = getHouseholdId(selectedRecord);

  const mayorCandidates = useMemo(
    () => candidates.filter((c) => c.position === "mayor"),
    [candidates]
  );

  const viceMayorCandidates = useMemo(
    () => candidates.filter((c) => c.position === "vice_mayor"),
    [candidates]
  );

  // ── Active legend entries based on current colorBy ────────────────────────
  const activeLegend = useMemo(() => {
    if (colorBy === "mayor") return mayorCandidates;
    if (colorBy === "vice_mayor") return viceMayorCandidates;
    return [];
  }, [colorBy, mayorCandidates, viceMayorCandidates]);

  // ── Handlers ──────────────────────────────────────────────────────────────
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
    const next = colorBy === value ? "none" : value; // toggle off if same
    setColorBy(next);
    onColorByChange?.(next);
  };

  return (
    <div
      className={clsx(
        "h-full w-full bg-gray-50 overflow-y-auto",
        visible ? "block" : "hidden"
      )}
    >
      <div className="px-6 py-6">
        <Section title="Location">
          <dl className="grid grid-cols-3 gap-3">
            <KV label="Region" value="NIR" />
            <KV label="Province" value="Negros Occ" />
            <KV label="City" value="Bacolod City" />
          </dl>
        </Section>

        {selectedRecord && (
          <Section title="Household Details">
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  Household #{fmt(selectedId)}
                </p>
                <p className="text-xs text-gray-500">
                  Barangay: {fmt(selectedRecord.barangay_name)}
                  {(selectedRecord.precinct_no ?? selectedRecord.precinct_id)
                    ? ` • Precinct: ${fmt(
                        selectedRecord.precinct_no ?? selectedRecord.precinct_id
                      )}`
                    : ""}
                </p>
              </div>

              <span
                className={[
                  "inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold border",
                  selectedRecord.is_visited
                    ? "bg-green-50 text-green-700 border-green-200"
                    : "bg-yellow-50 text-yellow-700 border-yellow-200",
                ].join(" ")}
              >
                {selectedRecord.is_visited ? "Visited" : "Not visited"}
              </span>

              <dl className="grid grid-cols-2 gap-3">
                <KV label="Family leader" value={fmt(selectedRecord.family_leader_name)} />
                <KV label="Number of Voters" value={fmt(selectedRecord.voter_count)} />
                <KV label="Leader age" value={fmt(selectedRecord.family_leader_age)} />
                <KV label="Leader gender" value={fmt(selectedRecord.family_leader_gender)} />
                <KV label="Purok" value={fmt(selectedRecord.purok)} />
                <KV label="Sitio" value={fmt(selectedRecord.sitio)} />
                <KV label="Mayor" value={fmt(selectedRecord.mayor_vote)} />
                <KV label="Vice Mayor" value={fmt(selectedRecord.vice_mayor_vote)} />
              </dl>

              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                  Notes
                </p>
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 min-h-[44px]">
                  {fmt(selectedRecord.notes)}
                </div>
              </div>
            </div>
          </Section>
        )}

        {/* ✅ Color By Section */}
        <Section title="Color Markers By">
          <div className="flex flex-wrap gap-2">
            <ColorByPill
              label="Mayor"
              active={colorBy === "mayor"}
              color="#6366f1" // indigo as preview dot when inactive
              onClick={() => handleColorBy("mayor")}
            />
            <ColorByPill
              label="Vice Mayor"
              active={colorBy === "vice_mayor"}
              color="#f59e0b" // amber as preview dot when inactive
              onClick={() => handleColorBy("vice_mayor")}
            />
            {colorBy !== "none" && (
              <button
                onClick={() => handleColorBy("none")}
                className="px-3 py-1.5 rounded-full border border-gray-200 text-xs text-gray-400 hover:text-gray-600 hover:border-gray-400 transition-all bg-white"
              >
                Reset
              </button>
            )}
          </div>

          {/* ── Dynamic legend ── */}
          {activeLegend.length > 0 && (
            <div className="mt-3 space-y-1.5 border-t border-gray-100 pt-3">
              {activeLegend.map((c) => (
                <div key={c.id} className="flex items-center gap-2 text-sm">
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: c.color || "#6b7280" }}
                  />
                  <span className="text-gray-800 font-medium">{c.full_name}</span>
                  <span className="text-xs text-gray-400 ml-auto">{c.party}</span>
                </div>
              ))}
             
            </div>
          )}
        </Section>

        <Section title="Map Filters">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
                Barangay
              </label>
              <select
                value={selectedBarangay}
                onChange={handleBarangayChange}
                className="w-full border border-gray-300 rounded-md px-2 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="">All barangays</option>
                {barangayOptions.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
                Precinct
              </label>
              <select
                value={selectedPrecinct}
                onChange={handlePrecinctChange}
                className="w-full border border-gray-300 rounded-md px-2 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="">All precincts</option>
                {BACOLOD_PRECINCTS.map((district, dIndex) => (
                  <optgroup
                    key={district.district}
                    label={district.district.replace("📌 ", "")}
                  >
                    {district.schools.map((school, sIndex) => {
                      const [start, end] = school.range;
                      const precincts = [];
                      for (let p = start; p <= end; p++) {
                        const code = `${String(dIndex + 1).padStart(2, "0")}${String(p).padStart(2, "0")}A`;
                        precincts.push(
                          <option key={code} value={p}>
                            {code}
                          </option>
                        );
                      }
                      return (
                        <React.Fragment key={sIndex}>
                          <option disabled>
                            🏫 {school.name} ({start}–{end})
                          </option>
                          {precincts}
                        </React.Fragment>
                      );
                    })}
                  </optgroup>
                ))}
              </select>
            </div>
          </div>

          {/* Filter summary counts */}
          <div className="mt-3 rounded-lg border border-gray-200 bg-white p-3">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Households</span>
                <span className="font-semibold text-gray-900">{totals.households}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Total voters</span>
                <span className="font-semibold text-gray-900">{totals.voterCount}</span>
              </div>
            </div>
          </div>

          {(selectedBarangay || selectedPrecinct) && (
            <button
              onClick={() => {
                setSelectedBarangay("");
                setSelectedPrecinct("");
                onFilterChange?.({ barangay: "", precinct: "" });
                onBarangaySelect?.(null);
              }}
              className="mt-2 w-full text-xs text-purple-600 hover:text-purple-800 underline text-center"
            >
              Clear filters
            </button>
          )}
        </Section>

        <div className="mt-5 flex gap-2">
          <Button to="/AdminLanding" variant="outline" size="md">
            Home
          </Button>
        </div>
      </div>
    </div>
  );
}