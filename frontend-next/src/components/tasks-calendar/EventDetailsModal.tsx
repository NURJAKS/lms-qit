"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, Calendar, BookOpen, FileText, Trash2, CheckCircle2, Circle, Pencil, Save } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { api } from "@/api/client";
import { cn } from "@/lib/utils";
import { getLocalizedCourseTitle, getLocalizedTopicTitle } from "@/lib/courseUtils";
import { DeleteConfirmButton } from "@/components/ui/DeleteConfirmButton";
import { formatLocalizedDate } from "@/utils/dateUtils";


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
};

type Topic = { id: number; title: string };
type Course = { id: number; title: string };

interface EventDetailsModalProps {
  event: ScheduleItem | Assignment;
  type: "schedule" | "assignment";
  onClose: () => void;
  onToggleComplete?: (id: number, is_completed: boolean) => void;
  onDelete?: (id: number) => void;
  onUpdate?: (id: number, data: { course_id?: number | null; topic_id?: number | null; scheduled_date?: string; notes?: string | null }) => void;
  courses?: Course[];
  topics?: Topic[];
  isUpdating?: boolean;
}

export function EventDetailsModal({
  event,
  type,
  onClose,
  onToggleComplete,
  onDelete,
  onUpdate,
  courses = [],
  topics = [],
  isUpdating = false,
}: EventDetailsModalProps) {
  const { t, lang } = useLanguage();

  const [isEditing, setIsEditing] = useState(false);
  const [editCourseId, setEditCourseId] = useState<number | "">(type === "schedule" ? (event as ScheduleItem).course_id || "" : "");
  const [editTopicId, setEditTopicId] = useState<number | "">(type === "schedule" ? (event as ScheduleItem).topic_id || "" : "");
  const [editNotes, setEditNotes] = useState(type === "schedule" ? (event as ScheduleItem).notes || "" : "");
  const [editDate, setEditDate] = useState(type === "schedule" ? (event as ScheduleItem).scheduled_date : "");

  // Загружаем темы для выбранного курса при редактировании
  const { data: editCourseStructure } = useQuery({
    queryKey: ["course-structure", editCourseId],
    queryFn: async () => {
      if (!editCourseId) return null;
      const { data } = await api.get<{ modules: Array<{ topics: Topic[] }> }>(`/courses/${editCourseId}/structure`);
      return data;
    },
    enabled: !!editCourseId && isEditing,
  });

  const editTopicsForSelect: Topic[] = editCourseStructure?.modules?.flatMap((m) => m.topics ?? []) ?? [];

  // Сбрасываем topicId при изменении courseId
  useEffect(() => {
    if (isEditing && editCourseId !== (type === "schedule" ? (event as ScheduleItem).course_id || "" : "")) {
      setEditTopicId("");
    }
  }, [editCourseId, isEditing]);

  // Sync edit form fields when event prop updates (e.g. after refetch) and form is closed
  useEffect(() => {
    if (!isEditing && type === "schedule") {
      const item = event as ScheduleItem;
      setEditCourseId(item.course_id || "");
      setEditTopicId(item.topic_id || "");
      setEditNotes(item.notes || "");
      setEditDate(item.scheduled_date);
    }
  }, [event, type, isEditing]);

  const isSchedule = type === "schedule";
  const scheduleItem = isSchedule ? (event as ScheduleItem) : null;
  const assignment = !isSchedule ? (event as Assignment) : null;

  const formatDate = (dateStr: string) => formatLocalizedDate(dateStr, lang as any, t);


  const handleSave = () => {
    if (!isSchedule || !onUpdate) return;
    onUpdate(scheduleItem!.id, {
      course_id: editCourseId === "" ? null : (editCourseId as number),
      topic_id: editTopicId === "" ? null : (editTopicId as number),
      scheduled_date: editDate,
      notes: editNotes.trim() || null,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditCourseId(type === "schedule" ? (event as ScheduleItem).course_id || "" : "");
    setEditTopicId(type === "schedule" ? (event as ScheduleItem).topic_id || "" : "");
    setEditNotes(type === "schedule" ? (event as ScheduleItem).notes || "" : "");
    setEditDate(type === "schedule" ? (event as ScheduleItem).scheduled_date : "");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
            {isSchedule ? t("scheduleTaskDetails") : t("assignmentDetails")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {isEditing && isSchedule ? (
            /* Edit mode */
            <>
              {/* Date */}
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-[#7C3AED] mt-0.5 shrink-0" />
                <div className="flex-1">
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400 block mb-1">
                    {t("scheduleDate")}
                  </label>
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                  />
                </div>
              </div>

              {/* Course */}
              <div className="flex items-start gap-3">
                <BookOpen className="w-5 h-5 text-[#7C3AED] mt-0.5 shrink-0" />
                <div className="flex-1">
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400 block mb-1">
                    {t("assignmentCourse")} ({t("scheduleOptional")})
                  </label>
                  <select
                    value={editCourseId}
                    onChange={(e) => {
                      setEditCourseId(e.target.value === "" ? "" : Number(e.target.value));
                      setEditTopicId(""); // Reset topic when course changes
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                  >
                    <option value="">{t("scheduleSelectCourse")}</option>
                    {courses.map((course) => (
                      <option key={course.id} value={course.id}>
                        {getLocalizedCourseTitle(course as any, t)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Topic */}
              {editCourseId && (
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 text-[#7C3AED] mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400 block mb-1">
                      {t("scheduleSelectTopic")} ({t("scheduleOptional")})
                    </label>
                    <select
                      value={editTopicId}
                      onChange={(e) => setEditTopicId(e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                    >
                      <option value="">{t("scheduleSelectTopic")}</option>
                      {editTopicsForSelect.map((topic) => (
                        <option key={topic.id} value={topic.id}>
                          {getLocalizedTopicTitle(topic.title, t)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div className="flex items-start gap-3">
                <FileText className="w-5 h-5 text-[#7C3AED] mt-0.5 shrink-0" />
                <div className="flex-1">
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400 block mb-1">
                    {t("scheduleNotes")}
                  </label>
                  <textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white resize-none"
                    placeholder={t("scheduleNotesPlaceholder")}
                  />
                </div>
              </div>

              {/* Edit actions */}
              <div className="flex items-center gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isUpdating}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#7C3AED] text-white hover:bg-[#6D28D9] transition-colors disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span className="text-sm font-medium">{t("scheduleSave")}</span>
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={isUpdating}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
                >
                  <span className="text-sm font-medium">{t("scheduleCancel")}</span>
                </button>
              </div>
            </>
          ) : (
            /* View mode */
            <>
              {/* Date */}
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-[#7C3AED] mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    {t("scheduleDate")}
                  </p>
                  <p className="text-gray-800 dark:text-white">
                    {formatDate(isSchedule ? scheduleItem!.scheduled_date : assignment!.deadline!)}
                  </p>
                </div>
              </div>

              {/* Course */}
              {(isSchedule ? scheduleItem!.course_title : assignment!.course_title) && (
                <div className="flex items-start gap-3">
                  <BookOpen className="w-5 h-5 text-[#7C3AED] mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      {t("assignmentCourse")}
                    </p>
                    <p className="text-gray-800 dark:text-white">
                      {isSchedule 
                        ? getLocalizedCourseTitle({ title: scheduleItem!.course_title } as any, t) 
                        : getLocalizedCourseTitle({ title: assignment!.course_title } as any, t)}
                    </p>
                  </div>
                </div>
              )}

              {/* Topic */}
              {isSchedule && scheduleItem!.topic_title && (
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 text-[#7C3AED] mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      {t("scheduleSelectTopic")}
                    </p>
                    <p className="text-gray-800 dark:text-white">{getLocalizedTopicTitle(scheduleItem!.topic_title, t)}</p>
                  </div>
                </div>
              )}

              {/* Title/Notes */}
              <div className="flex items-start gap-3">
                <FileText className="w-5 h-5 text-[#7C3AED] mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                    {isSchedule ? t("scheduleNotes") : t("assignmentTopic")}
                  </p>
                  <p className="text-gray-800 dark:text-white whitespace-pre-wrap break-words">
                    {isSchedule ? (scheduleItem!.notes || "-") : assignment!.title}
                  </p>
                </div>
              </div>
            </>
          )}

          {/* Assignment Description */}
          {!isSchedule && assignment!.description && (
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-[#7C3AED] mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                  {t("assignmentCriteria")}
                </p>
                <div
                  className="text-gray-800 dark:text-white prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: assignment!.description }}
                />
              </div>
            </div>
          )}

          {/* Actions */}
          {isSchedule && scheduleItem && !isEditing && (
            <div className="flex items-center gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              {onUpdate && (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                  <span className="text-sm font-medium">{t("scheduleEdit")}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  onToggleComplete?.(scheduleItem.id, !scheduleItem.is_completed);
                }}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors",
                  scheduleItem.is_completed
                    ? "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                )}
              >
                {scheduleItem.is_completed ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <Circle className="w-4 h-4" />
                )}
                <span className="text-sm font-medium">
                  {scheduleItem.is_completed ? t("scheduleCompleted") : t("scheduleMarkComplete")}
                </span>
              </button>
              {onDelete && (
                <DeleteConfirmButton
                  onDelete={() => onDelete(scheduleItem.id)}
                  isLoading={isUpdating}
                  text={t("scheduleDelete")}
                  title={`${t("scheduleDelete")}?`}
                  description={t("confirmDelete")}
                />
              )}
            </div>
          )}

          {/* Assignment Detail Link */}
          {!isSchedule && assignment && (
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <Link
                href={`/app/courses/${assignment.course_id}?tab=classwork&assignmentId=${assignment.id}`}
                className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl bg-[#7C3AED] text-white font-bold hover:opacity-90 transition-all shadow-lg shadow-indigo-500/20 active:scale-[0.98]"
              >
                <FileText className="w-5 h-5" />
                <span>{t("viewInstructions")}</span>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
