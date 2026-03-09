"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { formatDateTimeLocalized } from "@/lib/dateUtils";
import {
  Users,
  BookOpen,
  ClipboardList,
  Award,
  UsersRound,
  FileText,
  Activity,
  AlertCircle,
  TrendingUp,
  UserPlus,
  BookPlus,
  CheckCircle,
  Clock,
  LayoutDashboard,
  Grid3x3,
  ArrowRight,
} from "lucide-react";
import { motion } from "motion/react";
import { AnimatedNumber } from "./AnimatedNumber";
import { AnimatedGradientText } from "@/components/ui/animated-gradient-text";
import { BlurFade } from "@/components/ui/blur-fade";
import { useAuthStore } from "@/store/authStore";
import { Info } from "lucide-react";
import { getGlassCardStyle, getTextColors } from "@/utils/themeStyles";
import Link from "next/link";

type Dept = {
  id: string;
  name: string;
  count: number;
  importance: string;
  description: string;
};

type OverviewData = {
  departments: Dept[];
  total_users: number;
  total_courses: number;
  users_by_role?: Record<string, number>;
  new_users_week?: number;
  new_enrollments_week?: number;
  active_courses?: number;
  pending_users?: number;
  pending_courses?: number;
};

export function AdminOverview() {
  const { t, lang } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isCurator = user?.role === "curator";
  const glassStyle = getGlassCardStyle(theme);
  const textColors = getTextColors(theme);

  const { data } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: async () => {
      const { data: d } = await api.get<OverviewData>("/admin/overview");
      return d;
    },
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["admin-activity-logs"],
    queryFn: async () => {
      const { data: d } = await api.get<
        Array<{
          id: number;
          user_name: string | null;
          action: string;
          entity_type: string | null;
          created_at: string | null;
        }>
      >("/admin/activity-logs?limit=10");
      return d;
    },
  });


  const departments = data?.departments ?? [];
  const usersByRole = data?.users_by_role ?? {};
  const newUsersWeek = data?.new_users_week ?? 0;
  const newEnrollmentsWeek = data?.new_enrollments_week ?? 0;
  const pendingUsers = data?.pending_users ?? 0;
  const pendingCourses = data?.pending_courses ?? 0;

  // Основные KPI карточки
  const kpiCards = [
    {
      id: "users",
      label: t("adminTotalUsers"),
      value: data?.total_users ?? 0,
      icon: Users,
      color: "from-blue-500 to-cyan-500",
      bgColor: "bg-blue-500/10",
      link: "/app/admin/users",
    },
    {
      id: "courses",
      label: t("adminActiveCourses"),
      value: data?.total_courses ?? 0,
      icon: BookOpen,
      color: "from-purple-500 to-pink-500",
      bgColor: "bg-purple-500/10",
      link: "/app/admin/courses",
    },
    {
      id: "enrollments",
      label: t("adminEnrollments"),
      value: departments.find((d) => d.id === "enrollments")?.count ?? 0,
      icon: ClipboardList,
      color: "from-green-500 to-emerald-500",
      bgColor: "bg-green-500/10",
      link: "/app/admin/courses",
    },
    {
      id: "progress",
      label: t("adminCompletedTopics"),
      value: departments.find((d) => d.id === "progress")?.count ?? 0,
      icon: Award,
      color: "from-orange-500 to-red-500",
      bgColor: "bg-orange-500/10",
      link: "/app/admin/analytics",
    },
  ];

  // Статистика по ролям
  const roleLabels: Record<string, string> = {
    student: t("adminRoleStudent"),
    teacher: t("adminRoleTeacher"),
    admin: t("adminRoleAdmin"),
    director: t("adminRoleDirector"),
    curator: t("adminRoleCurator"),
    parent: t("adminRoleParent"),
    courier: t("adminRoleCourier"),
  };

  // Иконки для разделов процессов
  const getDeptIcon = (id: string) => {
    switch (id) {
      case "users": return Users;
      case "courses": return BookOpen;
      case "enrollments": return ClipboardList;
      case "progress": return Award;
      case "certificates": return Award;
      case "groups": return UsersRound;
      case "assignments": return FileText;
      case "activity": return Activity;
      default: return Activity;
    }
  };

  // Цвета для важности
  const getImportanceColor = (importance: string) => {
    switch (importance) {
      case "high": return "from-red-500 to-pink-500";
      case "medium": return "from-blue-500 to-cyan-500";
      case "low": return "from-gray-500 to-gray-600";
      default: return "from-gray-500 to-gray-600";
    }
  };

  // Ссылки для разделов
  const getDeptLink = (id: string) => {
    switch (id) {
      case "users": return "/app/admin/users";
      case "courses": return "/app/admin/courses";
      case "enrollments": return "/app/admin/courses";
      case "progress": return "/app/admin/analytics";
      case "certificates": return "/app/admin/analytics";
      case "groups": return "/app/admin/users";
      case "assignments": return "/app/admin/courses";
      case "activity": return "/app/admin/analytics";
      default: return "/app/admin";
    }
  };

  const formatAction = (action: string) => {
    const labels: Record<string, string> = {
      login: "adminLogLogin",
      logout: "adminLogLogout",
      register: "adminLogRegister",
      application_created: "adminLogApplicationCreated",
      application_approved: "adminLogApplicationApproved",
      payment_approved: "adminLogPaymentApproved",
    };
    const key = labels[action];
    return key ? t(key as any) : action;
  };

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
            <Info className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "#F59E0B" }} />
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

      {/* Заголовок */}
      <BlurFade delay={0} direction="down" duration={0.6} blur="8px">
        <div>
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3" style={{ color: textColors.primary }}>
            <Activity className="w-8 h-8" />
            <AnimatedGradientText speed={2} colorFrom="#FF4181" colorTo="#B938EB">
              {t("adminProcessesTitle")}
            </AnimatedGradientText>
          </h1>
          <p className="text-lg" style={{ color: textColors.secondary }}>
            {t("adminManageProcesses")}
          </p>
        </div>
      </BlurFade>

      {/* Основные KPI карточки */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpiCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <BlurFade key={card.id} delay={0.1 + index * 0.05} direction="up" offset={20}>
              <Link href={card.link}>
                <motion.div
                  className="rounded-xl p-6 cursor-pointer group transition-all duration-300 hover:shadow-xl"
                  style={{
                    ...glassStyle,
                    border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.1)",
                  }}
                  whileHover={{ scale: 1.02, y: -4 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center bg-gradient-to-br ${card.color} shadow-lg`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <TrendingUp className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: textColors.secondary }} />
                  </div>
                  <p className="text-3xl font-bold mb-1" style={{ color: textColors.primary }}>
                    <AnimatedNumber value={card.value} duration={1.5} />
                  </p>
                  <p className="text-sm font-medium" style={{ color: textColors.secondary }}>
                    {card.label}
                  </p>
                </motion.div>
              </Link>
            </BlurFade>
          );
        })}
      </div>

      {/* Разделы процессов */}
      <BlurFade delay={0.2} direction="up" offset={20}>
        <div>
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2" style={{ color: textColors.primary }}>
            <Grid3x3 className="w-6 h-6" />
            {t("adminPlatformSections")}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {departments.map((dept, index) => {
              const Icon = getDeptIcon(dept.id);
              const link = getDeptLink(dept.id);
              const gradientColor = getImportanceColor(dept.importance);
              return (
                <BlurFade key={dept.id} delay={0.25 + index * 0.05} direction="up" offset={20}>
                  <Link href={link}>
                    <motion.div
                      className="rounded-xl p-6 cursor-pointer group transition-all duration-300 hover:shadow-xl"
                      style={{
                        ...glassStyle,
                        border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.1)",
                      }}
                      whileHover={{ scale: 1.02, y: -4 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center bg-gradient-to-br ${gradientColor} shadow-lg`}>
                          <Icon className="w-6 h-6 text-white" />
                        </div>
                        <span className={`px-2 py-1 rounded-md text-xs font-medium ${
                          dept.importance === "high" ? "bg-red-500/20 text-red-600 dark:text-red-400" :
                          dept.importance === "medium" ? "bg-blue-500/20 text-blue-600 dark:text-blue-400" :
                          "bg-gray-500/20 text-gray-600 dark:text-gray-400"
                        }`}>
                          {dept.importance === "high" ? t("adminImportanceHigh") :
                           dept.importance === "medium" ? t("adminImportanceMedium") :
                           t("adminImportanceLow")}
                        </span>
                      </div>
                      <h3 className="text-xl font-bold mb-2" style={{ color: textColors.primary }}>
                        {t(`dept_${dept.id}_name` as any) || dept.name}
                      </h3>
                      <p className="text-sm mb-4" style={{ color: textColors.secondary }}>
                        {t(`dept_${dept.id}_desc` as any) || dept.description}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-2xl font-bold" style={{ color: textColors.primary }}>
                          <AnimatedNumber value={dept.count} duration={1.5} />
                        </span>
                        <ArrowRight className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: textColors.secondary }} />
                      </div>
                    </motion.div>
                  </Link>
                </BlurFade>
              );
            })}
          </div>
        </div>
      </BlurFade>

      {/* Статистика и быстрые действия */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Статистика по ролям */}
        <BlurFade delay={0.5} direction="right" offset={20}>
          <div className="rounded-xl p-6" style={glassStyle}>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2" style={{ color: textColors.primary }}>
              <UsersRound className="w-5 h-5 text-blue-500" />
              {t("adminUsersByRoles")}
            </h2>
            <div className="space-y-3">
              {Object.entries(usersByRole).map(([role, count]) => (
                <div key={role} className="flex items-center justify-between">
                  <span className="text-sm font-medium" style={{ color: textColors.secondary }}>
                    {roleLabels[role] || role}
                  </span>
                  <span className="text-lg font-bold" style={{ color: textColors.primary }}>
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </BlurFade>

        {/* Быстрые действия */}
        <BlurFade delay={0.55} direction="up" offset={20}>
          <div className="rounded-xl p-6" style={glassStyle}>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2" style={{ color: textColors.primary }}>
              <Activity className="w-5 h-5 text-purple-500" />
              {t("adminQuickActions")}
            </h2>
            <div className="space-y-2">
              <Link href="/app/admin/users">
                <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-opacity-50 transition-colors cursor-pointer" style={{ background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)" }}>
                  <UserPlus className="w-5 h-5 text-blue-500" />
                  <span className="text-sm font-medium" style={{ color: textColors.primary }}>{t("adminAddUser")}</span>
                </div>
              </Link>
              <Link href="/app/admin/courses">
                <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-opacity-50 transition-colors cursor-pointer" style={{ background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)" }}>
                  <BookPlus className="w-5 h-5 text-green-500" />
                  <span className="text-sm font-medium" style={{ color: textColors.primary }}>{t("adminCreateCourse")}</span>
                </div>
              </Link>
              <Link href="/app/admin/analytics">
                <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-opacity-50 transition-colors cursor-pointer" style={{ background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)" }}>
                  <Activity className="w-5 h-5 text-purple-500" />
                  <span className="text-sm font-medium" style={{ color: textColors.primary }}>{t("adminAnalytics")}</span>
                </div>
              </Link>
            </div>
          </div>
        </BlurFade>

        {/* Статистика за неделю */}
        <BlurFade delay={0.6} direction="left" offset={20}>
          <div className="rounded-xl p-6" style={glassStyle}>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2" style={{ color: textColors.primary }}>
              <TrendingUp className="w-5 h-5 text-green-500" />
              {t("adminLastWeek")}
            </h2>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm" style={{ color: textColors.secondary }}>{t("adminNewUsers")}</span>
                  <span className="text-2xl font-bold text-green-500">{newUsersWeek}</span>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm" style={{ color: textColors.secondary }}>{t("adminNewEnrollments")}</span>
                  <span className="text-2xl font-bold text-blue-500">{newEnrollmentsWeek}</span>
                </div>
              </div>
              {pendingUsers > 0 && (
                <div className="pt-3 border-t" style={{ borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)" }}>
                  <div className="flex items-center gap-2 text-amber-500">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm font-medium">{t("adminPendingApproval").replace("{count}", pendingUsers.toString())}</span>
                  </div>
                </div>
              )}
              {pendingCourses > 0 && (
                <div className="flex items-center gap-2 text-amber-500">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm font-medium">{t("adminPendingCourses").replace("{count}", pendingCourses.toString())}</span>
                </div>
              )}
            </div>
          </div>
        </BlurFade>
      </div>

      {/* Недавние действия */}
      <BlurFade delay={0.65} direction="up" offset={20}>
        <div className="rounded-xl p-6" style={glassStyle}>
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2" style={{ color: textColors.primary }}>
            <Activity className="w-5 h-5 text-blue-500" />
            {t("adminRecentActions")}
          </h2>
          {logs.length === 0 ? (
            <div className="text-center py-12">
              <Activity className="w-16 h-16 mx-auto mb-4 opacity-20" style={{ color: textColors.secondary }} />
              <p style={{ color: textColors.secondary }}>{t("adminActivityLogEmpty")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.1)" }}>
                    <th className="text-left py-3 px-4 font-semibold" style={{ color: textColors.secondary }}>
                      {t("adminUser")}
                    </th>
                    <th className="text-left py-3 px-4 font-semibold" style={{ color: textColors.secondary }}>
                      {t("adminAction")}
                    </th>
                    <th className="text-left py-3 px-4 font-semibold" style={{ color: textColors.secondary }}>
                      {t("adminTime")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l, index) => (
                    <motion.tr
                      key={l.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="border-b hover:bg-opacity-50 transition-colors"
                      style={{
                        borderColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
                        background: isDark ? "transparent" : "transparent",
                      }}
                    >
                      <td className="py-3 px-4 font-medium" style={{ color: textColors.primary }}>
                        {l.user_name ?? "—"}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium bg-blue-500/20 text-blue-600 dark:text-blue-400">
                          {formatAction(l.action)}
                        </span>
                      </td>
                      <td className="py-3 px-4" style={{ color: textColors.secondary }}>
                        {l.created_at ? formatDateTimeLocalized(l.created_at, lang, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </BlurFade>
    </div>
  );
}
