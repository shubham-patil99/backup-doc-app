// @ts-nocheck
import { Edit3, X, Check } from "lucide-react";
import EditorPage from "@/components/EditorPage";

export default function EditModal({ module, name, description, onNameChange, onDescriptionChange, onSave, onCancel }) {
  if (!module) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 w-screen h-screen">
      {/*
        The modal itself is a full-screen flex column.
        Header and footer are fixed-size; the body (flex-1) takes the rest.
      */}
      <div className="bg-white rounded-none w-screen h-screen shadow-2xl flex flex-col">

        {/* ── Header ─────────────────────────────────────── */}
        <div className="flex items-center gap-3 p-6 border-b flex-shrink-0">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
            <Edit3 className="text-white" size={16} />
          </div>
          <h3 className="text-xl font-semibold">Edit Section: {module.name}</h3>
        </div>

        {/*
          ── Body ───────────────────────────────────────────
          flex-1 + min-h-0 lets this region grow to fill the
          space between header and footer without overflowing.
        */}
        <div className="flex flex-1 flex-col gap-4 p-6 min-h-0">

          {/* Section Name — fixed height, never grows */}
          <div className="flex-shrink-0">
            <label className="block font-medium mb-2">Section Name</label>
            <input
              type="text"
              value={name || ""}
              onChange={(e) => onNameChange && onNameChange(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/*
            Editor wrapper — flex-1 + min-h-0 so it fills whatever
            vertical space remains after the name input.
          */}
          <div className="flex flex-col flex-1 min-h-0">
            <label className="block font-medium mb-2 flex-shrink-0">Edit Description:</label>

            {/*
              Key fix: add h-full so the child EditorPage (which uses
              height: 100%) has a real pixel height to measure against.
              overflow-hidden clips Jodit's own scrollbars at this boundary.
            */}
            <div className="flex-1 border border-gray-300 rounded-lg overflow-hidden min-h-0 flex flex-col h-full">
              <EditorPage
                value={description}
                onChange={onDescriptionChange}
                placeholder="Edit module description..."
                baseApi={process.env.NEXT_PUBLIC_API_URL}
                expandUploads={true}
                minHeight="100%"
                config={{
                  buttons: [
                    "undo","redo","|",
                    "bold","italic","underline","strikethrough","|",
                    "font","fontsize","brush","paragraph","|",
                    "ul","ol","outdent","indent","|",
                    "align","|","link","image","table","|","source"
                  ].join(","),
                  allowTags: [
                    "p","br","b","strong","i","em","u","s",
                    "ul","ol","li","table","thead","tbody","tr","th","td",
                    "img","a","span"
                  ],
                }}
              />
            </div>
          </div>
        </div>

        {/* ── Footer ─────────────────────────────────────── */}
        <div className="flex justify-end gap-3 p-6 border-t flex-shrink-0">
          <button
            onClick={onCancel}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={16} />
            Cancel
          </button>
          <button
            onClick={onSave}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors"
          >
            <Check size={16} />
            Save
          </button>
        </div>
      </div>

      {/* ── Scoped styles ──────────────────────────────────── */}
      <style jsx>{`
        svg {
          width: 1em;
          height: 1em;
        }
      `}</style>

      <style jsx global>{`
        /* ── Jodit full-height chain (modal context) ──────── */
        .jodit-editor-wrapper .jodit-container {
          height: 100% !important;
          display: flex !important;
          flex-direction: column !important;
        }

        .jodit-editor-wrapper .jodit-workplace {
          flex: 1 !important;
          min-height: 0 !important;
          display: flex !important;
          flex-direction: column !important;
        }

        .jodit-editor-wrapper .jodit-wysiwyg {
          flex: 1 !important;
          height: auto !important;
          min-height: 0 !important;
          overflow-y: auto !important;
        }

        /* ── List styles ──────────────────────────────────── */
        .jodit-wysiwyg ul,
        .jodit-wysiwyg ol {
          padding-left: 30px !important;
          margin: 10px 0 !important;
        }
        .jodit-wysiwyg li {
          margin: 5px 0 !important;
          list-style-position: outside !important;
        }
        .jodit-wysiwyg ul li {
          list-style-type: disc !important;
        }
        .jodit-wysiwyg ol li {
          list-style-type: decimal !important;
        }

        /* ── Table styles ─────────────────────────────────── */
        .jodit-wysiwyg table {
          border-collapse: collapse;
          width: 100%;
          margin: 10px 0;
        }
        .jodit-wysiwyg table td,
        .jodit-wysiwyg table th {
          border: 1px solid #ddd;
          padding: 8px 12px;
          min-width: 50px;
        }
        .jodit-wysiwyg table th {
          background-color: #f3f4f6;
          font-weight: 600;
        }

        /* ── Image styles ─────────────────────────────────── */
        .jodit-wysiwyg img {
          max-width: 100%;
          height: auto;
        }
      `}</style>
    </div>
  );
}