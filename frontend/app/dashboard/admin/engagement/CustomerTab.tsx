// @ts-nocheck
import { useState, useEffect, useRef } from "react";
import {
  Plus, Check, Pencil, Trash2, X, AlertCircle, Users, UserPlus,
  Search, ChevronUp, ChevronDown, ChevronsUpDown, XCircle
} from "lucide-react";
import { apiFetch } from "@/lib/apiClient";

// ── tiny hook: debounce ──────────────────────────────────────────────────────
function useDebounce(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ── sort helper ──────────────────────────────────────────────────────────────
function sortData(data, { key, dir }) {
  if (!key) return data;
  return [...data].sort((a, b) => {
    const av = (a[key] ?? "").toString().toLowerCase();
    const bv = (b[key] ?? "").toString().toLowerCase();
    if (av < bv) return dir === "asc" ? -1 : 1;
    if (av > bv) return dir === "asc" ? 1 : -1;
    return 0;
  });
}

// ── SortIcon component ───────────────────────────────────────────────────────
function SortIcon({ column, sort }) {
  if (sort.key !== column)
    return <ChevronsUpDown size={12} className="text-gray-400 ml-1 inline" />;
  return sort.dir === "asc"
    ? <ChevronUp size={12} className="text-green-600 ml-1 inline" />
    : <ChevronDown size={12} className="text-green-600 ml-1 inline" />;
}

// ────────────────────────────────────────────────────────────────────────────
export default function CustomersTab() {
  // list / pagination
  const [customers, setCustomers]   = useState([]);
  const [page, setPage]             = useState(1);
  const [pageSize]                  = useState(15);
  const [total, setTotal]           = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading]       = useState(false);

  // search
  const [searchQuery, setSearchQuery]         = useState("");
  const [searchResults, setSearchResults]     = useState([]);
  const [isSearching, setIsSearching]         = useState(false);
  const debouncedQuery                        = useDebounce(searchQuery, 350);

  // sorting (client-side over visible rows)
  const [sort, setSort] = useState({ key: "customerName", dir: "asc" });

  // add form
  const [newName, setNewName]       = useState("");
  const [newNo, setNewNo]           = useState("");
  const [newCountry, setNewCountry] = useState("");
  const [newSite, setNewSite]       = useState("");
  const [submitting, setSubmitting] = useState(false);

  // edit
  const [editingId, setEditingId]   = useState(null);
  const [editName, setEditName]     = useState("");
  const [editNo, setEditNo]         = useState("");
  const [editCountry, setEditCountry] = useState("");
  const [editSite, setEditSite]     = useState("");

  // toasts / modals
  const [successMessage, setSuccessMessage]     = useState("");
  const [errorToast, setErrorToast]             = useState("");
  const [deleteConfirmModal, setDeleteConfirmModal] = useState(null);

  const showSuccess = (msg) => { setSuccessMessage(msg); setTimeout(() => setSuccessMessage(""), 3000); };
  const showError   = (msg) => { setErrorToast(msg);     setTimeout(() => setErrorToast(""), 4000);    };

  // ── load paginated list ──────────────────────────────────────────────────
  const loadCustomers = async (p = 1) => {
    setLoading(true);
    try {
      const res = await apiFetch(`/customers?page=${p}&limit=${pageSize}`);
      if (res?.success) {
        setCustomers(res.customers || []);
        setTotal(res.total || 0);
        setPage(res.page || p);
        setTotalPages(res.totalPages || Math.ceil((res.total || 0) / pageSize));
      } else { setCustomers([]); setTotal(0); setTotalPages(0); }
    } catch (err) { console.error(err); showError("Failed to load customers"); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadCustomers(1); }, []);

  // ── debounced search ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setSearchResults([]);
      loadCustomers(1);
      return;
    }
    const run = async () => {
      setIsSearching(true);
      try {
        const res = await apiFetch(`/customers/search?query=${encodeURIComponent(debouncedQuery)}`);
        if (res?.success) setSearchResults(res.results || []);
      } catch (err) { console.error("Search error:", err); }
      finally { setIsSearching(false); }
    };
    run();
  }, [debouncedQuery]);

  const clearSearch = () => { setSearchQuery(""); setSearchResults([]); };

  // ── derived display rows (search OR paginated) + sort ───────────────────
  const isSearchMode = searchQuery.trim().length > 0;
  const baseRows     = isSearchMode ? searchResults : customers;
  const displayRows  = sortData(baseRows, sort);

  // ── column sort toggle ───────────────────────────────────────────────────
  const toggleSort = (key) => {
    setSort(prev =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    );
  };

  // ── add ──────────────────────────────────────────────────────────────────
  const handleAdd = async () => {
    if (!newNo || !newName) { showError("Customer number and name required"); return; }
    setSubmitting(true);
    try {
      const res = await apiFetch("/customers/add-customer", {
        method: "POST",
        body: { customerNo: newNo, customerName: newName, country: newCountry, siteId: newSite },
      });
      if (res?.success) {
        await loadCustomers(1);
        setNewName(""); setNewNo(""); setNewCountry(""); setNewSite("");
        showSuccess("Customer added successfully!");
      } else { showError(res?.error || "Failed to add customer"); }
    } catch (err) {
      showError(err?.response?.data?.error || err?.message || "Failed to add customer");
    } finally { setSubmitting(false); }
  };

  // ── edit ─────────────────────────────────────────────────────────────────
  const startEdit = (c) => {
    setEditingId(c.tblRid);
    setEditName(c.customerName || ""); setEditNo(c.customerNo || "");
    setEditCountry(c.country || ""); setEditSite(c.siteId || "");
  };
  const cancelEdit = () => {
    setEditingId(null); setEditName(""); setEditNo(""); setEditCountry(""); setEditSite("");
  };
  const saveEdit = async (id) => {
    if (!editName) { showError("Name required"); return; }
    try {
      const res = await apiFetch(`/customers/update-customer/${id}`, {
        method: "PUT",
        body: { customerNo: editNo, customerName: editName, country: editCountry, siteId: editSite },
      });
      if (res?.success) {
        await loadCustomers(page);
        cancelEdit();
        showSuccess("Customer updated successfully!");
      } else { showError(res?.error || "Failed to update"); }
    } catch (err) {
      showError(err?.response?.data?.error || err?.message || "Failed to update");
    }
  };

  // ── delete ───────────────────────────────────────────────────────────────
  const confirmDelete = async (id) => {
    try {
      const res = await apiFetch(`/customers/delete-customer/${id}`, { method: "DELETE" });
      if (res?.success) {
        const remaining = customers.length - 1;
        const newPage   = remaining === 0 && page > 1 ? page - 1 : page;
        await loadCustomers(newPage);
        showSuccess("Customer removed successfully!");
      } else { showError(res?.error || "Failed to delete"); }
    } catch (err) {
      showError(err?.response?.data?.error || err?.message || "Failed to delete");
    } finally { setDeleteConfirmModal(null); }
  };

  // ── pagination ───────────────────────────────────────────────────────────
  const goPrev = () => { if (page > 1) loadCustomers(page - 1); };
  const goNext = () => { if (page < totalPages) loadCustomers(page + 1); };

  // ── column header config ─────────────────────────────────────────────────
  const columns = [
    { key: "customerNo",   label: "Customer No" },
    { key: "customerName", label: "Name"        },
    { key: "country",      label: "Country"     },
    { key: "siteId",       label: "Site ID"     },
  ];

  // ────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* ── Add Customer Card ──────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="p-2 bg-green-100 rounded-lg">
              <UserPlus size={18} className="text-green-600" />
            </div>
            <h2 className="text-base font-semibold text-gray-800">Add New Customer</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {[
              { label: "Customer No",   val: newNo,      set: setNewNo,      ph: "e.g. 1001"        },
              { label: "Customer Name", val: newName,    set: setNewName,    ph: "Enter name"       },
              { label: "Country",       val: newCountry, set: setNewCountry, ph: "Enter country"    },
              { label: "Site ID",       val: newSite,    set: setNewSite,    ph: "Enter site ID"    },
            ].map(({ label, val, set, ph }) => (
              <div key={label}>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">{label}</label>
                <input
                  type="text" placeholder={ph} value={val}
                  onChange={(e) => set(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
            ))}

            <div className="flex items-end">
              <button
                onClick={handleAdd}
                disabled={submitting || !newNo.trim() || !newName.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-white text-sm font-medium rounded-lg transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: "linear-gradient(135deg, #004f2d 0%, #00b386 70%)" }}
              >
                {submitting ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Adding...</>
                ) : (
                  <><Plus size={16} />Add Customer</>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* ── Customers List Card ────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">

          {/* Header */}
          <div
            className="px-6 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
            style={{ background: "linear-gradient(135deg, #004f2d 0%, #00b386 70%)" }}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Users size={18} className="text-white" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-white">All Customers</h2>
                <p className="text-xs text-white/70">
                  {isSearchMode
                    ? `${displayRows.length} result${displayRows.length !== 1 ? "s" : ""} for "${searchQuery}"`
                    : `${total} total customer${total !== 1 ? "s" : ""}`}
                </p>
              </div>
            </div>

            {/* Search bar */}
            <div className="flex-1 max-w-sm">
              <div className="relative flex items-center">
                <Search size={15} className="absolute left-3 text-white/60 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search name, no, country, site…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-9 py-2 rounded-lg bg-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50 border border-white/30 text-sm"
                />
                {isSearching && (
                  <div className="absolute right-3 w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                )}
                {searchQuery && !isSearching && (
                  <button
                    onClick={clearSearch}
                    className="absolute right-3 text-white/60 hover:text-white transition-colors"
                  >
                    <XCircle size={15} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Search result banner */}
          {isSearchMode && (
            <div className="mx-6 mt-4 flex items-center justify-between px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <span className="font-semibold">{displayRows.length}</span> result{displayRows.length !== 1 ? "s" : ""} found for{" "}
                <span className="font-semibold">"{searchQuery}"</span>
              </p>
              <button
                onClick={clearSearch}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
              >
                <X size={12} /> Clear search
              </button>
            </div>
          )}

          {/* Table */}
          <div className="p-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-10 h-10 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mb-3" />
                <p className="text-sm text-gray-600">Loading customers…</p>
              </div>
            ) : displayRows.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-gray-100">
                      <th className="text-left py-3 px-4 font-semibold text-gray-500 uppercase text-xs w-10">#</th>
                      {columns.map(({ key, label }) => (
                        <th
                          key={key}
                          className="text-left py-3 px-4 font-semibold text-gray-500 uppercase text-xs cursor-pointer select-none hover:text-green-700 transition-colors"
                          onClick={() => toggleSort(key)}
                        >
                          {label}
                          <SortIcon column={key} sort={sort} />
                        </th>
                      ))}
                      <th className="text-right py-3 px-4 font-semibold text-gray-500 uppercase text-xs">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayRows.map((c, idx) => (
                      <tr
                        key={c.tblRid}
                        className="border-b border-gray-100 hover:bg-green-50/60 transition-colors group"
                      >
                        <td className="py-3 px-4 text-gray-400 text-xs">{idx + 1}</td>

                        {/* Customer No */}
                        <td className="py-3 px-4">
                          {editingId === c.tblRid ? (
                            <input type="text" value={editNo} onChange={(e) => setEditNo(e.target.value)}
                              className="px-3 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 w-full text-sm" />
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-gray-100 text-gray-700 font-mono text-xs font-medium">
                              {c.customerNo}
                            </span>
                          )}
                        </td>

                        {/* Name */}
                        <td className="py-3 px-4">
                          {editingId === c.tblRid ? (
                            <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                              onKeyPress={(e) => e.key === "Enter" && saveEdit(c.tblRid)}
                              className="px-3 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 w-full text-sm" autoFocus />
                          ) : (
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                                style={{ background: "linear-gradient(135deg, #d1fae5, #a7f3d0)" }}>
                                <span className="text-green-700 text-xs font-bold">
                                  {c.customerName.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <span className="text-gray-900 font-medium">{c.customerName}</span>
                            </div>
                          )}
                        </td>

                        {/* Country */}
                        <td className="py-3 px-4">
                          {editingId === c.tblRid ? (
                            <input type="text" value={editCountry} onChange={(e) => setEditCountry(e.target.value)}
                              className="px-3 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 w-full text-sm" />
                          ) : (
                            c.country
                              ? <span className="text-gray-700">{c.country}</span>
                              : <span className="text-gray-300">—</span>
                          )}
                        </td>

                        {/* Site ID */}
                        <td className="py-3 px-4">
                          {editingId === c.tblRid ? (
                            <input type="text" value={editSite} onChange={(e) => setEditSite(e.target.value)}
                              className="px-3 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 w-full text-sm" />
                          ) : (
                            c.siteId
                              ? <span className="inline-flex items-center px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-xs font-medium">{c.siteId}</span>
                              : <span className="text-gray-300">—</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center gap-2 justify-end">
                            {editingId === c.tblRid ? (
                              <>
                                <button onClick={() => saveEdit(c.tblRid)}
                                  className="p-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all" title="Save">
                                  <Check size={14} />
                                </button>
                                <button onClick={cancelEdit}
                                  className="p-1.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all" title="Cancel">
                                  <X size={14} />
                                </button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => startEdit(c)}
                                  className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-all opacity-0 group-hover:opacity-100" title="Edit">
                                  <Pencil size={14} />
                                </button>
                                <button onClick={() => setDeleteConfirmModal(c.tblRid)}
                                  className="p-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-all opacity-0 group-hover:opacity-100" title="Delete">
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  {isSearchMode
                    ? <Search size={28} className="text-gray-400" />
                    : <Users size={28} className="text-gray-400" />}
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-1">
                  {isSearchMode ? "No results found" : "No customers yet"}
                </h3>
                <p className="text-sm text-gray-500">
                  {isSearchMode ? `No customers match "${searchQuery}"` : "Add your first customer above"}
                </p>
                {isSearchMode && (
                  <button onClick={clearSearch}
                    className="mt-3 text-sm text-green-600 hover:text-green-800 font-medium underline underline-offset-2">
                    Clear search
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Pagination (only in non-search mode) ──────────────────────── */}
        {!isSearchMode && totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 bg-white rounded-2xl border border-gray-200">
            <div className="text-sm text-gray-500">
              Showing <span className="font-medium text-gray-700">{(page - 1) * pageSize + 1}</span>–
              <span className="font-medium text-gray-700">{Math.min(page * pageSize, total)}</span> of{" "}
              <span className="font-medium text-gray-700">{total}</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={goPrev} disabled={page <= 1}
                className="px-4 py-1.5 rounded-lg text-sm bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                ← Prev
              </button>
              <span className="px-3 py-1.5 text-sm text-gray-700 font-medium">
                {page} / {totalPages}
              </span>
              <button onClick={goNext} disabled={page >= totalPages}
                className="px-4 py-1.5 rounded-lg text-sm bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                Next →
              </button>
            </div>
          </div>
        )}

        {/* ── Success Toast ──────────────────────────────────────────────── */}
        {successMessage && (
          <div className="fixed bottom-6 right-6 bg-green-600 text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-2 animate-slideIn z-50">
            <div className="w-5 h-5 bg-white rounded-full flex items-center justify-center flex-shrink-0">
              <Check size={12} className="text-green-600" />
            </div>
            <span className="text-sm font-medium">{successMessage}</span>
          </div>
        )}

        {/* ── Error Toast ────────────────────────────────────────────────── */}
        {errorToast && (
          <div className="fixed bottom-6 left-6 bg-red-600 text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-2 z-50">
            <div className="w-5 h-5 bg-white rounded-full flex items-center justify-center flex-shrink-0">
              <X size={12} className="text-red-600" />
            </div>
            <span className="text-sm font-medium">{errorToast}</span>
          </div>
        )}

        {/* ── Delete Confirmation Modal ──────────────────────────────────── */}
        {deleteConfirmModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
            <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 animate-scaleIn">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-lg flex-shrink-0">
                  <AlertCircle size={28} className="text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Remove Customer</h3>
                  <p className="text-xs text-gray-500 mt-0.5">This action cannot be undone</p>
                </div>
              </div>
              <div className="bg-red-50 border-l-4 border-red-400 rounded-r-xl p-4 mb-6">
                <p className="text-sm text-gray-700">
                  Are you sure you want to remove{" "}
                  <span className="font-bold text-red-700">
                    "{customers.find((c) => c.tblRid === deleteConfirmModal)?.customerName}"
                  </span>?
                </p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setDeleteConfirmModal(null)}
                  className="flex-1 px-6 py-3 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
                  Cancel
                </button>
                <button onClick={() => confirmDelete(deleteConfirmModal)}
                  className="flex-1 px-6 py-3 text-sm font-semibold bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:from-red-700 hover:to-red-800 transition-all shadow-lg">
                  Remove
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        .animate-slideIn { animation: slideIn 0.3s ease-out; }

        @keyframes fadeIn {
          from { opacity: 0; } to { opacity: 1; }
        }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out; }

        @keyframes scaleIn {
          from { transform: scale(0.92); opacity: 0; }
          to   { transform: scale(1);    opacity: 1; }
        }
        .animate-scaleIn { animation: scaleIn 0.25s ease-out; }
      `}</style>
    </div>
  );
}