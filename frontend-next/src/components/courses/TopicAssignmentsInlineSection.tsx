"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { api } from "@/api/client";
import { useLanguage } from "@/context/LanguageContext";
import { PrivateCommentsSection } from "@/components/courses/PrivateCommentsSection";
import { CheckCircle2, FileText, Globe, Loader2, Plus, X, MessageSquare, ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type AssignmentRow = {
  id: number;
  title: string;
  description: string | null;
  course_id: number;
  topic_id: number | null;
  submitted: boolean;
  grade: number | null;
  teacher_comment: string | null;
  max_points: number;
  attachment_urls: string[];
  attachment_links: string[];
  submission_file_urls?: string[];
  submission_text?: string | null;
  closed: boolean;
  manually_closed?: boolean;
};

type QuestionRow = {
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
};

type SubmissionAttachment = { kind: "file" | "link"; url: string };

function classifySubmissionAttachment(url: string): "link" | "file" {
  return /^https?:\/\//i.test(url.trim()) ? "link" : "file";
}

function normalizeExternalLinkUrl(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

function apiErrorDetail(err: unknown): string | null {
  const ax = err as AxiosError<{ detail?: unknown }>;
  const d = ax.response?.data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d) && d.length > 0) {
    const first = d[0] as { msg?: string };
    if (typeof first?.msg === "string") return first.msg;
  }
  return null;
}

function fileNameFromUrl(url: string, idx: number): string {
  return url.split("/").pop()?.split("?")[0] || `File ${idx + 1}`;
}

function TopicAssignmentCard({
  assignment,
  courseId,
  topicId,
}: {
  assignment: AssignmentRow;
  courseId: number;
  topicId: number;
}) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [attachments, setAttachments] = useState<SubmissionAttachment[]>([]);
  const [answer, setAnswer] = useState("");
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [linkFieldOpen, setLinkFieldOpen] = useState(false);
  const [linkDraft, setLinkDraft] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const addMenuRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setAddMenuOpen(false);
      }
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  useEffect(() => {
    if (assignment.submitted) {
      setAttachments(
        (assignment.submission_file_urls ?? []).map((url) => ({
          kind: classifySubmissionAttachment(url),
          url,
        }))
      );
      setAnswer("");
      return;
    }
    setAttachments([]);
    setAnswer("");
  }, [assignment.id, assignment.submission_file_urls, assignment.submitted]);

  const refreshData = () => {
    queryClient.invalidateQueries({ queryKey: ["student-assignments", courseId] });
    queryClient.invalidateQueries({ queryKey: ["my-assignments"] });
    queryClient.invalidateQueries({ queryKey: ["topic-flow", topicId] });
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/assignments/${assignment.id}/submit`, {
        submission_text: answer.trim() || null,
        file_urls: attachments.map((a) => a.url),
      });
    },
    onSuccess: () => {
      setActionError(null);
      refreshData();
    },
    onError: (err) => {
      setActionError(apiErrorDetail(err) ?? t("assignmentSubmitErrorGeneric"));
    },
  });

  const unsubmitMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/assignments/${assignment.id}/unsubmit`);
    },
    onSuccess: () => {
      setActionError(null);
      refreshData();
    },
    onError: (err) => {
      const detail = apiErrorDetail(err);
      if (detail === "Cannot unsubmit a graded submission") {
        setActionError(t("unsubmitErrorGraded"));
      } else {
        setActionError(detail ?? t("assignmentSubmitErrorGeneric"));
      }
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await api.post<{ url: string }>(
        `/assignments/submissions/upload?assignment_id=${assignment.id}`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      return data?.url ?? "";
    },
    onSuccess: (url) => {
      if (!url) return;
      setAttachments((prev) => {
        if (prev.length >= 5) return prev;
        return [...prev, { kind: "file", url }].slice(0, 5);
      });
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ["topic-flow", topicId] });
    },
    onError: (err) => {
      setActionError(apiErrorDetail(err) ?? t("assignmentSubmitErrorGeneric"));
    },
  });

  const handleFilePick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || attachments.length >= 5) {
      e.target.value = "";
      return;
    }
    uploadMutation.mutate(file);
    e.target.value = "";
    setAddMenuOpen(false);
    setLinkFieldOpen(false);
  };

  const tryAddLink = () => {
    const normalized = normalizeExternalLinkUrl(linkDraft);
    if (!normalized) {
      setActionError(t("studentSubmissionLinkInvalid"));
      return;
    }
    setAttachments((prev) => {
      if (prev.length >= 5 || prev.some((a) => a.url === normalized)) return prev;
      return [...prev, { kind: "link", url: normalized }];
    });
    setActionError(null);
    setLinkDraft("");
    setLinkFieldOpen(false);
    setAddMenuOpen(false);
  };

  const canSubmit =
    !assignment.closed &&
    !assignment.submitted &&
    (attachments.length > 0 || answer.trim().length > 0) &&
    !submitMutation.isPending;
  const canUnsubmit =
    assignment.submitted && assignment.grade == null && !assignment.closed && !unsubmitMutation.isPending;
  const submissionBlocked = assignment.closed && !assignment.submitted;

  return (
    <article className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <h4 className="text-base font-semibold text-gray-900 dark:text-white">{assignment.title}</h4>
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
          {assignment.grade != null ? t("gradedStatus") : assignment.submitted ? t("submittedStatus") : t("appointedStatus")}
        </span>
      </div>

      {assignment.description ? (
        <div
          className="prose prose-sm max-w-none dark:prose-invert text-gray-700 dark:text-gray-200 [&_img]:max-w-full [&_pre]:overflow-x-auto"
          dangerouslySetInnerHTML={{ __html: assignment.description }}
        />
      ) : null}

      {(assignment.attachment_urls?.length > 0 || assignment.attachment_links?.length > 0) && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{t("assignmentMaterialsHeading")}</p>
          <div className="space-y-1">
            {(assignment.attachment_urls ?? []).map((url, idx) => (
              <a
                key={`${url}-${idx}`}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm hover:underline truncate"
              >
                {fileNameFromUrl(url, idx)}
              </a>
            ))}
            {(assignment.attachment_links ?? []).map((url, idx) => (
              <a
                key={`${url}-${idx}`}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm hover:underline truncate"
              >
                {url}
              </a>
            ))}
          </div>
        </div>
      )}

      {actionError ? (
        <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {actionError}
        </div>
      ) : null}

      {submissionBlocked ? (
        <div className="space-y-3">
          <div className="rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
            {assignment.manually_closed ? (
              <>
                <p className="font-semibold">{t("assignmentClosedByTeacherTitle")}</p>
                <p className="mt-1">{t("assignmentClosedByTeacherBody")}</p>
              </>
            ) : (
              <>
                <p className="font-semibold">{t("assignmentCannotSubmitPastDeadline")}</p>
                <p className="mt-1">{t("assignmentDeadlinePassedStudentExplanation")}</p>
              </>
            )}
          </div>
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3">
            <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
              {t("topicFlowRequestExtensionTitle")}
            </p>
            <PrivateCommentsSection
              targetType="assignment"
              targetId={assignment.id}
              title={t("personalComments")}
              placeholder={t("topicFlowRequestExtensionPlaceholder")}
            />
          </div>
        </div>
      ) : null}

      {attachments.length > 0 ? (
        <ul className="space-y-2">
          {attachments.map((att, idx) => (
            <li key={`${att.url}-${idx}`} className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2">
              <div className="min-w-0 flex items-center gap-2">
                {att.kind === "link" ? <Globe className="w-4 h-4 shrink-0 text-sky-600 dark:text-sky-400" /> : <FileText className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" />}
                <a href={att.url} target="_blank" rel="noopener noreferrer" className="truncate text-sm hover:underline">
                  {att.kind === "link" ? att.url : fileNameFromUrl(att.url, idx)}
                </a>
              </div>
              {!assignment.submitted && !assignment.closed && (
                <button
                  type="button"
                  onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                  aria-label={t("cancel")}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {!assignment.submitted && !assignment.closed && (
        <>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={3}
            placeholder={t("studentSubmissionAnswerPlaceholder")}
            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
          />

          <div className="relative" ref={addMenuRef}>
            <button
              type="button"
              onClick={() => {
                setAddMenuOpen((v) => !v);
                setLinkFieldOpen(false);
                setLinkDraft("");
              }}
              disabled={attachments.length >= 5 || uploadMutation.isPending}
              className="w-full rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 px-3 py-2 text-sm font-medium inline-flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {t("addOrCreate")}
            </button>

            {addMenuOpen && (
              <div className="absolute z-20 left-0 right-0 mt-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-2 shadow-lg space-y-2">
                <button
                  type="button"
                  className="w-full text-left rounded-lg px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
                  onClick={() => {
                    setLinkFieldOpen(false);
                    fileInputRef.current?.click();
                  }}
                >
                  {t("fileOption")}
                </button>
                <button
                  type="button"
                  className="w-full text-left rounded-lg px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
                  onClick={() => setLinkFieldOpen((v) => !v)}
                >
                  {t("linkOption")}
                </button>
                {linkFieldOpen && (
                  <div className="space-y-2 pt-1">
                    <input
                      type="url"
                      value={linkDraft}
                      onChange={(e) => setLinkDraft(e.target.value)}
                      placeholder={t("studentSubmissionLinkPlaceholder")}
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={tryAddLink}
                      className="w-full rounded-lg bg-sky-600 hover:bg-sky-700 px-3 py-2 text-sm text-white font-semibold"
                    >
                      {t("studentSubmissionAttachLink")}
                    </button>
                  </div>
                )}
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".jpg,.jpeg,.png,.gif,.webp,.mp4,.webm,.pdf,.doc,.docx,.txt"
              onChange={handleFilePick}
              disabled={attachments.length >= 5}
            />
          </div>
        </>
      )}

      {uploadMutation.isPending && (
        <p className="text-sm text-blue-600 dark:text-blue-400 inline-flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          {t("assignmentUploadFile")}
        </p>
      )}

      {!assignment.submitted && !submissionBlocked ? (
        <button
          type="button"
          onClick={() => submitMutation.mutate()}
          disabled={!canSubmit}
          className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2.5 text-white text-sm font-semibold"
        >
          {submitMutation.isPending ? <Loader2 className="w-4 h-4 mx-auto animate-spin" /> : t("markAsDone")}
        </button>
      ) : assignment.submitted ? (
        <div className="space-y-2">
          <p className="text-sm text-green-600 dark:text-green-400 inline-flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            {t("submitted")}
          </p>
          <button
            type="button"
            onClick={() => unsubmitMutation.mutate()}
            disabled={!canUnsubmit}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm"
          >
            {unsubmitMutation.isPending ? <Loader2 className="w-4 h-4 mx-auto animate-spin" /> : t("cancelSending")}
          </button>
        </div>
      ) : null}

      {assignment.grade != null && (
        <div className="rounded-lg border border-green-200 dark:border-green-900/50 bg-green-50 dark:bg-green-950/20 p-3">
          <p className="text-sm font-semibold text-green-800 dark:text-green-300">
            {t("assignmentGradeOutOf")
              .replace("{current}", String(assignment.grade))
              .replace("{max}", String(assignment.max_points))}
          </p>
          {assignment.teacher_comment ? (
            <p className="mt-2 text-sm text-gray-700 dark:text-gray-200">
              {t("assignmentTeacherCommentSection")}: {assignment.teacher_comment}
            </p>
          ) : null}
        </div>
      )}
    </article>
  );
}

function TopicQuestionCard({
  question,
}: {
  question: QuestionRow;
}) {
  const { t } = useLanguage();
  const isGraded = question.grade !== null;

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
      <div className="p-4 sm:p-5 flex items-start gap-4">
        <div className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white",
          isGraded ? "bg-green-500 shadow-lg shadow-green-500/20" : "bg-blue-500 shadow-lg shadow-blue-500/20"
        )}>
          <MessageSquare className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
            <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">
              {t("assignmentTypeQuestion")}
            </h4>
            {question.status === "submitted" && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-[10px] font-bold text-green-700 dark:text-green-300 uppercase tracking-wider">
                <CheckCircle2 className="w-3 h-3" />
                {t("submittedStatus")}
              </span>
            )}
          </div>
          <p className="text-base text-gray-800 dark:text-gray-200 line-clamp-2">
            {question.text}
          </p>
          
          <div className="mt-4 flex items-center justify-between">
            {isGraded ? (
              <div className="text-sm font-bold text-green-600 dark:text-green-400">
                {t("gradedStatus")}: {question.grade}/100
              </div>
            ) : (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {question.status === "submitted" ? t("answerSubmittedPendingReview") : t("assignmentNoDueDate")}
              </div>
            )}
            
            <Link
              href={`/app/teacher/view-questions/${question.id}`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-50 dark:bg-gray-700/50 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-sm font-bold text-blue-600 dark:text-blue-400 transition-all border border-transparent hover:border-blue-200 dark:hover:border-blue-800"
            >
              {question.status === "submitted" ? t("viewDetails") || "View Details" : t("studentAnswerPlaceholder")?.split("...")[0] || "Answer"}
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
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

  const topicAssignments = useMemo(
    () => assignmentsData.filter((a) => a.course_id === courseId && a.topic_id === topicId),
    [assignmentsData, courseId, topicId]
  );

  const topicQuestions = useMemo(
    () => questionsData.filter((q) => q.course_id === courseId && q.topic_id === topicId),
    [questionsData, courseId, topicId]
  );

  const isPending = isAssignmentsPending || isQuestionsPending;
  const hasItems = topicAssignments.length > 0 || topicQuestions.length > 0;

  return (
    <section className="mt-6 space-y-3">
      <div className="rounded-2xl border border-blue-200/60 dark:border-blue-900/40 bg-blue-50/40 dark:bg-blue-900/10 px-4 py-3">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">{t("topicFlowHomeworkInlineTitle")}</h3>
        <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{t("topicFlowHomeworkInlineHint")}</p>
      </div>

      {isPending && !hasItems ? (
        <div className="py-4 flex items-center gap-2 text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          {t("loading")}
        </div>
      ) : !hasItems ? (
        <div className="rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/70 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
          {t("topicFlowHomeworkInlineEmpty")}
        </div>
      ) : (
        <div className="space-y-4">
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
      )}
    </section>
  );
}
