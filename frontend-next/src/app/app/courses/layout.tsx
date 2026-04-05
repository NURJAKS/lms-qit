"use client";

import { useState, useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useAuthStore } from "@/store/authStore";
import { useLanguage } from "@/context/LanguageContext";
import type { TranslationKey } from "@/i18n/translations";
import { useTheme } from "@/context/ThemeContext";
import { getGlassCardStyle, getTextColors } from "@/utils/themeStyles";
import { ChevronDown, ChevronRight, Menu, X } from "lucide-react";
import type { Course } from "@/types";
import { getLocalizedCourseTitle } from "@/lib/courseUtils";

const GROUP_ACCENT_COLORS = [
  "#3B82F6", "#8B5CF6", "#10B981", "#F59E0B", "#EC4899", "#06B6D4", "#EF4444", "#14B8A6",
];

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

function SidebarContent({
  courses,
  enrollments,
  pathname,
  onNavigate,
  textColors,
  borderSubtle,
  t,
}: {
  courses: Course[];
  enrollments: Array<{ course_id: number; course: Course; enrolled_at?: string | null }>;
  pathname: string;
  onNavigate?: () => void;
  textColors: ReturnType<typeof getTextColors>;
  borderSubtle: string;
  t: (key: TranslationKey) => string;
}) {
  const [expanded, setExpanded] = useState(true);

  const enrollmentByCourse = useMemo(() => {
    const m = new Map<number, { enrolled_at?: string | null }>();
    enrollments.forEach((e) => {
      m.set(e.course_id, { enrolled_at: e.enrolled_at });
    });
    return m;
  }, [enrollments]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full px-3 py-2.5 rounded-xl text-left transition-colors hover:bg-black/5 dark:hover:bg-white/5"
        style={{ color: textColors.primary }}
      >
        <span className="font-medium text-sm font-geologica">{t("studentCoursesTabHint")}</span>
        {expanded ? <ChevronDown className="w-4 h-4 shrink-0 opacity-70" /> : <ChevronRight className="w-4 h-4 shrink-0 opacity-70" />}
      </button>

      {expanded && (
        <div className={`space-y-1 mt-2 pl-2 ml-1 border-l ${borderSubtle}`}>
          {courses.map((c, idx) => {
            const href = `/app/courses/${c.id}`;
            const active = pathname === href || pathname.startsWith(href + "/");
            const letter = (getLocalizedCourseTitle(c, t)?.trim()?.[0] || c.title?.trim()?.[0] || "?").toUpperCase();
            const color = GROUP_ACCENT_COLORS[idx % GROUP_ACCENT_COLORS.length];
            const y = yearFromEnrollment(enrollmentByCourse.get(c.id)?.enrolled_at, c);

            return (
              <Link
                key={c.id}
                href={href}
                onClick={onNavigate}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors ${
                  active ? "bg-blue-600 text-white shadow-md" : "hover:bg-black/5 dark:hover:bg-white/5"
                }`}
                style={!active ? { color: textColors.primary } : undefined}
              >
                <span
                  className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 text-white"
                  style={{ background: color }}
                >
                  {letter}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="font-semibold block truncate">{getLocalizedCourseTitle(c, t)}</span>
                  {y ? (
                    <span
                      className={`text-xs block ${active ? "text-white/85" : ""}`}
                      style={!active ? { color: textColors.secondary } : undefined}
                    >
                      {y}
                    </span>
                  ) : null}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function StudentCoursesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isTeacher } = useAuthStore();
  const { t } = useLanguage();
  const { theme } = useTheme();
  const glassStyle = getGlassCardStyle(theme);
  const textColors = getTextColors(theme);
  const [mobileOpen, setMobileOpen] = useState(false);

  const borderSubtle = theme === "dark" ? "border-white/12" : "border-black/10";
  const headerBorder = theme === "dark" ? "border-white/10" : "border-black/10";
  const asideBorder = theme === "dark" ? "border-white/10" : "border-black/10";

  useEffect(() => {
    if (user && isTeacher()) {
      router.replace("/app/teacher/courses");
    }
  }, [user, isTeacher, router]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const { data: enrollments = [] } = useQuery({
    queryKey: ["my-enrollments", user?.id],
    queryFn: async () => {
      const { data } = await api.get<Array<{ course_id: number; course: Course; enrolled_at?: string | null }>>("/courses/my/enrollments");
      return data;
    },
    enabled: user?.role === "student" && user?.id != null,
  });

  const courses = useMemo(
    () => enrollments.map((e) => e.course).filter((c): c is Course => !!c),
    [enrollments]
  );

  if (isTeacher()) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <div
        className={`lg:hidden flex items-center gap-3 px-4 py-3 border-b sticky top-0 z-30 backdrop-blur-md ${headerBorder}`}
        style={{ ...glassStyle }}
      >
        <button
          type="button"
          aria-label="Menu"
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
        >
          <Menu className="w-6 h-6" style={{ color: textColors.primary }} />
        </button>
        <span className="font-geologica font-semibold" style={{ color: textColors.primary }}>
          {t("teacherCoursesTab")}
        </span>
      </div>

      <aside
        className={`hidden lg:flex flex-col w-[280px] shrink-0 border-r min-h-screen p-4 overflow-y-auto ${asideBorder}`}
        style={{ ...glassStyle }}
      >
        <SidebarContent
          courses={courses}
          enrollments={enrollments}
          pathname={pathname}
          textColors={textColors}
          borderSubtle={borderSubtle}
          t={t}
        />
      </aside>

      {mobileOpen ? (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <button type="button" className="absolute inset-0 bg-black/50" aria-label="Close" onClick={() => setMobileOpen(false)} />
          <div
            className={`relative w-[280px] max-w-[85vw] h-full shadow-2xl flex flex-col p-4 border-r ${asideBorder} animate-in fade-in slide-in-from-left duration-200`}
            style={{ ...glassStyle }}
          >
            <div className="flex justify-end mb-2 shrink-0">
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" style={{ color: textColors.primary }} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 min-h-0">
              <SidebarContent
                courses={courses}
                enrollments={enrollments}
                pathname={pathname}
                onNavigate={() => setMobileOpen(false)}
                textColors={textColors}
                borderSubtle={borderSubtle}
                t={t}
              />
            </div>
          </div>
        </div>
      ) : null}

      <main className="flex-1 min-w-0 p-4 lg:p-8">{children}</main>
    </div>
  );
}
