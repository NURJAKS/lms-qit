"use client";

import { Calendar, Clock, FileText, BookOpen } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { useLanguage } from "@/context/LanguageContext";
import { getDashboardCardStyle, getTextColors } from "@/utils/themeStyles";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import Link from "next/link";

type Deadline = {
  id: number;
  title: string;
  type: "assignment" | "test" | "course";
  dueDate: string;
  courseTitle?: string;
  priority: "high" | "medium" | "low";
  submitted?: boolean;
};

const getIcon = (type: Deadline["type"]) => {
  switch (type) {
    case "assignment":
      return FileText;
    case "test":
      return BookOpen;
    case "course":
      return Calendar;
    default:
      return Calendar;
  }
};

const getPriorityColor = (priority: Deadline["priority"], isDark: boolean) => {
  switch (priority) {
    case "high":
      return isDark ? "#EF4444" : "#DC2626";
    case "medium":
      return isDark ? "#F59E0B" : "#D97706";
    case "low":
      return isDark ? "#10B981" : "#059669";
    default:
      return isDark ? "#64748B" : "#6B7280";
  }
};

const formatDueDate = (dateStr: string, t: (k: string) => string, lang: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return t("overdue");
  if (diffDays === 0) return t("today");
  if (diffDays === 1) return t("tomorrow");
  if (diffDays < 7) return t("daysLeft").replace("{count}", String(diffDays));
  return date.toLocaleDateString(lang === "ru" ? "ru-RU" : lang === "kk" ? "kk-KZ" : "en-US", { day: "numeric", month: "short" });
};

export function UpcomingDeadlinesWidget() {
  const { theme } = useTheme();
  const { t, lang } = useLanguage();
  const cardStyle = getDashboardCardStyle(theme);
  const textColors = getTextColors(theme);
  const isDark = theme === "dark";

  const { data: deadlines = [] } = useQuery({
    queryKey: ["upcoming-deadlines"],
    queryFn: async () => {
      try {
        const { data } = await api.get<Deadline[]>("/dashboard/deadlines?limit=10");
        return data || [];
      } catch (error) {
        console.error("Failed to fetch deadlines:", error);
        return [];
      }
    },
  });

  return (
    <div
      className="h-full flex flex-col rounded-xl p-3 transition-all duration-300 hover:shadow-lg"
      style={cardStyle}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold" style={{ color: textColors.primary }}>
          {t("upcomingDeadlines")}
        </h3>
        <Clock className="w-3.5 h-3.5" style={{ color: textColors.secondary }} />
      </div>

      {/* Deadlines list */}
      <div className={`flex-1 ${deadlines.length === 0 ? 'flex flex-col' : 'space-y-1.5'}`}>
        {deadlines.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-4 px-2">
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center mb-2.5 relative overflow-hidden"
              style={{
                background: isDark 
                  ? "linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(59, 130, 246, 0.2) 100%)"
                  : "linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%)",
              }}
            >
              <div 
                className="absolute inset-0 opacity-20"
                style={{
                  background: "linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)",
                }}
              />
              <Calendar 
                className="w-5 h-5 relative z-10" 
                style={{ 
                  color: isDark ? "#A78BFA" : "#7C3AED" 
                }} 
              />
            </div>
            <p 
              className="text-xs font-medium text-center mb-1" 
              style={{ color: textColors.primary }}
            >
              {t("noAssignments")}
            </p>
            <p 
              className="text-[10px] text-center leading-tight" 
              style={{ color: textColors.secondary }}
            >
              {t("allTasksCompleted")}
            </p>
          </div>
        ) : (
          deadlines.slice(0, 4).map((deadline) => {
            const Icon = getIcon(deadline.type);
            const priorityColor = getPriorityColor(deadline.priority, isDark);
            const isSubmitted = deadline.submitted;
            
            return (
              <Link
                key={deadline.id}
                href={`/app/tasks-calendar?tab=all-assignments&assignment=${deadline.id}`}
                className="block p-1.5 rounded-lg transition-all hover:scale-[1.02]"
                style={{
                  background: isDark 
                    ? "rgba(255, 255, 255, 0.04)" 
                    : "rgba(0, 0, 0, 0.02)",
                  border: `1px solid ${isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)"}`,
                  opacity: isSubmitted ? 0.6 : 1,
                }}
              >
                <div className="flex items-start gap-2">
                  <div
                    className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                    style={{
                      background: `${priorityColor}20`,
                      color: priorityColor,
                    }}
                  >
                    <Icon className="w-3 h-3" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <p className="text-xs font-semibold line-clamp-1" style={{ color: textColors.primary }}>
                        {deadline.title}
                      </p>
                      {isSubmitted && (
                        <span className="text-xs px-1 py-0.5 rounded" style={{ 
                          background: isDark ? "rgba(16, 185, 129, 0.2)" : "rgba(16, 185, 129, 0.1)",
                          color: "#10b981"
                        }}>
                          {t("assignmentsSubmitted")}
                        </span>
                      )}
                    </div>
                    {deadline.courseTitle && (
                      <p className="text-xs mb-0.5 line-clamp-1" style={{ color: textColors.secondary }}>
                        {deadline.courseTitle}
                      </p>
                    )}
                    <div className="flex items-center gap-1.5">
                      <span
                        className="text-xs font-medium px-1.5 py-0.5 rounded"
                        style={{
                          background: `${priorityColor}20`,
                          color: priorityColor,
                        }}
                      >
                        {formatDueDate(deadline.dueDate, t, lang)}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
