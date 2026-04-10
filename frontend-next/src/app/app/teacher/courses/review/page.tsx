"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useLanguage } from "@/context/LanguageContext";
import type { Lang } from "@/i18n/translations";
import { useTheme } from "@/context/ThemeContext";
import { getGlassCardStyle, getTextColors, getInputStyle } from "@/utils/themeStyles";
import { BlurFade } from "@/components/ui/blur-fade";
import { FileText, ChevronDown, ChevronRight, MoreVertical } from "lucide-react";
import { formatLocalizedDate } from "@/utils/dateUtils";


type InboxItem = {
  id: number;
  title: string;
  group_id: number;
  group_name: string;
  course_id: number;
  course_title: string;
  deadline: string | null;
  created_at: string | null;
  submitted_count: number;
  total_students: number;
  graded_count: number;
};

type Group = {
  id: number;
  group_name: string;
  course_id: number;
};

// formatDeadlineRow removed, using formatLocalizedDate directly


type TabKey = "pending" | "graded";

export default function TeacherCoursesReviewPage() {
  const router = useRouter();
  const { t, lang } = useLanguage();
  const queryClient = useQueryClient();
  const { theme } = useTheme();
  const glassStyle = getGlassCardStyle(theme);
  const textColors = getTextColors(theme);
  const inputStyle = getInputStyle(theme);

  const [tab, setTab] = useState<TabKey>("pending");
  const [groupFilter, setGroupFilter] = useState<number | "">("");
  const [openNoDue, setOpenNoDue] = useState(true);
  const [openDue, setOpenDue] = useState(true);
  const [activeMenu, setActiveMenu] = useState<number | null>(null);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const { data: groups = [] } = useQuery({
    queryKey: ["teacher-groups"],
    queryFn: async () => {
      const { data } = await api.get<Group[]>("/teacher/groups");
      return data;
    },
  });

  const status = tab === "pending" ? "pending" : "graded";

  const { data: inbox = [], isLoading, refetch } = useQuery({
    queryKey: ["teacher-submissions-inbox", status, groupFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("status", status);
      if (groupFilter !== "") params.set("group_id", String(groupFilter));
      const { data } = await api.get<InboxItem[]>(`/teacher/submissions/inbox?${params.toString()}`);
      return data;
    },
  });

  const markAsReviewed = async (assignmentId: number) => {
    try {
      setProcessingId(assignmentId);
      await api.post(`/teacher/assignments/${assignmentId}/mark-reviewed`);
      queryClient.setQueryData<InboxItem[]>(
        ["teacher-submissions-inbox", "pending", groupFilter],
        (prev = []) => prev.filter((x) => x.id !== assignmentId)
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["teacher-submissions-inbox", "pending", groupFilter] }),
        queryClient.invalidateQueries({ queryKey: ["teacher-submissions-inbox", "graded", groupFilter] }),
      ]);
      await refetch();
    } catch (error) {
      console.error("Failed to mark as reviewed:", error);
    } finally {
      setProcessingId(null);
    }
  };

  const markAsUnreviewed = async (assignmentId: number) => {
    try {
      setProcessingId(assignmentId);
      await api.post(`/teacher/assignments/${assignmentId}/unmark-reviewed`);
      queryClient.setQueryData<InboxItem[]>(
        ["teacher-submissions-inbox", "graded", groupFilter],
        (prev = []) => prev.filter((x) => x.id !== assignmentId)
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["teacher-submissions-inbox", "pending", groupFilter] }),
        queryClient.invalidateQueries({ queryKey: ["teacher-submissions-inbox", "graded", groupFilter] }),
      ]);
      await refetch();
    } catch (error) {
      console.error("Failed to mark as unreviewed:", error);
    } finally {
      setProcessingId(null);
    }
  };

  const noDeadlineItems = inbox.filter((x) => x.deadline === null);
  const withDeadlineItems = inbox.filter((x) => x.deadline !== null);

  const groupItemsByDate = (items: InboxItem[]) => {
    const groups: { [key: string]: InboxItem[] } = {};
    items.forEach((item) => {
      if (!item.deadline) return;
      const dateKey = formatLocalizedDate(item.deadline, lang, t);

      const key = `${t("teacherDueDateRowLabel")}: ${dateKey}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return groups;
  };

  const groupedWithDeadline = groupItemsByDate(withDeadlineItems);

  const renderSection = (title: string, items: InboxItem[], open: boolean, setOpen: (v: boolean) => void) => (
    <div className="rounded-2xl mb-4" style={{ ...glassStyle }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors rounded-t-2xl"
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold font-geologica" style={{ color: textColors.primary }}>
            {title}
          </span>
          <span
            className="text-xs font-medium px-2 py-0.5 rounded-full"
            style={{
              background: theme === "dark" ? "rgba(59,130,246,0.2)" : "rgba(59,130,246,0.12)",
              color: theme === "dark" ? "#93C5FD" : "#1D4ED8",
            }}
          >
            {items.length}
          </span>
        </div>
        {open ? <ChevronDown className="w-5 h-5 opacity-70" /> : <ChevronRight className="w-5 h-5 opacity-70" />}
      </button>
      {open ? (
        <ul className="divide-y divide-black/5 dark:divide-white/10">
          {items.map((item) => (
            <li
              key={item.id}
              className={`relative group/row transition-all duration-300 ${
                processingId === item.id ? "opacity-50 pointer-events-none scale-[0.98]" : "opacity-100"
              }`}
            >
              <div
                role="button"
                tabIndex={0}
                onClick={() => router.push(`/app/teacher/courses/${item.group_id}/assignment/${item.id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    router.push(`/app/teacher/courses/${item.group_id}/assignment/${item.id}`);
                  }
                }}
                className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 cursor-pointer hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors"
              >
                {(() => {
                  const rawSubmitted = Math.max(item.submitted_count || 0, 0);
                  const rawAssigned = Math.max(item.total_students || 0, 0);
                  const rawGraded = Math.max(item.graded_count || 0, 0);

                  // Show actionable counters:
                  // submitted = turned in but not yet graded
                  // assigned = not yet turned in
                  const submittedToReview = Math.max(rawSubmitted - rawGraded, 0);
                  const assignedNotSubmitted = Math.max(rawAssigned - rawSubmitted, 0);
                  const gradedDone = rawGraded;

                  return (
                    <>
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <FileText className="w-5 h-5 shrink-0 mt-0.5" style={{ color: textColors.secondary }} />
                  <div className="min-w-0">
                    <div className="font-semibold line-clamp-2" style={{ color: textColors.primary }}>
                      {item.title}
                    </div>
                    <div className="text-sm mt-0.5" style={{ color: textColors.secondary }}>
                      {item.group_name}
                      {item.deadline ? (
                        <>
                          {" "}
                          • {t("teacherDueDateRowLabel")}: {formatLocalizedDate(item.deadline, lang, t, { includeTime: true })}
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 text-sm sm:justify-end w-full sm:w-auto">
                  <div className="grid grid-cols-3 sm:flex items-center gap-4 sm:gap-6 flex-1 sm:flex-none">
                    <div className="text-center">
                      <div className="font-semibold text-base sm:text-sm" style={{ color: textColors.primary }}>
                        {submittedToReview}
                      </div>
                      <div className="text-[10px] sm:text-xs uppercase tracking-wider opacity-70" style={{ color: textColors.secondary }}>{t("submitted")}</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-base sm:text-sm" style={{ color: textColors.primary }}>
                        {assignedNotSubmitted}
                      </div>
                      <div className="text-[10px] sm:text-xs uppercase tracking-wider opacity-70" style={{ color: textColors.secondary }}>{t("assigned")}</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-base sm:text-sm" style={{ color: textColors.primary }}>
                        {gradedDone}
                      </div>
                      <div className="text-[10px] sm:text-xs uppercase tracking-wider opacity-70" style={{ color: textColors.secondary }}>{t("graded")}</div>
                    </div>
                  </div>
                  <div className="relative flex justify-end sm:block">
                    <button
                      type="button"
                      className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenu(activeMenu === item.id ? null : item.id);
                      }}
                      aria-label={t("menu")}
                    >
                      <MoreVertical className="w-5 h-5" style={{ color: textColors.secondary }} />
                    </button>
                    {activeMenu === item.id && (
                      <div
                        ref={menuRef}
                        className="absolute right-0 top-1/2 -translate-y-1/2 mt-8 z-50 min-w-[200px] rounded-xl shadow-xl border border-black/5 dark:border-white/10 overflow-hidden"
                        style={{ ...glassStyle, background: theme === "dark" ? "#1E293B" : "#FFFFFF" }}
                      >
                        {tab === "pending" ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (processingId === item.id) return;
                              markAsReviewed(item.id);
                              setActiveMenu(null);
                            }}
                            disabled={processingId === item.id}
                            className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                              processingId === item.id ? "opacity-50 cursor-not-allowed" : "hover:bg-black/5 dark:hover:bg-white/10"
                            }`}
                            style={{ color: textColors.primary }}
                          >
                            {t("markAsReviewed")}
                          </button>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (processingId === item.id) return;
                              markAsUnreviewed(item.id);
                              setActiveMenu(null);
                            }}
                            disabled={processingId === item.id}
                            className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                              processingId === item.id ? "opacity-50 cursor-not-allowed" : "hover:bg-black/5 dark:hover:bg-white/10"
                            }`}
                            style={{ color: textColors.primary }}
                          >
                            {t("markAsUnreviewed")}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                    </>
                  );
                })()}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );

  const empty = !isLoading && inbox.length === 0;

  return (
    <div className="max-w-4xl mx-auto">
      <BlurFade>
        <h1 className="text-2xl sm:text-3xl font-bold font-geologica mb-6" style={{ color: textColors.primary }}>
          {tab === "pending" ? t("unreviewedAssignments") : t("reviewedAssignments")}
        </h1>
      </BlurFade>

      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-8">
        <div
          className="flex w-full sm:w-auto rounded-xl p-1.5 gap-1.5"
          style={{
            ...glassStyle,
            background: theme === "dark" ? "rgba(26, 34, 56, 0.5)" : "rgba(255,255,255,0.9)",
          }}
        >
          <button
            type="button"
            onClick={() => setTab("pending")}
            className={`flex-1 sm:px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 ${
              tab === "pending" ? "text-white shadow-lg scale-[1.02]" : "hover:bg-black/5 dark:hover:bg-white/5"
            }`}
            style={
              tab === "pending"
                ? { background: "linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)" }
                : { color: textColors.secondary }
            }
          >
            {t("unreviewedAssignments")}
          </button>
          <button
            type="button"
            onClick={() => setTab("graded")}
            className={`flex-1 sm:px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 ${
              tab === "graded" ? "text-white shadow-lg scale-[1.02]" : "hover:bg-black/5 dark:hover:bg-white/5"
            }`}
            style={
              tab === "graded"
                ? { background: "linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)" }
                : { color: textColors.secondary }
            }
          >
            {t("reviewedAssignments")}
          </button>
        </div>

        <div className="w-full sm:w-auto sm:ml-auto">
          <select
            className="w-full sm:min-w-[220px] rounded-xl px-4 py-3 text-sm outline-none transition-all duration-300 focus:ring-2 focus:ring-blue-500/50"
            style={{ ...inputStyle }}
            value={groupFilter === "" ? "" : String(groupFilter)}
            onChange={(e) => setGroupFilter(e.target.value ? Number(e.target.value) : "")}
          >
            <option value="">{t("allCourses")}</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.group_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm" style={{ color: textColors.secondary }}>
          {t("loading")}
        </p>
      ) : empty ? (
        <BlurFade>
          <div className="rounded-2xl p-6 sm:p-10 text-center flex flex-col items-center gap-4" style={{ ...glassStyle }}>
            <svg
              width="120"
              height="100"
              viewBox="0 0 120 100"
              className="opacity-40"
              style={{ color: textColors.secondary }}
              aria-hidden
            >
              <rect x="10" y="20" width="100" height="70" rx="8" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M35 40h50M35 55h35M35 70h45" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <div>
              <p className="font-semibold text-lg font-geologica" style={{ color: textColors.primary }}>
                {tab === "pending" ? t("noUnreviewedWork") : t("noReviewedWork")}
              </p>
              <p className="text-sm mt-2 max-w-md mx-auto" style={{ color: textColors.secondary }}>
                {tab === "pending" ? t("noUnreviewedWorkHint") : t("noReviewedWorkHint")}
              </p>
            </div>
          </div>
        </BlurFade>
      ) : (
        <>
          {noDeadlineItems.length > 0 && renderSection(t("noDueDate"), noDeadlineItems, openNoDue, setOpenNoDue)}
          {tab === "pending" ? (
            withDeadlineItems.length > 0 &&
            renderSection(t("currentAssignments"), withDeadlineItems, openDue, setOpenDue)
          ) : (
            Object.entries(groupedWithDeadline).map(([dateLabel, items]) => (
              <div key={dateLabel}>
                {renderSection(dateLabel, items, true, () => {})}
              </div>
            ))
          )}
        </>
      )}
    </div>
  );
}
