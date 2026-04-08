"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useAuthStore } from "@/store/authStore";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";
import { getLocalizedCourseTitle } from "@/lib/courseUtils";
import { formatDateLocalized } from "@/lib/dateUtils";


const WD_KEYS = ["wdSun", "wdMon", "wdTue", "wdWed", "wdThu", "wdFri", "wdSat"] as const;
const MONTH_KEYS = ["monthJan", "monthFeb", "monthMar", "monthApr", "monthMay", "monthJun", "monthJul", "monthAug", "monthSep", "monthOct", "monthNov", "monthDec"] as const;

type CalendarView = "month" | "week" | "day";

const EVENT_COLORS_LIGHT = [
  { bg: "#E0E0E0", border: "#9E9E9E", text: "#1F2937" },
  { bg: "#FFEDED", border: "#F87171", text: "#1F2937" },
  { bg: "#FFFBEA", border: "#F59E0B", text: "#1F2937" },
  { bg: "#FFEBF0", border: "#EC4899", text: "#1F2937" },
  { bg: "#F2ECFB", border: "#A78BFA", text: "#1F2937" },
];

const EVENT_COLORS_DARK = [
  { bg: "rgba(156,163,175,0.2)", border: "#9E9E9E", text: "#E5E7EB" },
  { bg: "rgba(248,113,113,0.15)", border: "#F87171", text: "#FCA5A5" },
  { bg: "rgba(245,158,11,0.15)", border: "#F59E0B", text: "#FCD34D" },
  { bg: "rgba(236,72,153,0.15)", border: "#EC4899", text: "#F9A8D4" },
  { bg: "rgba(167,139,250,0.15)", border: "#A78BFA", text: "#C4B5FD" },
];

export function CalendarWidget() {
  const { t, lang } = useLanguage();
  const { user } = useAuthStore();
  const userId = user?.id;
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<number | null>(null);
  const [view, setView] = useState<CalendarView>("month");
  
  // Add task state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newCourseId, setNewCourseId] = useState<number | "">("");
  const [newNotes, setNewNotes] = useState("");
  const [addError, setAddError] = useState("");

  const isDark = theme === "dark";

  const eventColors = isDark ? EVENT_COLORS_DARK : EVENT_COLORS_LIGHT;

  const { data: events = [] } = useQuery({
    queryKey: ["dashboard-events"],
    queryFn: async () => {
      const { data } = await api.get<Array<{
        id: number;
        scheduled_date: string;
        notes: string | null;
        course_title: string | null;
        topic_title: string | null;
      }>>("/dashboard/events");
      return data;
    },
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ["my-enrollments", userId],
    queryFn: async () => {
      const { data } = await api.get<Array<{ course_id: number; course?: { id: number; title: string } }>>("/courses/my/enrollments");
      return data;
    },
    enabled: userId != null,
  });

  const addMutation = useMutation({
    mutationFn: async (body: { course_id?: number; scheduled_date: string; notes?: string }) => {
      await api.post("/schedule", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-events"] });
      queryClient.invalidateQueries({ queryKey: ["schedule"] });
      setIsAddModalOpen(false);
      setNewCourseId("");
      setNewNotes("");
      setAddError("");
    },
    onError: (err: any) => {
      setAddError(err.response?.data?.detail || t("scheduleAddError"));
    },
  });

  const handleAdd = () => {
    if (!newCourseId && !newNotes.trim()) {
      setAddError(t("scheduleAddErrorEmpty"));
      return;
    }
    const scheduledDate = formatDateKey(currentDate);
    addMutation.mutate({
      course_id: newCourseId || undefined,
      scheduled_date: scheduledDate,
      notes: newNotes.trim() || undefined,
    });
  };

  // Вспомогательная функция для форматирования даты в YYYY-MM-DD
  const formatDateKey = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  };

  const calendarDays = useMemo(() => {
    if (view === "month") {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const daysInMonth = lastDay.getDate();
      const startingDayOfWeek = firstDay.getDay();

      const days: Array<{ 
        date: Date; 
        isCurrentMonth: boolean; 
        events: Array<{ title: string; time?: string; color: { bg: string; border: string; text: string } }> 
      }> = [];

      const prevMonthLastDay = new Date(year, month, 0).getDate();
      for (let i = startingDayOfWeek - 1; i >= 0; i--) {
        days.push({
          date: new Date(year, month - 1, prevMonthLastDay - i),
          isCurrentMonth: false,
          events: [],
        });
      }

      for (let i = 1; i <= daysInMonth; i++) {
        const dateObj = new Date(year, month, i);
        const dateStr = formatDateKey(dateObj);
        const dayEvents = events
          .filter(e => e.scheduled_date === dateStr)
          .map((e, idx) => {
            const courseTitle = e.course_title ? getLocalizedCourseTitle({ title: e.course_title } as any, t) : null;
            const title = e.notes || e.topic_title || courseTitle || t("eventDefault");
            const timeMatch = title.match(/(\d{1,2}\.\d{2}(?:\s*-\s*\d{1,2}\.\d{2})?)/);
            const time = timeMatch ? timeMatch[1] : undefined;
            const displayTitle = time ? title.replace(/\s*\d{1,2}\.\d{2}(?:\s*-\s*\d{1,2}\.\d{2})?/, "").trim() : title;
            
            return {
              title: displayTitle,
              time,
              color: eventColors[idx % eventColors.length],
            };
          });
        
        days.push({
          date: dateObj,
          isCurrentMonth: true,
          events: dayEvents,
        });
      }

      const remainingDays = 42 - days.length;
      for (let i = 1; i <= remainingDays; i++) {
        days.push({
          date: new Date(year, month + 1, i),
          isCurrentMonth: false,
          events: [],
        });
      }

      return days;
    } else if (view === "week") {
      const startOfWeek = new Date(currentDate);
      const day = startOfWeek.getDay();
      startOfWeek.setDate(currentDate.getDate() - day);
      
      const days = [];
      for (let i = 0; i < 7; i++) {
        const dateObj = new Date(startOfWeek);
        dateObj.setDate(startOfWeek.getDate() + i);
        const dateStr = formatDateKey(dateObj);
        const dayEvents = events
          .filter(e => e.scheduled_date === dateStr)
          .map((e, idx) => {
            const courseTitle = e.course_title ? getLocalizedCourseTitle({ title: e.course_title } as any, t) : null;
            const title = e.notes || e.topic_title || courseTitle || t("eventDefault");
            const timeMatch = title.match(/(\d{1,2}\.\d{2}(?:\s*-\s*\d{1,2}\.\d{2})?)/);
            const time = timeMatch ? timeMatch[1] : undefined;
            return {
              title: time ? title.replace(/\s*\d{1,2}\.\d{2}(?:\s*-\s*\d{1,2}\.\d{2})?/, "").trim() : title,
              time,
              color: eventColors[idx % eventColors.length],
            };
          });
        days.push({ date: dateObj, isCurrentMonth: true, events: dayEvents });
      }
      return days;
    }
    return [];
  }, [currentDate, view, events, eventColors]);

  const dayEvents = useMemo(() => {
    if (view !== "day") return [];
    const dateStr = formatDateKey(currentDate);
    return events
      .filter(e => e.scheduled_date === dateStr)
      .map((e, idx) => {
        const courseTitle = e.course_title ? getLocalizedCourseTitle({ title: e.course_title } as any, t) : null;
        const title = e.notes || e.topic_title || courseTitle || t("eventDefault");
        const timeMatch = title.match(/(\d{1,2}\.\d{2}(?:\s*-\s*\d{1,2}\.\d{2})?)/);
        const time = timeMatch ? timeMatch[1] : undefined;
        return {
          title: time ? title.replace(/\s*\d{1,2}\.\d{2}(?:\s*-\s*\d{1,2}\.\d{2})?/, "").trim() : title,
          time,
          color: eventColors[idx % eventColors.length],
        };
      });
  }, [currentDate, view, events, eventColors]);

  const today = new Date();
  const isToday = (date: Date) => {
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const getHeaderTitle = () => {
    if (view === "month") {
      return `${t(MONTH_KEYS[currentDate.getMonth()])} ${currentDate.getFullYear()}`;
    } else if (view === "week") {
      const start = new Date(currentDate);
      start.setDate(currentDate.getDate() - currentDate.getDay());
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return `${start.getDate()} ${t(MONTH_KEYS[start.getMonth()]).slice(0, 3)} - ${end.getDate()} ${t(MONTH_KEYS[end.getMonth()]).slice(0, 3)} ${end.getFullYear()}`;
    } else {
      return formatDateLocalized(currentDate, lang, { day: "numeric", month: "long", year: "numeric", weekday: "long" });

    }
  };

  const navigate = (direction: "prev" | "next") => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev);
      if (view === "month") {
        newDate.setMonth(prev.getMonth() + (direction === "prev" ? -1 : 1));
      } else if (view === "week") {
        newDate.setDate(prev.getDate() + (direction === "prev" ? -7 : 7));
      } else {
        newDate.setDate(prev.getDate() + (direction === "prev" ? -1 : 1));
      }
      return newDate;
    });
    setSelectedDate(null);
  };

  const handleDateClick = (dateObj: Date, isCurrentMonth: boolean) => {
    if (!isCurrentMonth && view === "month") return;
    setCurrentDate(dateObj);
    if (view === "month") {
      setSelectedDate(dateObj.getDate());
    }
  };

  const tabStyle = (active: boolean) => ({
    background: active ? "#7C3AED" : (isDark ? "rgba(255,255,255,0.1)" : "#F3F4F6"),
    color: active ? "#FFFFFF" : (isDark ? "#9CA3AF" : "#6B7280"),
  });

  return (
    <div 
      className="rounded-xl overflow-hidden shadow-md"
      style={{ 
        background: isDark ? "rgba(30,41,59,0.95)" : "#FFFFFF",
        boxShadow: isDark ? "0 2px 8px rgba(0, 0, 0, 0.3)" : "0 2px 8px rgba(0, 0, 0, 0.1)",
      }}
    >
      <div className="p-4">
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => setView("month")}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={tabStyle(view === "month")}
          >
            {t("scheduleMonth")}
          </button>
          <button
            type="button"
            onClick={() => setView("week")}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={tabStyle(view === "week")}
          >
            {t("scheduleWeek")}
          </button>
          <button
            type="button"
            onClick={() => setView("day")}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={tabStyle(view === "day")}
          >
            {t("scheduleDay")}
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 
              className="font-bold text-lg"
              style={{ color: isDark ? "#F3F4F6" : "#1F2937" }}
            >
              {getHeaderTitle()}
            </h3>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => navigate("prev")}
                className="p-1.5 rounded-full transition-colors"
                style={{ color: isDark ? "#D1D5DB" : "#374151" }}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => navigate("next")}
                className="p-1.5 rounded-full transition-colors"
                style={{ color: isDark ? "#D1D5DB" : "#374151" }}
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setAddError("");
              setIsAddModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90"
            style={{ background: "#7C3AED" }}
          >
            <Plus className="w-4 h-4" />
            {t("addButton")}
          </button>
        </div>
      </div>

      {/* Add Task Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div 
            className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  {t("scheduleAddTask")}
                </h3>
                <button 
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {addError && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg">
                  {addError}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t("assignmentCourse")}
                  </label>
                  <select
                    value={newCourseId}
                    onChange={(e) => setNewCourseId(Number(e.target.value) || "")}
                    className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-[#7C3AED] outline-none transition-all"
                  >
                    <option value="">{t("scheduleSelectCourse")}</option>
                    {enrollments.map((e: any) => e.course && (
                      <option key={e.course.id} value={e.course.id}>
                        {getLocalizedCourseTitle(e.course, t)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t("scheduleNotes")}
                  </label>
                  <textarea
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    placeholder={t("scheduleNotes")}
                    rows={3}
                    className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-[#7C3AED] outline-none transition-all resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleAdd}
                    disabled={addMutation.isPending}
                    className="flex-1 py-2.5 bg-[#7C3AED] text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50 transition-all"
                  >
                    {addMutation.isPending ? t("loading") : t("scheduleAdd")}
                  </button>
                  <button
                    onClick={() => setIsAddModalOpen(false)}
                    className="flex-1 py-2.5 border dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
                  >
                    {t("cancel")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="p-4">
        {view === "day" ? (
          <div className="space-y-3 min-h-[300px]">
            {dayEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 opacity-50">
                <p className="text-sm" style={{ color: isDark ? "#9CA3AF" : "#6B7280" }}>
                  {t("scheduleNoEventsForDay")}
                </p>
              </div>
            ) : (
              dayEvents.map((event, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg border-l-4"
                  style={{
                    background: event.color.bg,
                    color: event.color.text,
                    borderLeftColor: event.color.border,
                  }}
                >
                  <div className="font-bold text-sm">{event.title}</div>
                  {event.time && <div className="text-xs mt-1 opacity-80">{event.time}</div>}
                </div>
              ))
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-7 gap-0 mb-0">
              {WD_KEYS.map((key) => (
                <div
                  key={key}
                  className="text-xs font-bold text-center py-2"
                  style={{ color: isDark ? "#D1D5DB" : "#1F2937" }}
                >
                  {t(key).slice(0, 3)}
                </div>
              ))}
            </div>

            <div 
              className="grid grid-cols-7 gap-0 border-t border-l"
              style={{ borderColor: isDark ? "rgba(255,255,255,0.1)" : "#E5E7EB" }}
            >
              {calendarDays.map((day, idx) => {
                const isSelected = selectedDate === day.date.getDate() && day.isCurrentMonth;
                const isTodayDate = isToday(day.date);

                return (
                  <div
                    key={idx}
                    className="relative min-h-[100px] border-r border-b p-1.5 cursor-pointer transition-colors"
                    style={{
                      borderColor: isDark ? "rgba(255,255,255,0.1)" : "#E5E7EB",
                      background: isSelected 
                        ? (isDark ? "rgba(124,58,237,0.15)" : "rgba(124,58,237,0.05)") 
                        : (isDark ? "rgba(30,41,59,0.5)" : "#FFFFFF"),
                    }}
                    onClick={() => handleDateClick(day.date, day.isCurrentMonth)}
                  >
                    <div 
                      className="text-sm font-medium mb-1"
                      style={{
                        color: !day.isCurrentMonth && view === "month"
                          ? (isDark ? "#4B5563" : "#D1D5DB")
                          : isTodayDate
                            ? "#7C3AED"
                            : (isDark ? "#E5E7EB" : "#1F2937"),
                      }}
                    >
                      {isTodayDate ? (
                        <span 
                          className="inline-flex items-center justify-center w-6 h-6 rounded-full text-white"
                          style={{ background: "#7C3AED" }}
                        >
                          {day.date.getDate()}
                        </span>
                      ) : (
                        day.date.getDate()
                      )}
                    </div>

                    <div className="w-full flex flex-col gap-1">
                      {day.events.slice(0, 3).map((event, eventIdx) => (
                        <div
                          key={eventIdx}
                          className="relative text-[10px] px-2 py-1 rounded text-left truncate"
                          style={{
                            background: event.color.bg,
                            color: event.color.text,
                            borderRight: `3px solid ${event.color.border}`,
                          }}
                          title={`${event.title}${event.time ? ` (${event.time})` : ""}`}
                        >
                          {event.title}
                        </div>
                      ))}
                      {day.events.length > 3 && (
                        <div className="text-[9px] px-1 opacity-60 text-center">
                          +{day.events.length - 3}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
