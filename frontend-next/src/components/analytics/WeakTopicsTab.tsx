"use client";

import Link from "next/link";
import { AlertTriangle, ChevronRight, RefreshCw, CheckCircle2 } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { getGlassCardStyle, getTextColors } from "@/utils/themeStyles";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";

interface WeakTopic {
  topic_id: number;
  topic_title: string;
  course_id: number;
  course_title: string;
  test_score: number;
  attempts_count: number;
}

export function WeakTopicsTab() {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const glassStyle = getGlassCardStyle(theme);
  const textColors = getTextColors(theme);
  const isDark = theme === "dark";

  const { data: topics = [], isLoading } = useQuery({
    queryKey: ["student-weak-topics"],
    queryFn: async () => {
      const { data } = await api.get<WeakTopic[]>("/analytics/student-insights/weak-topics");
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

  if (topics.length === 0) {
    return (
      <div className="rounded-xl p-8 text-center" style={glassStyle}>
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-green-500/10 flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-green-500" />
        </div>
        <h3 className="text-lg font-bold mb-2" style={{ color: textColors.primary }}>
          🎉 {t("weakTopicsEmpty")}
        </h3>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl p-4" style={glassStyle}>
        <div className="flex items-center gap-3 mb-1">
          <AlertTriangle className="w-5 h-5 text-orange-500" />
          <h3 className="font-bold" style={{ color: textColors.primary }}>{t("weakTopicsTitle")}</h3>
        </div>
        <p className="text-sm ml-8" style={{ color: textColors.secondary }}>{t("weakTopicsHint")}</p>
      </div>

      {topics.map((topic) => {
        const scoreColor =
          topic.test_score < 30
            ? "#EF4444"
            : topic.test_score < 50
            ? "#F59E0B"
            : "#F97316";

        return (
          <div
            key={topic.topic_id}
            className="rounded-xl p-4 sm:p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
            style={glassStyle}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-sm sm:text-base truncate" style={{ color: textColors.primary }}>
                  {topic.topic_title}
                </h4>
                <p className="text-xs mt-0.5 truncate" style={{ color: textColors.secondary }}>
                  {topic.course_title}
                </p>
                <div className="flex items-center gap-4 mt-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium" style={{ color: textColors.secondary }}>
                      {t("weakTopicsScore")}:
                    </span>
                    <span
                      className="text-sm font-bold px-2 py-0.5 rounded-md"
                      style={{ color: scoreColor, background: `${scoreColor}15` }}
                    >
                      {topic.test_score.toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5" style={{ color: textColors.secondary }} />
                    <span className="text-xs" style={{ color: textColors.secondary }}>
                      {topic.attempts_count} {t("weakTopicsAttempts").toLowerCase()}
                    </span>
                  </div>
                </div>
                {/* Score bar */}
                <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${topic.test_score}%`, background: scoreColor }}
                  />
                </div>
              </div>
              <Link
                href={`/app/courses/${topic.course_id}/topic/${topic.topic_id}`}
                className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: "linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)" }}
              >
                {t("weakTopicsRetry")}
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
