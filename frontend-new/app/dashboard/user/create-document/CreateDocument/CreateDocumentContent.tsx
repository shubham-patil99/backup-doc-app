// @ts-nocheck
  "use client";

  import React, { useEffect, useState, useRef } from "react";
  import { Download, Save, FileText, ChevronDown, ChevronRight, User, Layout, List, RotateCcw, X, Pencil, Eye, Trash, x } from "lucide-react";
  import AvailableSection from "./components/AvailableSection";
  import AvailableModule from "./components/AvailableModule";
  import DocumentSection from "./components/DocumentSection";
  import EditModal from "./components/EditModal";
  import GenerateDocumentModal from './components/GenerateDocumentModal';
  import ReadOnlyModal from "./components/ReadOnlyModal";
  import useDragDrop from "./hooks/useDragDrop";
  import { apiFetch } from "@/lib/apiClient";
  import DocxPreviewModal from "./components/DocxPreviewModal";
  import UserHeader from "@/components/UserHeader";
  import SowTypeWarningModal from "./components/SowTypeWarningModal";
  import { stripHtml, deriveBaseFromFileName, expandImageUrls, replaceTags, formatDateOnly, sortDocumentSectionsByPosition } from "../../utils/helpers";
  import { normalizeInlineLists, sanitizeDescription } from "../../utils/sanitization";


  // Types
  interface Module {
    id: number;
    name: string;
    description: string;
    sectionId: number;
    canEdit: boolean;
    position?: number;
  }

  interface Section {
    id: number;
    title: string;
    description?: string;
    position?: number;
  }

  interface DragItem {
    type: 'SECTION' | 'MODULE';
    data: {
      section?: Section;
      module?: Module;
      sectionId?: number;
    };
  }

  interface DocumentSection extends Section {
    modules: Module[];
  }

  // Main Component
  export default function CreateDocumentContent() {
    // State declarations
    const [sections, setSections] = useState<Section[]>([]);
    const [modules, setModules] = useState<Module[]>([]);
    const [documentSections, setDocumentSections] = useState<DocumentSection[]>([]);
    // const [sowSize, setSowSize] = useState<'large' | 'small'>('large');
    const [userId, setUserId] = useState(1);
    const [userNameDb, setUserNameDb] = useState("");
    const [documentName, setDocumentName] = useState("SoW Document");
    const [customerName, setCustomerName] = useState("");
    const [customerNo, setCustomerNo] = useState("");
    const [contractingParty, setContractingParty] = useState("");
    const [partnerName, setPartnerName] = useState("");
    const [opeId, setOpeId] = useState("");
    const [quoteId, setQuoteId] = useState<string | null>(null);
    const [username, setUsername] = useState("User");
    const [toast, setToast] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [showPreview, setShowPreview] = useState(false);
    const [showGenerateModal, setShowGenerateModal] = useState(false);
    const [version, setVersion] = useState(0);
    const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
    const [draftVersions, setDraftVersions] = useState<number[]>([]);
    const [finalVersions, setFinalVersions] = useState<number[]>([]);
    const [userEmail, setUserEmail] = useState("");
    const [generating, setGenerating] = useState(false);
      const [previewLoading, setPreviewLoading] = useState(false);
      const [documentNameFocused, setDocumentNameFocused] = useState(false);
      const [isSavingContractingParty, setIsSavingContractingParty] = useState(false);
      const [isSavingQuoteId, setIsSavingQuoteId] = useState(false);
    const [editingModule, setEditingModule] = useState<Module | null>(null);
    const [contractingPartyFocused, setContractingPartyFocused] = useState(false);
    const [customerNoFocused, setCustomerNoFocused] = useState(false);
    const [quoteIdFocused, setQuoteIdFocused] = useState(false);
    const [isSavingCustomerNo, setIsSavingCustomerNo] = useState(false);
    const [editedDescription, setEditedDescription] = useState("");
    const [editedName, setEditedName] = useState("");
    const [viewingModule, setViewingModule] = useState<Module | null>(null);
    const [expandedSections, setExpandedSections] = useState<number[]>([]);
     const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isEditingOpeId, setIsEditingOpeId] = useState(false);
    const [newOpeId, setNewOpeId] = useState("");
    const [isChangingOpeId, setIsChangingOpeId] = useState(false);
    const [errors, setErrors] = useState<any>({});
    const [sowSize, setSowSize] = useState<'full' | 'small'>('full');
    const [showSowTypeWarning, setShowSowTypeWarning] = useState(false);
    const [pendingSowType, setPendingSowType] = useState<'full' | 'small' | null>(null);
    // refs and state to sync left pane height -> builder height
     const dragSourceRef = useRef<{ sectionId: number; index: number } | null>(null);
    const [dragOver, setDragOver] = useState<{ sectionId: number | null; index: number | null; position: "before" | "after" | null }>({
      sectionId: null,
      index: null,
      position: null
    });
    const pendingAutoActionRef = useRef<any>(null);
    const leftPaneRef = useRef<HTMLDivElement | null>(null);
    const builderPaneRef = useRef<HTMLDivElement | null>(null);
    const [builderMinHeight, setBuilderMinHeight] = useState<number>(500);
    const autoSaveDebounceRef = useRef<NodeJS.Timeout | null>(null);
     const customerNoDebounceRef = useRef<NodeJS.Timeout | null>(null);
    const [autoSaveInProgress, setAutoSaveInProgress] = useState(false);

    useEffect(() => {
      if (typeof window === "undefined") return;
      const leftEl = leftPaneRef.current;
      if (!leftEl) return;

      const update = () => {
        // measure natural content height of left pane
        const natural = leftEl.scrollHeight || leftEl.offsetHeight || 0;
        // small padding so builder is slightly taller than left pane
        const desired = Math.max(500, natural + 40);
        // cap to avoid runaway sizes
        const cap = Math.max(window.innerHeight * 2, 2000);
        const target = Math.min(desired, cap);
        // only update when change is meaningful (prevents tiny oscillations)
        if (Math.abs((builderMinHeight || 0) - target) > 8) {
          setBuilderMinHeight(target);
        }
      };

      update();
      let ro: ResizeObserver | null = null;
      if ((window as any).ResizeObserver) {
        ro = new ResizeObserver(update);
        ro.observe(leftEl);
      }
      window.addEventListener("resize", update);
      return () => {
        if (ro) ro.disconnect();
        window.removeEventListener("resize", update);
      };
    }, [sections, documentSections, builderMinHeight]);

    // Initialize from localStorage
    useEffect(() => {
      if (typeof window === "undefined") return;

      try {
        const user = JSON.parse(localStorage.getItem("user") || "{}");
        const currentOpeId = localStorage.getItem("currentOpeId") || "";
        const customerInfo = JSON.parse(localStorage.getItem("customerInfo") || "{}");

        setUserId(user?.id || 1);
        setUserNameDb(user?.name || user?.email || "User");
        setUsername(user?.name || user?.email || "User");
        setUserEmail(user?.email || "");
        setOpeId(currentOpeId);
        setNewOpeId(currentOpeId);
        setCustomerName(customerInfo?.customerName || "");
        setCustomerNo(customerInfo?.customerNo || "");
        // Contracting party and partner name are the same field - use partnerName
        const partnerValue = customerInfo?.partnerName || customerInfo?.contractingParty || "";
        setContractingParty(partnerValue);
        setPartnerName(partnerValue);
      } catch (error) {
        console.error("Error loading from localStorage:", error);
      }
    }, []);

    // Reload on OPE ID mismatch
    useEffect(() => {
      if (typeof window === "undefined") return;

      const urlOpeId = new URLSearchParams(window.location.search).get("opeId");

      if (urlOpeId && opeId && opeId !== urlOpeId && !sessionStorage.getItem("reloadedOnce")) {
        sessionStorage.setItem("reloadedOnce", "true");
        window.location.reload();
      }
    }, [opeId]);

    // Sync user from localStorage
    useEffect(() => {
      const syncUser = () => {
        try {
          const stored = JSON.parse(localStorage.getItem("user") || "{}");
          setUserId(stored?.id || 1);
          setUserNameDb(stored?.name || stored?.email || "User");
        } catch {
          setUserNameDb("User");
        }
      };
      syncUser();
      window.addEventListener("storage", syncUser);
      return () => window.removeEventListener("storage", syncUser);
    }, []);

    // Fetch data on mount
    useEffect(() => {
      fetchData();
    }, []);

    useEffect(() => {
    if (!opeId) return;

    const loadDraftForOpe = async () => {
      setLoading(true);
      try {
        const res = await apiFetch(`/drafts/${opeId}`);
        const draft = res?.draft;

        let pending = null;
        try { pending = JSON.parse(localStorage.getItem("pendingDraft") || "null"); } catch {}
        const source = draft || (pending && pending.opeId === opeId ? pending : null);

        if (source && source.content && Array.isArray(source.content.documentSections)) {
          const mergedSections = source.content.documentSections.map((sec) => ({
            id: sec.id,
            title: sec.title || "",
            description: sec.description || "",
            position: sec.position,
            modules: (sec.modules || []).map(m => {
              const full = modules.find(x => String(x.id) === String(m.id));
              return {
                id: m.id,
                name: m.name ?? full?.name ?? "",
                description: m.description ?? full?.description ?? "",
                canEdit: typeof full?.canEdit !== "undefined" ? full.canEdit : !!m.canEdit,
                sectionId: sec.id,
                position: full?.position ?? m.position
              };
            })
          }));

          setDocumentSections(mergedSections);
          setCustomerName(source.customerName || customerName);
          setPartnerName(source.partnerName || partnerName);
          setQuoteId(source.quoteId || null);

          const loadedSowType = source.sowType === 'SMALL' ? 'small' : 'full';
          setSowSize(loadedSowType);
          console.log("📂 Loaded draft for OPE", opeId, "| sowType =", loadedSowType);
          
            if (source.documentName) {
             setDocumentName(source.documentName);
           } else if (source.fileName) {
             setDocumentName(deriveBaseFromFileName(source.fileName));
           }
         else {
            // Ensure default is set if draft has no sowType
            setSowSize('full');
          }
          if (source.documentName) {
            setDocumentName(source.documentName);
          } else if (source.fileName) {
            setDocumentName(deriveBaseFromFileName(source.fileName));
          }
        }

        if (!draft && pending && pending.opeId === opeId) {
          try {
            await apiFetch("/drafts/autosave", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(pending)
            });
            localStorage.removeItem("pendingDraft");
          } catch (err) {
            console.warn("Failed to flush pendingDraft:", err);
          }
        }
      } catch (err) {
        console.warn("Failed to load draft for ope:", opeId, err);
      } finally {
        setLoading(false);
      }
    };

    loadDraftForOpe();
  }, [opeId, modules]);

      // ✅ Auto-format document name when customer info or OPE ID changes
    useEffect(() => {
      // Only auto-format if documentName is still the default value or starts with OPE ID
      if (!opeId || !customerName) return;
      
      // Check if current documentName is the default or already formatted with this OPE/customer combo
      const isDefault = documentName === "SoW Document";
      const startsWithCurrentOpe = documentName.startsWith(opeId);
      
      if (isDefault || startsWithCurrentOpe) {
        const formattedBase = contractingParty && contractingParty.trim()
          ? `${opeId} - HPE Nonstop PSD SOW to ${contractingParty} for ${customerName}`
          : `${opeId} - HPE Nonstop PSD SOW for ${customerName}`;
        
        if (documentName !== formattedBase) {
          console.log("📝 Auto-formatted documentName:", { from: documentName, to: formattedBase });
          setDocumentName(formattedBase);
        }
      }
    }, [opeId, customerName, contractingParty]);

    // Merge module metadata
    useEffect(() => {
      if (!Array.isArray(modules) || modules.length === 0) return;
      if (!Array.isArray(documentSections) || documentSections.length === 0) return;

      let changed = false;
      const merged = documentSections.map(sec => {
        const newMods = (sec.modules || []).map(m => {
          const full = modules.find(x => Number(x.id) === Number(m.id));
          if (!full) return m;
          const mergedModule = {
            ...m,
            name: full.name ?? m.name,
            canEdit: typeof full.canEdit !== "undefined" ? full.canEdit : m.canEdit
          };
          if (JSON.stringify(mergedModule) !== JSON.stringify(m)) changed = true;
          return mergedModule;
        });
        return { ...sec, modules: newMods };
      });
      if (changed) setDocumentSections(merged);
    }, [modules]);

    // Sort document sections by position
    useEffect(() => {
      if (!sections || sections.length === 0 || !documentSections) return;

         const usedSectionIds = new Set(documentSections.map(s => s.id));
      const filtered = sections.filter(s => !usedSectionIds.has(s.id));

      const sorted = sortDocumentSectionsByPosition(documentSections, sections);
      const withPos = sorted.map(s => {
        const existingPos = typeof s.position === "number" ? s.position : undefined;
       const sourcePos = filtered.find(sec => sec.id === s.id)?.position;
        const resolvedPos = typeof existingPos === "number" ? existingPos : (Number.isFinite(Number(sourcePos)) ? Number(sourcePos) : undefined);
        return { ...s, position: resolvedPos };
      });

      const same = withPos.length === documentSections.length && withPos.every((s, i) => s.id === documentSections[i].id && s.position === documentSections[i].position);
      if (!same) {
        setDocumentSections(withPos);
      }
    }, [sections, documentSections]);

    // Auto action handler
    useEffect(() => {
      try {
        const raw = sessionStorage.getItem("autoAction");
        if (raw) {
          pendingAutoActionRef.current = JSON.parse(raw);
          sessionStorage.removeItem("autoAction");
        }
      } catch (e) {
        pendingAutoActionRef.current = null;
      }
    }, []);

    useEffect(() => {
      if (!pendingAutoActionRef.current) return;
      if (loading) return;

      const t = setTimeout(async () => {
        const { action } = pendingAutoActionRef.current || {};
        try {
          if (action === "preview") {
            await handlePreview();
          } else if (action === "openGenerateModal") {
            setShowGenerateModal(true);
          }
        } catch (err) {
          console.warn("autoAction failed:", err);
        } finally {
          pendingAutoActionRef.current = null;
        }
      }, 500);

      return () => clearTimeout(t);
    }, [loading, documentSections]);

    // Helper functions
    const stripHtml = (html: string) => {
      const temp = document.createElement("div");
      temp.innerHTML = html;
      return temp.textContent || temp.innerText || "";
    };
    const deriveBaseFromFileName = (fn?: string) => {
    if (!fn) return "";
    return fn.replace(/\.[^.]+$/, "");
    };

    // Ensure editor images with src="/uploads/..." become absolute so ReadOnlyModal can load them
    const expandImageUrls = (html = "") => {
      if (!html) return html;
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || (typeof window !== "undefined" ? window.location.origin : "");
        const baseUrl = apiUrl.replace(/\/api\/?$/i, "");
        return html.replace(/src="\/uploads/gi, `src="${baseUrl}/uploads`);
      } catch {
        return html;
      }
    };

       const fetchCustomerDetails = async () => {
      if (!customerNo) {
        // clear name and any customerNo error when input is empty
        setCustomerName("");
        setErrors(prev => {
          const { customerNo: _ignored, ...rest } = prev;
          return rest;
        });
        return;
      }
      
      try {
        const data = await apiFetch(`/customer/${customerNo}`);
        if (data.success && data.customer) {
          setCustomerName(data.customer.customerName);
          setErrors(prev => {
            const { customerNo: _ignored, ...rest } = prev;
            return rest;
          });
        } else {
          setCustomerName("");
          setErrors(prev => ({
            ...prev,
            customerNo: "Customer not found"
          }));
        }
      } catch (err) {
        console.error("Error fetching customer:", err);
        setCustomerName("");
        setErrors(prev => ({
          ...prev,
          customerNo: "Failed to fetch customer details"
        }));
      }
    };

        // Sync customer info to localStorage whenever it changes
    useEffect(() => {
      if (typeof window === "undefined") return;
      if (!customerName && !customerNo && !contractingParty && !partnerName) return;
      
      try {
        const customerInfo = {
          customerName,
          customerNo,
          partnerName: contractingParty || partnerName,
          contractingParty: contractingParty || partnerName,
        };
        console.log("💾 Syncing customer info to localStorage:", customerInfo);
        localStorage.setItem("customerInfo", JSON.stringify(customerInfo));
      } catch (error) {
        console.error("Error syncing to localStorage:", error);
      }
    }, [customerName, customerNo, contractingParty, partnerName]);

    // Debounce customerNo changes so API is called automatically while typing
    useEffect(() => {
      if (customerNoDebounceRef.current) clearTimeout(customerNoDebounceRef.current);
      customerNoDebounceRef.current = setTimeout(() => {
        fetchCustomerDetails().catch(err => console.warn('Debounced fetchCustomerDetails failed:', err));
      }, 600);
      return () => {
        if (customerNoDebounceRef.current) clearTimeout(customerNoDebounceRef.current);
      };
    }, [customerNo]);

    // Always ask for confirmation when switching SoW. When confirmed clear the builder and persist
    // the empty sections + sowType. Roll back UI if server save fails.
    const handleSowTypeChange = (newType: 'full' | 'small') => {
      if (newType === sowSize) return;
      setPendingSowType(newType);
      setShowSowTypeWarning(true);
    };

        // allow explicitSowType to override the current state sowSize (for confirmSowTypeChange)
    const autoSaveDraft = async (newDocumentSections = documentSections, explicitSowType = null) => {
   if (isSaving || autoSaveInProgress) {
      console.debug("autoSaveDraft: already in progress, skipping");
      return;
    }
      setIsSaving(true);
      setAutoSaveInProgress(true);
      try {
        // normalize sections payload
        const normalizedSections = (newDocumentSections || []).map(section => ({
          id: section.id,
          title: section.title || "",
          description: section.description || "",
          modules: (section.modules || []).map(module => ({
            id: module.id,
            name: module.name || "",
            // ensure nested lists are normalized and sanitize line breaks/spans before persisting
            description: sanitizeDescription(normalizeInlineLists(module.description || "")),
            sectionId: section.id
          }))
        }));

        // fallback to localStorage values if state not yet populated
        const storedUser = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("user") || "{}") : {};
        const storedOpe = typeof window !== "undefined" ? (localStorage.getItem("currentOpeId") || "") : "";
        const effectiveUserId = userId || storedUser?.id || null;
        const effectiveOpeId = opeId || storedOpe || null;

        const draftData = {
          opeId: effectiveOpeId,
          userId: effectiveUserId,
          customerName,
          customerNo,
          contractingParty: contractingParty || null,
          partnerName: contractingParty || null,
          documentName,
          quoteId: quoteId || null,
          content: { documentSections: normalizedSections },
          // use explicitSowType if provided (from confirmSowTypeChange), else use current sowSize
          sowType: explicitSowType ? (explicitSowType === 'small' ? 'SMALL' : 'FULL') : (sowSize === 'small' ? 'SMALL' : 'FULL'),
          status: "draft",
          version: version || 1
        };

        console.debug("autoSaveDraft -> draftData:", draftData);

        // If no OPE yet, persist locally and skip server call (will be saved when user assigns OPE)
        if (!effectiveOpeId || !effectiveUserId) {
          console.debug("autoSaveDraft: missing opeId/userId — saving pending draft to localStorage");
          localStorage.setItem("pendingDraft", JSON.stringify(draftData));
          showToast("Draft saved locally (assign OPE to persist)");
          setIsSaving(false);
          return { success: false, reason: "no-ope-or-user", savedLocally: true };
        }

        const res = await apiFetch("/drafts/autosave", {
          method: "PUT",
          body: JSON.stringify(draftData),
          headers: { "Content-Type": "application/json" }
        });

        console.debug("autoSaveDraft -> server response:", res);

        // update version/state if backend returned the draft
        if (res && res.success && res.draft) {
          setVersion(res.draft.version || version);
          // clear any pending local draft for this OPE
          try { localStorage.removeItem("pendingDraft"); } catch {}
          if (res.draft.documentName) {
          setDocumentName(res.draft.documentName);
        } else if (res.draft.fileName) {
          setDocumentName(deriveBaseFromFileName(res.draft.fileName));
        }

          setIsSaving(false);
          setAutoSaveInProgress(false);
          return res;
        } else {
          console.warn("autoSaveDraft: server responded but did not return saved draft", res);
          setIsSaving(false);
          setAutoSaveInProgress(false);
          return res;
        }

      } catch (error) {
        console.error('Auto-save failed:', error);
        showToast("Failed to auto-save draft");
        setIsSaving(false);
        setAutoSaveInProgress(false);
        return { success: false, error: (error && error.message) || error };
      }
    };

       const debouncedAutoSave = (sections: any[], sowType: any = null) => {
      if (autoSaveDebounceRef.current) clearTimeout(autoSaveDebounceRef.current);
      autoSaveDebounceRef.current = setTimeout(() => {
        autoSaveDraft(sections, sowType).catch(err => console.error("Debounced autosave failed:", err));
      }, 600);
    };

    // Cleanup debounce on unmount
    useEffect(() => {
      return () => {
        if (autoSaveDebounceRef.current) clearTimeout(autoSaveDebounceRef.current);
      };
    }, []);

    const confirmSowTypeChange = async () => {
      if (!pendingSowType) return;

      const prevSections = documentSections;
      const originalSow = sowSize;
      try {
        // Optimistically clear UI
        setDocumentSections([]);
        setSowSize(pendingSowType);

        // Persist empty builder + new sowType. autoSaveDraft will include sowType in payload.
        const res = await autoSaveDraft([], pendingSowType);
        if (!res || (typeof res === "object" && res.success === false)) {
          throw new Error("Autosave failed");
        }

        // Refresh available lists so removed sections reappear
        await refreshSourceLists();
        showToast(`Switched to ${pendingSowType === 'full' ? 'Full' : 'Short'} SoW`);
      } catch (error) {
        // Rollback UI on failure
        setDocumentSections(prevSections);
        setSowSize(originalSow);
        console.error("Error changing SoW type:", error);
        showToast("Failed to change SoW type. Changes reverted.");
      } finally {
        setShowSowTypeWarning(false);
        setPendingSowType(null);
      }
    };

    const toggleSection = (sectionId: number) => {
      setExpandedSections(prev =>
        prev.includes(sectionId)
          ? prev.filter(id => id !== sectionId)
          : [...prev, sectionId]
      );
    };

    const handleDragStart = (event: React.DragEvent, item: DragItem) => {
      event.dataTransfer.setData('text/plain', JSON.stringify(item));
    };
    
    // Module drag/reorder handlers (within same section only)
    const onModuleDragStart = (e: React.DragEvent, moduleId: number, sectionId: number, index: number) => {
      const payload = { type: 'MODULE', data: { moduleId, sectionId, index } };
      e.dataTransfer.setData('text/plain', JSON.stringify(payload));
      e.dataTransfer.effectAllowed = 'move';
      dragSourceRef.current = { sectionId, index };
    };

    const onModuleDragEnd = () => {
      setDragOver({ sectionId: null, index: null, position: null });
      dragSourceRef.current = null;
    };

       const handleDragEnd = (e: React.DragEvent) => {
     e.preventDefault?.();
     // reuse existing cleanup logic
     try { onModuleDragEnd(); } catch (_) { 
       // fallback: best-effort cleanup if onModuleDragEnd not available
       try { setDragOver({ sectionId: null, index: null, position: null }); } catch {}
       try { if (dragSourceRef) dragSourceRef.current = null; } catch {}
     }
   };

    // Determine before/after by mouse Y position relative to target element
    const onModuleDragEnter = (e: React.DragEvent, sectionId: number, index: number) => {
      e.preventDefault();
      const el = e.currentTarget as HTMLElement;
      const rect = el.getBoundingClientRect();
      const offsetY = e.clientY - rect.top;
      const position = offsetY > rect.height / 2 ? "after" : "before";
      setDragOver({ sectionId, index, position });
    };

    const onModuleDragLeave = (e: React.DragEvent, sectionId: number, index: number) => {
      // clear only if leaving the current hovered target
      const el = e.currentTarget as HTMLElement;
      const related = e.nativeEvent as DragEvent;
      // small debounce: if cursor left element completely, clear
      setTimeout(() => {
        if (!document.elementFromPoint((related as any).clientX || 0, (related as any).clientY || 0)?.contains(el)) {
          setDragOver(prev => (prev.sectionId === sectionId && prev.index === index ? { sectionId: null, index: null, position: null } : prev));
        }
      }, 10);
    };

    const onModuleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    };

    const onModuleDrop = async (e: React.DragEvent, targetSectionId: number, targetIndex: number) => {
      e.preventDefault();
      try {
        const raw = e.dataTransfer.getData('text/plain') || '{}';
        const parsed = JSON.parse(raw);
        if (!parsed || parsed.type !== 'MODULE' || !parsed.data) return;
        const { moduleId, sectionId: sourceSectionId, index: sourceIndex } = parsed.data;

        // Only allow reorder within same section
        if (Number(sourceSectionId) !== Number(targetSectionId)) return;

        // produce updated sections array and persist it immediately
         let updatedForSave: any[] | null = null;
        setDocumentSections(prev => {
          const updated = prev.map(section => {
            if (section.id !== Number(sourceSectionId)) return section;
            const mods = Array.isArray(section.modules) ? [...section.modules] : [];
            const src = Number(sourceIndex);
            const tgt = Number(targetIndex);
            // If src equals tgt (dropping onto itself), do nothing
            if (src === tgt || src === tgt - 1) return section;

            // remove the moved item
            const [moved] = mods.splice(src, 1);
            if (!moved) return section;

            // compute insert index after removal:
            // - if source was before target, after removal the target index shifts left by 1
            // - we want to insert at the position of the target item (i.e. before it)
            let insertAt = tgt;
            if (src < tgt) insertAt = Math.max(0, tgt - 1);
            if (insertAt > mods.length) insertAt = mods.length;

            mods.splice(insertAt, 0, moved);
            return { ...section, modules: mods };
          });

          // persist the updated documentSections (pass exact array)
           updatedForSave = updated;
           return updated;
        });

       if (updatedForSave) {
          await new Promise(resolve => setTimeout(resolve, 50));
          const saveRes = await autoSaveDraft(updatedForSave);
          if (!saveRes || !saveRes.success) {
            console.warn("Module reorder save failed, changes may not persist on reload");
            showToast("Warning: module order may not be saved");
          }
        }
       } catch (err) {
        console.warn('onModuleDrop parse failed:', err);
      }
    };

    const fetchData = async () => {
      setLoading(true);
      try {
        const [sectionsRes, modulesRes] = await Promise.all([
          apiFetch('/sections/all'),
          apiFetch('/modules'),
        ]);

        const normalizedModules = (modulesRes || []).map(m => ({
          ...m,
          sectionId: m.sectionId || m.section_id,
          position: Number.isFinite(Number(m.position)) ? Number(m.position) : (Number.isFinite(Number(m.sortOrder)) ? Number(m.sortOrder) : undefined)
        }));

        const normalizedSections = (sectionsRes || []).map((section, idx) => {
          const p = Number(section.position ?? section.sortOrder);
          return {
            ...section,
            position: Number.isFinite(p) ? p : idx,
            modules: normalizedModules.filter(module => module.sectionId === section.id)
          };
        }).sort((a, b) => (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER));

        setSections(normalizedSections);
        setModules(normalizedModules);
      } catch (error) {
        showToast("Failed to load sections and modules");
      }
      setLoading(false);
    };

    const refreshSourceLists = async () => {
      try {
        const [sectionsRes, modulesRes] = await Promise.all([
          apiFetch("/sections/all"),
          apiFetch("/modules"),
        ]);

        const normalizedModules = (modulesRes || []).map((m) => ({
          ...m,
          sectionId: m.sectionId || m.section_id,
        }));

        const normalizedSections = (sectionsRes || []).map((s, idx) => {
          const p = Number(s.position);
          return {
            ...s,
            position: Number.isFinite(p) ? p : idx,
            modules: normalizedModules.filter((m) => m.sectionId === s.id),
          };
        }).sort((a, b) => (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER));

        setSections(normalizedSections);
        setModules(normalizedModules);
        return normalizedSections;
      } catch (err) {
        console.warn("Failed to refresh source lists:", err);
        return sections;
      }
    };

     const syncFromServer = async (opts: { refreshVersions?: boolean } = {}) => {
     // short delay to reduce race with DB commit on busy servers
     await new Promise(r => setTimeout(r, 150));
     try {
       await refreshSourceLists();

       if (opts.refreshVersions && opeId) {
         try {
           const d = await apiFetch(`/drafts?opeId=${opeId}&userId=${userId}`);
           const f = await apiFetch(`/finals?opeId=${opeId}&userId=${userId}`);
           setDraftVersions(d?.drafts || []);
           setFinalVersions(f?.finals || []);
         } catch (e) {
           console.warn("Failed to refresh versions:", e);
         }
       }

       // If we have an OPE, re-load the authoritative draft content so reloads reflect latest saved builder
       if (opeId) {
         try {
           const draftRes = await apiFetch(`/drafts/${opeId}`);
           const source = draftRes?.draft;
           if (source && source.content && Array.isArray(source.content.documentSections)) {
             // Merge module metadata similar to loadDraftForOpe so UI has full module info
             const mergedSections = source.content.documentSections.map((sec) => ({
               id: sec.id,
               title: sec.title || "",
               description: sec.description || "",
               position: sec.position,
               modules: (sec.modules || []).map(m => {
                 const full = modules.find(x => String(x.id) === String(m.id));
                 return {
                   id: m.id,
                   name: m.name ?? full?.name ?? "",
                   description: m.description ?? full?.description ?? "",
                   canEdit: typeof full?.canEdit !== "undefined" ? full.canEdit : !!m.canEdit,
                   sectionId: sec.id,
                   position: full?.position ?? m.position
                 };
               })
             }));
             setDocumentSections(mergedSections);
           }
         } catch (err) {
           console.warn("syncFromServer: failed to reload draft:", err);
         }
       }
     } catch (err) {
      console.warn("syncFromServer failed:", err);
     }
   };

  // Prevent accidental reload/close while an autosave/save is still in progress
 useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isSaving || autoSaveInProgress) {
        e.preventDefault();
        e.returnValue = ""; // required for Chrome to show prompt
        return "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isSaving, autoSaveInProgress]);

    const triggerReloadWithAction = (action: string, payload: any = null) => {
      try {
        sessionStorage.setItem("autoAction", JSON.stringify({ action, payload, ts: Date.now() }));
      } catch (e) {
        // noop
      }
      window.location.reload();
    };

    const handleDrop = async (event: React.DragEvent) => {
      event.preventDefault();
      if (autoSaveInProgress || isSaving) {
       console.warn("handleDrop: save already in progress, skipping");
       showToast("Please wait for previous save to complete");
       return;
     }
      const dragData = JSON.parse(event.dataTransfer.getData('text/plain'));

      if (dragData.type === 'SECTION') {
        const { section } = dragData.data;

        if (documentSections.some(s => s.id === section.id)) {
          showToast("Section already in document!");
          return;
        }

        const freshSections = await refreshSourceLists();

        const source = (freshSections || sections).find(s => s.id === section.id) || {};
        const newSection = {
          id: section.id,
          title: section.title,
          description: section.description,
          position: Number.isFinite(Number(source.position)) ? Number(source.position) : undefined,
          modules: (modules || []).filter(m => m.sectionId === section.id)
        };
        const updated = [...documentSections, newSection];
        const sorted = sortDocumentSectionsByPosition(updated, freshSections || sections);

       setDocumentSections(sorted);
       const saveRes = await autoSaveDraft(sorted); 

        if (!saveRes || !saveRes.success) {
          console.warn("Section drop save failed, rolling back");
          setDocumentSections(documentSections);
          setSections(sPrev => [...sPrev, { id: section.id, title: section.title, description: section.description }]);
          showToast("Failed to save section. Changes reverted.");
          return;
        }

        await syncFromServer({ refreshVersions: false });

        setSections(sPrev => sPrev.filter(s => s.id !== section.id));
        showToast("Section added to document!");
        return;
      }

      if (dragData.type === 'MODULE') {
        const { module, sectionId } = dragData.data;

        const freshSections2 = await refreshSourceLists();

        const sectionIndex = documentSections.findIndex(s => s.id === sectionId);
        if (sectionIndex === -1) {
          const sourceSection = (freshSections2 || sections).find(s => s.id === sectionId);
          if (sourceSection) {
            const newSection = {
              id: sourceSection.id,
              title: sourceSection.title,
              description: sourceSection.description,
              position: Number.isFinite(Number(sourceSection.position)) ? Number(sourceSection.position) : undefined,
              modules: [module]
            };
            const updated2 = [...documentSections, newSection];
            const sorted2 = sortDocumentSectionsByPosition(updated2, freshSections2 || sections);
           
           setDocumentSections(sorted2);
           const saveRes = await autoSaveDraft(sorted2);
            if (!saveRes || !saveRes.success) {
              console.warn("Module drop save failed, rolling back");
              setDocumentSections(documentSections);
              setModules(mPrev => [...mPrev, module]);
              showToast("Failed to save module. Changes reverted.");
             return;
           }

           setModules(mPrev => mPrev.filter(m => m.id !== module.id));
          }
        } else {
          const updatedSections = documentSections.map(section =>
            section.id === sectionId
              ? {
                  ...section,
                  modules: section.modules.some(m => m.id === module.id)
                    ? section.modules
                    : [...section.modules, module]
                }
              : section
          );
          const sortedUpdated = sortDocumentSectionsByPosition(updatedSections, freshSections2 || sections);
          setDocumentSections(sortedUpdated);

          const saveRes = await autoSaveDraft(sortedUpdated);
          if (!saveRes || !saveRes.success) {
            console.warn("Module add save failed, rolling back");
            setDocumentSections(documentSections);
          setModules(mPrev => [...mPrev, module]);
            showToast("Failed to save module. Changes reverted.");
            return;
          }
           setModules(mPrev => mPrev.filter(m => m.id !== module.id));
        }

        showToast("Module added to section!");
        return;
      }
    };

    // Normalize simple inline numbered/bulleted lines inside <li> into nested lists
    const normalizeInlineLists = (html = "") => {
      if (!html) return html;
      return html.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (match, inner) => {
        const text = inner.replace(/<\/div>/gi, '\n').replace(/<div[^>]*>/gi, '\n').replace(/<br\s*\/?>/gi, '\n');
        const lines = text.split(/\n/).map(s => s.trim()).filter(Boolean);
        if (lines.length < 2) return match;
        const listStart = lines.findIndex(l => /^(\d+[\.\)]\s+|[-*•]\s+)/.test(l));
        if (listStart === -1) return match;
        const prefixLines = lines.slice(0, listStart);
        const listLines = lines.slice(listStart);
        const isNumbered = /^\d+[\.\)]\s+/.test(listLines[0]);
        const nestedItems = listLines.map(l => `<li>${l.replace(/^(\d+[\.\)]\s+|[-*•]\s+)/, '')}</li>`).join('');
        const nestedHtml = `<${isNumbered ? 'ol' : 'ul'}>${nestedItems}</${isNumbered ? 'ol' : 'ul'}>`;
        const prefixHtml = (() => {
          const originalPrefixMatch = inner.split(/(<br\s*\/?>|\r\n|\n)/i).slice(0, prefixLines.length).join('');
          return prefixLines.length ? originalPrefixMatch || prefixLines.join('<br/>') : '';
        })();
        return `<li>${prefixHtml}${nestedHtml}</li>`;
      });
    };

    // Sanitize description HTML before sending: unwrap spans in <p>, collapse <br> to spaces inside paragraphs,
    // remove empty paragraphs and collapse whitespace. Preserve lists, tables, images.
    const sanitizeDescription = (html = "") => {
      if (!html) return "";
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(`<div id="root">${html}</div>`, "text/html");
        const root = doc.getElementById("root");

        if (!root) return html;

        // Process paragraphs: unwrap spans, preserve <br>, collapse whitespace
        root.querySelectorAll("p, div").forEach((node) => {
          // skip if node contains a list/table/img (we want to preserve those blocks)
          if (node.querySelector("ul, ol, table, img")) return;

          // unwrap span elements inside this node
          node.querySelectorAll("span").forEach(sp => {
            while (sp.firstChild) sp.parentNode.insertBefore(sp.firstChild, sp);
            sp.parentNode.removeChild(sp);
          });

          // Rebuild innerHTML preserving <br/> and inline tags, collapsing whitespace in text nodes
          const parts = [];
          node.childNodes.forEach(child => {
            if (child.nodeType === Node.ELEMENT_NODE) {
              const tag = (child as Element).tagName.toLowerCase();
              if (tag === "br") {
                parts.push("<br/>");
              } else {
                // preserve inline element outerHTML but normalize its internal whitespace
                const outer = (child as Element).outerHTML.replace(/\u00A0/g, " ").replace(/\s+/g, " ");
                parts.push(outer);
              }
            } else if (child.nodeType === Node.TEXT_NODE) {
              const txt = (child.textContent || "").replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();
              if (txt) parts.push(txt);
            }
          });

          const rebuilt = parts.join("").trim();
          if (!rebuilt) {
            node.remove();
          } else {
            node.innerHTML = rebuilt;
          }
        });

        // Serialize root, preserving lists/tables/images and paragraph innerHTML (which may include <br/>)
        let out = "";
        root.childNodes.forEach(child => {
          if (child.nodeType === Node.ELEMENT_NODE) {
            const el = child as Element;
            const tag = el.tagName.toLowerCase();
            if (["ul","ol","table","img","pre"].includes(tag)) {
              out += el.outerHTML;
            } else {
              // keep innerHTML (preserves <br/> and inline tags), normalize outer whitespace
              const inner = el.innerHTML.replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();
              if (inner) out += `<p>${inner}</p>`;
            }
          } else if (child.nodeType === Node.TEXT_NODE) {
            const t = (child.textContent || "").replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();
            if (t) out += `<p>${t}</p>`;
          }
        });

        return out;
      } catch (e) {
        // fallback: remove span wrappers but preserve <br> and collapse whitespace
        return html
          .replace(/<span[^>]*>/gi, "")
          .replace(/<\/span>/gi, "")
          .replace(/\u00A0/g, " ")
          .replace(/\s+/g, " ")
          .trim();
      }
    };

    const handleEditModule = (module: Module) => {
      setEditingModule(module);
      setEditedDescription(module.description);
      setEditedName(module.name || "");
    };

const handleSaveEdit = async () => {
  // ✅ Create the updated sections first
  const updatedSections = documentSections.map(section => ({
    ...section,
    modules: section.modules.map(m =>
      m.id === editingModule?.id
        ? { 
            ...m, 
            description: sanitizeDescription(normalizeInlineLists(editedDescription || "")), 
            name: editedName 
          }
        : m
    )
  }));
  
  try {
    // ✅ Save to backend FIRST
    const saveResult = await autoSaveDraft(updatedSections);
    
    if (saveResult && saveResult.success) {
      // ✅ Only update UI state AFTER successful save
      setDocumentSections(updatedSections);
      setEditingModule(null);
      setEditedDescription("");
      setEditedName("");
      showToast("Module updated successfully!");
    } else {
      showToast("Failed to save module changes");
    }
  } catch (error) {
    console.error("Error saving module edit:", error);
    showToast("Error saving module changes");
  }
};

    const handleReset = async () => {
      // keep UI immediate but persist server-side first
      const prevSections = documentSections;
      try {
        // optimistic UI change
        setDocumentSections([]);
        // call server reset endpoint (ensures server state becomes empty)
        const storedUser = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("user") || "{}") : {};
        const effectiveUserId = userId || storedUser?.id || null;
        const res = await apiFetch("/drafts/reset", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ opeId, userId: effectiveUserId }),
        });

        if (res && res.success) {
          // also update local sections list (move back available sections)
          setSections(prev => [
            ...prev,
            ...prevSections.map(section => ({
              id: section.id,
              title: section.title,
              description: section.description
            }))
          ]);
          showToast("Document reset and saved to server");
        } else {
          // rollback UI if server failed
          setDocumentSections(prevSections);
          console.warn("Reset: server returned failure:", res);
          showToast("Reset failed: draft could not be saved to server");
        }
      } catch (err) {
        // rollback UI on error
        setDocumentSections(prevSections);
        console.error("Reset: error calling reset endpoint:", err);
        showToast("Reset failed: network or server error");
      }
    };

    const showToast = (message: string) => {
      setToast(message);
      setTimeout(() => setToast(null), 2000);
    };

const handlePreview = async () => {
  setPreviewLoading(true);
  try {
    const payload = {
      customerName,
      customerEmail: "",
      customerAddress: "",
      contractingParty,
      partnerName,
      quoteId,
      documentTitle: documentName,
      sowType: sowSize === 'small' ? 'SMALL' : 'FULL',
      status: "draft",
      createdAtFormatted: formatDateOnly(new Date()), // ✅ Add this
      sections: documentSections.map(section => ({
        id: section.id,
        title: replaceTags(section.title, { customerName, partnerName, documentName, opeId }),
        description: replaceTags(section.description, { customerName, partnerName, documentName, opeId }),
      })),
      assigned: documentSections.reduce((acc, section) => {
        acc[section.id] = section.modules.map(module => ({
          id: module.id,
          name: replaceTags(module.name, { customerName, partnerName, documentName, opeId }),
          description: replaceTags(module.description, { customerName, partnerName, documentName, opeId }),
          sectionId: section.id,
        }));
        return acc;
      }, {})
    };

    const response = await apiFetch(`/generate-document/${opeId}?type=pdf`, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
      responseType: 'blob'
    });

    if (response && response.size > 0) {
      const pdfUrl = window.URL.createObjectURL(new Blob([response], { type: 'application/pdf' }));
      setPreviewPdfUrl(pdfUrl);
      setShowPreview(true);
    } else {
      setPreviewPdfUrl(null);
      showToast("Failed to generate PDF preview");
    }
  } catch (error) {
    setPreviewPdfUrl(null);
    showToast("Failed to generate PDF preview");
  }
  setPreviewLoading(false);
};

    const removeSection = async (sectionId: number) => {
      const removedSection = documentSections.find(section => section.id === sectionId);
      
      const updated = documentSections.filter(section => section.id !== sectionId);
      setDocumentSections(updated);
      
      // Wait for save to complete before showing toast
      await autoSaveDraft(updated);

      if (removedSection) {
        setSections(prev => {
          const filtered = prev.filter(s => s.id !== sectionId);
          return [...filtered, { ...removedSection }];
        });
      }
      showToast("Section removed from document!");
    };

    const removeModule = (moduleId: number, sectionId: number) => {
      // remove module from documentSections and persist the updated state
      setDocumentSections(prev => {
        const updated = prev.map(section => {
          if (section.id === sectionId) {
            return {
              ...section,
              modules: section.modules.filter(m => m.id !== moduleId)
            };
          }
          return section;
        });
        // persist immediately
        autoSaveDraft(updated);
        return updated;
      });

      const removedModule = documentSections
        .find(section => section.id === sectionId)
        ?.modules.find(m => m.id === moduleId);

      if (removedModule) {
        setSections(prev => {
          const sectionIndex = prev.findIndex(s => s.id === sectionId);
          if (sectionIndex !== -1) {
            const updatedSections = [...prev];
            if (!updatedSections[sectionIndex].modules) updatedSections[sectionIndex].modules = [];
            if (!updatedSections[sectionIndex].modules.some(m => m.id === moduleId)) {
              updatedSections[sectionIndex].modules.push(removedModule);
            }
            return updatedSections;
          } else {
            return [
              ...prev,
              {
                id: sectionId,
                title: documentSections.find(s => s.id === sectionId)?.title || "Section",
                modules: [removedModule]
              }
            ];
          }
        });
      }
      showToast("Module removed and available for reuse!");
    };

    const handleGenerate = async (type: string, status: 'draft' | 'final') => {
      try {
        setGenerating(true);
        showToast(`Generating ${status.toUpperCase()} document...`);

        let latestVersion = 0;
        const versionsRes = await apiFetch(status === 'final' ? `/finals?opeId=${opeId}&userId=${userId}` : `/drafts?opeId=${opeId}&userId=${userId}`);
        const existingVersions = status === 'final' ? versionsRes?.finals || [] : versionsRes?.drafts || [];
        if (existingVersions.length > 0) latestVersion = existingVersions[existingVersions.length - 1].version;

        const nextVersion = latestVersion + 1;

        // Build frontend filename to match backend naming:
        // "OPE-0909090099 - HPE Nonstop PSD SOW for HEWLETT PACKARD ENTERPRISE - NED_<status>_v<version>.<ext>"
        const idPart = opeId || `OPE-${Date.now()}`;
        const formattedBase = partnerName && partnerName.trim()
          ? `${idPart} - HPE Nonstop PSD SOW to ${partnerName} for ${customerName}_${status}_v${nextVersion}`
          : `${idPart} - HPE Nonstop PSD SOW for ${customerName}_${status}_v${nextVersion}`;
        const fileName = `${formattedBase}.${type}`;
        setDocumentName(formattedBase);
        // optional: if you want to show this generated name in the Document Name input uncomment below
        // setDocumentName(formattedBase);

        const payload = {
          customerName,
          customerEmail: "",
          customerAddress: "",
          partnerName,
          documentTitle: documentName,
          sowType: sowSize === 'small' ? 'SMALL' : 'FULL',
          status,
          docVersion: nextVersion,
          fileName,
          sections: documentSections.map(section => ({
            id: section.id,
            title: replaceTags(section.title, { customerName, partnerName, documentName, opeId }),
            description: replaceTags(section.description, { customerName, partnerName, documentName, opeId }),
          })),
          assigned: documentSections.reduce((acc, section) => {
            acc[section.id] = section.modules.map(module => ({
              id: module.id,
              name: replaceTags(module.name, { customerName, partnerName, documentName, opeId }),
              description: replaceTags(module.description, { customerName, partnerName, documentName, opeId }),
              sectionId: section.id,
            }));
            return acc;
          }, {})
        };

        const saveUrl = status === "final" ? "/finals" : "/drafts";
        const saveRes = await apiFetch(saveUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
                opeId,
                userId,
                customerName,
                partnerName,
                customerEmail: "",
                customerAddress: "",
                documentName,
                fileName,
                quoteId,
                content: { documentSections },
                sowType: sowSize === 'small' ? 'SMALL' : 'FULL',
                status
                  })
        });

        if (saveRes.success) {
          showToast(`${status.toUpperCase()} document saved successfully!`);
  
          if (status === 'draft') {
            setDraftVersions(prev => [...prev, saveRes.draft]);
          } else {
            setFinalVersions(prev => [...prev, saveRes.final]);
          }
          setDocumentSections([]);
          setDocumentName("SoW Document");
          // return sections to available pool
          await refreshSourceLists();
          showToast(`${status.toUpperCase()} document generated. Document builder reset.`);
        } else {
          showToast(`Failed to save ${status} document`);
        }

        setGenerating(false);
      } catch (error) {
        console.error(error);
        setGenerating(false);
        showToast(`Error generating ${status} document`);
      }
    };

    const handleConfirmOpeIdChange = async () => {
      const val = newOpeId.toUpperCase();

      let validated = val.startsWith("OPE-") ? val : "OPE-" + val.replace(/^OPE-?/i, "");
      const suffix = validated.slice(4);

      const isValidFormat = /^(\d{10}|HOLD\d{6}|EXCP\d{6})$/.test(suffix);

      if (!/^[A-Z0-9]*$/.test(suffix)) {
        showToast("Invalid OPE ID: Only uppercase letters and digits allowed after OPE-");
        return;
      }

      if (!isValidFormat) {
        showToast("OPE ID must be: OPE-1234567890, OPE-HOLD123456, or OPE-EXCP123456");
        return;
      }

      if (validated === opeId) {
        setIsEditingOpeId(false);
        return;
      }

      const confirmed = window.confirm(
        `Changing OPE ID from "${opeId}" to "${validated}" will create a new document version starting from 1. Proceed?`
      );
      if (!confirmed) return;

      try {
        setIsChangingOpeId(true);

        const response = await apiFetch("/drafts/update-ope", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            oldOpeId: opeId,
            newOpeId: validated,
            userId,
          }),
        });

        if (response.success) {
          setOpeId(validated);
          localStorage.setItem("currentOpeId", validated);
          showToast(response.message || "OPE ID updated successfully! Reloading draft...");

          const draftRes = await apiFetch(`/drafts/${validated}`);
          setDocumentSections(draftRes?.draft?.content?.documentSections || []);
          setVersion(1);
          setIsEditingOpeId(false);
        } else {
          showToast(response.error || response.message || "Failed to update OPE ID");
        }
      } catch (error: any) {
        console.error("Error updating OPE ID:", error);
        showToast(error.message || "Error updating OPE ID");
      } finally {
        setIsChangingOpeId(false);
      }
    };

    const replaceTags = (text: string, { customerName, partnerName, documentName, opeId }: any) => {
      if (!text) return "";
      const cust = customerName || "";
      const partner = partnerName || "";
      const partnerOrCustomer = partner ? partner : cust;
      return text
        .replace(/{{\s*customerName\s*}}/gi, cust)
        .replace(/{{\s*partnerName\s*}}/gi, partner)
        .replace(/{{\s*partnerOrCustomerName\s*}}/gi, partnerOrCustomer)
        .replace(/{{\s*documentName\s*}}/gi, documentName || "")
        .replace(/{{\s*opeId\s*}}/gi, opeId || "");
    };


    const handleSaveAndExit = async () => {
      try {
        await autoSaveDraft();
        window.history.back();
      } catch (error) {
        showToast("Failed to save draft");
        console.error(error);
      }
    };

      const handleDeleteDocument = async () => {
      if (!opeId) {
        showToast("No OPE ID to delete");
        return;
      }

      setIsDeleting(true);
      try {
        const res = await apiFetch(`/drafts/delete-all/${opeId}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" }
        });

        if (res && res.success) {
          showToast("Document and all versions deleted successfully!");
          // Redirect back to dashboard after deletion
          setTimeout(() => {
            window.history.back();
          }, 1500);
        } else {
          showToast("Failed to delete document");
        }
      } catch (error) {
        console.error("Error deleting document:", error);
        showToast("Failed to delete document");
      } finally {
        setIsDeleting(false);
        setShowDeleteConfirm(false);
      }
    };

    const sortDocumentSectionsByPosition = (docSections: DocumentSection[], sourceSections: Section[]) => {
      const pos = new Map(
        (sourceSections || []).map((s, i) => {
          const p = Number(s.position);
          return [s.id, Number.isFinite(p) ? p : i];
        })
      );
      const sorted = [...docSections].sort(
        (a, b) => (pos.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (pos.get(b.id) ?? Number.MAX_SAFE_INTEGER)
      );
      return sorted.map(s => ({
        ...s,
        position: pos.has(s.id) ? pos.get(s.id) : s.position
      }));
    };

    if (generating || previewLoading) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading document workspace...</p>
          </div>
        </div>
      );
    }

const formatDateOnly = (date = new Date()) => {
  const d = new Date(date);
  if (isNaN(d.getTime())) return new Date().toLocaleDateString();
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric"
  });
};

    const previewPayload = {
      customerName,
      customerEmail: "",
      customerAddress: "",
      partnerName,
      documentTitle: documentName,
      sowType: sowSize === 'small' ? 'SMALL' : 'FULL',
      createdAtFormatted: formatDateOnly(new Date()),
      sections: documentSections.map((section) => ({
        id: section.id,
        title: replaceTags(section.title, { customerName, partnerName, documentName, opeId }),
        description: replaceTags(section.description, { customerName, partnerName, documentName, opeId }),
      })),
      assigned: documentSections.reduce((acc, section) => {
        acc[section.id] = (section.modules || []).map((module) => ({
          id: module.id,
          name: replaceTags(module.name, { customerName, partnerName, documentName, opeId }),
          description: replaceTags(module.description, { customerName, partnerName, documentName, opeId }),
          sectionId: section.id,
        }));
        return acc;
      }, {}),
    };

    return (
      <div className="min-h-screen bg-gray-50 text-sm" onDragEnd={handleDragEnd}>
        <UserHeader username={username} />

        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="mb-3 p-3 bg-white rounded-xl shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-2">
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Document Name</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={documentName}
                    onChange={(e) => setDocumentName(e.target.value)}
                    onFocus={() => setDocumentNameFocused(true)}
                    onBlur={() => !isSavingDocumentName && setDocumentNameFocused(false)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {documentNameFocused && (
                    <button
                      onMouseDown={async () => {
                        setIsSavingDocumentName(true);
                        try {
                          const result = await autoSaveDraft(documentSections, null, true);
                          if (result && result.success) {
                            showToast("Document Name saved successfully!");
                          } else if (result && result.savedLocally) {
                            showToast("Document Name saved locally (assign OPE to persist)");
                          } else {
                            showToast("Failed to save document name");
                          }
                        } catch (error) {
                          console.error("Save error:", error);
                          showToast("Failed to save document name");
                        } finally {
                          setIsSavingDocumentName(false);
                          setDocumentNameFocused(false);
                        }
                      }}
                      disabled={isSavingDocumentName}
                      className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 whitespace-nowrap disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      {isSavingDocumentName ? "Saving..." : "Save"}
                    </button>
                  )}
                </div>
              </div>
              <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <span>Customer</span>
                  <span
                    className={`ml-2 text-xm font-small ${
                      errors?.customerNo ? "text-red-600" : "text-green-700"
                    }`}
                    title={errors?.customerNo ? errors.customerNo : customerName}
                  >
                    {errors?.customerNo ? errors.customerNo : (customerName || "")}
                  </span>
                </label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={customerNo}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '');
                        setCustomerNo(val);
                      }}
                      onFocus={() => setCustomerNoFocused(true)}
                      onBlur={async () => {
                        if (!isSavingCustomerNo) {
                          await fetchCustomerDetails();
                          setCustomerNoFocused(false);
                        }
                      }}
                      placeholder="Customer Number"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    {customerNoFocused && (
                      <button
                        onMouseDown={async () => {
                          setIsSavingCustomerNo(true);
                          try {
                            await fetchCustomerDetails();
                            const result = await autoSaveDraft(documentSections, null, true);
                            if (result && result.success) {
                              showToast("Customer saved successfully!");
                            } else if (result && result.savedLocally) {
                              showToast("Customer saved locally (assign OPE to persist)");
                            } else {
                              showToast("Failed to save customer");
                            }
                          } catch (error) {
                            console.error("Save error:", error);
                            showToast("Failed to save customer");
                          } finally {
                            setIsSavingCustomerNo(false);
                            setCustomerNoFocused(false);
                          }
                        }}
                        disabled={isSavingCustomerNo}
                        className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 whitespace-nowrap disabled:bg-gray-400 disabled:cursor-not-allowed flex-shrink-0"
                      >
                        {isSavingCustomerNo ? "Saving..." : "Save"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Contracting Party</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={contractingParty}
                    placeholder="Enter Contracting Party"
                    onChange={(e) => setContractingParty(e.target.value)}
                    onFocus={() => setContractingPartyFocused(true)}
                    onBlur={() => !isSavingContractingParty && setContractingPartyFocused(false)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {contractingPartyFocused && (
                    <button
                      onMouseDown={async () => {
                        setIsSavingContractingParty(true);
                        try {
                          const result = await autoSaveDraft(documentSections, null, true);
                          if (result && result.success) {
                            showToast("Contracting Party saved successfully!");
                          } else if (result && result.savedLocally) {
                            showToast("Contracting Party saved locally (assign OPE to persist)");
                          } else {
                            showToast("Failed to save contracting party");
                          }
                        } catch (error) {
                          console.error("Save error:", error);
                          showToast("Failed to save contracting party");
                        } finally {
                          setIsSavingContractingParty(false);
                          setContractingPartyFocused(false);
                        }
                      }}
                      disabled={isSavingContractingParty}
                      className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 whitespace-nowrap disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      {isSavingContractingParty ? "Saving..." : "Save"}
                    </button>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Quote ID</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={quoteId || ""}
                    placeholder="Enter Quote Id"
                    onChange={(e) => setQuoteId(e.target.value)}
                    onFocus={() => setQuoteIdFocused(true)}
                    onBlur={() => !isSavingQuoteId && setQuoteIdFocused(false)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {quoteIdFocused && (
                    <button
                      onMouseDown={async () => {
                        setIsSavingQuoteId(true);
                        try {
                          const result = await autoSaveDraft(documentSections, null, true);
                          if (result && result.success) {
                            showToast("Quote ID saved successfully!");
                          } else if (result && result.savedLocally) {
                            showToast("Quote ID saved locally (assign OPE to persist)");
                          } else {
                            showToast("Failed to save quote ID");
                          }
                        } catch (error) {
                          console.error("Save error:", error);
                          showToast("Failed to save quote ID");
                        } finally {
                          setIsSavingQuoteId(false);
                          setQuoteIdFocused(false);
                        }
                      }}
                      disabled={isSavingQuoteId}
                      className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 whitespace-nowrap disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      {isSavingQuoteId ? "Saving..." : "Save"}
                    </button>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">OPE ID</label>
                <div className="flex items-center gap-2">
                  {isEditingOpeId ? (
                    <>
                      <input
                        type="text"
                        value={newOpeId}
                        onChange={(e) => {
                          let val = e.target.value.toUpperCase();

                          if (!val.startsWith("OPE-")) {
                            val = "OPE-" + val.replace(/^OPE-?/i, "");
                          }

                          let suffix = val.slice(4);

                          if (!/^[A-Z0-9]*$/.test(suffix)) return;

                          if (/^\d+$/.test(suffix) && suffix.length > 10) return;

                          if (suffix.startsWith("HOLD")) {
                            const afterHold = suffix.slice(4);
                            if (!/^\d*$/.test(afterHold)) return;
                            if (afterHold.length > 6) return;
                          }

                          if (suffix.startsWith("EXCP")) {
                            const afterExcp = suffix.slice(4);
                            if (!/^\d*$/.test(afterExcp)) return;
                            if (afterExcp.length > 6) return;
                          }

                          setNewOpeId("OPE-" + suffix);

                          if (/^(\d{10}|HOLD\d{6}|EXCP\d{6})$/.test(suffix)) {
                            setErrors((prev: any) => {
                              const { opeId: _ignored, ...rest } = prev;
                              return rest;
                            });
                          } else {
                            setErrors((prev: any) => ({
                              ...prev,
                              opeId: "OPE ID must be: OPE-1234567890, OPE-HOLD123456, or OPE-EXCP123456",
                            }));
                          }
                        }}
                        className="px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        onClick={handleConfirmOpeIdChange}
                        className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setIsEditingOpeId(false)}
                        className=" cursor-pointer hover:bg-gray-200 rounded-lg"
                      >
                        <X className="h-4 w-4 text-red-500" />
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="px-4 py-2 bg-gray-50 border rounded-lg font-mono text-sm flex items-center justify-between w-full">
                        <span>{opeId}</span>
                        <button
                          onClick={() => setIsEditingOpeId(true)}
                          className="p-1 hover:bg-gray-200 rounded"
                          title="Edit OPE ID"
                          disabled={isSaving || isChangingOpeId}
                        >
                          <Pencil className="h-4 w-4 text-blue-500" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Left Sidebar */}
            <div ref={leftPaneRef} className="bg-white rounded-xl shadow-sm p-3">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">Available Modules</h2>
                <div className="flex items-center gap-4 text-sm">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="sowSize"
                        value="full"
                        checked={sowSize === 'full'}
                        onChange={() => handleSowTypeChange('full')}
                        className="w-4 h-4 accent-green-600"
                      />
                      <span className="text-gray-700">Full SoW</span>
                    </label>
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="sowSize"
                        value="small"
                        checked={sowSize === 'small'}
                        onChange={() => handleSowTypeChange('small')}
                        className="w-4 h-4 accent-green-600"
                      />
                      <span className="text-gray-700">Short SoW</span>
                    </label>
                </div>
              </div>
              <div className="space-y-2">
                {(() => {
                  const filtered = (sections || []).filter(s => sowSize === 'full' ? true : !!s.compact);
                  return (
                    <AvailableSection
                      sections={filtered.map(section => ({
                        ...section,
                        title: stripHtml(section.title) || stripHtml(section.description || "").split('\n')[0]
                      }))}
                      expandedSections={expandedSections}
                      toggleSection={toggleSection}
                      handleDragStart={handleDragStart}
                    />
                  );
                })()}
              </div>
            </div>

            {/* Document Builder */}
            <div
              ref={builderPaneRef}
              className="lg:col-span-2 bg-white rounded-xl shadow-sm p-3"
              style={{ minHeight: `${builderMinHeight}px`, transition: "min-height 160ms ease" }}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold">Document Builder</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowResetConfirm(true)}
                    className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                  >
                    <RotateCcw size={16} />
                    Reset
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                    title="Delete entire document and all versions"
                  >
                    <Trash size={16} />
                    Delete
                  </button>
                  <button
                    onClick={() => triggerReloadWithAction("preview")}
                    disabled={documentSections.length === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-green-800 text-white rounded-lg hover:bg-green-900 disabled:bg-gray-300"
                  >
                    <FileText size={16} />
                    Preview
                  </button>
                  <button
                    onClick={() => triggerReloadWithAction("openGenerateModal")}
                    disabled={documentSections.length === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
                  >
                    <FileText size={16} />
                    Generate
                  </button>
                  <button
                    onClick={handleSaveAndExit}
                    className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"
                  >
                    <Save size={16} />
                    Save & Exit
                  </button>
                </div>
              </div>

              <div
                className="min-h-[500px] border-2 border-dashed border-gray-200 rounded-lg p-4"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
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
                    {documentSections.map(section => (
                      <div key={section.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                              Pos: {typeof section.position === "number" ? section.position : (sections.find(s => s.id === section.id)?.position ?? 'N/A')}
                            </span>
                            <h3 className="font-medium">
                              {stripHtml(replaceTags(section.title || "", { customerName, partnerName, documentName, opeId }))}
                            </h3>
                          </div>
                          <button
                            onClick={() => removeSection(section.id)}
                            className="p-1 hover:bg-gray-200 rounded"
                            title="Remove Section"
                          >
                            <X className="h-4 w-4 text-red-500" />
                          </button>
                        </div>
                        {section.modules?.map((module, moduleIndex) => (
                          <div
                            key={module.id}
                            draggable
                            onDragStart={(e) => onModuleDragStart(e, module.id, section.id, moduleIndex)}
                            onDragEnd={onModuleDragEnd}
                            onDragEnter={(e) => onModuleDragEnter(e, section.id, moduleIndex)}
                            onDragOver={(e) => e.preventDefault()}
                            onDragLeave={(e) => onModuleDragLeave(e, section.id, moduleIndex)}
                            onDrop={(e) => onModuleDrop(e, section.id, moduleIndex)}
                            className={`flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-grab transition-transform ${
                              dragSourceRef.current?.index === moduleIndex && dragSourceRef.current?.sectionId === section.id ? "opacity-60 scale-95" : ""
                            }`}
                          >
                            {/* show BEFORE indicator */}
                            {dragOver.sectionId === section.id && dragOver.index === moduleIndex && dragOver.position === "before" && (
                              <div className="h-0.5 bg-blue-600 w-full absolute left-0 -translate-y-2" />
                            )}

                            <span className="truncate relative">
                                {stripHtml(replaceTags(module.name || "", { customerName, partnerName, documentName, opeId })) ||
                                  (stripHtml(replaceTags(module.description || "", { customerName, partnerName, documentName, opeId })).slice(0, 80) + "...")}
                            </span>
                          {/* show AFTER indicator */}
                        {dragOver.sectionId === section.id && dragOver.index === moduleIndex && dragOver.position === "after" && (
                            <div className="h-0.5 bg-blue-600 w-full absolute right-0 translate-y-2" />
                          )}
                            <div className="flex items-center gap-2">
                              {module.canEdit && (
                                <button
                                  onClick={() => handleEditModule(module)}
                                  className="p-1 hover:bg-gray-200 rounded"
                                  title="Edit module"
                                >
                                  <Pencil className="h-4 w-4 text-blue-500" />
                                </button>
                              )}
                              <button
                                onClick={() => removeModule(module.id, section.id)}
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
          </div>
        </div>

          {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/60 bg-opacity-30 z-50">
            <div className="bg-white p-6 rounded shadow-lg max-w-sm w-full">
              <h3 className="text-lg font-bold mb-4 text-red-600">Delete Document</h3>
              <p className="mb-2 text-gray-700"><strong>Warning:</strong> Deleting this document will not be restored.</p>
              <p className="mb-4 text-gray-700">This will permanently remove all the versions ({version || 1} version(s)) and all data related to OPE ID: <strong>{opeId}</strong>.</p>
              <div className="flex gap-2 justify-end">
                <button
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  onClick={handleDeleteDocument}
                  disabled={isDeleting}
                >
                  {isDeleting ? "Deleting..." : "Yes, Delete Everything"}
                </button>
                <button
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reset Confirmation Modal */}
        {showResetConfirm && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/60 bg-opacity-30 z-50">
            <div className="bg-white p-6 rounded shadow-lg max-w-sm w-full">
              <h3 className="text-lg font-bold mb-4">Reset Document</h3>
              <p className="mb-4">Are you sure you want to reset the document builder? This will remove all sections and modules from your document.</p>
              <div className="flex gap-2 justify-end">
                <button
                  className="px-4 py-2 bg-red-600 text-white rounded"
                  onClick={async () => {
                    await handleReset();
                    setShowResetConfirm(false);
                  }}
                >
                  Yes, Reset
                </button>
                <button
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded"
                  onClick={() => setShowResetConfirm(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Modal */} 
        <EditModal
          module={editingModule}
          name={editedName}
          description={editedDescription}
          onNameChange={setEditedName}
          onDescriptionChange={setEditedDescription}
          onSave={handleSaveEdit}
          onCancel={() => setEditingModule(null)}
        />

        {/* Read-only fullsize viewer for non-editable modules */}
        <ReadOnlyModal
          module={viewingModule}
          onClose={() => setViewingModule(null)}
          expandImageUrls={expandImageUrls}
        />

        {/* Generate Document Modal */}
        <GenerateDocumentModal
          isOpen={showGenerateModal}
          onGenerate={handleGenerate}
          onClose={() => setShowGenerateModal(false)}
          draftVersions={draftVersions}
          finalVersions={finalVersions}
          documentName={documentName}
          opeId={opeId}
          userNameDb={userNameDb}
          customerName={customerName}
          partnerName={partnerName}
          version={version}
          userEmail={userEmail}
        />

        {/* Preview Modal */}
        <DocxPreviewModal
          isOpen={showPreview}
          onClose={() => setShowPreview(false)}
          payload={previewPayload}
          opeId={opeId}
          showToast={showToast}
          pdfUrl={previewPdfUrl}
        />

        {/* Toast */}
        {toast && (
          <div className="fixed bottom-4 right-4 bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg z-50">
            {toast}
          </div>
        )}

        <SowTypeWarningModal
          isOpen={showSowTypeWarning}
          onConfirm={confirmSowTypeChange}
          onCancel={() => {
            setShowSowTypeWarning(false);
            setPendingSowType(null);
          }}
          fromType={sowSize}
          toType={pendingSowType || sowSize}
        />
      </div>
    );
  }