// @ts-nocheck
import { Edit3 } from "lucide-react";

export default function AvailableModule({ module, onDragStart, onEditModule, sections }) {
  const section = sections?.find(s => s.id === module.sectionId);
  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, { type: 'MODULE', data: { module, sectionId: module.sectionId } })}
      className="p-3 bg-purple-50 border border-purple-200 rounded-lg cursor-grab hover:bg-purple-100 transition-colors"
    >
     <div className="flex items-start justify-start gap-2">
        <div className="flex-1 text-left">
          <h4 className="font-semibold text-sm break-words">{module.name}</h4>
          
          {section && (
            <span className="inline-block bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full mb-1">
              Module: {section.title}
            </span>
          )}
          
          <div
            className="text-xs text-gray-600 line-clamp-2 break-words text-left"
            dangerouslySetInnerHTML={{ __html: module.description }}
          />
        </div>
        
        {module.editable && (
          <button
            onClick={() => onEditModule && onEditModule(module)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-all self-start"
            title="Edit"
          >
            <Edit3 size={14} />
          </button>
        )}
      </div>

    </div>
  );
}