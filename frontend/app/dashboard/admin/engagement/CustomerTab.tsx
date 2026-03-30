// @ts-nocheck
import { useState, useEffect } from "react";
import { Plus, Check, Pencil, Trash2, X, AlertCircle, Users, UserPlus } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";

export default function CustomersTab() {
  const [customers, setCustomers] = useState([]);
  const [newName, setNewName] = useState("");
  const [newNo, setNewNo] = useState("");
  const [newCountry, setNewCountry] = useState("");
  const [newSite, setNewSite] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editNo, setEditNo] = useState("");
  const [editCountry, setEditCountry] = useState("");
  const [editSite, setEditSite] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15); // fixed 15 per request
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [deleteConfirmModal, setDeleteConfirmModal] = useState(null);
  const [errorToast, setErrorToast] = useState("");

  const showSuccess = (msg) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(""), 3000);
  };
  const showError = (msg) => {
    setErrorToast(msg);
    setTimeout(() => setErrorToast(""), 4000);
  };

  const loadCustomers = async (p = 1) => {
    setLoading(true);
    try {
      const res = await apiFetch(`/customers?page=${p}&limit=${pageSize}`);
      if (res && res.success) {
        setCustomers(res.customers || []);
        setTotal(res.total || 0);
        setPage(res.page || p);
        setTotalPages(res.totalPages || Math.ceil((res.total || 0) / pageSize));
      } else {
        setCustomers([]);
        setTotal(0);
        setTotalPages(0);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load customers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCustomers(page); }, []);

  const handleAdd = async () => {
    if (!newNo || !newName) return setError("Customer number and name required");
    setSubmitting(true); 
    setError("");
    try {
      const res = await apiFetch("/customers/add-customer", {
        method: "POST",
        body: { customerNo: newNo, customerName: newName, country: newCountry, siteId: newSite },
      });
      if (res.success) {
        // refresh current page after add (server may place new record into page 1)
        await loadCustomers(1);
        setNewName(""); 
        setNewNo(""); 
        setNewCountry(""); 
        setNewSite("");
        showSuccess("Customer added successfully!");
      } else {
        // show field-specific message as toast
        showError(res.error || "Failed to add customer");
      }
    } catch (err) {
      console.error(err); 
      showError(err.message || "Failed to add customer");
    } finally { 
      setSubmitting(false); 
    }
  };
  
  const startEdit = (c) => {
    setEditingId(c.tblRid);
    setEditName(c.customerName || "");
    setEditNo(c.customerNo || "");
    setEditCountry(c.country || "");
    setEditSite(c.siteId || "");
    setError("");
  };

  const saveEdit = async (id) => {
    if (!editName) return setError("Name required");
    setError("");
    try {
      const res = await apiFetch(`/customers/update-customer/${id}`, {
        method: "PUT",
        body: { customerNo: editNo, customerName: editName, country: editCountry, siteId: editSite },
      });
      if (res.success) {
        await loadCustomers(page);
        setEditingId(null); 
        setEditName(""); 
        setEditNo(""); 
        setEditCountry(""); 
        setEditSite("");
        showSuccess("Customer updated successfully!");
      } else {
        showError(res.error || "Failed to update");
      }
    } catch (err) {
      console.error(err); 
      showError(err.message || "Failed to update");
    }
  };

  const handleDelete = (id) => {
    setDeleteConfirmModal(id);
  };

  const confirmDelete = async (id) => {
    try {
      const res = await apiFetch(`/customers/delete-customer/${id}`, { method: "DELETE" });
      if (res.success) {
        // if deleting last item of last page, move page back if needed
        const remainingOnPage = customers.length - 1;
        const newPage = remainingOnPage === 0 && page > 1 ? page - 1 : page;
        await loadCustomers(newPage);
        showSuccess("Customer removed successfully!");
      } else {
        showError(res.error || "Failed to delete");
      }
    } catch (err) {
      console.error(err); 
      showError(err.message || "Failed to delete");
    } finally {
      setDeleteConfirmModal(null);
    }
  };

  // Pagination handlers
  const goPrev = () => { if (page > 1) { setPage(page - 1); loadCustomers(page - 1); } };
  const goNext = () => { if (page < totalPages) { setPage(page + 1); loadCustomers(page + 1); } };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Add Customer Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="p-2 bg-green-100 rounded-lg">
              <UserPlus size={18} className="text-green-600" />
            </div>
            <h2 className="text-base font-semibold text-gray-800">Add New Customer</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Customer No Input */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Customer No
              </label>
              <input
                type="text"
                placeholder="Enter customer no"
                value={newNo}
                onChange={(e) => {
                  setNewNo(e.target.value);
                  setError("");
                }}
                className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            {/* Customer Name Input */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Customer Name
              </label>
              <input
                type="text"
                placeholder="Enter customer name"
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                  setError("");
                }}
                className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            {/* Country Input */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Country
              </label>
              <input
                type="text"
                placeholder="Enter country"
                value={newCountry}
                onChange={(e) => {
                  setNewCountry(e.target.value);
                  setError("");
                }}
                className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            {/* Site ID Input */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Site ID
              </label>
              <input
                type="text"
                placeholder="Enter site ID"
                value={newSite}
                onChange={(e) => {
                  setNewSite(e.target.value);
                  setError("");
                }}
                className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            {/* Add Button */}
            <div className="flex items-end">
              <button
                onClick={handleAdd}
                disabled={submitting || !newNo.trim() || !newName.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-white text-sm font-medium rounded-lg transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: "linear-gradient(135deg, #004f2d 0%, #00b386 70%)" }}
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus size={16} />
                    Add Customer
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-4 flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
              <button
                onClick={() => setError("")}
                className="ml-auto text-red-400 hover:text-red-600"
              >
                <X size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Customers List Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Header with count */}
          <div 
            className="px-6 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 relative"
            style={{ background: "linear-gradient(135deg, #004f2d 0%, #00b386 70%)" }}
          >
            <h2 className="text-lg font-semibold text-white tracking-wide">
              All Customers
            </h2>
            {customers.length > 0 && (
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-bold shadow-md border border-white/30 text-sm">
                {customers.length}
              </div>
            )}
          </div>

          {/* Customers Table */}
          <div className="p-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-10 h-10 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mb-3" />
                <p className="text-sm text-gray-600">Loading customers...</p>
              </div>
            ) : customers.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 uppercase text-xs">#</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 uppercase text-xs">Customer No</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 uppercase text-xs">Name</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 uppercase text-xs">Country</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 uppercase text-xs">Site ID</th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-700 uppercase text-xs">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((c, idx) => (
                      <tr
                        key={c.tblRid}
                        className="border-b border-gray-100 hover:bg-green-50 transition-colors group"
                      >
                        <td className="py-3 px-4 text-gray-500">{idx + 1}</td>
                        
                        {/* Customer No */}
                        <td className="py-3 px-4">
                          {editingId === c.tblRid ? (
                            <input
                              type="text"
                              value={editNo}
                              onChange={(e) => setEditNo(e.target.value)}
                              className="px-3 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent w-full"
                            />
                          ) : (
                            <span className="text-gray-700 font-medium">{c.customerNo}</span>
                          )}
                        </td>

                        {/* Name */}
                        <td className="py-3 px-4">
                          {editingId === c.tblRid ? (
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              onKeyPress={(e) => e.key === "Enter" && saveEdit(c.tblRid)}
                              className="px-3 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent w-full"
                              autoFocus
                            />
                          ) : (
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-gradient-to-br from-green-100 to-green-100 rounded-full flex items-center justify-center">
                                <span className="text-green-700 text-sm font-semibold">
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
                            <input
                              type="text"
                              value={editCountry}
                              onChange={(e) => setEditCountry(e.target.value)}
                              className="px-3 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent w-full"
                            />
                          ) : (
                            <span className="text-gray-700">{c.country || <span className="text-gray-400">—</span>}</span>
                          )}
                        </td>

                        {/* Site ID */}
                        <td className="py-3 px-4">
                          {editingId === c.tblRid ? (
                            <input
                              type="text"
                              value={editSite}
                              onChange={(e) => setEditSite(e.target.value)}
                              className="px-3 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent w-full"
                            />
                          ) : (
                            <span className="text-gray-700">{c.siteId || <span className="text-gray-400">—</span>}</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center gap-2 justify-end">
                            {editingId === c.tblRid ? (
                              <>
                                <button
                                  onClick={() => saveEdit(c.tblRid)}
                                  className="p-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all"
                                  title="Save"
                                >
                                  <Check size={14} />
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingId(null);
                                    setEditName("");
                                    setEditNo("");
                                    setEditCountry("");
                                    setEditSite("");
                                    setError("");
                                  }}
                                  className="p-1.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all"
                                  title="Cancel"
                                >
                                  <X size={14} />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => startEdit(c)}
                                  className="p-1.5 bg-green-100 text-green-600 rounded-lg hover:bg-blue-200 transition-all opacity-0 group-hover:opacity-100"
                                  title="Edit"
                                >
                                  <Pencil size={14} />
                                </button>
                                <button
                                  onClick={() => handleDelete(c.tblRid)}
                                  className="p-1.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-all opacity-0 group-hover:opacity-100"
                                  title="Delete"
                                >
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
                  <Users size={28} className="text-gray-400" />
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-1">
                  No customers yet
                </h3>
                <p className="text-sm text-gray-600">
                  Add your first customer above
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-6 py-4 bg-white rounded-b-2xl border border-gray-200 mt-4">
          <div className="text-sm text-gray-600">
            Showing {(page-1)*pageSize + 1} - {Math.min(page*pageSize, total)} of {total}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={goPrev} disabled={page <= 1} className="px-3 py-1 rounded-lg bg-white border hover:bg-gray-50 disabled:opacity-50">Prev</button>
            <div className="px-3 py-1 text-sm text-gray-700">Page {page} / {totalPages || 1}</div>
            <button onClick={goNext} disabled={page >= totalPages} className="px-3 py-1 rounded-lg bg-white border hover:bg-gray-50 disabled:opacity-50">Next</button>
          </div>
        </div>

        {/* Success Toast */}
        {successMessage && (
          <div className="fixed bottom-6 right-6 bg-green-600 text-white px-5 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-slideIn z-50">
            <div className="w-5 h-5 bg-white rounded-full flex items-center justify-center">
              <Check size={12} className="text-green-600" />
            </div>
            <span className="text-sm font-medium">{successMessage}</span>
          </div>
        )}

        {/* Error Toast */}
        {errorToast && (
          <div className="fixed bottom-6 left-6 bg-red-600 text-white px-5 py-3 rounded-lg shadow-lg flex items-center gap-2 z-50">
            <div className="w-5 h-5 bg-white rounded-full flex items-center justify-center">
              <X size={12} className="text-red-600" />
            </div>
            <span className="text-sm font-medium">{errorToast}</span>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirmModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
            <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 transform animate-scaleIn">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-lg">
                  <AlertCircle size={32} className="text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">Remove Customer</h3>
                  <p className="text-sm text-gray-600">This action cannot be undone</p>
                </div>
              </div>

              <div className="bg-red-50 border-l-4 border-red-500 rounded-r-xl p-4 mb-6">
                <p className="text-sm text-gray-700">
                  Are you sure you want to remove{" "}
                  <span className="font-bold text-red-700">
                    "{customers.find(c => c.tblRid === deleteConfirmModal)?.customerName}"
                  </span>
                  ? This will permanently delete this customer from the system.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirmModal(null)}
                  className="flex-1 px-6 py-3 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => confirmDelete(deleteConfirmModal)}
                  className="flex-1 px-6 py-3 text-sm font-semibold bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:from-red-700 hover:to-red-800 transition-all shadow-lg hover:shadow-xl"
                >
                  Remove Customer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slideIn {
          animation: slideIn 0.3s ease-out;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }

        @keyframes scaleIn {
          from {
            transform: scale(0.9);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
        .animate-scaleIn {
          animation: scaleIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}