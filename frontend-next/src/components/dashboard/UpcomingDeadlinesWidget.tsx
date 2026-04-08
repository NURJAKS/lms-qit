"use client";

import { Calendar, Clock, FileText, BookOpen, ChevronRight } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { useLanguage } from "@/context/LanguageContext";
import { getGlassCardStyle, getTextColors } from "@/utils/themeStyles";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import Link from "next/link";
import { useAuthStore } from "@/store/authStore";
import { motion, AnimatePresence } from "motion/react";
import { formatDateTimeLocalized } from "@/lib/dateUtils";

type Deadline = {
  id: number;
  title: string;
  type: "assignment" | "test" | "course";
  dueDate: string;
  courseId?: number;
  courseTitle?: string;
  priority: "high" | "medium" | "low";
  submitted?: boolean;
  link?: string;
};

const getIcon = (type: string) => {
  switch (type) {
    case "assignment": return FileText;
    case "test": return BookOpen;
    case "course": return Calendar;
    default: return Calendar;
  }
};

const getPriorityColor = (priority: string, isDark: boolean) => {
  switch (priority) {
    case "high": return isDark ? "#EF4444" : "#DC2626";
    case "medium": return isDark ? "#F59E0B" : "#D97706";
    case "low": return isDark ? "#10B981" : "#059669";
    default: return isDark ? "#64748B" : "#6B7280";
  }
};

function formatDueDate(dateStr: string, t: any, lang: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return t("overdue");
  if (diffDays === 0) return t("today");
  if (diffDays === 1) return t("tomorrow");
  if (diffDays < 7) return t("daysLeft").replace("{count}", String(diffDays));
  
  return formatDateTimeLocalized(dateStr, lang, { hour: "2-digit", minute: "2-digit" });
}

export function UpcomingDeadlinesWidget({ layout = "list" }: { layout?: "list" | "grid" }) {
  const { theme } = useTheme();
  const { t, lang } = useLanguage();
  const glassStyle = getGlassCardStyle(theme);
  const textColors = getTextColors(theme);
  const isDark = theme === "dark";
  const { isTeacher } = useAuthStore();
  const teacherMode = isTeacher();

  const { data: deadlines = [], isLoading } = useQuery({
    queryKey: [teacherMode ? "teacher-upcoming-assignments" : "upcoming-deadlines"],
    queryFn: async () => {
      try {
        if (teacherMode) {
          const { data } = await api.get<any[]>("/teacher/assignments");
          const now = new Date();
          return data
            .filter(a => a.deadline && new Date(a.deadline) >= now)
            .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
            .map(a => {
              const diffMs = new Date(a.deadline).getTime() - now.getTime();
              const diffDays = diffMs / (1000 * 60 * 60 * 24);
              let priority: "high" | "medium" | "low" = "low";
              if (diffDays <= 2) priority = "high";
              else if (diffDays <= 5) priority = "medium";
              
              return {
                id: a.id,
                title: a.title,
                type: "assignment",
                dueDate: a.deadline,
                courseTitle: a.course_title,
                priority,
                link:
                  typeof a.group_id === "number"
                    ? `/app/teacher/courses/${a.group_id}/assignment/${a.id}`
                    : `/app/teacher/view-answers/${a.id}`,
              } as Deadline;
            });
        } else {
          const { data } = await api.get<Array<Deadline & { courseId?: number }>>("/dashboard/deadlines?limit=10");
          return (data || []).map((d) => ({
            ...d,
            link:
              d.courseId != null
                ? `/app/courses/${d.courseId}?tab=classwork&assignmentId=${d.id}`
                : "/app/courses",
          }));
        }
      } catch (error) {
        return [];
      }
    },
  });

  if (isLoading) {
    return (
      <div className="animate-pulse rounded-3xl h-64 w-full bg-gray-200 dark:bg-gray-800/20" />
    );
  }

  const isGrid = layout === "grid";
  const teacherReviewHref = "/app/teacher/courses/review";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        ...glassStyle,
        padding: isGrid ? "0.75rem" : "1.5rem",
        borderRadius: "1.5rem",
        height: isGrid ? "auto" : "100%",
        display: "flex",
        flexDirection: "column",
      }}
      className="relative overflow-hidden group border border-white/10"
    >
      <div className={`flex items-center justify-between ${isGrid ? "mb-4" : "mb-6"}`}>
        {teacherMode ? (
          <Link href={teacherReviewHref} className="flex items-center gap-3 min-w-0 rounded-xl -m-1 p-1 hover:opacity-90 transition-opacity">
            <div className={`${isGrid ? "w-8 h-8" : "w-10 h-10"} rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0`}>
              <Clock className={`${isGrid ? "w-4 h-4" : "w-5 h-5"} text-orange-500`} />
            </div>
            <div className="min-w-0">
              <h3 className={`${isGrid ? "text-base" : "text-lg"} font-bold`} style={{ color: textColors.primary }}>
                {t("upcomingDeadlines")}
              </h3>
              {!isGrid && (
                <p className="text-xs opacity-60" style={{ color: textColors.secondary }}>
                  {deadlines.length} {t("assignments").toLowerCase()}
                </p>
              )}
            </div>
          </Link>
        ) : (
          <div className={`flex items-center gap-3`}>
            <div className={`${isGrid ? "w-8 h-8" : "w-10 h-10"} rounded-xl bg-orange-500/10 flex items-center justify-center`}>
              <Clock className={`${isGrid ? "w-4 h-4" : "w-5 h-5"} text-orange-500`} />
            </div>
            <div>
              <h3 className={`${isGrid ? "text-base" : "text-lg"} font-bold`} style={{ color: textColors.primary }}>
                {t("upcomingDeadlines")}
              </h3>
              {!isGrid && (
                <p className="text-xs opacity-60" style={{ color: textColors.secondary }}>
                  {deadlines.length} {t("assignments").toLowerCase()}
                </p>
              )}
            </div>
          </div>
        )}
        <Link
          href={teacherMode ? teacherReviewHref : "/app/courses?tab=assignments"}
          className="p-2 rounded-xl hover:bg-white/5 transition-colors"
          aria-label={t("viewAll")}
        >
          <ChevronRight className="w-5 h-5 opacity-40" />
        </Link>
      </div>

      <div className={`${isGrid ? "h-auto" : "flex-1"} overflow-y-auto pr-1 custom-scrollbar ${isGrid ? "grid grid-cols-1 md:grid-cols-2 gap-2" : "space-y-3"}`}>
        {deadlines.length === 0 ? (
          <div className={`flex flex-col items-center justify-center py-10 text-center opacity-40 ${isGrid ? "md:col-span-2" : ""}`}>
            <Calendar className="w-12 h-12 mb-3" />
            <p className="text-sm">{t("noAssignments")}</p>
          </div>
        ) : (
          deadlines.map((deadline, idx) => {
            const Icon = getIcon(deadline.type);
            const priorityColor = getPriorityColor(deadline.priority, isDark);
            
            return (
              <Link key={deadline.id} href={deadline.link || "#"}>
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  whileHover={{ scale: 1.02 }}
                  className={`flex items-center ${isGrid ? "gap-2.5 p-2" : "gap-4 p-4"} rounded-xl transition-all relative overflow-hidden group`}
                  style={{
                    background: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.02)",
                    border: `1px solid ${isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)"}`,
                  }}
                >
                  <div 
                    className="absolute left-0 top-0 bottom-0 w-0.5"
                    style={{ backgroundColor: priorityColor }}
                  />
                  
                  <div 
                    className={`${isGrid ? "w-8 h-8" : "w-12 h-12"} rounded-lg flex items-center justify-center shrink-0`}
                    style={{ background: `${priorityColor}10`, color: priorityColor }}
                  >
                    <Icon className={isGrid ? "w-4 h-4" : "w-5 h-5"} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className={`${isGrid ? "text-[8px]" : "text-[10px]"} font-medium uppercase tracking-wider mb-0.5`} style={{ color: priorityColor }}>
                       {deadline.priority === "high" ? t("priorityUrgent") : 
                        deadline.priority === "medium" ? t("priorityMedium") : 
                        t("priorityLow")}
                    </p>
                    <h4 className={`${isGrid ? "text-[13px]" : "text-sm"} font-bold truncate leading-tight`} style={{ color: textColors.primary }}>
                      {deadline.title}
                    </h4>
                    {isGrid && deadline.courseTitle && (
                      <p className="text-[9px] truncate opacity-50 mb-0.5" style={{ color: textColors.secondary }}>
                        {deadline.courseTitle}
                      </p>
                    )}
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[9px] opacity-60" style={{ color: textColors.secondary }}>
                        {t("deadlineSubtext_due")}:
                      </span>
                      <span className="text-[9px] font-bold" style={{ color: textColors.primary }}>
                        {formatDueDate(deadline.dueDate, t, lang)}
                      </span>
                    </div>
                  </div>

                  <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-40 transition-opacity" />
                </motion.div>
              </Link>
            );
          })
        )}
      </div>

      <Link
        href={teacherMode ? teacherReviewHref : "/app/courses?tab=assignments"}
        className="mt-4 flex items-center justify-center w-full py-3 rounded-2xl font-bold text-sm transition-all bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 group"
      >
        {t("viewAll")}
        <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
      </Link>
    </motion.div>
  );
}
