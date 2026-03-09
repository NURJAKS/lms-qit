"use client";

import { useLanguage } from "@/context/LanguageContext";
import { cn } from "@/lib/utils";

type Topic = { id: number; title: string };

interface AddTaskPanelProps {
  selectedDate: Date;
  courseId: number | "";
  topicId: number | "";
  notes: string;
  error: string;
  courses: Array<{ id: number; title: string }>;
  topics: Topic[];
  isPending: boolean;
  onCourseChange: (courseId: number | "") => void;
  onTopicChange: (topicId: number | "") => void;
  onNotesChange: (notes: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function AddTaskPanel({
  selectedDate,
  courseId,
  topicId,
  notes,
  error,
  courses,
  topics,
  isPending,
  onCourseChange,
  onTopicChange,
  onNotesChange,
  onSubmit,
  onCancel,
}: AddTaskPanelProps) {
  const { t } = useLanguage();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 h-fit">
      <h2 className="font-semibold text-gray-800 dark:text-white text-lg mb-4">
        {t("scheduleAddTask")}
      </h2>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <select
            value={courseId}
            onChange={(e) => onCourseChange(Number(e.target.value) || "")}
            className={cn(
              "w-full border dark:border-gray-600 rounded-lg px-3 py-2.5",
              "dark:bg-gray-700 dark:text-white",
              "focus:ring-2 focus:ring-[var(--qit-primary)] focus:border-[var(--qit-primary)]",
              "transition-colors"
            )}
          >
            <option value="">{t("scheduleSelectCourse")}</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>

        {courseId && topics.length > 0 && (
          <div>
            <select
              value={topicId}
              onChange={(e) => onTopicChange(Number(e.target.value) || "")}
              className={cn(
                "w-full border dark:border-gray-600 rounded-lg px-3 py-2.5",
                "dark:bg-gray-700 dark:text-white",
                "focus:ring-2 focus:ring-[var(--qit-primary)]",
                "transition-colors"
              )}
            >
              <option value="">{t("scheduleSelectTopic")}</option>
              {topics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.title}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <input
            type="text"
            placeholder={t("scheduleNotes")}
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            className={cn(
              "w-full border dark:border-gray-600 rounded-lg px-3 py-2.5",
              "dark:bg-gray-700 dark:text-white",
              "focus:ring-2 focus:ring-[var(--qit-primary)]",
              "transition-colors"
            )}
          />
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onSubmit}
            disabled={isPending}
            className={cn(
              "py-2.5 px-5 rounded-lg text-white font-medium",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "transition-all hover:opacity-90"
            )}
            style={{ background: "var(--qit-primary)" }}
          >
            {t("scheduleAdd")}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className={cn(
              "py-2.5 px-5 rounded-lg border dark:border-gray-600",
              "hover:bg-gray-100 dark:hover:bg-gray-700",
              "text-gray-700 dark:text-gray-300",
              "transition-colors"
            )}
          >
            {t("cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
