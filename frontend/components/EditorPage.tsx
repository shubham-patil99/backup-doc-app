// @ts-nocheck
"use client";
import React, { useRef, useMemo, useEffect } from "react";
import JoditEditor from "jodit-react";

interface EditorPageProps {
  value: string;
  onChange: (content: string) => void;
  placeholder?: string;
  baseApi?: string;
  expandUploads?: boolean;
  minHeight?: number;
}

const EditorPage: React.FC<EditorPageProps> = ({
  value,
  onChange,
  placeholder = "Enter content...",
  baseApi,
  expandUploads,
  minHeight = 400,
}) => {
  const editor = useRef<any>(null);
  const lastClickPos = useRef<{ x: number; y: number } | null>(null);

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
    let apiBase = (baseApi || process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
    if (!apiBase && typeof window !== "undefined") apiBase = window.location.origin;
    const serverRoot = apiBase.replace(/\/api$/, "");
    const uploaderUrl = apiBase.endsWith("/api")
      ? `${apiBase}/uploads/image`
      : `${apiBase}/api/uploads/image`;

    return {
      readonly: false,
      toolbarSticky: false,
      placeholder,
      zIndex: 999999,

       readonly: false,
      toolbarSticky: false,
      placeholder: placeholder,

      toolbarAdaptive: false,


      buttons: [
        "font",
        "fontsize",
        "ul",
        "ol",
        "table",
        "link",
        "image",
        "align",
      ],

      removeButtons: [
        "speechRecognize", "file", "video", "about", "fullsize",
        "print", "selectall", "cut", "copy", "paste", "pasteText",
        "pasteFromWord", "hr", "superscript", "subscript", "shadow",
        "eraser", "symbol", "spellcheck", "toggleFormat", "preview",
        "find", "replace",  "bold",
        "italic",
        "underline",
        "strikethrough",
        "outdent",
        "source",
          "brush",
          "indent",
          "undo",
        "redo",
      ],

      allowTabNavigation: true,
      enableTabToIndent: true,
      controls: { list: { options: { allowNested: true } } },

      enter: "P",
      cleanHTML: { replaceNBSP: true, removeEmptyBlocks: true, fillEmptyParagraph: false },
      textIcons: false,
      iframe: false,
      spellcheck: false,
      safeMode: false,
      allowFocus: true,
      defaultLineHeight: 1.4,

      uploader: {
        insertImageAsBase64URI: false,
        url: uploaderUrl,
        format: "json",
        method: "POST",
        filesVariableName: () => "files",
        isSuccess: (resp: any) =>
          resp && (resp.success || resp.url || (resp.files && resp.files.length > 0)),
        getMsg: (resp: any) => resp.message || resp.error || "Upload completed",
        process: (resp: any) => {
          let files: string[] = [];
          if (resp.files && Array.isArray(resp.files))
            files = resp.files.map((f: any) => (typeof f === "string" ? f : f.file || f.url));
          else if (resp.url) files = [resp.url];
          else if (resp.file) files = [resp.file];
          return {
            files,
            path: "",
            baseurl: serverRoot,
            error: resp.error || null,
            msg: resp.message || "",
          };
        },
        defaultHandlerSuccess: function (data: any) {
          const j = this;
          if (data.files) data.files.forEach((url: string) => j.selection.insertImage(url, null, 250));
        },
        defaultHandlerError: function (resp: any) {
          console.error("Upload error:", resp);
          this.jodit.events.fire("errorMessage", resp.message || "Upload failed");
        },
      },

      image: { editSrc: true, styles: { float: "none", maxWidth: "100%" } },

      showXPathInStatusbar: false,
      useSearch: false,
      statusbar: false,
      height: minHeight,
      askBeforePasteHTML: false,
      askBeforePasteFromWord: false,
      defaultActionOnPaste: "insert_clear_html",

      events: {
        afterInit: function (instance: any) {
          const editorEl = instance.editor;

          // Use toolbar element bounding rect as anchor (more stable than raw click coords)
          let lastAnchorRect: DOMRect | null = null;
          let lastAnchorTs = 0;

          // Track mousedown on toolbar buttons and capture their bounding rect
          const toolbarMouseDown = (e: MouseEvent) => {
            try {
              const target = e.target as HTMLElement;
              const btn = target.closest(".jodit-toolbar-button, .jodit-toolbar button, .jodit-toolbar [role='button']") as HTMLElement;
              if (btn) {
                lastAnchorRect = btn.getBoundingClientRect();
                lastAnchorTs = Date.now();
                // small debug
                // console.debug("Anchor rect captured", lastAnchorRect);
              }
            } catch (err) {}
          };
          document.addEventListener("mousedown", toolbarMouseDown, true);

          // Position popup relative to an anchor rect (or fallback selection rect)
          const repositionPopup = (popupEl: HTMLElement) => {
            if (!popupEl) return;

            // prevent double-processing for same popup element
            if ((popupEl as any).__anchored) return;

            // choose anchor: prefer recent toolbar anchor (within 1500ms), else selection bounding rect
            let anchorRect: DOMRect | null = null;
            if (lastAnchorRect && Date.now() - lastAnchorTs < 1500) {
              anchorRect = lastAnchorRect;
            } else {
              try {
                const selNode = instance.selection && instance.selection.current && instance.selection.current();
                if (selNode && typeof selNode.getBoundingClientRect === "function") {
                  anchorRect = selNode.getBoundingClientRect();
                }
              } catch (e) {}
            }

            // if no anchor, fallback to editor top-left
            if (!anchorRect) {
              const eRect = editorEl.getBoundingClientRect();
              anchorRect = new DOMRect(eRect.left + 8, eRect.top + 8, 30, 20);
            }

            // wait a frame to let popup compute its size
            requestAnimationFrame(() => {
              try {
                const popupRect = popupEl.getBoundingClientRect();
                const viewportW = window.innerWidth;
                const viewportH = window.innerHeight;
                const gap = 8;

                // prefer placing above anchor (so it doesn't overlap toolbar)
                let left = anchorRect.left;
                let top = anchorRect.top - popupRect.height - 6;

                // if not enough space above, place below anchor
                if (top < gap) top = anchorRect.bottom + 6;

                // attempt center alignment relative to anchor
                const centered = anchorRect.left + anchorRect.width / 2 - popupRect.width / 2;
                if (centered >= gap && centered + popupRect.width <= viewportW - gap) {
                  left = centered;
                }

                // clamp horizontally
                if (left + popupRect.width > viewportW - gap) left = Math.max(gap, viewportW - popupRect.width - gap);
                if (left < gap) left = gap;

                // clamp vertically
                if (top + popupRect.height > viewportH - gap) top = Math.max(gap, viewportH - popupRect.height - gap);
                if (top < gap) top = gap;

                popupEl.style.position = "fixed";
                popupEl.style.left = `${Math.round(left)}px`;
                popupEl.style.top = `${Math.round(top)}px`;
                popupEl.style.transform = "none";
                popupEl.style.zIndex = "999999";

                // mark as positioned from anchor so we don't reuse stale anchor for nested/popups
                (popupEl as any).__anchored = true;
                // clear old anchor after using it
                lastAnchorRect = null;
              } catch (err) {
                // ignore
              }
            });
          };

          // Observe body for new Jodit popups and position them
          const observer = new MutationObserver((mutations) => {
            for (const m of mutations) {
              for (const n of Array.from(m.addedNodes || [])) {
                if (n instanceof HTMLElement && n.classList.contains("jodit-popup")) {
                  // small delay for popup content/layout
                  setTimeout(() => repositionPopup(n), 6);

                  // if popup changes (nested menus), try to re-position once more
                  const popupObserver = new MutationObserver(() => repositionPopup(n));
                  popupObserver.observe(n, { childList: true, subtree: true, attributes: true });

                  // cleanup observers when popup removed
                  const removeObs = new MutationObserver((ms) => {
                    for (const mm of ms) {
                      for (const rem of Array.from(mm.removedNodes || [])) {
                        if (rem === n) {
                          popupObserver.disconnect();
                          removeObs.disconnect();
                        }
                      }
                    }
                  });
                  removeObs.observe(document.body, { childList: true });
                }
              }
            }
          });

          observer.observe(document.body, { childList: true, subtree: true });

           // Re-position on resize/scroll
           const handleRepositionAll = () => {
             document.querySelectorAll(".jodit-popup").forEach((popup) => {
               if (popup instanceof HTMLElement) repositionPopup(popup);
             });
           };

           window.addEventListener("resize", handleRepositionAll);
           window.addEventListener("scroll", handleRepositionAll, true);

           // Cleanup on destroy
           instance.events.on("beforeDestruct", () => {
             observer.disconnect();
             document.removeEventListener("mousedown", toolbarMouseDown, true);
             window.removeEventListener("resize", handleRepositionAll);
             window.removeEventListener("scroll", handleRepositionAll, true);
           });
         },
       },

      style: { font: "14px Arial, sans-serif" },
    };
  }, [baseApi, placeholder, minHeight]);

  const handleBlur = (newContent: string) => {
    const normalized = normalizeInlineLists(newContent);
    onChange && onChange(normalized);
  };

  return (
    <>
      <div className="jodit-editor-wrapper" style={{ position: "relative", overflow: "visible" }}>
        <JoditEditor
          ref={editor}
          value={value}
          config={config}
          onBlur={(c) => handleBlur(c)}
          onChange={() => {}}
        />
      </div>

      {/* ✅ Global styles for popup positioning */}
      <style jsx global>{`
        .jodit-popup {
          position: fixed !important;
          z-index: 999999 !important;
        }

        .jodit-popup__content {
          max-height: 400px;
          overflow-y: auto;
        }

        /* Ensure nested dropdowns appear */
        .jodit-toolbar-collection__popup {
          position: fixed !important;
          z-index: 999999 !important;
        }

        /* Make sure popups are visible */
        body > .jodit-popup {
          display: block !important;
          visibility: visible !important;
        }
      `}</style>
    </>
  );
};

export default EditorPage;