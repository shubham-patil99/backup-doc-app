// @ts-nocheck
import React, { useState, useEffect, useRef, useMemo } from "react";
import { Search, X, ChevronDown, ChevronUp } from "lucide-react";

export default function SearchModal({
  isOpen,
  onClose,
  sections,
  modules,
  onSelectResult,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);

  // ─── Strip HTML helper ───────────────────────────────────────────────────────
  const stripHtml = (html: string): string => {
    if (!html) return "";
    try {
      const div = document.createElement("div");
      div.innerHTML = html;
      return div.textContent || div.innerText || "";
    } catch {
      return html;
    }
  };

  // ─── Highlight search term in text ───────────────────────────────────────────
  const highlightText = (text: string, query: string): React.ReactNode => {
    if (!query.trim()) return text;

    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    const parts = text.split(regex);

    return parts.map((part, i) =>
      regex.test(part) ? (
        <span key={i} className="bg-yellow-300 font-semibold">
          {part}
        </span>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  // ─── Combine and filter sections + modules ─────────────────────────────────
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];

    const query = searchQuery.toLowerCase();
    const results: any[] = [];

    // Search sections
    if (sections && Array.isArray(sections)) {
      sections.forEach((section) => {
        const sectionTitle = stripHtml(section.title || "").toLowerCase();
        const sectionDesc = stripHtml(section.description || "").toLowerCase();

        if (sectionTitle.includes(query) || sectionDesc.includes(query)) {
          results.push({
            type: "section",
            id: section.id,
            section,
            title: section.title || "",
            description: section.description || "",
            matchType: sectionTitle.includes(query) ? "title" : "description",
          });
        }
      });
    }

    // Search modules
    if (modules && Array.isArray(modules)) {
      modules.forEach((module) => {
        const moduleName = stripHtml(module.name || "").toLowerCase();
        const moduleDesc = stripHtml(module.description || "").toLowerCase();
        const sectionForModule = sections?.find((s) => s.id === module.sectionId);
        const sectionTitle = sectionForModule
          ? stripHtml(sectionForModule.title || "")
          : "";

        if (
          moduleName.includes(query) ||
          moduleDesc.includes(query) ||
          sectionTitle.toLowerCase().includes(query)
        ) {
          results.push({
            type: "module",
            id: module.id,
            module,
            sectionId: module.sectionId,
            section: sectionForModule,
            title: module.name || "",
            description: module.description || "",
            matchType: moduleName.includes(query)
              ? "name"
              : moduleDesc.includes(query)
              ? "description"
              : "section",
          });
        }
      });
    }

    // Sort by relevance: exact matches first, then title matches, then description
    return results.sort((a, b) => {
      const matchPriority = {
        title: 0,
        name: 0,
        description: 1,
        section: 2,
      };
      return matchPriority[a.matchType] - matchPriority[b.matchType];
    });
  }, [searchQuery, sections, modules]);

  // ─── Handle keyboard navigation ──────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < searchResults.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case "Enter":
        e.preventDefault();
        if (searchResults[selectedIndex]) {
          handleSelectResult(searchResults[selectedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        onClose();
        break;
      default:
        break;
    }
  };

  // ─── Handle result selection ────────────────────────────────────────────────
  const handleSelectResult = (result: any) => {
    if (onSelectResult) {
      onSelectResult(result);
    }
    setSearchQuery("");
    setSelectedIndex(0);
    onClose();
  };

  // ─── Auto-scroll to selected result ──────────────────────────────────────────
  useEffect(() => {
    const selectedElement = resultsContainerRef.current?.children[selectedIndex];
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  // ─── Focus input when modal opens ────────────────────────────────────────────
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // ─── Reset on close ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
      setSelectedIndex(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center pt-20"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-96 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Search Header ── */}
        <div className="flex items-center gap-3 p-4 border-b border-gray-200">
          <Search className="h-5 w-5 text-gray-400" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search sections and modules... (Esc to close)"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            className="flex-1 outline-none text-sm"
          />
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
            title="Close (Esc)"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* ── Results ── */}
        <div
          ref={resultsContainerRef}
          className="flex-1 overflow-y-auto space-y-1 p-2"
        >
          {searchQuery.trim() === "" ? (
            <div className="flex items-center justify-center h-32 text-gray-500 text-sm">
              Start typing to search sections and modules
            </div>
          ) : searchResults.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-gray-500 text-sm">
              No results found for "{searchQuery}"
            </div>
          ) : (
            searchResults.map((result, idx) => (
              <button
                key={`${result.type}-${result.id}-${idx}`}
                onClick={() => handleSelectResult(result)}
                className={`w-full text-left p-3 rounded-lg transition-colors ${
                  idx === selectedIndex
                    ? "bg-blue-100 border border-blue-300"
                    : "hover:bg-gray-100 border border-transparent"
                }`}
              >
                <div className="flex items-start gap-2">
                  {result.type === "section" ? (
                    <ChevronDown className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-purple-600 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">
                      {result.type === "section" ? "Section: " : "Module: "}
                      {highlightText(stripHtml(result.title), searchQuery)}
                    </div>
                    <div className="text-xs text-gray-600 line-clamp-2">
                      {stripHtml(result.description).slice(0, 100)}
                    </div>
                    {result.type === "module" && result.section && (
                      <div className="text-xs text-gray-500 mt-1">
                        Section:{" "}
                        {stripHtml(result.section.title || result.section.description || "")}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        {/* ── Footer Info ── */}
        {searchResults.length > 0 && searchQuery.trim() !== "" && (
          <div className="px-4 py-2 bg-gray-50 text-xs text-gray-600 border-t border-gray-200">
            {searchResults.length} result{searchResults.length !== 1 ? "s" : ""} found
            {" • Use ↑↓ to navigate, Enter to select, Esc to close"}
          </div>
        )}
      </div>
    </div>
  );
}