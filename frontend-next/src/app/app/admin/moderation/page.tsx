"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { ShieldCheck } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";

interface UnmoderatedCourse {
  id: number;
  title: string;
  description: string | null;
  is_active: boolean;
}

export default function ModerationPage() {
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const { data: courses = [] } = useQuery({
    queryKey: ["admin-moderation-courses"],
    queryFn: async () => {
      const { data } = await api.get<UnmoderatedCourse[]>("/admin/moderation/courses");
      return data;
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.patch(`/admin/courses/${id}`, { is_moderated: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-moderation-courses"] });
      queryClient.invalidateQueries({ queryKey: ["admin-courses"] });
    },
  });

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
        <ShieldCheck className="w-8 h-8 text-blue-600 dark:text-blue-400" /> {t("adminModerationTitle")}
      </h1>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        {t("adminModerationDescription")}
      </p>
      {courses.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 dark:border-white/10 backdrop-blur-xl p-16 text-center bg-white/80 dark:bg-[rgba(30,41,59,0.6)] shadow-lg dark:shadow-xl" style={{ boxShadow: isDark ? "0 8px 32px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05)" : "0 4px 16px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.05)" }}>
          <div className="w-24 h-24 mx-auto mb-6 rounded-full flex items-center justify-center bg-blue-100 dark:bg-[rgba(59,130,246,0.2)]">
            <ShieldCheck className="w-12 h-12 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {t("adminModerationEmptyTitle")}
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            {t("adminModerationEmptyDescription")}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {courses.map((c) => (
            <div
              key={c.id}
              className="rounded-2xl p-6 flex items-center justify-between gap-4 border border-gray-200 dark:border-white/10 backdrop-blur-xl transition-all duration-300 hover:border-gray-300 dark:hover:border-white/20 bg-white/80 dark:bg-[rgba(30,41,59,0.6)] shadow-lg dark:shadow-xl"
              style={{ boxShadow: isDark ? "0 8px 32px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05)" : "0 4px 16px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.05)" }}
            >
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 dark:text-white text-lg mb-2">{c.title}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-1 mb-2">
                  {c.description || "—"}
                </p>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 dark:text-gray-500">ID: {c.id}</span>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${
                    c.is_active 
                      ? "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300 border-green-300 dark:border-green-500/30" 
                      : "bg-gray-100 dark:bg-gray-500/20 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-500/30"
                  }`}>
                    {c.is_active ? t("adminActive") : t("adminInactive")}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => approveMutation.mutate(c.id)}
                disabled={approveMutation.isPending}
                className="py-3 px-6 rounded-xl bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 shrink-0 transition-all font-medium shadow-lg shadow-green-500/30 hover:shadow-green-500/40"
              >
                {t("adminModerationApprove")}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
