// @ts-nocheck
import { Section, DocumentSection } from "../types/types";

// ─── DOM / Environment Helpers ───────────────────────────────────────────────

export const isElectronEnv = (): boolean =>
  typeof window !== "undefined" && !!(window as any).electronAPI?.isElectron;

export const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = () => reject(new Error("FileReader failed"));
    reader.readAsDataURL(blob);
  });

// ─── Date Helpers ────────────────────────────────────────────────────────────

export const formatDateOnly = (date = new Date()) => {
  const d = new Date(date);
  if (isNaN(d.getTime())) return new Date().toLocaleDateString();
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

// ─── String / HTML Helpers ───────────────────────────────────────────────────

export const expandImageUrlsLocal = (html = "") => {
  if (!html) return html;
  try {
    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL ||
      (typeof window !== "undefined" ? window.location.origin : "");
    const baseUrl = apiUrl.replace(/\/api\/?$/i, "");
    return html.replace(/src="\/uploads/gi, `src="${baseUrl}/uploads`);
  } catch {
    return html;
  }
};

export const deriveBaseName = (fn?: string) =>
  fn ? fn.replace(/\.[^.]+$/, "") : "";

export const stripHtmlLocal = (html: string) => {
  const temp = document.createElement("div");
  temp.innerHTML = html;
  return temp.textContent || temp.innerText || "";
};

export const replaceTags = (text: string, vars: any) => {
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

export const normalizeInlineLists = (html = "") => {
  if (!html) return html;
  return html.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (match, inner) => {
    const text = inner
      .replace(/<\/div>/gi, "\n")
      .replace(/<div[^>]*>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n");
    const lines = text
      .split(/\n/)
      .map((s: string) => s.trim())
      .filter(Boolean);
    if (lines.length < 2) return match;
    const listStart = lines.findIndex((l: string) =>
      /^(\d+[\.\)]\s+|[-*\u2022]\s+)/.test(l)
    );
    if (listStart === -1) return match;
    const prefixLines = lines.slice(0, listStart);
    const listLines = lines.slice(listStart);
    const isNumbered = /^\d+[\.\)]\s+/.test(listLines[0]);
    const nestedItems = listLines
      .map(
        (l: string) =>
          `<li>${l.replace(/^(\d+[\.\)]\s+|[-*\u2022]\s+)/, "")}</li>`
      )
      .join("");
    const nestedHtml = `<${isNumbered ? "ol" : "ul"}>${nestedItems}</${
      isNumbered ? "ol" : "ul"
    }>`;
    const prefixHtml = prefixLines.length
      ? inner
          .split(/(<br\s*\/?>|\r\n|\n)/i)
          .slice(0, prefixLines.length)
          .join("") || prefixLines.join("<br/>")
      : "";
    return `<li>${prefixHtml}${nestedHtml}</li>`;
  });
};

export const sanitizeDescription = (html = "") => {
  if (!html) return "";
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(
      `<div id="root">${html}</div>`,
      "text/html"
    );
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
          else
            parts.push(
              (child as Element).outerHTML
                .replace(/\u00A0/g, " ")
                .replace(/\s+/g, " ")
            );
        } else if (child.nodeType === Node.TEXT_NODE) {
          const txt = (child.textContent || "")
            .replace(/\u00A0/g, " ")
            .replace(/\s+/g, " ")
            .trim();
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
        if (["ul", "ol", "table", "img", "pre"].includes(tag))
          out += el.outerHTML;
        else {
          const inner = el.innerHTML
            .replace(/\u00A0/g, " ")
            .replace(/\s+/g, " ")
            .trim();
          if (inner) out += `<p>${inner}</p>`;
        }
      } else if (child.nodeType === Node.TEXT_NODE) {
        const t = (child.textContent || "")
          .replace(/\u00A0/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        if (t) out += `<p>${t}</p>`;
      }
    });
    return out;
  } catch {
    return html
      .replace(/<span[^>]*>/gi, "")
      .replace(/<\/span>/gi, "")
      .replace(/\u00A0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
};

// ─── Section Sorting ─────────────────────────────────────────────────────────

export const sortSectionsByPosition = (
  docSections: DocumentSection[],
  sourceSections: Section[]
) => {
  const pos = new Map<number, number>();
  const sourcePos = new Map(
    (sourceSections || []).map((s, i) => {
      const p = Number(s.position);
      return [s.id, Number.isFinite(p) ? p : i];
    })
  );
  (docSections || []).forEach((doc, idx) => {
    const docPos = Number(doc.position);
    if (Number.isFinite(docPos)) {
      pos.set(doc.id, docPos);
    } else if (sourcePos.has(doc.id)) {
      pos.set(doc.id, sourcePos.get(doc.id)!);
    } else {
      pos.set(doc.id, idx);
    }
  });
  return [...docSections]
    .sort(
      (a, b) =>
        (pos.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
        (pos.get(b.id) ?? Number.MAX_SAFE_INTEGER)
    )
    .map((s) => ({ ...s, position: pos.get(s.id) ?? s.position }));
};

// ─── DocType Parsing ─────────────────────────────────────────────────────────

export const parseSectionDocTypes = (docType: any): string[] => {
  if (Array.isArray(docType)) {
    return docType.map((t) => String(t).toLowerCase());
  }
  if (typeof docType === "string") {
    if (docType.startsWith("[")) {
      try {
        const parsed = JSON.parse(docType);
        return Array.isArray(parsed)
          ? parsed.map((t) => String(t).toLowerCase())
          : [docType.toLowerCase()];
      } catch (e) {
        return [docType.toLowerCase()];
      }
    }
    return [docType.toLowerCase()];
  }
  return ["full"];
};

// ─── Session / Navigation Helpers ────────────────────────────────────────────

export const triggerReloadWithAction = (action: string, payload: any = null) => {
  try {
    sessionStorage.setItem(
      "autoAction",
      JSON.stringify({ action, payload, ts: Date.now() })
    );
  } catch {}
  window.location.reload();
};