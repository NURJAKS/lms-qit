"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useLanguage } from "@/context/LanguageContext";
import { formatLocalizedDate } from "@/utils/dateUtils";
import { useTheme } from "@/context/ThemeContext";
import { useAuthStore } from "@/store/authStore";
import { toast } from "@/store/notificationStore";
import { Loader2, Check, X, Copy, UserPlus, ExternalLink, ClipboardList } from "lucide-react";
import { getLocalizedCourseTitle } from "@/lib/courseUtils";
import { DeleteConfirmButton } from "@/components/ui/DeleteConfirmButton";

type TeacherGroupOption = {
  id: number;
  group_name: string;
  teacher_id: number;
  teacher_name: string;
};

interface Application {
  id: number;
  user_id: number;
  course_id: number;
  status: string;
  email: string;
  full_name: string;
  phone: string;
  parent_email: string;
  parent_full_name: string;
  parent_phone: string;
  created_at: string | null;
  approved_at: string | null;
  course_title: string | null;
}

export default function AdminApplicationsPage() {
  const { t, lang } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const router = useRouter();
  const { user, canManageUsers } = useAuthStore();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (user && !canManageUsers()) {
      router.replace("/app/admin");
    }
  }, [user, canManageUsers, router]);

  // Все хуки должны быть вызваны до early return
  const [statusFilter, setStatusFilter] = useState<string>("paid");
  const [approveModal, setApproveModal] = useState<{
    login: string;
    password?: string;
    user_id: number;
    course_id: number;
  } | null>(null);
  const [assignModal, setAssignModal] = useState<{ app_id: number; course_id: number } | null>(null);
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [reopeningId, setReopeningId] = useState<number | null>(null);
  const [assigningId, setAssigningId] = useState<number | null>(null);
  const [assignGroupId, setAssignGroupId] = useState<number | "">("");

  const { data: applications = [], isLoading } = useQuery({
    queryKey: ["admin-applications", statusFilter],
    queryFn: async () => {
      const url = statusFilter ? `/admin/applications?status=${statusFilter}` : "/admin/applications";
      const { data } = await api.get<Application[]>(url);
      return data;
    },
    enabled: !!user && canManageUsers(),
  });

  const teacherGroupsCourseId = approveModal?.course_id ?? assignModal?.course_id;
  const { data: teacherGroups = [] } = useQuery({
    queryKey: ["admin-teacher-groups", teacherGroupsCourseId],
    queryFn: async () => {
      const { data } = await api.get<TeacherGroupOption[]>(
        `/admin/teacher-groups?course_id=${teacherGroupsCourseId!}`
      );
      return data;
    },
    enabled: !!teacherGroupsCourseId && !!user && canManageUsers(),
  });

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!approveModal || typeof assignGroupId !== "number") return;
      const group = teacherGroups.find((g) => g.id === assignGroupId);
      if (!group) return;
      await api.post("/admin/add-student-tasks", {
        student_id: approveModal.user_id,
        teacher_id: group.teacher_id,
        group_id: assignGroupId,
      });
    },
    onSuccess: () => {
      setAssignGroupId("");
      setApproveModal(null);
      queryClient.invalidateQueries({ queryKey: ["admin-applications"] });
    },
  });

  const assignCuratorMutation = useMutation({
    mutationFn: async () => {
      if (!assignModal || typeof assignGroupId !== "number") return;
      await api.post(`/admin/applications/${assignModal.app_id}/assign-curator`, {
        group_id: assignGroupId,
      });
    },
    onSuccess: () => {
      setAssignGroupId("");
      setAssignModal(null);
      queryClient.invalidateQueries({ queryKey: ["admin-applications"] });
    },
  });

  if (!user || !canManageUsers()) {
    return null;
  }

  const handleApprove = async (appId: number, app: Application) => {
    setApprovingId(appId);
    try {
      const { data } = await api.post<{
        login: string;
        password?: string;
        user_id?: number;
        course_id?: number;
      }>(`/admin/applications/${appId}/approve`);
      setApproveModal({
        login: data.login,
        password: data.password,
        user_id: data.user_id ?? app.user_id,
        course_id: data.course_id ?? app.course_id,
      });
      queryClient.invalidateQueries({ queryKey: ["admin-applications"] });
    } catch (e) {
      toast.error((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? t("error"));
    } finally {
      setApprovingId(null);
    }
  };

  const handleReject = async (appId: number) => {
    setRejectingId(appId);
    try {
      await api.post(`/admin/applications/${appId}/reject`);
      queryClient.invalidateQueries({ queryKey: ["admin-applications"] });
    } catch (e) {
      toast.error((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? t("error"));
    } finally {
      setRejectingId(null);
    }
  };

  const handleReopen = async (appId: number) => {
    setReopeningId(appId);
    try {
      await api.post(`/admin/applications/${appId}/reopen`);
      queryClient.invalidateQueries({ queryKey: ["admin-applications"] });
    } catch (e) {
      toast.error((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? t("error"));
    } finally {
      setReopeningId(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const formatDate = (d: string | null) => formatLocalizedDate(d, lang as any, t);

  const showParentEmail = applications.some((a) => a.parent_email);
  const showParentFullName = applications.some((a) => a.parent_full_name);
  const showParentPhone = applications.some((a) => a.parent_phone);

  const statusLabel = (s: string) => {
    if (s === "pending") return t("applicationStatusPending");
    if (s === "paid") return t("applicationStatusPaid");
    if (s === "approved") return t("applicationStatusApproved");
    if (s === "rejected") return t("applicationStatusRejected");
    return s;
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getStatusBadgeColor = (status: string) => {
    const colors: Record<string, string> = {
      approved: "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300 border-green-300 dark:border-green-500/30",
      paid: "bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-500/30",
      rejected: "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300 border-red-300 dark:border-red-500/30",
      pending: "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-500/30",
    };
    return colors[status] || "bg-gray-100 dark:bg-gray-500/20 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-500/30";
  };

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">{t("applicationsList")}</h1>

      <div className="flex gap-3 mb-6">
        {["paid", "pending", "approved", "rejected"].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`px-5 py-2.5 rounded-xl font-medium transition-all ${
              statusFilter === s
                ? "text-white shadow-lg"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            }`}
            style={statusFilter === s ? { background: "#2563eb", boxShadow: "0 4px 14px rgba(37, 99, 235, 0.4)" } : { background: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(255, 255, 255, 0.8)", border: isDark ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(0, 0, 0, 0.1)" }}
          >
            {statusLabel(s)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-200 dark:border-white/10 overflow-hidden backdrop-blur-xl bg-white/80 dark:bg-[rgba(30,41,59,0.6)] shadow-lg dark:shadow-xl" style={{ boxShadow: isDark ? "0 8px 32px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05)" : "0 4px 16px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.05)" }}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px]">
              <thead className="bg-gray-100 dark:bg-[rgba(0,0,0,0.3)]">
                <tr>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700 dark:text-gray-300">{t("date")}</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700 dark:text-gray-300">{t("adminEmailLabel")}</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700 dark:text-gray-300">{t("fullName")}</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700 dark:text-gray-300">{t("phone")}</th>
                  {showParentEmail && (
                    <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700 dark:text-gray-300">{t("parentEmail")}</th>
                  )}
                  {showParentFullName && (
                    <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700 dark:text-gray-300">{t("parentFullName")}</th>
                  )}
                  {showParentPhone && (
                    <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700 dark:text-gray-300">{t("parentPhone")}</th>
                  )}
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700 dark:text-gray-300">{t("course")}</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700 dark:text-gray-300">{t("status")}</th>
                  {(statusFilter === "pending" || statusFilter === "paid" || statusFilter === "rejected") && (
                    <th className="text-right py-4 px-6 text-sm font-semibold text-gray-700 dark:text-gray-300">{t("actions")}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {applications.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-16 text-center">
                      <div className="flex flex-col items-center justify-center w-full">
                        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4 bg-blue-100 dark:bg-[rgba(59,130,246,0.2)]">
                          <ClipboardList className="w-10 h-10 text-blue-600 dark:text-blue-400" />
                        </div>
                        <p className="text-gray-600 dark:text-gray-400 text-lg">{t("noApplications")}</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  applications.map((app) => (
                    <tr key={app.id} className="border-t border-gray-200 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                      <td className="py-4 px-6 text-sm text-gray-600 dark:text-gray-400">{formatDate(app.created_at)}</td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0" style={{ background: "linear-gradient(135deg, #14b8a6 0%, #3b82f6 100%)" }}>
                            {getInitials(app.full_name)}
                          </div>
                          <span className="text-gray-900 dark:text-white text-sm">{app.email}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-sm text-gray-900 dark:text-white font-medium">{app.full_name}</td>
                      <td className="py-4 px-6 text-sm text-gray-600 dark:text-gray-400">{app.phone || "—"}</td>
                      {showParentEmail && (
                        <td className="py-4 px-6 text-sm text-gray-600 dark:text-gray-400">{app.parent_email || "—"}</td>
                      )}
                      {showParentFullName && (
                        <td className="py-4 px-6 text-sm text-gray-600 dark:text-gray-400">{app.parent_full_name || "—"}</td>
                      )}
                      {showParentPhone && (
                        <td className="py-4 px-6 text-sm text-gray-600 dark:text-gray-400">{app.parent_phone || "—"}</td>
                      )}
                      <td className="py-4 px-6 text-sm text-gray-900 dark:text-white">{app.course_title ? getLocalizedCourseTitle({ title: app.course_title } as any, t as (k: string) => string) : "—"}</td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getStatusBadgeColor(app.status)}`}>
                          {statusLabel(app.status)}
                        </span>
                      </td>
                      {statusFilter === "paid" && (
                        <td className="py-4 px-6 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setAssignModal({ app_id: app.id, course_id: app.course_id });
                              setAssignGroupId("");
                            }}
                            disabled={assigningId !== null}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 text-sm font-medium ml-auto transition-all shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40"
                          >
                            <UserPlus className="w-4 h-4" />
                            {t("adminAssignToCurator")}
                          </button>
                        </td>
                      )}
                      {statusFilter === "pending" && (
                        <td className="py-4 px-6 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleApprove(app.id, app)}
                              disabled={approvingId !== null}
                              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 text-sm font-medium transition-all shadow-lg shadow-green-500/30 hover:shadow-green-500/40"
                            >
                              {approvingId === app.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                              {t("approve")}
                            </button>
                            <DeleteConfirmButton
                              onDelete={() => handleReject(app.id)}
                              isLoading={rejectingId === app.id}
                              text={t("reject")}
                              title={`${t("reject")} ${app.full_name}?`}
                              description={t("confirmReject")}
                              className="shadow-red-500/30 hover:shadow-red-500/40"
                            />
                          </div>
                        </td>
                      )}
                      {statusFilter === "rejected" && (
                        <td className="py-4 px-6 text-right">
                          <button
                            type="button"
                            onClick={() => handleReopen(app.id)}
                            disabled={reopeningId !== null}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 text-sm font-medium ml-auto transition-all shadow-lg shadow-amber-500/30 hover:shadow-amber-500/40"
                          >
                            {reopeningId === app.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                            {t("adminReturnToPending")}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {approveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 max-w-md mx-4 w-full">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">{t("credentialsForStudent")}</h2>
            <div className="space-y-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-gray-600 dark:text-gray-400 w-20">{t("loginLabel")}</span>
                <code className="flex-1 bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded text-sm">{approveModal.login}</code>
                <button type="button" onClick={() => copyToClipboard(approveModal.login)} className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-600">
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-600 dark:text-gray-400 w-20">{t("password")}:</span>
                <code className="flex-1 bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded text-sm">
                  {approveModal.password ?? t("adminPasswordUnchanged")}
                </code>
                {approveModal.password && (
                  <button type="button" onClick={() => copyToClipboard(approveModal.password!)} className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-600">
                    <Copy className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{t("credentialsHint")}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">{t("adminAssignLaterHint")}</p>

            <div className="border-t border-gray-200 dark:border-gray-600 pt-4 mb-4">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t("adminAssignTitle")}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{t("adminAssignTitleHint")}</p>
              {teacherGroups.length === 0 ? (
                <div className="space-y-2">
                  <p className="text-sm text-amber-600 dark:text-amber-400">{t("adminNoGroupsForCourse")}</p>
                  <Link
                    href="/app/teacher"
                    className="inline-flex items-center gap-1 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    <ExternalLink className="w-4 h-4" /> {t("adminCreateGroupLink")}
                  </Link>
                </div>
              ) : (
                <>
                  <select
                    value={assignGroupId}
                    onChange={(e) => setAssignGroupId(e.target.value ? Number(e.target.value) : "")}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    <option value="">— {t("adminSelectNone")}</option>
                    {teacherGroups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.group_name} ({g.teacher_name})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => assignMutation.mutate()}
                    disabled={assignMutation.isPending || !assignGroupId}
                    className="mt-2 w-full py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <UserPlus className="w-4 h-4" /> {t("adminAssignConfirm")}
                  </button>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => setApproveModal(null)}
              className="w-full py-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              {t("close")}
            </button>
          </div>
        </div>
      )}

      {assignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 max-w-md mx-4 w-full">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">{t("adminAssignToCurator")}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{t("adminAssignToCuratorHint")}</p>
            {teacherGroups.length === 0 ? (
              <div className="space-y-2">
                <p className="text-sm text-amber-600 dark:text-amber-400">{t("adminNoGroupsForCourse")}</p>
                <Link
                  href="/app/teacher"
                  className="inline-flex items-center gap-1 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  <ExternalLink className="w-4 h-4" /> {t("adminCreateGroupLink")}
                </Link>
              </div>
            ) : (
              <>
                <select
                  value={assignGroupId}
                  onChange={(e) => setAssignGroupId(e.target.value ? Number(e.target.value) : "")}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 mb-4"
                >
                  <option value="">— {t("adminSelectNone")}</option>
                  {teacherGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.group_name} ({g.teacher_name})
                    </option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAssignModal(null)}
                    className="flex-1 py-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    {t("cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof assignGroupId !== "number") return;
                      setAssigningId(assignModal.app_id);
                      assignCuratorMutation.mutate(undefined, {
                        onSettled: () => setAssigningId(null),
                        onError: (e) => {
                          toast.error((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? t("error"));
                        },
                      });
                    }}
                    disabled={assignCuratorMutation.isPending || !assignGroupId}
                    className="flex-1 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {assignCuratorMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                    {t("adminAssignConfirm")}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
