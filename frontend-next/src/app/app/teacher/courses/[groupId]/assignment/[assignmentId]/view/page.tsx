"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useLanguage } from "@/context/LanguageContext";
import { formatLocalizedDate } from "@/utils/dateUtils";
import { ArrowLeft, ExternalLink } from "lucide-react";

type RubricCriterion = {
  id: number;
  name: string;
  max_points: number;
};

type RubricGrade = { criterion_id: number; points: number };

type Submission = {
  id: number | null;
  student_id: number;
  student_name: string;
  submission_text: string | null;
  file_url: string | null;
  file_urls: string[];
  grade: number | null;
  teacher_comment: string | null;
  rubric_grades: RubricGrade[];
  status: "graded" | "pending" | "not_submitted";
};

type AssignmentDetails = {
  title: string;
  max_points: number;
  deadline: string | null;
};

export default function AssignmentFileViewerPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { t, lang } = useLanguage();

  const assignmentId = Number(params.assignmentId);
  const groupId = Number(params.groupId);
  const studentIdParam = searchParams.get("studentId");
  const fileIndexParam = searchParams.get("fileIndex");
  const queryStudentId = studentIdParam != null ? Number(studentIdParam) : null;
  const queryFileIndex = fileIndexParam != null ? Number(fileIndexParam) : null;

  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [gradeInput, setGradeInput] = useState("");
  const [lastAutoSum, setLastAutoSum] = useState<string>("");
  const [privateComment, setPrivateComment] = useState("");
  const [rubricInputs, setRubricInputs] = useState<Record<number, string>>({});
  const [hasAppliedQuerySelection, setHasAppliedQuerySelection] = useState(false);
  const [hasAppliedQueryFile, setHasAppliedQueryFile] = useState(false);
  const [isBootstrappingSubmission, setIsBootstrappingSubmission] = useState(false);

  const submissionsQuery = useQuery({
    queryKey: ["assignment-submissions", assignmentId],
    queryFn: async () => {
      const { data } = await api.get<{ submissions: Submission[]; rubric: RubricCriterion[]; assignment: AssignmentDetails }>(
        `/teacher/assignments/${assignmentId}/submissions`
      );
      return data;
    },
    enabled: Number.isFinite(assignmentId),
  });

  const submissions = submissionsQuery.data?.submissions ?? [];
  const rubric = submissionsQuery.data?.rubric ?? [];
  const assignment = submissionsQuery.data?.assignment;
  const selectedSubmission = useMemo(
    () => submissions.find((s) => s.student_id === selectedStudentId) ?? null,
    [submissions, selectedStudentId]
  );

  useEffect(() => {
    if (hasAppliedQuerySelection || submissions.length === 0) return;
    if (queryStudentId != null && Number.isFinite(queryStudentId)) {
      const match = submissions.find((s) => s.student_id === queryStudentId);
      if (match) {
        setSelectedStudentId(match.student_id);
        setHasAppliedQuerySelection(true);
        return;
      }
    }
    setSelectedStudentId(submissions[0].student_id);
    setHasAppliedQuerySelection(true);
  }, [hasAppliedQuerySelection, submissions, queryStudentId]);

  useEffect(() => {
    if (!selectedSubmission) return;
    setGradeInput(selectedSubmission.grade != null ? String(selectedSubmission.grade) : "");
    setPrivateComment(selectedSubmission.teacher_comment ?? "");
    const next: Record<number, string> = {};
    rubric.forEach((c) => {
      const rg = selectedSubmission.rubric_grades.find((g) => g.criterion_id === c.id);
      next[c.id] = rg ? String(rg.points) : "";
    });
    setRubricInputs(next);
    setLastAutoSum(selectedSubmission.grade != null ? String(selectedSubmission.grade) : "");
    const files = [
      ...(selectedSubmission.file_url ? [selectedSubmission.file_url] : []),
      ...(selectedSubmission.file_urls ?? []),
    ];
    if (!hasAppliedQueryFile && queryFileIndex != null && Number.isFinite(queryFileIndex)) {
      const idx = Math.trunc(queryFileIndex);
      setSelectedFileIndex(idx >= 0 && idx < files.length ? idx : 0);
      setHasAppliedQueryFile(true);
      return;
    }
    setSelectedFileIndex(0);
  }, [selectedSubmission, rubric, hasAppliedQueryFile, queryFileIndex]);

  // Auto-calculate grade from rubric
  useEffect(() => {
    if (rubric.length === 0) return;
    const sum = Object.values(rubricInputs).reduce((acc, val) => {
      const n = parseFloat(val);
      return acc + (Number.isFinite(n) ? n : 0);
    }, 0);

    const roundedSum = String(Math.round(sum * 100) / 100);

    // Only update gradeInput if it matches lastAutoSum (meaning it's in sync)
    // or if the gradeInput is empty.
    if (sum > 0 || Object.keys(rubricInputs).length > 0) {
      if (gradeInput === "" || gradeInput === lastAutoSum) {
        setGradeInput(roundedSum);
        setLastAutoSum(roundedSum);
      }
    }
  }, [rubricInputs, rubric.length, lastAutoSum]);

  const selectedFiles = selectedSubmission
    ? [...(selectedSubmission.file_url ? [selectedSubmission.file_url] : []), ...(selectedSubmission.file_urls ?? [])]
    : [];
  const activeFile = selectedFiles[selectedFileIndex] ?? null;
  const normalizedActiveFile = activeFile
    ? activeFile.startsWith("http://") || activeFile.startsWith("https://")
      ? activeFile
      : `${window.location.origin}${activeFile.startsWith("/") ? "" : "/"}${activeFile}`
    : null;
  const activeFileExt = normalizedActiveFile?.split("?")[0].split(".").pop()?.toLowerCase() ?? "";
  const isPdf = activeFileExt === "pdf";
  const isImage = ["png", "jpg", "jpeg", "gif", "webp", "bmp"].includes(activeFileExt);
  const isOfficeDoc = ["doc", "docx", "ppt", "pptx", "xls", "xlsx", "odt", "ods", "odp"].includes(activeFileExt);
  const googleViewerUrl = normalizedActiveFile
    ? `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(normalizedActiveFile)}`
    : null;
  const maxPoints = assignment?.max_points ?? 100;

  const saveDraftMutation = useMutation({
    mutationFn: async ({ subId, grade, teacherComment, grades }: { subId: number; grade?: number; teacherComment: string; grades?: RubricGrade[] }) => {
      await api.put(`/teacher/submissions/${subId}`, {
        grade,
        teacher_comment: teacherComment,
        grades,
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["assignment-submissions", assignmentId] }),
  });

  const returnMutation = useMutation({
    mutationFn: async ({ subId, grade, teacherComment, grades }: { subId: number; grade?: number; teacherComment: string; grades?: RubricGrade[] }) => {
      await api.post(`/teacher/submissions/${subId}/return`, {
        grade,
        teacher_comment: teacherComment,
        grades,
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["assignment-submissions", assignmentId] }),
  });

  const deadline = assignment?.deadline ? new Date(assignment.deadline) : null;
  const isOverdue = deadline ? deadline < new Date() : false;
  const canGradeAbsentNoRow =
    !!selectedSubmission &&
    selectedSubmission.status === "not_submitted" &&
    isOverdue &&
    selectedSubmission.id == null;
  const canSaveOrReturn =
    !!selectedSubmission &&
    (selectedSubmission.id != null || canGradeAbsentNoRow) &&
    !(selectedSubmission.status === "not_submitted" && !isOverdue);
  const isBusy = saveDraftMutation.isPending || returnMutation.isPending || isBootstrappingSubmission;

  const buildPayload = (subId: number) => {
    const grades: RubricGrade[] | undefined =
      rubric.length > 0
        ? rubric.map((c) => ({
            criterion_id: c.id,
            points: parseFloat(rubricInputs[c.id] ?? "0") || 0,
          }))
        : undefined;
    const grade = gradeInput.trim() !== "" ? Number(gradeInput) : undefined;
    return { subId, grade, teacherComment: privateComment, grades };
  };

  const resolveSubmissionIdForGrade = async (): Promise<number | null> => {
    if (!selectedSubmission) return null;
    if (selectedSubmission.id != null) return selectedSubmission.id;
    if (!(selectedSubmission.status === "not_submitted" && isOverdue)) return null;
    const { data } = await api.post<{ id: number }>(
      `/teacher/assignments/${assignmentId}/submissions/bootstrap-absent`,
      { student_id: selectedSubmission.student_id }
    );
    await queryClient.invalidateQueries({ queryKey: ["assignment-submissions", assignmentId] });
    return data.id;
  };

  if (submissionsQuery.isPending) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--qit-primary)] border-t-transparent" />
      </div>
    );
  }

  if (!assignment || submissionsQuery.isError) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <button
          type="button"
          className="rounded-lg bg-[var(--qit-primary)] px-4 py-2 text-sm text-white"
          onClick={() => router.push(`/app/teacher/courses/${groupId}/assignment/${assignmentId}?tab=student-work`)}
        >
          {t("teacherBack")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-10rem)] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="rounded-full p-2 hover:bg-gray-100 dark:hover:bg-gray-800"
            onClick={() => router.push(`/app/teacher/courses/${groupId}/assignment/${assignmentId}?tab=student-work`)}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <p className="text-sm font-semibold">{assignment.title}</p>
            <p className="text-xs text-gray-500">{selectedSubmission?.student_name ?? t("teacherPickStudent")}</p>
          </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[1fr_360px]">
        <main className="min-h-0 overflow-y-auto bg-gray-100 p-4 dark:bg-gray-950">
          {selectedSubmission?.status === "not_submitted" ? (
            isOverdue ? (
              <div className="mb-3 rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 text-sm text-blue-900 shadow-sm dark:border-blue-800/40 dark:from-blue-950/30 dark:to-indigo-950/10 dark:text-blue-200">
                {t("teacherAssignmentOverdueGradingHint")}
              </div>
            ) : (
              <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-200">
                {t("teacherAssignmentNotSubmittedWarning")}
                {assignment?.deadline ? (
                  <span className="mt-1 block text-xs opacity-90">
                    {t("teacherAssignmentDue")} {formatLocalizedDate(assignment.deadline, lang as any, t, { includeTime: true })}
                  </span>
                ) : null}
              </div>
            )
          ) : null}
          {selectedFiles.length > 0 ? (
            <div className="mb-3 grid gap-2 sm:grid-cols-2">
              {selectedFiles.map((u, i) => (
                <button
                  key={`${u}-${i}`}
                  type="button"
                  onClick={() => setSelectedFileIndex(i)}
                  className={`rounded-xl border px-3 py-2 text-left ${i === selectedFileIndex ? "border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30" : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"}`}
                >
                  <p className="truncate text-sm font-medium">{u.split("/").pop()?.split("?")[0] || t("teacherGradingFileFallback").replace("{n}", String(i + 1))}</p>
                </button>
              ))}
            </div>
          ) : null}

          {!normalizedActiveFile ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900">
              {t("teacherGradingNoFilesAttached")}
            </div>
          ) : isPdf ? (
            <iframe src={normalizedActiveFile} className="h-[72vh] w-full rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900" title={t("teacherFilePreview")} />
          ) : isImage ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
              <img src={normalizedActiveFile} alt={t("teacherFilePreview")} className="mx-auto max-h-[72vh] max-w-full rounded-lg" />
            </div>
          ) : isOfficeDoc ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-900">
              <p className="text-sm text-gray-500">
                {t("teacherFilePreviewUnavailable")}
              </p>
              <div className="mt-3 flex items-center justify-center gap-4">
                <a
                  href={normalizedActiveFile}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-[var(--qit-primary)] hover:underline"
                >
                  <ExternalLink className="h-4 w-4" />
                  {t("teacherOpenFile")}
                </a>
                <a
                  href={normalizedActiveFile}
                  download
                  className="text-sm text-[var(--qit-primary)] hover:underline"
                >
                  {t("teacherDownloadFile")}
                </a>
              </div>
              {googleViewerUrl ? (
                <a
                  href={googleViewerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-block text-xs text-gray-500 hover:underline dark:text-gray-400"
                >
                  {t("teacherTryGoogleDocsViewer")}
                </a>
              ) : null}
            </div>
          ) : (
            <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-900">
              <p className="text-sm text-gray-500">{t("teacherAssignmentPreviewLimited")}</p>
              <div className="mt-3 flex items-center justify-center gap-4">
                <a href={normalizedActiveFile} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-[var(--qit-primary)] hover:underline">
                  <ExternalLink className="h-4 w-4" />
                  {t("teacherAssignmentDownloadOpen")}
                </a>
                {googleViewerUrl ? (
                  <a
                    href={googleViewerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-[var(--qit-primary)] hover:underline"
                  >
                    {t("teacherGoogleDocsViewer")}
                  </a>
                ) : null}
              </div>
            </div>
          )}
        </main>

        <aside className="min-h-0 overflow-y-auto border-l border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <div className="space-y-4">
            <section>
              <h3 className="mb-2 text-sm font-semibold">{t("teacherGradingGrade")}</h3>
              <input
                type="number"
                value={gradeInput}
                onChange={(e) => setGradeInput(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
                placeholder={t("teacherAssignmentGradePlaceholderShort").replace("{max}", String(maxPoints))}
              />
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold">{t("teacherAssignmentCriteriaHeading")}</h3>
              {rubric.length === 0 ? (
                <p className="text-xs text-gray-500 dark:text-gray-400">{t("teacherAssignmentRubricEmpty")}</p>
              ) : (
                <div className="space-y-2">
                  {rubric.map((c) => (
                    <div key={c.id} className="rounded-lg bg-gray-50 p-2 dark:bg-gray-800">
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="truncate">{c.name}</span>
                        <span>{c.max_points}</span>
                      </div>
                      <input
                        type="number"
                        min={0}
                        max={c.max_points}
                        step="any"
                        value={rubricInputs[c.id] ?? ""}
                        onChange={(e) => setRubricInputs((prev) => ({ ...prev, [c.id]: e.target.value }))}
                        className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
                      />
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold">{t("teacherAssignmentFeedbackTitle")}</h3>
              <textarea
                rows={5}
                value={privateComment}
                onChange={(e) => setPrivateComment(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
                placeholder={t("teacherAssignmentTeacherWorkCommentPh")}
              />
            </section>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                className="w-full rounded-lg bg-[var(--qit-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                disabled={!canSaveOrReturn || isBusy}
                onClick={async () => {
                  if (!selectedSubmission) return;
                  let subId = selectedSubmission.id;
                  if (subId == null && selectedSubmission.status === "not_submitted" && isOverdue) {
                    setIsBootstrappingSubmission(true);
                    try {
                      subId = await resolveSubmissionIdForGrade();
                    } catch {
                      setIsBootstrappingSubmission(false);
                      return;
                    }
                    setIsBootstrappingSubmission(false);
                  }
                  if (subId == null) return;
                  saveDraftMutation.mutate(buildPayload(subId));
                }}
              >
                {isBusy ? t("teacherSaving") : t("save")}
              </button>
              <button
                type="button"
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-600"
                disabled={!canSaveOrReturn || isBusy}
                onClick={async () => {
                  if (!selectedSubmission) return;
                  let subId = selectedSubmission.id;
                  if (subId == null && selectedSubmission.status === "not_submitted" && isOverdue) {
                    setIsBootstrappingSubmission(true);
                    try {
                      subId = await resolveSubmissionIdForGrade();
                    } catch {
                      setIsBootstrappingSubmission(false);
                      return;
                    }
                    setIsBootstrappingSubmission(false);
                  }
                  if (subId == null) return;
                  returnMutation.mutate(buildPayload(subId));
                }}
              >
                {t("teacherGradingReturn")}
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
