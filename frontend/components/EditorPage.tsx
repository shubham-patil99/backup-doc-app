// @ts-nocheck
"use client";
import React, { useRef, useMemo } from "react";
import JoditEditor from "jodit-react";

interface EditorPageProps {
  value: string;
  onChange: (content: string) => void;
  placeholder?: string;
  baseApi?: string;
  expandUploads?: boolean;
  minHeight?: number | string;
  config?: any;
}

const EditorPage: React.FC<EditorPageProps> = ({
  value,
  onChange,
  placeholder = "Enter content...",
  baseApi,
  expandUploads,
  minHeight = 400,
  config: externalConfig,
}) => {
  const editor = useRef<any>(null);

  const normalizeInlineLists = (html: string) => {
    if (!html) return html;
    return html.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (match, inner) => {
      const text = inner
        .replace(/<\/div>/gi, "\n")
        .replace(/<div[^>]*>/gi, "\n")
        .replace(/<br\s*\/?>/gi, "\n");
      const lines = text.split(/\n/).map((s) => s.trim()).filter(Boolean);
      if (lines.length < 2) return match;
      const listStart = lines.findIndex((l) => /^(\d+[\.\)]\s+|[-*•]\s+)/.test(l));
      if (listStart === -1) return match;
      const prefixLines = lines.slice(0, listStart);
      const listLines = lines.slice(listStart);
      const isNumbered = /^\d+[\.\)]\s+/.test(listLines[0]);
      const nestedItems = listLines
        .map((l) => `<li>${l.replace(/^(\d+[\.\)]\s+|[-*•]\s+)/, "")}</li>`)
        .join("");
      const nestedHtml = `<${isNumbered ? "ol" : "ul"}>${nestedItems}</${isNumbered ? "ol" : "ul"}>`;
      const prefixHtml = prefixLines.length
        ? inner.split(/(<br\s*\/?>|\r\n|\n)/i).slice(0, prefixLines.length).join("") ||
          prefixLines.join("<br/>")
        : "";
      return `<li>${prefixHtml}${nestedHtml}</li>`;
    });
  };

  const config = useMemo(() => {
    const defaultConfig = {
      readonly: false,
      placeholder,
      // Always use 100% so the editor fills its flex container
      height: "100%",
      buttons: ["bold", "italic", "underline", "ul", "ol", "link", "image"],
      cleanHTML: { replaceNBSP: true },
      askBeforePasteHTML: false,
      askBeforePasteFromWord: false,
      processPasteHTML: true,
      defaultActionOnPaste: "insert_clear_html",
      style: { font: "14px Arial, sans-serif" },
    };

    return {
      ...defaultConfig,
      // externalConfig can override anything except height/placeholder
      ...externalConfig,
      // Re-enforce these after spread so external config can't accidentally break layout
      height: "100%",
      placeholder,
    } as any;
  }, [placeholder, externalConfig]);

  const handleBlur = (newContent: string) => {
    const normalized = normalizeInlineLists(newContent);
    onChange && onChange(normalized);
  };

  return (
    <>
      {/*
        Key changes:
        - height: "100%" + flex: 1 so this div stretches inside its flex parent
        - display: "flex" + flexDirection: "column" so JoditEditor can also stretch
        - Removed minHeight / conditional height logic — parent controls size now
      */}
      <div
        className="jodit-editor-wrapper"
        style={{
          position: "relative",
          overflow: "visible",
          height: "100%",
          width: "100%",
          flex: 1,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <JoditEditor
          ref={editor}
          value={value}
          config={config}
          onBlur={(c) => handleBlur(c)}
          onChange={() => {}}
        />
      </div>

      <style jsx global>{`
        /* ── Popup positioning ───────────────────────────── */
        .jodit-popup {
          position: fixed !important;
          z-index: 999999 !important;
        }
        .jodit-popup__content {
          max-height: 400px;
          overflow-y: auto;
        }
        .jodit-toolbar-collection__popup {
          position: fixed !important;
          z-index: 999999 !important;
        }
        body > .jodit-popup {
          display: block !important;
          visibility: visible !important;
        }

        /* ── Full-height chain ───────────────────────────── */
        /*
          Every node in the chain must be a flex column so that
          "height: 100%" actually propagates all the way down to
          the contenteditable area.
        */
        .jodit-editor-wrapper,
        .jodit-editor-wrapper > div {
          height: 100% !important;
          flex: 1 !important;
          display: flex !important;
          flex-direction: column !important;
        }

        .jodit-container {
          height: 100% !important;
          display: flex !important;
          flex-direction: column !important;
        }

        .jodit-workplace {
          flex: 1 !important;
          min-height: 0 !important; /* critical — lets the flex child shrink */
          display: flex !important;
          flex-direction: column !important;
        }

        .jodit-wysiwyg {
          flex: 1 !important;
          height: auto !important;
          min-height: 0 !important;
          overflow-y: auto !important;
        }
      `}</style>
    </>
  );
};

export default EditorPage;