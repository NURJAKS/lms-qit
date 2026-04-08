import type { Lang } from "@/i18n/translations";

type DateInput = string | number | Date | null | undefined;

function normalizeDate(value: DateInput): Date | null {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

export function getLocaleForLang(lang: Lang | string | undefined): string {
  if (lang === "ru") return "ru-RU";
  if (lang === "kk") return "kk-KZ";
  if (lang === "en") return "en-US";
  return "ru-RU";
}

export function formatDateTimeLocalized(
  value: DateInput,
  lang: Lang | string | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  const d = normalizeDate(value);
  if (!d) return "—";

  const locale = getLocaleForLang(lang);
  
  // According to the spec, dateStyle/timeStyle cannot be used with individual date/time unit properties
  const hasStyle = options?.dateStyle || options?.timeStyle;

  const baseOptions: Intl.DateTimeFormatOptions = hasStyle
    ? {}
    : lang === "en"
    ? { day: "2-digit", month: "2-digit", year: "numeric", hour: "numeric", minute: "2-digit" }
    : {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      };

  return d.toLocaleString(locale, { ...baseOptions, ...(options ?? {}) });
}

const KK_MONTHS = [
  'қаңтар', 'ақпан', 'наурыз', 'сәуір', 'мамыр', 'маусым',
  'шілде', 'тамыз', 'қыркүйек', 'қазан', 'қараша', 'желтоқсан'
];

const KK_MONTHS_GENITIVE = [
  'қаңтар', 'ақпан', 'наурыз', 'сәуір', 'мамыр', 'маусым',
  'шілде', 'тамыз', 'қыркүйек', 'қазан', 'қараша', 'желтоқсан'
];

export function formatDateLocalized(
  value: DateInput,
  lang: Lang | string | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  const d = normalizeDate(value);
  if (!d) return "—";

  const hasStyle = options?.dateStyle;

  const baseOptions: Intl.DateTimeFormatOptions = hasStyle
    ? {}
    : {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      };

  const finalOptions = { ...baseOptions, ...(options ?? {}) };

  // Manual fallback for Kazakh month names
  if (lang === 'kk' && (finalOptions.month === 'long' || finalOptions.month === 'short')) {
    const day = d.getDate();
    const month = KK_MONTHS[d.getMonth()];
    const year = d.getFullYear();
    
    if (finalOptions.year === 'numeric') {
      return `${day} ${month} ${year} ж.`;
    }
    return `${day} ${month}`;
  }

  if (lang === 'ru' && finalOptions.month === 'long') {
    return d.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  const locale = getLocaleForLang(lang);
  return d.toLocaleDateString(locale, finalOptions);
}

