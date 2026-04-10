"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { usePathname } from "next/navigation";
import type { Course, Test } from "@/types";
import { Pencil, Trash2, FileQuestion, ShieldCheck, Info, Plus } from "lucide-react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getGlassCardStyle, getModalStyle, getInputStyle, getTextColors } from "@/utils/themeStyles";
import { getLocalizedCourseTitle } from "@/lib/courseUtils";
import { BlurFade } from "@/components/ui/blur-fade";

export function CourseManagement() {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const textColors = getTextColors(theme);
  const glassStyle = getGlassCardStyle(theme);
  const modalStyle = getModalStyle(theme);
  const inputStyle = getInputStyle(theme);
  const pathname = usePathname();
  const { user } = useAuthStore();
  const canManageUsers = useAuthStore((s) => s.canManageUsers());
  const isCurator = user?.role === "curator";
  const [editing, setEditing] = useState<Course | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const queryClient = useQueryClient();
  
  // Определяем активную вкладку на основе пути
  const activeTab = pathname === "/app/admin/courses" ? "courses" : 
                    pathname.startsWith("/app/admin/courses/tests") ? "tests" :
                    pathname.startsWith("/app/admin/courses/moderation") ? "moderation" : "courses";

  const { data: courses = [] } = useQuery({
    queryKey: ["admin-courses"],
    queryFn: async () => {
      const { data } = await api.get<Course[]>("/admin/courses");
      return data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      body,
    }: {
      id: number;
      body: Partial<{
        title: string;
        description: string;
        is_active: boolean;
        price: number;
        published_at: string | null;
      }>;
    }) => {
      const { data } = await api.patch(`/admin/courses/${id}`, body);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-courses"] });
      setEditing(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/admin/courses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-courses"] });
      setDeleteConfirm(null);
    },
  });

  const createMutation = useMutation({
    mutationFn: async (body: {
      title: string;
      description?: string;
      is_active: boolean;
      price: number;
      is_premium_only?: boolean;
      language?: string;
    }) => {
      const { data } = await api.post("/admin/courses", body);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-courses"] });
      setCreating(false);
    },
  });

  return (
    <div className="w-full">
      <BlurFade delay={0.1} inView duration={0.6} blur="8px" offset={20}>
        <h1 className="text-3xl font-bold mb-6" style={{ color: textColors.primary }}>{t("adminCoursesTitle")}</h1>
      </BlurFade>
      {!canManageUsers && (
        <BlurFade delay={0.12} inView duration={0.6} blur="8px" offset={20}>
          <div
            className="rounded-xl p-4 border-l-4 flex items-start gap-3 mb-6"
            style={{
              ...glassStyle,
              borderLeftColor: "#F59E0B",
              background: isDark
                ? "rgba(245, 158, 11, 0.1)"
                : "rgba(245, 158, 11, 0.05)",
            }}
          >
            <Info className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "#F59E0B" }} />
            <div className="flex-1">
              <p className="font-semibold mb-1" style={{ color: textColors.primary }}>
                {t("curatorLimitedAccess")}
              </p>
              <p className="text-sm" style={{ color: textColors.secondary }}>
                {t("adminCuratorAccessInfo")}
              </p>
            </div>
          </div>
        </BlurFade>
      )}
      
      {/* Вкладки и кнопка создания */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 border-b pb-2 w-full" style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}>
        <div className="w-full overflow-x-auto">
          <div className="flex gap-2 min-w-max pr-1">
          <BlurFade delay={0.15} duration={0.4} blur="4px" offset={10}>
            <Link
              href="/app/admin/courses"
              className={`px-3 sm:px-4 py-2 font-medium rounded-lg transition-all whitespace-nowrap text-sm sm:text-base ${
                activeTab === "courses"
                  ? "text-white shadow-lg"
                  : isDark ? "text-white/70 hover:text-white hover:bg-white/10" : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              }`}
              style={activeTab === "courses" ? { background: "linear-gradient(135deg, #FF4181 0%, #B938EB 100%)", boxShadow: "0 0 12px rgba(255, 65, 129, 0.3)" } : undefined}
            >
              {t("adminNavCourses")}
            </Link>
          </BlurFade>
        <BlurFade delay={0.2} duration={0.4} blur="4px" offset={10}>
          <Link
            href="/app/admin/courses/tests"
            className={`px-3 sm:px-4 py-2 font-medium rounded-lg transition-all whitespace-nowrap text-sm sm:text-base ${
              activeTab === "tests"
                ? "text-white shadow-lg"
                : isDark ? "text-white/70 hover:text-white hover:bg-white/10" : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            }`}
            style={activeTab === "tests" ? { background: "linear-gradient(135deg, #FF4181 0%, #B938EB 100%)", boxShadow: "0 0 12px rgba(255, 65, 129, 0.3)" } : undefined}
          >
            {t("adminNavTests")}
          </Link>
        </BlurFade>
        <BlurFade delay={0.25} duration={0.4} blur="4px" offset={10}>
          <Link
            href="/app/admin/courses/moderation"
            className={`px-3 sm:px-4 py-2 font-medium rounded-lg transition-all whitespace-nowrap text-sm sm:text-base ${
              activeTab === "moderation"
                ? "text-white shadow-lg"
                : isDark ? "text-white/70 hover:text-white hover:bg-white/10" : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            }`}
            style={activeTab === "moderation" ? { background: "linear-gradient(135deg, #FF4181 0%, #B938EB 100%)", boxShadow: "0 0 12px rgba(255, 65, 129, 0.3)" } : undefined}
          >
            {t("adminNavModeration")}
          </Link>
        </BlurFade>
          </div>
        </div>
        {activeTab === "courses" && (
          <BlurFade delay={0.3} duration={0.4} blur="4px" offset={10}>
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 font-medium rounded-lg text-white shadow-lg transition-all hover:scale-105 whitespace-nowrap"
              style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", boxShadow: "0 0 12px rgba(16, 185, 129, 0.3)" }}
            >
              <Plus className="w-4 h-4" />
              {t("adminCreateCourse")}
            </button>
          </BlurFade>
        )}
      </div>

      {/* Контент вкладок */}
      {activeTab === "courses" && (
        <BlurFade delay={0.2} duration={0.5} blur="6px" offset={15} direction="up">
          <div className="rounded-2xl border-0 backdrop-blur-xl shadow-lg w-full p-6" style={glassStyle}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {courses.map((c, index) => (
                <BlurFade key={c.id} delay={0.25 + index * 0.05} duration={0.4} blur="4px" offset={12} direction="up">
                  <div 
                    className="rounded-xl p-5 transition-colors border backdrop-blur-sm card-hover-lift"
                    style={{ 
                      background: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.03)",
                      borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.08)"
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.03)"}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-sm font-medium opacity-60" style={{ color: textColors.primary }}>ID: {c.id}</span>
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                            c.is_active 
                              ? "bg-green-500/20 text-green-300 border-green-500/30" 
                              : "bg-gray-500/20 text-gray-300 border-gray-500/30"
                          }`}>
                            {c.is_active ? t("adminYes") : t("adminNo")}
                          </span>
                        </div>
                        <h3 className="font-semibold text-base mb-2 leading-tight" style={{ color: textColors.primary }}>
                          {getLocalizedCourseTitle(c, t)}
                        </h3>
                        <div className="flex items-center justify-between mt-3">
                          <span className="font-semibold text-lg" style={{ color: textColors.primary }}>
                            {Number(c.price)}₸
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setEditing(c)}
                              className="p-2 rounded-lg transition-colors hover:opacity-80"
                              style={{ color: "#8B5CF6", background: isDark ? "rgba(139, 92, 246, 0.1)" : "rgba(139, 92, 246, 0.05)" }}
                              title={t("adminEdit")}
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            {canManageUsers && (
                              <button
                                type="button"
                                onClick={() => setDeleteConfirm(c.id)}
                                className="p-2 rounded-lg transition-colors hover:opacity-80"
                                style={{ color: "#FF4181", background: isDark ? "rgba(255, 65, 129, 0.1)" : "rgba(255, 65, 129, 0.05)" }}
                                title={t("adminDelete")}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </BlurFade>
              ))}
            </div>
          </div>
        </BlurFade>
      )}

      {activeTab === "tests" && <TestsTabContent />}
      {activeTab === "moderation" && <ModerationTabContent />}

      {editing && (
        <CourseEditModal
          course={editing}
          onClose={() => setEditing(null)}
          onSave={(body) =>
            updateMutation.mutate({ id: editing.id, body })
          }
          isPending={updateMutation.isPending}
          t={t}
        />
      )}

      {creating && (
        <CourseCreateModal
          onClose={() => setCreating(false)}
          onSave={(body) => createMutation.mutate(body)}
          isPending={createMutation.isPending}
          t={t}
        />
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="rounded-xl shadow-xl p-6 max-w-md mx-4 border-0 backdrop-blur-xl" style={modalStyle}>
            <h3 className="font-semibold mb-2" style={{ color: textColors.primary }}>{t("adminCourseDelete")}</h3>
            <p className="mb-4" style={{ color: textColors.secondary }}>
              {t("adminCourseDeleteConfirm")}
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="py-2 px-4 rounded-lg hover:opacity-90"
                style={{ background: isDark ? "rgba(30, 41, 59, 0.7)" : "rgba(0, 0, 0, 0.05)", border: isDark ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(0, 0, 0, 0.12)", color: textColors.primary }}
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={() => deleteMutation.mutate(deleteConfirm)}
                disabled={deleteMutation.isPending}
                className="py-2 px-4 rounded-lg text-white hover:opacity-90"
                style={{ background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)" }}
              >
                {t("adminDelete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TestsTabContent() {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const glassStyle = getGlassCardStyle(theme);
  const textColors = getTextColors(theme);

  const { data: courses = [] } = useQuery({
    queryKey: ["admin-courses"],
    queryFn: async () => {
      const { data } = await api.get<Course[]>("/admin/courses");
      return data;
    },
  });

  const courseIds = courses.map((c) => c.id);
  const { data: testsByCourse } = useQuery({
    queryKey: ["admin-tests-by-course", courseIds],
    queryFn: async () => {
      const result: Record<number, Test[]> = {};
      await Promise.all(
        courseIds.map(async (courseId) => {
          const { data } = await api.get<Test[]>(`/admin/courses/${courseId}/tests`);
          result[courseId] = data;
        })
      );
      return result;
    },
    enabled: courseIds.length > 0,
  });

  return (
    <BlurFade delay={0.2} duration={0.5} blur="6px" offset={15} direction="up">
      <div className="rounded-2xl border-0 overflow-hidden backdrop-blur-xl shadow-lg p-4 sm:p-6" style={glassStyle}>
        <BlurFade delay={0.25} duration={0.4} blur="4px" offset={10}>
          <p className="mb-4 sm:mb-6 text-sm sm:text-base" style={{ color: textColors.secondary }}>
            {t("adminTestsGroupedByCourses")}
          </p>
        </BlurFade>
        <div className="space-y-3 sm:space-y-4">
          {courses.map((course, index) => {
            const tests = (testsByCourse?.[course.id] ?? []) as Test[];
            return (
              <BlurFade key={course.id} delay={0.3 + index * 0.08} duration={0.4} blur="4px" offset={12} direction="up">
                <div
                  className="rounded-xl border-0 overflow-hidden backdrop-blur-sm card-hover-lift"
                  style={glassStyle}
                >
              <Link
                href={`/app/admin/tests/${course.id}`}
                className="flex items-center justify-between p-3 sm:p-4 hover:opacity-80 transition-opacity"
              >
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold text-sm sm:text-base truncate" style={{ color: textColors.primary }}>
                    {getLocalizedCourseTitle(course, t)}
                  </h2>
                  <p className="text-xs sm:text-sm mt-0.5" style={{ color: textColors.secondary }}>
                    {tests.length} {tests.length === 1 ? t("testQuestion") : t("adminTestQuestions")}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 ml-2" style={{ color: textColors.secondary }} />
              </Link>
              {tests.length > 0 && (
                <div className="px-3 sm:px-4 py-2" style={{ borderTop: isDark ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(0, 0, 0, 0.08)", background: isDark ? "rgba(0, 0, 0, 0.2)" : "rgba(0, 0, 0, 0.02)" }}>
                  <ul className="space-y-1">
                    {tests.map((test) => (
                      <li key={test.id} className="text-xs sm:text-sm" style={{ color: textColors.secondary }}>
                        • {test.title} ({t("testsPassingScore")}: {test.passing_score}%, {t("testsQuestionCount")}: {test.question_count})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
                </div>
              </BlurFade>
            );
          })}
        </div>
      </div>
    </BlurFade>
  );
}

function ModerationTabContent() {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const glassStyle = getGlassCardStyle(theme);
  const textColors = getTextColors(theme);
  const queryClient = useQueryClient();

  interface UnmoderatedCourse {
    id: number;
    title: string;
    description: string | null;
    is_active: boolean;
  }

  const { data: courses = [] } = useQuery({
    queryKey: ["admin-moderation-courses"],
    queryFn: async () => {
      const { data } = await api.get<UnmoderatedCourse[]>("/admin/moderation/courses");
      return data;
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.patch(`/admin/courses/${id}`, { is_moderated: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-moderation-courses"] });
      queryClient.invalidateQueries({ queryKey: ["admin-courses"] });
    },
  });

  return (
    <BlurFade delay={0.2} duration={0.5} blur="6px" offset={15} direction="up">
      <div className="rounded-2xl border-0 overflow-hidden backdrop-blur-xl shadow-lg p-4 sm:p-6" style={glassStyle}>
        <BlurFade delay={0.25} duration={0.4} blur="4px" offset={10}>
          <p className="mb-4 sm:mb-6 text-sm sm:text-base" style={{ color: textColors.secondary }}>
            {t("adminModerationCoursesList")}
          </p>
        </BlurFade>
        {courses.length === 0 ? (
          <BlurFade delay={0.3} duration={0.4} blur="4px" offset={12}>
            <div className="rounded-2xl border-0 backdrop-blur-xl p-8 sm:p-16 text-center" style={glassStyle}>
          <div className="w-16 h-16 sm:w-24 sm:h-24 mx-auto mb-4 sm:mb-6 rounded-full flex items-center justify-center" style={{ background: "rgba(139, 92, 246, 0.2)" }}>
            <ShieldCheck className="w-8 h-8 sm:w-12 sm:h-12" style={{ color: "#8B5CF6" }} />
          </div>
          <h3 className="text-lg sm:text-xl font-semibold mb-2" style={{ color: textColors.primary }}>{t("adminNoCoursesForModeration")}</h3>
              <p className="text-sm sm:text-base" style={{ color: textColors.secondary }}>{t("adminAllCoursesModerated")}</p>
            </div>
          </BlurFade>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {courses.map((c, index) => (
              <BlurFade key={c.id} delay={0.3 + index * 0.08} duration={0.4} blur="4px" offset={12} direction="up">
                <div
                  className="rounded-2xl p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 border-0 backdrop-blur-sm transition-all duration-300 card-glow-hover card-hover-lift w-full"
                  style={glassStyle}
                >
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-base sm:text-lg mb-2 truncate" style={{ color: textColors.primary }}>
                  {getLocalizedCourseTitle(c as any, t)}
                </h3>
                <p className="text-xs sm:text-sm line-clamp-1 mb-2" style={{ color: textColors.secondary }}>
                  {c.description || "—"}
                </p>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <span className="text-xs" style={{ color: textColors.secondary }}>ID: {c.id}</span>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${
                    c.is_active 
                      ? "bg-green-500/20 text-green-300 border-green-500/30" 
                      : "bg-gray-500/20 text-gray-300 border-gray-500/30"
                  }`}>
                    {c.is_active ? t("adminActive") : t("adminInactive")}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => approveMutation.mutate(c.id)}
                disabled={approveMutation.isPending}
                className="py-2.5 sm:py-3 px-4 sm:px-6 rounded-xl text-white hover:opacity-90 disabled:opacity-50 shrink-0 transition-all font-medium shadow-lg text-sm sm:text-base w-full sm:w-auto"
                style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", boxShadow: "0 4px 14px rgba(16, 185, 129, 0.4)" }}
              >
                  {t("adminApprove")}
                </button>
                </div>
              </BlurFade>
            ))}
          </div>
        )}
      </div>
    </BlurFade>
  );
}

function CourseCreateModal({
  onClose,
  onSave,
  isPending,
  t,
}: {
  onClose: () => void;
  onSave: (body: {
    title: string;
    description?: string;
    is_active: boolean;
    price: number;
    is_premium_only?: boolean;
    language?: string;
  }) => void;
  isPending: boolean;
  t: (k: import("@/i18n/translations").TranslationKey) => string;
}) {
  const { theme } = useTheme();
  const modalStyle = getModalStyle(theme);
  const inputStyle = getInputStyle(theme);
  const textColors = getTextColors(theme);
  const isDark = theme === "dark";
  const [title, setTitle] = useState("");
  const [titleRu, setTitleRu] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [price, setPrice] = useState("0");
  const [isPremiumOnly, setIsPremiumOnly] = useState(false);
  const [language, setLanguage] = useState("kz");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const body: {
      title: string;
      title_ru?: string;
      title_en?: string;
      description?: string;
      is_active: boolean;
      price: number;
      is_premium_only?: boolean;
      language?: string;
    } = {
      title,
      is_active: isActive,
      price: Number(price) || 0,
    };
    if (titleRu.trim()) body.title_ru = titleRu.trim();
    if (titleEn.trim()) body.title_en = titleEn.trim();
    if (description.trim()) body.description = description.trim();
    if (isPremiumOnly) body.is_premium_only = true;
    if (language) body.language = language;
    onSave(body);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="rounded-xl shadow-xl p-4 sm:p-6 max-w-md mx-4 w-full border-0 backdrop-blur-xl max-h-[90vh] overflow-y-auto" style={modalStyle}>
        <h3 className="font-semibold mb-4 text-base sm:text-lg" style={{ color: textColors.primary }}>
          {t("adminCreateCourse")}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: textColors.secondary }}>
              {t("adminCoursesTitleLabel")} (KZ) *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg px-3 py-2"
              style={inputStyle}
              required
              placeholder={t("adminCoursePlaceholderKz")}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: textColors.secondary }}>
              {t("adminCoursesTitleLabel")} (RU)
            </label>
            <input
              type="text"
              value={titleRu}
              onChange={(e) => setTitleRu(e.target.value)}
              className="w-full rounded-lg px-3 py-2"
              style={inputStyle}
              placeholder={t("adminCoursePlaceholderRu")}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: textColors.secondary }}>
              {t("adminCoursesTitleLabel")} (EN)
            </label>
            <input
              type="text"
              value={titleEn}
              onChange={(e) => setTitleEn(e.target.value)}
              className="w-full rounded-lg px-3 py-2"
              style={inputStyle}
              placeholder={t("adminCoursePlaceholderEn")}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: textColors.secondary }}>
              {t("adminCoursesDescLabel")}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-lg px-3 py-2"
              style={inputStyle}
              placeholder={t("adminCoursesDescLabel")}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: textColors.secondary }}>
              {t("adminCoursesPriceLabel")}
            </label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              min={0}
              step={1}
              className="w-full rounded-lg px-3 py-2"
              style={inputStyle}
              placeholder={t("placeholderNumber")}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: textColors.secondary }}>
              {t("adminCoursesLanguageLabel")}
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full rounded-lg px-3 py-2"
              style={inputStyle}
            >
              <option value="kz">{t("kazakh")}</option>
              <option value="ru">{t("russian")}</option>
              <option value="en">{t("english")}</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active_create"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded"
            />
            <label
              htmlFor="is_active_create"
              className="text-sm font-medium"
              style={{ color: textColors.secondary }}
            >
              {t("adminCoursesActiveLabel")}
            </label>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_premium_only_create"
              checked={isPremiumOnly}
              onChange={(e) => setIsPremiumOnly(e.target.checked)}
              className="rounded"
            />
            <label
              htmlFor="is_premium_only_create"
              className="text-sm font-medium"
              style={{ color: textColors.secondary }}
            >
              {t("adminCoursesPremiumOnlyLabel")}
            </label>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-4 rounded-lg hover:opacity-90"
              style={{ background: isDark ? "rgba(30, 41, 59, 0.7)" : "rgba(0, 0, 0, 0.05)", border: isDark ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(0, 0, 0, 0.12)", color: textColors.primary }}
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={isPending || !title.trim()}
              className="py-2 px-4 rounded-lg text-white hover:opacity-90 disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)" }}
            >
              {isPending ? t("adminCourseCreating") : t("adminCreateCourse")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CourseEditModal({
  course,
  onClose,
  onSave,
  isPending,
  t,
}: {
  course: Course;
  onClose: () => void;
  onSave: (body: Partial<{
    title: string;
    description: string;
    is_active: boolean;
    price: number;
    published_at: string | null;
  }>) => void;
  isPending: boolean;
  t: (k: import("@/i18n/translations").TranslationKey) => string;
}) {
  const { theme } = useTheme();
  const modalStyle = getModalStyle(theme);
  const inputStyle = getInputStyle(theme);
  const textColors = getTextColors(theme);
  const isDark = theme === "dark";
  const [title, setTitle] = useState(course.title);
  const [titleRu, setTitleRu] = useState((course as any).title_ru || "");
  const [titleEn, setTitleEn] = useState((course as any).title_en || "");
  const [description, setDescription] = useState(course.description ?? "");
  const [isActive, setIsActive] = useState(course.is_active);
  const [price, setPrice] = useState(String(Number(course.price)));
  const [publishedAt, setPublishedAt] = useState(
    course.published_at ? course.published_at.slice(0, 16) : ""
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const body: Partial<{
      title: string;
      title_ru: string;
      title_en: string;
      description: string;
      is_active: boolean;
      price: number;
      published_at: string | null;
    }> = {};
    if (title !== course.title) body.title = title;
    if (titleRu !== ((course as any).title_ru || "")) body.title_ru = titleRu;
    if (titleEn !== ((course as any).title_en || "")) body.title_en = titleEn;
    if (description !== (course.description ?? "")) body.description = description;
    if (isActive !== course.is_active) body.is_active = isActive;
    const p = Number(price);
    if (!isNaN(p) && p !== Number(course.price)) body.price = p;
    if (publishedAt !== (course.published_at ? course.published_at.slice(0, 16) : ""))
      body.published_at = publishedAt ? `${publishedAt}:00Z` : null;
    if (Object.keys(body).length) onSave(body);
    else onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="rounded-xl shadow-xl p-4 sm:p-6 max-w-md mx-4 w-full border-0 backdrop-blur-xl max-h-[90vh] overflow-y-auto" style={modalStyle}>
        <h3 className="font-semibold mb-4 text-base sm:text-lg" style={{ color: textColors.primary }}>{t("adminCourseEdit")}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: textColors.secondary }}>
              {t("adminCoursesTitleLabel")} (KZ)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg px-3 py-2"
              style={inputStyle}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: textColors.secondary }}>
              {t("adminCoursesTitleLabel")} (RU)
            </label>
            <input
              type="text"
              value={titleRu}
              onChange={(e) => setTitleRu(e.target.value)}
              className="w-full rounded-lg px-3 py-2"
              style={inputStyle}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: textColors.secondary }}>
              {t("adminCoursesTitleLabel")} (EN)
            </label>
            <input
              type="text"
              value={titleEn}
              onChange={(e) => setTitleEn(e.target.value)}
              className="w-full rounded-lg px-3 py-2"
              style={inputStyle}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: textColors.secondary }}>
              {t("adminCoursesDescLabel")}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-lg px-3 py-2"
              style={inputStyle}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: textColors.secondary }}>
              {t("adminCoursesPriceLabel")}
            </label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              min={0}
              step={1}
              className="w-full rounded-lg px-3 py-2"
              style={inputStyle}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded"
            />
            <label
              htmlFor="is_active"
              className="text-sm font-medium"
              style={{ color: textColors.secondary }}
            >
              {t("adminCoursesActiveLabel")}
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: textColors.secondary }}>
              {t("adminCoursesPublishDate")}
            </label>
            <input
              type="datetime-local"
              value={publishedAt}
              onChange={(e) => setPublishedAt(e.target.value)}
              className="w-full rounded-lg px-3 py-2"
              style={inputStyle}
            />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-4 rounded-lg hover:opacity-90"
              style={{ background: isDark ? "rgba(30, 41, 59, 0.7)" : "rgba(0, 0, 0, 0.05)", border: isDark ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(0, 0, 0, 0.12)", color: textColors.primary }}
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="py-2 px-4 rounded-lg text-white hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #FF4181 0%, #B938EB 100%)" }}
            >
              {t("save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
