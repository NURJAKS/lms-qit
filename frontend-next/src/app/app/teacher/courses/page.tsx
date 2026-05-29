"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient, useQueries } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useLanguage } from "@/context/LanguageContext";
import { formatWeekdayLongAndTime } from "@/utils/dateUtils";
import { useTheme } from "@/context/ThemeContext";
import { getGlassCardStyle, getTextColors, getInputStyle, getModalStyle } from "@/utils/themeStyles";
import { BlurFade } from "@/components/ui/blur-fade";
import { Plus, X, FileText, MoreVertical, Pencil, Trash2, Loader2, Edit2, AlertTriangle } from "lucide-react";
import { getCourseBannerUrl } from "@/lib/courseUtils";
import { useAuthStore } from "@/store/authStore";
import { DeleteConfirmButton } from "@/components/ui/DeleteConfirmButton";

type Group = {
  id: number;
  course_id: number;
  course_title: string;
  group_name: string;
  teacher_id: number;
  students_count: number;
  created_at: string | null;
};

type Assignment = {
  id: number;
  type: "assignment" | "material" | "question";
  group_id: number;
  title: string;
  deadline: string | null;
  is_closed: boolean;
};

function pickNearestDeadline(assignments: Assignment[]) {
  const now = Date.now();
  const candidates = assignments.filter((a) => a.type === "assignment" && a.deadline && !a.is_closed);
  if (candidates.length === 0) return null;
  const scored = candidates.map((a) => ({
    a,
    t: new Date(a.deadline!).getTime(),
  }));
  const upcoming = scored.filter((x) => x.t >= now).sort((x, y) => x.t - y.t);
  if (upcoming.length > 0) return upcoming[0].a;
  return scored.sort((x, y) => y.t - x.t)[0]?.a ?? null;
}

function yearFromCreated(s: string | null | undefined): string {
  if (!s) return "";
  try {
    return String(new Date(s).getFullYear());
  } catch {
    return "";
  }
}

export default function TeacherCoursesPage() {
  const router = useRouter();
  const { t, lang } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const queryClient = useQueryClient();
  const glassStyle = getGlassCardStyle(theme);
  const textColors = getTextColors(theme);
  const inputStyle = getInputStyle(theme);
  const modalStyle = getModalStyle(theme);

  const [modalOpen, setModalOpen] = useState(false);
  const [newCourseName, setNewCourseName] = useState("");
  const [newSection, setNewSection] = useState("");
  const [learningClasses, setLearningClasses] = useState("");
  const [subject, setSubject] = useState("");
  const [auditorium, setAuditorium] = useState("");
  const [newCourseId, setNewCourseId] = useState<number | "">("");
  const [activeTab, setActiveTab] = useState<"active" | "archive">("active");
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renamingGroup, setRenamingGroup] = useState<Group | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [menuOpenGroupId, setMenuOpenGroupId] = useState<number | null>(null);
  const { user, isTeacher } = useAuthStore();

  const { data: groups = [], isLoading: groupsLoading } = useQuery({
    queryKey: ["teacher-groups"],
    queryFn: async () => {
      const { data } = await api.get<Group[]>("/teacher/groups");
      return data;
    },
  });

  const assignmentQueries = useQueries({
    queries: groups.map((g) => ({
      queryKey: ["teacher-assignments", g.id],
      queryFn: async () => {
        const { data } = await api.get<Assignment[]>(`/teacher/assignments?group_id=${g.id}`);
        return data;
      },
      enabled: groups.length > 0,
    })),
  });

  const groupIdToAssignments = useMemo(() => {
    const map = new Map<number, Assignment[]>();
    groups.forEach((g, i) => {
      map.set(g.id, assignmentQueries[i]?.data ?? []);
    });
    return map;
  }, [groups, assignmentQueries]);

  const { data: catalogCourses = [] } = useQuery({
    queryKey: ["courses-active"],
    queryFn: async () => {
      const { data } = await api.get<Array<{ id: number; title: string }>>("/courses?is_active=true");
      return data;
    },
    enabled: modalOpen,
  });

  const createGroupMutation = useMutation({
    mutationFn: async (body: { course_id: number; group_name: string }) => {
      await api.post("/teacher/groups", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-groups"] });
      setModalOpen(false);
      setNewCourseName("");
      setNewSection("");
      setLearningClasses("");
      setSubject("");
      setAuditorium("");
      setNewCourseId("");
    },
  });

  const handleCreate = () => {
    if (!newCourseName.trim() || !newCourseId) return;
    createGroupMutation.mutate({
      course_id: typeof newCourseId === "number" ? newCourseId : 1,
      group_name: newCourseName.trim()
    });
  };

  const deleteGroupMutation = useMutation({
    mutationFn: async (groupId: number) => {
      await api.delete(`/teacher/groups/${groupId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-groups"] });
    },
  });

  const renameGroupMutation = useMutation({
    mutationFn: async ({ id, group_name }: { id: number; group_name: string }) => {
      await api.patch(`/teacher/groups/${id}`, { group_name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-groups"] });
      setRenameModalOpen(false);
      setRenamingGroup(null);
      setRenameTitle("");
    },
  });

  return (
    <div className="relative max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-geologica" style={{ color: textColors.primary }}>
            {t("teacherCoursesTab")}
          </h1>
          <p className="text-sm mt-1" style={{ color: textColors.secondary }}>
            {t("teacherCoursesTabHint")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="p-3 rounded-2xl text-white shrink-0 card-glow-hover transition-transform hover:scale-[1.02]"
          style={{ background: "linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)" }}
          title={t("teacherCreateCourse")}
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-8 border-b" style={{ borderColor: theme === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)" }}>
        <button
          type="button"
          onClick={() => setActiveTab("active")}
          className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${activeTab === "active"
            ? "border-blue-600 text-blue-600"
            : "border-transparent opacity-80 hover:opacity-100"
            }`}
        >
          {t("teacherActiveCourses")} ({groups.length})
        </button>
      </div>

      {/* Active Courses Tab */}
      <div className="space-y-6">
        {(groupsLoading) ? (
          <p className="text-sm" style={{ color: textColors.secondary }}>
            {t("loading")}
          </p>
        ) : groups.length === 0 ? (
          <BlurFade>
            <div className="rounded-2xl p-8 text-center" style={{ ...glassStyle }}>
              <p style={{ color: textColors.primary }}>{t("teacherNoCourses")}</p>
            </div>
          </BlurFade>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {groups.map((g, idx) => {
              const assignments = groupIdToAssignments.get(g.id) ?? [];
              const nearest = pickNearestDeadline(assignments);
              const y = yearFromCreated(g.created_at);
              const deadlineLine = nearest?.deadline
                ? t("teacherCourseCardDeadlineLine")
                  .replace("{when}", formatWeekdayLongAndTime(nearest.deadline, lang, t))
                  .replace("{title}", nearest.title)
                : null;

              return (
                <BlurFade key={g.id} delay={0.05 * idx}>
                  <div className="relative">
                    <div
                      className="w-full text-left rounded-2xl card-glow-hover transition-transform hover:scale-[1.01] flex flex-col relative"
                      style={{ ...glassStyle }}
                    >
                      <button
                        type="button"
                        onClick={() => router.push(`/app/teacher/courses/${g.id}`)}
                        className="w-full text-left flex flex-col rounded-t-2xl overflow-hidden"
                      >
                        <div
                          className="h-[160px] w-full px-4 flex flex-col justify-center shrink-0 relative overflow-hidden"
                        >
                          {/* Background Image Banner */}
                          <div
                            className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-110"
                            style={{ backgroundImage: `url(${getCourseBannerUrl({ title: g.course_title })})` }}
                          />
                          {/* Overlay for contrast */}
                          <div className="absolute inset-0 bg-black/40" />

                          <div className="relative z-10 font-geologica font-bold text-white text-lg leading-tight line-clamp-2">{g.group_name}</div>
                          {y ? <div className="relative z-10 text-white/90 text-sm font-semibold mt-1">{y}</div> : null}
                        </div>
                      </button>

                      {/* Three dots menu - Moved outside overflow-hidden header */}
                      <div className="absolute top-2 right-2 z-30">
                        <div className="relative">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuOpenGroupId(menuOpenGroupId === g.id ? null : g.id);
                            }}
                            className="p-1.5 rounded-full bg-black/20 hover:bg-black/40 text-white transition-colors"
                          >
                            <MoreVertical className="w-5 h-5" />
                          </button>
                          
                          {menuOpenGroupId === g.id && (
                            <div 
                              className="absolute right-0 mt-2 w-48 rounded-xl py-2 z-50 shadow-2xl animate-in fade-in zoom-in-95 duration-200"
                              style={{ 
                                ...modalStyle,
                                border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.1)" 
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setRenamingGroup(g);
                                  setRenameTitle(g.group_name);
                                  setRenameModalOpen(true);
                                  setMenuOpenGroupId(null);
                                }}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                                style={{ color: textColors.primary }}
                              >
                                <Pencil className="w-4 h-4" style={{ color: textColors.secondary }} />
                                {t("edit")}
                              </button>
                              
                              {(user?.role === "admin" || g.teacher_id === user?.id) && (
                                <div className="px-1 pt-1 mt-1 border-t" style={{ borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }}>
                                  <DeleteConfirmButton
                                    onDelete={() => deleteGroupMutation.mutate(g.id)}
                                    isLoading={deleteGroupMutation.isPending && deleteGroupMutation.variables === g.id}
                                    variant="ghost"
                                    size="sm"
                                    className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-500/10 px-3 py-2.5 rounded-lg"
                                    text={t("delete")}
                                    title={`${t("teacherDeleteGroup")}: ${g.group_name}?`}
                                    description={t("confirmDelete")}
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Click outside to close menu overlay */}
                      {menuOpenGroupId === g.id && (
                        <div 
                          className="fixed inset-0 z-10" 
                          onClick={() => setMenuOpenGroupId(null)}
                        />
                      )}
                      <div className="p-4 flex-1 flex flex-col gap-3 min-h-[100px]">
                        <button
                          type="button"
                          onClick={() => router.push(`/app/teacher/courses/${g.id}`)}
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

      {modalOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <button type="button" className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setModalOpen(false)} aria-label={t("close")} />
          <div
            className="relative w-full max-w-md rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-200"
            style={{ ...modalStyle }}
          >
            <div className="flex justify-between items-start gap-4 mb-4">
              <h2 className="text-lg font-semibold font-geologica" style={{ color: textColors.primary }}>
                {t("teacherCreateCourse")}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10"
              >
                <X className="w-5 h-5" style={{ color: textColors.secondary }} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-1.5" style={{ color: textColors.secondary }}>
                  {t("teacherSelectCourse")}*
                </label>
                <select
                  className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                  style={{ ...inputStyle }}
                  value={newCourseId}
                  onChange={(e) => setNewCourseId(e.target.value ? Number(e.target.value) : "")}
                >
                  <option value="">{t("teacherSelectCoursePlaceholder")}</option>
                  {catalogCourses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm mb-1.5" style={{ color: textColors.secondary }}>
                  {t("teacherCourseName")}*
                </label>
                <input
                  type="text"
                  className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                  style={{ ...inputStyle }}
                  placeholder={t("teacherCourseNamePlace")}
                  value={newCourseName}
                  onChange={(e) => setNewCourseName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm mb-1.5" style={{ color: textColors.secondary }}>
                  {t("teacherCourseSection")}
                </label>
                <input
                  type="text"
                  className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                  style={{ ...inputStyle }}
                  value={newSection}
                  onChange={(e) => setNewSection(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm mb-1.5" style={{ color: textColors.secondary }}>
                  {t("teacherLearningClasses")}
                </label>
                <input
                  type="text"
                  className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                  style={{ ...inputStyle }}
                  value={learningClasses}
                  onChange={(e) => setLearningClasses(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm mb-1.5" style={{ color: textColors.secondary }}>
                  {t("teacherSubject")}
                </label>
                <input
                  type="text"
                  className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                  style={{ ...inputStyle }}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm mb-1.5" style={{ color: textColors.secondary }}>
                  {t("teacherAuditorium")}
                </label>
                <input
                  type="text"
                  className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                  style={{ ...inputStyle }}
                  value={auditorium}
                  onChange={(e) => setAuditorium(e.target.value)}
                />
              </div>
              <button
                type="button"
                disabled={createGroupMutation.isPending || !newCourseName.trim() || !newCourseId}
                onClick={handleCreate}
                className="w-full py-3 rounded-xl font-semibold text-white disabled:opacity-50 transition"
                style={{ background: "linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)" }}
              >
                {t("teacherCreate")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {renameModalOpen && renamingGroup && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <button type="button" className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setRenameModalOpen(false)} aria-label={t("close")} />
          <div
            className="relative w-full max-w-md rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-200"
            style={{ ...modalStyle }}
          >
            <div className="flex justify-between items-start gap-4 mb-4">
              <h2 className="text-lg font-semibold font-geologica" style={{ color: textColors.primary }}>
                {t("teacherRenameCourseTitle")}
              </h2>
              <button
                type="button"
                onClick={() => setRenameModalOpen(false)}
                className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10"
              >
                <X className="w-5 h-5" style={{ color: textColors.secondary }} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-1.5" style={{ color: textColors.secondary }}>
                  {t("teacherCourseName")}*
                </label>
                <input
                  type="text"
                  className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                  style={{ ...inputStyle }}
                  placeholder={t("teacherCourseNamePlace")}
                  value={renameTitle}
                  onChange={(e) => setRenameTitle(e.target.value)}
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setRenameModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors"
                  style={{
                    background: theme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)",
                    color: textColors.secondary,
                  }}
                >
                  {t("teacherCancel")}
                </button>
                <button
                  type="button"
                  disabled={renameGroupMutation.isPending || !renameTitle.trim() || renameTitle === renamingGroup.group_name}
                  onClick={() => renameGroupMutation.mutate({ id: renamingGroup.id, group_name: renameTitle.trim() })}
                  className="flex-1 py-2.5 rounded-xl text-white font-semibold text-sm disabled:opacity-50 transition-all hover:shadow-lg"
                  style={{ background: "linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)" }}
                >
                  {renameGroupMutation.isPending ? t("teacherSaving") : t("teacherSave")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
