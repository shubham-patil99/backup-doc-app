// @ts-nocheck
import { useEffect } from "react";
import { apiFetch } from "@/lib/apiClient";
import { sortSectionsByPosition, deriveBaseName } from "../utils/utils";

/**
 * All useEffect side-effects for CreateDocumentContent.
 * Receives all relevant state and setters from useCreateDocumentState.
 */
export function useCreateDocumentEffects(state: any, actions: any) {
  const {
    leftPaneRef,
    builderMinHeight, setBuilderMinHeight,
    sections, setSections,
    modules, setModules,
    documentSections, setDocumentSections,
    opeId, setOpeId,
    userId, setUserId,
    userNameDb, setUserNameDb,
    username, setUsername,
    userEmail, setUserEmail,
    customerNo, setCustomerNo,
    customerName, setCustomerName,
    contractingParty, setContractingParty,
    partnerName, setPartnerName,
    contractingPartyRef, partnerNameRef,
    isHydratedRef,
    customerNoInitialMount,
    customerNoDebounceRef,
    sowSize, setSowSize,
    documentName, setDocumentName,
    quoteId, setQuoteId,
    hpeLegalEntity, setHpeLegalEntity,
    version, setVersion,
    initialDraftLoadedRef,
    dataFetchedAfterLoadRef,
    skipDraftReloadRef,
    sowTypeChangeInProgressRef,
    autoSaveDebounceRef,
    isSaving,
    autoSaveInProgress,
    newOpeId, setNewOpeId,
    pendingAutoActionRef,
    loading,
    showSearch,
    setHighlightedSectionId,
    setHighlightedModuleId,
    draftVersions, setDraftVersions,
    finalVersions, setFinalVersions,
  } = state;

  const {
    fetchData,
    fetchCustomerDetails,
    autoSaveDraft,
    handlePreview,
    setShowGenerateModal,
  } = actions;

  // ── Sync left pane height → builder min height ───────────────────────────
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
    if ((window as any).ResizeObserver) {
      ro = new ResizeObserver(update);
      ro.observe(leftEl);
    }
    window.addEventListener("resize", update);
    return () => { ro?.disconnect(); window.removeEventListener("resize", update); };
  }, [sections, documentSections, builderMinHeight]);

  // ── Customer No debounce ─────────────────────────────────────────────────
  useEffect(() => {
    if (customerNoInitialMount.current) {
      customerNoInitialMount.current = false;
      return;
    }
    if (!customerNo) {
      setCustomerName("");
      state.setErrors((prev: any) => { const { customerNo: _, ...rest } = prev; return rest; });
      return;
    }
    if (customerNoDebounceRef.current) clearTimeout(customerNoDebounceRef.current);
    customerNoDebounceRef.current = setTimeout(() => {
      fetchCustomerDetails().catch((e: any) => console.warn("Debounced fetchCustomer failed:", e));
    }, 600);
    return () => { if (customerNoDebounceRef.current) clearTimeout(customerNoDebounceRef.current); };
  }, [customerNo]);

  // ── localStorage init ────────────────────────────────────────────────────
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
      setHpeLegalEntity(customerInfo?.hpeLegalEntity || "");
      const partnerValue = customerInfo?.partnerName || customerInfo?.contractingParty || "";
      setContractingParty(partnerValue);
      setPartnerName(partnerValue);
      contractingPartyRef.current = partnerValue;
      partnerNameRef.current = partnerValue;
      if (customerInfo?.customerNo) {
        apiFetch(`/customer/${customerInfo.customerNo}`)
          .then((data: any) => {
            if (data?.success && data?.customer) setCustomerName(data.customer.customerName);
          })
          .catch(() => {});
      }
    } catch (e) { console.error("localStorage init error:", e); }
    Promise.resolve().then(() => { isHydratedRef.current = true; });
  }, []);

  // ── Sync partner refs ────────────────────────────────────────────────────
  useEffect(() => { contractingPartyRef.current = contractingParty; }, [contractingParty]);
  useEffect(() => { partnerNameRef.current = partnerName; }, [partnerName]);

  // ── Reload if URL opeId mismatches state ─────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    const urlOpeId = new URLSearchParams(window.location.search).get("opeId");
    if (urlOpeId && opeId && opeId !== urlOpeId && !sessionStorage.getItem("reloadedOnce")) {
      sessionStorage.setItem("reloadedOnce", "true");
      window.location.reload();
    }
  }, [opeId]);

  // ── Sync user from storage events ────────────────────────────────────────
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

  // ── Fetch sections/modules when sowSize changes ───────────────────────────
  useEffect(() => {
    if (!initialDraftLoadedRef.current) return;
    dataFetchedAfterLoadRef.current = false;
    fetchData();
  }, [sowSize]);

  // ── Load draft when opeId changes ────────────────────────────────────────
  useEffect(() => {
    if (!opeId || sowTypeChangeInProgressRef.current) return;
    if (skipDraftReloadRef.current) {
      skipDraftReloadRef.current = false;
      return;
    }
    const loadDraftForOpe = async () => {
      state.setLoading(true);
      try {
        const res = await apiFetch(`/drafts/${opeId}`);
        const draft = res?.draft;
        let pending = null;
        try { pending = JSON.parse(localStorage.getItem("pendingDraft") || "null"); } catch {}
        const source = draft || (pending && pending.opeId === opeId ? pending : null);

        if (source?.content && Array.isArray(source.content.documentSections)) {
          const mergedSections = source.content.documentSections.map((sec: any) => ({
            id: sec.id,
            title: sec.title || "",
            description: sec.description || "",
            position: sec.position,
            modules: (sec.modules || []).map((m: any, idx: number) => {
              const full = modules.find((x: any) => String(x.id) === String(m.id));
              return {
                id: m.id,
                name: m.name ?? full?.name ?? "",
                description: m.description ?? full?.description ?? "",
                canEdit: typeof m.canEdit !== "undefined" ? m.canEdit : (typeof full?.canEdit !== "undefined" ? full.canEdit : false),
                sectionId: sec.id,
                position: typeof m.position !== "undefined" ? m.position : idx,
                instanceId: m.instanceId || `${m.id}_${sec.id}_${Math.random().toString(36).substring(7)}`,
              };
            }),
          }));
          setDocumentSections(mergedSections);
          if (source.customerName) setCustomerName(source.customerName);

          const draftPartner =
            source.partnerName !== undefined && source.partnerName !== null
              ? source.partnerName
              : source.contractingParty !== undefined && source.contractingParty !== null
              ? source.contractingParty
              : null;
          if (draftPartner !== null) {
            setContractingParty(draftPartner);
            setPartnerName(draftPartner);
            contractingPartyRef.current = draftPartner;
            partnerNameRef.current = draftPartner;
          }

          if (source.quoteId) setQuoteId(source.quoteId);
          if (source.hpeLegalEntity) setHpeLegalEntity(source.hpeLegalEntity);
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

        initialDraftLoadedRef.current = true;
        const fetchSowType =
          source?.sowType === "SMALL" ? "small" : source?.sowType === "PROPOSAL" ? "proposal" : "full";
        if (!dataFetchedAfterLoadRef.current) {
          dataFetchedAfterLoadRef.current = true;
          setTimeout(() => fetchData(fetchSowType), 0);
        }
      } catch (err) { console.warn("Failed to load draft:", opeId, err); }
      finally { state.setLoading(false); }
    };
    loadDraftForOpe();
  }, [opeId]);

  // ── Auto-format document name ─────────────────────────────────────────────
  useEffect(() => {
    if (!opeId || !customerName) return;
    const isDefault = documentName === "SoW Document";
    const startsWithCurrentOpe = documentName.startsWith(opeId);
    if (isDefault || startsWithCurrentOpe) {
      const formattedBase = contractingParty?.trim()
        ? `${opeId} - HPE Nonstop PSD SOW to ${contractingParty} for ${customerName}`
        : `${opeId} - HPE Nonstop PSD SOW to ${customerName}`;
      if (documentName !== formattedBase) setDocumentName(formattedBase);
    }
  }, [opeId, customerName, contractingParty]);

  // ── Merge module metadata into documentSections ───────────────────────────
  useEffect(() => {
    if (!modules.length || !documentSections.length) return;
    let changed = false;
    const merged = documentSections.map((sec: any, secIdx: number) => ({
      ...sec,
      modules: (sec.modules || []).map((m: any, modIdx: number) => {
        const full = modules.find((x: any) => Number(x.id) === Number(m.id));
        if (!full) {
          // Ensure module has instanceId even if not found in modules array
          const ensuredModule = {
            ...m,
            instanceId: m.instanceId || `${m.id}_${sec.id}_${secIdx}_${modIdx}`,
          };
          if (JSON.stringify(ensuredModule) !== JSON.stringify(m)) changed = true;
          return ensuredModule;
        }
        const mergedModule = {
          ...m,
          name: m.name ?? full.name,
          canEdit: typeof full.canEdit !== "undefined" ? full.canEdit : m.canEdit,
          instanceId: m.instanceId || `${m.id}_${sec.id}_${secIdx}_${modIdx}`,
        };
        if (JSON.stringify(mergedModule) !== JSON.stringify(m)) changed = true;
        return mergedModule;
      }),
    }));
    if (changed) setDocumentSections(merged);
  }, [modules]);

  // ── Sort document sections by position ───────────────────────────────────
  useEffect(() => {
    if (!sections.length || !documentSections.length) return;
    const sorted = sortSectionsByPosition(documentSections, sections);
    const same =
      sorted.length === documentSections.length &&
      sorted.every(
        (s: any, i: number) =>
          s.id === documentSections[i].id &&
          s.position === documentSections[i].position
      );
    if (!same) setDocumentSections(sorted);
  }, [sections]);

  // ── Auto-action from sessionStorage ──────────────────────────────────────
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("autoAction");
      if (raw) {
        pendingAutoActionRef.current = JSON.parse(raw);
        sessionStorage.removeItem("autoAction");
      }
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

  // ── Guard localStorage sync ───────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isHydratedRef.current) return;
    if (!customerName && !customerNo && !contractingParty && !partnerName) return;
    try {
      localStorage.setItem("customerInfo", JSON.stringify({
        customerName,
        customerNo,
        partnerName: contractingParty || partnerName,
        contractingParty: contractingParty || partnerName,
      }));
    } catch (e) { console.error("localStorage sync error:", e); }
  }, [customerName, customerNo, contractingParty, partnerName]);

  // ── Prevent accidental close while saving ────────────────────────────────
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isSaving || autoSaveInProgress) {
        e.preventDefault();
        e.returnValue = "";
        return "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isSaving, autoSaveInProgress]);

  // ── Cleanup debounce on unmount ───────────────────────────────────────────
  useEffect(() => () => {
    if (autoSaveDebounceRef.current) clearTimeout(autoSaveDebounceRef.current);
  }, []);

  // ── Reset highlights when search opens ───────────────────────────────────
  useEffect(() => {
    if (showSearch) {
      setHighlightedSectionId(null);
      setHighlightedModuleId(null);
    }
  }, [showSearch]);
}