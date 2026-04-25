"use client";

import Link from "next/link";
import { Clock, BookOpen, UserPlus, CheckCircle2, ChevronRight } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useTheme } from "@/context/ThemeContext";
import { getGlassCardStyle, getTextColors } from "@/utils/themeStyles";
import { useAuthStore } from "@/store/authStore";
import { motion, AnimatePresence } from "framer-motion";

const formatTimeAgo = (dateStr: string, t: any) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return t("timeJustNow");
  if (diffMins < 60) return t("timeMinAgo").replace("{n}", diffMins.toString());
  if (diffHours < 24) return t("timeHourAgo").replace("{n}", diffHours.toString());
  return t("timeDayAgo").replace("{n}", diffDays.toString());
};

export function ActivityFeedWidget() {
  const { t, lang } = useLanguage();
  const { theme } = useTheme();
  const glassStyle = getGlassCardStyle(theme);
  const textColors = getTextColors(theme);
  const { isTeacher } = useAuthStore();
  const teacherMode = isTeacher();

  const { data: activities = [], isLoading } = useQuery({
    queryKey: [teacherMode ? "teacher-recent-submissions" : "student-activity-feed", lang],
    queryFn: async () => {
      const withTimeout = async <T,>(promise: Promise<T>, ms: number): Promise<T> => {
        return await Promise.race([
          promise,
          new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
        ]);
      };
      try {
        if (teacherMode) {
          const { data } = await withTimeout(api.get<Array<{
            id: number;
            student_id: number;
            student_name: string;
            assignment_id: number;
            assignment_title: string;
            group_name: string;
            submitted_at: string;
            grade: number | null;
          }>>("/teacher/recent-submissions"), 7000);
          return data.map(s => ({
            id: s.id,
            type: "submission",
            message: s.student_name,
            subtext: `${t("activitySubtext_submitted")} ${s.assignment_title}`,
            group: s.group_name,
            time: s.submitted_at,
            link: `/app/teacher/view-answers/${s.assignment_id}?tab=submissions&studentId=${s.student_id}`,
          }));
        } else {
          const { data } = await withTimeout(api.get<Array<any>>("/dashboard/events"), 7000);
          return data.slice(0, 10).map((e: any) => {
            let type = "other";
            const notes = (e.notes || "").toLowerCase();
            if (notes.includes("сда") || notes.includes("work") || notes.includes("submission")) type = "submission";
            else if (notes.includes("зада") || notes.includes("assign")) type = "assignment";
            else if (notes.includes("студ") || notes.includes("stud")) type = "student";
            
            return {
              id: e.id,
              type: type,
              message: e.notes || e.topic_title || t("leaderboardActivity"),
              subtext: e.course_title || "",
              time: e.scheduled_date,
              link: "/app",
              group: null
            };
          });
        }
      } catch {
        return [];
      }
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "submission": return <CheckCircle2 className="w-4 h-4" />;
      case "assignment": return <BookOpen className="w-4 h-4" />;
      case "student": return <UserPlus className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case "submission": return "#10b981";
      case "assignment": return "#8B5CF6";
      case "student": return "#3B82F6";
      default: return "#64748B";
    }
  };

  const isDark = theme === "dark";
  const teacherReviewHref = "/app/teacher/courses/review";

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-unified-lg overflow-hidden backdrop-blur-xl border border-white/10 shadow-2xl"
      style={{
        ...glassStyle,
        background: isDark 
          ? "linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.8) 100%)" 
          : "linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(243, 244, 246, 0.8) 100%)",
      }}
    >
      {teacherMode ? (
        <Link
          href={teacherReviewHref}
          className="p-5 text-white flex items-center justify-between relative overflow-hidden group"
          style={{ background: "linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)" }}
        >
          <div className="absolute inset-0 bg-black/10 mix-blend-overlay" />
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-30 blur-2xl bg-white" />
          <div className="flex items-center gap-2 relative z-10 min-w-0">
            <Clock className="w-5 h-5 shrink-0" />
            <h3 className="font-bold text-base tracking-tight">{t("recentActivity")}</h3>
          </div>
          <div className="relative z-10 flex items-center gap-2 shrink-0">
            {isLoading && (
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
            )}
            <ChevronRight className="w-5 h-5 opacity-80 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </Link>
      ) : (
        <div
          className="p-5 text-white flex items-center justify-between relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)" }}
        >
          <div className="absolute inset-0 bg-black/10 mix-blend-overlay" />
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-30 blur-2xl bg-white" />
          <div className="flex items-center gap-2 relative z-10">
            <Clock className="w-5 h-5" />
            <h3 className="font-bold text-base tracking-tight">{t("recentActivity")}</h3>
          </div>
          {isLoading && <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full relative z-10" />}
        </div>
      )}

      <div className="p-4">
        <AnimatePresence mode="popLayout">
          {activities.length === 0 && !isLoading ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-10 text-center"
            >
              <div className="w-16 h-16 rounded-full bg-gray-500/10 flex items-center justify-center mb-3">
                <Clock className="w-8 h-8 opacity-20" />
              </div>
              <p className="text-sm font-medium" style={{ color: textColors.secondary }}>
                {t("noActivity")}
              </p>
            </motion.div>
          ) : (
            <div className="space-y-3">
              {activities.map((activity, idx) => {
                const color = getActivityColor(activity.type);
                const timeAgo = formatTimeAgo(activity.time, t);

                const href = typeof activity.link === "string" && activity.link.trim() ? activity.link : null;
                return (
                  <div key={activity.id + "-" + idx}>
                  {href ? (
                  <Link href={href}>
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      whileHover={{ scale: 1.02, x: 5 }}
                      className="flex items-start gap-3 p-3.5 rounded-2xl transition-all cursor-pointer group mb-3"
                      style={{
                        background: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.02)",
                        border: `1px solid ${isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)"}`,
                      }}
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white shadow-lg shadow-blue-500/10"
                        style={{ background: `linear-gradient(135deg, ${color}, ${color}dd)` }}
                      >
                        {getActivityIcon(activity.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="text-sm font-bold truncate leading-tight mb-0.5" style={{ color: textColors.primary }}>
                            {activity.message}
                          </p>
                          <span className="text-[10px] font-medium opacity-60 ml-auto text-right" style={{ color: textColors.secondary }}>
                            {timeAgo}
                          </span>
                        </div>
                        <p className="text-xs opacity-70 truncate line-clamp-1 mb-0.5" style={{ color: textColors.secondary }}>
                          {activity.subtext}
                        </p>
                        {activity.group && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/5 border border-white/10" style={{ color: textColors.secondary }}>
                            {activity.group}
                          </span>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-40 transition-opacity self-center" />
                    </motion.div>
                  </Link>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="flex items-start gap-3 p-3.5 rounded-2xl transition-all mb-3"
                      style={{
                        background: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.02)",
                        border: `1px solid ${isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)"}`,
                      }}
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white shadow-lg shadow-blue-500/10"
                        style={{ background: `linear-gradient(135deg, ${color}, ${color}dd)` }}
                      >
                        {getActivityIcon(activity.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="text-sm font-bold truncate leading-tight mb-0.5" style={{ color: textColors.primary }}>
                            {activity.message}
                          </p>
                          <span className="text-[10px] font-medium opacity-60 ml-auto text-right" style={{ color: textColors.secondary }}>
                            {timeAgo}
                          </span>
                        </div>
                        <p className="text-xs opacity-70 truncate line-clamp-1 mb-0.5" style={{ color: textColors.secondary }}>
                          {activity.subtext}
                        </p>
                        {activity.group && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/5 border border-white/10" style={{ color: textColors.secondary }}>
                            {activity.group}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  )}
                  </div>
                );
              })}
            </div>
          )}
        </AnimatePresence>

        <Link
          href={teacherMode ? teacherReviewHref : "/app"}
          className="mt-4 flex items-center justify-center w-full py-3 rounded-2xl font-bold text-sm transition-all bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 group"
        >
          {t("viewAll")}
          <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>
    </motion.div>
  );
}
