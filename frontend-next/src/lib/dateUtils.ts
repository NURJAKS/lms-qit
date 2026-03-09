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
  const baseOptions: Intl.DateTimeFormatOptions =
    lang === "en"
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

export function formatDateLocalized(
  value: DateInput,
  lang: Lang | string | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  const d = normalizeDate(value);
  if (!d) return "—";

  const locale = getLocaleForLang(lang);
  const baseOptions: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  };

  return d.toLocaleDateString(locale, { ...baseOptions, ...(options ?? {}) });
}

