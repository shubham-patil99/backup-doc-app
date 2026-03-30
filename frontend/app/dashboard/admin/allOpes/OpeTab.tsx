// @ts-nocheck
import { useState, useEffect } from "react";
import { Trash2, X, AlertCircle, Check  } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";

export default function OpeTab() {
  const [opes, setOpes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
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

  const loadOpes = async (p = 1) => {
    setLoading(true);
    try {
      // Fetch all drafts without pagination to get complete OPE list
      const [draftsRes, finalsRes] = await Promise.all([
        apiFetch(`/drafts?page=1&limit=10000`),
        apiFetch(`/finals?page=1&limit=10000`),
      ]);

      const allDocuments = [];

      if (draftsRes && draftsRes.success && draftsRes.drafts) {
        allDocuments.push(...draftsRes.drafts);
      }

      if (finalsRes && finalsRes.success && finalsRes.finals) {
        allDocuments.push(...finalsRes.finals);
      }

      // Group by OPE ID and collect versions
      const opesMap = new Map();
      allDocuments.forEach((doc) => {
        if (!opesMap.has(doc.opeId)) {
          opesMap.set(doc.opeId, {
            opeId: doc.opeId,
            userName: doc.userName || "N/A",
            versions: [],
            statuses: new Set(),
          });
        }
        const opeData = opesMap.get(doc.opeId);
        opeData.versions.push({
          version: doc.version,
          status: doc.status,
        });
        opeData.statuses.add(doc.status);
      });

      // Convert map to array and sort
      let opesList = Array.from(opesMap.values()).map((ope) => ({
        ...ope,
        versions: ope.versions.sort((a, b) => a.version - b.version),
        statuses: Array.from(ope.statuses),
      }));

      // Apply client-side pagination
      const calculatedTotal = opesList.length;
      const calculatedTotalPages = Math.ceil(calculatedTotal / pageSize);
      const startIdx = (p - 1) * pageSize;
      const paginatedOpes = opesList.slice(startIdx, startIdx + pageSize);

      setOpes(paginatedOpes);
      setTotal(calculatedTotal);
      setPage(p);
      setTotalPages(calculatedTotalPages);
    } catch (err) {
      console.error(err);
      setError("Failed to load OPEs");
      setOpes([]);
      setTotal(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOpes(page);
  }, [page]);

  const handleDelete = (opeId) => {
    setDeleteConfirmModal(opeId);
  };

  const confirmDelete = async (opeId) => {
    try {
      // Delete draft and final documents with this OPE ID
      const [draftRes, finalRes] = await Promise.all([
        apiFetch(`/drafts/by-ope/${opeId}`, { method: "DELETE" }),
        apiFetch(`/finals/by-ope/${opeId}`, { method: "DELETE" }),
      ]);

      if (draftRes?.success || finalRes?.success) {
        const remainingOnPage = opes.length - 1;
        const newPage = remainingOnPage === 0 && page > 1 ? page - 1 : page;
        await loadOpes(newPage);
        showSuccess("OPE deleted successfully!");
      } else {
        showError(draftRes?.error || finalRes?.error || "Failed to delete OPE");
      }
    } catch (err) {
      console.error(err);
      showError(err.message || "Failed to delete OPE");
    } finally {
      setDeleteConfirmModal(null);
    }
  };

  // Pagination handlers
  const goPrev = () => {
    if (page > 1) {
      setPage(page - 1);
    }
  };

  const goNext = () => {
    if (page < totalPages) {
      setPage(page + 1);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* OPEs List Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Header with count */}
          <div
            className="px-6 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 relative"
            style={{ background: "linear-gradient(135deg, #004f2d 0%, #00b386 70%)" }}
          >
            <h2 className="text-lg font-semibold text-white tracking-wide">
              All OPEs
            </h2>
            {opes.length > 0 && (
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-bold shadow-md border border-white/30 text-sm">
                {opes.length}
              </div>
            )}
          </div>

          {/* OPEs Table */}
          <div className="p-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-10 h-10 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mb-3" />
                <p className="text-sm text-gray-600">Loading OPEs...</p>
              </div>
            ) : opes.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 uppercase text-xs">
                        #
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 uppercase text-xs">
                        OPE ID
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 uppercase text-xs">
                        User Name
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 uppercase text-xs">
                        Versions (Status)
                      </th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-700 uppercase text-xs">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {opes.map((ope, idx) => (
                      <tr
                        key={ope.opeId}
                        className="border-b border-gray-100 hover:bg-green-50 transition-colors group"
                      >
                        <td className="py-3 px-4 text-gray-500">{idx + 1}</td>

                        {/* OPE ID */}
                        <td className="py-3 px-4 min-w-36">
                          <span className="text-gray-700 font-medium">{ope.opeId}</span>
                        </td>

                        {/* User Name */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-gradient-to-br from-green-100 to-green-100 rounded-full flex items-center justify-center">
                              <span className="text-green-700 text-sm font-semibold">
                                {ope.userName.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <span className="text-gray-900 font-medium">
                              {ope.userName}
                            </span>
                          </div>
                        </td>

                        {/* Versions with Status */}
                        <td className="py-3 px-4">
                          <div className="space-y-1">
                            {ope.versions.map((v, vidx) => (
                              <span
                                key={vidx}
                                className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium mr-2 ${
                                  v.status === "draft"
                                    ? "bg-blue-100 text-blue-800"
                                    : "bg-green-100 text-green-800"
                                }`}
                              >
                                v{v.version} ({v.status})
                              </span>
                            ))}
                          </div>
                        </td>

                        {/* Delete Action */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center gap-2 justify-end">
                            <button
                              onClick={() => handleDelete(ope.opeId)}
                              className="p-1.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-all opacity-0 group-hover:opacity-100"
                              title="Delete OPE"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <p className="text-gray-600 text-sm">No OPEs found</p>
              </div>
            )}
          </div>
        </div>

        {/* Pagination Controls */}
        <div className="flex items-center justify-between px-6 py-4 bg-white rounded-b-2xl border border-gray-200 mt-4">
          <div className="text-sm text-gray-600">
            Showing {(page-1)*pageSize + 1} - {Math.min(page*pageSize, total)} of {total}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={goPrev} disabled={page <= 1 || loading} className="px-3 py-1 rounded-lg bg-white border hover:bg-gray-50 disabled:opacity-50">Prev</button>
            <div className="px-3 py-1 text-sm text-gray-700">Page {page} / {totalPages || 1}</div>
            <button onClick={goNext} disabled={page >= totalPages || loading} className="px-3 py-1 rounded-lg bg-white border hover:bg-gray-50 disabled:opacity-50">Next</button>
          </div>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="fixed bottom-6 right-6 flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg shadow-lg">
            <div className="w-5 h-5 rounded-full bg-green-600 flex items-center justify-center text-white flex-shrink-0 mt-0.5">
              <Check size={14} />
            </div>
            <p className="text-sm text-green-800">{successMessage}</p>
            <button
              onClick={() => setSuccessMessage("")}
              className="ml-auto text-green-400 hover:text-green-600"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Error Toast */}
        {errorToast && (
          <div className="fixed bottom-6 right-6 flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg shadow-lg">
            <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{errorToast}</p>
            <button
              onClick={() => setErrorToast("")}
              className="ml-auto text-red-400 hover:text-red-600"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirmModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 animate-in fade-in zoom-in-95">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <AlertCircle size={24} className="text-red-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Delete OPE
                  </h3>
                  <p className="text-sm text-gray-600 mb-6">
                    Are you sure you want to delete OPE <span className="font-semibold">{deleteConfirmModal}</span>? This action cannot be undone.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <button
                  onClick={() => setDeleteConfirmModal(null)}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => confirmDelete(deleteConfirmModal)}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 text-white hover:bg-red-700 font-medium text-sm transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes zoomIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-in {
          animation: fadeIn 0.2s ease-in-out;
        }
        .fade-in {
          animation: fadeIn 0.2s ease-in-out;
        }
        .zoom-in-95 {
          animation: zoomIn 0.2s ease-in-out;
        }
      `}</style>
    </div>
  );
}
