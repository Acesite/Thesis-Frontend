// src/components/Voters/VotersSidebar.js
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import clsx from "clsx";

import Button from "../AdminCrop/MapControls/Button";

const fmt = (v) => (v ?? v === 0 ? v : "—");
const getHouseholdId = (rec) => rec?.id ?? rec?.household_id ?? null;

const Section = ({ title, children }) => (
  <div className="rounded-xl border border-gray-200 bg-white p-4 mb-4">
    {title && <h3 className="text-sm font-semibold text-gray-900 mb-3">{title}</h3>}
    {children}
  </div>
);

const KV = ({ label, value }) => (
  <div className="flex flex-col">
    <dt className="text-xs uppercase tracking-wide text-gray-500">{label}</dt>
    <dd className="text-sm text-gray-900">{value}</dd>
  </div>
);

export default function VotersSidebar({
  visible,
  zoomToLocation,
  onBarangaySelect,
  records = [],
  selectedRecord,
  onSelectRecord,
  onRefresh,
}) {

  const [selectedBarangay, setSelectedBarangay] = useState("");
  const [selectedPrecinct, setSelectedPrecinct] = useState("");

  const barangayOptions = useMemo(() => {
    const set = new Set();
    (Array.isArray(records) ? records : []).forEach((r) => {
      const name = r?.barangay_name || r?.barangay;
      if (name) set.add(String(name));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [records]);

  const precinctOptions = useMemo(() => {
    const set = new Set();
    (Array.isArray(records) ? records : []).forEach((r) => {
      const p = r?.precinct_no ?? r?.precinct_id;
      if (p !== null && p !== undefined && p !== "") set.add(String(p));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [records]);

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
    let households = 0;
    let voterCount = 0;

    for (const r of filteredRecords) {
      households += 1;
      voterCount += Number(r?.voter_count || 0);
    }

    return { households, voterCount };
  }, [filteredRecords]);

  const selectedId = getHouseholdId(selectedRecord);
  
  const handleBarangayChange = (e) => {
    const barangay = e.target.value;
    setSelectedBarangay(barangay);
    onBarangaySelect?.(barangay ? { name: barangay } : null);
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
            <KV label="Region" value="Western Visayas" />
            <KV label="Province" value="Negros Occidental" />
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
                "shrink-0 inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold border",
                selectedRecord.is_visited
                  ? "bg-green-50 text-green-700 border-green-200"
                  : "bg-yellow-50 text-yellow-700 border-yellow-200",
              ].join(" ")}
            >
              {selectedRecord.is_visited ? "Visited" : "Not visited"}
            </span>

                    {selectedRecord?.is_visited && selectedRecord?.last_visited_at && (
          <div className="text-xs text-gray-500">
            Last visited:{" "}
            {new Date(selectedRecord.last_visited_at).toLocaleString("en-PH", {
              timeZone: "Asia/Manila",
            })}
          </div>
        )}
              <div className="bg-gray-50 rounded-md p-3 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-gray-500">Family Leader</span>
                  <span className="text-gray-900 font-medium">
                    {fmt(selectedRecord.family_leader_name)}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-500">Leader Age</span>
                  <span className="text-gray-900">{fmt(selectedRecord.family_leader_age)}</span>
                </div>

                <div className="flex justify-between pt-2 border-t border-gray-200 mt-2">
                  <span className="text-gray-500">Voter Count</span>
                  <span className="text-gray-900 font-semibold">{fmt(selectedRecord.voter_count)}</span>
                </div>
              </div>

              <div className="bg-gray-50 rounded-md p-3 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-gray-500">Mayor</span>
                  <span className="text-gray-900">
                    {selectedRecord.mayor_name
                      ? `${selectedRecord.mayor_name} (${selectedRecord.mayor_party || "—"})`
                      : "—"}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-500">Vice Mayor</span>
                  <span className="text-gray-900">
                    {selectedRecord.vice_mayor_name
                      ? `${selectedRecord.vice_mayor_name} (${selectedRecord.vice_mayor_party || "—"})`
                      : "—"}
                  </span>
                </div>
              </div>

              <div className="bg-gray-50 rounded-md p-3 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-gray-500">Purok</span>
                  <span className="text-gray-900">{fmt(selectedRecord.purok)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Sitio</span>
                  <span className="text-gray-900">{fmt(selectedRecord.sitio)}</span>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Notes
                </h3>
                <div className="bg-gray-50 rounded-md p-3 text-sm text-gray-900">
                  {selectedRecord.notes ? selectedRecord.notes : "—"}
                </div>
              </div>
            </div>
          </Section>
        )}

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

            <div className="col-span-2 flex items-center justify-between gap-2">
              <p className="text-xs text-gray-600">
                Showing{" "}
                <span className="font-semibold text-gray-900">{filteredRecords.length}</span>{" "}
                household(s)
              </p>
            </div>
          </div>

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