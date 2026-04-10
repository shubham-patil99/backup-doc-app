// @ts-nocheck
import React from "react";
import { ChevronDown, ChevronRight, Pencil } from "lucide-react";

export default function AvailableSection({
  sections,
  expandedSections,
  toggleSection,
  handleDragStart,
  highlightedSectionId = null,
  highlightedModuleId = null,
}) {
  const stripHtml = (html) => {
    if (!html) return "";
    try {
      const div = document.createElement("div");
      div.innerHTML = html;
      return div.textContent || div.innerText || "";
    } catch {
      return html;
    }
  };

  return (
    <div className="space-y-2">
      {sections.map((section) => {
        const isHighlightedSection = highlightedSectionId === section.id;
        const hasHighlightedModule = section.modules?.some(
          (m) => highlightedModuleId === m.id
        );

        return (
          <div
            key={section.id}
            className={`border rounded-lg transition-all ${
              isHighlightedSection
                ? "border-yellow-400 bg-yellow-50 shadow-md ring-2 ring-yellow-300"
                : "border-gray-200"
            }`}
            data-section-id={section.id}
            data-section-title={stripHtml(section.title)}
            data-section-desc={stripHtml(section.description || "")}
          >
            <button
              onClick={() => toggleSection(section.id)}
              className={`w-full flex items-start justify-start text-left gap-2 p-3 transition-colors ${
                isHighlightedSection ? "bg-yellow-50 hover:bg-yellow-100" : "hover:bg-gray-50"
              }`}
              draggable
              onDragStart={(e) =>
                handleDragStart(e, { type: "SECTION", data: { section } })
              }
            >
              <ChevronDown
                className={`h-4 w-4 transition-transform flex-shrink-0 ${
                  expandedSections.includes(section.id) ? "" : "rotate-[-90deg]"
                }`}
              />
              <span className={`font-medium break-words ${isHighlightedSection ? "text-yellow-900 font-semibold" : ""}`}>
                {stripHtml(section.title) ||
                  stripHtml(section.description || "")
                    .split("\n")[0]
                    .slice(0, 50)}
              </span>
              {isHighlightedSection && (
                <span className="ml-auto text-xs bg-yellow-300 text-yellow-900 px-2 py-1 rounded font-semibold">
                  ✓ Found
                </span>
              )}
            </button>

            {expandedSections.includes(section.id) && (
              <div className={`p-2 border-t space-y-1 ${isHighlightedSection ? "bg-yellow-50" : "bg-gray-50"}`}>
                {section.modules && section.modules.length > 0 ? (
                  section.modules.map((module) => {
                    const isHighlightedModule = highlightedModuleId === module.id;

                    return (
                      <div
                        key={module.id}
                        data-module-id={module.id}
                        data-module-name={stripHtml(module.name)}
                        data-module-desc={stripHtml(module.description || "")}
                        data-module-section={section.id}
                        draggable
                        onDragStart={(e) =>
                          handleDragStart(e, {
                            type: "MODULE",
                            data: { module, sectionId: section.id },
                          })
                        }
                        className={`flex items-center gap-2 p-2 rounded cursor-move transition-all group ${
                          isHighlightedModule
                            ? "bg-yellow-200 border-l-4 border-yellow-400 font-semibold shadow-sm"
                            : "hover:bg-white transition-colors"
                        }`}
                      >
                        <span className="text-sm truncate flex-1">
                          {stripHtml(module.name) ||
                            stripHtml(module.description || "").slice(0, 30) +
                              "..."}
                        </span>
                        {module.canEdit && (
                          <Pencil className="h-4 w-4 text-blue-500 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}
                        {isHighlightedModule && (
                          <span className="text-xs bg-yellow-400 text-yellow-900 px-1.5 py-0.5 rounded font-bold flex-shrink-0">
                            ✓
                          </span>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-gray-400 text-sm italic px-2 py-1">
                    No modules available
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}