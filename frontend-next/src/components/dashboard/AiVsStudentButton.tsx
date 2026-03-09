"use client";

import Link from "next/link";
import { Zap } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { getGlassCardStyle, getTextColors } from "@/utils/themeStyles";
import type { Course } from "@/types";

interface AiVsStudentButtonProps {
  course?: Course | { course_id: number; course?: Course };
  variant?: "hero" | "card";
  className?: string;
}

export function AiVsStudentButton({ course, variant = "card", className = "" }: AiVsStudentButtonProps) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const glassStyle = getGlassCardStyle(theme);
  const textColors = getTextColors(theme);
  const isDark = theme === "dark";

  const courseId = course ? ("id" in course ? course.id : course.course_id) : null;
  const courseTitle = course
    ? "title" in course
      ? course.title
      : course.course?.title ?? t("aiVsStudent")
    : t("aiVsStudent");

  const href = courseId ? `/app/ai-challenge/${courseId}` : "#ai-challenge";

  if (variant === "hero") {
    return (
      <Link
        href={href}
        className={`group relative w-full rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 hover:scale-[1.01] ${className}`}
        style={{
          background: "linear-gradient(135deg, #6366f1 0%, #818cf8 50%, #8b5cf6 100%)",
          backgroundImage: "linear-gradient(135deg, #6366f1 0%, #818cf8 50%, #8b5cf6 100%)",
          backgroundColor: "#6366f1",
          boxShadow: "0 8px 24px rgba(99, 102, 241, 0.4)",
        }}
      >
        {/* Decorative wave pattern */}
        <div className="absolute inset-0 opacity-10">
          <svg className="absolute bottom-0 left-0 w-full h-24" viewBox="0 0 1200 120" preserveAspectRatio="none">
            <path
              fill="currentColor"
              d="M0,60 C300,120 600,0 900,60 C1050,90 1200,30 1200,60 L1200,120 L0,120 Z"
            />
          </svg>
        </div>

        {/* Decorative glow elements */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2" style={{ background: "rgba(99, 102, 241, 0.4)" }} />
          <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full blur-3xl transform -translate-x-1/2 translate-y-1/2" style={{ background: "rgba(139, 92, 246, 0.4)" }} />
        </div>

        {/* Content */}
        <div className="relative p-10 lg:p-16 xl:p-20 2xl:p-24 flex items-center gap-10 lg:gap-12 xl:gap-16 min-h-[200px] lg:min-h-[280px] xl:min-h-[360px]">
          {/* Icon */}
          <div
            className="w-28 h-28 lg:w-40 lg:h-40 xl:w-48 xl:h-48 2xl:w-56 2xl:h-56 rounded-3xl flex items-center justify-center shrink-0 text-white group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 shadow-xl"
            style={{ 
              background: "rgba(255, 255, 255, 0.25)",
              backdropFilter: "blur(10px)",
              border: "2px solid rgba(255, 255, 255, 0.4)",
            }}
          >
            <Zap className="w-16 h-16 lg:w-24 lg:h-24 xl:w-28 xl:h-28 2xl:w-32 2xl:h-32" fill="currentColor" stroke="currentColor" strokeWidth={2} />
          </div>

          {/* Text content */}
          <div className="flex-1 min-w-0">
            <h3 className="text-4xl lg:text-5xl xl:text-6xl 2xl:text-7xl font-extrabold mb-4 lg:mb-5 xl:mb-6 text-white drop-shadow-lg leading-tight" style={{ color: "#FFFFFF", textShadow: "0 2px 8px rgba(0, 0, 0, 0.4)" }}>
              {courseTitle}
            </h3>
            <p className="text-2xl lg:text-3xl xl:text-4xl 2xl:text-5xl font-bold text-white drop-shadow-md leading-tight" style={{ color: "#FFFFFF", textShadow: "0 2px 4px rgba(0, 0, 0, 0.3)" }}>
              {t("competeWithAI")}
            </p>
          </div>
        </div>

        {/* Shine effect on hover */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
          <div 
            className="absolute inset-0 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"
            style={{
              background: "linear-gradient(to right, transparent 0%, rgba(99, 102, 241, 0.3) 50%, transparent 100%)",
            }}
          />
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={`group relative rounded-xl overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 flex items-center gap-4 p-5 ${className}`}
      style={{
        background: "linear-gradient(135deg, #c4b5fd 0%, #a78bfa 50%, #8b5cf6 100%)",
        backgroundImage: "linear-gradient(135deg, #c4b5fd 0%, #a78bfa 50%, #8b5cf6 100%)",
        backgroundColor: "#a78bfa",
        boxShadow: "0 4px 20px rgba(167, 139, 250, 0.4), 0 2px 8px rgba(139, 92, 246, 0.3)",
      }}
    >
      {/* Decorative glow */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full blur-2xl opacity-30" />
      </div>

      <div
        className="relative w-14 h-14 rounded-xl flex items-center justify-center shrink-0 text-white group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 shadow-lg"
        style={{ 
          background: "rgba(255, 255, 255, 0.25)",
          backdropFilter: "blur(8px)",
          border: "2px solid rgba(255, 255, 255, 0.4)",
        }}
      >
        <Zap className="w-7 h-7" fill="currentColor" stroke="currentColor" strokeWidth={2} />
      </div>
      <div className="relative min-w-0 flex-1">
        <p className="font-bold truncate text-base text-white drop-shadow-lg" style={{ color: "#FFFFFF", textShadow: "0 2px 4px rgba(0, 0, 0, 0.3)" }}>
          {courseTitle}
        </p>
        <p className="text-sm mt-1 font-semibold text-white drop-shadow-md" style={{ color: "#FFFFFF", textShadow: "0 1px 2px rgba(0, 0, 0, 0.2)" }}>
          {t("competeWithAI")}
        </p>
        <div className="mt-2 inline-flex items-center gap-1 text-white font-medium text-xs">
          <span>{t("aiStarting")}</span>
          <span>→</span>
        </div>
      </div>
    </Link>
  );
}
