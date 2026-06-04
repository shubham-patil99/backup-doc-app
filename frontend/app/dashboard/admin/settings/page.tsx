// @ts-nocheck
"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Upload, X, Check, AlertCircle, Loader,
  Download, Trash2, FileText, Type,
} from "lucide-react";
import { apiFetch } from "@/lib/apiClient";

export default function SettingsPage() {
  // ── Logo state ──────────────────────────────────────────────────────────────
  const [logo, setLogo] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoLoading, setLogoLoading] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // ── App Name state ──────────────────────────────────────────────────────────
  const [appName, setAppName] = useState("Brahma");
  const [appNameInput, setAppNameInput] = useState("Brahma");
  const [appNameLoading, setAppNameLoading] = useState(false);
  const [appNameEditing, setAppNameEditing] = useState(false);

  // ── Templates state ─────────────────────────────────────────────────────────
  const [templates, setTemplates] = useState<any[]>([]);
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [downloadingTemplate, setDownloadingTemplate] = useState<string | null>(null);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<string | null>(null);

  // ── Toast state ──────────────────────────────────────────────────────────────
  const [successMessage, setSuccessMessage] = useState("");
  const [errorToast, setErrorToast] = useState("");

  const logoInputRef = useRef<HTMLInputElement>(null);
  const templateInputRef = useRef<HTMLInputElement>(null);

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(""), 3000);
  };
  const showError = (msg: string) => {
    setErrorToast(msg);
    setTimeout(() => setErrorToast(""), 4000);
  };

  useEffect(() => {
    fetchLogo();
    fetchAppName();
    fetchTemplates();
  }, []);

  // ─── Fetch logo ──────────────────────────────────────────────────────────────
  const fetchLogo = async () => {
    try {
      const blob = await apiFetch("/settings/logo/file", {
        credentials: "include",
        responseType: "blob",
      });
      if (blob) setLogo(URL.createObjectURL(blob));
    } catch (err) {
      console.error("Failed to fetch logo:", err);
    }
  };

  // ─── Fetch app name ───────────────────────────────────────────────────────────
  const fetchAppName = async () => {
    try {
      const data = await apiFetch("/settings/app-name", { credentials: "include" });
      if (data?.name) {
        setAppName(data.name);
        setAppNameInput(data.name);
      }
    } catch (err) {
      // Silently fall back to default "Brahma" if endpoint doesn't exist yet
      console.warn("App name endpoint not available, using default");
    }
  };

  // ─── Save app name ────────────────────────────────────────────────────────────
  const handleSaveAppName = async () => {
    const trimmed = appNameInput.trim();
    if (!trimmed) { showError("App name cannot be empty"); return; }
    if (trimmed === appName) { setAppNameEditing(false); return; }

    setAppNameLoading(true);
    try {
      await apiFetch("/settings/app-name", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      setAppName(trimmed);
      setAppNameEditing(false);
      // Broadcast to other tabs (UserHeader & AdminDashboard pick this up)
      window.dispatchEvent(new StorageEvent("storage", { key: "appName", newValue: trimmed }));
      localStorage.setItem("appName", trimmed);
      showSuccess("App name updated successfully!");
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to update app name");
    } finally {
      setAppNameLoading(false);
    }
  };

  const handleCancelAppName = () => {
    setAppNameInput(appName);
    setAppNameEditing(false);
  };

  // ─── Fetch templates ──────────────────────────────────────────────────────────
  const fetchTemplates = async () => {
    try {
      const data = await apiFetch("/settings/templates", { credentials: "include" });
      if (Array.isArray(data)) setTemplates(data);
    } catch (err) {
      console.error("Failed to fetch templates:", err);
    }
  };

  // ─── Logo handlers ────────────────────────────────────────────────────────────
  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      showError("Only PNG and JPG files are allowed"); return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showError("File size must be less than 5MB"); return;
    }
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setLogoPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleUploadLogo = async () => {
    if (!logoFile) { showError("Please select a logo file"); return; }
    setLogoLoading(true);
    try {
      const formData = new FormData();
      formData.append("logo", logoFile);
      const result = await apiFetch("/settings/logo", {
        method: "POST", body: formData, credentials: "include",
      });
      setLogo(result.logoUrl);
      setLogoFile(null);
      setLogoPreview(null);
      showSuccess("Logo updated successfully!");
      if (logoInputRef.current) logoInputRef.current.value = "";
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to upload logo");
    } finally {
      setLogoLoading(false);
    }
  };

  const handleCancelLogoPreview = () => {
    setLogoFile(null);
    setLogoPreview(null);
    if (logoInputRef.current) logoInputRef.current.value = "";
  };

  // ─── Template handlers ────────────────────────────────────────────────────────
  const handleTemplateSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validTypes = [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ];
    if (!validTypes.includes(file.type)) {
      showError("Only DOCX and PPTX files are allowed"); return;
    }
    if (file.size > 20 * 1024 * 1024) {
      showError("File size must be less than 20MB"); return;
    }
    setTemplateFile(file);
  };

  const handleUploadTemplate = async () => {
    if (!templateFile || !selectedTemplate) {
      showError("Please select a template to replace"); return;
    }
    setTemplateLoading(true);
    try {
      const formData = new FormData();
      formData.append("template", templateFile);
      formData.append("templateName", selectedTemplate);
      await apiFetch("/settings/templates", {
        method: "POST", body: formData, credentials: "include",
      });
      await fetchTemplates();
      setTemplateFile(null);
      setSelectedTemplate(null);
      showSuccess("Template updated successfully!");
      if (templateInputRef.current) templateInputRef.current.value = "";
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to upload template");
    } finally {
      setTemplateLoading(false);
    }
  };

  const handleDownloadTemplate = async (e: React.MouseEvent, templateName: string) => {
    e.stopPropagation();
    setDownloadingTemplate(templateName);
    try {
      const blob = await apiFetch(
        `/settings/templates/${encodeURIComponent(templateName)}/download`,
        { credentials: "include", responseType: "blob" }
      );
      if (!blob) throw new Error("Download failed");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = templateName;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showSuccess("Template downloaded successfully!");
    } catch (err) {
      showError("Failed to download template");
    } finally {
      setDownloadingTemplate(null);
    }
  };

  const handleDeleteTemplate = (templateName: string) => setDeleteConfirmModal(templateName);

  const confirmDeleteTemplate = async (templateName: string) => {
    try {
      await apiFetch(`/settings/templates/${encodeURIComponent(templateName)}`, {
        method: "DELETE", credentials: "include",
      });
      await fetchTemplates();
      showSuccess("Template deleted successfully!");
    } catch (err) {
      showError("Failed to delete template");
    } finally {
      setDeleteConfirmModal(null);
    }
  };

  const getTemplateType = (fileName: string) => {
    if (fileName.endsWith(".docx")) return "DOCX";
    if (fileName.endsWith(".pptx")) return "PPTX";
    return "Unknown";
  };

  const HEADER_GRADIENT = "linear-gradient(135deg, #004f2d 0%, #00b386 70%)";

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* ══ LOGO CARD ══════════════════════════════════════════════════════════ */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 flex items-center justify-between" style={{ background: HEADER_GRADIENT }}>
            <h2 className="text-lg font-semibold text-white tracking-wide">Application Logo</h2>
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shadow-md border border-white/30">
              <Upload size={18} className="text-white" />
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              {/* Preview */}
              <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center min-h-[150px]">
                {logoPreview ? (
                  <div className="flex flex-col items-center p-4">
                    <img src={logoPreview} alt="Logo preview" className="max-w-[200px] max-h-[120px] object-contain" />
                    <p className="text-xs text-gray-500 mt-2">Preview</p>
                  </div>
                ) : logo ? (
                  <div className="flex flex-col items-center p-4">
                    <img src={logo} alt="Current logo" className="max-w-[200px] max-h-[120px] object-contain" />
                    <p className="text-xs text-gray-500 mt-2">Current Logo</p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">No logo uploaded yet</p>
                )}
              </div>

              {/* Controls */}
              <div className="flex flex-col gap-4">
                <div className="p-3 bg-green-50 border border-green-100 rounded-xl text-sm text-green-800 space-y-1">
                  <p className="font-semibold text-green-900 text-xs uppercase tracking-wide mb-1">Specifications</p>
                  <p>• Format: PNG or JPG</p>
                  <p>• Recommended: 300 × 100 px</p>
                  <p>• Max size: 5 MB</p>
                </div>
                <input type="file" ref={logoInputRef} onChange={handleLogoSelect} accept=".png,.jpg,.jpeg" className="hidden" />
                <button
                  onClick={() => logoInputRef.current?.click()}
                  className="w-full px-4 py-2.5 bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-600 hover:bg-green-50 hover:border-green-300 transition-colors"
                >
                  {logoFile ? `Selected: ${logoFile.name}` : "Click to select logo"}
                </button>
                {logoFile && (
                  <div className="flex gap-3">
                    <button
                      onClick={handleUploadLogo}
                      disabled={logoLoading}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 font-medium text-sm flex items-center justify-center gap-2 transition-colors"
                    >
                      {logoLoading
                        ? <><Loader size={14} className="animate-spin" /> Uploading...</>
                        : <><Check size={14} /> Upload</>}
                    </button>
                    <button
                      onClick={handleCancelLogoPreview}
                      className="px-4 py-2.5 rounded-xl border border-gray-300 text-gray-600 hover:bg-gray-50 flex items-center justify-center transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ══ APP NAME CARD ═══════════════════════════════════════════════════════ */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 flex items-center justify-between" style={{ background: HEADER_GRADIENT }}>
            <h2 className="text-lg font-semibold text-white tracking-wide">Application Name</h2>
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shadow-md border border-white/30">
              <Type size={18} className="text-white" />
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

              {/* Left: live preview */}
              <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center min-h-[120px] gap-2 px-6">
                <p className="text-xs text-gray-400 uppercase tracking-widest font-medium">Live Preview</p>
                <p className="text-2xl font-bold text-gray-800 tracking-tight">
                  {appNameEditing ? appNameInput || <span className="text-gray-300 italic">Type a name…</span> : appName}
                </p>
                <p className="text-xs text-gray-400">Shown in header</p>
              </div>

              {/* Right: edit controls */}
              <div className="flex flex-col gap-4">
                <div className="p-3 bg-green-50 border border-green-100 rounded-xl text-sm text-green-800 space-y-1">
                  <p className="font-semibold text-green-900 text-xs uppercase tracking-wide mb-1">Guidelines</p>
                  <p>• Keep it short and memorable</p>
                  <p>• Max 32 characters recommended</p>
                  <p>• Reflects across all headers instantly</p>
                </div>

                {!appNameEditing ? (
                  /* View mode */
                  <div className="flex items-center gap-3">
                    <div className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 font-medium">
                      {appName}
                    </div>
                    <button
                      onClick={() => setAppNameEditing(true)}
                      className="px-4 py-2.5 rounded-xl bg-green-600 text-white hover:bg-green-700 font-medium text-sm transition-colors whitespace-nowrap"
                    >
                      Edit Name
                    </button>
                  </div>
                ) : (
                  /* Edit mode */
                  <div className="flex flex-col gap-3">
                    <input
                      type="text"
                      value={appNameInput}
                      onChange={(e) => setAppNameInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleSaveAppName(); if (e.key === "Escape") handleCancelAppName(); }}
                      maxLength={50}
                      placeholder="Enter application name"
                      autoFocus
                      className="w-full px-4 py-2.5 border-2 border-green-400 focus:border-green-600 rounded-xl text-sm text-gray-800 font-medium outline-none bg-white transition-colors"
                    />
                    <div className="flex gap-3">
                      <button
                        onClick={handleSaveAppName}
                        disabled={appNameLoading || !appNameInput.trim()}
                        className="flex-1 px-4 py-2.5 rounded-xl bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 font-medium text-sm flex items-center justify-center gap-2 transition-colors"
                      >
                        {appNameLoading
                          ? <><Loader size={14} className="animate-spin" /> Saving...</>
                          : <><Check size={14} /> Save Name</>}
                      </button>
                      <button
                        onClick={handleCancelAppName}
                        className="px-4 py-2.5 rounded-xl border border-gray-300 text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-1.5 text-sm transition-colors"
                      >
                        <X size={14} /> Cancel
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 text-right">{appNameInput.length}/50</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ══ TEMPLATES CARD ══════════════════════════════════════════════════════ */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 flex items-center justify-between" style={{ background: HEADER_GRADIENT }}>
            <h2 className="text-lg font-semibold text-white tracking-wide">Document Templates</h2>
            {templates.length > 0 && (
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-bold shadow-md border border-white/30 text-sm">
                {templates.length}
              </div>
            )}
          </div>

          <div className="p-6 space-y-6">
            {templates.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 uppercase text-xs">#</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 uppercase text-xs">Template Name</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 uppercase text-xs">Type</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 uppercase text-xs">Size</th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-700 uppercase text-xs">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {templates.map((template, idx) => {
                      const type = getTemplateType(template.name);
                      return (
                        <tr
                          key={template.name}
                          onClick={() => setSelectedTemplate(selectedTemplate === template.name ? null : template.name)}
                          className={`border-b border-gray-100 hover:bg-green-50 transition-colors cursor-pointer group ${selectedTemplate === template.name ? "bg-green-50" : ""}`}
                        >
                          <td className="py-3 px-4 text-gray-500">{idx + 1}</td>
                          <td className="py-3 px-4 min-w-48">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-gradient-to-br from-green-100 to-green-100 rounded-full flex items-center justify-center">
                                <FileText size={14} className={type === "DOCX" ? "text-blue-600" : "text-orange-500"} />
                              </div>
                              <span className="text-gray-900 font-medium truncate max-w-[180px]">{template.name}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${type === "DOCX" ? "bg-blue-100 text-blue-800" : "bg-orange-100 text-orange-800"}`}>
                              {type}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-gray-600">{(template.size / 1024).toFixed(2)} KB</td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center gap-2 justify-end">
                              {selectedTemplate === template.name && (
                                <span className="text-xs text-green-700 font-medium bg-green-100 px-2 py-0.5 rounded-full">Selected</span>
                              )}
                              <button
                                onClick={(e) => handleDownloadTemplate(e, template.name)}
                                disabled={downloadingTemplate === template.name}
                                title="Download"
                                className="p-1.5 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50"
                              >
                                {downloadingTemplate === template.name
                                  ? <Loader size={14} className="animate-spin" />
                                  : <Download size={14} />}
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(template.name); }}
                                title="Delete"
                                className="p-1.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-all opacity-0 group-hover:opacity-100"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <p className="text-gray-600 text-sm">No templates found</p>
              </div>
            )}

            <div className="border-t border-gray-100 pt-4 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {selectedTemplate ? `Replace: ${selectedTemplate}` : "Upload / Replace Template"}
              </p>
              <input type="file" ref={templateInputRef} onChange={handleTemplateSelect} accept=".docx,.pptx" className="hidden" />
              <button
                onClick={() => templateInputRef.current?.click()}
                className="w-full px-4 py-2.5 bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-600 hover:bg-green-50 hover:border-green-300 transition-colors"
              >
                {templateFile ? `Selected: ${templateFile.name}` : "Click to select DOCX or PPTX"}
              </button>
              {templateFile && !selectedTemplate && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  ⚠️ Select a template row above to replace it with this file.
                </p>
              )}
              {templateFile && selectedTemplate && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-xs text-amber-800 mb-3">
                    ⚠️ This will replace <strong>{selectedTemplate}</strong>.
                    {selectedTemplate.endsWith(".docx") && (
                      <span className="block mt-1">Placeholders and formatting will be migrated into the new file.</span>
                    )}
                  </p>
                  <button
                    onClick={handleUploadTemplate}
                    disabled={templateLoading}
                    className="w-full px-4 py-2.5 rounded-xl bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 font-medium text-sm flex items-center justify-center gap-2 transition-colors"
                  >
                    {templateLoading
                      ? <><Loader size={14} className="animate-spin" /> Uploading &amp; Migrating...</>
                      : <><Upload size={14} /> Replace Template</>}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── TOASTS ── */}
      {successMessage && (
        <div className="fixed bottom-6 right-6 flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg shadow-lg z-50">
          <div className="w-5 h-5 rounded-full bg-green-600 flex items-center justify-center text-white flex-shrink-0 mt-0.5">
            <Check size={14} />
          </div>
          <p className="text-sm text-green-800">{successMessage}</p>
          <button onClick={() => setSuccessMessage("")} className="ml-auto text-green-400 hover:text-green-600"><X size={14} /></button>
        </div>
      )}
      {errorToast && (
        <div className="fixed bottom-6 right-6 flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg shadow-lg z-50">
          <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">{errorToast}</p>
          <button onClick={() => setErrorToast("")} className="ml-auto text-red-400 hover:text-red-600"><X size={14} /></button>
        </div>
      )}

      {/* ── DELETE MODAL ── */}
      {deleteConfirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertCircle size={24} className="text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Template</h3>
                <p className="text-sm text-gray-600">
                  Are you sure you want to delete <span className="font-semibold">{deleteConfirmModal}</span>? This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-3 mt-8">
              <button onClick={() => setDeleteConfirmModal(null)} className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium text-sm transition-colors">
                Cancel
              </button>
              <button onClick={() => confirmDeleteTemplate(deleteConfirmModal)} className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 text-white hover:bg-red-700 font-medium text-sm transition-colors">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}