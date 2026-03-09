"use client";

import { useState, useMemo, useRef } from "react";
import Link from "next/link";
import { Calendar, HelpCircle, FolderCode, Code, MoreVertical, ChevronLeft, ChevronRight } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useTheme } from "@/context/ThemeContext";
import { getGlassCardStyle, getTextColors } from "@/utils/themeStyles";
import { getLocalizedCourseTitle } from "@/lib/courseUtils";

const ICON_COLORS = [
  "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400",
  "bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400",
  "bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400",
  "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400",
];

const iconByNotes = (notes: string | null) => {
  if (!notes) return Calendar;
  const n = (notes || "").toLowerCase();
  if (n.includes("quiz") || n.includes("тест")) return HelpCircle;
  if (n.includes("homework") || n.includes("тапсырма")) return FolderCode;
  if (n.includes("code") || n.includes("код")) return Code;
  return Calendar;
};

const WD_KEYS = ["wdSun", "wdMon", "wdTue", "wdWed", "wdThu", "wdFri", "wdSat"] as const;

function getDatePills(count = 14): Array<{ date: string; day: string; weekdayKey: string }> {
  const today = new Date();
  const pills: Array<{ date: string; day: string; weekdayKey: string }> = [];
  // Start from 3 days ago to show more context
  for (let i = -3; i < count - 3; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    pills.push({
      date: d.toISOString().slice(0, 10),
      day: d.getDate().toString(),
      weekdayKey: WD_KEYS[d.getDay()],
    });
  }
  return pills;
}

const todayStr = () => new Date().toISOString().slice(0, 10);

export function EventsWidget() {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const glassStyle = getGlassCardStyle(theme);
  const textColors = getTextColors(theme);
  const datePills = useMemo(() => getDatePills(14), []);
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const { data: events = [] } = useQuery({
    queryKey: ["dashboard-events"],
    queryFn: async () => {
      const { data } = await api.get<Array<{
        id: number;
        scheduled_date: string;
        notes: string | null;
        course_title: string | null;
        topic_title: string | null;
        is_completed: boolean;
      }>>("/dashboard/events");
      return data;
    },
  });

  const filteredEvents = events.filter((e) => e.scheduled_date === selectedDate);

  const scrollDates = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      const scrollAmount = 200;
      scrollContainerRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  return (
    <div className="h-full flex flex-col rounded-2xl border-0 shadow-lg overflow-hidden bg-white dark:bg-gray-800" style={{ boxShadow: "0 4px 20px rgba(0, 0, 0, 0.08)" }}>
      {/* Header with gradient */}
      <div className="relative p-2.5 text-white flex items-center justify-between overflow-hidden" style={{ background: "linear-gradient(135deg, #7c3aed 0%, #3b82f6 100%)" }}>
        {/* Decorative background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white rounded-full blur-2xl" />
        </div>
        <h3 className="relative font-bold text-sm">{t("events")}</h3>
        <button type="button" className="relative p-1 rounded-lg hover:bg-white/20 transition-colors" aria-label={t("ariaOptions")}>
          <MoreVertical className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 flex flex-col p-2 bg-white dark:bg-gray-800">
        {/* Date selection with scroll */}
        <div className="relative mb-2">
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1.5 -mx-1 px-1" ref={scrollContainerRef} style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
            {datePills.map((p) => {
              const isSelected = selectedDate === p.date;
              const isToday = p.date === todayStr();
              return (
                <button
                  key={p.date}
                  type="button"
                  onClick={() => setSelectedDate(p.date)}
                  className={`shrink-0 flex flex-col items-center justify-center min-w-[44px] py-1 px-1 rounded-lg text-xs font-medium transition-all duration-200 ${
                    isSelected ? "" : "hover:scale-102"
                  }`}
                  style={
                    isSelected
                      ? {
                          background: "linear-gradient(135deg, #7c3aed 0%, #3b82f6 100%)",
                          color: "#FFFFFF",
                          boxShadow: "0 4px 12px rgba(124, 58, 237, 0.4)",
                        }
                      : {
                          background: theme === "dark" ? "rgba(156, 163, 175, 0.1)" : "rgba(156, 163, 175, 0.15)",
                          color: theme === "dark" ? "#9CA3AF" : "#6B7280",
                          border: `1px solid ${theme === "dark" ? "rgba(156, 163, 175, 0.2)" : "rgba(156, 163, 175, 0.3)"}`,
                        }
                  }
                >
                  <span className="text-[9px] font-medium mb-0.5 opacity-90">{t(p.weekdayKey as import("@/i18n/translations").TranslationKey)}</span>
                  <span className={`text-xs font-bold ${isSelected ? "text-white" : ""}`}>{p.day}</span>
                </button>
              );
            })}
          </div>
          
          {/* Scroll arrows */}
          <button
            type="button"
            onClick={() => scrollDates("left")}
            className="absolute left-0 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white dark:bg-gray-700 shadow-md flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors z-10"
            style={{ boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)" }}
          >
            <ChevronLeft className="w-3 h-3" style={{ color: textColors.primary }} />
          </button>
          <button
            type="button"
            onClick={() => scrollDates("right")}
            className="absolute right-0 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white dark:bg-gray-700 shadow-md flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors z-10"
            style={{ boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)" }}
          >
            <ChevronRight className="w-3 h-3" style={{ color: textColors.primary }} />
          </button>
        </div>

        {/* Events list */}
        <div className={`flex-1 min-h-[50px] mb-2 ${filteredEvents.length === 0 ? 'flex items-center justify-center' : 'space-y-1'}`}>
          {filteredEvents.length === 0 ? (
            <p className="text-xs text-center font-medium" style={{ color: textColors.secondary }}>
              {events.length === 0 ? t("eventsNoScheduled") : t("eventsNoEventsForDate")}
            </p>
          ) : (
            filteredEvents.slice(0, 5).map((e, idx) => {
              const Icon = iconByNotes(e.notes);
              const courseTitle = e.course_title ? getLocalizedCourseTitle({ title: e.course_title } as any, t) : null;
              const title = e.notes || e.topic_title || courseTitle || t("eventDefault");
              const subtitle = e.topic_title && e.notes ? e.notes : courseTitle || e.scheduled_date;
              const colorClass = ICON_COLORS[idx % ICON_COLORS.length];
              return (
                <Link
                  key={e.id}
                  href="/app/tasks-calendar"
                  className="flex items-start gap-1.5 p-1.5 rounded-lg hover:opacity-80 transition-all group"
                  style={{
                    background: theme === "dark" ? "rgba(30, 41, 59, 0.3)" : "rgba(0, 0, 0, 0.02)",
                    border: `1px solid ${theme === "dark" ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)"}`,
                  }}
                >
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${colorClass}`}>
                    <Icon className="w-3 h-3" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold truncate group-hover:text-[#7c3aed] transition-colors" style={{ color: textColors.primary }}>
                      {title}
                    </p>
                    <p className="text-[10px] mt-0.5 line-clamp-1" style={{ color: textColors.secondary }}>
                      {subtitle}
                    </p>
                  </div>
                </Link>
              );
            })
          )}
        </div>

        {/* View All link */}
        <Link
          href="/app/tasks-calendar"
          className="flex items-center justify-center w-full py-1.5 rounded-xl font-semibold text-[10px] transition-all hover:opacity-80"
          style={{
            color: theme === "dark" ? "#3b82f6" : "#3b82f6",
            background: theme === "dark" ? "transparent" : "rgba(59, 130, 246, 0.1)",
            border: theme === "dark" ? "none" : "1px solid rgba(59, 130, 246, 0.2)",
          }}
        >
          {t("viewAll")}
        </Link>
      </div>
    </div>
  );
}
