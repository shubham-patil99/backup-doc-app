// @ts-nocheck
import React from "react";
import { X } from "lucide-react";

export default function DocxPreviewModal({ isOpen, onClose, pdfUrl }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-900/75 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-[95vw] max-w-[none] h-[95vh] shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-2 border-b border-gray-200">
          <h2 className="text-lg font-bold">Document Preview (PDF)</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* PDF Preview */}
        <div className="flex-1 overflow-auto">
          {pdfUrl ? (
            <iframe
              src={pdfUrl}
              title="PDF Preview"
              width="100%"
              height="100%"
              style={{ border: "none" }}
            />
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
