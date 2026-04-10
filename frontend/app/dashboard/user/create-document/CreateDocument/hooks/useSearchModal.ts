// @ts-nocheck
import { useState, useEffect } from "react";

/**
 * useSearchModal Hook
 * 
 * Manages search modal state with keyboard shortcut support (Ctrl+F / Cmd+F)
 * Works on both web and Electron desktop applications.
 * 
 * Usage:
 * const { isOpen, open, close } = useSearchModal();
 * 
 * Then:
 * <SearchModal isOpen={isOpen} onClose={close} sections={sections} modules={modules} />
 */
export default function useSearchModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // ─── Handle Ctrl+F (Windows/Linux) and Cmd+F (macOS) ──────────────────────
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Ctrl+F or Cmd+F
      const isCtrlF = (e.ctrlKey || e.metaKey) && e.key === "f";

      if (isCtrlF) {
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(true);
      }

      // Also support Escape to close
      if (e.key === "Escape") {
        if (isOpen) {
          e.preventDefault();
          setIsOpen(false);
        }
      }
    };

    // ─── Handle Electron-specific shortcuts ──────────────────────────────────
    const handleElectronShortcut = async () => {
      try {
        if (typeof window !== "undefined" && (window as any).electronAPI) {
          const electronAPI = (window as any).electronAPI;

          // If Electron provides custom shortcut handling, use it
          if (electronAPI.onSearch) {
            electronAPI.onSearch(() => {
              setIsOpen(true);
            });
          }
        }
      } catch (err) {
        console.debug("Electron API not available:", err);
      }
    };

    // Attach event listeners
    window.addEventListener("keydown", handleKeyDown);
    handleElectronShortcut();

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen((prev) => !prev),
  };
}