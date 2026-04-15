// @ts-nocheck
"use client";

import React from "react";
import { Save, FileText, RotateCcw, Trash, Pencil, X } from "lucide-react";
import { replaceTags, stripHtmlLocal, triggerReloadWithAction } from "../utils/utils";

interface DocumentBuilderPaneProps {
  builderPaneRef: React.RefObject<HTMLDivElement>;
  builderMinHeight: number;
  documentSections: any[];
  sections: any[];
  vars: any;
  dragSourceRef: React.RefObject<any>;
  dragOver: { sectionId: number | null; index: number | null; position: "before" | "after" | null };
  isSaving: boolean;
  autoSaveInProgress: boolean;
  sowSize: string;

  // Handlers
  onReset: () => void;
  onDelete: () => void;
  onSaveAndExit: () => void;
  onDrop: (e: React.DragEvent) => void;
  onModuleDragStart: (e: React.DragEvent, moduleId: number, sectionId: number, index: number) => void;
  onModuleDragEnd: () => void;
  onModuleDragEnter: (e: React.DragEvent, sectionId: number, index: number) => void;
  onModuleDragLeave: (e: React.DragEvent, sectionId: number, index: number) => void;
  onModuleDrop: (e: React.DragEvent, targetSectionId: number, targetIndex: number) => void;
  onEditModule: (module: any, sectionId?: number, instanceId?: string) => void;
  onRemoveModule: (instanceId: string | number, sectionId: number) => void;
  onRemoveSection: (sectionId: number) => void;
}

export default function DocumentBuilderPane({
  builderPaneRef,
  builderMinHeight,
  documentSections,
  sections,
  vars,
  dragSourceRef,
  dragOver,
  isSaving,
  autoSaveInProgress,
  sowSize,
  onReset,
  onDelete,
  onSaveAndExit,
  onDrop,
  onModuleDragStart,
  onModuleDragEnd,
  onModuleDragEnter,
  onModuleDragLeave,
  onModuleDrop,
  onEditModule,
  onRemoveModule,
  onRemoveSection,
}: DocumentBuilderPaneProps) {
  return (
    <div
      ref={builderPaneRef}
      className="lg:col-span-2 bg-white rounded-xl shadow-sm p-3"
      style={{ minHeight: `${builderMinHeight}px`, transition: "min-height 160ms ease" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold">Document Builder</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={onReset}
            className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <RotateCcw size={16} /> Reset
          </button>
          <button
            onClick={onDelete}
            className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
            title="Delete entire document and all versions"
          >
            <Trash size={16} /> Delete
          </button>
          <button
            onClick={() => triggerReloadWithAction("preview")}
            disabled={documentSections.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-green-800 text-white rounded-lg hover:bg-green-900 disabled:bg-gray-300"
          >
            <FileText size={16} /> Preview
          </button>
          <button
            onClick={() => triggerReloadWithAction("openGenerateModal")}
            disabled={documentSections.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
          >
            <FileText size={16} /> Generate
          </button>
          <button
            onClick={onSaveAndExit}
            className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"
          >
            <Save size={16} /> Save & Exit
          </button>
        </div>
      </div>

      {/* Drop Zone */}
      <div
        className="min-h-[500px] border-2 border-dashed border-gray-200 rounded-lg p-4"
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        style={{ minHeight: builderMinHeight }}
      >
        {documentSections.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Drag modules here to build your document</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {documentSections.map((section) => (
              <div key={section.id} className="border rounded-lg p-4">
                {/* Section Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                      Pos:{" "}
                      {typeof section.position === "number"
                        ? section.position
                        : (sections.find((s) => s.id === section.id)?.position ?? "N/A")}
                    </span>
                    <h3 className="font-medium">
                      {stripHtmlLocal(replaceTags(section.title || "", vars))}
                    </h3>
                  </div>
                  <button
                    onClick={() => onRemoveSection(section.id)}
                    className="p-1 hover:bg-gray-200 rounded"
                    title="Remove Section"
                  >
                    <X className="h-4 w-4 text-red-500" />
                  </button>
                </div>

                {/* Modules */}
                {section.modules?.map((module: any, moduleIndex: number) => (
                  <div
                    key={module.instanceId || `${section.id}_${moduleIndex}`}
                    draggable
                    onDragStart={(e) => onModuleDragStart(e, module.id, section.id, moduleIndex)}
                    onDragEnd={onModuleDragEnd}
                    onDragEnter={(e) => onModuleDragEnter(e, section.id, moduleIndex)}
                    onDragOver={(e) => e.preventDefault()}
                    onDragLeave={(e) => onModuleDragLeave(e, section.id, moduleIndex)}
                    onDrop={(e) => onModuleDrop(e, section.id, moduleIndex)}
                    className={`flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-grab transition-transform relative ${
                      dragSourceRef.current?.index === moduleIndex &&
                      dragSourceRef.current?.sectionId === section.id
                        ? "opacity-60 scale-95"
                        : ""
                    }`}
                  >
                    {dragOver.sectionId === section.id &&
                      dragOver.index === moduleIndex &&
                      dragOver.position === "before" && (
                        <div className="h-0.5 bg-blue-600 w-full absolute left-0 -translate-y-2" />
                      )}
                    <span className="truncate relative">
                      {stripHtmlLocal(replaceTags(module.name || "", vars)) ||
                        stripHtmlLocal(replaceTags(module.description || "", vars)).slice(0, 80) + "..."}
                    </span>
                    {dragOver.sectionId === section.id &&
                      dragOver.index === moduleIndex &&
                      dragOver.position === "after" && (
                        <div className="h-0.5 bg-blue-600 w-full absolute right-0 translate-y-2" />
                      )}
                    <div className="flex items-center gap-2">
                      {module.canEdit && (
                        <button
                          onClick={() => onEditModule(module, section.id, module.instanceId)}
                          className="p-1 hover:bg-gray-200 rounded"
                          title="Edit module"
                        >
                          <Pencil className="h-4 w-4 text-blue-500" />
                        </button>
                      )}
                      <button
                        onClick={() => onRemoveModule(module.instanceId || module.id, section.id)}
                        className="p-1 hover:bg-gray-200 rounded"
                      >
                        <X className="h-4 w-4 text-red-500" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}