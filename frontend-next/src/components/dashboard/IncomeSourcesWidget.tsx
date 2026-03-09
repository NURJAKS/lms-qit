"use client";

import { useState } from "react";
import { ChevronDown, MoreVertical } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";
import { useTheme } from "@/context/ThemeContext";
import { useLanguage } from "@/context/LanguageContext";
import type { TranslationKey } from "@/i18n/translations";
import { getDashboardCardStyle, getTextColors } from "@/utils/themeStyles";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";

type LearningActivityData = {
  name: string;
  value: number;
  change: "up" | "down";
  color: string;
  pattern?: boolean;
};

type LearningActivityResponse = {
  period: string;
  total: number;
  change_percent: number;
  categories: Array<{
    name: string;
    label: string;
    value: number;
    change: "up" | "down";
  }>;
};

// Цвета для категорий LMS
const categoryColors: Record<string, string> = {
  lessons: "#3B82F6", // синий - основной цвет обучения
  assignments: "#8B5CF6", // фиолетовый - как в других виджетах
  tests: "#F59E0B", // оранжевый - для тестов
  certificates: "#10B981", // зеленый - успех/достижение
};

// Порядок категорий для отображения
const categoryOrder = ["lessons", "assignments", "tests", "certificates"];

// Компонент для кастомных меток на столбцах
const CustomBarLabel = (props: any) => {
  const { x, y, width, value, payload } = props;
  if (!payload) return null;
  
  return (
    <g>
      <rect
        x={x + width / 2 - 28}
        y={y - 22}
        width={56}
        height={20}
        rx={10}
        fill="#FFFFFF"
        stroke="none"
        style={{ filter: "drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1))" }}
      />
      <text
        x={x + width / 2}
        y={y - 9}
        textAnchor="middle"
        fontSize="11"
        fill="#1F2937"
        fontWeight="500"
      >
        {payload.change === "up" ? "↑" : "↓"} {payload.value}
      </text>
    </g>
  );
};

export function IncomeSourcesWidget() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [period, setPeriod] = useState<"30_days" | "7_days">("30_days");
  const cardStyle = getDashboardCardStyle(theme);
  const textColors = getTextColors(theme);
  const isDark = theme === "dark";

  const { data: activityData, isLoading } = useQuery<LearningActivityResponse>({
    queryKey: ["learning-activity-sources", period],
    queryFn: async () => {
      const { data } = await api.get<LearningActivityResponse>(
        `/dashboard/learning-activity-sources?period=${period}`
      );
      return data;
    },
  });

  // Преобразуем данные для графика
  const chartData: LearningActivityData[] = activityData?.categories
    ? categoryOrder
        .map((catName) => {
          const category = activityData.categories.find((c) => c.name === catName);
          if (!category) return null;
          return {
            name: t(category.name as TranslationKey),
            value: category.value,
            change: category.change,
            color: categoryColors[category.name] || "#64748B",
            pattern: category.name === "lessons" || category.name === "certificates",
          };
        })
        .filter((item) => item !== null) as LearningActivityData[]
    : [];

  const total = activityData?.total ?? 0;
  const changePercent = activityData?.change_percent ?? 0;
  const periodLabel = period === "7_days" ? t("forWeek") : "30 " + t("days");

  return (
    <div
      className="rounded-xl p-6 transition-all duration-300 hover:shadow-lg"
      style={cardStyle}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold" style={{ color: textColors.primary }}>
          {t("learningActivitySources")}
        </h3>
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as "30_days" | "7_days")}
              className="appearance-none pr-8 pl-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-colors"
              style={{
                background: isDark ? "rgba(255, 255, 255, 0.08)" : "#F3F4F6",
                color: textColors.primary,
                border: "none",
              }}
            >
              <option value="30_days">{t("sortByMonth")}</option>
              <option value="7_days">{t("sortByWeek")}</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none" style={{ color: textColors.secondary }} />
          </div>
          <button className="p-1.5 rounded-full hover:bg-white/10 transition-colors" style={{ background: isDark ? "rgba(255, 255, 255, 0.08)" : "#F3F4F6" }}>
            <MoreVertical className="w-4 h-4" style={{ color: textColors.secondary }} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <p style={{ color: textColors.secondary }}>{t("loading")}</p>
        </div>
      ) : activityData ? (
        <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-6">
          {/* Left Summary Panel */}
          <div className="flex flex-col">
            {/* Period Tag */}
            <div className="mb-4">
              <button
                className="px-4 py-1.5 rounded-full text-xs font-medium text-white"
                style={{ background: "#000000" }}
              >
                {periodLabel}
              </button>
            </div>

            {/* Total Activities */}
            <div className="mb-2">
              <p className="text-4xl font-bold" style={{ color: textColors.primary }}>
                {total}
              </p>
            </div>

            {/* Description */}
            <p className="text-sm mb-6" style={{ color: textColors.secondary }}>
              {t("learningActivityStatistic")}
            </p>

            {/* Legend */}
            <div className="mt-auto space-y-2">
              {activityData?.categories
                .sort((a, b) => categoryOrder.indexOf(a.name) - categoryOrder.indexOf(b.name))
                .map((category) => (
                  <div key={category.name} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: categoryColors[category.name] || "#64748B" }}
                    />
                    <span className="text-xs" style={{ color: textColors.secondary }}>
                      {t(category.name as TranslationKey)}
                    </span>
                  </div>
                ))}
            </div>
          </div>

          {/* Right Bar Chart Panel */}
          <div className="flex-1">
            {/* Performance Indicator */}
            <div className="mb-4">
              <p
                className="text-2xl font-bold mb-1"
                style={{ color: changePercent >= 0 ? "#3B82F6" : "#EF4444" }}
              >
                {changePercent >= 0 ? "+" : ""}
                {changePercent.toFixed(1)}%
              </p>
              <p className="text-xs" style={{ color: textColors.secondary }}>
                {t("betterThanLastPeriod")}
              </p>
            </div>

            {/* Bar Chart */}
            {chartData.length > 0 && (
              <div className="h-48 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 30, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      {/* Pattern for striped bars - синий (lessons) */}
                      <pattern
                        id="diagonal-stripe-blue"
                        patternUnits="userSpaceOnUse"
                        width="6"
                        height="6"
                        patternTransform="rotate(45)"
                      >
                        <rect width="6" height="6" fill="#3B82F6" />
                        <path d="M 0,3 L 3,0 L 6,3 L 3,6 Z" fill="#60A5FA" opacity="0.5" />
                      </pattern>
                      {/* Pattern for striped bars - зеленый (certificates) */}
                      <pattern
                        id="diagonal-stripe-green"
                        patternUnits="userSpaceOnUse"
                        width="6"
                        height="6"
                        patternTransform="rotate(45)"
                      >
                        <rect width="6" height="6" fill="#10B981" />
                        <path d="M 0,3 L 3,0 L 6,3 L 3,6 Z" fill="#34D399" opacity="0.6" />
                      </pattern>
                    </defs>
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
                    <YAxis hide />
                    <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                      {chartData.map((entry, index) => {
                        // Для паттернов используем SVG паттерны
                        let fillColor = entry.color;
                        if (entry.pattern) {
                          fillColor =
                            entry.color === categoryColors.lessons
                              ? "url(#diagonal-stripe-blue)"
                              : "url(#diagonal-stripe-green)";
                        }
                        return <Cell key={`cell-${index}`} fill={fillColor} />;
                      })}
                      <LabelList content={(props: any) => <CustomBarLabel {...props} />} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center h-64">
          <p style={{ color: textColors.secondary }}>
            {t("noData")}
          </p>
        </div>
      )}
    </div>
  );
}
