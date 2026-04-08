export function filenameFromUrl(url: string): string {
  try {
    const path = url.split("/").pop()?.split("?")[0];
    return path && path.length > 0 ? decodeURIComponent(path) : url;
  } catch {
    return url.split("/").pop()?.split("?")[0] || url;
  }
}

export type AttachmentVisualKind =
  | "word"
  | "excel"
  | "ppt"
  | "pdf"
  | "image"
  | "video"
  | "audio"
  | "archive"
  | "code"
  | "generic";

export function detectAttachmentKind(filename: string): AttachmentVisualKind {
  const lower = filename.toLowerCase();
  if (/\.(doc|docx)$/.test(lower)) return "word";
  if (/\.(xls|xlsx|csv)$/.test(lower)) return "excel";
  if (/\.(ppt|pptx)$/.test(lower)) return "ppt";
  if (/\.pdf$/.test(lower)) return "pdf";
  if (/\.(png|jpe?g|gif|webp|svg|bmp|ico)$/.test(lower)) return "image";
  if (/\.(mp4|webm|mov|mkv|avi)$/.test(lower)) return "video";
  if (/\.(mp3|wav|ogg|m4a)$/.test(lower)) return "audio";
  if (/\.(zip|rar|7z|tar|gz)$/.test(lower)) return "archive";
  if (/\.(js|ts|tsx|jsx|py|java|cpp|c|html|css|json)$/.test(lower)) return "code";
  return "generic";
}

/** Russian plural for «условие» (1 / 2–4 / 5+) */
export function formatCriteriaCountRu(n: number): string {
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (mod100 >= 11 && mod100 <= 14) return `${n} условий`;
  if (mod10 === 1) return `${n} условие`;
  if (mod10 >= 2 && mod10 <= 4) return `${n} условия`;
  return `${n} условий`;
}
