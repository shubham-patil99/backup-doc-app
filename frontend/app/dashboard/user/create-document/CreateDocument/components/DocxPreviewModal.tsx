// @ts-nocheck
import React from "react";
import { X, Download, AlertCircle } from "lucide-react";

export default function DocxPreviewModal({ isOpen, onClose, pdfUrl, fileType = "pdf" }) {
  if (!isOpen) return null;

  const isPdf = fileType === "pdf";
  const isDocx = fileType === "docx";
  const isPptx = fileType === "pptx";
  const isFileProtocol = pdfUrl?.startsWith("file://");

  const handleDownload = () => {
    if (!pdfUrl) return;
    
    // For file:// URLs, we can't directly download, so provide helpful message
    if (isFileProtocol) {
      alert(`📂 File saved at:\n${pdfUrl.replace("file:///", "").replace(/\//g, "\\")}\n\nYou can open it from your file explorer.`);
      return;
    }
    
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = isDocx ? "preview.docx" : isPptx ? "preview.pptx" : "preview.pdf";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 bg-gray-900/75 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-[95vw] max-w-[none] h-[95vh] shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-200">
          <div className="flex-1">
            <h2 className="text-lg font-bold">
              {isPdf ? "Document Preview (PDF with TOC)" : isDocx ? "Document Preview (DOCX)" : isPptx ? "Presentation Preview (PPTX)" : "Document Preview"}
            </h2>
          </div>
          <div className="flex gap-2">
            {pdfUrl && (
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Download size={16} /> Download
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <X size={20} className="text-gray-500" />
            </button>
          </div>
        </div>

        {/* Preview Content */}
        <div className="flex-1 overflow-auto bg-gray-100">
          {pdfUrl && isPdf ? (
            <iframe
              src={pdfUrl}
              title="PDF Preview"
              width="100%"
              height="100%"
              style={{ border: "none" }}
              onError={(e) => {
                console.error("iframe error:", e);
              }}
            />
          ) : pdfUrl && (isDocx || isPptx) ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 p-8 bg-white">
              <AlertCircle size={48} className="text-gray-400" />
              <div className="text-center">
                <p className="text-gray-600 mb-2">
                  {isDocx ? "Word documents" : "PowerPoint presentations"} cannot be previewed in the browser.
                </p>
                <p className="text-sm text-gray-500 mb-4">
                  Click the Download button to open in your {isDocx ? "Word" : "PowerPoint"} editor.
                </p>
                <p className="text-xs text-gray-400">
                  Or use Office Online at office.com to view online.
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-500 flex items-center justify-center h-full">
              No preview available.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
