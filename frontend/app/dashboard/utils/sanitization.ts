export const normalizeInlineLists = (html = "") => {
  if (!html) return html;
  return html.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (match, inner) => {
    const text = inner
      .replace(/<\/div>/gi, '\n')
      .replace(/<div[^>]*>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n');
    const lines = text.split(/\n/).map(s => s.trim()).filter(Boolean);
    if (lines.length < 2) return match;
    
    const listStart = lines.findIndex(l => /^(\d+[\.\)]\s+|[-*•]\s+)/.test(l));
    if (listStart === -1) return match;
    
    const prefixLines = lines.slice(0, listStart);
    const listLines = lines.slice(listStart);
    const isNumbered = /^\d+[\.\)]\s+/.test(listLines[0]);
    const nestedItems = listLines
      .map(l => `<li>${l.replace(/^(\d+[\.\)]\s+|[-*•]\s+)/, '')}</li>`)
      .join('');
    const nestedHtml = `<${isNumbered ? 'ol' : 'ul'}>${nestedItems}</${isNumbered ? 'ol' : 'ul'}>`;
    const prefixHtml = prefixLines.length ? prefixLines.join('<br/>') : '';
    return `<li>${prefixHtml}${nestedHtml}</li>`;
  });
};

export const sanitizeDescription = (html = "") => {
  if (!html) return "";
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div id="root">${html}</div>`, "text/html");
    const root = doc.getElementById("root");
    if (!root) return html;

    root.querySelectorAll("p, div").forEach((node) => {
      if (node.querySelector("ul, ol, table, img")) return;
      node.querySelectorAll("span").forEach(sp => {
        while (sp.firstChild) sp.parentNode.insertBefore(sp.firstChild, sp);
        sp.parentNode.removeChild(sp);
      });

      const parts = [];
      node.childNodes.forEach(child => {
        if (child.nodeType === Node.ELEMENT_NODE) {
          const tag = (child as Element).tagName.toLowerCase();
          if (tag === "br") {
            parts.push("<br/>");
          } else {
            const outer = (child as Element).outerHTML
              .replace(/\u00A0/g, " ")
              .replace(/\s+/g, " ");
            parts.push(outer);
          }
        } else if (child.nodeType === Node.TEXT_NODE) {
          const txt = (child.textContent || "")
            .replace(/\u00A0/g, " ")
            .replace(/\s+/g, " ")
            .trim();
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

    let out = "";
    root.childNodes.forEach(child => {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as Element;
        const tag = el.tagName.toLowerCase();
        if (["ul", "ol", "table", "img", "pre"].includes(tag)) {
          out += el.outerHTML;
        } else {
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
  } catch (e) {
    return html
      .replace(/<span[^>]*>/gi, "")
      .replace(/<\/span>/gi, "")
      .replace(/\u00A0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
};