"use client";

import { Filter, X } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

type Course = { id: number; title: string };

interface CalendarFiltersProps {
  courses: Course[];
  selectedCourseId: number | "";
  selectedStatus: "all" | "completed" | "pending";
  dateFrom: string;
  dateTo: string;
  sortType: "none" | "status" | "course" | "time";
  onCourseChange: (courseId: number | "") => void;
  onStatusChange: (status: "all" | "completed" | "pending") => void;
  onDateFromChange: (date: string) => void;
  onDateToChange: (date: string) => void;
  onSortChange: (sortType: "none" | "status" | "course" | "time") => void;
  onClear: () => void;
}

export function CalendarFilters({
  courses,
  selectedCourseId,
  selectedStatus,
  dateFrom,
  dateTo,
  sortType,
  onCourseChange,
  onStatusChange,
  onDateFromChange,
  onDateToChange,
  onSortChange,
  onClear,
}: CalendarFiltersProps) {
  const { t } = useLanguage();
  const hasFilters = selectedCourseId !== "" || selectedStatus !== "all" || dateFrom !== "" || dateTo !== "";

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-white flex items-center gap-2">
          <Filter className="w-4 h-4" />
          {t("scheduleFilters")}
        </h3>
        {hasFilters && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-[#7C3AED] hover:opacity-80 flex items-center gap-1"
          >
            <X className="w-3 h-3" />
            {t("scheduleClearFilters")}
          </button>
        )}
      </div>

      {/* Course filter */}
      <div>
        <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">
          {t("assignmentCourse")}
        </label>
        <select
          value={selectedCourseId}
          onChange={(e) => onCourseChange(e.target.value === "" ? "" : Number(e.target.value))}
          className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
        >
          <option value="">{t("scheduleAllCourses")}</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.title}
            </option>
          ))}
        </select>
      </div>

      {/* Status filter */}
      <div>
        <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">
          {t("scheduleStatus")}
        </label>
        <select
          value={selectedStatus}
          onChange={(e) => onStatusChange(e.target.value as "all" | "completed" | "pending")}
          className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
        >
          <option value="all">{t("scheduleAllStatus" as any)}</option>
          <option value="completed">{t("scheduleCompleted" as any)}</option>
          <option value="pending">{t("schedulePending" as any)}</option>
        </select>
      </div>

      {/* Date range filters */}
      <div className="space-y-2">
        <div>
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">
            {t("scheduleDateFrom")}
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">
            {t("scheduleDateTo")}
          </label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => onDateToChange(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
          />
        </div>
      </div>

      {/* Sort */}
      <div>
        <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">
          {t("scheduleSort")}
        </label>
        <select
          value={sortType}
          onChange={(e) => onSortChange(e.target.value as "none" | "status" | "course" | "time")}
          className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
        >
          <option value="none">{t("scheduleSortNone")}</option>
          <option value="status">{t("scheduleSortByStatus")}</option>
          <option value="course">{t("scheduleSortByCourse")}</option>
          <option value="time">{t("scheduleSortByTime")}</option>
        </select>
      </div>
    </div>
  );
}
