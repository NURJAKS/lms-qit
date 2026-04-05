"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useAuthStore } from "@/store/authStore";
import { useLanguage } from "@/context/LanguageContext";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronLeft,
  FileText,
  Mail,
  Paperclip,
  Send,
  Settings,
} from "lucide-react";

type RubricCriterion = {
  id: number;
  name: string;
  max_points: number;
  description?: string;
  levels?: { text: string; points: number }[];
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
  student_private_comment: string | null;
  submitted_at: string | null;
  rubric_grades: RubricGrade[];
  status: "graded" | "pending" | "not_submitted";
};

type AssignmentDetails = {
  id: number;
  title: string;
  description: string;
  max_points: number;
  deadline: string | null;
  group_id?: number;
  group_name?: string;
  created_at?: string | null;
  attachment_urls?: string[];
  attachment_links?: string[];
  video_urls?: string[];
  rubric?: RubricCriterion[];
};

type AssignmentListRow = {
  id: number;
  created_at: string | null;
};

export default function CourseAssignmentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { t } = useLanguage();

  const submissionStatusLabel = (status: Submission["status"]) => {
    if (status === "graded") return t("teacherAssignmentListStatusGraded");
    if (status === "pending") return t("teacherAssignmentListStatusSubmitted");
    return t("teacherAssignmentListStatusAssigned");
  };

  const assignmentId = Number(params.assignmentId);
  const groupId = Number(params.groupId);
  const activeTab: "instructions" | "student-work" =
    searchParams.get("tab") === "instructions" ? "instructions" : "student-work";

  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [selectedFileUrl, setSelectedFileUrl] = useState<string | null>(null);
  const [instructionComment, setInstructionComment] = useState("");
  const [privateComment, setPrivateComment] = useState("");
  const [gradeInput, setGradeInput] = useState("");
  const [rubricInputs, setRubricInputs] = useState<Record<number, string>>({});
  const [sortBy, setSortBy] = useState<"name" | "status">("name");
  const [selectAll, setSelectAll] = useState(false);
  const [checkedStudents, setCheckedStudents] = useState<Record<number, boolean>>({});
  const [isReturnMenuOpen, setIsReturnMenuOpen] = useState(false);
  const [showReturnDialog, setShowReturnDialog] = useState(false);

  const detailsQuery = useQuery({
    queryKey: ["teacher-assignment-detail", assignmentId],
    queryFn: async () => {
      const { data } = await api.get<AssignmentDetails>(`/teacher/assignments/${assignmentId}`);
      return data;
    },
    enabled: Number.isFinite(assignmentId),
  });

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

  const assignmentListQuery = useQuery({
    queryKey: ["teacher-assignments", groupId],
    queryFn: async () => {
      const { data } = await api.get<AssignmentListRow[]>(`/teacher/assignments?group_id=${groupId}`);
      return data;
    },
    enabled: Number.isFinite(groupId),
  });

  const gradeMutation = useMutation({
    mutationFn: async ({
      subId,
      grade,
      teacherComment,
      grades,
    }: {
      subId: number;
      grade?: number;
      teacherComment: string;
      grades?: RubricGrade[];
    }) => {
      await api.put(`/teacher/submissions/${subId}`, {
        grade,
        teacher_comment: teacherComment,
        grades,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignment-submissions", assignmentId] });
      setShowReturnDialog(false);
      setIsReturnMenuOpen(false);
    },
  });

  const submissions = submissionsQuery.data?.submissions ?? [];
  const rubric = submissionsQuery.data?.rubric ?? [];
  const details = detailsQuery.data;

  const selectedSubmission = useMemo(
    () => submissions.find((s) => s.student_id === selectedStudentId) ?? null,
    [submissions, selectedStudentId]
  );

  const sortedSubmissions = useMemo(() => {
    const copy = [...submissions];
    if (sortBy === "name") {
      copy.sort((a, b) => a.student_name.localeCompare(b.student_name, "ru"));
      return copy;
    }
    const rank = (s: Submission) => (s.status === "not_submitted" ? 0 : s.status === "pending" ? 1 : 2);
    copy.sort((a, b) => rank(a) - rank(b));
    return copy;
  }, [submissions, sortBy]);

  const countAssigned = submissions.filter((s) => s.status === "not_submitted").length;
  const countSubmitted = submissions.filter((s) => s.status === "pending").length;
  const countGraded = submissions.filter((s) => s.status === "graded").length;

  useEffect(() => {
    if (!selectedSubmission && sortedSubmissions.length > 0) {
      setSelectedStudentId(sortedSubmissions[0].student_id);
    }
  }, [sortedSubmissions, selectedSubmission]);

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
    setSelectedFileUrl(null);
  }, [selectedSubmission, rubric]);

  useEffect(() => {
    if (!selectAll) return;
    const allChecked: Record<number, boolean> = {};
    submissions.forEach((s) => {
      allChecked[s.student_id] = true;
    });
    setCheckedStudents(allChecked);
  }, [selectAll, submissions]);

  const assignmentFromList = assignmentListQuery.data?.find((a) => a.id === assignmentId);
  const postedAt = assignmentFromList?.created_at;
  const maxPoints = details?.max_points ?? submissionsQuery.data?.assignment?.max_points ?? 100;

  const selectedFiles = selectedSubmission
    ? [
        ...(selectedSubmission.file_url ? [selectedSubmission.file_url] : []),
        ...(selectedSubmission.file_urls ?? []),
      ]
    : [];
  const activeFile = selectedFileUrl ?? selectedFiles[0] ?? null;

  const currentIndex = sortedSubmissions.findIndex((s) => s.student_id === selectedStudentId);

  const handleSaveGrade = () => {
    if (!selectedSubmission?.id) return;
    const grades: RubricGrade[] | undefined =
      rubric.length > 0
        ? rubric.map((c) => ({
            criterion_id: c.id,
            points: parseFloat(rubricInputs[c.id] ?? "0") || 0,
          }))
        : undefined;
    const numericGrade = gradeInput ? Number(gradeInput) : undefined;
    gradeMutation.mutate({
      subId: selectedSubmission.id,
      grade: numericGrade,
      teacherComment: privateComment,
      grades,
    });
  };

  if (detailsQuery.isPending || submissionsQuery.isPending) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--qit-primary)] border-t-transparent" />
      </div>
    );
  }

  if (detailsQuery.isError || submissionsQuery.isError || !details) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-gray-500">{t("teacherAssignmentLoadError")}</p>
          <button
            type="button"
            className="mt-3 rounded-lg bg-[var(--qit-primary)] px-4 py-2 text-sm text-white"
            onClick={() => router.push(`/app/teacher/courses/${groupId}`)}
          >
            {t("teacherBack")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-6rem)] -m-4 flex flex-col overflow-hidden pb-4 sm:-m-6 sm:pb-6 lg:-m-8 lg:pb-8">
      <div className="shrink-0 border-b border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <button
          className="mb-2 inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[var(--qit-primary)]"
          onClick={() => router.push(`/app/teacher/courses/${groupId}`)}
          type="button"
        >
          <ChevronLeft className="h-4 w-4" />
          {t("teacherBack")}
        </button>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900 dark:text-white">
              <FileText className="h-5 w-5 text-[var(--qit-primary)]" />
              {details.title}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
              <span>
                {t("teacherAssignmentInstructor")} {user?.full_name || t("profileValueEmpty")}
              </span>
              <span>
                {t("teacherAssignmentPointsShort")} {maxPoints}
              </span>
              <span>
                {t("teacherAssignmentDue")}{" "}
                {details.deadline ? new Date(details.deadline).toLocaleString() : t("teacherAssignmentNoDue")}
              </span>
              <span>
                {t("teacherAssignmentPostedAt")} {postedAt ? new Date(postedAt).toLocaleString() : t("profileValueEmpty")}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              className={`rounded-full px-3 py-1.5 text-sm ${
                activeTab === "instructions" ? "bg-[var(--qit-primary)] text-white" : "bg-gray-200 text-gray-700"
              }`}
              onClick={() => router.push(`/app/teacher/courses/${groupId}/assignment/${assignmentId}?tab=instructions`)}
              type="button"
            >
              {t("teacherViewAnswersInstructions")}
            </button>
            <button
              className={`rounded-full px-3 py-1.5 text-sm ${
                activeTab === "student-work" ? "bg-[var(--qit-primary)] text-white" : "bg-gray-200 text-gray-700"
              }`}
              onClick={() => router.push(`/app/teacher/courses/${groupId}/assignment/${assignmentId}?tab=student-work`)}
              type="button"
            >
              {t("teacherAssignmentStudentWorkTab")}
            </button>
          </div>
        </div>
      </div>

      {activeTab === "instructions" ? (
        <div className="flex-1 overflow-y-auto bg-gray-50 p-6 dark:bg-gray-950">
          <div className="mx-auto max-w-4xl space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">{t("profileDescription")}</h2>
              {details.description ? (
                <div className="prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: details.description }} />
              ) : (
                <p className="text-sm text-gray-500">{t("teacherAssignmentNoDescription")}</p>
              )}
            </div>

            {details.rubric && details.rubric.length > 0 ? (
              <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">{t("teacherRubric")}</h2>
                <div className="space-y-2">
                  {details.rubric.map((c, idx) => (
                    <div key={`${c.name}-${idx}`} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm dark:bg-gray-800">
                      <span>{c.name}</span>
                      <span className="font-medium">{t("teacherAssignmentPointsAbbr").replace("{n}", String(c.max_points))}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">{t("teacherAssignmentAttachments")}</h2>
              <div className="space-y-2">
                {(details.attachment_urls ?? []).map((u, i) => (
                  <a key={`${u}-${i}`} href={u} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm hover:underline dark:bg-gray-800">
                    <Paperclip className="h-4 w-4" />
                    {u.split("/").pop()?.split("?")[0] || t("teacherGradingFileFallback").replace("{n}", String(i + 1))}
                  </a>
                ))}
                {(details.attachment_links ?? []).map((u, i) => (
                  <a key={`${u}-${i}`} href={u} target="_blank" rel="noopener noreferrer" className="block rounded-lg bg-gray-50 px-3 py-2 text-sm hover:underline dark:bg-gray-800">
                    {u}
                  </a>
                ))}
                {(details.attachment_urls ?? []).length === 0 && (details.attachment_links ?? []).length === 0 ? (
                  <p className="text-sm text-gray-500">{t("teacherAssignmentNoAttachments")}</p>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">{t("teacherAssignmentCommentsSection")}</h2>
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
                  placeholder={t("teacherAssignmentInstructionCommentPh")}
                  value={instructionComment}
                  onChange={(e) => setInstructionComment(e.target.value)}
                />
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-xl bg-[var(--qit-primary)] px-3 py-2 text-sm text-white"
                >
                  <Send className="h-4 w-4" />
                  {t("send")}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          <aside className="w-80 shrink-0 border-r border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
            <div className="border-b border-gray-200 p-3 dark:border-gray-700">
              <label className="mb-2 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={selectAll} onChange={(e) => setSelectAll(e.target.checked)} />
                {t("teacherAssignmentAllLearners")}
              </label>
              <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
                <span>{t("teacherAssignmentSortByEllipsis")}</span>
                <select
                  className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-800"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as "name" | "status")}
                >
                  <option value="name">{t("teacherAssignmentSortNameOption")}</option>
                  <option value="status">{t("teacherAssignmentSortStatusOption")}</option>
                </select>
              </div>
              <div className="mt-2 text-xs text-gray-500">
                {t("teacherAssignmentCountsLine")
                  .replace("{assigned}", String(countAssigned))
                  .replace("{submitted}", String(countSubmitted))
                  .replace("{graded}", String(countGraded))}
              </div>
            </div>

            <ul className="h-[calc(100%-112px)] overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
              {sortedSubmissions.map((s) => (
                <li key={s.student_id}>
                  <button
                    type="button"
                    onClick={() => setSelectedStudentId(s.student_id)}
                    className={`w-full p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800 ${
                      selectedStudentId === s.student_id ? "bg-blue-50 dark:bg-blue-950/30" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={checkedStudents[s.student_id] || false}
                        onChange={(e) =>
                          setCheckedStudents((prev) => ({ ...prev, [s.student_id]: e.target.checked }))
                        }
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="h-8 w-8 rounded-full bg-[var(--qit-primary)]/15 text-center text-sm leading-8 text-[var(--qit-primary)]">
                        {(s.student_name || "?").charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{s.student_name}</p>
                        <p className="truncate text-xs text-gray-500">{submissionStatusLabel(s.status)}</p>
                      </div>
                      <div className="text-xs text-gray-500">
                        {s.grade != null
                          ? t("teacherAssignmentGradeFromMax").replace("{current}", String(s.grade)).replace("{max}", String(maxPoints))
                          : `___${t("teacherAssignmentGradePlaceholderShort").replace("{max}", String(maxPoints))}`}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          {!activeFile ? (
            <main className="flex min-h-0 flex-1 flex-col">
              <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <button
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700"
                      onClick={() => setIsReturnMenuOpen((v) => !v)}
                      type="button"
                    >
                      {t("teacherGradingReturn")}
                      <ChevronDown className="h-4 w-4" />
                    </button>
                    {isReturnMenuOpen ? (
                      <div className="absolute left-0 top-full z-10 mt-1 w-44 rounded-lg border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                        <button type="button" className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-800" onClick={() => setShowReturnDialog(true)}>
                          {t("teacherAssignmentReturnToSelected")}
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <button type="button" className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700">
                    <Mail className="h-4 w-4" />
                    {t("teacherAssignmentEmailButton")}
                  </button>
                  <select
                    className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-800"
                    value={gradeInput}
                    onChange={(e) => setGradeInput(e.target.value)}
                  >
                    <option value="">{t("teacherAssignmentPointsPick")}</option>
                    <option value={String(maxPoints)}>{t("teacherGradingPointsOption").replace("{n}", String(maxPoints))}</option>
                    <option value={String(Math.floor(maxPoints * 0.8))}>
                      {t("teacherGradingPointsOption").replace("{n}", String(Math.floor(maxPoints * 0.8)))}
                    </option>
                    <option value={String(Math.floor(maxPoints * 0.6))}>
                      {t("teacherGradingPointsOption").replace("{n}", String(Math.floor(maxPoints * 0.6)))}
                    </option>
                  </select>
                </div>
                <button type="button" className="rounded-lg border border-gray-300 p-2 dark:border-gray-700">
                  <Settings className="h-4 w-4" />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto bg-gray-50 p-5 dark:bg-gray-950">
                {!selectedSubmission ? null : selectedSubmission.status === "not_submitted" ? (
                  <div className="mx-auto max-w-3xl space-y-4">
                    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
                      <p className="text-sm font-semibold">{t("teacherAssignmentNoGrade")}</p>
                    </div>
                    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
                      <p className="mb-2 text-sm font-semibold">{t("teacherAssignmentRubricCriteriaTitle")}</p>
                      <details className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
                        <summary className="cursor-pointer text-sm">{t("teacherAssignmentShowRubric")}</summary>
                        <ul className="mt-2 space-y-1 text-sm text-gray-600 dark:text-gray-300">
                          {rubric.map((c) => (
                            <li key={c.id}>
                              {t("teacherAssignmentCriterionLine").replace("{name}", c.name).replace("{max}", String(c.max_points))}
                            </li>
                          ))}
                        </ul>
                      </details>
                    </div>
                  </div>
                ) : (
                  <div className="mx-auto grid max-w-6xl grid-cols-1 gap-5 xl:grid-cols-[1fr_340px]">
                    <div className="space-y-4">
                      {selectedSubmission.submission_text ? (
                        <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm dark:border-gray-700 dark:bg-gray-900">
                          {selectedSubmission.submission_text}
                        </div>
                      ) : null}
                      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
                        <p className="mb-2 text-sm font-semibold">{t("teacherAssignmentSubmittedFiles")}</p>
                        <div className="space-y-2">
                          {selectedFiles.length === 0 ? (
                            <p className="text-sm text-gray-500">{t("teacherGradingNoFilesAttached")}</p>
                          ) : (
                            selectedFiles.map((u, i) => (
                              <button
                                key={`${u}-${i}`}
                                type="button"
                                onClick={() => setSelectedFileUrl(u)}
                                className="flex w-full items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-left text-sm hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700"
                              >
                                <span className="truncate">
                                  {u.split("/").pop()?.split("?")[0] || t("teacherGradingFileFallback").replace("{n}", String(i + 1))}
                                </span>
                                <span className="text-xs text-gray-500">{t("teacherAssignmentOpenLink")}</span>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
                        <p className="mb-2 text-sm font-semibold">{t("teacherAssignmentRubricEval")}</p>
                        <div className="space-y-2">
                          {rubric.map((c) => (
                            <div key={c.id} className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
                              <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
                                <span>{c.name}</span>
                                <span>{t("teacherAssignmentPointsAbbr").replace("{n}", String(c.max_points))}</span>
                              </div>
                              <input
                                type="number"
                                className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900"
                                min={0}
                                max={c.max_points}
                                value={rubricInputs[c.id] ?? ""}
                                onChange={(e) => setRubricInputs((prev) => ({ ...prev, [c.id]: e.target.value }))}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="shrink-0 border-t border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
                <div className="mx-auto max-w-5xl space-y-2">
                  {selectedSubmission?.student_private_comment?.trim() ? (
                    <div className="rounded-xl border border-blue-100 bg-blue-50/80 px-3 py-2 text-sm dark:border-blue-900/40 dark:bg-blue-950/30">
                      <p className="text-xs font-semibold text-blue-800 dark:text-blue-300">{t("teacherAssignmentStudentMessage")}</p>
                      <p className="mt-1 whitespace-pre-wrap text-gray-800 dark:text-gray-200">
                        {selectedSubmission.student_private_comment}
                      </p>
                    </div>
                  ) : null}
                  <input
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
                    placeholder={t("teacherAssignmentGradeCommentPh")}
                    value={privateComment}
                    onChange={(e) => setPrivateComment(e.target.value)}
                  />
                </div>
              </div>
            </main>
          ) : (
            <main className="flex min-h-0 flex-1 flex-col">
              <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-[var(--qit-primary)]/15 text-center text-sm leading-9 text-[var(--qit-primary)]">
                    {(selectedSubmission?.student_name || "?").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{selectedSubmission?.student_name}</p>
                    <input
                      className="mt-1 w-24 rounded-md border border-gray-300 px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-800"
                      value={gradeInput}
                      onChange={(e) => setGradeInput(e.target.value)}
                      placeholder={`${maxPoints}/${maxPoints}`}
                    />
                  </div>
                  <div className="ml-2 flex rounded-lg border border-gray-300 dark:border-gray-700">
                    <button
                      type="button"
                      className="border-r border-gray-300 p-2 dark:border-gray-700"
                      disabled={currentIndex <= 0}
                      onClick={() => setSelectedStudentId(sortedSubmissions[currentIndex - 1]?.student_id ?? null)}
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="p-2"
                      disabled={currentIndex >= sortedSubmissions.length - 1}
                      onClick={() => setSelectedStudentId(sortedSubmissions[currentIndex + 1]?.student_id ?? null)}
                    >
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <a
                  href={activeFile}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700"
                >
                  {t("teacherAssignmentOpenInApp")}
                </a>
              </div>

              <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[1fr_340px]">
                <div className="min-h-0 overflow-y-auto bg-gray-100 p-4 dark:bg-gray-950">
                  <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
                    {/\.(pdf)$/i.test(activeFile) ? (
                      <iframe src={activeFile} className="h-[72vh] w-full rounded-2xl" title={t("teacherFilePreview")} />
                    ) : (
                      <div className="flex min-h-[360px] items-center justify-center p-8">
                        <div className="text-center">
                          <p className="text-sm text-gray-500">{t("teacherAssignmentPreviewLimited")}</p>
                          <a href={activeFile} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm text-[var(--qit-primary)] hover:underline">
                            {t("teacherAssignmentDownloadOpen")}
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <aside className="min-h-0 overflow-y-auto border-l border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
                  <div className="space-y-4">
                    <section>
                      <h3 className="mb-2 text-sm font-semibold">{t("teacherGradingFiles")}</h3>
                      <div className="space-y-1">
                        {selectedFiles.map((u, i) => (
                          <button
                            key={`${u}-${i}`}
                            type="button"
                            onClick={() => setSelectedFileUrl(u)}
                            className={`w-full truncate rounded-lg px-2 py-1.5 text-left text-sm ${
                              u === activeFile ? "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300" : "bg-gray-50 dark:bg-gray-800"
                            }`}
                          >
                            {u.split("/").pop()?.split("?")[0] || t("teacherGradingFileFallback").replace("{n}", String(i + 1))}
                          </button>
                        ))}
                      </div>
                    </section>

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
                      <div className="space-y-2">
                        {rubric.map((c) => (
                          <div key={c.id} className="rounded-lg bg-gray-50 p-2 dark:bg-gray-800">
                            <div className="mb-1 flex items-center justify-between text-xs">
                              <span className="truncate">
                                {t("teacherAssignmentCriterionLabel").replace("{name}", c.name)}
                              </span>
                              <Check className="h-3.5 w-3.5 text-green-500" />
                            </div>
                            <input
                              type="number"
                              min={0}
                              max={c.max_points}
                              value={rubricInputs[c.id] ?? ""}
                              onChange={(e) => setRubricInputs((prev) => ({ ...prev, [c.id]: e.target.value }))}
                              className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
                            />
                          </div>
                        ))}
                      </div>
                    </section>

                    <section>
                      <h3 className="mb-2 text-sm font-semibold">{t("teacherAssignmentFeedbackTitle")}</h3>
                      {selectedSubmission?.student_private_comment?.trim() ? (
                        <div className="mb-3 rounded-lg border border-blue-100 bg-blue-50/80 p-2 text-xs dark:border-blue-900/40 dark:bg-blue-950/30">
                          <p className="font-semibold text-blue-800 dark:text-blue-300">{t("teacherAssignmentStudentMessage")}</p>
                          <p className="mt-1 whitespace-pre-wrap text-gray-800 dark:text-gray-200">
                            {selectedSubmission.student_private_comment}
                          </p>
                        </div>
                      ) : null}
                      <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">{t("teacherAssignmentGradeCommentShort")}</p>
                      <textarea
                        rows={4}
                        value={privateComment}
                        onChange={(e) => setPrivateComment(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
                        placeholder={t("teacherAssignmentTeacherWorkCommentPh")}
                      />
                    </section>

                    <button
                      type="button"
                      className="w-full rounded-lg bg-[var(--qit-primary)] px-4 py-2 text-sm text-white disabled:opacity-50"
                      onClick={() => setShowReturnDialog(true)}
                      disabled={!selectedSubmission?.id || gradeMutation.isPending}
                    >
                      {t("teacherGradingReturn")}
                    </button>
                  </div>
                </aside>
              </div>
            </main>
          )}
        </div>
      )}

      {showReturnDialog && selectedSubmission ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 dark:bg-gray-900">
            <h3 className="text-lg font-semibold">
              {t("teacherAssignmentReturnConfirmTitle").replace("{student}", selectedSubmission.student_name)}
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              {t("teacherAssignmentReturnGradeLine")
                .replace("{grade}", gradeInput || t("profileValueEmpty"))
                .replace("{max}", String(maxPoints))}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700" onClick={() => setShowReturnDialog(false)}>
                {t("cancel")}
              </button>
              <button
                type="button"
                className="rounded-lg bg-[var(--qit-primary)] px-3 py-1.5 text-sm text-white disabled:opacity-50"
                disabled={gradeMutation.isPending || !selectedSubmission.id}
                onClick={handleSaveGrade}
              >
                {t("teacherAssignmentConfirmReturn")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
