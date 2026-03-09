"use client";

import { useLanguage } from "@/context/LanguageContext";
import { useAuthStore } from "@/store/authStore";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { Clock, BookOpen, AlertCircle } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { getGlassCardStyle, getTextColors } from "@/utils/themeStyles";
import { getLocalizedCourseTitle } from "@/lib/courseUtils";
import Link from "next/link";

export function WelcomeWidget() {
  const { t } = useLanguage();
  const { user } = useAuthStore();
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

  const { data: upcomingEvents = [] } = useQuery({
    queryKey: ["teacher-upcoming-events"],
    queryFn: async () => {
      try {
        const { data } = await api.get<Array<{
          scheduled_date: string;
          notes: string | null;
          course_title: string | null;
        }>>("/dashboard/events");
        const today = new Date();
        const nextWeek = new Date(today);
        nextWeek.setDate(today.getDate() + 7);
        return data.filter(e => {
          const eventDate = new Date(e.scheduled_date);
          return eventDate >= today && eventDate <= nextWeek;
        }).slice(0, 1);
      } catch {
        return [];
      }
    },
  });

  const pendingCount = stats?.pending_submissions_count ?? 0;
  const nextEvent = upcomingEvents[0];
  const userName = user?.full_name?.split(" ")[0] || t("teacher");

  return (
    <div
      className="relative rounded-unified-lg p-6 overflow-hidden group"
      style={{
        ...glassStyle,
        background: isDark 
          ? "linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(139, 92, 246, 0.1) 100%)"
          : "linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(139, 92, 246, 0.05) 100%)",
      }}
    >
      {/* Decorative gradient glow */}
      <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-20 blur-3xl" style={{ background: "linear-gradient(135deg, #3B82F6, #8B5CF6)" }} />

      {/* Decorative pattern */}
      <div className="absolute inset-0 opacity-[0.03]">
        <svg className="absolute bottom-0 left-0 w-full h-24" viewBox="0 0 1200 120" preserveAspectRatio="none">
          <path
            fill="currentColor"
            d="M0,60 C300,120 600,0 900,60 C1050,90 1200,30 1200,60 L1200,120 L0,120 Z"
          />
        </svg>
      </div>

      <div className="relative">
        <h2 className="text-2xl font-geologica font-bold mb-1" style={{ color: textColors.primary }}>
          {t("welcome")}, {userName}! 👋
        </h2>
        <p className="text-sm mb-5" style={{ color: textColors.secondary }}>
          {t("teacherDashboardHint")}
        </p>
        
        <div className="space-y-3 mt-5">
          {pendingCount > 0 && (
            <Link
              href="/app/teacher?tab=assignments"
              className="group flex items-center gap-4 p-4 rounded-xl hover:scale-[1.02] transition-all duration-300 relative overflow-hidden"
              style={{
                background: isDark 
                  ? "rgba(245, 158, 11, 0.2)" 
                  : "rgba(245, 158, 11, 0.12)",
                border: `1px solid ${isDark ? "rgba(245, 158, 11, 0.3)" : "rgba(245, 158, 11, 0.2)"}`,
                boxShadow: isDark 
                  ? "0 4px 12px rgba(245, 158, 11, 0.2)" 
                  : "0 4px 12px rgba(245, 158, 11, 0.1)",
              }}
            >
              <div className="relative">
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg"
                  style={{ background: "linear-gradient(135deg, #F59E0B, #EF4444)" }}
                >
                  <BookOpen className="w-6 h-6" />
                </div>
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse-dot border-2 border-white shadow-lg" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-semibold mb-1" style={{ color: textColors.primary }}>
                  {pendingCount} {t("teacherStatsPending")}
                </p>
                <p className="text-xs flex items-center gap-1" style={{ color: textColors.secondary }}>
                  <AlertCircle className="w-3 h-3" />
                  {t("teacherDashboardHint")}
                </p>
              </div>
            </Link>
          )}

          {nextEvent && (
            <div 
              className="flex items-center gap-4 p-4 rounded-xl"
              style={{
                background: isDark 
                  ? "rgba(59, 130, 246, 0.2)" 
                  : "rgba(59, 130, 246, 0.1)",
                border: `1px solid ${isDark ? "rgba(59, 130, 246, 0.3)" : "rgba(59, 130, 246, 0.2)"}`,
              }}
            >
              <div 
                className="w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg"
                style={{ background: "linear-gradient(135deg, #3B82F6, #8B5CF6)" }}
              >
                <Clock className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold mb-1" style={{ color: textColors.primary }}>
                  {(nextEvent.course_title ? getLocalizedCourseTitle({ title: nextEvent.course_title } as any, t) : null) || nextEvent.notes || t("upcomingEvent")}
                </p>
                <p className="text-xs" style={{ color: textColors.secondary }}>
                  {new Date(nextEvent.scheduled_date).toLocaleDateString()}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
