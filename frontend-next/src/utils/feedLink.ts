/** Normalize and validate URLs for course feed posts (surveys, events, etc.). */

export function isPlausibleExternalUrl(h: string): boolean {
  const s = h.trim();
  if (!s) return false;
  if (/^https?:\/\//i.test(s)) return true;
  if (s.startsWith("//")) return true;
  if (s.startsWith("/")) return true;
  if (/^localhost(:\d+)?([\/?#]|$)/i.test(s)) return true;
  return /^[\w.-]+\.[a-z]{2,}([\w./:?#&=%@+~,\-]*)?$/i.test(s);
}

/** Returns absolute href for storage/API, or null if invalid. */
export function normalizeFeedLinkForSave(raw: string): string | null {
  const h = raw.trim();
  if (!h) return null;
  if (h.startsWith("/")) return h;
  if (/^https?:\/\//i.test(h)) return h;
  if (h.startsWith("//")) return `https:${h}`;
  if (isPlausibleExternalUrl(h)) return `https://${h}`;
  return null;
}

export function feedLinkDisplayHref(raw: string): { href: string; external: boolean; ok: boolean } {
  const h = (raw ?? "").trim();
  if (!h) return { href: "#", external: false, ok: false };
  if (h.startsWith("/")) return { href: h, external: false, ok: true };
  if (/^https?:\/\//i.test(h)) return { href: h, external: true, ok: true };
  if (h.startsWith("//")) return { href: `https:${h}`, external: true, ok: true };
  const saved = normalizeFeedLinkForSave(h);
  if (saved && saved.startsWith("http")) return { href: saved, external: true, ok: true };
  return { href: "#", external: true, ok: false };
}
