"use client";

import { Trash2, FileText, ImageIcon, Video, File } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { useLanguage } from "@/context/LanguageContext";
import { getGlassCardStyle, getTextColors } from "@/utils/themeStyles";

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);
const VIDEO_EXT = new Set([".mp4", ".webm"]);
const DOC_EXT = new Set([".pdf", ".doc", ".docx", ".txt"]);

function getExt(url: string): string {
  const path = url.split("?")[0];
  const idx = path.lastIndexOf(".");
  return idx >= 0 ? path.slice(idx).toLowerCase() : "";
}

export function FileAttachmentCard({
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

  const fileName = url.split("/").pop()?.split("?")[0] || "file";
  const ext = getExt(url);
  const isImage = IMAGE_EXT.has(ext);
  const isVideo = VIDEO_EXT.has(ext);
  const isDoc = DOC_EXT.has(ext);

  let Icon = File;
  if (isImage) Icon = ImageIcon;
  else if (isVideo) Icon = Video;
  else if (isDoc) Icon = FileText;

  return (
    <div
      className="rounded-xl overflow-hidden flex items-stretch gap-3 min-h-0"
      style={glassStyle}
    >
      {isImage ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-16 h-16 shrink-0 bg-black/10 rounded-lg overflow-hidden"
        >
          <img
            src={url}
            alt=""
            className="w-full h-full object-cover"
          />
        </a>
      ) : (
        <div
          className="w-16 h-16 shrink-0 rounded-lg flex items-center justify-center"
          style={{
            background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
          }}
        >
          <Icon className="w-8 h-8" style={{ color: textColors.secondary }} />
        </div>
      )}
      <div className="flex-1 min-w-0 flex flex-col justify-center py-2">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium truncate hover:underline"
          style={{ color: linkColor }}
        >
          {fileName}
        </a>
        <span className="text-xs mt-0.5" style={{ color: textColors.secondary }}>
          {isImage ? t("fileTypeImage") : isVideo ? t("fileTypeVideo") : isDoc ? t("fileTypeDocument") : t("fileTypeFile")}
        </span>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 p-2 self-center rounded-lg text-red-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
        aria-label={t("remove")}
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}
