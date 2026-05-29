"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import {
  Users,
  BookOpen,
  Download,
  Printer,
  User,
  FolderCode,
  CheckCircle2,
  Award,
  TrendingUp,
  Clock,
  Target,
  Trophy,
  AlertCircle,
  GraduationCap,
  BarChart3,
  Star,
  Zap,
} from "lucide-react";
import { getGlassCardStyle, getTextColors, getDashboardCardStyle } from "@/utils/themeStyles";
import { BlurFade } from "@/components/ui/blur-fade";
import { getLocalizedCourseTitle, getLocalizedTopicTitle } from "@/lib/courseUtils";
import { formatLocalizedDate } from "@/utils/dateUtils";

interface ReportCourse {
  course_id: number;
  course_title: string;
  progress_percent: number;
  topics_completed: number;
  completed_topic_titles: string[];
  total_topics: number;
  test_scores: number[];
  avg_test_score: number | null;
  certificate: { id: number; final_score: number | null; issued_at: string | null } | null;
}

interface Report {
  student: { id: number; full_name: string; email: string };
  courses: ReportCourse[];
  certificates: Array<{ course_id: number; course_title: string; final_score: number | null }>;
  overall_stats: {
    avg_score: number | null;
    total_topics_completed: number;
    courses_enrolled: number;
    certificates_count: number;
    total_study_hours?: number;
    assignment_avg_score?: number | null;
    assignments_count?: number;
    rank?: number | null;
    points?: number;
  };
}

interface Child {
  id: number;
  full_name: string;
  email: string;
  avatarColor?: string;
}

interface ParentAssignment {
  id: number;
  title: string;
  description: string | null;
  course_id: number;
  course_title: string;
  deadline: string | null;
  submitted: boolean;
  grade: number | null;
  teacher_comment: string | null;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function ParentDashboard() {
  const { t, lang } = useLanguage();
  const { theme } = useTheme();
  const glassStyle = getGlassCardStyle(theme);
  const textColors = getTextColors(theme);
  const cardStyle = getDashboardCardStyle(theme);
  const isDark = theme === "dark";
  const [selectedChildId, setSelectedChildId] = useState<number | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);
  const avatarColors = [
    "linear-gradient(135deg, #FF6B6B 0%, #EE5A24 100%)",
    "linear-gradient(135deg, #7C3AED 0%, #DB2777 100%)",
    "linear-gradient(135deg, #059669 0%, #14B8A6 100%)",
    "linear-gradient(135deg, #2563EB 0%, #06B6D4 100%)",
  ];

  const { data: childrenData = [], isLoading: childrenLoading, error: childrenError } = useQuery({
    queryKey: ["parent-children"],
    queryFn: async () => {
      const { data } = await api.get<Array<{ id: number; full_name: string; email: string }>>("/parent/children");
      return data;
    },
  });

  const children = childrenData.map((c, idx) => ({
    ...c,
    avatarColor: avatarColors[idx % avatarColors.length],
  }));

  const childIds = children.map((child) => child.id);

  const { data: childrenReports = [], isLoading: childrenReportsLoading } = useQuery({
    queryKey: ["parent-children-reports", childIds],
    enabled: childIds.length > 0,
    queryFn: async () => {
      const settled = await Promise.allSettled(
        childIds.map(async (childId) => {
          const { data } = await api.get<Report>(`/parent/children/${childId}/report`);
          return { childId, report: data };
        })
      );
      return settled.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
    },
  });

  const reportsByChildId = new Map(childrenReports.map(({ childId, report }) => [childId, report]));

  const selectedChildReportFromList = selectedChildId ? reportsByChildId.get(selectedChildId) ?? null : null;

  const { data: childReportQueryData, isLoading: childReportLoading, error: childReportError } = useQuery({
    queryKey: ["parent-child-report", selectedChildId],
    queryFn: async () => {
      if (!selectedChildId) return null;
      const { data } = await api.get<Report>(`/parent/children/${selectedChildId}/report`);
      return data;
    },
    enabled: !!selectedChildId && !selectedChildReportFromList,
  });

  const childReport = selectedChildReportFromList ?? childReportQueryData ?? null;

  const { data: childAssignmentsData, isLoading: childAssignmentsLoading, error: childAssignmentsError } = useQuery({
    queryKey: ["parent-child-assignments", selectedChildId],
    queryFn: async () => {
      if (!selectedChildId) return null;
      const { data } = await api.get<{
        student: { id: number; full_name: string; email: string };
        assignments: ParentAssignment[];
      }>(`/parent/children/${selectedChildId}/assignments`);
      return data;
    },
    enabled: !!selectedChildId,
  });

  // Автоматически выбираем первого ребенка если не выбран
  useEffect(() => {
    if (!selectedChildId && children.length > 0) {
      setSelectedChildId(children[0].id);
    }
  }, [children, selectedChildId]);

  const handleDownload = () => {
    if (!childReport) return;
    const text = [
      `${t("parentReportTitle")}: ${childReport.student.full_name}`,
      `${t("email")}: ${childReport.student.email}`,
      "",
      `=== ${t("parentProgress")} ===`,
      ...childReport.courses.flatMap((c) => [
        getLocalizedCourseTitle({ title: c.course_title } as any, t),
        `  ${t("parentProgress")}: ${c.progress_percent}%`,
        `  ${t("parentTestScores")}: ${c.test_scores.length ? c.test_scores.join(", ") : "—"}`,
        `  ${t("profileTopic")}: ${c.completed_topic_titles.length ? c.completed_topic_titles.map((tt) => getLocalizedTopicTitle(tt, t)).join(", ") : "—"}`,
        "",
      ]),
      `=== ${t("parentOverallStats")} ===`,
      `${t("parentAvgScore")}: ${childReport.overall_stats.avg_score ?? "—"}`,
      `${t("parentTopicsCompleted")}: ${childReport.overall_stats.total_topics_completed}`,
      `${t("parentCertificates")}: ${childReport.overall_stats.certificates_count}`,
    ].join("\n");
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${childReport.student.full_name.replace(/\s+/g, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  const overallProgress = childReport?.courses?.length
    ? Math.round(
        childReport.courses.reduce((s, c) => s + c.progress_percent, 0) / childReport.courses.length
      )
    : 0;

  const totalChildren = children.length;
  const totalCourses = childrenReports.reduce((sum, { report }) => {
    return sum + (report.overall_stats.courses_enrolled || 0);
  }, 0);
  const totalCertificates = childrenReports.reduce((sum, { report }) => {
    return sum + (report.overall_stats.certificates_count || 0);
  }, 0);
  const avgProgress = childrenReports.length
    ? Math.round(
        childrenReports.reduce((sum, { report }) => {
          if (!report.courses.length) return sum;
          const childProgress = report.courses.reduce((s, c) => s + c.progress_percent, 0) / report.courses.length;
          return sum + childProgress;
        }, 0) / childrenReports.length
      )
    : 0;

  if (childrenLoading) {
    return (
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6" style={{ color: textColors.primary }}>
          {t("parentDashboardTitle")}
        </h1>
        <div className="rounded-xl p-6 text-center" style={glassStyle}>
          <p className="font-medium" style={{ color: textColors.primary }}>
            {t("parentLoading")}
          </p>
        </div>
      </div>
    );
  }

  if (childrenError) {
    return (
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6" style={{ color: textColors.primary }}>
          {t("parentDashboardTitle")}
        </h1>
        <div className="rounded-xl p-6 text-center" style={glassStyle}>
          <AlertCircle className="w-12 h-12 mx-auto mb-3" style={{ color: "#EF4444" }} />
          <p className="font-medium mb-2" style={{ color: textColors.primary }}>
            {t("error")}
          </p>
          <p className="text-sm" style={{ color: textColors.secondary }}>
            {childrenError instanceof Error ? childrenError.message : t("parentLoading")}
          </p>
        </div>
      </div>
    );
  }

  if (children.length > 0 && childrenReportsLoading && childrenReports.length === 0) {
    return (
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6" style={{ color: textColors.primary }}>
          {t("parentDashboardTitle")}
        </h1>
        <div className="rounded-xl p-6 text-center" style={glassStyle}>
          <p className="font-medium" style={{ color: textColors.primary }}>
            {t("parentLoading")}
          </p>
        </div>
      </div>
    );
  }

  if (children.length === 0) {
    return (
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6" style={{ color: textColors.primary }}>
          {t("parentDashboardTitle")}
        </h1>
        <div className="rounded-xl p-6 text-center" style={glassStyle}>
          <Users className="w-12 h-12 mx-auto mb-3" style={{ color: "#F59E0B" }} />
          <p className="font-medium mb-2" style={{ color: textColors.primary }}>
            {t("parentNoChildren")}
          </p>
          <p className="text-sm" style={{ color: textColors.secondary }}>
            {t("parentNoChildrenHint")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <BlurFade delay={0.1} inView duration={0.6} blur="8px" offset={20}>
        <div
          className="relative rounded-xl overflow-hidden p-6 text-white"
          style={{
            background: "linear-gradient(135deg, #7C3AED 0%, #2563EB 50%, #06B6D4 100%)",
            boxShadow: "0 8px 24px rgba(124, 58, 237, 0.25)",
          }}
        >
        <div className="absolute inset-0 opacity-10">
          <svg className="absolute bottom-0 left-0 w-full h-24" viewBox="0 0 1200 120" preserveAspectRatio="none">
            <path fill="currentColor" d="M0,60 C300,120 600,0 900,60 C1050,90 1200,30 1200,60 L1200,120 L0,120 Z" />
          </svg>
        </div>
        <div className="absolute top-4 right-4 w-32 h-32 rounded-full bg-white/10 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <h1 className="text-xl lg:text-2xl font-bold">{t("parentDashboardTitle")}</h1>
          </div>
          <p className="text-white/90 text-sm mt-2">{t("parentDashboardSubtitle")}</p>
        </div>
        </div>
      </BlurFade>

      {/* Overall Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Users, value: totalChildren, label: t("profileChildren"), color: "#7C3AED" },
          { icon: BookOpen, value: totalCourses, label: t("parentTotalCourses"), color: "#3B82F6" },
          { icon: Trophy, value: totalCertificates, label: t("parentCertificates"), color: "#F59E0B" },
          {
            icon: TrendingUp,
            value: childrenReportsLoading && childrenReports.length === 0 ? t("parentLoading") : `${avgProgress}%`,
            label: t("parentAvgProgress"),
            color: "#10B981",
          },
        ].map((stat, index) => (
          <BlurFade key={stat.label} delay={0.2 + index * 0.1} duration={0.5} blur="6px" offset={15} direction="up">
            <div className="rounded-xl p-4 flex items-center gap-3" style={cardStyle}>
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-white shrink-0"
              style={{ background: stat.color }}
            >
              <stat.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-lg font-bold" style={{ color: textColors.primary }}>
                {stat.value}
              </p>
              <p className="text-xs" style={{ color: textColors.secondary }}>
                {stat.label}
              </p>
            </div>
            </div>
          </BlurFade>
        ))}
      </div>

      {/* Children Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {children.map((child, index) => {
          const report = reportsByChildId.get(child.id);
          const childProgress = report?.courses.length
            ? Math.round(
                report.courses.reduce((s, c) => s + c.progress_percent, 0) / report.courses.length
              )
            : 0;
          const isSelected = selectedChildId === child.id;

          return (
            <BlurFade key={child.id} delay={0.3 + index * 0.08} duration={0.5} blur="6px" offset={20} direction="up">
              <button
                type="button"
                onClick={() => setSelectedChildId(child.id)}
                className="text-left rounded-xl p-4 transition-all hover:scale-[1.02]"
                style={{
                  ...cardStyle,
                  border: isSelected
                    ? "2px solid #7C3AED"
                    : isDark
                    ? "1px solid rgba(255, 255, 255, 0.08)"
                    : "1px solid rgba(0, 0, 0, 0.08)",
                  background: isSelected
                    ? isDark
                      ? "rgba(124, 58, 237, 0.15)"
                      : "rgba(124, 58, 237, 0.05)"
                    : undefined,
                }}
              >
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                  style={{ background: child.avatarColor }}
                >
                  {getInitials(child.full_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate" style={{ color: textColors.primary }}>
                    {child.full_name}
                  </p>
                  <p className="text-xs truncate" style={{ color: textColors.secondary }}>
                    {child.email}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: textColors.secondary }}>
                    {t("profileCourseProgress")}
                  </span>
                  <span className="text-sm font-bold" style={{ color: textColors.primary }}>
                    {childProgress}%
                  </span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)" }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${childProgress}%`,
                      background: "linear-gradient(135deg, #7C3AED 0%, #2563EB 100%)",
                    }}
                  />
                </div>
                <div className="flex items-center gap-4 text-xs" style={{ color: textColors.secondary }}>
                  <span>
                    {report?.overall_stats.courses_enrolled || 0} {t("courses")}
                  </span>
                  {report?.overall_stats.certificates_count ? (
                    <span className="flex items-center gap-1">
                      <Trophy className="w-3 h-3" style={{ color: "#F59E0B" }} />
                      {report.overall_stats.certificates_count}
                    </span>
                  ) : null}
                </div>
              </div>
            </button>
            </BlurFade>
          );
        })}
      </div>

      {/* Detailed View */}
      {selectedChildId && childReportLoading && (
        <BlurFade delay={0.1} duration={0.6} blur="8px" offset={30} direction="up">
          <div className="rounded-xl p-6 text-center" style={cardStyle}>
            <p style={{ color: textColors.secondary }}>{t("parentLoading")}</p>
          </div>
        </BlurFade>
      )}

      {selectedChildId && childReportError && (
        <BlurFade delay={0.1} duration={0.6} blur="8px" offset={30} direction="up">
          <div className="rounded-xl p-6 text-center" style={cardStyle}>
            <AlertCircle className="w-12 h-12 mx-auto mb-3" style={{ color: "#EF4444" }} />
            <p className="font-medium mb-2" style={{ color: textColors.primary }}>
              {t("error")}
            </p>
            <p style={{ color: textColors.secondary }}>
              {childReportError instanceof Error ? childReportError.message : t("parentLoading")}
            </p>
          </div>
        </BlurFade>
      )}

      {selectedChildId && childReport && (
        <BlurFade delay={0.1} duration={0.6} blur="8px" offset={30} direction="up">
          <div ref={reportRef} className="rounded-xl overflow-hidden" style={cardStyle}>
          <div className="p-6 print:shadow-none">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                  style={{
                    background:
                      children.find((c) => c.id === selectedChildId)?.avatarColor ||
                      "linear-gradient(135deg, #7C3AED 0%, #2563EB 100%)",
                  }}
                >
                  {getInitials(childReport.student.full_name)}
                </div>
                <div>
                  <h2 className="font-semibold text-lg" style={{ color: textColors.primary }}>
                    {childReport.student.full_name}
                  </h2>
                  <p className="text-sm" style={{ color: textColors.secondary }}>
                    {childReport.student.email}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Link
                  href={`/app/profile/${childReport.student.id}`}
                  className="inline-flex items-center gap-1.5 py-2 px-3 rounded-lg text-white text-sm font-medium hover:opacity-90 transition-opacity"
                  style={{ background: "linear-gradient(135deg, #7C3AED 0%, #2563EB 100%)" }}
                >
                  <User className="w-4 h-4" /> {t("parentViewProfile")}
                </Link>
                <div className="flex gap-2 print:hidden">
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="inline-flex items-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-all"
                    style={{
                      background: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.05)",
                      color: textColors.primary,
                      border: `1px solid ${isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)"}`,
                    }}
                  >
                    <Download className="w-4 h-4" /> {t("parentDownloadReport")}
                  </button>
                  <button
                    type="button"
                    onClick={handlePrint}
                    className="inline-flex items-center gap-1.5 py-2 px-3 rounded-lg text-white text-sm font-medium hover:opacity-90"
                    style={{ background: "linear-gradient(135deg, #7C3AED 0%, #2563EB 100%)" }}
                  >
                    <Printer className="w-4 h-4" /> {t("parentPrint")}
                  </button>
                </div>
              </div>
            </div>

            {childReport.courses.length === 0 ? (
              <p className="py-6 text-center" style={{ color: textColors.secondary }}>
                {t("parentNoProgressYet")}
              </p>
            ) : (
              <div className="space-y-6">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <BlurFade delay={0.2} duration={0.5} blur="4px" offset={15} direction="up">
                    <div className="rounded-xl p-6" style={{ background: isDark ? "rgba(30, 41, 59, 0.4)" : "rgba(0, 0, 0, 0.02)" }}>
                    <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: textColors.primary }}>
                      <Target className="w-5 h-5" /> {t("profileProgressGeneral")}
                    </h3>
                    <div className="flex flex-col items-center">
                      <div className="relative w-32 h-32">
                        <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                          <circle
                            cx="18"
                            cy="18"
                            r="15.9"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            style={{ color: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}
                          />
                          <circle
                            cx="18"
                            cy="18"
                            r="15.9"
                            fill="none"
                            stroke="url(#progressGradient)"
                            strokeWidth="2"
                            strokeDasharray={`${overallProgress} 100`}
                            strokeLinecap="round"
                            className="transition-all duration-500"
                          />
                          <defs>
                            <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                              <stop offset="0%" stopColor="#7C3AED" />
                              <stop offset="100%" stopColor="#2563EB" />
                            </linearGradient>
                          </defs>
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-xl font-bold" style={{ color: textColors.primary }}>
                          {overallProgress}%
                        </span>
                      </div>
                      <p className="text-sm mt-2" style={{ color: textColors.secondary }}>
                        {t("profileCourseProgress")}
                      </p>
                    </div>
                    </div>
                  </BlurFade>

                  <BlurFade delay={0.3} duration={0.5} blur="4px" offset={15} direction="up">
                    <div className="rounded-xl p-6" style={{ background: isDark ? "rgba(30, 41, 59, 0.4)" : "rgba(0, 0, 0, 0.02)" }}>
                    <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: textColors.primary }}>
                      <Award className="w-5 h-5" /> {t("parentOverallStats")}
                    </h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span style={{ color: textColors.secondary }}>{t("parentAvgScore")}:</span>
                        <span className="font-semibold" style={{ color: textColors.primary }}>
                          {childReport.overall_stats.avg_score ?? "—"}
                        </span>
                      </div>
                      {childReport.overall_stats.assignment_avg_score != null && (
                        <div className="flex items-center justify-between">
                          <span style={{ color: textColors.secondary }}>{t("parentAssignmentAvgScore")}:</span>
                          <span className="font-semibold" style={{ color: textColors.primary }}>
                            {childReport.overall_stats.assignment_avg_score}
                            {childReport.overall_stats.assignments_count != null && (
                              <span className="text-xs ml-1" style={{ color: textColors.secondary }}>
                                ({childReport.overall_stats.assignments_count})
                              </span>
                            )}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span style={{ color: textColors.secondary }}>{t("parentTopicsCompleted")}:</span>
                        <span className="font-semibold" style={{ color: textColors.primary }}>
                          {childReport.overall_stats.total_topics_completed}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span style={{ color: textColors.secondary }}>{t("parentCertificates")}:</span>
                        <span className="font-semibold flex items-center gap-1" style={{ color: textColors.primary }}>
                          {childReport.overall_stats.certificates_count}
                          {childReport.overall_stats.certificates_count > 0 && (
                            <Trophy className="w-4 h-4" style={{ color: "#F59E0B" }} />
                          )}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span style={{ color: textColors.secondary }}>{t("parentCoursesEnrolled")}:</span>
                        <span className="font-semibold" style={{ color: textColors.primary }}>
                          {childReport.overall_stats.courses_enrolled}
                        </span>
                      </div>
                      {childReport.overall_stats.total_study_hours != null && childReport.overall_stats.total_study_hours > 0 && (
                        <div className="flex items-center justify-between">
                          <span style={{ color: textColors.secondary }}>{t("parentStudyTime")}:</span>
                          <span className="font-semibold flex items-center gap-1" style={{ color: textColors.primary }}>
                            <Clock className="w-3 h-3" />
                            {childReport.overall_stats.total_study_hours} {t("hours")}
                          </span>
                        </div>
                      )}
                      {childReport.overall_stats.rank != null && (
                        <div className="flex items-center justify-between">
                          <span style={{ color: textColors.secondary }}>{t("parentRank")}:</span>
                          <span className="font-semibold flex items-center gap-1" style={{ color: textColors.primary }}>
                            <Trophy className="w-3 h-3" style={{ color: "#F59E0B" }} />
                            #{childReport.overall_stats.rank}
                          </span>
                        </div>
                      )}

                    </div>
                    </div>
                  </BlurFade>
                </div>

                {/* Дополнительные метрики */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  {childReport.overall_stats.total_study_hours != null && childReport.overall_stats.total_study_hours > 0 && (
                    <BlurFade delay={0.4} duration={0.5} blur="4px" offset={15} direction="up">
                      <div className="rounded-xl p-4" style={{ background: isDark ? "rgba(30, 41, 59, 0.4)" : "rgba(0, 0, 0, 0.02)" }}>
                        <div className="flex items-center gap-2 mb-2">
                          <Clock className="w-4 h-4" style={{ color: "#3B82F6" }} />
                          <span className="text-xs font-medium" style={{ color: textColors.secondary }}>
                            {t("parentStudyTime")}
                          </span>
                        </div>
                        <p className="text-lg font-bold" style={{ color: textColors.primary }}>
                          {childReport.overall_stats.total_study_hours} {t("hours")}
                        </p>
                      </div>
                    </BlurFade>
                  )}
                  {childReport.overall_stats.rank != null && (
                    <BlurFade delay={0.45} duration={0.5} blur="4px" offset={15} direction="up">
                      <div className="rounded-xl p-4" style={{ background: isDark ? "rgba(30, 41, 59, 0.4)" : "rgba(0, 0, 0, 0.02)" }}>
                        <div className="flex items-center gap-2 mb-2">
                          <BarChart3 className="w-4 h-4" style={{ color: "#10B981" }} />
                          <span className="text-xs font-medium" style={{ color: textColors.secondary }}>
                            {t("parentRank")}
                          </span>
                        </div>
                        <p className="text-lg font-bold flex items-center gap-1" style={{ color: textColors.primary }}>
                          <Trophy className="w-4 h-4" style={{ color: "#F59E0B" }} />
                          #{childReport.overall_stats.rank}
                        </p>
                      </div>
                    </BlurFade>
                  )}
                  {childReport.overall_stats.assignment_avg_score != null && (
                    <BlurFade delay={0.5} duration={0.5} blur="4px" offset={15} direction="up">
                      <div className="rounded-xl p-4" style={{ background: isDark ? "rgba(30, 41, 59, 0.4)" : "rgba(0, 0, 0, 0.02)" }}>
                        <div className="flex items-center gap-2 mb-2">
                          <Star className="w-4 h-4" style={{ color: "#F59E0B" }} />
                          <span className="text-xs font-medium" style={{ color: textColors.secondary }}>
                            {t("parentAssignmentAvgScore")}
                          </span>
                        </div>
                        <p className="text-lg font-bold" style={{ color: textColors.primary }}>
                          {childReport.overall_stats.assignment_avg_score}
                          {childReport.overall_stats.assignments_count != null && (
                            <span className="text-xs ml-1 font-normal" style={{ color: textColors.secondary }}>
                              ({childReport.overall_stats.assignments_count} {t("assignments")})
                            </span>
                          )}
                        </p>
                      </div>
                    </BlurFade>
                  )}
                </div>

                {/* Courses */}
                <div>
                  <BlurFade delay={0.15} duration={0.4} blur="4px" offset={10}>
                    <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: textColors.primary }}>
                      <BookOpen className="w-5 h-5" /> {t("profileCourseProgress")}
                    </h3>
                  </BlurFade>
                  <div className="space-y-3">
                    {childReport.courses.map((c, courseIndex) => (
                      <BlurFade key={c.course_id} delay={0.25 + courseIndex * 0.08} duration={0.4} blur="4px" offset={12} direction="up">
                        <div
                          className="p-4 rounded-lg"
                          style={{ background: isDark ? "rgba(30, 41, 59, 0.4)" : "rgba(0, 0, 0, 0.02)" }}
                        >
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-medium truncate" style={{ color: textColors.primary }}>
                            {getLocalizedCourseTitle({ title: c.course_title } as any, t)}
                          </p>
                          <span className="text-sm font-semibold shrink-0 ml-2" style={{ color: textColors.secondary }}>
                            {c.progress_percent}%
                          </span>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden mb-2" style={{ background: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)" }}>
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${c.progress_percent}%`,
                              background: "linear-gradient(135deg, #7C3AED 0%, #2563EB 100%)",
                            }}
                          />
                        </div>
                        <div className="flex items-center gap-4 text-xs" style={{ color: textColors.secondary }}>
                          <span>
                            {c.topics_completed}/{c.total_topics} {t("profileTopic")}
                          </span>
                          {c.avg_test_score != null && (
                            <span className="flex items-center gap-1">
                              <Target className="w-3 h-3" /> {c.avg_test_score}%
                            </span>
                          )}
                          {c.certificate && (
                            <span className="flex items-center gap-1 text-green-600">
                              <GraduationCap className="w-3 h-3" /> {t("parentCertificate")}
                            </span>
                            )}
                          </div>
                        </div>
                      </BlurFade>
                    ))}
                  </div>
                </div>

                {/* Assignments */}
                {childAssignmentsLoading ? (
                  <BlurFade delay={0.2} duration={0.4}>
                    <p className="text-sm py-6 text-center" style={{ color: textColors.secondary }}>
                      {t("parentLoading")}
                    </p>
                  </BlurFade>
                ) : childAssignmentsError ? (
                  <BlurFade delay={0.2} duration={0.4}>
                    <p className="text-sm py-6 text-center" style={{ color: textColors.secondary }}>
                      {t("error")}
                    </p>
                  </BlurFade>
                ) : childAssignmentsData && (
                  <div>
                    <BlurFade delay={0.2} duration={0.4} blur="4px" offset={10}>
                      <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: textColors.primary }}>
                        <FolderCode className="w-5 h-5" /> {t("parentAssignmentsTitle")}
                      </h3>
                    </BlurFade>
                    {childAssignmentsData.assignments.length === 0 ? (
                      <BlurFade delay={0.3} duration={0.4}>
                        <p className="text-sm py-6 text-center" style={{ color: textColors.secondary }}>
                          {t("parentNoAssignments")}
                        </p>
                      </BlurFade>
                    ) : (
                      <div className="space-y-3">
                        {childAssignmentsData.assignments
                          .filter((a) => !a.submitted)
                          .map((a, assignIndex) => {
                            const deadlineDate = a.deadline ? new Date(a.deadline) : null;
                            const isOverdue = deadlineDate && deadlineDate < new Date();
                            return (
                              <BlurFade key={a.id} delay={0.3 + assignIndex * 0.06} duration={0.4} blur="4px" offset={12} direction="up">
                                <div
                                  className="p-4 rounded-lg"
                                  style={{
                                    background: isOverdue
                                      ? isDark
                                        ? "rgba(239, 68, 68, 0.15)"
                                        : "rgba(239, 68, 68, 0.1)"
                                      : isDark
                                      ? "rgba(245, 158, 11, 0.15)"
                                      : "rgba(245, 158, 11, 0.1)",
                                    border: `1px solid ${isOverdue ? "rgba(239, 68, 68, 0.3)" : "rgba(245, 158, 11, 0.3)"}`,
                                  }}
                                >
                                <div className="flex items-start gap-2">
                                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: isOverdue ? "#EF4444" : "#F59E0B" }} />
                                  <div className="flex-1">
                                    <p className="font-medium" style={{ color: textColors.primary }}>
                                      {a.title}
                                    </p>
                                    <p className="text-xs mt-1" style={{ color: textColors.secondary }}>
                                      {getLocalizedCourseTitle({ title: a.course_title } as any, t)}
                                      {deadlineDate &&
                                        ` • ${t("assignmentDeadline")}: ${formatLocalizedDate(a.deadline, lang, t, { shortMonth: true })}`}
                                    </p>
                                    {isOverdue && (
                                      <span className="inline-block mt-2 text-xs font-medium" style={{ color: "#EF4444" }}>
                                        {t("parentOverdue")}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </BlurFade>
                            );
                          })}
                        {childAssignmentsData.assignments
                          .filter((a) => a.submitted)
                          .map((a, submittedIndex) => (
                            <BlurFade key={a.id} delay={0.4 + submittedIndex * 0.06} duration={0.4} blur="4px" offset={12} direction="up">
                              <div
                                className="p-4 rounded-lg"
                                style={{ background: isDark ? "rgba(30, 41, 59, 0.4)" : "rgba(0, 0, 0, 0.02)" }}
                              >
                              <div className="flex items-start gap-2">
                                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#10B981" }} />
                                <div className="flex-1">
                                  <p className="font-medium" style={{ color: textColors.primary }}>
                                    {a.title}
                                  </p>
                                  <p className="text-xs mt-1" style={{ color: textColors.secondary }}>
                                    {getLocalizedCourseTitle({ title: a.course_title } as any, t)}
                                    {a.grade != null && ` • ${t("assignmentGrade")}: ${a.grade}`}
                                  </p>
                                  {a.teacher_comment && (
                                    <p className="text-sm mt-2 italic" style={{ color: textColors.secondary }}>
                                      "{a.teacher_comment}"
                                    </p>
                                  )}
                                  <span className="inline-block mt-2 text-xs font-medium" style={{ color: "#10B981" }}>
                                    {t("assignmentsSubmitted")}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </BlurFade>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          </div>
        </BlurFade>
      )}
    </div>
  );
}
