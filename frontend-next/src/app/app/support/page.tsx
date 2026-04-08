"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useLanguage } from "@/context/LanguageContext";
import { useAuthStore } from "@/store/authStore";
import { MessageCircle, Send, CheckCircle2, AlertCircle, Loader2, BookOpen, Activity } from "lucide-react";
import type { Course } from "@/types";

type SupportTicketItem = {
  id: number;
  status: "open" | "resolved";
  message: string;
  staff_note?: string | null;
  created_at?: string | null;
  resolved_at?: string | null;
  course?: { id: number; title?: string | null } | null;
};

export default function StudentSupportPage() {
  const { t } = useLanguage();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState<number | "">("");

  // Fetch student's enrollments to allow linking a ticket to a course
  const { data: enrollments = [] } = useQuery({
    queryKey: ["my-enrollments", user?.id],
    queryFn: async () => {
      const { data } = await api.get<Array<{ course_id: number; course: Course }>>("/courses/my/enrollments");
      return data;
    },
    enabled: !!user?.id,
  });

  // Optional: Fetch student's own tickets if backend supports it
  const { data: myTickets = [], isLoading: isLoadingTickets } = useQuery({
    queryKey: ["my-support-tickets"],
    queryFn: async () => {
      const { data } = await api.get<SupportTicketItem[]>("/support/tickets");
      return data;
    },
    enabled: !!user?.id,
  });

  const sendTicket = useMutation({
    mutationFn: async (payload: { message: string; course_id?: number }) => {
      await api.post("/support/tickets", payload);
    },
    onSuccess: () => {
      setMessage("");
      setSelectedCourseId("");
      queryClient.invalidateQueries({ queryKey: ["my-support-tickets"] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    sendTicket.mutate({
      message: message.trim(),
      course_id: selectedCourseId === "" ? undefined : selectedCourseId,
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <MessageCircle className="w-8 h-8 text-[var(--qit-primary)]" />
          {t("studentSupportTitle")}
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          {t("studentSupportDescription")}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form Section */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-xl border border-gray-100 dark:border-gray-700">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  {t("supportColCourse")} ({t("teacherDeadlineOptional")})
                </label>
                <div className="relative">
                  <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <select
                    value={selectedCourseId}
                    onChange={(e) => setSelectedCourseId(e.target.value ? Number(e.target.value) : "")}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-[var(--qit-primary)] transition-all appearance-none"
                  >
                    <option value="">{t("supportNoCourse")}</option>
                    {enrollments.map((e) => (
                      <option key={e.course_id} value={e.course_id}>
                        {e.course.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  {t("supportColMessage")}
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={t("supportTicketPlaceholder")}
                  rows={6}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-[var(--qit-primary)] transition-all resize-none"
                  required
                />
              </div>

              {sendTicket.isSuccess && (
                <div className="flex items-center gap-2 p-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-xl border border-emerald-100 dark:border-emerald-800/30">
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                  <p className="text-sm font-medium">{t("supportTicketSent")}</p>
                </div>
              )}

              {sendTicket.isError && (
                <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-xl border border-red-100 dark:border-red-800/30">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p className="text-sm font-medium">{t("error")}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={sendTicket.isPending || !message.trim()}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-[#FF4181] to-[#B938EB] text-white font-bold shadow-lg shadow-[#FF4181]/30 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2"
              >
                {sendTicket.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
                {t("supportSend")}
              </button>
            </form>
          </div>
        </div>

        {/* Info / Recent Tickets Section */}
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-[var(--qit-primary)] to-[var(--qit-secondary)] rounded-3xl p-6 text-white shadow-xl">
            <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              {t("adminQuickActions")}
            </h3>
            <p className="text-sm text-white/80 leading-relaxed">
              {t("managerWillContact")} {t("checkNotifications")}
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-xl border border-gray-100 dark:border-gray-700">
            <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-gray-400" />
              {t("history")}
            </h3>
            
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {isLoadingTickets && (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              )}
              
              {!isLoadingTickets && myTickets.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">
                  {t("supportEmpty")}
                </p>
              )}

              {myTickets.map((ticket) => (
                <div key={ticket.id} className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                      ticket.status === "resolved" 
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" 
                        : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    }`}>
                      {ticket.status === "resolved" ? t("supportFilterResolved") : t("supportFilterOpen")}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {ticket.created_at ? new Date(ticket.created_at).toLocaleDateString() : ""}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
                    {ticket.message}
                  </p>
                  {ticket.staff_note && (
                    <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                      <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">{t("reviewAdminResponse")}</p>
                      <p className="text-xs text-blue-600 dark:text-blue-400 italic">
                        {ticket.staff_note}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
