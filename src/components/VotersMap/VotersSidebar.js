// src/components/Voters/VotersSidebar.js
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import clsx from "clsx";

import AgriGISLogo from "../../components/MapboxImages/AgriGIS.png"; // same as DAR sidebar
import Button from "../AdminCrop/MapControls/Button"; // reuse your button

const fmt = (v) => (v ?? v === 0 ? v : "—");

const formatCoordinate = (val) => {
  if (val === null || val === undefined || val === "") return "—";
  const num = Number(val);
  if (Number.isNaN(num)) return String(val);
  return num.toFixed(6);
};

const toInt = (v, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : def;
};

const computeSupportRatio = (rec) => {
  const eligible = toInt(rec?.eligible_voters, 0);
  const yes = toInt(rec?.voting_for_us, 0);
  if (eligible <= 0) return null;
  return yes / eligible;
};

const getSupportLevel = (rec) => {
  const r = computeSupportRatio(rec);
  if (r === null) return "unknown";
  if (r >= 0.6) return "high";
  if (r >= 0.3) return "medium";
  return "low";
};

const SUPPORT_COLORS = {
  high: "#10B981", // green
  medium: "#F59E0B", // yellow
  low: "#EF4444", // red
  unknown: "#3B82F6", // blue
};

const VOTERS_LEGEND = [
  { label: "High support (≥ 60%)", color: SUPPORT_COLORS.high },
  { label: "Medium support (30–59%)", color: SUPPORT_COLORS.medium },
  { label: "Low support (< 30%)", color: SUPPORT_COLORS.low },
  { label: "Unknown / no eligible", color: SUPPORT_COLORS.unknown },
];

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
    <dd className="text-sm text-gray-900">{value}</dd>
  </div>
);

// flexible ID getter (for markers/list highlight)
const getHouseholdId = (rec) => rec?.id ?? rec?.household_id ?? null;

const VotersSidebar = ({
  visible,

  // map helpers from parent (optional)
  zoomToLocation,
  onBarangaySelect,

  // data from VotersMap parent
  records = [], // households array
  selectedRecord, // selected household
  onSelectRecord, // click record in list -> select + flyTo on map (parent)

  // optional style switcher, keep same signature as DAR sidebar
  mapStyles = {},
  setMapStyle,

  // filters
  onRefresh,
}) => {
  const navigate = useNavigate();

  const [selectedBarangay, setSelectedBarangay] = useState("");
  const [selectedPrecinct, setSelectedPrecinct] = useState("");
  const [supportFilter, setSupportFilter] = useState("all"); // all|high|medium|low|unknown

  // ✅ Back button handler (kept same behavior)
  const handleBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/AdminLanding");
  };

  // barangay list derived from records (since voters uses DB barangays)
  const barangayOptions = useMemo(() => {
    const set = new Set();
    (Array.isArray(records) ? records : []).forEach((r) => {
      const name = r?.barangay_name || r?.barangay;
      if (name) set.add(String(name));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [records]);

  // precinct list derived from records
  const precinctOptions = useMemo(() => {
    const set = new Set();
    (Array.isArray(records) ? records : []).forEach((r) => {
      const p = r?.precinct_no;
      if (p) set.add(String(p));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [records]);

  // filtered records
  const filteredRecords = useMemo(() => {
    let out = Array.isArray(records) ? records.slice() : [];

    if (selectedBarangay) {
      const brgy = selectedBarangay.toLowerCase();
      out = out.filter(
        (r) => String(r?.barangay_name || r?.barangay || "").toLowerCase() === brgy
      );
    }

    if (selectedPrecinct) {
      out = out.filter((r) => String(r?.precinct_no || "") === selectedPrecinct);
    }

    if (supportFilter !== "all") {
      out = out.filter((r) => getSupportLevel(r) === supportFilter);
    }

    return out;
  }, [records, selectedBarangay, selectedPrecinct, supportFilter]);

  // computed totals for sidebar summary
  const totals = useMemo(() => {
    const base = {
      households: 0,
      eligible: 0,
      yes: 0,
      undecided: 0,
      no: 0,
    };

    for (const r of filteredRecords) {
      base.households += 1;
      base.eligible += toInt(r?.eligible_voters, 0);
      base.yes += toInt(r?.voting_for_us, 0);
      base.undecided += toInt(r?.undecided, 0);
      base.no += toInt(r?.not_supporting, 0);
    }
    return base;
  }, [filteredRecords]);

  const selectedId = getHouseholdId(selectedRecord);

  const selectedSupportRatio = selectedRecord ? computeSupportRatio(selectedRecord) : null;
  const selectedSupportLevel = selectedRecord ? getSupportLevel(selectedRecord) : "unknown";
  const selectedSupportColor = SUPPORT_COLORS[selectedSupportLevel] || SUPPORT_COLORS.unknown;

  // hero preview image (optional if you later add photo_url)
  const heroUrl =
    selectedRecord?.photo_url ||
    selectedRecord?.image_url ||
    selectedRecord?.photos?.[0] ||
    null;

  const handleBarangayChange = (e) => {
    const barangay = e.target.value;
    setSelectedBarangay(barangay);

    // You might not have coordinates by barangay since no polygons.
    // But if parent provides a handler, still call it.
    onBarangaySelect?.(barangay ? { name: barangay } : null);
  };

  const handleSelect = (rec) => {
    onSelectRecord?.(rec);

    // optional flyTo (if parent passes zoomToLocation)
    const lat = Number(rec?.lat);
    const lng = Number(rec?.lng);
    if (zoomToLocation && Number.isFinite(lat) && Number.isFinite(lng)) {
      zoomToLocation([lng, lat]);
    }
  };

  return (
    <div
      className={clsx(
        "absolute top-0 left-0 h-full bg-gray-50 z-20 overflow-y-auto border-r border-gray-200",
        visible ? "w-[500px]" : "w-0 overflow-hidden"
      )}
    >
      <div className={clsx("transition-all", visible ? "px-6 py-6" : "px-0 py-0")}>
        {/* hero */}
        <div className="mb-4">
          <div className="relative w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-50 aspect-[16/9]">
            {heroUrl ? (
              <img
                src={heroUrl}
                alt="Household"
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="h-full w-full flex flex-col items-center justify-center gap-2">
                <img src={AgriGISLogo} alt="AgriGIS" className="h-10 opacity-70" />
                <p className="text-xs text-gray-500">
                  Click a household marker to see voter details here.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* back */}
        <div className="mb-4">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            title="Go back"
          >
            ← Back
          </button>
        </div>

        {/* location */}
        <Section title="Location">
          <dl className="grid grid-cols-3 gap-3">
            <KV label="Region" value="Western Visayas" />
            <KV label="Province" value="Negros Occidental" />
            <KV label="City" value="Bacolod City" />
          </dl>
        </Section>

        {/* Selected household */}
        {selectedRecord && (
          <Section title="Household Voters">
            <div className="space-y-4">
              {/* header */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    Household #{fmt(selectedId)}
                  </p>
                  <p className="text-xs text-gray-500">
                    Barangay: {fmt(selectedRecord.barangay_name)}
                    {selectedRecord.precinct_no ? ` • Precinct: ${selectedRecord.precinct_no}` : ""}
                  </p>
                </div>

                <span
                  className="inline-flex items-center gap-2 rounded-full px-2 py-1 text-xs font-semibold"
                  style={{
                    backgroundColor: `${selectedSupportColor}1A`,
                    color: selectedSupportColor,
                    border: `1px solid ${selectedSupportColor}40`,
                  }}
                >
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{ backgroundColor: selectedSupportColor }}
                  />
                  {selectedSupportLevel.toUpperCase()}
                </span>
              </div>

              {/* voter counts */}
              <section>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Voter Counts
                </h3>
                <div className="bg-gray-50 rounded-md p-3 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Eligible voters</span>
                    <span className="font-medium text-gray-900">
                      {fmt(selectedRecord.eligible_voters)}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-500">Voting for us</span>
                    <span className="text-gray-900">{fmt(selectedRecord.voting_for_us)}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-500">Undecided</span>
                    <span className="text-gray-900">{fmt(selectedRecord.undecided)}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-500">Not supporting</span>
                    <span className="text-gray-900">{fmt(selectedRecord.not_supporting)}</span>
                  </div>

                  <div className="flex justify-between pt-2 border-t border-gray-200 mt-2">
                    <span className="text-gray-500">Support %</span>
                    <span className="text-gray-900">
                      {selectedSupportRatio === null
                        ? "—"
                        : `${Math.round(selectedSupportRatio * 100)}%`}
                    </span>
                  </div>
                </div>
              </section>

              {/* household location */}
              <section>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Household Info
                </h3>
                <div className="bg-gray-50 rounded-md p-3 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Purok</span>
                    <span className="text-gray-900">{fmt(selectedRecord.purok)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Sitio</span>
                    <span className="text-gray-900">{fmt(selectedRecord.sitio)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Latitude</span>
                    <span className="text-gray-900">
                      {formatCoordinate(selectedRecord.lat)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Longitude</span>
                    <span className="text-gray-900">
                      {formatCoordinate(selectedRecord.lng)}
                    </span>
                  </div>
                </div>
              </section>

              {/* notes */}
              <section>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Notes
                </h3>
                <div className="bg-gray-50 rounded-md p-3 text-sm text-gray-900">
                  {selectedRecord.notes ? selectedRecord.notes : "—"}
                </div>
              </section>
            </div>
          </Section>
        )}

        {/* Filters */}
        <Section title="Map filters">
          <div className="grid grid-cols-2 gap-3">
            {/* barangay */}
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

            {/* precinct */}
            <div>
              <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
                Precinct
              </label>
              <select
                value={selectedPrecinct}
                onChange={(e) => setSelectedPrecinct(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-2 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="">All precincts</option>
                {precinctOptions.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            {/* support */}
            <div className="col-span-2">
              <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
                Support level
              </label>
              <select
                value={supportFilter}
                onChange={(e) => setSupportFilter(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-2 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="all">All</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>

            <div className="col-span-2 flex items-center justify-between gap-2">
              <p className="text-xs text-gray-600">
                Showing{" "}
                <span className="font-semibold text-gray-900">
                  {filteredRecords.length}
                </span>{" "}
                household(s)
              </p>

              <button
                type="button"
                onClick={() => onRefresh?.()}
                className="rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Refresh
              </button>
            </div>
          </div>

          {/* quick totals */}
          <div className="mt-3 rounded-lg border border-gray-200 bg-white p-3">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Households</span>
                <span className="font-semibold text-gray-900">{totals.households}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Eligible</span>
                <span className="font-semibold text-gray-900">{totals.eligible}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">For us</span>
                <span className="font-semibold text-gray-900">{totals.yes}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Undecided</span>
                <span className="font-semibold text-gray-900">{totals.undecided}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Not supporting</span>
                <span className="font-semibold text-gray-900">{totals.no}</span>
              </div>
            </div>
          </div>
        </Section>

        {/* Legend */}
        <Section title="Legend">
          <details className="text-sm">
            <summary className="cursor-pointer select-none text-gray-900">
              Show marker colors
            </summary>
            <ul className="mt-2 space-y-1">
              {VOTERS_LEGEND.map((x) => (
                <li key={x.label} className="flex items-center">
                  <span
                    className="inline-block w-3.5 h-3.5 rounded-full mr-2"
                    style={{ backgroundColor: x.color }}
                  />
                  {x.label}
                </li>
              ))}
            </ul>
          </details>
        </Section>

        {/* Household list */}
        <Section title="Households">
          {filteredRecords.length === 0 ? (
            <p className="text-sm text-gray-500">No households found.</p>
          ) : (
            <div className="space-y-2">
              {filteredRecords.slice(0, 200).map((r) => {
                const id = getHouseholdId(r);
                const level = getSupportLevel(r);
                const color = SUPPORT_COLORS[level] || SUPPORT_COLORS.unknown;

                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleSelect(r)}
                    className={clsx(
                      "w-full text-left rounded-lg border px-3 py-2 transition",
                      String(id) === String(selectedId)
                        ? "border-purple-400 bg-purple-50"
                        : "border-gray-200 bg-white hover:bg-gray-50"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-gray-900 truncate">
                          Household #{id}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {r.barangay_name || "—"}
                          {r.precinct_no ? ` • Precinct ${r.precinct_no}` : ""}
                        </div>
                      </div>

                      <span className="inline-flex items-center gap-2 text-xs font-semibold">
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        {level.toUpperCase()}
                      </span>
                    </div>

                    <div className="mt-2 grid grid-cols-4 gap-2 text-[11px] text-gray-700">
                      <div className="flex flex-col">
                        <span className="text-gray-500">Eligible</span>
                        <span className="font-semibold">{fmt(r.eligible_voters)}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-gray-500">For us</span>
                        <span className="font-semibold">{fmt(r.voting_for_us)}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-gray-500">Und</span>
                        <span className="font-semibold">{fmt(r.undecided)}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-gray-500">No</span>
                        <span className="font-semibold">{fmt(r.not_supporting)}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {filteredRecords.length > 200 && (
            <p className="mt-3 text-[11px] text-gray-500">
              Showing first 200 results. Add more filters to narrow.
            </p>
          )}
        </Section>

        {/* home */}
        <div className="mt-5 flex gap-2">
          <Button to="/AdminLanding" variant="outline" size="md">
            Home
          </Button>
        </div>
      </div>
    </div>
  );
};

export default VotersSidebar;