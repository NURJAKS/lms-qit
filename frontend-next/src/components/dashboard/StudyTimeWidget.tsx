"use client";

import { Clock, TrendingDown, TrendingUp, BookOpen } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { useLanguage } from "@/context/LanguageContext";
import { getDashboardCardStyle, getTextColors } from "@/utils/themeStyles";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";

type StudyTimeSummary = {
  total_minutes: number;
  today_minutes: number;
  week_minutes: number;
  month_minutes: number;
  change_percent: number;
  is_positive: boolean;
};

function formatTime<K extends string>(minutes: number, t: (k: K) => string): string {
  const T = t as (k: string) => string;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} ${T("unitMinute")}`;
  if (mins === 0) return `${hours} ${T("unitHour")}`;
  return `${hours} ${T("unitHour")} ${mins} ${T("unitMinute")}`;
}

export function StudyTimeWidget() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const cardStyle = getDashboardCardStyle(theme);
  const textColors = getTextColors(theme);
  const isDark = theme === "dark";

  const { data, isLoading } = useQuery({
    queryKey: ["study-time-summary"],
    queryFn: async () => {
      const { data } = await api.get<StudyTimeSummary>("/dashboard/study-time-summary");
      return data;
    },
  });

  const studyData = {
    today: data?.today_minutes ?? 0,
    week: data?.week_minutes ?? 0,
    month: data?.month_minutes ?? 0,
    change: data?.change_percent ?? 0,
    isPositive: data?.is_positive ?? true,
  };

  return (
    <div
      className="h-full flex flex-col rounded-xl p-2.5 transition-all duration-300 hover:shadow-lg"
      style={cardStyle}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <div
            className="w-6 h-6 rounded-lg flex items-center justify-center"
            style={{
              background: isDark ? "rgba(59, 130, 246, 0.2)" : "rgba(59, 130, 246, 0.1)",
              color: "#3B82F6",
            }}
          >
            <Clock className="w-3 h-3" />
          </div>
          <h3 className="text-xs font-semibold" style={{ color: textColors.primary }}>
            {t("studyTime")}
          </h3>
        </div>
      </div>

      <div className="mb-1.5">
        {isLoading ? (
          <div className="h-8 w-24 rounded animate-pulse bg-black/10 dark:bg-white/10" />
        ) : (
          <>
            <p className="text-lg font-bold mb-0.5" style={{ color: textColors.primary }}>
              {formatTime(studyData.today, t)}
            </p>
            <p className="text-[10px] font-medium" style={{ color: textColors.secondary }}>
              {t("today")}
            </p>
          </>
        )}
      </div>

      <div className="flex-1 space-y-1 mb-1">
        <div
          className="flex items-center justify-between p-1 rounded-lg"
          style={{
            background: isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.02)",
          }}
        >
          <div className="flex items-center gap-1.5">
            <BookOpen className="w-2.5 h-2.5" style={{ color: textColors.secondary }} />
            <span className="text-[10px]" style={{ color: textColors.secondary }}>
              {t("thisWeek")}
            </span>
          </div>
          <span className="text-[10px] font-semibold" style={{ color: textColors.primary }}>
            {isLoading ? "—" : formatTime(studyData.week, t)}
          </span>
        </div>
        <div
          className="flex items-center justify-between p-1 rounded-lg"
          style={{
            background: isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.02)",
          }}
        >
          <div className="flex items-center gap-1.5">
            <BookOpen className="w-2.5 h-2.5" style={{ color: textColors.secondary }} />
            <span className="text-[10px]" style={{ color: textColors.secondary }}>
              {t("thisMonth")}
            </span>
          </div>
          <span className="text-[10px] font-semibold" style={{ color: textColors.primary }}>
            {isLoading ? "—" : formatTime(studyData.month, t)}
          </span>
        </div>
      </div>

      <div
        className="flex items-center gap-1 pt-1.5 border-t"
        style={{
          borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.08)",
        }}
      >
        <div
          className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg ${
            studyData.isPositive
              ? isDark
                ? "bg-green-500/20 text-green-400"
                : "bg-green-50 text-green-600"
              : isDark
                ? "bg-red-500/20 text-red-400"
                : "bg-red-50 text-red-600"
          }`}
        >
          {studyData.isPositive ? (
            <TrendingUp className="w-2.5 h-2.5" />
          ) : (
            <TrendingDown className="w-2.5 h-2.5" />
          )}
          <span className="text-[10px] font-semibold">
            {studyData.isPositive ? "+" : ""}
            {studyData.change}%
          </span>
        </div>
        <span className="text-[9px] leading-tight" style={{ color: textColors.secondary }}>
          {t("comparedToLastWeek")}
        </span>
      </div>
    </div>
  );
}
