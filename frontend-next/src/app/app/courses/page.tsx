"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useAuthStore } from "@/store/authStore";
import { useLanguage } from "@/context/LanguageContext";
import type { Lang } from "@/i18n/translations";
import { useTheme } from "@/context/ThemeContext";
import { getGlassCardStyle, getTextColors } from "@/utils/themeStyles";
import type { Course } from "@/types";
import { BlurFade } from "@/components/ui/blur-fade";
import { getLocalizedCourseTitle, getCourseBannerUrl } from "@/lib/courseUtils";
import { StudentAssignmentsListView } from "@/components/courses/StudentAssignmentsListView";

type AssignmentRow = {
  id: number;
  title: string;
  course_id: number;
  course_title: string;
  deadline: string | null;
  submitted: boolean;
  grade: number | null;
  closed?: boolean;
};

type EnrollmentRow = {
  course_id: number;
  course: Course;
  enrolled_at?: string | null;
};

function formatDueWhen(iso: string, lang: Lang): string {
  const d = new Date(iso);
  const locale = lang === "kk" ? "kk-KZ" : lang === "en" ? "en-US" : "ru-RU";
  return new Intl.DateTimeFormat(locale, { weekday: "long", hour: "2-digit", minute: "2-digit" }).format(d);
}

function pickNearestStudentAssignment(assignments: AssignmentRow[], courseId: number): AssignmentRow | null {
  const now = Date.now();
  const candidates = assignments.filter(
    (a) =>
      a.course_id === courseId &&
      a.deadline &&
      !a.submitted &&
      (a.grade === null || a.grade === undefined) &&
      !a.closed
  );
  if (candidates.length === 0) return null;
  const scored = candidates.map((a) => ({
    a,
    t: new Date(a.deadline!).getTime(),
  }));
  const upcoming = scored.filter((x) => x.t >= now).sort((x, y) => x.t - y.t);
  if (upcoming.length > 0) return upcoming[0].a;
  return scored.sort((x, y) => y.t - x.t)[0]?.a ?? null;
}

function yearFromEnrollment(enrolledAt: string | null | undefined, course: Course): string {
  if (enrolledAt) {
    try {
      return String(new Date(enrolledAt).getFullYear());
    } catch {
      /* fall through */
    }
  }
  if (course.created_at) {
    try {
      return String(new Date(course.created_at).getFullYear());
    } catch {
      return "";
    }
  }
  return "";
}

export default function MyCoursesPage() {
  const { t, lang } = useLanguage();
  const { theme } = useTheme();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();
  const userId = user?.id;
  const glassStyle = getGlassCardStyle(theme);
  const textColors = getTextColors(theme);
  const [indexTab, setIndexTab] = useState<"courses" | "assignments">("courses");

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "assignments") {
      setIndexTab("assignments");
    }
  }, [searchParams]);

  useEffect(() => {
    if (user?.role === "parent") {
      router.replace("/app");
    }
  }, [user, router]);

  const { data: enrollments = [], isLoading } = useQuery({
    queryKey: ["my-enrollments", userId],
    queryFn: async () => {
      const { data } = await api.get<EnrollmentRow[]>("/courses/my/enrollments");
      return data;
    },
    enabled: userId != null && user?.role !== "parent",
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const courses = useMemo(
    () => enrollments.map((e) => e.course).filter((c): c is Course => !!c),
    [enrollments]
  );

  const enrollmentByCourse = useMemo(() => {
    const m = new Map<number, string | null | undefined>();
    enrollments.forEach((e) => m.set(e.course_id, e.enrolled_at));
    return m;
  }, [enrollments]);

  const { data: assignments = [] } = useQuery({
    queryKey: ["student-assignments", "courses-page"],
    queryFn: async () => {
      const { data } = await api.get<AssignmentRow[]>(`/assignments/my`);
      return Array.isArray(data) ? data : [];
    },
    enabled: userId != null && user?.role !== "parent" && courses.length > 0,
  });

  if (user?.role === "parent") {
    return null;
  }

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
    <div className="relative max-w-6xl mx-auto">
      <div className="mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-geologica" style={{ color: textColors.primary }}>
            {t("teacherCoursesTab")}
          </h1>
          <p className="text-sm mt-1" style={{ color: textColors.secondary }}>
            {t("studentCoursesTabHint")}
          </p>
        </div>
      </div>

      <div
        className="flex flex-wrap gap-4 mb-8 border-b"
        style={{ borderColor: theme === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)" }}
      >
        <button
          type="button"
          onClick={() => setIndexTab("courses")}
          className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
            indexTab === "courses"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-600 dark:text-gray-400 hover:opacity-90"
          }`}
        >
          {t("teacherActiveCourses")} ({courses.length})
        </button>
        <button
          type="button"
          onClick={() => setIndexTab("assignments")}
          className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
            indexTab === "assignments"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-600 dark:text-gray-400 hover:opacity-90"
          }`}
        >
          {t("assignmentsList")}
        </button>
      </div>

      {indexTab === "assignments" ? (
        <StudentAssignmentsListView embedded />
      ) : (
        <div className="space-y-6">
          {courses.length === 0 ? (
            <BlurFade>
              <div className="rounded-2xl p-8 text-center" style={{ ...glassStyle }}>
                <p style={{ color: textColors.primary }}>{t("noEnrollments")}</p>
                <Link
                  href="/courses"
                  className="inline-flex mt-4 px-4 py-2 rounded-xl text-white font-medium"
                  style={{ background: "linear-gradient(135deg, #FF4181 0%, #B938EB 100%)" }}
                >
                  {t("courseCatalog")}
                </Link>
              </div>
            </BlurFade>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {courses.map((c, idx) => {
                const nearest = pickNearestStudentAssignment(assignments, c.id);
                const y = yearFromEnrollment(enrollmentByCourse.get(c.id), c);
                const deadlineLine = nearest?.deadline
                  ? t("teacherCourseCardDeadlineLine")
                      .replace("{when}", formatDueWhen(nearest.deadline, lang))
                      .replace("{title}", nearest.title)
                  : null;

                return (
                  <BlurFade key={c.id} delay={0.05 * idx}>
                    <div className="relative">
                      <div
                        className="w-full text-left rounded-2xl overflow-hidden card-glow-hover transition-transform hover:scale-[1.01] flex flex-col"
                        style={{ ...glassStyle }}
                      >
                        <button
                          type="button"
                          onClick={() => router.push(`/app/courses/${c.id}`)}
                          className="w-full text-left flex flex-col rounded-t-2xl overflow-hidden"
                        >
                          <div
                            className="h-[160px] w-full px-4 flex flex-col justify-center shrink-0 relative overflow-hidden"
                          >
                            {/* Background Image Banner */}
                            <div 
                              className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-110"
                              style={{ backgroundImage: `url(${getCourseBannerUrl(c)})` }}
                            />
                            {/* Overlay for contrast */}
                            <div className="absolute inset-0 bg-black/50" />

                            <div className="relative z-10 font-geologica font-bold text-white text-lg leading-tight line-clamp-2">
                              {getLocalizedCourseTitle(c, t)}
                            </div>
                            {y ? <div className="relative z-10 text-white/90 text-sm font-semibold mt-1">{y}</div> : null}
                          </div>
                        </button>
                        <div className="p-4 flex-1 flex flex-col gap-3 min-h-[100px]">
                          <button
                            type="button"
                            onClick={() => router.push(`/app/courses/${c.id}`)}
                            className="w-full text-left"
                          >
                            <p className="text-sm line-clamp-2 min-h-[2.5rem]" style={{ color: textColors.secondary }}>
                              {deadlineLine ?? t("teacherNoAssignments")}
                            </p>
                          </button>
                        </div>
                      </div>
                    </div>
                  </BlurFade>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
