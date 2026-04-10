// @ts-nocheck
import { Edit3, X, Check } from "lucide-react";
import EditorPage from "@/components/EditorPage";

export default function EditModal({ module, name, description, onNameChange, onDescriptionChange, onSave, onCancel }) {
  if (!module) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 w-screen h-screen">
      <div className="bg-white rounded-none w-screen h-screen shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 p-6 border-b">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
            <Edit3 className="text-white" size={16} />
          </div>
          <h3 className="text-xl font-semibold">Edit Section: {module.name}</h3>
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col gap-6 p-6 overflow-auto">
          {/* Module Name */}
          <div>
            <label className="block font-medium mb-2">Section Name</label>
            <input
              type="text"
              value={name || ""}
              onChange={(e) => onNameChange && onNameChange(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          {/* Jodit Editor */}
          <div className="flex-1 flex flex-col">
            <label className="block font-medium mb-2">Edit Description:</label>
            <div className="flex-1 border border-gray-300 rounded-lg overflow-hidden">
              <EditorPage
                value={description}
                onChange={onDescriptionChange}
                placeholder="Edit module description..."
                baseApi={process.env.NEXT_PUBLIC_API_URL}
                expandUploads={true}
                minHeight={400}
                config={{
                  // show font family, font size and color pickers
                  buttons: [
                    "undo","redo","|",
                    "bold","italic","underline","strikethrough","|",
                    "font","fontsize","brush","paragraph","|",
                    "ul","ol","outdent","indent","|",
                    "align","|","link","image","table","|","source"
                  ].join(","),
                  allowTags: ["p","br","b","strong","i","em","u","s","ul","ol","li","table","thead","tbody","tr","th","td","img","a","span"],
                  height: 400
                }}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t">
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

      <style jsx>{`
        /* Fix lucide icons rendering at huge size initially */
        svg {
          width: 1em;
          height: 1em;
        }
      `}</style>

      <style jsx global>{`
        /* Make Jodit editor fill the available space in modal */
        .jodit-editor-wrapper .jodit-container {
          height: 100% !important;
          display: flex !important;
          flex-direction: column !important;
        }

        .jodit-editor-wrapper .jodit-workplace {
          flex: 1 !important;
          display: flex !important;
          flex-direction: column !important;
        }

        .jodit-editor-wrapper .jodit-wysiwyg {
          flex: 1 !important;
          min-height: 100% !important;
          height: auto !important;
        }

        /* Jodit Editor List Styles */
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

        /* Table Styles */
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

        /* Image Styles */
        .jodit-wysiwyg img {
          max-width: 100%;
          height: auto;
        }
      `}</style>
    </div>
  );
}