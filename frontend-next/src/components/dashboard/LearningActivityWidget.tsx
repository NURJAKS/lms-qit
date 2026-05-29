"use client";

import { useState, useMemo } from "react";
import { ChevronDown } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { useLanguage } from "@/context/LanguageContext";
import { getDashboardCardStyle, getTextColors } from "@/utils/themeStyles";
import { WeeklyActivityGrid } from "./WeeklyActivityGrid";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import {
  LineChart,
  Line,
  Area,
  AreaChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

type ActivityLevel = "high" | "medium" | "none";

type WeeklyActivityData = {
  category: string;
  days: ActivityLevel[];
};

export function LearningActivityWidget() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [period, setPeriod] = useState<"weekly" | "monthly">("weekly");
  const cardStyle = getDashboardCardStyle(theme);
  const textColors = getTextColors(theme);
  const isDark = theme === "dark";

  const { data: activityDataRaw = [] } = useQuery({
    queryKey: ["weekly-activity", period],
    queryFn: async () => {
      const { data } = await api.get<Array<{ category: string; days: ActivityLevel[] }>>(
        `/dashboard/weekly-activity?period=${period}`
      );
      return data;
    },
  });

  // Преобразуем данные API в формат с переведенными категориями
  const activityData: WeeklyActivityData[] = activityDataRaw.map((item) => ({
    category: item.category === "courses" 
      ? t("courses") 
      : item.category === "assignments" 
      ? t("assignments") 
      : t("tests"),
    days: item.days,
  }));

  const totalActivity = activityData.reduce((sum, item) => {
    return sum + item.days.filter((d) => d === "high").length;
  }, 0);

  // Преобразуем данные для графика с более выразительными значениями
  const chartData = useMemo(() => {
    const WD_KEYS = ["wdSun", "wdMon", "wdTue", "wdWed", "wdThu", "wdFri", "wdSat"];
    const dayLabels = period === "weekly" 
      ? WD_KEYS.map(key => t(key as any).slice(0, 1).toUpperCase())
      : Array.from({ length: 30 }, (_, i) => `${i + 1}`);
    
    const daysCount = period === "weekly" ? 7 : 30;
    
    // Проверяем, есть ли реальные данные
    const hasRealData = activityData.length > 0 && activityData.some(item => 
      item.days.some(day => day !== "none")
    );
    
    return Array.from({ length: daysCount }, (_, dayIdx) => {
      const dayData: Record<string, any> = {
        day: dayLabels[dayIdx],
      };
      
      if (hasRealData && activityData.length > 0) {
        // Используем реальные данные с более выразительными значениями
        activityData.forEach((item) => {
          const level = item.days[dayIdx] || "none";
          // Преобразуем уровень активности в числовое значение для графика
          // Используем более широкий диапазон для лучшей визуализации
          const value = level === "high" ? 100 : level === "medium" ? 50 : 0;
          dayData[item.category] = value;
        });
      } else {
        // Если данных нет, показываем демо-данные для красоты
        const demoPattern = [
          { courses: 20, assignments: 15, tests: 10 },
          { courses: 45, assignments: 30, tests: 25 },
          { courses: 60, assignments: 50, tests: 40 },
          { courses: 80, assignments: 70, tests: 60 },
          { courses: 65, assignments: 55, tests: 45 },
          { courses: 90, assignments: 85, tests: 75 },
          { courses: 50, assignments: 40, tests: 30 },
        ];
        
        const patternIdx = dayIdx % demoPattern.length;
        const pattern = demoPattern[patternIdx];
        
        dayData[t("courses")] = pattern.courses;
        dayData[t("assignments")] = pattern.assignments;
        dayData[t("tests")] = pattern.tests;
      }
      
      return dayData;
    });
  }, [activityData, period, t]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div
          className="rounded-lg p-3 shadow-xl border backdrop-blur-sm"
          style={{
            background: isDark ? "rgba(26, 34, 56, 0.98)" : "rgba(255, 255, 255, 0.98)",
            borderColor: isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.1)",
            boxShadow: isDark ? "0 8px 24px rgba(0, 0, 0, 0.4)" : "0 8px 24px rgba(0, 0, 0, 0.15)",
          }}
        >
          {payload.map((entry: any, idx: number) => {
            const value = entry.value || 0;
            let label = "";
            if (value >= 70) label = t("activityHigh");
            else if (value >= 30) label = t("activityMedium");
            else label = t("activityNone");
            
            return (
              <div key={idx} className="flex items-center gap-2 mb-1 last:mb-0">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-sm font-medium" style={{ color: textColors.primary }}>
                  {entry.name}: <span style={{ color: entry.color, fontWeight: 600 }}>{value}</span>
                </span>
              </div>
            );
          })}
        </div>
      );
    }
    return null;
  };

  return (
    <div
      className="h-full flex flex-col rounded-xl p-4 transition-all duration-300 hover:shadow-lg"
      style={cardStyle}
    >
      {/* Compact Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold" style={{ color: textColors.primary }}>
            {t("learningActivity")}
          </h3>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ 
            background: isDark ? "rgba(59, 130, 246, 0.2)" : "rgba(59, 130, 246, 0.1)",
            color: "#3B82F6"
          }}>
            {totalActivity}
          </span>
        </div>
        <div className="relative">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as "weekly" | "monthly")}
            className="appearance-none pr-7 pl-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors"
            style={{
              background: isDark ? "rgba(255, 255, 255, 0.08)" : "#FFFFFF",
              color: textColors.primary,
              border: `1px solid ${isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.12)"}`,
            }}
          >
            <option value="weekly">{t("activityWeek")}</option>
            <option value="monthly">{t("activityMonth")}</option>
          </select>
          <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none" style={{ color: textColors.secondary }} />
        </div>
      </div>

      {/* Beautiful Chart with gradient areas */}
      <div className="flex-1 -mx-2 mb-2 min-h-[144px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
            <defs>
              {/* Красивые градиенты для каждой линии */}
              <linearGradient id="gradientCourses" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.4} />
                <stop offset="50%" stopColor="#3B82F6" stopOpacity={0.15} />
                <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gradientAssignments" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10B981" stopOpacity={0.4} />
                <stop offset="50%" stopColor="#10B981" stopOpacity={0.15} />
                <stop offset="100%" stopColor="#10B981" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gradientTests" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.4} />
                <stop offset="50%" stopColor="#F59E0B" stopOpacity={0.15} />
                <stop offset="100%" stopColor="#F59E0B" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.04)"}
              vertical={false}
            />
            <XAxis
              dataKey="day"
              tick={{ fontSize: 11, fill: textColors.secondary, fontWeight: 500 }}
              stroke={isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)"}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              hide={true}
            />
            <Tooltip 
              content={<CustomTooltip />}
              cursor={{ stroke: isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.1)", strokeWidth: 1, strokeDasharray: "5 5" }}
            />
            {/* Курсы - синяя линия */}
            <Area
              type="monotone"
              dataKey={activityData.length > 0 ? activityData[0]?.category : t("courses")}
              stroke="#3B82F6"
              strokeWidth={3}
              fill="url(#gradientCourses)"
              dot={{ fill: "#3B82F6", r: 4, strokeWidth: 2, stroke: isDark ? "#1F2937" : "#FFFFFF" }}
              activeDot={{ r: 6, strokeWidth: 2, stroke: "#3B82F6", fill: "#FFFFFF" }}
            />
            {/* Задания - зеленая линия */}
            <Area
              type="monotone"
              dataKey={activityData.length > 1 ? activityData[1]?.category : t("assignments")}
              stroke="#10B981"
              strokeWidth={3}
              fill="url(#gradientAssignments)"
              dot={{ fill: "#10B981", r: 4, strokeWidth: 2, stroke: isDark ? "#1F2937" : "#FFFFFF" }}
              activeDot={{ r: 6, strokeWidth: 2, stroke: "#10B981", fill: "#FFFFFF" }}
            />
            {/* Тесты - оранжевая линия */}
            <Area
              type="monotone"
              dataKey={activityData.length > 2 ? activityData[2]?.category : t("tests")}
              stroke="#F59E0B"
              strokeWidth={3}
              fill="url(#gradientTests)"
              dot={{ fill: "#F59E0B", r: 4, strokeWidth: 2, stroke: isDark ? "#1F2937" : "#FFFFFF" }}
              activeDot={{ r: 6, strokeWidth: 2, stroke: "#F59E0B", fill: "#FFFFFF" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Beautiful Legend */}
      <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)" }}>
        <div className="flex items-center gap-4 flex-wrap">
          {(activityData.length > 0 ? activityData : [
            { category: t("courses") },
            { category: t("assignments") },
            { category: t("tests") },
          ]).map((item, idx) => {
            const colors = ["#3B82F6", "#10B981", "#F59E0B"];
            const color = colors[idx % colors.length];
            return (
              <div key={idx} className="flex items-center gap-2">
                <div
                  className="w-2.5 h-2.5 rounded-full shadow-sm"
                  style={{ 
                    backgroundColor: color,
                    boxShadow: `0 2px 4px ${color}40`
                  }}
                />
                <span className="text-xs font-semibold" style={{ color: textColors.secondary }}>
                  {item.category}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
