// src/components/VotersMap/TagVotersForm.js
import React, { useMemo, useEffect } from "react";

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

const normalizeName = (name = "") =>
  String(name)
    .trim()
    .toLowerCase()
    .replace(/^brgy\.?\s*/i, "")
    .replace(/^barangay\s*/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const extractBrgyNumber = (name = "") => {
  const match = String(name).match(/\d+/);
  return match ? match[0] : "";
};

const findBarangayMatch = (barangayList = [], name = "") => {
  if (!name || !Array.isArray(barangayList)) return null;

  const normalized = normalizeName(name);

  for (const b of barangayList) {
    const candidate = normalizeName(b?.barangay_name || "");
    if (!candidate) continue;

    if (candidate === normalized) return b;
    if (candidate.includes(normalized)) return b;
    if (normalized.includes(candidate)) return b;
  }

  return null;
};

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
  const finalBarangayOptions = useMemo(() => {
    const base = Array.isArray(barangayOptions) ? [...barangayOptions] : [];

    if (
      form?.barangay_name &&
      !base.some((name) => normalizeName(name) === normalizeName(form.barangay_name))
    ) {
      base.unshift(form.barangay_name);
    }

    return base;
  }, [barangayOptions, form?.barangay_name]);

  useEffect(() => {
    if (!visible) return;
    if (!form?.barangay_name) return;
    if (form?.barangay_id) return;

    const match = findBarangayMatch(barangayList, form.barangay_name);
    if (!match?.id) return;

    setForm((prev) => ({
      ...prev,
      barangay_name: match.barangay_name,
      barangay_id: match.id,
    }));
  }, [visible, form?.barangay_name, form?.barangay_id, barangayList, setForm]);

  if (!visible || !tagLngLat) return null;

  const handleVoterCountChange = (value) => {
    const total = Math.max(1, Number(value) || 1);
    const extraCount = Math.max(0, total - 1);
    const existing = Array.isArray(form.other_members) ? form.other_members : [];

    const resized = Array.from({ length: extraCount }, (_, i) => {
      return existing[i] || { age: "", gender: "" };
    });

    setForm((prev) => ({
      ...prev,
      voter_count: total,
      other_members: resized,
    }));
  };

  const handleOtherMemberChange = (index, key, value) => {
    setForm((prev) => {
      const updated = Array.isArray(prev.other_members)
        ? [...prev.other_members]
        : [];

      updated[index] = {
        ...(updated[index] || { age: "", gender: "" }),
        [key]: value,
      };

      return {
        ...prev,
        other_members: updated,
      };
    });
  };

  const handleBarangayChange = (e) => {
    const name = e.target.value;
    const match = findBarangayMatch(barangayList, name);

    setForm((prev) => ({
      ...prev,
      barangay_name: match?.barangay_name || name,
      barangay_id: match?.id || "",
    }));
  };

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
            <Select value={form.barangay_name || ""} onChange={handleBarangayChange}>
              <option value="">Select barangay</option>
              {finalBarangayOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </Select>
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
            <Label>Family Leader Age</Label>
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
            <Label>Family Leader Gender</Label>
            <Select
              value={form.family_leader_gender || ""}
              onChange={(e) => setField("family_leader_gender", e.target.value)}
            >
              <option value="">Select gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </Select>
          </div>

          <div className="md:col-span-2">
            <Label>Number of Voters</Label>
            <Input
              type="number"
              min="1"
              value={form.voter_count}
              onChange={(e) => handleVoterCountChange(e.target.value)}
            />
          </div>

          {Number(form.voter_count || 0) > 1 && (
            <div className="md:col-span-2">
              <Label>Other Household Members</Label>

              <div className="space-y-3 mt-2">
                {(form.other_members || []).map((member, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-gray-200 p-3"
                  >
                    <Input
                      type="number"
                      min="0"
                      max="120"
                      value={member.age}
                      onChange={(e) =>
                        handleOtherMemberChange(index, "age", e.target.value)
                      }
                      placeholder={`Member ${index + 2} age`}
                    />

                    <Select
                      value={member.gender || ""}
                      onChange={(e) =>
                        handleOtherMemberChange(index, "gender", e.target.value)
                      }
                    >
                      <option value="">Select gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </Select>
                  </div>
                ))}
              </div>

              <div className="text-[11px] text-gray-500 mt-2">
                Family leader is already counted as 1 voter.
              </div>
            </div>
          )}

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