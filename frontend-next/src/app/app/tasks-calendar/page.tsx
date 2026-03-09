"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { api } from "@/api/client";
import { useAuthStore } from "@/store/authStore";
import { useLanguage } from "@/context/LanguageContext";
import type { TranslationKey } from "@/i18n/translations";
import {
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  FileText,
  Award,
  Send,
  CheckCircle,
  Calendar,
  ListTodo,
  Paperclip,
  Link as LinkIcon,
} from "lucide-react";
import { TasksCalendar } from "@/components/tasks-calendar/TasksCalendar";
import { AddTaskPanel } from "@/components/tasks-calendar/AddTaskPanel";
import { EventDetailsModal } from "@/components/tasks-calendar/EventDetailsModal";
import { CalendarFilters } from "@/components/tasks-calendar/CalendarFilters";
import { cn } from "@/lib/utils";
import { BlurFade } from "@/components/ui/blur-fade";
import { getLocalizedCourseTitle } from "@/lib/courseUtils";

type Topic = { id: number; title: string };

type ScheduleItem = {
  id: number;
  course_id: number | null;
  topic_id: number | null;
  course_title: string | null;
  topic_title: string | null;
  scheduled_date: string;
  is_completed: boolean;
  notes: string | null;
};

type Assignment = {
  id: number;
  title: string;
  description: string | null;
  course_id: number;
  course_title: string;
  deadline: string | null;
  submitted: boolean;
  grade: number | null;
  teacher_comment: string | null;
  attachment_urls?: string[];
  attachment_links?: string[];
};

const MONTH_KEYS = ["monthJan", "monthFeb", "monthMar", "monthApr", "monthMay", "monthJun", "monthJul", "monthAug", "monthSep", "monthOct", "monthNov", "monthDec"] as const;
const WEEKDAY_KEYS = ["wdMon", "wdTue", "wdWed", "wdThu", "wdFri", "wdSat", "wdSun"] as const;
const WEEKDAY_FULL_KEYS = ["weekdaySun", "weekdayMon", "weekdayTue", "weekdayWed", "weekdayThu", "weekdayFri", "weekdaySat"] as const;

export default function TasksCalendarPage() {
  const { t, lang } = useLanguage();
  const router = useRouter();
  const { user } = useAuthStore();
  const searchParams = useSearchParams();

  const locale = lang === "ru" ? "ru-RU" : lang === "kk" ? "kk-KZ" : "en-US";

  useEffect(() => {
    if (user?.role === "parent") {
      router.replace("/app");
    }
  }, [user, router]);

  if (user?.role === "parent") {
    return null;
  }
  const [activeTab, setActiveTab] = useState<"by-date" | "all-assignments">("by-date");
  const [date, setDate] = useState<Date>(new Date());
  const [newCourseId, setNewCourseId] = useState<number | "">("");
  const [newTopicId, setNewTopicId] = useState<number | "">("");
  const [newNotes, setNewNotes] = useState("");
  const [addError, setAddError] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<{ event: ScheduleItem | Assignment; type: "schedule" | "assignment" } | null>(null);
  const [filterCourseId, setFilterCourseId] = useState<number | "">("");
  const [filterStatus, setFilterStatus] = useState<"all" | "completed" | "pending">("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [sortType, setSortType] = useState<"none" | "status" | "course" | "time">("none");
  const [submittingId, setSubmittingId] = useState<number | null>(null);
  const [submitText, setSubmitText] = useState("");
  const [submitFileUrls, setSubmitFileUrls] = useState<string[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "all-assignments") setActiveTab("all-assignments");
  }, [searchParams]);

  const { data: schedule = [] } = useQuery({
    queryKey: ["schedule", date.getFullYear(), date.getMonth()],
    queryFn: async () => {
      const from = new Date(date.getFullYear(), date.getMonth(), 1);
      const to = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      // Форматируем даты в локальном времени
      const formatDate = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
      };
      const { data } = await api.get<ScheduleItem[]>(`/schedule?from_date=${formatDate(from)}&to_date=${formatDate(to)}`);
      return data;
    },
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ["my-assignments"],
    queryFn: async () => {
      const { data } = await api.get<Assignment[]>("/assignments/my");
      return data;
    },
  });

  const submitMutation = useMutation({
    mutationFn: async ({
      id,
      submission_text,
      file_urls,
    }: {
      id: number;
      submission_text: string;
      file_urls: string[];
    }) => {
      const { data } = await api.post(`/assignments/${id}/submit`, {
        submission_text: submission_text || null,
        file_urls: file_urls.length ? file_urls : undefined,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-assignments"] });
      setSubmittingId(null);
      setSubmitText("");
      setSubmitFileUrls([]);
    },
  });

  const handleUploadSubmissionFile = async (assignmentId: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || submitFileUrls.length >= 5) return;
    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await api.post<{ url: string }>(
        `/assignments/submissions/upload?assignment_id=${assignmentId}`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      setSubmitFileUrls((prev) => (prev.length < 5 ? [...prev, data.url] : prev));
    } finally {
      setUploadingFile(false);
      e.target.value = "";
    }
  };

  const isAdmin = user?.role && ["admin", "director", "curator"].includes(user.role);

  const { data: enrollments = [] } = useQuery({
    queryKey: ["my-enrollments"],
    queryFn: async () => {
      const { data } = await api.get<Array<{ course_id: number; course?: { id: number; title: string } }>>("/courses/my/enrollments");
      return data;
    },
  });

  const { data: allCourses = [] } = useQuery({
    queryKey: ["courses-active"],
    queryFn: async () => {
      const { data } = await api.get<Array<{ id: number; title: string }>>("/courses?is_active=true");
      return data;
    },
  });

  const coursesForSelect = isAdmin ? allCourses : enrollments.map((e) => e.course).filter((c): c is { id: number; title: string } => !!c);

  const { data: courseStructure } = useQuery({
    queryKey: ["course-structure", newCourseId],
    queryFn: async () => {
      if (!newCourseId) return null;
      const { data } = await api.get<{ modules: Array<{ topics: Topic[] }> }>(`/courses/${newCourseId}/structure`);
      return data;
    },
    enabled: !!newCourseId,
  });

  const topicsForSelect: Topic[] = courseStructure?.modules?.flatMap((m) => m.topics ?? []) ?? [];

  const addMutation = useMutation({
    mutationFn: async (body: { course_id?: number; topic_id?: number; scheduled_date: string; notes?: string }) => {
      await api.post("/schedule", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-events"] });
      setNewCourseId("");
      setNewTopicId("");
      setNewNotes("");
      setAddError("");
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      setAddError(err.response?.data?.detail || t("scheduleAddError"));
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_completed }: { id: number; is_completed: boolean }) => {
      await api.patch(`/schedule/${id}`, { is_completed } as { is_completed: boolean });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-events"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/schedule/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-events"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { course_id?: number | null; topic_id?: number | null; scheduled_date?: string; notes?: string | null } }) => {
      await api.patch(`/schedule/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-events"] });
    },
  });

  // Применяем фильтры к schedule
  const filteredSchedule = useMemo(() => {
    let filtered = [...schedule];
    
    if (filterCourseId !== "") {
      filtered = filtered.filter((s) => s.course_id === filterCourseId);
    }
    
    if (filterStatus === "completed") {
      filtered = filtered.filter((s) => s.is_completed);
    } else if (filterStatus === "pending") {
      filtered = filtered.filter((s) => !s.is_completed);
    }
    
    if (filterDateFrom) {
      filtered = filtered.filter((s) => s.scheduled_date >= filterDateFrom);
    }
    
    if (filterDateTo) {
      filtered = filtered.filter((s) => s.scheduled_date <= filterDateTo);
    }
    
    return filtered;
  }, [schedule, filterCourseId, filterStatus, filterDateFrom, filterDateTo]);

  // Форматируем дату в локальном времени
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const dateStr = `${year}-${month}-${day}`;
  const itemsForDate = filteredSchedule.filter((s) => s.scheduled_date === dateStr);
  const assignmentsForDate = assignments.filter((a) => a.deadline && a.deadline.slice(0, 10) === dateStr);

  const datesWithTasks = useMemo(() => {
    const set = new Set(filteredSchedule.map((s) => s.scheduled_date));
    assignments.forEach((a) => {
      if (a.deadline) set.add(a.deadline.slice(0, 10));
    });
    return set;
  }, [filteredSchedule, assignments]);

  const upcomingAssignments = useMemo(
    () => assignments.filter((a) => !a.submitted && a.deadline && a.deadline >= new Date().toISOString().slice(0, 10)).slice(0, 3),
    [assignments]
  );

  const pending = assignments.filter((a) => !a.submitted);
  const submitted = assignments.filter((a) => a.submitted);

  const handleAdd = () => {
    setAddError("");
    if (!newCourseId && !newNotes.trim()) {
      setAddError(t("scheduleAddErrorEmpty"));
      return;
    }
    // Форматируем дату в локальном времени, чтобы избежать проблем с часовыми поясами
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const scheduledDate = `${year}-${month}-${day}`;
    
    addMutation.mutate({
      course_id: newCourseId || undefined,
      topic_id: newTopicId || undefined,
      scheduled_date: scheduledDate,
      notes: newNotes.trim() || undefined,
    });
  };

  const handleCourseChange = (val: number | "") => {
    setNewCourseId(val);
    setNewTopicId("");
  };

  const goToToday = () => {
    setDate(new Date());
  };

  const formatDate = (d: Date) => {
    const y = d.getFullYear();
    const m = d.getMonth();
    const day = d.getDate();
    const wd = d.getDay();
    const weekday = t(WEEKDAY_FULL_KEYS[wd] as TranslationKey);
    const month = t(MONTH_KEYS[m]);
    return `${y} · ${day} ${month}, ${weekday}`;
  };

  const getItemLabel = (item: ScheduleItem) => {
    const parts: string[] = [];
    if (item.course_title) parts.push(getLocalizedCourseTitle({ title: item.course_title } as any, t));
    if (item.topic_title) parts.push(`— ${item.topic_title}`);
    if (item.notes && item.notes.trim()) parts.push(`— ${item.notes.trim()}`);
    return parts.length ? parts.join(" ") : item.notes?.trim() || `#${item.id}`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4">
      {/* Header */}
      <BlurFade delay={0.1}>
        <div
          className="relative rounded-[20px] overflow-hidden mb-6 p-6 text-white"
          style={{
            background: "var(--qit-gradient-banner)",
            boxShadow: "0 10px 40px rgba(26,35,126,0.25)",
          }}
        >
        <div className="absolute inset-0 opacity-10">
          <svg className="absolute bottom-0 left-0 w-full h-24" viewBox="0 0 1200 120" preserveAspectRatio="none">
            <path fill="currentColor" d="M0,60 C300,120 600,0 900,60 C1050,90 1200,30 1200,60 L1200,120 L0,120 Z" />
          </svg>
        </div>
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ListTodo className="w-7 h-7" />
            {t("tasksCalendar")}
          </h1>
          <button
            type="button"
            onClick={goToToday}
            className="self-start sm:self-auto px-4 py-2 rounded-xl text-sm font-medium bg-white/20 hover:bg-white/30 transition-colors"
          >
            {t("scheduleToday")}
          </button>
        </div>
      </div>
      </BlurFade>

      {/* Tabs */}
      <BlurFade delay={0.15}>
        <div className="flex gap-2 mb-6">
        <button
          type="button"
          onClick={() => setActiveTab("by-date")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all",
            activeTab === "by-date"
              ? "text-white shadow-md"
              : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          )}
          style={activeTab === "by-date" ? { background: "var(--qit-primary)" } : undefined}
        >
          <Calendar className="w-5 h-5" />
          {t("tasksCalendarByDate")}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("all-assignments")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all",
            activeTab === "all-assignments"
              ? "text-white shadow-md"
              : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          )}
          style={activeTab === "all-assignments" ? { background: "var(--qit-primary)" } : undefined}
        >
          <FileText className="w-5 h-5" />
          {t("tasksCalendarAllAssignments")}
        </button>
      </div>
      </BlurFade>

      {/* Tab: By Date - Calendar and Add Panel Side by Side */}
      {activeTab === "by-date" && (
        <BlurFade delay={0.2}>
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
          {/* Календарь слева */}
          <div className="lg:col-span-1">
            <TasksCalendar
              date={date}
              onDateChange={setDate}
              schedule={filteredSchedule}
              assignments={assignments}
              onEventClick={(event, type) => setSelectedEvent({ event, type })}
              onToggleComplete={(id, is_completed) => toggleMutation.mutate({ id, is_completed })}
              sortType={sortType}
            />
          </div>

          {/* Панель добавления и фильтров справа */}
          <div className="lg:col-span-1 space-y-4">
            <CalendarFilters
              courses={coursesForSelect}
              selectedCourseId={filterCourseId}
              selectedStatus={filterStatus}
              dateFrom={filterDateFrom}
              dateTo={filterDateTo}
              sortType={sortType}
              onCourseChange={setFilterCourseId}
              onStatusChange={setFilterStatus}
              onDateFromChange={setFilterDateFrom}
              onDateToChange={setFilterDateTo}
              onSortChange={setSortType}
              onClear={() => {
                setFilterCourseId("");
                setFilterStatus("all");
                setFilterDateFrom("");
                setFilterDateTo("");
                setSortType("none");
              }}
            />
            <AddTaskPanel
              selectedDate={date}
              courseId={newCourseId}
              topicId={newTopicId}
              notes={newNotes}
              error={addError}
              courses={coursesForSelect}
              topics={topicsForSelect}
              isPending={addMutation.isPending}
              onCourseChange={handleCourseChange}
              onTopicChange={setNewTopicId}
              onNotesChange={setNewNotes}
              onSubmit={handleAdd}
              onCancel={() => {
                setAddError("");
                setNewCourseId("");
                setNewTopicId("");
                setNewNotes("");
              }}
            />
          </div>
        </div>
        </BlurFade>
      )}

      {/* Event Details Modal */}
      {selectedEvent && (
        <EventDetailsModal
          event={selectedEvent.event}
          type={selectedEvent.type}
          onClose={() => setSelectedEvent(null)}
          onToggleComplete={
            selectedEvent.type === "schedule"
              ? (id, is_completed) => {
                  toggleMutation.mutate({ id, is_completed });
                }
              : undefined
          }
          onDelete={
            selectedEvent.type === "schedule"
              ? (id) => {
                  deleteMutation.mutate(id);
                }
              : undefined
          }
          onUpdate={
            selectedEvent.type === "schedule"
              ? (id, data) => {
                  updateMutation.mutate({ id, data });
                }
              : undefined
          }
          courses={coursesForSelect}
          topics={topicsForSelect}
          isUpdating={updateMutation.isPending}
        />
      )}

      {/* Tab: All Assignments */}
      {activeTab === "all-assignments" && (
        <BlurFade delay={0.2}>
          <div className="space-y-8">
          {pending.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">{t("assignmentsToSubmit")}</h2>
              <div className="space-y-4">
                {pending.map((a) => (
                  <div
                    key={a.id}
                    className="bg-white dark:bg-gray-800 rounded-[20px] border border-gray-200 dark:border-gray-700 p-5 shadow-md hover:shadow-lg transition-all"
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex gap-4 min-w-0 flex-1">
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-white"
                          style={{ background: "var(--qit-gradient-3)" }}
                        >
                          <FileText className="w-6 h-6" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-medium text-gray-800 dark:text-white">
                            <span className="text-[var(--qit-primary)] font-bold">{t("assignmentTopic")}:</span> {a.title}
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            <span className="font-medium">{t("assignmentCourse")}:</span> {getLocalizedCourseTitle({ title: a.course_title } as any, t)}
                          </p>
                          {a.deadline && (
                            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                              {t("assignmentDeadline")}: {new Date(a.deadline).toLocaleDateString(locale)}
                            </p>
                          )}
                          {a.description && (
                            <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-100 dark:border-gray-700">
                              <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                                {t("assignmentCriteria")}:
                              </p>
                              <div
                                className="text-sm text-gray-600 dark:text-gray-300 break-words"
                                dangerouslySetInnerHTML={{ __html: a.description }}
                              />
                            </div>
                          )}
                          {((a.attachment_urls?.length ?? 0) > 0 || (a.attachment_links?.length ?? 0) > 0) && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {a.attachment_urls?.map((u, i) => (
                                <a
                                  key={`url-${i}`}
                                  href={u}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-[var(--qit-primary)] hover:underline"
                                >
                                  <Paperclip className="w-3 h-3" /> {u.split("/").pop()}
                                </a>
                              ))}
                              {a.attachment_links?.map((link, i) => (
                                <a
                                  key={`link-${i}`}
                                  href={link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-[var(--qit-primary)] hover:underline"
                                >
                                  <LinkIcon className="w-3 h-3" /> {link.slice(0, 40)}...
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      {submittingId === a.id ? (
                        <div className="w-full max-w-md space-y-3">
                          <textarea
                            value={submitText}
                            onChange={(e) => setSubmitText(e.target.value)}
                            placeholder={t("assignmentPlaceholder")}
                            className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white"
                            rows={5}
                          />
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                              {t("assignmentAttachFiles")} ({submitFileUrls.length}/5)
                            </p>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="file"
                                accept=".jpg,.jpeg,.png,.gif,.webp,.mp4,.webm,.pdf,.doc,.docx,.txt"
                                onChange={(e) => handleUploadSubmissionFile(a.id, e)}
                                className="hidden"
                                disabled={submitFileUrls.length >= 5 || uploadingFile}
                              />
                              <Paperclip className="w-4 h-4 text-gray-500" />
                              <span className="text-sm text-[var(--qit-primary)] hover:underline">
                                {uploadingFile ? t("loading") : t("assignmentUploadFile")}
                              </span>
                            </label>
                            {submitFileUrls.length > 0 && (
                              <ul className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                                {submitFileUrls.map((u, i) => (
                                  <li key={i} className="flex items-center gap-2">
                                    <a href={u} target="_blank" rel="noopener noreferrer" className="truncate hover:underline">
                                      {u.split("/").pop()}
                                    </a>
                                    <button
                                      type="button"
                                      onClick={() => setSubmitFileUrls((prev) => prev.filter((_, j) => j !== i))}
                                      className="text-red-500 shrink-0"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                submitMutation.mutate({
                                  id: a.id,
                                  submission_text: submitText,
                                  file_urls: submitFileUrls,
                                })
                              }
                              disabled={submitMutation.isPending}
                              className="flex items-center gap-1 py-1.5 px-3 rounded-lg bg-[var(--qit-primary)] text-white text-sm hover:opacity-90"
                            >
                              <Send className="w-4 h-4" /> {t("assignmentSubmit")}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSubmittingId(null);
                                setSubmitText("");
                                setSubmitFileUrls([]);
                              }}
                              className="py-1.5 px-3 rounded-lg border dark:border-gray-600 text-sm"
                            >
                              {t("cancel")}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setSubmittingId(a.id);
                            setSubmitText("");
                            setSubmitFileUrls([]);
                          }}
                          className="py-2 px-4 rounded-lg bg-[var(--qit-primary)] text-white text-sm hover:opacity-90"
                        >
                          {t("assignmentSubmit")}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {submitted.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">{t("assignmentsSubmitted")}</h2>
              <div className="space-y-4">
                {submitted.map((a) => (
                  <div
                    key={a.id}
                    className="bg-white dark:bg-gray-800 rounded-[20px] border border-gray-200 dark:border-gray-700 p-5 shadow-md hover:shadow-lg transition-all"
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-white"
                        style={{ background: "linear-gradient(135deg, #10b981, #059669)" }}
                      >
                        <CheckCircle className="w-6 h-6" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-medium text-gray-800 dark:text-white">{a.title}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{getLocalizedCourseTitle({ title: a.course_title } as any, t)}</p>
                        {a.grade != null && (
                          <p className="text-sm font-medium text-[var(--qit-primary)] mt-1">
                            {t("assignmentGrade")}: {a.grade}
                            {a.grade >= 90 && (
                              <span className="ml-2 text-green-600 dark:text-green-400">{t("assignmentCoinsBonus")}</span>
                            )}
                          </p>
                        )}
                        {a.teacher_comment && (
                          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{a.teacher_comment}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {assignments.length === 0 && (
            <p className="text-gray-500 dark:text-gray-400">{t("assignmentNoTasks")}</p>
          )}
        </div>
        </BlurFade>
      )}
    </div>
  );
}
