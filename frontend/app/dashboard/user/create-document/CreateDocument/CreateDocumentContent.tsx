// @ts-nocheck
"use client";

import React, { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import AvailableSection from "./components/AvailableSection";
import EditModal from "./components/EditModal";
import GenerateDocumentModal from "./components/GenerateDocumentModal";
import ReadOnlyModal from "./components/ReadOnlyModal";
import DocxPreviewModal from "./components/DocxPreviewModal";
import UserHeader from "@/components/UserHeader";
import SowTypeWarningModal from "./components/SowTypeWarningModal";

import { useCreateDocumentState } from "./hooks/useCreateDocumentState";
import { useCreateDocumentDataActions } from "./hooks/useCreateDocumentDataActions";
import { useCreateDocumentDragActions } from "./hooks/useCreateDocumentDragActions";
import { useCreateDocumentEffects } from "./hooks/useCreateDocumentEffects";
import DocumentHeaderFields from "./components/DocumentHeaderFields";
import DocumentBuilderPane from "./components/DocumentBuilderPane";
import { DeleteConfirmModal, ResetConfirmModal, Toast } from "./components/ConfirmModals";
import { parseSectionDocTypes, replaceTags, formatDateOnly, stripHtmlLocal, expandImageUrlsLocal } from "./utils/utils";

// ─── Main Component ────────────────────────────────────────────────────────────

export default function CreateDocumentContent() {
  const [searchQuery, setSearchQuery] = useState("");
  const state = useCreateDocumentState();
  const dataActions = useCreateDocumentDataActions(state);
  const dragActions = useCreateDocumentDragActions(state, dataActions);
  // Merge for convenient access
  const actions = { ...dataActions, ...dragActions };

  // ── Wire up all effects ──────────────────────────────────────────────────────
  useCreateDocumentEffects(
    { ...state },
    {
      fetchData: actions.fetchData,
      fetchCustomerDetails: actions.fetchCustomerDetails,
      autoSaveDraft: actions.autoSaveDraft,
      handlePreview: actions.handlePreview,
      setShowGenerateModal: state.setShowGenerateModal,
    }
  );

  const {
    sections, modules, documentSections, setDocumentSections,
    userId, userNameDb, username, userEmail,
    documentName, setDocumentName,
    customerName, setCustomerName,
    customerNo, setCustomerNo,
    contractingParty, setContractingParty,
    partnerName, opeId, setOpeId,
    quoteId, setQuoteId, version,
    sowSize, setSowSize,
    showSowTypeWarning, setShowSowTypeWarning, pendingSowType, setPendingSowType,
    loading, generating, previewLoading,
    isSaving, autoSaveInProgress, isDeleting, isChangingOpeId,
    isEditingOpeId, setIsEditingOpeId, newOpeId, setNewOpeId,
    errors, setErrors, toast,
    documentNameFocused, setDocumentNameFocused, isSavingDocumentName, setIsSavingDocumentName,
    customerNoFocused, setCustomerNoFocused, isSavingCustomerNo, setIsSavingCustomerNo,
    contractingPartyFocused, setContractingPartyFocused,
    isSavingContractingParty, setIsSavingContractingParty,
    quoteIdFocused, setQuoteIdFocused, isSavingQuoteId, setIsSavingQuoteId,
    showPreview, setShowPreview,
    previewPdfUrl, previewFileType,
    showGenerateModal, setShowGenerateModal,
    showResetConfirm, setShowResetConfirm,
    showDeleteConfirm, setShowDeleteConfirm,
    editingModule, setEditingModule,
    editedDescription, setEditedDescription,
    editedName, setEditedName,
    viewingModule, setViewingModule,
    draftVersions, finalVersions,
    highlightedSectionId, setHighlightedSectionId,
    highlightedModuleId, setHighlightedModuleId,
    expandedSections, setExpandedSections,
    dragSourceRef, dragOver,
    leftPaneRef, builderPaneRef, builderMinHeight,
  } = state;

  // ── Derived / computed ───────────────────────────────────────────────────────

  const visibleSections = useMemo(
    () => sections.filter((s) => parseSectionDocTypes(s.docType).includes(sowSize.toLowerCase())),
    [sections, sowSize]
  );

  const visibleModules = useMemo(
    () =>
      modules.filter((m) => {
        const sec = sections.find((s) => Number(s.id) === Number(m.sectionId));
        if (!sec) return false;
        return parseSectionDocTypes(sec.docType).includes(sowSize.toLowerCase());
      }),
    [modules, sections, sowSize]
  );

  const visibleSectionsWithModules = useMemo(
    () =>
      visibleSections.map((section) => ({
        ...section,
        modules: visibleModules.filter((m) => m.sectionId === section.id),
      })),
    [visibleSections, visibleModules]
  );

  // Filter modules and sections based on search query
  const filteredSectionsWithModules = useMemo(() => {
    if (!searchQuery.trim()) return visibleSectionsWithModules;

    const query = searchQuery.toLowerCase();
    return visibleSectionsWithModules
      .map((section) => ({
        ...section,
        modules: (section.modules || []).filter((module) => {
          const moduleName = (module.name || "").toLowerCase();
          const moduleDesc = stripHtmlLocal(module.description || "").toLowerCase();
          return moduleName.includes(query) || moduleDesc.includes(query);
        }),
      }))
      .filter((section) => {
        const sectionTitle = stripHtmlLocal(section.title || "").toLowerCase();
        const sectionDesc = stripHtmlLocal(section.description || "").toLowerCase();
        return (
          sectionTitle.includes(query) ||
          sectionDesc.includes(query) ||
          (section.modules || []).length > 0
        );
      });
  }, [visibleSectionsWithModules, searchQuery]);

  const vars = { customerName, partnerName, documentName, opeId };

  const previewPayload = useMemo(() => ({
    customerName, customerEmail: "", customerAddress: "", contractingParty, partnerName,
    documentTitle: documentName,
    sowType: sowSize === "small" ? "SMALL" : sowSize === "proposal" ? "PROPOSAL" : "FULL",
    createdAtFormatted: formatDateOnly(new Date()),
    sections: documentSections.map((s) => ({
      id: s.id,
      title: replaceTags(s.title, vars),
      description: replaceTags(s.description || "", vars),
    })),
    assigned: documentSections.reduce((acc: any, s) => {
      acc[s.id] = (s.modules || []).map((m) => ({
        id: m.id,
        name: replaceTags(m.name, vars),
        description: replaceTags(m.description, vars),
        sectionId: s.id,
      }));
      return acc;
    }, {}),
  }), [customerName, contractingParty, partnerName, documentName, sowSize, documentSections]);

  // ── Field save handlers (inline save buttons) ───────────────────────────────

  const onSaveDocumentName = async () => {
    setIsSavingDocumentName(true);
    try {
      const result = await actions.autoSaveDraft();
      actions.showToast(result?.success ? "Document Name saved!" : result?.savedLocally ? "Saved locally" : "Failed to save");
    } catch { actions.showToast("Failed to save document name"); }
    finally { setIsSavingDocumentName(false); setDocumentNameFocused(false); }
  };

  const onSaveCustomerNo = async () => {
    setIsSavingCustomerNo(true);
    try {
      await actions.fetchCustomerDetails();
      const result = await actions.autoSaveDraft();
      actions.showToast(result?.success ? "Customer saved!" : result?.savedLocally ? "Saved locally" : "Failed to save");
    } catch { actions.showToast("Failed to save customer"); }
    finally { setIsSavingCustomerNo(false); setCustomerNoFocused(false); }
  };

  const onSaveContractingParty = async () => {
    setIsSavingContractingParty(true);
    try {
      const result = await actions.autoSaveDraft();
      actions.showToast(result?.success ? "Contracting Party saved!" : result?.savedLocally ? "Saved locally" : "Failed to save");
    } catch { actions.showToast("Failed to save contracting party"); }
    finally { setIsSavingContractingParty(false); setContractingPartyFocused(false); }
  };

  const onSaveQuoteId = async () => {
    setIsSavingQuoteId(true);
    try {
      const result = await actions.autoSaveDraft();
      actions.showToast(result?.success ? "Quote ID saved!" : result?.savedLocally ? "Saved locally" : "Failed to save");
    } catch { actions.showToast("Failed to save quote ID"); }
    finally { setIsSavingQuoteId(false); setQuoteIdFocused(false); }
  };

  // ── Loading splash ───────────────────────────────────────────────────────────

  if (generating || previewLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading document workspace...</p>
        </div>
      </div>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 text-sm" onDragEnd={actions.handleDragEnd}>
      <UserHeader username={username} />

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* ── Header Fields ── */}
        <DocumentHeaderFields
          documentName={documentName} setDocumentName={setDocumentName}
          documentNameFocused={documentNameFocused} setDocumentNameFocused={setDocumentNameFocused}
          isSavingDocumentName={isSavingDocumentName} onSaveDocumentName={onSaveDocumentName}
          customerNo={customerNo} setCustomerNo={setCustomerNo}
          customerName={customerName} errors={errors}
          customerNoFocused={customerNoFocused} setCustomerNoFocused={setCustomerNoFocused}
          isSavingCustomerNo={isSavingCustomerNo} onSaveCustomerNo={onSaveCustomerNo}
          fetchCustomerDetails={actions.fetchCustomerDetails}
          contractingParty={contractingParty} setContractingParty={setContractingParty}
          contractingPartyFocused={contractingPartyFocused}
          setContractingPartyFocused={setContractingPartyFocused}
          isSavingContractingParty={isSavingContractingParty}
          onSaveContractingParty={onSaveContractingParty}
          quoteId={quoteId} setQuoteId={setQuoteId}
          quoteIdFocused={quoteIdFocused} setQuoteIdFocused={setQuoteIdFocused}
          isSavingQuoteId={isSavingQuoteId} onSaveQuoteId={onSaveQuoteId}
          opeId={opeId} newOpeId={newOpeId} setNewOpeId={setNewOpeId}
          isEditingOpeId={isEditingOpeId} setIsEditingOpeId={setIsEditingOpeId}
          isSaving={isSaving} isChangingOpeId={isChangingOpeId}
          setErrors={setErrors}
          onConfirmOpeIdChange={actions.handleConfirmOpeIdChange}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* ── Left Sidebar ── */}
          <div ref={leftPaneRef} className="bg-white rounded-xl shadow-sm p-3">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Modules</h2>
              <div className="flex items-center gap-3 text-sm flex-wrap">
                {(["full", "small", "proposal"] as const).map((type) => (
                  <label key={type} className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio" name="sowSize" value={type}
                      checked={sowSize === type}
                      onChange={() => actions.handleSowTypeChange(type)}
                      className={`w-4 h-4 ${type === "proposal" ? "accent-blue-600" : "accent-green-600"}`}
                    />
                    <span className={type === "proposal" ? "text-blue-700 font-semibold" : "text-gray-700"}>
                      {type === "full" ? "Full SoW" : type === "small" ? "Short SoW" : "Proposal"}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* ── Search Input ── */}
            <div className="mb-4 flex items-center gap-2 px-2 py-1.5 bg-gray-100 rounded-lg border border-gray-300">
              <Search className="h-4 w-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search modules..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-gray-100 outline-none text-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="p-1 hover:bg-gray-200 rounded transition-colors"
                  title="Clear search"
                >
                  <X className="h-4 w-4 text-gray-500" />
                </button>
              )}
            </div>

            <div className="space-y-2">
              <AvailableSection
                sections={filteredSectionsWithModules.map((section) => ({
                  ...section,
                  title:
                    stripHtmlLocal(section.title) ||
                    stripHtmlLocal(section.description || "").split("\n")[0],
                }))}
                expandedSections={expandedSections}
                toggleSection={(id) =>
                  setExpandedSections((prev) =>
                    prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
                  )
                }
                handleDragStart={actions.handleDragStart}
                highlightedSectionId={highlightedSectionId}
                highlightedModuleId={highlightedModuleId}
              />
            </div>
          </div>

          {/* ── Document Builder ── */}
          <DocumentBuilderPane
            builderPaneRef={builderPaneRef}
            builderMinHeight={builderMinHeight}
            documentSections={documentSections}
            sections={sections}
            vars={vars}
            dragSourceRef={dragSourceRef}
            dragOver={dragOver}
            isSaving={isSaving}
            autoSaveInProgress={autoSaveInProgress}
            sowSize={sowSize}
            onReset={() => setShowResetConfirm(true)}
            onDelete={() => setShowDeleteConfirm(true)}
            onSaveAndExit={actions.handleSaveAndExit}
            onDrop={actions.handleDrop}
            onModuleDragStart={actions.onModuleDragStart}
            onModuleDragEnd={actions.onModuleDragEnd}
            onModuleDragEnter={actions.onModuleDragEnter}
            onModuleDragLeave={actions.onModuleDragLeave}
            onModuleDrop={actions.onModuleDrop}
            onEditModule={actions.handleEditModule}
            onRemoveModule={actions.removeModule}
            onRemoveSection={actions.removeSection}
          />
        </div>
      </div>

      {/* ── Confirm Modals ── */}
      {showDeleteConfirm && (
        <DeleteConfirmModal
          opeId={opeId} version={version} isDeleting={isDeleting}
          onConfirm={actions.handleDeleteDocument}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
      {showResetConfirm && (
        <ResetConfirmModal
          onConfirm={async () => { await actions.handleReset(); setShowResetConfirm(false); }}
          onCancel={() => setShowResetConfirm(false)}
        />
      )}

      {/* ── Feature Modals ── */}
      <EditModal
        module={editingModule} name={editedName} description={editedDescription}
        onNameChange={setEditedName} onDescriptionChange={setEditedDescription}
        onSave={actions.handleSaveEdit} onCancel={() => setEditingModule(null)}
      />
      <ReadOnlyModal
        module={viewingModule} onClose={() => setViewingModule(null)}
        expandImageUrls={expandImageUrlsLocal}
      />
      <GenerateDocumentModal
        isOpen={showGenerateModal} onGenerate={actions.handleGenerate}
        onClose={() => setShowGenerateModal(false)}
        draftVersions={draftVersions} finalVersions={finalVersions}
        documentName={documentName} opeId={opeId} userNameDb={userNameDb}
        customerName={customerName} partnerName={partnerName} version={version}
        userEmail={userEmail}
        sowType={sowSize === "small" ? "SMALL" : sowSize === "proposal" ? "PROPOSAL" : "FULL"}
      />
      <DocxPreviewModal
        isOpen={showPreview} onClose={() => setShowPreview(false)}
        payload={previewPayload} opeId={opeId}
        showToast={actions.showToast} pdfUrl={previewPdfUrl}
        fileType={previewFileType}
      />
      <SowTypeWarningModal
        isOpen={showSowTypeWarning} onConfirm={actions.confirmSowTypeChange}
        onCancel={() => { setShowSowTypeWarning(false); setPendingSowType(null); }}
        fromType={sowSize} toType={pendingSowType || sowSize}
      />

      {/* ── Toast ── */}
      {toast && <Toast message={toast} />}
    </div>
  );
}