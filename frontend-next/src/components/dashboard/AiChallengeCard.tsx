"use client";

import Link from "next/link";
import { useTheme } from "@/context/ThemeContext";
import { useLanguage } from "@/context/LanguageContext";
import { getDashboardCardStyle, getTextColors } from "@/utils/themeStyles";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { Zap } from "lucide-react";
import type { Course } from "@/types";

export function AiChallengeCard() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const cardStyle = getDashboardCardStyle(theme);
  const textColors = getTextColors(theme);

  // Получаем первый активный курс (Python)
  const { data: courses = [] } = useQuery({
    queryKey: ["courses-active"],
    queryFn: async () => {
      const { data } = await api.get<Course[]>("/courses?is_active=true");
      return data;
    },
  });

  // Находим курс Python или берем первый активный
  const pythonCourse = courses.find((c) => 
    c.title?.toLowerCase().includes("python") || 
    c.title?.includes("Python программалау")
  ) || courses[0];

  if (!pythonCourse) {
    return null;
  }

  return (
    <div
      className="h-full flex flex-col rounded-xl p-6 transition-all duration-300 hover:shadow-lg cursor-pointer"
      style={cardStyle}
    >
      <Link href={`/app/ai-challenge/${pythonCourse.id}?mode=quiz&level=intermediate`} className="flex-1 flex flex-col items-center justify-center text-center">
          {/* Icon */}
          <div className="w-16 h-16 rounded-xl flex items-center justify-center mb-4 bg-gradient-to-br from-purple-500 to-pink-500">
            <Zap className="w-8 h-8 text-white" fill="currentColor" />
          </div>
          
          {/* Title */}
          <h3 className="text-lg font-bold mb-1" style={{ color: textColors.primary }}>
            {t("aiVsStudent")}
          </h3>
          
          {/* Subtitle */}
          <p className="text-sm mb-4" style={{ color: textColors.secondary }}>
            {t("competeWithAI")}
          </p>
          
          {/* Course name */}
          <p className="text-base font-semibold mb-4" style={{ color: textColors.primary }}>
            {pythonCourse.title}
          </p>
          
          {/* Start button */}
          <div className="flex items-center gap-2 text-sm font-medium text-purple-600 dark:text-purple-400">
            <span>{t("aiStarting")}</span>
            <span>→</span>
          </div>
      </Link>
    </div>
  );
}
