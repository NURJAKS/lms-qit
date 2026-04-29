"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { api } from "@/api/client";
import { useLanguage } from "@/context/LanguageContext";
import { PrivateCommentsSection } from "@/components/courses/PrivateCommentsSection";
import { CheckCircle2, FileText, Globe, Loader2, Plus, X, MessageSquare, ChevronRight, Sparkles, BookOpen } from "lucide-react";
import Link from "next/link";
import { TestComponent } from "@/components/tests/TestComponent";
import { cn } from "@/lib/utils";
import { htmlLinksOpenInNewTab } from "@/lib/htmlLinkNewTab";
import { ALLOWED_EXTENSIONS_STR, ALLOWED_EXTENSIONS_HINT } from "@/constants/fileTypes";
import type { TranslationKey } from "@/i18n/translations";

import { TopicAssignmentCard, type AssignmentRow } from "@/components/courses/TopicAssignmentCard";

export type QuestionRow = {
  id: number;
  text: string;
  type: string;
  course_id: number;
  course_title: string;
  topic_id: number | null;
  topic_title: string | null;
  status: "not_submitted" | "submitted";
  grade: number | null;
  teacher_comment: string | null;
  created_at: string | null;
  answer_text: string | null;
};

type MaterialRow = {
  id: number;
  title: string;
  description: string | null;
  course_id: number;
  topic_id: number | null;
  video_urls: string[];
  image_urls: string[];
  attachment_urls: string[];
  attachment_links: string[];
  is_supplementary?: boolean;
  created_at: string | null;
};

function fileNameFromUrl(url: string, idx: number, fileLabel: string): string {
  return url.split("/").pop()?.split("?")[0] || `${fileLabel} ${idx + 1}`;
}

export function TopicQuestionCard({
  question,
}: {
  question: QuestionRow;
}) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const isGraded = question.grade !== null;
  const isSubmitted = question.status === "submitted";
  
  const [answerText, setAnswerText] = useState(question.answer_text || "");
  const [isEditing, setIsEditing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const submitMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/questions/${question.id}/submit`, { answer_text: answerText });
    },
    onSuccess: () => {
      setActionError(null);
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ["student-questions", question.course_id] });
      queryClient.invalidateQueries({ queryKey: ["topic-flow", question.topic_id] });
    },
    onError: (err: any) => {
      setActionError(err.response?.data?.detail?.message || err.response?.data?.detail || t("assignmentErrorDefault"));
    }
  });

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden flex flex-col">
      <div className="p-4 sm:p-5 flex items-start gap-4">
        <div className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white",
          isGraded ? "bg-green-500 shadow-lg shadow-green-500/20" : 
          isSubmitted ? "bg-gray-400 shadow-lg shadow-gray-400/20" :
          "bg-blue-500 shadow-lg shadow-blue-500/20"
        )}>
          <MessageSquare className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
            <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">
              {t("assignmentTypeQuestion")}
            </h4>
            {isSubmitted && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-[10px] font-bold text-green-700 dark:text-green-300 uppercase tracking-wider">
                <CheckCircle2 className="w-3 h-3" />
                {t("submittedStatus")}
              </span>
            )}
          </div>
          <p className="text-sm sm:text-base text-gray-800 dark:text-gray-200 line-clamp-4 sm:line-clamp-none break-words">
            {question.text}
          </p>
          
          <div className="mt-4 flex items-center justify-between">
            {isGraded ? (
              <div className="text-sm font-bold text-green-600 dark:text-green-400">
                {t("gradedStatus")}: {question.grade}/100
              </div>
            ) : (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {isSubmitted ? t("answerSubmittedPendingReview") : t("assignmentNoDueDate")}
              </div>
            )}
          </div>

          {!isSubmitted || isEditing ? (
            <div className="mt-4 space-y-3">
              <textarea
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value)}
                placeholder={t("studentAnswerPlaceholder")}
                rows={3}
                className="w-full resize-none rounded-xl border border-gray-300 bg-gray-50 p-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-blue-400 dark:focus:ring-blue-400 transition-colors"
                disabled={submitMutation.isPending}
              />
              {actionError && (
                <div className="text-sm text-red-600 dark:text-red-400 font-medium">
                  {t(actionError as any)}
                </div>
              )}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => submitMutation.mutate()}
                  disabled={submitMutation.isPending || !answerText.trim()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {submitMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isSubmitted ? t("assignmentUpdateAnswer") : t("assignmentSendAnswer")}
                </button>
                {isSubmitted && isEditing && (
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setAnswerText(question.answer_text || "");
                    }}
                    disabled={submitMutation.isPending}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-200 dark:bg-gray-700 px-4 py-2 text-sm font-bold text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 transition-all"
                  >
                    {t("cancel")}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
              <div className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase mb-1">{t("studentSubmissionAnswerLabel")}</div>
              <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{question.answer_text}</p>
              
              {!isGraded && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="mt-3 text-sm font-bold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                >
                  {t("assignmentEdit")}
                </button>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

function TopicMaterialCard({ material }: { material: MaterialRow }) {
  const { t } = useLanguage();
  return (
    <article className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-900/10 p-4 sm:p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
          <BookOpen className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h4 className="text-base font-semibold text-gray-900 dark:text-white min-w-0 break-words flex-1">
          {material.title}
        </h4>
      </div>

      {material.description ? (
        <div
          className="prose prose-sm max-w-none dark:prose-invert text-gray-700 dark:text-gray-200 [&_img]:max-w-full [&_pre]:overflow-x-auto break-words"
          dangerouslySetInnerHTML={{ __html: htmlLinksOpenInNewTab(material.description) }}
        />
      ) : null}

      {(material.attachment_urls?.length > 0 || material.attachment_links?.length > 0) && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{t("assignmentMaterialsHeading")}</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {(material.attachment_urls ?? []).map((url, idx) => (
              <a
                key={`m-att-${idx}`}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-lg border border-emerald-100 bg-white px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 transition-all dark:border-emerald-800 dark:bg-gray-900 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
              >
                <FileText className="w-4 h-4 shrink-0" />
                <span className="truncate">{fileNameFromUrl(url, idx, t("fileTypeFile"))}</span>
              </a>
            ))}
            {(material.attachment_links ?? []).map((url, idx) => (
              <a
                key={`m-link-${idx}`}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-lg border border-emerald-100 bg-white px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 transition-all dark:border-emerald-800 dark:bg-gray-900 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
              >
                <Globe className="w-4 h-4 shrink-0" />
                <span className="truncate">{url}</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

export function TopicAssignmentsInlineSection({
  courseId,
  topicId,
}: {
  courseId: number;
  topicId: number;
}) {
  const { t } = useLanguage();
  const { data: assignmentsData = [], isPending: isAssignmentsPending } = useQuery({
    queryKey: ["student-assignments", courseId],
    queryFn: async () => {
      const { data } = await api.get<AssignmentRow[]>("/assignments/my");
      return Array.isArray(data) ? data : [];
    },
    enabled: Number.isFinite(courseId) && courseId > 0,
  });

  const { data: questionsData = [], isPending: isQuestionsPending } = useQuery({
    queryKey: ["student-questions", courseId],
    queryFn: async () => {
      const { data } = await api.get<QuestionRow[]>("/questions/my");
      return Array.isArray(data) ? data : [];
    },
    enabled: Number.isFinite(courseId) && courseId > 0,
  });

  const { data: materialsData = [], isPending: isMaterialsPending } = useQuery({
    queryKey: ["student-materials", courseId],
    queryFn: async () => {
      const { data } = await api.get<MaterialRow[]>("/assignments/my-materials");
      return Array.isArray(data) ? data : [];
    },
    enabled: Number.isFinite(courseId) && courseId > 0,
  });

  const topicAssignments = useMemo(
    () => assignmentsData.filter((a) => a.course_id === courseId && a.topic_id === topicId && a.is_supplementary && !a.is_synopsis),
    [assignmentsData, courseId, topicId]
  );

  const topicQuestions = useMemo(
    () => questionsData.filter((q) => q.course_id === courseId && q.topic_id === topicId && (q as any).is_supplementary && !(q as any).is_synopsis),
    [questionsData, courseId, topicId]
  );

  const topicMaterials = useMemo(
    () => materialsData.filter((m) => m.course_id === courseId && m.topic_id === topicId && m.is_supplementary),
    [materialsData, courseId, topicId]
  );

  const isPending = isAssignmentsPending || isQuestionsPending || isMaterialsPending;
  const hasItems = topicAssignments.length > 0 || topicQuestions.length > 0 || topicMaterials.length > 0;

  if (isPending && !hasItems) {
    return (
      <section className="mt-6">
        <div className="py-4 flex items-center gap-2 text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          {t("loading")}
        </div>
      </section>
    );
  }

  if (!hasItems) {
    return null;
  }

  return (
    <section className="mt-6 space-y-4">
      <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30 p-5 sm:p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-500" />
          {t("teacherSupplementaryHeading")}
        </h3>
        <div className="space-y-4">
          {topicMaterials.map((m) => (
            <TopicMaterialCard key={`m-${m.id}`} material={m} />
          ))}
          {topicAssignments.map((a) => (
            <TopicAssignmentCard key={`a-${a.id}`} assignment={a} courseId={courseId} topicId={topicId} />
          ))}
          {topicQuestions.map((q) => (
            <TopicQuestionCard key={`q-${q.id}`} question={q} />
          ))}
          {isPending ? (
            <div className="py-2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {t("topicFlowHomeworkInlineLoadingMore")}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
