"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useLanguage } from "@/context/LanguageContext";
import type { Lang } from "@/i18n/translations";
import { useTheme } from "@/context/ThemeContext";
import { getGlassCardStyle, getTextColors } from "@/utils/themeStyles";
import { Loader2, MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { getLocalizedTopicTitle } from "@/lib/courseUtils";

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

function fmtDueShort(iso: string | null, lang: Lang): string {
  if (!iso) return "";
  const d = new Date(iso);
  const locale = lang === "kk" ? "kk-KZ" : lang === "en" ? "en-US" : "ru-RU";
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(d);
}

type SortStudents = "name" | "avg_high" | "avg_low";

export function TeacherGradebook({ groupId }: { groupId: number }) {
  const { t, lang } = useLanguage();
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const glassStyle = getGlassCardStyle(theme);
  const textColors = getTextColors(theme);
  const isDark = theme === "dark";
  const [sortStudents, setSortStudents] = useState<SortStudents>("name");
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
      if (typeof window !== "undefined") window.alert(typeof detail === "string" ? detail : t("teacherGradebookLoadError"));
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
      if (typeof window !== "undefined") window.alert(typeof detail === "string" ? detail : t("teacherGradebookLoadError"));
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

  const assignments = data?.assignments ?? [];
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm" style={{ color: textColors.secondary }}>
          {t("teacherGradebookHint")}
        </p>
        <label className="flex items-center gap-2 text-sm" style={{ color: textColors.primary }}>
          <span className="shrink-0 opacity-80">{t("teacherAssignmentSortByEllipsis")}</span>
          <select
            value={sortStudents}
            onChange={(e) => setSortStudents(e.target.value as SortStudents)}
            className="min-w-0 rounded-xl border px-3 py-2 text-sm outline-none sm:min-w-[200px]"
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

      <div
        className="overflow-x-auto rounded-2xl border"
        style={{ ...glassStyle, borderColor: border }}
      >
        <p className="px-3 pt-3 text-xs sm:hidden" style={{ color: textColors.secondary }}>
          {"\u2194 "}{t("teacherGradebookHint")}
        </p>
        <table className="w-max min-w-full border-collapse text-left text-sm">
          <thead>
            <tr>
              <th
                className="sticky left-0 z-20 min-w-[160px] sm:min-w-[200px] border-b px-3 py-3 text-xs font-semibold uppercase tracking-wide"
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
                  className="min-w-[140px] sm:min-w-[160px] border-b px-2 py-3 align-bottom font-normal"
                  style={{ borderColor: border }}
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
                        {a.deadline ? fmtDueShort(a.deadline, lang) : t("noDueDate")}
                      </div>
                      <Link
                        href={`/app/teacher/courses/${groupId}/assignment/${a.id}`}
                        className="mt-0.5 block text-left font-semibold leading-snug text-blue-600 hover:underline dark:text-blue-400"
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
                              if (
                                typeof window !== "undefined" &&
                                !window.confirm(t("teacherGradebookDeleteConfirm").replace("{title}", a.title))
                              ) {
                                return;
                              }
                              deleteAssignmentMutation.mutate(a.id);
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
                              if (
                                typeof window !== "undefined" &&
                                !window.confirm(t("teacherGradebookMarkReviewedConfirm"))
                              ) {
                                return;
                              }
                              markReviewedMutation.mutate(a.id);
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
                className="sticky left-0 z-20 border-b px-3 py-2 text-xs font-bold uppercase tracking-wide"
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
                    className="border-b px-2 py-2 text-center text-sm font-semibold tabular-nums"
                    style={{ borderColor: border, color: textColors.primary }}
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
                  className="sticky left-0 z-10 border-b px-3 py-2.5"
                  style={{
                    background: isDark ? "rgb(15 23 42)" : "#fff",
                    borderColor: border,
                  }}
                >
                  <Link
                    href={`/app/profile/${s.id}`}
                    className="font-medium hover:underline"
                    style={{ color: isDark ? "#93c5fd" : "#2563eb" }}
                  >
                    {s.full_name || s.email}
                  </Link>
                  <div className="text-[11px] opacity-70 truncate max-w-[200px]" style={{ color: textColors.secondary }}>
                    {t("teacherGradebookStudentAvg")}:{" "}
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
                          className="text-xs font-semibold text-amber-700 hover:underline dark:text-amber-400"
                        >
                          {t("teacherSubmissionStatusPending")}
                        </Link>
                      ) : (
                        <span className="text-xs font-medium opacity-60" style={{ color: textColors.secondary }}>
                          {t("teacherSubmissionStatusNotSubmitted")}
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
