"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import type { AxiosError } from "axios";
import { useLanguage } from "@/context/LanguageContext";
import type { TranslationKey } from "@/i18n/translations";
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  ChevronsUpDown,
  ClipboardList,
  ExternalLink,
  FileText,
  Filter,
  Globe,
  Loader2,
  Lock,
  MessageSquare,
  Paperclip,
  Play,
  Plus,
  Users,
  Video,
  AlertTriangle,
  X,
  Sparkles,
} from "lucide-react";
import { TestComponent } from "@/components/tests/TestComponent";
import { PrivateCommentsSection } from "@/components/courses/PrivateCommentsSection";
import { AssignmentClassCommentsSection } from "@/components/courses/AssignmentClassCommentsSection";
import { cn } from "@/lib/utils";
import { getLocalizedTopicTitle } from "@/lib/courseUtils";
import { htmlLinksOpenInNewTab } from "@/lib/htmlLinkNewTab";
import { formatLocalizedDate, formatRelativeDate } from "@/utils/dateUtils";
import { TopicTheoryContent } from "@/components/courses/TopicTheoryContent";

type RubricLevelItem = { text: string; points: number };
type RubricItem = {
  id: number;
  name: string;
  max_points: number;
  description?: string;
  levels?: RubricLevelItem[];
};
type RubricGradeRow = { criterion_id: number; points: number };

type AssignmentRow = {
  id: number;
  title: string;
  description: string | null;
  course_id: number;
  course_title: string;
  topic_id: number | null;
  topic_title: string | null;
  deadline: string | null;
  closed: boolean;
  manually_closed?: boolean;
  deadline_passed?: boolean;
  reject_submissions_after_deadline?: boolean;
  submitted: boolean;
  grade: number | null;
  teacher_comment: string | null;
  max_points: number;
  attachment_urls: string[];
  attachment_links: string[];
  video_urls: string[];
  test_id: number | null;
  created_at?: string | null;
  submitted_at?: string | null;
  graded_at?: string | null;
  teacher_name?: string;
  rubric?: RubricItem[];
  rubric_grades?: RubricGradeRow[];
  submission_file_urls?: string[];
  submission_text?: string | null;
  class_comments_count?: number;
  allow_student_class_comments?: boolean;
  is_synopsis?: boolean;
  is_supplementary?: boolean;
  is_locked?: boolean;
};

type MaterialRow = {
  id: number;
  title: string;
  description: string | null;
  course_id: number;
  course_title: string;
  topic_id: number | null;
  video_urls: string[];
  image_urls: string[];
  attachment_urls: string[];
  attachment_links: string[];
  created_at: string | null;
  is_supplementary?: boolean;
  is_locked?: boolean;
};

type QuestionRow = {
  id: number;
  text: string;
  type: string;
  course_id: number;
  course_title: string;
  topic_id: number | null;
  topic_title: string | null;
  status: "not_submitted" | "submitted";
  grade: number | null;
  teacher_comment: string | null;
  created_at: string | null;
};

type ClassworkItem =
  | { kind: "assignment"; data: AssignmentRow }
  | { kind: "material"; data: MaterialRow }
  | { kind: "question"; data: QuestionRow };

type SubmissionAttachment = { kind: "file" | "link"; url: string };

type CourseTopic = {
  id: number;
  title: string;
};

type TopicSection = {
  key: string;
  topicId: number | null;
  title: string;
  items: ClassworkItem[];
};

/** Stable empty refs so React deps / useEffect do not fire every render when query has no data yet. */
const EMPTY_ASSIGNMENTS: AssignmentRow[] = [];
const EMPTY_MATERIALS: MaterialRow[] = [];
const EMPTY_QUESTIONS: QuestionRow[] = [];
const EMPTY_TOPICS: CourseTopic[] = [];

function attachmentLabel(url: string, googleFormText: string) {
  const lower = url.toLowerCase();
  if (lower.includes("forms")) return googleFormText;
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function classifySubmissionAttachment(url: string): "link" | "file" {
  return /^https?:\/\//i.test(url.trim()) ? "link" : "file";
}

function normalizeExternalLinkUrl(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

function apiErrorDetail(err: unknown): string | null {
  const ax = err as AxiosError<{ detail?: unknown }>;
  const d = ax.response?.data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d) && d.length > 0) {
    const first = d[0] as { msg?: string };
    if (typeof first?.msg === "string") return first.msg;
  }
  return null;
}

/* ── YouTube helpers ── */
function isYouTubeUrl(url: string): boolean {
  return /youtube\.com|youtu\.be/i.test(url);
}

function getYouTubeEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    let videoId = u.searchParams.get("v");
    if (!videoId && u.hostname.includes("youtu.be")) {
      videoId = u.pathname.slice(1);
    }
    return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
  } catch {
    return null;
  }
}

function fileKindIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".doc") || lower.endsWith(".docx"))
    return <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white">W</span>;
  if (lower.endsWith(".pdf"))
    return <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-600 text-xs font-bold text-white">PDF</span>;
  return <FileText className="h-10 w-10 shrink-0 text-blue-500" />;
}

function AttachmentsBlockRich({
  urls,
  links,
  linkTitle,
}: {
  urls: string[];
  links: string[];
  linkTitle: string;
}) {
  const { t } = useLanguage();
  const border = "border-gray-200 dark:border-gray-700";
  if (urls.length === 0 && links.length === 0) return null;
  return (
    <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-2">
      {urls.map((u, idx) => {
        const name = u.split("/").pop()?.split("?")[0] || `${t("fileLabel")} ${idx + 1}`;
        return (
          <a
            key={`${u}-${idx}`}
            href={u}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex min-h-[88px] w-full min-w-0 items-center gap-3 rounded-2xl border p-4 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50",
              border
            )}
          >
            {fileKindIcon(name)}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t("fileLabel")}</p>
            </div>
          </a>
        );
      })}
      {links.map((u, idx) => (
        <a
          key={`${u}-${idx}`}
          href={u}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "flex min-h-[88px] w-full min-w-0 items-center gap-3 rounded-2xl border p-4 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50",
            border
          )}
        >
          <Globe className="h-10 w-10 shrink-0 text-gray-400" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{linkTitle}</p>
            <p className="truncate text-xs text-gray-500 dark:text-gray-400">{attachmentLabel(u, t("googleFormLabel"))}</p>
          </div>
        </a>
      ))}
    </div>
  );
}

function VideosBlock({ urls }: { urls: string[] }) {
  const { t } = useLanguage();
  if (!urls?.length) return null;
  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">{t("teacherVideo")}</div>
      <div className="space-y-1">
        {urls.map((u, idx) => (
          <a
            key={`${u}-${idx}`}
            href={u}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-xl border border-gray-200 px-3 py-2 text-sm hover:underline dark:border-gray-700"
          >
            {u}
          </a>
        ))}
      </div>
    </div>
  );
}

function TranslationOr({ keyName, fallback }: { keyName: TranslationKey; fallback: string }) {
  const { t } = useLanguage();
  const v = t(keyName);
  return <>{v === keyName ? fallback : v}</>;
}

function rubricPointsMatch(awarded: number | undefined, levelPoints: number): boolean {
  if (awarded === undefined) return false;
  return Math.abs(Number(awarded) - Number(levelPoints)) < 0.01;
}

function normalizeRubricLevels(c: RubricItem): RubricLevelItem[] | null {
  const raw = c.levels;
  if (!raw || raw.length === 0) return null;
  return raw.map((lv) => ({
    text: typeof lv.text === "string" ? lv.text : "",
    points: Number(lv.points) || 0,
  }));
}

function AssignmentRubricBlock({
  rubric,
  rubricGrades,
  title,
  totalLabel,
}: {
  rubric: RubricItem[];
  rubricGrades: RubricGradeRow[];
  title: string;
  totalLabel: string;
}) {
  const { t } = useLanguage();
  const byCrit = useMemo(() => {
    const m = new Map<number, number>();
    rubricGrades.forEach((g) => m.set(g.criterion_id, g.points));
    return m;
  }, [rubricGrades]);

  const maxSum = useMemo(() => rubric.reduce((s, c) => s + Number(c.max_points), 0), [rubric]);
  const earned = useMemo(
    () => rubric.reduce((s, c) => s + (byCrit.get(c.id) ?? 0), 0),
    [rubric, byCrit]
  );

  const [blockOpen, setBlockOpen] = useState(true);
  const [openCriteria, setOpenCriteria] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(rubric.map((c) => [c.id, true]))
  );

  const allCriteriaOpen =
    rubric.length > 0 && rubric.every((c) => openCriteria[c.id] !== false);
  const toggleCriterion = (id: number) => {
    setOpenCriteria((prev) => ({ ...prev, [id]: prev[id] === false }));
  };
  const toggleExpandAll = () => {
    if (allCriteriaOpen) {
      setOpenCriteria(Object.fromEntries(rubric.map((c) => [c.id, false])));
    } else {
      setOpenCriteria(Object.fromEntries(rubric.map((c) => [c.id, true])));
    }
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <button
        type="button"
        onClick={() => setBlockOpen((o) => !o)}
        className="mb-1 flex w-full items-center justify-between gap-3 text-left"
      >
        <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">{title}</h3>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
            {earned > 0 || rubricGrades.length > 0 ? `${earned} / ${maxSum}` : `— / ${maxSum}`}
          </span>
          {blockOpen ? (
            <ChevronUp className="h-4 w-4 text-gray-400" aria-hidden />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400" aria-hidden />
          )}
        </div>
      </button>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs text-gray-500 dark:text-gray-400">{totalLabel}</p>
        {blockOpen && rubric.length > 1 ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleExpandAll();
            }}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-200 text-blue-600 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-blue-400 dark:hover:bg-gray-800"
            title={allCriteriaOpen ? t("assignmentRubricCollapseAll") : t("assignmentRubricExpandAll")}
            aria-label={allCriteriaOpen ? t("assignmentRubricCollapseAll") : t("assignmentRubricExpandAll")}
          >
            <ChevronsUpDown className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      {blockOpen ? (
        <ul className="space-y-0 divide-y divide-gray-100 dark:divide-gray-800">
          {rubric.map((c) => {
            const pts = byCrit.get(c.id);
            const got = pts ?? 0;
            const max = Number(c.max_points);
            const pct = max > 0 ? Math.min(100, (got / max) * 100) : 0;
            const hasGrade = pts !== undefined;
            const levels = normalizeRubricLevels(c);
            const isOpen = openCriteria[c.id] !== false;
            const desc = (c.description || "").trim();

            return (
              <li key={c.id} className="py-4 first:pt-0 last:pb-0">
                <button
                  type="button"
                  onClick={() => toggleCriterion(c.id)}
                  className="flex w-full items-start justify-between gap-2 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-blue-600 dark:text-blue-400">{c.name}</div>
                    {desc ? (
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{desc}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                      {hasGrade ? `${got} / ${max}` : `— / ${max}`}
                    </span>
                    {isOpen ? (
                      <ChevronUp className="h-4 w-4 text-blue-600 dark:text-blue-400" aria-hidden />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-blue-600 dark:text-blue-400" aria-hidden />
                    )}
                  </div>
                </button>

                {isOpen ? (
                  <div className="mt-3">
                    {levels ? (
                      <div className="flex flex-wrap gap-2">
                        {levels.map((lv, idx) => {
                          const selected = hasGrade && rubricPointsMatch(pts, lv.points);
                          return (
                            <div
                              key={`${c.id}-lv-${idx}-${lv.points}`}
                              className={cn(
                                "min-w-[140px] max-w-full flex-1 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors sm:max-w-[260px]",
                                selected
                                  ? "border-transparent bg-blue-600 text-white dark:bg-blue-500"
                                  : "border-gray-200 bg-white text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                              )}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <span className={cn("font-semibold leading-snug", selected ? "text-white" : "")}>
                                  {lv.text || "—"}
                                </span>
                                <span
                                  className={cn(
                                    "shrink-0 text-xs italic",
                                    selected ? "text-white/90" : "text-gray-500 dark:text-gray-400"
                                  )}
                                >
                                  {t("assignmentRubricLevelPoints").replace("{n}", String(lv.points))}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                    <div
                      className={cn(
                        "h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800",
                        levels ? "mt-3" : "mt-2"
                      )}
                    >
                      <div
                        className="h-full rounded-full bg-blue-600 transition-all dark:bg-blue-500"
                        style={{ width: `${hasGrade ? pct : 0}%` }}
                      />
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

export function StudentCourseClasswork({ 
  courseId, 
  initialAssignmentId 
}: { 
  courseId: number; 
  initialAssignmentId?: number;
}) {
  const { t, lang } = useLanguage();
  const queryClient = useQueryClient();
  const courseIdOk = Number.isFinite(courseId) && courseId > 0;

  const initialAssignmentIdValid =
    initialAssignmentId != null && Number.isFinite(initialAssignmentId) && initialAssignmentId > 0;
  const [activeView, setActiveView] = useState<"list" | "detail">(
    initialAssignmentIdValid ? "detail" : "list"
  );
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<number | null>(
    initialAssignmentIdValid ? initialAssignmentId : null
  );

  const [submissionAttachments, setSubmissionAttachments] = useState<SubmissionAttachment[]>([]);
  const [submissionDraft, setSubmissionDraft] = useState("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showUnsubmitConfirm, setShowUnsubmitConfirm] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [linkDraft, setLinkDraft] = useState("");
  const [linkFieldOpen, setLinkFieldOpen] = useState(false);
  const [workActionError, setWorkActionError] = useState<string | null>(null);
  const addMenuRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [topicFilter, setTopicFilter] = useState<"all" | number>("all");
  const [topicFilterOpen, setTopicFilterOpen] = useState(false);
  const [collapsedTopics, setCollapsedTopics] = useState<Record<string, boolean>>({});
  const [expandedItem, setExpandedItem] = useState<number | null>(null);
  const [expandedMaterial, setExpandedMaterial] = useState<number | null>(null);
  const [allCollapsed, setAllCollapsed] = useState(false);

  const topicFilterRef = useRef<HTMLDivElement | null>(null);
  const prevSelectedAssignmentIdRef = useRef<number | null>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (topicFilterRef.current && !topicFilterRef.current.contains(e.target as Node)) {
        setTopicFilterOpen(false);
      }
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setAddMenuOpen(false);
      }
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  const {
    data: assignmentsData,
    isPending: assignmentsPending,
    isError: assignmentsError,
    error: assignmentsErrorObj,
    refetch: refetchAssignments,
  } = useQuery({
    queryKey: ["student-assignments", courseId],
    queryFn: async () => {
      const { data } = await api.get<AssignmentRow[]>(`/assignments/my`);
      return Array.isArray(data) ? data : [];
    },
    staleTime: 20_000,
    enabled: courseIdOk,
    retry: 1,
  });
  const assignments = assignmentsData ?? EMPTY_ASSIGNMENTS;

  const { data: topicsData } = useQuery({
    queryKey: ["course-topics", courseId],
    queryFn: async () => {
      const { data } = await api.get<CourseTopic[]>(`/courses/${courseId}/topics`);
      return Array.isArray(data) ? data : [];
    },
    staleTime: 60_000,
    enabled: courseIdOk,
    retry: 1,
  });
  const topics = topicsData ?? EMPTY_TOPICS;

  const { data: materialsData } = useQuery({
    queryKey: ["student-materials", courseId],
    queryFn: async () => {
      const { data } = await api.get<MaterialRow[]>(`/assignments/my-materials`);
      return Array.isArray(data) ? data : [];
    },
    staleTime: 20_000,
    enabled: courseIdOk,
    retry: 1,
  });
  const materials = materialsData ?? EMPTY_MATERIALS;

  const { data: questionsData } = useQuery({
    queryKey: ["student-questions", courseId],
    queryFn: async () => {
      const { data } = await api.get<QuestionRow[]>(`/questions/my`);
      return Array.isArray(data) ? data : [];
    },
    staleTime: 60_000,
    enabled: courseIdOk,
    retry: 1,
  });
  const questions = questionsData ?? EMPTY_QUESTIONS;

  const courseAssignments = useMemo(
    () => assignments.filter((a) => a.course_id === courseId),
    [assignments, courseId]
  );

  const courseMaterials = useMemo(
    () => materials.filter((m) => m.course_id === courseId),
    [materials, courseId]
  );

  const courseQuestions = useMemo(
    () => questions.filter((q) => q.course_id === courseId),
    [questions, courseId]
  );

  const topicSections = useMemo(() => {
    const assignmentItems = (arr: AssignmentRow[]): ClassworkItem[] =>
      arr.map((a) => ({ kind: "assignment" as const, data: a }));
    const materialItems = (arr: MaterialRow[]): ClassworkItem[] =>
      arr.map((m) => ({ kind: "material" as const, data: m }));
    const questionItems = (arr: QuestionRow[]): ClassworkItem[] =>
      arr.map((q) => ({ kind: "question" as const, data: q }));

    const filterA = (arr: AssignmentRow[]) =>
      topicFilter === "all" ? arr : arr.filter((a) => a.topic_id === topicFilter);
    const filterM = (arr: MaterialRow[]) =>
      topicFilter === "all" ? arr : arr.filter((m) => m.topic_id === topicFilter);
    const filterQ = (arr: QuestionRow[]) =>
      topicFilter === "all" ? arr : arr.filter((q) => q.topic_id === topicFilter);

    const sections: TopicSection[] = [];

    for (const tp of topics) {
      const items: ClassworkItem[] = [
        ...assignmentItems(filterA(courseAssignments.filter((a) => a.topic_id === tp.id))),
        ...materialItems(filterM(courseMaterials.filter((m) => m.topic_id === tp.id))),
        ...questionItems(filterQ(courseQuestions.filter((q) => q.topic_id === tp.id))),
      ];
      sections.push({ key: `t-${tp.id}`, topicId: tp.id, title: getLocalizedTopicTitle(tp.title, t as any), items });
    }

    const uncatItems: ClassworkItem[] = [
      ...assignmentItems(filterA(courseAssignments.filter((a) => a.topic_id == null))),
      ...materialItems(filterM(courseMaterials.filter((m) => m.topic_id == null))),
      ...questionItems(filterQ(courseQuestions.filter((q) => q.topic_id == null))),
    ];
    if (uncatItems.length > 0) {
      sections.push({ key: "uncategorized", topicId: null, title: t("courseTopicUncategorized"), items: uncatItems });
    }

    if (topicFilter === "all") return sections;
    return sections.filter((s) => s.items.length > 0 || s.topicId === topicFilter);
  }, [courseAssignments, courseMaterials, courseQuestions, topics, topicFilter, t]);

  const selectedAssignment = useMemo(() => {
    if (selectedAssignmentId == null) return null;
    return assignments.find((a) => a.id === selectedAssignmentId) ?? null;
  }, [assignments, selectedAssignmentId]);

  useEffect(() => {
    if (selectedAssignmentId == null) {
      prevSelectedAssignmentIdRef.current = null;
      return;
    }
    // Avoid treating "no row" as missing submission while /assignments/my is still loading (prevents setState loops).
    if (assignmentsPending && courseIdOk) return;

    const row = assignments.find((a) => a.id === selectedAssignmentId);
    const idChanged = prevSelectedAssignmentIdRef.current !== selectedAssignmentId;
    prevSelectedAssignmentIdRef.current = selectedAssignmentId;
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;

      if (!row) {
        setWorkActionError(null);
        setLinkFieldOpen(false);
        setLinkDraft("");
        setSubmissionAttachments([]);
        setSubmissionDraft("");
        return;
      }

      if (idChanged) {
        setWorkActionError(null);
        setLinkFieldOpen(false);
        setLinkDraft("");
      }

      if (row.submitted) {
        setSubmissionAttachments(
          (row.submission_file_urls ?? []).map((url) => ({
            kind: classifySubmissionAttachment(url),
            url,
          }))
        );
        setSubmissionDraft("");
        return;
      }
      if (idChanged) {
        setSubmissionAttachments([]);
        setSubmissionDraft("");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [selectedAssignmentId, assignments, assignmentsPending, courseIdOk]);

  const submitMutation = useMutation({
    mutationFn: async ({
      assignmentId,
      fileUrlsToSubmit,
      submissionText,
    }: {
      assignmentId: number;
      fileUrlsToSubmit: string[];
      submissionText: string | null;
    }) => {
      await api.post(`/assignments/${assignmentId}/submit`, {
        submission_text: submissionText?.trim() || null,
        file_urls: fileUrlsToSubmit.length ? fileUrlsToSubmit : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student-assignments", courseId] });
      setShowConfirmDialog(false);
      setWorkActionError(null);
    },
    onError: (err) => {
      setWorkActionError(apiErrorDetail(err) ?? t("assignmentSubmitErrorGeneric"));
    },
  });

  const unsubmitMutation = useMutation({
    mutationFn: async ({ assignmentId }: { assignmentId: number }) => {
      await api.post(`/assignments/${assignmentId}/unsubmit`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student-assignments", courseId] });
      setWorkActionError(null);
    },
    onError: (err) => {
      const detail = apiErrorDetail(err);
      if (detail === "Cannot unsubmit a graded submission") {
        setWorkActionError(t("unsubmitErrorGraded"));
      } else {
        setWorkActionError(detail ?? t("assignmentSubmitErrorGeneric"));
      }
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ assignmentId, file }: { assignmentId: number; file: File }) => {
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await api.post<{ url: string }>(
        `/assignments/submissions/upload?assignment_id=${assignmentId}`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      return data?.url ?? "";
    },
    onSuccess: (url) => {
      if (!url) return;
      setSubmissionAttachments((prev) => {
        if (prev.length >= 5) return prev;
        return [...prev, { kind: "file" as const, url }].slice(0, 5);
      });
      setWorkActionError(null);
    },
    onError: (err) => {
      setWorkActionError(apiErrorDetail(err) ?? t("assignmentSubmitErrorGeneric"));
    },
  });

  const toggleTopicCollapsed = useCallback((key: string) => {
    setCollapsedTopics((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const toggleAllCollapsed = useCallback(() => {
    const nextCollapsed = !allCollapsed;
    setAllCollapsed(nextCollapsed);
    const next: Record<string, boolean> = {};
    if (nextCollapsed) {
      for (const s of topicSections) {
        next[s.key] = true;
      }
    }
    setCollapsedTopics(next);
  }, [allCollapsed, topicSections]);

  const openDetail = useCallback((id: number) => {
    setSelectedAssignmentId(id);
    setActiveView("detail");
  }, []);

  const backToList = useCallback(() => {
    setWorkActionError(null);
    setActiveView("list");
    setSelectedAssignmentId(null);
    // Also clear from URL if present
    const q = new URLSearchParams(window.location.search);
    if (q.has("assignmentId")) {
      q.delete("assignmentId");
      const s = q.toString();
      window.history.replaceState(null, "", s ? `?${s}` : window.location.pathname);
    }
  }, []);

  const handleFilePick = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !selectedAssignment || submissionAttachments.length >= 5) {
        e.target.value = "";
        return;
      }
      uploadMutation.mutate({ assignmentId: selectedAssignment.id, file });
      e.target.value = "";
      setAddMenuOpen(false);
      setLinkFieldOpen(false);
    },
    [selectedAssignment, submissionAttachments.length, uploadMutation]
  );

  const removeAttachment = useCallback((idx: number) => {
    setSubmissionAttachments((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const tryAddLink = useCallback(() => {
    const normalized = normalizeExternalLinkUrl(linkDraft);
    if (!normalized) {
      setWorkActionError(t("studentSubmissionLinkInvalid"));
      return;
    }
    setWorkActionError(null);
    setSubmissionAttachments((prev) => {
      if (prev.length >= 5) return prev;
      if (prev.some((a) => a.url === normalized)) return prev;
      return [...prev, { kind: "link" as const, url: normalized }];
    });
    setLinkDraft("");
    setLinkFieldOpen(false);
    setAddMenuOpen(false);
  }, [linkDraft, t]);

  const onMarkAsDoneClick = useCallback(() => {
    if (!selectedAssignment) return;
    const hasAttachments = submissionAttachments.length > 0;
    const hasText = submissionDraft.trim().length > 0;
    if (!hasAttachments && !hasText) return;
    setWorkActionError(null);
    setShowConfirmDialog(true);
  }, [selectedAssignment, submissionAttachments.length, submissionDraft]);

  const confirmHandIn = useCallback(() => {
    if (!selectedAssignment) return;
    submitMutation.mutate({
      assignmentId: selectedAssignment.id,
      fileUrlsToSubmit: submissionAttachments.map((a) => a.url),
      submissionText: submissionDraft.trim() || null,
    });
  }, [selectedAssignment, submissionAttachments, submissionDraft, submitMutation]);

  if (!courseIdOk) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-800">
        <p className="text-gray-800 dark:text-white">{t("courseError")}</p>
      </div>
    );
  }

  if (assignmentsError) {
    const msg =
      (assignmentsErrorObj as { response?: { data?: { detail?: string } }; message?: string })?.response?.data
        ?.detail ??
      (assignmentsErrorObj as Error)?.message ??
      t("assignmentsLoadError");
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 rounded-2xl border border-red-100 bg-red-50/50 p-8 text-center dark:border-red-900/40 dark:bg-red-950/20">
        <p className="text-sm font-medium text-red-800 dark:text-red-200">{t("assignmentsLoadError")}</p>
        <p className="max-w-md text-xs text-red-600/90 dark:text-red-300/90">{String(msg)}</p>
        <button
          type="button"
          onClick={() => refetchAssignments()}
          className="rounded-xl bg-[var(--qit-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          {t("retry")}
        </button>
      </div>
    );
  }

  if (assignmentsPending && courseIdOk) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
      </div>
    );
  }

  if (activeView === "detail" && selectedAssignmentId != null && !selectedAssignment) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-800">
        <p className="text-gray-800 dark:text-white">{t("assignmentNoTasks")}</p>
        <button
          type="button"
          onClick={backToList}
          className="mt-4 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          {t("assignmentsList")}
        </button>
      </div>
    );
  }

  if (activeView === "detail" && selectedAssignment) {
    const a = selectedAssignment;
    const canUnsubmit = a.submitted && a.grade === null && !a.closed && !unsubmitMutation.isPending;
    const canTurnIn =
      !a.submitted && !a.closed && (submissionAttachments.length > 0 || submissionDraft.trim().length > 0);
    const submissionBlocked = a.closed && !a.submitted;
    const myWorkStatus: "appointed" | "submitted" | "graded" =
      a.grade !== null ? "graded" : a.submitted ? "submitted" : "appointed";

    return (
      <div className="min-w-0 space-y-6">
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 pb-4 dark:border-gray-700">
          <button
            type="button"
            onClick={backToList}
            className="inline-flex items-center gap-2 text-sm font-bold text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 px-3 py-1.5 rounded-lg transition-all"
          >
            <ChevronLeft className="h-4 w-4" />
            {t("assignmentsList")}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
          <div className="min-w-0 space-y-6">
            <div className="flex flex-col gap-4 border-b border-gray-100 pb-6 dark:border-gray-800 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex min-w-0 items-start gap-3 sm:gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/20 sm:h-12 sm:w-12">
                  <ClipboardList className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="break-words text-2xl font-extrabold leading-tight text-gray-900 dark:text-white sm:text-3xl">{a.title}</h1>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-medium text-gray-600 dark:text-gray-300">
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {a.teacher_name?.trim() || t("studentTeacher")}
                    </span>
                    {a.created_at ? (
                      <>
                        <span className="h-1 w-1 rounded-full bg-gray-300 dark:bg-gray-600" />
                        <span>
                          {t("assignmentPosted")}: {formatRelativeDate(a.created_at, lang, t)}
                        </span>
                      </>
                    ) : null}
                  </div>
                  <p className="mt-3 text-base font-bold text-gray-900 dark:text-white">
                    {t("assignmentGradeOutOf")
                      .replace("{current}", a.grade != null ? String(a.grade) : "—")
                      .replace("{max}", String(a.max_points))}
                  </p>
                </div>
              </div>
              <div className="shrink-0 text-left text-sm lg:text-right">
                <p className="text-xs font-bold uppercase tracking-wide text-gray-400">{t("assignmentDueWithTime")}</p>
                <p className="mt-1 font-semibold text-gray-900 dark:text-white">
                  {a.deadline ? formatLocalizedDate(a.deadline, lang, t, { includeTime: true, shortMonth: true }) : t("noDueDate")}
                </p>
                {a.submitted_at ? (
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    {t("submittedStatus")}: {formatLocalizedDate(a.submitted_at, lang, t, { includeTime: true, shortMonth: true })}
                  </p>
                ) : null}
                {a.graded_at ? (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {t("gradedStatus")}: {formatLocalizedDate(a.graded_at, lang, t, { includeTime: true, shortMonth: true })}
                  </p>
                ) : null}
              </div>
            </div>

            {a.description ? (
              <div
                className="prose prose-blue max-w-none break-words leading-relaxed text-gray-800 dark:prose-invert dark:text-gray-100 [&_img]:max-w-full [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto"
                dangerouslySetInnerHTML={{ __html: htmlLinksOpenInNewTab(a.description) }}
              />
            ) : null}

            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400">{t("assignmentMaterialsHeading")}</h3>
              <AttachmentsBlockRich
                urls={a.attachment_urls ?? []}
                links={a.attachment_links ?? []}
                linkTitle={t("linkOption")}
              />
              <VideosBlock urls={a.video_urls ?? []} />
            </div>

            {(a.rubric?.length ?? 0) > 0 ? (
              <AssignmentRubricBlock
                key={`rubric-${a.id}-${(a.rubric ?? []).map((c) => c.id).join("-")}`}
                rubric={a.rubric ?? []}
                rubricGrades={a.rubric_grades ?? []}
                title={t("assignmentRubric")}
                totalLabel={t("assignmentRubricTotal")}
              />
            ) : null}

            <div className="border-t border-gray-100 pt-6 dark:border-gray-800">
              <AssignmentClassCommentsSection
                assignmentId={a.id}
                canPost={a.allow_student_class_comments !== false}
              />
            </div>
          </div>

          <aside className="min-w-0 space-y-6">
            <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">{t("myWork")}</h3>
                <span className={cn(
                  "text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md",
                  myWorkStatus === "graded" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                  myWorkStatus === "submitted" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                  "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                )}>
                  {myWorkStatus === "graded" && t("gradedStatus")}
                  {myWorkStatus === "submitted" && t("submittedStatus")}
                  {myWorkStatus === "appointed" && t("appointedStatus")}
                </span>
              </div>

              {workActionError ? (
                <div
                  className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
                  role="alert"
                >
                  {workActionError}
                </div>
              ) : null}

              {submissionBlocked ? (
                <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 dark:border-gray-800 dark:bg-gray-800/50 dark:text-gray-300">
                  {a.manually_closed ? (
                    <>
                      <p className="font-semibold">{t("assignmentClosedByTeacherTitle")}</p>
                      <p className="mt-2 text-xs leading-relaxed opacity-95">{t("assignmentClosedByTeacherBody")}</p>
                    </>
                  ) : (
                    <>
                      <p className="font-semibold">{t("assignmentCannotSubmitPastDeadline")}</p>
                      <p className="mt-2 text-xs leading-relaxed opacity-95">{t("assignmentDeadlinePassedStudentExplanation")}</p>
                    </>
                  )}
                </div>
              ) : null}

              {submissionAttachments.length > 0 ? (
                <ul className="mb-4 space-y-2">
                  {submissionAttachments.map((att, idx) => (
                    <li
                      key={`${att.url}-${idx}`}
                      className="group flex items-center justify-between gap-3 rounded-xl border border-gray-100 p-3 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {att.kind === "link" ? (
                          <Globe className="h-5 w-5 shrink-0 text-sky-600 dark:text-sky-400" />
                        ) : (
                          <FileText className="h-5 w-5 shrink-0 text-blue-500" />
                        )}
                        <a
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="truncate text-sm font-medium text-gray-700 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400 transition-colors"
                        >
                          {att.kind === "link"
                            ? att.url
                            : att.url.split("/").pop()?.split("?")[0] || `${t("fileOption")} ${idx + 1}`}
                        </a>
                      </div>
                      {!a.submitted && !a.closed && (
                        <button
                          type="button"
                          className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                          onClick={() => removeAttachment(idx)}
                          aria-label={t("cancel")}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : null}

              {!a.submitted && !a.closed && (
                <div className="mb-4">
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-400">
                    {t("studentSubmissionAnswerLabel")}
                  </label>
                  <textarea
                    value={submissionDraft}
                    onChange={(e) => setSubmissionDraft(e.target.value)}
                    rows={4}
                    placeholder={t("studentSubmissionAnswerPlaceholder")}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500"
                  />
                </div>
              )}

              {a.submitted && (a.submission_text?.trim() ?? "") ? (
                <div className="mb-4 rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-800/50">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">{t("studentSubmissionAnswerLabel")}</p>
                  <p className="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-100 break-words">{a.submission_text}</p>
                </div>
              ) : null}

              {!a.submitted && !a.closed && (
                <div className="relative mb-4" ref={addMenuRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setAddMenuOpen((o) => !o);
                      setLinkFieldOpen(false);
                      setLinkDraft("");
                    }}
                    disabled={uploadMutation.isPending || submissionAttachments.length >= 5}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 bg-white px-4 py-3 text-sm font-bold text-blue-600 hover:border-blue-200 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-blue-400 dark:hover:border-blue-900/50 dark:hover:bg-blue-900/10 transition-all"
                  >
                    <Plus className="h-5 w-5" />
                    {t("addOrCreate")}
                  </button>
                  {addMenuOpen && (
                    <div className="absolute left-0 right-0 z-20 mt-2 rounded-2xl border border-gray-200 bg-white p-2 shadow-xl dark:border-gray-700 dark:bg-gray-900 animate-in fade-in zoom-in duration-100">
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        onClick={() => {
                          setLinkFieldOpen(false);
                          fileInputRef.current?.click();
                        }}
                      >
                        <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                          <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        {t("fileOption")}
                      </button>
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        onClick={() => setLinkFieldOpen((v) => !v)}
                      >
                        <div className="p-2 bg-sky-50 dark:bg-sky-900/30 rounded-lg">
                          <Globe className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                        </div>
                        {t("linkOption")}
                      </button>
                      {linkFieldOpen ? (
                        <div className="mt-2 space-y-2 border-t border-gray-100 px-2 pt-3 dark:border-gray-800">
                          <input
                            type="url"
                            value={linkDraft}
                            onChange={(e) => setLinkDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                tryAddLink();
                              }
                            }}
                            placeholder={t("studentSubmissionLinkPlaceholder")}
                            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                          />
                          <button
                            type="button"
                            onClick={tryAddLink}
                            disabled={submissionAttachments.length >= 5}
                            className="w-full rounded-lg bg-sky-600 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
                          >
                            {t("studentSubmissionAttachLink")}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".jpg,.jpeg,.png,.gif,.webp,.mp4,.webm,.pdf,.doc,.docx,.txt"
                    onChange={handleFilePick}
                    disabled={submissionAttachments.length >= 5}
                  />
                </div>
              )}

              {uploadMutation.isPending && (
                <div className="mb-4 flex items-center justify-center gap-2 text-sm font-bold text-blue-600 animate-pulse">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("assignmentUploadFile")}
                </div>
              )}



              {!a.submitted ? (
                <button
                  type="button"
                  onClick={onMarkAsDoneClick}
                  disabled={!canTurnIn || submitMutation.isPending || a.closed}
                  className="w-full rounded-xl bg-blue-600 py-4 text-sm font-extrabold text-white shadow-lg shadow-blue-500/30 hover:bg-blue-700 hover:shadow-blue-500/40 disabled:cursor-not-allowed disabled:opacity-50 transition-all active:scale-[0.98]"
                >
                  {submitMutation.isPending ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : t("markAsDone")}
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-center gap-2 py-3 rounded-xl bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 font-bold text-sm">
                    <CheckCircle2 className="w-5 h-5" />
                    {t("submitted")}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setWorkActionError(null);
                      setShowUnsubmitConfirm(true);
                    }}
                    disabled={!canUnsubmit || unsubmitMutation.isPending}
                    className="w-full rounded-xl border border-gray-200 bg-white py-3 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700/50 transition-all"
                  >
                    {unsubmitMutation.isPending ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : t("cancelSending")}
                  </button>
                </div>
              )}

              {a.grade !== null && (
                <div className="mt-6 rounded-2xl border-2 border-green-100 bg-green-50/30 p-5 dark:border-green-900/30 dark:bg-green-900/10">
                  <div className="mb-2 flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-green-700 dark:text-green-400">
                      {t("assignmentGradeSectionTitle")}
                    </h4>
                    <span className="text-2xl font-black text-green-700 dark:text-green-400">
                      {a.grade}{" "}
                      <span className="text-sm font-bold opacity-60">/ {a.max_points}</span>
                    </span>
                  </div>
                  {a.teacher_comment && (
                    <div className="mt-4 border-t border-green-100 pt-4 dark:border-green-900/30">
                      <p className="mb-2 text-xs font-bold uppercase text-gray-400">{t("assignmentTeacherCommentSection")}</p>
                      <p className="text-sm italic leading-relaxed text-gray-700 dark:text-gray-200">
                        &ldquo;{a.teacher_comment}&rdquo;
                      </p>
                    </div>
                  )}
                </div>
              )}

            </div>

            <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                  <Users className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <PrivateCommentsSection
                    targetType="assignment"
                    targetId={a.id}
                    title={t("personalComments")}
                    placeholder={t("addCommentForTeacher")}
                  />
                </div>
              </div>
            </div>
          </aside>
        </div>

        {showConfirmDialog ? (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center sm:p-4">
            <div
              role="dialog"
              aria-modal="true"
              className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-gray-200 bg-white p-5 shadow-xl dark:border-gray-700 dark:bg-gray-800 sm:p-6"
            >
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t("handInAssignment")}</h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                {submissionAttachments.length > 0 ? (
                  <>{t("handInWillSendAttachmentsCount").replace("{n}", String(submissionAttachments.length))} </>
                ) : (
                  <>{t("submissionTextWillBeSent")} </>
                )}
                &quot;{a.title}&quot;.
              </p>
              {submissionAttachments.length > 0 ? (
                <ul className="mt-3 max-h-40 space-y-2 overflow-y-auto">
                  {submissionAttachments.map((att, idx) => (
                    <li key={`${att.url}-${idx}`} className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-100">
                      {att.kind === "link" ? (
                        <Globe className="h-4 w-4 shrink-0 text-sky-600" />
                      ) : (
                        <FileText className="h-4 w-4 shrink-0 text-blue-600" />
                      )}
                      <span className="truncate">
                        {att.kind === "link"
                          ? att.url
                          : att.url.split("/").pop()?.split("?")[0] || att.url}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {submissionDraft.trim() ? (
                <p className="mt-2 line-clamp-4 text-xs text-gray-500 dark:text-gray-400 whitespace-pre-wrap">
                  {submissionDraft.trim()}
                </p>
              ) : null}
              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setShowConfirmDialog(false)}
                  className="rounded-full border border-gray-200 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
                >
                  {t("cancel")}
                </button>
                <button
                  type="button"
                  onClick={confirmHandIn}
                  disabled={submitMutation.isPending}
                  className="rounded-full bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : t("assignmentSubmit")}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  /* ─── List view: Google Classroom style grouped by topics ─── */

  const totalItems = courseAssignments.length + courseMaterials.length;

  function commentsLabel(n: number) {
    if (n === 0) return null;
    if (n === 1) return t("classCommentsCountOne");
    return t("classCommentsCount").replace("{n}", String(n));
  }

  return (
    <div className="min-w-0 space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-end gap-3">
        {/* Topic filter dropdown */}
        <div className="relative min-w-0 max-w-full" ref={topicFilterRef}>
          <div className="mb-1 pl-1 text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">{t("topicFilter")}</div>
          <button
            type="button"
            onClick={() => setTopicFilterOpen((o) => !o)}
            className="group inline-flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-all hover:border-blue-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-blue-500 dark:hover:bg-gray-700/50 min-w-0 w-full max-w-[min(100%,320px)] sm:min-w-[260px] sm:w-auto"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Filter className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors shrink-0" />
              <span className="truncate">{topicFilter === "all" ? t("allTopics") : getLocalizedTopicTitle(topics.find((tp) => tp.id === topicFilter)?.title || "", t as any) || t("allTopics")}</span>
            </div>
            <ChevronDown className={cn("w-4 h-4 text-gray-400 transition-transform duration-200 shrink-0", topicFilterOpen && "rotate-180")} />
          </button>
          {topicFilterOpen && (
            <div className="absolute left-0 top-full mt-2 z-40 min-w-[240px] max-h-72 overflow-y-auto rounded-2xl border border-gray-200 bg-white p-1.5 shadow-xl dark:border-gray-700 dark:bg-gray-900 animate-in fade-in zoom-in duration-100">
              <button
                type="button"
                className={cn(
                  "w-full text-left px-3.5 py-2.5 text-sm rounded-xl transition-colors",
                  topicFilter === "all" 
                    ? "bg-blue-50 text-blue-600 font-bold dark:bg-blue-900/20 dark:text-blue-400" 
                    : "text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                )}
                onClick={() => { setTopicFilter("all"); setTopicFilterOpen(false); }}
              >
                {t("allTopics")}
              </button>
              <div className="my-1 border-t border-gray-100 dark:border-gray-800" />
              {topics.map((tp) => (
                <button
                  key={tp.id}
                  type="button"
                  className={cn(
                    "w-full text-left px-3.5 py-2.5 text-sm rounded-xl transition-colors",
                    topicFilter === tp.id 
                      ? "bg-blue-50 text-blue-600 font-bold dark:bg-blue-900/20 dark:text-blue-400" 
                      : "text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                  )}
                  onClick={() => { setTopicFilter(tp.id); setTopicFilterOpen(false); }}
                >
                  {getLocalizedTopicTitle(tp.title, t as any)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Collapse/Expand all */}
        <button
          type="button"
          onClick={toggleAllCollapsed}
          className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
        >
          {allCollapsed ? (
            <>
              <ChevronDown className="w-4 h-4" />
              {t("expandAll")}
            </>
          ) : (
            <>
              <X className="w-4 h-4" />
              {t("collapseAll")}
            </>
          )}
        </button>
      </div>

      {/* Topic sections */}
      {totalItems === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-10 text-center dark:border-gray-700 dark:bg-gray-800">
          <p className="font-medium text-gray-800 dark:text-white">{t("classworkEmpty")}</p>
          <p className="text-sm mt-2 text-gray-500 dark:text-gray-400">{t("classworkEmptyHint")}</p>
        </div>
      ) : topicSections.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-10 text-center dark:border-gray-700 dark:bg-gray-800">
          <p className="font-medium text-gray-800 dark:text-white">{t("assignmentNoTasks")}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {topicSections.map((section) => {
            const collapsed = !!collapsedTopics[section.key];
            return (
              <div key={section.key}>
                {/* Section header — Google Classroom style */}
                <div
                  className="flex items-center gap-2 border-b border-gray-300 dark:border-gray-600 pb-2 mb-0 cursor-pointer hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors"
                  onClick={() => toggleTopicCollapsed(section.key)}
                >
                  <h3 className="flex-1 text-lg font-medium text-gray-900 dark:text-white min-w-0 truncate">
                    {section.title}
                  </h3>
                  <div className="p-1.5 rounded-full text-gray-500 dark:text-gray-400">
                    {collapsed ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
                  </div>
                </div>

                {/* Section items */}
                {!collapsed && (
                  <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
                    {section.items.length === 0 ? (
                      <div className="px-4 py-8 text-sm text-center text-gray-400 dark:text-gray-500">
                        {t("assignmentNoTasks")}
                      </div>
                    ) : (
                      section.items.map((cItem) => {
                        if (cItem.kind === "material") {
                          const mat = cItem.data as MaterialRow;
                          const isMaterialExpanded = expandedMaterial === mat.id;
                          const hasDescription = !!mat.description?.trim();
                          const hasVideos = mat.video_urls?.length > 0;
                          const hasFiles = (mat.attachment_urls?.length ?? 0) > 0 || (mat.attachment_links?.length ?? 0) > 0;
                          return (
                            <div key={`m-${mat.id}`}>
                              {/* Material row header */}
                              <div
                                role="button"
                                tabIndex={0}
                                onClick={() => {
                                  if (mat.is_locked) return;
                                  setExpandedMaterial(isMaterialExpanded ? null : mat.id);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    if (mat.is_locked) return;
                                    setExpandedMaterial(isMaterialExpanded ? null : mat.id);
                                  }
                                }}
                                className={cn(
                                  "flex flex-wrap items-center gap-x-3 gap-y-2 px-2 py-3 rounded-lg transition-colors",
                                  mat.is_locked ? "opacity-50 grayscale cursor-not-allowed" : "cursor-pointer",
                                  !mat.is_locked && (isMaterialExpanded ? "bg-purple-50/50 dark:bg-purple-900/10" : "hover:bg-gray-50 dark:hover:bg-gray-700/30")
                                )}
                              >
                                <div className={cn(
                                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white",
                                  mat.is_locked ? "bg-gray-400" : "bg-purple-600"
                                )}>
                                  {mat.is_locked ? <Lock className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <span className="block truncate text-sm text-gray-900 dark:text-white">
                                    {mat.title}
                                  </span>
                                  {mat.is_locked && (
                                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                                      {t("lockedWatchVideoFirst")}
                                    </span>
                                  )}
                                </div>
                                <span className="shrink-0 text-[10px] text-gray-500 dark:text-gray-400 sm:text-xs">
                                  {mat.created_at ? `${t("publishedLabel")} ${formatRelativeDate(mat.created_at, lang, t)}` : ""}
                                </span>
                              </div>

                              {/* Expanded material content */}
                              {isMaterialExpanded && (
                                <div className="border-t border-gray-100 dark:border-gray-700/50 bg-white dark:bg-gray-800 px-3 py-5 sm:px-4 sm:py-6 space-y-5 animate-in fade-in slide-in-from-top-2 duration-200">
                                  <div className="space-y-5 pl-0 sm:pl-12">
                                    {/* ── 🎥 Video Section ── */}
                                    {hasVideos && (
                                      <section>
                                        <div className="flex items-center gap-3 mb-4">
                                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-lg shadow-red-500/20">
                                            <Play className="w-5 h-5 text-white" />
                                          </div>
                                          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                            {t("teacherVideo")}
                                          </h3>
                                        </div>
                                        <div className="space-y-4">
                                          {mat.video_urls.map((url, i) =>
                                            isYouTubeUrl(url) ? (
                                              <div key={i} className="rounded-2xl overflow-hidden aspect-video shadow-xl border border-gray-200 dark:border-gray-700">
                                                <iframe
                                                  src={getYouTubeEmbedUrl(url) || url}
                                                  className="w-full h-full"
                                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                  allowFullScreen
                                                  title={mat.title}
                                                />
                                              </div>
                                            ) : (
                                              <a
                                                key={i}
                                                href={url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 hover:border-red-300 dark:hover:border-red-800 transition-colors"
                                              >
                                                <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                                                  <Video className="w-5 h-5 text-red-600 dark:text-red-400" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{mat.title}</p>
                                                  <p className="text-xs text-gray-500 truncate">{url}</p>
                                                </div>
                                                <ExternalLink className="w-4 h-4 text-gray-400 shrink-0" />
                                              </a>
                                            )
                                          )}
                                        </div>
                                      </section>
                                    )}

                                    {/* ── 📖 Theory / Description Section ── */}
                                    {hasDescription && (
                                      <section>
                                        <TopicTheoryContent content={mat.description!} />
                                      </section>
                                    )}

                                    {/* ── 📎 Files & Links Section ── */}
                                    {hasFiles && (
                                      <section>
                                        <div className="flex items-center gap-3 mb-4">
                                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                                            <Paperclip className="w-5 h-5 text-white" />
                                          </div>
                                          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                            {t("assignmentMaterialsHeading")}
                                          </h3>
                                        </div>
                                        <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-2">
                                          {(mat.attachment_urls ?? []).map((u, idx) => {
                                            const name = u.split("/").pop()?.split("?")[0] || `${t("fileLabel")} ${idx + 1}`;
                                            return (
                                              <a
                                                key={`${u}-${idx}`}
                                                href={u}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex min-h-[88px] w-full min-w-0 items-center gap-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 transition-all hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700"
                                              >
                                                {fileKindIcon(name)}
                                                <div className="min-w-0 flex-1">
                                                  <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{name}</p>
                                                  <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">{t("fileLabel")}</p>
                                                </div>
                                              </a>
                                            );
                                          })}
                                          {(mat.attachment_links ?? []).map((u, idx) => (
                                            <a
                                              key={`${u}-${idx}`}
                                              href={u}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="flex min-h-[88px] w-full min-w-0 items-center gap-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 transition-all hover:shadow-md hover:border-sky-300 dark:hover:border-sky-700"
                                            >
                                              <Globe className="h-10 w-10 shrink-0 text-gray-400" />
                                              <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{t("linkOption")}</p>
                                                <p className="truncate text-xs text-gray-500 dark:text-gray-400">{attachmentLabel(u, t("googleFormLabel"))}</p>
                                              </div>
                                            </a>
                                          ))}
                                        </div>
                                      </section>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        }
                        if (cItem.kind === "question") {
                          const q = cItem.data as QuestionRow;
                          const isGraded = q.grade !== null;
                          return (
                            <Link
                              key={`q-${q.id}`}
                              href={`/app/teacher/view-questions/${q.id}`}
                              className="flex flex-wrap items-center gap-x-3 gap-y-2 px-2 py-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/30 rounded-lg group"
                            >
                              <div className={cn(
                                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition-transform group-hover:scale-110",
                                q.status === "submitted" ? "bg-gray-400" : "bg-blue-500"
                              )}>
                                <MessageSquare className="h-4 w-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className="block truncate text-sm font-medium text-gray-900 dark:text-white">
                                  {q.text}
                                </span>
                                {q.status === "submitted" && (
                                  <span className="text-[10px] text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" />
                                    {isGraded ? `${t("gradedStatus")}: ${q.grade}` : t("submittedStatus")}
                                  </span>
                                )}
                              </div>
                              <span className="shrink-0 text-[10px] text-gray-500 dark:text-gray-400 sm:text-xs">
                                {q.created_at ? `${t("publishedLabel")} ${formatRelativeDate(q.created_at, lang, t)}` : ""}
                              </span>
                            </Link>
                          );
                        }

                        const item = cItem.data as AssignmentRow;
                        const itemKey = `a-${item.id}`;
                        const isExpanded = expandedItem === item.id;
                        const hasAttachments = (item.attachment_urls?.length ?? 0) > 0 || (item.attachment_links?.length ?? 0) > 0;
                        const isOverdue = item.deadline && !item.submitted && !item.closed && new Date(item.deadline).getTime() < Date.now();
                        const isGraded = item.grade !== null;
                        const ccCount = item.class_comments_count ?? 0;

                        return (
                          <div key={itemKey}>
                            {/* Assignment row */}
                            <div
                              role="button"
                              tabIndex={0}
                              onClick={() => {
                                if (item.is_locked) return;
                                setExpandedItem(isExpanded ? null : item.id);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  if (item.is_locked) return;
                                  setExpandedItem(isExpanded ? null : item.id);
                                }
                              }}
                              className={cn(
                                "flex flex-wrap items-center gap-x-3 gap-y-2 px-2 py-3 rounded-lg transition-colors",
                                item.is_locked ? "opacity-50 grayscale cursor-not-allowed" : "cursor-pointer",
                                !item.is_locked && (isExpanded ? "bg-blue-50/50 dark:bg-blue-900/10" : "hover:bg-gray-50 dark:hover:bg-gray-700/30")
                              )}
                            >
                              <div className={cn(
                                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white",
                                item.is_locked ? "bg-gray-400" : (item.submitted ? "bg-gray-400" : "bg-blue-600")
                              )}>
                                {item.is_locked ? <Lock className="h-4 w-4" /> : <ClipboardList className="h-4 w-4" />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-gray-900 dark:text-white truncate">
                                    {item.title}
                                  </span>
                                  {ccCount > 0 && (
                                    <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                                      <MessageSquare className="w-3.5 h-3.5" />
                                      {ccCount}
                                    </span>
                                  )}
                                </div>
                                {item.is_locked && (
                                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                                    {t("lockedWatchVideoFirst")}
                                  </span>
                                )}
                              </div>
                              <span
                                className={cn(
                                  "shrink-0 text-[10px] sm:text-xs",
                                  isOverdue ? "text-red-500 dark:text-red-400" : "text-gray-500 dark:text-gray-400"
                                )}
                              >
                                {item.deadline
                                  ? `${t("dueDateShort")} ${formatLocalizedDate(item.deadline, lang, t, { shortMonth: true })}`
                                  : t("noDueDate")}
                              </span>
                            </div>

                            {/* Expanded inline details */}
                            {isExpanded && (
                              <div className="border-t border-gray-100 dark:border-gray-700/50 bg-white dark:bg-gray-800 px-3 py-4 sm:px-4 sm:py-5 space-y-4">
                                <div className="space-y-4 pl-0 sm:pl-12">
                                  {/* Meta: Posted + Grade status */}
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="font-medium text-gray-500 dark:text-gray-400">
                                      {item.created_at ? `${t("publishedLabel")} ${formatRelativeDate(item.created_at, lang, t)}` : ""}
                                    </span>
                                    {isGraded ? (
                                      <span className="text-green-600 dark:text-green-400 font-medium">
                                        {t("withGrade")}
                                      </span>
                                    ) : null}
                                  </div>

                                  {/* Description */}
                                  {item.description && (
                                    <div
                                      className="prose prose-sm prose-blue max-w-none break-words text-gray-700 dark:prose-invert dark:text-gray-300 [&_img]:max-w-full [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto"
                                      dangerouslySetInnerHTML={{ __html: htmlLinksOpenInNewTab(item.description) }}
                                    />
                                  )}

                                  {/* Rubric compact badge */}
                                  {(item.rubric?.length ?? 0) > 0 && (
                                    <div className="inline-flex items-center gap-2 rounded border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-xs text-gray-600 dark:text-gray-300">
                                      <ClipboardList className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                      <span className="font-medium">
                                        {t("assignmentCriteria")}: {item.rubric!.length} {t("assignmentCriteria").toLowerCase()} · {item.max_points} {t("assignmentPoints")}
                                      </span>
                                    </div>
                                  )}

                                  {/* Attachment cards — GC style (horizontal cards with icon) */}
                                  {hasAttachments && (
                                    <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-2">
                                      {(item.attachment_urls ?? []).map((u, idx) => {
                                        const name = u.split("/").pop()?.split("?")[0] || `${t("fileLabel")} ${idx + 1}`;
                                        return (
                                          <a
                                            key={`${u}-${idx}`}
                                            href={u}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex min-h-[88px] w-full min-w-0 items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800/50"
                                          >
                                            {fileKindIcon(name)}
                                            <div className="min-w-0 flex-1">
                                              <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{name}</p>
                                              <p className="text-xs text-gray-500 dark:text-gray-400">{t("fileLabel")}</p>
                                            </div>
                                          </a>
                                        );
                                      })}
                                      {(item.attachment_links ?? []).map((u, idx) => (
                                        <a
                                          key={`${u}-${idx}`}
                                          href={u}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex min-h-[88px] w-full min-w-0 items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800/50"
                                        >
                                          <Globe className="h-10 w-10 shrink-0 text-gray-400" />
                                          <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{t("linkOption")}</p>
                                            <p className="truncate text-xs text-gray-500 dark:text-gray-400">{attachmentLabel(u, t("googleFormLabel"))}</p>
                                          </div>
                                        </a>
                                      ))}
                                    </div>
                                  )}

                                  {/* Class comments count */}
                                  {ccCount > 0 && (
                                    <div className="flex items-center gap-2 text-xs font-medium text-blue-600 dark:text-blue-400">
                                      <MessageSquare className="w-4 h-4" />
                                      {commentsLabel(ccCount)}
                                    </div>
                                  )}

                                  {/* "Instructions" button (opens detail) */}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openDetail(item.id);
                                    }}
                                    className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                                  >
                                    {t("viewInstructions")}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Unsubmit Confirmation Dialogue */}
      {showUnsubmitConfirm && selectedAssignment ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowUnsubmitConfirm(false)}>
          <div
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-gray-900 border border-gray-100 dark:border-gray-800 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 mb-4">
              <AlertTriangle className="h-7 w-7" />
            </div>
            <h3 className="text-xl font-black text-gray-900 dark:text-white">{t("confirmUnsubmit")}</h3>
            <p className="mt-2 text-sm font-medium text-gray-600 dark:text-gray-400 leading-relaxed">
              {t("unsubmitDescription")}
            </p>
            <div className="mt-8 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowUnsubmitConfirm(false)}
                className="rounded-full border border-gray-200 px-6 py-2.5 text-sm font-bold hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800 transition-colors"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={() => {
                  unsubmitMutation.mutate({ assignmentId: selectedAssignment.id });
                  setShowUnsubmitConfirm(false);
                }}
                disabled={unsubmitMutation.isPending}
                className="rounded-full bg-amber-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-amber-700 shadow-lg shadow-amber-500/20 disabled:opacity-50 transition-all"
              >
                {unsubmitMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : t("unsubmit")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
