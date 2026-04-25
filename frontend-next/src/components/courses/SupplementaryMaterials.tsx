"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useRef, useEffect, type ChangeEvent } from "react";
import { api } from "@/api/client";
import { useLanguage } from "@/context/LanguageContext";
import type { TranslationKey } from "@/i18n/translations";
import { TopicTheoryContent } from "@/components/courses/TopicTheoryContent";
import { TestComponent } from "@/components/tests/TestComponent";
import { htmlLinksOpenInNewTab } from "@/lib/htmlLinkNewTab";
import { ALLOWED_EXTENSIONS_STR, ALLOWED_EXTENSIONS_HINT } from "@/constants/fileTypes";
import type { AxiosError } from "axios";
import {
  BookOpen,
  Video,
  FileText,
  Link2,
  ChevronLeft,
  ExternalLink,
  GraduationCap,
  Sparkles,
  Play,
  ChevronRight,
  Loader2,
  Paperclip,
  Plus,
  Trash2,
  CheckCircle2,
  ClipboardList,
  Globe,
  X,
  PenLine,
} from "lucide-react";

/* ────────────────────────────────────────────
   Types
   ──────────────────────────────────────────── */

interface Topic {
  id: number;
  title: string;
  order_number: number;
}

interface SupplementaryAssignment {
  id: number;
  title: string;
  description: string | null;
  topic_id: number | null;
  attachment_urls: string[];
  attachment_links: string[];
  video_urls: string[];
  created_at: string | null;
  is_synopsis: boolean;
}

interface SupplementaryMaterial {
  id: number;
  title: string;
  description: string | null;
  topic_id: number | null;
  video_urls: string[];
  image_urls: string[];
  attachment_urls: string[];
  attachment_links: string[];
  created_at: string | null;
}

interface SupplementaryData {
  topics: Topic[];
  assignments: SupplementaryAssignment[];
  materials: SupplementaryMaterial[];
}

/** Full assignment row from /assignments/my — needed for submission state */
interface FullAssignmentRow {
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
  video_urls: string[];
  submission_file_urls?: string[];
  submission_text?: string | null;
  closed: boolean;
  manually_closed?: boolean;
  is_synopsis?: boolean;
  is_supplementary?: boolean;
  test_id?: number | null;
}

type SubmissionAttachment = { kind: "file" | "link"; url: string };

/* ────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────── */

function isYouTubeUrl(url: string): boolean {
  return /youtube\.com|youtu\.be/i.test(url);
}

function getYouTubeEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    let videoId = u.searchParams.get("v");
    if (!videoId && u.hostname.includes("youtu.be")) {
      videoId = u.pathname.slice(1);
    }
    return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
  } catch {
    return null;
  }
}

function getFileName(url: string): string {
  try {
    const parts = url.split("/");
    const name = parts[parts.length - 1];
    return decodeURIComponent(name).replace(/^[a-f0-9]{32}/, "").replace(/^[-_.]/, "") || name;
  } catch {
    return url;
  }
}

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

function fileKindIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".doc") || lower.endsWith(".docx"))
    return <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white shadow-lg shadow-blue-500/20">W</span>;
  if (lower.endsWith(".pdf"))
    return <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-600 text-xs font-bold text-white shadow-lg shadow-red-500/20">PDF</span>;
  if (lower.endsWith(".xls") || lower.endsWith(".xlsx"))
    return <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-600 text-xs font-bold text-white shadow-lg shadow-green-500/20">XLS</span>;
  if (lower.endsWith(".ppt") || lower.endsWith(".pptx"))
    return <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-600 text-xs font-bold text-white shadow-lg shadow-orange-500/20">PPT</span>;
  if (lower.endsWith(".zip") || lower.endsWith(".rar") || lower.endsWith(".7z"))
    return <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-600 text-xs font-bold text-white shadow-lg shadow-gray-500/20">ZIP</span>;
  return <FileText className="h-10 w-10 shrink-0 text-blue-500" />;
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

/* ────────────────────────────────────────────
   Inline Assignment Submission Card
   ──────────────────────────────────────────── */

function SupplementaryAssignmentCard({
  assignment,
  courseId,
  isSynopsis,
}: {
  assignment: FullAssignmentRow;
  courseId: number;
  isSynopsis?: boolean;
}) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const addMenuRef = useRef<HTMLDivElement | null>(null);

  const [attachments, setAttachments] = useState<SubmissionAttachment[]>([]);
  const [answer, setAnswer] = useState("");
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [linkFieldOpen, setLinkFieldOpen] = useState(false);
  const [linkDraft, setLinkDraft] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
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
      setAnswer(assignment.submission_text ?? "");
    } else {
      setAttachments([]);
      setAnswer("");
    }
  }, [assignment.id, assignment.submitted, assignment.submission_file_urls, assignment.submission_text]);

  const refreshData = () => {
    queryClient.invalidateQueries({ queryKey: ["student-assignments", courseId] });
    queryClient.invalidateQueries({ queryKey: ["supplementary-materials", courseId] });
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
      setInfo(isSynopsis ? t("topicFlowSynopsisSaved") : t("submitted"));
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
      setInfo(null);
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
      setAttachments((prev) => [...prev, { kind: "file" as const, url }].slice(0, 5));
      setActionError(null);
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

  const isBusy = uploadMutation.isPending || submitMutation.isPending || unsubmitMutation.isPending;
  const canSubmit = !assignment.closed && !assignment.submitted && (attachments.length > 0 || answer.trim().length > 0) && !submitMutation.isPending;
  const canUnsubmit = assignment.submitted && assignment.grade == null && !assignment.closed && !unsubmitMutation.isPending;
  const isGraded = assignment.grade !== null;

  const accentColor = isSynopsis ? "teal" : "blue";
  const borderClass = isSynopsis
    ? "border-teal-200 dark:border-teal-800"
    : "border-blue-200 dark:border-blue-800";
  const bgClass = isSynopsis
    ? "bg-teal-50/80 dark:bg-teal-900/20"
    : "bg-white dark:bg-gray-900";

  return (
    <article className={`rounded-2xl border ${borderClass} ${bgClass} p-4 sm:p-5 space-y-4 transition-all`}>
      {/* Title & status */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
            isSynopsis 
              ? "bg-teal-100 dark:bg-teal-900/40" 
              : "bg-blue-100 dark:bg-blue-900/40"
          }`}>
            {isSynopsis 
              ? <PenLine className="w-4.5 h-4.5 text-teal-600 dark:text-teal-400" />
              : <ClipboardList className="w-4.5 h-4.5 text-blue-600 dark:text-blue-400" />
            }
          </div>
          <h4 className="text-base font-semibold text-gray-900 dark:text-white min-w-0 break-words flex-1">
            {assignment.title}
          </h4>
        </div>
        <span className={`text-xs font-bold shrink-0 self-start px-2.5 py-1 rounded-full ${
          isGraded ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300" :
          assignment.submitted ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300" :
          "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
        }`}>
          {isGraded ? t("gradedStatus") : assignment.submitted ? t("submittedStatus") : t("appointedStatus")}
        </span>
      </div>

      {/* Description */}
      {assignment.description && (
        <div
          className="prose prose-sm max-w-none dark:prose-invert text-gray-700 dark:text-gray-200 [&_img]:max-w-full [&_pre]:overflow-x-auto break-words"
          dangerouslySetInnerHTML={{ __html: htmlLinksOpenInNewTab(assignment.description) }}
        />
      )}

      {/* Teacher attachments */}
      {((assignment.attachment_urls?.length ?? 0) > 0 || (assignment.attachment_links?.length ?? 0) > 0) && (
        <div className="space-y-3">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t("assignmentMaterialsHeading")}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(assignment.attachment_urls ?? []).map((url, idx) => {
              const name = getFileName(url);
              return (
                <a
                  key={`${url}-${idx}`}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 p-4 transition-all hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 group/file"
                >
                  {fileKindIcon(name)}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900 dark:text-white group-hover/file:text-blue-600 dark:group-hover/file:text-blue-400 transition-colors">{name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t("fileLabel")}</p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-gray-300 opacity-0 group-hover/file:opacity-100 transition-opacity" />
                </a>
              );
            })}
            {(assignment.attachment_links ?? []).map((url, idx) => (
              <a
                key={`${url}-${idx}`}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 p-4 transition-all hover:shadow-md hover:border-sky-300 dark:hover:border-sky-700 group/link"
              >
                <div className="w-10 h-10 rounded-lg bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center shrink-0">
                  <Globe className="h-6 w-6 text-sky-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900 dark:text-white group-hover/link:text-sky-600 transition-colors">{t("linkOption")}</p>
                  <p className="truncate text-xs text-gray-500 dark:text-gray-400">{url}</p>
                </div>
                <ExternalLink className="w-4 h-4 text-gray-300 opacity-0 group-hover/link:opacity-100 transition-opacity" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Teacher videos */}
      {(assignment.video_urls?.length ?? 0) > 0 && (
        <div className="space-y-2">
          {assignment.video_urls.map((url, i) =>
            isYouTubeUrl(url) ? (
              <div key={i} className="rounded-xl overflow-hidden aspect-video shadow-md">
                <iframe
                  src={getYouTubeEmbedUrl(url) || url}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title={assignment.title}
                />
              </div>
            ) : (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                <Video className="w-4 h-4" />
                <span>{t("supplementaryVideos" as TranslationKey)} {i + 1}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )
          )}
        </div>
      )}

      {/* Quiz section */}
      {assignment.test_id && !assignment.submitted && !assignment.closed && (
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowTest(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-sm font-bold shadow-lg shadow-purple-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Sparkles className="w-4 h-4" />
            {t("startQuiz" as TranslationKey)}
          </button>
        </div>
      )}

      {showTest && assignment.test_id && (
        <TestComponent
          testId={assignment.test_id}
          onComplete={() => {
            setShowTest(false);
            refreshData();
          }}
          onCancel={() => setShowTest(false)}
          onRetake={() => setTestAttemptKey((k) => k + 1)}
          key={testAttemptKey}
        />
      )}

      {actionError && (
        <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {actionError}
        </div>
      )}

      {/* Submission attachments list */}
      {attachments.length > 0 && (
        <ul className="space-y-2">
          {attachments.map((att, idx) => (
            <li key={`${att.url}-${idx}`} className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2">
              <div className="min-w-0 flex items-center gap-2">
                {att.kind === "link" ? <Globe className="w-4 h-4 shrink-0 text-sky-600 dark:text-sky-400" /> : <FileText className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" />}
                <a href={att.url} target="_blank" rel="noopener noreferrer" className="truncate text-sm hover:underline">
                  {att.kind === "link" ? att.url : getFileName(att.url)}
                </a>
              </div>
              {!assignment.submitted && !assignment.closed && (
                <button
                  type="button"
                  onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                  disabled={isBusy}
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Work area: textarea + add file/link */}
      {!assignment.submitted && !assignment.closed && (
        <>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={isSynopsis ? 3 : 5}
            placeholder={isSynopsis ? t("supplementarySynopsisHint" as TranslationKey) : t("studentSubmissionAnswerPlaceholder")}
            className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
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
                disabled={attachments.length >= 5 || isBusy}
                className={`w-full rounded-xl border-2 border-dashed px-3 py-2.5 text-sm font-medium inline-flex items-center justify-center gap-2 transition-colors ${
                  isSynopsis
                    ? "border-teal-300 dark:border-teal-800 text-teal-700 dark:text-teal-400 hover:bg-teal-100/50 dark:hover:bg-teal-900/30"
                    : "border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
              >
                {uploadMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
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
        <p className="text-sm text-blue-600 dark:text-blue-400 inline-flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          {t("assignmentUploadFile")}
        </p>
      )}

      {/* Submit / Unsubmit buttons */}
      {!assignment.submitted && !assignment.closed && (
        <button
          type="button"
          onClick={() => submitMutation.mutate()}
          disabled={!canSubmit}
          className={`w-full rounded-xl px-4 py-3 text-white text-sm font-extrabold shadow-lg transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:scale-100 ${
            isSynopsis
              ? "shadow-teal-500/20"
              : "shadow-blue-500/20"
          }`}
          style={{
            background: isSynopsis
              ? "linear-gradient(135deg, #0d9488, #0f766e)"
              : "linear-gradient(135deg, #3b82f6, #2563eb)",
          }}
        >
          {submitMutation.isPending ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : (isSynopsis ? t("topicFlowSynopsisSave") : t("markAsDone"))}
        </button>
      )}

      {assignment.submitted && !isGraded && !assignment.closed && (
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 font-bold text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            {isSynopsis ? t("topicFlowSynopsisGradingPending") : t("topicFlowAssignmentGradingPending")}
          </div>
          <button
            type="button"
            className="w-full py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 text-sm font-bold text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
            onClick={() => unsubmitMutation.mutate()}
            disabled={!canUnsubmit}
          >
            {unsubmitMutation.isPending ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : t("cancelSending")}
          </button>
        </div>
      )}

      {isGraded && (
        <div className="p-4 rounded-xl border border-green-200 bg-green-50/50 dark:border-green-900/30 dark:bg-green-900/10">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-black mb-1">
            <CheckCircle2 className="w-5 h-5" />
            {t("gradedStatus")}: {assignment.grade}/{assignment.max_points}
          </div>
          {assignment.teacher_comment && (
            <div className="mt-2 text-sm text-gray-700 dark:text-gray-200 italic leading-relaxed">
              &ldquo;{assignment.teacher_comment}&rdquo;
            </div>
          )}
        </div>
      )}

      {info && <p className="text-sm font-bold text-teal-600 dark:text-teal-400">{info}</p>}
    </article>
  );
}

/* ────────────────────────────────────────────
   Topic Detail View (Video, Theory, Synopsis, Tasks)
   ──────────────────────────────────────────── */

function SupplementaryTopicDetail({
  topic,
  materials,
  assignments,
  fullAssignments,
  courseId,
  onBack,
}: {
  topic: Topic;
  materials: SupplementaryMaterial[];
  assignments: SupplementaryAssignment[];
  fullAssignments: FullAssignmentRow[];
  courseId: number;
  onBack: () => void;
}) {
  const { t } = useLanguage();

  // Collect all videos from materials + assignments
  const allVideos = useMemo(() => {
    const videos: { url: string; title: string }[] = [];
    for (const m of materials) {
      for (const url of m.video_urls) {
        videos.push({ url, title: m.title });
      }
    }
    for (const a of assignments) {
      for (const url of a.video_urls) {
        videos.push({ url, title: a.title });
      }
    }
    return videos;
  }, [materials, assignments]);

  // Collect all theory (material descriptions)
  const theoryItems = useMemo(
    () => materials.filter((m) => m.description && m.description.trim().length > 0),
    [materials]
  );

  // Synopsis items (is_synopsis=true assignments)
  const synopsisAssignmentIds = useMemo(
    () => new Set(assignments.filter((a) => a.is_synopsis).map((a) => a.id)),
    [assignments]
  );

  // Task items (non-synopsis assignments)
  const taskAssignmentIds = useMemo(
    () => new Set(assignments.filter((a) => !a.is_synopsis).map((a) => a.id)),
    [assignments]
  );

  const synopsisFullRows = useMemo(
    () => fullAssignments.filter((a) => synopsisAssignmentIds.has(a.id)),
    [fullAssignments, synopsisAssignmentIds]
  );

  const taskFullRows = useMemo(
    () => fullAssignments.filter((a) => taskAssignmentIds.has(a.id)),
    [fullAssignments, taskAssignmentIds]
  );

  // Material attachments (files and links not counting videos)
  const materialAttachments = useMemo(() => {
    const items: { url: string; title: string; isLink: boolean }[] = [];
    for (const m of materials) {
      for (const url of m.attachment_urls) {
        items.push({ url, title: m.title, isLink: false });
      }
      for (const url of m.attachment_links) {
        items.push({ url, title: m.title, isLink: true });
      }
    }
    return items;
  }, [materials]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      {/* Back button + topic title */}
      <div>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors mb-3"
        >
          <ChevronLeft className="w-4 h-4" />
          {t("supplementaryBackToList" as TranslationKey)}
        </button>
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white break-words">
          {topic.title}
        </h2>
      </div>

      {/* ── 🎥 VIDEO SECTION ── */}
      {allVideos.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-lg shadow-red-500/20">
              <Play className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              {t("supplementaryVideoSection" as TranslationKey)}
            </h3>
          </div>
          <div className="space-y-4">
            {allVideos.map((v, i) =>
              isYouTubeUrl(v.url) ? (
                <div key={i} className="rounded-2xl overflow-hidden aspect-video shadow-xl border border-gray-200 dark:border-gray-700">
                  <iframe
                    src={getYouTubeEmbedUrl(v.url) || v.url}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title={v.title}
                  />
                </div>
              ) : (
                <a
                  key={i}
                  href={v.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 hover:border-red-300 dark:hover:border-red-800 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                    <Video className="w-5 h-5 text-red-600 dark:text-red-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{v.title}</p>
                    <p className="text-xs text-gray-500 truncate">{v.url}</p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-gray-400 shrink-0" />
                </a>
              )
            )}
          </div>
        </section>
      )}

      {/* ── 📖 THEORY SECTION ── */}
      {theoryItems.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              {t("supplementaryTheorySection" as TranslationKey)}
            </h3>
          </div>
          <div className="space-y-4">
            {theoryItems.map((m) => (
              <div key={m.id}>
                <TopicTheoryContent content={m.description!} />
                {/* Material attachments for this material */}
                {(m.attachment_urls.length > 0 || m.attachment_links.length > 0) && (
                  <div className="mt-6 space-y-3">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">{t("assignmentMaterialsHeading")}</p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {m.attachment_urls.map((url, idx) => {
                        const name = getFileName(url);
                        return (
                          <a
                            key={`f-${m.id}-${idx}`}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/40 p-4 transition-all hover:shadow-lg hover:border-purple-300 dark:hover:border-purple-700 group/file"
                          >
                            {fileKindIcon(name)}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-gray-900 dark:text-white group-hover/file:text-purple-600 transition-colors">{name}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{t("fileLabel")}</p>
                            </div>
                            <ExternalLink className="w-4 h-4 text-gray-300 opacity-0 group-hover/file:opacity-100 transition-opacity" />
                          </a>
                        );
                      })}
                      {m.attachment_links.map((link, idx) => (
                        <a
                          key={`l-${m.id}-${idx}`}
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/40 p-4 transition-all hover:shadow-lg hover:border-sky-300 dark:hover:border-sky-700 group/link"
                        >
                          <div className="w-10 h-10 rounded-lg bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center shrink-0">
                            <Globe className="h-6 w-6 text-sky-600" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-gray-900 dark:text-white group-hover/link:text-sky-600 transition-colors">{t("linkOption")}</p>
                            <p className="truncate text-xs text-gray-500 dark:text-gray-400">{link}</p>
                          </div>
                          <ExternalLink className="w-4 h-4 text-gray-300 opacity-0 group-hover/link:opacity-100 transition-opacity" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── 📝 SYNOPSIS SECTION ── */}
      {synopsisFullRows.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-teal-500/20">
              <PenLine className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {t("supplementarySynopsisSection" as TranslationKey)}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {t("supplementarySynopsisHint" as TranslationKey)}
              </p>
            </div>
          </div>
          <div className="space-y-4">
            {synopsisFullRows.map((a) => (
              <SupplementaryAssignmentCard
                key={`syn-${a.id}`}
                assignment={a}
                courseId={courseId}
                isSynopsis
              />
            ))}
          </div>
        </section>
      )}

      {/* ── 📋 TASKS SECTION ── */}
      {taskFullRows.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <ClipboardList className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {t("supplementaryTasksSection" as TranslationKey)}
              </h3>
            </div>
          </div>
          <div className="space-y-4">
            {taskFullRows.map((a) => (
              <SupplementaryAssignmentCard
                key={`task-${a.id}`}
                assignment={a}
                courseId={courseId}
              />
            ))}
          </div>
        </section>
      )}

      {/* Empty state when topic has no content sections */}
      {allVideos.length === 0 && theoryItems.length === 0 && synopsisFullRows.length === 0 && taskFullRows.length === 0 && materialAttachments.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 flex items-center justify-center mx-auto mb-4 shadow-inner">
            <Sparkles className="w-8 h-8 text-gray-400 dark:text-gray-500" />
          </div>
          <p className="text-gray-500 dark:text-gray-400">{t("supplementaryMaterialsEmpty" as TranslationKey)}</p>
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────
   Topic List Card
   ──────────────────────────────────────────── */

function TopicCard({
  topic,
  itemCount,
  videoCount,
  theoryCount,
  synopsisCount,
  taskCount,
  onClick,
}: {
  topic: Topic;
  itemCount: number;
  videoCount: number;
  theoryCount: number;
  synopsisCount: number;
  taskCount: number;
  onClick: () => void;
}) {
  const { t } = useLanguage();

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-700 transition-all group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-md group-hover:shadow-lg transition-shadow">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <h3 className="font-bold text-gray-900 dark:text-white text-base truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {topic.title}
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {videoCount > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-xs font-medium rounded-full">
                <Play className="w-3 h-3" /> {videoCount} {t("supplementaryVideos" as TranslationKey).toLowerCase()}
              </span>
            )}
            {theoryCount > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 text-xs font-medium rounded-full">
                <BookOpen className="w-3 h-3" /> {theoryCount} {t("supplementaryTheory" as TranslationKey).toLowerCase()}
              </span>
            )}
            {synopsisCount > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 text-xs font-medium rounded-full">
                <PenLine className="w-3 h-3" /> {synopsisCount} {t("supplementarySynopsisSection" as TranslationKey).toLowerCase()}
              </span>
            )}
            {taskCount > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs font-medium rounded-full">
                <ClipboardList className="w-3 h-3" /> {taskCount} {t("supplementaryAssignments" as TranslationKey).toLowerCase()}
              </span>
            )}
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-500 shrink-0 mt-2 transition-colors" />
      </div>
    </button>
  );
}

/* ────────────────────────────────────────────
   Main Export
   ──────────────────────────────────────────── */

export function SupplementaryMaterials({ courseId }: { courseId: number }) {
  const { t } = useLanguage();

  // Supplementary data (topics, assignments, materials)
  const { data, isLoading, error } = useQuery({
    queryKey: ["supplementary-materials", courseId],
    queryFn: async () => {
      const { data } = await api.get<SupplementaryData>(
        `/assignments/my-supplementary?course_id=${courseId}`
      );
      return data;
    },
    enabled: !!courseId,
  });

  // Full assignment rows (with submission status) 
  const { data: fullAssignmentsData } = useQuery({
    queryKey: ["student-assignments", courseId],
    queryFn: async () => {
      const { data } = await api.get<FullAssignmentRow[]>("/assignments/my");
      return Array.isArray(data) ? data : [];
    },
    staleTime: 20_000,
    enabled: !!courseId,
  });

  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);

  const topics = data?.topics ?? [];
  const assignments = data?.assignments ?? [];
  const materials = data?.materials ?? [];
  const fullAssignments = fullAssignmentsData ?? [];
  const hasItems = assignments.length > 0 || materials.length > 0;

  // Supplementary assignment IDs for cross-reference
  const suppAssignmentIds = useMemo(
    () => new Set(assignments.map((a) => a.id)),
    [assignments]
  );

  // Full rows that correspond to supplementary assignments
  const suppFullAssignments = useMemo(
    () => fullAssignments.filter((a) => suppAssignmentIds.has(a.id)),
    [fullAssignments, suppAssignmentIds]
  );

  // Topics with their items
  const topicsWithItems = useMemo(() => {
    const result: {
      topic: Topic;
      materials: SupplementaryMaterial[];
      assignments: SupplementaryAssignment[];
      fullAssignments: FullAssignmentRow[];
      videoCount: number;
      theoryCount: number;
      synopsisCount: number;
      taskCount: number;
    }[] = [];

    for (const topic of topics) {
      const topicMaterials = materials.filter((m) => m.topic_id === topic.id);
      const topicAssignments = assignments.filter((a) => a.topic_id === topic.id);
      const topicFullAssignments = suppFullAssignments.filter((a) => a.topic_id === topic.id);

      if (topicMaterials.length === 0 && topicAssignments.length === 0) continue;

      let videoCount = 0;
      for (const m of topicMaterials) videoCount += m.video_urls.length;
      for (const a of topicAssignments) videoCount += a.video_urls.length;

      const theoryCount = topicMaterials.filter((m) => m.description && m.description.trim().length > 0).length;
      const synopsisCount = topicAssignments.filter((a) => a.is_synopsis).length;
      const taskCount = topicAssignments.filter((a) => !a.is_synopsis).length;

      result.push({
        topic,
        materials: topicMaterials,
        assignments: topicAssignments,
        fullAssignments: topicFullAssignments,
        videoCount,
        theoryCount,
        synopsisCount,
        taskCount,
      });
    }

    // Uncategorized items
    const uncatMaterials = materials.filter((m) => !m.topic_id);
    const uncatAssignments = assignments.filter((a) => !a.topic_id);
    const uncatFullAssignments = suppFullAssignments.filter((a) => !a.topic_id);
    if (uncatMaterials.length > 0 || uncatAssignments.length > 0) {
      let videoCount = 0;
      for (const m of uncatMaterials) videoCount += m.video_urls.length;
      for (const a of uncatAssignments) videoCount += a.video_urls.length;

      result.push({
        topic: { id: -1, title: t("courseTopicUncategorized" as TranslationKey), order_number: 9999 },
        materials: uncatMaterials,
        assignments: uncatAssignments,
        fullAssignments: uncatFullAssignments,
        videoCount,
        theoryCount: uncatMaterials.filter((m) => m.description && m.description.trim().length > 0).length,
        synopsisCount: uncatAssignments.filter((a) => a.is_synopsis).length,
        taskCount: uncatAssignments.filter((a) => !a.is_synopsis).length,
      });
    }

    return result.sort((a, b) => a.topic.order_number - b.topic.order_number);
  }, [topics, materials, assignments, suppFullAssignments, t]);

  const selectedTopic = useMemo(
    () => topicsWithItems.find((tw) => tw.topic.id === selectedTopicId),
    [topicsWithItems, selectedTopicId]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-500 dark:text-gray-400 text-sm font-medium">{t("loading")}</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <p>{t("error")}</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-900/20 dark:via-indigo-900/20 dark:to-purple-900/20 rounded-2xl border border-blue-200/50 dark:border-blue-800/50 p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-lg">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-1">
                {t("supplementaryMaterialsHeading" as TranslationKey)}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                {t("supplementaryMaterialsDesc" as TranslationKey)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Empty state */}
      {!hasItems && (
        <div className="text-center py-16">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 flex items-center justify-center mx-auto mb-5 shadow-inner">
            <Sparkles className="w-10 h-10 text-gray-400 dark:text-gray-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
            {t("supplementaryMaterialsEmpty" as TranslationKey)}
          </h3>
        </div>
      )}

      {/* Content */}
      {hasItems && !selectedTopic && (
        /* ── Topic List View ── */
        <div className="space-y-3 animate-in fade-in duration-300">
          {topicsWithItems.length === 0 && (
            <p className="text-center text-gray-500 dark:text-gray-400 py-8">
              {t("supplementarySelectTopic" as TranslationKey)}
            </p>
          )}
          {topicsWithItems.map(({ topic, videoCount, theoryCount, synopsisCount, taskCount, materials: mats, assignments: asns }) => (
            <TopicCard
              key={topic.id}
              topic={topic}
              itemCount={mats.length + asns.length}
              videoCount={videoCount}
              theoryCount={theoryCount}
              synopsisCount={synopsisCount}
              taskCount={taskCount}
              onClick={() => setSelectedTopicId(topic.id)}
            />
          ))}
        </div>
      )}

      {hasItems && selectedTopic && (
        /* ── Topic Detail View ── */
        <SupplementaryTopicDetail
          topic={selectedTopic.topic}
          materials={selectedTopic.materials}
          assignments={selectedTopic.assignments}
          fullAssignments={selectedTopic.fullAssignments}
          courseId={courseId}
          onBack={() => setSelectedTopicId(null)}
        />
      )}
    </div>
  );
}
