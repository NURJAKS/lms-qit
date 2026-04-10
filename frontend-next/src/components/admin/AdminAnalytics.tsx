"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
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
  LineChart,
  Line,
} from "recharts";
import { api } from "@/api/client";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import {
  BarChart3,
  Users,
  BookOpen,
  Trophy,
  TrendingUp,
  Download,
  ListTodo,
} from "lucide-react";
import { AnimatedNumber } from "./AnimatedNumber";
import { StaggeredAnimation } from "./StaggeredAnimation";
import { GlareEffect } from "./GlareEffect";
import { CourseStatsChart } from "./CourseStatsChart";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { toast } from "@/store/notificationStore";

type CourseStat = {
  course_id: number;
  title?: string;
  enrollments: number;
  completed_topics: number;
  total_topics?: number;
};
type LeaderboardItem = {
  rank: number;
  user_id: number;
  full_name: string;
  email: string;
  rating_score: number;
  avg_score: number;
  avg_assignment: number;
  courses_done: number;
  activity: number;
  points?: number;
};
type TimeSeriesPoint = { date: string; count: number };
type AssignmentsSummary = {
  total_assignments: number;
  pending: number;
  graded: number;
};

export function AdminAnalytics() {
  const { t, lang } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const {
    data: courseStats = [],
    isLoading: courseStatsLoading,
    isError: courseStatsError,
  } = useQuery({
    queryKey: ["analytics-course-stats"],
    queryFn: async () => {
      const { data } = await api.get<CourseStat[]>("/analytics/course-stats");
      return data;
    },
    retry: (_, err: { response?: { status?: number } }) =>
      err?.response?.status !== 403,
  });

  const {
    data: leaderboard = [],
    isLoading: leaderboardLoading,
    isError: leaderboardError,
  } = useQuery({
    queryKey: ["analytics-leaderboard"],
    queryFn: async () => {
      const { data } = await api.get<LeaderboardItem[]>(
        "/analytics/leaderboard?limit=20"
      );
      return data;
    },
    retry: (_, err: { response?: { status?: number } }) =>
      err?.response?.status !== 403,
  });

  const { data: completionsData } = useQuery({
    queryKey: ["analytics-completions", 30],
    queryFn: async () => {
      const { data } = await api.get<{ data: TimeSeriesPoint[] }>(
        "/analytics/completions-over-time?days=30"
      );
      return data;
    },
    retry: (_, err: { response?: { status?: number } }) =>
      err?.response?.status !== 403,
  });

  const { data: newUsersData } = useQuery({
    queryKey: ["analytics-new-users", 30],
    queryFn: async () => {
      const { data } = await api.get<{ data: TimeSeriesPoint[] }>(
        "/analytics/new-users?days=30"
      );
      return data;
    },
    retry: (_, err: { response?: { status?: number } }) =>
      err?.response?.status !== 403,
  });

  const { data: assignmentsSummary } = useQuery({
    queryKey: ["analytics-assignments-summary"],
    queryFn: async () => {
      const { data } = await api.get<AssignmentsSummary>(
        "/analytics/assignments-summary"
      );
      return data;
    },
    retry: (_, err: { response?: { status?: number } }) =>
      err?.response?.status !== 403,
  });

  const isLoading = courseStatsLoading || leaderboardLoading;
  const hasError = courseStatsError || leaderboardError;

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

  const sparseDayTicks = useMemo(() => {
    const pick = (data: TimeSeriesPoint[]) => {
      if (data.length <= 8) return undefined as string[] | undefined;
      const target = 6;
      const step = Math.max(1, Math.floor((data.length - 1) / (target - 1)));
      const ticks: string[] = [];
      for (let i = 0; i < data.length; i += step) ticks.push(data[i].date);
      const last = data[data.length - 1].date;
      if (ticks[ticks.length - 1] !== last) ticks.push(last);
      return ticks;
    };
    return {
      completions: pick(completionsChartData),
      newUsers: pick(newUsersChartData),
    };
  }, [completionsChartData, newUsersChartData]);

  const totalEnrollments = courseStats.reduce((s, c) => s + c.enrollments, 0);
  const totalCompleted = courseStats.reduce(
    (s, c) => s + c.completed_topics,
    0
  );

  const handleExportExcel = async () => {
    try {
      const { data } = await api.get<Blob>(`/analytics/leaderboard/excel?limit=20&lang=${lang}`, {
        responseType: "blob",
      });
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = lang === "kk" ? "reiting-top20.xlsx" : "leaderboard-top20.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to export Excel:", error);
      const err = error as { response?: { data?: { detail?: string }; status?: number }; message?: string };
      const errorMessage = err?.response?.data?.detail || err?.message || t("excelExportError");
      toast.error(errorMessage);
    }
  };

  if (hasError) {
    return (
      <div className="space-y-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <BarChart3 className="w-8 h-8 text-blue-600 dark:text-blue-400" />{" "}
          {t("adminAnalyticsTitle")}
        </h1>
        <div className="rounded-2xl border-0 backdrop-blur-xl p-8 text-center shadow-lg dark:shadow-xl" style={{ 
          background: isDark ? "rgba(26, 34, 56, 0.7)" : "rgba(255, 255, 255, 0.85)", 
          backdropFilter: "blur(12px)" 
        }}>
          <p className="font-medium text-lg" style={{ color: "#FF4181" }}>
            {t("adminAnalyticsLoadError")}
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <h1 className={`text-3xl font-bold flex items-center gap-2 ${isDark ? "text-white" : "text-gray-900"}`}>
            <BarChart3 className="w-8 h-8" style={{ color: "#8B5CF6" }} />{" "}
            {t("adminAnalyticsTitle")}
          </h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="rounded-2xl p-6 border-0 backdrop-blur-xl animate-pulse"
              style={{ background: isDark ? "rgba(26, 34, 56, 0.7)" : "rgba(255, 255, 255, 0.85)", backdropFilter: "blur(12px)" }}
            >
              <div className={`h-4 w-24 rounded mb-4 ${isDark ? "bg-white/10" : "bg-gray-200"}`} />
              <div className={`h-12 w-20 rounded ${isDark ? "bg-white/10" : "bg-gray-200"}`} />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-2xl border-0 backdrop-blur-xl p-6 animate-pulse h-64" style={{ background: isDark ? "rgba(26, 34, 56, 0.7)" : "rgba(255, 255, 255, 0.85)", backdropFilter: "blur(12px)" }} />
          <div className="rounded-2xl border-0 backdrop-blur-xl p-6 animate-pulse h-64" style={{ background: isDark ? "rgba(26, 34, 56, 0.7)" : "rgba(255, 255, 255, 0.85)", backdropFilter: "blur(12px)" }} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-2xl border-0 backdrop-blur-xl p-6 animate-pulse h-64" style={{ background: isDark ? "rgba(26, 34, 56, 0.7)" : "rgba(255, 255, 255, 0.85)", backdropFilter: "blur(12px)" }} />
          <div className="rounded-2xl border-0 backdrop-blur-xl p-6 animate-pulse h-64" style={{ background: isDark ? "rgba(26, 34, 56, 0.7)" : "rgba(255, 255, 255, 0.85)", backdropFilter: "blur(12px)" }} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between min-w-0">
        <h1 className={`text-2xl sm:text-3xl font-bold flex items-center gap-2 min-w-0 ${isDark ? "text-white" : "text-gray-900"}`}>
          <BarChart3 className="w-7 h-7 sm:w-8 sm:h-8 shrink-0" style={{ color: "#8B5CF6" }} />{" "}
          <span className="min-w-0">{t("adminAnalyticsTitle")}</span>
        </h1>
        <Link
          href="/app/leaderboard"
          className="inline-flex items-center justify-center gap-1.5 py-2 px-3 sm:px-4 rounded-lg bg-blue-600 dark:bg-qit-primary text-white hover:bg-blue-700 dark:hover:bg-qit-primary-light transition-colors text-sm shrink-0 w-full sm:w-auto text-center whitespace-normal leading-tight"
        >
          <Trophy className="w-4 h-4 shrink-0" /> {t("adminAnalyticsLeaderboardPage")}
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StaggeredAnimation delay={0}>
          <GlareEffect>
            <div
              className="rounded-2xl p-6 border-0 backdrop-blur-xl transition-all duration-300 card-glow-hover shadow-lg dark:shadow-xl"
              style={{ 
                background: isDark ? "rgba(26, 34, 56, 0.7)" : "rgba(255, 255, 255, 0.85)",
                backdropFilter: "blur(12px)",
                boxShadow: isDark ? "0 8px 32px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05)" : "0 4px 16px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.05)"
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm font-medium mb-2 ${isDark ? "text-[#94A3B8]" : "text-gray-600"}`}>
                    {t("adminTotalEnrollments")}
                  </p>
                  <p className={`text-5xl font-bold tracking-tight ${isDark ? "text-white" : "text-gray-900"}`}>
                    <AnimatedNumber value={totalEnrollments} duration={1.5} />
                  </p>
                </div>
                <div className="w-14 h-14 rounded-xl flex items-center justify-center bg-[rgba(139,92,246,0.2)]">
                  <Users className="w-7 h-7 text-[#8B5CF6]" />
                </div>
              </div>
            </div>
          </GlareEffect>
        </StaggeredAnimation>
        <StaggeredAnimation delay={100}>
          <GlareEffect>
            <div
              className="rounded-2xl p-6 border-0 backdrop-blur-xl transition-all duration-300 card-glow-hover shadow-lg dark:shadow-xl"
              style={{ 
                background: isDark ? "rgba(26, 34, 56, 0.7)" : "rgba(255, 255, 255, 0.85)",
                backdropFilter: "blur(12px)",
                boxShadow: isDark ? "0 8px 32px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05)" : "0 4px 16px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.05)"
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm font-medium mb-2 ${isDark ? "text-[#94A3B8]" : "text-gray-600"}`}>
                    {t("adminCompletedTopics")}
                  </p>
                  <p className={`text-5xl font-bold tracking-tight ${isDark ? "text-white" : "text-gray-900"}`}>
                    <AnimatedNumber value={totalCompleted} duration={1.5} />
                  </p>
                </div>
                <div className="w-14 h-14 rounded-xl flex items-center justify-center bg-[rgba(6,182,212,0.2)]">
                  <TrendingUp className="w-7 h-7 text-[#06B6D4]" />
                </div>
              </div>
            </div>
          </GlareEffect>
        </StaggeredAnimation>
        <StaggeredAnimation delay={200}>
          <GlareEffect>
            <div
              className="rounded-2xl p-6 border-0 backdrop-blur-xl transition-all duration-300 card-glow-hover shadow-lg dark:shadow-xl"
              style={{ 
                background: isDark ? "rgba(26, 34, 56, 0.7)" : "rgba(255, 255, 255, 0.85)",
                backdropFilter: "blur(12px)",
                boxShadow: isDark ? "0 8px 32px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05)" : "0 4px 16px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.05)"
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm font-medium mb-2 ${isDark ? "text-[#94A3B8]" : "text-gray-600"}`}>
                    {t("adminActiveCourses")}
                  </p>
                  <p className={`text-5xl font-bold tracking-tight ${isDark ? "text-white" : "text-gray-900"}`}>
                    <AnimatedNumber value={courseStats.length} duration={1.5} />
                  </p>
                </div>
                <div className="w-14 h-14 rounded-xl flex items-center justify-center bg-[rgba(255,65,129,0.2)]">
                  <BookOpen className="w-7 h-7 text-[#FF4181]" />
                </div>
              </div>
            </div>
          </GlareEffect>
        </StaggeredAnimation>
        <StaggeredAnimation delay={300}>
          <GlareEffect>
            <div
              className="rounded-2xl p-6 border-0 backdrop-blur-xl transition-all duration-300 card-glow-hover shadow-lg dark:shadow-xl"
              style={{ 
                background: isDark ? "rgba(26, 34, 56, 0.7)" : "rgba(255, 255, 255, 0.85)",
                backdropFilter: "blur(12px)",
                boxShadow: isDark ? "0 8px 32px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05)" : "0 4px 16px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.05)"
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm font-medium mb-2 ${isDark ? "text-[#94A3B8]" : "text-gray-600"}`}>
                    {t("adminAssignments")}
                  </p>
                  <p className={`text-5xl font-bold tracking-tight ${isDark ? "text-white" : "text-gray-900"}`}>
                    <AnimatedNumber value={assignmentsSummary?.total_assignments ?? 0} duration={1.5} />
                  </p>
                  <p className={`text-xs mt-2 ${isDark ? "text-[#94A3B8]" : "text-gray-500"}`}>
                    {t("adminAssignmentsPending")}: {assignmentsSummary?.pending ?? 0} · {t("adminAssignmentsGraded")}: {assignmentsSummary?.graded ?? 0}
                  </p>
                </div>
                <div className="w-14 h-14 rounded-xl flex items-center justify-center bg-[rgba(185,56,235,0.2)]">
                  <ListTodo className="w-7 h-7 text-[#B938EB]" />
                </div>
              </div>
            </div>
          </GlareEffect>
        </StaggeredAnimation>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StaggeredAnimation delay={400}>
          <GlareEffect>
            <div className="rounded-2xl p-6 border-0 backdrop-blur-xl transition-all duration-300 card-hover-lift shadow-lg" style={{ 
              background: isDark ? "rgba(30, 41, 59, 0.4)" : "rgba(255, 255, 255, 0.85)", 
              backdropFilter: "blur(12px)", 
              border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(0, 0, 0, 0.05)",
              boxShadow: isDark ? "0 8px 32px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05)" : "0 4px 16px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.05)"
            }}>
              <h2 className={`font-semibold mb-6 flex items-center gap-2 text-lg ${isDark ? "text-white" : "text-gray-900"}`}>
                <TrendingUp className="w-5 h-5 text-[#8B5CF6]" /> {t("adminCompletionsOverTime")}
              </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={completionsChartData}>
                <defs>
                  <linearGradient id="completionsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8B5CF6" stopOpacity={isDark ? 0.5 : 0.3} />
                    <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)"} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: isDark ? "#94A3B8" : "#64748B" }}
                  tickFormatter={(v) => String(v).slice(5)}
                  stroke={isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)"}
                  angle={-40}
                  textAnchor="end"
                  height={52}
                  {...(sparseDayTicks.completions
                    ? { ticks: sparseDayTicks.completions, interval: 0 as const }
                    : { interval: "preserveStartEnd" as const })}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: isDark ? "#94A3B8" : "#64748B" }}
                  stroke={isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)"}
                  allowDecimals={false}
                  tickCount={6}
                />
                <Tooltip
                  contentStyle={{ 
                    backgroundColor: isDark ? "rgba(26, 34, 56, 0.95)" : "rgba(255, 255, 255, 0.98)", 
                    color: isDark ? "#fff" : "#0F172A", 
                    borderRadius: "12px",
                    border: isDark ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(0, 0, 0, 0.1)",
                    backdropFilter: "blur(10px)",
                    boxShadow: isDark ? "0 8px 32px rgba(0, 0, 0, 0.3)" : "0 4px 16px rgba(0, 0, 0, 0.15)"
                  }}
                  formatter={(value: any, name: any) => {
                    if (name === "count") return [value ?? 0, t("adminCompleted")];
                    return [value ?? 0, String(name)];
                  }}
                  labelFormatter={(label) => label}
                />
                <Area 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#8B5CF6" 
                  strokeWidth={3}
                  fill="url(#completionsGradient)"
                  style={{
                    filter: "drop-shadow(0 0 8px rgba(139, 92, 246, 0.6))",
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
            </div>
          </GlareEffect>
        </StaggeredAnimation>
        <StaggeredAnimation delay={500}>
          <GlareEffect>
            <div className="rounded-2xl p-6 border-0 backdrop-blur-xl transition-all duration-300 card-hover-lift shadow-lg" style={{ 
              background: isDark ? "rgba(30, 41, 59, 0.4)" : "rgba(255, 255, 255, 0.85)", 
              backdropFilter: "blur(12px)", 
              border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(0, 0, 0, 0.05)",
              boxShadow: isDark ? "0 8px 32px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05)" : "0 4px 16px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.05)"
            }}>
              <h2 className={`font-semibold mb-6 flex items-center gap-2 text-lg ${isDark ? "text-white" : "text-gray-900"}`}>
                <Users className="w-5 h-5 text-[#06B6D4]" /> {t("adminNewUsers")}
              </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={newUsersChartData}>
                <defs>
                  <linearGradient id="usersGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06B6D4" stopOpacity={isDark ? 0.8 : 0.4} />
                    <stop offset="95%" stopColor="#06B6D4" stopOpacity={isDark ? 0.4 : 0.2} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)"} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: isDark ? "#94A3B8" : "#64748B" }}
                  tickFormatter={(v) => String(v).slice(5)}
                  stroke={isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)"}
                  angle={-40}
                  textAnchor="end"
                  height={52}
                  {...(sparseDayTicks.newUsers
                    ? { ticks: sparseDayTicks.newUsers, interval: 0 as const }
                    : { interval: "preserveStartEnd" as const })}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: isDark ? "#94A3B8" : "#64748B" }}
                  stroke={isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)"}
                  allowDecimals={false}
                  tickCount={6}
                />
                <Tooltip
                  contentStyle={{ 
                    backgroundColor: isDark ? "rgba(26, 34, 56, 0.95)" : "rgba(255, 255, 255, 0.98)", 
                    color: isDark ? "#fff" : "#0F172A", 
                    borderRadius: "12px",
                    border: isDark ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(0, 0, 0, 0.1)",
                    backdropFilter: "blur(10px)",
                    boxShadow: isDark ? "0 8px 32px rgba(0, 0, 0, 0.3)" : "0 4px 16px rgba(0, 0, 0, 0.15)"
                  }}
                  formatter={(value: any, name: any) => {
                    if (name === "count") return [value ?? 0, t("adminNewUsers")];
                    return [value ?? 0, String(name)];
                  }}
                  labelFormatter={(label) => label}
                />
                <Bar 
                  dataKey="count" 
                  fill="url(#usersGradient)" 
                  radius={[8, 8, 0, 0]}
                  style={{
                    filter: "drop-shadow(0 0 6px rgba(6, 182, 212, 0.5))",
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
            </div>
          </GlareEffect>
        </StaggeredAnimation>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StaggeredAnimation delay={600}>
          <CourseStatsChart courseStats={courseStats} />
        </StaggeredAnimation>

        <StaggeredAnimation delay={700}>
          <GlareEffect>
            <div className="rounded-2xl p-6 border-0 backdrop-blur-xl transition-all duration-300 card-hover-lift shadow-lg" style={{ 
              background: isDark ? "rgba(30, 41, 59, 0.4)" : "rgba(255, 255, 255, 0.85)", 
              backdropFilter: "blur(12px)", 
              border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(0, 0, 0, 0.05)",
              boxShadow: isDark ? "0 8px 32px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05)" : "0 4px 16px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.05)"
            }}>
              <div className="flex items-center justify-between mb-6">
                <h2 className={`font-semibold flex items-center gap-2 text-lg ${isDark ? "text-white" : "text-gray-900"}`}>
                  <Trophy className="w-5 h-5 text-[#FBBF24]" /> {t("adminLeaderboardTop20")}
                </h2>
                <ShimmerButton
                  onClick={handleExportExcel}
                  className="flex items-center gap-1 py-1.5 px-3 rounded-xl text-white text-xs border-0 bg-gradient-to-r from-blue-600 to-purple-600"
                  shimmerColor="#ffffff"
                >
                  <Download className="w-4 h-4" /> Excel
                </ShimmerButton>
          </div>
          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className={`sticky top-0 ${isDark ? "bg-black/30" : "bg-gray-50"}`}>
                <tr>
                  <th className={`text-left py-3 px-4 font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
                    #
                  </th>
                  <th className={`text-left py-3 px-4 font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
                    {t("adminFullName")}
                  </th>
                  <th className={`text-left py-3 px-4 font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
                    {t("leaderboardRatingScore")}
                  </th>
                  <th className={`text-left py-3 px-4 font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
                    {t("leaderboardAvgTestScore")}
                  </th>
                  <th className={`text-left py-3 px-4 font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
                    {t("leaderboardAvgAssignment")}
                  </th>
                  <th className={`text-left py-3 px-4 font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
                    {t("courses")}
                  </th>
                  <th className={`text-left py-3 px-4 font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
                    {t("adminActivity")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((r) => (
                  <tr key={r.user_id} className={`border-b transition-colors ${isDark ? "border-white/10 hover:bg-white/5" : "border-gray-200 hover:bg-gray-50"}`}>
                    <td className={`py-3 px-4 font-bold ${isDark ? "text-white" : "text-gray-900"}`}>{r.rank}</td>
                    <td className={`py-3 px-4 ${isDark ? "text-white" : "text-gray-900"}`}>{r.full_name}</td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-[rgba(139,92,246,0.2)] text-[#8B5CF6] border border-[rgba(139,92,246,0.3)]">
                        {r.rating_score.toFixed(1)}
                      </span>
                    </td>
                    <td className={`py-3 px-4 ${isDark ? "text-white" : "text-gray-900"}`}>{r.avg_score.toFixed(1)}</td>
                    <td className={`py-3 px-4 ${isDark ? "text-white" : "text-gray-900"}`}>{r.avg_assignment.toFixed(1)}</td>
                    <td className={`py-3 px-4 ${isDark ? "text-white" : "text-gray-900"}`}>{r.courses_done}</td>
                    <td className={`py-3 px-4 ${isDark ? "text-[#94A3B8]" : "text-gray-600"}`}>{r.activity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {leaderboard.length === 0 && (
              <p className={`py-6 text-center ${isDark ? "text-[#94A3B8]" : "text-gray-600"}`}>
                {t("adminLeaderboardEmpty")}
              </p>
            )}
          </div>
            </div>
          </GlareEffect>
        </StaggeredAnimation>
      </div>
    </div>
  );
}
