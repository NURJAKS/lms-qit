"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FileText, Globe, Loader2, Lock, MessageSquare, Paperclip, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import { api } from "@/api/client";
import { useLanguage } from "@/context/LanguageContext";
import type { AxiosError } from "axios";
import { cn } from "@/lib/utils";
import { ALLOWED_EXTENSIONS_STR, ALLOWED_EXTENSIONS_HINT } from "@/constants/fileTypes";

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
  is_synopsis?: boolean;
  is_supplementary?: boolean;
  is_locked?: boolean;
};

type Props = {
  topicId: number;
  courseId: number;
};

type SubmissionAttachment = { kind: "file" | "link"; url: string };

function classifySubmissionAttachment(url: string): "link" | "file" {
  return /^https?:\/\//i.test(url.trim()) ? "link" : "file";
}

function fileNameFromUrl(url: string, idx: number, fileLabel: string): string {
  return url.split("/").pop()?.split("?")[0] || `${fileLabel} ${idx + 1}`;
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

export function TopicSynopsisSection({ topicId, courseId }: Props) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { data: assignmentsData = [], isPending: isLoading } = useQuery({
    queryKey: ["student-assignments", courseId],
    queryFn: async () => {
      const { data } = await api.get<AssignmentRow[]>("/assignments/my");
      return Array.isArray(data) ? data : [];
    },
    enabled: !!courseId,
  });

  const synopsis = useMemo(() => {
    const list = assignmentsData.filter((a) => a.topic_id === topicId && a.is_synopsis && !a.is_supplementary);
    if (list.length === 0) return null;
    // Prefer the one already submitted
    const submitted = list.find(a => a.submitted);
    if (submitted) return submitted;
    // Otherwise pick the newest (highest ID)
    return [...list].sort((a, b) => b.id - a.id)[0];
  }, [assignmentsData, topicId]);

  const [attachments, setAttachments] = useState<SubmissionAttachment[]>([]);
  const [noteText, setNoteText] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (synopsis?.submitted) {
      setAttachments(
        (synopsis.submission_file_urls ?? []).map((url) => ({
          kind: classifySubmissionAttachment(url),
          url,
        }))
      );
      setNoteText(synopsis.submission_text ?? "");
    } else {
      setAttachments([]);
      setNoteText("");
    }
  }, [synopsis?.id, synopsis?.submitted, synopsis?.submission_file_urls, synopsis?.submission_text]);

  const refreshData = () => {
    queryClient.invalidateQueries({ queryKey: ["student-assignments", courseId] });
    queryClient.invalidateQueries({ queryKey: ["topic-flow", topicId] });
  };

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!synopsis) return;
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await api.post<{ url: string }>(
        `/assignments/submissions/upload?assignment_id=${synopsis.id}`,
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
      setActionError(apiErrorDetail(err) ?? t("topicFlowSynopsisUploadError"));
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!synopsis) return;
      await api.post(`/assignments/${synopsis.id}/submit`, {
        submission_text: noteText.trim() || null,
        file_urls: attachments.map((a) => a.url),
      });
    },
    onSuccess: () => {
      setInfo(t("topicFlowSynopsisSaved"));
      setActionError(null);
      refreshData();
    },
    onError: (err) => {
      setActionError(apiErrorDetail(err) ?? t("topicFlowSynopsisSaveError"));
    },
  });

  const unsubmitMutation = useMutation({
    mutationFn: async () => {
      if (!synopsis) return;
      await api.post(`/assignments/${synopsis.id}/unsubmit`);
    },
    onSuccess: () => {
      setInfo(null);
      setActionError(null);
      refreshData();
    },
  });

  if (isLoading) {
    return (
      <div className="mb-6 flex items-center gap-2 text-gray-500 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        {t("loading")}
      </div>
    );
  }

  if (!synopsis) return null;

  const isLocked = synopsis.is_locked;
  const isGraded = synopsis.grade !== null;
  const isBusy = uploadMutation.isPending || saveMutation.isPending || unsubmitMutation.isPending;

  return (
    <div className={cn(
      "mb-6 p-4 rounded-xl border transition-all",
      isLocked 
        ? "border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/50 opacity-60 grayscale" 
        : "border-teal-200 dark:border-teal-800 bg-teal-50/80 dark:bg-teal-900/20 shadow-sm shadow-teal-500/5"
    )}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {isLocked ? <Lock className="w-5 h-5 text-gray-400" /> : <FileText className="w-5 h-5 text-teal-600 dark:text-teal-400" />}
          <h3 className="font-semibold text-gray-900 dark:text-white">
            {synopsis.title || t("topicFlowSynopsisTitle")}
          </h3>
        </div>
        {isLocked && (
          <span className="text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2.5 py-1 rounded-full border border-amber-200 dark:border-amber-800">
            {t("lockedWatchVideoFirst")}
          </span>
        )}
        {!isLocked && (
          <span className="text-xs font-bold text-teal-700 dark:text-teal-400">
            {isGraded ? t("gradedStatus") : synopsis.submitted ? t("submittedStatus") : t("appointedStatus")}
          </span>
        )}
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">{t("topicFlowSynopsisHint")}</p>

      {/* Teacher's Synopsis Description & Materials */}
      {(synopsis.description || synopsis.attachment_urls?.length > 0 || synopsis.attachment_links?.length > 0) && (
        <div className="mb-6 p-4 rounded-xl border border-teal-100 bg-white/50 dark:border-teal-900/30 dark:bg-teal-950/20">
          <p className="text-[10px] font-bold text-teal-600/60 dark:text-teal-400/60 uppercase tracking-widest mb-3">
            {t("theoryMaterial")}
          </p>
          
          {synopsis.description && (
            <div 
              className="prose prose-sm max-w-none dark:prose-invert text-gray-700 dark:text-gray-300 mb-4"
              dangerouslySetInnerHTML={{ __html: synopsis.description }}
            />
          )}

          {(synopsis.attachment_urls?.length > 0 || synopsis.attachment_links?.length > 0) && (
            <div className="space-y-2">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {synopsis.attachment_urls.map((url, idx) => (
                  <a
                    key={`teacher-att-${idx}`}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-lg border border-teal-100 bg-white px-3 py-2 text-sm font-medium text-teal-700 hover:bg-teal-50 hover:border-teal-200 transition-all dark:border-teal-800 dark:bg-gray-900 dark:text-teal-300 dark:hover:bg-teal-900/40"
                  >
                    <FileText className="w-4 h-4 shrink-0" />
                    <span className="truncate">{fileNameFromUrl(url, idx, t("fileTypeFile"))}</span>
                    <Globe className="w-3 h-3 ml-auto opacity-40" />
                  </a>
                ))}
                {synopsis.attachment_links.map((url, idx) => (
                  <a
                    key={`teacher-link-${idx}`}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-lg border border-teal-100 bg-white px-3 py-2 text-sm font-medium text-teal-700 hover:bg-teal-50 hover:border-teal-200 transition-all dark:border-teal-800 dark:bg-gray-900 dark:text-teal-300 dark:hover:bg-teal-900/40"
                  >
                    <Globe className="w-4 h-4 shrink-0" />
                    <span className="truncate">{url}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept={ALLOWED_EXTENSIONS_STR}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) uploadMutation.mutate(f);
          e.target.value = "";
        }}
      />

      {/* Attachments list */}
      {attachments.length > 0 && (
        <ul className="mb-4 space-y-2">
          {attachments.map((att, idx) => (
            <li
              key={`${att.url}-${idx}`}
              className="flex items-center justify-between gap-2 rounded-lg border border-teal-200 bg-white/60 px-3 py-2 text-sm dark:border-teal-800 dark:bg-teal-950/20"
            >
              <div className="min-w-0 flex-1 flex items-center gap-2">
                <Paperclip className="h-4 w-4 text-teal-500 shrink-0" />
                <a
                  href={att.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate font-medium text-teal-700 hover:underline dark:text-teal-300"
                >
                  {fileNameFromUrl(att.url, idx, t("fileTypeFile"))}
                </a>
              </div>
              {!synopsis.submitted && !isLocked && (
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                  className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Add file button */}
      {!synopsis.submitted && !isLocked && (
        <div className="space-y-2 mb-4">
          <button
            type="button"
            disabled={isBusy || attachments.length >= 5}
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-teal-300 dark:border-teal-800 text-teal-700 dark:text-teal-400 hover:bg-teal-100/50 dark:hover:bg-teal-900/30 transition-all text-sm font-bold"
          >
            {uploadMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {t("topicFlowChooseFile")}
          </button>
          <p className="text-[10px] font-medium text-center" style={{ color: "#F87171" }}>
            {t("onlyAllowedExtensions").replace("{extensions}", ALLOWED_EXTENSIONS_HINT)}
          </p>
        </div>
      )}

      {/* Note textarea */}
      <textarea
        value={noteText}
        onChange={(e) => setNoteText(e.target.value)}
        placeholder={t("topicFlowSynopsisNotePlaceholder")}
        rows={3}
        disabled={synopsis.submitted || isLocked}
        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-sm mb-4 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all disabled:opacity-50"
      />

      {/* Submission Actions */}
      {!synopsis.submitted && !isLocked && (
        <button
          type="button"
          disabled={isBusy || (attachments.length === 0 && !noteText.trim())}
          onClick={() => saveMutation.mutate()}
          className="w-full py-3 rounded-xl text-sm font-extrabold text-white shadow-lg shadow-teal-500/20 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:scale-100"
          style={{ background: "linear-gradient(135deg, #0d9488, #0f766e)" }}
        >
          {saveMutation.isPending ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : t("topicFlowSynopsisSave")}
        </button>
      )}

      {synopsis.submitted && !isGraded && !isLocked && (
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 font-bold text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            {t("topicFlowSynopsisGradingPending")}
          </div>
          <button
            type="button"
            className="w-full py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 text-sm font-bold text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
            onClick={() => unsubmitMutation.mutate()}
            disabled={unsubmitMutation.isPending}
          >
            {unsubmitMutation.isPending ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : t("cancelSending")}
          </button>
        </div>
      )}

      {isGraded && (
        <div className="mt-2 p-4 rounded-xl border border-green-200 bg-green-50/50 dark:border-green-900/30 dark:bg-green-900/10">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-black mb-1">
            <CheckCircle2 className="w-5 h-5" />
            {t("topicFlowSynopsisGraded")}
          </div>
          {synopsis.teacher_comment && (
            <div className="mt-2 text-sm text-gray-700 dark:text-gray-200 italic leading-relaxed">
              &ldquo;{synopsis.teacher_comment}&rdquo;
            </div>
          )}
        </div>
      )}

      {actionError && <p className="mt-3 text-sm font-bold text-red-600 dark:text-red-400">{t(actionError as any)}</p>}
      {info && <p className="mt-3 text-sm font-bold text-teal-600 dark:text-teal-400">{info}</p>}
    </div>
  );
}
