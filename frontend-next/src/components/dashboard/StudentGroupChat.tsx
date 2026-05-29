"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  MessageCircle,
  Send,
  Lightbulb,
  Target,
  Users,
  GraduationCap,
  ThumbsUp,
  Clock,
  Sparkles,
  Crown,
  Pencil,
  Trash2,
  X,
  Check,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { useAuthStore } from "@/store/authStore";
import { api } from "@/api/client";
import { getGlassCardStyle, getTextColors, getInputStyle } from "@/utils/themeStyles";
import { BlurFade } from "@/components/ui/blur-fade";
import { DeleteConfirmButton } from "@/components/ui/DeleteConfirmButton";

type MessageTag = "strategy" | "tip";
type FilterType = "all" | MessageTag;

interface CommunityAuthor {
  id: number;
  full_name: string;
  photo_url: string | null;
  role: string;
  is_premium: number;
}

interface CommunityPost {
  id: number;
  text: string;
  tag: MessageTag;
  created_at: string;
  updated_at: string | null;
  author: CommunityAuthor;
  can_edit: boolean;
  can_delete: boolean;
  is_edited: boolean;
  like_count: number;
  current_user_liked: boolean;
}

const AVATAR_COLORS = [
  "linear-gradient(135deg, #FF6B6B 0%, #EE5A24 100%)",
  "linear-gradient(135deg, #7C3AED 0%, #DB2777 100%)",
  "linear-gradient(135deg, #059669 0%, #14B8A6 100%)",
  "linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)",
  "linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)",
  "linear-gradient(135deg, #EC4899 0%, #8B5CF6 100%)",
  "linear-gradient(135deg, #06B6D4 0%, #3B82F6 100%)",
  "linear-gradient(135deg, #10B981 0%, #059669 100%)",
];

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getAvatarStyle(seed: number) {
  return { background: AVATAR_COLORS[seed % AVATAR_COLORS.length] };
}

function formatRelativeTime(
  iso: string,
  t: (key: "timeToday" | "timeYesterday" | "daysAgo") => string
): string {
  const d = new Date(iso);
  const now = new Date();
  const startOfDay = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffDays = Math.floor((startOfDay(now) - startOfDay(d)) / 86400000);

  if (diffDays <= 0) return t("timeToday");
  if (diffDays === 1) return t("timeYesterday");
  if (diffDays >= 2 && diffDays <= 6) return t("daysAgo").replace("{count}", String(diffDays));
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

export function StudentGroupChat() {
  const { t, lang } = useLanguage();
  const { theme } = useTheme();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const glassStyle = getGlassCardStyle(theme);
  const textColors = getTextColors(theme);
  const inputStyle = getInputStyle(theme);
  const isDark = theme === "dark";

  const [newMessage, setNewMessage] = useState("");
  const [selectedTag, setSelectedTag] = useState<MessageTag>("strategy");
  const [filter, setFilter] = useState<FilterType>("all");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");
  const [editingTag, setEditingTag] = useState<MessageTag>("strategy");


  const { data: posts = [], isLoading, isError } = useQuery({
    queryKey: ["community-posts"],
    queryFn: async () => {
      const { data } = await api.get<CommunityPost[]>("/community/posts?limit=100");
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<CommunityPost>("/community/posts", {
        text: newMessage.trim(),
        tag: selectedTag,
      });
      return data;
    },
    onSuccess: (data) => {
      setNewMessage("");
      queryClient.setQueryData<CommunityPost[]>(["community-posts"], (prev) =>
        prev ? [data, ...prev] : [data]
      );
      queryClient.invalidateQueries({ queryKey: ["community-widget-posts"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, text, tag }: { id: number; text: string; tag: MessageTag }) => {
      const { data } = await api.patch<CommunityPost>(`/community/posts/${id}`, {
        text,
        tag,
      });
      return data;
    },
    onSuccess: async () => {
      setEditingId(null);
      setEditingText("");
      await queryClient.invalidateQueries({ queryKey: ["community-posts"] });
      await queryClient.invalidateQueries({ queryKey: ["community-widget-posts"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/community/posts/${id}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["community-posts"] });
      await queryClient.invalidateQueries({ queryKey: ["community-widget-posts"] });
    },
  });


  const filteredPosts = filter === "all" ? posts : posts.filter((post) => post.tag === filter);

  const stats = useMemo(() => {
    const participants = new Set(posts.map((post) => post.author.id)).size;
    return {
      messages: posts.length,
      strategies: posts.filter((post) => post.tag === "strategy").length,
      tips: posts.filter((post) => post.tag === "tip").length,
      participants,
    };
  }, [posts]);

  const tagConfig = {
    strategy: {
      icon: Target,
      label: t("communityTagStrategy"),
      bg: isDark ? "rgba(59, 130, 246, 0.15)" : "rgba(59, 130, 246, 0.1)",
      color: "#3B82F6",
      border: isDark ? "rgba(59, 130, 246, 0.3)" : "rgba(59, 130, 246, 0.2)",
    },
    tip: {
      icon: Lightbulb,
      label: t("communityTagTip"),
      bg: isDark ? "rgba(245, 158, 11, 0.15)" : "rgba(245, 158, 11, 0.1)",
      color: "#F59E0B",
      border: isDark ? "rgba(245, 158, 11, 0.3)" : "rgba(245, 158, 11, 0.2)",
    },
  };

  const handleSend = () => {
    if (!newMessage.trim() || createMutation.isPending) return;
    createMutation.mutate();
  };

  const likeMutation = useMutation({
    mutationFn: async (postId: number) => {
      const { data } = await api.post<CommunityPost>(`/community/posts/${postId}/like`);
      return data;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<CommunityPost[]>(["community-posts"], (prev) =>
        prev ? prev.map((p) => (p.id === updated.id ? updated : p)) : [updated]
      );
      queryClient.invalidateQueries({ queryKey: ["community-widget-posts"] });
    },
  });

  const handleLike = (postId: number) => {
    if (likeMutation.isPending) return;
    likeMutation.mutate(postId);
  };

  const startEdit = (post: CommunityPost) => {
    setEditingId(post.id);
    setEditingText(post.text);
    setEditingTag(post.tag);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingText("");
  };

  const saveEdit = (postId: number) => {
    if (!editingText.trim() || updateMutation.isPending) return;
    updateMutation.mutate({
      id: postId,
      text: editingText.trim(),
      tag: editingTag,
    });
  };


  return (
    <div className="space-y-4 sm:space-y-5">
      <BlurFade delay={0} direction="down" duration={0.5} offset={20}>
        <div
          className="relative rounded-xl overflow-hidden p-4 sm:p-6 text-white"
          style={{
            background: "linear-gradient(135deg, #7C3AED 0%, #2563EB 50%, #06B6D4 100%)",
            boxShadow: "0 8px 24px rgba(124, 58, 237, 0.25)",
          }}
        >
          <div className="absolute inset-0 opacity-10">
            <svg className="absolute bottom-0 left-0 w-full h-24" viewBox="0 0 1200 120" preserveAspectRatio="none">
              <path fill="currentColor" d="M0,60 C300,120 600,0 900,60 C1050,90 1200,30 1200,60 L1200,120 L0,120 Z" />
            </svg>
          </div>
          <div className="absolute top-4 right-4 w-32 h-32 rounded-full bg-white/10 blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl lg:text-2xl font-bold">{t("communityTitle")}</h1>
                <p className="text-white/80 text-sm">Python - {t("communityCohort")} #3</p>
              </div>
            </div>
            <p className="text-white/90 text-sm mt-3 max-w-2xl">{t("communitySubtitle")}</p>
          </div>
        </div>
      </BlurFade>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        {[
          { icon: MessageCircle, value: stats.messages, label: t("communityStatsMessages"), color: "#7C3AED" },
          { icon: Target, value: stats.strategies, label: t("communityStatsStrategies"), color: "#3B82F6" },
          { icon: Lightbulb, value: stats.tips, label: t("communityStatsTips"), color: "#F59E0B" },
          { icon: Users, value: stats.participants, label: t("communityStatsParticipants"), color: "#10B981" },
        ].map((stat, index) => (
          <BlurFade key={stat.label} delay={0.1 + index * 0.05} direction="down" duration={0.5} offset={20}>
            <div className="rounded-xl p-2.5 sm:p-4 flex flex-col xs:flex-row xs:items-center gap-2 xs:gap-3 min-w-0" style={glassStyle}>
              <div
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center text-white shrink-0"
                style={{ background: stat.color }}
              >
                <stat.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm sm:text-base md:text-lg font-bold leading-none mb-0.5" style={{ color: textColors.primary }}>
                  {stat.value}
                </p>
                <p 
                  className="text-[10px] sm:text-xs font-medium leading-tight truncate sm:whitespace-normal" 
                  style={{ color: textColors.secondary }}
                  title={stat.label}
                >
                  {stat.label}
                </p>
              </div>
            </div>
          </BlurFade>
        ))}
      </div>

      <BlurFade delay={0.3} direction="down" duration={0.5} offset={20}>
        <div className="rounded-xl overflow-hidden" style={glassStyle}>
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4" style={{ color: "#7C3AED" }} />
              <span className="text-sm font-semibold" style={{ color: textColors.primary }}>
                {t("communityWriteMessage")}
              </span>
            </div>

            <div className="flex gap-2 mb-3">
              {(["strategy", "tip"] as MessageTag[]).map((tag) => {
                const cfg = tagConfig[tag];
                const isSelected = selectedTag === tag;
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setSelectedTag(tag)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all min-h-[2.5rem]"
                    style={{
                      background: isSelected ? cfg.color : cfg.bg,
                      color: isSelected ? "#fff" : cfg.color,
                      border: `1px solid ${cfg.border}`,
                    }}
                  >
                    <cfg.icon className="w-3.5 h-3.5" />
                    {cfg.label}
                  </button>
                );
              })}
            </div>

            <div className="flex gap-2">
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={t("communityPlaceholder")}
                rows={2}
                className="flex-1 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                style={inputStyle}
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={!newMessage.trim() || createMutation.isPending}
                className="self-end px-4 py-3 rounded-xl text-white font-medium text-sm transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed min-h-[2.75rem]"
                style={{ background: "linear-gradient(135deg, #7C3AED 0%, #2563EB 100%)" }}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </BlurFade>

      <BlurFade delay={0.4} direction="down" duration={0.5} offset={20}>
        <div className="flex gap-2">
          {(["all", "strategy", "tip"] as FilterType[]).map((f) => {
            const isActive = filter === f;
            const label =
              f === "all"
                ? t("communityFilterAll")
                : f === "strategy"
                ? t("communityTagStrategy")
                : t("communityTagTip");
            return (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className="px-4 py-2.5 rounded-lg text-xs font-medium transition-all min-h-[2.5rem]"
                style={{
                  background: isActive
                    ? "linear-gradient(135deg, #7C3AED 0%, #2563EB 100%)"
                    : isDark
                    ? "rgba(30, 41, 59, 0.6)"
                    : "rgba(0, 0, 0, 0.04)",
                  color: isActive ? "#fff" : textColors.secondary,
                  border: `1px solid ${
                    isActive ? "transparent" : isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)"
                  }`,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </BlurFade>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, index) => (
            <div key={index} className="rounded-xl p-4 animate-pulse" style={glassStyle}>
              <div className="h-5 w-40 rounded bg-white/10 mb-3" />
              <div className="h-4 w-full rounded bg-white/10 mb-2" />
              <div className="h-4 w-4/5 rounded bg-white/10" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-xl p-6 text-sm" style={glassStyle}>
          <p style={{ color: textColors.primary }}>{t("error")}</p>
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="rounded-xl p-8 text-center" style={glassStyle}>
          <p className="text-base font-semibold mb-2" style={{ color: textColors.primary }}>
            {t("communityEmptyTitle")}
          </p>
          <p className="text-sm" style={{ color: textColors.secondary }}>
            {t("communityEmptyDescription")}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPosts.map((post, index) => {
            const cfg = tagConfig[post.tag];
            const TagIcon = cfg.icon;
            const isLiked = post.current_user_liked ?? false;
            const likeCount = post.like_count ?? 0;
            const isEditing = editingId === post.id;
            const canManage = post.can_edit || post.can_delete;

            return (
              <BlurFade key={post.id} delay={0.5 + index * 0.08} direction="down" duration={0.5} offset={20}>
                <div className="rounded-xl overflow-hidden transition-all hover:scale-[1.005] group" style={glassStyle}>
                  <div className="p-4">
                    <div className="flex items-start gap-3 mb-3">
                      <Link
                        href={`/app/profile/${post.author.id}`}
                        className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 overflow-hidden"
                        style={post.author.photo_url ? undefined : getAvatarStyle(post.author.id)}
                      >
                        {post.author.photo_url ? (
                          <img
                            src={post.author.photo_url}
                            alt={post.author.full_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          getInitials(post.author.full_name)
                        )}
                      </Link>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            href={`/app/profile/${post.author.id}`}
                            className="text-sm font-semibold hover:underline"
                            style={{ color: textColors.primary }}
                          >
                            {post.author.full_name}
                          </Link>
                          {post.author.role === "student" && (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
                              style={{
                                background: isDark ? "rgba(16, 185, 129, 0.15)" : "rgba(16, 185, 129, 0.1)",
                                color: "#10B981",
                                border: `1px solid ${isDark ? "rgba(16, 185, 129, 0.3)" : "rgba(16, 185, 129, 0.2)"}`,
                              }}
                            >
                              <GraduationCap className="w-3 h-3" />
                              {t("communityStudentBadge")}
                            </span>
                          )}
                          {post.author.is_premium === 1 && (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
                              style={{
                                background: isDark ? "rgba(124, 58, 237, 0.15)" : "rgba(124, 58, 237, 0.1)",
                                color: "#7C3AED",
                                border: `1px solid ${isDark ? "rgba(124, 58, 237, 0.3)" : "rgba(124, 58, 237, 0.2)"}`,
                              }}
                            >
                              <Crown className="w-3 h-3" />
                              {t("communityPremiumBadge")}
                            </span>
                          )}
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
                            style={{
                              background: cfg.bg,
                              color: cfg.color,
                              border: `1px solid ${cfg.border}`,
                            }}
                          >
                            <TagIcon className="w-3 h-3" />
                            {cfg.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <Clock className="w-3 h-3" style={{ color: textColors.secondary }} />
                          <span className="text-xs" style={{ color: textColors.secondary }}>
                            {formatRelativeTime(post.is_edited && post.updated_at ? post.updated_at : post.created_at, t)}
                          </span>
                          {post.is_edited && (
                            <span className="text-xs" style={{ color: textColors.secondary }}>
                              {t("communityEdited")}
                            </span>
                          )}
                        </div>
                      </div>

                      {canManage && (
                        <div className="flex items-center gap-1 shrink-0">
                          {!isEditing ? (
                            <>
                              <button
                                type="button"
                                onClick={() => startEdit(post)}
                                className="p-2 rounded-lg transition-all hover:opacity-80"
                                style={{
                                  color: textColors.secondary,
                                  background: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.03)",
                                }}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <DeleteConfirmButton
                                onDelete={() => deleteMutation.mutate(post.id)}
                                isLoading={deleteMutation.isPending}
                                hideText={true}
                                title={t("communityDeleteConfirm")}
                                description={t("confirmDelete")}
                                variant="ghost"
                                size="sm"
                                className="p-0 border-0 shadow-none"
                              />
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="p-2 rounded-lg transition-all hover:opacity-80"
                              style={{
                                color: textColors.secondary,
                                background: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.03)",
                              }}
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {isEditing ? (
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          {(["strategy", "tip"] as MessageTag[]).map((tag) => {
                            const cfg = tagConfig[tag];
                            const isSelected = editingTag === tag;
                            return (
                              <button
                                key={tag}
                                type="button"
                                onClick={() => setEditingTag(tag)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                                style={{
                                  background: isSelected ? cfg.color : cfg.bg,
                                  color: isSelected ? "#fff" : cfg.color,
                                  border: `1px solid ${cfg.border}`,
                                }}
                              >
                                <cfg.icon className="w-3.5 h-3.5" />
                                {cfg.label}
                              </button>
                            );
                          })}
                        </div>

                        <textarea
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          rows={3}
                          className="w-full rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                          style={inputStyle}
                        />

                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all"
                            style={{
                              background: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.04)",
                              color: textColors.secondary,
                            }}
                          >
                            <X className="w-4 h-4" />
                            {t("communityCancelEdit")}
                          </button>
                          <button
                            type="button"
                            onClick={() => saveEdit(post.id)}
                            disabled={!editingText.trim() || updateMutation.isPending}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                            style={{ background: "linear-gradient(135deg, #7C3AED 0%, #2563EB 100%)" }}
                          >
                            <Check className="w-4 h-4" />
                            {t("communitySaveChanges")}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm leading-relaxed mb-3 pl-0 sm:pl-12 mobile-safe-text" style={{ color: textColors.primary }}>
                          {post.text}
                        </p>

                        <div className="flex items-center gap-3 pl-0 sm:pl-12">
                          <button
                            type="button"
                            onClick={() => handleLike(post.id)}
                            disabled={likeMutation.isPending}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all hover:scale-105 disabled:opacity-70"
                            style={{
                              background: isLiked
                                ? isDark
                                  ? "rgba(124, 58, 237, 0.2)"
                                  : "rgba(124, 58, 237, 0.1)"
                                : isDark
                                ? "rgba(255, 255, 255, 0.05)"
                                : "rgba(0, 0, 0, 0.03)",
                              color: isLiked ? "#7C3AED" : textColors.secondary,
                              border: `1px solid ${
                                isLiked
                                  ? isDark
                                    ? "rgba(124, 58, 237, 0.3)"
                                    : "rgba(124, 58, 237, 0.2)"
                                  : isDark
                                  ? "rgba(255, 255, 255, 0.08)"
                                  : "rgba(0, 0, 0, 0.06)"
                              }`,
                            }}
                          >
                            <ThumbsUp className="w-3 h-3" />
                            {likeCount > 0 && (
                              <span className="tabular-nums">{likeCount}</span>
                            )}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </BlurFade>
            );
          })}
        </div>
      )}


    </div>
  );
}
