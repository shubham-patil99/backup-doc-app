// @ts-nocheck
import {
  X, Download, FileText, FileCheck2, History,
  FileCheck, Mail, CheckCircle, XCircle,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import DocxPreviewModal from "./DocxPreviewModal";
import { apiFetch } from "@/lib/apiClient";

// ─── Types ────────────────────────────────────────────────────────────────────

interface GenerateDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (type: string, status: "draft" | "final", versionObj: any) => void;
  draftVersions?: any[];
  finalVersions?: any[];
  documentName: string;
  opeId: string;
  partnerName?: string;
  userNameDb: string;
  userEmail: string;
  sowType: string; // "FULL" | "SMALL" | "PROPOSAL"
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function GenerateDocumentModal({
  isOpen,
  onClose,
  onGenerate,
  draftVersions = [],
  finalVersions = [],
  documentName,
  opeId,
  partnerName,
  userNameDb,
  userEmail,
  sowType,
}: GenerateDocumentModalProps) {
  // ── Core state ───────────────────────────────────────────────────────────────
  const [selectedStatus, setSelectedStatus] = useState<"draft" | "final">("draft");
  const [showPreview, setShowPreview] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewFileType, setPreviewFileType] = useState<"pdf" | "docx" | "pptx">("pdf");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  // ── Version state ────────────────────────────────────────────────────────────
  const [localDraftVersions, setLocalDraftVersions] = useState<any[]>(draftVersions || []);
  const [localFinalVersions, setLocalFinalVersions] = useState<any[]>(finalVersions || []);

  // ── Email state ──────────────────────────────────────────────────────────────
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<any>(null);
  const [toInput, setToInput] = useState("");
  const [ccInput, setCcInput] = useState("");
  const [selectedTo, setSelectedTo] = useState<string[]>([]);
  const [selectedCc, setSelectedCc] = useState<string[]>([]);
  const [toSuggestions, setToSuggestions] = useState([]);
  const [ccSuggestions, setCcSuggestions] = useState([]);

  // ── Toast state ──────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<{ show: boolean; message: string; type: "success" | "error" }>({
    show: false, message: "", type: "success",
  });

  // ─── Effects ─────────────────────────────────────────────────────────────────

  /** Keep local copies in sync when parent passes updated arrays */
  useEffect(() => {
    setLocalDraftVersions(draftVersions || []);
    setLocalFinalVersions(finalVersions || []);
  }, [draftVersions, finalVersions]);

  /** Fetch versions from server when modal opens, filtered by sowType */
  useEffect(() => {
    if (!isOpen || !opeId) return;
    let mounted = true;
    const loadVersions = async () => {
      try {
        const normalizedSowType = sowType.toUpperCase();
        const [dRes, fRes] = await Promise.all([
          apiFetch(`/drafts?opeId=${opeId}&sowType=${normalizedSowType}`),
          apiFetch(`/finals?opeId=${opeId}&sowType=${normalizedSowType}`),
        ]);
        if (!mounted) return;
        setLocalDraftVersions(dRes?.drafts || []);
        setLocalFinalVersions(fRes?.finals || []);
      } catch (err) {
        console.warn("Failed to load versions for modal:", err);
      }
    };
    loadVersions();
    return () => { mounted = false; };
  }, [isOpen, opeId, sowType]);

  /** Debounced To suggestions */
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (toInput.trim()) {
        const res = await apiFetch(`/engagement/search?query=${toInput}`);
        if (res.success) setToSuggestions(res.results);
      } else setToSuggestions([]);
    }, 300);
    return () => clearTimeout(timer);
  }, [toInput]);

  /** Debounced CC suggestions */
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (ccInput.trim()) {
        const res = await apiFetch(`/engagement/search?query=${ccInput}`);
        if (res.success) setCcSuggestions(res.results);
      } else setCcSuggestions([]);
    }, 300);
    return () => clearTimeout(timer);
  }, [ccInput]);

  /** Auto-add current user to CC when email modal opens */
  useEffect(() => {
    if (showEmailModal && userEmail && !selectedCc.includes(userEmail)) {
      setSelectedCc((prev) => [...prev, userEmail]);
    }
  }, [showEmailModal, userEmail]);

  // ─── Filtered versions (by opeId + sowType) ──────────────────────────────────

  const filteredDraftVersions = useMemo(() => {
    const norm = sowType.toUpperCase();
    return localDraftVersions.filter(
      (d) => d.opeId === opeId && (d.sowType || "FULL").toUpperCase() === norm && (d.version || 0) > 0
    );
  }, [localDraftVersions, opeId, sowType]);

  const filteredFinalVersions = useMemo(() => {
    const norm = sowType.toUpperCase();
    return localFinalVersions.filter(
      (f) => f.opeId === opeId && (f.sowType || "FULL").toUpperCase() === norm && (f.version || 0) > 0
    );
  }, [localFinalVersions, opeId, sowType]);

  if (!isOpen) return null;

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3000);
  };

  const isElectronEnv = (): boolean =>
    typeof window !== "undefined" && !!(window as any).electronAPI?.isElectron;

  const blobToBase64 = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.onerror = () => reject(new Error("FileReader failed"));
      reader.readAsDataURL(blob);
    });

  const ensureExtension = (fileName = "", ext = "pdf") => {
    if (!fileName) return `document.${ext}`;
    return fileName.replace(/\.[^/.]+$/, `.${ext}`);
  };

  const formatDateOnly = (dateString: string) => {
    const d = new Date(dateString);
    return isNaN(d.getTime())
      ? new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
      : d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  };

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return isNaN(d.getTime())
      ? "Invalid Date"
      : d.toLocaleString("en-US", {
          month: "long", day: "numeric", year: "numeric",
          hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "UTC",
        });
  };

  const fetchVersionFromDb = async (version: number, status: string) => {
    const endpoint =
      status === "final"
        ? `/finals/${opeId}/version/${version}`
        : `/drafts/${opeId}/version/${version}`;
    return apiFetch(endpoint);
  };

  const buildDocumentPayload = (versionData: any) => {
    let sections: any[] = [];
    let assigned: any = {};

    if (versionData.content?.documentSections) {
      sections = versionData.content.documentSections.map((s: any) => ({
        id: s.id, title: s.title, description: s.description || "",
      }));
      assigned = versionData.content.documentSections.reduce((acc: any, s: any) => {
        acc[s.id] = (s.modules || []).map((m: any) => ({
          id: m.id, name: m.name, description: m.description, sectionId: s.id,
        }));
        return acc;
      }, {});
    } else if (versionData.content?.sections && versionData.content?.assigned) {
      sections = versionData.content.sections;
      assigned = versionData.content.assigned;
    }

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
      sowType: (versionData.sowType || versionData.content?.sowType || "FULL").toUpperCase(),
      fileName: versionData.fileName || `${documentName}_${versionData.status}_v${versionData.version}.pdf`,
      createdAtFormatted: formatDateOnly(versionData.createdAt || versionData.created_at || new Date().toISOString()),
    };
  };

  const getLatestVersion = () => {
    const versions = selectedStatus === "draft" ? filteredDraftVersions : filteredFinalVersions;
    return versions[versions.length - 1];
  };

  // ─── Actions ─────────────────────────────────────────────────────────────────

  const handlePreviewVersion = async (versionObj: any) => {
    setPreviewLoading(true);
    setPreviewPdfUrl(null);
    try {
      const dbVersion = await fetchVersionFromDb(versionObj.version, versionObj.status);
      const versionData = dbVersion.draft || dbVersion.final || versionObj;
      const payload = buildDocumentPayload(versionData);

      // ✅ Backend always returns DOCX now (Electron on Windows handles TOC/PDF)
      // For preview: fetch document and process appropriately
      const isProposal = sowType.toUpperCase() === "PROPOSAL";
      
      if (isProposal) {
        // Proposal → backend converts PPTX to PDF for preview (when ?preview=true)
        const endpoint = `/proposal/${opeId}?preview=true`;
        try {
          const response = await apiFetch(endpoint, {
            method: "POST", body: JSON.stringify(payload),
            headers: { "Content-Type": "application/json" }, responseType: "blob",
          });
          
          if (!response || response.size === 0) {
            console.warn("handlePreviewVersion: Empty or null proposal response from endpoint");
            showToast("Failed to generate proposal preview - empty response", "error");
            return;
          }
          
          try {
            // Backend returns PDF for ?preview=true
            const pdfUrl = window.URL.createObjectURL(new Blob([response], { type: "application/pdf" }));
            setPreviewFileType("pdf");
            setPreviewPdfUrl(pdfUrl);
            setShowPreview(true);
          } catch (blobErr) {
            console.error("Failed to create PDF blob URL:", blobErr);
            showToast("Failed to create proposal preview URL", "error");
          }
        } catch (fetchErr) {
          console.error("Failed to fetch proposal preview:", fetchErr);
          showToast("Failed to fetch proposal preview", "error");
        }
      } else {
        // SoW/DOCX → backend returns DOCX
        const endpoint = `/generate-document/${opeId}?type=docx&preview=true`;
        const response = await apiFetch(endpoint, {
          method: "POST", body: JSON.stringify(payload),
          headers: { "Content-Type": "application/json" }, responseType: "blob",
        });
        
        if (response && response.size > 0) {
          // ✅ Electron: convert DOCX → PDF with TOC for preview
          if (isElectronEnv() && (window as any).electronAPI?.processDOCXAndGeneratePDF) {
            try {
              const base64 = await blobToBase64(response);
              const fileName = `preview_${Date.now()}.docx`;
              const result = await (window as any).electronAPI.processDOCXAndGeneratePDF({
                base64,
                fileName,
              });
              
              if (result?.success && result.pdfPath) {
                // Load PDF from file system using file:// protocol
                const fileUrl = `file:///${result.pdfPath.replace(/\\/g, "/")}`;
                setPreviewFileType("pdf");
                setPreviewPdfUrl(fileUrl);
                setShowPreview(true);
              } else {
                console.warn("processDOCXAndGeneratePDF failed:", result?.error);
                // Fallback: display DOCX as blob
                const docxUrl = window.URL.createObjectURL(new Blob([response], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));
                setPreviewFileType("docx");
                setPreviewPdfUrl(docxUrl);
                setShowPreview(true);
              }
            } catch (electronErr) {
              console.error("Electron PDF conversion failed:", electronErr);
              // Fallback: display DOCX as blob
              const docxUrl = window.URL.createObjectURL(new Blob([response], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));
              setPreviewFileType("docx");
              setPreviewPdfUrl(docxUrl);
              setShowPreview(true);
            }
          } else {
            // Non-Electron or API not available: display DOCX as blob
            const docxUrl = window.URL.createObjectURL(new Blob([response], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));
            setPreviewFileType("docx");
            setPreviewPdfUrl(docxUrl);
            setShowPreview(true);
          }
        } else {
          console.warn("handlePreviewVersion: Empty or null DOCX response");
          showToast("Failed to generate DOCX preview - empty response", "error");
        }
      }
    } catch (error) {
      console.error("Preview error:", error);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDownloadVersion = async (versionObj: any, type: "docx" | "pdf" | "pptx") => {
    const loadingKey = `${versionObj.version}-${versionObj.createdAt}-download-${type}`;
    setLoadingAction(loadingKey);
    try {
      const dbVersion = await fetchVersionFromDb(versionObj.version, versionObj.status);
      const versionData = dbVersion.draft || dbVersion.final || versionObj;
      const payload = buildDocumentPayload(versionData);

      const endpoint =
        type === "pptx" ? `/proposal/${opeId}` : `/generate-document/${opeId}?type=${type}`;
      const response = await apiFetch(endpoint, {
        method: "POST", body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" }, responseType: "blob",
      });

      if (!response || response.size === 0) { alert("Failed to generate document — empty response"); return; }

      const candidate =
        versionData.fileName || payload.fileName ||
        `${documentName}_${versionObj.status}_v${versionObj.version}`;
      const filename = ensureExtension(candidate, type);

      // Electron: save via IPC so main process can update TOC
      if (type === "docx" && isElectronEnv()) {
        try {
          const base64 = await blobToBase64(response);
          const result = await (window as any).electronAPI.saveDocxAndUpdateTOC(base64, filename);
          if (result?.success) { alert(`✅ Saved to Downloads:\n${result.filePath}`); return; }
          console.warn("[TOC] saveDocxAndUpdateTOC failed:", result?.error, "— falling back");
        } catch (ipcErr) {
          console.warn("[TOC] IPC error:", ipcErr, "— falling back");
        }
      }

      // Browser / fallback download
      const url = window.URL.createObjectURL(response);
      const a = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download error:", error);
      alert("Failed to download document");
    } finally {
      setLoadingAction(null);
    }
  };

  const openEmailModal = async (versionObj: any) => {
    const isProposal = sowType.toUpperCase() === "PROPOSAL";
    const fileType = isProposal ? "pptx" : versionObj.status === "final" ? "pdf" : "docx";
    const loadingKey = `${versionObj.version}-${versionObj.createdAt}-email`;
    setLoadingAction(loadingKey);

    const defaultFileName = ensureExtension(
      versionObj.fileName || `${documentName}_${versionObj.status}_v${versionObj.version}`,
      fileType
    );
    const subject = defaultFileName.replace(/\.[^.]+$/, "");
    const emailBody = [`Hi,`, ``, `Please find the document: ${defaultFileName}`, ``, `Best regards,`, userNameDb || "HPE Document Creator"].join("\n");

    try {
      const dbVersion = await fetchVersionFromDb(versionObj.version, versionObj.status);
      const versionData = dbVersion.draft || dbVersion.final || versionObj;
      const payload = buildDocumentPayload(versionData);

      const endpoint =
          fileType === "pptx" ? `/proposal/${opeId}` : `/generate-document/${opeId}?type=${fileType}`;
        const response = await apiFetch(endpoint, {
          method: "POST", body: JSON.stringify(payload),
          headers: { "Content-Type": "application/json" }, responseType: "blob",
        });

        if (response?.size > 0) {
          const finalFileName = ensureExtension(defaultFileName, fileType);

          // ✅ Electron: auto-attach to email client with document
          if (isElectronEnv()) {
            try {
              const base64 = await blobToBase64(response);
              const result = await (window as any).electronAPI.sendEmailWithAttachment({
                base64,
                fileName: finalFileName,
                subject,
                body: emailBody,
                fileType,
              });
              if (result?.success) {
                const method = result.method || "unknown";
                let message: string;

                if (method === "outlook-com") {
                  message = `✅ Outlook opened — ${finalFileName} is attached and ready to send.`;
                } else if (method === "mailto") {
                  message = `📬 Mail client opened. Attach the file from your Downloads folder: ${finalFileName}`;
                } else {
                  message = `📎 Document saved to Downloads: ${finalFileName}`;
                }

                showToast(message, "success");
                setShowEmailModal(false);
                setSelectedTo([]);
                setCcInput("");
                setToInput("");
                setSelectedCc([]);
                return;
              } else {
                console.warn("sendEmailWithAttachment failed:", result?.error);
              }
            } catch (ipcErr) {
              console.warn("IPC sendEmailWithAttachment error:", ipcErr);
            }
          }

          // ✅ Web fallback: trigger browser download so user can manually attach
          const url = window.URL.createObjectURL(response);
          const a = document.createElement("a");
          a.href = url; a.download = finalFileName;
          document.body.appendChild(a); a.click();
          document.body.removeChild(a);
          setTimeout(() => window.URL.revokeObjectURL(url), 30_000);

          // ✅ Open email modal for manual to/cc entry in web mode
          setShowEmailModal(true);
          setSelectedVersion(versionObj);
        } else {
          console.warn("openEmailModal: generated file blob empty");
          showToast("Failed to generate document", "error");
        }
      } catch (err) {
        console.warn("openEmailModal: generation failed", err);
        showToast("Error generating document", "error");
      } finally {
        setLoadingAction(null);
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
    setLoadingAction(`${selectedVersion.version}-${selectedVersion.createdAt}-email`);
    try {
      const dbVersion = await fetchVersionFromDb(selectedVersion.version, selectedVersion.status);
      const versionData = dbVersion.draft || dbVersion.final || selectedVersion;
      const payload = buildDocumentPayload(versionData);

      const isElectron = typeof window !== "undefined" && (window as any).electron?.isElectron;
      const wantClientPdf = isElectron && selectedVersion.status === "final";
      const fileType = wantClientPdf ? "docx" : selectedVersion.status === "final" ? "pdf" : "docx";

      const response = await apiFetch(`/generate-document/${opeId}?send=true&type=${fileType}`, {
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

      if (!response?.success) {
        showToast(`Document generation failed: ${response?.message || response?.error || "unknown error"}`, "error");
        return;
      }

      if (isElectron && response.fileData) {
        // ✅ Use the correct Electron API from preload.js
        try {
          if (wantClientPdf && (window as any).electronAPI?.processDOCXAndGeneratePDF) {
            // Send DOCX to Electron to update TOC and generate PDF
            const result = await (window as any).electronAPI.processDOCXAndGeneratePDF({
              base64: response.fileData,
              fileName: `${documentName}_final_v${selectedVersion.version}.docx`,
            });
            if (!result?.success) throw new Error(result?.error || "Failed to process document");
            showToast("✅ Document processed (TOC updated, PDF generated), email client ready!", "success");
          } else if ((window as any).electronAPI?.sendEmailWithAttachment) {
            // Send DOCX/PDF directly via email
            const emailResult = await (window as any).electronAPI.sendEmailWithAttachment({
              base64: response.fileData,
              fileName: `${documentName}_${selectedVersion.status}_v${selectedVersion.version}.${fileType}`,
              subject: `Document Version ${selectedVersion.version} - ${documentName}`,
              body: `Hi,\n\nPlease find attached version ${selectedVersion.version} (${selectedVersion.status}) of "${documentName}".\n\nBest regards,\n${userNameDb}\n${userEmail}`,
              fileType,
            });
            if (!emailResult?.success) throw new Error(emailResult?.error || "Failed to open email client");
            showToast("✅ Email client opened with document attached!", "success");
          } else {
            throw new Error("Electron API methods not available");
          }
        } catch (electronErr) {
          console.warn("Electron email failed, using backend email:", electronErr);
          showToast("✅ Email sent successfully!", "success");
        }
      } else {
        showToast("✅ Email sent successfully!", "success");
      }
      closeEmailModal();
    } catch (error: any) {
      console.error("Email preparation error:", error);
      showToast(`Something went wrong: ${error.message || "Unknown error"}`, "error");
    } finally {
      setLoadingAction(null);
    }
  };

  const addRecipient = (email: string, type: "to" | "cc") => {
    if (type === "to" && !selectedTo.includes(email) && !selectedCc.includes(email)) {
      setSelectedTo((prev) => [...prev, email]);
      setToInput(""); setToSuggestions([]);
    } else if (type === "cc" && !selectedCc.includes(email) && !selectedTo.includes(email)) {
      setSelectedCc((prev) => [...prev, email]);
      setCcInput(""); setCcSuggestions([]);
    }
  };

  const removeRecipient = (email: string, type: "to" | "cc") => {
    if (type === "to") setSelectedTo((prev) => prev.filter((e) => e !== email));
    else setSelectedCc((prev) => prev.filter((e) => e !== email));
  };

  // ─── Sub-renders ─────────────────────────────────────────────────────────────

  const renderVersionCard = (version: any, isDraft: boolean) => {
    const loadingKey = `${version.version}-${version.createdAt}`;
    const colorClass = isDraft ? "blue" : "green";
    const isProposal = sowType.toUpperCase() === "PROPOSAL";

    return (
      <div key={loadingKey} className={`bg-white p-4 rounded-lg border border-${colorClass}-200 hover:shadow-md transition-all`}>
        <div className="flex items-center justify-between mb-2">
          <span
            className={`text-sm text-${colorClass}-700 underline cursor-pointer flex-1 truncate`}
            onClick={() => handlePreviewVersion(version)}
            title="Preview this version"
          >
            {version.fileName || `${documentName}_${version.status}_v${version.version}${isProposal ? ".pptx" : ".docx"}`}
          </span>
          <div className="flex gap-2 ml-2">
            {/* DOCX download — non-proposal only */}
            {!isProposal && (
              <button
                onClick={() => handleDownloadVersion(version, "docx")}
                className="p-1 hover:bg-blue-50 rounded-md transition-colors"
                title="Download DOCX"
                disabled={loadingAction === `${loadingKey}-download-docx`}
              >
                {loadingAction === `${loadingKey}-download-docx`
                  ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
                  : <Download className="h-4 w-4 text-blue-600" />}
              </button>
            )}

            {/* PPTX for proposals; PDF for finals (non-proposal) */}
            {isProposal ? (
              <button
                onClick={() => handleDownloadVersion(version, "pptx")}
                className="p-1 hover:bg-purple-50 rounded-md transition-colors"
                title="Download PPTX"
                disabled={loadingAction === `${loadingKey}-download-pptx`}
              >
                {loadingAction === `${loadingKey}-download-pptx`
                  ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600" />
                  : <FileCheck2 className="h-4 w-4 text-purple-600" />}
              </button>
            ) : (
              !isDraft && (
                <button
                  onClick={() => handleDownloadVersion(version, "pdf")}
                  className="p-1 hover:bg-red-50 rounded-md transition-colors"
                  title="Download PDF"
                  disabled={loadingAction === `${loadingKey}-download-pdf`}
                >
                  {loadingAction === `${loadingKey}-download-pdf`
                    ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600" />
                    : <FileCheck2 className="h-4 w-4 text-red-600" />}
                </button>
              )
            )}

            <button
              onClick={() => openEmailModal(version)}
              className="p-1 hover:bg-green-50 rounded-md transition-colors"
              title="Send Email"
              disabled={loadingAction === `${loadingKey}-email`}
            >
              {loadingAction === `${loadingKey}-email`
                ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600" />
                : <Mail className="h-4 w-4 text-green-600" />}
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

  const renderSuggestions = (suggestions: any[], type: "to" | "cc") => (
    suggestions.length > 0 && (
      <div className="mt-2 border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto bg-white">
        {suggestions.map((s) => (
          <div
            key={s.id}
            className="cursor-pointer px-4 py-2.5 hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-0"
            onClick={() => addRecipient(s.email, type)}
          >
            <div className="font-medium text-gray-900">{s.memberName}</div>
            <div className="text-sm text-gray-500">{s.email}</div>
          </div>
        ))}
      </div>
    )
  );

  const renderTags = (emails: string[], type: "to" | "cc") => (
    emails.length > 0 && (
      <div className="mt-3 flex flex-wrap gap-2">
        {emails.map((email, idx) => (
          <div key={idx} className={`flex items-center gap-2 ${type === "to" ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-800"} px-3 py-1.5 rounded-full text-sm`}>
            <span>{email}</span>
            <button type="button" onClick={() => removeRecipient(email, type)} className="hover:bg-opacity-20 rounded-full p-0.5 transition-colors">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    )
  );

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 bg-gray-900/75 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-[1200px] max-h-[90vh] shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <History className="h-6 w-6 text-blue-600" />
            <h2 className="text-lg font-bold text-gray-900">Generate Document</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          <div className="grid grid-cols-[35%_65%] gap-8">
            {/* Left Column */}
            <div className="space-y-6">
              {/* Status selector */}
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                <h3 className="text-base font-semibold text-gray-900 mb-4">Select Status</h3>
                <div className="flex gap-4">
                  {(["draft", "final"] as const).map((s) => (
                    <label key={s} className="flex-1">
                      <input type="radio" name="status" value={s} checked={selectedStatus === s}
                        onChange={() => setSelectedStatus(s)} className="sr-only peer" />
                      <div className={`flex items-center gap-3 p-3 bg-white border-2 border-gray-200 rounded-xl cursor-pointer transition-colors hover:bg-gray-50 ${
                        s === "draft" ? "peer-checked:border-blue-500 peer-checked:bg-blue-50" : "peer-checked:border-green-500 peer-checked:bg-green-50"
                      }`}>
                        {s === "draft"
                          ? <FileText className="h-5 w-5 text-blue-600" />
                          : <FileCheck className="h-5 w-5 text-green-600" />}
                        <span className="font-medium text-gray-900 capitalize">{s}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Generate button */}
              <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                <button
                  onClick={() => onGenerate("docx", selectedStatus, getLatestVersion())}
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

            {/* Right Column — Version History */}
            <div className="space-y-6">
              {/* Draft versions */}
              <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 h-[300px] flex flex-col">
                <h3 className="text-base font-semibold text-blue-900 mb-4 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-600" /> Draft Version History
                </h3>
                <div className="space-y-3 overflow-y-auto flex-1 pr-2">
                  {filteredDraftVersions.length > 0
                    ? filteredDraftVersions.map((d) => renderVersionCard(d, true))
                    : <div className="text-sm text-blue-600 italic text-center py-4">No drafts yet</div>}
                </div>
              </div>

              {/* Final versions */}
              <div className="bg-green-50 p-6 rounded-xl border border-green-100 h-[300px] flex flex-col">
                <h3 className="text-base font-semibold text-green-900 mb-4 flex items-center gap-2">
                  <FileCheck className="h-5 w-5 text-green-600" /> Final Version History
                </h3>
                <div className="space-y-3 overflow-y-auto flex-1 pr-2">
                  {filteredFinalVersions.length > 0
                    ? filteredFinalVersions.map((f) => renderVersionCard(f, false))
                    : <div className="text-sm text-green-600 italic text-center py-4">No finals yet</div>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Preview loading overlay */}
      {previewLoading && (
        <div className="fixed inset-0 bg-gray-900/75 flex items-center justify-center z-[60]">
          <div className="text-center text-white">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto" />
            <p className="mt-4">Loading preview...</p>
          </div>
        </div>
      )}

      {/* Preview modal */}
      <DocxPreviewModal
        isOpen={showPreview} onClose={() => setShowPreview(false)}
        pdfUrl={previewPdfUrl} fileType={previewFileType} loading={previewLoading}
      />

      {/* Email modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70]">
          <div className="bg-white rounded-xl shadow-2xl w-[600px] max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <Mail className="h-6 w-6 text-blue-600" />
                <h3 className="text-xl font-bold text-gray-900">Send Email</h3>
              </div>
              <button onClick={() => setShowEmailModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {/* To */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  To <span className="text-red-500">*</span>
                </label>
                <input
                  type="text" value={toInput}
                  onChange={(e) => setToInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && toInput.trim()) addRecipient(toInput.trim(), "to"); }}
                  placeholder="Type name or email and press Enter"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
                {renderSuggestions(toSuggestions, "to")}
                {renderTags(selectedTo, "to")}
              </div>

              {/* CC */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">CC</label>
                <input
                  type="text" value={ccInput}
                  onChange={(e) => setCcInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && ccInput.trim()) addRecipient(ccInput.trim(), "cc"); }}
                  placeholder="Type name or email and press Enter"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
                {renderSuggestions(ccSuggestions, "cc")}
                {renderTags(selectedCc, "cc")}
              </div>
            </div>

            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
              <button onClick={() => setShowEmailModal(false)} className="px-6 py-2.5 text-gray-700 font-medium hover:bg-gray-200 rounded-lg transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSendEmail}
                disabled={selectedTo.length === 0 || !!loadingAction?.includes("email")}
                className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {loadingAction?.includes("email") ? (
                  <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Sending...</>
                ) : (
                  <><Mail className="h-4 w-4" /> Send Email</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast.show && (
        <div className="fixed top-4 right-4 z-[80] animate-in slide-in-from-top-2 duration-300">
          <div className={`flex items-center gap-3 px-6 py-4 rounded-lg shadow-lg ${
            toast.type === "success" ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"
          }`}>
            {toast.type === "success"
              ? <CheckCircle className="h-5 w-5 text-green-600" />
              : <XCircle className="h-5 w-5 text-red-600" />}
            <span className={`font-medium ${toast.type === "success" ? "text-green-800" : "text-red-800"}`}>
              {toast.message}
            </span>
            <button
              onClick={() => setToast({ show: false, message: "", type: "success" })}
              className={`p-1 rounded-full transition-colors ${toast.type === "success" ? "hover:bg-green-200" : "hover:bg-red-200"}`}
            >
              <X size={16} className={toast.type === "success" ? "text-green-600" : "text-red-600"} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Module-level helpers ─────────────────────────────────────────────────────

function replaceTags(text: string, { customerName, partnerName, documentName }: any) {
  if (!text) return "";
  return text
    .replace(/{{\s*customerName\s*}}/gi, customerName || "")
    .replace(/{{\s*partnerName\s*}}/gi, partnerName || "")
    .replace(/{{\s*documentName\s*}}/gi, documentName || "");
}

const ensureExtension = (fileName = "", ext = "pdf") => {
  if (!fileName) return `document.${ext}`;
  return fileName.replace(/\.[^/.]+$/, `.${ext}`);
};