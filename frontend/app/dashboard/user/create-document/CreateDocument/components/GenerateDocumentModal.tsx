// @ts-nocheck
import { X, Download, FileText, FileCheck2, History, FileCheck, Mail, CheckCircle, XCircle } from "lucide-react";
import { useState, useEffect, use } from "react";
import DocxPreviewModal from "./DocxPreviewModal";
import { apiFetch } from "@/lib/apiClient";

interface GenerateDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (type: string, status: 'draft' | 'final', versionObj: any) => void;
  draftVersions?: any[];
  finalVersions?: any[];
  documentName: string;
  opeId: string;
  partnerName: string;
  userNameDb: string;
  userEmail: string;
  sowType: string;
}

export default function GenerateDocumentModal({
  isOpen,
  onClose,
  onGenerate,
  draftVersions = [],
  finalVersions = [],
  documentName,
  opeId,
  userNameDb,
  userEmail,
  sowType
}: GenerateDocumentModalProps) {
  const [selectedStatus, setSelectedStatus] = useState<'draft' | 'final'>('draft');
  const [showPreview, setShowPreview] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  
  // Email modal states
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<any>(null);
  const [toInput, setToInput] = useState("");
  const [ccInput, setCcInput] = useState("");
  const [selectedTo, setSelectedTo] = useState<string[]>([]);
  const [selectedCc, setSelectedCc] = useState<string[]>([]);
  const [toSuggestions, setToSuggestions] = useState([]);
  const [ccSuggestions, setCcSuggestions] = useState([]);

  // Local versions so modal can refresh from server on open
  const [localDraftVersions, setLocalDraftVersions] = useState<any[]>(draftVersions || []);
  const [localFinalVersions, setLocalFinalVersions] = useState<any[]>(finalVersions || []);
  
  useEffect(() => {
    // keep local copies in sync if parent passed updated arrays
    setLocalDraftVersions(draftVersions || []);
    setLocalFinalVersions(finalVersions || []);
  }, [draftVersions, finalVersions]);
  
  // Fetch versions from server when modal opens so history shows correctly
  useEffect(() => {
    if (!isOpen || !opeId) return;
    let mounted = true;
    const loadVersions = async () => {
      try {
        const dRes = await apiFetch(`/drafts?opeId=${opeId}`);
        const fRes = await apiFetch(`/finals?opeId=${opeId}`);
        if (!mounted) return;
        setLocalDraftVersions(dRes?.drafts || []);
        setLocalFinalVersions(fRes?.finals || []);
      } catch (err) {
        console.warn("Failed to load versions for modal:", err);
      }
    };
    loadVersions();
    return () => { mounted = false; };
  }, [isOpen, opeId]);

  // Toast state
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({
    show: false,
    message: '',
    type: 'success'
  });

  useEffect(() => { 
  console.log("email captured",userEmail)
  }, [userEmail]);

  // Fetch suggestions with debounce
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (toInput.trim()) {
        const res = await apiFetch(`/engagement/search?query=${toInput}`);
        if (res.success) setToSuggestions(res.results);
      } else setToSuggestions([]);
    }, 300);
    return () => clearTimeout(timer);
  }, [toInput]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (ccInput.trim()) {
        const res = await apiFetch(`/engagement/search?query=${ccInput}`);
        if (res.success) setCcSuggestions(res.results);
      } else setCcSuggestions([]);
    }, 300);
    return () => clearTimeout(timer);
  }, [ccInput]);

  // Add current user to CC when opening email modal
  useEffect(() => {
    if (showEmailModal && userEmail && !selectedCc.includes(userEmail)) {
      setSelectedCc(prev => [...prev, userEmail]);
    }
  }, [showEmailModal, userEmail]);

  if (!isOpen) return null;

  // Toast helper function
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: '', type: 'success' });
    }, 3000);
  };

  const isElectronEnv = (): boolean =>
  typeof window !== "undefined" && !!(window as any).electronAPI?.isElectron;

// ── Helper: Blob → base64 string ─────────────────────────────────────────
const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // result is "data:<mime>;base64,<data>" — strip the prefix
      resolve(result.split(",")[1]);
    };
    reader.onerror = () => reject(new Error("FileReader failed"));
    reader.readAsDataURL(blob);
  });

// ── Helper: ensure correct file extension ────────────────────────────────
const ensureExtension = (fileName = "", ext = "pdf") => {
  if (!fileName) return `document.${ext}`;
  return fileName.replace(/\.[^/.]+$/, `.${ext}`);
};

  // Common helper functions
  const buildDocumentPayload = (versionData: any) => {
    let sections = [];
    let assigned = {};

    if (versionData.content?.documentSections) {
      sections = versionData.content.documentSections.map(section => ({
        id: section.id,
        title: section.title,
        description: section.description || ""
      }));
      assigned = versionData.content.documentSections.reduce((acc, section) => {
        acc[section.id] = (section.modules || []).map(module => ({
          id: module.id,
          name: module.name,
          description: module.description,
          sectionId: section.id
        }));
        return acc;
      }, {});
    } else if (versionData.content?.sections && versionData.content?.assigned) {
      sections = versionData.content.sections;
      assigned = versionData.content.assigned;
    }

  const formatDateOnly = (dateString) => {
  const d = new Date(dateString);
  if (isNaN(d.getTime())) {
    return new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  }
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
};

    const createdAtFormatted = formatDateOnly(versionData.createdAt || versionData.created_at || new Date().toISOString());

     const sowType = (versionData.sowType || versionData.content?.sowType || 'SMALL').toUpperCase();

    return {
      customerName: versionData.customerName || versionData.content?.customerName || "",
      customerEmail: versionData.customerEmail || "",
      customerAddress: versionData.customerAddress || "",
      partnerName: versionData.partnerName || versionData.content?.partnerName || "",
      documentTitle: `${documentName} (${versionData.status} v${versionData.version})`,
      status: versionData.status || "final",
      version: versionData.version,
      sections,
      assigned,
      sowType,
      fileName: versionData.fileName || `${documentName}_${versionData.status}_v${versionData.version}.pdf`,
      createdAtFormatted
    };
  };

  const fetchVersionFromDb = async (version, status) => {
    const endpoint = status === 'final'
      ? `/finals/${opeId}/version/${version}`
      : `/drafts/${opeId}/version/${version}`;
    return await apiFetch(endpoint);
  };

  const formatDate = (dateString) => {
    const dateObj = new Date(dateString);
    return isNaN(dateObj.getTime())
      ? "Invalid Date"
      : dateObj.toLocaleString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
          timeZone: "UTC"
        });
  };

  const handlePreviewVersion = async (versionObj: any) => {
    setPreviewLoading(true);
    setPreviewPdfUrl(null);

    try {
      const dbVersion = await fetchVersionFromDb(versionObj.version, versionObj.status);
      const versionData = dbVersion.draft || dbVersion.final || versionObj;
      const payload = buildDocumentPayload(versionData);

      const response = await apiFetch(`/generate-document/${opeId}?type=pdf`, {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
        responseType: "blob"
      });

      if (response && response.size > 0) {
        const pdfUrl = window.URL.createObjectURL(new Blob([response], { type: "application/pdf" }));
        setPreviewPdfUrl(pdfUrl);
      }
    } catch (error) {
      console.error("Preview error:", error);
      setPreviewPdfUrl(null);
    } finally {
      setPreviewLoading(false);
    }
    setShowPreview(true);
  };

const handleDownloadVersion = async (versionObj: any, type: "docx" | "pdf") => {
  const loadingKey = `${versionObj.version}-${versionObj.createdAt}-download-${type}`;
  setLoadingAction(loadingKey);

  try {
    const dbVersion = await fetchVersionFromDb(versionObj.version, versionObj.status);
    const versionData = dbVersion.draft || dbVersion.final || versionObj;
    const payload = buildDocumentPayload(versionData);

    const response = await apiFetch(`/generate-document/${opeId}?type=${type}`, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
      responseType: "blob",
    });

    if (!response || response.size === 0) {
      alert("Failed to generate document — empty response");
      return;
    }

    const mimeType =
      type === "pdf"
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    const blob = response;

    const candidate =
      versionData.fileName ||
      payload.fileName ||
      `${documentName}_${versionObj.status}_v${versionObj.version}`;
    const filename = ensureExtension(candidate, type);

    // ── Electron path: save via IPC so main process can update TOC ────────
    if (type === "docx" && isElectronEnv()) {
      try {
        const base64 = await blobToBase64(blob);
        const result = await (window as any).electronAPI.saveDocxAndUpdateTOC(base64, filename);

        if (result?.success) {
          // File saved to Downloads + TOC updated
          console.log("[TOC] File saved and TOC updated:", result.filePath);
          // Optionally show a toast — you can call showToast here if accessible
          alert(`✅ Saved to Downloads:\n${result.filePath}`);
          return;
        } else {
          // IPC call failed — fall through to normal browser download
          console.warn("[TOC] saveDocxAndUpdateTOC failed:", result?.error, "— falling back to browser download");
        }
      } catch (ipcErr) {
        console.warn("[TOC] IPC error:", ipcErr, "— falling back to browser download");
      }
    }

    // ── Browser / fallback path: normal anchor download ───────────────────
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Download error:", error);
    alert("Failed to download document");
  } finally {
    setLoadingAction(null);
  }
};


  // Download the specific version (PDF for final) then open default email client.
  // Shows per-version loading spinner while downloading.
const openEmailModal = async (versionObj: any) => {
  const fileType = versionObj.status === "final" ? "pdf" : "docx";
  const loadingKey = `${versionObj.version}-${versionObj.createdAt}-email`;
  setLoadingAction(loadingKey);

  const defaultFileName = ensureExtension(
    versionObj.fileName || `${documentName}_${versionObj.status}_v${versionObj.version}`,
    fileType
  );
  const subject = encodeURIComponent(defaultFileName.replace(/\.[^.]+$/, ""));
  const bodyLines = [
    `Hi,`,
    ``,
    `Please find the document: ${defaultFileName}`,
    ``,
    `Best regards,`,
    `${userNameDb || "HPE Document Creator"}`,
  ];
  const body = encodeURIComponent(bodyLines.join("\n"));

  try {
    const dbVersion = await fetchVersionFromDb(versionObj.version, versionObj.status);
    const versionData = dbVersion.draft || dbVersion.final || versionObj;
    const payload = buildDocumentPayload(versionData);

    const response = await apiFetch(`/generate-document/${opeId}?type=${fileType}`, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
      responseType: "blob",
    });

    if (response && response.size > 0) {
      const mimeType =
        fileType === "pdf"
          ? "application/pdf"
          : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      const blob = new Blob([response], { type: mimeType });
      const finalFileName = ensureExtension(defaultFileName, fileType);

      // In Electron, save via IPC first so TOC is updated before user attaches file
      if (fileType === "docx" && isElectronEnv()) {
        try {
          const base64 = await blobToBase64(blob);
          const result = await (window as any).electronAPI.saveDocxAndUpdateTOC(base64, finalFileName);
          if (result?.success) {
            console.log("[TOC] Email attachment saved with TOC:", result.filePath);
          } else {
            console.warn("[TOC] saveDocxAndUpdateTOC failed for email:", result?.error);
          }
        } catch (ipcErr) {
          console.warn("[TOC] IPC error for email attachment:", ipcErr);
        }
      }

      // Also trigger browser download so user has the file to attach manually
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = finalFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => window.URL.revokeObjectURL(url), 30_000);
    }
  } catch (err) {
    console.warn("openEmailModal: generation failed, opening mail client anyway", err);
  } finally {
    const mailto = `mailto:?subject=${subject}&body=${body}`;
    try {
      window.location.href = mailto;
    } finally {
      setLoadingAction(null);
    }
  }
};

  const closeEmailModal = () => {
  setShowEmailModal(false);
  setSelectedTo([]);
  setSelectedCc([userEmail]);
  setToInput("");
  setCcInput("");
};

const handleSendEmail = async () => {
  if (!selectedVersion || selectedTo.length === 0) return;

  // set per-version loading key so UI shows spinner on the correct card
  setLoadingAction(`${selectedVersion.version}-${selectedVersion.createdAt}-email`);

  try {
    // Step 1: Load version and build payload
    const dbVersion = await fetchVersionFromDb(selectedVersion.version, selectedVersion.status);
    const versionData = dbVersion.draft || dbVersion.final || selectedVersion;
    const payload = buildDocumentPayload(versionData);

    // Step 2: Generate document on backend
    const isElectron = typeof window !== "undefined" && window.electron?.isElectron;
    // If running in Electron we will perform Word COM & optional PDF export locally.
    const wantClientPdf = isElectron && selectedVersion.status === "final";
    const fileType = wantClientPdf ? "docx" : (selectedVersion.status === "final" ? "pdf" : "docx");

    const endpoint = `/generate-document/${opeId}?send=true&type=${fileType}`;
    const response = await apiFetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        to: selectedTo.join(","),
        cc: selectedCc.join(","),
        senderName: userNameDb || "HPE Document Creator",
        senderEmail: userEmail || "",
      }),
    });

    if (!response || !response.success) {
      showToast(
        `Document generation failed: ${(response && (response.message || response.error)) || "unknown error"}`,
        "error"
      );
      return;
    }

    
    if (isElectron) {
      // Ask Electron to update TOC and optionally convert to PDF
      const prep = await window.electron.prepareDocument({
        filePath: response.filePath,
        convertToPdf: wantClientPdf
      });

      const attachmentPath = (prep && prep.convertedFilePath) ? prep.convertedFilePath : response.filePath;

      const emailResult = await window.electron.sendEmail({
        filePath: attachmentPath,
        to: response.recipients || selectedTo.join(","),
        cc: response.cc || selectedCc.join(","),
        subject: response.subject || `Document Version ${selectedVersion.version}`,
        body: response.body || `Please find attached the document.\n\nBest regards,\n${userNameDb}`
      });

      if (!emailResult.success) {
        throw new Error(emailResult.error || "Failed to open email client");
      }

      showToast("✅ Email client opened with document attached!", "success");
      closeEmailModal();

    } else {
      // Not in Electron - backend handled email via nodemailer
      console.log("🌐 Running in browser, email sent via backend");
      showToast("✅ Email sent successfully!", "success");
      closeEmailModal();
    }

  } catch (error: any) {
    console.error("❌ Email preparation error:", error);
    showToast(
      `Something went wrong: ${error.message || "Unknown error"}`,
      "error"
    );
  } finally {
    setLoadingAction(null);
  }
};


  const addRecipient = (email: string, type: 'to' | 'cc') => {
    if (type === 'to' && !selectedTo.includes(email) && !selectedCc.includes(email)) {
      setSelectedTo(prev => [...prev, email]);
      setToInput("");
      setToSuggestions([]);
    } else if (type === 'cc' && !selectedCc.includes(email) && !selectedTo.includes(email)) {
      setSelectedCc(prev => [...prev, email]);
      setCcInput("");
      setCcSuggestions([]);
    }
  };

  const removeRecipient = (email: string, type: 'to' | 'cc') => {
    if (type === 'to') {
      setSelectedTo(prev => prev.filter(e => e !== email));
    } else {
      setSelectedCc(prev => prev.filter(e => e !== email));
    }
  };

  const renderVersionCard = (version: any, isDraft: boolean) => {
    const loadingKey = `${version.version}-${version.createdAt}`;
    const colorClass = isDraft ? 'blue' : 'green';

    return (
      <div
        key={loadingKey}
        className={`bg-white p-4 rounded-lg border border-${colorClass}-200 hover:shadow-md transition-all`}
      >
        <div className="flex items-center justify-between mb-2">
          <span
            className={`text-sm text-${colorClass}-700 underline cursor-pointer flex-1 truncate`}
            onClick={() => handlePreviewVersion(version)}
            title="Preview this version"
          >
            {version.fileName || `${documentName}_${version.status}_v${version.version}.docx`}
          </span>
          <div className="flex gap-2 ml-2">
            <button
              onClick={() => handleDownloadVersion(version, "docx")}
              className="p-1 hover:bg-blue-50 rounded-md transition-colors"
              title="Download DOCX"
              disabled={loadingAction === `${loadingKey}-download-docx`}
            >
              {loadingAction === `${loadingKey}-download-docx` ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              ) : (
                <Download className="h-4 w-4 text-blue-600" />
              )}
            </button>

            {!isDraft && (
              <button
                onClick={() => handleDownloadVersion(version, "pdf")}
                className="p-1 hover:bg-red-50 rounded-md transition-colors"
                title="Download PDF"
                disabled={loadingAction === `${loadingKey}-download-pdf`}
              >
                {loadingAction === `${loadingKey}-download-pdf` ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                ) : (
                  <FileCheck2 className="h-4 w-4 text-red-600" />
                )}
              </button>
            )}
            <button
              onClick={() => openEmailModal(version)}
              className="p-1 hover:bg-green-50 rounded-md transition-colors"
              title="Send Email"
              disabled={loadingAction === `${loadingKey}-email`}
            >
              {loadingAction === `${loadingKey}-email` ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
              ) : (
                <Mail className="h-4 w-4 text-green-600" />
              )}
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">{version.userName}</span>
          <span className="text-gray-500">{formatDate(version.createdAt)}</span>
        </div>
      </div>
    );
  };
  
  const getLatestVersion = () => {
    const versions = selectedStatus === "draft" ? localDraftVersions : localFinalVersions;
    return versions[versions.length - 1];
  };

  return (
    <div className="fixed inset-0 bg-gray-900/75 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-[1200px] max-h-[90vh] shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <History className="h-6 w-6 text-blue-600" />
            <h2 className="text-lg font-bold text-gray-900">Generate Document</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          <div className="grid grid-cols-[35%_65%] gap-8">
            {/* Left Column - Controls */}
            <div className="space-y-6">
              {/* Document Status */}
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                <h3 className="text-base font-semibold text-gray-900 mb-4">Select Status</h3>
                <div className="flex gap-4">
                  <label className="flex-1">
                    <input
                      type="radio"
                      name="status"
                      value="draft"
                      checked={selectedStatus === 'draft'}
                      onChange={(e) => setSelectedStatus(e.target.value as 'draft' | 'final')}
                      className="sr-only peer"
                    />
                    <div className="flex items-center gap-3 p-3 bg-white border-2 border-gray-200 rounded-xl cursor-pointer peer-checked:border-blue-500 peer-checked:bg-blue-50 hover:bg-gray-50 transition-colors">
                      <FileText className="h-5 w-5 text-blue-600" />
                      <span className="font-medium text-gray-900">Draft</span>
                    </div>
                  </label>
                  <label className="flex-1">
                    <input
                      type="radio"
                      name="status"
                      value="final"
                      checked={selectedStatus === 'final'}
                      onChange={(e) => setSelectedStatus(e.target.value as 'draft' | 'final')}
                      className="sr-only peer"
                    />
                    <div className="flex items-center gap-3 p-3 bg-white border-2 border-gray-200 rounded-xl cursor-pointer peer-checked:border-green-500 peer-checked:bg-green-50 hover:bg-gray-50 transition-colors">
                      <FileCheck className="h-5 w-5 text-green-600" />
                      <span className="font-medium text-gray-900">Final</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Generate Button */}
              <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                <button
                  onClick={() => {
                    const versionObj = getLatestVersion();
                    onGenerate("docx", selectedStatus, versionObj);
                  }}
                  className="w-full flex items-center gap-3 p-4 bg-white border-2 border-gray-200 rounded-xl hover:bg-blue-50 hover:border-blue-500 transition-all group"
                >
                  <FileText className="h-6 w-6 text-blue-600" />
                  <div className="text-left">
                    <div className="font-semibold text-gray-900 group-hover:text-blue-700">Generate Document</div>
                    <div className="text-sm text-gray-500 group-hover:text-blue-600">Check under version history</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Right Column - Version History */}
            <div className="space-y-6">
              {/* Draft Versions */}
              <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 h-[300px] flex flex-col">
                <h3 className="text-base font-semibold text-blue-900 mb-4 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-600" />
                  Draft Version History
                </h3>
                <div className="space-y-3 overflow-y-auto flex-1 pr-2">
                  {localDraftVersions.length > 0 ? (
                    localDraftVersions.map(draft => renderVersionCard(draft, true))
                  ) : (
                    <div className="text-sm text-blue-600 italic text-center py-4">
                      No drafts yet
                    </div>
                  )}
                </div>
              </div>

              {/* Final Versions */}
              <div className="bg-green-50 p-6 rounded-xl border border-green-100 h-[300px] flex flex-col">
                <h3 className="text-base font-semibold text-green-900 mb-4 flex items-center gap-2">
                  <FileCheck className="h-5 w-5 text-green-600" />
                  Final Version History
                </h3>
                <div className="space-y-3 overflow-y-auto flex-1 pr-2">
                  {localFinalVersions.length > 0 ? (
                    localFinalVersions.map(final => renderVersionCard(final, false))
                  ) : (
                    <div className="text-sm text-green-600 italic text-center py-4">
                      No finals yet
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Loading Overlay for Preview */}
      {previewLoading && (
        <div className="fixed inset-0 bg-gray-900/75 flex items-center justify-center z-[60]">
          <div className="text-center text-white">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
            <p className="mt-4">Loading preview...</p>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      <DocxPreviewModal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        pdfUrl={previewPdfUrl}
        loading={previewLoading}
      />

      {/* Email Recipients Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70]">
          <div className="bg-white rounded-xl shadow-2xl w-[600px] max-h-[85vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <Mail className="h-6 w-6 text-blue-600" />
                <h3 className="text-xl font-bold text-gray-900">Send Email</h3>
              </div>
              <button
                onClick={() => setShowEmailModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1">
              {/* To Field */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  To <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={toInput}
                  onChange={(e) => setToInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && toInput.trim()) {
                      addRecipient(toInput.trim(), 'to');
                    }
                  }}
                  placeholder="Type name or email and press Enter"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
                
                {/* To Suggestions Dropdown */}
                {toSuggestions.length > 0 && (
                  <div className="mt-2 border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto bg-white">
                    {toSuggestions.map((s) => (
                      <div
                        key={s.id}
                        className="cursor-pointer px-4 py-2.5 hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-0"
                        onClick={() => addRecipient(s.email, 'to')}
                      >
                        <div className="font-medium text-gray-900">{s.memberName}</div>
                        <div className="text-sm text-gray-500">{s.email}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Selected To Recipients */}
                {selectedTo.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedTo.map((email, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 bg-blue-100 text-blue-800 px-3 py-1.5 rounded-full text-sm"
                      >
                        <span>{email}</span>
                        <button
                          type="button"
                          onClick={() => removeRecipient(email, 'to')}
                          className="hover:bg-blue-200 rounded-full p-0.5 transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* CC Field */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">CC</label>
                <input
                  type="text"
                  value={ccInput}
                  onChange={(e) => setCcInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && ccInput.trim()) {
                      addRecipient(ccInput.trim(), 'cc');
                    }
                  }}
                  placeholder="Type name or email and press Enter"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
                
                {/* CC Suggestions Dropdown */}
                {ccSuggestions.length > 0 && (
                  <div className="mt-2 border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto bg-white">
                    {ccSuggestions.map((s) => (
                      <div
                        key={s.id}
                        className="cursor-pointer px-4 py-2.5 hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-0"
                        onClick={() => addRecipient(s.email, 'cc')}
                      >
                        <div className="font-medium text-gray-900">{s.memberName}</div>
                        <div className="text-sm text-gray-500">{s.email}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Selected CC Recipients */}
                {selectedCc.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedCc.map((email, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 bg-gray-100 text-gray-800 px-3 py-1.5 rounded-full text-sm"
                      >
                        <span>{email}</span>
                        <button
                          type="button"
                          onClick={() => removeRecipient(email, 'cc')}
                          className="hover:bg-gray-200 rounded-full p-0.5 transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
              <button
                className="px-6 py-2.5 text-gray-700 font-medium hover:bg-gray-200 rounded-lg transition-colors"
                onClick={() => setShowEmailModal(false)}
              >
                Cancel
              </button>
              <button
                className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                onClick={handleSendEmail}
                disabled={selectedTo.length === 0 || loadingAction?.includes('email')}
              >
                {loadingAction?.includes('email') ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4" />
                    Send Email
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed top-4 right-4 z-[80] animate-in slide-in-from-top-2 duration-300">
          <div className={`flex items-center gap-3 px-6 py-4 rounded-lg shadow-lg ${
            toast.type === 'success' 
              ? 'bg-green-50 border border-green-200' 
              : 'bg-red-50 border border-red-200'
          }`}>
            {toast.type === 'success' ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600" />
            )}
            <span className={`font-medium ${
              toast.type === 'success' ? 'text-green-800' : 'text-red-800'
            }`}>
              {toast.message}
            </span>
            <button
              onClick={() => setToast({ show: false, message: '', type: 'success' })}
              className={`p-1 rounded-full hover:bg-opacity-20 transition-colors ${
                toast.type === 'success' ? 'hover:bg-green-200' : 'hover:bg-red-200'
              }`}
            >
              <X size={16} className={toast.type === 'success' ? 'text-green-600' : 'text-red-600'} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function replaceTags(text, { customerName, partnerName, documentName }) {
  if (!text) return "";
  return text
    .replace(/{{\s*customerName\s*}}/gi, customerName || "")
    .replace(/{{\s*partnerName\s*}}/gi, partnerName || "")
    .replace(/{{\s*documentName\s*}}/gi, documentName || "");
}

// ensure filename ends with the requested extension
const ensureExtension = (fileName = "", ext = "pdf") => {
  if (!fileName) return `document.${ext}`;
  return fileName.replace(/\.[^/.]+$/, `.${ext}`);
};