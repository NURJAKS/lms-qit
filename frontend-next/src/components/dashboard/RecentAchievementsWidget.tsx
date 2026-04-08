"use client";

import { Trophy, Award, Star, Medal } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { useLanguage } from "@/context/LanguageContext";
import { getDashboardCardStyle, getTextColors } from "@/utils/themeStyles";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { formatDateLocalized } from "@/lib/dateUtils";


type Achievement = {
  id: number;
  title_key: string;
  description_key: string;
  title: string;
  description: string;
  icon: "trophy" | "award" | "star" | "medal";
  date: string;
  color: string;
};

const getIcon = (icon: Achievement["icon"]) => {
  switch (icon) {
    case "trophy":
      return Trophy;
    case "award":
      return Award;
    case "star":
      return Star;
    case "medal":
      return Medal;
    default:
      return Trophy;
  }
};

function formatDate<K extends string>(dateStr: string, t: (k: K) => string, lang: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  const T = t as (k: string) => string;
  if (diffDays === 0) return T("today");
  if (diffDays === 1) return T("yesterday");
  if (diffDays < 7) return T("daysAgo").replace("{count}", String(diffDays));
  return formatDateLocalized(dateStr, lang, { day: "numeric", month: "short" });

}

export function RecentAchievementsWidget() {
  const { theme } = useTheme();
  const { t, lang } = useLanguage();
  const cardStyle = getDashboardCardStyle(theme);
  const textColors = getTextColors(theme);
  const isDark = theme === "dark";

  const { data: achievementsRaw = [] } = useQuery({
    queryKey: ["recent-achievements"],
    queryFn: async () => {
      const { data } = await api.get<Array<{
        id: number;
        title_key: string;
        description_key: string;
        icon: "trophy" | "award" | "star" | "medal";
        date: string;
        color: string;
      }>>("/dashboard/achievements");
      return data;
    },
  });

  // Преобразуем данные API с переводами
  const achievements: Achievement[] = achievementsRaw.map((item) => ({
    ...item,
    title: t(item.title_key as any),
    description: t(item.description_key as any),
  }));

  return (
    <div
      className="rounded-xl p-5 transition-all duration-300 hover:shadow-lg"
      style={cardStyle}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold" style={{ color: textColors.primary }}>
          {t("recentAchievements")}
        </h3>
      </div>

      {/* Achievements list */}
      <div className="space-y-3">
        {achievements.slice(0, 3).map((achievement) => {
          const Icon = getIcon(achievement.icon);
          return (
            <div
              key={achievement.id}
              className="flex items-start gap-3 p-2.5 rounded-lg transition-colors hover:bg-opacity-50"
              style={{
                background: isDark 
                  ? "rgba(255, 255, 255, 0.04)" 
                  : "rgba(0, 0, 0, 0.02)",
              }}
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                style={{
                  background: `${achievement.color}20`,
                  color: achievement.color,
                }}
              >
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold mb-0.5" style={{ color: textColors.primary }}>
                  {achievement.title}
                </p>
                <p className="text-xs mb-0.5 line-clamp-1" style={{ color: textColors.secondary }}>
                  {achievement.description}
                </p>
                <p className="text-xs" style={{ color: textColors.secondary }}>
                  {formatDate(achievement.date, t, lang)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
