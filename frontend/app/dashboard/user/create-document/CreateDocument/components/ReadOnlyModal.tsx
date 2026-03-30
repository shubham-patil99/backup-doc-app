import { X } from "lucide-react";
import React from "react";

export default function ReadOnlyModal({ module, onClose, expandImageUrls }: { module: any | null; onClose: () => void; expandImageUrls?: (html: string) => string; }) {
  if (!module) return null;

  const safeHtml = (html: string) => {
    if (!html) return "";
    try {
      // prefer provided expandImageUrls, fallback to basic replace
      const expanded = expandImageUrls ? expandImageUrls(html) : html.replace(/src="\/uploads/gi, `src="${(process.env.NEXT_PUBLIC_API_URL || window.location.origin).replace(/\/api\/?$/i, "")}/uploads"`);
      return expanded;
    } catch {
      return html;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-start justify-center z-50 overflow-auto">
      <div className="bg-white rounded-none w-full max-w-5xl mt-8 mb-8 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h3 className="text-lg font-semibold">View Section</h3>
            <p className="text-sm text-gray-600">{module.name}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 overflow-auto" style={{ maxHeight: "80vh" }}>
          {/* Use the same class names Jodit uses so tables/lists get the same CSS applied */}
          <div className="jodit-wysiwyg prose max-w-none">
            <div dangerouslySetInnerHTML={{ __html: safeHtml(module.description || "") }} />
          </div>
        </div>

        <div className="flex justify-end p-4 border-t">
          <button onClick={onClose} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            Close
          </button>
        </div>
      </div>

      <style jsx global>{`
        /* Provide minimal Jodit-like styles so tables, lists and images render similarly */
        .jodit-wysiwyg {
          font-size: 14px;
          line-height: 1.5;
          color: #111827;
        }
        .jodit-wysiwyg p {
          margin: 0 0 0.75rem 0;
        }
        .jodit-wysiwyg ul, .jodit-wysiwyg ol {
          padding-left: 30px !important;
          margin: 0 0 0.75rem 0 !important;
        }
        .jodit-wysiwyg li {
          margin: 0.25rem 0 !important;
        }
        .jodit-wysiwyg table {
          border-collapse: collapse;
          width: 100%;
          margin: 0.5rem 0;
        }
        .jodit-wysiwyg table td,
        .jodit-wysiwyg table th {
          border: 1px solid #e5e7eb;
          padding: 8px 12px;
          vertical-align: top;
        }
        .jodit-wysiwyg table th {
          background-color: #f3f4f6;
          font-weight: 600;
        }
        .jodit-wysiwyg img {
          max-width: 100%;
          height: auto;
          display: block;
          margin: 0.5rem 0;
        }
        /* Preserve pre-existing table cell wrapping behavior */
        .jodit-wysiwyg td, .jodit-wysiwyg th {
          word-break: break-word;
        }
      `}</style>
    </div>
  );
}