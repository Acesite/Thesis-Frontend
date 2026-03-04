// src/components/Voters/TagVotersForm.js
import React from "react";

const Label = ({ children }) => (
  <label className="text-[11px] font-semibold text-gray-700">{children}</label>
);

const Input = (props) => (
  <input
    {...props}
    className={[
      "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm",
      "outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400",
      props.className || "",
    ].join(" ")}
  />
);

const Select = (props) => (
  <select
    {...props}
    className={[
      "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm",
      "outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400",
      props.className || "",
    ].join(" ")}
  />
);

const Textarea = (props) => (
  <textarea
    {...props}
    className={[
      "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm",
      "outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400",
      props.className || "",
    ].join(" ")}
  />
);

export default function TagVotersForm({
  visible,
  tagLngLat,
  form,
  setForm,
  setField,
  barangayList,
  barangayOptions,
  mayorOptions,
  viceMayorOptions,
  onClose,
  onSave,
}) {
  if (!visible || !tagLngLat) return null;

  return (
    <div className="w-full max-w-[560px] bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-200">
      <div className="px-5 py-4 border-b bg-white flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-base font-semibold text-gray-900">Tag Household</div>
          <div className="text-xs text-gray-500 truncate">
            Lat: {tagLngLat.lat.toFixed(6)} | Lng: {tagLngLat.lng.toFixed(6)}
          </div>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-lg border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50"
          onClick={onClose}
        >
          Close
        </button>
      </div>

      <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-1">
            <Label>Barangay</Label>
            <Select
              value={form.barangay_name}
              onChange={(e) => {
                const name = e.target.value;
                const match = barangayList.find(
                  (b) =>
                    b.barangay_name &&
                    b.barangay_name.trim().toLowerCase() ===
                      name.trim().toLowerCase()
                );

                setForm((prev) => ({
                  ...prev,
                  barangay_name: name,
                  barangay_id: match ? match.id : "",
                }));
              }}
            >
              <option value="">Select barangay</option>
              {barangayOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </Select>

            {!!form.barangay_name && (
              <div className="text-[11px] text-gray-500 mt-1">
                Detected/Selected: {form.barangay_name}
              </div>
            )}
          </div>

          <div className="md:col-span-1">
            <Label>Precinct</Label>
            <Input
              value={form.precinct_id}
              onChange={(e) => setField("precinct_id", e.target.value)}
              placeholder="optional"
            />
          </div>

          <div>
            <Label>Purok</Label>
            <Input
              value={form.purok}
              onChange={(e) => setField("purok", e.target.value)}
              placeholder="e.g., Purok 1"
            />
          </div>

          <div>
            <Label>Sitio</Label>
            <Input
              value={form.sitio}
              onChange={(e) => setField("sitio", e.target.value)}
              placeholder="e.g., Sitio A"
            />
          </div>

          <div className="md:col-span-2">
            <Label>Family Leader Name (optional)</Label>
            <Input
              value={form.family_leader_name}
              onChange={(e) => setField("family_leader_name", e.target.value)}
              placeholder="e.g., Juan Dela Cruz"
            />
          </div>

          <div>
            <Label>Age</Label>
            <Input
              type="number"
              min="0"
              max="120"
              value={form.family_leader_age}
              onChange={(e) => setField("family_leader_age", e.target.value)}
              placeholder="e.g., 45"
            />
          </div>

          <div>
            <Label>Voter count</Label>
            <Input
              type="number"
              min="0"
              value={form.voter_count}
              onChange={(e) => setField("voter_count", Number(e.target.value))}
            />
          </div>

          <div>
            <Label>Mayor (optional)</Label>
            <Select
              value={form.mayor_candidate_id || ""}
              onChange={(e) => setField("mayor_candidate_id", e.target.value)}
            >
              <option value="">Select mayor</option>
              {(mayorOptions || []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name} ({c.party || "—"})
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label>Vice Mayor (optional)</Label>
            <Select
              value={form.vice_mayor_candidate_id || ""}
              onChange={(e) => setField("vice_mayor_candidate_id", e.target.value)}
            >
              <option value="">Select vice mayor</option>
              {(viceMayorOptions || []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name} ({c.party || "—"})
                </option>
              ))}
            </Select>
          </div>

          <div className="md:col-span-2">
            <Label>Notes</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setField("notes", e.target.value)}
              rows={4}
              placeholder="Optional notes..."
            />
          </div>
        </div>
      </div>

      <div className="px-5 py-4 border-t bg-white flex items-center justify-end gap-2">
        <button
          type="button"
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm hover:bg-gray-50"
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          type="button"
          className="rounded-lg bg-black px-4 py-2 text-sm text-white hover:bg-gray-900"
          onClick={onSave}
        >
          Save Household
        </button>
      </div>
    </div>
  );
}