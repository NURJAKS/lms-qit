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

  // В реальности будет запрос к API
  const { data: progressData } = useQuery({
    queryKey: ["today-progress", metric],
    queryFn: async () => {
      // TODO: Replace with actual API call
      // const { data } = await api.get(`/dashboard/today-progress?metric=${metric}`);
      // return data;
      return {
        value: 532,
        change: 12,
        isPositive: true,
      };
    },
  });

  const value = progressData?.value ?? 0;
  const change = progressData?.change ?? 0;
  const isPositive = progressData?.isPositive ?? true;

  const metricLabels: Record<MetricType, string> = {
    lessons: t("lessonsCompleted" as any) || "Уроков завершено",
    assignments: t("assignmentsCompleted" as any) || "Заданий выполнено",
    tests: t("testsCompleted" as any) || "Тестов пройдено",
  };

  return (
    <div
      className="rounded-xl p-6 transition-all duration-300 hover:shadow-lg"
      style={cardStyle}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <ChevronDown className="w-4 h-4 rotate-180" style={{ color: textColors.secondary }} />
        <h3 className="text-sm font-medium" style={{ color: textColors.secondary }}>
          {t("todayProgress" as any) || "Сегодня"}
        </h3>
      </div>

      {/* Value */}
      <div className="mb-4">
        <p className="text-4xl font-bold mb-2" style={{ color: textColors.primary }}>
          {value.toLocaleString()}
        </p>
      </div>

      {/* Change indicator */}
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
          {isPositive ? (
            <TrendingUp className="w-3.5 h-3.5" />
          ) : (
            <TrendingDown className="w-3.5 h-3.5" />
          )}
          <span className="text-xs font-semibold">{Math.abs(change)}%</span>
        </div>
        <ChevronDown className="w-4 h-4" style={{ color: textColors.secondary }} />
      </div>
    </div>
  );
}
