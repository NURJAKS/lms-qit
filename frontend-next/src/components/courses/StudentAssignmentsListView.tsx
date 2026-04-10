"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useAuthStore } from "@/store/authStore";
import { useLanguage } from "@/context/LanguageContext";
import type { TranslationKey } from "@/i18n/translations";
import { useTheme } from "@/context/ThemeContext";
import { getTextColors } from "@/utils/themeStyles";
import {
  GraduationCap,
  ChevronRight,
  Loader2,
  Filter,
  Cat,
  Laptop,
  Dog,
  ChevronDown,
  Lock,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { BlurFade } from "@/components/ui/blur-fade";
import { formatLocalizedDate } from "@/utils/dateUtils";

export type StudentAssignmentRow = {
  id: number;
  title: string;
  course_id: number;
  course_title: string;
  deadline: string | null;
  submitted: boolean;
  grade: number | null;
  closed?: boolean;
  submitted_at?: string | null;
  max_points?: number;
  is_locked?: boolean;
};

type MainTabId = "appointed" | "missed" | "completed";

type TimeBucket = "no_due_date" | "this_week" | "next_week" | "later";

const TIME_BUCKET_ORDER: TimeBucket[] = ["no_due_date", "this_week", "next_week", "later"];

function startOfWeekMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function classifyByDeadline(deadline: string | null, nowMs: number): TimeBucket {
  if (!deadline) return "no_due_date";
  const dl = new Date(deadline).getTime();
  const now = new Date(nowMs);
  const thisWeekStart = startOfWeekMonday(now).getTime();
  const nextWeekStart = thisWeekStart + 7 * 24 * 60 * 60 * 1000;
  const laterStart = nextWeekStart + 7 * 24 * 60 * 60 * 1000;

  if (dl < nextWeekStart) return "this_week";
  if (dl < laterStart) return "next_week";
  return "later";
}

function classifyAppointed(a: StudentAssignmentRow, nowMs: number): TimeBucket {
  return classifyByDeadline(a.deadline, nowMs);
}

function classifyMissed(a: StudentAssignmentRow, nowMs: number): TimeBucket {
  if (!a.deadline) return "no_due_date";
  const dl = new Date(a.deadline).getTime();
  const now = new Date(nowMs);
  const thisWeekStart = startOfWeekMonday(now).getTime();
  const lastWeekStart = thisWeekStart - 7 * 24 * 60 * 60 * 1000;

  if (dl >= thisWeekStart) return "this_week";
  if (dl >= lastWeekStart) return "later";
  return "later";
}

function classifyCompleted(a: StudentAssignmentRow, nowMs: number): TimeBucket {
  return classifyByDeadline(a.deadline ?? null, nowMs);
}

function classifyForTab(a: StudentAssignmentRow, type: MainTabId, nowMs: number): TimeBucket {
  if (type === "appointed") return classifyAppointed(a, nowMs);
  if (type === "missed") return classifyMissed(a, nowMs);
  return classifyCompleted(a, nowMs);
}

function bucketLabel(bucket: string, t: (k: TranslationKey) => string): string {
  switch (bucket) {
    case "no_due_date":
      return t("studentAssignmentsSectionNoDue");
    case "this_week":
      return t("studentAssignmentsSectionThisWeek");
    case "next_week":
      return t("studentAssignmentsSectionNextWeek");
    case "later":
      return t("studentAssignmentsSectionLater");
    default:
      return bucket;
  }
}

function formatDoneGrade(a: StudentAssignmentRow, t: (k: TranslationKey) => string): string {
  const max = a.max_points ?? 100;
  if (a.grade != null && a.grade !== undefined && !Number.isNaN(Number(a.grade))) {
    const cur = Math.round(Number(a.grade));
    return t("assignmentGradeOutOf").replace("{current}", String(cur)).replace("{max}", String(max));
  }
  return t("submittedStatus");
}

function AssignmentRowLink({
  a,
  variant,
  formatDate,
  t,
  compact,
}: {
  a: StudentAssignmentRow;
  variant: "implement" | "missing" | "done";
  formatDate: (iso: string | null) => string;
  t: (k: TranslationKey) => string;
  compact?: boolean;
}) {
  const rightLabel =
    variant === "done"
      ? formatDoneGrade(a, t)
      : a.is_locked
        ? t("lockedWatchVideoFirst")
        : a.deadline
          ? `${t("dueDateShort")} ${formatDate(a.deadline)}`
          : formatDate(a.deadline);

  return (
    <Link
      href={a.is_locked ? "#" : `/app/courses/${a.course_id}?tab=classwork&assignmentId=${a.id}`}
      onClick={(e) => a.is_locked && e.preventDefault()}
      className={cn(
        "group block rounded-2xl border border-gray-200 bg-white transition-all active:scale-[0.99] card-glow-hover hover:shadow-md dark:border-gray-700 dark:bg-gray-800",
        compact ? "p-2.5" : "p-4",
        a.is_locked && "opacity-60 cursor-not-allowed"
      )}
    >
      <div className={cn("flex items-start", compact ? "gap-2" : "gap-4")}>
        <div className={cn(
          "flex shrink-0 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-900/20 transition-colors group-hover:bg-amber-100",
          compact ? "h-8 w-8" : "h-10 w-10",
          a.is_locked && "bg-gray-100 dark:bg-gray-800"
        )}>
          {a.is_locked ? (
            <Lock className={cn("text-gray-400", compact ? "h-4 w-4" : "h-5 w-5")} />
          ) : (
            <GraduationCap className={cn("text-amber-600", compact ? "h-4 w-4" : "h-5 w-5")} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className={cn(
            "truncate font-bold text-gray-900 transition-colors group-hover:text-blue-600 dark:text-white",
            compact ? "text-xs" : ""
          )}>
            {a.title}
          </h3>
          <p className={cn("mt-0.5 text-gray-500 dark:text-gray-400", compact ? "text-[10px]" : "text-xs")}>{a.course_title}</p>
        </div>
        {!compact && (
          <div className="shrink-0 text-right">
            <p
              className={cn(
                "text-xs font-bold",
                variant === "missing" ? "text-red-500" : "text-gray-500 dark:text-gray-400"
              )}
            >
              {rightLabel}
            </p>
            {variant === "missing" && (
              <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-red-500">
                {t("overdueTab")}
              </p>
            )}
          </div>
        )}
        {compact && variant === "missing" && (
          <div className="shrink-0">
             <div className="h-1.5 w-1.5 rounded-full bg-red-500 mt-1.5" />
          </div>
        )}
        {!compact && <ChevronRight className="mt-2 h-5 w-5 shrink-0 text-gray-300 transition-colors group-hover:text-gray-400" />}
      </div>
    </Link>
  );
}

function AssignmentsEmptyStateAssigned({
  t,
  textColors,
}: {
  t: (k: TranslationKey) => string;
  textColors: ReturnType<typeof getTextColors>;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-gray-200 py-16 text-center dark:border-gray-700">
      <div className="relative mb-6 flex h-36 w-full max-w-sm items-end justify-center gap-2">
        <Cat className="h-24 w-24 text-gray-300 dark:text-gray-600" strokeWidth={1.25} aria-hidden />
        <Laptop className="mb-1 h-16 w-16 text-gray-200 dark:text-gray-700" strokeWidth={1.25} aria-hidden />
      </div>
      <p className="text-lg font-semibold" style={{ color: textColors.primary }}>
        {t("studentAssignmentsEmptyTitle")}
      </p>
      <p className="mt-2 max-w-sm text-sm" style={{ color: textColors.secondary }}>
        {t("studentAssignmentsEmptyHint")}
      </p>
    </div>
  );
}

function AssignmentsEmptyStateNoOverdue({
  t,
  textColors,
}: {
  t: (k: TranslationKey) => string;
  textColors: ReturnType<typeof getTextColors>;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-gray-200 py-16 text-center dark:border-gray-700">
      <div className="relative mb-6 flex h-36 w-full max-w-sm items-center justify-center">
        <Dog className="h-28 w-28 text-gray-300 dark:text-gray-600" strokeWidth={1.15} aria-hidden />
      </div>
      <p className="text-lg font-semibold" style={{ color: textColors.primary }}>
        {t("studentAssignmentsEmptyNoOverdueTitle")}
      </p>
      <p className="mt-2 max-w-md text-sm" style={{ color: textColors.secondary }}>
        {t("studentAssignmentsEmptyNoOverdueHint")}
      </p>
    </div>
  );
}

function AssignmentsGrouped({
  list,
  type,
  t,
  formatDate,
  compact,
}: {
  list: StudentAssignmentRow[];
  type: MainTabId;
  t: (k: TranslationKey) => string;
  formatDate: (iso: string | null) => string;
  compact?: boolean;
}) {
  const order = TIME_BUCKET_ORDER;
  
  const grouped = useMemo(() => {
    const nowMs = Date.now();
    const buckets: Record<string, StudentAssignmentRow[]> = {};
    order.forEach(b => buckets[b] = []);
    
    for (const a of list) {
      const b = classifyForTab(a, type, nowMs);
      if (buckets[b]) buckets[b].push(a);
      else buckets["later"]?.push(a);
    }
    return buckets;
  }, [list, type, order]);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    order.forEach(b => init[b] = false);
    const first = order.find((b) => grouped[b]?.length > 0);
    if (first) init[first] = true;
    return init;
  });

  useEffect(() => {
    const first = order.find((b) => grouped[b]?.length > 0);
    setOpenSections(() => {
      const next: Record<string, boolean> = {};
      order.forEach(b => next[b] = false);
      if (first) next[first] = true;
      return next;
    });
  }, [grouped, order]);

  const toggle = (b: string) => {
    setOpenSections((prev) => ({ ...prev, [b]: !prev[b] }));
  };

  return (
    <div className="space-y-2">
      {order.map((bucket) => {
        const items = grouped[bucket];
        const open = openSections[bucket];
        return (
          <div
            key={bucket}
            className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
          >
            <button
              type="button"
              onClick={() => toggle(bucket)}
              className={cn(
                "flex w-full items-center justify-between gap-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50",
                compact ? "px-3 py-2" : "px-4 py-3"
              )}
            >
              <span className={cn("font-semibold text-gray-900 dark:text-white", compact ? "text-xs" : "")}>{bucketLabel(bucket, t)}</span>
              <span className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <span className={cn("tabular-nums", compact ? "text-[10px]" : "")}>{items.length}</span>
                <ChevronDown
                  className={cn("shrink-0 transition-transform", compact ? "h-3 w-3" : "h-5 w-5", open ? "rotate-180" : "rotate-0")}
                />
              </span>
            </button>
            {open && items.length > 0 ? (
              <div className={cn("border-t border-gray-100 pt-2 dark:border-gray-600", compact ? "px-1.5 pb-2 space-y-1.5" : "px-3 pb-3 space-y-2")}>
                {items.map((a) => (
                  <BlurFade key={a.id} delay={0.03}>
                    <AssignmentRowLink a={a} variant={type === "appointed" ? "implement" : type === "missed" ? "missing" : "done"} formatDate={formatDate} t={t} compact={compact} />
                  </BlurFade>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

type StudentAssignmentsListViewProps = {
  fixedCourseId?: number;
  embedded?: boolean;
  compact?: boolean;
};

export function StudentAssignmentsListView({ fixedCourseId, embedded, compact }: StudentAssignmentsListViewProps) {
  const { t, lang } = useLanguage();
  const { user } = useAuthStore();
  const userId = user?.id;
  const { theme } = useTheme();
  const textColors = getTextColors(theme);

  const [activeTab, setActiveTab] = useState<MainTabId>("appointed");
  const [courseFilter, setCourseFilter] = useState<number | "all">(
    fixedCourseId != null ? fixedCourseId : "all"
  );

  const { data: assignments = [], isPending: assignmentsPending } = useQuery({
    queryKey: ["my-assignments"],
    queryFn: async () => {
      const { data } = await api.get<StudentAssignmentRow[]>("/assignments/my");
      return data;
    },
  });

  const currentCourseAssignments = useMemo(() => {
    if (fixedCourseId == null) return assignments;
    return assignments.filter(a => a.course_id === fixedCourseId);
  }, [assignments, fixedCourseId]);

  const courses = useMemo(() => {
    const map = new Map<number, string>();
    assignments.forEach((a) => map.set(a.course_id, a.course_title));
    return Array.from(map.entries()).map(([id, title]) => ({ id, title }));
  }, [assignments]);

  const effectiveFilter = fixedCourseId != null ? fixedCourseId : courseFilter;

  const implementList = useMemo(() => {
    const now = Date.now();
    return currentCourseAssignments.filter((a) => {
      if (effectiveFilter !== "all" && a.course_id !== effectiveFilter) return false;
      if (a.submitted || a.grade !== null) return false;
      if (a.closed) return false;
      const isOverdue = a.deadline && new Date(a.deadline).getTime() < now;
      if (isOverdue) return false;
      return true;
    });
  }, [currentCourseAssignments, effectiveFilter]);

  const missingList = useMemo(() => {
    const now = Date.now();
    return currentCourseAssignments.filter((a) => {
      if (effectiveFilter !== "all" && a.course_id !== effectiveFilter) return false;
      if (a.submitted || a.grade !== null) return false;
      const isOverdue = a.deadline && new Date(a.deadline).getTime() < now;
      return Boolean(isOverdue);
    });
  }, [currentCourseAssignments, effectiveFilter]);

  const doneList = useMemo(() => {
    return currentCourseAssignments.filter((a) => {
      if (effectiveFilter !== "all" && a.course_id !== effectiveFilter) return false;
      return a.submitted || a.grade !== null;
    });
  }, [currentCourseAssignments, effectiveFilter]);

  const formatDate = (iso: string | null) => {
    if (!iso) return t("noDueDate");
    return formatLocalizedDate(iso, lang, t, {
      shortMonth: true,
      includeTime: !compact,
    });
  };

  const tabBorder = theme === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)";

  const loading = assignmentsPending;

  const wrapperClass = compact ? "relative w-full" : embedded ? "relative w-full" : "relative mx-auto max-w-6xl px-4 py-8";

  const showTopBar = !compact && (!embedded || fixedCourseId == null);

  const renderListBody = () => {
    if (loading) {
      return (
        <div className={cn("flex justify-center", compact ? "py-4" : "py-20")}>
          <Loader2 className={cn("animate-spin text-blue-600", compact ? "h-6 w-6" : "h-10 w-10")} />
        </div>
      );
    }

    if (activeTab === "appointed") {
      if (implementList.length === 0) {
        return compact ? (
          <p className="text-xs text-center py-4 opacity-60" style={{ color: textColors.secondary }}>
            {t("studentAssignmentsEmptyTitle")}
          </p>
        ) : (
          <AssignmentsEmptyStateAssigned t={t} textColors={textColors} />
        );
      }
      return <AssignmentsGrouped list={implementList} type="appointed" t={t} formatDate={formatDate} compact={compact} />;
    }

    if (activeTab === "missed") {
      if (missingList.length === 0) {
        return compact ? (
          <p className="text-xs text-center py-4 opacity-60" style={{ color: textColors.secondary }}>
            {t("studentAssignmentsEmptyNoOverdueTitle")}
          </p>
        ) : (
          <AssignmentsEmptyStateNoOverdue t={t} textColors={textColors} />
        );
      }
      return <AssignmentsGrouped list={missingList} type="missed" t={t} formatDate={formatDate} compact={compact} />;
    }

    if (doneList.length === 0) {
      return compact ? (
        <p className="text-xs text-center py-4 opacity-60" style={{ color: textColors.secondary }}>
          {t("studentAssignmentsEmptyTitle")}
        </p>
      ) : (
        <AssignmentsEmptyStateAssigned t={t} textColors={textColors} />
      );
    }
    return <AssignmentsGrouped list={doneList} type="completed" t={t} formatDate={formatDate} compact={compact} />;
  };

  return (
    <div className={wrapperClass}>
      {showTopBar && (
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          {!embedded && (
            <div>
              <h1 className="font-geologica text-2xl font-bold sm:text-3xl" style={{ color: textColors.primary }}>
                {t("assignmentsList")}
              </h1>
              <p className="mt-1 text-sm" style={{ color: textColors.secondary }}>
                {t("studentTodoPageSubtitle")}
              </p>
            </div>
          )}
          {fixedCourseId == null && (
            <div className="relative min-w-0 max-w-full">
              <div className="mb-1 pl-1 text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">{t("courseFilter")}</div>
              <div className="group relative flex shrink-0 items-center gap-2 self-start rounded-xl border border-gray-200 bg-white p-1.5 pr-3 shadow-sm transition-all hover:border-blue-300 dark:border-white/10 dark:bg-white/5 dark:hover:border-blue-500">
                <Filter className="ml-2 h-4 w-4 shrink-0 text-gray-400 group-hover:text-blue-500 transition-colors" />
                <select
                  value={courseFilter === "all" ? "all" : String(courseFilter)}
                  onChange={(e) => setCourseFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
                  className="min-w-[140px] bg-transparent text-sm font-bold text-gray-700 focus:outline-none dark:text-gray-200"
                >
                  <option value="all" className="dark:bg-gray-900">{t("allCourses")}</option>
                  {courses.map((c) => (
                    <option key={c.id} value={String(c.id)} className="dark:bg-gray-900">
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      )}

      <div className={cn("flex flex-wrap border-b border-gray-200 dark:border-gray-600", compact ? "mb-4 gap-2" : "mb-8 gap-4")} style={{ borderColor: tabBorder }}>
        {(
          [
            { id: "appointed" as const, label: t("assignedTab") },
            { id: "missed" as const, label: t("overdueTab") },
            { id: "completed" as const, label: t("completedTab") },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "border-b-2 px-1 pb-2 transition-colors",
              compact ? "text-[11px] font-semibold" : "text-sm font-medium pb-3",
              activeTab === tab.id
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-600 opacity-80 hover:opacity-100 dark:text-gray-400"
            )}
            style={activeTab !== tab.id ? { color: textColors.secondary } : undefined}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {renderListBody()}
    </div>
  );
}
