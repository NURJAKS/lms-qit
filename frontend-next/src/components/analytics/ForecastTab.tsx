"use client";

import { Clock, Rocket, TrendingDown, TrendingUp, CheckCircle2, AlertCircle } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { getGlassCardStyle, getTextColors } from "@/utils/themeStyles";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { getLocalizedCourseTitle } from "@/lib/courseUtils";

interface ForecastCourse {
  course_id: number;
  course_title: string;
  total_topics: number;
  completed_topics: number;
  remaining_topics: number;
  progress_pct: number;
  pace_per_week: number;
  estimated_days: number;
  avg_score: number;
  status: "completed" | "excellent" | "good" | "slow" | "inactive";
}

interface ForecastData {
  courses: ForecastCourse[];
  overall_status: string;
}

const STATUS_CONFIG = {
  completed: { icon: CheckCircle2, color: "#10B981", gradient: "from-green-500 to-emerald-600" },
  excellent: { icon: Rocket, color: "#6366F1", gradient: "from-indigo-500 to-purple-600" },
  good: { icon: TrendingUp, color: "#14B8A6", gradient: "from-teal-500 to-cyan-600" },
  slow: { icon: TrendingDown, color: "#F59E0B", gradient: "from-amber-500 to-orange-600" },
  inactive: { icon: AlertCircle, color: "#EF4444", gradient: "from-red-500 to-rose-600" },
};

export function ForecastTab() {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const glassStyle = getGlassCardStyle(theme);
  const textColors = getTextColors(theme);
  const isDark = theme === "dark";

  const { data, isLoading } = useQuery({
    queryKey: ["student-forecast"],
    queryFn: async () => {
      const { data } = await api.get<ForecastData>("/analytics/student-insights/success-forecast");
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

  if (!data || data.courses.length === 0) {
    return (
      <div className="rounded-xl p-8 text-center" style={glassStyle}>
        <Clock className="w-10 h-10 mx-auto mb-3 text-gray-400" />
        <p className="text-sm" style={{ color: textColors.secondary }}>{t("forecastEmpty")}</p>
      </div>
    );
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "completed": return t("forecastCompleted");
      case "excellent": return t("forecastExcellent");
      case "good": return t("forecastGood");
      case "slow": return t("forecastSlow");
      case "inactive": return t("forecastInactive");
      default: return "";
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-4" style={glassStyle}>
        <div className="flex items-center gap-3">
          <Rocket className="w-5 h-5 text-indigo-500" />
          <h3 className="font-bold" style={{ color: textColors.primary }}>{t("forecastTitle")}</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {data.courses.map((course) => {
          const config = STATUS_CONFIG[course.status] || STATUS_CONFIG.inactive;
          const StatusIcon = config.icon;

          return (
            <div
              key={course.course_id}
              className="rounded-xl overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
              style={glassStyle}
            >
              {/* Status header */}
              <div
                className={`px-4 py-2.5 flex items-center gap-2 bg-gradient-to-r ${config.gradient}`}
              >
                <StatusIcon className="w-4 h-4 text-white" />
                <span className="text-xs font-bold text-white">{getStatusLabel(course.status)}</span>
              </div>

              <div className="p-4 sm:p-5">
                <h4 className="font-bold text-sm sm:text-base mb-3 truncate" style={{ color: textColors.primary }}>
                  {getLocalizedCourseTitle({ title: course.course_title } as any, t)}
                </h4>

                {/* Progress */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs" style={{ color: textColors.secondary }}>
                      {course.completed_topics}/{course.total_topics}
                    </span>
                    <span className="text-xs font-bold" style={{ color: config.color }}>
                      {course.progress_pct}%
                    </span>
                  </div>
                  <div
                    className="h-2 rounded-full overflow-hidden"
                    style={{ background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${course.progress_pct}%`, background: config.color }}
                    />
                  </div>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-3 gap-2">
                  <div
                    className="rounded-lg p-2.5 text-center"
                    style={{
                      background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                    }}
                  >
                    <p className="text-lg font-bold" style={{ color: textColors.primary }}>
                      {course.pace_per_week}
                    </p>
                    <p className="text-[10px]" style={{ color: textColors.secondary }}>
                      {t("forecastTopicsPerWeek")}
                    </p>
                  </div>
                  <div
                    className="rounded-lg p-2.5 text-center"
                    style={{
                      background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                    }}
                  >
                    <p className="text-lg font-bold" style={{ color: textColors.primary }}>
                      {course.estimated_days >= 0 ? course.estimated_days : "—"}
                    </p>
                    <p className="text-[10px]" style={{ color: textColors.secondary }}>
                      {t("forecastEstimated")}
                    </p>
                  </div>
                  <div
                    className="rounded-lg p-2.5 text-center"
                    style={{
                      background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                    }}
                  >
                    <p className="text-lg font-bold" style={{ color: textColors.primary }}>
                      {course.avg_score > 0 ? `${course.avg_score}%` : "—"}
                    </p>
                    <p className="text-[10px]" style={{ color: textColors.secondary }}>
                      {t("weakTopicsScore")}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
