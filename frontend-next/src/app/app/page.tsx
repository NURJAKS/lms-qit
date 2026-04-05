"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuthStore } from "@/store/authStore";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { api } from "@/api/client";
import type { User } from "@/types";
import { useQuery } from "@tanstack/react-query";
import { Code2, Globe } from "lucide-react";
import { DashboardStatsCards } from "@/components/dashboard/DashboardStatsCards";
import { TeacherDashboard } from "@/components/dashboard/TeacherDashboard";
import { ParentDashboard } from "@/components/dashboard/ParentDashboard";
import { ContinueWatching } from "@/components/dashboard/ContinueWatching";
import { DailyQuestWidget } from "@/components/dashboard/DailyQuestWidget";
import { RecentAchievementsWidget } from "@/components/dashboard/RecentAchievementsWidget";
import { UpcomingDeadlinesWidget } from "@/components/dashboard/UpcomingDeadlinesWidget";
import { LeaderboardMotivationWidget } from "@/components/dashboard/LeaderboardMotivationWidget";
import { AiChallengeCard } from "@/components/dashboard/AiChallengeCard";
import { CommunityWidget } from "@/components/dashboard/CommunityWidget";
import { getGlassCardStyle, getTextColors } from "@/utils/themeStyles";
import type { Course } from "@/types";
import { BlurFade } from "@/components/ui/blur-fade";
import { AdminDashboard } from "@/components/admin/AdminDashboard";

function StudentPendingGroupDashboard({ t }: { t: (k: import("@/i18n/translations").TranslationKey) => string }) {
  const [refreshing, setRefreshing] = useState(false);
  const { theme } = useTheme();
  const glassStyle = getGlassCardStyle(theme);
  const textColors = getTextColors(theme);
  const setAuth = useAuthStore((s) => s.setAuth);
  const token = useAuthStore((s) => s.token);

  const checkStatus = async () => {
    if (!token) return;
    setRefreshing(true);
    try {
      const { data } = await api.get<User>("/users/me");
      setAuth(data, token);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="rounded-2xl p-6 sm:p-8 text-center backdrop-blur-xl" style={glassStyle}>
        <h1 className="text-lg sm:text-xl font-bold mb-4" style={{ color: textColors.primary }}>{t("studentPaidWaitCurator")}</h1>
        <p className="mb-6" style={{ color: textColors.secondary }}>{t("studentPaidWaitCuratorHint")}</p>
        <button
          type="button"
          onClick={checkStatus}
          disabled={refreshing}
          className="px-4 py-2 rounded-lg text-white disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, #FF4181 0%, #B938EB 100%)" }}
        >
          {refreshing ? t("loading") : t("checkStatus")}
        </button>
      </div>
    </div>
  );
}

function PendingDashboard({ t }: { t: (k: import("@/i18n/translations").TranslationKey) => string }) {
  const [refreshing, setRefreshing] = useState(false);
  const { theme } = useTheme();
  const glassStyle = getGlassCardStyle(theme);
  const textColors = getTextColors(theme);
  const setAuth = useAuthStore((s) => s.setAuth);
  const token = useAuthStore((s) => s.token);

  const checkStatus = async () => {
    if (!token) return;
    setRefreshing(true);
    try {
      const { data } = await api.get<User>("/users/me");
      setAuth(data, token);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="rounded-2xl p-6 sm:p-8 text-center backdrop-blur-xl" style={glassStyle}>
        <h1 className="text-lg sm:text-xl font-bold mb-4" style={{ color: textColors.primary }}>{t("applicationPending")}</h1>
        <p className="mb-6" style={{ color: textColors.secondary }}>{t("applicationPendingHint")}</p>
        <p className="text-sm mb-4" style={{ color: textColors.secondary }}>
          {t("checkNotifications")}
        </p>
        <button
          type="button"
          onClick={checkStatus}
          disabled={refreshing}
          className="px-4 py-2 rounded-lg text-white disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, #FF4181 0%, #B938EB 100%)" }}
        >
          {refreshing ? t("loading") : t("checkStatus")}
        </button>
      </div>
    </div>
  );
}

function courseIcon(c: Course): React.ReactNode {
  const title = (c.title || "").toLowerCase();
  if (title.includes("python") || title.includes("программа")) return <Code2 className="w-8 h-8" />;
  if (title.includes("web") || title.includes("әзірлеу") || title.includes("html") || title.includes("javascript"))
    return <Globe className="w-8 h-8" />;
  return <Code2 className="w-8 h-8" />;
}

export default function DashboardPage() {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const glassStyle = getGlassCardStyle(theme);
  const textColors = getTextColors(theme);
  const isDark = theme === "dark";
  const { user, isTeacher } = useAuthStore();
  const userId = user?.id;
  const isAdmin = user?.role && ["admin", "director", "curator"].includes(user.role);
  const { data: enrollments = [] } = useQuery({
    queryKey: ["my-enrollments", userId],
    queryFn: async () => {
      const { data } = await api.get<Array<{ course_id: number; course: Course }>>("/courses/my/enrollments");
      return data;
    },
    enabled: userId != null,
  });
  const { data: progressDetail } = useQuery({
    queryKey: ["my-progress-detail"],
    queryFn: async () => {
      const { data } = await api.get<{ courses: Array<{ course_id: number; progress_percent: number }> }>(
        "/users/me/progress-detail"
      );
      return data;
    },
  });
  const { data: courses = [] } = useQuery({
    queryKey: ["courses-active"],
    queryFn: async () => {
      const { data } = await api.get<Course[]>("/courses?is_active=true");
      return data;
    },
  });
  const progressByCourse = new Map(
    progressDetail?.courses?.map((c) => [c.course_id, c.progress_percent]) ?? []
  );
  const enrolledIds = new Set(enrollments.map((e) => e.course_id));

  const roleLabelMap: Record<string, string> = {
    admin: t("roleAdmin"),
    director: t("director"),
    curator: t("curator"),
    teacher: t("teacher"),
    parent: t("parent"),
    student: t("student"),
  };
  const roleLabel = user?.role && roleLabelMap[user.role] ? ` (${roleLabelMap[user.role]})` : "";
  const isApproved = user?.is_approved !== false;

  let content: React.ReactNode;
  if (!isApproved) {
    content = <PendingDashboard t={t} />;
  } else {
    const isStudentWithoutGroup = user?.role === "student" && !user?.has_group_access;
    if (isAdmin && isApproved) {
      content = <AdminDashboard />;
    } else if (isStudentWithoutGroup) {
      content = <StudentPendingGroupDashboard t={t} />;
    } else if (isTeacher()) {
      content = <TeacherDashboard />;
    } else if (user?.role === "parent") {
      content = <ParentDashboard />;
    } else {
      content = (
    <div className="space-y-4 sm:space-y-5 md:space-y-6">
      {/* Row 1: KPI Cards - полная ширина */}
      <DashboardStatsCards />
      
      {/* Row 2: Welcome Banner - полная ширина */}
      <BlurFade direction="down" delay={0.1} offset={40} inView={true} duration={0.6} blur="8px">
        <div
          className="relative rounded-xl overflow-hidden p-4 sm:p-5 lg:p-8 text-white"
          style={{
            background: "linear-gradient(135deg, #14b8a6 0%, #3b82f6 100%)",
            boxShadow: "0 8px 24px rgba(20, 184, 166, 0.25)",
          }}
        >
          <div className="absolute inset-0 opacity-10">
            <svg className="absolute bottom-0 left-0 w-full h-24" viewBox="0 0 1200 120" preserveAspectRatio="none">
              <path
                fill="currentColor"
                d="M0,60 C300,120 600,0 900,60 C1050,90 1200,30 1200,60 L1200,120 L0,120 Z"
              />
            </svg>
          </div>
          <div className="relative">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-1.5 sm:mb-2 leading-tight break-words">
              {t("dashboardGreeting")}
              {roleLabel && <span className="font-normal opacity-90"> {roleLabel}</span>}
            </h1>
            <p className="text-white/90 text-sm lg:text-base break-words">
              {user?.full_name ? `${t("welcome")}, ${user.full_name}` : t("welcome")}
            </p>
          </div>
        </div>
      </BlurFade>

      {/* Row 3: Continue Watching - полная ширина (moved up) */}
      <BlurFade direction="up" delay={0.2} offset={30} inView={true} duration={0.6} blur="8px">
        <ContinueWatching />
      </BlurFade>

      {/* Row 3.5: Leaderboard motivation - full width */}
      <BlurFade direction="up" delay={0.25} offset={30} inView={true} duration={0.6} blur="8px">
        <LeaderboardMotivationWidget />
      </BlurFade>

      {/* Row 4: AI Challenge, Daily Quest */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
        <BlurFade direction="down" delay={0.35} offset={30} inView={true} duration={0.6} blur="8px">
          <div className="xl:col-span-1 h-full">
            <AiChallengeCard />
          </div>
        </BlurFade>
        <BlurFade direction="right" delay={0.4} offset={30} inView={true} duration={0.6} blur="8px">
          <div className="xl:col-span-1 h-full">
            <DailyQuestWidget />
          </div>
        </BlurFade>
      </div>

      {/* Row 5: Upcoming Deadlines, Community */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
        <BlurFade direction="down" delay={0.5} offset={30} inView={true} duration={0.6} blur="8px">
          <div className="xl:col-span-1 h-full">
            <UpcomingDeadlinesWidget />
          </div>
        </BlurFade>
        <BlurFade direction="right" delay={0.55} offset={30} inView={true} duration={0.6} blur="8px">
          <div className="xl:col-span-1 h-full">
            <CommunityWidget />
          </div>
        </BlurFade>
      </div>

      {/* Footer: Catalog hint */}
      <BlurFade direction="up" delay={0.6} offset={30} inView={true} duration={0.6} blur="8px">
        <section>
          <div className="rounded-xl p-5 text-center" style={glassStyle}>
            <p className="mb-3 text-sm" style={{ color: textColors.secondary }}>{t("catalogHint")}</p>
            <Link
              href="/courses"
              className="inline-flex items-center gap-1 font-medium hover:underline text-sm"
              style={{ color: "#14b8a6" }}
            >
              {t("allCoursesLink")}
            </Link>
          </div>
        </section>
      </BlurFade>
    </div>
      );
    }
  }

  return <>{content}</>;
}
