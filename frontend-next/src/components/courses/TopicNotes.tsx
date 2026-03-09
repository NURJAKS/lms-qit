"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Save, Trash2, Loader2 } from "lucide-react";
import { api } from "@/api/client";
import { useLanguage } from "@/context/LanguageContext";
import { useAuthStore } from "@/store/authStore";

interface TopicNotesProps {
  topicId: number;
}

export function TopicNotes({ topicId }: TopicNotesProps) {
  const { t } = useLanguage();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [noteText, setNoteText] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const isPremium = user?.is_premium === 1;

  const { data: noteData, isLoading } = useQuery({
    queryKey: ["topic-note", topicId],
    queryFn: async () => {
      const { data } = await api.get<{ note_text: string; exists: boolean }>(`/topics/${topicId}/note`);
      return data;
    },
    enabled: isPremium && !!topicId,
  });

  useEffect(() => {
    if (noteData) {
      setNoteText(noteData.note_text || "");
      setIsEditing(false);
      setHasChanges(false);
    }
  }, [noteData]);

  const saveMutation = useMutation({
    mutationFn: async (text: string) => {
      const { data } = await api.post<{ note_text: string }>(`/topics/${topicId}/note`, {
        note_text: text,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["topic-note", topicId] });
      setIsEditing(false);
      setHasChanges(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/topics/${topicId}/note`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["topic-note", topicId] });
      setNoteText("");
      setIsEditing(false);
      setHasChanges(false);
    },
  });

  const handleSave = () => {
    if (noteText.trim()) {
      saveMutation.mutate(noteText.trim());
    }
  };

  const handleDelete = () => {
    if (confirm(t("topicNotesDeleteConfirm"))) {
      deleteMutation.mutate();
    }
  };

  const handleTextChange = (value: string) => {
    setNoteText(value);
    setHasChanges(value !== (noteData?.note_text || ""));
    setIsEditing(true);
  };

  if (!isPremium) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">{t("loading")}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
      <div className="flex items-center gap-2 mb-3">
        <FileText className="w-5 h-5 text-purple-600 dark:text-purple-400" />
        <h3 className="font-semibold text-gray-900 dark:text-white">
          {t("topicNotesTitle")}
        </h3>
      </div>
      
      <textarea
        value={noteText}
        onChange={(e) => handleTextChange(e.target.value)}
        placeholder={t("topicNotesPlaceholder")}
        rows={4}
        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none text-sm"
      />
      
      <div className="flex items-center justify-between mt-3">
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {noteData?.exists ? (
            <span>{t("topicNotesLastSaved")}</span>
          ) : (
            <span>{t("topicNotesNew")}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {noteData?.exists && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              {t("topicNotesDelete")}
            </button>
          )}
          {hasChanges && (
            <button
              type="button"
              onClick={handleSave}
              disabled={saveMutation.isPending || !noteText.trim()}
              className="px-4 py-1.5 rounded-lg text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t("saving")}
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {t("topicNotesSave")}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
