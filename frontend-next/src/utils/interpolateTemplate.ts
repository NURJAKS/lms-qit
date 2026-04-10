/** Replace `{name}` placeholders in UI strings (translations). */
export function interpolateTemplate(
  template: string,
  values: Record<string, string | number>
): string {
  return template.replace(/\{(\w+)\}/g, (full, key: string) => {
    const v = values[key];
    if (v === undefined || v === null) return full;
    return String(v);
  });
}
