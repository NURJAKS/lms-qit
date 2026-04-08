"use client";

import Link from "next/link";
import { BookOpen, ChevronRight, ListChecks, RefreshCw, Target } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { getGlassCardStyle, getTextColors } from "@/utils/themeStyles";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { getLocalizedCourseTitle, getLocalizedTopicTitle } from "@/lib/courseUtils";

interface Recommendation {
  type: "review" | "continue";
  topic_id: number;
  course_id: number;
  topic_title: string;
  course_title: string;
  priority: "high" | "medium" | "low";
  reason: string;
  reason_kk: string;
  reason_en: string;
  score: number | null;
}

interface StudyPlanData {
  daily_goal_topics: number;
  current_pace_per_day: number;
  recommendations: Recommendation[];
}

export function StudyPlanTab() {
  const { t, lang } = useLanguage();
  const { theme } = useTheme();
  const glassStyle = getGlassCardStyle(theme);
  const textColors = getTextColors(theme);
  const isDark = theme === "dark";

  const { data, isLoading } = useQuery({
    queryKey: ["student-study-plan"],
    queryFn: async () => {
      const { data } = await api.get<StudyPlanData>("/analytics/student-insights/study-plan");
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="rounded-xl p-8 text-center" style={glassStyle}>
        <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto" />
        <p className="mt-3 text-sm" style={{ color: textColors.secondary }}>{t("loading")}</p>
      </div>
    );
  }

  if (!data || data.recommendations.length === 0) {
    return (
      <div className="rounded-xl p-8 text-center" style={glassStyle}>
        <ListChecks className="w-10 h-10 mx-auto mb-3 text-gray-400" />
        <p className="text-sm" style={{ color: textColors.secondary }}>{t("studyPlanEmpty")}</p>
      </div>
    );
  }

  const getReason = (rec: Recommendation) => {
    if (lang === "kk") return rec.reason_kk;
    if (lang === "en") return rec.reason_en;
    return rec.reason;
  };

  const priorityConfig = {
    high: { color: "#EF4444", bg: "rgba(239, 68, 68, 0.1)", border: "rgba(239, 68, 68, 0.2)" },
    medium: { color: "#6366F1", bg: "rgba(99, 102, 241, 0.1)", border: "rgba(99, 102, 241, 0.2)" },
    low: { color: "#10B981", bg: "rgba(16, 185, 129, 0.1)", border: "rgba(16, 185, 129, 0.2)" },
  };

  return (
    <div className="space-y-4">
      {/* Header with daily goal */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div
          className="rounded-xl p-5 relative overflow-hidden"
          style={{
            background: isDark
              ? "linear-gradient(135deg, rgba(20, 184, 166, 0.15) 0%, rgba(99, 102, 241, 0.1) 100%)"
              : "linear-gradient(135deg, rgba(20, 184, 166, 0.08) 0%, rgba(99, 102, 241, 0.05) 100%)",
            border: isDark
              ? "1px solid rgba(20, 184, 166, 0.25)"
              : "1px solid rgba(20, 184, 166, 0.15)",
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-teal-500" />
            <span className="text-xs font-semibold" style={{ color: textColors.secondary }}>
              {t("studyPlanGoal")}
            </span>
          </div>
          <p className="text-3xl font-black" style={{ color: "#14B8A6" }}>
            {data.daily_goal_topics}
          </p>
          <p className="text-xs mt-1" style={{ color: textColors.secondary }}>
            {t("studyPlanTopicsPerDay")}
          </p>
        </div>

        <div
          className="rounded-xl p-5 relative overflow-hidden"
          style={glassStyle}
        >
          <div className="flex items-center gap-2 mb-2">
            <RefreshCw className="w-4 h-4" style={{ color: textColors.secondary }} />
            <span className="text-xs font-semibold" style={{ color: textColors.secondary }}>
              {t("studyPlanCurrentPace")}
            </span>
          </div>
          <p className="text-3xl font-black" style={{ color: textColors.primary }}>
            {data.current_pace_per_day}
          </p>
          <p className="text-xs mt-1" style={{ color: textColors.secondary }}>
            {t("studyPlanTopicsPerDay")}
          </p>
        </div>
      </div>

      {/* Title */}
      <div className="rounded-xl p-4" style={glassStyle}>
        <div className="flex items-center gap-3">
          <ListChecks className="w-5 h-5 text-indigo-500" />
          <h3 className="font-bold" style={{ color: textColors.primary }}>{t("studyPlanTitle")}</h3>
        </div>
      </div>

      {/* Recommendations list */}
      <div className="space-y-2">
        {data.recommendations.map((rec, idx) => {
          const pConf = priorityConfig[rec.priority] || priorityConfig.medium;
          const isReview = rec.type === "review";

          return (
            <div
              key={`${rec.type}-${rec.topic_id}-${idx}`}
              className="rounded-xl p-4 sm:p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
              style={glassStyle}
            >
              <div className="flex items-start gap-3">
                {/* Priority indicator */}
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: pConf.bg, border: `1px solid ${pConf.border}` }}
                >
                  {isReview ? (
                    <RefreshCw className="w-4.5 h-4.5" style={{ color: pConf.color }} />
                  ) : (
                    <BookOpen className="w-4.5 h-4.5" style={{ color: pConf.color }} />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span
                      className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded"
                      style={{ color: pConf.color, background: pConf.bg }}
                    >
                      {isReview ? t("studyPlanReview") : t("studyPlanContinue")}
                    </span>
                  </div>
                  <h4 className="font-semibold text-sm truncate" style={{ color: textColors.primary }}>
                    {getLocalizedTopicTitle(rec.topic_title, t)}
                  </h4>
                  <p className="text-xs truncate mt-0.5" style={{ color: textColors.secondary }}>
                    {getLocalizedCourseTitle({ title: rec.course_title } as any, t)}
                  </p>
                  <p className="text-xs mt-1.5" style={{ color: textColors.secondary }}>
                    {getReason(rec)}
                  </p>
                </div>

                <Link
                  href={`/app/courses/${rec.course_id}/topic/${rec.topic_id}`}
                  className="shrink-0 flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ background: `linear-gradient(135deg, ${pConf.color}, ${pConf.color}cc)` }}
                >
                  {isReview ? t("weakTopicsRetry") : t("studyPlanContinue")}
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
