"use client";

import Link from "next/link";
import { Play } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useTheme } from "@/context/ThemeContext";
import { getGlassCardStyle, getTextColors } from "@/utils/themeStyles";
import { getLocalizedCourseTitle, getLocalizedTopicTitle } from "@/lib/courseUtils";

function courseImageUrl(item: { course_id: number; course_image_url?: string | null }): string {
  if (item.course_image_url) return item.course_image_url;
  return "/course-placeholder.svg";
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function ContinueWatching() {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const glassStyle = getGlassCardStyle(theme);
  const textColors = getTextColors(theme);
  const { data: items = [] } = useQuery({
    queryKey: ["continue-watching"],
    queryFn: async () => {
      const { data } = await api.get<Array<{
        topic_id: number;
        course_id: number;
        course_title: string;
        course_image_url?: string | null;
        topic_title: string;
        video_watched_seconds: number;
        video_duration: number;
        progress_percent: number;
      }>>("/dashboard/continue-watching");
      return data;
    },
  });

  if (items.length === 0) return null;

  return (
    <section className="mb-6 sm:mb-10">
      <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4" style={{ color: textColors.primary }}>{t("continueWatching")}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item) => (
          <Link
            key={item.topic_id}
            href={`/app/courses/${item.course_id}/topic/${item.topic_id}`}
            className="group rounded-[20px] overflow-hidden shadow-md hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 card-glow-hover card-hover-lift"
            style={glassStyle}
          >
            <div className="relative h-32 sm:h-28 bg-gray-100 dark:bg-gray-700 overflow-hidden">
              <img
                src={courseImageUrl(item)}
                alt={getLocalizedCourseTitle({ title: item.course_title } as any, t)}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white opacity-90 group-hover:opacity-100 group-hover:scale-110 transition-all shadow-lg"
                  style={{ background: "linear-gradient(135deg, #FF4181 0%, #B938EB 100%)" }}
                >
                  <Play className="w-6 h-6 ml-0.5" fill="currentColor" />
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-900/30">
                <div
                  className="h-full transition-all"
                  style={{ width: `${item.progress_percent}%`, background: "linear-gradient(135deg, #FF4181 0%, #B938EB 100%)" }}
                />
              </div>
            </div>
            <div className="p-3.5 sm:p-4">
              <p className="font-semibold line-clamp-2 sm:line-clamp-1 leading-snug" style={{ color: textColors.primary }}>
                {getLocalizedTopicTitle(item.topic_title, t as any)}
              </p>
              <p className="text-sm mt-0.5 line-clamp-1" style={{ color: textColors.secondary }}>{getLocalizedCourseTitle({ title: item.course_title } as any, t)}</p>
              <p className="text-xs mt-1.5 sm:mt-2" style={{ color: "#8B5CF6" }}>
                {formatTime(item.video_watched_seconds)} / {formatTime(item.video_duration)}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
