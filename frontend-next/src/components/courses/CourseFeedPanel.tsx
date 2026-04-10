"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  AlertTriangle,
  Calendar,
  Clock,
  FileText,
  Loader2,
  Megaphone,
  Paperclip,
  Trash2,
  X,
} from "lucide-react";
import { api } from "@/api/client";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import type { TranslationKey } from "@/i18n/translations";
import { useAuthStore } from "@/store/authStore";
import { formatLocalizedDate } from "@/utils/dateUtils";
import { getModalStyle, getTextColors } from "@/utils/themeStyles";
import { feedLinkDisplayHref, isPlausibleExternalUrl, normalizeFeedLinkForSave } from "@/utils/feedLink";

const FEED_ATTACHMENTS_MAX = 12;

type FeedItem = {
  kind: string;
  id: string;
  title: string;
  body?: string | null;
  link?: string | null;
  date?: string | null;
  post_kind?: string;
  attachment_urls?: string[];
  meta?: Record<string, unknown>;
};

function isImageAttachmentUrl(url: string): boolean {
  const path = url.split("?")[0]?.toLowerCase() ?? "";
  return /\.(jpe?g|png|gif|webp)$/i.test(path);
}

function postAccentClass(postKind: string | undefined): string {
  if (postKind === "survey") return "border-l-teal-500";
  if (postKind === "event") return "border-l-violet-500";
  if (postKind === "recommendation") return "border-l-amber-500";
  return "border-l-slate-400 dark:border-l-slate-500";
}

function FeedAttachmentsBlock({
  urls,
  t,
}: {
  urls: string[];
  t: (key: TranslationKey) => string;
}) {
  if (!urls.length) return null;
  const images = urls.filter(isImageAttachmentUrl);
  const files = urls.filter((u) => !isImageAttachmentUrl(u));
  return (
    <div className="mt-3 space-y-3">
      <p className="text-[10px] uppercase tracking-wide font-semibold text-gray-500 dark:text-gray-400">
        {t("courseFeedAttachments")}
      </p>
      {images.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {images.map((u) => (
            <a
              key={u}
              href={u}
              target="_blank"
              rel="noopener noreferrer"
              className="group block overflow-hidden rounded-xl border border-gray-200 bg-gray-100 dark:border-gray-600 dark:bg-gray-800 aspect-[4/3] shadow-sm transition-shadow hover:shadow-md"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]" loading="lazy" />
            </a>
          ))}
        </div>
      ) : null}
      {files.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {files.map((u) => {
            const name = u.split("/").pop()?.split("?")[0] || u;
            return (
              <a
                key={u}
                href={u}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex max-w-full items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-medium text-blue-600 shadow-sm transition-colors hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800/90 dark:text-blue-400 dark:hover:bg-gray-800"
              >
                <Paperclip className="w-3.5 h-3.5 shrink-0 opacity-80" />
                <span className="truncate">{name}</span>
              </a>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function CourseFeedPanel({
  variant,
  courseId,
  groupId,
}: {
  variant: "student" | "teacher";
  courseId: number;
  groupId?: number;
}) {
  const { t, lang } = useLanguage();
  const { theme } = useTheme();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [portalMounted, setPortalMounted] = useState(false);
  const modalStyle = getModalStyle(theme);
  const textColors = getTextColors(theme);
  const isDarkTheme = theme === "dark";

  useEffect(() => {
    setPortalMounted(true);
  }, []);

  const canManage =
    variant === "teacher" &&
    user &&
    (user.role === "teacher" || user.role === "curator" || user.role === "admin" || user.role === "director");

  const [postTitle, setPostTitle] = useState("");
  const [postBody, setPostBody] = useState("");
  const [postKind, setPostKind] = useState<"text" | "survey" | "event" | "recommendation">("text");
  const [postLink, setPostLink] = useState("");
  const [postLinkError, setPostLinkError] = useState<string | null>(null);
  const [postAttachments, setPostAttachments] = useState<string[]>([]);
  const [uploadBusy, setUploadBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: variant === "student" ? ["course-feed", courseId] : ["teacher-group-feed", groupId],
    queryFn: async () => {
      if (variant === "student") {
        const { data: d } = await api.get<{ items: FeedItem[] }>(`/courses/${courseId}/feed`);
        return d.items;
      }
      const { data: d } = await api.get<{ items: FeedItem[] }>(`/teacher/groups/${groupId}/feed`);
      return d.items;
    },
    enabled: variant === "student" ? courseId > 0 : (groupId ?? 0) > 0,
  });

  const uploadFile = async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    const { data: d } = await api.post<{ url: string }>("/teacher/assignments/upload", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return d.url;
  };

  const onPickFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploadBusy(true);
    try {
      const next: string[] = [...postAttachments];
      for (let i = 0; i < files.length && next.length < FEED_ATTACHMENTS_MAX; i++) {
        const url = await uploadFile(files[i]!);
        if (!next.includes(url)) next.push(url);
      }
      setPostAttachments(next.slice(0, FEED_ATTACHMENTS_MAX));
    } catch {
      setPostLinkError(t("courseFeedUploadFailed"));
    } finally {
      setUploadBusy(false);
      e.target.value = "";
    }
  };

  const createMut = useMutation({
    mutationFn: async () => {
      const rawLink = postLink.trim();
      if (rawLink && !isPlausibleExternalUrl(rawLink)) {
        throw new Error("LINK_INVALID");
      }
      const link_url = rawLink ? normalizeFeedLinkForSave(rawLink) : null;
      if (rawLink && !link_url) {
        throw new Error("LINK_INVALID");
      }
      await api.post(`/courses/${courseId}/feed/posts`, {
        title: postTitle.trim(),
        body: postBody.trim() || null,
        kind: postKind,
        link_url,
        group_id: groupId ?? null,
        attachment_urls: postAttachments.length ? postAttachments : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course-feed", courseId] });
      queryClient.invalidateQueries({ queryKey: ["teacher-group-feed", groupId] });
      setPostTitle("");
      setPostBody("");
      setPostLink("");
      setPostAttachments([]);
      setPostLinkError(null);
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "LINK_INVALID") {
        setPostLinkError(t("courseFeedLinkValidationError"));
        return;
      }
      setPostLinkError(null);
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (postId: number) => {
      await api.delete(`/courses/${courseId}/feed/posts/${postId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course-feed", courseId] });
      queryClient.invalidateQueries({ queryKey: ["teacher-group-feed", groupId] });
      setConfirmDeleteId(null);
    },
  });

  useEffect(() => {
    if (confirmDeleteId == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !deleteMut.isPending) setConfirmDeleteId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmDeleteId, deleteMut.isPending]);

  const items = data ?? [];

  const iconFor = (it: FeedItem) => {
    if (it.kind === "deadline") return <Clock className="w-4 h-4 text-orange-500 shrink-0" />;
    if (it.kind === "schedule") return <Calendar className="w-4 h-4 text-blue-500 shrink-0" />;
    if (it.kind === "missing_topic_assignment") return <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />;
    if (it.kind === "pending_grade") return <FileText className="w-4 h-4 text-violet-500 shrink-0" />;
    return <Megaphone className="w-4 h-4 text-teal-500 shrink-0" />;
  };

  const labelFor = (it: FeedItem) => {
    if (it.kind === "deadline") return t("courseFeedBadgeDeadline");
    if (it.kind === "schedule") return t("courseFeedBadgeSchedule");
    if (it.kind === "missing_topic_assignment") return t("courseFeedBadgeMissingAssignment");
    if (it.kind === "pending_grade") return t("courseFeedBadgePendingGrade");
    if (it.post_kind === "survey") return t("courseFeedBadgeSurvey");
    if (it.post_kind === "event") return t("courseFeedBadgeEvent");
    if (it.post_kind === "recommendation") return t("courseFeedBadgeRecommendation");
    return t("courseFeedBadgeNews");
  };

  const parsePostNumericId = (id: string): number | null => {
    const m = id.match(/^post-(\d+)$/);
    return m ? Number(m[1]) : null;
  };

  return (
    <div className="w-full min-w-0 max-w-3xl space-y-6">
      {canManage && (
        <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-900/40">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">{t("courseFeedCreatePost")}</h3>
          <div className="space-y-2">
            <input
              value={postTitle}
              onChange={(e) => setPostTitle(e.target.value)}
              placeholder={t("courseFeedPostTitle")}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
            />
            <textarea
              value={postBody}
              onChange={(e) => setPostBody(e.target.value)}
              placeholder={t("courseFeedPostBody")}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
            />
            <input
              value={postLink}
              onChange={(e) => {
                setPostLink(e.target.value);
                setPostLinkError(null);
              }}
              placeholder={t("courseFeedPostLink")}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
            />
            {postLinkError ? (
              <p className="text-xs text-amber-600 dark:text-amber-400">{postLinkError}</p>
            ) : null}
            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.txt,.mp4,.webm"
                className="hidden"
                onChange={onPickFiles}
              />
              <button
                type="button"
                disabled={uploadBusy || postAttachments.length >= FEED_ATTACHMENTS_MAX}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-xs font-medium text-gray-800 dark:text-gray-200 disabled:opacity-50"
              >
                {uploadBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />}
                {uploadBusy ? t("courseFeedUploading") : t("courseFeedAddFiles")}
              </button>
              {postAttachments.length > 0 ? (
                <ul className="flex flex-wrap gap-2">
                  {postAttachments.map((u) => (
                    <li
                      key={u}
                      className="flex max-w-full items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/80 pl-2 pr-1 py-1 text-xs"
                    >
                      <span className="truncate text-gray-700 dark:text-gray-300">
                        {u.split("/").pop()?.split("?")[0] || u}
                      </span>
                      <button
                        type="button"
                        className="shrink-0 rounded p-0.5 text-red-600 hover:bg-red-500/10"
                        aria-label={t("delete")}
                        onClick={() => setPostAttachments((prev) => prev.filter((x) => x !== u))}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <select
              value={postKind}
              onChange={(e) => setPostKind(e.target.value as typeof postKind)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
            >
              <option value="text">{t("courseFeedKindText")}</option>
              <option value="survey">{t("courseFeedKindSurvey")}</option>
              <option value="event">{t("courseFeedKindEvent")}</option>
              <option value="recommendation">{t("courseFeedKindRecommendation")}</option>
            </select>
            <button
              type="button"
              disabled={!postTitle.trim() || createMut.isPending || uploadBusy}
              onClick={() => createMut.mutate()}
              className="py-2 px-4 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: "var(--qit-primary)" }}
            >
              {createMut.isPending ? t("loading") : t("courseFeedSubmit")}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 text-gray-500 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          {t("loading")}
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t("courseFeedEmpty")}</p>
      ) : (
        <ul className="space-y-3">
          {items.map((it) => {
            const isPost = it.kind === "post";
            const accent = isPost ? postAccentClass(it.post_kind) : "border-l-transparent";
            const postId = isPost ? parsePostNumericId(it.id) : null;
            const attachments = it.attachment_urls ?? [];
            return (
              <li
                key={it.id}
                className={`flex gap-3 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-900/50 border-l-4 ${accent} shadow-sm`}
              >
                <div className="mt-0.5">{iconFor(it)}</div>
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] uppercase tracking-wide font-semibold text-gray-500 dark:text-gray-400">
                    {labelFor(it)}
                  </span>
                  <p className="mt-0.5 break-words font-medium text-gray-900 dark:text-white">{it.title}</p>
                  {it.body ? (
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 whitespace-pre-wrap">{it.body}</p>
                  ) : null}
                  <FeedAttachmentsBlock urls={attachments} t={t} />
                  {it.date ? (
                    <p className="text-xs text-gray-500 mt-2">{formatLocalizedDate(it.date, lang, t)}</p>
                  ) : null}
                  {it.link?.trim() ? (() => {
                    const { href, external, ok } = feedLinkDisplayHref(it.link);
                    if (!ok) {
                      return (
                        <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">{t("courseFeedLinkBroken")}</p>
                      );
                    }
                    if (external) {
                      return (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block mt-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline break-all"
                        >
                          {t("courseFeedOpenLink")}
                        </a>
                      );
                    }
                    return (
                      <Link
                        href={href}
                        className="inline-block mt-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline break-all"
                      >
                        {t("courseFeedOpenLink")}
                      </Link>
                    );
                  })() : null}
                </div>
                {canManage && isPost && postId != null ? (
                  <button
                    type="button"
                    disabled={deleteMut.isPending && confirmDeleteId === postId}
                    className="shrink-0 self-start rounded-lg p-2 text-red-600 hover:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/15 disabled:opacity-50"
                    title={t("courseFeedDeletePost")}
                    aria-label={t("courseFeedDeletePost")}
                    onClick={() => setConfirmDeleteId(postId)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {portalMounted &&
        confirmDeleteId != null &&
        createPortal(
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <button
              type="button"
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              aria-label={t("close")}
              disabled={deleteMut.isPending}
              onClick={() => !deleteMut.isPending && setConfirmDeleteId(null)}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="feed-delete-title"
              className="relative w-full max-w-md rounded-2xl border p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200"
              style={{
                ...modalStyle,
                borderColor: isDarkTheme ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)",
              }}
            >
              <button
                type="button"
                className="absolute right-3 top-3 rounded-lg p-1.5 transition-colors hover:bg-black/5 dark:hover:bg-white/10"
                style={{ color: textColors.secondary }}
                disabled={deleteMut.isPending}
                onClick={() => setConfirmDeleteId(null)}
                aria-label={t("close")}
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex flex-col items-center text-center pt-1">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10">
                  <AlertTriangle className="h-7 w-7 text-red-500" strokeWidth={2} />
                </div>
                <h2 id="feed-delete-title" className="text-lg font-bold font-geologica" style={{ color: textColors.primary }}>
                  {t("courseFeedDeleteModalTitle")}
                </h2>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: textColors.secondary }}>
                  {t("courseFeedDeletePostConfirm")}
                </p>
                {(() => {
                  const pendingTitle = items.find(
                    (i) => i.kind === "post" && parsePostNumericId(i.id) === confirmDeleteId
                  )?.title;
                  return pendingTitle ? (
                    <p
                      className="mt-3 w-full truncate rounded-xl border px-3 py-2 text-sm font-medium"
                      style={{
                        borderColor: isDarkTheme ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)",
                        color: textColors.primary,
                        background: isDarkTheme ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                      }}
                      title={pendingTitle}
                    >
                      {pendingTitle}
                    </p>
                  ) : null;
                })()}
              </div>
              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  disabled={deleteMut.isPending}
                  className="w-full rounded-xl px-4 py-3 text-sm font-semibold transition-colors sm:w-auto"
                  style={{
                    background: isDarkTheme ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
                    color: textColors.primary,
                  }}
                  onClick={() => setConfirmDeleteId(null)}
                >
                  {t("cancel")}
                </button>
                <button
                  type="button"
                  disabled={deleteMut.isPending}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-red-600/25 transition-colors hover:bg-red-700 disabled:opacity-60 sm:w-auto"
                  onClick={() => deleteMut.mutate(confirmDeleteId)}
                >
                  {deleteMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  {t("courseFeedDeletePost")}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
