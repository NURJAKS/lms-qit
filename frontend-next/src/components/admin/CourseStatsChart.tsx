"use client";

import { useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { useTheme } from "@/context/ThemeContext";
import { useLanguage } from "@/context/LanguageContext";
import { BookOpen } from "lucide-react";
import { COURSE_TITLE_KEYS } from "@/lib/courseUtils";

type CourseStat = {
  course_id: number;
  title?: string;
  enrollments: number;
  completed_topics: number;
  total_topics?: number;
};

type TimeRange = "all" | "top5" | "top10";

interface CourseStatsChartProps {
  courseStats: CourseStat[];
}

export function CourseStatsChart({ courseStats }: CourseStatsChartProps) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const isDark = theme === "dark";
  const [timeRange, setTimeRange] = useState<TimeRange>("all");

  // Подготовка данных для графика
  const chartData = useMemo(() => {
    // Сортируем курсы по enrollments (популярности)
    const sorted = [...courseStats].sort((a, b) => b.enrollments - a.enrollments);
    
    // Фильтруем по выбранному диапазону
    let filtered = sorted;
    if (timeRange === "top5") {
      filtered = sorted.slice(0, 5);
    } else if (timeRange === "top10") {
      filtered = sorted.slice(0, 10);
    }

    // Формируем данные для графика
    return filtered.map((course, index) => {
      const titleKey = course.title ? COURSE_TITLE_KEYS[course.title] : null;
      const localizedTitle = titleKey ? t(titleKey as any) : (course.title || `${t("course")} #${course.course_id}`);
      
      return {
        name: localizedTitle,
        shortName: localizedTitle.length > 20 
          ? localizedTitle.substring(0, 20) + "..." 
          : localizedTitle,
        enrollments: course.enrollments,
        completed: course.completed_topics,
        index,
      };
    });
  }, [courseStats, timeRange, t]);

  const maxValue = useMemo(() => {
    if (chartData.length === 0) return 100;
    return Math.max(
      ...chartData.map((d) => Math.max(d.enrollments, d.completed)),
      100
    );
  }, [chartData]);

  // Форматирование значений для Y-axis
  const formatYAxis = (value: number) => {
    if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
    return value.toString();
  };

  // Кастомный tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const enrollments = payload.find((p: any) => p.dataKey === "enrollments")?.value || 0;
      const completed = payload.find((p: any) => p.dataKey === "completed")?.value || 0;
      const change = completed > 0 ? Math.round((completed / enrollments) * 100) : 0;

      return (
        <div
          className="rounded-xl p-4 shadow-xl border backdrop-blur-xl"
          style={{
            background: isDark 
              ? "rgba(26, 34, 56, 0.95)" 
              : "rgba(255, 255, 255, 0.98)",
            border: isDark 
              ? "1px solid rgba(255, 255, 255, 0.15)" 
              : "1px solid rgba(0, 0, 0, 0.1)",
            boxShadow: isDark 
              ? "0 8px 32px rgba(0, 0, 0, 0.5)" 
              : "0 8px 32px rgba(0, 0, 0, 0.15)",
          }}
        >
          <p className={`text-sm font-medium mb-2 ${isDark ? "text-gray-300" : "text-gray-600"}`}>
            {data.name}
          </p>
          <div className="flex items-center gap-3">
            <p className={`text-2xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
              {enrollments.toLocaleString()}
            </p>
            {change > 0 && (
              <span
                className="px-2 py-1 rounded-lg text-xs font-semibold"
                style={{ background: "rgba(16, 185, 129, 0.2)", color: "#10B981" }}
              >
                +{change}%
              </span>
            )}
          </div>
          <p className={`text-xs mt-1 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
            {completed} {t("adminCompleted")}
          </p>
        </div>
      );
    }
    return null;
  };

  if (chartData.length === 0) {
    return (
      <div 
        className="rounded-unified-lg p-6 border-0 backdrop-blur-xl relative overflow-hidden"
        style={{ 
          background: isDark 
            ? "linear-gradient(135deg, rgba(26, 34, 56, 0.95) 0%, rgba(30, 41, 59, 0.9) 100%)" 
            : "linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(255, 255, 255, 0.95) 100%)",
          backdropFilter: "blur(20px) saturate(180%)",
          border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid rgba(0, 0, 0, 0.06)",
        }}
      >
        <p className={`text-center py-8 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
          {t("adminCourseStatsEmpty")}
        </p>
      </div>
    );
  }

  return (
    <div 
      className="rounded-unified-lg p-6 border-0 backdrop-blur-xl relative overflow-hidden"
      style={{ 
        background: isDark 
          ? "linear-gradient(135deg, rgba(26, 34, 56, 0.95) 0%, rgba(30, 41, 59, 0.9) 100%)" 
          : "linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(255, 255, 255, 0.95) 100%)",
        backdropFilter: "blur(20px) saturate(180%)",
        border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid rgba(0, 0, 0, 0.06)",
        boxShadow: isDark 
          ? "0 8px 32px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.2)" 
          : "0 8px 32px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04)",
      }}
    >
      {/* Decorative gradient glow */}
      <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-10 blur-3xl" style={{ background: "linear-gradient(135deg, #3B82F6, #8B5CF6)" }} />
      
      <div className="relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)" }}
            >
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <h2 className={`font-geologica font-bold text-xl ${isDark ? "text-white" : "text-gray-900"}`}>
              {t("adminCourseStats")}
            </h2>
          </div>

          {/* Time range selectors */}
          <div className="flex items-center gap-2">
            {[
              { key: "all" as TimeRange, label: t("coursesFilterAll") },
              { key: "top10" as TimeRange, label: "Top 10" },
              { key: "top5" as TimeRange, label: "Top 5" },
            ].map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setTimeRange(key)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  timeRange === key
                    ? "text-white"
                    : isDark
                      ? "text-gray-400 hover:text-white"
                      : "text-gray-600 hover:text-gray-900"
                }`}
                style={
                  timeRange === key
                    ? {
                        background: "linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)",
                        boxShadow: "0 4px 12px rgba(59, 130, 246, 0.4)",
                      }
                    : {
                        border: isDark 
                          ? "1px solid rgba(255, 255, 255, 0.1)" 
                          : "1px solid rgba(0, 0, 0, 0.1)",
                      }
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Chart */}
        <div className="h-80 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
            >
              <defs>
                <linearGradient id="enrollmentsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="completedGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke={isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)"}
                vertical={false}
              />
              <XAxis
                dataKey="shortName"
                tick={{ fontSize: 11, fill: isDark ? "#94A3B8" : "#64748B" }}
                stroke={isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)"}
                angle={45}
                textAnchor="start"
                height={90}
              />
              <YAxis
                tick={{ fontSize: 11, fill: isDark ? "#94A3B8" : "#64748B" }}
                stroke={isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)"}
                tickFormatter={formatYAxis}
                domain={[0, Math.ceil(maxValue * 1.1)]}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="enrollments"
                stroke="#3B82F6"
                strokeWidth={2.5}
                fill="url(#enrollmentsGradient)"
                dot={{ fill: "#3B82F6", r: 4 }}
                activeDot={{ r: 6, fill: "#3B82F6" }}
              />
              <Area
                type="monotone"
                dataKey="completed"
                stroke="#8B5CF6"
                strokeWidth={2.5}
                fill="url(#completedGradient)"
                dot={{ fill: "#8B5CF6", r: 4 }}
                activeDot={{ r: 6, fill: "#8B5CF6" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ background: "#3B82F6" }} />
            <span className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>
              {t("adminEnrollments")}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ background: "#8B5CF6" }} />
            <span className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>
              {t("adminCompleted")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
