import type { Lang, TranslationKey } from "@/i18n/translations";

type TFunction = (key: TranslationKey) => string;

const WEEKDAY_FULL_KEYS = [
  "weekdaySun",
  "weekdayMon",
  "weekdayTue",
  "weekdayWed",
  "weekdayThu",
  "weekdayFri",
  "weekdaySat",
] as const satisfies readonly TranslationKey[];

interface FormatOptions {
  includeTime?: boolean;
  shortMonth?: boolean;
  use24h?: boolean;
}

export function formatLocalizedDate(
  iso: string | null | undefined,
  lang: Lang,
  t: TFunction,
  options: FormatOptions = {}
): string {
  if (!iso) return "";

  try {
    const date = new Date(iso);
    if (isNaN(date.getTime())) return iso;

    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    // Check for yesterday
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    if (isToday) {
      const timeStr = formatTime(date, lang, t, options.use24h);
      return t("today") + (options.includeTime ? ` ${t("atTime").replace("{time}", timeStr)}` : "");
    }

    if (isYesterday) {
      const timeStr = formatTime(date, lang, t, options.use24h);
      return t("yesterday") + (options.includeTime ? ` ${t("atTime").replace("{time}", timeStr)}` : "");
    }

    const day = date.getDate();
    const monthIndex = date.getMonth() + 1;
    const monthKey = (options.shortMonth ? `monthShort${monthIndex}` : `month${monthIndex}`) as TranslationKey;
    const monthName = t(monthKey);

    let result = "";
    if (lang === "en") {
      // English: Month Day, Year
      result = `${monthName} ${day}`;
    } else {
      // Kazakh/Russian: Day Month
      result = `${day} ${monthName}`;
    }

    if (options.includeTime) {
      const timeStr = formatTime(date, lang, t, options.use24h);
      result += ` ${t("atTime").replace("{time}", timeStr)}`;
    }

    return result;
  } catch (e) {
    return iso;
  }
}

/** Weekday + time using app translations (avoids Intl kk-KZ falling back to English weekdays). */
export function formatWeekdayLongAndTime(
  iso: string,
  lang: Lang,
  t: TFunction,
  options: { use24h?: boolean } = {}
): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return iso;
  const wd = t(WEEKDAY_FULL_KEYS[date.getDay()]);
  const timeStr = formatTime(date, lang, t, options.use24h);
  return `${wd}, ${timeStr}`;
}

function formatTime(date: Date, lang: Lang, t: TFunction, force24h?: boolean): string {
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");

  const use24h = force24h ?? (lang !== "en");

  if (use24h) {
    return `${hours.toString().padStart(2, "0")}:${minutes}`;
  } else {
    const ampmKey = hours >= 12 ? "pm" : "am";
    return `${hours % 12 || 12}:${minutes} ${t(ampmKey as TranslationKey)}`;
  }
}

export function formatRelativeDate(
  iso: string,
  lang: Lang,
  t: TFunction
): string {
  try {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffDays === 0) return t("today");
    if (diffDays === 1) return t("yesterday");

    return formatLocalizedDate(iso, lang, t, { shortMonth: true });
  } catch {
    return iso;
  }
}
