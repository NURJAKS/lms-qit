"use client";

import { useMemo, useState } from "react";
import { ChevronDown, TrendingDown, TrendingUp, MoreVertical } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { useTheme } from "@/context/ThemeContext";
import { useLanguage } from "@/context/LanguageContext";
import { getDashboardCardStyle, getTextColors } from "@/utils/themeStyles";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";

type CourseProgressData = {
  name: string;
  progress: number;
  type: "programming" | "design" | "marketing" | "other";
};

type CourseProgressBarsResponse = {
  courses: CourseProgressData[];
  average_progress: number;
  improvement_percent: number;
};

const courseTypeColors: Record<string, string> = {
  programming: "#3B82F6",
  design: "#8B5CF6",
  marketing: "#F59E0B",
  other: "#64748B",
};

export function CourseProgressChart() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [sortBy, setSortBy] = useState<"progress" | "month">("progress");
  const [sourceFilter, setSourceFilter] = useState<"all" | string>("all");
  const cardStyle = getDashboardCardStyle(theme);
  const textColors = getTextColors(theme);
  const isDark = theme === "dark";

  const { data, isLoading } = useQuery({
    queryKey: ["course-progress-bars"],
    queryFn: async () => {
      const { data } = await api.get<CourseProgressBarsResponse>("/dashboard/course-progress-bars");
      return data;
    },
  });

  const courses = data?.courses ?? [];
  const averageProgress = data?.average_progress ?? 0;
  const improvement = data?.improvement_percent ?? 0;

  const sortedData = useMemo(() => {
    let rows =
      sourceFilter === "all" ? courses : courses.filter((c) => c.type === sourceFilter);
    if (sortBy === "progress") {
      return [...rows].sort((a, b) => b.progress - a.progress);
    }
    return [...rows].sort((a, b) => a.name.localeCompare(b.name));
  }, [courses, sourceFilter, sortBy]);

  const yMax = useMemo(() => {
    const m = Math.max(10, ...sortedData.map((d) => d.progress), Math.ceil(averageProgress));
    return Math.min(100, Math.ceil(m / 10) * 10);
  }, [sortedData, averageProgress]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div
          className="rounded-lg p-3 shadow-lg border"
          style={{
            background: isDark ? "rgba(26, 34, 56, 0.95)" : "rgba(255, 255, 255, 0.98)",
            borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
          }}
        >
          <p className="font-semibold text-sm" style={{ color: textColors.primary }}>
            {payload[0].payload.name}
          </p>
          <p className="text-sm" style={{ color: textColors.secondary }}>
            {t("progress")}: {payload[0].value}%
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="rounded-xl p-6 transition-all duration-300 hover:shadow-lg" style={cardStyle}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold" style={{ color: textColors.primary }}>
          {t("courseProgress")}
        </h3>
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "progress" | "month")}
              className="appearance-none pr-8 pl-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors"
              style={{
                background: isDark ? "rgba(255, 255, 255, 0.08)" : "#F3F4F6",
                color: textColors.primary,
                border: "none",
              }}
            >
              <option value="progress">{t("sortByProgress")}</option>
              <option value="month">{t("sortByMonth")}</option>
            </select>
            <ChevronDown
              className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none"
              style={{ color: textColors.secondary }}
            />
          </div>
          <div className="relative">
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="appearance-none pr-8 pl-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors"
              style={{
                background: isDark ? "rgba(255, 255, 255, 0.08)" : "#F3F4F6",
                color: textColors.primary,
                border: "none",
              }}
            >
              <option value="all">{t("allSources")}</option>
              <option value="programming">{t("programming")}</option>
              <option value="design">{t("design")}</option>
              <option value="marketing">{t("marketing")}</option>
            </select>
            <ChevronDown
              className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none"
              style={{ color: textColors.secondary }}
            />
          </div>
          <button type="button" className="p-1.5 rounded-lg hover:bg-white/10 transition-colors" aria-hidden>
            <MoreVertical className="w-4 h-4" style={{ color: textColors.secondary }} />
          </button>
        </div>
      </div>

      <div className="mb-6">
        <div className="flex items-baseline gap-2 mb-2">
          <p className="text-4xl font-bold" style={{ color: textColors.primary }}>
            {averageProgress}%
          </p>
          <span className="text-sm font-medium ml-2" style={{ color: textColors.secondary }}>
            {t("averageProgress")}
          </span>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <div
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg ${
              improvement >= 0
                ? isDark
                  ? "bg-green-500/20 text-green-400"
                  : "bg-green-50 text-green-600"
                : isDark
                  ? "bg-red-500/20 text-red-400"
                  : "bg-red-50 text-red-600"
            }`}
          >
            {improvement >= 0 ? (
              <TrendingUp className="w-3.5 h-3.5" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5" />
            )}
            <span className="text-xs font-semibold">
              {improvement >= 0 ? "+" : ""}
              {improvement}%
            </span>
          </div>
          <span className="text-xs" style={{ color: textColors.secondary }}>
            {t("betterThanLastMonth")}
          </span>
        </div>
      </div>

      <div className="h-64 -mx-2">
        {isLoading ? (
          <div className="h-full rounded-lg animate-pulse bg-black/5 dark:bg-white/5" />
        ) : sortedData.length === 0 ? (
          <p className="text-sm text-center py-16" style={{ color: textColors.secondary }}>
            {t("noData")}
          </p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sortedData} margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.05)"}
                vertical={false}
              />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: textColors.secondary }}
                stroke={isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)"}
              />
              <YAxis
                domain={[0, yMax]}
                tick={{ fontSize: 11, fill: textColors.secondary }}
                stroke={isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)"}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="progress" radius={[8, 8, 0, 0]}>
                {sortedData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={courseTypeColors[entry.type] || "#64748B"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div
        className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t"
        style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.08)" }}
      >
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: courseTypeColors.programming }} />
          <span className="text-xs" style={{ color: textColors.secondary }}>
            {t("programming")}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: courseTypeColors.design }} />
          <span className="text-xs" style={{ color: textColors.secondary }}>
            {t("design")}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: courseTypeColors.marketing }} />
          <span className="text-xs" style={{ color: textColors.secondary }}>
            {t("marketing")}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: courseTypeColors.other }} />
          <span className="text-xs" style={{ color: textColors.secondary }}>
            {t("other")}
          </span>
        </div>
      </div>
    </div>
  );
}
