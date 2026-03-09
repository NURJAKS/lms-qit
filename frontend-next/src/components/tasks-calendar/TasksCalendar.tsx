"use client";

import { useState, useMemo, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { getLocalizedCourseTitle } from "@/lib/courseUtils";

const WD_KEYS = ["wdSun", "wdMon", "wdTue", "wdWed", "wdThu", "wdFri", "wdSat"] as const;
const MONTH_KEYS = ["monthJan", "monthFeb", "monthMar", "monthApr", "monthMay", "monthJun", "monthJul", "monthAug", "monthSep", "monthOct", "monthNov", "monthDec"] as const;
const WEEKDAY_FULL_KEYS = ["weekdaySun", "weekdayMon", "weekdayTue", "weekdayWed", "weekdayThu", "weekdayFri", "weekdaySat"] as const;

type CalendarView = "month" | "week" | "day";

type ScheduleItem = {
  id: number;
  course_id: number | null;
  topic_id: number | null;
  scheduled_date: string;
  course_title: string | null;
  topic_title: string | null;
  notes: string | null;
  is_completed: boolean;
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

type SortType = "none" | "status" | "course" | "time";

interface TasksCalendarProps {
  date: Date;
  onDateChange: (date: Date) => void;
  schedule: ScheduleItem[];
  assignments: Assignment[];
  onEventClick?: (event: ScheduleItem | Assignment, type: "schedule" | "assignment") => void;
  onToggleComplete?: (id: number, is_completed: boolean) => void;
  sortType?: SortType;
}

export function TasksCalendar({ date, onDateChange, schedule, assignments, onEventClick, onToggleComplete, sortType = "none" }: TasksCalendarProps) {
  const { t, lang } = useLanguage();
  const { theme } = useTheme();

  const locale = lang === "ru" ? "ru-RU" : lang === "kk" ? "kk-KZ" : "en-US";
  const [currentMonth, setCurrentMonth] = useState(new Date(date.getFullYear(), date.getMonth(), 1));
  const [view, setView] = useState<CalendarView>("month");

  // Функция сортировки событий
  const sortEvents = (events: Array<{ title: string; time?: string; color: string; item: ScheduleItem | Assignment; type: "schedule" | "assignment"; is_completed?: boolean }>) => {
    if (sortType === "none") return events;
    
    const sorted = [...events];
    
    if (sortType === "status") {
      sorted.sort((a, b) => {
        const aCompleted = a.is_completed || false;
        const bCompleted = b.is_completed || false;
        if (aCompleted === bCompleted) return 0;
        return aCompleted ? 1 : -1; // Невыполненные сначала
      });
    } else if (sortType === "course") {
      sorted.sort((a, b) => {
        const aTitle = a.type === "schedule" ? (a.item as ScheduleItem).course_title || "" : (a.item as Assignment).course_title || "";
        const bTitle = b.type === "schedule" ? (b.item as ScheduleItem).course_title || "" : (b.item as Assignment).course_title || "";
        return aTitle.localeCompare(bTitle);
      });
    } else if (sortType === "time") {
      sorted.sort((a, b) => {
        const aTime = a.time || "";
        const bTime = b.time || "";
        if (!aTime && !bTime) return 0;
        if (!aTime) return 1;
        if (!bTime) return -1;
        return aTime.localeCompare(bTime);
      });
    }
    
    return sorted;
  };

  // Sync currentMonth with date prop
  useEffect(() => {
    setCurrentMonth(new Date(date.getFullYear(), date.getMonth(), 1));
  }, [date.getFullYear(), date.getMonth()]);

  // Вычисляем дни недели для Week view
  const weekDays = useMemo(() => {
    if (view !== "week") return [];
    const selectedDate = new Date(date);
    const startOfWeek = new Date(selectedDate);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day; // Понедельник = 1, Воскресенье = 0
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0);

    const days: Array<{ 
      date: Date; 
      events: Array<{ title: string; time?: string; color: string; item: ScheduleItem | Assignment; type: "schedule" | "assignment"; is_completed?: boolean }> 
    }> = [];

    for (let i = 0; i < 7; i++) {
      const currentDay = new Date(startOfWeek);
      currentDay.setDate(startOfWeek.getDate() + i);
      const dateStr = `${currentDay.getFullYear()}-${String(currentDay.getMonth() + 1).padStart(2, "0")}-${String(currentDay.getDate()).padStart(2, "0")}`;
      
      const daySchedule = schedule.filter(s => s.scheduled_date === dateStr);
      const dayAssignments = assignments.filter(a => a.deadline && a.deadline.slice(0, 10) === dateStr);
      
      const dayEvents: Array<{ title: string; time?: string; color: string; item: ScheduleItem | Assignment; type: "schedule" | "assignment"; is_completed?: boolean }> = [];
      
      daySchedule.forEach((item, idx) => {
        const courseTitle = item.course_title ? getLocalizedCourseTitle({ title: item.course_title } as any, t) : null;
        const title = courseTitle || item.topic_title || item.notes || t("eventDefault");
        let time: string | undefined;
        if (item.notes) {
          const timeMatch = item.notes.match(/(\d{1,2}\.\d{2}(?:\s*-\s*\d{1,2}\.\d{2})?)/);
          if (timeMatch) time = timeMatch[1];
        }
        const colors = [
          "rgba(156, 163, 175, 0.3)",
          "rgba(251, 191, 36, 0.3)",
          "rgba(252, 165, 165, 0.3)",
          "rgba(196, 181, 253, 0.3)",
        ];
        dayEvents.push({
          title,
          time,
          color: colors[idx % colors.length],
          item,
          type: "schedule",
          is_completed: item.is_completed,
        });
      });
      
      dayAssignments.forEach((assignment) => {
        dayEvents.push({
          title: assignment.title,
          color: "rgba(239, 68, 68, 0.3)",
          item: assignment,
          type: "assignment",
        });
      });
      
      days.push({ date: currentDay, events: sortEvents(dayEvents) });
    }
    
    return days;
  }, [view, date, schedule, assignments, sortType]);

  // Вычисляем один день для Day view
  const dayEvents = useMemo(() => {
    if (view !== "day") return [];
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const daySchedule = schedule.filter(s => s.scheduled_date === dateStr);
    const dayAssignments = assignments.filter(a => a.deadline && a.deadline.slice(0, 10) === dateStr);
    
    const events: Array<{ title: string; time?: string; color: string; item: ScheduleItem | Assignment; type: "schedule" | "assignment"; is_completed?: boolean }> = [];
    
    daySchedule.forEach((item, idx) => {
      const courseTitle = item.course_title ? getLocalizedCourseTitle({ title: item.course_title } as any, t) : null;
      const title = courseTitle || item.topic_title || item.notes || t("eventDefault");
      let time: string | undefined;
      if (item.notes) {
        const timeMatch = item.notes.match(/(\d{1,2}\.\d{2}(?:\s*-\s*\d{1,2}\.\d{2})?)/);
        if (timeMatch) time = timeMatch[1];
      }
      const colors = [
        "rgba(156, 163, 175, 0.3)",
        "rgba(251, 191, 36, 0.3)",
        "rgba(252, 165, 165, 0.3)",
        "rgba(196, 181, 253, 0.3)",
      ];
      events.push({
        title,
        time,
        color: colors[idx % colors.length],
        item,
        type: "schedule",
        is_completed: item.is_completed,
      });
    });
    
    dayAssignments.forEach((assignment) => {
      events.push({
        title: assignment.title,
        color: "rgba(239, 68, 68, 0.3)",
        item: assignment,
        type: "assignment",
      });
    });
    
    return sortEvents(events);
  }, [view, date, schedule, assignments, sortType]);

  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: Array<{ 
      date: number; 
      isCurrentMonth: boolean; 
      events: Array<{ title: string; time?: string; color: string; item: ScheduleItem | Assignment; type: "schedule" | "assignment"; is_completed?: boolean }> 
    }> = [];

    // Previous month days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      days.push({
        date: prevMonthLastDay - i,
        isCurrentMonth: false,
        events: [],
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
      
      // Get schedule items for this date
      const daySchedule = schedule.filter(s => s.scheduled_date === dateStr);
      // Get assignments for this date
      const dayAssignments = assignments.filter(a => a.deadline && a.deadline.slice(0, 10) === dateStr);
      
      const dayEvents: Array<{ title: string; time?: string; color: string; item: ScheduleItem | Assignment; type: "schedule" | "assignment"; is_completed?: boolean }> = [];
      
      // Add schedule items
      daySchedule.forEach((item, idx) => {
        const courseTitle = item.course_title ? getLocalizedCourseTitle({ title: item.course_title } as any, t) : null;
        const title = courseTitle || item.topic_title || item.notes || t("eventDefault");
        // Try to extract time from notes
        let time: string | undefined;
        if (item.notes) {
          const timeMatch = item.notes.match(/(\d{1,2}\.\d{2}(?:\s*-\s*\d{1,2}\.\d{2})?)/);
          if (timeMatch) time = timeMatch[1];
        }
        const colors = [
          "rgba(156, 163, 175, 0.3)", // Light grey
          "rgba(251, 191, 36, 0.3)", // Light yellow
          "rgba(252, 165, 165, 0.3)", // Light pink
          "rgba(196, 181, 253, 0.3)", // Light purple
        ];
        dayEvents.push({
          title,
          time,
          color: colors[idx % colors.length],
          item,
          type: "schedule",
          is_completed: item.is_completed,
        });
      });
      
      // Add assignments
      dayAssignments.forEach((assignment) => {
        const colors = [
          "rgba(239, 68, 68, 0.3)", // Light red for assignments
          "rgba(251, 191, 36, 0.3)", // Light yellow
        ];
        dayEvents.push({
          title: assignment.title,
          color: colors[0],
          item: assignment,
          type: "assignment",
        });
      });
      
      days.push({
        date: i,
        isCurrentMonth: true,
        events: sortEvents(dayEvents),
      });
    }

    // Не добавляем дни следующего месяца - показываем только текущий месяц
    // Пустые ячейки для завершения последней недели (если нужно)
    const totalCells = days.length;
    const rowsNeeded = Math.ceil(totalCells / 7);
    const emptyCells = rowsNeeded * 7 - totalCells;
    
    // Добавляем пустые ячейки только если они нужны для завершения последней недели
    for (let i = 0; i < emptyCells; i++) {
      days.push({
        date: 0, // 0 означает пустую ячейку
        isCurrentMonth: false,
        events: [],
      });
    }

    return days;
  }, [view, currentMonth, schedule, assignments, sortType]);

  const today = new Date();
  const isToday = (date: number) => {
    return (
      date === today.getDate() &&
      currentMonth.getMonth() === today.getMonth() &&
      currentMonth.getFullYear() === today.getFullYear()
    );
  };

  const monthName = `${t(MONTH_KEYS[currentMonth.getMonth()])} ${currentMonth.getFullYear()}`;
  
  const getWeekRange = () => {
    if (view !== "week") return "";
    const start = weekDays[0]?.date;
    const end = weekDays[6]?.date;
    if (!start || !end) return "";
    const startStr = `${start.getDate()} ${t(MONTH_KEYS[start.getMonth()])}`;
    const endStr = `${end.getDate()} ${t(MONTH_KEYS[end.getMonth()])} ${end.getFullYear()}`;
    return `${startStr} - ${endStr}`;
  };

  const navigateMonth = (direction: "prev" | "next") => {
    if (view === "week") {
      const days = direction === "prev" ? -7 : 7;
      const newDate = new Date(date);
      newDate.setDate(date.getDate() + days);
      onDateChange(newDate);
      return;
    }
    if (view === "day") {
      const days = direction === "prev" ? -1 : 1;
      const newDate = new Date(date);
      newDate.setDate(date.getDate() + days);
      onDateChange(newDate);
      return;
    }
    setCurrentMonth((prev) => {
      const newDate = new Date(prev);
      if (direction === "prev") {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const getDayOfWeek = (date: number, isCurrentMonth: boolean) => {
    if (!isCurrentMonth) return -1;
    const testDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), date);
    return testDate.getDay();
  };

  const isWeekend = (date: number, isCurrentMonth: boolean) => {
    const dayOfWeek = getDayOfWeek(date, isCurrentMonth);
    return dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
  };

  const handleDateClick = (dayDate: number, isCurrentMonth: boolean) => {
    if (!isCurrentMonth) return;
    const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), dayDate);
    onDateChange(newDate);
  };

  const isDark = theme === "dark";
  const selectedDay = date.getDate();
  const isSelectedDate = (dayDate: number, isCurrentMonth: boolean) => {
    // Проверяем только дни текущего месяца
    if (!isCurrentMonth || dayDate === 0) return false;
    return (
      dayDate === selectedDay &&
      currentMonth.getMonth() === date.getMonth() &&
      currentMonth.getFullYear() === date.getFullYear()
    );
  };

  const formatFullDate = (d: Date) => {
    const day = d.getDate();
    const month = t(MONTH_KEYS[d.getMonth()]);
    const year = d.getFullYear();
    const weekday = t(WEEKDAY_FULL_KEYS[d.getDay()]);
    
    // Order based on language
    if (lang === "kk") {
      return `${year} жылғы ${day} ${month}, ${weekday}`;
    }
    if (lang === "ru") {
      return `${day} ${month} ${year}, ${weekday}`;
    }
    return `${weekday}, ${month} ${day}, ${year}`;
  };

  return (
    <div 
      className="w-full rounded-2xl overflow-hidden shadow-lg"
      style={{ 
        background: isDark ? "rgba(31, 41, 55, 0.95)" : "#FFFFFF",
        border: isDark ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(0, 0, 0, 0.05)",
      }}
    >
      {/* Top section with view tabs and navigation */}
      <div className="p-4" style={{ background: isDark ? "rgba(17, 24, 39, 0.5)" : "#FFFFFF" }}>
        {/* View tabs */}
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => setView("month")}
            className="px-4 py-2 rounded-full text-sm font-medium transition-all"
            style={{
              background: view === "month" ? "#7C3AED" : (isDark ? "rgba(156, 163, 175, 0.2)" : "rgba(156, 163, 175, 0.15)"),
              color: view === "month" ? "#FFFFFF" : (isDark ? "#9CA3AF" : "#6B7280"),
            }}
          >
            {t("scheduleMonth")}
          </button>
          <button
            type="button"
            onClick={() => setView("week")}
            className="px-4 py-2 rounded-full text-sm font-medium transition-all"
            style={{
              background: view === "week" ? "#7C3AED" : (isDark ? "rgba(156, 163, 175, 0.2)" : "rgba(156, 163, 175, 0.15)"),
              color: view === "week" ? "#FFFFFF" : (isDark ? "#9CA3AF" : "#6B7280"),
            }}
          >
            {t("scheduleWeek")}
          </button>
          <button
            type="button"
            onClick={() => setView("day")}
            className="px-4 py-2 rounded-full text-sm font-medium transition-all"
            style={{
              background: view === "day" ? "#7C3AED" : (isDark ? "rgba(156, 163, 175, 0.2)" : "rgba(156, 163, 175, 0.15)"),
              color: view === "day" ? "#FFFFFF" : (isDark ? "#9CA3AF" : "#6B7280"),
            }}
          >
            {t("scheduleDay")}
          </button>
        </div>

          {/* Month/Week/Day navigation */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 
                className="font-semibold text-lg"
                style={{ 
                  color: isDark ? "#F3F4F6" : "#1F2937",
                }}
              >
                {view === "month" ? monthName : view === "week" ? getWeekRange() : formatFullDate(date)}
              </h3>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => navigateMonth("prev")}
                  className="p-1.5 rounded-full hover:bg-opacity-20 transition-colors"
                  style={{
                    color: isDark ? "#E5E7EB" : "#374151",
                  }}
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => navigateMonth("next")}
                  className="p-1.5 rounded-full hover:bg-opacity-20 transition-colors"
                  style={{
                    color: isDark ? "#E5E7EB" : "#374151",
                  }}
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
      </div>

      {/* Calendar body */}
      <div className="p-4" style={{ background: isDark ? "rgba(17, 24, 39, 0.5)" : "#FFFFFF" }}>
        {view === "day" ? (
          /* Day view */
          <div className="space-y-3">
            <h4 className="text-sm font-semibold mb-3" style={{ color: isDark ? "#E5E7EB" : "#1F2937" }}>
              {formatFullDate(date)}
            </h4>
            {dayEvents.length === 0 ? (
              <p className="text-sm opacity-60 text-center py-8" style={{ color: isDark ? "#9CA3AF" : "#6B7280" }}>
                {t("scheduleNoEventsForDay")}
              </p>
            ) : (
              <div className="space-y-2">
                {dayEvents.map((event, eventIdx) => {
                  const isCompleted = event.is_completed || false;
                  const isSchedule = event.type === "schedule";
                  return (
                    <div
                      key={eventIdx}
                      className="p-3 rounded-lg border"
                      style={{
                        background: isCompleted 
                          ? (isDark ? "rgba(156, 163, 175, 0.1)" : "rgba(156, 163, 175, 0.05)")
                          : event.color,
                        borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
                      }}
                    >
                      <div className="flex items-start gap-3">
                        {isSchedule && onToggleComplete && (
                          <input
                            type="checkbox"
                            checked={isCompleted}
                            onChange={(e) => {
                              const scheduleItem = event.item as ScheduleItem;
                              onToggleComplete(scheduleItem.id, e.target.checked);
                            }}
                            className="w-4 h-4 rounded cursor-pointer mt-0.5 shrink-0"
                            style={{ accentColor: "#7C3AED" }}
                          />
                        )}
                        <div className="flex-1">
                          <button
                            type="button"
                            onClick={() => onEventClick?.(event.item, event.type)}
                            className={`text-sm font-medium w-full text-left hover:opacity-80 transition-opacity ${
                              isCompleted ? "line-through opacity-60" : ""
                            }`}
                            style={{ color: isDark ? "#E5E7EB" : "#1F2937" }}
                          >
                            {event.title}
                          </button>
                          {event.time && (
                            <p className="text-xs mt-1 opacity-75" style={{ color: isDark ? "#9CA3AF" : "#6B7280" }}>
                              {event.time}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : view === "week" ? (
          /* Week view */
          <>
            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-1.5 mb-2">
              {WD_KEYS.map((key, idx) => {
                const isWeekend = idx === 0 || idx === 6;
                return (
                  <div
                    key={key}
                    className="text-xs font-semibold text-center py-2"
                    style={{
                      color: isWeekend 
                        ? (isDark ? "#F87171" : "#EF4444")
                        : (isDark ? "#9CA3AF" : "#6B7280"),
                    }}
                  >
                    {t(key).slice(0, 2).toUpperCase()}
                  </div>
                );
              })}
            </div>
            {/* Week grid */}
            <div className="grid grid-cols-7 gap-1.5">
              {weekDays.map((day, idx) => {
                const dayDate = day.date.getDate();
                const isTodayDate = day.date.toDateString() === today.toDateString();
                const isSelected = day.date.toDateString() === date.toDateString();
                const dayOfWeek = day.date.getDay();
                const isWeekendDay = dayOfWeek === 0 || dayOfWeek === 6;
                
                return (
                  <div
                    key={idx}
                    className="relative min-h-[200px] p-2 rounded-lg border"
                    style={{
                      background: isSelected
                        ? "rgba(124, 58, 237, 0.1)"
                        : "transparent",
                      borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => onDateChange(day.date)}
                      className="w-full flex flex-col items-start"
                    >
                      <div 
                        className="flex items-center justify-center w-7 h-7 rounded-full mb-2 text-sm font-medium"
                        style={{
                          background: isSelected
                            ? "#7C3AED"
                            : isTodayDate && !isSelected
                              ? "rgba(124, 58, 237, 0.2)"
                              : "transparent",
                          color: isSelected
                            ? "#FFFFFF"
                            : isTodayDate && !isSelected
                              ? "#7C3AED"
                              : isWeekendDay
                                ? "#EF4444"
                                : (isDark ? "#E5E7EB" : "#1F2937"),
                        }}
                      >
                        {dayDate}
                      </div>
                    </button>
                    <div className="w-full flex flex-col gap-1 mt-1 overflow-y-auto max-h-[150px]">
                      {day.events.map((event, eventIdx) => {
                        const isCompleted = event.is_completed || false;
                        const isSchedule = event.type === "schedule";
                        return (
                          <div key={eventIdx} className="flex items-center gap-1">
                            {isSchedule && onToggleComplete && (
                              <input
                                type="checkbox"
                                checked={isCompleted}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  const scheduleItem = event.item as ScheduleItem;
                                  onToggleComplete(scheduleItem.id, e.target.checked);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="w-3 h-3 rounded cursor-pointer shrink-0"
                                style={{ accentColor: "#7C3AED" }}
                              />
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onEventClick?.(event.item, event.type);
                              }}
                              className={`text-[10px] px-2 py-1 rounded text-left truncate hover:opacity-80 transition-opacity cursor-pointer flex-1 ${
                                isCompleted ? "line-through opacity-60" : ""
                              }`}
                              style={{
                                background: isCompleted 
                                  ? (isDark ? "rgba(156, 163, 175, 0.15)" : "rgba(156, 163, 175, 0.1)")
                                  : event.color,
                                color: isDark ? "#E5E7EB" : "#1F2937",
                              }}
                              title={event.title}
                            >
                              {event.title}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          /* Month view */
          <>
            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-1.5 mb-2">
              {WD_KEYS.map((key, idx) => {
                const isWeekend = idx === 0 || idx === 6;
                return (
                  <div
                    key={key}
                    className="text-[10px] font-semibold text-center py-1"
                    style={{
                      color: isWeekend 
                        ? (isDark ? "#F87171" : "#EF4444")
                        : (isDark ? "#9CA3AF" : "#6B7280"),
                    }}
                  >
                    {t(key).slice(0, 2).toUpperCase()}
                  </div>
                );
              })}
            </div>
            {/* Calendar grid - компактный широкий */}
            <div className="grid grid-cols-7 gap-1.5">
              {calendarDays.map((day, idx) => {
            // Пропускаем пустые ячейки (date === 0)
            if (day.date === 0) {
              return <div key={idx} className="min-h-[100px]" />;
            }
            
            const weekend = isWeekend(day.date, day.isCurrentMonth);
            const selected = isSelectedDate(day.date, day.isCurrentMonth);
            const todayDate = isToday(day.date) && day.isCurrentMonth;

            return (
              <div
                key={idx}
                className="relative min-h-[100px] p-1 rounded-lg transition-all"
                style={{
                  background: selected
                    ? "rgba(124, 58, 237, 0.1)"
                    : "transparent",
                }}
              >
                <button
                  type="button"
                  onClick={() => handleDateClick(day.date, day.isCurrentMonth)}
                  disabled={!day.isCurrentMonth}
                  className={`w-full h-full flex flex-col items-start p-1 rounded-lg transition-all ${
                    !day.isCurrentMonth ? "opacity-30 cursor-not-allowed" : "cursor-pointer hover:bg-opacity-5"
                  }`}
                  style={{
                    color: selected
                      ? "#7C3AED"
                      : !day.isCurrentMonth
                        ? isDark ? "#4B5563" : "#D1D5DB"
                        : weekend
                          ? "#EF4444"
                          : isDark
                            ? "#E5E7EB"
                            : "#1F2937",
                  }}
                >
                  {/* Date number */}
                  <div className="flex items-center justify-center w-6 h-6 rounded-full mb-0.5 text-xs font-medium shrink-0"
                    style={{
                      background: selected
                        ? "#7C3AED"
                        : todayDate && !selected
                          ? "rgba(124, 58, 237, 0.2)"
                          : "transparent",
                      color: selected
                        ? "#FFFFFF"
                        : todayDate && !selected
                          ? "#7C3AED"
                          : "inherit",
                    }}
                  >
                    {day.date}
                  </div>

                  {/* Events - прокручиваемый контейнер */}
                  <div className="w-full flex flex-col gap-0.5 mt-0.5 flex-1 min-h-0 overflow-y-auto max-h-[60px]">
                    {day.events.map((event, eventIdx) => {
                      const isCompleted = event.is_completed || false;
                      const isSchedule = event.type === "schedule";
                      return (
                        <div
                          key={eventIdx}
                          className="flex items-center gap-1 shrink-0"
                        >
                          {isSchedule && onToggleComplete && (
                            <input
                              type="checkbox"
                              checked={isCompleted}
                              onChange={(e) => {
                                e.stopPropagation();
                                const scheduleItem = event.item as ScheduleItem;
                                onToggleComplete(scheduleItem.id, e.target.checked);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="w-3 h-3 rounded cursor-pointer shrink-0"
                              style={{
                                accentColor: "#7C3AED",
                              }}
                            />
                          )}
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              onEventClick?.(event.item, event.type);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                e.stopPropagation();
                                onEventClick?.(event.item, event.type);
                              }
                            }}
                            className={`text-[10px] px-1.5 py-0.5 rounded text-left truncate hover:opacity-80 transition-opacity cursor-pointer flex-1 ${
                              isCompleted ? "line-through opacity-60" : ""
                            }`}
                            style={{
                              background: isCompleted 
                                ? (isDark ? "rgba(156, 163, 175, 0.15)" : "rgba(156, 163, 175, 0.1)")
                                : event.color,
                              color: isDark ? "#E5E7EB" : "#1F2937",
                            }}
                            title={event.title}
                          >
                            {event.title}
                            {event.time && <span className="ml-1 opacity-75 text-[9px]">{event.time}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </button>
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
