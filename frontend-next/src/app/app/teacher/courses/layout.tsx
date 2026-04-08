"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useAuthStore } from "@/store/authStore";
import { useLanguage } from "@/context/LanguageContext";
import type { TranslationKey } from "@/i18n/translations";
import { useTheme } from "@/context/ThemeContext";
import { getGlassCardStyle, getTextColors } from "@/utils/themeStyles";
import { FileText, ChevronDown, ChevronRight, Menu, X } from "lucide-react";

type Group = {
  id: number;
  course_id: number;
  course_title: string;
  group_name: string;
  teacher_id: number;
  students_count: number;
  created_at: string | null;
};

const GROUP_ACCENT_COLORS = [
  "#3B82F6", "#8B5CF6", "#10B981", "#F59E0B", "#EC4899", "#06B6D4", "#EF4444", "#14B8A6",
];

function SidebarContent({
  groups,
  pathname,
  onNavigate,
  textColors,
  borderSubtle,
  t,
}: {
  groups: Group[];
  pathname: string;
  onNavigate?: () => void;
  textColors: ReturnType<typeof getTextColors>;
  borderSubtle: string;
  t: (key: TranslationKey) => string;
}) {
  const [expanded, setExpanded] = useState(true);

  const reviewActive =
    pathname === "/app/teacher/courses/review" || pathname.startsWith("/app/teacher/courses/review/");

  return (
    <div className="flex flex-col h-full min-h-0">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full px-3 py-2.5 rounded-xl text-left transition-colors hover:bg-black/5 dark:hover:bg-white/5"
        style={{ color: textColors.primary }}
      >
        <span className="font-medium text-sm font-geologica">{t("teacherCoursesTabHint")}</span>
        {expanded ? <ChevronDown className="w-4 h-4 shrink-0 opacity-70" /> : <ChevronRight className="w-4 h-4 shrink-0 opacity-70" />}
      </button>

      {expanded && (
        <div className={`space-y-1 mt-2 pl-2 ml-1 border-l ${borderSubtle}`}>
          <Link
            href="/app/teacher/courses/review"
            onClick={onNavigate}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors ${
              reviewActive ? "bg-blue-600 text-white shadow-md" : "hover:bg-black/5 dark:hover:bg-white/5"
            }`}
            style={!reviewActive ? { color: textColors.primary } : undefined}
          >
            <FileText className="w-4 h-4 shrink-0" />
            {t("unreviewedAssignments")}
          </Link>

          {groups.map((g) => {
            const href = `/app/teacher/courses/${g.id}`;
            const active = pathname === href;
            const letter = (g.group_name?.trim()[0] || "?").toUpperCase();
            const color = GROUP_ACCENT_COLORS[Math.abs(g.id) % GROUP_ACCENT_COLORS.length];
            const year = g.created_at ? new Date(g.created_at).getFullYear() : "";

            return (
              <Link
                key={g.id}
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
                  <span className="font-semibold block truncate">{g.group_name}</span>
                  {year ? (
                    <span
                      className={`text-xs block ${active ? "text-white/85" : ""}`}
                      style={!active ? { color: textColors.secondary } : undefined}
                    >
                      {year}
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

export default function TeacherCoursesLayout({ children }: { children: React.ReactNode }) {
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
    if (user && !isTeacher()) {
      router.replace("/app");
    }
  }, [user, isTeacher, router]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const { data: groups = [] } = useQuery({
    queryKey: ["teacher-groups"],
    queryFn: async () => {
      const { data } = await api.get<Group[]>("/teacher/groups");
      return data;
    },
  });

  return (
    <div className="min-h-screen w-full max-w-full min-w-0 flex flex-col overflow-x-hidden lg:flex-row">
      <div
        className={`lg:hidden mb-3 flex items-center gap-3 rounded-xl border px-4 py-3 ${headerBorder}`}
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
        <SidebarContent groups={groups} pathname={pathname} textColors={textColors} borderSubtle={borderSubtle} t={t} />
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
                groups={groups}
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

      <main className="flex-1 min-w-0 overflow-x-hidden p-4 lg:p-8">{children}</main>
    </div>
  );
}
