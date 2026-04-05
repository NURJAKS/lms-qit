"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X, Plus, ChevronDown, Paperclip, Upload, Link as LinkIcon, CalendarDays, Users } from "lucide-react";
import { api } from "@/api/client";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { getGlassCardStyle, getInputStyle, getModalStyle, getTextColors } from "@/utils/themeStyles";
import { RichTextEditor } from "@/components/teacher/RichTextEditor";
import { FileAttachmentCard } from "@/components/teacher/FileAttachmentCard";
import { LinkAttachmentCard } from "@/components/teacher/LinkAttachmentCard";
import { VideoPreviewCard } from "@/components/teacher/VideoPreviewCard";

type Group = {
  id: number;
  course_id: number;
  course_title: string;
  group_name: string;
  teacher_id?: number;
  students_count?: number;
  created_at?: string | null;
};

type CourseTopic = { id: number; title: string };

type GroupStudent = { id: number; full_name: string; email: string };

type RubricBandPayload = { text: string; points: number };
type RubricCriterionPayload = {
  name: string;
  max_points: number;
  description?: string;
  levels?: RubricBandPayload[];
};

type QuizQuestion = {
  question: string;
  options: string[];
  correct_option_index: number;
};

type TestQuestionApi = {
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string;
};

function quizQuestionsToApiFormat(questions: QuizQuestion[]): TestQuestionApi[] {
  const letters = ["a", "b", "c", "d"] as const;
  return questions
    .filter((q) => q.question.trim())
    .map((q) => {
      const opts = [...q.options];
      while (opts.length < 4) opts.push("");
      const idx = Math.min(Math.max(0, q.correct_option_index), 3);
      return {
        question_text: q.question.trim(),
        option_a: (opts[0] ?? "").trim(),
        option_b: (opts[1] ?? "").trim(),
        option_c: (opts[2] ?? "").trim(),
        option_d: (opts[3] ?? "").trim(),
        correct_answer: letters[idx] ?? "a",
      };
    });
}

type RubricLevel = { name: string; points: number };

type RubricCondition = {
  name: string;
  description: string;
  levels: RubricLevel[];
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  currentGroup: Group;
  teacherGroups: Group[];
  topics: CourseTopic[];
  onInviteStudents: () => void;
  mode?: "assignment" | "assignmentWithTest" | "question" | "material";
  initialData?: any;
};

function formatDDMMYYYY(d: Date) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function toIsoFromYMD(ymd: string) {
  // Interpret as UTC midnight to avoid timezone drift.
  return new Date(`${ymd}T00:00:00.000Z`).toISOString();
}

function isValidHttpUrl(value: string) {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function CreateAssignmentFullPageModal({
  isOpen,
  onClose,
  currentGroup,
  teacherGroups,
  topics,
  onInviteStudents,
  mode = "assignment",
  initialData,
}: Props) {
  const isAssignmentLike = mode === "assignment" || mode === "assignmentWithTest";
  const queryClient = useQueryClient();
  const { t, lang } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const glassStyle = getGlassCardStyle(theme);
  const inputStyle = getInputStyle(theme);
  const modalStyle = getModalStyle(theme);
  const textColors = getTextColors(theme);

  const availableGroups = useMemo(
    () => teacherGroups.filter((g) => g.course_id === currentGroup.course_id),
    [teacherGroups, currentGroup.course_id]
  );

  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [instructionsHtml, setInstructionsHtml] = useState("");

  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);

  const [attachmentUrls, setAttachmentUrls] = useState<string[]>([]);
  const [attachmentLinks, setAttachmentLinks] = useState<string[]>([]);
  const [videoUrls, setVideoUrls] = useState<string[]>([]);

  const [forWhomOpen, setForWhomOpen] = useState(false);

  const [studentSelectorOpen, setStudentSelectorOpen] = useState(false);
  const [studentSelectorGroupId, setStudentSelectorGroupId] = useState<number | null>(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Record<number, boolean>>({});

  const studentSelectorStudentsQuery = useQuery({
    queryKey: ["teacher-group-students", studentSelectorGroupId],
    queryFn: async (): Promise<GroupStudent[]> => {
      if (!studentSelectorGroupId) return [];
      const { data } = await api.get<GroupStudent[]>(`/teacher/groups/${studentSelectorGroupId}/students`);
      return data;
    },
    enabled: studentSelectorOpen && !!studentSelectorGroupId,
  });

  const students = studentSelectorStudentsQuery.data ?? [];

  const [dueMode, setDueMode] = useState<"none" | "date">("none");
  const [dueDateYMD, setDueDateYMD] = useState<string>("");

  const [pointsMode, setPointsMode] = useState<"graded" | "no_grade">("graded");
  const [maxPoints, setMaxPoints] = useState<number>(100);

  const [topicId, setTopicId] = useState<number | null>(null);
  const [topicCreateOpen, setTopicCreateOpen] = useState(false);
  const [topicCreateTitle, setTopicCreateTitle] = useState("");
  const [topicCreateDesc, setTopicCreateDesc] = useState("");

  const [rubricDropdownOpen, setRubricDropdownOpen] = useState(false);
  const [rubricCreatorOpen, setRubricCreatorOpen] = useState(false);

  const [rubricConditions, setRubricConditions] = useState<RubricCondition[]>([
    { name: "", description: "", levels: [{ name: "0", points: 0 }] },
  ]);
  const [rubricTitle, setRubricTitle] = useState(t("assignmentRubricCriterion"));
  const [rubricUsePoints, setRubricUsePoints] = useState(true);
  const [rubricSortDesc, setRubricSortDesc] = useState(true);

  const [hasQuiz, setHasQuiz] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([
    { question: "", options: ["", ""], correct_option_index: 0 },
  ]);

  // Question mode specific state
  const [questionType, setQuestionType] = useState<"short_answer" | "multiple_choice">("short_answer");
  const [questionOptions, setQuestionOptions] = useState<string[]>([""]);
  const [canComment, setCanComment] = useState(true);
  const [canEdit, setCanEdit] = useState(false);

  const rubricPayload: RubricCriterionPayload[] = useMemo(() => {
    const raw = rubricConditions
      .filter((c) => c.name.trim().length > 0)
      .map((c) => {
        const levelsForApi: RubricBandPayload[] = c.levels.map((l) => ({
          text: (l.name || "").trim(),
          points: rubricUsePoints && Number.isFinite(l.points) ? l.points : 0,
        }));
        const levelMax = levelsForApi.reduce((m, l) => Math.max(m, l.points), 0);
        const max = rubricUsePoints ? levelMax : 0;
        const desc = (c.description || "").trim();
        const row: RubricCriterionPayload = {
          name: c.name.trim(),
          max_points: max,
        };
        if (desc) row.description = desc;
        if (levelsForApi.length > 0) row.levels = levelsForApi;
        return row;
      });
    return rubricSortDesc ? raw.slice().sort((a, b) => b.max_points - a.max_points) : raw;
  }, [rubricConditions, rubricSortDesc, rubricUsePoints]);

  // Attachment dialogs
  const [youtubeDialogOpen, setYoutubeDialogOpen] = useState(false);
  const [youtubeSearch, setYoutubeSearch] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeUrlError, setYoutubeUrlError] = useState<string | null>(null);

  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkUrlError, setLinkUrlError] = useState<string | null>(null);

  const [createAttachmentDialogOpen, setCreateAttachmentDialogOpen] = useState(false);
  const [createAttachmentType, setCreateAttachmentType] = useState<
    "docs" | "presentations" | "spreadsheets" | null
  >(null);
  const [createAttachmentUrl, setCreateAttachmentUrl] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Reset state on open
  useEffect(() => {
    if (!isOpen) return;
    
    if (initialData) {
      setTitle(initialData.title || "");
      setInstructionsHtml(initialData.description || "");
      setAttachmentUrls(initialData.attachment_urls || []);
      setAttachmentLinks(initialData.attachment_links || []);
      setVideoUrls(initialData.video_urls || []);
      setTopicId(initialData.topic_id || null);
      if (initialData.max_points !== undefined) {
        setMaxPoints(initialData.max_points);
        setPointsMode(initialData.max_points === 0 ? "no_grade" : "graded");
      }
      if (initialData.rubric) {
        setRubricConditions(
          initialData.rubric.map((r: any) => {
            const apiLevels = Array.isArray(r.levels) ? r.levels : [];
            const levelsFromApi =
              apiLevels.length > 0
                ? apiLevels.map((lv: any) => ({
                    name: typeof lv.text === "string" ? lv.text : typeof lv.name === "string" ? lv.name : "",
                    points: Number.isFinite(Number(lv.points)) ? Number(lv.points) : 0,
                  }))
                : [{ name: "Max", points: Number(r.max_points) || 0 }];
            return {
              name: typeof r.name === "string" ? r.name : "",
              description: typeof r.description === "string" ? r.description : "",
              levels: levelsFromApi,
            };
          })
        );
      }
    } else {
      setTitle("");
      setInstructionsHtml("");
      setAttachmentUrls([]);
      setAttachmentLinks([]);
      setVideoUrls([]);
      setTopicId(null);
      setPointsMode("graded");
      setMaxPoints(100);
      setRubricConditions([{ name: "", description: "", levels: [{ name: "0", points: 0 }] }]);
    }

    setTitleTouched(false);
    setSelectedGroupIds([currentGroup.id]);
    setForWhomOpen(false);
    setStudentSelectorOpen(false);
    setStudentSelectorGroupId(null);
    setSelectedStudentIds({});
    setDueMode("none");
    setDueDateYMD("");
    setTopicCreateOpen(false);
    setTopicCreateTitle("");
    setTopicCreateDesc("");
    setRubricDropdownOpen(false);
    setRubricCreatorOpen(false);
    setRubricTitle(t("assignmentRubricCriterion"));
    setRubricUsePoints(true);
    setRubricSortDesc(true);
    setHasQuiz(mode === "assignmentWithTest");
    setQuizQuestions([{ question: "", options: ["", ""], correct_option_index: 0 }]);
    setQuestionType("short_answer");
    setQuestionOptions([""]);
    setCanComment(true);
    setCanEdit(false);
    setYoutubeDialogOpen(false);
    setYoutubeSearch("");
    setYoutubeUrl("");
    setYoutubeUrlError(null);
    setLinkDialogOpen(false);
    setLinkUrl("");
    setLinkUrlError(null);
    setCreateAttachmentDialogOpen(false);
    setCreateAttachmentType(null);
    setCreateAttachmentUrl("");
    setSubmitError(null);
    setSubmitting(false);
  }, [isOpen, currentGroup.id, initialData, mode, t]);

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const { data } = await api.post<{ url: string }>("/teacher/assignments/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data.url;
  };

  const createTopicMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ id: number; title: string }>(`/teacher/courses/${currentGroup.course_id}/topics`, {
        title: topicCreateTitle.trim(),
        description: topicCreateDesc.trim() || undefined,
      });
      return data;
    },
    onSuccess: (data) => {
      setTopicId(data.id);
      setTopicCreateOpen(false);
      setTopicCreateTitle("");
      setTopicCreateDesc("");
      queryClient.invalidateQueries({ queryKey: ["course-topics", currentGroup.course_id] });
    },
  });

  const handleOpenStudentSelector = () => {
    const first = selectedGroupIds[0] ?? currentGroup.id;
    setStudentSelectorGroupId(first);
    setStudentSelectorOpen(true);
  };

  const resolveTopicIdForSubmit = async () => {
    if (topicId) return topicId;
    // "No topic" - create once (if missing) and reuse existing in the list.
    const noTopicTitle = t("assignmentNoTopic");
    const existing = topics.find((t) => t.title === noTopicTitle);
    if (existing) return existing.id;
    const { data } = await api.post<{ id: number; title: string }>(`/teacher/courses/${currentGroup.course_id}/topics`, {
      title: noTopicTitle,
      description: undefined,
    });
    queryClient.invalidateQueries({ queryKey: ["course-topics", currentGroup.course_id] });
    return data.id;
  };

  const createAssignmentMutation = useMutation({
    mutationFn: async (payload: {
      groupId: number;
      courseId: number;
      topicId: number;
      title: string;
      description?: string;
      deadlineIso?: string;
      maxPoints: number;
      attachmentUrls: string[];
      attachmentLinks: string[];
      videoUrls: string[];
      rubric: RubricCriterionPayload[];
      testQuestions?: TestQuestionApi[];
    }) => {
      await api.post("/teacher/assignments", {
        group_id: payload.groupId,
        course_id: payload.courseId,
        topic_id: payload.topicId,
        title: payload.title,
        description: payload.description || undefined,
        deadline: payload.deadlineIso || undefined,
        max_points: payload.maxPoints,
        attachment_urls: payload.attachmentUrls.length ? payload.attachmentUrls : undefined,
        attachment_links: payload.attachmentLinks.length ? payload.attachmentLinks : undefined,
        video_urls: payload.videoUrls.length ? payload.videoUrls : undefined,
        rubric: payload.rubric.length ? payload.rubric : undefined,
        test_questions: payload.testQuestions?.length ? payload.testQuestions : undefined,
      });
    },
  });

  const createQuestionMutation = useMutation({
    mutationFn: async (payload: {
      groupId: number;
      courseId: number;
      topicId: number;
      questionText: string;
      instructions?: string;
      questionType: string;
      options?: string[];
      deadlineIso?: string;
      maxPoints: number;
      attachmentUrls: string[];
      attachmentLinks: string[];
      videoUrls: string[];
      canComment: boolean;
      canEdit: boolean;
    }) => {
      await api.post("/teacher/questions", {
        group_id: payload.groupId,
        course_id: payload.courseId,
        topic_id: payload.topicId,
        question_text: payload.questionText,
        instructions: payload.instructions || undefined,
        question_type: payload.questionType,
        options: payload.options?.length ? payload.options : undefined,
        deadline: payload.deadlineIso || undefined,
        max_points: payload.maxPoints,
        attachment_urls: payload.attachmentUrls.length ? payload.attachmentUrls : undefined,
        attachment_links: payload.attachmentLinks.length ? payload.attachmentLinks : undefined,
        video_urls: payload.videoUrls.length ? payload.videoUrls : undefined,
        can_comment: payload.canComment,
        can_edit: payload.canEdit,
      });
    },
  });

  const createMaterialMutation = useMutation({
    mutationFn: async (payload: {
      groupId: number;
      courseId: number;
      topicId: number;
      title: string;
      description?: string;
      attachmentUrls: string[];
      attachmentLinks: string[];
      videoUrls: string[];
    }) => {
      await api.post("/teacher/materials", {
        group_id: payload.groupId,
        course_id: payload.courseId,
        topic_id: payload.topicId,
        title: payload.title,
        description: payload.description || undefined,
        attachment_urls: payload.attachmentUrls.length ? payload.attachmentUrls : undefined,
        attachment_links: payload.attachmentLinks.length ? payload.attachmentLinks : undefined,
        video_urls: payload.videoUrls.length ? payload.videoUrls : undefined,
      });
    },
  });

  const handleCreateAssignment = async () => {
    setSubmitError(null);
    setTitleTouched(true);
    const cleanedTitle = title.trim();
    if (!cleanedTitle) return;
    if (selectedGroupIds.length === 0) setSelectedGroupIds([currentGroup.id]);

    setSubmitting(true);
    try {
      const resolvedTopic = await resolveTopicIdForSubmit();
      const deadlineIso = dueMode === "date" && dueDateYMD ? toIsoFromYMD(dueDateYMD) : undefined;
      const payloadMaxPoints = pointsMode === "no_grade" ? 0 : Math.max(0, maxPoints);

      const rubricToSend =
        pointsMode === "no_grade" ? [] : rubricPayload.length ? rubricPayload : [];

      const groupById = new Map(teacherGroups.map((g) => [g.id, g] as const));
      for (const gid of selectedGroupIds) {
        const g = groupById.get(gid);
        if (!g) continue;

        if (mode === "material") {
          await createMaterialMutation.mutateAsync({
            groupId: gid,
            courseId: g.course_id,
            topicId: resolvedTopic,
            title: cleanedTitle,
            description: instructionsHtml || undefined,
            attachmentUrls,
            attachmentLinks,
            videoUrls,
          });
        } else if (mode === "question") {
          await createQuestionMutation.mutateAsync({
            groupId: gid,
            courseId: g.course_id,
            topicId: resolvedTopic,
            questionText: cleanedTitle,
            instructions: instructionsHtml || undefined,
            questionType,
            options: questionType === "multiple_choice" ? questionOptions.filter(o => o.trim()) : undefined,
            deadlineIso,
            maxPoints: payloadMaxPoints,
            attachmentUrls,
            attachmentLinks,
            videoUrls,
            canComment,
            canEdit,
          });
        } else {
          const includeTest =
            mode === "assignmentWithTest" || (mode === "assignment" && hasQuiz);
          const apiTestQuestions = includeTest ? quizQuestionsToApiFormat(quizQuestions) : [];
          await createAssignmentMutation.mutateAsync({
            groupId: gid,
            courseId: g.course_id,
            topicId: resolvedTopic,
            title: cleanedTitle,
            description: instructionsHtml || undefined,
            deadlineIso,
            maxPoints: payloadMaxPoints,
            attachmentUrls,
            attachmentLinks,
            videoUrls,
            rubric: rubricToSend,
            testQuestions: apiTestQuestions.length ? apiTestQuestions : undefined,
          });
        }
      }

      // Update the teacher course page.
      queryClient.invalidateQueries({ queryKey: ["teacher-assignments", currentGroup.id] });
      queryClient.invalidateQueries({ queryKey: ["teacher-questions", currentGroup.id] });
      onClose();
    } catch (e: any) {
      setSubmitError(e?.response?.data?.detail ?? e?.message ?? t("assignmentErrorCreate"));
    } finally {
      setSubmitting(false);
    }
  };

  const attachmentInputAccept = ".jpg,.jpeg,.png,.gif,.webp,.mp4,.webm,.pdf,.doc,.docx,.txt";

  if (!isOpen) return null;

  const titleError =
    titleTouched && !title.trim() ? t("assignmentFieldRequired") : null;

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-stretch justify-center z-50 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full h-full max-w-none rounded-none shadow-2xl overflow-hidden flex flex-col"
        style={modalStyle}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b" style={{ borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold" style={{ background: "linear-gradient(135deg,#3B82F6,#8B5CF6)" }}>
                <Plus className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-semibold font-geologica" style={{ color: textColors.primary }}>
                {mode === "material"
                  ? t("assignmentTypeMaterial")
                  : mode === "question"
                    ? t("assignmentTypeQuestion")
                    : mode === "assignmentWithTest"
                      ? t("assignmentTypeAssignmentWithTest")
                      : t("assignmentTypeAssignment")}
              </h2>
            </div>
            <p className="text-xs mt-1" style={{ color: textColors.secondary }}>
              {mode === "material"
                ? t("assignmentCreateMaterial")
                : mode === "question"
                  ? t("assignmentCreateQuestion")
                  : mode === "assignmentWithTest"
                    ? t("assignmentCreateAssignmentWithTest")
                    : t("createAssignment")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!isAssignmentLike && (
              <button
                type="button"
                onClick={handleCreateAssignment}
                disabled={submitting || !title.trim()}
                className="px-6 py-2 rounded-xl text-white font-semibold transition-all hover:shadow-lg disabled:opacity-50"
                style={{ background: "linear-gradient(135deg,#3B82F6,#8B5CF6)" }}
              >
                {submitting
                  ? mode === "material" ? t("publishing") : t("asking")
                  : mode === "material" ? t("publish") : t("ask")}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" style={{ color: textColors.secondary }} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {!rubricCreatorOpen ? (
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-0">
              {/* Left Panel */}
              <div className="p-5 lg:p-7 border-b lg:border-b-0 lg:border-r" style={{ borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}>
                <div className="space-y-5">
                  {/* Title */}
                  <div className="space-y-1">
                    <label className="block text-sm font-semibold" style={{ color: textColors.primary }}>
                      {mode === "material" ? t("assignmentTitleLabel") : mode === "question" ? t("assignmentQuestionLabel") : t("assignmentTitleLabel")}
                    </label>
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      onBlur={() => setTitleTouched(true)}
                      placeholder={mode === "question" ? t("assignmentQuestionPlaceholder") : t("assignmentTitlePlaceholder")}
                      className="w-full px-4 py-3 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/40"
                      style={{ ...inputStyle, color: textColors.primary }}
                    />
                    {titleError ? (
                      <p className="text-xs" style={{ color: "#F87171" }}>
                        {titleError}
                      </p>
                    ) : null}
                  </div>

                  {mode === "question" && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold" style={{ color: textColors.primary }}>
                          {t("assignmentQuestionType")}
                        </label>
                        <select
                          value={questionType}
                          onChange={(e) => setQuestionType(e.target.value as any)}
                          className="w-full px-4 py-3 rounded-2xl text-sm font-semibold outline-none"
                          style={{ ...inputStyle, color: textColors.primary }}
                        >
                          <option value="short_answer">{t("assignmentShortAnswer")}</option>
                          <option value="multiple_choice">{t("assignmentMultipleChoice")}</option>
                        </select>
                      </div>

                      {questionType === "multiple_choice" && (
                        <div className="space-y-3">
                          <label className="block text-sm font-semibold" style={{ color: textColors.primary }}>
                            Варианты ответа
                          </label>
                          <div className="space-y-2">
                            {questionOptions.map((opt, idx) => {
                              const isDuplicate = questionOptions.some((o, i) => i !== idx && o.trim() !== "" && o.trim() === opt.trim());
                              return (
                                <div key={idx} className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 rounded-full border-2 border-gray-300 shrink-0" />
                                    <input
                                      value={opt}
                                      onChange={(e) => {
                                        const newOpts = [...questionOptions];
                                        newOpts[idx] = e.target.value;
                                        setQuestionOptions(newOpts);
                                      }}
                                      placeholder={`Вариант ${idx + 1}`}
                                      className="flex-1 px-4 py-2 rounded-xl outline-none text-sm"
                                      style={{ ...inputStyle, color: textColors.primary, borderColor: isDuplicate ? "#F87171" : undefined }}
                                    />
                                    <div className="flex items-center gap-1">
                                      {questionOptions.length > 1 && (
                                        <button
                                          type="button"
                                          onClick={() => setQuestionOptions(prev => prev.filter((_, i) => i !== idx))}
                                          className="p-2 text-gray-400 hover:text-red-400"
                                        >
                                          <X className="w-4 h-4" />
                                        </button>
                                      )}
                                      <QuestionOptionMenu
                                        onDuplicate={() => {
                                          const newOpts = [...questionOptions];
                                          newOpts.splice(idx + 1, 0, opt);
                                          setQuestionOptions(newOpts);
                                        }}
                                        onMoveUp={idx > 0 ? () => {
                                          const newOpts = [...questionOptions];
                                          [newOpts[idx - 1], newOpts[idx]] = [newOpts[idx], newOpts[idx - 1]];
                                          setQuestionOptions(newOpts);
                                        } : undefined}
                                        onMoveDown={idx < questionOptions.length - 1 ? () => {
                                          const newOpts = [...questionOptions];
                                          [newOpts[idx], newOpts[idx + 1]] = [newOpts[idx + 1], newOpts[idx]];
                                          setQuestionOptions(newOpts);
                                        } : undefined}
                                      />
                                    </div>
                                  </div>
                                  {isDuplicate && (
                                    <p className="text-[10px] ml-6" style={{ color: "#F87171" }}>
                                      Такой вариант ответа уже существует
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                            <button
                              type="button"
                              onClick={() => setQuestionOptions([...questionOptions, ""])}
                              className="text-sm font-semibold text-blue-500 hover:text-blue-600 ml-6"
                            >
                              + Добавить вариант
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Instructions */}
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold" style={{ color: textColors.primary }}>
                      {mode === "material" ? t("optionalDescription") : t("optionalInstructions")}
                    </label>
                    <RichTextEditor value={instructionsHtml} onChange={setInstructionsHtml} />
                  </div>

                  {/* Attachments */}
                  <div className="space-y-3">
                    <label className="block text-sm font-semibold" style={{ color: textColors.primary }}>
                      Прикрепить
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <DriveButton />
                      <YoutubeButton />
                      <CreateDocsDropdown />
                      {mode !== "material" && (mode !== "assignmentWithTest" || !hasQuiz) && (
                        <button
                          type="button"
                          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold transition-colors"
                          style={{ background: "rgba(0,0,0,0.04)", color: textColors.secondary }}
                          onClick={() => setHasQuiz(true)}
                        >
                          <Plus className="w-4 h-4" />
                          Тест
                        </button>
                      )}
                      <UploadButton />
                      <LinkButton />
                    </div>

                    {/* Attachment previews */}
                    {videoUrls.length > 0 ||
                    attachmentUrls.length > 0 ||
                    attachmentLinks.length > 0 ||
                    hasQuiz ? (
                      <div className="space-y-3">
                        {videoUrls.length > 0 ? (
                          <div>
                            <p className="text-xs font-semibold mb-2" style={{ color: textColors.secondary }}>
                              Видео
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {videoUrls.map((u, i) => (
                                <VideoPreviewCard key={`${u}-${i}`} url={u} onRemove={() => setVideoUrls((prev) => prev.filter((_, idx) => idx !== i))} />
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {attachmentUrls.length > 0 ? (
                          <div>
                            <p className="text-xs font-semibold mb-2" style={{ color: textColors.secondary }}>
                              Файлы
                            </p>
                            <div className="space-y-2">
                              {attachmentUrls.map((u, i) => (
                                <FileAttachmentCard key={`${u}-${i}`} url={u} onRemove={() => setAttachmentUrls((prev) => prev.filter((_, idx) => idx !== i))} />
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {attachmentLinks.length > 0 ? (
                          <div>
                            <p className="text-xs font-semibold mb-2" style={{ color: textColors.secondary }}>
                              Ссылки
                            </p>
                            <div className="space-y-2">
                              {attachmentLinks.map((u, i) => (
                                <LinkAttachmentCard key={`${u}-${i}`} url={u} onRemove={() => setAttachmentLinks((prev) => prev.filter((_, idx) => idx !== i))} />
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {hasQuiz && (
                          <div className="mt-4">
                            <p className="text-xs font-semibold mb-2" style={{ color: textColors.secondary }}>
                              Тест
                            </p>
                            <div className="rounded-2xl p-4 flex items-center justify-between" style={glassStyle}>
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-purple-500 flex items-center justify-center text-white">
                                  <Plus className="w-6 h-6" />
                                </div>
                                <div>
                                  <p className="text-sm font-semibold" style={{ color: textColors.primary }}>Blank Quiz</p>
                                  <p className="text-xs" style={{ color: textColors.secondary }}>{t("googleForms")}</p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => setHasQuiz(false)}
                                className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                              >
                                <X className="w-5 h-5" style={{ color: textColors.secondary }} />
                              </button>
                            </div>

                            {/* Quiz Editor */}
                            <div className="mt-4 space-y-4">
                              {quizQuestions.map((q, qIdx) => (
                                <div key={qIdx} className="rounded-2xl p-5 space-y-4" style={glassStyle}>
                                  <div className="flex items-center justify-between gap-4">
                                    <input
                                      value={q.question}
                                      onChange={(e) => {
                                        const newQuestions = [...quizQuestions];
                                        newQuestions[qIdx].question = e.target.value;
                                        setQuizQuestions(newQuestions);
                                      }}
                                      placeholder={t("assignmentTypeQuestion")}
                                      className="flex-1 bg-transparent border-b border-gray-300 dark:border-gray-700 py-2 outline-none focus:border-blue-500 transition-colors"
                                      style={{ color: textColors.primary }}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => setQuizQuestions(prev => prev.filter((_, i) => i !== qIdx))}
                                      className="p-2 text-red-400 hover:text-red-500"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>

                                  <div className="space-y-2">
                                    {q.options.map((opt, oIdx) => (
                                      <div key={oIdx} className="flex items-center gap-3">
                                        <input
                                          type="radio"
                                          checked={q.correct_option_index === oIdx}
                                          onChange={() => {
                                            const newQuestions = [...quizQuestions];
                                            newQuestions[qIdx].correct_option_index = oIdx;
                                            setQuizQuestions(newQuestions);
                                          }}
                                          className="w-4 h-4 accent-blue-500"
                                        />
                                        <input
                                          value={opt}
                                          onChange={(e) => {
                                            const newQuestions = [...quizQuestions];
                                            newQuestions[qIdx].options[oIdx] = e.target.value;
                                            setQuizQuestions(newQuestions);
                                          }}
                                          placeholder={`Вариант ${oIdx + 1}`}
                                          className="flex-1 bg-transparent border-b border-gray-200 dark:border-gray-800 py-1 outline-none text-sm"
                                          style={{ color: textColors.primary }}
                                        />
                                        {q.options.length > 2 && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const newQuestions = [...quizQuestions];
                                              newQuestions[qIdx].options = newQuestions[qIdx].options.filter((_, i) => i !== oIdx);
                                              if (q.correct_option_index >= newQuestions[qIdx].options.length) {
                                                newQuestions[qIdx].correct_option_index = 0;
                                              }
                                              setQuizQuestions(newQuestions);
                                            }}
                                            className="p-1 text-gray-400 hover:text-red-400"
                                          >
                                            <X className="w-3 h-3" />
                                          </button>
                                        )}
                                      </div>
                                    ))}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const newQuestions = [...quizQuestions];
                                        newQuestions[qIdx].options.push("");
                                        setQuizQuestions(newQuestions);
                                      }}
                                      className="text-xs font-semibold text-blue-500 hover:text-blue-600 mt-2"
                                    >
                                      + Добавить вариант
                                    </button>
                                  </div>
                                </div>
                              ))}
                              <button
                                type="button"
                                onClick={() => setQuizQuestions([...quizQuestions, { question: "", options: ["", ""], correct_option_index: 0 }])}
                                className="w-full py-3 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700 text-sm font-semibold hover:border-blue-500 hover:text-blue-500 transition-all"
                                style={{ color: textColors.secondary }}
                              >
                                + {t("addQuestion")}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-2xl p-5 text-center" style={glassStyle}>
                        <p className="text-sm font-medium" style={{ color: textColors.secondary }}>
                          {t("noAttachments")}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Submit footer */}
                  {isAssignmentLike && (
                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        onClick={handleCreateAssignment}
                        disabled={submitting}
                        className="flex-1 py-3 rounded-2xl text-white font-semibold transition-all hover:shadow-lg disabled:opacity-50"
                        style={{ background: "linear-gradient(135deg,#3B82F6,#8B5CF6)" }}
                      >
                        {submitting
                          ? t("creating")
                          : mode === "assignmentWithTest"
                            ? t("assignmentCreateAssignmentWithTest")
                            : t("createAssignment")}
                      </button>
                    </div>
                  )}
                  {submitError ? (
                    <p className="text-sm" style={{ color: "#F87171" }}>
                      {submitError}
                    </p>
                  ) : null}
                </div>
              </div>

              {/* Right Panel */}
              <div className="p-5 lg:p-7">
                <div className="space-y-5">
                  {/* For whom */}
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold" style={{ color: textColors.primary }}>
                      {t("forWhom")}
                    </label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setForWhomOpen((o) => !o)}
                        className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-2xl text-sm font-semibold transition-colors"
                        style={{ ...inputStyle, color: textColors.primary }}
                      >
                        <span className="truncate">
                          {selectedGroupIds.length === 0
                            ? t("selectCourseGroup")
                            : t("groupsSelected").replace("{count}", String(selectedGroupIds.length))}
                        </span>
                        <ChevronDown className="w-4 h-4 opacity-70" />
                      </button>

                      {forWhomOpen ? (
                        <div
                          className="absolute z-10 mt-2 w-full max-h-64 overflow-y-auto rounded-2xl p-2"
                          style={{
                            background: isDark ? "rgba(26,34,56,0.95)" : "rgba(255,255,255,0.98)",
                            border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)"}`,
                            boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
                          }}
                        >
                          {availableGroups.length === 0 ? (
                            <p className="text-sm" style={{ color: textColors.secondary }}>
                              {t("noGroups")}
                            </p>
                          ) : (
                            availableGroups.map((g) => {
                              const checked = selectedGroupIds.includes(g.id);
                              return (
                                <label
                                  key={g.id}
                                  className="flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer hover:bg-black/5 dark:hover:bg-white/10"
                                  style={{ color: textColors.primary }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => {
                                      setSelectedGroupIds((prev) => {
                                        if (prev.includes(g.id)) return prev.filter((x) => x !== g.id);
                                        return [...prev, g.id];
                                      });
                                    }}
                                  />
                                  <div className="min-w-0">
                                    <div className="text-sm font-semibold truncate">{g.group_name}</div>
                                    <div className="text-xs truncate" style={{ color: textColors.secondary }}>
                                      {g.course_title}
                                    </div>
                                  </div>
                                </label>
                              );
                            })
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* Assign */}
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold" style={{ color: textColors.primary }}>
                      {t("assign")}
                    </label>
                    <button
                      type="button"
                      onClick={handleOpenStudentSelector}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-semibold transition-colors"
                      style={{ background: "linear-gradient(135deg,#10B981,#06B6D4)", color: "#FFFFFF" }}
                    >
                      <Users className="w-4 h-4" />
                      {t("allStudents")}
                    </button>
                  </div>

                  {/* Points */}
                  {mode !== "material" && (
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold" style={{ color: textColors.primary }}>
                        {t("points")}
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          value={pointsMode === "no_grade" ? 0 : maxPoints}
                          onChange={(e) => setMaxPoints(Math.max(0, parseInt(e.target.value || "0", 10) || 0))}
                          disabled={pointsMode === "no_grade"}
                          className="w-full px-4 py-3 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/40 text-sm font-semibold"
                          style={{
                            ...inputStyle,
                            color: textColors.primary,
                            opacity: pointsMode === "no_grade" ? 0.65 : 1,
                          }}
                        />
                        <select
                          value={pointsMode}
                          onChange={(e) => setPointsMode(e.target.value as any)}
                          className="px-4 py-3 rounded-2xl text-sm font-semibold outline-none"
                          style={{ ...inputStyle, color: textColors.primary }}
                        >
                          <option value="graded">{t("graded")}</option>
                          <option value="no_grade">{t("noGrade")}</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Due date */}
                  {mode !== "material" && (
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold" style={{ color: textColors.primary }}>
                        {t("dueDate")}
                      </label>
                      <div className="relative">
                        <select
                          value={dueMode}
                          onChange={(e) => setDueMode(e.target.value as any)}
                          className="w-full px-4 py-3 rounded-2xl text-sm font-semibold outline-none"
                          style={{ ...inputStyle, color: textColors.primary }}
                        >
                          <option value="none">{t("noDueDate")}</option>
                          <option value="date">{t("setDueDate")}</option>
                        </select>
                      </div>
                      {dueMode === "date" ? (
                        <div className="mt-2 flex items-center gap-2">
                          <CalendarDays className="w-4 h-4 shrink-0" style={{ color: textColors.secondary }} />
                          <input
                            type="date"
                            value={dueDateYMD}
                            onChange={(e) => setDueDateYMD(e.target.value)}
                            className="w-full px-4 py-3 rounded-2xl outline-none text-sm font-semibold"
                            style={{ ...inputStyle, color: textColors.primary }}
                          />
                        </div>
                      ) : null}
                      {dueMode === "date" && dueDateYMD ? (
                        <p className="text-xs mt-1" style={{ color: textColors.secondary }}>
                          {formatDDMMYYYY(new Date(`${dueDateYMD}T00:00:00.000Z`))}
                        </p>
                      ) : null}
                    </div>
                  )}

                  {/* Topic */}
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold" style={{ color: textColors.primary }}>
                      {t("topic")}
                    </label>
                    <select
                      value={topicId === null ? "none" : String(topicId)}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === "none") setTopicId(null);
                        else if (v === "create") {
                          setTopicCreateOpen(true);
                        } else {
                          setTopicId(Number(v));
                        }
                      }}
                      className="w-full px-4 py-3 rounded-2xl text-sm font-semibold outline-none"
                      style={{ ...inputStyle, color: textColors.primary }}
                    >
                      <option value="none">{t("assignmentNoTopic")}</option>
                      {topics.map((tpc) => (
                        <option key={tpc.id} value={tpc.id}>
                          {tpc.title}
                        </option>
                      ))}
                      <option value="create">{t("createTopic")}</option>
                    </select>
                  </div>

                  {/* Rubric */}
                  {isAssignmentLike && (
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold" style={{ color: textColors.primary }}>
                        {t("assignmentRubricCriterion")}
                      </label>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setRubricDropdownOpen((o) => !o)}
                          className="w-full flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-semibold transition-colors"
                          style={{ ...inputStyle, color: textColors.primary }}
                        >
                          <span>+ {t("assignmentRubricCriterion")}</span>
                          <ChevronDown className="w-4 h-4 opacity-70" />
                        </button>
                        {rubricDropdownOpen ? (
                          <div
                            className="absolute z-10 mt-2 w-full rounded-2xl overflow-hidden"
                            style={{
                              background: isDark ? "rgba(26,34,56,0.95)" : "rgba(255,255,255,0.98)",
                              border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)"}`,
                              boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
                            }}
                          >
                            <button
                              type="button"
                              className="w-full text-left px-4 py-3 text-sm font-semibold hover:bg-black/5 dark:hover:bg-white/10"
                              onClick={() => {
                                setRubricDropdownOpen(false);
                                setRubricCreatorOpen(true);
                              }}
                            >
                              Создать критерий оценки
                            </button>
                            <button
                              type="button"
                              className="w-full text-left px-4 py-3 text-sm font-semibold hover:bg-black/5 dark:hover:bg-white/10"
                              onClick={() => {
                                setRubricDropdownOpen(false);
                                setRubricCreatorOpen(true);
                                // Reuse current state as-is.
                              }}
                            >
                              Повторно использовать критерий оценки
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  )}

                  {/* Question specific checkboxes */}
                  {mode === "question" && (
                    <div className="space-y-3 pt-2">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={canComment}
                          onChange={(e) => setCanComment(e.target.checked)}
                          className="w-4 h-4 rounded accent-blue-500"
                        />
                        <span className="text-sm" style={{ color: textColors.primary }}>
                          Учащиеся могут комментировать ответы друг друга
                        </span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={canEdit}
                          onChange={(e) => setCanEdit(e.target.checked)}
                          className="w-4 h-4 rounded accent-blue-500"
                        />
                        <span className="text-sm" style={{ color: textColors.primary }}>
                          Учащиеся могут редактировать ответы
                        </span>
                      </label>
                    </div>
                  )}

                  {/* Small rubric preview */}
                  {isAssignmentLike && rubricPayload.length > 0 ? (
                    <div className="rounded-2xl p-4" style={glassStyle}>
                      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: textColors.secondary }}>
                        Предварительный просмотр
                      </p>
                      <ul className="mt-2 space-y-1">
                        {rubricPayload.slice(0, 4).map((r, i) => (
                          <li key={`${r.name}-${i}`} className="flex items-center justify-between gap-3">
                            <span className="text-sm truncate" style={{ color: textColors.primary }}>{r.name}</span>
                            <span className="text-xs font-semibold" style={{ color: textColors.secondary }}>
                              {r.max_points}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : (
            // Rubric Creator full-screen view inside the modal
            <div className="p-5 lg:p-7">
              <div
                className="rounded-3xl overflow-hidden"
                style={{
                  background: isDark ? "rgba(26,34,56,0.6)" : "rgba(255,255,255,0.55)",
                  border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}`,
                }}
              >
                <div className="flex items-center justify-between gap-4 px-5 py-4 border-b" style={{ borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}>
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold font-geologica" style={{ color: textColors.primary }}>
                      {t("assignmentTypeAssignment")}
                    </h2>
                    <p className="text-xs mt-1" style={{ color: textColors.secondary }}>
                      {t("createRubric")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCreateAssignment}
                      disabled={submitting}
                      className="flex items-center gap-2 px-5 py-3 rounded-2xl text-white font-semibold disabled:opacity-50 transition-all hover:shadow-lg"
                      style={{ background: "linear-gradient(135deg,#3B82F6,#8B5CF6)" }}
                    >
                      {t("createAssignment")}
                      <ChevronDown className="w-4 h-4 opacity-90" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setRubricCreatorOpen(false)}
                      className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                    >
                      <X className="w-5 h-5" style={{ color: textColors.secondary }} />
                    </button>
                  </div>
                </div>

                <div className="p-5 lg:p-7 space-y-5">
                  <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold" style={{ color: textColors.primary }}>
                        Название
                      </label>
                      <input
                        value={rubricTitle}
                        onChange={(e) => setRubricTitle(e.target.value)}
                        className="w-full px-4 py-3 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/40 text-sm font-semibold"
                        style={{ ...inputStyle, color: textColors.primary }}
                      />
                    </div>

                    <div className="space-y-3">
                      <label className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl" style={glassStyle}>
                        <span className="text-sm font-semibold" style={{ color: textColors.primary }}>
                          Использовать систему баллов
                        </span>
                        <input
                          type="checkbox"
                          checked={rubricUsePoints}
                          onChange={(e) => setRubricUsePoints(e.target.checked)}
                        />
                      </label>
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold" style={{ color: textColors.primary }}>
                          Сортировка
                        </label>
                        <select
                          value={rubricSortDesc ? "desc" : "asc"}
                          onChange={(e) => setRubricSortDesc(e.target.value === "desc")}
                          className="w-full px-4 py-3 rounded-2xl text-sm font-semibold outline-none"
                          style={{ ...inputStyle, color: textColors.primary }}
                        >
                          <option value="desc">{t("sortByPointsDesc")}</option>
                          <option value="asc">{t("sortByPointsAsc")}</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Criteria */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold" style={{ color: textColors.primary }}>
                        Условия
                      </h3>
                      <button
                        type="button"
                        onClick={() =>
                          setRubricConditions((prev) => [
                            ...prev,
                            { name: "", description: "", levels: [{ name: "", points: 0 }] },
                          ])
                        }
                        className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold transition-colors"
                        style={{ background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)", color: textColors.secondary }}
                      >
                        <Plus className="w-4 h-4" />
                        {t("addCondition")}
                      </button>
                    </div>

                    <div className="space-y-3">
                      {rubricConditions.map((cond, idx) => (
                        <div key={idx} className="rounded-3xl p-4" style={glassStyle}>
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <label className="block text-xs font-semibold uppercase tracking-wider" style={{ color: textColors.secondary }}>
                                {t("conditionName")}
                              </label>
                              <input
                                value={cond.name}
                                onChange={(e) =>
                                  setRubricConditions((prev) =>
                                    prev.map((c, j) => (j === idx ? { ...c, name: e.target.value } : c))
                                  )
                                }
                                className="w-full px-4 py-3 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/40 text-sm font-semibold"
                                style={{ ...inputStyle, color: textColors.primary }}
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="block text-xs font-semibold uppercase tracking-wider" style={{ color: textColors.secondary }}>
                                {t("conditionDescription")}
                              </label>
                              <input
                                value={cond.description}
                                onChange={(e) =>
                                  setRubricConditions((prev) =>
                                    prev.map((c, j) => (j === idx ? { ...c, description: e.target.value } : c))
                                  )
                                }
                                className="w-full px-4 py-3 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/40 text-sm font-semibold"
                                style={{ ...inputStyle, color: textColors.primary }}
                              />
                            </div>
                          </div>

                          <div className="mt-4 space-y-3">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: textColors.secondary }}>
                                {t("levels")}
                              </p>
                              <button
                                type="button"
                                onClick={() =>
                                  setRubricConditions((prev) =>
                                    prev.map((c, j) =>
                                      j === idx ? { ...c, levels: [...c.levels, { name: "", points: 0 }] } : c
                                    )
                                  )
                                }
                                className="flex items-center gap-2 px-3 py-2 rounded-2xl text-xs font-semibold transition-colors"
                                style={{ background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)", color: textColors.secondary }}
                              >
                                <Plus className="w-3.5 h-3.5" />
                                {t("addLevel")}
                              </button>
                            </div>

                            <div className="space-y-2">
                              {cond.levels.map((lvl, lidx) => (
                                <div key={lidx} className="flex items-center gap-2">
                                  <input
                                    value={lvl.name}
                                    onChange={(e) =>
                                      setRubricConditions((prev) =>
                                        prev.map((c, j) =>
                                          j === idx
                                            ? {
                                                ...c,
                                                levels: c.levels.map((x, k) => (k === lidx ? { ...x, name: e.target.value } : x)),
                                              }
                                            : c
                                        )
                                      )
                                    }
                                    placeholder={t("levelName")}
                                    className="flex-1 px-4 py-3 rounded-2xl outline-none text-sm font-semibold"
                                    style={{ ...inputStyle, color: textColors.primary, opacity: rubricUsePoints ? 1 : 0.75 }}
                                    disabled={!rubricUsePoints}
                                  />
                                  <input
                                    type="number"
                                    value={lvl.points}
                                    onChange={(e) => {
                                      const v = parseFloat(e.target.value || "0");
                                      setRubricConditions((prev) =>
                                        prev.map((c, j) =>
                                          j === idx
                                            ? {
                                                ...c,
                                                levels: c.levels.map((x, k) =>
                                                  k === lidx ? { ...x, points: Number.isFinite(v) ? v : 0 } : x
                                                ),
                                              }
                                            : c
                                        )
                                      );
                                    }}
                                    placeholder="0"
                                    className="w-28 px-4 py-3 rounded-2xl outline-none text-sm font-semibold"
                                    style={{ ...inputStyle, color: textColors.primary, opacity: rubricUsePoints ? 1 : 0.75 }}
                                    disabled={!rubricUsePoints}
                                  />
                                  <button
                                    type="button"
                                    className="p-3 rounded-2xl text-red-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                                    onClick={() =>
                                      setRubricConditions((prev) =>
                                        prev.map((c, j) =>
                                          j === idx ? { ...c, levels: c.levels.filter((_, k) => k !== lidx) } : c
                                        )
                                      )
                                    }
                                    aria-label={t("deleteLevel")}
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setRubricCreatorOpen(false)}
                      className="flex-1 py-3 rounded-2xl text-white font-semibold transition-all hover:shadow-lg"
                      style={{ background: "linear-gradient(135deg,#10B981,#06B6D4)" }}
                    >
                      Сохранить
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Topic Create Dialog */}
        {topicCreateOpen ? (
          <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-center justify-center" onClick={() => setTopicCreateOpen(false)}>
            <div className="max-w-xl w-full mx-4 rounded-3xl p-6 overflow-hidden" style={modalStyle} onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold font-geologica" style={{ color: textColors.primary }}>
                  {t("createTopic")}
                </h3>
                <button type="button" onClick={() => setTopicCreateOpen(false)} className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10">
                  <X className="w-5 h-5" style={{ color: textColors.secondary }} />
                </button>
              </div>
              <div className="space-y-3">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold" style={{ color: textColors.primary }}>
                    {t("topic")}
                  </label>
                  <input
                    value={topicCreateTitle}
                    onChange={(e) => setTopicCreateTitle(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/40 text-sm font-semibold"
                    style={{ ...inputStyle, color: textColors.primary }}
                    placeholder={t("topicTitlePlaceholder")}
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold" style={{ color: textColors.primary }}>
                    {t("optionalDescription")}
                  </label>
                  <input
                    value={topicCreateDesc}
                    onChange={(e) => setTopicCreateDesc(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/40 text-sm font-semibold"
                    style={{ ...inputStyle, color: textColors.primary }}
                    placeholder={t("topicDescriptionPlaceholder")}
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <button
                  type="button"
                  onClick={() => createTopicMutation.mutate()}
                  disabled={createTopicMutation.isPending || !topicCreateTitle.trim()}
                  className="flex-1 py-3 rounded-2xl text-white font-semibold transition-all disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg,#F59E0B,#EF4444)" }}
                >
                  {createTopicMutation.isPending ? t("creating") : t("teacherSave")}
                </button>
                <button
                  type="button"
                  onClick={() => setTopicCreateOpen(false)}
                  className="flex-1 py-3 rounded-2xl text-sm font-semibold transition-colors"
                  style={{ background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)", color: textColors.secondary }}
                >
                  {t("teacherCancel")}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* Student Selector Dialog */}
        {studentSelectorOpen ? (
          <div className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm flex items-center justify-center p-2" onClick={() => setStudentSelectorOpen(false)}>
            <div className="max-w-2xl w-full rounded-3xl p-6 overflow-hidden" style={modalStyle} onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-lg font-semibold font-geologica" style={{ color: textColors.primary }}>
                    {t("assign")}
                  </h3>
                  <p className="text-xs mt-1" style={{ color: textColors.secondary }}>
                    {t("selectStudentsDemo")}
                  </p>
                </div>
                <button type="button" onClick={() => setStudentSelectorOpen(false)} className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10">
                  <X className="w-5 h-5" style={{ color: textColors.secondary }} />
                </button>
              </div>

              {studentSelectorStudentsQuery.isFetching ? (
                <p className="text-sm" style={{ color: textColors.secondary }}>
                  {t("loading")}...
                </p>
              ) : students.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-10 gap-3">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" }}>
                    <Users className="w-7 h-7" style={{ color: textColors.secondary }} />
                  </div>
                  <p className="text-sm font-semibold" style={{ color: textColors.secondary }}>
                    {t("noStudentsOnCourse")}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setStudentSelectorOpen(false);
                      onInviteStudents();
                    }}
                    className="px-5 py-3 rounded-2xl text-sm font-semibold transition-colors"
                    style={{ background: "linear-gradient(135deg,#10B981,#06B6D4)", color: "#fff" }}
                  >
                    {t("inviteStudentsLabel")}
                  </button>
                </div>
              ) : (
                <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
                  {students.map((s) => {
                    const checked = !!selectedStudentIds[s.id];
                    return (
                      <label
                        key={s.id}
                        className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl cursor-pointer hover:bg-black/5 dark:hover:bg-white/10"
                        style={{ border: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}` }}
                      >
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold truncate" style={{ color: textColors.primary }}>
                            {s.full_name || s.email}
                          </span>
                          <span className="block text-xs truncate" style={{ color: textColors.secondary }}>
                            {s.email}
                          </span>
                        </span>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setSelectedStudentIds((prev) => ({ ...prev, [s.id]: !prev[s.id] }));
                          }}
                        />
                      </label>
                    );
                  })}
                </div>
              )}

              <div className="flex gap-2 mt-5">
                <button
                  type="button"
                  onClick={() => setStudentSelectorOpen(false)}
                  className="flex-1 py-3 rounded-2xl text-sm font-semibold transition-colors"
                  style={{ background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)", color: textColors.secondary }}
                >
                  {t("done")}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* YouTube Dialog */}
        {youtubeDialogOpen ? (
          <div className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-sm flex items-center justify-center p-2" onClick={() => setYoutubeDialogOpen(false)}>
            <div className="max-w-xl w-full rounded-3xl p-6 overflow-hidden" style={modalStyle} onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold font-geologica" style={{ color: textColors.primary }}>
                  YouTube
                </h3>
                <button type="button" onClick={() => setYoutubeDialogOpen(false)} className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10">
                  <X className="w-5 h-5" style={{ color: textColors.secondary }} />
                </button>
              </div>
              <div className="space-y-3">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold" style={{ color: textColors.primary }}>
                    {t("searchOptional")}
                  </label>
                  <input
                    value={youtubeSearch}
                    onChange={(e) => setYoutubeSearch(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/40 text-sm font-semibold"
                    style={{ ...inputStyle, color: textColors.primary }}
                    placeholder={t("searchPlaceholder")}
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold" style={{ color: textColors.primary }}>
                    {t("videoUrl")}
                  </label>
                  <input
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/40 text-sm font-semibold"
                    style={{ ...inputStyle, color: textColors.primary }}
                    placeholder="https://youtube.com/watch?v=..."
                  />
                  {youtubeUrlError ? (
                    <p className="text-xs" style={{ color: "#F87171" }}>
                      {youtubeUrlError}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <button
                  type="button"
                  onClick={() => {
                    if (!isValidHttpUrl(youtubeUrl)) {
                      setYoutubeUrlError(t("invalidUrl"));
                      return;
                    }
                    setYoutubeUrlError(null);
                    setVideoUrls((prev) => (prev.includes(youtubeUrl.trim()) ? prev : [...prev, youtubeUrl.trim()]));
                    setYoutubeDialogOpen(false);
                    setYoutubeUrl("");
                    setYoutubeSearch("");
                  }}
                  className="flex-1 py-3 rounded-2xl text-white font-semibold disabled:opacity-50 transition-all hover:shadow-lg"
                  style={{ background: "linear-gradient(135deg,#3B82F6,#8B5CF6)" }}
                >
                  {t("teacherSave")}
                </button>
                <button
                  type="button"
                  onClick={() => setYoutubeDialogOpen(false)}
                  className="flex-1 py-3 rounded-2xl text-sm font-semibold transition-colors"
                  style={{ background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)", color: textColors.secondary }}
                >
                  {t("teacherCancel")}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* Link Dialog */}
        {linkDialogOpen ? (
          <div className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-sm flex items-center justify-center p-2" onClick={() => setLinkDialogOpen(false)}>
            <div className="max-w-xl w-full rounded-3xl p-6 overflow-hidden" style={modalStyle} onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold font-geologica" style={{ color: textColors.primary }}>
                  {t("addLink")}
                </h3>
                <button type="button" onClick={() => setLinkDialogOpen(false)} className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10">
                  <X className="w-5 h-5" style={{ color: textColors.secondary }} />
                </button>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold" style={{ color: textColors.primary }}>
                  URL
                </label>
                <input
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/40 text-sm font-semibold"
                  style={{ ...inputStyle, color: textColors.primary }}
                  placeholder="https://..."
                />
                {linkUrlError ? (
                  <p className="text-xs" style={{ color: "#F87171" }}>
                    {linkUrlError}
                  </p>
                ) : null}
              </div>

              <div className="flex gap-2 mt-5">
                <button
                  type="button"
                  onClick={() => {
                    if (!isValidHttpUrl(linkUrl)) {
                      setLinkUrlError(t("invalidUrl"));
                      return;
                    }
                    setLinkUrlError(null);
                    setAttachmentLinks((prev) => (prev.includes(linkUrl.trim()) ? prev : [...prev, linkUrl.trim()]));
                    setLinkDialogOpen(false);
                    setLinkUrl("");
                  }}
                  className="flex-1 py-3 rounded-2xl text-white font-semibold disabled:opacity-50 transition-all hover:shadow-lg"
                  style={{ background: "linear-gradient(135deg,#3B82F6,#8B5CF6)" }}
                >
                  {t("teacherSave")}
                </button>
                <button
                  type="button"
                  onClick={() => setLinkDialogOpen(false)}
                  className="flex-1 py-3 rounded-2xl text-sm font-semibold transition-colors"
                  style={{ background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)", color: textColors.secondary }}
                >
                  {t("teacherCancel")}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* Create Attachment Dialog */}
        {createAttachmentDialogOpen ? (
          <div
            className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-sm flex items-center justify-center p-2"
            onClick={() => setCreateAttachmentDialogOpen(false)}
          >
            <div className="max-w-xl w-full rounded-3xl p-6 overflow-hidden" style={modalStyle} onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold font-geologica" style={{ color: textColors.primary }}>
                  {t("addLink")}: {createAttachmentType ? t(createAttachmentType as any) : ""}
                </h3>
                <button type="button" onClick={() => setCreateAttachmentDialogOpen(false)} className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10">
                  <X className="w-5 h-5" style={{ color: textColors.secondary }} />
                </button>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold" style={{ color: textColors.primary }}>
                  URL
                </label>
                <input
                  value={createAttachmentUrl}
                  onChange={(e) => setCreateAttachmentUrl(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/40 text-sm font-semibold"
                  style={{ ...inputStyle, color: textColors.primary }}
                  placeholder="https://..."
                />
              </div>
              <div className="flex gap-2 mt-5">
                <button
                  type="button"
                  onClick={() => {
                    if (!isValidHttpUrl(createAttachmentUrl)) return;
                    setAttachmentLinks((prev) =>
                      prev.includes(createAttachmentUrl.trim()) ? prev : [...prev, createAttachmentUrl.trim()]
                    );
                    setCreateAttachmentDialogOpen(false);
                    setCreateAttachmentType(null);
                    setCreateAttachmentUrl("");
                  }}
                  className="flex-1 py-3 rounded-2xl text-white font-semibold disabled:opacity-50 transition-all hover:shadow-lg"
                  style={{ background: "linear-gradient(135deg,#3B82F6,#8B5CF6)" }}
                >
                  {t("teacherSave")}
                </button>
                <button
                  type="button"
                  onClick={() => setCreateAttachmentDialogOpen(false)}
                  className="flex-1 py-3 rounded-2xl text-sm font-semibold transition-colors"
                  style={{ background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)", color: textColors.secondary }}
                >
                  {t("teacherCancel")}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* Hidden file inputs */}
        <input
          type="file"
          accept={attachmentInputAccept}
          className="hidden"
          id="teacher-assignment-disk"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const url = await uploadFile(file);
            setAttachmentUrls((prev) => [...prev, url]);
            e.target.value = "";
          }}
        />

        <input
          type="file"
          accept={attachmentInputAccept}
          className="hidden"
          id="teacher-assignment-upload"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const url = await uploadFile(file);
            setAttachmentUrls((prev) => [...prev, url]);
            e.target.value = "";
          }}
        />

        {/* Local button components for attachments */}
        {/** eslint-disable-next-line react/no-unknown-property */}
        <div className="hidden">
          <span>{lang}</span>
        </div>
      </div>
    </div>
  );

  function DriveButton() {
    return (
      <label
        className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold cursor-pointer transition-colors"
        style={{ background: "rgba(0,0,0,0.04)", color: textColors.secondary }}
        onClick={() => {
          const el = document.getElementById("teacher-assignment-disk") as HTMLInputElement | null;
          el?.click();
        }}
      >
        <Paperclip className="w-4 h-4" style={{ color: textColors.secondary }} />
        {t("drive")}
      </label>
    );
  }

  function UploadButton() {
    return (
      <label
        className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold cursor-pointer transition-colors"
        style={{ background: "rgba(0,0,0,0.04)", color: textColors.secondary }}
        onClick={() => {
          const el = document.getElementById("teacher-assignment-upload") as HTMLInputElement | null;
          el?.click();
        }}
      >
        <Upload className="w-4 h-4" style={{ color: textColors.secondary }} />
        {t("upload")}
      </label>
    );
  }

  function YoutubeButton() {
    return (
      <button
        type="button"
        className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold transition-colors"
        style={{ background: "rgba(0,0,0,0.04)", color: textColors.secondary }}
        onClick={() => {
          setYoutubeUrlError(null);
          setYoutubeDialogOpen(true);
        }}
      >
        <span style={{ fontWeight: 900 }}>YouTube</span>
      </button>
    );
  }

  function LinkButton() {
    return (
      <button
        type="button"
        className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold transition-colors"
        style={{ background: "rgba(0,0,0,0.04)", color: textColors.secondary }}
        onClick={() => {
          setLinkUrlError(null);
          setLinkDialogOpen(true);
        }}
      >
        <LinkIcon className="w-4 h-4" style={{ color: textColors.secondary }} />
        {t("linkOption")}
      </button>
    );
  }

  function CreateDocsDropdown() {
    const [open, setOpen] = useState(false);
    const items = ["docs", "presentations", "spreadsheets"] as const;
    return (
      <div className="relative">
        <button
          type="button"
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold transition-colors"
          style={{ background: "rgba(0,0,0,0.04)", color: textColors.secondary }}
          onClick={() => setOpen((o) => !o)}
        >
          {t("createAssignment")} <ChevronDown className="w-4 h-4 opacity-70" />
        </button>
        {open ? (
          <div
            className="absolute left-0 mt-2 z-[90] w-56 rounded-2xl overflow-hidden"
            style={{
              background: isDark ? "rgba(26,34,56,0.95)" : "rgba(255,255,255,0.98)",
              border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)"}`,
              boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
            }}
          >
            {items.map((it) => (
              <button
                key={it}
                type="button"
                className="w-full text-left px-4 py-3 text-sm font-semibold hover:bg-black/5 dark:hover:bg-white/10"
                onClick={() => {
                  setOpen(false);
                  setCreateAttachmentType(it);
                  setCreateAttachmentUrl("");
                  setCreateAttachmentDialogOpen(true);
                }}
              >
                {t(it as any)}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  function QuestionOptionMenu({ onDuplicate, onMoveUp, onMoveDown }: { onDuplicate: () => void; onMoveUp?: () => void; onMoveDown?: () => void }) {
    const [open, setOpen] = useState(false);
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="p-2 text-gray-400 hover:text-gray-600"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
        {open && (
          <div
            className="absolute right-0 mt-1 z-[100] w-48 rounded-xl overflow-hidden shadow-xl border"
            style={{
              background: isDark ? "rgba(26,34,56,0.98)" : "#FFFFFF",
              borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
            }}
          >
            <button
              type="button"
              className="w-full text-left px-4 py-2 text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/10"
              onClick={() => { onDuplicate(); setOpen(false); }}
              style={{ color: textColors.primary }}
            >
              {t("duplicate")}
            </button>
            {onMoveUp && (
              <button
                type="button"
                className="w-full text-left px-4 py-2 text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/10"
                onClick={() => { onMoveUp(); setOpen(false); }}
                style={{ color: textColors.primary }}
              >
                {t("moveUp")}
              </button>
            )}
            {onMoveDown && (
              <button
                type="button"
                className="w-full text-left px-4 py-2 text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/10"
                onClick={() => { onMoveDown(); setOpen(false); }}
                style={{ color: textColors.primary }}
              >
                {t("moveDown")}
              </button>
            )}
          </div>
        )}
      </div>
    );
  }
}
