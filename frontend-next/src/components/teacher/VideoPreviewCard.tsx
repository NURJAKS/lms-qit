"use client";

import { Trash2 } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { getGlassCardStyle, getTextColors } from "@/utils/themeStyles";
import { useLanguage } from "@/context/LanguageContext";

function getYoutubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1).split("?")[0] || null;
    if (u.hostname.includes("youtube.com")) return u.searchParams.get("v");
    return null;
  } catch {
    return null;
  }
}

function isVimeo(url: string): boolean {
  try {
    return new URL(url).hostname.includes("vimeo.com");
  } catch {
    return false;
  }
}

export function VideoPreviewCard({
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

  const fileName = url.startsWith("/") ? url.split("/").pop() || "video" : url;
  const youtubeId = getYoutubeId(url);
  const vimeo = isVimeo(url);
  const isLocal = url.startsWith("/uploads/");

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        ...glassStyle,
        padding: 0,
      }}
    >
      <div className="relative aspect-video bg-black/20">
        {isLocal && (
          <video
            src={url}
            preload="metadata"
            muted
            playsInline
            className="w-full h-full object-contain"
          />
        )}
        {youtubeId && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full h-full"
          >
            <img
              src={`https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`}
              alt="YouTube"
              className="w-full h-full object-cover"
            />
          </a>
        )}
        {vimeo && !youtubeId && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full h-full items-center justify-center"
            style={{ background: isDark ? "rgba(30,41,59,0.9)" : "rgba(0,0,0,0.06)" }}
          >
            <span className="text-sm font-medium" style={{ color: textColors.secondary }}>
              Vimeo
            </span>
          </a>
        )}
        {!isLocal && !youtubeId && !vimeo && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full h-full items-center justify-center"
            style={{ background: isDark ? "rgba(30,41,59,0.9)" : "rgba(0,0,0,0.06)" }}
          >
            <span className="text-sm truncate px-2" style={{ color: linkColor }}>
              {fileName}
            </span>
          </a>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="truncate text-sm hover:underline"
          style={{ color: linkColor }}
        >
          {isLocal ? fileName : youtubeId ? "YouTube" : vimeo ? "Vimeo" : fileName}
        </a>
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 p-1 rounded-lg text-red-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
          aria-label={t("remove")}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
