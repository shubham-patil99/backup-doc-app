// @ts-nocheck
"use client";

import React, { useEffect, useState, useRef } from "react";
import { Save, FileText, RotateCcw, X, Pencil, Trash } from "lucide-react";
import AvailableSection from "./components/AvailableSection";
import AvailableModule from "./components/AvailableModule";
import DocumentSection from "./components/DocumentSection";
import EditModal from "./components/EditModal";
import GenerateDocumentModal from "./components/GenerateDocumentModal";
import ReadOnlyModal from "./components/ReadOnlyModal";
import useDragDrop from "./hooks/useDragDrop";
import { apiFetch } from "@/lib/apiClient";
import DocxPreviewModal from "./components/DocxPreviewModal";
import UserHeader from "@/components/UserHeader";
import SowTypeWarningModal from "./components/SowTypeWarningModal";


// ─── Types ───────────────────────────────────────────────────────────────────

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
  compact?: boolean;
  docType?: string;
}

interface DragItem {
  type: "SECTION" | "MODULE";
  data: { section?: Section; module?: Module; sectionId?: number };
}

interface DocumentSection extends Section {
  modules: Module[];
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CreateDocumentContent() {
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
  const [version, setVersion] = useState(0);

  // ── SoW type ─────────────────────────────────────────────────────────────────
  const [sowSize, setSowSize] = useState<"full" | "small" | "proposal">("full");
  const [showSowTypeWarning, setShowSowTypeWarning] = useState(false);
  const [pendingSowType, setPendingSowType] = useState<"full" | "small" | "proposal" | null>(null);

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
  const dataFetchedAfterLoadRef = useRef(false);  // ✅ Prevent infinite fetch loop

  // ─── Computed lists filtered by docType ─────────────────────────────────────

  const visibleSections = React.useMemo(
    () => sections.filter((s) => String(s.docType || "").toLowerCase() === sowSize.toLowerCase()),
    [sections, sowSize]
  );

  const visibleModules = React.useMemo(
    () =>
      modules.filter((m) => {
        const sec = sections.find((s) => Number(s.id) === Number(m.sectionId));
        return !!sec && String(sec.docType || "").toLowerCase() === sowSize.toLowerCase();
      }),
    [modules, sections, sowSize]
  );

  // ✅ Recompute sections with synced modules for each sowType
  // This ensures when sowSize changes, each section shows the correct modules
  const visibleSectionsWithModules = React.useMemo(
    () => visibleSections.map((section) => ({
      ...section,
      modules: visibleModules.filter((m) => m.sectionId === section.id),
    })),
    [visibleSections, visibleModules]
  );

  // ─── Helpers ────────────────────────────────────────────────────────────────

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2000);
  };

  const isElectronEnv = (): boolean =>
    typeof window !== "undefined" && !!(window as any).electronAPI?.isElectron;

  const blobToBase64 = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.onerror = () => reject(new Error("FileReader failed"));
      reader.readAsDataURL(blob);
    });

  const formatDateOnly = (date = new Date()) => {
    const d = new Date(date);
    if (isNaN(d.getTime())) return new Date().toLocaleDateString();
    return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  };

  const expandImageUrlsLocal = (html = "") => {
    if (!html) return html;
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || (typeof window !== "undefined" ? window.location.origin : "");
      const baseUrl = apiUrl.replace(/\/api\/?$/i, "");
      return html.replace(/src="\/uploads/gi, `src="${baseUrl}/uploads`);
    } catch {
      return html;
    }
  };

  /** Build a document name from SoW type, version, and status */
  const generateDocumentName = (
    type: "full" | "small" | "proposal",
    versionNumber: number,
    status: "draft" | "final"
  ) => {
    const idPart = opeId || `OPE-${Date.now()}`;
    const partnerPart = partnerName?.trim() ? ` to ${partnerName}` : "";
    const sowLabel = type === "proposal" ? "Proposal" : "SoW";
    return `${idPart} - HPE Nonstop ${sowLabel}${partnerPart} for ${customerName}_${status}_v${versionNumber}`;
  };

  const sortSectionsByPosition = (
    docSections: DocumentSection[],
    sourceSections: Section[]
  ) => {
    const pos = new Map(
      (sourceSections || []).map((s, i) => {
        const p = Number(s.position);
        return [s.id, Number.isFinite(p) ? p : i];
      })
    );
    return [...docSections]
      .sort((a, b) => (pos.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (pos.get(b.id) ?? Number.MAX_SAFE_INTEGER))
      .map((s) => ({ ...s, position: pos.has(s.id) ? pos.get(s.id) : s.position }));
  };

  const replaceTags = (text: string, vars: any) => {
    if (!text) return "";
    const cust = vars.customerName || "";
    const partner = vars.partnerName || "";
    return text
      .replace(/{{\s*customerName\s*}}/gi, cust)
      .replace(/{{\s*partnerName\s*}}/gi, partner)
      .replace(/{{\s*partnerOrCustomerName\s*}}/gi, partner || cust)
      .replace(/{{\s*documentName\s*}}/gi, vars.documentName || "")
      .replace(/{{\s*opeId\s*}}/gi, vars.opeId || "");
  };

  const stripHtmlLocal = (html: string) => {
    const temp = document.createElement("div");
    temp.innerHTML = html;
    return temp.textContent || temp.innerText || "";
  };

  const deriveBaseName = (fn?: string) => (fn ? fn.replace(/\.[^.]+$/, "") : "");

  const normalizeInlineLists = (html = "") => {
    if (!html) return html;
    return html.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (match, inner) => {
      const text = inner.replace(/<\/div>/gi, "\n").replace(/<div[^>]*>/gi, "\n").replace(/<br\s*\/?>/gi, "\n");
      const lines = text.split(/\n/).map((s: string) => s.trim()).filter(Boolean);
      if (lines.length < 2) return match;
      const listStart = lines.findIndex((l: string) => /^(\d+[\.\)]\s+|[-*\u2022]\s+)/.test(l));
      if (listStart === -1) return match;
      const prefixLines = lines.slice(0, listStart);
      const listLines = lines.slice(listStart);
      const isNumbered = /^\d+[\.\)]\s+/.test(listLines[0]);
      const nestedItems = listLines.map((l: string) => `<li>${l.replace(/^(\d+[\.\)]\s+|[-*\u2022]\s+)/, "")}</li>`).join("");
      const nestedHtml = `<${isNumbered ? "ol" : "ul"}>${nestedItems}</${isNumbered ? "ol" : "ul"}>`;
      const prefixHtml = prefixLines.length
        ? inner.split(/(<br\s*\/?>|\r\n|\n)/i).slice(0, prefixLines.length).join("") || prefixLines.join("<br/>")
        : "";
      return `<li>${prefixHtml}${nestedHtml}</li>`;
    });
  };

  const sanitizeDescription = (html = "") => {
    if (!html) return "";
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(`<div id="root">${html}</div>`, "text/html");
      const root = doc.getElementById("root");
      if (!root) return html;
      root.querySelectorAll("p, div").forEach((node) => {
        if (node.querySelector("ul, ol, table, img")) return;
        node.querySelectorAll("span").forEach((sp) => {
          while (sp.firstChild) sp.parentNode!.insertBefore(sp.firstChild, sp);
          sp.parentNode!.removeChild(sp);
        });
        const parts: string[] = [];
        node.childNodes.forEach((child) => {
          if (child.nodeType === Node.ELEMENT_NODE) {
            const tag = (child as Element).tagName.toLowerCase();
            if (tag === "br") parts.push("<br/>");
            else parts.push((child as Element).outerHTML.replace(/\u00A0/g, " ").replace(/\s+/g, " "));
          } else if (child.nodeType === Node.TEXT_NODE) {
            const txt = (child.textContent || "").replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();
            if (txt) parts.push(txt);
          }
        });
        const rebuilt = parts.join("").trim();
        if (!rebuilt) node.remove();
        else node.innerHTML = rebuilt;
      });
      let out = "";
      root.childNodes.forEach((child) => {
        if (child.nodeType === Node.ELEMENT_NODE) {
          const el = child as Element;
          const tag = el.tagName.toLowerCase();
          if (["ul", "ol", "table", "img", "pre"].includes(tag)) out += el.outerHTML;
          else {
            const inner = el.innerHTML.replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();
            if (inner) out += `<p>${inner}</p>`;
          }
        } else if (child.nodeType === Node.TEXT_NODE) {
          const t = (child.textContent || "").replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();
          if (t) out += `<p>${t}</p>`;
        }
      });
      return out;
    } catch {
      return html.replace(/<span[^>]*>/gi, "").replace(/<\/span>/gi, "").replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();
    }
  };

  const triggerReloadWithAction = (action: string, payload: any = null) => {
    try {
      sessionStorage.setItem("autoAction", JSON.stringify({ action, payload, ts: Date.now() }));
    } catch {}
    window.location.reload();
  };

  // ─── Effects ─────────────────────────────────────────────────────────────────

  /** Sync left pane height → builder min height */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const leftEl = leftPaneRef.current;
    if (!leftEl) return;
    const update = () => {
      const desired = Math.max(500, (leftEl.scrollHeight || leftEl.offsetHeight || 0) + 40);
      const cap = Math.max(window.innerHeight * 2, 2000);
      const target = Math.min(desired, cap);
      if (Math.abs((builderMinHeight || 0) - target) > 8) setBuilderMinHeight(target);
    };
    update();
    let ro: ResizeObserver | null = null;
    if ((window as any).ResizeObserver) { ro = new ResizeObserver(update); ro.observe(leftEl); }
    window.addEventListener("resize", update);
    return () => { ro?.disconnect(); window.removeEventListener("resize", update); };
  }, [sections, documentSections, builderMinHeight]);

  /** Init from localStorage */
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
      const partnerValue = customerInfo?.partnerName || customerInfo?.contractingParty || "";
      setContractingParty(partnerValue);
      setPartnerName(partnerValue);
    } catch (e) { console.error("localStorage init error:", e); }
  }, []);

  /** Reload if URL opeId mismatches state */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const urlOpeId = new URLSearchParams(window.location.search).get("opeId");
    if (urlOpeId && opeId && opeId !== urlOpeId && !sessionStorage.getItem("reloadedOnce")) {
      sessionStorage.setItem("reloadedOnce", "true");
      window.location.reload();
    }
  }, [opeId]);

  /** Sync user from storage events */
  useEffect(() => {
    const syncUser = () => {
      try {
        const stored = JSON.parse(localStorage.getItem("user") || "{}");
        setUserId(stored?.id || 1);
        setUserNameDb(stored?.name || stored?.email || "User");
      } catch { setUserNameDb("User"); }
    };
    syncUser();
    window.addEventListener("storage", syncUser);
    return () => window.removeEventListener("storage", syncUser);
  }, []);

  /** Fetch sections/modules on mount and when sowSize changes */
  /** But SKIP the initial call on first mount - wait for draft to load to get the actual sowType */
  useEffect(() => {
    if (!initialDraftLoadedRef.current) return;  // ✅ Skip initial call until draft is loaded
    dataFetchedAfterLoadRef.current = false;  // ✅ Allow data fetch after sowSize changes
    fetchData();
  }, [sowSize]);

  /** Load draft when opeId or modules change (skip during sow-type switch) */
  useEffect(() => {
    if (!opeId || sowTypeChangeInProgressRef.current) return;
    if (skipDraftReloadRef.current) {
      skipDraftReloadRef.current = false;
      return;
    }
    const loadDraftForOpe = async () => {
      setLoading(true);
      try {
        // ✅ Don't specify sowType on first load - get whatever was last saved
        // This ensures we load the ACTUAL saved sowType, not assume it based on current state
        const res = await apiFetch(`/drafts/${opeId}`);
        const draft = res?.draft;
        let pending = null;
        try { pending = JSON.parse(localStorage.getItem("pendingDraft") || "null"); } catch {}
        const source = draft || (pending && pending.opeId === opeId ? pending : null);

        if (source?.content && Array.isArray(source.content.documentSections)) {
          const mergedSections = source.content.documentSections.map((sec) => ({
            id: sec.id,
            title: sec.title || "",
            description: sec.description || "",
            position: sec.position,
            modules: (sec.modules || []).map((m) => {
              const full = modules.find((x) => String(x.id) === String(m.id));
              return {
                id: m.id,
                name: m.name ?? full?.name ?? "",
                description: m.description ?? full?.description ?? "",
                canEdit: typeof full?.canEdit !== "undefined" ? full.canEdit : !!m.canEdit,
                sectionId: sec.id,
                position: full?.position ?? m.position,
              };
            }),
          }));

          setDocumentSections(mergedSections);
          setCustomerName(source.customerName || customerName);
          setPartnerName(source.partnerName || partnerName);
          setQuoteId(source.quoteId || null);

          const loadedSowType =
            source.sowType === "SMALL" ? "small" : source.sowType === "PROPOSAL" ? "proposal" : "full";
          setSowSize(loadedSowType);

          if (source.documentName) setDocumentName(source.documentName);
          else if (source.fileName) setDocumentName(deriveBaseName(source.fileName));
        }

        if (!draft && pending && pending.opeId === opeId) {
          try {
            await apiFetch("/drafts/autosave", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(pending),
            });
            localStorage.removeItem("pendingDraft");
          } catch (err) { console.warn("Failed to flush pendingDraft:", err); }
        }
        
        // ✅ Mark initial draft load as complete 
        initialDraftLoadedRef.current = true;
        
        // ✅ If this is the initial load and sowSize won't change, fetch data now
        const fetchSowType =
          source?.sowType === "SMALL" ? "small" : source?.sowType === "PROPOSAL" ? "proposal" : "full";
        if (!dataFetchedAfterLoadRef.current) {
          dataFetchedAfterLoadRef.current = true;
          // Schedule fetch after state updates complete
          setTimeout(() => fetchData(fetchSowType), 0);
        }
      } catch (err) { console.warn("Failed to load draft:", opeId, err); }
      finally { setLoading(false); }
    };
    loadDraftForOpe();
  }, [opeId]);  // ✅ Removed modules - prevents infinite loop

  /** Auto-format document name when opeId / customerName / contractingParty changes */
  useEffect(() => {
    if (!opeId || !customerName) return;
    const isDefault = documentName === "SoW Document";
    const startsWithCurrentOpe = documentName.startsWith(opeId);
    if (isDefault || startsWithCurrentOpe) {
      const formattedBase = contractingParty?.trim()
        ? `${opeId} - HPE Nonstop PSD SOW to ${contractingParty} for ${customerName}`
        : `${opeId} - HPE Nonstop PSD SOW for ${customerName}`;
      if (documentName !== formattedBase) setDocumentName(formattedBase);
    }
  }, [opeId, customerName, contractingParty]);

  /** Merge module metadata into documentSections when modules list updates */
  useEffect(() => {
    if (!modules.length || !documentSections.length) return;
    let changed = false;
    const merged = documentSections.map((sec) => ({
      ...sec,
      modules: sec.modules.map((m) => {
        const full = modules.find((x) => Number(x.id) === Number(m.id));
        if (!full) return m;
        const mergedModule = {
          ...m,
          name: full.name ?? m.name,
          canEdit: typeof full.canEdit !== "undefined" ? full.canEdit : m.canEdit,
        };
        if (JSON.stringify(mergedModule) !== JSON.stringify(m)) changed = true;
        return mergedModule;
      }),
    }));
    if (changed) setDocumentSections(merged);
  }, [modules]);

  /** Sort document sections by position whenever source list changes */
  useEffect(() => {
    if (!sections.length || !documentSections.length) return;
    const sorted = sortSectionsByPosition(documentSections, sections);
    const same =
      sorted.length === documentSections.length &&
      sorted.every((s, i) => s.id === documentSections[i].id && s.position === documentSections[i].position);
    if (!same) setDocumentSections(sorted);
  }, [sections]);

  /** Auto-action from sessionStorage (e.g. preview/generate after reload) */
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("autoAction");
      if (raw) { pendingAutoActionRef.current = JSON.parse(raw); sessionStorage.removeItem("autoAction"); }
    } catch { pendingAutoActionRef.current = null; }
  }, []);

  useEffect(() => {
    if (!pendingAutoActionRef.current || loading) return;
    const t = setTimeout(async () => {
      const { action } = pendingAutoActionRef.current || {};
      try {
        if (action === "preview") await handlePreview();
        else if (action === "openGenerateModal") setShowGenerateModal(true);
      } catch (err) { console.warn("autoAction failed:", err); }
      finally { pendingAutoActionRef.current = null; }
    }, 500);
    return () => clearTimeout(t);
  }, [loading, documentSections]);

  /** Sync customerInfo to localStorage */
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!customerName && !customerNo && !contractingParty && !partnerName) return;
    try {
      localStorage.setItem("customerInfo", JSON.stringify({
        customerName, customerNo,
        partnerName: contractingParty || partnerName,
        contractingParty: contractingParty || partnerName,
      }));
    } catch (e) { console.error("localStorage sync error:", e); }
  }, [customerName, customerNo, contractingParty, partnerName]);

  /** Debounce customerNo → fetchCustomerDetails */
  useEffect(() => {
    if (customerNoDebounceRef.current) clearTimeout(customerNoDebounceRef.current);
    customerNoDebounceRef.current = setTimeout(() => {
      fetchCustomerDetails().catch((e) => console.warn("Debounced fetchCustomer failed:", e));
    }, 600);
    return () => { if (customerNoDebounceRef.current) clearTimeout(customerNoDebounceRef.current); };
  }, [customerNo]);

  /** Prevent accidental close while saving */
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isSaving || autoSaveInProgress) { e.preventDefault(); e.returnValue = ""; return ""; }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isSaving, autoSaveInProgress]);

  /** Cleanup debounce on unmount */
  useEffect(() => () => {
    if (autoSaveDebounceRef.current) clearTimeout(autoSaveDebounceRef.current);
  }, []);

  // ─── Data Fetching ───────────────────────────────────────────────────────────

  const fetchData = async (docType: string = sowSize) => {
    setLoading(true);
    try {
      const [sectionsRes, modulesRes] = await Promise.all([
        apiFetch(`/sections/all?docType=${docType}`),
        apiFetch("/modules"),
      ]);
      
      console.log(`[fetchData] docType=${docType}, sections returned:`, sectionsRes?.length || 0, "modules returned:", modulesRes?.length || 0);
      
      const normalizedModules = (modulesRes || []).map((m) => ({
        ...m,
        sectionId: m.sectionId || m.section_id,
        position: Number.isFinite(Number(m.position)) ? Number(m.position)
          : Number.isFinite(Number(m.sortOrder)) ? Number(m.sortOrder) : undefined,
      }));
      const normalizedSections = (sectionsRes || [])
        .map((s, idx) => {
          const p = Number(s.position ?? s.sortOrder);
          // ✅ Explicitly ensure docType is set (fallback to docType from query if missing)
          return { 
            ...s, 
            docType: s.docType || docType,  // Fallback to query param if field is missing
            position: Number.isFinite(p) ? p : idx, 
            modules: normalizedModules.filter((m) => m.sectionId === s.id) 
          };
        })
        .sort((a, b) => (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER));
      
      console.log(`[fetchData] normalized ${normalizedSections.length} sections`, normalizedSections);
      
      setSections(normalizedSections);
      setModules(normalizedModules);
    } catch {
      showToast("Failed to load sections and modules");
    }
    setLoading(false);
  };

  const refreshSourceLists = async (docType: string = sowSize) => {
    try {
      const [sectionsRes, modulesRes] = await Promise.all([
        apiFetch(`/sections/all?docType=${docType}`),
        apiFetch("/modules"),
      ]);
      const normalizedModules = (modulesRes || []).map((m) => ({ ...m, sectionId: m.sectionId || m.section_id }));
      const normalizedSections = (sectionsRes || [])
        .map((s, idx) => {
          const p = Number(s.position);
          // ✅ Explicitly ensure docType is set (fallback to docType from query if missing)
          return { 
            ...s, 
            docType: s.docType || docType,  // Fallback to query param if field is missing
            position: Number.isFinite(p) ? p : idx, 
            modules: normalizedModules.filter((m) => m.sectionId === s.id) 
          };
        })
        .sort((a, b) => (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER));
      setSections(normalizedSections);
      setModules(normalizedModules);
      return normalizedSections;
    } catch (err) {
      console.warn("Failed to refresh source lists:", err);
      return sections;
    }
  };

  const syncFromServer = async (opts: { refreshVersions?: boolean } = {}) => {
    await new Promise((r) => setTimeout(r, 150));
    try {
      await refreshSourceLists();
      if (opts.refreshVersions && opeId) {
        try {
          const [d, f] = await Promise.all([
            apiFetch(`/drafts?opeId=${opeId}&userId=${userId}`),
            apiFetch(`/finals?opeId=${opeId}&userId=${userId}`),
          ]);
          setDraftVersions(d?.drafts || []);
          setFinalVersions(f?.finals || []);
        } catch (e) { console.warn("Failed to refresh versions:", e); }
      }
      if (opeId) {
        try {
          // ✅ Don't specify sowType - fetch the actual saved draft
          const draftRes = await apiFetch(`/drafts/${opeId}`);
          const source = draftRes?.draft;
          if (source?.content && Array.isArray(source.content.documentSections)) {
            const mergedSections = source.content.documentSections.map((sec) => ({
              id: sec.id, title: sec.title || "", description: sec.description || "", position: sec.position,
              modules: (sec.modules || []).map((m) => {
                const full = modules.find((x) => String(x.id) === String(m.id));
                return {
                  id: m.id, name: m.name ?? full?.name ?? "", description: m.description ?? full?.description ?? "",
                  canEdit: typeof full?.canEdit !== "undefined" ? full.canEdit : !!m.canEdit,
                  sectionId: sec.id, position: full?.position ?? m.position,
                };
              }),
            }));
            setDocumentSections(mergedSections);
          }
        } catch (err) { console.warn("syncFromServer: failed to reload draft:", err); }
      }
    } catch (err) { console.warn("syncFromServer failed:", err); }
  };

  const fetchCustomerDetails = async () => {
    if (!customerNo) {
      setCustomerName("");
      setErrors((prev) => { const { customerNo: _, ...rest } = prev; return rest; });
      return;
    }
    try {
      const data = await apiFetch(`/customer/${customerNo}`);
      if (data.success && data.customer) {
        setCustomerName(data.customer.customerName);
        setErrors((prev) => { const { customerNo: _, ...rest } = prev; return rest; });
      } else {
        setCustomerName("");
        setErrors((prev) => ({ ...prev, customerNo: "Customer not found" }));
      }
    } catch {
      setCustomerName("");
      setErrors((prev) => ({ ...prev, customerNo: "Failed to fetch customer details" }));
    }
  };

  // ─── Auto Save ───────────────────────────────────────────────────────────────

  const autoSaveDraft = async (newDocumentSections = documentSections, explicitSowType = null) => {
    if (isSaving || autoSaveInProgress) { console.debug("autoSaveDraft: already in progress, skipping"); return; }
    setIsSaving(true);
    setAutoSaveInProgress(true);
    try {
      const normalizedSections = (newDocumentSections || []).map((section) => ({
        id: section.id,
        title: section.title || "",
        description: section.description || "",
        modules: (section.modules || []).map((module) => ({
          id: module.id,
          name: module.name || "",
          description: sanitizeDescription(normalizeInlineLists(module.description || "")),
          sectionId: section.id,
        })),
      }));

      const storedUser = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("user") || "{}") : {};
      const storedOpe = typeof window !== "undefined" ? (localStorage.getItem("currentOpeId") || "") : "";
      const effectiveUserId = userId || storedUser?.id || null;
      const effectiveOpeId = opeId || storedOpe || null;
      const effectiveSowType = explicitSowType || sowSize;

      const sowTypeStr =
        effectiveSowType === "small" ? "SMALL" : effectiveSowType === "proposal" ? "PROPOSAL" : "FULL";

      const draftData = {
        opeId: effectiveOpeId,
        userId: effectiveUserId,
        customerName,
        customerNo,
        contractingParty: contractingParty || null,
        partnerName: contractingParty || partnerName || null,
        documentName,
        quoteId: quoteId || null,
        content: { documentSections: normalizedSections },
        sowType: sowTypeStr,
        status: "draft",
        // ✅ Don't send version - backend finds and updates latest version
      };

      if (!effectiveOpeId || !effectiveUserId) {
        localStorage.setItem("pendingDraft", JSON.stringify(draftData));
        showToast("Draft saved locally (assign OPE to persist)");
        setIsSaving(false); setAutoSaveInProgress(false);
        return { success: false, reason: "no-ope-or-user", savedLocally: true };
      }

      const res = await apiFetch("/drafts/autosave", {
        method: "PUT",
        body: JSON.stringify(draftData),
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
    } catch (error) {
      console.error("Auto-save failed:", error);
      showToast("Failed to auto-save draft");
      setIsSaving(false); setAutoSaveInProgress(false);
      return { success: false, error: error?.message || error };
    }
  };

  const debouncedAutoSave = (secs: any[], sowType: any = null) => {
    if (autoSaveDebounceRef.current) clearTimeout(autoSaveDebounceRef.current);
    autoSaveDebounceRef.current = setTimeout(() => {
      autoSaveDraft(secs, sowType).catch((e) => console.error("Debounced autosave failed:", e));
    }, 600);
  };

  // ─── SoW Type ────────────────────────────────────────────────────────────────

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
      // Delete all records for old SoW type to start fresh
      const deleteRes = await apiFetch(`/drafts/delete-all/${opeId}/${oldSowType}`, {
        method: "DELETE"
      });
      
      if (!deleteRes.success) {
        showToast("Failed to clear previous SoW data");
        return;
      }
      
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
      return;
    } finally {
      sowTypeChangeInProgressRef.current = false;
    }
  };

  // ─── CRUD Actions ────────────────────────────────────────────────────────────

  const handleReset = async () => {
    const prevSections = documentSections;
    try {
      setDocumentSections([]);
      const storedUser = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("user") || "{}") : {};
      const effectiveUserId = userId || storedUser?.id || null;
      const res = await apiFetch("/drafts/reset", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opeId, userId: effectiveUserId }),
      });
      if (res?.success) {
        setSections((prev) => [...prev, ...prevSections.map(({ id, title, description }) => ({ id, title, description }))]);
        showToast("Document reset successfully");
      } else {
        setDocumentSections(prevSections);
        showToast("Reset failed: draft could not be saved to server");
      }
    } catch (err) {
      setDocumentSections(prevSections);
      showToast("Reset failed: network or server error");
    }
  };

  const handleDeleteDocument = async () => {
    if (!opeId) { showToast("No OPE ID to delete"); return; }
    setIsDeleting(true);
    try {
      const res = await apiFetch(`/drafts/delete-all/${opeId}`, { method: "DELETE", headers: { "Content-Type": "application/json" } });
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

  // ─── Module Edit ─────────────────────────────────────────────────────────────

  const handleEditModule = (module: Module) => {
    setEditingModule(module);
    setEditedDescription(module.description);
    setEditedName(module.name || "");
  };

  const handleSaveEdit = async () => {
    const updatedSections = documentSections.map((section) => ({
      ...section,
      modules: section.modules.map((m) =>
        m.id === editingModule?.id
          ? { ...m, description: sanitizeDescription(normalizeInlineLists(editedDescription || "")), name: editedName }
          : m
      ),
    }));
    try {
      const saveResult = await autoSaveDraft(updatedSections);
      if (saveResult?.success) {
        setDocumentSections(updatedSections);
        setEditingModule(null); setEditedDescription(""); setEditedName("");
        showToast("Module updated successfully!");
      } else { showToast("Failed to save module changes"); }
    } catch { showToast("Error saving module changes"); }
  };

  // ─── Remove Section / Module ─────────────────────────────────────────────────

  const removeSection = async (sectionId: number) => {
    const removedSection = documentSections.find((s) => s.id === sectionId);
    const updated = documentSections.filter((s) => s.id !== sectionId);
    setDocumentSections(updated);
    await autoSaveDraft(updated);
    if (removedSection) setSections((prev) => [...prev.filter((s) => s.id !== sectionId), { ...removedSection }]);
    showToast("Section removed from document!");
  };

  const removeModule = (moduleId: number, sectionId: number) => {
    setDocumentSections((prev) => {
      const updated = prev.map((section) =>
        section.id === sectionId
          ? { ...section, modules: section.modules.filter((m) => m.id !== moduleId) }
          : section
      );
      autoSaveDraft(updated);
      return updated;
    });
    showToast("Module removed from document!");
  };

  // ─── Preview ─────────────────────────────────────────────────────────────────

const handlePreview = async () => {
  setPreviewLoading(true);
  setPreviewFileType("pdf"); // default
  try {
    const vars = { customerName, partnerName, documentName, opeId };
    const isProposal = sowSize === "proposal";

    const payload = {
      customerName, customerEmail: "", customerAddress: "", contractingParty, partnerName,
      quoteId, documentTitle: documentName,
      sowType: sowSize === "small" ? "SMALL" : sowSize === "proposal" ? "PROPOSAL" : "FULL",
      status: "draft",
      createdAtFormatted: formatDateOnly(new Date()),
      sections: documentSections.map((s) => ({
        id: s.id,
        title: replaceTags(s.title, vars),
        description: replaceTags(s.description || "", vars),
      })),
      assigned: documentSections.reduce((acc, s) => {
        acc[s.id] = s.modules.map((m) => ({
          id: m.id,
          name: replaceTags(m.name, vars),
          description: replaceTags(m.description, vars),
          sectionId: s.id,
        }));
        return acc;
      }, {}),
    };

    if (isProposal) {
      // Proposal → backend converts PPTX to PDF for preview (when ?preview=true)
      const endpoint = `/proposal/${opeId}?preview=true`;
      try {
        const response = await apiFetch(endpoint, {
          method: "POST",
          body: JSON.stringify(payload),
          headers: { "Content-Type": "application/json" },
          responseType: "blob",
        });
        
        if (!response || response.size === 0) {
          console.warn("handlePreview: Empty or null proposal response from endpoint");
          showToast("Failed to generate proposal preview - empty response");
          return;
        }
        
        try {
          // Backend returns PDF for ?preview=true
          const pdfUrl = window.URL.createObjectURL(
            new Blob([response], { type: "application/pdf" })
          );
          setPreviewFileType("pdf");
          setPreviewPdfUrl(pdfUrl);
          setShowPreview(true);
        } catch (blobErr) {
          console.error("Failed to create PDF blob URL:", blobErr);
          showToast("Failed to create proposal preview URL");
        }
      } catch (fetchErr) {
        console.error("Failed to fetch proposal preview:", fetchErr);
        showToast("Failed to fetch proposal preview");
      }
    } else {
      // SoW/DOCX → backend returns DOCX, convert to PDF with TOC on Electron
      const endpoint = `/generate-document/${opeId}?type=docx&preview=true`;
      const response = await apiFetch(endpoint, {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
        responseType: "blob",
      });

      if (response && response.size > 0) {
        // ✅ Electron: convert DOCX → PDF with TOC for preview
        if (isElectronEnv() && (window as any).electronAPI?.processDOCXAndGeneratePDF) {
          try {
            const base64 = await blobToBase64(response);
            const fileName = `preview_${Date.now()}.docx`;
            const result = await (window as any).electronAPI.processDOCXAndGeneratePDF({
              base64,
              fileName,
            });

            if (result?.success && result.pdfPath) {
              const fileUrl = `file:///${result.pdfPath.replace(/\\/g, "/")}`;
              setPreviewFileType("pdf");
              setPreviewPdfUrl(fileUrl);
              setShowPreview(true);
            } else {
              // Fallback: display DOCX as blob if conversion fails
              const docxUrl = window.URL.createObjectURL(
                new Blob([response], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" })
              );
              setPreviewFileType("docx");
              setPreviewPdfUrl(docxUrl);
              setShowPreview(true);
              showToast("Preview: Showing DOCX (TOC conversion failed)");
            }
          } catch (electronErr) {
            // Fallback: display DOCX as blob if Electron API fails
            console.warn("Electron API error:", electronErr);
            const docxUrl = window.URL.createObjectURL(
              new Blob([response], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" })
            );
            setPreviewFileType("docx");
            setPreviewPdfUrl(docxUrl);
            setShowPreview(true);
            showToast("Preview: Showing DOCX (Electron unavailable)");
          }
        } else {
          // Non-Electron or API not available: display DOCX as blob
          const docxUrl = window.URL.createObjectURL(
            new Blob([response], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" })
          );
          setPreviewFileType("docx");
          setPreviewPdfUrl(docxUrl);
          setShowPreview(true);
        }
      } else {
        showToast("Failed to generate preview");
      }
    }
  } catch (error) {
    console.error("Preview error:", error);
    showToast("Failed to generate preview");
  }
  setPreviewLoading(false);
};
  // ─── Generate ────────────────────────────────────────────────────────────────

  const handleGenerate = async (type: string, status: "draft" | "final") => {
    try {
      setGenerating(true);
      showToast(`Generating ${status.toUpperCase()} document...`);
      const versionsRes = await apiFetch(
        status === "final" ? `/finals?opeId=${opeId}&userId=${userId}` : `/drafts?opeId=${opeId}&userId=${userId}`
      );
      const allVersions = (status === "final" ? versionsRes?.finals : versionsRes?.drafts) || [];
      // ✅ Only count generated versions (version > 0) for calculating nextVersion
      const generatedVersions = allVersions.filter((v) => (v.version || 0) > 0);
      const nextVersion = (generatedVersions.length > 0 ? generatedVersions[generatedVersions.length - 1].version : 0) + 1;

      const idPart = opeId || `OPE-${Date.now()}`;
      const formattedBase =
        sowSize === "proposal"
          ? `${idPart} - HPE Nonstop Proposal${partnerName ? ` to ${partnerName}` : ""} for ${customerName}_${status}_v${nextVersion}`
          : `${idPart} - HPE Nonstop SoW${partnerName ? ` to ${partnerName}` : ""} for ${customerName}_${status}_v${nextVersion}`;
      const fileExt = sowSize === "proposal" ? "pptx" : type;
      const fileName = `${formattedBase}.${fileExt}`;
      setDocumentName(formattedBase);

      const vars = { customerName, partnerName, documentName, opeId };
      const sowTypeStr = sowSize === "small" ? "SMALL" : sowSize === "proposal" ? "PROPOSAL" : "FULL";

      const saveUrl = status === "final" ? "/finals" : "/drafts";
      const saveRes = await apiFetch(saveUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          opeId, userId, customerName, customerNo, contractingParty, partnerName,
          customerEmail: "", customerAddress: "", documentName, fileName, quoteId,
          content: { documentSections }, sowType: sowTypeStr, status,
        }),
      });

      if (saveRes.success) {
        showToast(`${status.toUpperCase()} document saved successfully!`);
        if (status === "draft") setDraftVersions((prev) => [...prev, saveRes.draft]);
        else setFinalVersions((prev) => [...prev, saveRes.final]);
        setDocumentSections([]);
        setDocumentName("SoW Document");
        await refreshSourceLists();
        showToast(`${status.toUpperCase()} document generated. Builder reset.`);
      } else { showToast(`Failed to save ${status} document`); }
    } catch (error) {
      console.error(error);
      showToast(`Error generating ${status} document`);
    } finally { setGenerating(false); }
  };

  // ─── OPE ID Change ───────────────────────────────────────────────────────────

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
        body: JSON.stringify({ oldOpeId: opeId, newOpeId: validated, userId }),
      });
      if (response.success) {
        setOpeId(validated);
        localStorage.setItem("currentOpeId", validated);
        showToast(response.message || "OPE ID updated successfully!");
        // ✅ Don't specify sowType - fetch the actual saved draft for new OPE
        const draftRes = await apiFetch(`/drafts/${validated}`);
        if (draftRes?.draft) {
          setDocumentSections(draftRes.draft.content?.documentSections || []);
          setVersion(draftRes.draft.version || 0);
          // ✅ Update sowSize based on loaded draft's sowType
          const loadedSowType = 
            draftRes.draft.sowType === "SMALL" ? "small" : 
            draftRes.draft.sowType === "PROPOSAL" ? "proposal" : 
            "full";
          setSowSize(loadedSowType);
        }
        setIsEditingOpeId(false);
      } else { showToast(response.error || response.message || "Failed to update OPE ID"); }
    } catch (error: any) {
      showToast(error.message || "Error updating OPE ID");
    } finally { setIsChangingOpeId(false); }
  };

  // ─── Drag & Drop ─────────────────────────────────────────────────────────────

  const handleDragStart = (event: React.DragEvent, item: DragItem) => {
    event.dataTransfer.setData("text/plain", JSON.stringify(item));
  };

  const handleDragEnd = (e: React.DragEvent) => {
    e.preventDefault?.();
    try { onModuleDragEnd(); } catch {
      try { setDragOver({ sectionId: null, index: null, position: null }); } catch {}
      try { dragSourceRef.current = null; } catch {}
    }
  };

  const onModuleDragStart = (e: React.DragEvent, moduleId: number, sectionId: number, index: number) => {
    e.dataTransfer.setData("text/plain", JSON.stringify({ type: "MODULE", data: { moduleId, sectionId, index } }));
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
        setDragOver((prev) => prev.sectionId === sectionId && prev.index === index ? { sectionId: null, index: null, position: null } : prev);
    }, 10);
  };

  const onModuleDrop = async (e: React.DragEvent, targetSectionId: number, targetIndex: number) => {
    e.preventDefault();
    try {
      const parsed = JSON.parse(e.dataTransfer.getData("text/plain") || "{}");
      if (!parsed || parsed.type !== "MODULE" || !parsed.data) return;
      const { sectionId: sourceSectionId, index: sourceIndex } = parsed.data;
      if (Number(sourceSectionId) !== Number(targetSectionId)) return;

      let updatedForSave: any[] | null = null;
      setDocumentSections((prev) => {
        const updated = prev.map((section) => {
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
          return { ...section, modules: mods };
        });
        updatedForSave = updated;
        return updated;
      });
      if (updatedForSave) {
        await new Promise((r) => setTimeout(r, 50));
        const saveRes = await autoSaveDraft(updatedForSave);
        if (!saveRes?.success) showToast("Warning: module order may not be saved");
      }
    } catch (err) { console.warn("onModuleDrop parse failed:", err); }
  };

  const handleDrop = async (event: React.DragEvent) => {
    event.preventDefault();
    if (autoSaveInProgress || isSaving) { showToast("Please wait for previous save to complete"); return; }
    const dragData = JSON.parse(event.dataTransfer.getData("text/plain"));

    if (dragData.type === "SECTION") {
      const { section } = dragData.data;
      if (documentSections.some((s) => s.id === section.id)) { showToast("Section already in document!"); return; }
      const freshSections = await refreshSourceLists();
      const source = (freshSections || sections).find((s) => s.id === section.id) || {};
      const newSection = {
        id: section.id, title: section.title, description: section.description,
        position: Number.isFinite(Number(source.position)) ? Number(source.position) : undefined,
        modules: (modules || []).filter((m) => m.sectionId === section.id),
      };
      const sorted = sortSectionsByPosition([...documentSections, newSection], freshSections || sections);
      setDocumentSections(sorted);
      const saveRes = await autoSaveDraft(sorted);
      if (!saveRes?.success) {
        setDocumentSections(documentSections);
        setSections((prev) => [...prev, { id: section.id, title: section.title, description: section.description }]);
        showToast("Failed to save section. Changes reverted.");
        return;
      }
      await syncFromServer({ refreshVersions: false });
      setSections((prev) => prev.filter((s) => s.id !== section.id));
      showToast("Section added to document!");
      return;
    }

    if (dragData.type === "MODULE") {
      const { module, sectionId } = dragData.data;
      const freshSections2 = await refreshSourceLists();
      const sectionIndex = documentSections.findIndex((s) => s.id === sectionId);
      if (sectionIndex === -1) {
        const sourceSection = (freshSections2 || sections).find((s) => s.id === sectionId);
        if (sourceSection) {
          const sorted2 = sortSectionsByPosition(
            [...documentSections, { id: sourceSection.id, title: sourceSection.title, description: sourceSection.description, position: Number.isFinite(Number(sourceSection.position)) ? Number(sourceSection.position) : undefined, modules: [module] }],
            freshSections2 || sections
          );
          setDocumentSections(sorted2);
          const saveRes = await autoSaveDraft(sorted2);
          if (!saveRes?.success) { setDocumentSections(documentSections); setModules((p) => [...p, module]); showToast("Failed to save module. Changes reverted."); return; }
          setModules((p) => p.filter((m) => m.id !== module.id));
        }
      } else {
        const updatedSections = sortSectionsByPosition(
          documentSections.map((section) =>
            section.id === sectionId
              ? { ...section, modules: section.modules.some((m) => m.id === module.id) ? section.modules : [...section.modules, module] }
              : section
          ),
          freshSections2 || sections
        );
        setDocumentSections(updatedSections);
        const saveRes = await autoSaveDraft(updatedSections);
        if (!saveRes?.success) { setDocumentSections(documentSections); setModules((p) => [...p, module]); showToast("Failed to save module. Changes reverted."); return; }
        setModules((p) => p.filter((m) => m.id !== module.id));
      }
      showToast("Module added to section!");
    }
  };

  // ─── Preview payload ─────────────────────────────────────────────────────────

  const vars = { customerName, partnerName, documentName, opeId };
  const previewPayload = {
    customerName, customerEmail: "", customerAddress: "", contractingParty, partnerName,
    documentTitle: documentName,
    sowType: sowSize === "small" ? "SMALL" : sowSize === "proposal" ? "PROPOSAL" : "FULL",
    createdAtFormatted: formatDateOnly(new Date()),
    sections: documentSections.map((s) => ({ id: s.id, title: replaceTags(s.title, vars), description: replaceTags(s.description || "", vars) })),
    assigned: documentSections.reduce((acc, s) => {
      acc[s.id] = (s.modules || []).map((m) => ({ id: m.id, name: replaceTags(m.name, vars), description: replaceTags(m.description, vars), sectionId: s.id }));
      return acc;
    }, {}),
  };

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
    <div className="min-h-screen bg-gray-50 text-sm" onDragEnd={handleDragEnd}>
      <UserHeader username={username} />

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* ── Header Fields ── */}
        <div className="mb-3 p-3 bg-white rounded-xl shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-2">
            {/* Document Name */}
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Document Name</label>
              <div className="flex items-center gap-2">
                <input
                  type="text" value={documentName}
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
                        const result = await autoSaveDraft();
                        showToast(result?.success ? "Document Name saved!" : result?.savedLocally ? "Saved locally" : "Failed to save");
                      } catch { showToast("Failed to save document name"); }
                      finally { setIsSavingDocumentName(false); setDocumentNameFocused(false); }
                    }}
                    disabled={isSavingDocumentName}
                    className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 whitespace-nowrap disabled:bg-gray-400"
                  >
                    {isSavingDocumentName ? "Saving..." : "Save"}
                  </button>
                )}
              </div>
            </div>

            {/* Customer No */}
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <span>Customer</span>
                <span className={`ml-2 text-xm font-small ${errors?.customerNo ? "text-red-600" : "text-green-700"}`}>
                  {errors?.customerNo || customerName || ""}
                </span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text" value={customerNo}
                  onChange={(e) => setCustomerNo(e.target.value.replace(/\D/g, ""))}
                  onFocus={() => setCustomerNoFocused(true)}
                  onBlur={async () => { if (!isSavingCustomerNo) { await fetchCustomerDetails(); setCustomerNoFocused(false); } }}
                  placeholder="Customer Number"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {customerNoFocused && (
                  <button
                    onMouseDown={async () => {
                      setIsSavingCustomerNo(true);
                      try {
                        await fetchCustomerDetails();
                        const result = await autoSaveDraft();
                        showToast(result?.success ? "Customer saved!" : result?.savedLocally ? "Saved locally" : "Failed to save");
                      } catch { showToast("Failed to save customer"); }
                      finally { setIsSavingCustomerNo(false); setCustomerNoFocused(false); }
                    }}
                    disabled={isSavingCustomerNo}
                    className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 whitespace-nowrap disabled:bg-gray-400 flex-shrink-0"
                  >
                    {isSavingCustomerNo ? "Saving..." : "Save"}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Contracting Party */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Contracting Party</label>
              <div className="flex items-center gap-2">
                <input
                  type="text" value={contractingParty} placeholder="Enter Contracting Party"
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
                        const result = await autoSaveDraft();
                        showToast(result?.success ? "Contracting Party saved!" : result?.savedLocally ? "Saved locally" : "Failed to save");
                      } catch { showToast("Failed to save contracting party"); }
                      finally { setIsSavingContractingParty(false); setContractingPartyFocused(false); }
                    }}
                    disabled={isSavingContractingParty}
                    className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 whitespace-nowrap disabled:bg-gray-400"
                  >
                    {isSavingContractingParty ? "Saving..." : "Save"}
                  </button>
                )}
              </div>
            </div>

            {/* Quote ID */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Quote ID</label>
              <div className="flex items-center gap-2">
                <input
                  type="text" value={quoteId || ""} placeholder="Enter Quote Id"
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
                        const result = await autoSaveDraft();
                        showToast(result?.success ? "Quote ID saved!" : result?.savedLocally ? "Saved locally" : "Failed to save");
                      } catch { showToast("Failed to save quote ID"); }
                      finally { setIsSavingQuoteId(false); setQuoteIdFocused(false); }
                    }}
                    disabled={isSavingQuoteId}
                    className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 whitespace-nowrap disabled:bg-gray-400"
                  >
                    {isSavingQuoteId ? "Saving..." : "Save"}
                  </button>
                )}
              </div>
            </div>

            {/* OPE ID */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">OPE ID</label>
              <div className="flex items-center gap-2">
                {isEditingOpeId ? (
                  <>
                    <input
                      type="text" value={newOpeId}
                      onChange={(e) => {
                        let val = e.target.value.toUpperCase();
                        if (!val.startsWith("OPE-")) val = "OPE-" + val.replace(/^OPE-?/i, "");
                        const suffix = val.slice(4);
                        if (!/^[A-Z0-9]*$/.test(suffix)) return;
                        if (/^\d+$/.test(suffix) && suffix.length > 10) return;
                        if (suffix.startsWith("HOLD") && (!/^\d*$/.test(suffix.slice(4)) || suffix.slice(4).length > 6)) return;
                        if (suffix.startsWith("EXCP") && (!/^\d*$/.test(suffix.slice(4)) || suffix.slice(4).length > 6)) return;
                        setNewOpeId("OPE-" + suffix);
                        if (/^(\d{10}|HOLD\d{6}|EXCP\d{6})$/.test(suffix))
                          setErrors((prev: any) => { const { opeId: _, ...rest } = prev; return rest; });
                        else
                          setErrors((prev: any) => ({ ...prev, opeId: "OPE ID must be: OPE-1234567890, OPE-HOLD123456, or OPE-EXCP123456" }));
                      }}
                      className="px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500"
                    />
                    <button onClick={handleConfirmOpeIdChange} className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Save</button>
                    <button onClick={() => setIsEditingOpeId(false)} className="cursor-pointer hover:bg-gray-200 rounded-lg p-1">
                      <X className="h-4 w-4 text-red-500" />
                    </button>
                  </>
                ) : (
                  <div className="px-4 py-2 bg-gray-50 border rounded-lg font-mono text-sm flex items-center justify-between w-full">
                    <span>{opeId}</span>
                    <button onClick={() => setIsEditingOpeId(true)} className="p-1 hover:bg-gray-200 rounded" title="Edit OPE ID" disabled={isSaving || isChangingOpeId}>
                      <Pencil className="h-4 w-4 text-blue-500" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

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
                      onChange={() => handleSowTypeChange(type)}
                      className={`w-4 h-4 ${type === "proposal" ? "accent-blue-600" : "accent-green-600"}`}
                    />
                    <span className={type === "proposal" ? "text-blue-700 font-semibold" : "text-gray-700"}>
                      {type === "full" ? "Full SoW" : type === "small" ? "Short SoW" : "Proposal"}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <AvailableSection
                sections={visibleSectionsWithModules.map((section) => ({
                  ...section,
                  title: stripHtmlLocal(section.title) || stripHtmlLocal(section.description || "").split("\n")[0],
                }))}
                expandedSections={expandedSections}
                toggleSection={(id) => setExpandedSections((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])}
                handleDragStart={handleDragStart}
              />
            </div>
          </div>

          {/* ── Document Builder ── */}
          <div
            ref={builderPaneRef}
            className="lg:col-span-2 bg-white rounded-xl shadow-sm p-3"
            style={{ minHeight: `${builderMinHeight}px`, transition: "min-height 160ms ease" }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold">Document Builder</h2>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowResetConfirm(true)} className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                  <RotateCcw size={16} /> Reset
                </button>
                <button onClick={() => setShowDeleteConfirm(true)} className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg" title="Delete entire document and all versions">
                  <Trash size={16} /> Delete
                </button>
                <button onClick={() => triggerReloadWithAction("preview")} disabled={documentSections.length === 0} className="flex items-center gap-2 px-4 py-2 bg-green-800 text-white rounded-lg hover:bg-green-900 disabled:bg-gray-300">
                  <FileText size={16} /> Preview
                </button>
                <button onClick={() => triggerReloadWithAction("openGenerateModal")} disabled={documentSections.length === 0} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300">
                  <FileText size={16} /> Generate
                </button>
                <button onClick={handleSaveAndExit} className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600">
                  <Save size={16} /> Save & Exit
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
                  {documentSections.map((section) => (
                    <div key={section.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                            Pos: {typeof section.position === "number" ? section.position : (sections.find((s) => s.id === section.id)?.position ?? "N/A")}
                          </span>
                          <h3 className="font-medium">
                            {stripHtmlLocal(replaceTags(section.title || "", vars))}
                          </h3>
                        </div>
                        <button onClick={() => removeSection(section.id)} className="p-1 hover:bg-gray-200 rounded" title="Remove Section">
                          <X className="h-4 w-4 text-red-500" />
                        </button>
                      </div>
                      {section.modules?.map((module, moduleIndex) => (
                        <div
                          key={module.id} draggable
                          onDragStart={(e) => onModuleDragStart(e, module.id, section.id, moduleIndex)}
                          onDragEnd={onModuleDragEnd}
                          onDragEnter={(e) => onModuleDragEnter(e, section.id, moduleIndex)}
                          onDragOver={(e) => e.preventDefault()}
                          onDragLeave={(e) => onModuleDragLeave(e, section.id, moduleIndex)}
                          onDrop={(e) => onModuleDrop(e, section.id, moduleIndex)}
                          className={`flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-grab transition-transform relative ${
                            dragSourceRef.current?.index === moduleIndex && dragSourceRef.current?.sectionId === section.id ? "opacity-60 scale-95" : ""
                          }`}
                        >
                          {dragOver.sectionId === section.id && dragOver.index === moduleIndex && dragOver.position === "before" && (
                            <div className="h-0.5 bg-blue-600 w-full absolute left-0 -translate-y-2" />
                          )}
                          <span className="truncate relative">
                            {stripHtmlLocal(replaceTags(module.name || "", vars)) ||
                              (stripHtmlLocal(replaceTags(module.description || "", vars)).slice(0, 80) + "...")}
                          </span>
                          {dragOver.sectionId === section.id && dragOver.index === moduleIndex && dragOver.position === "after" && (
                            <div className="h-0.5 bg-blue-600 w-full absolute right-0 translate-y-2" />
                          )}
                          <div className="flex items-center gap-2">
                            {module.canEdit && (
                              <button onClick={() => handleEditModule(module)} className="p-1 hover:bg-gray-200 rounded" title="Edit module">
                                <Pencil className="h-4 w-4 text-blue-500" />
                              </button>
                            )}
                            <button onClick={() => removeModule(module.id, section.id)} className="p-1 hover:bg-gray-200 rounded">
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

      {/* ── Modals ── */}

      {showDeleteConfirm && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-50">
          <div className="bg-white p-6 rounded shadow-lg max-w-sm w-full">
            <h3 className="text-lg font-bold mb-4 text-red-600">Delete Document</h3>
            <p className="mb-2 text-gray-700"><strong>Warning:</strong> Deleting this document cannot be undone.</p>
            <p className="mb-4 text-gray-700">This will permanently remove all versions ({version || 1} version(s)) for OPE ID: <strong>{opeId}</strong>.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={handleDeleteDocument} disabled={isDeleting} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400">
                {isDeleting ? "Deleting..." : "Yes, Delete Everything"}
              </button>
              <button onClick={() => setShowDeleteConfirm(false)} disabled={isDeleting} className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showResetConfirm && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-50">
          <div className="bg-white p-6 rounded shadow-lg max-w-sm w-full">
            <h3 className="text-lg font-bold mb-4">Reset Document</h3>
            <p className="mb-4">Are you sure? This will remove all sections and modules from your document.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={async () => { await handleReset(); setShowResetConfirm(false); }} className="px-4 py-2 bg-red-600 text-white rounded">Yes, Reset</button>
              <button onClick={() => setShowResetConfirm(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded">Cancel</button>
            </div>
          </div>
        </div>
      )}

      <EditModal
        module={editingModule} name={editedName} description={editedDescription}
        onNameChange={setEditedName} onDescriptionChange={setEditedDescription}
        onSave={handleSaveEdit} onCancel={() => setEditingModule(null)}
      />

      <ReadOnlyModal module={viewingModule} onClose={() => setViewingModule(null)} expandImageUrls={expandImageUrlsLocal} />

      <GenerateDocumentModal
        isOpen={showGenerateModal} onGenerate={handleGenerate} onClose={() => setShowGenerateModal(false)}
        draftVersions={draftVersions} finalVersions={finalVersions}
        documentName={documentName} opeId={opeId} userNameDb={userNameDb}
        customerName={customerName} partnerName={partnerName} version={version} userEmail={userEmail}
        sowType={sowSize === "small" ? "SMALL" : sowSize === "proposal" ? "PROPOSAL" : "FULL"}
      />

      <DocxPreviewModal
        isOpen={showPreview} onClose={() => setShowPreview(false)}
        payload={previewPayload} opeId={opeId} showToast={showToast} pdfUrl={previewPdfUrl}
        fileType={previewFileType}
      />

      <SowTypeWarningModal
        isOpen={showSowTypeWarning} onConfirm={confirmSowTypeChange}
        onCancel={() => { setShowSowTypeWarning(false); setPendingSowType(null); }}
        fromType={sowSize} toType={pendingSowType || sowSize}
      />

      {toast && (
        <div className="fixed bottom-4 right-4 bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg z-50">{toast}</div>
      )}
    </div>
  );
}