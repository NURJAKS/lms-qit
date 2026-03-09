"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useState } from "react";
import Link from "next/link";
import { useAuthStore } from "@/store/authStore";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { Download, Pencil, Plus, Trash2, UserPlus, ClipboardList, Info } from "lucide-react";
import { getGlassCardStyle, getModalStyle, getInputStyle, getTextColors } from "@/utils/themeStyles";
import { BlurFade } from "@/components/ui/blur-fade";
import { getLocalizedCourseTitle } from "@/lib/courseUtils";
import { formatDateTimeLocalized, formatDateLocalized } from "@/lib/dateUtils";

type UserRow = {
  id: number;
  email: string;
  full_name: string;
  role: string;
  description?: string;
  photo_url?: string;
  parent_id?: number | null;
  phone?: string | null;
  birth_date?: string | null;
  address?: string | null;
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

type Application = {
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
};

type TeacherGroupOption = {
  id: number;
  group_name: string;
  teacher_id: number;
  teacher_name: string;
};

export function UserManagement() {
  const { t, lang } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const modalStyle = getModalStyle(theme);
  const inputStyle = getInputStyle(theme);
  const textColors = getTextColors(theme);
  const glassStyle = getGlassCardStyle(theme);
  const { user } = useAuthStore();
  const canManageUsers = useAuthStore((s) => s.canManageUsers());
  const isCurator = user?.role === "curator";
  const [activeTab, setActiveTab] = useState<"users" | "without-group" | "applications">("users");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("paid");
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [assignModal, setAssignModal] = useState<StudentWithoutGroup | null>(null);
  const queryClient = useQueryClient();

  const { data: users = [] } = useQuery({
    queryKey: ["admin-users", search],
    queryFn: async () => {
      const { data } = await api.get<UserRow[]>(
        `/admin/users?search=${encodeURIComponent(search)}`
      );
      return data;
    },
    enabled: activeTab === "users",
  });

  const { data: studentsWithoutGroup = [] } = useQuery({
    queryKey: ["admin-students-without-group"],
    queryFn: async () => {
      const { data } = await api.get<StudentWithoutGroup[]>("/admin/students-without-group");
      return data;
    },
    enabled: activeTab === "without-group",
  });

  const { data: applications = [] } = useQuery({
    queryKey: ["admin-applications", statusFilter],
    queryFn: async () => {
      const url = statusFilter ? `/admin/applications?status=${statusFilter}` : "/admin/applications";
      const { data } = await api.get<Application[]>(url);
      return data;
    },
    enabled: activeTab === "applications",
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
      setEditing(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/admin/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setDeleteConfirm(null);
    },
  });

  const handleExportCsv = async () => {
    try {
      const { data } = await api.get<Blob>("/admin/users/export/csv", {
        responseType: "blob",
      });
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = "users.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to export CSV:", error);
      const err = error as { response?: { data?: { detail?: string }; status?: number }; message?: string };
      const errorMessage = err?.response?.data?.detail || err?.message || t("csvExportError");
      alert(errorMessage);
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

  const statusLabel = (s: string) => {
    if (s === "pending") return t("applicationStatusPending");
    if (s === "paid") return t("applicationStatusPaid");
    if (s === "approved") return t("applicationStatusApproved");
    if (s === "rejected") return t("applicationStatusRejected");
    return s;
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

  const formatDate = (d: string | null) => formatDateTimeLocalized(d, lang);

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
      <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-white/10 pb-2 w-full">
        <BlurFade delay={0.15} duration={0.4} blur="4px" offset={10}>
          <button
            type="button"
            onClick={() => setActiveTab("users")}
              className={`px-4 py-2 font-medium rounded-lg transition-all ${
                activeTab === "users"
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
            onClick={() => setActiveTab("without-group")}
              className={`px-4 py-2 font-medium rounded-lg transition-all ${
                activeTab === "without-group"
                  ? "text-white shadow-lg"
                  : isDark ? "text-white/70 hover:text-white hover:bg-white/10" : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              }`}
              style={activeTab === "without-group" ? { background: "linear-gradient(135deg, #FF4181 0%, #B938EB 100%)", boxShadow: "0 0 12px rgba(255, 65, 129, 0.3)" } : undefined}
          >
            {t("adminStudentsWithoutGroup")}
          </button>
        </BlurFade>
        <BlurFade delay={0.25} duration={0.4} blur="4px" offset={10}>
          <button
            type="button"
            onClick={() => setActiveTab("applications")}
              className={`px-4 py-2 font-medium rounded-lg transition-all ${
                activeTab === "applications"
                  ? "text-white shadow-lg"
                  : isDark ? "text-white/70 hover:text-white hover:bg-white/10" : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              }`}
              style={activeTab === "applications" ? { background: "linear-gradient(135deg, #FF4181 0%, #B938EB 100%)", boxShadow: "0 0 12px rgba(255, 65, 129, 0.3)" } : undefined}
          >
            {t("applicationsList")}
          </button>
        </BlurFade>
      </div>
      <BlurFade delay={0.2} duration={0.4} blur="4px" offset={10}>
        <div className="flex gap-3 mb-6 w-full justify-between items-center">
          <div className="flex gap-3 flex-1">
            {activeTab === "users" && (
              <input
                type="text"
                placeholder={t("adminSearch")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border-0 rounded-xl px-4 py-2.5 w-64 transition-all backdrop-blur-sm"
                style={getInputStyle(theme)}
              />
            )}
            {activeTab === "applications" && (
              <div className="flex gap-2">
                {["paid", "pending", "approved", "rejected"].map((s, index) => (
                  <BlurFade key={s} delay={0.25 + index * 0.05} duration={0.4} blur="4px" offset={10}>
                    <button
                      type="button"
                      onClick={() => setStatusFilter(s)}
                  className={`px-4 py-2 font-medium rounded-lg transition-all ${
                    statusFilter === s
                      ? "text-white shadow-lg"
                      : isDark ? "text-white/70 hover:text-white hover:bg-white/10" : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                  }`}
                  style={statusFilter === s ? { background: "linear-gradient(135deg, #FF4181 0%, #B938EB 100%)", boxShadow: "0 0 12px rgba(255, 65, 129, 0.3)" } : undefined}
                    >
                      {statusLabel(s)}
                    </button>
                  </BlurFade>
                ))}
              </div>
            )}
          </div>
          {canManageUsers && activeTab === "users" && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAddUserOpen(true)}
                className="flex items-center gap-2 py-2.5 px-5 rounded-xl text-white hover:opacity-90 transition-all font-medium shadow-lg"
                style={{ background: "linear-gradient(135deg, #FF4181 0%, #B938EB 100%)", boxShadow: "0 4px 14px rgba(255, 65, 129, 0.4)" }}
              >
                <Plus className="w-4 h-4" /> {t("adminAddUser")}
              </button>
              <button
                type="button"
                onClick={handleExportCsv}
                className="flex items-center gap-2 py-2.5 px-5 rounded-xl hover:opacity-90 transition-all font-medium backdrop-blur-sm"
                style={getGlassCardStyle(theme)}
              >
                <Download className="w-4 h-4" /> CSV
              </button>
            </div>
          )}
        </div>
      </BlurFade>
      <BlurFade delay={0.2} duration={0.5} blur="6px" offset={15} direction="up">
        <div className="rounded-2xl overflow-hidden border-0 backdrop-blur-xl shadow-lg w-full" style={getGlassCardStyle(theme)}>
          {activeTab === "users" ? (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead style={{ background: isDark ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.05)" }}>
              <tr>
                <th className="text-left py-4 px-6 font-semibold text-sm" style={{ color: textColors.primary }}>
                  {t("adminFullName")}
                </th>
                <th className="text-left py-4 px-6 font-semibold text-sm" style={{ color: textColors.primary }}>
                  Email
                </th>
                <th className="text-left py-4 px-6 font-semibold text-sm" style={{ color: textColors.primary }}>
                  {t("role")}
                </th>
                {canManageUsers && (
                  <th className="text-right py-4 px-6 font-semibold text-sm w-32" style={{ color: textColors.primary }}>
                    {t("adminCoursesActions")}
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {users.map((u, index) => (
                <BlurFade key={u.id} delay={0.2 + index * 0.04} duration={0.4} blur="4px" offset={12} direction="up">
                  <tr className={`border-b ${isDark ? "border-white/10 hover:bg-white/5" : "border-gray-200 hover:bg-gray-50"} transition-colors`}>
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
                        className="font-medium transition-colors hover:text-[#8B5CF6]"
                        style={{ color: textColors.primary }}
                      >
                        {u.full_name}
                      </Link>
                      <p className="text-xs mt-0.5" style={{ color: textColors.secondary }}>ID: {u.id}</p>
                    </div>
                  </div>
                </td>
                <td className="py-4 px-6">
                  <span style={{ color: textColors.primary }}>{u.email}</span>
                </td>
                <td className="py-4 px-6">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getRoleBadgeColor(u.role)}`}>
                    {u.role}
                  </span>
                </td>
                {canManageUsers && (
                  <td className="py-4 px-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditing(u)}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        style={{ color: "#8B5CF6" }}
                        title={t("adminEdit")}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirm(u.id)}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        style={{ color: "#FF4181" }}
                        title={t("adminDelete")}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                  )}
                    </tr>
                  </BlurFade>
                ))}
            </tbody>
          </table>
          </div>
          ) : activeTab === "without-group" ? (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead style={{ background: isDark ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.05)" }}>
              <tr>
                <th className="text-left py-4 px-6 font-semibold text-sm" style={{ color: textColors.primary }}>
                  {t("adminFullName")}
                </th>
                <th className="text-left py-4 px-6 font-semibold text-sm" style={{ color: textColors.primary }}>
                  Email
                </th>
                <th className="text-left py-4 px-6 font-semibold text-sm" style={{ color: textColors.primary }}>
                  {t("phone")}
                </th>
                <th className="text-left py-4 px-6 font-semibold text-sm" style={{ color: textColors.primary }}>
                  {t("courses")}
                </th>
                <th className="text-left py-4 px-6 font-semibold text-sm" style={{ color: textColors.primary }}>
                  {t("adminEnrolledAt")}
                </th>
                <th className="text-right py-4 px-6 font-semibold text-sm w-32" style={{ color: textColors.primary }}>
                  {t("adminCoursesActions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {studentsWithoutGroup.length === 0 ? (
                <BlurFade delay={0.2} duration={0.4} blur="4px" offset={12}>
                  <tr>
                    <td colSpan={6} className="py-12 text-center">
                      <div className="flex flex-col items-center">
                        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: "rgba(139, 92, 246, 0.2)" }}>
                          <UserPlus className="w-8 h-8" style={{ color: "#8B5CF6" }} />
                        </div>
                        <p style={{ color: textColors.secondary }}>{t("adminNoStudentsWithoutGroup")}</p>
                      </div>
                    </td>
                  </tr>
                </BlurFade>
              ) : (
                studentsWithoutGroup.map((s, index) => (
                  <BlurFade key={`${s.id}-${s.course_id}`} delay={0.2 + index * 0.04} duration={0.4} blur="4px" offset={12} direction="up">
                    <tr className={`border-b ${isDark ? "border-white/10 hover:bg-white/5" : "border-gray-200 hover:bg-gray-50"} transition-colors`}>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0" style={{ background: "linear-gradient(135deg, #14b8a6 0%, #3b82f6 100%)" }}>
                        {getInitials(s.full_name)}
                      </div>
                      <span className="font-medium" style={{ color: textColors.primary }}>{s.full_name}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6" style={{ color: textColors.primary }}>{s.email}</td>
                  <td className="py-4 px-6" style={{ color: textColors.secondary }}>{s.phone || "—"}</td>
                  <td className="py-4 px-6" style={{ color: textColors.primary }}>{getLocalizedCourseTitle({ title: s.course_title } as any, t)}</td>
                  <td className="py-4 px-6" style={{ color: textColors.secondary }}>
                    {s.enrolled_at ? formatDateLocalized(s.enrolled_at, lang) : "—"}
                  </td>
                  <td className="py-4 px-6 text-right">
                    <button
                      type="button"
                      onClick={() => setAssignModal(s)}
                      className="flex items-center gap-2 ml-auto py-2.5 px-4 rounded-xl text-white hover:opacity-90 text-sm font-medium transition-all shadow-lg"
                      style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", boxShadow: "0 4px 14px rgba(16, 185, 129, 0.4)" }}
                    >
                      <UserPlus className="w-4 h-4" /> {t("adminAssign")}
                      </button>
                    </td>
                    </tr>
                  </BlurFade>
                ))
              )}
            </tbody>
          </table>
          </div>
          ) : activeTab === "applications" ? (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead style={{ background: isDark ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.05)" }}>
              <tr>
                <th className="text-left py-4 px-6 font-semibold text-sm" style={{ color: textColors.primary }}>
                  {t("date")}
                </th>
                <th className="text-left py-4 px-6 font-semibold text-sm" style={{ color: textColors.primary }}>
                  Email
                </th>
                <th className="text-left py-4 px-6 font-semibold text-sm" style={{ color: textColors.primary }}>
                  {t("fullName")}
                </th>
                <th className="text-left py-4 px-6 font-semibold text-sm" style={{ color: textColors.primary }}>
                  {t("phone")}
                </th>
                <th className="text-left py-4 px-6 font-semibold text-sm" style={{ color: textColors.primary }}>
                  {t("parentEmail")}
                </th>
                <th className="text-left py-4 px-6 font-semibold text-sm" style={{ color: textColors.primary }}>
                  {t("parentFullName")}
                </th>
                <th className="text-left py-4 px-6 font-semibold text-sm" style={{ color: textColors.primary }}>
                  {t("course")}
                </th>
                <th className="text-left py-4 px-6 font-semibold text-sm" style={{ color: textColors.primary }}>
                  {t("status")}
                </th>
              </tr>
            </thead>
            <tbody>
              {applications.length === 0 ? (
                <BlurFade delay={0.2} duration={0.4} blur="4px" offset={12}>
                  <tr>
                    <td colSpan={8} className="py-12 text-center">
                      <div className="flex flex-col items-center">
                        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: "rgba(139, 92, 246, 0.2)" }}>
                          <ClipboardList className="w-8 h-8" style={{ color: "#8B5CF6" }} />
                        </div>
                        <p style={{ color: textColors.secondary }}>{t("noApplications")}</p>
                      </div>
                    </td>
                  </tr>
                </BlurFade>
              ) : (
                applications.map((app, index) => (
                  <BlurFade key={app.id} delay={0.2 + index * 0.04} duration={0.4} blur="4px" offset={12} direction="up">
                    <tr className={`border-b ${isDark ? "border-white/10 hover:bg-white/5" : "border-gray-200 hover:bg-gray-50"} transition-colors`}>
                  <td className="py-4 px-6 text-sm" style={{ color: textColors.secondary }}>{formatDate(app.created_at)}</td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0" style={{ background: "linear-gradient(135deg, #14b8a6 0%, #3b82f6 100%)" }}>
                        {getInitials(app.full_name)}
                      </div>
                      <span className="text-sm" style={{ color: textColors.primary }}>{app.email}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-sm font-medium" style={{ color: textColors.primary }}>{app.full_name}</td>
                  <td className="py-4 px-6 text-sm" style={{ color: textColors.secondary }}>{app.phone || "—"}</td>
                  <td className="py-4 px-6 text-sm" style={{ color: textColors.secondary }}>{app.parent_email || "—"}</td>
                  <td className="py-4 px-6 text-sm" style={{ color: textColors.secondary }}>{app.parent_full_name || "—"}</td>
                  <td className="py-4 px-6 text-sm" style={{ color: textColors.primary }}>{app.course_title ? getLocalizedCourseTitle({ title: app.course_title } as any, t) : "—"}</td>
                  <td className="py-4 px-6">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getStatusBadgeColor(app.status)}`}>
                      {statusLabel(app.status)}
                    </span>
                    </td>
                    </tr>
                  </BlurFade>
                ))
              )}
            </tbody>
          </table>
          </div>
          ) : null}
        </div>
      </BlurFade>

      {assignModal && (
        <AssignStudentModal
          student={assignModal}
          onClose={() => setAssignModal(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["admin-students-without-group"] });
            setAssignModal(null);
          }}
        />
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

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="rounded-xl shadow-xl p-6 max-w-md mx-4 border-0 backdrop-blur-xl" style={modalStyle}>
            <h3 className="font-semibold mb-2" style={{ color: textColors.primary }}>
              {t("adminUserDelete")}
            </h3>
            <p className="mb-4" style={{ color: textColors.secondary }}>
              {t("adminUserDeleteConfirm")}
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="py-2 px-4 rounded-lg hover:opacity-90"
                style={{ background: isDark ? "rgba(30, 41, 59, 0.7)" : "rgba(0, 0, 0, 0.05)", border: isDark ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(0, 0, 0, 0.12)", color: textColors.primary }}
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={() => deleteMutation.mutate(deleteConfirm)}
                disabled={deleteMutation.isPending}
                className="py-2 px-4 rounded-lg text-white hover:opacity-90"
                style={{ background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)" }}
              >
                {t("adminDelete")}
              </button>
            </div>
          </div>
        </div>
      )}
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="rounded-xl shadow-xl p-6 max-w-3xl mx-4 w-full border-0 backdrop-blur-xl max-h-[90vh] overflow-y-auto" style={modalStyle}>
        <h3 className="font-semibold mb-4 text-lg" style={{ color: textColors.primary }}>{t("adminAddUserTitle")}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Левая колонка */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: textColors.secondary }}>Email *</label>
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
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
                    className="w-full border-0 rounded-lg px-3 py-2 text-sm md:col-span-2"
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>
          )}

          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-2 justify-end">
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
              disabled={createMutation.isPending}
              className="py-2 px-4 rounded-lg text-white hover:opacity-90"
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
              <dt style={{ color: textColors.secondary }}>Email</dt>
              <dd style={{ color: textColors.primary }}>{user.email}</dd>
              <dt style={{ color: textColors.secondary }}>{t("adminFullName")}</dt>
              <dd style={{ color: textColors.primary }}>{user.full_name}</dd>
              <dt style={{ color: textColors.secondary }}>{t("role")}</dt>
              <dd style={{ color: textColors.primary }}>{user.role}</dd>
              <dt style={{ color: textColors.secondary }}>{t("phone")}</dt>
              <dd style={{ color: textColors.primary }}>{user.phone || "—"}</dd>
              <dt style={{ color: textColors.secondary }}>{t("city")}</dt>
              <dd style={{ color: textColors.primary }}>{user.address || "—"}</dd>
              <dt style={{ color: textColors.secondary }}>{t("date")}</dt>
              <dd style={{ color: textColors.primary }}>{user.birth_date || "—"}</dd>
            </dl>
          </section>

          {parent && (
            <section>
              <h4 className="text-sm font-medium mb-2" style={{ color: "#94A3B8" }}>{t("parentDataSection")}</h4>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <dt style={{ color: textColors.secondary }}>Email</dt>
                <dd style={{ color: textColors.primary }}>{parent.email}</dd>
                <dt style={{ color: textColors.secondary }}>{t("adminFullName")}</dt>
                <dd style={{ color: textColors.primary }}>{parent.full_name}</dd>
                <dt style={{ color: textColors.secondary }}>{t("phone")}</dt>
                <dd style={{ color: textColors.primary }}>{parent.phone || "—"}</dd>
                <dt style={{ color: textColors.secondary }}>{t("city")}</dt>
                <dd style={{ color: textColors.primary }}>{parent.address || "—"}</dd>
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
                      <dt style={{ color: textColors.secondary }}>Email</dt>
                      <dd style={{ color: textColors.primary }}>{app.email}</dd>
                      <dt style={{ color: textColors.secondary }}>{t("adminFullName")}</dt>
                      <dd style={{ color: textColors.primary }}>{app.full_name}</dd>
                      <dt style={{ color: textColors.secondary }}>{t("phone")}</dt>
                      <dd style={{ color: textColors.primary }}>{app.phone || "—"}</dd>
                      <dt style={{ color: textColors.secondary }}>{t("city")}</dt>
                      <dd style={{ color: textColors.primary }}>{app.city || "—"}</dd>
                      <dt style={{ color: textColors.secondary }}>{t("parentEmail")}</dt>
                      <dd style={{ color: textColors.primary }}>{app.parent_email || "—"}</dd>
                      <dt style={{ color: textColors.secondary }}>{t("parentFullName")}</dt>
                      <dd style={{ color: textColors.primary }}>{app.parent_full_name || "—"}</dd>
                      <dt style={{ color: textColors.secondary }}>{t("parentPhone")}</dt>
                      <dd style={{ color: textColors.primary }}>{app.parent_phone || "—"}</dd>
                      <dt style={{ color: textColors.secondary }}>{t("parentCity")}</dt>
                      <dd style={{ color: textColors.primary }}>{app.parent_city || "—"}</dd>
                      <dt style={{ color: textColors.secondary }}>{t("date")}</dt>
                      <dd style={{ color: textColors.primary }}>{app.created_at ? formatDateLocalized(app.created_at, lang) : "—"}</dd>
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
                  Email
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
                  placeholder="https://..."
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
      if (typeof groupId !== "number") throw new Error("Select group");
      const group = groups.find((g) => g.id === groupId);
      if (!group) throw new Error("Group not found");
      await api.post("/admin/add-student-tasks", {
        student_id: student.id,
        teacher_id: group.teacher_id,
        group_id: groupId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-students-without-group"] });
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="rounded-xl shadow-xl p-6 max-w-md mx-4 w-full border-0 backdrop-blur-xl" style={{ background: "rgba(26, 34, 56, 0.95)", backdropFilter: "blur(12px)", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
        <h3 className="font-semibold text-white mb-2">
          {t("adminAssignTitle")}
        </h3>
        <p className="text-sm mb-4" style={{ color: "#94A3B8" }}>
          {student.full_name} ({student.email}) — {getLocalizedCourseTitle({ title: student.course_title } as any, t)}
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "#94A3B8" }}>
              {t("adminAssignGroup")} ({t("adminAssignTeacher")})
            </label>
            <select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value ? Number(e.target.value) : "")}
              className="w-full border-0 rounded-lg px-3 py-2 text-white"
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
          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-4 rounded-lg text-white hover:opacity-90"
              style={{ background: "rgba(30, 41, 59, 0.7)", border: "1px solid rgba(255, 255, 255, 0.1)" }}
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={createTaskMutation.isPending || groupId === ""}
              className="py-2 px-4 rounded-lg text-white hover:opacity-90 disabled:opacity-50"
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
