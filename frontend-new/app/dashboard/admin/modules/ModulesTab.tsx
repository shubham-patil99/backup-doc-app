// @ts-nocheck
import React, { useEffect, useState } from "react";
import { FileText, Plus, Search, X, Check, Trash2, PackagePlus, Layout, AlertCircle, Save, GripVertical } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import DOMPurify from "dompurify";
import EditorPage from "@/components/EditorPage";

type Section = {
  id: number;
  title: string;
};

type Module = {
  id: number;
  name: string;
  description: string;
  sectionId: number;
  createdBy: number;
  canEdit?: boolean;
  sortOrder?: number; // Add this field to track order
};

export default function ModuleTab() {
  const [sections, setSections] = useState<Section[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [originalEditingModule, setOriginalEditingModule] = useState<Module | null>(null);
  const [expandedSections, setExpandedSections] = useState<number[]>([]);
  const [newModuleName, setNewModuleName] = useState("");
  const [newModuleDescription, setNewModuleDescription] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState<number | undefined>();
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingModule, setEditingModule] = useState<Module | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  
  // Drag and drop state
  const [draggedModule, setDraggedModule] = useState<Module | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  // Ensure images saved with src="/uploads/..." become absolute URLs using API base
  const expandImageUrlsLocal = (html: string) => {
    if (!html) return html;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || (typeof window !== "undefined" ? window.location.origin : "");
    const baseUrl = apiUrl.replace("/api", "");
    try {
      return html.replace(/src="\/uploads/g, `src="${baseUrl}/uploads`);
    } catch (e) {
      return html;
    }
  };

  // Ensure any src="/uploads/..." become absolute URLs before sending to backend
  const ensureAbsoluteImageUrls = (html: string) => {
    if (!html) return html;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? window.location.origin : '');
    const baseUrl = apiUrl.replace(/\/api$/, '').replace(/\/$/, '');
    return html.replace(/src=["']\/uploads/g, `src="${baseUrl}/uploads`);
  };

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(""), 3000);
  };

  const getModuleSections = (sectionId: number) => {
    return modules
      .filter((module) => module.sectionId === sectionId)
      .sort((a, b) => (a.sortOrder ?? a.id) - (b.sortOrder ?? b.id));
  };

  const getFilteredModules = (sectionId: number) => {
    const sectionModules = getModuleSections(sectionId);
    
    if (!searchQuery.trim()) {
      return sectionModules;
    }

    return sectionModules.filter(module => {
      const searchLower = searchQuery.toLowerCase();
      const nameMatch = module.name?.toLowerCase().includes(searchLower);
      const descMatch = stripHtml(module.description).toLowerCase().includes(searchLower);
      return nameMatch || descMatch;
    });
  };

  const fetchData = async () => {
    try {
      setLoading(true);

      const [sectionRes, moduleRes] = await Promise.all([
        apiFetch("/sections/all"),
        apiFetch("/modules"),
      ]);

      const sectionData = Array.isArray(sectionRes)
        ? sectionRes
        : Array.isArray(sectionRes.data)
          ? sectionRes.data
          : [];

      // Normalize module descriptions so images use absolute URLs
      const normalizedModules = (Array.isArray(moduleRes) ? moduleRes : []).map((m) => ({
        ...m,
        description: expandImageUrlsLocal(m.description || ""),
      }));


      setSections(sectionData);
      setModules(normalizedModules);
      
      setExpandedSections(sectionData.map(s => s.id));
    } catch (err) {
      console.error("Failed to fetch sections/modules:", err);
      setSections([]);
      setModules([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const handleBeforeUnload = (e) => {
      if (unsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
        return "";
      }
      return undefined;
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, module: Module) => {
    setDraggedModule(module);
    e.dataTransfer.effectAllowed = "move";
    e.currentTarget.classList.add("opacity-50");
  };

  const handleDragEnd = (e: React.DragEvent) => {
    e.currentTarget.classList.remove("opacity-50");
    setDraggedModule(null);
    setDragOverIndex(null);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = async (e: React.DragEvent, targetModule: Module, targetIndex: number) => {
    e.preventDefault();
    
    if (!draggedModule || draggedModule.id === targetModule.id) {
      setDragOverIndex(null);
      return;
    }

    // Only allow reordering within the same section
    if (draggedModule.sectionId !== targetModule.sectionId) {
      setDragOverIndex(null);
      showSuccess("Cannot move modules between different sections");
      return;
    }

    const sectionModules = getModuleSections(draggedModule.sectionId);
    const draggedIndex = sectionModules.findIndex(m => m.id === draggedModule.id);
    
    // Reorder the modules
    const reorderedModules = [...sectionModules];
    const [removed] = reorderedModules.splice(draggedIndex, 1);
    reorderedModules.splice(targetIndex, 0, removed);

    // Update sort order for all modules in this section
    const updatedModules = reorderedModules.map((mod, idx) => ({
      ...mod,
      sortOrder: idx
    }));

    // Optimistically update the UI
    setModules(prev => {
      const otherModules = prev.filter(m => m.sectionId !== draggedModule.sectionId);
      return [...otherModules, ...updatedModules];
    });

    // Persist to backend
    try {
      await Promise.all(
        updatedModules.map(mod =>
          apiFetch(`/modules/${mod.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...mod, sortOrder: mod.sortOrder }),
          })
        )
      );
      showSuccess("Module order updated successfully!");
    } catch (err) {
      console.error("Failed to update module order:", err);
      // Revert on error
      fetchData();
    }

    setDragOverIndex(null);
  };

  const sanitizeContent = (html: string) => {
    const clean = DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        "b", "i", "u", "strike", "strong", "em",
        "p", "ul", "ol", "li",
        "a", "table", "thead", "tbody", "tr", "td", "th",
        "br", "img", "h1", "h2", "h3", "h4", "h5", "h6",
        "div", "span", "blockquote", "code", "pre"
      ],
      ALLOWED_ATTR: [
        "href", "colspan", "rowspan", "target", "src", "alt", 
        "width", "height", "class", "data-row", "data-col",
        "style", "align"
      ]
    });
    return clean;
  };

  const handleAddModule = async () => {
    const savedUser = localStorage.getItem("user");
    const currentUser = savedUser ? JSON.parse(savedUser) : null;
    if (!selectedSectionId || !currentUser) return;

    if (!newModuleName.trim() && !newModuleDescription.trim()) {
      alert("Section Description is required if Section Name is empty.");
      return;
    }

    try {
      setLoading(true);
      const sanitizedDescription = ensureAbsoluteImageUrls(sanitizeContent(newModuleDescription));
      const finalModuleName = newModuleName.trim();

      // Get the highest sort order for this section
      const sectionModules = modules.filter(m => m.sectionId === selectedSectionId);
      const maxSortOrder = Math.max(...sectionModules.map(m => m.sortOrder ?? 0), -1);

      await apiFetch("/modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: finalModuleName,
          description: sanitizedDescription,
          sectionId: selectedSectionId,
          createdBy: currentUser.id,
          sortOrder: maxSortOrder + 1,
        }),
      });

      await fetchData();
      setNewModuleName("");
      setNewModuleDescription("");
      setSelectedSectionId(undefined);
      setShowModal(false);
      showSuccess("Section created successfully!");
    } catch (err) {
      console.error("Failed to add module:", err);
    } finally {
      setLoading(false);
    }
  };

  const confirmDiscardUnsaved = (nextAction: () => void) => {
    // Determine if current editing state is actually different from the original
    const isEditingDirty = () => {
      if (!editingModule || !originalEditingModule) return false;

      // strip HTML and collapse whitespace for reliable text comparison
      const stripText = (html = "") => {
        try {
          const div = document.createElement("div");
          div.innerHTML = html || "";
          return (div.textContent || div.innerText || "").replace(/\s+/g, " ").trim();
        } catch {
          return String(html || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
        }
      };

      const normalize = (m: any) => ({
        name: (m.name || "").trim(),
        description: stripText(m.description || ""),
        sectionId: m.sectionId ?? null,
        canEdit: !!m.canEdit,
        sortOrder: typeof m.sortOrder === "number" ? m.sortOrder : null,
      });

      try {
        const a = normalize(editingModule);
        const b = normalize(originalEditingModule);
        return JSON.stringify(a) !== JSON.stringify(b);
      } catch {
        return false;
      }
    };

    // Prompt only when the editor content truly differs from the original snapshot.
    if (!isEditingDirty()) {
      nextAction();
      return;
    }

    setPendingAction(() => nextAction);
    setShowDiscardModal(true);
  };

  const handleSelectModule = (module: Module) => {
    confirmDiscardUnsaved(() => {
      // expand image URLs for editor preview/editing context
      const withExpandedImages = { ...module, description: expandImageUrlsLocal(module.description || "") };
      setEditingModule(withExpandedImages);
      setOriginalEditingModule(withExpandedImages);
      setUnsavedChanges(false);
    });
  };

  const handleDeleteModule = async (id: number) => {
    try {
      await apiFetch(`/modules/${id}`, {
        method: "DELETE",
      });

      setModules((prev) => prev.filter((m) => m.id !== id));
      if (editingModule?.id === id) {
        setEditingModule(null);
      }
      setDeleteConfirm(null);
      showSuccess("Section deleted successfully!");
    } catch (err) {
      console.error("Failed to delete module:", err);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingModule) return;

    try {
      const sanitizedDescription = ensureAbsoluteImageUrls(sanitizeContent(editingModule.description));

      const updated = await apiFetch(`/modules/${editingModule.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...editingModule, description: sanitizedDescription }),
      });

      setModules(prev => prev.map(m => (m.id === editingModule.id ? updated : m)));
      setUnsavedChanges(false);
      setOriginalEditingModule(updated);
      showSuccess("Section saved successfully!");
    } catch (err) {
      console.error("Failed to update module:", err);
    }
  };

  const toggleSection = (sectionId: number) => {
    confirmDiscardUnsaved(() => {
      setExpandedSections(prev =>
        prev.includes(sectionId)
          ? prev.filter(id => id !== sectionId)
          : [...prev, sectionId]
      );
    });
  };

  const stripHtml = (html: string) => {
    const temp = document.createElement("div");
    temp.innerHTML = html;
    return temp.textContent || temp.innerText || "";
  };

  const expandImageUrls = (html: string) => {
    if (!html) return html;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    const baseUrl = apiUrl.replace('/api', '');
    return html.replace(/src="\/uploads/g, `src="${baseUrl}/uploads`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-green-50 to-green-50 p-6">
      <div className="max-w-7xl mx-auto">

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Sidebar - Sections List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden sticky top-6">
              <div className="px-6 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 relative"
                style={{
                  background: "linear-gradient(135deg, #004f2d 0%, #00b386 70%)"
                }}>
                <h2 className="text-lg font-semibold tracking-wide text-white">
                  All Sections
                </h2>
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-bold shadow-md border border-white/30 text-sm">
                  {modules.length}
                </div>
              </div>

              <div className="p-4 border-b border-gray-100">
                <button
                  onClick={() => setShowModal(true)}
                  style={{
                    background: "linear-gradient(135deg, #004f2d 0%, #00b386 70%, #e8fff7 100%)",
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all"
                >
                  <Plus size={18} />
                  Add New Section
                </button>
              </div>

              <div className="p-4 border-b border-gray-100">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="text"
                    placeholder="Search sections..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>

              <div className="max-h-[500px] overflow-y-auto p-2">
                {sections.map(section => {
                  const filteredModules = getFilteredModules(section.id);
                  const totalModules = getModuleSections(section.id).length;
                  
                  if (searchQuery && filteredModules.length === 0) return null;

                  return (
                    <div key={section.id} className="mb-2">
                      <button
                        onClick={() => toggleSection(section.id)}
                        className="w-full flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Layout size={16} className="text-[#00b386]" />
                          <span className="font-semibold text-gray-700 text-sm">{section.title}</span>
                        </div>
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                          {searchQuery ? `${filteredModules.length}/${totalModules}` : totalModules}
                        </span>
                      </button>
                      
                      {expandedSections.includes(section.id) && (
                        <div className="ml-4 mt-1 space-y-1">
                          {filteredModules.length === 0 ? (
                            <div className="px-3 py-2 text-xs text-gray-400 italic">
                              No sections found
                            </div>
                          ) : (
                            filteredModules.map((module, index) => (
                              <div
                                key={module.id}
                                draggable={!searchQuery}
                                onDragStart={(e) => handleDragStart(e, module)}
                                onDragEnd={handleDragEnd}
                                onDragOver={(e) => handleDragOver(e, index)}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, module, index)}
                                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all cursor-grab ${
                                  editingModule?.id === module.id
                                    ? "bg-green-50 text-green-700 border-l-2 border-green-400"
                                    : "hover:bg-gray-50 text-gray-600"
                                } ${
                                  dragOverIndex === index && draggedModule?.id !== module.id
                                    ? "border-t-2 border-green-500"
                                    : ""
                                }`}
                              >
                                {/* Drag handle */}
                                {!searchQuery && (
                                  <GripVertical size={14} className="text-gray-400 flex-shrink-0" />
                                )}
                                
                                {/* Clickable area */}
                                <button
                                  onClick={() => handleSelectModule(module)}
                                  className="flex-1 text-left flex items-center gap-2 focus:outline-none"
                                  type="button"
                                >
                                  <FileText size={14} className="flex-shrink-0 text-gray-600" />
                                  <span className="text-sm truncate">
                                    {module.name || (stripHtml(module.description || "").slice(0, 30) + "...")}
                                  </span>
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Content Panel */}
          <div className="lg:col-span-2">
            {editingModule ? (
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                <div
                  style={{
                    background: "linear-gradient(135deg, #004f2d 0%, #00b386 70%)",
                  }}
                  className="px-6 py-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white/20 backdrop-blur-sm rounded-lg">
                        <FileText size={20} className="text-white" />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold text-white">
                          {editingModule.name || "Untitled Section"}
                        </h2>
                        <p className="text-sm text-green-100">
                          {sections.find(s => s.id === editingModule.sectionId)?.title}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-2 rounded-lg cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!editingModule?.canEdit}
                          onChange={(e) =>
                            setEditingModule({ ...editingModule, canEdit: e.target.checked })
                          }
                          className="w-4 h-4 rounded border-white/50"
                          style={{ accentColor: "#00b386" }}
                        />
                        <span className="text-sm text-white">Can Edit</span>
                      </label>
                      <button
                        onClick={() => setDeleteConfirm(editingModule.id)}
                        className="p-2 bg-white/20 backdrop-blur-sm hover:bg-red-500/30 rounded-lg transition-colors"
                      >
                        <Trash2 size={18} className="text-white" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  <div className="mb-4">
                    <label className=" text-sm font-medium text-gray-700 mb-2">
                      Section Name
                    </label>
                    <input
                      type="text"
                      value={editingModule.name}
                      onChange={(e) => {
                        setEditingModule({ ...editingModule, name: e.target.value });
                        setUnsavedChanges(true);
                      }}
                      placeholder="Enter section name..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className=" text-sm font-medium text-gray-700 mb-2">
                      Section Content
                    </label>
                    <div className="border border-gray-300 rounded-lg">
                      <EditorPage
                        value={editingModule ? editingModule.description : ""}
                        onChange={(value) => {
                          if (editingModule) {
                            setEditingModule({ ...editingModule, description: value });
                            setUnsavedChanges(true);
                          }
                        }}
                        placeholder="Enter section content..."
                        baseApi={process.env.NEXT_PUBLIC_API_URL}
                        expandUploads={true}
                        minHeight={400}
                                          config={{
                         buttons: [
                           "undo", "redo", "|",
                           "bold", "italic", "underline", "strikethrough", "|",
                           "font", "fontsize", "brush", "paragraph", "|",
                           "ul", "ol", "outdent", "indent", "|",
                           "align", "|", "link", "image", "table", "|", "source"
                         ].join(","),
                         allowTags: ["p", "br", "b", "strong", "i", "em", "u", "s", "ul", "ol", "li", "table", "thead", "tbody", "tr", "th", "td", "img", "a", "span"],
                         height: 400
                       }}
                      />
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end">
                    <button
                      onClick={handleSaveEdit}
                      className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-medium hover:from-green-600 hover:to-emerald-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                    >
                      <Save size={18} />
                      Save Changes
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 flex items-center justify-center" style={{ minHeight: "500px" }}>
                <div className="text-center">
                  <div className="p-4 bg-gradient-to-br from-green-100 to-green-100 rounded-2xl shadow-lg mb-4 mx-auto w-fit">
                    <FileText className="h-16 w-16 text-[#00a176]" />
                  </div>
                  <h3 className="text-xl font-semibold text-[#004f2d] mb-2">
                    No Section Selected
                  </h3>
                  <p className="text-gray-600">
                    Choose a section from the sidebar to start editing
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Section Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-2 animate-fadeIn">
          <div className="bg-white rounded-none md:rounded-2xl shadow-2xl w-full h-full md:max-w-4xl md:h-[90vh] p-6 transform animate-scaleIn overflow-y-auto">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-green-100 rounded-lg">
                <PackagePlus size={24} className="text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Add New Section</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Module
                </label>
                <select
                  value={selectedSectionId || ""}
                  onChange={(e) => setSelectedSectionId(Number(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="">Choose a module...</option>
                  {sections.map(section => (
                    <option key={section.id} value={section.id}>
                      {section.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Section Name
                </label>
                <input
                  type="text"
                  value={newModuleName}
                  onChange={(e) => setNewModuleName(e.target.value)}
                  placeholder="Enter section name..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Section Description
                </label>
                <div className="border border-gray-300 rounded-lg overflow-hidden">
                  <EditorPage
                    value={newModuleDescription}
                    onChange={setNewModuleDescription}
                    placeholder="Enter section description..."
                                       config={{
                     buttons: [
                       "undo", "redo", "|",
                       "bold", "italic", "underline", "strikethrough", "|",
                       "font", "fontsize", "brush", "paragraph", "|",
                       "ul", "ol", "outdent", "indent", "|",
                       "align", "|", "link", "image", "table", "|", "source"
                     ].join(","),
                     allowTags: ["p", "br", "b", "strong", "i", "em", "u", "s", "ul", "ol", "li", "table", "thead", "tbody", "tr", "th", "td", "img", "a", "span"],
                     height: 400
                   }}
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowModal(false);
                  setNewModuleName("");
                  setNewModuleDescription("");
                  setSelectedSectionId(undefined);
                }}
                className="flex-1 px-4 py-3 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddModule}
                disabled={!selectedSectionId || loading}
                className="flex-1 px-4 py-3 text-sm font-medium bg-gradient-to-r from-green-600 to-green-600 text-white rounded-xl hover:from-green-700 hover:to-green-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
              >
                {loading ? "Creating..." : "Add Section"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-0 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 transform animate-scaleIn">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
                <AlertCircle size={28} className="text-red-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Delete Section</h3>
                <p className="text-sm text-gray-600">This action cannot be undone</p>
              </div>
            </div>
            
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
              <p className="text-sm text-gray-700">
                Are you sure you want to delete this section? All content will be lost.
              </p>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-3 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteModule(deleteConfirm)}
                className="flex-1 px-4 py-3 text-sm font-medium bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:from-red-700 hover:to-red-800 transition-all shadow-lg hover:shadow-xl"
              >
                Delete Section
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Toast */}
      {successMessage && (
        <div className="fixed bottom-6 right-6 bg-green-600 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 animate-slideIn z-50">
          <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
            <Check size={16} className="text-green-600" />
          </div>
          <span className="font-medium">{successMessage}</span>
        </div>
      )}

      {/* Discard Changes Confirmation Modal */}
      {showDiscardModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 transform animate-scaleIn">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg">
                <AlertCircle size={32} className="text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900">Unsaved Changes</h3>
                <p className="text-sm text-gray-600">You have unsaved changes</p>
              </div>
            </div>

            <div className="bg-amber-50 border-l-4 border-amber-500 rounded-r-xl p-4 mb-6">
              <p className="text-sm text-gray-700">
                Are you sure you want to discard your unsaved changes? This action cannot be undone.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDiscardModal(false)}
                className="flex-1 px-6 py-3 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowDiscardModal(false);
                  pendingAction?.();
                }}
                className="flex-1 px-6 py-3 text-sm font-semibold bg-gradient-to-r from-amber-600 to-amber-700 text-white rounded-xl hover:from-amber-700 hover:to-amber-800 transition-all shadow-lg hover:shadow-xl"
              >
                Discard Changes
              </button>
            </div>
          </div>
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
        .animate-slideIn {
          animation: slideIn 0.3s ease-out;
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
        .animate-scaleIn {
          animation: scaleIn 0.15s ease-out;
        }

        /* Jodit Editor Customization */
        .jodit-editor-wrapper .jodit-container {
          border: none !important;
        }

        .jodit-editor-wrapper .jodit-wysiwyg {
          min-height: 400px;
          padding: 15px;
        }

        .jodit-editor-wrapper .jodit-toolbar-button {
          border-radius: 6px;
        }

        .jodit-editor-wrapper ul,
        .jodit-editor-wrapper ol {
          padding-left: 30px !important;
          margin: 10px 0 !important;
        }

        .jodit-editor-wrapper li {
          margin: 5px 0 !important;
          list-style-position: outside !important;
        }

        .jodit-editor-wrapper ul li {
          list-style-type: disc !important;
        }

        .jodit-editor-wrapper ol li {
          list-style-type: decimal !important;
        }

        .jodit-editor-wrapper table {
          border-collapse: collapse;
          width: 100%;
          margin: 10px 0;
        }

        .jodit-editor-wrapper table td,
        .jodit-editor-wrapper table th {
          border: 1px solid #ddd;
          padding: 8px 12px;
          min-width: 50px;
        }

        .jodit-editor-wrapper table th {
          background-color: #f3f4f6;
          font-weight: 600;
        }

        .jodit-editor-wrapper img {
          max-width: 100%;
          height: auto;
        }
      `}</style>
    </div>
  );
}
