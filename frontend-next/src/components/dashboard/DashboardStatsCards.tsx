"use client";

import Link from "next/link";
import { BookCheck, Award, TrendingUp, Flame } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useTheme } from "@/context/ThemeContext";
import { getGlassCardStyle, getTextColors } from "@/utils/themeStyles";
import { BlurFade } from "@/components/ui/blur-fade";

export function DashboardStatsCards() {
  const { t, lang } = useLanguage();
  const { theme } = useTheme();
  const glassStyle = getGlassCardStyle(theme);
  const textColors = getTextColors(theme);
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const { data } = await api.get<{
        courses_completed: number;
        points: number;
        progress_percent: number;
        total_courses: number;
      }>("/dashboard/stats");
      return data;
    },
  });

  const coursesCompleted = stats?.courses_completed ?? 0;
  const points = stats?.points ?? 0;
  const progress = stats?.progress_percent ?? 0;
  const totalCourses = stats?.total_courses ?? 0;

  const { data: streakData } = useQuery({
    queryKey: ["user-streak"],
    queryFn: async () => {
      const { data } = await api.get<{ streak: number }>("/users/me/streak");
      return data;
    },
  });

  const streak = streakData?.streak ?? 0;

  const cards = [
    {
      icon: BookCheck,
      value: `${coursesCompleted}/${totalCourses || 1}`,
      label: t("statsCoursesComplete"),
      gradient: "from-blue-500 to-indigo-600",
      bgGlow: "bg-blue-500/10 dark:bg-blue-500/5",
      iconBg: "bg-gradient-to-br from-blue-500 to-indigo-600",
      direction: "left" as const,
      delay: 0.1,
    },
    {
      icon: Award,
      value: points.toLocaleString(lang === "kk" ? "kk-KZ" : lang === "ru" ? "ru-RU" : "en-US"),
      label: t("profileCoins"),
      gradient: "from-purple-500 to-pink-600",
      bgGlow: "bg-purple-500/10 dark:bg-purple-500/5",
      iconBg: "bg-gradient-to-br from-purple-500 to-pink-600",
      direction: "down" as const,
      delay: 0.15,
    },
    {
      icon: TrendingUp,
      value: `${progress}%`,
      label: t("statsProgress"),
      gradient: "from-orange-500 to-red-500",
      bgGlow: "bg-orange-500/10 dark:bg-orange-500/5",
      iconBg: "bg-gradient-to-br from-orange-500 to-red-500",
      direction: "up" as const,
      delay: 0.2,
    },
    {
      icon: Flame,
      value: streak.toString(),
      label: t("statsStreak"),
      gradient: "from-yellow-400 to-orange-500",
      bgGlow: "bg-yellow-400/10 dark:bg-yellow-400/5",
      iconBg: "bg-gradient-to-br from-yellow-400 to-orange-500",
      direction: "right" as const,
      delay: 0.25,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5 mb-6 sm:mb-8">
      {cards.map((card, i) => {
        const Icon = card.icon;
        const isDark = theme === "dark";
        return (
          <BlurFade
            key={i}
            direction={card.direction}
            delay={card.delay}
            offset={30}
            inView={true}
            duration={0.6}
            blur="8px"
          >
            <div
              className={`group relative overflow-hidden rounded-xl p-4 sm:p-5 lg:p-6 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5`}
              style={{
                background: isDark 
                  ? "rgba(30, 41, 59, 0.8)" 
                  : "#FFFFFF",
                border: isDark 
                  ? "1px solid rgba(255, 255, 255, 0.08)" 
                  : "1px solid rgba(0, 0, 0, 0.08)",
                boxShadow: isDark
                  ? "0 2px 8px rgba(0, 0, 0, 0.3), 0 1px 3px rgba(0, 0, 0, 0.2)"
                  : "0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.05)",
              }}
            >
              {/* Subtle gradient overlay on hover */}
              <div 
                className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${card.bgGlow}`}
              />

              {/* Decorative accent */}
              <div className={`absolute -top-8 -right-8 w-32 h-32 rounded-full ${card.iconBg} opacity-[0.06] group-hover:opacity-[0.1] transition-opacity`} />

              <div className="relative flex flex-row items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight mb-0.5 sm:mb-1 truncate leading-tight" style={{ color: textColors.primary }}>
                    {card.value}
                  </p>
                  <p className="text-[10px] sm:text-xs lg:text-sm font-bold uppercase tracking-tighter opacity-80 leading-tight" style={{ color: textColors.secondary }}>
                    {card.label}
                  </p>
                </div>
                <div
                  className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0 text-white shadow-lg shadow-black/10 group-hover:scale-110 transition-transform duration-300 ${card.iconBg}`}
                >
                  <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
              </div>

              {/* Progress bar for the progress card */}
              {i === 2 && (
                <div className="mt-4 h-1.5 rounded-full overflow-hidden" style={{ background: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{
                      width: `${progress}%`,
                      background: "linear-gradient(135deg, #FF4181 0%, #B938EB 100%)",
                    }}
                  />
                </div>
              )}
            </div>
          </BlurFade>
        );
      })}
    </div>
  );
}
