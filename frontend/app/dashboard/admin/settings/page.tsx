// @ts-nocheck
"use client";

import React, { useState, useEffect, useRef } from "react";
import { Upload, X, Check, AlertCircle, Loader, Download, Trash2, FileText } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";

// Toast notification component
const Toast = ({ message, type = "success", onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor = type === "success" ? "bg-green-500" : type === "error" ? "bg-red-500" : "bg-blue-500";
  return (
    <div className={`fixed bottom-4 right-4 ${bgColor} text-white px-4 py-3 rounded-lg shadow-lg z-50 flex items-center gap-2`}>
      {type === "success" && <Check className="h-5 w-5" />}
      {type === "error" && <AlertCircle className="h-5 w-5" />}
      {message}
    </div>
  );
};

export default function SettingsPage() {
  const [logo, setLogo] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoLoading, setLogoLoading] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const [templates, setTemplates] = useState<any[]>([]);
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const [toast, setToast] = useState<{ message: string; type: string } | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const templateInputRef = useRef<HTMLInputElement>(null);

  // ─── Fetch current logo ──────────────────────────────────────────────────────
  useEffect(() => {
    fetchLogo();
    fetchTemplates();
  }, []);

  const fetchLogo = async () => {
    try {
      // Use relative API path - Next.js will proxy to backend
      const response = await fetch("/api/settings/logo/file", {
        credentials: "include",
      });
      if (response.ok) {
        const blob = await response.blob();
        const logoBlob = URL.createObjectURL(blob);
        setLogo(logoBlob);
      } else {
        console.error(`Failed to fetch logo: ${response.status}`);
      }
    } catch (err) {
      console.error("Failed to fetch logo:", err);
    }
  };

  // ─── Fetch available templates ───────────────────────────────────────────────
  const fetchTemplates = async () => {
    try {
      const response = await fetch("/api/settings/templates", {
        credentials: "include",
      });
      
      if (response.ok) {
        const templates = await response.json();
        if (Array.isArray(templates)) {
          setTemplates(templates);
        }
      } else {
        console.error(`Failed to fetch templates: ${response.status}`);
      }
    } catch (err) {
      console.error("Failed to fetch templates:", err);
    }
  };

  // ─── Logo handlers ──────────────────────────────────────────────────────────

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      showToast("Only PNG and JPG files are allowed", "error");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showToast("File size must be less than 5MB", "error");
      return;
    }

    setLogoFile(file);

    // Show preview
    const reader = new FileReader();
    reader.onload = (event) => {
      setLogoPreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUploadLogo = async () => {
    if (!logoFile) {
      showToast("Please select a logo file", "error");
      return;
    }

    setLogoLoading(true);
    try {
      const formData = new FormData();
      formData.append("logo", logoFile);

      // Use Next.js API proxy route
      const response = await fetch("/api/settings/logo", {
        method: "POST",
        body: formData,
        credentials: "include", // Include httpOnly cookies
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData?.error || "Failed to upload logo");
      }

      const result = await response.json();
      setLogo(result.logoUrl);
      setLogoFile(null);
      setLogoPreview(null);
      showToast("Logo updated successfully!", "success");

      if (logoInputRef.current) {
        logoInputRef.current.value = "";
      }
    } catch (err) {
      console.error("Logo upload error:", err);
      showToast(err instanceof Error ? err.message : "Failed to upload logo", "error");
    } finally {
      setLogoLoading(false);
    }
  };

  const handleCancelLogoPreview = () => {
    setLogoFile(null);
    setLogoPreview(null);
    if (logoInputRef.current) {
      logoInputRef.current.value = "";
    }
  };

  // ─── Template handlers ──────────────────────────────────────────────────────

  const handleTemplateSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.presentationml.presentation"];
    if (!validTypes.includes(file.type)) {
      showToast("Only DOCX and PPTX files are allowed", "error");
      return;
    }

    // Validate file size (max 20MB)
    if (file.size > 20 * 1024 * 1024) {
      showToast("File size must be less than 20MB", "error");
      return;
    }

    setTemplateFile(file);
  };

  const handleUploadTemplate = async () => {
    if (!templateFile || !selectedTemplate) {
      showToast("Please select a template to replace", "error");
      return;
    }

    setTemplateLoading(true);
    try {
      const formData = new FormData();
      formData.append("template", templateFile);
      formData.append("templateName", selectedTemplate);

      // Use Next.js API proxy route
      const response = await fetch("/api/settings/templates", {
        method: "POST",
        body: formData,
        credentials: "include", // Include httpOnly cookies
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData?.error || "Failed to upload template");
      }

      await fetchTemplates();
      setTemplateFile(null);
      setSelectedTemplate(null);
      showToast("Template updated successfully!", "success");

      if (templateInputRef.current) {
        templateInputRef.current.value = "";
      }
    } catch (err) {
      console.error("Template upload error:", err);
      showToast(err instanceof Error ? err.message : "Failed to upload template", "error");
    } finally {
      setTemplateLoading(false);
    }
  };

  const handleDeleteTemplate = async (templateName: string) => {
    if (!window.confirm(`Delete template: ${templateName}?`)) return;

    try {
      const response = await fetch(`/api/settings/templates/${encodeURIComponent(templateName)}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (response.ok) {
        await fetchTemplates();
        showToast("Template deleted successfully!", "success");
      } else {
        throw new Error("Failed to delete template");
      }
    } catch (err) {
      console.error("Template delete error:", err);
      showToast("Failed to delete template", "error");
    }
  };

  const showToast = (message: string, type: string) => {
    setToast({ message, type });
  };

  // ─── Helper to determine template type ───────────────────────────────────────
  const getTemplateType = (fileName: string) => {
    if (fileName.endsWith(".docx")) return "DOCX";
    if (fileName.endsWith(".pptx")) return "PPTX";
    return "Unknown";
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-2">Manage application logo and document templates</p>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* ── LOGO SECTION ── */}
          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Upload className="h-6 w-6 text-blue-600" />
              Application Logo
            </h2>

            {/* Current Logo Preview */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center min-h-[150px]">
              {logoPreview ? (
                <div className="flex flex-col items-center">
                  <img src={logoPreview} alt="Logo preview" className="max-w-[200px] max-h-[120px] object-contain" />
                  <p className="text-sm text-gray-600 mt-2">Preview</p>
                </div>
              ) : logo ? (
                <div className="flex flex-col items-center">
                  <img src={logo} alt="Current logo" className="max-w-[200px] max-h-[120px] object-contain" />
                  <p className="text-sm text-gray-600 mt-2">Current Logo</p>
                </div>
              ) : (
                <p className="text-gray-500">No logo uploaded yet</p>
              )}
            </div>

            {/* Logo Specifications */}
            <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm font-semibold text-blue-900 mb-2">📋 Specifications:</p>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Format: PNG or JPG</li>
                <li>• Recommended Size: 300 × 100 pixels</li>
                <li>• Max File Size: 5 MB</li>
              </ul>
            </div>

            {/* File Input */}
            <div className="mb-4">
              <input
                type="file"
                ref={logoInputRef}
                onChange={handleLogoSelect}
                accept=".png,.jpg,.jpeg"
                className="hidden"
              />
              <button
                onClick={() => logoInputRef.current?.click()}
                className="w-full px-4 py-2 bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                {logoFile ? `Selected: ${logoFile.name}` : "Click to select logo"}
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              {logoFile && (
                <>
                  <button
                    onClick={handleUploadLogo}
                    disabled={logoLoading}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center justify-center gap-2 transition-colors"
                  >
                    {logoLoading ? (
                      <>
                        <Loader className="h-4 w-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        Upload
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleCancelLogoPreview}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 flex items-center justify-center gap-2 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* ── TEMPLATES SECTION ── */}
          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <FileText className="h-6 w-6 text-green-600" />
              Document Templates
            </h2>

            {/* Template List */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Available Templates:</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {templates.length > 0 ? (
                  templates.map((template) => (
                    <div
                      key={template.name}
                      onClick={() => setSelectedTemplate(template.name)}
                      className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        selectedTemplate === template.name
                          ? "border-green-500 bg-green-50"
                          : "border-gray-200 bg-gray-50 hover:border-gray-300"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          <FileText className={`h-5 w-5 ${getTemplateType(template.name) === "DOCX" ? "text-blue-500" : "text-orange-500"}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{template.name}</p>
                            <p className="text-xs text-gray-600">{getTemplateType(template.name)} • {(template.size / 1024).toFixed(2)} KB</p>
                          </div>
                        </div>
                        {selectedTemplate === template.name && <Check className="h-5 w-5 text-green-600" />}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-sm">No templates found</p>
                )}
              </div>
            </div>

            {/* Template Upload */}
            <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
              <p className="text-sm font-semibold text-green-900 mb-3">📋 Replace Template:</p>
              <input
                type="file"
                ref={templateInputRef}
                onChange={handleTemplateSelect}
                accept=".docx,.pptx"
                className="hidden"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => templateInputRef.current?.click()}
                  className="flex-1 px-4 py-2 bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-sm"
                >
                  {templateFile ? `Selected: ${templateFile.name}` : "Click to select DOCX or PPTX"}
                </button>
              </div>
            </div>

            {/* Upload Button */}
            {templateFile && selectedTemplate && (
              <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800 mb-3">
                  ⚠️ This will replace: <strong>{selectedTemplate}</strong>
                </p>
                <button
                  onClick={handleUploadTemplate}
                  disabled={templateLoading}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 flex items-center justify-center gap-2 transition-colors"
                >
                  {templateLoading ? (
                    <>
                      <Loader className="h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Replace Template
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Toast notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
