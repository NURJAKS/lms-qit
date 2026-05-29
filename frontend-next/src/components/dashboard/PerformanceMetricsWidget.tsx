"use client";

import { TrendingUp, BarChart3, Lock } from "lucide-react";
import Link from "next/link";
import { useTheme } from "@/context/ThemeContext";
import { useLanguage } from "@/context/LanguageContext";
import { getDashboardCardStyle, getTextColors } from "@/utils/themeStyles";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";

export function PerformanceMetricsWidget() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const cardStyle = getDashboardCardStyle(theme);
  const textColors = getTextColors(theme);
  const isDark = theme === "dark";

  const { data, isLoading } = useQuery({
    queryKey: ["student-performance"],
    queryFn: async () => {
      const { data } = await api.get("/analytics/student/me/performance");
      return data;
    },
  });

  const isPremium = data?.is_premium;
  const performance = data?.performance || [];

  if (isLoading) {
    return (
      <div className="rounded-xl p-5 animate-pulse" style={cardStyle}>
        <div className="h-40 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
      </div>
    );
  }

  return (
    <div
      className="relative rounded-xl p-5 transition-all duration-300 hover:shadow-lg overflow-hidden"
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
        {performance.length > 0 ? (
          performance.slice(-3).map((p: any, index: number) => (
            <div
              key={index}
              className="p-3 rounded-lg text-center"
              style={{
                background: isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.02)",
              }}
            >
              <p className="text-2xl font-bold mb-1" style={{ color: textColors.primary }}>
                {p.avg_quiz_score}%
              </p>
              <p className="text-[10px] mb-1.5 line-clamp-1" style={{ color: textColors.secondary }}>
                {p.date}
              </p>
              <div className="flex items-center justify-center gap-1">
                <TrendingUp className="w-3 h-3 text-green-500" />
                <span className="text-[10px] font-semibold text-green-500">
                  {t("topicsCount").replace("{count}", String(p.topics_completed))}
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-3 py-4 text-center text-sm text-gray-500">
            {t("noPerformanceData")}
          </div>
        )}
      </div>

      {/* Premium Overlay */}
      {!isPremium && (
        <div className="absolute inset-0 z-10 bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
          <Lock className="w-8 h-8 text-purple-600 mb-2" />
          <h4 className="font-bold text-gray-900 dark:text-white mb-1">
            {t("premiumAnalyticsTitle")}
          </h4>
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
            {t("premiumAnalyticsDesc")}
          </p>
          <Link
            href="/app/premium"
            className="px-4 py-2 rounded-lg bg-purple-600 text-white text-xs font-semibold hover:bg-purple-700 transition-colors"
          >
            {t("unlockPremium")}
          </Link>
        </div>
      )}
    </div>
  );
}
