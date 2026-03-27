// @ts-nocheck
import React from "react";
import { ChevronDown, ChevronRight, Pencil } from "lucide-react";

export default function AvailableSection({ sections, expandedSections, toggleSection, handleDragStart }) {
  return (
    <div className="space-y-2">
      {sections.map(section => (
        <div 
          key={section.id} 
          className="border rounded-lg"
          // REMOVE draggable from section container!
        >
          <button
          onClick={() => toggleSection(section.id)}
          className="w-full flex items-start justify-start text-left gap-2 p-3 hover:bg-gray-50"
          draggable
          onDragStart={e => handleDragStart(e, { type: 'SECTION', data: { section } })}
        >
          <ChevronDown
            className={`h-4 w-4 transition-transform ${
              expandedSections.includes(section.id) ? '' : 'rotate-[-90deg]'
            }`}
          />
          <span className="font-medium break-words">
            {stripHtml(section.title) || stripHtml(section.description || "").split('\n')[0]}
          </span>
        </button>
          {expandedSections.includes(section.id) && (
            <div className="p-2 bg-gray-50 border-t">
              {(section.modules && section.modules.length > 0) ? (
                section.modules.map(module => (
                  <div
                  key={module.id}
                  draggable
                  onDragStart={e => handleDragStart(e, { type: 'MODULE', data: { module, sectionId: section.id } })}
                  className="flex items-center gap-2 p-2 hover:bg-white rounded cursor-move"
                >
                  <span className="text-sm truncate">
                    {stripHtml(module.name) || stripHtml(module.description || "").slice(0, 20) + "..."}
                  </span>
                  {module.editable && <Pencil className="h-4 w-4 text-blue-500 flex-shrink-0" />}
                </div>
                ))
              ) : (
                <div className="text-gray-400 text-sm italic px-2 py-1">
                  No modules available
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function stripHtml(html) {
  if (!html) return "";
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent || div.innerText || "";
}

const handleModuleDrop = (moduleId: number, sectionId: number) => {
  setDocumentSections(prevSections => {
    const updated = prevSections.map(sec => {
      if (sec.id === sectionId) {
        const moduleExists = sec.modules.some(m => m.id === moduleId);
        if (!moduleExists) {
          const module = modules.find(m => m.id === moduleId);
          if (module) {
            return {
              ...sec,
              modules: [...sec.modules, {
                id: module.id,
                name: module.name,
                description: module.description,
                canEdit: module.canEdit,
                sectionId: sec.id
              }]
            };
          }
        }
      }
      return sec;
    });
    // ✅ Trigger autosave with updated sections
    triggerAutoSave(updated, sowSize);
     return updated;
   });
 };