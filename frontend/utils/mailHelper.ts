// utils/mailHelper.ts
export const openMailClient = (
  to: string[] = [],
  cc: string[] = [],
  subject: string = "",
  body: string = ""
) => {
  let mailto = "mailto:";

  // Only add "to" if not empty
  if (to.length > 0) {
    mailto += encodeURIComponent(to.join(","));
  }

  // Build query params manually
  const params: string[] = [];

  if (cc.length > 0) params.push(`cc=${encodeURIComponent(cc.join(","))}`);
  if (subject) params.push(`subject=${encodeURIComponent(subject)}`);
  if (body) params.push(`body=${encodeURIComponent(body)}`);

  let mailtoLink = mailto;
  if (params.length > 0) {
    mailtoLink += `?${params.join("&")}`;
  }

  // Replace all '+' with '%20' to preserve spaces
  mailtoLink = mailtoLink.replace(/\+/g, "%20");

  // Open user's default mail client
  window.location.href = mailtoLink;
};