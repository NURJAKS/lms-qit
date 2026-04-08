"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Calendar, Clock, FileText, Loader2, Megaphone } from "lucide-react";
import { api } from "@/api/client";
import { useLanguage } from "@/context/LanguageContext";
import { useAuthStore } from "@/store/authStore";
import { formatDateTimeLocalized } from "@/lib/dateUtils";

type FeedItem = {
  kind: string;
  id: string;
  title: string;
  body?: string | null;
  link?: string | null;
  date?: string | null;
  post_kind?: string;
  meta?: Record<string, unknown>;
};

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
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const canPost =
    variant === "teacher" &&
    user &&
    (user.role === "teacher" || user.role === "curator" || user.role === "admin" || user.role === "director");

  const [postTitle, setPostTitle] = useState("");
  const [postBody, setPostBody] = useState("");
  const [postKind, setPostKind] = useState<"text" | "survey" | "event" | "recommendation">("text");
  const [postLink, setPostLink] = useState("");

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

  const createMut = useMutation({
    mutationFn: async () => {
      await api.post(`/courses/${courseId}/feed/posts`, {
        title: postTitle.trim(),
        body: postBody.trim() || null,
        kind: postKind,
        link_url: postLink.trim() || null,
        group_id: groupId ?? null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course-feed", courseId] });
      queryClient.invalidateQueries({ queryKey: ["teacher-group-feed", groupId] });
      setPostTitle("");
      setPostBody("");
      setPostLink("");
    },
  });

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

  return (
    <div className="w-full min-w-0 max-w-3xl space-y-6">
      {canPost && (
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
              onChange={(e) => setPostLink(e.target.value)}
              placeholder={t("courseFeedPostLink")}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
            />
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
              disabled={!postTitle.trim() || createMut.isPending}
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
          {items.map((it) => (
            <li
              key={it.id}
              className="flex gap-3 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-900/50"
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
                {it.date ? (
                  <p className="text-xs text-gray-500 mt-1">{formatDateTimeLocalized(it.date, lang)}</p>
                ) : null}
                {it.link ? (
                  <Link
                    href={it.link}
                    className="inline-block mt-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {t("courseFeedOpenLink")}
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
