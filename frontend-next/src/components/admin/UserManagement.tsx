"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { Coins, Download, Pencil, Plus, Trash2, UserPlus, Info, X } from "lucide-react";
import { useSidebar } from "@/context/SidebarContext";
import { getGlassCardStyle, getModalStyle, getInputStyle, getTextColors } from "@/utils/themeStyles";
import { BlurFade } from "@/components/ui/blur-fade";
import { DeleteConfirmButton } from "@/components/ui/DeleteConfirmButton";
import { getLocalizedCourseTitle } from "@/lib/courseUtils";
import { formatLocalizedDate } from "@/utils/dateUtils";
import { mapCity } from "@/lib/profileFieldLabels";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { toast } from "@/store/notificationStore";
import { motion, AnimatePresence } from "framer-motion";

const ADMIN_REWARD_COINS_MAX = 100_000;

type UserRow = {
  id: number;
  email: string;
  full_name: string;
  role: string;
  points?: number;
  description?: string;
  photo_url?: string;
  parent_id?: number | null;
  phone?: string | null;
  birth_date?: string | null;
  address?: string | null;
  parent?: {
    id: number;
    full_name: string;
    email: string;
  } | null;
  children?: Array<{
    id: number;
    full_name: string;
    email: string;
  }> | null;
};

type StudentWithoutGroup = {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  course_id: number;
  course_title: string;
  enrolled_at: string | null;
};

type AssignStudentTarget = StudentWithoutGroup & { application_id?: number | null };

type GroupQueueItem = {
  queue_kind: "awaiting_confirmation" | "needs_group";
  application_id: number | null;
  user_id: number;
  course_id: number;
  full_name: string;
  email: string;
  phone: string;
  course_title: string | null;
  created_at: string | null;
  enrolled_at: string | null;
};

type GroupQueueResponse = {
  awaiting_confirmation: GroupQueueItem[];
  needs_group: GroupQueueItem[];
  counts: { awaiting_confirmation: number; needs_group: number; total: number };
};

type UsersTabId = "group-queue" | "users" | "parents" | "relations";

type TeacherGroupOption = {
  id: number;
  group_name: string;
  teacher_id: number;
  teacher_name: string;
};

type ParentOption = {
  id: number;
  full_name: string;
};

type ParentLinkRow = {
  student: {
    id: number;
    full_name: string;
    email: string;
  };
  parent: {
    id: number;
    full_name: string;
    email: string;
  } | null;
};

export function UserManagement() {
  const { t, lang } = useLanguage();
  const { theme } = useTheme();
  const { collapsed } = useSidebar();
  const isDark = theme === "dark";
  const modalStyle = getModalStyle(theme);
  const inputStyle = getInputStyle(theme);
  const textColors = getTextColors(theme);
  const glassStyle = getGlassCardStyle(theme);
  const { user } = useAuthStore();
  const canManageUsers = useAuthStore((s) => s.canManageUsers());
  const isCurator = user?.role === "curator";
  const searchParams = useSearchParams();
  const router = useRouter();
  /** Skips one searchParams-driven sync after we update the URL ourselves (avoids fighting React state). */
  const skipSearchParamsSyncRef = useRef(false);
  const [activeTab, setActiveTab] = useState<UsersTabId>(() =>
    searchParams.get("tab") === "group-queue" ? "group-queue" : "users"
  );

  const selectTab = useCallback(
    (tab: UsersTabId) => {
      setActiveTab(tab);
      skipSearchParamsSyncRef.current = true;
      if (tab === "group-queue") {
        router.replace("/app/admin/users?tab=group-queue", { scroll: false });
      } else if (searchParams.get("tab") === "group-queue") {
        router.replace("/app/admin/users", { scroll: false });
      } else {
        skipSearchParamsSyncRef.current = false;
      }
    },
    [router, searchParams]
  );
  const [search, setSearch] = useState("");
  const [relationStudentSearch, setRelationStudentSearch] = useState("");
  const [relationParentSearch, setRelationParentSearch] = useState("");
  const [showOnlyUnlinked, setShowOnlyUnlinked] = useState(false);
  const [selectedParentByStudent, setSelectedParentByStudent] = useState<Record<number, string>>({});
  const [uiToast, setUiToast] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [assignModal, setAssignModal] = useState<AssignStudentTarget | null>(null);
  const [rewardUser, setRewardUser] = useState<UserRow | null>(null);
  const [rewardSuccess, setRewardSuccess] = useState<{ amount: number; balance: number } | null>(null);
  const queryClient = useQueryClient();

  const { data: users = [] } = useQuery({
    queryKey: ["admin-users", search],
    queryFn: async () => {
      const { data } = await api.get<UserRow[]>(
        `/admin/users?search=${encodeURIComponent(search)}&include_relations=true`
      );
      return data;
    },
    enabled: activeTab === "users" || activeTab === "parents",
  });

  const { data: relationRows = [] } = useQuery({
    queryKey: ["admin-parent-links", relationStudentSearch, relationParentSearch, showOnlyUnlinked],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (relationStudentSearch.trim()) params.set("search_student", relationStudentSearch.trim());
      if (relationParentSearch.trim()) params.set("search_parent", relationParentSearch.trim());
      if (showOnlyUnlinked) params.set("only_unlinked", "true");
      const query = params.toString();
      const { data } = await api.get<ParentLinkRow[]>(`/admin/parent-links${query ? `?${query}` : ""}`);
      return data;
    },
    enabled: activeTab === "relations",
  });

  const { data: parentOptions = [] } = useQuery({
    queryKey: ["admin-users-parents-options"],
    queryFn: async () => {
      const { data } = await api.get<ParentOption[]>("/admin/users?role=parent");
      return data;
    },
    enabled: activeTab === "users" || activeTab === "relations",
  });

  const { data: groupQueue } = useQuery({
    queryKey: ["admin-group-assignment-queue"],
    queryFn: async () => {
      const { data } = await api.get<GroupQueueResponse>("/admin/group-assignment-queue");
      return data;
    },
    enabled: canManageUsers || activeTab === "group-queue",
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      body,
    }: {
      id: number;
      body: Record<string, unknown>;
    }) => {
      const { data } = await api.patch(`/admin/users/${id}`, body);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-parent-links"] });
      setEditing(null);
    },
  });

  const linkParentMutation = useMutation({
    mutationFn: async ({ studentId, parentId }: { studentId: number; parentId: number | null }) => {
      const { data } = await api.patch(`/admin/users/${studentId}`, { parent_id: parentId });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-parent-links"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/admin/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });

  const rewardCoinsMutation = useMutation({
    mutationFn: async ({ userId, amount }: { userId: number; amount: number }) => {
      const { data } = await api.post<{ ok: boolean; new_balance: number }>(
        `/admin/users/${userId}/reward-coins`,
        { amount }
      );
      return { data, amount };
    },
    onSuccess: ({ data, amount }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setRewardUser(null);
      setRewardSuccess({ amount, balance: data.new_balance });
    },
    onError: (e: { response?: { data?: { detail?: string | unknown } } }) => {
      const detail = e.response?.data?.detail;
      const msg =
        typeof detail === "string"
          ? detail
          : Array.isArray(detail)
            ? String((detail[0] as { msg?: string })?.msg ?? t("error"))
            : t("error");
      setRewardError(msg);
    },
  });

  const [rewardError, setRewardError] = useState<string | null>(null);

  const grantAccessMutation = useMutation({
    mutationFn: async (appId: number) => {
      const { data } = await api.post(`/admin/applications/${appId}/grant-access`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-applications"] });
      queryClient.invalidateQueries({ queryKey: ["admin-group-assignment-queue"] });
      setUiToast({ type: "success", text: t("adminGrantAccessSuccess") });
    },
    onError: (e: { response?: { data?: { detail?: string } } }) => {
      setUiToast({ type: "error", text: e?.response?.data?.detail ?? t("error") });
    },
  });

  /** `tab` query value only — avoids re-running when the searchParams object identity changes every render. */
  const tabQueryParam = searchParams.get("tab");

  /** Sync tab from URL when using browser back/forward or external navigation (not after selectTab). */
  useEffect(() => {
    if (skipSearchParamsSyncRef.current) {
      skipSearchParamsSyncRef.current = false;
      return;
    }
    if (tabQueryParam === "group-queue") {
      setActiveTab((prev) => (prev !== "group-queue" ? "group-queue" : prev));
    } else {
      setActiveTab((prev) => (prev === "group-queue" ? "users" : prev));
    }
  }, [tabQueryParam]);

  useEffect(() => {
    const next: Record<number, string> = {};
    for (const row of relationRows) {
      next[row.student.id] = row.parent ? String(row.parent.id) : "";
    }
    setSelectedParentByStudent((prev) => {
      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(next);
      if (prevKeys.length !== nextKeys.length) return next;
      for (const key of nextKeys) {
        if (prev[Number(key)] !== next[Number(key)]) return next;
      }
      return prev;
    });
  }, [relationRows]);

  useEffect(() => {
    if (!uiToast) return;
    const timer = setTimeout(() => setUiToast(null), 2600);
    return () => clearTimeout(timer);
  }, [uiToast]);

  const handleExportExcel = async () => {
    try {
      const { data } = await api.get<Blob>("/admin/users/export/excel", {
        responseType: "blob",
      });
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = "users.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to export Excel:", error);
      const err = error as { response?: { data?: { detail?: string }; status?: number }; message?: string };
      const errorMessage = err?.response?.data?.detail || err?.message || t("excelExportError");
      toast.error(errorMessage);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      admin: "bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-500/30",
      director: "bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-500/30",
      curator: "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-500/30",
      teacher: "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300 border-green-300 dark:border-green-500/30",
      student: "bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border-cyan-300 dark:border-cyan-500/30",
      parent: "bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-500/30",
    };
    return colors[role] || "bg-gray-100 dark:bg-gray-500/20 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-500/30";
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDate = (d: string | null) => formatLocalizedDate(d, lang as any, t);
  const parentUsers = users.filter((u) => u.role === "parent");
  const queueAwaitingConfirmation = groupQueue?.awaiting_confirmation ?? [];
  const queueNeedsGroup = groupQueue?.needs_group ?? [];

  return (
    <div>
      <BlurFade delay={0.1} inView duration={0.6} blur="8px" offset={20}>
        <h1 className="text-3xl font-bold mb-6" style={{ color: textColors.primary }}>{t("adminUsersTitle")}</h1>
      </BlurFade>
      {!canManageUsers && (
        <BlurFade delay={0.12} inView duration={0.6} blur="8px" offset={20}>
          <div
            className="rounded-xl p-4 border-l-4 flex items-start gap-3 mb-6"
            style={{
              ...glassStyle,
              borderLeftColor: "#F59E0B",
              background: isDark
                ? "rgba(245, 158, 11, 0.1)"
                : "rgba(245, 158, 11, 0.05)",
            }}
          >
            <Info className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "#F59E0B" }} />
            <div className="flex-1">
              <p className="font-semibold mb-1" style={{ color: textColors.primary }}>
                {t("curatorLimitedAccess")}
              </p>
              <p className="text-sm" style={{ color: textColors.secondary }}>
                {t("adminCuratorAccessInfo")}
              </p>
            </div>
          </div>
        </BlurFade>
      )}
      <div className="mb-6 border-b border-gray-200 dark:border-white/10 pb-4 w-full overflow-x-auto overscroll-x-contain touch-pan-x [-webkit-overflow-scrolling:touch]">
        <div className="flex gap-2 min-w-max pr-2 pb-1 snap-x snap-mandatory">
          <BlurFade delay={0.15} duration={0.4} blur="4px" offset={10}>
            <button
              type="button"
              onClick={() => selectTab("users")}
              className={`px-3 sm:px-4 py-2 font-medium rounded-lg transition-all whitespace-nowrap text-sm sm:text-base shrink-0 snap-start ${activeTab === "users"
                  ? "text-white shadow-lg"
                  : isDark ? "text-white/70 hover:text-white hover:bg-white/10" : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                }`}
              style={activeTab === "users" ? { background: "linear-gradient(135deg, #FF4181 0%, #B938EB 100%)", boxShadow: "0 0 12px rgba(255, 65, 129, 0.3)" } : undefined}
            >
              {t("adminUsersAll")}
            </button>
          </BlurFade>
          <BlurFade delay={0.2} duration={0.4} blur="4px" offset={10}>
            <button
              type="button"
              onClick={() => selectTab("group-queue")}
              title={t("adminGroupQueueTabCountHint")}
              className={`px-3 sm:px-4 py-2 font-medium rounded-lg transition-all whitespace-nowrap text-sm sm:text-base shrink-0 snap-start max-w-[min(100vw-2rem,22rem)] text-left sm:text-center sm:max-w-none ${activeTab === "group-queue"
                  ? "text-white shadow-lg"
                  : isDark ? "text-white/70 hover:text-white hover:bg-white/10" : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                }`}
              style={activeTab === "group-queue" ? { background: "linear-gradient(135deg, #FF4181 0%, #B938EB 100%)", boxShadow: "0 0 12px rgba(255, 65, 129, 0.3)" } : undefined}
            >
              <span className="line-clamp-2 sm:line-clamp-none">
                {t("adminGroupQueueTab")}
                {groupQueue?.counts?.total != null ? ` (${groupQueue.counts.total})` : ""}
              </span>
            </button>
          </BlurFade>
          <BlurFade delay={0.25} duration={0.4} blur="4px" offset={10}>
            <button
              type="button"
              onClick={() => selectTab("parents")}
              className={`px-3 sm:px-4 py-2 font-medium rounded-lg transition-all whitespace-nowrap text-sm sm:text-base shrink-0 snap-start ${activeTab === "parents"
                  ? "text-white shadow-lg"
                  : isDark ? "text-white/70 hover:text-white hover:bg-white/10" : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                }`}
              style={activeTab === "parents" ? { background: "linear-gradient(135deg, #FF4181 0%, #B938EB 100%)", boxShadow: "0 0 12px rgba(255, 65, 129, 0.3)" } : undefined}
            >
              {t("parentsTab")}
            </button>
          </BlurFade>
          <BlurFade delay={0.3} duration={0.4} blur="4px" offset={10}>
            <button
              type="button"
              onClick={() => selectTab("relations")}
              className={`px-3 sm:px-4 py-2 font-medium rounded-lg transition-all whitespace-nowrap text-sm sm:text-base shrink-0 snap-start ${activeTab === "relations"
                  ? "text-white shadow-lg"
                  : isDark ? "text-white/70 hover:text-white hover:bg-white/10" : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                }`}
              style={activeTab === "relations" ? { background: "linear-gradient(135deg, #FF4181 0%, #B938EB 100%)", boxShadow: "0 0 12px rgba(255, 65, 129, 0.3)" } : undefined}
            >
              {t("adminRelationsTab")}
            </button>
          </BlurFade>
        </div>
      </div>
      <BlurFade delay={0.2} duration={0.4} blur="4px" offset={10}>
        <div className="flex flex-col md:flex-row gap-4 mb-6 w-full justify-between items-start md:items-center">
          <div className="flex flex-wrap gap-3 flex-1 w-full">
            {(activeTab === "users" || activeTab === "parents") && (
              <input
                type="text"
                placeholder={t("adminSearch")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border-0 rounded-xl px-4 py-2.5 w-full md:w-64 transition-all backdrop-blur-sm"
                style={getInputStyle(theme)}
              />
            )}
            {activeTab === "relations" && (
              <>
                <input
                  type="text"
                  placeholder={t("adminRelationSearchStudent")}
                  value={relationStudentSearch}
                  onChange={(e) => setRelationStudentSearch(e.target.value)}
                  className="border-0 rounded-xl px-4 py-2.5 w-full md:w-64 transition-all backdrop-blur-sm"
                  style={getInputStyle(theme)}
                />
                <input
                  type="text"
                  placeholder={t("adminRelationSearchParent")}
                  value={relationParentSearch}
                  onChange={(e) => setRelationParentSearch(e.target.value)}
                  className="border-0 rounded-xl px-4 py-2.5 w-full md:w-64 transition-all backdrop-blur-sm"
                  style={getInputStyle(theme)}
                />
                <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl" style={getGlassCardStyle(theme)}>
                  <input
                    type="checkbox"
                    checked={showOnlyUnlinked}
                    onChange={(e) => setShowOnlyUnlinked(e.target.checked)}
                  />
                  <span className="text-sm" style={{ color: textColors.secondary }}>
                    {t("adminOnlyUnlinked")}
                  </span>
                </label>
              </>
            )}
          </div>
          {canManageUsers && activeTab === "users" && (
            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              <button
                type="button"
                onClick={() => setAddUserOpen(true)}
                className="flex items-center gap-2 py-2.5 px-5 rounded-xl text-white hover:opacity-90 transition-all font-medium shadow-lg whitespace-nowrap"
                style={{ background: "linear-gradient(135deg, #FF4181 0%, #B938EB 100%)", boxShadow: "0 4px 14px rgba(255, 65, 129, 0.4)" }}
              >
                <Plus className="w-4 h-4 shrink-0" /> {t("adminAddUser")}
              </button>
              <ShimmerButton
                onClick={handleExportExcel}
                className="flex items-center gap-2 py-2.5 px-5 rounded-xl text-white border-0 font-medium shadow-lg bg-gradient-to-r from-[#FF4181] to-[#B938EB]"
                shimmerColor="#ffffff"
              >
                <Download className="w-4 h-4 shrink-0" /> {t("excelLabel")}
              </ShimmerButton>
            </div>
          )}
        </div>
      </BlurFade>
      <BlurFade key={activeTab} delay={0.05} duration={0.4} blur="6px" offset={15} direction="up">
        <div className="rounded-2xl overflow-hidden border-0 backdrop-blur-xl shadow-lg w-full" style={getGlassCardStyle(theme)}>
          {activeTab === "group-queue" ? (
            <div className="space-y-6 p-4 sm:p-6">
              <div>
                <h3 className="text-base font-semibold mb-3" style={{ color: textColors.primary }}>
                  {t("adminQueueAwaitingConfirmation")} ({queueAwaitingConfirmation.length})
                </h3>
                {/* Mobile Cards for Awaiting Confirmation */}
                <div className="sm:hidden space-y-3">
                  {queueAwaitingConfirmation.length === 0 ? (
                    <div className="py-8 text-center text-sm" style={{ color: textColors.secondary }}>
                      {t("adminQueueAwaitingConfirmationEmpty")}
                    </div>
                  ) : (
                    queueAwaitingConfirmation.map((row) => (
                      <div key={`await-card-${row.application_id}-${row.user_id}`} className="p-4 rounded-xl border border-gray-200 dark:border-white/10 space-y-3">
                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-sm truncate" style={{ color: textColors.primary }}>{row.full_name}</p>
                            <p className="text-xs truncate" style={{ color: textColors.secondary }}>{row.email}</p>
                          </div>
                          <p className="text-[10px] whitespace-nowrap" style={{ color: textColors.secondary }}>{formatDate(row.created_at)}</p>
                        </div>
                        <div className="text-xs">
                          <span className="opacity-60">{t("course")}: </span>
                          <span className="font-medium" style={{ color: textColors.primary }}>
                            {row.course_title ? getLocalizedCourseTitle({ title: row.course_title } as any, t) : "—"}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => row.application_id && grantAccessMutation.mutate(row.application_id)}
                          disabled={grantAccessMutation.isPending || !row.application_id}
                          className="w-full py-2 px-3 rounded-lg text-white text-sm disabled:opacity-60 font-medium"
                          style={{ background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)" }}
                        >
                          {t("adminGrantAccess")}
                        </button>
                      </div>
                    ))
                  )}
                </div>
                {/* Desktop Table */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full min-w-[760px]">
                    <thead style={{ background: isDark ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.05)" }}>
                      <tr>
                        <th className="text-left py-3 px-4 font-semibold text-sm" style={{ color: textColors.primary }}>{t("date")}</th>
                        <th className="text-left py-3 px-4 font-semibold text-sm" style={{ color: textColors.primary }}>{t("fullName")}</th>
                        <th className="text-left py-3 px-4 font-semibold text-sm" style={{ color: textColors.primary }}>{t("email")}</th>
                        <th className="text-left py-3 px-4 font-semibold text-sm" style={{ color: textColors.primary }}>{t("course")}</th>
                        <th className="text-right py-3 px-4 font-semibold text-sm" style={{ color: textColors.primary }}>{t("actions")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {queueAwaitingConfirmation.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-sm" style={{ color: textColors.secondary }}>
                            {t("adminQueueAwaitingConfirmationEmpty")}
                          </td>
                        </tr>
                      ) : (
                        queueAwaitingConfirmation.map((row) => (
                          <tr key={`await-${row.application_id}-${row.user_id}-${row.course_id}`} className={`border-b ${isDark ? "border-white/10 hover:bg-white/5" : "border-gray-200 hover:bg-gray-50"} transition-colors`}>
                            <td className="py-3 px-4 text-sm" style={{ color: textColors.secondary }}>{formatDate(row.created_at)}</td>
                            <td className="py-3 px-4 text-sm font-medium" style={{ color: textColors.primary }}>{row.full_name}</td>
                            <td className="py-3 px-4 text-sm" style={{ color: textColors.secondary }}>{row.email}</td>
                            <td className="py-3 px-4 text-sm" style={{ color: textColors.primary }}>{row.course_title ? getLocalizedCourseTitle({ title: row.course_title } as any, t) : "—"}</td>
                            <td className="py-3 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  if (!row.application_id) return;
                                  grantAccessMutation.mutate(row.application_id);
                                }}
                                disabled={grantAccessMutation.isPending || !row.application_id}
                                className="py-2 px-3 rounded-lg text-white text-sm disabled:opacity-60"
                                style={{ background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)" }}
                              >
                                {t("adminGrantAccess")}
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-8">
                <h3 className="text-base font-semibold mb-3" style={{ color: textColors.primary }}>
                  {t("adminQueueNeedsGroup")} ({queueNeedsGroup.length})
                </h3>
                {/* Mobile Cards for Needs Group */}
                <div className="sm:hidden space-y-3">
                  {queueNeedsGroup.length === 0 ? (
                    <div className="py-8 text-center text-sm" style={{ color: textColors.secondary }}>
                      {t("adminQueueNeedsGroupEmpty")}
                    </div>
                  ) : (
                    queueNeedsGroup.map((row) => (
                      <div key={`needs-card-${row.user_id}-${row.course_id}`} className="p-4 rounded-xl border border-gray-200 dark:border-white/10 space-y-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate" style={{ color: textColors.primary }}>{row.full_name}</p>
                          <p className="text-xs truncate" style={{ color: textColors.secondary }}>{row.email}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div>
                            <span className="opacity-60">{t("course")}: </span>
                            <p className="font-medium truncate" style={{ color: textColors.primary }}>
                              {row.course_title ? getLocalizedCourseTitle({ title: row.course_title } as any, t) : "—"}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="opacity-60">{t("adminEnrolledAt")}: </span>
                            <p className="font-medium" style={{ color: textColors.primary }}>{formatDate(row.enrolled_at)}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setAssignModal({
                              id: row.user_id,
                              full_name: row.full_name,
                              email: row.email,
                              phone: row.phone || "",
                              course_id: row.course_id,
                              course_title: row.course_title || "",
                              enrolled_at: row.enrolled_at,
                              application_id: row.application_id,
                            })
                          }
                          className="w-full py-2 px-3 rounded-lg text-white text-sm font-medium"
                          style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)" }}
                        >
                          {t("adminAssign")}
                        </button>
                      </div>
                    ))
                  )}
                </div>
                {/* Desktop Table */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full min-w-[760px]">
                    <thead style={{ background: isDark ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.05)" }}>
                      <tr>
                        <th className="text-left py-3 px-4 font-semibold text-sm" style={{ color: textColors.primary }}>{t("fullName")}</th>
                        <th className="text-left py-3 px-4 font-semibold text-sm" style={{ color: textColors.primary }}>{t("email")}</th>
                        <th className="text-left py-3 px-4 font-semibold text-sm" style={{ color: textColors.primary }}>{t("course")}</th>
                        <th className="text-left py-3 px-4 font-semibold text-sm" style={{ color: textColors.primary }}>{t("adminEnrolledAt")}</th>
                        <th className="text-right py-3 px-4 font-semibold text-sm" style={{ color: textColors.primary }}>{t("actions")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {queueNeedsGroup.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-sm" style={{ color: textColors.secondary }}>
                            {t("adminQueueNeedsGroupEmpty")}
                          </td>
                        </tr>
                      ) : (
                        queueNeedsGroup.map((row) => (
                          <tr key={`group-${row.user_id}-${row.course_id}`} className={`border-b ${isDark ? "border-white/10 hover:bg-white/5" : "border-gray-200 hover:bg-gray-50"} transition-colors`}>
                            <td className="py-3 px-4 text-sm font-medium" style={{ color: textColors.primary }}>{row.full_name}</td>
                            <td className="py-3 px-4 text-sm" style={{ color: textColors.secondary }}>{row.email}</td>
                            <td className="py-3 px-4 text-sm" style={{ color: textColors.primary }}>{row.course_title ? getLocalizedCourseTitle({ title: row.course_title } as any, t) : "—"}</td>
                            <td className="py-3 px-4 text-sm" style={{ color: textColors.secondary }}>{formatDate(row.enrolled_at)}</td>
                            <td className="py-3 px-4 text-right">
                              <button
                                type="button"
                                onClick={() =>
                                  setAssignModal({
                                    id: row.user_id,
                                    full_name: row.full_name,
                                    email: row.email,
                                    phone: row.phone || "",
                                    course_id: row.course_id,
                                    course_title: row.course_title || "",
                                    enrolled_at: row.enrolled_at,
                                    application_id: row.application_id,
                                  })
                                }
                                className="py-2 px-3 rounded-lg text-white text-sm"
                                style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)" }}
                              >
                                {t("adminAssign")}
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : activeTab === "users" ? (
            <div>
              {/* Mobile User Cards */}
              <div className="sm:hidden p-4 space-y-4">
                {users.map((u) => (
                  <div key={`user-card-${u.id}`} className="p-4 rounded-2xl border border-gray-200 dark:border-white/10 space-y-4" style={getGlassCardStyle(theme)}>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-base shrink-0 shadow-inner" style={{ background: "linear-gradient(135deg, #14b8a6 0%, #3b82f6 100%)" }}>
                        {u.photo_url ? (
                          <img src={u.photo_url} alt={u.full_name} className="w-full h-full rounded-full object-cover" />
                        ) : (
                          getInitials(u.full_name)
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <Link href={`/app/profile/${u.id}`} className="font-bold text-base truncate block hover:text-[#8B5CF6] transition-colors" style={{ color: textColors.primary }}>
                          {u.full_name}
                        </Link>
                        <p className="text-xs truncate opacity-70" style={{ color: textColors.secondary }}>{u.email}</p>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getRoleBadgeColor(u.role)}`}>
                        {u.role}
                      </span>
                      <span className="text-[10px] font-medium opacity-50" style={{ color: textColors.secondary }}>ID: {u.id}</span>
                    </div>

                    <div className="text-xs space-y-2 p-3 rounded-xl bg-gray-50/50 dark:bg-black/20 border border-gray-100 dark:border-white/5">
                      <p className="font-semibold opacity-60 uppercase text-[9px] tracking-tight">{t("adminRelationColumn")}</p>
                      {u.role === "student" ? (
                        u.parent ? (
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center text-[10px] text-blue-600 dark:text-blue-300 font-bold shrink-0">
                              {getInitials(u.parent.full_name)}
                            </div>
                            <span className="font-medium truncate" style={{ color: textColors.primary }}>{u.parent.full_name}</span>
                          </div>
                        ) : <span style={{ color: textColors.secondary }}>{t("adminNoParentAssigned")}</span>
                      ) : u.role === "parent" ? (
                        <div className="flex flex-wrap gap-1.5">
                          {(u.children ?? []).map((child) => (
                            <span key={child.id} className="px-2 py-0.5 rounded-md bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-300 font-medium">
                              {child.full_name}
                            </span>
                          ))}
                          {(u.children ?? []).length === 0 && <span style={{ color: textColors.secondary }}>{t("noChildren")}</span>}
                        </div>
                      ) : <span className="opacity-40">—</span>}
                    </div>

                    {canManageUsers && (
                      <div className="flex items-center gap-2 pt-2">
                        <button
                          onClick={() => setEditing(u)}
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 font-semibold text-sm transition-all active:scale-[0.98]"
                        >
                          <Pencil className="w-4 h-4" /> {t("adminEdit")}
                        </button>
                        {u.role === "student" && (
                          <button
                            onClick={() => setRewardUser(u)}
                            className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 active:scale-[0.98]"
                          >
                            <Coins className="w-5 h-5" />
                          </button>
                        )}
                        <div className="p-1 rounded-xl bg-red-100 dark:bg-red-500/20">
                          <DeleteConfirmButton
                            onDelete={() => deleteMutation.mutate(u.id)}
                            isLoading={deleteMutation.isPending && deleteMutation.variables === u.id}
                            hideText={true}
                            size="sm"
                            variant="ghost"
                            className="p-1.5 text-red-600 dark:text-red-400"
                            title={`${t("adminDelete")} ${u.full_name}?`}
                            description={t("adminUserDeleteConfirm")}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Desktop Table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full min-w-[640px]">
                  <thead style={{ background: isDark ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.05)" }}>
                    <tr>
                      <th className="text-left py-4 px-6 font-semibold text-sm" style={{ color: textColors.primary }}>
                        {t("adminFullName")}
                      </th>
                      <th className="text-left py-4 px-6 font-semibold text-sm" style={{ color: textColors.primary }}>
                        {t("email")}
                      </th>
                      <th className="text-left py-4 px-6 font-semibold text-sm" style={{ color: textColors.primary }}>
                        {t("role")}
                      </th>
                      <th className="text-left py-4 px-6 font-semibold text-sm" style={{ color: textColors.primary }}>
                        {t("adminRelationColumn")}
                      </th>
                      {canManageUsers && (
                        <th className="text-right py-4 px-6 font-semibold text-sm w-32" style={{ color: textColors.primary }}>
                          {t("adminCoursesActions")}
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} className={`border-b ${isDark ? "border-white/10 hover:bg-white/5" : "border-gray-200 hover:bg-gray-50"} transition-colors`}>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm shrink-0" style={{ background: "linear-gradient(135deg, #14b8a6 0%, #3b82f6 100%)" }}>
                              {u.photo_url ? (
                                <img src={u.photo_url} alt={u.full_name} className="w-full h-full rounded-full object-cover" />
                              ) : (
                                getInitials(u.full_name)
                              )}
                            </div>
                            <div>
                              <Link
                                href={`/app/profile/${u.id}`}
                                className="font-medium transition-colors hover:text-[#8B5CF6] truncate max-w-[150px] inline-block"
                                style={{ color: textColors.primary }}
                              >
                                {u.full_name}
                              </Link>
                              <p className="text-xs mt-0.5" style={{ color: textColors.secondary }}>ID: {u.id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span className="truncate max-w-[180px] inline-block" style={{ color: textColors.primary }} title={u.email}>{u.email}</span>
                        </td>
                        <td className="py-4 px-6">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getRoleBadgeColor(u.role)}`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-sm" style={{ color: textColors.secondary }}>
                          {u.role === "student" ? (
                            u.parent ? (
                              <div>
                                <p style={{ color: textColors.primary }}>{u.parent.full_name}</p>
                                <p className="text-xs">ID: {u.parent.id}</p>
                              </div>
                            ) : (
                              t("adminNoParentAssigned")
                            )
                          ) : u.role === "parent" ? (
                            <div className="flex flex-wrap gap-1 items-center">
                              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)", color: textColors.primary }}>
                                {t("adminChildrenCountLabel")}: {u.children?.length ?? 0}
                              </span>
                              {(u.children ?? []).slice(0, 3).map((child) => (
                                <span
                                  key={child.id}
                                  className="text-xs px-2 py-0.5 rounded-full"
                                  style={{ background: isDark ? "rgba(16,185,129,0.2)" : "rgba(16,185,129,0.12)", color: textColors.primary }}
                                >
                                  {child.full_name}
                                </span>
                              ))}
                            </div>
                          ) : (
                            "—"
                          )}
                        </td>
                        {canManageUsers && (
                          <td className="py-4 px-6 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {u.role === "student" && (
                                <button
                                  type="button"
                                  onClick={() => setRewardUser(u)}
                                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                  style={{ color: "#EAB308" }}
                                  title={t("adminRewardCoinsButtonTitle")}
                                >
                                  <Coins className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setEditing(u)}
                                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                style={{ color: "#8B5CF6" }}
                                title={t("adminEdit")}
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <DeleteConfirmButton
                                onDelete={() => deleteMutation.mutate(u.id)}
                                isLoading={deleteMutation.isPending && deleteMutation.variables === u.id}
                                hideText={!collapsed}
                                size="sm"
                                variant="ghost"
                                className="p-1"
                                title={`${t("adminDelete")} ${u.full_name}?`}
                                description={t("adminUserDeleteConfirm")}
                              />
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : activeTab === "parents" ? (
            <div>
              {/* Mobile Parent Cards */}
              <div className="sm:hidden p-4 space-y-4">
                {parentUsers.length === 0 ? (
                  <div className="py-10 text-center text-sm" style={{ color: textColors.secondary }}>
                    {t("noParentsFound")}
                  </div>
                ) : (
                  parentUsers.map((u) => (
                    <div key={`parent-card-${u.id}`} className="p-4 rounded-2xl border border-gray-200 dark:border-white/10 space-y-4" style={getGlassCardStyle(theme)}>
                      <div className="flex justify-between items-start">
                        <div className="min-w-0">
                          <Link href={`/app/profile/${u.id}`} className="font-bold text-base truncate block hover:text-[#8B5CF6] transition-colors" style={{ color: textColors.primary }}>
                            {u.full_name}
                          </Link>
                          <p className="text-xs truncate opacity-70" style={{ color: textColors.secondary }}>{u.email}</p>
                          <p className="text-[10px] mt-1 opacity-40">ID: {u.id}</p>
                        </div>
                      </div>

                      <div className="text-xs space-y-2 p-3 rounded-xl bg-gray-50/50 dark:bg-black/20 border border-gray-100 dark:border-white/5">
                        <p className="font-semibold opacity-60 uppercase text-[9px] tracking-tight">{t("adminParentsLinkedStudents")}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {u.children && u.children.length > 0 ? (
                            u.children.map((child) => (
                              <span key={child.id} className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 font-medium">
                                {child.full_name}
                              </span>
                            ))
                          ) : <span style={{ color: textColors.secondary }}>{t("noChildren")}</span>}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => selectTab("relations")}
                        className="w-full py-2.5 rounded-xl text-white font-semibold text-sm transition-all active:scale-[0.98]"
                        style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)" }}
                      >
                        {t("adminOpenRelationManager")}
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Desktop Parent Table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full min-w-[760px]">
                  <thead style={{ background: isDark ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.05)" }}>
                    <tr>
                      <th className="text-left py-4 px-6 font-semibold text-sm" style={{ color: textColors.primary }}>
                        {t("adminFullName")}
                      </th>
                      <th className="text-left py-4 px-6 font-semibold text-sm" style={{ color: textColors.primary }}>
                        {t("email")}
                      </th>
                      <th className="text-left py-4 px-6 font-semibold text-sm" style={{ color: textColors.primary }}>
                        {t("adminParentsLinkedStudents")}
                      </th>
                      <th className="text-right py-4 px-6 font-semibold text-sm w-52" style={{ color: textColors.primary }}>
                        {t("adminCoursesActions")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {parentUsers.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-10 text-center text-sm" style={{ color: textColors.secondary }}>
                          {t("noParentsFound")}
                        </td>
                      </tr>
                    ) : (
                      parentUsers.map((u) => (
                        <tr key={u.id} className={`border-b ${isDark ? "border-white/10 hover:bg-white/5" : "border-gray-200 hover:bg-gray-50"} transition-colors`}>
                          <td className="py-4 px-6">
                            <div>
                              <Link
                                href={`/app/profile/${u.id}`}
                                className="font-medium transition-colors hover:text-[#8B5CF6] inline-block"
                                style={{ color: textColors.primary }}
                              >
                                {u.full_name}
                              </Link>
                              <p className="text-xs mt-0.5" style={{ color: textColors.secondary }}>ID: {u.id}</p>
                            </div>
                          </td>
                          <td className="py-4 px-6" style={{ color: textColors.primary }}>{u.email}</td>
                          <td className="py-4 px-6 text-sm" style={{ color: textColors.secondary }}>
                            {u.children && u.children.length > 0 ? (
                              <div className="flex flex-wrap gap-1 items-center">
                                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)", color: textColors.primary }}>
                                  {t("childrenCount").replace("{count}", String(u.children.length))}
                                </span>
                                {u.children.map((child) => (
                                  <span
                                    key={child.id}
                                    className="text-xs px-2 py-0.5 rounded-full"
                                    style={{ background: isDark ? "rgba(16,185,129,0.2)" : "rgba(16,185,129,0.12)", color: textColors.primary }}
                                  >
                                    {child.full_name}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              t("noChildren")
                            )}
                          </td>
                          <td className="py-4 px-6 text-right">
                            <button
                              type="button"
                              onClick={() => selectTab("relations")}
                              className="py-2 px-4 rounded-lg text-white text-sm"
                              style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)" }}
                            >
                              {t("adminOpenRelationManager")}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : activeTab === "relations" ? (
            <div>
              {/* Mobile Relation Cards */}
              <div className="sm:hidden p-4 space-y-4">
                {relationRows.length === 0 ? (
                  <div className="py-10 text-center text-sm" style={{ color: textColors.secondary }}>
                    {t("adminNoRelationsFound")}
                  </div>
                ) : (
                  relationRows.map((row) => {
                    const selectedParent = selectedParentByStudent[row.student.id] ?? (row.parent ? String(row.parent.id) : "");
                    return (
                      <div key={`rel-card-${row.student.id}`} className="p-4 rounded-2xl border border-gray-200 dark:border-white/10 space-y-4" style={getGlassCardStyle(theme)}>
                        <div>
                          <p className="font-bold text-base truncate" style={{ color: textColors.primary }}>{row.student.full_name}</p>
                          <p className="text-xs truncate opacity-70" style={{ color: textColors.secondary }}>{row.student.email}</p>
                        </div>

                        <div className="space-y-1">
                          <p className="text-[10px] font-semibold opacity-60 uppercase tracking-tight">{t("adminCurrentParent")}</p>
                          <p className="text-xs font-medium" style={{ color: textColors.primary }}>
                            {row.parent ? `${row.parent.full_name} (#${row.parent.id})` : t("adminNoParentAssigned")}
                          </p>
                        </div>

                        <div className="space-y-2">
                          <p className="text-[10px] font-semibold opacity-60 uppercase tracking-tight">{t("adminSelectParentToLink")}</p>
                          <select
                            value={selectedParent}
                            onChange={(e) =>
                              setSelectedParentByStudent((prev) => ({ ...prev, [row.student.id]: e.target.value }))
                            }
                            className="w-full border-0 rounded-lg px-3 py-2 text-sm"
                            style={inputStyle}
                          >
                            <option value="" style={{ background: isDark ? "rgba(26, 34, 56, 0.95)" : "#FFFFFF" }}>
                              — {t("adminSelectNone")}
                            </option>
                            {parentOptions.map((parent) => (
                              <option
                                key={parent.id}
                                value={parent.id}
                                style={{ background: isDark ? "rgba(26, 34, 56, 0.95)" : "#FFFFFF" }}
                              >
                                {parent.full_name} (#{parent.id})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() =>
                              linkParentMutation.mutate({
                                studentId: row.student.id,
                                parentId: selectedParent ? Number(selectedParent) : null,
                              })
                            }
                            disabled={linkParentMutation.isPending}
                            className="flex-1 py-2.5 rounded-xl text-white font-semibold text-sm disabled:opacity-60 transition-all active:scale-[0.98]"
                            style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)" }}
                          >
                            {t("adminLinkSave")}
                          </button>
                          {row.parent && (
                            <button
                              type="button"
                              onClick={() => linkParentMutation.mutate({ studentId: row.student.id, parentId: null })}
                              disabled={linkParentMutation.isPending}
                              className="p-2.5 rounded-xl disabled:opacity-60 active:scale-[0.98]"
                              style={{
                                background: isDark ? "rgba(239, 68, 68, 0.2)" : "rgba(239, 68, 68, 0.1)",
                                color: "#EF4444",
                              }}
                              title={t("adminUnlinkParent")}
                            >
                              <X className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Desktop Relation Table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full min-w-[900px]">
                  <thead style={{ background: isDark ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.05)" }}>
                    <tr>
                      <th className="text-left py-4 px-6 font-semibold text-sm" style={{ color: textColors.primary }}>
                        {t("student")}
                      </th>
                      <th className="text-left py-4 px-6 font-semibold text-sm" style={{ color: textColors.primary }}>
                        {t("adminCurrentParent")}
                      </th>
                      <th className="text-left py-4 px-6 font-semibold text-sm" style={{ color: textColors.primary }}>
                        {t("adminSelectParentToLink")}
                      </th>
                      <th className="text-right py-4 px-6 font-semibold text-sm" style={{ color: textColors.primary }}>
                        {t("adminCoursesActions")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {relationRows.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-10 text-center text-sm" style={{ color: textColors.secondary }}>
                          {t("adminNoRelationsFound")}
                        </td>
                      </tr>
                    ) : (
                      relationRows.map((row) => {
                        const selectedParent = selectedParentByStudent[row.student.id] ?? (row.parent ? String(row.parent.id) : "");
                        return (
                          <tr
                            key={row.student.id}
                            className={`border-b ${isDark ? "border-white/10 hover:bg-white/5" : "border-gray-200 hover:bg-gray-50"} transition-colors`}
                          >
                            <td className="py-4 px-6">
                              <div>
                                <p style={{ color: textColors.primary }}>{row.student.full_name}</p>
                                <p className="text-xs" style={{ color: textColors.secondary }}>{row.student.email}</p>
                              </div>
                            </td>
                            <td className="py-4 px-6 text-sm" style={{ color: textColors.secondary }}>
                              {row.parent ? `${row.parent.full_name} (#${row.parent.id})` : t("adminNoParentAssigned")}
                            </td>
                            <td className="py-4 px-6">
                              <select
                                value={selectedParent}
                                onChange={(e) =>
                                  setSelectedParentByStudent((prev) => ({ ...prev, [row.student.id]: e.target.value }))
                                }
                                className="w-full border-0 rounded-lg px-3 py-2"
                                style={inputStyle}
                              >
                                <option value="" style={{ background: isDark ? "rgba(26, 34, 56, 0.95)" : "#FFFFFF" }}>
                                  — {t("adminSelectNone")}
                                </option>
                                {parentOptions.map((parent) => (
                                  <option
                                    key={parent.id}
                                    value={parent.id}
                                    style={{ background: isDark ? "rgba(26, 34, 56, 0.95)" : "#FFFFFF" }}
                                  >
                                    {parent.full_name} (#{parent.id})
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="py-4 px-6">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    linkParentMutation.mutate({
                                      studentId: row.student.id,
                                      parentId: selectedParent ? Number(selectedParent) : null,
                                    })
                                  }
                                  disabled={linkParentMutation.isPending}
                                  className="py-2 px-4 rounded-lg text-white text-sm disabled:opacity-60"
                                  style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)" }}
                                >
                                  {t("adminLinkSave")}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => linkParentMutation.mutate({ studentId: row.student.id, parentId: null })}
                                  disabled={linkParentMutation.isPending}
                                  className="py-2 px-4 rounded-lg text-sm disabled:opacity-60"
                                  style={{
                                    background: isDark ? "rgba(239, 68, 68, 0.2)" : "rgba(239, 68, 68, 0.1)",
                                    color: "#EF4444",
                                  }}
                                >
                                  {t("adminUnlinkParent")}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      </BlurFade>

      {assignModal && (
        <AssignStudentModal
          student={assignModal}
          onClose={() => setAssignModal(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["admin-group-assignment-queue"] });
            setAssignModal(null);
          }}
        />
      )}

      {uiToast && (
        <div className="fixed top-4 right-4 z-[60]">
          <div
            className="rounded-xl px-4 py-3 shadow-xl border backdrop-blur-md"
            style={{
              background: isDark ? "rgba(17,24,39,0.9)" : "rgba(255,255,255,0.95)",
              borderColor: uiToast.type === "success" ? "rgba(16,185,129,0.5)" : "rgba(239,68,68,0.5)",
              color: textColors.primary,
            }}
          >
            {uiToast.text}
          </div>
        </div>
      )}

      {addUserOpen && (
        <AddUserModal
          onClose={() => setAddUserOpen(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["admin-users"] });
            setAddUserOpen(false);
          }}
        />
      )}

      {editing && (
        <UserEditModal
          user={editing}
          editing={editing}
          onClose={() => setEditing(null)}
          onSave={(body) =>
            updateMutation.mutate({ id: editing.id, body })
          }
          isPending={updateMutation.isPending}
        />
      )}

      {rewardUser && (
        <RewardCoinsModal
          user={rewardUser}
          onClose={() => setRewardUser(null)}
          onSubmit={(amount) =>
            rewardCoinsMutation.mutate({ userId: rewardUser.id, amount })
          }
          isPending={rewardCoinsMutation.isPending}
        />
      )}

      {rewardSuccess && (
        <RewardSuccessModal
          amount={rewardSuccess.amount}
          balance={rewardSuccess.balance}
          onClose={() => setRewardSuccess(null)}
        />
      )}

      {rewardError && (
        <RewardErrorModal
          message={rewardError}
          onClose={() => setRewardError(null)}
        />
      )}
    </div>
  );
}

function RewardErrorModal({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const modalStyle = getModalStyle(theme);
  const textColors = getTextColors(theme);
  const isDark = theme === "dark";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="rounded-2xl shadow-2xl p-8 max-w-sm mx-4 w-full border-0 text-center relative overflow-hidden"
        style={modalStyle}
      >
        <div
          className="absolute top-0 left-0 w-full h-1 bg-red-500"
        />

        <div className="w-20 h-20 bg-red-100 dark:bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <Info className="w-10 h-10 text-red-600 dark:text-red-400" />
        </div>

        <h3 className="text-xl font-bold mb-4" style={{ color: textColors.primary }}>
          {t("error")}
        </h3>

        <p className="text-sm mb-8 opacity-80" style={{ color: textColors.secondary }}>
          {message}
        </p>

        <button
          onClick={onClose}
          className="w-full py-3 px-6 rounded-xl text-white font-bold transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg bg-red-500 shadow-red-500/30"
        >
          {t("ok")}
        </button>
      </motion.div>
    </div>
  );
}

function RewardSuccessModal({
  amount,
  balance,
  onClose,
}: {
  amount: number;
  balance: number;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const modalStyle = getModalStyle(theme);
  const textColors = getTextColors(theme);
  const isDark = theme === "dark";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="rounded-2xl shadow-2xl p-8 max-w-sm mx-4 w-full border-0 text-center relative overflow-hidden"
        style={modalStyle}
      >
        <div
          className="absolute top-0 left-0 w-full h-1"
          style={{ background: "linear-gradient(90deg, #EAB308, #CA8A04)" }}
        />

        <div className="w-20 h-20 bg-yellow-100 dark:bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <Coins className="w-10 h-10 text-yellow-600 dark:text-yellow-400" />
        </div>

        <h3 className="text-2xl font-bold mb-2" style={{ color: textColors.primary }}>
          {t("adminRewardCoinsSuccess")}
        </h3>

        <div className="space-y-1 mb-8">
          <p className="text-3xl font-black text-yellow-600 dark:text-yellow-400">
            +{amount}
          </p>
          <p className="text-sm opacity-70" style={{ color: textColors.secondary }}>
            {t("adminRewardCoinsNewBalance")}: {balance}
          </p>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 px-6 rounded-xl text-white font-bold transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg"
          style={{
            background: "linear-gradient(135deg, #EAB308 0%, #CA8A04 100%)",
            boxShadow: "0 4px 15px rgba(234, 179, 8, 0.4)"
          }}
        >
          {t("ok")}
        </button>
      </motion.div>
    </div>
  );
}

function AddUserModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("student");
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [address, setAddress] = useState("");
  const [parentId, setParentId] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [parentPassword, setParentPassword] = useState("");
  const [parentFullName, setParentFullName] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [parentCity, setParentCity] = useState("");
  const [error, setError] = useState("");

  const createMutation = useMutation({
    mutationFn: async () => {
      let resolvedParentId: number | null = null;
      if (role === "student") {
        const hasNewParentData = parentEmail.trim().length > 0;
        if (hasNewParentData) {
          const { data: parentUser } = await api.post<{ id: number }>("/admin/users", {
            email: parentEmail.trim(),
            password: parentPassword.trim() || "Parent" + Math.random().toString(36).slice(-8),
            full_name: parentFullName.trim() || t("adminRoleParent"),
            role: "parent",
            phone: parentPhone.trim() || undefined,
            address: parentCity.trim() || undefined,
          });
          resolvedParentId = parentUser.id;
        } else if (parentId) {
          resolvedParentId = Number(parentId);
        }
      }
      const { data } = await api.post("/admin/users", {
        email: email.trim(),
        password: password.trim(),
        full_name: fullName.trim(),
        role,
        phone: phone.trim() || undefined,
        birth_date: birthDate.trim() || undefined,
        address: address.trim() || undefined,
        parent_id: resolvedParentId,
      });
      return data;
    },
    onSuccess: () => onSuccess(),
    onError: (e: { response?: { data?: { detail?: string } } }) => {
      setError(e.response?.data?.detail ?? t("error"));
    },
  });

  const { data: parents = [] } = useQuery({
    queryKey: ["admin-users-parents"],
    queryFn: async () => {
      const { data } = await api.get<Array<{ id: number; full_name: string }>>("/admin/users?role=parent");
      return data;
    },
    enabled: role === "student",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password.trim() || !fullName.trim()) {
      setError(t("error"));
      return;
    }
    const hasNewParentData = parentEmail.trim().length > 0;
    if (hasNewParentData && !parentFullName.trim()) {
      setError(t("adminParentDataRequired"));
      return;
    }
    createMutation.mutate();
  };

  const { theme } = useTheme();
  const modalStyle = getModalStyle(theme);
  const inputStyle = getInputStyle(theme);
  const textColors = getTextColors(theme);
  const isDark = theme === "dark";

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-add-user-title"
    >
      <div
        className="w-full sm:max-w-3xl max-h-[min(92dvh,100vh)] sm:max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-xl shadow-xl p-4 sm:p-6 border-0 backdrop-blur-xl pb-[max(1rem,env(safe-area-inset-bottom))]"
        style={modalStyle}
      >
        <h3 id="admin-add-user-title" className="font-semibold mb-4 text-base sm:text-lg" style={{ color: textColors.primary }}>
          {t("adminAddUserTitle")}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {/* Левая колонка */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: textColors.secondary }}>{t("email")} *</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border-0 rounded-lg px-3 py-2"
                  style={inputStyle}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: textColors.secondary }}>{t("adminFullName")} *</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full border-0 rounded-lg px-3 py-2"
                  style={inputStyle}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: textColors.secondary }}>{t("role")}</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full border-0 rounded-lg px-3 py-2"
                  style={inputStyle}
                >
                  <option value="admin">{t("admin")}</option>
                  <option value="director">{t("adminDirector")}</option>
                  <option value="curator">{t("adminCurator")}</option>
                  <option value="teacher">{t("adminTeacherRole")}</option>
                  <option value="student">{t("student")}</option>
                  <option value="parent">{t("adminParentRole")}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: textColors.secondary }}>{t("city")}</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full border-0 rounded-lg px-3 py-2"
                  style={inputStyle}
                  placeholder={t("cityPlaceholder")}
                />
              </div>
            </div>

            {/* Правая колонка */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: textColors.secondary }}>{t("password")} *</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border-0 rounded-lg px-3 py-2"
                  style={inputStyle}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: textColors.secondary }}>{t("phone")}</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full border-0 rounded-lg px-3 py-2"
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: textColors.secondary }}>{t("profileBirthDate")}</label>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full border-0 rounded-lg px-3 py-2"
                  style={inputStyle}
                />
              </div>
            </div>
          </div>

          {/* Данные родителя на всю ширину */}
          {role === "student" && (
            <div className="space-y-3 pt-3" style={{ borderTop: isDark ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(0, 0, 0, 0.1)" }}>
              <p className="text-sm font-medium" style={{ color: textColors.primary }}>{t("parentDataSection")}</p>
              <div>
                <label className="block text-xs mb-1" style={{ color: textColors.secondary }}>{t("adminSelectExistingParent")}</label>
                <select
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value)}
                  className="w-full border-0 rounded-lg px-3 py-2"
                  style={inputStyle}
                >
                  <option value="" style={{ background: isDark ? "rgba(26, 34, 56, 0.95)" : "#FFFFFF" }}>—</option>
                  {parents.map((p) => (
                    <option key={p.id} value={p.id} style={{ background: isDark ? "rgba(26, 34, 56, 0.95)" : "#FFFFFF" }}>
                      {p.full_name} (ID: {p.id})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: textColors.secondary }}>{t("adminOrAddNewParent")}</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="email"
                    value={parentEmail}
                    onChange={(e) => setParentEmail(e.target.value)}
                    placeholder={t("parentEmail")}
                    className="w-full border-0 rounded-lg px-3 py-2 text-sm"
                    style={inputStyle}
                  />
                  <input
                    type="password"
                    value={parentPassword}
                    onChange={(e) => setParentPassword(e.target.value)}
                    placeholder={t("password")}
                    className="w-full border-0 rounded-lg px-3 py-2 text-sm"
                    style={inputStyle}
                  />
                  <input
                    type="text"
                    value={parentFullName}
                    onChange={(e) => setParentFullName(e.target.value)}
                    placeholder={t("parentFullName")}
                    className="w-full border-0 rounded-lg px-3 py-2 text-sm"
                    style={inputStyle}
                  />
                  <input
                    type="tel"
                    value={parentPhone}
                    onChange={(e) => setParentPhone(e.target.value)}
                    placeholder={t("parentPhone")}
                    className="w-full border-0 rounded-lg px-3 py-2 text-sm"
                    style={inputStyle}
                  />
                  <input
                    type="text"
                    value={parentCity}
                    onChange={(e) => setParentCity(e.target.value)}
                    placeholder={t("parentCity")}
                    className="w-full border-0 rounded-lg px-3 py-2 text-sm sm:col-span-2"
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>
          )}

          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-3">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto py-3 sm:py-2 px-4 rounded-xl sm:rounded-lg hover:opacity-90 text-center"
              style={{ background: isDark ? "rgba(30, 41, 59, 0.7)" : "rgba(0, 0, 0, 0.05)", border: isDark ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(0, 0, 0, 0.12)", color: textColors.primary }}
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="w-full sm:w-auto py-3 sm:py-2 px-4 rounded-xl sm:rounded-lg text-white hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #FF4181 0%, #B938EB 100%)" }}
            >
              {createMutation.isPending ? t("loading") : t("adminAddUser")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

type UserDetailResponse = {
  user: {
    id: number;
    email: string;
    full_name: string;
    role: string;
    phone: string;
    address: string;
    birth_date: string | null;
    parent_id: number | null;
    is_approved: boolean;
    created_at: string | null;
  };
  parent: {
    id: number;
    email: string;
    full_name: string;
    phone: string;
    address: string;
  } | null;
  applications: Array<{
    id: number;
    course_id: number;
    course_title: string | null;
    status: string;
    email: string;
    full_name: string;
    phone: string;
    city: string;
    parent_email: string;
    parent_full_name: string;
    parent_phone: string;
    parent_city: string;
    created_at: string | null;
    approved_at: string | null;
  }>;
};

function UserDetailModal({
  userId,
  onClose,
  onEdit,
}: {
  userId: number;
  onClose: () => void;
  onEdit: () => void;
}) {
  const { t, lang } = useLanguage();
  const { theme } = useTheme();
  const modalStyle = getModalStyle(theme);
  const textColors = getTextColors(theme);
  const isDark = theme === "dark";
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin-user-detail", userId],
    queryFn: async () => {
      const { data: d } = await api.get<UserDetailResponse>(`/admin/users/${userId}/detail`);
      return d;
    },
    enabled: !!userId,
    retry: 1,
  });

  if (isLoading || (!data && !isError)) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="rounded-xl shadow-xl p-6 max-w-2xl mx-4 w-full border-0 backdrop-blur-xl" style={modalStyle}>
          <p style={{ color: textColors.secondary }}>{t("loading")}</p>
        </div>
      </div>
    );
  }

  if (isError) {
    const errMsg = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? t("error");
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="rounded-xl shadow-xl p-6 max-w-md mx-4 w-full border-0 backdrop-blur-xl" style={modalStyle}>
          <p className="mb-4" style={{ color: "#ef4444" }}>{errMsg}</p>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => refetch()}
              className="py-2 px-4 rounded-lg hover:opacity-90"
              style={{ background: isDark ? "rgba(30, 41, 59, 0.7)" : "rgba(0, 0, 0, 0.05)", border: isDark ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(0, 0, 0, 0.12)", color: textColors.primary }}
            >
              {t("checkStatus")}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-4 rounded-lg text-white hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #FF4181 0%, #B938EB 100%)" }}
            >
              {t("close")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { user, parent, applications } = data;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto py-8">
      <div className="rounded-xl shadow-xl p-6 max-w-2xl mx-4 w-full border-0 backdrop-blur-xl max-h-[90vh] overflow-y-auto" style={modalStyle}>
        <div className="flex justify-between items-start mb-4">
          <h3 className="font-semibold text-lg" style={{ color: textColors.primary }}>
            {t("adminUserDetail")} — {user.full_name}
          </h3>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onEdit}
              className="p-2 rounded-lg hover:opacity-80"
              style={{ color: "#8B5CF6" }}
              title={t("adminEdit")}
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg hover:opacity-80"
              style={{ color: "#94A3B8" }}
            >
              ×
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <section>
            <h4 className="text-sm font-medium mb-2" style={{ color: "#94A3B8" }}>{t("adminUserProfile")}</h4>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt style={{ color: textColors.secondary }}>{t("email")}</dt>
              <dd style={{ color: textColors.primary }}>{user.email}</dd>
              <dt style={{ color: textColors.secondary }}>{t("adminFullName")}</dt>
              <dd style={{ color: textColors.primary }}>{user.full_name}</dd>
              <dt style={{ color: textColors.secondary }}>{t("role")}</dt>
              <dd style={{ color: textColors.primary }}>{user.role}</dd>
              <dt style={{ color: textColors.secondary }}>{t("phone")}</dt>
              <dd style={{ color: textColors.primary }}>{user.phone || "—"}</dd>
              <dt style={{ color: textColors.secondary }}>{t("city")}</dt>
              <dd style={{ color: textColors.primary }}>{mapCity(user.address, t) || "—"}</dd>
              <dt style={{ color: textColors.secondary }}>{t("date")}</dt>
              <dd style={{ color: textColors.primary }}>{user.birth_date || "—"}</dd>
            </dl>
          </section>

          {parent && (
            <section>
              <h4 className="text-sm font-medium mb-2" style={{ color: "#94A3B8" }}>{t("parentDataSection")}</h4>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <dt style={{ color: textColors.secondary }}>{t("email")}</dt>
                <dd style={{ color: textColors.primary }}>{parent.email}</dd>
                <dt style={{ color: textColors.secondary }}>{t("adminFullName")}</dt>
                <dd style={{ color: textColors.primary }}>{parent.full_name}</dd>
                <dt style={{ color: textColors.secondary }}>{t("phone")}</dt>
                <dd style={{ color: textColors.primary }}>{parent.phone || "—"}</dd>
                <dt style={{ color: textColors.secondary }}>{t("city")}</dt>
                <dd style={{ color: textColors.primary }}>{mapCity(parent.address, t) || "—"}</dd>
              </dl>
            </section>
          )}

          <section>
            <h4 className="text-sm font-medium mb-2" style={{ color: "#94A3B8" }}>{t("applicationsList")}</h4>
            {applications.length === 0 ? (
              <p className="text-sm" style={{ color: "#94A3B8" }}>{t("noApplications")}</p>
            ) : (
              <div className="space-y-3">
                {applications.map((app) => (
                  <div
                    key={app.id}
                    className="rounded-lg p-3 text-sm"
                    style={{ border: "1px solid rgba(255, 255, 255, 0.1)" }}
                  >
                    <div className="font-medium mb-2" style={{ color: textColors.primary }}>
                      {(app.course_title ? getLocalizedCourseTitle({ title: app.course_title } as any, t) : null) || "—"} — {t("status")}: {app.status}
                    </div>
                    <dl className="grid grid-cols-2 gap-1 text-xs">
                      <dt style={{ color: textColors.secondary }}>{t("email")}</dt>
                      <dd style={{ color: textColors.primary }}>{app.email}</dd>
                      <dt style={{ color: textColors.secondary }}>{t("adminFullName")}</dt>
                      <dd style={{ color: textColors.primary }}>{app.full_name}</dd>
                      <dt style={{ color: textColors.secondary }}>{t("phone")}</dt>
                      <dd style={{ color: textColors.primary }}>{app.phone || "—"}</dd>
                      <dt style={{ color: textColors.secondary }}>{t("city")}</dt>
                      <dd style={{ color: textColors.primary }}>{mapCity(app.city, t) || "—"}</dd>
                      <dt style={{ color: textColors.secondary }}>{t("parentEmail")}</dt>
                      <dd style={{ color: textColors.primary }}>{app.parent_email || "—"}</dd>
                      <dt style={{ color: textColors.secondary }}>{t("parentFullName")}</dt>
                      <dd style={{ color: textColors.primary }}>{app.parent_full_name || "—"}</dd>
                      <dt style={{ color: textColors.secondary }}>{t("parentPhone")}</dt>
                      <dd style={{ color: textColors.primary }}>{app.parent_phone || "—"}</dd>
                      <dt style={{ color: textColors.secondary }}>{t("parentCity")}</dt>
                      <dd style={{ color: textColors.primary }}>{mapCity(app.parent_city, t) || "—"}</dd>
                      <dt style={{ color: textColors.secondary }}>{t("date")}</dt>
                      <dd style={{ color: textColors.primary }}>{app.created_at ? formatLocalizedDate(app.created_at, lang as any, t) : "—"}</dd>
                    </dl>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="py-2 px-4 rounded-lg text-white hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #FF4181 0%, #B938EB 100%)" }}
          >
            {t("close")}
          </button>
        </div>
      </div>
    </div>
  );
}

function RewardCoinsModal({
  user,
  onClose,
  onSubmit,
  isPending,
}: {
  user: UserRow;
  onClose: () => void;
  onSubmit: (amount: number) => void;
  isPending: boolean;
}) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const modalStyle = getModalStyle(theme);
  const inputStyle = getInputStyle(theme);
  const textColors = getTextColors(theme);
  const isDark = theme === "dark";
  const [amountStr, setAmountStr] = useState("");
  const [localError, setLocalError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError("");
    const n = parseInt(amountStr.trim(), 10);
    if (!Number.isFinite(n) || n < 1 || n > ADMIN_REWARD_COINS_MAX) {
      setLocalError(t("adminRewardCoinsAmountInvalid"));
      return;
    }
    onSubmit(n);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div
        className="rounded-xl shadow-xl p-6 max-w-md mx-4 w-full border-0 backdrop-blur-xl"
        style={modalStyle}
      >
        <h3 className="font-semibold mb-2 text-lg" style={{ color: textColors.primary }}>
          {t("adminRewardCoinsModalTitle")}
        </h3>
        <p className="text-sm mb-1" style={{ color: textColors.primary }}>
          {user.full_name}
        </p>
        <p className="text-xs mb-4" style={{ color: textColors.secondary }}>
          {t("adminRewardCoinsBalanceLabel")}: {user.points ?? 0}
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: textColors.secondary }}>
              {t("adminRewardCoinsAmountLabel")}
            </label>
            <input
              type="number"
              min={1}
              max={ADMIN_REWARD_COINS_MAX}
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              className="w-full border-0 rounded-lg px-3 py-2"
              style={inputStyle}
              placeholder={t("adminRewardCoinsAmountPlaceholder")}
              autoFocus
            />
            <p className="text-xs mt-1" style={{ color: textColors.secondary }}>
              {t("adminRewardCoinsAmountHint")}
            </p>
          </div>
          {localError && <p className="text-red-400 text-sm">{localError}</p>}
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-4 rounded-lg hover:opacity-90"
              style={{
                background: isDark ? "rgba(30, 41, 59, 0.7)" : "rgba(0, 0, 0, 0.05)",
                border: isDark ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(0, 0, 0, 0.12)",
                color: textColors.primary,
              }}
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="py-2 px-4 rounded-lg text-white hover:opacity-90 disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #EAB308 0%, #CA8A04 100%)" }}
            >
              {isPending ? t("loading") : t("adminRewardCoinsSubmit")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function UserEditModal({
  user,
  editing,
  onClose,
  onSave,
  isPending,
}: {
  user: UserRow;
  editing: UserRow;
  onClose: () => void;
  onSave: (body: {
    full_name?: string;
    role?: string;
    password?: string;
    description?: string;
    photo_url?: string;
    phone?: string;
    birth_date?: string;
    address?: string;
    parent_id?: number | null;
  }) => void;
  isPending: boolean;
}) {
  const [fullName, setFullName] = useState(user.full_name);
  const [role, setRole] = useState(user.role);
  const [password, setPassword] = useState("");
  const [description, setDescription] = useState(user.description ?? "");
  const [photoUrl, setPhotoUrl] = useState(user.photo_url ?? "");
  const [phone, setPhone] = useState(user.phone ?? "");
  const [birthDate, setBirthDate] = useState(user.birth_date ?? "");
  const [address, setAddress] = useState(user.address ?? "");
  const [parentId, setParentId] = useState<string>(
    user.parent_id != null ? String(user.parent_id) : ""
  );

  const { t } = useLanguage();
  const { theme } = useTheme();
  const modalStyle = getModalStyle(theme);
  const inputStyle = getInputStyle(theme);
  const textColors = getTextColors(theme);
  const isDark = theme === "dark";

  const { data: parents = [] } = useQuery({
    queryKey: ["admin-users-parents"],
    queryFn: async () => {
      const { data } = await api.get<
        Array<{ id: number; full_name: string }>
      >("/admin/users?role=parent");
      return data;
    },
    enabled: role === "student",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const body: Record<string, string | number | null> = {};
    if (fullName !== user.full_name) body.full_name = fullName;
    if (role !== user.role) body.role = role;
    if (password.trim()) body.password = password;
    if (description !== (user.description ?? "")) body.description = description;
    if (photoUrl !== (user.photo_url ?? "")) body.photo_url = photoUrl;
    if (phone !== (user.phone ?? "")) body.phone = phone || null;
    if (birthDate !== (user.birth_date ?? "")) body.birth_date = birthDate || null;
    if (address !== (user.address ?? "")) body.address = address || null;
    const newParentId = parentId ? Number(parentId) : null;
    if (role === "student" && newParentId !== (user.parent_id ?? null)) body.parent_id = newParentId;
    if (Object.keys(body).length) onSave(body);
    else onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="rounded-xl shadow-xl p-6 max-w-3xl mx-4 w-full border-0 backdrop-blur-xl" style={modalStyle}>
        <h3 className="font-semibold mb-4 text-lg" style={{ color: textColors.primary }}>
          {t("adminUserEdit")}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Левая колонка */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: textColors.secondary }}>
                  {t("email")}
                </label>
                <input
                  type="text"
                  value={user.email}
                  disabled
                  className="w-full border-0 rounded-lg px-3 py-2"
                  style={{ ...inputStyle, opacity: 0.6 }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: textColors.secondary }}>
                  {t("adminFullName")}
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full border-0 rounded-lg px-3 py-2"
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: textColors.secondary }}>
                  {t("role")}
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full border-0 rounded-lg px-3 py-2"
                  style={inputStyle}
                >
                  <option value="admin" style={{ background: isDark ? "rgba(26, 34, 56, 0.95)" : "#FFFFFF" }}>{t("admin")}</option>
                  <option value="director" style={{ background: isDark ? "rgba(26, 34, 56, 0.95)" : "#FFFFFF" }}>{t("adminDirector")}</option>
                  <option value="curator" style={{ background: isDark ? "rgba(26, 34, 56, 0.95)" : "#FFFFFF" }}>{t("adminCurator")}</option>
                  <option value="teacher" style={{ background: isDark ? "rgba(26, 34, 56, 0.95)" : "#FFFFFF" }}>{t("adminTeacherRole")}</option>
                  <option value="student" style={{ background: isDark ? "rgba(26, 34, 56, 0.95)" : "#FFFFFF" }}>{t("student")}</option>
                  <option value="parent" style={{ background: isDark ? "rgba(26, 34, 56, 0.95)" : "#FFFFFF" }}>{t("adminParentRole")}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: textColors.secondary }}>{t("profileAddress")}</label>
                <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder={t("profilePlaceholderAddress")} className="w-full border-0 rounded-lg px-3 py-2" style={inputStyle} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: textColors.secondary }}>
                  {t("adminPhotoUrl")}
                </label>
                <input
                  type="text"
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                  placeholder={t("placeholderUrl")}
                  className="w-full border-0 rounded-lg px-3 py-2"
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Правая колонка */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: textColors.secondary }}>{t("phone")}</label>
                <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t("profilePlaceholderPhone")} className="w-full border-0 rounded-lg px-3 py-2" style={inputStyle} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: textColors.secondary }}>{t("profileBirthDate")}</label>
                <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className="w-full border-0 rounded-lg px-3 py-2" style={inputStyle} />
              </div>
              {role === "student" && (
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: textColors.secondary }}>
                    {t("adminParentSelect")}
                  </label>
                  <select
                    value={parentId}
                    onChange={(e) => setParentId(e.target.value)}
                    className="w-full border-0 rounded-lg px-3 py-2"
                    style={inputStyle}
                  >
                    <option value="" style={{ background: isDark ? "rgba(26, 34, 56, 0.95)" : "#FFFFFF" }}>— {t("adminSelectNone")}</option>
                    {parents.map((p) => (
                      <option key={p.id} value={p.id} style={{ background: isDark ? "rgba(26, 34, 56, 0.95)" : "#FFFFFF" }}>
                        {p.full_name} (#{p.id})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: textColors.secondary }}>
                  {t("adminNewPasswordHint")}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("adminLeaveEmptyToKeep")}
                  className="w-full border-0 rounded-lg px-3 py-2"
                  style={inputStyle}
                />
              </div>
            </div>
          </div>

          {/* Описание на всю ширину */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: textColors.secondary }}>
              {t("adminCoursesDescLabel")}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full border-0 rounded-lg px-3 py-2"
              style={inputStyle}
            />
          </div>

          {/* Кнопки */}
          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-4 rounded-lg hover:opacity-90"
              style={{ background: isDark ? "rgba(30, 41, 59, 0.7)" : "rgba(0, 0, 0, 0.05)", border: isDark ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(0, 0, 0, 0.12)", color: textColors.primary }}
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="py-2 px-4 rounded-lg text-white hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #FF4181 0%, #B938EB 100%)" }}
            >
              {t("save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AssignStudentModal({
  student,
  onClose,
  onSuccess,
}: {
  student: StudentWithoutGroup;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const modalStyle = getModalStyle(theme);
  const inputStyle = getInputStyle(theme);
  const textColors = getTextColors(theme);
  const isDark = theme === "dark";
  const [groupId, setGroupId] = useState<number | "">("");
  const queryClient = useQueryClient();

  const { data: groups = [] } = useQuery({
    queryKey: ["admin-teacher-groups", student.course_id],
    queryFn: async () => {
      const { data } = await api.get<TeacherGroupOption[]>(
        `/admin/teacher-groups?course_id=${student.course_id}`
      );
      return data;
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async () => {
      if (typeof groupId !== "number") throw new Error(t("errorGroupNotSelected"));
      const group = groups.find((g) => g.id === groupId);
      if (!group) throw new Error(t("courseGroupNotFound"));
      await api.post("/admin/add-student-tasks", {
        student_id: student.id,
        teacher_id: group.teacher_id,
        group_id: groupId,
      });
    },
    onSuccess: () => {
      onSuccess();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof groupId === "number") {
      createTaskMutation.mutate();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="assign-student-modal-title"
      onClick={onClose}
    >
      <div
        className="rounded-t-2xl sm:rounded-xl shadow-2xl w-full max-w-md max-h-[min(90dvh,100vh)] flex flex-col border-0 sm:mx-4 overflow-hidden"
        style={{ background: "rgba(26, 34, 56, 0.98)", backdropFilter: "blur(12px)", border: "1px solid rgba(255, 255, 255, 0.1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 sm:px-6 sm:pt-6 shrink-0 border-b border-white/10">
          <div className="min-w-0 flex-1 pr-2">
            <h3 id="assign-student-modal-title" className="font-semibold text-white text-base sm:text-lg leading-snug">
              {t("adminAssignTitle")}
            </h3>
            <p className="text-sm mt-2 break-words" style={{ color: "#94A3B8" }}>
              {student.full_name} ({student.email}) — {getLocalizedCourseTitle({ title: student.course_title } as any, t)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-xl p-2.5 text-white/90 hover:bg-white/10 hover:text-white transition-colors"
            aria-label={t("close")}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 px-5 sm:px-6">
          <div className="overflow-y-auto flex-1 py-4 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "#94A3B8" }}>
                {t("adminAssignGroup")} ({t("adminAssignTeacher")})
              </label>
              <select
                value={groupId}
                onChange={(e) => setGroupId(e.target.value ? Number(e.target.value) : "")}
                className="w-full border-0 rounded-lg px-3 py-2.5 text-white text-base"
                style={{ background: "rgba(30, 41, 59, 0.7)", border: "1px solid rgba(255, 255, 255, 0.1)" }}
                required
              >
                <option value="">— {t("adminSelectNone")}</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.group_name} ({g.teacher_name})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="shrink-0 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-2 border-t border-white/10 mt-2 pb-[calc(5.25rem+env(safe-area-inset-bottom))] sm:pb-4">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto py-3.5 sm:py-2.5 px-4 rounded-xl sm:rounded-lg text-white hover:opacity-90"
              style={{ background: "rgba(30, 41, 59, 0.85)", border: "1px solid rgba(255, 255, 255, 0.12)" }}
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={createTaskMutation.isPending || groupId === ""}
              className="w-full sm:w-auto py-3.5 sm:py-2.5 px-4 rounded-xl sm:rounded-lg text-white hover:opacity-90 disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #FF4181 0%, #B938EB 100%)" }}
            >
              {t("adminAssignConfirm")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
