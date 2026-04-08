"use client";

import { Trash2, Link as LinkIcon } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { useLanguage } from "@/context/LanguageContext";
import { getGlassCardStyle, getTextColors } from "@/utils/themeStyles";

function getHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function LinkAttachmentCard({
  url,
  onRemove,
}: {
  url: string;
  onRemove: () => void;
}) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const isDark = theme === "dark";
  const glassStyle = getGlassCardStyle(theme);
  const textColors = getTextColors(theme);
  const linkColor = isDark ? "#60A5FA" : "#3B82F6";

  const host = getHost(url);

  return (
    <div
      className="rounded-xl overflow-hidden flex items-center gap-3 px-3 py-2"
      style={glassStyle}
    >
      <div
        className="w-10 h-10 shrink-0 rounded-lg flex items-center justify-center"
        style={{
          background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
        }}
      >
        <LinkIcon className="w-5 h-5" style={{ color: textColors.secondary }} />
      </div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 min-w-0 text-sm truncate hover:underline"
        style={{ color: linkColor }}
      >
        {host}
      </a>
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 p-1.5 rounded-lg text-red-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
        aria-label={t("remove")}
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}
