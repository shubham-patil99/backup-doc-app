export const stripHtml = (html: string) => {
  if (typeof document === 'undefined') return html;
  const temp = document.createElement("div");
  temp.innerHTML = html;
  return temp.textContent || temp.innerText || "";
};

export const deriveBaseFromFileName = (fn?: string) => {
  if (!fn) return "";
  return fn.replace(/\.[^.]+$/, "");
};

export const expandImageUrls = (html = "") => {
  if (!html) return html;
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 
      (typeof window !== "undefined" ? window.location.origin : "");
    const baseUrl = apiUrl.replace(/\/api\/?$/i, "");
    return html.replace(/src="\/uploads/gi, `src="${baseUrl}/uploads`);
  } catch {
    return html;
  }
};

export const replaceTags = (
  text: string,
  { customerName, partnerName, documentName, opeId }: any
) => {
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

export const formatDateOnly = (date = new Date()) => {
  const d = new Date(date);
  if (isNaN(d.getTime())) return new Date().toLocaleDateString();
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric"
  });
};

export const sortDocumentSectionsByPosition = (
  docSections: any[],
  sourceSections: any[]
) => {
  const pos = new Map(
    (sourceSections || []).map((s, i) => {
      const p = Number(s.position);
      return [s.id, Number.isFinite(p) ? p : i];
    })
  );
  const sorted = [...docSections].sort(
    (a, b) =>
      (pos.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
      (pos.get(b.id) ?? Number.MAX_SAFE_INTEGER)
  );
  return sorted.map((s) => ({
    ...s,
    position: pos.has(s.id) ? pos.get(s.id) : s.position
  }));
};