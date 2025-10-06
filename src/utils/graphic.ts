export const escapeText = (s: string) =>
  String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

export const escapeAttrQuotesOnly = (s: string) =>
  String(s ?? "")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

