"use client";

import { TrendingUp, Users } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { getGlassCardStyle, getTextColors } from "@/utils/themeStyles";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface ComparisonData {
  my_avg: number;
  global_avg: number;
  percentile: number;
  total_students: number;
  distribution: Array<{ range: string; count: number; is_my_range: boolean }>;
  courses: Array<{ course_title: string; my_avg: number; topics_done: number }>;
}

export function ComparisonTab() {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const glassStyle = getGlassCardStyle(theme);
  const textColors = getTextColors(theme);
  const isDark = theme === "dark";

  const { data, isLoading } = useQuery({
    queryKey: ["student-comparison"],
    queryFn: async () => {
      const { data } = await api.get<ComparisonData>("/analytics/student-insights/comparison");
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="rounded-xl p-8 text-center" style={glassStyle}>
        <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto" />
        <p className="mt-3 text-sm" style={{ color: textColors.secondary }}>{t("loading")}</p>
      </div>
    );
  }

  if (!data || data.my_avg === 0) {
    return (
      <div className="rounded-xl p-8 text-center" style={glassStyle}>
        <Users className="w-10 h-10 mx-auto mb-3 text-gray-400" />
        <p className="text-sm" style={{ color: textColors.secondary }}>{t("comparisonEmpty")}</p>
      </div>
    );
  }

  const chartData = data.distribution.map((d) => ({
    range: d.range,
    count: d.count,
    isMine: d.is_my_range,
  }));

  return (
    <div className="space-y-4">
      {/* Top metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Percentile */}
        <div
          className="rounded-xl p-5 text-center relative overflow-hidden"
          style={{
            background: isDark
              ? "linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(139, 92, 246, 0.15) 100%)"
              : "linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(139, 92, 246, 0.06) 100%)",
            border: isDark ? "1px solid rgba(99, 102, 241, 0.3)" : "1px solid rgba(99, 102, 241, 0.15)",
          }}
        >
          <p className="text-4xl sm:text-5xl font-black bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">
            {data.percentile}%
          </p>
          <p className="text-xs mt-2 font-medium" style={{ color: textColors.secondary }}>
            {t("comparisonPercentile")} {data.percentile}{t("comparisonPercentileSuffix")}
          </p>
        </div>

        {/* My Score */}
        <div className="rounded-xl p-5 text-center" style={glassStyle}>
          <p className="text-3xl sm:text-4xl font-bold" style={{ color: "#14B8A6" }}>
            {data.my_avg}
          </p>
          <p className="text-xs mt-2 font-medium" style={{ color: textColors.secondary }}>
            {t("comparisonYourAvg")}
          </p>
        </div>

        {/* Global Score */}
        <div className="rounded-xl p-5 text-center" style={glassStyle}>
          <p className="text-3xl sm:text-4xl font-bold" style={{ color: textColors.primary }}>
            {data.global_avg}
          </p>
          <p className="text-xs mt-2 font-medium" style={{ color: textColors.secondary }}>
            {t("comparisonGlobalAvg")}
          </p>
          <p className="text-[10px] mt-1" style={{ color: textColors.secondary }}>
            {data.total_students} {t("comparisonStudents")}
          </p>
        </div>
      </div>

      {/* Distribution chart */}
      <div className="rounded-xl p-5" style={glassStyle}>
        <h3 className="font-bold text-sm mb-4" style={{ color: textColors.primary }}>
          {t("comparisonDistribution")}
        </h3>
        <div className="h-48 sm:h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barCategoryGap="20%">
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}
                vertical={false}
              />
              <XAxis
                dataKey="range"
                tick={{ fill: textColors.secondary, fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: textColors.secondary, fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  background: isDark ? "#1E293B" : "#FFFFFF",
                  border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.1)",
                  borderRadius: "12px",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                  color: textColors.primary,
                  fontSize: 13,
                }}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={48}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={index}
                    fill={
                      entry.isMine
                        ? "url(#myRangeGrad)"
                        : isDark
                        ? "rgba(148, 163, 184, 0.3)"
                        : "rgba(148, 163, 184, 0.4)"
                    }
                    stroke={entry.isMine ? "#6366F1" : "transparent"}
                    strokeWidth={entry.isMine ? 2 : 0}
                  />
                ))}
              </Bar>
              <defs>
                <linearGradient id="myRangeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366F1" />
                  <stop offset="100%" stopColor="#8B5CF6" />
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Per-course comparison */}
      {data.courses.length > 0 && (
        <div className="rounded-xl p-5" style={glassStyle}>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4" style={{ color: "#14B8A6" }} />
            <h3 className="font-bold text-sm" style={{ color: textColors.primary }}>
              {t("comparisonYourAvg")} — {t("courses")}
            </h3>
          </div>
          <div className="space-y-3">
            {data.courses.map((c) => {
              const pct = Math.min(100, c.my_avg);
              const barColor = c.my_avg >= 80 ? "#10B981" : c.my_avg >= 60 ? "#6366F1" : "#F59E0B";
              return (
                <div key={c.course_title}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium truncate" style={{ color: textColors.primary }}>
                      {c.course_title}
                    </span>
                    <span className="text-sm font-bold shrink-0 ml-2" style={{ color: barColor }}>
                      {c.my_avg}%
                    </span>
                  </div>
                  <div
                    className="h-2 rounded-full overflow-hidden"
                    style={{ background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, background: barColor }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
