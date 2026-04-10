"use client";

import { useEffect, useState, useCallback } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { formatLocalizedDate } from "@/utils/dateUtils";
import { useTheme } from "@/context/ThemeContext";
import { getLocalizedCourseTitle } from "@/lib/courseUtils";
import { api as apiClient } from "@/api/client";
import { Star, Check, X, MessageCircle, Sparkles, Trash2, Filter } from "lucide-react";
import { AnimatedNumber } from "./AnimatedNumber";
import { StaggeredAnimation } from "./StaggeredAnimation";
import { GlareEffect } from "./GlareEffect";
import { DeleteConfirmButton } from "@/components/ui/DeleteConfirmButton";

interface Review {
    id: number;
    user_id: number;
    user_name: string;
    user_email: string;
    course_id: number;
    course_title: string;
    rating: number;
    text: string | null;
    is_approved: boolean;
    is_featured: boolean;
    admin_reply: string | null;
    created_at: string | null;
}

interface ReviewStats {
    total: number;
    pending: number;
    approved: number;
    featured: number;
    avg_rating: number;
}

export default function ReviewManagement() {
    const { t, lang } = useLanguage();
    const { theme } = useTheme();
    const isDark = theme === "dark";
    const [reviews, setReviews] = useState<Review[]>([]);
    const [stats, setStats] = useState<ReviewStats | null>(null);
    const [filter, setFilter] = useState<string>("all");
    const [loading, setLoading] = useState(true);
    const [replyId, setReplyId] = useState<number | null>(null);
    const [replyText, setReplyText] = useState("");

    const fetchReviews = useCallback(async () => {
        try {
            const params: Record<string, string> = {};
            if (filter === "pending") params.status = "pending";
            if (filter === "approved") params.status = "approved";
            const { data } = await apiClient.get("/admin/reviews", { params });
            setReviews(data);
        } catch (e) {
            console.error(e);
        }
    }, [filter]);

    const fetchStats = async () => {
        try {
            const { data } = await apiClient.get("/reviews/stats");
            setStats(data);
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        setLoading(true);
        Promise.all([fetchReviews(), fetchStats()]).finally(() => setLoading(false));
    }, [fetchReviews]);

    const handleApprove = async (id: number) => {
        await apiClient.put(`/admin/reviews/${id}/approve`);
        fetchReviews();
        fetchStats();
    };

    const handleReject = async (id: number) => {
        await apiClient.put(`/admin/reviews/${id}/reject`);
        fetchReviews();
        fetchStats();
    };

    const handleFeature = async (id: number) => {
        await apiClient.put(`/admin/reviews/${id}/feature`);
        fetchReviews();
        fetchStats();
    };

    const handleDelete = async (id: number) => {
        await apiClient.delete(`/admin/reviews/${id}`);
        fetchReviews();
        fetchStats();
    };

    const handleReply = async (id: number) => {
        if (!replyText.trim()) return;
        await apiClient.put(`/admin/reviews/${id}/reply`, { admin_reply: replyText });
        setReplyId(null);
        setReplyText("");
        fetchReviews();
    };

    const renderStars = (rating: number) => (
        <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((s) => (
                <Star
                    key={s}
                    className={`w-4 h-4 ${s <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300 dark:text-gray-600"}`}
                />
            ))}
        </div>
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="animate-spin w-8 h-8 border-4 border-[var(--qit-primary)] border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {[
                        { label: t("reviewStatsTotal"), value: stats.total, color: "from-blue-500 to-blue-600" },
                        { label: t("reviewStatsPending"), value: stats.pending, color: "from-amber-500 to-orange-500" },
                        { label: t("reviewStatsApproved"), value: stats.approved, color: "from-emerald-500 to-green-500" },
                        { label: t("reviewStatsFeatured"), value: stats.featured, color: "from-purple-500 to-pink-500" },
                        { label: t("reviewStatsAvgRating"), value: stats.avg_rating, color: "from-yellow-500 to-amber-500" },
                    ].map((s, i) => (
                        <StaggeredAnimation key={i} delay={i * 100}>
                            <GlareEffect>
                                <div
                                    className="relative overflow-hidden rounded-2xl border border-gray-200 dark:border-white/10 backdrop-blur-xl p-6 transition-all duration-300 bg-white/80 dark:bg-[rgba(30,41,59,0.6)] shadow-lg dark:shadow-xl"
                                    style={{ 
                                        boxShadow: isDark ? `0 8px 32px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05)` : `0 4px 16px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.05)`
                                    }}
                                >
                                    <div className="relative">
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{s.label}</p>
                                        <p className="text-4xl font-bold text-gray-900 dark:text-white tracking-tight">
                                            <AnimatedNumber value={typeof s.value === 'number' ? s.value : parseFloat(String(s.value))} duration={1.5} decimals={typeof s.value === 'number' && s.value % 1 !== 0 ? 1 : 0} />
                                        </p>
                                    </div>
                                </div>
                            </GlareEffect>
                        </StaggeredAnimation>
                    ))}
                </div>
            )}

            {/* Filter Tabs */}
            <div className="flex gap-3 flex-wrap">
                {[
                    { key: "all", label: t("reviewFilterAll") },
                    { key: "pending", label: t("reviewFilterPending") },
                    { key: "approved", label: t("reviewFilterApproved") },
                ].map((f) => (
                    <button
                        key={f.key}
                        onClick={() => setFilter(f.key)}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                            filter === f.key
                                ? "bg-blue-600 text-white shadow-lg"
                                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-white/20 hover:bg-gray-100 dark:hover:bg-white/10"
                        }`}
                        style={filter === f.key ? { boxShadow: "0 4px 14px rgba(37, 99, 235, 0.4)" } : { background: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(255, 255, 255, 0.8)" }}
                    >
                        <Filter className="w-4 h-4" /> {f.label}
                    </button>
                ))}
            </div>

            {/* Reviews List */}
            {reviews.length === 0 ? (
                <div className="rounded-2xl border border-gray-200 dark:border-white/10 backdrop-blur-xl p-16 text-center bg-white/80 dark:bg-[rgba(30,41,59,0.6)] shadow-lg dark:shadow-xl" style={{ boxShadow: isDark ? "0 8px 32px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05)" : "0 4px 16px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.05)" }}>
                    <div className="w-24 h-24 mx-auto mb-6 rounded-full flex items-center justify-center bg-purple-100 dark:bg-[rgba(139,92,246,0.2)]">
                        <Star className="w-12 h-12 text-purple-600 dark:text-purple-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{t("reviewNoReviews")}</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">{t("reviewNoReviewsSubtitle")}</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {reviews.map((r, index) => (
                        <StaggeredAnimation key={r.id} delay={index * 50}>
                            <GlareEffect>
                                <div
                                    className={`relative overflow-hidden rounded-2xl border backdrop-blur-xl transition-all duration-300 bg-white/80 dark:bg-[rgba(30,41,59,0.6)] shadow-lg dark:shadow-xl ${
                                        r.is_featured
                                            ? "border-yellow-500/50 dark:border-yellow-500/50"
                                            : r.is_approved
                                                ? "border-emerald-500/30 dark:border-emerald-500/30"
                                                : "border-amber-500/30 dark:border-amber-500/30"
                                    } hover:border-gray-300 dark:hover:border-white/30`}
                                    style={{ 
                                        boxShadow: r.is_featured 
                                            ? (isDark ? "0 8px 32px rgba(251, 191, 36, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05)" : "0 4px 16px rgba(251, 191, 36, 0.2), 0 0 0 1px rgba(0, 0, 0, 0.05)")
                                            : (isDark ? "0 8px 32px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05)" : "0 4px 16px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.05)")
                                    }}
                                >
                            {r.is_featured && (
                                <div className="absolute top-0 right-0 bg-gradient-to-bl from-yellow-400 to-amber-500 text-white text-xs px-4 py-1.5 rounded-bl-xl font-medium shadow-lg">
                                    ⭐ {t("reviewFeatured")}
                                </div>
                            )}
                            <div className="p-6">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0" style={{ background: "linear-gradient(135deg, #14b8a6 0%, #3b82f6 100%)" }}>
                                                {r.user_name?.[0]?.toUpperCase() || "?"}
                                            </div>
                                            <div>
                                                <p className="font-medium text-sm text-gray-900 dark:text-white">{r.user_name}</p>
                                                <p className="text-xs text-gray-600 dark:text-gray-400">{r.user_email}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 mb-3">
                                            {renderStars(r.rating)}
                                            <span className="text-xs text-gray-600 dark:text-gray-400 ml-1">
                                                {getLocalizedCourseTitle({ title: r.course_title } as any, t)}
                                            </span>
                                        </div>
                                        {r.text && (
                                            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                                                {r.text}
                                            </p>
                                        )}
                                        {r.admin_reply && (
                                            <div className="mt-3 pl-4 border-l-2 border-blue-500">
                                                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">{t("reviewAdminReply")}</p>
                                                <p className="text-sm text-gray-700 dark:text-gray-300">{r.admin_reply}</p>
                                            </div>
                                        )}
                                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-3">
                                            {r.created_at ? formatLocalizedDate(r.created_at, lang as any, t) : ""}
                                        </p>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        {!r.is_approved && (
                                            <button
                                                onClick={() => handleApprove(r.id)}
                                                className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-600/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-600/30 border border-emerald-300 dark:border-emerald-500/30 transition-colors"
                                                title={t("reviewApprove")}
                                            >
                                                <Check className="w-4 h-4" />
                                            </button>
                                        )}
                                        {r.is_approved && (
                                            <button
                                                onClick={() => handleReject(r.id)}
                                                className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-600/20 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-600/30 border border-amber-300 dark:border-amber-500/30 transition-colors"
                                                title={t("reviewReject")}
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleFeature(r.id)}
                                            className={`p-2.5 rounded-xl transition-colors border ${
                                                r.is_featured
                                                    ? "bg-yellow-100 dark:bg-yellow-600/20 text-yellow-700 dark:text-yellow-400 border-yellow-300 dark:border-yellow-500/30"
                                                    : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-yellow-100 dark:hover:bg-yellow-600/20 border-gray-300 dark:border-white/10 hover:border-yellow-500/30"
                                            }`}
                                            title={t("reviewFeature")}
                                        >
                                            <Sparkles className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => { setReplyId(r.id === replyId ? null : r.id); setReplyText(r.admin_reply || ""); }}
                                            className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-600/20 text-blue-700 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-600/30 border border-blue-300 dark:border-blue-500/30 transition-colors"
                                            title={t("reviewReply")}
                                        >
                                            <MessageCircle className="w-4 h-4" />
                                        </button>
                                        <DeleteConfirmButton
                                            onDelete={() => handleDelete(r.id)}
                                            hideText={true}
                                            title={t("reviewDeleteConfirm")}
                                            description={t("confirmDelete")}
                                            variant="ghost"
                                            size="sm"
                                            className="p-0 border-0 shadow-none bg-red-100 dark:bg-red-600/20 rounded-xl"
                                        />
                                    </div>
                                </div>
                                {replyId === r.id && (
                                    <div className="mt-4 flex gap-2">
                                        <input
                                            value={replyText}
                                            onChange={(e) => setReplyText(e.target.value)}
                                            placeholder={t("reviewReplyPlaceholder")}
                                            className="flex-1 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--qit-primary)]"
                                        />
                                        <button
                                            onClick={() => handleReply(r.id)}
                                            className="px-4 py-2 rounded-xl bg-[var(--qit-primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
                                        >
                                            {t("reviewSendReply")}
                                        </button>
                                    </div>
                                )}
                            </div>
                                </div>
                            </GlareEffect>
                        </StaggeredAnimation>
                    ))}
                </div>
            )}
        </div>
    );
}
