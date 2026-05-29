"use client";

import { useState } from "react";
import { ChevronDown, TrendingUp, TrendingDown } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { useLanguage } from "@/context/LanguageContext";
import { getDashboardCardStyle, getTextColors } from "@/utils/themeStyles";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";

type MetricType = "lessons" | "assignments" | "tests";

export function TodayProgressWidget() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [metric, setMetric] = useState<MetricType>("lessons");
  const cardStyle = getDashboardCardStyle(theme);
  const textColors = getTextColors(theme);
  const isDark = theme === "dark";

  const { data: progressData, isLoading } = useQuery({
    queryKey: ["today-progress", metric],
    queryFn: async () => {
      const { data } = await api.get<{ value: number; change: number; is_positive: boolean }>(
        "/dashboard/today-progress",
        { params: { metric } }
      );
      return data;
    },
  });

  const value = progressData?.value ?? 0;
  const change = progressData?.change ?? 0;
  const isPositive = progressData?.is_positive ?? true;

  const metricLabels: Record<MetricType, string> = {
    lessons: t("lessonsCompleted"),
    assignments: t("assignmentsCompleted"),
    tests: t("testsCompleted"),
  };

  return (
    <div className="rounded-xl p-6 transition-all duration-300 hover:shadow-lg" style={cardStyle}>
      <div className="flex items-center gap-2 mb-3">
        <ChevronDown className="w-4 h-4 rotate-180" style={{ color: textColors.secondary }} />
        <h3 className="text-sm font-medium" style={{ color: textColors.secondary }}>
          {t("todayProgress")}
        </h3>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {(Object.keys(metricLabels) as MetricType[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMetric(m)}
            className={`text-xs px-2 py-1 rounded-lg transition-colors ${
              metric === m
                ? "bg-blue-600 text-white"
                : isDark
                  ? "bg-white/10 text-white/80 hover:bg-white/15"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {metricLabels[m]}
          </button>
        ))}
      </div>

      <div className="mb-4">
        {isLoading ? (
          <div className="h-12 w-20 rounded animate-pulse bg-black/10 dark:bg-white/10" />
        ) : (
          <p className="text-4xl font-bold mb-2" style={{ color: textColors.primary }}>
            {value.toLocaleString()}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div
          className={`flex items-center gap-1 px-2 py-1 rounded-lg ${
            isPositive
              ? isDark
                ? "bg-green-500/20 text-green-400"
                : "bg-green-50 text-green-600"
              : isDark
                ? "bg-red-500/20 text-red-400"
                : "bg-red-50 text-red-600"
          }`}
        >
          {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
          <span className="text-xs font-semibold">{Math.abs(change)}%</span>
        </div>
        <ChevronDown className="w-4 h-4" style={{ color: textColors.secondary }} />
      </div>
    </div>
  );
}
