"use client";

import { useState } from "react";
import { ChevronDown, TrendingUp, MoreVertical } from "lucide-react";
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

const courseTypeColors: Record<string, string> = {
  programming: "#3B82F6", // Blue
  design: "#8B5CF6", // Purple - яркий фиолетовый как на изображении
  marketing: "#F59E0B", // Orange - яркий оранжевый
  other: "#64748B", // Gray
};

// Mock data generator - точные данные из изображения
const generateMockData = (): CourseProgressData[] => {
  return [
    { name: "UI/UX Design", progress: 118, type: "design" },
    { name: "Digital Marketing", progress: 81, type: "marketing" },
    { name: "Python", progress: 77, type: "programming" },
    { name: "JavaScript", progress: 56, type: "programming" },
    { name: "React", progress: 45, type: "programming" },
  ];
};

export function CourseProgressChart() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [sortBy, setSortBy] = useState<"progress" | "month">("progress");
  const [sourceFilter, setSourceFilter] = useState<"all" | string>("all");
  const cardStyle = getDashboardCardStyle(theme);
  const textColors = getTextColors(theme);
  const isDark = theme === "dark";

  const { data: chartData = generateMockData() } = useQuery({
    queryKey: ["course-progress", sortBy, sourceFilter],
    queryFn: async () => {
      // TODO: Replace with actual API call
      // const { data } = await api.get(`/dashboard/course-progress?sort=${sortBy}&source=${sourceFilter}`);
      // return data;
      return generateMockData();
    },
  });

  // Данные в порядке как на изображении: UI/UX Design, Digital Marketing, Python, JavaScript, React
  const sortedData = chartData;

  // Фиксированные значения как на изображении
  const averageProgress = 75.8; // Точное значение из изображения
  const improvement = 73.6; // Mock improvement percentage

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
    <div
      className="rounded-xl p-6 transition-all duration-300 hover:shadow-lg"
      style={cardStyle}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold" style={{ color: textColors.primary }}>
          courseProgress
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
              <option value="progress">sortByProgress</option>
              <option value="month">sortByMonth</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none" style={{ color: textColors.secondary }} />
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
              <option value="all">allSources</option>
              <option value="programming">{t("programming" as any) || "Программирование"}</option>
              <option value="design">{t("design" as any) || "Дизайн"}</option>
              <option value="marketing">{t("marketing" as any) || "Маркетинг"}</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none" style={{ color: textColors.secondary }} />
          </div>
          <button className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            <MoreVertical className="w-4 h-4" style={{ color: textColors.secondary }} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6">
        <div className="flex items-baseline gap-2 mb-2">
          <p className="text-4xl font-bold" style={{ color: textColors.primary }}>
            75.8%
          </p>
          <span className="text-sm font-medium ml-2" style={{ color: textColors.secondary }}>
            averageProgress
          </span>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg ${isDark ? "bg-green-500/20 text-green-400" : "bg-green-50 text-green-600"}`}>
            <TrendingUp className="w-3.5 h-3.5" />
            <span className="text-xs font-semibold">+73.6%</span>
          </div>
          <span className="text-xs" style={{ color: textColors.secondary }}>
            betterThanLastMonth
          </span>
        </div>
      </div>

      {/* Chart */}
      <div className="h-64 -mx-2">
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
              domain={[0, 120]}
              ticks={[0, 30, 60, 90, 120]}
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
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 pt-4 border-t" style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.08)" }}>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: courseTypeColors.programming }} />
          <span className="text-xs" style={{ color: textColors.secondary }}>
            programming
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: courseTypeColors.design }} />
          <span className="text-xs" style={{ color: textColors.secondary }}>
            design
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: courseTypeColors.marketing }} />
          <span className="text-xs" style={{ color: textColors.secondary }}>
            marketing
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: courseTypeColors.other }} />
          <span className="text-xs" style={{ color: textColors.secondary }}>
            other
          </span>
        </div>
      </div>
    </div>
  );
}
