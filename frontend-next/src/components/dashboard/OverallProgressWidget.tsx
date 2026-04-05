"use client";

import { useState } from "react";
import { ChevronDown, TrendingDown, TrendingUp } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { useLanguage } from "@/context/LanguageContext";
import { getDashboardCardStyle, getTextColors } from "@/utils/themeStyles";
import { RadialProgressChart } from "./RadialProgressChart";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";

export function OverallProgressWidget() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [period, setPeriod] = useState<"total" | "week">("total");
  const cardStyle = getDashboardCardStyle(theme);
  const textColors = getTextColors(theme);
  const isDark = theme === "dark";

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const { data } = await api.get<{
        progress_percent: number;
      }>("/dashboard/stats");
      return data;
    },
  });

  const activityPeriod = period === "week" ? "7_days" : "30_days";
  const { data: activity } = useQuery({
    queryKey: ["learning-activity-sources", activityPeriod],
    queryFn: async () => {
      const { data } = await api.get<{ change_percent: number }>("/dashboard/learning-activity-sources", {
        params: { period: activityPeriod },
      });
      return data;
    },
  });

  const progress = stats?.progress_percent ?? 0;
  const change = activity?.change_percent ?? 0;
  const isPositive = change >= 0;

  return (
    <div className="rounded-xl p-6 transition-all duration-300 hover:shadow-lg" style={cardStyle}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold flex items-center gap-2" style={{ color: textColors.primary }}>
          {t("overallProgress")}
          <ChevronDown className="w-4 h-4" style={{ color: textColors.secondary }} />
        </h3>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setPeriod("total")}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              period === "total"
                ? "bg-blue-600 text-white"
                : isDark
                  ? "bg-white/10 text-white/70"
                  : "bg-gray-100 text-gray-600"
            }`}
          >
            {t("total")}
          </button>
          <button
            type="button"
            onClick={() => setPeriod("week")}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              period === "week"
                ? "bg-blue-600 text-white"
                : isDark
                  ? "bg-white/10 text-white/70"
                  : "bg-gray-100 text-gray-600"
            }`}
          >
            {t("forWeek")}
          </button>
        </div>
      </div>

      <div className="flex justify-center mb-6">
        {statsLoading ? (
          <div className="h-[180px] w-[180px] rounded-full animate-pulse bg-black/10 dark:bg-white/10" />
        ) : (
          <RadialProgressChart value={progress} size={180} strokeWidth={16} />
        )}
      </div>

      <div className="text-center">
        <p className="text-sm mb-2" style={{ color: textColors.secondary }}>
          {t("progress")} {progress}% {t("moreThanLastWeek")}
        </p>
        <div className="flex items-center justify-center gap-2">
          {isPositive ? (
            <TrendingUp className="w-4 h-4" style={{ color: "#10B981" }} />
          ) : (
            <TrendingDown className="w-4 h-4" style={{ color: "#EF4444" }} />
          )}
          <span
            className={`text-sm font-semibold ${
              isPositive ? (isDark ? "text-green-400" : "text-green-600") : isDark ? "text-red-400" : "text-red-600"
            }`}
          >
            {change > 0 ? "+" : ""}
            {change}%
          </span>
        </div>
      </div>
    </div>
  );
}
