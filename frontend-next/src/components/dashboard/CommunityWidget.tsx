"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  MessageCircle,
  Target,
  Lightbulb,
  Crown,
  ArrowRight,
  Users,
} from "lucide-react";
import { api } from "@/api/client";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { getGlassCardStyle, getTextColors } from "@/utils/themeStyles";

interface CommunityPostPreview {
  id: number;
  text: string;
  tag: "strategy" | "tip";
  author: {
    id: number;
    full_name: string;
    is_premium: number;
  };
}

export function CommunityWidget() {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const glassStyle = getGlassCardStyle(theme);
  const textColors = getTextColors(theme);
  const isDark = theme === "dark";

  const { data: previews = [] } = useQuery({
    queryKey: ["community-widget-posts"],
    queryFn: async () => {
      const { data } = await api.get<CommunityPostPreview[]>("/community/posts?limit=3");
      return data;
    },
  });

  const tagStyles = {
    strategy: { color: "#3B82F6", bg: isDark ? "rgba(59, 130, 246, 0.15)" : "rgba(59, 130, 246, 0.1)" },
    tip: { color: "#F59E0B", bg: isDark ? "rgba(245, 158, 11, 0.15)" : "rgba(245, 158, 11, 0.1)" },
  };

  return (
    <div className="h-full flex flex-col rounded-xl overflow-hidden" style={glassStyle}>
      {/* Header */}
      <div
        className="p-3.5 text-white flex items-center justify-between relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #7C3AED 0%, #2563EB 100%)" }}
      >
        <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-white/10 blur-2xl" />
        <div className="flex items-center gap-2 relative z-10">
          <Users className="w-4 h-4" />
          <h3 className="font-bold text-sm sm:text-base">{t("communityTitle")}</h3>
        </div>
        <div className="flex items-center gap-1 text-white/80 text-xs relative z-10">
          <MessageCircle className="w-3 h-3" />
          <span>{previews.length}</span>
        </div>
      </div>

      {/* Preview messages */}
      <div className="flex-1 p-3.5 space-y-2.5">
        {previews.map((msg) => {
          const ts = tagStyles[msg.tag];
          const TagIcon = msg.tag === "strategy" ? Target : Lightbulb;
          return (
            <div
              key={msg.id}
              className="p-3 rounded-lg"
              style={{
                background: isDark ? "rgba(30, 41, 59, 0.4)" : "rgba(0, 0, 0, 0.02)",
                border: `1px solid ${isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.04)"}`,
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs sm:text-sm font-semibold line-clamp-1" style={{ color: textColors.primary }}>
                  {msg.author.full_name}
                </span>
                {msg.author.is_premium === 1 && (
                  <Crown className="w-3 h-3" style={{ color: "#7C3AED" }} />
                )}
                <span
                  className="ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0"
                  style={{ background: ts.bg, color: ts.color }}
                >
                  <TagIcon className="w-2.5 h-2.5" />
                  {msg.tag === "strategy" ? t("communityTagStrategy") : t("communityTagTip")}
                </span>
              </div>
              <p className="text-xs sm:text-sm line-clamp-2 leading-relaxed mobile-safe-text" style={{ color: textColors.secondary }}>
                {msg.text}
              </p>
            </div>
          );
        })}
        {previews.length === 0 && (
          <div
            className="p-2.5 rounded-lg text-xs"
            style={{
              background: isDark ? "rgba(30, 41, 59, 0.4)" : "rgba(0, 0, 0, 0.02)",
              border: `1px solid ${isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.04)"}`,
              color: textColors.secondary,
            }}
          >
            {t("communityEmptyDescription")}
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="p-3.5 pt-0">
        <Link
          href="/app/community"
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl font-medium text-sm transition-all hover:opacity-90 text-white"
          style={{ background: "linear-gradient(135deg, #7C3AED 0%, #2563EB 100%)" }}
        >
          {t("communitySidebarLink")}
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
