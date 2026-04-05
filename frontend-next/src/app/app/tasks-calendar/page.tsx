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
import { getLocalizedCourseTitle, getLocalizedTopicTitle } from "@/lib/courseUtils";

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
    if (tab === "all-assignments" && user?.role !== "teacher") setActiveTab("all-assignments");
  }, [searchParams, user?.role]);

  // Учителю вкладка «Все задания» не показывается — оставляем только «По дате»
  useEffect(() => {
    if (user?.role === "teacher" && activeTab === "all-assignments") setActiveTab("by-date");
  }, [user?.role, activeTab]);

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

  const { data: assignments = [], isPending: assignmentsPending } = useQuery({
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
    queryKey: ["my-enrollments", user?.id],
    queryFn: async () => {
      const { data } = await api.get<Array<{ course_id: number; course?: { id: number; title: string } }>>("/courses/my/enrollments");
      return data;
    },
    enabled: user?.id != null,
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
    onSuccess: (_, variables) => {
      queryClient.setQueryData<ScheduleItem[]>(
        ["schedule", date.getFullYear(), date.getMonth()],
        (old) =>
          old?.map((s) => (s.id === variables.id ? { ...s, is_completed: variables.is_completed } : s)) ?? old
      );
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
      setSelectedEvent(null);
      alert(t("scheduleDeleted"));
    },
    onError: (err) => {
      alert(t("scheduleDeleteError"));
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { course_id?: number | null; topic_id?: number | null; scheduled_date?: string; notes?: string | null } }) => {
      await api.patch(`/schedule/${id}`, data);
    },
    onSuccess: (_, variables) => {
      queryClient.setQueryData<ScheduleItem[]>(
        ["schedule", date.getFullYear(), date.getMonth()],
        (old) =>
          old?.map((s) => (s.id === variables.id ? { ...s, ...variables.data } : s)) ?? old
      );
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
    if (item.topic_title) parts.push(`— ${getLocalizedTopicTitle(item.topic_title, t)}`);
    if (item.notes && item.notes.trim()) parts.push(`— ${item.notes.trim()}`);
    return parts.length ? parts.join(" ") : item.notes?.trim() || `#${item.id}`;
  };

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4">
      {/* Header */}
      <BlurFade delay={0.1}>
        <div
          className="relative rounded-[32px] overflow-hidden mb-8 p-8 sm:p-12 text-white shadow-2xl group"
          style={{
            background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 40%, #C026D3 100%)",
          }}
        >
          {/* Decorative Background elements */}
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-colors duration-700" />
          <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 bg-purple-400/20 rounded-full blur-2xl group-hover:bg-purple-400/30 transition-colors duration-700" />
          
          <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div className="space-y-2">
              <h1 className="text-3xl sm:text-4xl font-extrabold flex items-center gap-3 tracking-tight">
                <div className="p-2.5 bg-white/20 backdrop-blur-md rounded-2xl shadow-inner">
                  <ListTodo className="w-8 h-8 text-white" />
                </div>
                {t("tasksCalendar")}
              </h1>
              <p className="text-white/80 text-lg font-medium max-w-md">
                {t("tasksCalendarSubtitle")}
              </p>
            </div>
            <button
              type="button"
              onClick={goToToday}
              className="self-start sm:self-auto px-6 py-3 rounded-2xl text-sm font-bold bg-white text-[#7C3AED] hover:bg-opacity-90 hover:scale-105 active:scale-95 transition-all shadow-xl shadow-indigo-500/20"
            >
              {t("scheduleToday")}
            </button>
          </div>
        </div>
      </BlurFade>

      {/* Tab: By Date - Calendar and Add Panel Side by Side */}
      <BlurFade delay={0.2}>
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 sm:gap-6">
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

      {/* Event Details Modal: pass live event from schedule so modal updates after toggle/edit */}
      {selectedEvent && (
        <EventDetailsModal
          event={
            selectedEvent.type === "schedule"
              ? (schedule.find((s) => s.id === (selectedEvent.event as ScheduleItem).id) ?? selectedEvent.event)
              : selectedEvent.event
          }
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
          isUpdating={updateMutation.isPending || deleteMutation.isPending || toggleMutation.isPending}
        />
      )}
    </div>
  );
}
