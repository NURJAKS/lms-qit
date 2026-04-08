"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useLanguage } from "@/context/LanguageContext";
import { 
  Users, 
  Send, 
  Loader2, 
  MessageSquare
} from "lucide-react";
import { cn } from "@/lib/utils";

type TargetType = "assignment" | "material";

type PrivateComment = {
  id: number | null;
  target_type?: TargetType;
  target_id?: number;
  author_role: string | null;
  author_id: number | null;
  author_name: string | null;
  text: string;
  created_at: string | null;
};

const AVATAR_COLORS = [
  "bg-purple-600",
  "bg-blue-600",
  "bg-amber-500",
  "bg-emerald-600",
  "bg-pink-600",
  "bg-indigo-600",
];

function getAvatarColor(name: string) {
  if (!name) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatRelativeDate(iso: string | null, t: (k: any) => string) {
  if (!iso) return "";
  const date = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  if (diffDays === 1) {
    return t("yesterday");
  }
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function PrivateCommentsSection({
  targetType,
  targetId,
  canPost = true,
  placeholder = "Add private comment...",
  title = "Private comments",
}: {
  targetType: TargetType;
  targetId: number;
  canPost?: boolean;
  placeholder?: string;
  title?: string;
}) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");

  const queryKey = useMemo(() => ["private-comments", targetType, targetId] as const, [targetType, targetId]);

  const { data: comments = [], isPending, isError } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data } = await api.get<PrivateComment[]>(
        `/private-comments?target_type=${encodeURIComponent(targetType)}&target_id=${encodeURIComponent(String(targetId))}`
      );
      return data;
    },
    enabled: Number.isFinite(targetId),
  });

  const postMutation = useMutation({
    mutationFn: async (text: string) => {
      await api.post(`/private-comments`, {
        target_type: targetType,
        target_id: targetId,
        text,
      });
    },
    onSuccess: () => {
      setDraft("");
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const displayComments = useMemo(() => {
    return [...comments].sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return ta - tb;
    });
  }, [comments]);

  const handleSend = () => {
    if (!draft.trim() || postMutation.isPending) return;
    postMutation.mutate(draft.trim());
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Users className="h-5 w-5 text-gray-500 dark:text-gray-400" />
        <h3 className="text-sm font-bold text-gray-900 dark:text-white">
          {displayComments.length} {t("personalComments").toLowerCase()}
        </h3>
      </div>

      {/* Comments List */}
      <div className="space-y-4">
        {isPending ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          </div>
        ) : isError ? (
          <p className="text-xs text-red-500">{t("privateCommentsLoadError")}</p>
        ) : displayComments.length === 0 ? (
          <p className="text-xs text-gray-400 pl-8 italic">{t("privateCommentsEmpty")}</p>
        ) : (
          displayComments.map((c, idx) => {
            const authorName = c.author_name || (c.author_role === "teacher" ? t("studentTeacher") : t("you"));
            const initials = getInitials(authorName);
            const bgColor = getAvatarColor(authorName);

            return (
              <div key={c.id ?? idx} className="flex gap-3 group animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-sm", bgColor)}>
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-bold text-gray-900 dark:text-white">
                      {authorName}
                    </span>
                    <span className="text-[10px] text-gray-400 font-medium">
                      • {formatRelativeDate(c.created_at, t)}
                    </span>
                  </div>
                  <div className="mt-1 text-sm leading-relaxed text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {c.text}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input Area */}
      <div className="space-y-3">
        <div className={cn(
          "relative overflow-hidden rounded-2xl border bg-white transition-all focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 dark:bg-gray-950",
          "border-gray-200 dark:border-gray-800"
        )}>
          <textarea
            className="w-full resize-none border-0 bg-transparent px-4 py-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-white dark:placeholder:text-gray-600"
            placeholder={placeholder}
            rows={2}
            value={draft}
            disabled={!canPost || postMutation.isPending}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          
          <div className="flex items-center justify-end border-t border-gray-100 px-3 py-1.5 dark:border-gray-900">
            <button
              type="button"
              onClick={handleSend}
              disabled={postMutation.isPending || !draft.trim() || !canPost}
              className={cn(
                "ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all active:scale-95",
                draft.trim() && canPost
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20 hover:bg-blue-700" 
                  : "bg-gray-100 text-gray-300 dark:bg-gray-800 dark:text-gray-600"
              )}
            >
              {postMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <p className="flex items-center gap-1.5 px-1 text-[11px] font-medium text-gray-400">
          <MessageSquare className="h-3 w-3" />
          {t("privateCommentsAssignmentHint")}
        </p>
      </div>
    </div>
  );
}

