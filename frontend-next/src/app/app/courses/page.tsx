"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { useMemo, memo } from "react";
import { api } from "@/api/client";
import { useAuthStore } from "@/store/authStore";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { getTextColors } from "@/utils/themeStyles";
import type { TranslationKey } from "@/i18n/translations";
import type { Course } from "@/types";
import { BlurFade } from "@/components/ui/blur-fade";
import { getLocalizedCourseTitle, getLocalizedCourseDesc } from "@/lib/courseUtils";

function courseImageUrl(c: Course): string {
  if (c.image_url) return c.image_url;
  const seeds: Record<number, string> = { 1: "python-programming", 2: "web-development", 3: "react-framework", 4: "machine-learning" };
  const seed = seeds[c.id] ?? `course-${c.id}`;
  return `https://picsum.photos/seed/${seed}/400/200`;
}

const MyCourseCard = memo(function MyCourseCard({ c, t }: { c: Course; t: (k: TranslationKey) => string }) {
  const { theme } = useTheme();
  const imgUrl = useMemo(() => courseImageUrl(c), [c]);
  const textColors = getTextColors(theme);
  const isDark = theme === "dark";
  
  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800 rounded-2xl overflow-hidden border-2 border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow">
      {/* Image Section */}
      <div className="h-44 shrink-0 relative overflow-hidden">
        <Image
          src={imgUrl}
          alt={c.title}
          width={400}
          height={200}
          className="w-full h-full object-cover"
          loading="lazy"
          unoptimized={imgUrl.startsWith("http")}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
      </div>
      
      {/* Content Section */}
      <div className="flex-1 flex flex-col p-5 min-h-0">
        <h3 
          className="font-bold text-xl mb-2"
          style={{ color: textColors.primary }}
        >
          {getLocalizedCourseTitle(c, t)}
        </h3>
        <p 
          className="text-sm line-clamp-3 mb-4 leading-relaxed" 
          style={{ color: textColors.secondary }}
        >
          {getLocalizedCourseDesc(c, t)}
        </p>
        
        <div className="mt-auto pt-3">
          <Link 
            href={`/app/courses/${c.id}`}
            className="block w-full px-4 py-2 text-center rounded-lg font-medium transition-colors"
            style={{
              background: "linear-gradient(135deg, #FF4181 0%, #B938EB 100%)",
              color: "white",
            }}
          >
            <span className="flex items-center justify-center gap-2">
              {t("viewCourse")}
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7l5 5m0 0l-5 5m5-5H6"
                />
              </svg>
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
});

export default function MyCoursesPage() {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const router = useRouter();
  const { user } = useAuthStore();
  const textColors = getTextColors(theme);

  useEffect(() => {
    if (user?.role === "parent") {
      router.replace("/app");
    }
  }, [user, router]);

  if (user?.role === "parent") {
    return null;
  }
  
  const { data: enrollments = [], isLoading } = useQuery({
    queryKey: ["my-enrollments"],
    queryFn: async () => {
      const { data } = await api.get<Array<{ course_id: number; course: Course }>>("/courses/my/enrollments");
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 минут - данные курсов не меняются часто
    gcTime: 10 * 60 * 1000, // 10 минут в кеше
    refetchOnWindowFocus: false, // Не обновлять при фокусе окна
  });
  
  // Мемоизация списка курсов для предотвращения лишних ререндеров
  const courses = useMemo(
    () => enrollments.map((e) => e.course).filter((c): c is Course => !!c),
    [enrollments]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
          <p className="mt-4 text-center" style={{ color: textColors.secondary }}>
            {t("loading")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header Section */}
      <BlurFade delay={0.1}>
        <div className="mb-8">
          <h1 
            className="text-3xl font-bold mb-2"
            style={{ color: textColors.primary }}
          >
            {t("myCourses")}
          </h1>
          <p 
            className="text-lg opacity-70"
            style={{ color: textColors.secondary }}
          >
            {courses.length > 0 
              ? `${courses.length} ${t("coursesInSchedule")}`
              : t("startLearningNow")
            }
          </p>
        </div>
      </BlurFade>

      {/* Content */}
      {courses.length === 0 ? (
        <BlurFade delay={0.2}>
          <div className="rounded-2xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-16 text-center">
          <div className="mb-6">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-4 bg-gradient-to-br from-pink-500 to-purple-500">
              <svg
                className="w-10 h-10 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
            </div>
          </div>
          <p 
            className="mb-6 text-xl font-medium" 
            style={{ color: textColors.primary }}
          >
            {t("noEnrollments")}
          </p>
          <Link 
            href="/courses"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors"
            style={{
              background: "linear-gradient(135deg, #FF4181 0%, #B938EB 100%)",
              color: "white",
            }}
          >
            {t("courseCatalog")}
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
          </Link>
        </div>
        </BlurFade>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
          {courses.map((c, index) => (
            <BlurFade key={c.id} delay={0.1 + index * 0.05}>
              <MyCourseCard c={c} t={t} />
            </BlurFade>
          ))}
        </div>
      )}
    </div>
  );
}
