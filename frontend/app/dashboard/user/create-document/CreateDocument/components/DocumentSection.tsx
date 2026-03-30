// @ts-nocheck

import { useState } from "react";
import { Edit3, FileText } from "lucide-react";

interface DocumentSectionProps {
  section: any;
  onModuleDrop: (sectionId: number, module: any) => void;
  onEditModule: (module: any) => void;
  draggedItem: any;
  dragType: string;
}

export default function DocumentSection({ section, onModuleDrop, onEditModule, draggedItem, dragType }: DocumentSectionProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (dragType === 'module' && draggedItem?.sectionId === section.id) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = () => setIsDragOver(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (dragType === 'module' && draggedItem?.sectionId === section.id) {
      onModuleDrop(section.id, draggedItem);
    }
  };

  return (
    <div className="bg-gray-50 border-l-4 border-blue-500 p-4 rounded">
      {autoSaveError && (
        <div className="mb-3 p-2 bg-red-100 border border-red-400 text-red-700 text-sm rounded">
          ⚠️ Draft not saved: {autoSaveError}
        </div>
      )}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-lg">{section.title}</h3>
        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
          {section.modules?.length || 0} section
        </span>
      </div>
      {section.description && (
        <p className="text-xs text-gray-500 mb-4">{section.description}</p>
      )}
      <div className="space-y-3">
        {(!section.modules || section.modules.length === 0) ? (
          <div className="text-center py-8 text-gray-500">
            <FileText size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">Drop sections here</p>
          </div>
        ) : (
          section.modules.map(module => (
            <div key={module.id} className="flex items-center gap-2 bg-white rounded-lg p-3 border shadow-sm group">
              <div className="flex-1">
                <h4 className="font-semibold text-sm">{module.name}</h4>
                <div
                  className="text-xs text-gray-500 mt-1 line-clamp-2"
                  dangerouslySetInnerHTML={{ __html: module.description }}
                />
              </div>
              {module.editable && (
                <button
                  onClick={() => onEditModule(module)}
                  className="opacity-0 group-hover:opacity-100 p-2 hover:bg-gray-100 rounded-lg transition-all"
                  title="Edit"
                >
                  <Edit3 size={14} />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}