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
  ChevronLeft,
  FileText,
  Paperclip,
} from "lucide-react";
import { AssignmentClassCommentsSection } from "@/components/courses/AssignmentClassCommentsSection";
import { formatLocalizedDate } from "@/utils/dateUtils";
import { interpolateTemplate } from "@/utils/interpolateTemplate";
import { AssignmentAttachmentsGC } from "@/components/teacher/AssignmentAttachmentsGC";
import { AssignmentRubricExplorer } from "@/components/teacher/AssignmentRubricExplorer";
import { cn } from "@/lib/utils";

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
  returned_at?: string | null;
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
  is_synopsis?: boolean;
  rubric?: RubricCriterion[];
};

type AssignmentListRow = {
  id: number;
  created_at: string | null;
};

export default function TeacherAssignmentPage() {
  const { t, lang } = useLanguage();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const submissionStatusLabel = (status: Submission["status"]) => {
    if (status === "graded") return t("teacherAssignmentListStatusGraded");
    if (status === "pending") return t("teacherAssignmentListStatusSubmitted");
    return t("teacherAssignmentListStatusAssigned");
  };

  const assignmentId = Number(params.assignmentId);
  const groupId = Number(params.groupId);
  /** Default to instructions (Classroom-style); ?tab=student-work opens grading. */
  const activeTab: "instructions" | "student-work" =
    searchParams.get("tab") === "student-work" ? "student-work" : "instructions";
  const studentIdParam = searchParams.get("studentId");
  const fileIndexParam = searchParams.get("fileIndex");
  const queryStudentId = studentIdParam != null ? Number(studentIdParam) : null;
  const queryFileIndex = fileIndexParam != null ? Number(fileIndexParam) : null;

  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [selectedFileUrl, setSelectedFileUrl] = useState<string | null>(null);
  const [privateComment, setPrivateComment] = useState("");
  const [gradeInput, setGradeInput] = useState("");
  const [lastAutoSum, setLastAutoSum] = useState<string>("");
  const [rubricInputs, setRubricInputs] = useState<Record<number, string>>({});
  const [sortBy, setSortBy] = useState<"name" | "status">("name");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "graded" | "not_submitted">("all");
  const [showReturnDialog, setShowReturnDialog] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [hasAppliedQuerySelection, setHasAppliedQuerySelection] = useState(false);
  const [hasAppliedQueryFile, setHasAppliedQueryFile] = useState(false);

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

  const saveDraftMutation = useMutation({
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
      const { data } = await api.put(`/teacher/submissions/${subId}`, {
        grade,
        teacher_comment: teacherComment,
        grades,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignment-submissions", assignmentId] });
      queryClient.invalidateQueries({ queryKey: ["teacher-assignment-detail", assignmentId] });
      queryClient.invalidateQueries({ queryKey: ["teacher-submissions-inbox"] });
      queryClient.invalidateQueries({ queryKey: ["teacher-submissions-inbox", groupId] });
      setActionFeedback({ type: "success", message: t("teacherGradeSavedDraft") });
    },
    onError: () => {
      setActionFeedback({ type: "error", message: t("teacherGradeSaveError") });
    },
  });

  const returnMutation = useMutation({
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
      const { data } = await api.post(`/teacher/submissions/${subId}/return`, {
        grade,
        teacher_comment: teacherComment,
        grades,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignment-submissions", assignmentId] });
      queryClient.invalidateQueries({ queryKey: ["teacher-assignment-detail", assignmentId] });
      queryClient.invalidateQueries({ queryKey: ["teacher-submissions-inbox"] });
      queryClient.invalidateQueries({ queryKey: ["teacher-submissions-inbox", groupId] });
      setShowReturnDialog(false);
      setActionFeedback({ type: "success", message: t("teacherWorkReturned") });
    },
    onError: () => {
      setActionFeedback({ type: "error", message: t("teacherWorkReturnError") });
    },
  });

  const submissions = submissionsQuery.data?.submissions ?? [];
  const details = detailsQuery.data;

  /** Check if the assignment is overdue */
  const deadline = details?.deadline ? new Date(details.deadline) : null;
  const isOverdue = deadline ? deadline < new Date() : false;

  /** Submissions endpoint and assignment detail both expose rubric; merge so UI never misses criteria. */
  const rubric = useMemo((): RubricCriterion[] => {
    const fromSub = submissionsQuery.data?.rubric;
    if (fromSub && fromSub.length > 0) return fromSub;
    return details?.rubric ?? [];
  }, [submissionsQuery.data?.rubric, details?.rubric]);

  const selectedSubmission = useMemo(
    () => submissions.find((s) => s.student_id === selectedStudentId) ?? null,
    [submissions, selectedStudentId]
  );

  const filteredSubmissions = useMemo(() => {
    if (statusFilter === "all") return submissions;
    return submissions.filter((s) => s.status === statusFilter);
  }, [submissions, statusFilter]);

  const sortedSubmissions = useMemo(() => {
    const copy = [...filteredSubmissions];
    if (sortBy === "name") {
      copy.sort((a, b) => a.student_name.localeCompare(b.student_name, "ru"));
      return copy;
    }
    const rank = (s: Submission) => (s.status === "not_submitted" ? 0 : s.status === "pending" ? 1 : 2);
    copy.sort((a, b) => rank(a) - rank(b));
    return copy;
  }, [filteredSubmissions, sortBy]);

  /** Всего учащихся в группе по этому заданию · сдали работу · получили оценку */
  const countTotalAssigned = submissions.length;
  const countTurnedIn = submissions.filter((s) => s.status === "pending" || s.status === "graded").length;
  const countGraded = submissions.filter((s) => s.status === "graded").length;

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
    if (sortedSubmissions.length > 0) {
      setSelectedStudentId(sortedSubmissions[0].student_id);
    }
    setHasAppliedQuerySelection(true);
  }, [hasAppliedQuerySelection, submissions, sortedSubmissions, queryStudentId]);

  useEffect(() => {
    if (!selectedSubmission) return;
    setActionFeedback(null);
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
    if (
      !hasAppliedQueryFile &&
      queryFileIndex != null &&
      Number.isFinite(queryFileIndex) &&
      (queryStudentId == null || selectedSubmission.student_id === queryStudentId)
    ) {
      const requestedIndex = Math.trunc(queryFileIndex);
      setSelectedFileUrl(files[requestedIndex] ?? null);
      setHasAppliedQueryFile(true);
      return;
    }
    setSelectedFileUrl(null);
  }, [selectedSubmission, rubric, hasAppliedQueryFile, queryFileIndex, queryStudentId]);

  // Auto-calculate grade from rubric
  useEffect(() => {
    if (rubric.length === 0) return;
    const sum = Object.values(rubricInputs).reduce((acc, val) => {
      const n = parseFloat(val);
      return acc + (Number.isFinite(n) ? n : 0);
    }, 0);

    const roundedSum = String(Math.round(sum * 100) / 100);

    // Only update gradeInput if it matches lastAutoSum (meaning it's in sync)
    // or if the gradeInput is empty, or if we just haven't set a lastAutoSum yet.
    if (sum > 0 || Object.keys(rubricInputs).length > 0) {
      if (gradeInput === "" || gradeInput === lastAutoSum) {
        setGradeInput(roundedSum);
        setLastAutoSum(roundedSum);
      }
    }
  }, [rubricInputs, rubric.length, lastAutoSum]);

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
  const activeFileIndex = activeFile ? selectedFiles.findIndex((u) => u === activeFile) : -1;
  const fileNameFromUrl = (u: string, i: number) => {
    const rawName = u.split("/").pop()?.split("?")[0] || t("teacherGradingFileFallback").replace("{n}", String(i + 1));
    if (rawName.length > 20) {
      return rawName.slice(0, 15) + "..." + (rawName.includes(".") ? rawName.split(".").pop() : "");
    }
    return rawName;
  };
  const openFileGradingTab = (fileIndex: number) => {
    const studentId = selectedSubmission?.student_id ?? selectedStudentId;
    if (studentId == null) return;
    const url = selectedFiles[fileIndex];
    if (!url) return;

    const isImage = /\.(jpeg|jpg|gif|png|webp)$/i.test(url.split("?")[0]);
    if (isImage) {
      const params = new URLSearchParams({
        studentId: String(studentId),
        fileIndex: String(fileIndex),
      });
      const viewerUrl = `/app/teacher/courses/${groupId}/assignment/${assignmentId}/view?${params.toString()}`;
      window.open(viewerUrl, "_blank", "noopener,noreferrer");
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const currentIndex = sortedSubmissions.findIndex((s) => s.student_id === selectedStudentId);
  const isSaving = saveDraftMutation.isPending || returnMutation.isPending;
  const [isBootstrappingSubmission, setIsBootstrappingSubmission] = useState(false);
  const isBusy = isSaving || isBootstrappingSubmission;

  const canGradeAbsentNoRow =
    !!selectedSubmission &&
    selectedSubmission.status === "not_submitted" &&
    isOverdue &&
    selectedSubmission.id == null;
  const canSaveOrReturn =
    !!selectedSubmission &&
    (selectedSubmission.id != null || canGradeAbsentNoRow) &&
    !(selectedSubmission.status === "not_submitted" && !isOverdue);

  const buildGradePayload = (subId: number) => {
    const grades: RubricGrade[] | undefined =
      rubric.length > 0
        ? rubric.map((c) => ({
            criterion_id: c.id,
            points: parseFloat(rubricInputs[c.id] ?? "0") || 0,
          }))
        : undefined;
    let numericGrade: number | undefined = undefined;
    if (gradeInput.trim() !== "") {
      const n = Number(gradeInput);
      numericGrade = Number.isFinite(n) ? n : undefined;
    }
    return {
      subId,
      grade: numericGrade,
      teacherComment: privateComment,
      grades,
    };
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

  const handleSaveGrade = async () => {
    setActionFeedback(null);
    if (!selectedSubmission) return;
    let subId = selectedSubmission.id;
    if (subId == null && selectedSubmission.status === "not_submitted" && isOverdue) {
      setIsBootstrappingSubmission(true);
      try {
        subId = await resolveSubmissionIdForGrade();
      } catch {
        setActionFeedback({ type: "error", message: t("teacherGradeSaveError") });
        setIsBootstrappingSubmission(false);
        return;
      }
      setIsBootstrappingSubmission(false);
    }
    if (subId == null) return;
    saveDraftMutation.mutate(buildGradePayload(subId));
  };

  const handleReturnToStudent = async () => {
    setActionFeedback(null);
    if (!selectedSubmission) return;
    let subId = selectedSubmission.id;
    if (subId == null && selectedSubmission.status === "not_submitted" && isOverdue) {
      setIsBootstrappingSubmission(true);
      try {
        subId = await resolveSubmissionIdForGrade();
      } catch {
        setActionFeedback({ type: "error", message: t("teacherWorkReturnError") });
        setIsBootstrappingSubmission(false);
        return;
      }
      setIsBootstrappingSubmission(false);
    }
    if (subId == null) return;
    returnMutation.mutate(buildGradePayload(subId));
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
    <div className="flex min-h-[calc(100vh-12rem)] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="shrink-0 border-b border-gray-200 bg-gradient-to-b from-white to-gray-50/70 p-4 dark:border-gray-700 dark:from-gray-900 dark:to-gray-900">
        <button
          className="mb-2 inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[var(--qit-primary)]"
          onClick={() => router.push(`/app/teacher/courses/${groupId}`)}
          type="button"
        >
          <ChevronLeft className="h-4 w-4" />
          {t("teacherBack")}
        </button>
        <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="flex items-start gap-2 text-lg font-bold text-gray-900 sm:text-xl dark:text-white">
              <FileText className="mt-0.5 h-5 w-5 shrink-0 text-[var(--qit-primary)]" />
              <span className="min-w-0 break-words">{details.title}</span>
            </h1>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5 text-sm text-gray-500 dark:text-gray-400">
              <span className="min-w-0">
                {t("teacherAssignmentInstructor")} {user?.full_name || t("profileValueEmpty")}
              </span>
              <span>
                {t("teacherAssignmentPointsShort")} {maxPoints}
              </span>
              <span className="min-w-0">
                {t("teacherAssignmentDue")}{" "}
                {details.deadline ? formatLocalizedDate(details.deadline, lang, t, { includeTime: true }) : t("teacherAssignmentNoDue")}
              </span>
              <span className="min-w-0">
                {t("teacherAssignmentPostedAt")} {postedAt ? formatLocalizedDate(postedAt, lang, t, { includeTime: true }) : t("profileValueEmpty")}
              </span>
            </div>
          </div>
          <div className="flex w-full shrink-0 gap-1 rounded-2xl border border-gray-200 bg-white/80 p-1 shadow-sm sm:inline-flex sm:w-auto sm:rounded-full dark:border-gray-700 dark:bg-gray-800/70">
            <button
              className={`min-h-[44px] flex-1 rounded-xl px-3 py-2 text-center text-sm font-medium sm:min-h-0 sm:flex-initial sm:rounded-full sm:py-1.5 ${
                activeTab === "instructions"
                  ? "bg-[var(--qit-primary)] text-white shadow-sm"
                  : "text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
              }`}
              onClick={() => router.push(`/app/teacher/courses/${groupId}/assignment/${assignmentId}?tab=instructions`)}
              type="button"
            >
              {t("teacherViewAnswersInstructions")}
            </button>
            <button
              className={`min-h-[44px] flex-1 rounded-xl px-3 py-2 text-center text-sm font-medium sm:min-h-0 sm:flex-initial sm:rounded-full sm:py-1.5 ${
                activeTab === "student-work"
                  ? "bg-[var(--qit-primary)] text-white shadow-sm"
                  : "text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
              }`}
              onClick={() => router.push(`/app/teacher/courses/${groupId}/assignment/${assignmentId}?tab=student-work`)}
              type="button"
            >
              <span className="line-clamp-2 text-balance sm:line-clamp-none">{t("teacherAssignmentStudentWorkTab")}</span>
            </button>
          </div>
        </div>
      </div>

      {actionFeedback ? (
        <div
          className={`mx-4 mt-3 rounded-xl border px-4 py-2 text-sm sm:mx-6 lg:mx-8 ${
            actionFeedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200"
              : "border-red-200 bg-red-50 text-red-900 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200"
          }`}
        >
          {actionFeedback.message}
        </div>
      ) : null}

      {activeTab === "instructions" ? (
        <div className="flex-1 overflow-y-auto bg-gradient-to-b from-gray-50 to-gray-100/60 p-4 sm:p-6 dark:from-gray-950 dark:to-gray-950">
          <div className="mx-auto max-w-4xl space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5 dark:border-gray-700 dark:bg-gray-900">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">{t("profileDescription")}</h2>
              {details.description ? (
                <div className="prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: details.description }} />
              ) : (
                <p className="text-sm text-gray-500">{t("teacherAssignmentNoDescription")}</p>
              )}
            </div>

            {details.rubric && details.rubric.length > 0 ? (
              <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5 dark:border-gray-700 dark:bg-gray-900">
                <AssignmentRubricExplorer assignmentTitle={details.title} rubric={details.rubric} />
              </div>
            ) : null}

            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5 dark:border-gray-700 dark:bg-gray-900">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">{t("teacherAssignmentAttachments")}</h2>
              <AssignmentAttachmentsGC
                attachmentUrls={details.attachment_urls ?? []}
                attachmentLinks={details.attachment_links ?? []}
                videoUrls={details.video_urls ?? []}
              />
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5 dark:border-gray-700 dark:bg-gray-900">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">{t("teacherAssignmentCommentsSection")}</h2>
              <AssignmentClassCommentsSection assignmentId={assignmentId} hideHeading />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <aside className="flex max-h-[min(42vh,380px)] w-full shrink-0 flex-col overflow-hidden border-b border-gray-200 bg-white md:max-h-none md:h-auto md:w-80 md:shrink-0 md:border-b-0 md:border-r dark:border-gray-700 dark:bg-gray-900">
            <div className="sticky top-0 z-10 shrink-0 border-b border-gray-200 bg-white/95 p-3 backdrop-blur dark:border-gray-700 dark:bg-gray-900/95">
              <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-200">{t("teacherAssignmentAllLearners")}</p>
              <div className="mb-3 flex flex-wrap gap-1.5">
                {[
                  { key: "all", label: t("filterAll") },
                  { key: "pending", label: t("filterSubmitted") },
                  { key: "graded", label: t("filterGraded") },
                  { key: "not_submitted", label: t("filterNotSubmitted") },
                ].map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setStatusFilter(f.key as "all" | "pending" | "graded" | "not_submitted")}
                    className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                      statusFilter === f.key
                        ? "bg-[var(--qit-primary)] text-white shadow-sm"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
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
                  .replace("{assigned}", String(countTotalAssigned))
                  .replace("{submitted}", String(countTurnedIn))
                  .replace("{graded}", String(countGraded))}
              </div>
            </div>

            <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain p-2">
              {sortedSubmissions.map((s) => (
                <li key={s.student_id}>
                  <button
                    type="button"
                    onClick={() => setSelectedStudentId(s.student_id)}
                    className={`w-full rounded-xl border p-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 ${
                      selectedStudentId === s.student_id
                        ? "border-blue-200 bg-blue-50 shadow-sm dark:border-blue-900/40 dark:bg-blue-950/30"
                        : "border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2">
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

          <main className="flex min-h-0 min-w-0 flex-1 flex-col">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white/95 px-3 py-3 backdrop-blur sm:px-4 dark:border-gray-700 dark:bg-gray-900/95">
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:gap-3">
                  <div className="h-9 w-9 rounded-full bg-[var(--qit-primary)]/15 text-center text-sm leading-9 text-[var(--qit-primary)]">
                    {(selectedSubmission?.student_name || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{selectedSubmission?.student_name}</p>
                    <input
                      className="mt-1 w-full max-w-[6rem] rounded-md border border-gray-300 px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-800"
                      value={gradeInput}
                      onChange={(e) => setGradeInput(e.target.value)}
                      placeholder={`${maxPoints}/${maxPoints}`}
                    />
                  </div>
                  <div className="flex shrink-0 rounded-lg border border-gray-300 sm:ml-2 dark:border-gray-700">
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
              </div>

              <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1fr_minmax(280px,340px)]">
                <div className="min-h-0 min-w-0 overflow-y-auto bg-gradient-to-b from-gray-100 to-gray-50 p-3 sm:p-4 dark:from-gray-950 dark:to-gray-950">
                  {selectedSubmission ? (
                    <div className="mb-3 rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50/80 px-4 py-3 shadow-sm dark:border-blue-900/40 dark:from-blue-950/30 dark:to-indigo-950/10">
                      <p className="text-xs font-medium uppercase tracking-wide text-blue-700 dark:text-blue-300">{t("teacherNowReviewing")}</p>
                      <p className="mt-1 text-lg font-bold text-gray-900 dark:text-white">
                        {selectedSubmission.student_name}
                        <span className="ml-2 text-sm font-medium text-gray-500 dark:text-gray-400">
                          ({submissionStatusLabel(selectedSubmission.status)})
                        </span>
                      </p>
                      {selectedSubmission.returned_at ? (
                        <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
                          {interpolateTemplate(t("teacherReturnedToStudentAt"), {
                            time: formatLocalizedDate(
                              selectedSubmission.returned_at,
                              lang,
                              t,
                              { includeTime: true }
                            ),
                          })}
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                          {t("teacherNotReturnedYet")}
                        </p>
                      )}
                    </div>
                  ) : null}
                  {selectedFiles.length > 0 ? (
                    <div className="mb-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                      <div className="mb-2 flex items-center gap-2">
                        <Paperclip className="h-4 w-4 text-[var(--qit-primary)]" />
                        <p className="text-sm font-semibold">{t("teacherGradingFiles")}</p>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {selectedFiles.map((u, i) => (
                          <button
                            key={`${u}-${i}`}
                            type="button"
                            onClick={() => openFileGradingTab(i)}
                            className={`relative rounded-2xl border p-4 text-left transition-all duration-300 ${
                              u === activeFile
                                ? "border-blue-500 bg-blue-50/50 shadow-md ring-2 ring-blue-500/20 dark:border-blue-400 dark:bg-blue-500/10"
                                : "border-gray-200 bg-gray-50 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
                            }`}
                          >
                            <div className="flex items-start gap-2.5 overflow-visible">
                              <FileText className={cn("mt-1.5 h-5 w-5 shrink-0", u === activeFile ? "text-blue-600 dark:text-blue-400" : "text-[var(--qit-primary)]")} />
                              <div className="min-w-0 flex-1 w-full relative">
                                <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                                  <span className={cn("min-w-0 flex-1 text-base font-bold leading-none break-all sm:truncate py-1", u === activeFile ? "text-blue-700 dark:text-blue-300" : "text-gray-900 dark:text-white")}>
                                    {fileNameFromUrl(u, i)}
                                  </span>
                                  {/* Active checkmark removed as requested */}
                                </div>
                              </div>
                            </div>
                            <span className={cn("mt-2 block text-sm font-medium", u === activeFile ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-400")}>
                                {/\.(jpeg|jpg|gif|png|webp)$/i.test(u.split("?")[0])
                                  ? t("teacherAssignmentOpenLink")
                                  : t("teacherDownloadFile")}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {selectedSubmission?.status === "not_submitted" ? (
                    isOverdue ? (
                      <div className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 text-sm text-blue-900 shadow-sm dark:border-blue-800/40 dark:from-blue-950/30 dark:to-indigo-950/10 dark:text-blue-200">
                        {t("teacherAssignmentOverdueGradingHint")}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 px-4 py-3 text-sm text-amber-900 shadow-sm dark:border-amber-800/40 dark:from-amber-950/30 dark:to-yellow-950/10 dark:text-amber-200">
                        {t("teacherAssignmentNotSubmittedWarning")}
                      </div>
                    )
                  ) : !activeFile ? (
                    <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900">
                      {t("teacherGradingNoFilesAttached")}
                    </div>
                  ) : /\.(pdf)$/i.test(activeFile) ? (
                    <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
                      <iframe src={activeFile} className="h-[72vh] w-full rounded-2xl" title={t("teacherFilePreview")} />
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-gray-700 dark:bg-gray-900">
                      <p className="text-sm text-gray-500">{t("teacherAssignmentPreviewLimited")}</p>
                    </div>
                  )}
                </div>

                <aside className="min-h-0 min-w-0 overflow-y-auto border-t border-gray-200 bg-white p-3 sm:p-4 lg:border-l lg:border-t-0 dark:border-gray-700 dark:bg-gray-900">
                  <div className="space-y-4">
                    <section>
                      <h3 className="mb-2 text-sm font-semibold">{t("teacherGradingGrade")}</h3>
                      {details.is_synopsis ? (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setGradeInput("0")}
                            className={cn(
                              "flex-1 py-2 rounded-lg border text-sm font-medium transition-all",
                              gradeInput === "0"
                                ? "bg-red-50 border-red-500 text-red-700 shadow-sm"
                                : "bg-white border-gray-200 text-gray-700 hover:border-red-200"
                            )}
                          >
                            {t("gradePoor")}
                          </button>
                          <button
                            type="button"
                            onClick={() => setGradeInput("100")}
                            className={cn(
                              "flex-1 py-2 rounded-lg border text-sm font-medium transition-all",
                              gradeInput === "100"
                                ? "bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm"
                                : "bg-white border-gray-200 text-gray-700 hover:border-emerald-200"
                            )}
                          >
                            {t("gradeChecked")}
                          </button>
                        </div>
                      ) : (
                        <input
                          type="number"
                          value={gradeInput}
                          onChange={(e) => setGradeInput(e.target.value)}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-800"
                          placeholder={t("teacherAssignmentGradePlaceholderShort").replace("{max}", String(maxPoints))}
                        />
                      )}
                    </section>

                    <section>
                      <h3 className="mb-2 text-sm font-semibold">{t("teacherAssignmentCriteriaHeading")}</h3>
                      {rubric.length === 0 ? (
                        <p className="text-xs text-gray-500 dark:text-gray-400">{t("teacherAssignmentRubricEmpty")}</p>
                      ) : (
                        <div className="space-y-2">
                          {rubric.map((c) => (
                            <div key={c.id} className="rounded-lg bg-gray-50 p-2 ring-1 ring-gray-100 dark:bg-gray-800 dark:ring-gray-700">
                              <div className="mb-1 flex items-center justify-between text-xs">
                                <span className="truncate">
                                  {t("teacherAssignmentCriterionLabel").replace("{name}", c.name)}
                                </span>
                                <Check className="h-3.5 w-3.5 shrink-0 text-green-500 opacity-60" />
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
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-800"
                        placeholder={t("teacherAssignmentTeacherWorkCommentPh")}
                      />
                    </section>

                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        className="w-full rounded-lg bg-[var(--qit-primary)] px-4 py-2 text-sm font-medium text-white shadow-sm disabled:opacity-50"
                        onClick={() => void handleSaveGrade()}
                        disabled={!canSaveOrReturn || isBusy}
                      >
                        {isBusy ? t("teacherSaving") : t("save")}
                      </button>
                      <button
                        type="button"
                        className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-600"
                        onClick={() => setShowReturnDialog(true)}
                        disabled={!canSaveOrReturn || isBusy}
                      >
                        {t("teacherGradingReturn")}
                      </button>
                    </div>
                  </div>
                </aside>
              </div>
            </main>
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
                disabled={isBusy || !canSaveOrReturn}
                onClick={() => void handleReturnToStudent()}
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
