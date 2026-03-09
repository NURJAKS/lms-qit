"use client";

import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { Users, BookOpen, UserPlus, ArrowUpRight, ArrowDownRight, TrendingUp } from "lucide-react";
import { SparklineChart } from "./SparklineChart";
import { WelcomeWidget } from "./WelcomeWidget";
import { CalendarWidget } from "./CalendarWidget";
import { ActivityFeedWidget } from "./ActivityFeedWidget";
import { useTheme } from "@/context/ThemeContext";
import { getGlassCardStyle, getTextColors } from "@/utils/themeStyles";

// Mock sparkline data generator - в реальности это будет из API
const generateSparklineData = (baseValue: number, trend: "up" | "down" | "neutral" = "neutral"): number[] => {
  const data: number[] = [];
  let current = baseValue;
  const direction = trend === "up" ? 1 : trend === "down" ? -1 : 0;
  for (let i = 0; i < 7; i++) {
    current += (Math.random() * 2 - 1) + direction * 0.5;
    data.push(Math.max(0, Math.round(current)));
  }
  return data;
};

export function TeacherDashboard() {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const glassStyle = getGlassCardStyle(theme);
  const textColors = getTextColors(theme);
  const isDark = theme === "dark";
  
  const { data: stats } = useQuery({
    queryKey: ["teacher-stats"],
    queryFn: async () => {
      const { data } = await api.get<{
        groups_count: number;
        pending_submissions_count: number;
        students_count: number;
      }>("/teacher/stats");
      return data;
    },
  });

  const groupsCount = stats?.groups_count ?? 0;
  const pendingCount = stats?.pending_submissions_count ?? 0;
  const studentsCount = stats?.students_count ?? 0;

  // Mock trend data - в реальности это будет из API
  const groupsTrend = generateSparklineData(groupsCount, "up");
  const studentsTrend = generateSparklineData(studentsCount, "up");
  const groupsChange = groupsTrend[groupsTrend.length - 1] - groupsTrend[0];
  const studentsChange = studentsTrend[studentsTrend.length - 1] - studentsTrend[0];

  const statCards = [
    {
      icon: Users,
      value: groupsCount,
      label: t("teacherStatsGroups"),
      gradient: "linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)",
      sparklineData: groupsTrend,
      change: groupsChange,
      changePercent: groupsChange > 0 ? Math.round((groupsChange / groupsCount) * 100) : 0,
      color: "#3B82F6",
      bgGlow: isDark ? "rgba(59, 130, 246, 0.15)" : "rgba(59, 130, 246, 0.08)",
    },
    {
      icon: BookOpen,
      value: pendingCount,
      label: t("teacherStatsPending"),
      gradient: "linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)",
      sparklineData: generateSparklineData(pendingCount, "neutral"),
      change: 0,
      changePercent: 0,
      color: "#F59E0B",
      bgGlow: isDark ? "rgba(245, 158, 11, 0.15)" : "rgba(245, 158, 11, 0.08)",
      hasAlert: pendingCount > 0,
    },
    {
      icon: UserPlus,
      value: studentsCount,
      label: t("teacherStatsStudents"),
      gradient: "linear-gradient(135deg, #10B981 0%, #06B6D4 100%)",
      sparklineData: studentsTrend,
      change: studentsChange,
      changePercent: studentsChange > 0 ? Math.round((studentsChange / studentsCount) * 100) : 0,
      color: "#10B981",
      bgGlow: isDark ? "rgba(16, 185, 129, 0.15)" : "rgba(16, 185, 129, 0.08)",
    },
  ];

  const quickActions = [
    {
      href: "/app/teacher?tab=groups",
      icon: Users,
      label: t("teacherGoToGroups"),
      description: t("teacherGoToGroupsHint"),
      gradient: "linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)",
      color: "#3B82F6",
    },
    {
      href: "/app/teacher?tab=assignments",
      icon: BookOpen,
      label: t("teacherGoToAssignments"),
      description: t("teacherGoToAssignmentsHint"),
      gradient: "linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)",
      color: "#F59E0B",
    },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_380px] gap-6 lg:gap-8">
      {/* Main content */}
      <div className="min-w-0 space-y-6">
        {/* Welcome Widget */}
        <WelcomeWidget />

        {/* Stats Cards with Sparklines - улучшенный дизайн */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {statCards.map((card, index) => {
            const Icon = card.icon;
            const isPositive = card.change >= 0;
            const hasChange = card.change !== 0;
            
            return (
              <div
                key={index}
                className="relative rounded-unified-lg p-6 overflow-hidden group hover:scale-[1.02] transition-all duration-300 card-glow-hover"
                style={{
                  ...glassStyle,
                  background: isDark 
                    ? `linear-gradient(135deg, rgba(26, 34, 56, 0.9) 0%, rgba(30, 41, 59, 0.8) 100%)`
                    : `linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(255, 255, 255, 0.95) 100%)`,
                }}
              >
                {/* Gradient background accent с улучшенным glow */}
                <div
                  className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-20 blur-3xl transition-opacity group-hover:opacity-30"
                  style={{ background: card.gradient }}
                />

                {/* Subtle border glow */}
                <div
                  className="absolute inset-0 rounded-unified-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{
                    background: `linear-gradient(135deg, ${card.color}15, transparent)`,
                    border: `1px solid ${card.color}30`,
                  }}
                />

                <div className="relative">
                  <div className="flex items-start justify-between mb-5">
                    <div
                      className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 text-white shadow-lg group-hover:scale-110 transition-transform duration-300"
                      style={{ 
                        background: card.gradient,
                        boxShadow: `0 8px 16px ${card.color}40`,
                      }}
                    >
                      <Icon className="w-7 h-7" />
                      {card.hasAlert && (
                        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full animate-pulse-dot border-2 border-white shadow-lg" />
                      )}
                    </div>
                    {hasChange && (
                      <div 
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                          isPositive 
                            ? isDark ? "bg-green-500/20 text-green-400" : "bg-green-50 text-green-600"
                            : isDark ? "bg-red-500/20 text-red-400" : "bg-red-50 text-red-600"
                        }`}
                      >
                        {isPositive ? (
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        ) : (
                          <ArrowDownRight className="w-3.5 h-3.5" />
                        )}
                        {Math.abs(card.changePercent)}%
                      </div>
                    )}
                  </div>

                  <div className="mb-4">
                    <p className="text-3xl font-bold font-geologica tracking-tight mb-1" style={{ color: textColors.primary }}>
                      {card.value}
                    </p>
                    <p className="text-sm font-medium" style={{ color: textColors.secondary }}>
                      {card.label}
                    </p>
                  </div>

                  {/* Sparkline с улучшенным дизайном */}
                  <div className="mt-4 pt-4 border-t" style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.08)" }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium" style={{ color: textColors.secondary }}>
                        {t("trend")}
                      </span>
                      {hasChange && (
                        <TrendingUp 
                          className={`w-4 h-4 ${isPositive ? "text-green-500" : "text-red-500"}`} 
                        />
                      )}
                    </div>
                    <SparklineChart 
                      data={card.sparklineData} 
                      color={hasChange ? (isPositive ? "#10B981" : "#EF4444") : card.color} 
                      height={32} 
                      width={100} 
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick Actions - Icon Tiles с улучшенным дизайном */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {quickActions.map((action, index) => {
            const Icon = action.icon;
            return (
              <Link
                key={index}
                href={action.href}
                className="group relative rounded-unified-lg p-6 overflow-hidden hover:scale-[1.02] transition-all duration-300 card-glow-hover"
                style={{
                  ...glassStyle,
                  background: isDark 
                    ? `linear-gradient(135deg, rgba(26, 34, 56, 0.9) 0%, rgba(30, 41, 59, 0.8) 100%)`
                    : `linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(255, 255, 255, 0.95) 100%)`,
                }}
              >
                {/* Gradient background с glow эффектом */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-300"
                  style={{ background: action.gradient }}
                />

                {/* Border glow при hover */}
                <div
                  className="absolute inset-0 rounded-unified-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{
                    border: `1px solid ${action.color}40`,
                    boxShadow: `0 0 0 1px ${action.color}20`,
                  }}
                />

                <div className="relative flex items-center gap-4">
                  <div
                    className="w-16 h-16 rounded-xl flex items-center justify-center shrink-0 text-white shadow-xl group-hover:scale-110 group-hover:rotate-3 transition-all duration-300"
                    style={{ 
                      background: action.gradient,
                      boxShadow: `0 8px 24px ${action.color}40`,
                    }}
                  >
                    <Icon className="w-8 h-8" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-lg mb-1.5 group-hover:text-[#3B82F6] transition-colors" style={{ color: textColors.primary }}>
                      {action.label}
                    </p>
                    <p className="text-sm line-clamp-2 leading-relaxed" style={{ color: textColors.secondary }}>
                      {action.description}
                    </p>
                  </div>
                  <ArrowUpRight className="w-6 h-6 shrink-0 opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-1 group-hover:-translate-y-1" style={{ color: action.color }} />
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Right Sidebar */}
      <aside className="lg:order-none order-last">
        <div className="lg:sticky lg:top-24 space-y-6">
          <CalendarWidget />
          <ActivityFeedWidget />
        </div>
      </aside>
    </div>
  );
}
