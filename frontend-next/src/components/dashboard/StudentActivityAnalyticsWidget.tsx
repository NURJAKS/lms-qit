"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useTheme } from "@/context/ThemeContext";
import { useLanguage } from "@/context/LanguageContext";
import { getDashboardCardStyle, getTextColors } from "@/utils/themeStyles";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";

type ActivityLevel = "high" | "medium" | "none";

type WeeklyActivityResponse = Array<{
  category: "courses" | "assignments" | "tests";
  days: ActivityLevel[];
}>;

function levelToValue(level: ActivityLevel): number {
  if (level === "high") return 100;
  if (level === "medium") return 50;
  return 0;
}

export function StudentActivityAnalyticsWidget() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [period, setPeriod] = useState<"weekly" | "monthly">("weekly");

  const cardStyle = getDashboardCardStyle(theme);
  const textColors = getTextColors(theme);
  const isDark = theme === "dark";

  const { data: activityDataRaw = [] } = useQuery({
    queryKey: ["student-weekly-activity", period],
    queryFn: async () => {
      const { data } = await api.get<WeeklyActivityResponse>(`/dashboard/weekly-activity?period=${period}`);
      return data;
    },
    enabled: true,
  });

  const coursesLabel = t("courses");
  const assignmentsLabel = t("assignments");
  const testsLabel = t("tests");

  const chartData = useMemo(() => {
    const daysCount = period === "weekly" ? 7 : 30;

    const WD_KEYS = ["wdSun", "wdMon", "wdTue", "wdWed", "wdThu", "wdFri", "wdSat"] as const;
    const dayLabels =
      period === "weekly"
        ? WD_KEYS.map((key) => t(key as any).slice(0, 1).toUpperCase())
        : Array.from({ length: 30 }, (_, i) => `${i + 1}`);

    const byCategory = new Map(activityDataRaw.map((item) => [item.category, item.days]));

    return Array.from({ length: daysCount }, (_, dayIdx) => {
      const coursesDays = byCategory.get("courses") ?? [];
      const assignmentsDays = byCategory.get("assignments") ?? [];
      const testsDays = byCategory.get("tests") ?? [];

      return {
        day: dayLabels[dayIdx],
        [coursesLabel]: levelToValue(coursesDays[dayIdx] ?? "none"),
        [assignmentsLabel]: levelToValue(assignmentsDays[dayIdx] ?? "none"),
        [testsLabel]: levelToValue(testsDays[dayIdx] ?? "none"),
      };
    });
  }, [activityDataRaw, period, coursesLabel, assignmentsLabel, testsLabel, t]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;

    const findValue = (key: string) => payload.find((p: any) => p.dataKey === key)?.value ?? 0;

    const coursesValue = findValue(coursesLabel);
    const assignmentsValue = findValue(assignmentsLabel);
    const testsValue = findValue(testsLabel);

    const fmt = (value: number) => `${value}%`;

    return (
      <div
        className="rounded-lg p-3 shadow-xl border backdrop-blur-sm"
        style={{
          background: isDark ? "rgba(26, 34, 56, 0.98)" : "rgba(255, 255, 255, 0.98)",
          borderColor: isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.1)",
          boxShadow: isDark ? "0 8px 24px rgba(0,0,0,0.4)" : "0 8px 24px rgba(0,0,0,0.15)",
        }}
      >
        <div className="text-sm font-medium" style={{ color: textColors.primary }}>
          {payload[0]?.payload?.day}
        </div>
        <div className="mt-2 space-y-1">
          <div className="flex items-center gap-2 text-sm" style={{ color: textColors.primary }}>
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#3B82F6" }} />
            {coursesLabel}: <span style={{ color: "#3B82F6", fontWeight: 600 }}>{fmt(coursesValue)}</span>
          </div>
          <div className="flex items-center gap-2 text-sm" style={{ color: textColors.primary }}>
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#10B981" }} />
            {assignmentsLabel}: <span style={{ color: "#10B981", fontWeight: 600 }}>{fmt(assignmentsValue)}</span>
          </div>
          <div className="flex items-center gap-2 text-sm" style={{ color: textColors.primary }}>
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#F59E0B" }} />
            {testsLabel}: <span style={{ color: "#F59E0B", fontWeight: 600 }}>{fmt(testsValue)}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-xl p-4 transition-all duration-300 hover:shadow-lg" style={cardStyle}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold" style={{ color: textColors.primary }}>
            {t("learningActivity")}
          </h3>
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{
              background: isDark ? "rgba(59, 130, 246, 0.2)" : "rgba(59, 130, 246, 0.1)",
              color: "#3B82F6",
            }}
          >
            {chartData
              .reduce((s, d) => s + (Number((d as Record<string, unknown>)[coursesLabel]) || 0) / 100, 0)
              .toFixed(0)}
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

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
            <defs>
              <linearGradient id="saCourses" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.4} />
                <stop offset="50%" stopColor="#3B82F6" stopOpacity={0.15} />
                <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="saAssignments" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10B981" stopOpacity={0.4} />
                <stop offset="50%" stopColor="#10B981" stopOpacity={0.15} />
                <stop offset="100%" stopColor="#10B981" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="saTests" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.4} />
                <stop offset="50%" stopColor="#F59E0B" stopOpacity={0.15} />
                <stop offset="100%" stopColor="#F59E0B" stopOpacity={0.02} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.04)"} vertical={false} />
            <XAxis
              dataKey="day"
              tick={{ fontSize: 11, fill: textColors.secondary, fontWeight: 500 }}
              stroke={isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)"}
              axisLine={false}
              tickLine={false}
            />
            <YAxis domain={[0, 100]} hide />

            <Tooltip content={<CustomTooltip />} cursor={{ stroke: isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.1)", strokeWidth: 1, strokeDasharray: "5 5" }} />

            <Area type="monotone" dataKey={coursesLabel} stroke="#3B82F6" strokeWidth={3} fill="url(#saCourses)" dot={{ fill: "#3B82F6", r: 4 }} activeDot={{ r: 6, fill: "#3B82F6" }} />
            <Area type="monotone" dataKey={assignmentsLabel} stroke="#10B981" strokeWidth={3} fill="url(#saAssignments)" dot={{ fill: "#10B981", r: 4 }} activeDot={{ r: 6, fill: "#10B981" }} />
            <Area type="monotone" dataKey={testsLabel} stroke="#F59E0B" strokeWidth={3} fill="url(#saTests)" dot={{ fill: "#F59E0B", r: 4 }} activeDot={{ r: 6, fill: "#F59E0B" }} />

            <Legend />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

