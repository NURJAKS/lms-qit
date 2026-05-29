"use client";

import { useState, useMemo } from "react";
import { Search, Plus, X, Clock, MapPin } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useLanguage } from "@/context/LanguageContext";
import { MiniCalendar } from "./MiniCalendar";
import { EventCard } from "./EventCard";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { BlurFade } from "@/components/ui/blur-fade";
import { cn } from "@/lib/utils";
import { getLocalizedCourseTitle } from "@/lib/courseUtils";

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
  deadline: string | null;
  submitted: boolean;
};

interface EventSidebarProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  schedule: ScheduleItem[];
  assignments: Assignment[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onAddClick: () => void;
  showAddForm: boolean;
  onEventClick?: (item: ScheduleItem | Assignment) => void;
}

type EventType = "reminders" | "event";

export function EventSidebar({
  selectedDate,
  onDateSelect,
  schedule,
  assignments,
  searchQuery,
  onSearchChange,
  onAddClick,
  showAddForm,
  onEventClick,
}: EventSidebarProps) {
  const { user } = useAuthStore();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<EventType>("event");
  const [showForFilter, setShowForFilter] = useState(false);

  const dateStr = selectedDate.toISOString().slice(0, 10);
  const itemsForDate = schedule.filter((s) => s.scheduled_date === dateStr);
  const assignmentsForDate = assignments.filter(
    (a) => a.deadline && a.deadline.slice(0, 10) === dateStr
  );

  // Combine and filter events
  const allEvents = useMemo(() => {
    const events: Array<ScheduleItem | Assignment> = [...itemsForDate, ...assignmentsForDate];
    
    if (!searchQuery.trim()) return events;
    
    const query = searchQuery.toLowerCase();
    return events.filter((event) => {
      if ("title" in event) {
        return event.title.toLowerCase().includes(query);
      } else {
        const courseTitle = event.course_title ? getLocalizedCourseTitle({ title: event.course_title } as any, t) : null;
        const label = [
          courseTitle,
          event.topic_title,
          event.notes,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return label.includes(query);
      }
    });
  }, [itemsForDate, assignmentsForDate, searchQuery]);

  const eventsByDate = useMemo(() => {
    const set = new Set<string>();
    schedule.forEach((s) => set.add(s.scheduled_date));
    assignments.forEach((a) => {
      if (a.deadline) set.add(a.deadline.slice(0, 10));
    });
    return set;
  }, [schedule, assignments]);

  const getEventColor = (event: ScheduleItem | Assignment, index: number): "gray" | "yellow" | "pink" | "purple" | "red" => {
    if ("title" in event) {
      return "red"; // Assignments are red
    }
    
    const colors: Array<"gray" | "yellow" | "pink" | "purple"> = ["gray", "yellow", "pink", "purple"];
    return colors[index % colors.length];
  };

  const getEventTitle = (event: ScheduleItem | Assignment): string => {
    if ("title" in event) {
      return event.title;
    }
    const parts: string[] = [];
    if (event.course_title) parts.push(getLocalizedCourseTitle({ title: event.course_title } as any, t));
    if (event.topic_title) parts.push(event.topic_title);
    if (event.notes) parts.push(event.notes);
    return parts.join(" ") || `Event #${event.id}`;
  };

  const getEventTime = (event: ScheduleItem | Assignment): string | undefined => {
    if ("title" in event) {
      return undefined;
    }
    // Try to extract time from notes (format: "Event 10.00 - 11.00" or "Event 10.00")
    if (event.notes) {
      const timeMatch = event.notes.match(/(\d{1,2}\.\d{2}(?:\s*-\s*\d{1,2}\.\d{2})?)/);
      if (timeMatch) return timeMatch[1];
    }
    return undefined;
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 min-h-[600px] lg:min-h-0">
      {/* Search Bar */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder={t("searchEventsPlaceholder")}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className={cn(
              "w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600",
              "bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white",
              "placeholder:text-gray-400 dark:placeholder:text-gray-500",
              "focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:border-transparent",
              "transition-all duration-200"
            )}
          />
        </div>
      </div>

      {/* For Filter */}
      {showForFilter && (
        <BlurFade>
          <div className="px-4 py-2 bg-[#7C3AED] text-white flex items-center justify-between">
            <span className="text-sm font-medium">{t("filterFor")}</span>
            <button
              type="button"
              onClick={() => setShowForFilter(false)}
              className="p-1 hover:bg-white/20 rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </BlurFade>
      )}

      {/* Add Button and Tabs */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2 flex-wrap flex-shrink-0">
        <ShimmerButton
          onClick={onAddClick}
          background="linear-gradient(135deg, #7C3AED 0%, #A855F7 100%)"
          shimmerColor="#ffffff"
          className="px-4 py-2 text-sm font-medium"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          {t("addButton")}
        </ShimmerButton>
        <div className="flex gap-1 ml-auto">
          <button
            type="button"
            onClick={() => setActiveTab("reminders")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
              activeTab === "reminders"
                ? "bg-[#7C3AED] text-white"
                : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
            )}
          >
            {t("remindersTab")}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("event")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
              activeTab === "event"
                ? "bg-[#7C3AED] text-white"
                : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
            )}
          >
            {t("eventTab")}
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Mini Calendar */}
        <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-4">
          <MiniCalendar
            selectedDate={selectedDate}
            onDateSelect={onDateSelect}
            eventsByDate={eventsByDate}
          />
        </div>

        {/* Events List */}
        {allEvents.length > 0 ? (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              {t("scheduleMyPlannedTasks")}
            </h3>
            {allEvents.map((event, index) => (
              <div
                key={"title" in event ? `assignment-${event.id}` : `schedule-${event.id}`}
                onClick={() => onEventClick?.(event)}
                className="cursor-pointer"
              >
                <EventCard
                  title={getEventTitle(event)}
                  time={getEventTime(event)}
                  color={getEventColor(event, index)}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
              <Clock className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500 dark:text-gray-400 font-medium">
              {t("scheduleNoTasks")}
            </p>
            <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
              {t("scheduleAddHint")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
