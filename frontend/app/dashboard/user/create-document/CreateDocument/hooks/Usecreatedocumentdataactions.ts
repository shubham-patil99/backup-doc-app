// @ts-nocheck
import { apiFetch } from "@/lib/apiClient";
import {
  sanitizeDescription,
  normalizeInlineLists,
  sortSectionsByPosition,
  replaceTags,
  formatDateOnly,
  isElectronEnv,
  blobToBase64,
  deriveBaseName,
} from "../utils/utils";

/**
 * Data, save, SoW type, CRUD, preview, generate, and OPE ID actions.
 */
export function useCreateDocumentDataActions(state: any) {
  const {
    sections, setSections,
    modules, setModules,
    documentSections, setDocumentSections,
    customerName, customerNo,
    contractingParty, partnerName,
    contractingPartyRef, partnerNameRef,
    documentName, setDocumentName,
    quoteId, opeId, setOpeId,
    sowSize, setSowSize,
    version, setVersion,
    isSaving, setIsSaving,
    autoSaveInProgress, setAutoSaveInProgress,
    isDeleting, setIsDeleting,
    generating, setGenerating,
    previewLoading, setPreviewLoading,
    setShowPreview, setPreviewPdfUrl, setPreviewFileType,
    setToast, setErrors,
    autoSaveDebounceRef, savingPromiseRef,
    sowTypeChangeInProgressRef, skipDraftReloadRef,
    setShowSowTypeWarning, setPendingSowType, pendingSowType,
    setShowDeleteConfirm, setIsChangingOpeId,
    newOpeId, setIsEditingOpeId,
    setEditingModule, setEditedDescription, setEditedName,
    editingModule, editedDescription, editedName,
    setDraftVersions, setFinalVersions,
  } = state;

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2000);
  };

  // ─── Data Fetching ──────────────────────────────────────────────────────────

  const fetchData = async (docType: string = sowSize) => {
    state.setLoading(true);
    try {
      const [sectionsRes, modulesRes] = await Promise.all([
        apiFetch(`/sections/all?docType=${docType}`),
        apiFetch("/modules"),
      ]);
      const normalizedModules = (modulesRes || []).map((m: any) => ({
        ...m,
        sectionId: m.sectionId || m.section_id,
        position: Number.isFinite(Number(m.position)) ? Number(m.position)
          : Number.isFinite(Number(m.sortOrder)) ? Number(m.sortOrder) : undefined,
        canEdit: typeof m.canEdit !== "undefined" ? m.canEdit : true,
      }));
      const normalizedSections = (sectionsRes || [])
        .map((s: any, idx: number) => {
          const p = Number(s.position ?? s.sortOrder);
          return {
            ...s,
            docType: s.docType || docType,
            position: Number.isFinite(p) ? p : idx,
            modules: normalizedModules.filter((m: any) => m.sectionId === s.id),
          };
        })
        .sort((a: any, b: any) =>
          (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER)
        );
      setSections(normalizedSections);
      setModules(normalizedModules);
    } catch {
      showToast("Failed to load sections and modules");
    }
    state.setLoading(false);
  };

  const refreshSourceLists = async (docType: string = sowSize) => {
    try {
      const [sectionsRes, modulesRes] = await Promise.all([
        apiFetch(`/sections/all?docType=${docType}`),
        apiFetch("/modules"),
      ]);
      const normalizedModules = (modulesRes || []).map((m: any) => ({
        ...m,
        sectionId: m.sectionId || m.section_id,
        canEdit: typeof m.canEdit !== "undefined" ? m.canEdit : true,
      }));
      const normalizedSections = (sectionsRes || [])
        .map((s: any, idx: number) => {
          const p = Number(s.position);
          return {
            ...s,
            docType: s.docType || docType,
            position: Number.isFinite(p) ? p : idx,
            modules: normalizedModules.filter((m: any) => m.sectionId === s.id),
          };
        })
        .sort((a: any, b: any) =>
          (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER)
        );
      setSections(normalizedSections);
      setModules(normalizedModules);
      return normalizedSections;
    } catch (err) {
      console.warn("Failed to refresh source lists:", err);
      return sections;
    }
  };

  const fetchCustomerDetails = async (forceNo?: string) => {
    const no = forceNo ?? customerNo;
    if (!no) return;
    try {
      const data = await apiFetch(`/customer/${no}`);
      if (data.success && data.customer) {
        state.setCustomerName(data.customer.customerName);
        setErrors((prev: any) => { const { customerNo: _, ...rest } = prev; return rest; });
      } else {
        setErrors((prev: any) => ({ ...prev, customerNo: "Customer not found" }));
      }
    } catch {
      setErrors((prev: any) => ({ ...prev, customerNo: "Failed to fetch customer details" }));
    }
  };

  // ─── Auto Save ──────────────────────────────────────────────────────────────

  const waitForPendingSave = async (maxWaitMs = 5000) => {
    const startTime = Date.now();
    while (savingPromiseRef.current && Date.now() - startTime < maxWaitMs) {
      try { await savingPromiseRef.current; } catch (e) { console.warn("Pending save failed:", e); }
      if (!savingPromiseRef.current) break;
      await new Promise((r) => setTimeout(r, 100));
    }
  };

  const autoSaveDraft = async (newDocumentSections = documentSections, explicitSowType = null) => {
    if (savingPromiseRef.current) {
      try { await savingPromiseRef.current; } catch (e) { console.warn("Previous save failed:", e); }
    }
    if (isSaving || autoSaveInProgress) return;

    const savePromise = (async () => {
      setIsSaving(true);
      setAutoSaveInProgress(true);
      try {
        const normalizedSections = (newDocumentSections || []).map((section: any) => ({
          id: section.id, title: section.title || "", description: section.description || "",
          position: section.position,
          modules: (section.modules || []).map((module: any) => ({
            id: module.id, name: module.name || "",
            description: sanitizeDescription(normalizeInlineLists(module.description || "")),
            sectionId: section.id, position: module.position, canEdit: module.canEdit,
          })),
        }));
        const storedUser = typeof window !== "undefined"
          ? JSON.parse(localStorage.getItem("user") || "{}") : {};
        const storedOpe = typeof window !== "undefined"
          ? (localStorage.getItem("currentOpeId") || "") : "";
        const effectiveUserId = state.userId || storedUser?.id || null;
        const effectiveOpeId = opeId || storedOpe || null;
        const effectiveSowType = explicitSowType || sowSize;
        const sowTypeStr = effectiveSowType === "small" ? "SMALL"
          : effectiveSowType === "proposal" ? "PROPOSAL" : "FULL";
        const currentContractingParty = contractingPartyRef.current;
        const currentPartnerName = partnerNameRef.current;
        const draftData = {
          opeId: effectiveOpeId, userId: effectiveUserId,
          customerName, customerNo,
          contractingParty: currentContractingParty || null,
          partnerName: currentContractingParty || currentPartnerName || null,
          documentName, quoteId: quoteId || null,
          content: { documentSections: normalizedSections },
          sowType: sowTypeStr, status: "draft",
        };
        if (!effectiveOpeId || !effectiveUserId) {
          localStorage.setItem("pendingDraft", JSON.stringify(draftData));
          showToast("Draft saved locally (assign OPE to persist)");
          setIsSaving(false); setAutoSaveInProgress(false);
          return { success: false, reason: "no-ope-or-user", savedLocally: true };
        }
        const res = await apiFetch("/drafts/autosave", {
          method: "PUT", body: JSON.stringify(draftData),
          headers: { "Content-Type": "application/json" },
        });
        if (res?.success && res.draft) {
          setVersion(res.draft.version || version);
          try { localStorage.removeItem("pendingDraft"); } catch {}
          if (res.draft.documentName) setDocumentName(res.draft.documentName);
          else if (res.draft.fileName) setDocumentName(deriveBaseName(res.draft.fileName));
        }
        setIsSaving(false); setAutoSaveInProgress(false);
        return res;
      } catch (error: any) {
        console.error("Auto-save failed:", error);
        showToast("Failed to auto-save draft");
        setIsSaving(false); setAutoSaveInProgress(false);
        return { success: false, error: error?.message || error };
      } finally { savingPromiseRef.current = null; }
    })();
    savingPromiseRef.current = savePromise;
    return savePromise;
  };

  const debouncedAutoSave = (secs: any[], sowType: any = null) => {
    if (autoSaveDebounceRef.current) clearTimeout(autoSaveDebounceRef.current);
    autoSaveDebounceRef.current = setTimeout(() => {
      autoSaveDraft(secs, sowType).catch((e: any) =>
        console.error("Debounced autosave failed:", e)
      );
    }, 600);
  };

  // ─── SoW Type ───────────────────────────────────────────────────────────────

  const handleSowTypeChange = (newType: "full" | "small" | "proposal") => {
    if (newType === sowSize) return;
    setPendingSowType(newType);
    setShowSowTypeWarning(true);
  };

  const confirmSowTypeChange = async () => {
    if (!pendingSowType) return;
    const newType = pendingSowType;
    const oldSowType = sowSize.toUpperCase();
    try {
      const deleteRes = await apiFetch(`/drafts/delete-all/${opeId}/${oldSowType}`, { method: "DELETE" });
      if (!deleteRes.success) { showToast("Failed to clear previous SoW data"); return; }
      sowTypeChangeInProgressRef.current = true;
      skipDraftReloadRef.current = true;
      setShowSowTypeWarning(false);
      setPendingSowType(null);
      setSowSize(newType);
      setDocumentSections([]);
      setSections([]);
      setModules([]);
      await autoSaveDraft([], newType);
      await refreshSourceLists(newType);
      showToast(`Switched to ${newType === "full" ? "Full" : newType === "small" ? "Short" : "Proposal"} SoW`);
    } catch (err) {
      console.warn("Failed to save sow change:", err);
      showToast("Error switching SoW types");
    } finally { sowTypeChangeInProgressRef.current = false; }
  };

  // ─── CRUD Actions ───────────────────────────────────────────────────────────

  const handleReset = async () => {
    const prevSections = documentSections;
    try {
      setDocumentSections([]);
      const storedUser = typeof window !== "undefined"
        ? JSON.parse(localStorage.getItem("user") || "{}") : {};
      const effectiveUserId = state.userId || storedUser?.id || null;
      const res = await apiFetch("/drafts/reset", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opeId, userId: effectiveUserId }),
      });
      if (res?.success) {
        setSections((prev: any) => [
          ...prev,
          ...prevSections.map(({ id, title, description }: any) => ({ id, title, description })),
        ]);
        showToast("Document reset successfully");
      } else {
        setDocumentSections(prevSections);
        showToast("Reset failed: draft could not be saved to server");
      }
    } catch {
      setDocumentSections(prevSections);
      showToast("Reset failed: network or server error");
    }
  };

  const handleDeleteDocument = async () => {
    if (!opeId) { showToast("No OPE ID to delete"); return; }
    setIsDeleting(true);
    try {
      const res = await apiFetch(`/drafts/delete-all/${opeId}`, {
        method: "DELETE", headers: { "Content-Type": "application/json" },
      });
      if (res?.success) {
        showToast("Document and all versions deleted successfully!");
        setTimeout(() => window.history.back(), 1500);
      } else { showToast("Failed to delete document"); }
    } catch { showToast("Failed to delete document"); }
    finally { setIsDeleting(false); setShowDeleteConfirm(false); }
  };

  const handleSaveAndExit = async () => {
    try { await autoSaveDraft(); window.history.back(); }
    catch { showToast("Failed to save draft"); }
  };

  // ─── Module Edit ────────────────────────────────────────────────────────────

  // ─── Helper: Deep copy section with unique module instances ─────────────────

  const ensureModuleInstanceUniqueness = (sections: any[]) => {
    return sections.map((section: any) => ({
      ...section,
      modules: (section.modules || []).map((module: any, idx: number) => {
        // Ensure each module has unique runtime ID
        const instanceId = module.instanceId || `${module.id}_${section.id}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        // Return complete new object (deep copy to break references)
        return {
          id: module.id,
          name: module.name || "",
          description: module.description || "",
          sectionId: module.sectionId || section.id,
          position: module.position ?? idx,
          canEdit: typeof module.canEdit !== "undefined" ? module.canEdit : false,
          instanceId, // Always include instanceId
        };
      }),
    }));
  };

  // ─── Module Edit ────────────────────────────────────────────────────────────

  const handleEditModule = (module: any, sectionId?: number, instanceId?: string) => {
    // Store section + instanceId to uniquely identify this module instance
    const editModuleWithContext = {
      ...module,
      _sectionId: sectionId,
      _instanceId: instanceId || `${module.id}`,
    };
    setEditingModule(editModuleWithContext);
    setEditedDescription(module.description);
    setEditedName(module.name || "");
  };

  const handleSaveEdit = async () => {
    const updatedSections = ensureModuleInstanceUniqueness(
      documentSections.map((section: any) => ({
        ...section,
        modules: (section.modules || []).map((m: any) => {
          // Match by instanceId (unique identifier for this specific instance)
          const isTargetModule = editingModule?._instanceId && m.instanceId
            ? m.instanceId === editingModule._instanceId
            : false;

          return isTargetModule
            ? {
                ...m,
                description: sanitizeDescription(normalizeInlineLists(editedDescription || "")),
                name: editedName,
              }
            : m;
        }),
      }))
    );
    try {
      const saveResult = await autoSaveDraft(updatedSections);
      if (saveResult?.success) {
        setDocumentSections(updatedSections);
        setEditingModule(null); 
        setEditedDescription(""); 
        setEditedName("");
        showToast("Module updated successfully!");
      } else { showToast("Failed to save module changes"); }
    } catch { showToast("Error saving module changes"); }
  };

  // ─── Remove Section / Module ────────────────────────────────────────────────

  const removeSection = async (sectionId: number) => {
    const removedSection = documentSections.find((s: any) => s.id === sectionId);
    const updated = documentSections.filter((s: any) => s.id !== sectionId);
    setDocumentSections(updated);
    await autoSaveDraft(updated);
    if (removedSection) {
      setSections((prev: any) => [
        ...prev,
        { id: removedSection.id, title: removedSection.title,
          description: removedSection.description, docType: removedSection.docType },
      ]);
    }
    showToast("Section removed from document!");
  };

  const removeModule = (instanceId: string | number, sectionId: number) => {
    setDocumentSections((prev: any) => {
      const updated = ensureModuleInstanceUniqueness(
        prev.map((section: any) => {
          if (section.id !== sectionId) return section;
          
          // Filter by instanceId (unique identifier for this specific instance)
          return {
            ...section,
            modules: (section.modules || []).filter((m: any) => m.instanceId !== instanceId),
          };
        })
      );
      autoSaveDraft(updated);
      return updated;
    });
    showToast("Module removed from document!");
  };

  // ─── Preview ────────────────────────────────────────────────────────────────

  const handlePreview = async () => {
    setPreviewLoading(true);
    setPreviewFileType("pdf");
    try {
      const vars = { customerName, partnerName, documentName, opeId };
      const isProposal = sowSize === "proposal";
      const payload = {
        customerName, customerEmail: "", customerAddress: "", contractingParty, partnerName,
        quoteId, documentTitle: documentName,
        sowType: sowSize === "small" ? "SMALL" : sowSize === "proposal" ? "PROPOSAL" : "FULL",
        status: "draft", createdAtFormatted: formatDateOnly(new Date()),
        sections: documentSections.map((s: any) => ({
          id: s.id, title: replaceTags(s.title, vars), description: replaceTags(s.description || "", vars),
        })),
        assigned: documentSections.reduce((acc: any, s: any) => {
          acc[s.id] = s.modules.map((m: any) => ({
            id: m.id, name: replaceTags(m.name, vars),
            description: replaceTags(m.description, vars), sectionId: s.id,
          }));
          return acc;
        }, {}),
      };

      if (isProposal) {
        try {
          const response = await apiFetch(`/proposal/${opeId}?preview=true`, {
            method: "POST", body: JSON.stringify(payload),
            headers: { "Content-Type": "application/json" }, responseType: "blob",
          });
          if (!response || response.size === 0) { showToast("Failed to generate proposal preview"); return; }
          setPreviewFileType("pdf");
          setPreviewPdfUrl(window.URL.createObjectURL(new Blob([response], { type: "application/pdf" })));
          setShowPreview(true);
        } catch (fetchErr) {
          console.error("Failed to fetch proposal preview:", fetchErr);
          showToast("Failed to fetch proposal preview");
        }
      } else {
        const response = await apiFetch(`/generate-document/${opeId}?type=docx&preview=true`, {
          method: "POST", body: JSON.stringify(payload),
          headers: { "Content-Type": "application/json" }, responseType: "blob",
        });
        if (response && response.size > 0) {
          if (isElectronEnv() && (window as any).electronAPI?.processDOCXAndGeneratePDF) {
            try {
              const base64 = await blobToBase64(response);
              const result = await (window as any).electronAPI.processDOCXAndGeneratePDF({
                base64, fileName: `preview_${Date.now()}.docx`,
              });
              if (result?.success && result.pdfPath) {
                setPreviewFileType("pdf");
                setPreviewPdfUrl(`file:///${result.pdfPath.replace(/\\/g, "/")}`);
                setShowPreview(true);
              } else {
                setPreviewFileType("docx");
                setPreviewPdfUrl(window.URL.createObjectURL(
                  new Blob([response], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" })
                ));
                setShowPreview(true);
                showToast("Preview: Showing DOCX (TOC conversion failed)");
              }
            } catch {
              setPreviewFileType("docx");
              setPreviewPdfUrl(window.URL.createObjectURL(
                new Blob([response], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" })
              ));
              setShowPreview(true);
              showToast("Preview: Showing DOCX (Electron unavailable)");
            }
          } else {
            setPreviewFileType("docx");
            setPreviewPdfUrl(window.URL.createObjectURL(
              new Blob([response], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" })
            ));
            setShowPreview(true);
          }
        } else { showToast("Failed to generate preview"); }
      }
    } catch (error) {
      console.error("Preview error:", error);
      showToast("Failed to generate preview");
    }
    setPreviewLoading(false);
  };

  // ─── Generate ───────────────────────────────────────────────────────────────

  const handleGenerate = async (type: string, status: "draft" | "final") => {
    try {
      setGenerating(true);
      showToast(`Generating ${status.toUpperCase()} document...`);
      const versionsRes = await apiFetch(
        status === "final"
          ? `/finals?opeId=${opeId}&userId=${state.userId}`
          : `/drafts?opeId=${opeId}&userId=${state.userId}`
      );
      const allVersions = (status === "final" ? versionsRes?.finals : versionsRes?.drafts) || [];
      const generatedVersions = allVersions.filter((v: any) => (v.version || 0) > 0);
      const nextVersion =
        (generatedVersions.length > 0 ? generatedVersions[generatedVersions.length - 1].version : 0) + 1;
      const idPart = opeId || `OPE-${Date.now()}`;
      const formattedBase =
        sowSize === "proposal"
          ? `${idPart} - HPE Nonstop Proposal${partnerName ? ` to ${partnerName}` : ""} for ${customerName}_${status}_v${nextVersion}`
          : `${idPart} - HPE Nonstop SoW${partnerName ? ` to ${partnerName}` : ""} for ${customerName}_${status}_v${nextVersion}`;
      setDocumentName(formattedBase);
      const sowTypeStr = sowSize === "small" ? "SMALL" : sowSize === "proposal" ? "PROPOSAL" : "FULL";
      const saveRes = await apiFetch(status === "final" ? "/finals" : "/drafts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          opeId, userId: state.userId, customerName, customerNo, contractingParty, partnerName,
          customerEmail: "", customerAddress: "", documentName,
          fileName: `${formattedBase}.${sowSize === "proposal" ? "pptx" : type}`,
          quoteId, content: { documentSections }, sowType: sowTypeStr, status,
        }),
      });
      if (saveRes.success) {
        showToast(`${status.toUpperCase()} document saved successfully!`);
        if (status === "draft") setDraftVersions((prev: any) => [...prev, saveRes.draft]);
        else setFinalVersions((prev: any) => [...prev, saveRes.final]);
        await refreshSourceLists();
        showToast(`${status.toUpperCase()} document generated. Keep editing or generate again!`);
      } else { showToast(`Failed to save ${status} document`); }
    } catch (error) {
      console.error(error);
      showToast(`Error generating ${status} document`);
    } finally { setGenerating(false); }
  };

  // ─── OPE ID Change ──────────────────────────────────────────────────────────

  const handleConfirmOpeIdChange = async () => {
    const val = newOpeId.toUpperCase();
    let validated = val.startsWith("OPE-") ? val : "OPE-" + val.replace(/^OPE-?/i, "");
    const suffix = validated.slice(4);
    if (!/^[A-Z0-9]*$/.test(suffix)) { showToast("Invalid OPE ID: Only uppercase letters and digits allowed after OPE-"); return; }
    if (!/^(\d{10}|HOLD\d{6}|EXCP\d{6})$/.test(suffix)) { showToast("OPE ID must be: OPE-1234567890, OPE-HOLD123456, or OPE-EXCP123456"); return; }
    if (validated === opeId) { setIsEditingOpeId(false); return; }
    if (!window.confirm(`Changing OPE ID from "${opeId}" to "${validated}" will create a new document version starting from 1. Proceed?`)) return;
    try {
      setIsChangingOpeId(true);
      const response = await apiFetch("/drafts/update-ope", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldOpeId: opeId, newOpeId: validated, userId: state.userId }),
      });
      if (response.success) {
        setOpeId(validated);
        localStorage.setItem("currentOpeId", validated);
        showToast(response.message || "OPE ID updated successfully!");
        const draftRes = await apiFetch(`/drafts/${validated}`);
        if (draftRes?.draft) {
          setDocumentSections(draftRes.draft.content?.documentSections || []);
          setVersion(draftRes.draft.version || 0);
          setSowSize(draftRes.draft.sowType === "SMALL" ? "small" : draftRes.draft.sowType === "PROPOSAL" ? "proposal" : "full");
        }
        setIsEditingOpeId(false);
      } else { showToast(response.error || response.message || "Failed to update OPE ID"); }
    } catch (error: any) {
      showToast(error.message || "Error updating OPE ID");
    } finally { setIsChangingOpeId(false); }
  };

  return {
    showToast,
    fetchData, refreshSourceLists, fetchCustomerDetails,
    autoSaveDraft, debouncedAutoSave, waitForPendingSave,
    handleSowTypeChange, confirmSowTypeChange,
    handleReset, handleDeleteDocument, handleSaveAndExit,
    handleEditModule, handleSaveEdit,
    removeSection, removeModule,
    handlePreview, handleGenerate, handleConfirmOpeIdChange,
  };
}