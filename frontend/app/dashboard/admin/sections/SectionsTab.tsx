// @ts-nocheck
import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Check,
  Pencil,
  Trash2,
  AlertCircle,
  Layout,
  X,
  GripVertical,
} from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CheckSquare, Square } from "lucide-react";
import { CSS } from "@dnd-kit/utilities";

interface Section {
  id: number;
  title: string;
  docType: string[] | string; // Can be array or single value for backward compat
  createdAt?: string;
  updatedAt?: string;
}

// Helper function to safely parse docType to array
const parseDocTypes = (docType: any): string[] => {
  if (Array.isArray(docType)) {
    // If it's already an array, return it as-is
    return docType;
  }
  
  if (typeof docType === 'string') {
    // Try to parse as JSON if it looks like stringified JSON
    if (docType.startsWith('[')) {
      try {
        const parsed = JSON.parse(docType);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch (e) {
        // Not valid JSON, treat as single value
      }
    }
    // Return as single-item array
    return [docType];
  }
  
  // Default fallback
  return ["full"];
};

function SortableItem({
  section,
  index,
  onEdit,
  onDelete,
  isEditing,
  editValue,
  onChangeEdit,
  onSaveEdit,
  onCancelEdit,
  onDocTypeChange,
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: String(section.id),
      disabled: !!isEditing,
    });
  
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.8 : 1,
    zIndex: isDragging ? 50 : "auto",
  };

  // Normalize docType to array using helper function
  const docTypes = parseDocTypes(section.docType);

  const handleDocTypeToggle = (type) => {
    let newTypes = [...docTypes];
    
    if (newTypes.includes(type)) {
      newTypes = newTypes.filter(t => t !== type);
    } else {
      newTypes.push(type);
    }
    
    // Prevent empty array - keep at least one type
    if (newTypes.length === 0) {
      newTypes = [type];
      return;
    }
    
    onDocTypeChange(section.id, newTypes);
  };

  return (  
    <div ref={setNodeRef} style={style} className="group relative select-none">
      <div className="relative border-2 border-gray-200 hover:border-green-300 rounded-xl p-4 transition-all bg-white hover:bg-gradient-to-br hover:from-white hover:to-green-50 shadow-md hover:shadow-xl transform hover:-translate-y-1 duration-200 active:scale-[0.98]">
        <div className="absolute -top-2 -left-2 w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform z-10">
          <span className="font-bold text-white text-xs">{index + 1}</span>
        </div>

        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3 flex-1 min-w-0 pr-20">
            <div className="w-8 h-8 bg-gradient-to-br from-green-100 to-emerald-100 rounded-lg flex items-center justify-center shadow-sm">
              <Layout size={16} className="text-green-600" />
            </div>

            {/* Title / Edit UI */}
            {isEditing ? (
              <div className="flex items-center gap-2 w-full">
                <input
                  value={editValue}
                  onChange={(e) => onChangeEdit(e.target.value)}
                  className="flex-1 px-2 py-1 rounded-md border"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onSaveEdit();
                    if (e.key === "Escape") onCancelEdit();
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
                <button
                  onClick={(ev) => {
                    ev.stopPropagation();
                    onSaveEdit();
                  }}
                  className="px-3 py-1 bg-green-600 text-white rounded-md text-sm"
                >
                  Save
                </button>
                <button
                  onClick={(ev) => { ev.stopPropagation(); onCancelEdit(); }}
                  className="p-2 bg-gray-100 rounded-md text-gray-600 hover:bg-gray-200"
                  title="Cancel"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <h3 className="font-semibold text-gray-900 text-sm truncate">
                {section.title}
              </h3>
            )}
          </div>

          {/* Drag handle + Edit/Delete buttons */}
          <div className={`flex items-center gap-2 transition-opacity duration-200 ${isEditing ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
            <button
              {...attributes}
              {...listeners}
              onClick={(e) => e.stopPropagation()}
              className="p-1.5 bg-white border rounded-md text-gray-500 hover:text-gray-700 hover:shadow-sm cursor-grab active:cursor-grabbing"
              title="Drag to reorder"
            >
              <GripVertical size={16} />
            </button>

            <button
              onClick={(ev) => {
                ev.stopPropagation();
                onEdit(section);
              }}
              className="p-1.5 bg-blue-100 text-blue-600 rounded-lg cursor-pointer"
              title="Edit"
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={(ev) => {
                ev.stopPropagation();
                onDelete(section.id);
              }}
              className="p-1.5 bg-red-100 text-red-600 rounded-lg cursor-pointer"
              title="Delete"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {/* ✅ Doc Type Checkboxes */}
        <div className="border-t border-gray-200 pt-3">
          <div className="flex items-center gap-4 flex-wrap">
            <p className="text-xs font-semibold text-gray-600 whitespace-nowrap">Assign to:</p>
            <div className="flex gap-4">
            {["full", "short", "proposal"].map((type) => (
              <label
                key={type}
                className="flex items-center gap-2 cursor-pointer hover:text-green-600 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={docTypes.includes(type)}
                  onChange={() => handleDocTypeToggle(type)}
                  className="w-4 h-4 rounded border-gray-300 text-green-600 cursor-pointer accent-green-600"
                  onClick={(e) => e.stopPropagation()}
                />
                <span className="text-sm text-gray-700 capitalize font-medium">
                  {type}
                </span>
              </label>
            ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


export default function SectionsTab() {
  const [sections, setSections] = useState<Section[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // keep edit state and handlers in parent
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [successMessage, setSuccessMessage] = useState("");

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(""), 3000);
  };

  const fetchSections = async () => {
    try {
      const json = await apiFetch("/sections/all");
      if (json && Array.isArray(json.data)) {
        setSections(json.data);
      } else if (Array.isArray(json)) {
        setSections(json);
      } else {
        console.warn("Unexpected sections response:", json);
        setSections([]);
      }
      setIsDirty(false);
    } catch (error) {
      console.error("Failed to fetch sections:", error);
      setSections([]);
    }
  };

  useEffect(() => {
    fetchSections();
  }, []);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    try {
      setLoading(true);
      setError(null);

      const res = await apiFetch("/sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            title: newTitle.trim(),
            docType: ["full"] // default to array with "full"
          }),
      });

      if (res.error || res.status === "error") throw new Error("Failed to create section");
      await fetchSections();
      setNewTitle("");
      showSuccess("Module created successfully!");
      setIsDirty(false);
    } catch (err: any) {
      setError(err.message || "Failed to create section");
    } finally {
      setLoading(false);
    }
  };

  const handleStartEdit = (section: Section) => {
    setEditingId(section.id);
    setEditValue(section.title);
    setError(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValue("");
  };

  const handleSaveEdit = async () => {
    if (!editValue.trim() || !editingId) {
      setEditingId(null);
      return;
    }

    try {
      const res = await apiFetch(`/sections/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editValue.trim() }),
      });

      if (res.error || res.status === "error") throw new Error("Failed to update section");
      await fetchSections();
      setEditingId(null);
      setEditValue("");
      showSuccess("Module updated successfully!");
    } catch (err: any) {
      setError(err.message || "Failed to update section");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await apiFetch(`/sections/${id}`, {
        method: "DELETE",
      });

      if (res.error || res.status === "error") throw new Error("Failed to delete section");
      setSections((prev) => prev.filter((s) => s.id !== id));
      setDeleteConfirm(null);
      showSuccess("Module deleted successfully!");
    } catch (err: any) {
      setError(err.message || "Failed to delete section");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === "Enter") action();
    else if (e.key === "Escape" && editingId) setEditingId(null);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 }, // require slight move before drag
    })
  );

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sections.findIndex((s) => String(s.id) === String(active.id));
    const newIndex = sections.findIndex((s) => String(s.id) === String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;

    const prev = sections.slice();
    const next = arrayMove(prev, oldIndex, newIndex);
    // update UI only, persist when user clicks Save
    setSections(next);
    setIsDirty(true);
  };

  const saveOrder = useCallback(async () => {
    if (!isDirty || savingOrder) return;
    setSavingOrder(true);
    setError(null);
    try {
      const resp = await apiFetch("/sections/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: sections.map((s) => s.id) }),
      });
      if (!resp || resp.error || resp.status === "error") {
        throw new Error((resp && (resp.error || resp.message)) || "Failed to persist order");
      }
      setIsDirty(false);
      showSuccess("Order saved");

      // Notify other pages (document builder) to refresh their sections/modules
      try {
        window.dispatchEvent(new CustomEvent("sections:reordered", {
          detail: { order: sections.map(s => s.id) }
        }));
      } catch (e) { /* no-op in non-browser env */ }
    } catch (err: any) {
      console.warn("Failed to persist order:", err);
      setError(err?.message || "Failed to save order. Try again.");
    } finally {
      setSavingOrder(false);
    }
  }, [isDirty, savingOrder, sections]);


const handleDocTypeChange = async (id, newDocTypes) => {
  try {
    // Ensure it's an array
    const typesArray = Array.isArray(newDocTypes) ? newDocTypes : [newDocTypes];
    
    await apiFetch(`/sections/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ docType: typesArray }),
    });

    setSections((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, docType: typesArray } : s
      )
    );

    const typesList = typesArray.join(", ");
    showSuccess(`Section assigned to: ${typesList}`);
  } catch (err) {
    console.error("Failed to update docTypes:", err);
    setError("Failed to update doc types");
  }
};

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 p-6 relative overflow-hidden">
      {/* Animated Background Elements - Subtle */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-green-200/20 to-emerald-200/20 rounded-full blur-3xl animate-blob"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-teal-200/20 to-green-200/20 rounded-full blur-3xl animate-blob animation-delay-2000"></div>
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Modules List Card */}
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-200/50 overflow-hidden">
          {/* Header Strip with Gradient */}
          <div className="relative overflow-hidden">
            <div
              className="px-6 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 relative"
              style={{
                background: "linear-gradient(135deg, #004f2d 0%, #00b386 70%, #00d9a3 100%)"
              }}
            >
              {/* Decorative Pattern Overlay */}
              <div className="absolute inset-0 opacity-10">
                <div className="absolute inset-0" style={{
                  backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
                  backgroundSize: '24px 24px'
                }}></div>
              </div>

              {/* Left Section */}
              <div className="flex items-center gap-3 relative z-10">
                <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/30 shadow-lg">
                  <Layout size={20} className="text-white" />
                </div>
                <h2 className="text-lg font-bold text-white drop-shadow-sm">All Modules</h2>
              </div>

              {/* Create Module Inline Input + Save Order (Save placed after Create) */}
              <div className="flex items-center gap-3 flex-1 justify-center relative z-10">
                <div className="flex gap-3 items-center bg-white/20 backdrop-blur-md px-4 py-2 rounded-xl w-full lg:w-auto shadow-lg border border-white/20">
                  <input
                    type="text"
                    placeholder="Enter module title..."
                    value={newTitle}
                    onChange={(e) => {
                      setNewTitle(e.target.value);
                      setError(null);
                    }}
                    onKeyPress={(e) => handleKeyPress(e, handleCreate)}
                    className="flex-1 lg:w-64 px-3 py-1.5 rounded-lg border border-transparent focus:ring-2 focus:ring-white/70 bg-white/95 text-gray-900 placeholder-gray-500 text-sm shadow-sm"
                  />
                  <button
                    onClick={handleCreate}
                    disabled={!newTitle.trim() || loading}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white text-green-700 font-semibold rounded-lg hover:bg-green-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm transition-all shadow-md hover:shadow-lg"
                  >
                    {loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                        ...
                      </>
                    ) : (
                      <>
                        <Plus size={14} />
                        Create
                      </>
                    )}
                  </button>
                </div>

                <button
                  onClick={saveOrder}
                  disabled={!isDirty || savingOrder}
                  className="flex-shrink-0 px-3 py-1.5 bg-white text-green-700 font-semibold rounded-lg hover:bg-green-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm transition-all shadow-md hover:shadow-lg"
                >
                  {savingOrder ? "Saving..." : isDirty ? "Save Order" : "Saved"}
                </button>
              </div>

              {/* Module Count Badge aligned right */}
              <div className="flex items-center gap-3 relative z-10 ml-auto">
                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-white font-bold shadow-lg border border-white/30 text-sm">
                  {sections.length}
                </div>
              </div>
             </div>
           </div>

          {/* Error Message */}
          {error && (
            <div className="mx-6 mt-3 flex items-start gap-3 p-3 bg-red-50 border-l-4 border-red-500 rounded-r-lg shadow-sm animate-slideIn">
              <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800 flex-1">{error}</p>
              <button
                onClick={() => setError(null)}
                className="text-red-400 hover:text-red-600 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Modules Grid */}
          <div className="p-6">
            {sections.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner">
                  <Layout size={32} className="text-gray-400" />
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-1">
                  No modules yet
                </h3>
                <p className="text-sm text-gray-600">Create your first module to get started</p>
              </div>
            ) : (
              <DndContext
  sensors={sensors}
  collisionDetection={closestCenter}
  onDragEnd={handleDragEnd}
>
  <SortableContext
    items={sections.map((s) => String(s.id))}
    strategy={verticalListSortingStrategy}
  >
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {sections.map((section, idx) => (
        <SortableItem
          key={section.id}
          section={section}
          index={idx}
          onEdit={(s) => handleStartEdit(s)}
          onDelete={(id) => setDeleteConfirm(id)}
          isEditing={editingId === section.id}
          editValue={editingId === section.id ? editValue : ""}
          onChangeEdit={(v) => setEditValue(v)}
          onSaveEdit={handleSaveEdit}
          onCancelEdit={handleCancelEdit}
        onDocTypeChange={handleDocTypeChange}
        />
      ))}
    </div>
  </SortableContext>
</DndContext>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 transform animate-scaleIn">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-lg">
                <AlertCircle size={32} className="text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900">Delete Module</h3>
                <p className="text-sm text-gray-600">This action cannot be undone</p>
              </div>
            </div>

            <div className="bg-red-50 border-l-4 border-red-500 rounded-r-xl p-4 mb-6">
              <p className="text-sm text-gray-700">
                Are you sure you want to delete{" "}
                <span className="font-bold text-red-700">
                  "{sections.find(s => s.id === deleteConfirm)?.title}"
                </span>
                ? All associated content will be permanently lost.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-6 py-3 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 px-6 py-3 text-sm font-semibold bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:from-red-700 hover:to-red-800 transition-all shadow-lg hover:shadow-xl"
              >
                Delete Module
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Toast */}
      {successMessage && (
        <div className="fixed bottom-6 right-6 bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-slideIn z-50 border border-green-500">
          <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
            <Check size={18} className="text-green-600" />
          </div>
          <span className="font-semibold">{successMessage}</span>
        </div>
      )}

      <style jsx global>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes scaleIn {
          from {
            transform: scale(0.95);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
        @keyframes blob {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
        }
        .animate-slideIn {
          animation: slideIn 0.3s ease-out;
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
        .animate-scaleIn {
          animation: scaleIn 0.15s ease-out;
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
      `}</style>
    </div>
  );
}