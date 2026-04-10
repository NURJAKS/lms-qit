/** Ensure <a> in rich HTML open in a new tab when they don't already set target. */
export function htmlLinksOpenInNewTab(html: string): string {
  if (!html || typeof html !== "string") return html;
  return html.replace(/<a(\s+[^>]*?)>/gi, (full, attrs: string) => {
    if (/\starget\s*=/i.test(attrs)) return full;
    return `<a target="_blank" rel="noopener noreferrer"${attrs}>`;
  });
}
