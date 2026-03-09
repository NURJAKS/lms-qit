"use client";

import { TrendingUp, TrendingDown, BarChart3 } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { useLanguage } from "@/context/LanguageContext";
import { getDashboardCardStyle, getTextColors } from "@/utils/themeStyles";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";

type PerformanceMetric = {
  name: string;
  value: number;
  change: number;
  isPositive: boolean;
};

const generateMockMetrics = (): PerformanceMetric[] => {
  return [
    {
      name: "averageScore",
      value: 87,
      change: 5,
      isPositive: true,
    },
    {
      name: "completionRate",
      value: 92,
      change: 3,
      isPositive: true,
    },
    {
      name: "testAccuracy",
      value: 85,
      change: -2,
      isPositive: false,
    },
  ];
};

const getMetricLabel = (name: string, t: (k: string) => string) => {
  switch (name) {
    case "averageScore":
      return t("averageScore");
    case "completionRate":
      return t("completionRate");
    case "testAccuracy":
      return t("testAccuracy");
    default:
      return name;
  }
};

export function PerformanceMetricsWidget() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const cardStyle = getDashboardCardStyle(theme);
  const textColors = getTextColors(theme);
  const isDark = theme === "dark";

  const { data: metrics = generateMockMetrics() } = useQuery({
    queryKey: ["performance-metrics"],
    queryFn: async () => {
      // TODO: Replace with actual API call
      // const { data } = await api.get("/dashboard/performance-metrics");
      // return data;
      return generateMockMetrics();
    },
  });


  return (
    <div
      className="rounded-xl p-5 transition-all duration-300 hover:shadow-lg"
      style={cardStyle}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{
              background: isDark ? "rgba(139, 92, 246, 0.2)" : "rgba(139, 92, 246, 0.1)",
              color: "#8B5CF6",
            }}
          >
            <BarChart3 className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-semibold" style={{ color: textColors.primary }}>
            {t("performanceMetrics")}
          </h3>
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-3 gap-2.5 mb-4">
        {metrics.map((metric, index) => (
          <div
            key={index}
            className="p-3 rounded-lg text-center"
            style={{
              background: isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.02)",
            }}
          >
            <p className="text-2xl font-bold mb-1" style={{ color: textColors.primary }}>
              {metric.value}%
            </p>
            <p className="text-xs mb-1.5 line-clamp-2" style={{ color: textColors.secondary }}>
              {getMetricLabel(metric.name, t as (k: string) => string)}
            </p>
            <div className="flex items-center justify-center gap-1">
              {metric.isPositive ? (
                <TrendingUp className="w-3 h-3 text-green-500" />
              ) : (
                <TrendingDown className="w-3 h-3 text-red-500" />
              )}
              <span
                className={`text-xs font-semibold ${
                  metric.isPositive
                    ? isDark
                      ? "text-green-400"
                      : "text-green-600"
                    : isDark
                      ? "text-red-400"
                      : "text-red-600"
                }`}
              >
                {metric.change > 0 ? "+" : ""}
                {metric.change}%
              </span>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
