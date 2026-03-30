// @ts-nocheck

import { useState } from "react";

export default function useDragDrop() {
  const [draggedItem, setDraggedItem] = useState(null);
  const [dragType, setDragType] = useState(null); // 'section' | 'module'

  const handleDragStart = (item, type) => {
    setDraggedItem(item);
    setDragType(type);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragType(null);
  };

  return { draggedItem, dragType, handleDragStart, handleDragEnd };
}