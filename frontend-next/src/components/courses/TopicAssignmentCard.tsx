"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { api } from "@/api/client";
import { useLanguage } from "@/context/LanguageContext";
import { PrivateCommentsSection } from "@/components/courses/PrivateCommentsSection";
import { CheckCircle2, FileText, Globe, Loader2, Plus, X, Sparkles } from "lucide-react";
import { TestComponent } from "@/components/tests/TestComponent";
import { htmlLinksOpenInNewTab } from "@/lib/htmlLinkNewTab";
import { ALLOWED_EXTENSIONS_STR, ALLOWED_EXTENSIONS_HINT } from "@/constants/fileTypes";
import type { TranslationKey } from "@/i18n/translations";

export type AssignmentRow = {
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
  is_synopsis?: boolean;
  is_supplementary?: boolean;
  test_id?: number | null;
  teacher_comment_author_name?: string | null;
  created_at?: string | null;
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

function fileNameFromUrl(url: string, idx: number, fileLabel: string): string {
  return url.split("/").pop()?.split("?")[0] || `${fileLabel} ${idx + 1}`;
}

export function TopicAssignmentCard({
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
  const [showTest, setShowTest] = useState(false);
  const [testAttemptKey, setTestAttemptKey] = useState(0);

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
        return [...prev, { kind: "file" as const, url }].slice(0, 5);
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
    <article className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 p-4 sm:p-5 space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <h4 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white min-w-0 break-words flex-1">
          {assignment.title}
        </h4>
        <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 shrink-0 self-start">
          {assignment.grade != null ? t("gradedStatus") : assignment.submitted ? t("submittedStatus") : t("appointedStatus")}
        </span>
      </div>

      {assignment.description ? (
        <div
          className="prose prose-sm max-w-none dark:prose-invert text-gray-700 dark:text-gray-200 [&_img]:max-w-full [&_pre]:overflow-x-auto break-words min-w-0"
          dangerouslySetInnerHTML={{ __html: htmlLinksOpenInNewTab(assignment.description) }}
        />
      ) : null}

      {(assignment.attachment_urls?.length > 0 || assignment.attachment_links?.length > 0) && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{t("assignmentMaterialsHeading")}</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {(assignment.attachment_urls ?? []).map((url, idx) => (
              <a
                key={`${url}-${idx}`}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm hover:border-blue-300 transition-all truncate"
              >
                <FileText className="w-4 h-4 shrink-0 text-blue-500" />
                <span className="truncate">{fileNameFromUrl(url, idx, t("fileTypeFile"))}</span>
              </a>
            ))}
            {(assignment.attachment_links ?? []).map((url, idx) => (
              <a
                key={`${url}-${idx}`}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm hover:border-blue-300 transition-all truncate"
              >
                <Globe className="w-4 h-4 shrink-0 text-sky-500" />
                <span className="truncate">{url}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {actionError && (
        <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {t(actionError as any)}
        </div>
      )}

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
                <p className="mt-1">{t("assignmentDeadlinePassedStudentExplanation")}</p>
              </>
            )}
          </div>
        </div>
      ) : null}

      {attachments.length > 0 ? (
        <ul className="space-y-2">
          {attachments.map((att, idx) => (
            <li key={`${att.url}-${idx}`} className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 bg-white/50 dark:bg-black/20">
              <div className="min-w-0 flex items-center gap-2">
                {att.kind === "link" ? <Globe className="w-4 h-4 shrink-0 text-sky-600 dark:text-sky-400" /> : <FileText className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" />}
                <a href={att.url} target="_blank" rel="noopener noreferrer" className="truncate text-sm hover:underline">
                  {att.kind === "link" ? att.url : fileNameFromUrl(att.url, idx, t("fileTypeFile"))}
                </a>
              </div>
              {!assignment.submitted && !assignment.closed && (
                <button
                  type="button"
                  onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                  className="p-1 rounded hover:bg-red-50 hover:text-red-600 transition-colors"
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
            rows={4}
            placeholder={t("studentSubmissionAnswerPlaceholder")}
            className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-4 py-3 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
          />

          <div className="space-y-2">
            <div className="relative" ref={addMenuRef}>
              <button
                type="button"
                onClick={() => {
                  setAddMenuOpen((v) => !v);
                  setLinkFieldOpen(false);
                  setLinkDraft("");
                }}
                disabled={attachments.length >= 5 || uploadMutation.isPending}
                className="w-full rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-800 px-4 py-2.5 text-sm font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                {t("addOrCreate")}
              </button>

              {addMenuOpen && (
                <div className="absolute z-20 left-0 right-0 mt-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-2 shadow-2xl animate-in fade-in zoom-in duration-200 space-y-1">
                  <button
                    type="button"
                    className="w-full text-left rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    onClick={() => {
                      setLinkFieldOpen(false);
                      fileInputRef.current?.click();
                    }}
                  >
                    {t("fileOption")}
                  </button>
                  <button
                    type="button"
                    className="w-full text-left rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    onClick={() => setLinkFieldOpen((v) => !v)}
                  >
                    {t("linkOption")}
                  </button>
                  {linkFieldOpen && (
                    <div className="p-2 space-y-2 bg-gray-50 dark:bg-gray-950 rounded-lg mt-1 border border-gray-100 dark:border-gray-800">
                      <input
                        type="url"
                        value={linkDraft}
                        onChange={(e) => setLinkDraft(e.target.value)}
                        placeholder={t("studentSubmissionLinkPlaceholder")}
                        className="w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                      <button
                        type="button"
                        onClick={tryAddLink}
                        className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 px-3 py-2 text-sm text-white font-bold"
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
                accept={ALLOWED_EXTENSIONS_STR}
                onChange={handleFilePick}
                disabled={attachments.length >= 5}
              />
            </div>
            
            <p className="text-[10px] font-medium text-center" style={{ color: "#F87171" }}>
              {t("onlyAllowedExtensions").replace("{extensions}", ALLOWED_EXTENSIONS_HINT)}
            </p>
          </div>
        </>
      )}

      {uploadMutation.isPending && (
        <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 font-medium bg-blue-50 dark:bg-blue-900/20 px-3 py-2 rounded-lg">
          <Loader2 className="w-4 h-4 animate-spin" />
          {t("assignmentUploadFile")}
        </div>
      )}

      {/* Quiz section */}
      {assignment.test_id && !assignment.submitted && !assignment.closed && (
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowTest(true)}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-black shadow-lg shadow-blue-500/25 transition-all hover:scale-[1.01] active:scale-[0.99]"
          >
            <Sparkles className="w-4.5 h-4.5" />
            {t("startQuiz" as TranslationKey)}
          </button>
        </div>
      )}

      {showTest && assignment.test_id && (
        <TestComponent
          testId={assignment.test_id}
          onComplete={() => {
            setShowTest(false);
            queryClient.invalidateQueries({ queryKey: ["student-assignments", courseId] });
            queryClient.invalidateQueries({ queryKey: ["topic-flow", topicId] });
          }}
          onCancel={() => setShowTest(false)}
          onRetake={() => setTestAttemptKey((k) => k + 1)}
          key={testAttemptKey}
        />
      )}

      {!assignment.submitted && !submissionBlocked ? (
        <button
          type="button"
          onClick={() => submitMutation.mutate()}
          disabled={!canSubmit}
          className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed py-3.5 text-white text-sm font-extrabold shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.01] active:scale-[0.99]"
        >
          {submitMutation.isPending ? <Loader2 className="w-5 h-5 mx-auto animate-spin" /> : t("markAsDone")}
        </button>
      ) : assignment.submitted ? (
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-2 py-3 rounded-xl bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 font-bold text-sm">
            <CheckCircle2 className="w-4.5 h-4.5" />
            {t("submitted")}
          </div>
          {!assignment.grade && !assignment.closed && (
            <button
              type="button"
              onClick={() => unsubmitMutation.mutate()}
              disabled={!canUnsubmit}
              className="w-full rounded-xl border border-gray-200 dark:border-gray-800 py-2.5 text-sm font-bold text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
            >
              {unsubmitMutation.isPending ? <Loader2 className="w-4 h-4 mx-auto animate-spin" /> : t("cancelSending")}
            </button>
          )}
        </div>
      ) : null}

      {assignment.grade != null && (
        <div className="rounded-xl border border-green-200 dark:border-green-900/50 bg-green-50/50 dark:bg-green-950/20 p-4">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-black mb-2">
            <CheckCircle2 className="w-5 h-5" />
            <span>
              {t("assignmentGradeOutOf")
                .replace("{current}", String(assignment.grade))
                .replace("{max}", String(assignment.max_points))}
            </span>
          </div>
          {assignment.teacher_comment ? (
            <div className="mt-2 text-sm text-gray-700 dark:text-gray-200 italic border-l-2 border-green-200 dark:border-green-800 pl-3 py-1">
              {assignment.teacher_comment_author_name && (
                <div className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 not-italic">
                  {assignment.teacher_comment_author_name}
                </div>
              )}
              &ldquo;{assignment.teacher_comment}&rdquo;
            </div>
          ) : null}
        </div>
      )}

      {/* Private Comments / Chat Section */}
      <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
        <PrivateCommentsSection
          targetType="assignment"
          targetId={assignment.id}
          title={t("personalComments")}
          placeholder={t("studentSubmissionAnswerPlaceholder")}
        />
      </div>
    </article>
  );
}
