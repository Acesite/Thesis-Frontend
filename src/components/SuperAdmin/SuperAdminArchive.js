import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import SuperAdminNav from "../NavBar/SuperAdminNav";
import Footer from "../LandingPage/Footer";

const MODULES = ["All", "Crops"]; // you can add other modules later
const STATUSES = ["All", "Archived", "Deleted"];

const PageBtn = ({ disabled, onClick, aria, children }) => (
  <button
    disabled={disabled}
    onClick={onClick}
    aria-label={aria}
    className={`px-2 py-1 border border-slate-300 rounded-md text-sm ${
      disabled
        ? "text-slate-400 cursor-not-allowed bg-slate-100"
        : "hover:bg-slate-50 text-slate-700"
    }`}
  >
    {children}
  </button>
);

const Badge = ({ children, tone = "default" }) => {
  const map = {
    default: "bg-slate-100 text-slate-700",
    green: "bg-emerald-50 text-emerald-700",
    red: "bg-rose-50 text-rose-700",
    blue: "bg-sky-50 text-sky-700",
    amber: "bg-amber-50 text-amber-700",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
        map[tone] || map.default
      }`}
    >
      {children}
    </span>
  );
};

const toneForStatus = (status) =>
  status === "Deleted" ? "red" : status === "Archived" ? "amber" : "default";

const SuperAdminArchive = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // filters / search
  const [moduleFilter, setModuleFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");

  // selection
  const [checkedIds, setCheckedIds] = useState(new Set());

  // pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);

  // kebab menu (per row)
  const [openMenuId, setOpenMenuId] = useState(null);

  // fetch archived crops
  async function fetchArchive() {
    setLoading(true);
    try {
      const { data } = await axios.get("http://localhost:5000/api/archive/crops");
      const arr = data?.items || [];
      setItems(arr);
    } catch (e) {
      console.error("Archive fetch error:", e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchArchive();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let arr = items.filter((it) => {
      const matchesModule = moduleFilter === "All" || it.module === moduleFilter;
      const matchesStatus = statusFilter === "All" || it.status === statusFilter;
      const matchesSearch =
        !q ||
        it.id.toLowerCase().includes(q) ||
        (it.title || "").toLowerCase().includes(q) ||
        (it.owner || "").toLowerCase().includes(q) ||
        (it.barangay || "").toLowerCase().includes(q) ||
        (it.tags || []).some((t) => (t || "").toLowerCase().includes(q));
      return matchesModule && matchesStatus && matchesSearch;
    });
    return arr.sort(
      (a, b) =>
        new Date(b.archivedAt).getTime() - new Date(a.archivedAt).getTime()
    );
  }, [items, moduleFilter, statusFilter, search]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  const paginated = filtered.slice(start, start + pageSize);

  const visibleIds = useMemo(() => filtered.map((i) => i.id), [filtered]);
  const allChecked = useMemo(
    () => visibleIds.length > 0 && visibleIds.every((id) => checkedIds.has(id)),
    [checkedIds, visibleIds]
  );

  function toggleCheckAll() {
    const next = new Set(checkedIds);
    if (allChecked) {
      visibleIds.forEach((id) => next.delete(id));
    } else {
      visibleIds.forEach((id) => next.add(id));
    }
    setCheckedIds(next);
  }

  function toggleRow(id) {
    const next = new Set(checkedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setCheckedIds(next);
  }

  // helpers to convert display id "C-000123" -> numeric rawId
  const displayIdToRaw = (displayId) => {
    const item = items.find((x) => x.id === displayId);
    return item?.rawId ?? null;
  };

  // Single restore with confirmation (UI-only)
  async function restoreOne(displayId, options = {}) {
    const { skipConfirm = false } = options;
    const rawId = displayIdToRaw(displayId);
    if (!rawId) return;

    if (!skipConfirm) {
      const ok = window.confirm(
        "Are you sure you want to restore this record?"
      );
      if (!ok) {
        setOpenMenuId(null);
        return;
      }
    }

    await axios.post(`http://localhost:5000/api/archive/crops/${rawId}/restore`);
    await fetchArchive();
    const next = new Set(checkedIds);
    next.delete(displayId);
    setCheckedIds(next);
    setOpenMenuId(null);
  }

  async function deleteForeverOne(displayId) {
    const rawId = displayIdToRaw(displayId);
    if (!rawId) return;
    const ok = window.confirm(
      "Permanently delete this record? This cannot be undone."
    );
    if (!ok) return;
    await axios.delete(`http://localhost:5000/api/archive/crops/${rawId}`);
    await fetchArchive();
    const next = new Set(checkedIds);
    next.delete(displayId);
    setCheckedIds(next);
    setOpenMenuId(null);
  }

  // Bulk restore with single confirmation for the group
  async function handleRestoreBulk() {
    const ids = Array.from(checkedIds);
    if (ids.length === 0) return;

    const ok = window.confirm(
      `Are you sure you want to restore ${ids.length} record(s)?`
    );
    if (!ok) return;

    for (const displayId of ids) {
      await restoreOne(displayId, { skipConfirm: true });
    }
  }

  async function handleDeleteForeverBulk() {
    const ids = Array.from(checkedIds);
    if (ids.length === 0) return;

    const ok = window.confirm(
      `Permanently delete ${ids.length} record(s)? This cannot be undone.`
    );
    if (!ok) return;

    for (const displayId of ids) {
      await deleteForeverOne(displayId);
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 font-poppins">
      <SuperAdminNav />

      <main className="ml-[115px] pt-[92px] pr-8 flex-grow">
        <div className="max-w-7xl mx-auto px-6 pb-10">
          {/* Header */}
          <div className="mb-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-[32px] leading-tight font-bold text-slate-900">
                  Archive
                </h1>
                <p className="text-[15px] text-slate-600">
                  Review, filter, restore, or permanently delete archived items.
                  Currently showing Crops.
                </p>
              </div>
              <button
                onClick={fetchArchive}
                className="h-9 px-3 rounded-md border border-slate-300 text-sm bg-white hover:bg-slate-50 shadow-sm"
              >
                Refresh
              </button>
            </div>

            {/* Tools row */}
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
              <div className="flex flex-wrap gap-3">
                {/* Module filter */}
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                    Module
                  </span>
                  <select
                    className="h-10 rounded-full border border-slate-300 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/70"
                    value={moduleFilter}
                    onChange={(e) => {
                      setModuleFilter(e.target.value);
                      setPage(1);
                    }}
                  >
                    {MODULES.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status filter */}
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                    Status
                  </span>
                  <select
                    className="h-10 rounded-full border border-slate-300 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/70"
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setPage(1);
                    }}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Search */}
              <div className="flex items-end">
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                    Search
                  </span>
                  <div className="relative">
                    <div className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 text-xs">
                      🔍︎
                    </div>
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setPage(1);
                      }}
                      placeholder="Search by ID, title, owner, barangay, tag…"
                      className="h-10 w-80 rounded-full border border-slate-300 bg-slate-50 pl-10 pr-4 text-sm placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/70"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Bulk actions bar */}
            {checkedIds.size > 0 && (
              <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2">
                <div className="text-sm text-emerald-800">
                  {checkedIds.size} selected
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleRestoreBulk}
                    className="inline-flex items-center rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
                  >
                    Restore
                  </button>
                  <button
                    onClick={handleDeleteForeverBulk}
                    className="inline-flex items-center rounded-md bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700"
                  >
                    Delete forever
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Table */}
          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500 shadow-sm">
              Loading…
            </div>
          ) : paginated.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-500 shadow-sm">
              No archived items found.
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="grid grid-cols-[32px_minmax(0,0.35fr)_minmax(0,1fr)_minmax(0,0.6fr)_minmax(0,0.6fr)_minmax(0,0.5fr)_minmax(0,0.55fr)_80px] items-center border-b border-slate-200 bg-slate-50 px-6 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                <div>
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={toggleCheckAll}
                    aria-label="Select all"
                  />
                </div>
                <div>ID</div>
                <div>Title</div>
                <div>Module</div>
                <div>Owner / Barangay</div>
                <div>Archived On</div>
                <div>Status</div>
                <div className="text-right pr-2">Actions</div>
              </div>

              <div className="divide-y divide-slate-200">
                {paginated.map((item) => (
                  <div
                    key={item.id}
                    className="grid grid-cols-[32px_minmax(0,0.35fr)_minmax(0,1fr)_minmax(0,0.6fr)_minmax(0,0.6fr)_minmax(0,0.5fr)_minmax(0,0.55fr)_80px] items-start px-6 py-3 text-sm hover:bg-slate-50 transition"
                  >
                    <div className="pt-0.5">
                      <input
                        type="checkbox"
                        checked={checkedIds.has(item.id)}
                        onChange={() => toggleRow(item.id)}
                        aria-label={`Select ${item.id}`}
                      />
                    </div>

                    <div className="min-w-0">
                      <div className="truncate font-medium text-slate-800">
                        {item.id}
                      </div>
                    </div>

                    <div className="min-w-0">
                      <div className="font-medium text-emerald-700">
                        {item.title}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {item.tags?.map((t) => (
                          <Badge key={t}>{t}</Badge>
                        ))}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500">
                        Archived by: {item.archivedBy || "—"}
                      </div>
                    </div>

                    <div className="min-w-0">
                      <Badge tone="blue">{item.module}</Badge>
                    </div>

                    <div className="min-w-0">
                      <div className="text-slate-700">{item.owner || "—"}</div>
                      <div className="text-[11px] text-slate-500">
                        {item.barangay || "—"}
                      </div>
                    </div>

                    <div className="min-w-0">
                      <div className="text-slate-700">
                        {item.archivedAt
                          ? new Date(item.archivedAt).toLocaleString()
                          : "—"}
                      </div>
                    </div>

                    <div className="min-w-0">
                      <Badge tone={toneForStatus(item.status)}>
                        {item.status}
                      </Badge>
                    </div>

                    {/* Actions: kebab menu */}
                    <div className="min-w-0">
                      <div className="relative flex justify-end">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenMenuId((prev) =>
                              prev === item.id ? null : item.id
                            )
                          }
                          className="inline-flex items-center justify-center rounded-full h-8 w-8 text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                          title="More actions"
                        >
                          <span className="text-lg leading-none">⋮</span>
                        </button>

                        {openMenuId === item.id && (
                          <div className="absolute right-0 top-9 z-10 w-36 rounded-md border border-slate-200 bg-white shadow-lg text-[13px]">
                            <button
                              onClick={() => restoreOne(item.id)}
                              className="w-full text-left px-3 py-2 hover:bg-emerald-50 text-emerald-700"
                            >
                              Restore
                            </button>
                            <button
                              onClick={() => deleteForeverOne(item.id)}
                              className="w-full text-left px-3 py-2 hover:bg-rose-50 text-rose-700 border-t border-slate-100"
                            >
                              Delete forever
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pagination */}
          {total > 0 && (
            <div className="mt-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="text-sm text-slate-600">
                Showing{" "}
                <span className="font-medium">
                  {total === 0 ? 0 : start + 1}
                </span>
                {"–"}
                <span className="font-medium">
                  {Math.min(start + pageSize, total)}
                </span>{" "}
                of <span className="font-medium">{total}</span>
              </div>

              <div className="flex items-center gap-3">
                <select
                  className="border border-slate-300 px-2 py-1 rounded-md bg-white text-sm"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                >
                  {[8, 12, 16, 24].map((n) => (
                    <option key={n} value={n}>
                      {n} per page
                    </option>
                  ))}
                </select>

                <div className="inline-flex items-center gap-1">
                  <PageBtn
                    disabled={page === 1}
                    onClick={() => setPage(1)}
                    aria="First"
                  >
                    «
                  </PageBtn>
                  <PageBtn
                    disabled={page === 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    aria="Previous"
                  >
                    ‹
                  </PageBtn>
                  <span className="px-3 text-sm text-slate-700">
                    Page {page} of {totalPages}
                  </span>
                  <PageBtn
                    disabled={page === totalPages}
                    onClick={() =>
                      setPage((p) => Math.min(totalPages, p + 1))
                    }
                    aria="Next"
                  >
                    ›
                  </PageBtn>
                  <PageBtn
                    disabled={page === totalPages}
                    onClick={() => setPage(totalPages)}
                    aria="Last"
                  >
                    »
                  </PageBtn>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <div className="mt-5">
        <Footer />
      </div>
    </div>
  );
};

export default SuperAdminArchive;
