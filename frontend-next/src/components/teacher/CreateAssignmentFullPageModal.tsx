"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X, Plus, ChevronDown, Paperclip, Upload, Link as LinkIcon, CalendarDays, Users, Loader2 } from "lucide-react";
import { ALLOWED_EXTENSIONS_STR, ALLOWED_EXTENSIONS_HINT } from "@/constants/fileTypes";
import { api } from "@/api/client";
import { useLanguage } from "@/context/LanguageContext";
import { mapApiErrorToUserMessage } from "@/lib/mapApiError";
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
  mode?: "assignment" | "assignmentWithTest" | "material" | "question";
  initialData?: any;
};

function formatDDMMYYYY(d: Date) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function formatLocalDateTimePreview(ymd: string, hm: string, locale: string) {
  const iso = localDateTimeToIso(ymd, hm);
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString(locale === "kk" ? "kk-KZ" : locale === "en" ? "en-US" : "ru-RU", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return formatDDMMYYYY(new Date(iso));
  }
}

/** Local calendar date + time → UTC ISO (browser timezone). */
function localDateTimeToIso(ymd: string, hm: string): string | undefined {
  if (!ymd?.trim()) return undefined;
  const p = ymd.split("-").map((x) => parseInt(x, 10));
  const yy = p[0];
  const mo = p[1];
  const dd = p[2];
  if (!yy || !mo || !dd) return undefined;
  const [hs, ms] = (hm || "23:59").split(":");
  const hh = parseInt(hs, 10);
  const mm = parseInt(ms, 10);
  const dt = new Date(yy, mo - 1, dd, Number.isFinite(hh) ? hh : 23, Number.isFinite(mm) ? mm : 59, 0, 0);
  return dt.toISOString();
}

function parseIsoToLocalDateParts(iso: string): { ymd: string; hm: string } {
  const d = new Date(iso);
  const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return { ymd, hm };
}

type ReusableRubricItem = {
  assignment_id: number;
  title: string;
  course_id: number;
  course_title: string;
  group_name: string;
  criteria_count: number;
  total_points: number;
  rubric: Array<{
    id?: number;
    name: string;
    max_points: number;
    description?: string;
    levels?: Array<{ text?: string; points?: number }>;
  }>;
};

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
  const isQuestionMode = mode === "question";
  const queryClient = useQueryClient();
  const { t, lang } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const glassStyle = getGlassCardStyle(theme);
  const inputStyle = getInputStyle(theme);
  const modalStyle = getModalStyle(theme);
  const textColors = getTextColors(theme);

  const availableGroups = useMemo(
    () => teacherGroups,
    [teacherGroups]
  );

  const courseFilterOptions = useMemo(() => {
    const m = new Map<number, string>();
    for (const g of teacherGroups) {
      if (!m.has(g.course_id)) m.set(g.course_id, g.course_title);
    }
    return Array.from(m.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [teacherGroups]);

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
  const [dueTimeHM, setDueTimeHM] = useState<string>("23:59");
  const [rejectAfterDeadline, setRejectAfterDeadline] = useState(true);

  const [pointsMode, setPointsMode] = useState<"graded" | "no_grade">("graded");
  const [maxPoints, setMaxPoints] = useState<number>(100);
  /** When true, max points track the rubric sum; false = teacher set total manually. */
  const [maxPointsFollowsRubric, setMaxPointsFollowsRubric] = useState(true);

  const [topicId, setTopicId] = useState<number | null>(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);
  const [testPassingScore, setTestPassingScore] = useState<number>(70);

  const [topicCreateOpen, setTopicCreateOpen] = useState(false);
  const [topicCreateTitle, setTopicCreateTitle] = useState("");
  const [topicCreateDesc, setTopicCreateDesc] = useState("");
  const [isSynopsis, setIsSynopsis] = useState(false);
  const [isSupplementary, setIsSupplementary] = useState(false);


  const [rubricDropdownOpen, setRubricDropdownOpen] = useState(false);
  const [rubricCreatorOpen, setRubricCreatorOpen] = useState(false);
  const [rubricReuseOpen, setRubricReuseOpen] = useState(false);
  const [rubricReuseCourseId, setRubricReuseCourseId] = useState<number | "all">("all");

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
  const [questionText, setQuestionText] = useState("");
  const [questionType, setQuestionType] = useState<"single_choice" | "open">("single_choice");
  const [questionOptions, setQuestionOptions] = useState<string[]>(["", ""]);
  const [correctOption, setCorrectOption] = useState("");


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
  const submittingRef = useRef(false);
  /** Raw API error payload; mapped with current `t` on render so language switches apply. */
  const [submitErrorDetail, setSubmitErrorDetail] = useState<unknown>(null);
  const submitErrorMessage = useMemo(
    () =>
      submitErrorDetail == null
        ? null
        : mapApiErrorToUserMessage(submitErrorDetail, t, "assignmentErrorCreate"),
    [submitErrorDetail, t]
  );

  const rubricAutoTotal = useMemo(() => {
    if (pointsMode === "no_grade") return null;
    if (!rubricUsePoints || rubricPayload.length === 0) return null;
    return rubricPayload.reduce((s, r) => s + (Number(r.max_points) || 0), 0);
  }, [pointsMode, rubricUsePoints, rubricPayload]);

  useEffect(() => {
    if (pointsMode === "no_grade") return;
    if (!maxPointsFollowsRubric) return;
    if (rubricAutoTotal != null) {
      setMaxPoints(rubricAutoTotal);
    }
  }, [rubricAutoTotal, pointsMode, maxPointsFollowsRubric]);

  const reusableRubricsQuery = useQuery({
    queryKey: ["teacher-reusable-rubrics", rubricReuseCourseId],
    queryFn: async (): Promise<ReusableRubricItem[]> => {
      const params = new URLSearchParams();
      if (rubricReuseCourseId !== "all") params.set("course_id", String(rubricReuseCourseId));
      const q = params.toString();
      const { data } = await api.get<ReusableRubricItem[]>(q ? `/teacher/rubrics/reusable?${q}` : "/teacher/rubrics/reusable");
      return Array.isArray(data) ? data : [];
    },
    enabled: rubricReuseOpen,
    staleTime: 0,
  });

  const applyReusedRubricRows = (rows: ReusableRubricItem["rubric"]) => {
    setRubricConditions(
      rows.map((r) => {
        const apiLevels = Array.isArray(r.levels) ? r.levels : [];
        const levelsFromApi =
          apiLevels.length > 0
            ? apiLevels.map((lv) => ({
                name: typeof lv.text === "string" ? lv.text : "",
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
    setRubricReuseOpen(false);
    setRubricDropdownOpen(false);
  };

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
      if (initialData.deadline) {
        setDueMode("date");
        const { ymd, hm } = parseIsoToLocalDateParts(String(initialData.deadline));
        setDueDateYMD(ymd);
        setDueTimeHM(hm);
      } else {
        setDueMode("none");
        setDueDateYMD("");
        setDueTimeHM("23:59");
        setRejectAfterDeadline(true);
      }
      if (initialData.reject_submissions_after_deadline !== undefined && initialData.reject_submissions_after_deadline !== null) {
        setRejectAfterDeadline(!!initialData.reject_submissions_after_deadline);
      } else if (initialData.deadline) {
        setRejectAfterDeadline(true);
      }
      setIsSynopsis(!!initialData.is_synopsis);
      setIsSupplementary(!!initialData.is_supplementary);
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
      setDueTimeHM("23:59");
      setRejectAfterDeadline(true);
    }

    setTitleTouched(false);
    setSelectedGroupIds([currentGroup.id]);
    setForWhomOpen(false);
    setStudentSelectorOpen(false);
    setStudentSelectorGroupId(null);
    if (!initialData) {
      setDueMode("none");
      setDueDateYMD("");
      setDueTimeHM("23:59");
      setRejectAfterDeadline(true);
    }
    setTopicCreateOpen(false);
    setTopicCreateTitle("");
    setTopicCreateDesc("");
    setRubricDropdownOpen(false);
    setRubricCreatorOpen(false);
    setRubricReuseOpen(false);
    setRubricReuseCourseId("all");
    setRubricTitle(t("assignmentRubricCriterion"));
    setRubricUsePoints(true);
    setRubricSortDesc(true);
    setQuizQuestions([{ question: "", options: ["", ""], correct_option_index: 0 }]);
    setQuestionText("");
    setQuestionType("single_choice");
    setQuestionOptions(["", ""]);
    setCorrectOption("");

    if (initialData) {
      if (mode === "question") {
        setQuestionText(initialData.question_text || "");
        setQuestionType(initialData.question_type || "single_choice");
        setQuestionOptions(initialData.options || ["", ""]);
        setCorrectOption(initialData.correct_option || "");
      }
    }

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
    setSubmitErrorDetail(null);
    setSubmitting(false);
    setMaxPointsFollowsRubric(!initialData);
    setIsSynopsis(initialData?.is_synopsis || false);
    setIsSupplementary(initialData?.is_supplementary || false);
    setSelectedStudentIds(initialData?.target_student_ids ? (typeof initialData.target_student_ids === 'string' ? JSON.parse(initialData.target_student_ids) : initialData.target_student_ids) : []);
    setTestPassingScore(initialData?.test_passing_score || 70);

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

  const resolveTopicIdForSubmit = async (courseId: number) => {
    if (topicId != null && courseId === currentGroup.course_id) {
      const selected = topics.find((tpc) => tpc.id === topicId);
      if (selected) return topicId;
    }
    const noTopicTitle = t("assignmentNoTopic");
    if (courseId === currentGroup.course_id) {
      const existing = topics.find((tpc) => tpc.title === noTopicTitle);
      if (existing) return existing.id;
    }
    const { data } = await api.post<{ id: number; title: string }>(`/teacher/courses/${courseId}/topics`, {
      title: noTopicTitle,
      description: undefined,
    });
    queryClient.invalidateQueries({ queryKey: ["course-topics", courseId] });
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
      testPassingScore?: number;
      rejectSubmissionsAfterDeadline?: boolean;
      isSynopsis?: boolean;
      isSupplementary?: boolean;
      targetStudentIds?: number[];
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
        test_passing_score: payload.testPassingScore,
        reject_submissions_after_deadline: payload.rejectSubmissionsAfterDeadline,
        is_synopsis: payload.isSynopsis,
        is_supplementary: payload.isSupplementary,
        target_student_ids: payload.targetStudentIds?.length ? payload.targetStudentIds : undefined,
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
      isSupplementary?: boolean;
      targetStudentIds?: number[];
    }) => {
      await api.post("/teacher/materials", {
        group_id: payload.groupId,
        course_id: payload.courseId,
        topic_id: payload.topicId,
        title: payload.title,
        description: payload.description || undefined,
        attachment_urls: payload.attachmentUrls?.length ? payload.attachmentUrls : undefined,
        attachment_links: payload.attachmentLinks?.length ? payload.attachmentLinks : undefined,
        video_urls: payload.videoUrls?.length ? payload.videoUrls : undefined,
        is_supplementary: payload.isSupplementary,
        target_student_ids: payload.targetStudentIds?.length ? payload.targetStudentIds : undefined,
      });
    },
  });

  const createQuestionMutation = useMutation({
    mutationFn: async (payload: {
      groupId: number;
      courseId: number;
      questionText: string;
      questionType: string;
      options?: string[];
      correctOption?: string;
      isSupplementary?: boolean;
    }) => {
      const isEdit = !!initialData?.isEdit;
      const itemId = initialData?.id;
      if (isEdit && itemId) {
        await api.patch(`/teacher/questions/${itemId}`, {
          question_text: payload.questionText,
          question_type: payload.questionType,
          options: payload.options,
          correct_option: payload.correctOption,
          is_supplementary: payload.isSupplementary,
        });
      } else {
        await api.post("/teacher/questions", {
          group_id: payload.groupId,
          course_id: payload.courseId,
          question_text: payload.questionText,
          question_type: payload.questionType,
          options: payload.options,
          correct_option: payload.correctOption,
          is_supplementary: payload.isSupplementary,
        });
      }
    },
  });

  const handleCreateAssignment = async () => {
    if (submittingRef.current) return;
    setSubmitErrorDetail(null);
    setTitleTouched(true);
    const cleanedTitle = title.trim();
    if (!cleanedTitle && mode !== "question") return;
    if (selectedGroupIds.length === 0) setSelectedGroupIds([currentGroup.id]);

    submittingRef.current = true;
    setSubmitting(true);
    try {
      const deadlineIso =
        dueMode === "date" && dueDateYMD ? localDateTimeToIso(dueDateYMD, dueTimeHM) : undefined;
      const payloadMaxPoints = pointsMode === "no_grade" ? 0 : Math.max(0, maxPoints);
      const rejectPayload = dueMode === "date" && deadlineIso ? rejectAfterDeadline : undefined;

      const rubricToSend =
        pointsMode === "no_grade" ? [] : rubricPayload.length ? rubricPayload : [];

      const groupById = new Map(teacherGroups.map((g) => [g.id, g] as const));
      const targetGroupIds = [...new Set(selectedGroupIds.length ? selectedGroupIds : [currentGroup.id])];
      const isEdit = !!initialData?.isEdit;
      const itemId = initialData?.id;

      for (const gid of targetGroupIds) {
        const g = groupById.get(gid);
        if (!g) continue;
        const resolvedTopic = await resolveTopicIdForSubmit(g.course_id);

        if (mode === "material") {
          if (isEdit && itemId) {
            await api.patch(`/teacher/materials/${itemId}`, {
              title: cleanedTitle,
              description: instructionsHtml || undefined,
              topic_id: resolvedTopic,
              attachment_urls: attachmentUrls.length ? attachmentUrls : undefined,
              attachment_links: attachmentLinks.length ? attachmentLinks : undefined,
              video_urls: videoUrls.length ? videoUrls : undefined,
              is_supplementary: isSupplementary,
              target_student_ids: selectedStudentIds.length ? selectedStudentIds : undefined,
            });
          } else {
            await createMaterialMutation.mutateAsync({
              groupId: gid,
              courseId: g.course_id,
              topicId: resolvedTopic,
              title: cleanedTitle,
              description: instructionsHtml || undefined,
              attachmentUrls,
              attachmentLinks,
              videoUrls,
              isSupplementary,
              targetStudentIds: selectedStudentIds,
            });
          }
        } else if (mode === "question") {
          await createQuestionMutation.mutateAsync({
            groupId: gid,
            courseId: g.course_id,
            questionText,
            questionType,
            options: questionType === "single_choice" ? questionOptions : undefined,
            correctOption: questionType === "single_choice" ? correctOption : undefined,
            isSupplementary,
          });
        } else {
          const includeTest =
            mode === "assignmentWithTest" || (mode === "assignment" && hasQuiz);
          const apiTestQuestions = includeTest ? quizQuestionsToApiFormat(quizQuestions) : [];
          const mainIsSynopsis = !!isSynopsis;

          if (isEdit && itemId) {
            await api.patch(`/teacher/assignments/${itemId}`, {
              title: cleanedTitle,
              description: instructionsHtml || undefined,
              topic_id: resolvedTopic,
              deadline: deadlineIso,
              max_points: payloadMaxPoints,
              attachment_urls: attachmentUrls.length ? attachmentUrls : undefined,
              attachment_links: attachmentLinks.length ? attachmentLinks : undefined,
              video_urls: videoUrls.length ? videoUrls : undefined,
              rubric: rubricToSend,
              reject_submissions_after_deadline: rejectPayload,
              is_synopsis: mainIsSynopsis,
              is_supplementary: isSupplementary,
              target_student_ids: selectedStudentIds.length ? selectedStudentIds : undefined,
              test_passing_score: testPassingScore,
            });
          } else {
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
              testPassingScore: testPassingScore,
              rejectSubmissionsAfterDeadline: rejectPayload,
              isSynopsis: mainIsSynopsis,
              isSupplementary,
              targetStudentIds: selectedStudentIds,
            });
          }
        }
      }

      // Update the teacher course page.
      queryClient.invalidateQueries({ queryKey: ["teacher-assignments", currentGroup.id] });
      queryClient.invalidateQueries({ queryKey: ["teacher-questions", currentGroup.id] });
      queryClient.invalidateQueries({ queryKey: ["teacher-topics-missing-assignments", currentGroup.id] });
      queryClient.invalidateQueries({ queryKey: ["teacher-group-feed", currentGroup.id] });
      queryClient.invalidateQueries({ queryKey: ["teacher-reusable-rubrics"] });
      if (isEdit && itemId) {
        queryClient.invalidateQueries({ queryKey: ["teacher-assignment-details", itemId] });
        queryClient.invalidateQueries({ queryKey: ["teacher-material-details", itemId] });
      }
      onClose();
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      setSubmitErrorDetail(detail ?? e?.message ?? null);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const attachmentInputAccept = ALLOWED_EXTENSIONS_STR;

  if (!isOpen) return null;

  const titleError =
    titleTouched && !title.trim() ? t("assignmentFieldRequired") : null;

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-stretch justify-center z-50 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full h-full max-w-none rounded-none shadow-2xl overflow-hidden flex flex-col min-w-0 min-h-0"
        style={modalStyle}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 sm:gap-4 px-4 sm:px-5 py-4 border-b shrink-0 min-w-0" style={{ borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold" style={{ background: "linear-gradient(135deg,#3B82F6,#8B5CF6)" }}>
                <Plus className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-semibold font-geologica" style={{ color: textColors.primary }}>
                {initialData?.isEdit ? t("teacherEditAssignment") : (mode === "material"
                  ? t("assignmentTypeMaterial")
                  : mode === "question"
                    ? t("teacherCreateQuestion")
                    : mode === "assignmentWithTest"
                      ? t("assignmentTypeAssignmentWithTest")
                      : t("assignmentTypeAssignment"))}
              </h2>
            </div>
            <p className="text-xs mt-1" style={{ color: textColors.secondary }}>
              {mode === "material"
                ? t("assignmentCreateMaterial")
                : mode === "question"
                  ? t("teacherCreateQuestion")
                  : mode === "assignmentWithTest"
                    ? t("assignmentCreateAssignmentWithTest")
                    : t("createAssignment")}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!isAssignmentLike && (
              <button
                type="button"
                onClick={handleCreateAssignment}
                disabled={submitting || (mode !== "question" && !title.trim())}
                className="px-6 py-2 rounded-xl text-white font-semibold transition-all hover:shadow-lg hover:brightness-110 disabled:opacity-50 ring-2 ring-white/25 dark:ring-white/15 shadow-md"
                style={{ background: "linear-gradient(135deg,#2563EB,#7C3AED)" }}
              >
                {submitting
                  ? (initialData?.isEdit ? t("teacherSaving") : (mode === "material" ? t("publishing") : t("asking")))
                  : (initialData?.isEdit ? t("teacherSave") : (mode === "material" ? t("publish") : t("ask")))}
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
        <div className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden">
          {!rubricCreatorOpen ? (
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)] gap-0 min-w-0">
              {/* Left Panel */}
              <div className="min-w-0 p-4 sm:p-6 lg:p-10 border-b lg:border-b-0 lg:border-r" style={{ borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}>
                <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8">
                  {/* Title or Question */}
                  {mode === "question" ? (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: textColors.secondary }}>
                          {t("teacherQuestionText")}
                        </label>
                        <textarea
                          placeholder={t("teacherQuestionText")}
                          value={questionText}
                          onChange={(e) => setQuestionText(e.target.value)}
                          className="w-full min-h-[100px] rounded-xl p-3 resize-none outline-none focus:ring-2 focus:ring-blue-500/40"
                          style={{ ...inputStyle, color: textColors.primary }}
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: textColors.secondary }}>
                            {t("teacherQuestionType")}
                          </label>
                          <select
                            value={questionType}
                            onChange={(e) => setQuestionType(e.target.value as "single_choice" | "open")}
                            className="w-full h-11 rounded-xl px-3 outline-none"
                            style={{ ...inputStyle, color: textColors.primary }}
                          >
                            <option value="single_choice">{t("teacherQuestionTypeSingle")}</option>
                            <option value="open">{t("teacherQuestionTypeOpen")}</option>
                          </select>
                        </div>
                      </div>

                      {questionType === "single_choice" && (
                        <div className="space-y-3">
                          <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: textColors.secondary }}>
                            {t("teacherOptions")}
                          </label>
                          {questionOptions.map((opt, idx) => (
                            <div key={idx} className="flex gap-2 items-center">
                              <input
                                type="radio"
                                name="correct_option"
                                checked={correctOption === String.fromCharCode(97 + idx)}
                                onChange={() => setCorrectOption(String.fromCharCode(97 + idx))}
                                className="w-4 h-4 accent-blue-500"
                              />
                              <input
                                type="text"
                                placeholder={`${t("teacherOption")} ${idx + 1}`}
                                value={opt}
                                onChange={(e) => {
                                  const newOpts = [...questionOptions];
                                  newOpts[idx] = e.target.value;
                                  setQuestionOptions(newOpts);
                                }}
                                className="flex-1 h-11 rounded-xl px-3 outline-none"
                                style={{ ...inputStyle, color: textColors.primary }}
                              />
                              <button
                                type="button"
                                onClick={() => setQuestionOptions(questionOptions.filter((_, i) => i !== idx))}
                                className="p-2.5 rounded-xl hover:bg-red-500/10 text-red-500 transition-colors"
                              >
                                <X className="w-5 h-5" />
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => setQuestionOptions([...questionOptions, ""])}
                            className="flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                          >
                            <Plus className="w-4 h-4" /> {t("teacherAddOption")}
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <label className="block text-sm font-semibold" style={{ color: textColors.primary }}>
                        {mode === "material" ? t("assignmentTitleLabel") : t("assignmentTitleLabel")}
                      </label>
                      <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        onBlur={() => setTitleTouched(true)}
                        placeholder={t("assignmentTitlePlaceholder")}
                        className="w-full px-4 py-3 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/40"
                        style={{ ...inputStyle, color: textColors.primary }}
                      />
                      {titleError ? (
                        <p className="text-xs" style={{ color: "#F87171" }}>
                          {titleError}
                        </p>
                      ) : null}
                    </div>
                  )}

                  {/* Instructions (Not for questions) */}
                  {mode !== "question" && (
                    <div className="space-y-3">
                      <label className="block text-sm font-semibold" style={{ color: textColors.primary }}>
                        {mode === "material" ? t("optionalDescription") : t("optionalInstructions")}
                      </label>
                      <div className="min-h-[200px]">
                        <RichTextEditor value={instructionsHtml} onChange={setInstructionsHtml} />
                      </div>
                    </div>
                  )}

                  {/* Attachments */}
                  <div className="space-y-4 pt-4 border-t" style={{ borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}>
                    <label className="block text-sm font-semibold" style={{ color: textColors.primary }}>
                      {t("teacherAttachLabel")}
                    </label>
                    <div className="grid grid-cols-2 gap-2 min-w-0 sm:flex sm:flex-wrap sm:gap-3">
                      <UploadButton />
                      <YoutubeButton />
                      <LinkButton />
                    </div>

                    <p className="text-[10px] sm:text-xs font-medium" style={{ color: "#F87171" }}>
                      {t("onlyAllowedExtensions").replace("{extensions}", ALLOWED_EXTENSIONS_HINT)}
                    </p>

                    {/* Attachment previews */}
                    {videoUrls.length > 0 ||
                    attachmentUrls.length > 0 ||
                    attachmentLinks.length > 0 ||
                    hasQuiz ? (
                      <div className="space-y-3">
                        {videoUrls.length > 0 ? (
                          <div>
                            <p className="text-xs font-semibold mb-2" style={{ color: textColors.secondary }}>
                              {t("teacherVideosLabel")}
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
                              {t("teacherFilesLabel")}
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
                              {t("teacherLinksLabel")}
                            </p>
                            <div className="space-y-2">
                              {attachmentLinks.map((u, i) => (
                                <LinkAttachmentCard key={`${u}-${i}`} url={u} onRemove={() => setAttachmentLinks((prev) => prev.filter((_, idx) => idx !== i))} />
                              ))}
                            </div>
                          </div>
                        ) : null}
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
                  {submitErrorMessage ? (
                    <p className="text-sm" style={{ color: "#F87171" }}>
                      {submitErrorMessage}
                    </p>
                  ) : null}
                </div>
              </div>

              {/* Right Panel — narrow column: stack fields, clip overflow */}
              <div className="min-w-0 max-w-full overflow-x-hidden box-border px-4 py-6 sm:px-5 lg:p-6 bg-black/5 dark:bg-white/[0.02]">
                <div className="space-y-5 min-w-0 max-w-full">
                  {/* For whom */}
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold" style={{ color: textColors.primary }}>
                      {t("forWhom")}
                    </label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setForWhomOpen((o) => !o)}
                        className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-2xl text-sm font-semibold transition-all hover:bg-black/5 dark:hover:bg-white/5"
                        style={{ 
                          ...inputStyle, 
                          color: textColors.primary,
                          background: isDark ? "rgba(30, 41, 59, 0.8)" : "#F1F5F9",
                          borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.05)"
                        }}
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

                  {/* Synopsis assignment checkbox (visible for all non-material modes) */}
                  {mode !== "material" && (
                    <div className="space-y-2">
                      <label
                        className="flex items-start gap-3 cursor-pointer p-4 rounded-2xl border transition-all hover:shadow-md"
                        style={{
                          borderColor: isSynopsis ? "#3B82F6" : isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)",
                          background: isSynopsis
                            ? isDark
                              ? "rgba(59,130,246,0.1)"
                              : "rgba(219,234,254,0.3)"
                            : "transparent",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSynopsis}
                          onChange={(e) => {
                            setIsSynopsis(e.target.checked);
                            if (e.target.checked) setPointsMode("graded");
                          }}
                          className="mt-1 w-4 h-4 rounded accent-blue-500 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-semibold" style={{ color: textColors.primary }}>
                            {t("assignmentIsSynopsisLabel")}
                          </div>
                          <div className="text-xs mt-0.5 leading-relaxed" style={{ color: textColors.secondary }}>
                            {t("assignmentIsSynopsisHint")}
                          </div>
                        </div>
                      </label>
                    </div>
                  )}

                  {/* Supplementary checkbox (visible for all modes) */}
                  <div className="space-y-2">
                    <label
                      className="flex items-start gap-3 cursor-pointer p-4 rounded-2xl border transition-all hover:shadow-md"
                      style={{
                        borderColor: isSupplementary ? "#3B82F6" : isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)",
                        background: isSupplementary
                          ? isDark
                            ? "rgba(59,130,246,0.1)"
                            : "rgba(219,234,254,0.3)"
                          : "transparent",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSupplementary}
                        onChange={(e) => setIsSupplementary(e.target.checked)}
                        className="mt-1 w-4 h-4 rounded accent-blue-500 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold" style={{ color: textColors.primary }}>
                          {t("teacherCreateSupplementary")}
                        </div>
                        <div className="text-xs mt-0.5 leading-relaxed" style={{ color: textColors.secondary }}>
                          {t("teacherCreateSupplementaryHint")}
                        </div>
                      </div>
                    </label>
                  </div>

                  {/* Assign */}
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold" style={{ color: textColors.primary }}>
                      {t("assign")}
                    </label>
                    <button
                      type="button"
                      onClick={handleOpenStudentSelector}
                      className="w-full max-w-full flex items-center justify-center gap-2 px-3 py-3 rounded-2xl text-sm font-semibold transition-colors text-center leading-snug"
                      style={{ background: "linear-gradient(135deg,#10B981,#06B6D4)", color: "#FFFFFF" }}
                    >
                      <Users className="w-4 h-4 shrink-0" />
                      <span className="min-w-0 break-words">
                        {selectedStudentIds.length === 0
                          ? t("allStudents")
                          : t("studentsSelectedCount").replace("{count}", String(selectedStudentIds.length))}
                      </span>
                    </button>
                  </div>

                  {/* Points: always stacked in sidebar — fixed width column cannot fit two fields side-by-side with RU labels */}
                  {mode !== "material" && (
                    <div className="space-y-2 min-w-0 max-w-full">
                      <label className="block text-sm font-semibold" style={{ color: textColors.primary }}>
                        {t("points")}
                      </label>
                      <div className="flex flex-col gap-2 min-w-0 max-w-full">
                        <div
                          className="w-full max-w-full min-w-0 rounded-2xl border focus-within:ring-2 focus-within:ring-blue-500/40"
                          style={{
                            borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)",
                            background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.95)",
                          }}
                        >
                          <input
                            type="number"
                            min={0}
                            inputMode="numeric"
                            value={pointsMode === "no_grade" ? "" : maxPoints}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (v === "") {
                                setMaxPointsFollowsRubric(true);
                                setMaxPoints(rubricAutoTotal != null ? rubricAutoTotal : 100);
                                return;
                              }
                              const n = Math.max(0, parseInt(v, 10) || 0);
                              setMaxPoints(n);
                              if (rubricAutoTotal != null && n === rubricAutoTotal) {
                                setMaxPointsFollowsRubric(true);
                              } else {
                                setMaxPointsFollowsRubric(false);
                              }
                            }}
                            disabled={pointsMode === "no_grade"}
                            placeholder={pointsMode === "no_grade" ? "—" : "100"}
                            className="w-full max-w-full min-w-0 border-0 bg-transparent px-4 py-3 text-sm font-semibold outline-none rounded-2xl box-border"
                            style={{
                              color: textColors.primary,
                              opacity: pointsMode === "no_grade" ? 0.5 : 1,
                            }}
                            aria-label={t("points")}
                          />
                        </div>
                        {pointsMode === "graded" && rubricAutoTotal != null ? (
                          <p className="text-[11px] leading-snug px-0.5" style={{ color: textColors.secondary }}>
                            {maxPointsFollowsRubric ? t("pointsAutoFromRubricHint") : t("pointsManualOverrideActiveHint")}
                          </p>
                        ) : null}
                        <div
                          className="w-full max-w-full min-w-0 rounded-2xl border focus-within:ring-2 focus-within:ring-blue-500/40"
                          style={{
                            borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)",
                            background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.95)",
                          }}
                        >
                          <select
                            value={pointsMode}
                            onChange={(e) => {
                              const m = e.target.value as "graded" | "no_grade";
                              setPointsMode(m);
                              if (m === "graded") {
                                setMaxPointsFollowsRubric(true);
                              }
                            }}
                            className="w-full max-w-full min-w-0 min-h-[48px] border-0 bg-transparent px-3 py-3 text-sm font-semibold outline-none rounded-2xl cursor-pointer box-border"
                            style={{ color: textColors.primary }}
                            aria-label={t("graded")}
                          >
                            <option value="graded">{t("graded")}</option>
                            <option value="no_grade">{t("noGrade")}</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Due date */}
                  {mode !== "material" && mode !== "question" && (
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
                        <div className="mt-2 space-y-2">
                          <div className="flex items-center gap-2">
                            <CalendarDays className="w-4 h-4 shrink-0" style={{ color: textColors.secondary }} />
                            <input
                              type="date"
                              value={dueDateYMD}
                              onChange={(e) => setDueDateYMD(e.target.value)}
                              className="min-w-0 flex-1 px-4 py-3 rounded-2xl outline-none text-sm font-semibold"
                              style={{ ...inputStyle, color: textColors.primary }}
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold shrink-0 w-14" style={{ color: textColors.secondary }}>
                              {t("assignmentDueTime")}
                            </span>
                            <input
                              type="time"
                              value={dueTimeHM}
                              onChange={(e) => setDueTimeHM(e.target.value)}
                              className="w-full px-4 py-3 rounded-2xl outline-none text-sm font-semibold"
                              style={{ ...inputStyle, color: textColors.primary }}
                            />
                          </div>
                          <label className="flex items-start gap-3 cursor-pointer pt-1">
                            <input
                              type="checkbox"
                              checked={rejectAfterDeadline}
                              onChange={(e) => setRejectAfterDeadline(e.target.checked)}
                              className="mt-0.5 w-4 h-4 rounded accent-blue-500 shrink-0"
                            />
                            <span className="text-sm leading-snug" style={{ color: textColors.primary }}>
                              {t("assignmentRejectAfterDeadline")}
                            </span>
                          </label>
                        </div>
                      ) : null}
                      {dueMode === "date" && dueDateYMD ? (
                        <p className="text-xs mt-1" style={{ color: textColors.secondary }}>
                          {formatLocalDateTimePreview(dueDateYMD, dueTimeHM, lang)}
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
                              {t("assignmentCreateRubricMenu")}
                            </button>
                            <button
                              type="button"
                              className="w-full text-left px-4 py-3 text-sm font-semibold hover:bg-black/5 dark:hover:bg-white/10"
                              onClick={() => {
                                setRubricDropdownOpen(false);
                                setRubricReuseOpen(true);
                                setRubricReuseCourseId("all");
                              }}
                            >
                              {t("assignmentReuseRubricMenu")}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  )}

                  {/* Question specific checkboxes */}

                  {/* Small rubric preview */}
                  {isAssignmentLike && rubricPayload.length > 0 ? (
                    <div className="rounded-2xl p-4" style={glassStyle}>
                      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: textColors.secondary }}>
                        {t("rubricPreviewTitle")}
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
                <div
                  className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-4 sm:px-5 py-4 border-b"
                  style={{ borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}
                >
                  <div className="min-w-0 flex-1 order-2 sm:order-1">
                    <h2 className="text-lg font-semibold font-geologica" style={{ color: textColors.primary }}>
                      {t("assignmentTypeAssignment")}
                    </h2>
                    <p className="text-xs mt-1" style={{ color: textColors.secondary }}>
                      {t("createRubric")}
                    </p>
                  </div>
                  <div className="flex items-stretch sm:items-center gap-2 w-full sm:w-auto order-1 sm:order-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleCreateAssignment}
                      disabled={submitting}
                      className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 sm:px-5 py-3 rounded-2xl text-white text-sm font-semibold disabled:opacity-50 transition-all hover:shadow-lg min-w-0"
                      style={{ background: "linear-gradient(135deg,#3B82F6,#8B5CF6)" }}
                    >
                      {t("createAssignment")}
                      <ChevronDown className="w-4 h-4 opacity-90 shrink-0" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setRubricCreatorOpen(false)}
                      className="p-3 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors shrink-0"
                      aria-label={t("teacherCancel")}
                    >
                      <X className="w-5 h-5" style={{ color: textColors.secondary }} />
                    </button>
                  </div>
                </div>

                <div className="p-5 lg:p-7 space-y-5">
                  <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold" style={{ color: textColors.primary }}>
                        {t("rubricSheetNameLabel")}
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
                          {t("teacherRubricUsePointSystem")}
                        </span>
                        <input
                          type="checkbox"
                          checked={rubricUsePoints}
                          onChange={(e) => setRubricUsePoints(e.target.checked)}
                        />
                      </label>
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold" style={{ color: textColors.primary }}>
                          {t("rubricSortLabel")}
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

                    <div className="space-y-4 pt-4 border-t" style={{ borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}>
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-semibold" style={{ color: textColors.primary }}>
                          {t("passingScore")} (%)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={testPassingScore}
                          onChange={(e) => setTestPassingScore(Number(e.target.value))}
                          className="w-20 px-3 py-2 rounded-xl text-center font-semibold"
                          style={{ ...inputStyle, color: textColors.primary }}
                        />
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="100"
                        value={testPassingScore}
                        onChange={(e) => setTestPassingScore(Number(e.target.value))}
                        className="w-full accent-blue-500"
                      />
                    </div>
                  </div>

                  {/* Criteria */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold" style={{ color: textColors.primary }}>
                        {t("rubricConditionsHeading")}
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
                                <div key={lidx} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2 min-w-0">
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
                                    className="flex-1 min-w-0 px-4 py-3 rounded-2xl outline-none text-sm font-semibold"
                                    style={{ ...inputStyle, color: textColors.primary, opacity: rubricUsePoints ? 1 : 0.75 }}
                                    disabled={!rubricUsePoints}
                                  />
                                  <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                                    <input
                                      type="number"
                                      value={lvl.points === 0 ? "" : lvl.points}
                                      onChange={(e) => {
                                        const raw = e.target.value;
                                        if (raw === "") {
                                          setRubricConditions((prev) =>
                                            prev.map((c, j) =>
                                              j === idx
                                                ? {
                                                    ...c,
                                                    levels: c.levels.map((x, k) =>
                                                      k === lidx ? { ...x, points: 0 } : x
                                                    ),
                                                  }
                                                : c
                                            )
                                          );
                                          return;
                                        }
                                        const v = parseFloat(raw);
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
                                      placeholder={t("points")}
                                      className="w-full sm:w-28 min-w-0 px-4 py-3 rounded-2xl outline-none text-sm font-semibold"
                                      style={{ ...inputStyle, color: textColors.primary, opacity: rubricUsePoints ? 1 : 0.75 }}
                                      disabled={!rubricUsePoints}
                                    />
                                    <button
                                      type="button"
                                      className="p-3 rounded-2xl text-red-400 hover:text-red-500 hover:bg-red-500/10 transition-colors shrink-0"
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
                      {t("teacherSave")}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Reuse rubric picker */}
        {rubricReuseOpen ? (
          <div
            className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-center justify-center p-2"
            onClick={() => setRubricReuseOpen(false)}
          >
            <div
              className="max-w-lg w-full mx-4 rounded-3xl p-6 overflow-hidden max-h-[85vh] flex flex-col"
              style={modalStyle}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4 shrink-0">
                <h3 className="text-lg font-semibold font-geologica" style={{ color: textColors.primary }}>
                  {t("assignmentReuseRubricModalTitle")}
                </h3>
                <button
                  type="button"
                  onClick={() => setRubricReuseOpen(false)}
                  className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10"
                >
                  <X className="w-5 h-5" style={{ color: textColors.secondary }} />
                </button>
              </div>
              <div className="space-y-3 mb-4 shrink-0">
                <label className="block text-xs font-semibold uppercase tracking-wide" style={{ color: textColors.secondary }}>
                  {t("assignmentReuseRubricFilterCourse")}
                </label>
                <select
                  value={rubricReuseCourseId === "all" ? "" : String(rubricReuseCourseId)}
                  onChange={(e) => {
                    e.stopPropagation();
                    const v = e.target.value;
                    setRubricReuseCourseId(v === "" ? "all" : Number(v));
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full px-4 py-3 rounded-2xl text-sm font-semibold outline-none cursor-pointer"
                  style={{ ...inputStyle, color: textColors.primary }}
                >
                  <option value="">{t("assignmentReuseRubricAllCourses")}</option>
                  {courseFilterOptions.map(([cid, ctitle]) => (
                    <option key={cid} value={cid}>
                      {ctitle}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
                {reusableRubricsQuery.isPending ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin" style={{ color: textColors.secondary }} />
                  </div>
                ) : (reusableRubricsQuery.data ?? []).length === 0 ? (
                  <p className="text-sm text-center py-8" style={{ color: textColors.secondary }}>
                    {t("assignmentReuseRubricEmpty")}
                  </p>
                ) : (
                  (reusableRubricsQuery.data ?? []).map((row) => (
                    <button
                      key={row.assignment_id}
                      type="button"
                      onClick={() => applyReusedRubricRows(row.rubric)}
                      className="w-full text-left rounded-2xl px-4 py-3 border transition-colors hover:bg-black/5 dark:hover:bg-white/10"
                      style={{
                        borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)",
                        color: textColors.primary,
                      }}
                    >
                      <div className="font-semibold truncate">{row.title}</div>
                      <div className="text-xs mt-1 truncate" style={{ color: textColors.secondary }}>
                        {row.course_title}
                        {" · "}
                        {t("assignmentReuseRubricSummary")
                          .replace("{n}", String(row.criteria_count))
                          .replace("{pts}", String(row.total_points))}
                      </div>
                    </button>
                  ))
                )}
              </div>
              <div className="mt-4 pt-4 border-t shrink-0" style={{ borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}>
                <button
                  type="button"
                  onClick={() => setRubricReuseOpen(false)}
                  className="w-full py-3 rounded-2xl text-sm font-semibold"
                  style={{ background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)", color: textColors.secondary }}
                >
                  {t("teacherCancel")}
                </button>
              </div>
            </div>
          </div>
        ) : null}

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
                  <p className="text-xs mt-1 leading-relaxed" style={{ color: textColors.secondary }}>
                    {t("assignmentGroupAudienceHint")}
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
                <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: textColors.secondary }}>
                    {t("assignmentGroupRosterTitle")}
                  </p>
                  {students.map((s) => {
                    const isSelected = selectedStudentIds.includes(s.id);
                    return (
                      <label
                        key={s.id}
                        className="flex items-center gap-4 px-4 py-3 rounded-2xl cursor-pointer transition-all hover:bg-black/5 dark:hover:bg-white/5 border"
                        style={{ 
                          borderColor: isSelected ? "#10B981" : isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
                          background: isSelected ? (isDark ? "rgba(16,185,129,0.1)" : "rgba(209,250,229,0.3)") : "transparent"
                        }}
                      >
                        <input
                          type="checkbox"
                          className="w-5 h-5 rounded-md accent-emerald-500 shrink-0"
                          checked={isSelected}
                          onChange={() => {
                            setSelectedStudentIds(prev => 
                              prev.includes(s.id) 
                                ? prev.filter(id => id !== s.id) 
                                : [...prev, s.id]
                            );
                          }}
                        />
                        <div className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold truncate" style={{ color: textColors.primary }}>
                            {s.full_name || s.email}
                          </span>
                          <span className="block text-xs mt-0.5 truncate" style={{ color: textColors.secondary }}>
                            {s.email}
                          </span>
                        </div>
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
                  {t("teacherYoutube")}
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
                    placeholder={t("teacherYoutubePlaceholder")}
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
                  {t("teacherUrlLabel")}
                </label>
                <input
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/40 text-sm font-semibold"
                  style={{ ...inputStyle, color: textColors.primary }}
                  placeholder={t("placeholderUrl")}
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
                  {t("teacherUrlLabel")}
                </label>
                <input
                  value={createAttachmentUrl}
                  onChange={(e) => setCreateAttachmentUrl(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/40 text-sm font-semibold"
                  style={{ ...inputStyle, color: textColors.primary }}
                  placeholder={t("placeholderUrl")}
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
        className="flex items-center justify-center gap-2 px-3 py-2.5 sm:px-4 rounded-2xl text-sm font-semibold cursor-pointer transition-all hover:bg-black/10 dark:hover:bg-white/10 w-full min-w-0 sm:w-auto sm:justify-start"
        style={{ background: isDark ? "rgba(255,255,255,0.08)" : "#F1F5F9", color: textColors.primary }}
        onClick={() => {
          const el = document.getElementById("teacher-assignment-disk") as HTMLInputElement | null;
          el?.click();
        }}
      >
        <Paperclip className="w-4 h-4 shrink-0" style={{ color: textColors.primary }} />
        <span className="truncate">{t("drive")}</span>
      </label>
    );
  }

  function UploadButton() {
    return (
      <label
        className="flex items-center justify-center gap-2 px-3 py-2.5 sm:px-4 rounded-2xl text-sm font-semibold cursor-pointer transition-all hover:bg-black/10 dark:hover:bg-white/10 w-full min-w-0 sm:w-auto sm:justify-start"
        style={{ background: isDark ? "rgba(255,255,255,0.08)" : "#F1F5F9", color: textColors.primary }}
        onClick={() => {
          const el = document.getElementById("teacher-assignment-upload") as HTMLInputElement | null;
          el?.click();
        }}
      >
        <Upload className="w-4 h-4 shrink-0" style={{ color: textColors.primary }} />
        <span className="truncate">{t("upload")}</span>
      </label>
    );
  }

  function YoutubeButton() {
    return (
      <button
        type="button"
        className="flex items-center justify-center gap-2 px-3 py-2.5 sm:px-4 rounded-2xl text-sm font-semibold transition-all hover:bg-black/10 dark:hover:bg-white/10 w-full min-w-0 sm:w-auto sm:justify-start"
        style={{ background: isDark ? "rgba(255,255,255,0.08)" : "#F1F5F9", color: textColors.primary }}
        onClick={() => {
          setYoutubeUrlError(null);
          setYoutubeDialogOpen(true);
        }}
      >
        <span className="truncate" style={{ fontWeight: 900 }}>
          {t("teacherYoutube")}
        </span>
      </button>
    );
  }

  function LinkButton() {
    return (
      <button
        type="button"
        className="flex items-center justify-center gap-2 px-3 py-2.5 sm:px-4 rounded-2xl text-sm font-semibold transition-all hover:bg-black/10 dark:hover:bg-white/10 w-full min-w-0 sm:w-auto sm:justify-start"
        style={{ background: isDark ? "rgba(255,255,255,0.08)" : "#F1F5F9", color: textColors.primary }}
        onClick={() => {
          setLinkUrlError(null);
          setLinkDialogOpen(true);
        }}
      >
        <LinkIcon className="w-4 h-4 shrink-0" style={{ color: textColors.primary }} />
        <span className="truncate">{t("linkOption")}</span>
      </button>
    );
  }

  function CreateDocsDropdown() {
    const [open, setOpen] = useState(false);
    const items = ["docs", "presentations", "spreadsheets"] as const;
    return (
      <div className="relative col-span-2 min-w-0 sm:col-span-1 sm:w-auto">
        <button
          type="button"
          className="flex items-center justify-between gap-2 px-3 py-2.5 sm:px-4 sm:justify-start rounded-2xl text-sm font-semibold transition-all hover:bg-black/10 dark:hover:bg-white/10 w-full min-w-0 text-left"
          style={{ background: isDark ? "rgba(255,255,255,0.08)" : "#F1F5F9", color: textColors.primary }}
          onClick={() => setOpen((o) => !o)}
        >
          <span className="truncate min-w-0">{t("connectAssignment")}</span>
          <ChevronDown className="w-4 h-4 shrink-0 opacity-70" />
        </button>
        {open ? (
          <div
            className="absolute left-0 right-0 sm:right-auto mt-2 z-[90] w-full min-w-0 sm:w-56 rounded-2xl overflow-hidden"
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
}
