"use client";

import Link from "next/link";
import { Clock, BookOpen, UserPlus, CheckCircle2 } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useTheme } from "@/context/ThemeContext";
import { getGlassCardStyle, getTextColors } from "@/utils/themeStyles";
import { getLocalizedCourseTitle } from "@/lib/courseUtils";

// Simple time formatter without date-fns dependency
const formatTimeAgo = (dateStr: string, lang: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return lang === "ru" ? "только что" : lang === "kk" ? "дәл қазір" : "just now";
  if (diffMins < 60) return `${diffMins} ${lang === "ru" ? "мин назад" : lang === "kk" ? "мин бұрын" : "min ago"}`;
  if (diffHours < 24) return `${diffHours} ${lang === "ru" ? "ч назад" : lang === "kk" ? "сағ бұрын" : "h ago"}`;
  return `${diffDays} ${lang === "ru" ? "дн назад" : lang === "kk" ? "күн бұрын" : "d ago"}`;
};

export function ActivityFeedWidget() {
  const { t, lang } = useLanguage();
  const { theme } = useTheme();
  const glassStyle = getGlassCardStyle(theme);
  const textColors = getTextColors(theme);

  // Mock activity feed - в реальности это будет API endpoint
  const { data: activities = [] } = useQuery({
    queryKey: ["teacher-activity-feed"],
    queryFn: async () => {
      try {
        // Пока используем события как источник активности
        const { data } = await api.get<Array<{
          id: number;
          scheduled_date: string;
          notes: string | null;
          course_title: string | null;
          topic_title: string | null;
        }>>("/dashboard/events");
        
        return data.slice(0, 5).map((e, idx) => ({
          id: e.id,
          type: idx % 3 === 0 ? "submission" : idx % 3 === 1 ? "assignment" : "student",
          message: e.notes || (e.course_title ? getLocalizedCourseTitle({ title: e.course_title } as any, t) : null) || e.topic_title || t("leaderboardActivity"),
          time: e.scheduled_date,
        }));
      } catch {
        return [];
      }
    },
  });

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "submission":
        return <CheckCircle2 className="w-4 h-4" />;
      case "assignment":
        return <BookOpen className="w-4 h-4" />;
      case "student":
        return <UserPlus className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case "submission":
        return "#10b981";
      case "assignment":
        return "#8B5CF6";
      case "student":
        return "#FF4181";
      default:
        return textColors.secondary;
    }
  };

  const isDark = theme === "dark";

  return (
    <div className="rounded-unified-lg overflow-hidden backdrop-blur-xl card-glow-hover" style={glassStyle}>
      <div className="p-4 text-white flex items-center justify-between relative overflow-hidden" style={{ background: "linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)" }}>
        {/* Decorative glow */}
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-20 blur-2xl bg-white dark:bg-gray-800" />
        <h3 className="font-semibold text-sm relative z-10">{t("recentActivity")}</h3>
      </div>

      <div className="p-4">
        {activities.length === 0 ? (
          <p className="text-sm py-6 text-center" style={{ color: textColors.secondary }}>
            {t("noActivity")}
          </p>
        ) : (
          <div className="space-y-3">
            {activities.map((activity) => {
              const color = getActivityColor(activity.type);
              const timeAgo = formatTimeAgo(activity.time, lang);

              return (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 p-3.5 rounded-xl hover:scale-[1.02] transition-all group"
                  style={{
                    background: isDark 
                      ? "rgba(30, 41, 59, 0.4)" 
                      : "rgba(0, 0, 0, 0.04)",
                    border: `1px solid ${isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)"}`,
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-white"
                    style={{ background: color }}
                  >
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium line-clamp-2 group-hover:text-[#3B82F6] transition-colors" style={{ color: textColors.primary }}>
                      {activity.message}
                    </p>
                    <p className="text-xs mt-1" style={{ color: textColors.secondary }}>
                      {timeAgo}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <Link
          href="/app/teacher"
          className="mt-4 flex items-center justify-center w-full py-2.5 rounded-xl font-medium text-sm transition-all hover:bg-blue-50 dark:hover:bg-blue-500/10"
          style={{ color: "#3B82F6" }}
        >
          {t("viewAll")}
        </Link>
      </div>
    </div>
  );
}
