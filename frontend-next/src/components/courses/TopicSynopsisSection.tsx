"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Loader2, Pencil, Trash2, Upload } from "lucide-react";
import { api } from "@/api/client";
import { useLanguage } from "@/context/LanguageContext";

type Props = {
  topicId: number;
  userId: number | undefined;
};

export function TopicSynopsisSection({ topicId, userId }: Props) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [noteText, setNoteText] = useState("");
  const [replaceTargetId, setReplaceTargetId] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const { data: synopsis, isLoading } = useQuery({
    queryKey: ["topic-synopsis", topicId],
    queryFn: async () => {
      const { data } = await api.get<{
        exists: boolean;
        files: Array<{
          id: number;
          file_url: string;
          submitted_at: string | null;
          updated_at: string | null;
        }>;
        note_text: string | null;
        max_files: number;
      }>(`/topics/${topicId}/synopsis`);
      return data;
    },
    enabled: !!topicId && userId != null,
  });

  useEffect(() => {
    setNoteText(synopsis?.note_text ?? "");
  }, [synopsis?.note_text, synopsis?.exists]);

  const listQueryKey = ["topic-synopsis", topicId] as const;
  const refreshList = () => {
    queryClient.invalidateQueries({ queryKey: listQueryKey });
    queryClient.invalidateQueries({ queryKey: ["topic-flow", topicId] });
  };

  const addFileMut = useMutation({
    mutationFn: async (fileUrl: string) => {
      await api.post(`/topics/${topicId}/synopsis`, { file_url: fileUrl });
    },
    onSuccess: () => {
      setInfo(t("topicFlowSynopsisSaved"));
      setErr(null);
      refreshList();
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setErr(typeof msg === "string" ? msg : t("topicFlowSynopsisUploadError"));
    },
  });

  const replaceFileMut = useMutation({
    mutationFn: async ({ synopsisId, fileUrl }: { synopsisId: number; fileUrl: string }) => {
      await api.put(`/topics/${topicId}/synopsis/${synopsisId}`, { file_url: fileUrl });
    },
    onSuccess: () => {
      setReplaceTargetId(null);
      setInfo(t("topicFlowSynopsisSaved"));
      setErr(null);
      refreshList();
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setErr(typeof msg === "string" ? msg : t("topicFlowSynopsisSaveError"));
    },
  });

  const deleteFileMut = useMutation({
    mutationFn: async (synopsisId: number) => {
      await api.delete(`/topics/${topicId}/synopsis/${synopsisId}`);
    },
    onSuccess: () => {
      setInfo(t("topicFlowSynopsisSaved"));
      setErr(null);
      refreshList();
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setErr(typeof msg === "string" ? msg : t("topicFlowSynopsisSaveError"));
    },
  });

  const saveNoteMut = useMutation({
    mutationFn: async () => {
      await api.post(`/topics/${topicId}/synopsis/note`, { note_text: noteText.trim() || null });
    },
    onSuccess: () => {
      setInfo(t("topicFlowSynopsisSaved"));
      setErr(null);
      refreshList();
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setErr(typeof msg === "string" ? msg : t("topicFlowSynopsisSaveError"));
    },
  });

  const uploadMut = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post<{ url: string }>(`/topics/${topicId}/synopsis/upload`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data.url;
    },
    onSuccess: (url) => {
      setErr(null);
      if (replaceTargetId != null) {
        replaceFileMut.mutate({ synopsisId: replaceTargetId, fileUrl: url });
      } else {
        addFileMut.mutate(url);
      }
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setErr(typeof msg === "string" ? msg : t("topicFlowSynopsisUploadError"));
    },
  });

  if (isLoading) {
    return (
      <div className="mb-6 flex items-center gap-2 text-gray-500 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        {t("loading")}
      </div>
    );
  }

  const files = synopsis?.files ?? [];
  const maxFiles = synopsis?.max_files ?? 5;
  const done = synopsis?.exists === true;
  const isBusy =
    uploadMut.isPending ||
    addFileMut.isPending ||
    replaceFileMut.isPending ||
    deleteFileMut.isPending ||
    saveNoteMut.isPending;

  const handleChoose = (forReplaceId: number | null) => {
    setReplaceTargetId(forReplaceId);
    fileRef.current?.click();
  };

  const canAddMore = files.length < maxFiles;
  const showAddButton = canAddMore || replaceTargetId != null;

  const fileNameOf = (url: string) => {
    const clean = url.split("?")[0];
    return clean.split("/").pop() || url;
  };

  const normalizeFileHref = (url: string) => (url.startsWith("/") ? url : `/uploads/${url}`);

  return (
    <div className="mb-6 p-4 rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50/80 dark:bg-teal-900/20">
      <div className="flex items-center gap-2 mb-3">
        <FileText className="w-5 h-5 text-teal-600 dark:text-teal-400" />
        <h3 className="font-semibold text-gray-900 dark:text-white">{t("topicFlowSynopsisTitle")}</h3>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">{t("topicFlowSynopsisHint")}</p>

      <input
        ref={fileRef}
        type="file"
        className="hidden"
        accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.gif,.webp"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) uploadMut.mutate(f);
          e.target.value = "";
          setReplaceTargetId(null);
        }}
      />

      <div className="mb-3 flex items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
        <span>
          {t("topicFlowSynopsisFilesCount")
            .replace("{count}", String(files.length))
            .replace("{max}", String(maxFiles))}
        </span>
        {showAddButton ? (
          <button
            type="button"
            disabled={isBusy || !canAddMore}
            onClick={() => handleChoose(null)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-teal-300 px-3 py-1.5 font-medium text-teal-800 hover:bg-teal-100/50 disabled:opacity-50 dark:border-teal-700 dark:text-teal-200 dark:hover:bg-teal-900/40"
          >
            <Upload className="h-3.5 w-3.5" />
            {uploadMut.isPending ? t("topicFlowSynopsisUploading") : t("topicFlowChooseFile")}
          </button>
        ) : null}
      </div>

      {files.length > 0 ? (
        <ul className="mb-3 space-y-2">
          {files.map((file) => (
            <li
              key={file.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-teal-200 bg-white/60 px-3 py-2 text-sm dark:border-teal-800 dark:bg-teal-950/20"
            >
              <a
                href={normalizeFileHref(file.file_url)}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 flex-1 truncate font-medium text-teal-700 hover:underline dark:text-teal-300"
              >
                {fileNameOf(file.file_url)}
              </a>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleChoose(file.id)}
                  disabled={isBusy}
                  className="rounded-md p-1.5 text-gray-500 hover:bg-teal-100 hover:text-teal-700 disabled:opacity-50 dark:hover:bg-teal-900/40 dark:hover:text-teal-200"
                  title={t("topicFlowSynopsisReplace")}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => deleteFileMut.mutate(file.id)}
                  disabled={isBusy}
                  className="rounded-md p-1.5 text-gray-500 hover:bg-red-100 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-900/40 dark:hover:text-red-300"
                  title={t("delete")}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">{t("topicFlowSynopsisNoFiles")}</p>
      )}

      <textarea
        value={noteText}
        onChange={(e) => setNoteText(e.target.value)}
        placeholder={t("topicFlowSynopsisNotePlaceholder")}
        rows={2}
        disabled={files.length === 0}
        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm mb-3 disabled:opacity-50"
      />

      {files.length > 0 && (
        <button
          type="button"
          disabled={saveNoteMut.isPending}
          onClick={() => saveNoteMut.mutate()}
          className="py-2 px-4 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: "var(--qit-primary)" }}
        >
          {saveNoteMut.isPending ? t("topicFlowSynopsisUploading") : t("topicFlowSynopsisSave")}
        </button>
      )}

      {done && (
        <p className="mt-2 text-sm text-green-600 dark:text-green-400">{t("topicFlowSynopsisSaved")}</p>
      )}
      {info && <p className="mt-2 text-sm text-green-600 dark:text-green-400">{info}</p>}
      {err && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{err}</p>}
    </div>
  );
}
