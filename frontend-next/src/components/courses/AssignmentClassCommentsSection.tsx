"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useLanguage } from "@/context/LanguageContext";
import { Loader2, Send } from "lucide-react";

export type ClassCommentRow = {
  id: number;
  author_id: number;
  author_name: string;
  author_role: string | null;
  text: string;
  created_at: string | null;
};

export function AssignmentClassCommentsSection({
  assignmentId,
  hideHeading = false,
}: {
  assignmentId: number;
  /** When the parent already renders the section title (e.g. teacher assignment page). */
  hideHeading?: boolean;
}) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");

  const queryKey = useMemo(() => ["assignment-class-comments", assignmentId] as const, [assignmentId]);

  const { data: comments = [], isPending, isError } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data } = await api.get<ClassCommentRow[]>(`/assignments/${assignmentId}/class-comments`);
      return Array.isArray(data) ? data : [];
    },
    enabled: Number.isFinite(assignmentId) && assignmentId > 0,
  });

  const postMutation = useMutation({
    mutationFn: async (text: string) => {
      await api.post(`/assignments/${assignmentId}/class-comments`, { text });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setDraft("");
    },
  });

  return (
    <section className="space-y-3">
      {hideHeading ? null : (
        <>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">{t("assignmentClassComments")}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t("assignmentClassCommentsHint")}</p>
        </>
      )}

      {isPending ? (
        <p className="text-sm text-gray-500">{t("loading")}</p>
      ) : isError ? (
        <p className="text-sm text-red-500">{t("assignmentClassCommentsLoadError")}</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t("assignmentClassCommentsEmpty")}</p>
      ) : (
        <div className="space-y-2">
          {comments.map((c) => (
            <div
              key={c.id}
              className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                  {c.author_name || "—"}
                </span>
                {c.created_at ? (
                  <span className="text-[11px] text-gray-500">{new Date(c.created_at).toLocaleString()}</span>
                ) : null}
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-gray-900 dark:text-white">{c.text}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 rounded-xl border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-900">
        <textarea
          className="min-h-[44px] flex-1 resize-none border-0 bg-transparent px-2 py-1.5 text-sm text-gray-900 outline-none dark:text-white"
          placeholder={t("assignmentClassCommentPlaceholder")}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
          disabled={postMutation.isPending}
        />
        <button
          type="button"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--qit-primary)] text-white disabled:opacity-50"
          disabled={postMutation.isPending || !draft.trim()}
          onClick={() => postMutation.mutate(draft.trim())}
          aria-label={t("send")}
        >
          {postMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </section>
  );
}
