"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useAuthStore } from "@/store/authStore";
import { useLanguage } from "@/context/LanguageContext";

type SupportTicketItem = {
  id: number;
  status: "open" | "resolved";
  message: string;
  staff_note?: string | null;
  created_at?: string | null;
  resolved_at?: string | null;
  student: { id: number; full_name: string; email: string };
  course?: { id: number; title?: string | null } | null;
};

export default function AdminSupportPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { t } = useLanguage();
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "resolved">("open");
  const [noteDraft, setNoteDraft] = useState<Record<number, string>>({});

  const canAccess = useMemo(
    () => Boolean(user && ["admin", "director", "curator"].includes(user.role)),
    [user]
  );

  useEffect(() => {
    if (user && !canAccess) router.replace("/app/admin");
  }, [user, canAccess, router]);

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["support-tickets", statusFilter],
    queryFn: async () => {
      const q = statusFilter === "all" ? "" : `?status=${statusFilter}`;
      const { data } = await api.get<SupportTicketItem[]>(`/support/tickets${q}`);
      return data;
    },
    enabled: canAccess,
  });

  const updateTicket = useMutation({
    mutationFn: async (payload: { id: number; status: "open" | "resolved"; staff_note?: string }) => {
      await api.patch(`/support/tickets/${payload.id}`, {
        status: payload.status,
        staff_note: payload.staff_note ?? "",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
    },
  });

  if (!user || !canAccess) return null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t("adminNavSupport")}</h1>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "all" | "open" | "resolved")}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        >
          <option value="all">{t("supportFilterAll")}</option>
          <option value="open">{t("supportFilterOpen")}</option>
          <option value="resolved">{t("supportFilterResolved")}</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr className="text-left text-gray-600 dark:text-gray-300">
              <th className="px-4 py-3">{t("supportColStudent")}</th>
              <th className="px-4 py-3">{t("supportColCourse")}</th>
              <th className="px-4 py-3">{t("supportColMessage")}</th>
              <th className="px-4 py-3">{t("supportColStatus")}</th>
              <th className="px-4 py-3">{t("supportColAction")}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td className="px-4 py-6 text-gray-500 dark:text-gray-400" colSpan={5}>
                  {t("loading")}
                </td>
              </tr>
            )}
            {!isLoading && tickets.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-gray-500 dark:text-gray-400" colSpan={5}>
                  {t("supportEmpty")}
                </td>
              </tr>
            )}
            {tickets.map((ticket) => {
              const currentDraft = noteDraft[ticket.id] ?? ticket.staff_note ?? "";
              return (
                <tr key={ticket.id} className="border-t border-gray-100 align-top dark:border-gray-800">
                  <td className="px-4 py-3 max-w-[220px]">
                    <div className="font-medium text-gray-900 dark:text-gray-100 truncate" title={ticket.student.full_name || ticket.student.email}>
                      {ticket.student.full_name || ticket.student.email}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate" title={ticket.student.email}>{ticket.student.email}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300 max-w-[220px]">
                    <span className="block truncate" title={ticket.course?.title || t("supportNoCourse")}>
                    {ticket.course?.title || t("supportNoCourse")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                    <p className="whitespace-pre-wrap">{ticket.message}</p>
                    <textarea
                      value={currentDraft}
                      onChange={(e) =>
                        setNoteDraft((prev) => ({ ...prev, [ticket.id]: e.target.value }))
                      }
                      placeholder={t("supportStaffNotePlaceholder")}
                      className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                      rows={3}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                        ticket.status === "resolved"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                      }`}
                    >
                      {ticket.status === "resolved" ? t("supportFilterResolved") : t("supportFilterOpen")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {ticket.status === "open" ? (
                      <button
                        type="button"
                        onClick={() =>
                          updateTicket.mutate({
                            id: ticket.id,
                            status: "resolved",
                            staff_note: currentDraft,
                          })
                        }
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        {t("supportMarkResolved")}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          updateTicket.mutate({
                            id: ticket.id,
                            status: "open",
                            staff_note: currentDraft,
                          })
                        }
                        className="rounded-lg bg-gray-600 px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        {t("supportReopen")}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
