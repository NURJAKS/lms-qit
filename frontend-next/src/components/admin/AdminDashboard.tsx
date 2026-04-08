"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import {
  Users,
  BookOpen,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Clock,
  Activity,
  BarChart3,
  ArrowRight,
  CheckCircle,
  XCircle,
  UserPlus,
  BookPlus,
  ShieldAlert,
  Calendar,
  Zap,
} from "lucide-react";
import { motion } from "motion/react";
import { AnimatedNumber } from "./AnimatedNumber";
import { AnimatedGradientText } from "@/components/ui/animated-gradient-text";
import { BlurFade } from "@/components/ui/blur-fade";
import { MagicCard } from "@/components/ui/magic-card";
import { getLocalizedCourseTitle } from "@/lib/courseUtils";
import { useAuthStore } from "@/store/authStore";
import { getGlassCardStyle, getTextColors } from "@/utils/themeStyles";
import { formatDateTimeLocalized } from "@/lib/dateUtils";
import Link from "next/link";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type TimeSeriesPoint = {
  date: string;
  count: number;
};

type CourseStat = {
  course_id: number;
  title?: string;
  enrollments: number;
  completed_topics: number;
  total_topics?: number;
};

export function AdminDashboard() {
  const { t, lang } = useLanguage();
  const locale = lang === "ru" ? "ru-RU" : lang === "kk" ? "kk-KZ" : "en-US";
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const queryClient = useQueryClient();
  const [triggering, setTriggering] = useState(false);
  const [triggerResult, setTriggerResult] = useState<string | null>(null);
  const [chartsLoaded, setChartsLoaded] = useState(false);
  const { user, canManageUsers } = useAuthStore();
  const isCurator = user?.role === "curator";
  const glassStyle = getGlassCardStyle(theme);
  const textColors = getTextColors(theme);

  // Анимация появления графиков
  useEffect(() => {
    const timer = setTimeout(() => {
      setChartsLoaded(true);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  // Основная статистика
  const { data: overviewData } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: async () => {
      const { data: d } = await api.get<{
        departments: Array<{ id: string; name: string; count: number; importance: string; description: string }>;
        total_users: number;
        total_courses: number;
        users_by_role?: Record<string, number>;
        new_users_week?: number;
        new_enrollments_week?: number;
        active_courses?: number;
        pending_users?: number;
        pending_courses?: number;
      }>("/admin/overview");
      return d;
    },
  });

  // Статистика за 30 дней для графиков
  const { data: newUsersData } = useQuery({
    queryKey: ["analytics-new-users", 30],
    queryFn: async () => {
      try {
        const { data } = await api.get<{ data: TimeSeriesPoint[] }>(
          "/analytics/new-users?days=30"
        );
        return data;
      } catch {
        return { data: [] };
      }
    },
  });

  const { data: completionsData } = useQuery({
    queryKey: ["analytics-completions", 30],
    queryFn: async () => {
      try {
        const { data } = await api.get<{ data: TimeSeriesPoint[] }>(
          "/analytics/completions-over-time?days=30"
        );
        return data;
      } catch {
        return { data: [] };
      }
    },
  });

  // Статистика по курсам
  const { data: courseStats = [] } = useQuery({
    queryKey: ["analytics-course-stats"],
    queryFn: async () => {
      try {
        const { data } = await api.get<CourseStat[]>("/analytics/course-stats");
        return data;
      } catch {
        return [];
      }
    },
  });

  // Недавние действия
  const { data: logs = [] } = useQuery({
    queryKey: ["admin-activity-logs"],
    queryFn: async () => {
      try {
        const { data: d } = await api.get<
          Array<{
            id: number;
            user_name: string | null;
            action: string;
            entity_type: string | null;
            created_at: string | null;
          }>
        >("/admin/activity-logs?limit=5");
        return d;
      } catch {
        return [];
      }
    },
  });

  const handleTriggerDailyRewards = async () => {
    setTriggering(true);
    setTriggerResult(null);
    try {
      const { data: res } = await api.post<{ awarded: number; message: string }>("/admin/trigger-daily-rewards");
      setTriggerResult(
        res.awarded > 0 
          ? t("adminAwardsGivenCount").replace("{count}", String(res.awarded))
          : t("adminAwardsAlreadyGiven")
      );
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
    } catch (e: unknown) {
      setTriggerResult((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? t("error"));
    } finally {
      setTriggering(false);
    }
  };

  // Вычисляем тренды
  const newUsersChartData = useMemo(() => {
    const raw = newUsersData?.data ?? [];
    const byDate = new Map(raw.map((r) => [r.date, r.count]));
    const result: TimeSeriesPoint[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      result.push({ date: dateStr, count: byDate.get(dateStr) ?? 0 });
    }
    return result;
  }, [newUsersData?.data]);

  const completionsChartData = useMemo(() => {
    const raw = completionsData?.data ?? [];
    const byDate = new Map(raw.map((r) => [r.date, r.count]));
    const result: TimeSeriesPoint[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      result.push({ date: dateStr, count: byDate.get(dateStr) ?? 0 });
    }
    return result;
  }, [completionsData?.data]);

  // Вычисляем изменения за последние 7 дней
  const usersLast7Days = newUsersChartData.slice(-7).reduce((sum, d) => sum + d.count, 0);
  const usersPrev7Days = newUsersChartData.slice(-14, -7).reduce((sum, d) => sum + d.count, 0);
  const usersChange = usersLast7Days - usersPrev7Days;
  const usersChangePercent = usersPrev7Days > 0 ? ((usersChange / usersPrev7Days) * 100).toFixed(1) : "0";

  const completionsLast7Days = completionsChartData.slice(-7).reduce((sum, d) => sum + d.count, 0);
  const completionsPrev7Days = completionsChartData.slice(-14, -7).reduce((sum, d) => sum + d.count, 0);
  const completionsChange = completionsLast7Days - completionsPrev7Days;
  const completionsChangePercent = completionsPrev7Days > 0 ? ((completionsChange / completionsPrev7Days) * 100).toFixed(1) : "0";

  const totalUsers = overviewData?.total_users ?? 0;
  const totalCourses = overviewData?.total_courses ?? 0;
  const newUsersWeek = overviewData?.new_users_week ?? 0;
  const newEnrollmentsWeek = overviewData?.new_enrollments_week ?? 0;
  const pendingUsers = overviewData?.pending_users ?? 0;
  const pendingCourses = overviewData?.pending_courses ?? 0;
  const activeCourses = overviewData?.active_courses ?? 0;

  // Топ курсов по популярности
  const topCourses = [...courseStats]
    .sort((a, b) => b.enrollments - a.enrollments)
    .slice(0, 5);

  // Основные метрики
  const mainMetrics = [
    {
      id: "users",
      label: t("adminTotalUsers"),
      value: totalUsers,
      icon: Users,
      color: "from-blue-500 to-cyan-500",
      change: usersChange,
      changePercent: usersChangePercent,
      link: "/app/admin/users",
    },
    {
      id: "courses",
      label: t("adminCoursesActive"),
      value: activeCourses,
      icon: BookOpen,
      color: "from-purple-500 to-pink-500",
      change: null,
      changePercent: null,
      link: "/app/admin/courses",
    },
    {
      id: "enrollments",
      label: t("adminEnrollmentsWeek"),
      value: newEnrollmentsWeek,
      icon: TrendingUp,
      color: "from-green-500 to-emerald-500",
      change: null,
      changePercent: null,
      link: "/app/teacher",
    },
    {
      id: "completions",
      label: t("adminCompletionsWeek"),
      value: completionsLast7Days,
      icon: CheckCircle,
      color: "from-orange-500 to-red-500",
      change: completionsChange,
      changePercent: completionsChangePercent,
      link: "/app/admin/analytics",
    },
  ];

  // Критические задачи
  const criticalTasks = [
    // Показываем карточку пользователей только для админов и директоров
    ...(canManageUsers() && pendingUsers > 0 ? [{
      id: "pending-users",
      title: `${t("adminRequiresAttention")}: ${pendingUsers}`,
      description: t("adminManageUsers"),
      icon: UserPlus,
      color: "text-amber-500",
      link: "/app/admin/users",
      urgent: true,
    }] : []),
    ...(pendingCourses > 0 ? [{
      id: "pending-courses",
      title: `${t("adminManageCourses")}: ${pendingCourses}`,
      description: t("adminManageCourses"),
      icon: BookPlus,
      color: "text-blue-500",
      link: "/app/admin/courses/moderation",
      urgent: true,
    }] : []),
  ];

  return (
    <div className="space-y-8 relative">
      {isCurator && (
        <BlurFade delay={0} direction="down" duration={0.6} blur="8px" offset={20}>
          <div
            className="rounded-xl p-4 border-l-4 flex items-start gap-3"
            style={{
              ...glassStyle,
              borderLeftColor: "#F59E0B",
              background: isDark ? "rgba(245, 158, 11, 0.1)" : "rgba(245, 158, 11, 0.05)",
            }}
          >
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "#F59E0B" }} />
            <div className="flex-1">
              <p className="font-semibold mb-1" style={{ color: textColors.primary }}>
                {t("curatorRoleInfo")}
              </p>
              <p className="text-sm" style={{ color: textColors.secondary }}>
                {t("adminCuratorNote")}
              </p>
            </div>
          </div>
        </BlurFade>
      )}

      {/* Заголовок дашборда */}
      <BlurFade delay={0} direction="scale" duration={0.8} blur="10px" scale={true}>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-3" style={{ color: textColors.primary }}>
              <BarChart3 className="w-8 h-8" />
              <AnimatedGradientText speed={2} colorFrom="#3b82f6" colorTo="#8b5cf6">
                {t("adminDashboardTitle")}
              </AnimatedGradientText>
            </h1>
            <p className="text-lg" style={{ color: textColors.secondary }}>
              {t("adminDashboardSubtitle")}
            </p>
          </div>
          <div className="flex gap-3">
            <MagicCard className="inline-block">
              <button
                type="button"
                onClick={handleTriggerDailyRewards}
                disabled={triggering}
                className="flex items-center gap-2 px-4 py-2 rounded-xl backdrop-blur-sm disabled:opacity-50 text-white font-medium text-sm transition-all duration-300 hover:scale-105 active:scale-95"
                style={{
                  background: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
                  boxShadow: "0 4px 14px rgba(245, 158, 11, 0.4)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%)";
                  e.currentTarget.style.boxShadow = "0 6px 20px rgba(245, 158, 11, 0.5)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)";
                  e.currentTarget.style.boxShadow = "0 4px 14px rgba(245, 158, 11, 0.4)";
                }}
              >
                <Zap className={`w-4 h-4 ${triggering ? 'animate-spin' : ''}`} />
                {triggering ? "..." : t("adminAwardTop5")}
              </button>
            </MagicCard>
          </div>
        </div>
        {triggerResult && (
          <div className="mt-4 text-sm rounded-lg p-2 px-4 inline-block" style={{ 
            background: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
            color: textColors.primary 
          }}>
            {triggerResult}
          </div>
        )}
      </BlurFade>

      {/* Критические задачи */}
      {criticalTasks.length > 0 && (
        <BlurFade delay={0.05} direction="scale" offset={40} blur="12px" scale={true}>
          <div className="rounded-xl p-6 border-l-4" style={{
            ...glassStyle,
            borderLeftColor: "#EF4444",
            background: isDark ? "rgba(239, 68, 68, 0.1)" : "rgba(239, 68, 68, 0.05)",
          }}>
            <div className="flex items-center gap-2 mb-4">
              <ShieldAlert className="w-5 h-5 text-red-500" />
              <h2 className="text-xl font-bold" style={{ color: textColors.primary }}>
                {t("adminRequiresAttention")}
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {criticalTasks.map((task) => {
                const Icon = task.icon;
                return (
                  <Link key={task.id} href={task.link}>
                    <motion.div
                      className="flex items-center gap-4 p-4 rounded-lg cursor-pointer hover:bg-opacity-50 transition-colors"
                      style={{ background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)" }}
                      whileHover={{ scale: 1.02 }}
                    >
                      <Icon className={`w-6 h-6 ${task.color}`} />
                      <div className="flex-1">
                        <p className="font-semibold" style={{ color: textColors.primary }}>
                          {task.title}
                        </p>
                        <p className="text-sm" style={{ color: textColors.secondary }}>
                          {task.description}
                        </p>
                      </div>
                      <ArrowRight className="w-5 h-5" style={{ color: textColors.secondary }} />
                    </motion.div>
                  </Link>
                );
              })}
            </div>
          </div>
        </BlurFade>
      )}

      {/* Основные метрики */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
        {mainMetrics.map((metric, index) => {
          const Icon = metric.icon;
          const isPositive = metric.change === null || metric.change >= 0;
          const directions: Array<"diagonal-top-left" | "diagonal-top-right" | "diagonal-bottom-left" | "diagonal-bottom-right"> = [
            "diagonal-top-left",
            "diagonal-top-right",
            "diagonal-bottom-left",
            "diagonal-bottom-right",
          ];
          return (
            <BlurFade 
              key={metric.id} 
              delay={0.1 + index * 0.1} 
              direction={directions[index % 4]} 
              offset={50} 
              blur="14px" 
              scale={true}
              rotation={index % 2 === 0 ? -5 : 5}
              className="h-full"
            >
              <Link href={metric.link} className="h-full block">
                <motion.div
                  className="rounded-xl p-6 cursor-pointer group transition-all duration-300 hover:shadow-xl h-full flex flex-col"
                  style={{
                    ...glassStyle,
                    border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.1)",
                  }}
                  whileHover={{ scale: 1.02, y: -4 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center bg-gradient-to-br ${metric.color} shadow-lg`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    {metric.change !== null && (
                      <div className={`flex items-center gap-1 ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                        {isPositive ? (
                          <TrendingUp className="w-4 h-4" />
                        ) : (
                          <TrendingDown className="w-4 h-4" />
                        )}
                        <span className="text-xs font-medium">
                          {isPositive ? '+' : ''}{metric.changePercent}%
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <p className="text-3xl font-bold mb-1" style={{ color: textColors.primary }}>
                        <AnimatedNumber value={metric.value} duration={1.5} />
                      </p>
                      <p className="text-sm font-medium" style={{ color: textColors.secondary }}>
                        {metric.label}
                      </p>
                    </div>
                    {metric.change !== null && (
                      <p className="text-xs mt-2" style={{ color: textColors.secondary }}>
                        {isPositive ? '↑' : '↓'} {Math.abs(metric.change)} {t("adminPerWeek")}
                      </p>
                    )}
                  </div>
                </motion.div>
              </Link>
            </BlurFade>
          );
        })}
      </div>

      {/* Графики и статистика */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* График завершений - Area Chart */}
        <BlurFade delay={0.2} direction="diagonal-bottom-left" offset={60} blur="16px" scale={true} rotation={-8}>
          <div 
            className="rounded-xl p-6 relative overflow-hidden group transition-all duration-300 hover:shadow-2xl"
            style={{
              ...glassStyle,
              boxShadow: isDark 
                ? "0 8px 32px rgba(139, 92, 246, 0.15)" 
                : "0 4px 20px rgba(139, 92, 246, 0.1)",
            }}
          >
            {/* Glow эффект на фоне */}
            <div 
              className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-20 blur-3xl transition-opacity group-hover:opacity-30"
              style={{ background: "radial-gradient(circle, #8b5cf6 0%, transparent 70%)" }}
            />
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 relative z-10" style={{ color: textColors.primary }}>
              <TrendingUp className="w-5 h-5 transition-transform group-hover:scale-110" style={{ color: "#8b5cf6" }} />
              {t("adminCompletionsOverTime")}
            </h2>
            <motion.div 
              className="h-64 relative z-10"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={chartsLoaded ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95 }}
              transition={{ delay: 0.3, duration: 0.8, ease: [0.34, 1.56, 0.64, 1] }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={completionsChartData.map((point) => {
                    const d = new Date(point.date);
                    const month = String(d.getMonth() + 1).padStart(2, "0");
                    const day = String(d.getDate()).padStart(2, "0");
                    return {
                      date: `${month}-${day}`,
                      value: point.count,
                    };
                  })}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <defs>
                    {/* Glow filter для линии */}
                    <filter id="glowCompletions" x="-50%" y="-50%" width="200%" height="200%">
                      <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                      <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                      </feMerge>
                    </filter>
                    {/* Улучшенный градиент для области */}
                    <linearGradient id="colorCompletions" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.9} />
                      <stop offset="50%" stopColor="#8b5cf6" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.15} />
                    </linearGradient>
                    {/* Градиент для линии */}
                    <linearGradient id="strokeCompletions" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#c4b5fd" />
                      <stop offset="50%" stopColor="#8b5cf6" />
                      <stop offset="100%" stopColor="#7c3aed" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid 
                    strokeDasharray="3 3" 
                    stroke={isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}
                    strokeOpacity={0.5}
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: textColors.secondary, fontSize: 11 }}
                    tickLine={{ stroke: textColors.secondary, strokeOpacity: 0.3 }}
                    interval={2}
                    axisLine={{ stroke: textColors.secondary, strokeOpacity: 0.2 }}
                  />
                  <YAxis
                    tick={{ fill: textColors.secondary, fontSize: 11 }}
                    tickLine={{ stroke: textColors.secondary, strokeOpacity: 0.3 }}
                    axisLine={{ stroke: textColors.secondary, strokeOpacity: 0.2 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDark ? "rgba(26, 34, 56, 0.98)" : "rgba(255, 255, 255, 0.98)",
                      border: `1px solid ${isDark ? "rgba(139, 92, 246, 0.3)" : "rgba(139, 92, 246, 0.2)"}`,
                      borderRadius: "12px",
                      color: textColors.primary,
                      boxShadow: "0 8px 32px rgba(139, 92, 246, 0.3)",
                      padding: "8px 12px",
                    }}
                    labelStyle={{ color: textColors.primary, fontWeight: 600 }}
                    formatter={(value: any) => [value ?? 0, t("adminCompleted")]}
                    labelFormatter={(label) => label}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="url(#strokeCompletions)"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorCompletions)"
                    filter="url(#glowCompletions)"
                    style={{ transition: "all 0.3s ease" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </motion.div>
          </div>
        </BlurFade>

        {/* График новых пользователей - Bar Chart */}
        <BlurFade delay={0.4} direction="diagonal-bottom-right" offset={60} blur="16px" scale={true} rotation={8}>
          <div 
            className="rounded-xl p-6 relative overflow-hidden group transition-all duration-300 hover:shadow-2xl"
            style={{
              ...glassStyle,
              boxShadow: isDark 
                ? "0 8px 32px rgba(96, 165, 250, 0.15)" 
                : "0 4px 20px rgba(96, 165, 250, 0.1)",
            }}
          >
            {/* Glow эффект на фоне */}
            <div 
              className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-20 blur-3xl transition-opacity group-hover:opacity-30"
              style={{ background: "radial-gradient(circle, #60a5fa 0%, transparent 70%)" }}
            />
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 relative z-10" style={{ color: textColors.primary }}>
              <Users className="w-5 h-5 transition-transform group-hover:scale-110" style={{ color: "#60a5fa" }} />
              {t("adminNewUsers")}
            </h2>
            <motion.div 
              className="h-64 relative z-10"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={chartsLoaded ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95 }}
              transition={{ delay: 0.5, duration: 0.8, ease: [0.34, 1.56, 0.64, 1] }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={newUsersChartData.map((point) => {
                    const d = new Date(point.date);
                    const month = String(d.getMonth() + 1).padStart(2, "0");
                    const day = String(d.getDate()).padStart(2, "0");
                    return {
                      date: `${month}-${day}`,
                      value: point.count,
                    };
                  })}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <defs>
                    {/* Glow filter для столбцов */}
                    <filter id="glowUsers" x="-50%" y="-50%" width="200%" height="200%">
                      <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                      <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                      </feMerge>
                    </filter>
                    {/* Градиент для столбцов */}
                    <linearGradient id="gradientUsers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#93c5fd" stopOpacity={1} />
                      <stop offset="50%" stopColor="#60a5fa" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.9} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid 
                    strokeDasharray="3 3" 
                    stroke={isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}
                    strokeOpacity={0.5}
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: textColors.secondary, fontSize: 11 }}
                    tickLine={{ stroke: textColors.secondary, strokeOpacity: 0.3 }}
                    interval={2}
                    axisLine={{ stroke: textColors.secondary, strokeOpacity: 0.2 }}
                  />
                  <YAxis
                    tick={{ fill: textColors.secondary, fontSize: 11 }}
                    tickLine={{ stroke: textColors.secondary, strokeOpacity: 0.3 }}
                    axisLine={{ stroke: textColors.secondary, strokeOpacity: 0.2 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDark ? "rgba(26, 34, 56, 0.98)" : "rgba(255, 255, 255, 0.98)",
                      border: `1px solid ${isDark ? "rgba(96, 165, 250, 0.3)" : "rgba(96, 165, 250, 0.2)"}`,
                      borderRadius: "12px",
                      color: textColors.primary,
                      boxShadow: "0 8px 32px rgba(96, 165, 250, 0.3)",
                      padding: "8px 12px",
                    }}
                    labelStyle={{ color: textColors.primary, fontWeight: 600 }}
                    formatter={(value: any) => [value ?? 0, t("adminNewUsers")]}
                    labelFormatter={(label) => label}
                  />
                  <Bar 
                    dataKey="value" 
                    fill="url(#gradientUsers)" 
                    radius={[6, 6, 0, 0]}
                    filter="url(#glowUsers)"
                    style={{ 
                      transition: "all 0.3s ease",
                      cursor: "pointer",
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </motion.div>
          </div>
        </BlurFade>
      </div>

      {/* Топ курсов и недавние действия */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Топ курсов */}
        <BlurFade delay={0.5} direction="diagonal-top-left" offset={50} blur="14px" scale={true} rotation={-6} className="h-full">
          <div className="rounded-xl p-6 h-full flex flex-col" style={glassStyle}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: textColors.primary }}>
                <BookOpen className="w-5 h-5 text-purple-500" />
                {t("adminTopCourses")}
              </h2>
              <Link href="/app/admin/courses" className="text-sm font-medium hover:underline" style={{ color: "#8b5cf6" }}>
                {t("adminAllCourses")} →
              </Link>
            </div>
            {topCourses.length === 0 ? (
              <div className="text-center py-8">
                <BookOpen className="w-12 h-12 mx-auto mb-2 opacity-20" style={{ color: textColors.secondary }} />
                <p style={{ color: textColors.secondary }}>{t("adminNoCourseData")}</p>
              </div>
            ) : (
              <div className="space-y-2 flex-1">
                {topCourses.map((course, index) => (
                  <motion.div
                    key={course.course_id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-opacity-50 transition-colors"
                    style={{ background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)" }}
                  >
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-500 text-white font-bold text-xs shrink-0">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate text-sm leading-tight" style={{ color: textColors.primary }}>
                          {getLocalizedCourseTitle(course as any, t)}
                        </p>
                        <p className="text-xs leading-tight mt-0.5" style={{ color: textColors.secondary }}>
                          {t("adminEnrollmentsCount").replace("{count}", String(course.enrollments))} • {t("adminCompletionsCount").replace("{count}", String(course.completed_topics))}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </BlurFade>

        {/* Недавние действия */}
        <BlurFade delay={0.55} direction="diagonal-top-right" offset={50} blur="14px" scale={true} rotation={6} className="h-full">
          <div className="rounded-xl p-6 h-full flex flex-col" style={glassStyle}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: textColors.primary }}>
                <Activity className="w-5 h-5 text-blue-500" />
                {t("adminRecentActions")}
              </h2>
              <Link href="/app/admin/analytics" className="text-sm font-medium hover:underline" style={{ color: "#3b82f6" }}>
                {t("adminAllActions")} →
              </Link>
            </div>
            {logs.length === 0 ? (
              <div className="text-center py-8">
                <Activity className="w-12 h-12 mx-auto mb-2 opacity-20" style={{ color: textColors.secondary }} />
                <p style={{ color: textColors.secondary }}>{t("adminNoRecentActions")}</p>
              </div>
            ) : (
              <div className="space-y-2 flex-1 overflow-y-auto max-h-[600px]">
                {logs.map((log, index) => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-start gap-2.5 py-2 px-3 rounded-lg"
                    style={{ background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)" }}
                  >
                    <div className="w-1.5 h-1.5 rounded-full mt-1.5 bg-blue-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight" style={{ color: textColors.primary }}>
                        {log.user_name ?? t("adminSystem")}
                      </p>
                      <p className="text-xs truncate leading-tight mt-0.5" style={{ color: textColors.secondary }}>
                        {(() => {
                          const actionMap: Record<string, string> = {
                            login: t("actionLogin"),
                            user_created: t("actionUserCreated"),
                            user_updated: t("actionUserUpdated"),
                            student_profile_updated: t("actionStudentProfileUpdated"),
                            user_deleted: t("actionUserDeleted"),
                            course_created: t("actionCourseCreated"),
                            course_updated: t("actionCourseUpdated"),
                            course_deleted: t("actionCourseDeleted"),
                          };
                          return actionMap[log.action] || log.action;
                        })()}
                      </p>
                      {log.created_at && (
                        <p className="text-xs mt-0.5 leading-tight" style={{ color: textColors.secondary }}>
                          {formatDateTimeLocalized(log.created_at, lang, {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </BlurFade>
      </div>

      {/* Быстрые действия */}
      <BlurFade delay={0.6} direction="scale" offset={40} blur="12px" scale={true}>
        <div className="rounded-xl p-6" style={glassStyle}>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2" style={{ color: textColors.primary }}>
            <Zap className="w-5 h-5 text-yellow-500" />
            {t("adminQuickActions")}
          </h2>
          <div className={`grid gap-4 ${canManageUsers() ? "grid-cols-1 md:grid-cols-3" : "grid-cols-1 md:grid-cols-2"}`}>
            {canManageUsers() && (
              <Link href="/app/admin/users">
                <div className="flex items-center gap-3 p-4 rounded-lg hover:bg-opacity-50 transition-colors cursor-pointer border" style={{ 
                  background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
                  borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"
                }}>
                  <UserPlus className="w-5 h-5 text-blue-500" />
                  <span className="font-medium" style={{ color: textColors.primary }}>{t("adminManageUsers")}</span>
                </div>
              </Link>
            )}
            <Link href="/app/admin/courses">
              <div className="flex items-center gap-3 p-4 rounded-lg hover:bg-opacity-50 transition-colors cursor-pointer border" style={{ 
                background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
                borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"
              }}>
                <BookPlus className="w-5 h-5 text-green-500" />
                <span className="font-medium" style={{ color: textColors.primary }}>{t("adminManageCourses")}</span>
              </div>
            </Link>
            <Link href="/app/admin/analytics">
              <div className="flex items-center gap-3 p-4 rounded-lg hover:bg-opacity-50 transition-colors cursor-pointer border" style={{ 
                background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
                borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"
              }}>
                <BarChart3 className="w-5 h-5 text-purple-500" />
                <span className="font-medium" style={{ color: textColors.primary }}>{t("adminAnalytics")}</span>
              </div>
            </Link>
          </div>
        </div>
      </BlurFade>
    </div>
  );
}
