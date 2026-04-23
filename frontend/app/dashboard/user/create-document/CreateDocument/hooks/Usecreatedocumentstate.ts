// @ts-nocheck
import { useState, useRef } from "react";
import { Module, Section, DocumentSection, SowSize } from "./types";

export function useCreateDocumentState() {
  // ── Core state ──────────────────────────────────────────────────────────────
  const [sections, setSections] = useState<Section[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [documentSections, setDocumentSections] = useState<DocumentSection[]>([]);
  const [userId, setUserId] = useState(1);
  const [userNameDb, setUserNameDb] = useState("");
  const [username, setUsername] = useState("User");
  const [userEmail, setUserEmail] = useState("");

  // ── Document metadata ────────────────────────────────────────────────────────
  const [documentName, setDocumentName] = useState("SoW Document");
  const [customerName, setCustomerName] = useState("");
  const [customerNo, setCustomerNo] = useState("");
  const [contractingParty, setContractingParty] = useState("");
  const [partnerName, setPartnerName] = useState("");
  const [opeId, setOpeId] = useState("");
  const [quoteId, setQuoteId] = useState<string | null>(null);
  const [hpeLegalEntity, setHpeLegalEntity] = useState("");
  const [version, setVersion] = useState(0);

  // ── SoW type ─────────────────────────────────────────────────────────────────
  const [sowSize, setSowSize] = useState<SowSize>("full");
  const [showSowTypeWarning, setShowSowTypeWarning] = useState(false);
  const [pendingSowType, setPendingSowType] = useState<SowSize | null>(null);

  // ── UI / loading state ───────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [autoSaveInProgress, setAutoSaveInProgress] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isChangingOpeId, setIsChangingOpeId] = useState(false);
  const [isEditingOpeId, setIsEditingOpeId] = useState(false);
  const [newOpeId, setNewOpeId] = useState("");
  const [errors, setErrors] = useState<any>({});
  const [toast, setToast] = useState<string | null>(null);

  // ── Field-level save flags ───────────────────────────────────────────────────
  const [documentNameFocused, setDocumentNameFocused] = useState(false);
  const [isSavingDocumentName, setIsSavingDocumentName] = useState(false);
  const [customerNoFocused, setCustomerNoFocused] = useState(false);
  const [isSavingCustomerNo, setIsSavingCustomerNo] = useState(false);
  const [contractingPartyFocused, setContractingPartyFocused] = useState(false);
  const [isSavingContractingParty, setIsSavingContractingParty] = useState(false);
  const [quoteIdFocused, setQuoteIdFocused] = useState(false);
  const [isSavingQuoteId, setIsSavingQuoteId] = useState(false);
  const [hpeLegalEntityFocused, setHpeLegalEntityFocused] = useState(false);
  const [isSavingHpeLegalEntity, setIsSavingHpeLegalEntity] = useState(false);

  // ── Modal state ──────────────────────────────────────────────────────────────
  const [showPreview, setShowPreview] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewFileType, setPreviewFileType] = useState<"pdf" | "docx" | "pptx">("pdf");
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editingModule, setEditingModule] = useState<Module | null>(null);
  const [editedDescription, setEditedDescription] = useState("");
  const [editedName, setEditedName] = useState("");
  const [viewingModule, setViewingModule] = useState<Module | null>(null);

  // ── Versions ─────────────────────────────────────────────────────────────────
  const [draftVersions, setDraftVersions] = useState<number[]>([]);
  const [finalVersions, setFinalVersions] = useState<number[]>([]);

  // ── Highlight state ──────────────────────────────────────────────────────────
  const [highlightedSectionId, setHighlightedSectionId] = useState<number | null>(null);
  const [highlightedModuleId, setHighlightedModuleId] = useState<number | null>(null);

  // ── Drag state ───────────────────────────────────────────────────────────────
  const [expandedSections, setExpandedSections] = useState<number[]>([]);
  const dragSourceRef = useRef<{ sectionId: number; index: number } | null>(null);
  const [dragOver, setDragOver] = useState<{
    sectionId: number | null;
    index: number | null;
    position: "before" | "after" | null;
  }>({ sectionId: null, index: null, position: null });

  // ── Refs ─────────────────────────────────────────────────────────────────────
  const leftPaneRef = useRef<HTMLDivElement | null>(null);
  const builderPaneRef = useRef<HTMLDivElement | null>(null);
  const [builderMinHeight, setBuilderMinHeight] = useState<number>(500);
  const autoSaveDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const customerNoDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const pendingAutoActionRef = useRef<any>(null);
  const sowTypeChangeInProgressRef = useRef(false);
  const skipDraftReloadRef = useRef(false);
  const initialDraftLoadedRef = useRef(false);
  const dataFetchedAfterLoadRef = useRef(false);
  const savingPromiseRef = useRef<Promise<any> | null>(null);
  const customerNoInitialMount = useRef(true);
  const isHydratedRef = useRef(false);

  // ── Always-current refs for partner fields ───────────────────────────────────
  const contractingPartyRef = useRef(contractingParty);
  const partnerNameRef = useRef(partnerName);

  return {
    // Core state
    sections, setSections,
    modules, setModules,
    documentSections, setDocumentSections,
    userId, setUserId,
    userNameDb, setUserNameDb,
    username, setUsername,
    userEmail, setUserEmail,
    // Document metadata
    documentName, setDocumentName,
    customerName, setCustomerName,
    customerNo, setCustomerNo,
    contractingParty, setContractingParty,
    partnerName, setPartnerName,
    opeId, setOpeId,
    quoteId, setQuoteId,
    hpeLegalEntity, setHpeLegalEntity,
    version, setVersion,
    // SoW type
    sowSize, setSowSize,
    showSowTypeWarning, setShowSowTypeWarning,
    pendingSowType, setPendingSowType,
    // UI / loading
    loading, setLoading,
    generating, setGenerating,
    previewLoading, setPreviewLoading,
    isSaving, setIsSaving,
    autoSaveInProgress, setAutoSaveInProgress,
    isDeleting, setIsDeleting,
    isChangingOpeId, setIsChangingOpeId,
    isEditingOpeId, setIsEditingOpeId,
    newOpeId, setNewOpeId,
    errors, setErrors,
    toast, setToast,
    // Field-level save flags
    documentNameFocused, setDocumentNameFocused,
    isSavingDocumentName, setIsSavingDocumentName,
    customerNoFocused, setCustomerNoFocused,
    isSavingCustomerNo, setIsSavingCustomerNo,
    contractingPartyFocused, setContractingPartyFocused,
    isSavingContractingParty, setIsSavingContractingParty,
    quoteIdFocused, setQuoteIdFocused,
    isSavingQuoteId, setIsSavingQuoteId,
    hpeLegalEntityFocused, setHpeLegalEntityFocused,
    isSavingHpeLegalEntity, setIsSavingHpeLegalEntity,
    // Modals
    showPreview, setShowPreview,
    previewPdfUrl, setPreviewPdfUrl,
    previewFileType, setPreviewFileType,
    showGenerateModal, setShowGenerateModal,
    showResetConfirm, setShowResetConfirm,
    showDeleteConfirm, setShowDeleteConfirm,
    editingModule, setEditingModule,
    editedDescription, setEditedDescription,
    editedName, setEditedName,
    viewingModule, setViewingModule,
    // Versions
    draftVersions, setDraftVersions,
    finalVersions, setFinalVersions,
    // Highlights
    highlightedSectionId, setHighlightedSectionId,
    highlightedModuleId, setHighlightedModuleId,
    // Drag
    expandedSections, setExpandedSections,
    dragSourceRef,
    dragOver, setDragOver,
    // Refs
    leftPaneRef,
    builderPaneRef,
    builderMinHeight, setBuilderMinHeight,
    autoSaveDebounceRef,
    customerNoDebounceRef,
    pendingAutoActionRef,
    sowTypeChangeInProgressRef,
    skipDraftReloadRef,
    initialDraftLoadedRef,
    dataFetchedAfterLoadRef,
    savingPromiseRef,
    customerNoInitialMount,
    isHydratedRef,
    contractingPartyRef,
    partnerNameRef,
  };
}