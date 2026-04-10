"use client";

import React, { useState } from "react";
import { X, Search, UserPlus, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "@/store/notificationStore";

interface Teacher {
  id: number;
  full_name: string;
  email: string;
}

interface InviteTeacherModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: number;
}

const InviteTeacherModal: React.FC<InviteTeacherModalProps> = ({
  isOpen,
  onClose,
  groupId,
}) => {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: searchResults = [], isLoading: isSearching } = useQuery<Teacher[]>({
    queryKey: ["teacher-search", searchQuery, groupId],
    queryFn: async () => {
      let url = `/teacher/search-teachers?group_id=${groupId}`;
      if (searchQuery && searchQuery.length >= 2) {
        url += `&query=${encodeURIComponent(searchQuery)}`;
      }
      const { data } = await api.get(url);
      return data;
    },
    enabled: isOpen,
  });

  const inviteMutation = useMutation({
    mutationFn: async (teacherId: number) => {
      await api.post(`/teacher/groups/${groupId}/teachers`, { teacher_id: teacherId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-teachers", groupId] });
      // We don't automatically close so they can add multiple teachers if they want
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || t("errorInviteTeacher"));
    },
  });

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4 max-h-[80vh] flex flex-col animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-500 text-white">
              <UserPlus className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {t("inviteTeacher")}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm outline-none focus:ring-2 focus:ring-blue-500/40"
            placeholder={t("teacherSearchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
        </div>

        <div className="flex-1 overflow-y-auto min-h-[200px]">
          {isSearching ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            </div>
          ) : searchResults.length > 0 ? (
            <ul className="space-y-1">
              {searchResults.map((teacher) => (
                <li
                  key={teacher.id}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xs shrink-0">
                      {(teacher.full_name || teacher.email).charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {teacher.full_name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {teacher.email}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => inviteMutation.mutate(teacher.id)}
                    disabled={inviteMutation.isPending}
                    className="p-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50 transition-all"
                  >
                    {inviteMutation.variables === teacher.id && inviteMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <UserPlus className="w-4 h-4" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="py-10 text-center text-sm text-gray-500">
              {t("noResults")}
            </div>
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            {t("close")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default InviteTeacherModal;
