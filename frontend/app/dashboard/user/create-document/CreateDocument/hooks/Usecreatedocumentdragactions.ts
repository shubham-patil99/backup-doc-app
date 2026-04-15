// @ts-nocheck
import { sortSectionsByPosition } from "../utils/utils";

/**
 * Drag-and-drop handlers and search result selection logic.
 */
export function useCreateDocumentDragActions(state: any, dataActions: any) {
  const {
    sections,
    modules,
    documentSections,
    setDocumentSections,
    isSaving,
    autoSaveInProgress,
    dragSourceRef,
    setDragOver,
    setHighlightedSectionId,
    setHighlightedModuleId,
  } = state;

  const {
    showToast,
    autoSaveDraft,
    waitForPendingSave,
    refreshSourceLists,
  } = dataActions;

  // ─── Section / Module drag from left panel ──────────────────────────────────

  const handleDragStart = (event: React.DragEvent, item: any) => {
    event.dataTransfer.setData("text/plain", JSON.stringify(item));
  };

  const handleDragEnd = (e: React.DragEvent) => {
    e.preventDefault?.();
    try { onModuleDragEnd(); } catch {
      try { setDragOver({ sectionId: null, index: null, position: null }); } catch {}
      try { dragSourceRef.current = null; } catch {}
    }
  };

  // ─── Module reorder drag within builder ────────────────────────────────────

  const onModuleDragStart = (
    e: React.DragEvent,
    moduleId: number,
    sectionId: number,
    index: number
  ) => {
    e.dataTransfer.setData(
      "text/plain",
      JSON.stringify({ type: "MODULE", data: { moduleId, sectionId, index } })
    );
    e.dataTransfer.effectAllowed = "move";
    dragSourceRef.current = { sectionId, index };
  };

  const onModuleDragEnd = () => {
    setDragOver({ sectionId: null, index: null, position: null });
    dragSourceRef.current = null;
  };

  const onModuleDragEnter = (e: React.DragEvent, sectionId: number, index: number) => {
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const position = e.clientY - rect.top > rect.height / 2 ? "after" : "before";
    setDragOver({ sectionId, index, position });
  };

  const onModuleDragLeave = (e: React.DragEvent, sectionId: number, index: number) => {
    const el = e.currentTarget as HTMLElement;
    const { clientX, clientY } = e.nativeEvent as DragEvent;
    setTimeout(() => {
      if (!document.elementFromPoint(clientX || 0, clientY || 0)?.contains(el))
        setDragOver((prev: any) =>
          prev.sectionId === sectionId && prev.index === index
            ? { sectionId: null, index: null, position: null }
            : prev
        );
    }, 10);
  };

  const onModuleDrop = async (
    e: React.DragEvent,
    targetSectionId: number,
    targetIndex: number
  ) => {
    e.preventDefault();
    try {
      const parsed = JSON.parse(e.dataTransfer.getData("text/plain") || "{}");
      if (!parsed || parsed.type !== "MODULE" || !parsed.data) return;
      const { sectionId: sourceSectionId, index: sourceIndex } = parsed.data;
      if (Number(sourceSectionId) !== Number(targetSectionId)) return;

      const updated = documentSections.map((section: any) => {
        if (section.id !== Number(sourceSectionId)) return section;
        const mods = [...(section.modules || [])];
        const src = Number(sourceIndex), tgt = Number(targetIndex);
        if (src === tgt || src === tgt - 1) return section;
        const [moved] = mods.splice(src, 1);
        if (!moved) return section;
        let insertAt = tgt;
        if (src < tgt) insertAt = Math.max(0, tgt - 1);
        if (insertAt > mods.length) insertAt = mods.length;
        mods.splice(insertAt, 0, moved);
        return { ...section, modules: mods.map((m: any, idx: number) => ({ ...m, position: idx })) };
      });

      setDocumentSections(updated);
      await waitForPendingSave();
      const saveRes = await autoSaveDraft(updated);
      if (!saveRes?.success) showToast("Warning: module order may not be saved");
    } catch (err) { console.warn("onModuleDrop parse failed:", err); }
  };

  // ─── Drop onto builder panel ────────────────────────────────────────────────

  const handleDrop = async (event: React.DragEvent) => {
    event.preventDefault();
    if (autoSaveInProgress || isSaving) {
      showToast("Please wait for previous save to complete");
      return;
    }
    const dragData = JSON.parse(event.dataTransfer.getData("text/plain"));

    if (dragData.type === "SECTION") {
      const { section } = dragData.data;
      if (documentSections.some((s: any) => s.id === section.id)) {
        showToast("Section already in document!");
        return;
      }
      const freshSections = await refreshSourceLists();
      const source = (freshSections || sections).find((s: any) => s.id === section.id) || {};
      const newSection = {
        id: section.id, title: section.title, description: section.description,
        position: Number.isFinite(Number((source as any).position))
          ? Number((source as any).position) : undefined,
        modules: (modules || []).filter((m: any) => m.sectionId === section.id),
      };
      const sorted = sortSectionsByPosition(
        [...documentSections, newSection], freshSections || sections
      );
      setDocumentSections(sorted);
      const saveRes = await autoSaveDraft(sorted);
      if (!saveRes?.success) {
        setDocumentSections(documentSections);
        showToast("Failed to save section. Changes reverted.");
        return;
      }
      showToast("Section added to document!");
      return;
    }

    if (dragData.type === "MODULE") {
      const { module, sectionId } = dragData.data;
      if (!module) return;
      const freshSections2 = await refreshSourceLists();
      const sectionIndex = documentSections.findIndex((s: any) => s.id === sectionId);

      if (sectionIndex === -1) {
        const sourceSection = (freshSections2 || sections).find((s: any) => s.id === sectionId);
        if (sourceSection) {
          const sorted2 = sortSectionsByPosition(
            [
              ...documentSections,
              {
                id: sourceSection.id, title: sourceSection.title,
                description: sourceSection.description,
                position: Number.isFinite(Number(sourceSection.position))
                  ? Number(sourceSection.position) : undefined,
                modules: [{
                  ...module, position: 0,
                  canEdit: typeof module.canEdit !== "undefined" ? module.canEdit : true,
                  instanceId: `${module.id}_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                }],
              },
            ],
            freshSections2 || sections
          );
          setDocumentSections(sorted2);
          const saveRes = await autoSaveDraft(sorted2);
          if (!saveRes?.success) {
            setDocumentSections(documentSections);
            showToast("Failed to save module. Changes reverted.");
            return;
          }
        }
      } else {
        const updatedSections = sortSectionsByPosition(
          documentSections.map((section: any) =>
            section.id === sectionId
              ? {
                  ...section,
                  modules: [
                    ...section.modules,
                    {
                      ...module, position: (section.modules || []).length,
                      canEdit: typeof module.canEdit !== "undefined" ? module.canEdit : true,
                      instanceId: `${module.id}_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                    },
                  ],
                }
              : section
          ),
          freshSections2 || sections
        );
        setDocumentSections(updatedSections);
        const saveRes = await autoSaveDraft(updatedSections);
        if (!saveRes?.success) {
          setDocumentSections(documentSections);
          showToast("Failed to save module. Changes reverted.");
          return;
        }
      }
      showToast("Module added to section!");
    }
  };

  // ─── Search result highlight + scroll ──────────────────────────────────────

  const handleSearchResultSelect = (
    result: any,
    stateExtras: { setExpandedSections: (fn: any) => void }
  ) => {
    const { setExpandedSections } = stateExtras;
    if (result.type === "section") {
      setHighlightedSectionId(result.id);
      setHighlightedModuleId(null);
      setExpandedSections((prev: any) =>
        prev.includes(result.id) ? prev : [...prev, result.id]
      );
      setTimeout(() => {
        document
          .querySelector(`[data-section-id="${result.id}"]`)
          ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 100);
    } else if (result.type === "module") {
      setHighlightedModuleId(result.id);
      setHighlightedSectionId(result.sectionId);
      setExpandedSections((prev: any) =>
        prev.includes(result.sectionId) ? prev : [...prev, result.sectionId]
      );
      setTimeout(() => {
        document
          .querySelector(`[data-module-id="${result.id}"]`)
          ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 100);
    }
  };

  return {
    handleDragStart,
    handleDragEnd,
    onModuleDragStart,
    onModuleDragEnd,
    onModuleDragEnter,
    onModuleDragLeave,
    onModuleDrop,
    handleDrop,
    handleSearchResultSelect,
  };
}