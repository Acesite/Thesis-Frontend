// src/components/AdminDAR/DARsidebar.js
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import clsx from "clsx";

import AgriGISLogo from "../../components/MapboxImages/AgriGIS.png"; // adjust if needed
import Button from "../AdminCrop/MapControls/Button"; // adjust path to your Button

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : "—");
const fmt = (v) => (v ?? v === 0 ? v : "—");

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

// ✅ same style helper as your other code (soft delete / inactive)
function isSoftDeletedDar(rec) {
  if (!rec) return false;

  const yes = (v) =>
    v === 1 || v === "1" || v === true || v === "true" || v === "yes" || v === "y";
  const no = (v) => v === 0 || v === "0" || v === false || v === "false" || v === "no";

  if (
    yes(rec.is_deleted) ||
    yes(rec.deleted) ||
    yes(rec.is_archived) ||
    yes(rec.archived) ||
    yes(rec.is_hidden) ||
    yes(rec.hidden)
  )
    return true;

  if (no(rec.is_active) || no(rec.active)) return true;

  const checkStatusStr = (val) => {
    if (typeof val !== "string") return false;
    const s = val.toLowerCase();
    return ["deleted", "archived", "inactive", "removed"].includes(s);
  };

  if (checkStatusStr(rec.status) || checkStatusStr(rec.record_status)) return true;

  return false;
}

const getDarStatus = (rec) =>
  String(rec?.dar_status ?? rec?.status ?? rec?.award_status ?? "unknown").toLowerCase();

const STATUS_COLORS = {
  awarded: "#10B981",
  approved: "#10B981",
  pending: "#F59E0B",
  cancelled: "#EF4444",
  revoked: "#EF4444",
  unknown: "#3B82F6",
};

const statusColor = (status) => STATUS_COLORS[status] || "#3B82F6";

const DAR_LEGEND = [
  { label: "Awarded / Approved", color: "#10B981" },
  { label: "Pending", color: "#F59E0B" },
  { label: "Cancelled / Revoked", color: "#EF4444" },
  { label: "Other", color: "#3B82F6" },
];

/* ---------- DUMMY LAND DATA (The Land Data) ---------- */
const dummyLandData = {
  land_id: "LD-0001",
  tct_oct_number: "TCT-2025-00123",
  tax_dec_number: "TD-4567-2025",
  total_area: "3.25 ha",
  lot_number: "Lot 12-B",
  land_classification: "Agricultural",
  location_brgy: "Ma-ao",
  municipality_id: "BAGO-01",
  is_split_eligible: true,
};

const AdminDarSidebar = ({
  visible,
  zoomToBarangay,
  onBarangaySelect,

  // ✅ from parent
  records = [],
  selectedRecord,
  onSelectRecord,

  // ✅ map styles switcher (optional but matches your map)
  mapStyles = {},
  setMapStyle,

  // ✅ filters (optional)
  statusFilter = "all",
  setStatusFilter,
  onRefresh,
}) => {
  const [selectedBarangay, setSelectedBarangay] = useState("");
  const [barangayDetails, setBarangayDetails] = useState(null);
  const navigate = useNavigate();

  // ✅ Back button handler (adjust route)
  const handleBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/AdminLanding");
  };

  // barangay coordinates (reuse your list)
  const barangayCoordinates = {
    Abuanan: [122.9844, 10.5275],
    Alianza: [122.92424927088227, 10.471876805354725],
    Atipuluan: [122.94997254227323, 10.51054338526979],
    Bacong: [123.03026270744279, 10.520037893339277],
    Bagroy: [122.87467558102158, 10.47702885963125],
    Balingasag: [122.84330579876998, 10.528672212250575],
    Binubuhan: [122.98236293756698, 10.457428765280468],
    Busay: [122.8936085581886, 10.536447801424544],
    Calumangan: [122.8857773056537, 10.55943773159997],
    Caridad: [122.89676017560787, 10.484855427956782],
    Dulao: [122.94775786836688, 10.549767917490168],
    Ilijan: [123.04567999131407, 10.44537414453059],
    "Lag-asan": [122.84543167453091, 10.519843756585255],
    Mailum: [123.05148249170527, 10.469013722796765],
    "Ma-ao": [123.018102985426, 10.508962844307234],
    Malingin: [122.92533490443519, 10.51102316577104],
    Napoles: [122.86024955431672, 10.510195807139885],
    Pacol: [122.86326134780008, 10.48966963268301],
    Poblacion: [122.83378471878187, 10.535871883140523],
    Sagasa: [122.89592554988106, 10.465232192594353],
    Tabunan: [122.93868999567334, 10.570304584775227],
    Taloc: [122.9100707275183, 10.57850192116514],
  };

  const filteredRecords = useMemo(() => {
    let out = Array.isArray(records) ? records.slice() : [];
    out = out.filter((r) => !isSoftDeletedDar(r));

    if (statusFilter && statusFilter !== "all") {
      out = out.filter((r) => getDarStatus(r) === statusFilter);
    }

    if (selectedBarangay) {
      const brgy = selectedBarangay.toLowerCase();
      out = out.filter((r) => String(r.barangay || "").toLowerCase() === brgy);
    }

    return out;
  }, [records, statusFilter, selectedBarangay]);

  const statusOptions = useMemo(() => {
    const set = new Set();
    (Array.isArray(records) ? records : [])
      .filter((r) => !isSoftDeletedDar(r))
      .forEach((r) => set.add(getDarStatus(r)));
    return Array.from(set).sort();
  }, [records]);

  const handleBarangayChange = (e) => {
    const barangay = e.target.value;
    setSelectedBarangay(barangay);

    if (barangay && barangayCoordinates[barangay]) {
      const coordinates = barangayCoordinates[barangay];
      zoomToBarangay?.(coordinates);

      setBarangayDetails({
        name: barangay,
        coordinates,
      });

      onBarangaySelect?.({ name: barangay, coordinates });
    } else {
      setBarangayDetails(null);
      onBarangaySelect?.(null);
    }
  };

  const selectedStatus = getDarStatus(selectedRecord);
  const selectedColor = statusColor(selectedStatus);

  // ✅ hero preview image (optional)
  const heroUrl =
    selectedRecord?.photo_url ||
    selectedRecord?.image_url ||
    selectedRecord?.photos?.[0] ||
    null;

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
                alt="DAR record"
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="h-full w-full flex flex-col items-center justify-center gap-2">
                <img src={AgriGISLogo} alt="AgriGIS" className="h-10 opacity-70" />
                <p className="text-xs text-gray-500">
                  Select a DAR parcel/marker to see details here.
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
            <KV label="Municipality" value="Bacolod City" />
          </dl>
        </Section>

        {/* THE LAND DATA (dummy) */}
        <Section title="The Land Data">
          <p className="text-[11px] text-gray-500 mb-2">
            Dummy land data for layout only. Replace later with real DAR land table.
          </p>
          <dl className="grid grid-cols-2 gap-3">
            <KV label="Land ID" value={fmt(dummyLandData.land_id)} />
            <KV label="TCT/OCT Number" value={fmt(dummyLandData.tct_oct_number)} />
            <KV label="Tax Dec Number" value={fmt(dummyLandData.tax_dec_number)} />
            <KV label="Total Area" value={fmt(dummyLandData.total_area)} />
            <KV label="Lot Number" value={fmt(dummyLandData.lot_number)} />
            <KV
              label="Land Classification"
              value={fmt(dummyLandData.land_classification)}
            />
            <KV label="Location (Brgy)" value={fmt(dummyLandData.location_brgy)} />
            <KV label="Municipality ID" value={fmt(dummyLandData.municipality_id)} />
            <KV
              label="Split Eligible"
              value={dummyLandData.is_split_eligible ? "Yes" : "No"}
            />
          </dl>
        </Section>

        {/* selected record */}
        {selectedRecord && (
          <Section title="Agrarian Reform Beneficiary">
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">
                    {selectedRecord.owner_name ||
                      selectedRecord.arb_name ||
                      selectedRecord.beneficiary_name ||
                      "Agrarian Reform Beneficiary"}
                  </p>
                  <p className="text-xs text-gray-500">
                    {selectedRecord.barangay ? `Barangay ${selectedRecord.barangay}` : "—"}
                  </p>

                  <div className="mt-2 flex flex-wrap gap-2">
                    <span
                      className="inline-flex items-center gap-1 rounded-full border bg-white px-2.5 py-1 text-xs font-medium"
                      style={{ borderColor: `${selectedColor}55`, color: selectedColor }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: selectedColor }}
                      />
                      {selectedStatus}
                    </span>

                    {selectedRecord.area_ha != null && (
                      <span className="inline-flex items-center gap-1 rounded-full border bg-white px-2.5 py-1 text-xs font-medium border-emerald-200 text-emerald-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        {Number(selectedRecord.area_ha).toFixed(2)} ha
                      </span>
                    )}

                    {selectedRecord.cloa_no && (
                      <span className="inline-flex items-center gap-1 rounded-full border bg-white px-2.5 py-1 text-xs font-medium border-gray-200 text-gray-700">
                        CLOA {selectedRecord.cloa_no}
                      </span>
                    )}

                    {selectedRecord.lot_no && (
                      <span className="inline-flex items-center gap-1 rounded-full border bg-white px-2.5 py-1 text-xs font-medium border-gray-200 text-gray-700">
                        Lot {selectedRecord.lot_no}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <dl className="grid grid-cols-2 gap-3">
                <KV label="CLOA no." value={fmt(selectedRecord.cloa_no)} />
                <KV label="Lot no." value={fmt(selectedRecord.lot_no)} />
                <KV label="Barangay" value={fmt(selectedRecord.barangay)} />
                <KV label="Area (ha)" value={fmt(selectedRecord.area_ha)} />
                <KV
                  label="Award date"
                  value={fmtDate(
                    selectedRecord.award_date || selectedRecord.date_awarded
                  )}
                />
                <KV label="Status" value={fmt(selectedStatus)} />
                <KV label="Tagged by" value={fmt(selectedRecord.admin_name)} />
                <KV label="Tagged on" value={fmtDate(selectedRecord.created_at)} />
              </dl>

              {selectedRecord.note?.trim?.() && (
                <div className="pt-2 border-t border-gray-100">
                  <dt className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                    Note
                  </dt>
                  <dd className="text-sm text-gray-900">
                    {selectedRecord.note.trim()}
                  </dd>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* filters */}
        <Section title="Map filters">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
                Status
              </label>
              <select
                className="w-full border border-gray-300 rounded-md px-2 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                value={statusFilter}
                onChange={(e) => setStatusFilter?.(e.target.value)}
              >
                <option value="all">All</option>
                {statusOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
                Barangay
              </label>
              <select
                value={selectedBarangay}
                onChange={handleBarangayChange}
                className="w-full border border-gray-300 rounded-md px-2 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
              >
                <option value="">All barangays</option>
                {Object.keys(barangayCoordinates).map((brgy) => (
                  <option key={brgy} value={brgy}>
                    {brgy}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-span-2 flex items-center justify-between gap-2">
              <p className="text-xs text-gray-600">
                Showing{" "}
                <span className="font-semibold text-gray-900">
                  {filteredRecords.length}
                </span>{" "}
                record(s)
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
        </Section>

        {/* list */}
        <Section title="Agrarian Reform Beneficiaries">
          {filteredRecords.length === 0 ? (
            <p className="text-sm text-gray-500">
              No records match your filters.
            </p>
          ) : (
            <ol className="space-y-2 text-xs">
              {filteredRecords.map((r) => {
                const st = getDarStatus(r);
                const c = statusColor(st);
                const isActive =
                  selectedRecord && String(selectedRecord.id) === String(r.id);

                const title =
                  r.owner_name ||
                  r.arb_name ||
                  r.beneficiary_name ||
                  r.cloa_no ||
                  `DAR #${r.id}`;

                return (
                  <li
                    key={r.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectRecord?.(r)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelectRecord?.(r);
                      }
                    }}
                    className={clsx(
                      "rounded-lg border px-3 py-2 cursor-pointer transition-colors",
                      isActive
                        ? "border-emerald-300 bg-emerald-50"
                        : "border-gray-100 bg-white hover:bg-gray-50"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {title}
                        </p>
                        <p className="text-[11px] text-gray-500">
                          {r.barangay ? `Brgy. ${r.barangay}` : "—"}
                          {r.cloa_no ? ` · CLOA ${r.cloa_no}` : ""}
                          {r.lot_no ? ` · Lot ${r.lot_no}` : ""}
                        </p>
                      </div>

                      <span
                        className="inline-flex items-center gap-1 rounded-full border bg-white px-2 py-1 text-[11px] font-semibold"
                        style={{ borderColor: `${c}55`, color: c }}
                        title={st}
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: c }}
                        />
                        {st}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </Section>

        {/* barangay overview */}
        {barangayDetails && (
          <Section title="Barangay overview">
            <div className="text-sm text-gray-900">
              <span className="font-medium">{barangayDetails.name}</span>
              <div className="mt-1 text-xs text-gray-500">
                Center: {barangayDetails.coordinates?.join(", ") || "—"}
              </div>
            </div>
          </Section>
        )}

        {/* map layers (optional) */}
        {mapStyles && setMapStyle && Object.keys(mapStyles).length > 0 && (
          <Section title="Map style">
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(mapStyles).map(([label, cfg]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setMapStyle(cfg.url)}
                  className="overflow-hidden rounded-lg border border-gray-200 bg-white hover:shadow-sm"
                  title={label}
                >
                  <img
                    src={cfg.thumbnail}
                    alt={label}
                    className="h-16 w-full object-cover"
                    loading="lazy"
                  />
                  <div className="px-2 py-1 text-[11px] text-gray-700 text-center">
                    {label}
                  </div>
                </button>
              ))}
            </div>
          </Section>
        )}

        {/* legend */}
        <Section title="Legend">
          <details className="text-sm">
            <summary className="cursor-pointer select-none text-gray-900">
              Show status colors
            </summary>
            <ul className="mt-2 space-y-1">
              {DAR_LEGEND.map((x) => (
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

export default AdminDarSidebar;
