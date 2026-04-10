"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useLanguage } from "@/context/LanguageContext";
import type { Lang } from "@/i18n/translations";
import { useTheme } from "@/context/ThemeContext";
import { getGlassCardStyle, getTextColors } from "@/utils/themeStyles";
import { formatLocalizedDate } from "@/utils/dateUtils";
import { Loader2, MoreVertical, Clock, Filter, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { getLocalizedTopicTitle } from "@/lib/courseUtils";
import { toast, useNotificationStore } from "@/store/notificationStore";

type GbStudent = { id: number; full_name: string; email: string };
type GbAssignment = {
  id: number;
  title: string;
  topic_id?: number | null;
  topic_title?: string | null;
  deadline: string | null;
  max_points: number;
  created_at: string | null;
};
type GbCell = {
  submission_id: number | null;
  grade: number | null;
  submitted: boolean;
  graded: boolean;
  missing: boolean;
};
type GradebookPayload = {
  students: GbStudent[];
  assignments: GbAssignment[];
  cells: Record<string, GbCell>;
  column_averages: Record<string, number | null>;
  row_averages: Record<string, number | null>;
};



type SortStudents = "name" | "avg_high" | "avg_low";

export function TeacherGradebook({ groupId, topics = [] }: { groupId: number; topics?: { id: number; title: string }[] }) {
  const { t, lang } = useLanguage();
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const showConfirm = useNotificationStore((s) => s.showConfirm);
  const glassStyle = getGlassCardStyle(theme);
  const textColors = getTextColors(theme);
  const isDark = theme === "dark";
  const [sortStudents, setSortStudents] = useState<SortStudents>("name");
  const [topicFilter, setTopicFilter] = useState<"all" | number>("all");
  const [columnMenuId, setColumnMenuId] = useState<number | null>(null);
  const columnMenuRef = useRef<HTMLDivElement | null>(null);

  const { data, isPending, isError } = useQuery({
    queryKey: ["teacher-gradebook", groupId],
    queryFn: async () => {
      const { data: res } = await api.get<GradebookPayload>(`/teacher/groups/${groupId}/gradebook`);
      return res;
    },
    enabled: Number.isFinite(groupId) && groupId > 0,
  });

  useEffect(() => {
    if (columnMenuId == null) return;
    const handle = (e: MouseEvent) => {
      if (columnMenuRef.current && !columnMenuRef.current.contains(e.target as Node)) {
        setColumnMenuId(null);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [columnMenuId]);

  const deleteAssignmentMutation = useMutation({
    mutationFn: async (assignmentId: number) => {
      await api.delete(`/teacher/assignments/${assignmentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-gradebook", groupId] });
      queryClient.invalidateQueries({ queryKey: ["teacher-assignments", groupId] });
      queryClient.invalidateQueries({ queryKey: ["teacher-submissions-inbox"] });
      setColumnMenuId(null);
    },
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : t("teacherGradebookLoadError"));
    },
  });

  const markReviewedMutation = useMutation({
    mutationFn: async (assignmentId: number) => {
      await api.post(`/teacher/assignments/${assignmentId}/mark-reviewed`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-gradebook", groupId] });
      queryClient.invalidateQueries({ queryKey: ["teacher-submissions-inbox"] });
      setColumnMenuId(null);
    },
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : t("teacherGradebookLoadError"));
    },
  });

  const sortedStudents = useMemo(() => {
    const list = [...(data?.students ?? [])];
    if (sortStudents === "name") {
      list.sort((a, b) => ((a.full_name || a.email).toLowerCase() > (b.full_name || b.email).toLowerCase() ? 1 : -1));
      return list;
    }
    const rowAv = data?.row_averages ?? {};
    const rank = (id: number) => rowAv[String(id)];
    list.sort((a, b) => {
      const va = rank(a.id);
      const vb = rank(b.id);
      const na = va ?? -1;
      const nb = vb ?? -1;
      if (sortStudents === "avg_high") return nb - na;
      return na - nb;
    });
    return list;
  }, [data?.students, data?.row_averages, sortStudents]);

  const assignments = useMemo(() => {
    const list = data?.assignments ?? [];
    if (topicFilter === "all") return list;
    return list.filter((a) => a.topic_id === topicFilter);
  }, [data?.assignments, topicFilter]);

  const cells = data?.cells ?? {};
  const colAvg = data?.column_averages ?? {};
  const rowAvg = data?.row_averages ?? {};

  if (isPending) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-2xl" style={glassStyle}>
        <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-2xl p-8 text-center text-sm" style={{ ...glassStyle, color: textColors.secondary }}>
        {t("teacherGradebookLoadError")}
      </div>
    );
  }

  if (assignments.length === 0) {
    return (
      <div className="rounded-2xl p-10 text-center" style={glassStyle}>
        <p className="text-base font-medium" style={{ color: textColors.primary }}>
          {t("teacherGradebookNoAssignments")}
        </p>
        <p className="mt-2 text-sm" style={{ color: textColors.secondary }}>
          {t("teacherGradebookNoAssignmentsHint")}
        </p>
      </div>
    );
  }

  if (sortedStudents.length === 0) {
    return (
      <div className="rounded-2xl p-10 text-center" style={glassStyle}>
        <p className="text-base font-medium" style={{ color: textColors.primary }}>
          {t("teacherGradebookNoStudents")}
        </p>
        <p className="mt-2 text-sm" style={{ color: textColors.secondary }}>
          {t("gradesEmptyHint")}
        </p>
      </div>
    );
  }

  const border = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between px-1">
        <p className="hidden text-sm sm:block" style={{ color: textColors.secondary }}>
          {t("teacherGradebookHint")}
        </p>
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          <label className="flex items-center gap-2 text-xs sm:text-sm" style={{ color: textColors.primary }}>
            <Filter className="h-3.5 w-3.5 opacity-60 sm:hidden" />
            <span className="hidden shrink-0 opacity-80 sm:inline">{t("topicFilter")}</span>
            <select
              value={topicFilter === "all" ? "all" : topicFilter}
              onChange={(e) => setTopicFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
              className="max-w-[130px] truncate rounded-xl border px-2 py-1.5 text-xs outline-none sm:max-w-[200px] sm:px-3 sm:py-2 sm:text-sm"
              style={{
                borderColor: border,
                background: isDark ? "rgba(255,255,255,0.06)" : "#fff",
                color: textColors.primary,
              }}
            >
              <option value="all">{t("allTopics")}</option>
              {topics.map((tp) => (
                <option key={tp.id} value={tp.id}>
                  {tp.title}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs sm:text-sm" style={{ color: textColors.primary }}>
            <ArrowUpDown className="h-3.5 w-3.5 opacity-60 sm:hidden" />
            <span className="hidden shrink-0 opacity-80 sm:inline">{t("teacherAssignmentSortByEllipsis")}</span>
            <select
              value={sortStudents}
              onChange={(e) => setSortStudents(e.target.value as SortStudents)}
              className="max-w-[120px] truncate rounded-xl border px-2 py-1.5 text-xs outline-none sm:max-w-none sm:px-3 sm:py-2 sm:text-sm"
              style={{
                borderColor: border,
                background: isDark ? "rgba(255,255,255,0.06)" : "#fff",
                color: textColors.primary,
              }}
            >
              <option value="name">{t("teacherGradebookSortName")}</option>
              <option value="avg_high">{t("teacherGradebookSortAvgHigh")}</option>
              <option value="avg_low">{t("teacherGradebookSortAvgLow")}</option>
            </select>
          </label>
        </div>
      </div>

      <div
        className="overflow-auto rounded-2xl border max-h-[75vh] relative scrollbar-thin shadow-sm"
        style={{ ...glassStyle, borderColor: border }}
      >
        <p className="px-3 pt-3 text-[10px] sm:hidden" style={{ color: textColors.secondary }}>
          {"\u2194 "}{t("teacherGradebookHint")}
        </p>
        <table className="w-max min-w-full border-separate border-spacing-0 text-left text-xs sm:text-sm">
          <thead>
            <tr>
              <th
                className="sticky left-0 top-0 z-40 min-w-[100px] max-w-[100px] sm:min-w-[200px] sm:max-w-none truncate border-b px-2 sm:px-3 py-3 text-[10px] sm:text-xs font-semibold uppercase tracking-wide"
                style={{
                  background: isDark ? "rgb(30 41 59)" : "rgb(248 250 252)",
                  borderColor: border,
                  color: textColors.secondary,
                }}
              >
                {t("teacherGradebookStudentCol")}
              </th>
              {assignments.map((a) => (
                <th
                  key={a.id}
                  className="sticky top-0 z-30 min-w-[80px] sm:min-w-[160px] border-b px-2 py-3 align-bottom font-normal"
                  style={{
                    background: isDark ? "rgb(30 41 59)" : "rgb(248 250 252)",
                    borderColor: border,
                  }}
                >
                  <div
                    className="flex items-start justify-between gap-1"
                    ref={columnMenuId === a.id ? columnMenuRef : null}
                  >
                    <div className="min-w-0 flex-1">
                      {a.topic_title ? (
                        <p
                          className="mb-1 line-clamp-2 text-[10px] font-semibold uppercase tracking-wide opacity-80"
                          style={{ color: textColors.secondary }}
                          title={a.topic_title}
                        >
                          {getLocalizedTopicTitle(a.topic_title, t)}
                        </p>
                      ) : null}
                      <div className="text-[11px] font-medium opacity-80" style={{ color: textColors.secondary }}>
                        {a.deadline ? formatLocalizedDate(a.deadline, lang, t, { shortMonth: true }) : t("noDueDate")}
                      </div>
                      <Link
                        href={`/app/teacher/courses/${groupId}/assignment/${a.id}`}
                        className="mt-0.5 block text-left font-semibold leading-snug text-blue-600 hover:underline dark:text-blue-400 line-clamp-2"
                      >
                        {a.title}
                      </Link>
                      <div
                        className="mt-1 border-t pt-1 text-[11px] font-medium tabular-nums opacity-70"
                        style={{ borderColor: border, color: textColors.secondary }}
                      >
                        {t("teacherGradingRubricOutOf").replace("{max}", String(a.max_points))}
                      </div>
                    </div>
                    <div className="relative shrink-0 pt-0.5">
                      <button
                        type="button"
                        className="rounded-lg p-1 hover:bg-black/5 dark:hover:bg-white/10"
                        aria-label={t("teacherMoreOptions")}
                        aria-expanded={columnMenuId === a.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setColumnMenuId((id) => (id === a.id ? null : a.id));
                        }}
                      >
                        <MoreVertical className="h-4 w-4" style={{ color: textColors.secondary }} />
                      </button>
                      {columnMenuId === a.id ? (
                        <div
                          className="absolute right-0 top-full z-30 mt-1 min-w-[220px] rounded-xl border py-1 shadow-xl animate-in fade-in zoom-in-95 duration-100"
                          style={{ ...glassStyle, borderColor: border }}
                          role="menu"
                        >
                          <Link
                            href={`/app/teacher/courses/${groupId}/assignment/${a.id}?tab=instructions`}
                            className="block w-full px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"
                            style={{ color: textColors.primary }}
                            role="menuitem"
                            onClick={() => setColumnMenuId(null)}
                          >
                            {t("teacherGradebookColumnMenuEdit")}
                          </Link>
                          <button
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-500/10 dark:text-red-400"
                            role="menuitem"
                            disabled={deleteAssignmentMutation.isPending}
                            onClick={() => {
                              showConfirm({
                                title: t("delete"),
                                message: t("teacherGradebookDeleteConfirm").replace("{title}", a.title),
                                variant: "danger",
                                onConfirm: () => deleteAssignmentMutation.mutate(a.id),
                              });
                            }}
                          >
                            {t("teacherGradebookColumnMenuDelete")}
                          </button>
                          <Link
                            href={`/app/teacher/view-answers/${a.id}?tab=submissions`}
                            className="block w-full px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"
                            style={{ color: textColors.primary }}
                            role="menuitem"
                            onClick={() => setColumnMenuId(null)}
                          >
                            {t("teacherGradebookColumnMenuGradeAll")}
                          </Link>
                          <button
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"
                            style={{ color: textColors.primary }}
                            role="menuitem"
                            disabled={markReviewedMutation.isPending}
                            onClick={() => {
                              showConfirm({
                                title: t("teacherGradebookColumnMenuMarkReviewed"),
                                message: t("teacherGradebookMarkReviewedConfirm"),
                                onConfirm: () => markReviewedMutation.mutate(a.id),
                              });
                            }}
                          >
                            {t("teacherGradebookColumnMenuMarkReviewed")}
                          </button>
                          <button
                            type="button"
                            className="w-full cursor-not-allowed px-3 py-2 text-left text-sm opacity-40"
                            style={{ color: textColors.secondary }}
                            disabled
                            title={t("teacherGradebookColumnMenuReturnAllDisabled")}
                          >
                            {t("teacherGradebookColumnMenuReturnAll")}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </th>
              ))}
            </tr>
            <tr>
              <td
                className="sticky left-0 top-[60px] sm:top-[68px] z-40 min-w-[100px] max-w-[100px] sm:min-w-[200px] sm:max-w-none truncate border-b px-2 sm:px-3 py-2 text-[10px] sm:text-xs font-bold uppercase tracking-wide"
                style={{
                  background: isDark ? "rgb(30 41 59)" : "rgb(241 245 249)",
                  borderColor: border,
                  color: textColors.primary,
                }}
              >
                {t("teacherGradebookColAverage")}
              </td>
              {assignments.map((a) => {
                const v = colAvg[String(a.id)];
                return (
                  <td
                    key={a.id}
                    className="sticky top-[60px] sm:top-[68px] z-30 border-b px-2 py-2 text-center text-sm font-semibold tabular-nums"
                    style={{ 
                      background: isDark ? "rgb(30 41 59)" : "rgb(241 245 249)",
                      borderColor: border, 
                      color: textColors.primary 
                    }}
                  >
                    {v != null ? v : "—"}
                  </td>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sortedStudents.map((s) => (
              <tr key={s.id}>
                <td
                  className="sticky left-0 z-10 border-b px-2 sm:px-3 py-2.5 min-w-[100px] max-w-[100px] sm:min-w-[200px] sm:max-w-none"
                  style={{
                    background: isDark ? "rgb(15 23 42)" : "#fff",
                    borderColor: border,
                  }}
                >
                  <Link
                    href={`/app/profile/${s.id}`}
                    className="block font-medium hover:underline truncate max-w-[90px] sm:max-w-none text-xs sm:text-sm"
                    style={{ color: isDark ? "#93c5fd" : "#2563eb" }}
                  >
                    {s.full_name || s.email}
                  </Link>
                  <div className="text-[10px] sm:text-[11px] opacity-70 truncate max-w-[90px] sm:max-w-[200px]" style={{ color: textColors.secondary }}>
                    <span className="hidden sm:inline">{t("teacherGradebookStudentAvg")}: </span>
                    <span className="tabular-nums font-semibold">
                      {rowAvg[String(s.id)] != null ? rowAvg[String(s.id)] : "—"}
                    </span>
                  </div>
                </td>
                {assignments.map((a) => {
                  const cell = cells[`${s.id}_${a.id}`];
                  return (
                    <td
                      key={a.id}
                      className={cn(
                        "border-b px-2 py-2 text-center align-middle",
                        cell?.missing && "bg-red-50/40 dark:bg-red-950/20"
                      )}
                      style={{ borderColor: border }}
                    >
                      {cell?.graded && cell.grade != null ? (
                        <Link
                          href={`/app/teacher/view-answers/${a.id}?tab=submissions`}
                          className="inline-block font-semibold tabular-nums text-blue-600 hover:underline dark:text-blue-400"
                        >
                          {cell.grade}
                        </Link>
                      ) : cell?.submitted && !cell.graded ? (
                        <Link
                          href={`/app/teacher/view-answers/${a.id}?tab=submissions`}
                          className="flex justify-center text-amber-500 hover:text-amber-600 dark:text-amber-400"
                          title={t("teacherSubmissionStatusPending")}
                        >
                          <Clock className="h-4 w-4 sm:hidden" />
                          <span className="hidden text-xs font-semibold hover:underline sm:inline">
                            {t("teacherSubmissionStatusPending")}
                          </span>
                        </Link>
                      ) : (
                        <span 
                          className="text-xs font-medium opacity-60" 
                          style={{ color: textColors.secondary }}
                          title={t("teacherSubmissionStatusNotSubmitted")}
                        >
                          <span className="sm:hidden">—</span>
                          <span className="hidden sm:inline">{t("teacherSubmissionStatusNotSubmitted")}</span>
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
