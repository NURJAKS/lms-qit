"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";

const WD_KEYS = ["wdSun", "wdMon", "wdTue", "wdWed", "wdThu", "wdFri", "wdSat"] as const;
const MONTH_KEYS = ["monthJan", "monthFeb", "monthMar", "monthApr", "monthMay", "monthJun", "monthJul", "monthAug", "monthSep", "monthOct", "monthNov", "monthDec"] as const;

interface MiniCalendarProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  eventsByDate?: Set<string>;
}

export function MiniCalendar({ selectedDate, onDateSelect, eventsByDate = new Set() }: MiniCalendarProps) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const [currentMonth, setCurrentMonth] = useState(
    new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
  );

  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: Array<{ date: number; isCurrentMonth: boolean; dateStr: string }> = [];

    // Previous month days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const date = prevMonthLastDay - i;
      const prevMonth = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      days.push({
        date,
        isCurrentMonth: false,
        dateStr: `${prevYear}-${String(prevMonth + 1).padStart(2, "0")}-${String(date).padStart(2, "0")}`,
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        date: i,
        isCurrentMonth: true,
        dateStr: `${year}-${String(month + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`,
      });
    }

    // Next month days to fill the grid
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      const nextMonth = month === 11 ? 0 : month + 1;
      const nextYear = month === 11 ? year + 1 : year;
      days.push({
        date: i,
        isCurrentMonth: false,
        dateStr: `${nextYear}-${String(nextMonth + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`,
      });
    }

    return days;
  }, [currentMonth]);

  const today = new Date();
  const isToday = (date: number, isCurrentMonth: boolean) => {
    return (
      isCurrentMonth &&
      date === today.getDate() &&
      currentMonth.getMonth() === today.getMonth() &&
      currentMonth.getFullYear() === today.getFullYear()
    );
  };

  const isSelected = (date: number, isCurrentMonth: boolean) => {
    return (
      isCurrentMonth &&
      date === selectedDate.getDate() &&
      currentMonth.getMonth() === selectedDate.getMonth() &&
      currentMonth.getFullYear() === selectedDate.getFullYear()
    );
  };

  const handleDateClick = (dayDate: number, isCurrentMonth: boolean, dateStr: string) => {
    if (!isCurrentMonth) return;
    const [year, month, day] = dateStr.split("-").map(Number);
    onDateSelect(new Date(year, month - 1, day));
  };

  const navigateMonth = (direction: "prev" | "next") => {
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

  const monthName = `${t(MONTH_KEYS[currentMonth.getMonth()])} ${currentMonth.getFullYear()}`;
  const isDark = theme === "dark";

  return (
    <div className="w-full">
      {/* Navigation */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <button
          type="button"
          onClick={() => navigateMonth("prev")}
          className={cn(
            "p-1 rounded-lg transition-colors",
            isDark ? "hover:bg-gray-700/50" : "hover:bg-gray-100"
          )}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className={cn("text-sm font-semibold", isDark ? "text-gray-200" : "text-gray-700")}>
          {monthName}
        </span>
        <button
          type="button"
          onClick={() => navigateMonth("next")}
          className={cn(
            "p-1 rounded-lg transition-colors",
            isDark ? "hover:bg-gray-700/50" : "hover:bg-gray-100"
          )}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {WD_KEYS.map((key) => (
          <div
            key={key}
            className={cn(
              "text-[10px] font-semibold text-center py-1",
              isDark ? "text-gray-400" : "text-gray-500"
            )}
          >
            {t(key).slice(0, 2).toUpperCase()}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day, idx) => {
          const todayDate = isToday(day.date, day.isCurrentMonth);
          const selected = isSelected(day.date, day.isCurrentMonth);
          const hasEvents = eventsByDate.has(day.dateStr);

          return (
            <button
              key={idx}
              type="button"
              onClick={() => handleDateClick(day.date, day.isCurrentMonth, day.dateStr)}
              disabled={!day.isCurrentMonth}
              className={cn(
                "relative aspect-square rounded-lg text-xs font-medium transition-all duration-200",
                "flex items-center justify-center",
                !day.isCurrentMonth && "opacity-30 cursor-not-allowed",
                day.isCurrentMonth && "hover:bg-opacity-20 cursor-pointer",
                selected
                  ? "bg-[#7C3AED] text-white shadow-md"
                  : todayDate && !selected
                    ? "bg-[#7C3AED]/20 text-[#7C3AED]"
                    : day.isCurrentMonth
                      ? isDark
                        ? "text-gray-300 hover:bg-gray-700/30"
                        : "text-gray-700 hover:bg-gray-100"
                      : ""
              )}
            >
              {day.date}
              {hasEvents && !selected && (
                <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 rounded-full bg-[#7C3AED]" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
