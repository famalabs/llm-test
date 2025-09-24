export const getHeatmapColor = (value: number) => {
  const v = Math.max(0, Math.min(1, value));
  const r = Math.round(255 * (1 - v));
  const g = Math.round(255 * v);
  return `rgb(${r},${g},0)`;
};

export const getTextColor = (value: number) => {
  const v = Math.max(0, Math.min(1, value));
  const r = 255 * (1 - v),
    g = 255 * v,
    b = 0;
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 140 ? "#111827" : "#FFFFFF";
};

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