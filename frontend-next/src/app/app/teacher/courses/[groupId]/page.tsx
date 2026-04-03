"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useAuthStore } from "@/store/authStore";
import { useLanguage } from "@/context/LanguageContext";
import type { Lang } from "@/i18n/translations";
import type { TranslationKey } from "@/i18n/translations";
import { useTheme } from "@/context/ThemeContext";
import { getGlassCardStyle, getTextColors, getInputStyle, getModalStyle } from "@/utils/themeStyles";
import { BlurFade } from "@/components/ui/blur-fade";
import { CreateAssignmentFullPageModal } from "@/components/teacher/CreateAssignmentFullPageModal";
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Copy,
  FileText,
  GripVertical,
  MessageCircle,
  MoreVertical,
  Plus,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";

type Group = {
  id: number;
  course_id: number;
  course_title: string;
  group_name: string;
  teacher_id: number;
  students_count: number;
  created_at: string | null;
};

type Assignment = {
  id: number;
  type: "assignment" | "material" | "question";
  group_id: number;
  group_name: string;
  course_id: number;
  course_title: string;
  topic_id: number | null;
  title: string;
  description: string | null;
  deadline: string | null;
  closed_at: string | null;
  is_closed: boolean;
  created_at: string | null;
};

type SubmissionInboxRow = {
  id: number;
  submitted_count: number;
  total_students: number;
};

type QuestionListRow = {
  id: number;
  created_at: string | null;
  question_text: string;
  question_type: string;
  options: string[];
  correct_option: string | null;
  answers_count: number;
};

type AssignmentDetails = {
  title: string;
  description: string | null;
  max_points: number;
  deadline: string | null;
  group_name: string;
  attachment_urls: string[];
  attachment_links: string[];
  video_urls: string[];
  rubric: { name: string; max_points: number }[];
};

type MaterialDetails = {
  title: string;
  description: string | null;
  video_urls: string[];
  image_urls: string[];
  attachment_urls: string[];
  attachment_links: string[];
};

type CourseTopic = { id: number; title: string };

type GroupStudent = { id: number; full_name: string; email: string };

type StudentWithoutGroup = { id: number; full_name: string; email: string };

type TabId = "stream" | "classwork" | "people" | "grades";

function yearFromCreated(s: string | null | undefined): string {
  if (!s) return "";
  try {
    return String(new Date(s).getFullYear());
  } catch {
    return "";
  }
}

function pickNearestDeadline(assignments: Assignment[]) {
  const now = Date.now();
  const candidates = assignments.filter((a) => a.type === "assignment" && a.deadline && !a.is_closed);
  if (candidates.length === 0) return null;
  const scored = candidates.map((a) => ({
    a,
    t: new Date(a.deadline!).getTime(),
  }));
  const upcoming = scored.filter((x) => x.t >= now).sort((x, y) => x.t - y.t);
  if (upcoming.length > 0) return upcoming[0].a;
  return scored.sort((x, y) => y.t - x.t)[0]?.a ?? null;
}

function formatDueWhen(iso: string, lang: Lang): string {
  const d = new Date(iso);
  const locale = lang === "kk" ? "kk-KZ" : lang === "en" ? "en-US" : "ru-RU";
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function formatDueClasswork(iso: string, lang: Lang): string {
  const d = new Date(iso);
  const locale = lang === "kk" ? "kk-KZ" : lang === "en" ? "en-US" : "ru-RU";
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

function formatPostedAt(iso: string | null, lang: Lang): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const locale = lang === "kk" ? "kk-KZ" : lang === "en" ? "en-US" : "ru-RU";
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

/** Короткий формат для списка заданий (как в Classroom: «Опубликовано 08:33»). */
function formatPostedClassworkLine(iso: string | null, lang: Lang): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = new Date();
  const locale = lang === "kk" ? "kk-KZ" : lang === "en" ? "en-US" : "ru-RU";
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(d);
  }
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function sortByCreatedDesc(a: Assignment, b: Assignment) {
  const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
  const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
  return tb - ta;
}

function activityMessage(item: Assignment, t: (k: TranslationKey) => string): string {
  const title = item.title || "—";
  if (item.type === "question") return t("courseActivityPublishedQuestion").replace("{title}", title);
  if (item.type === "material") return t("courseActivityPublishedMaterial").replace("{title}", title);
  return t("courseActivityPublishedAssignment").replace("{title}", title);
}

function TypeIcon({ type }: { type: Assignment["type"] }) {
  if (type === "question") return <MessageCircle className="w-5 h-5 shrink-0 text-violet-500" />;
  if (type === "material") return <BookOpen className="w-5 h-5 shrink-0 text-emerald-500" />;
  return <FileText className="w-5 h-5 shrink-0 text-blue-500" />;
}

function useClickOutside(ref: RefObject<HTMLElement | null>, onOutside: () => void) {
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (!ref.current || ref.current.contains(e.target as Node)) return;
      onOutside();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ref, onOutside]);
}

export default function TeacherCourseGroupPage() {
  const params = useParams();
  const router = useRouter();
  const rawId = params.groupId;
  const groupId = typeof rawId === "string" ? Number(rawId) : NaN;

  const { user, isTeacher } = useAuthStore();
  const { t, lang } = useLanguage();
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const isDark = theme === "dark";
  const glassStyle = getGlassCardStyle(theme);
  const textColors = getTextColors(theme);
  const inputStyle = getInputStyle(theme);
  const modalStyle = getModalStyle(theme);

  const [activeTab, setActiveTab] = useState<TabId>("stream");
  const [createOpen, setCreateOpen] = useState(false);
  const [topicFilterOpen, setTopicFilterOpen] = useState(false);
  const [topicFilter, setTopicFilter] = useState<"all" | number>("all");
  const [collapsedTopics, setCollapsedTopics] = useState<Record<string, boolean>>({});
  const [addStudentOpen, setAddStudentOpen] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState<Record<number, boolean>>({});
  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false);

  const [assignmentModalMode, setAssignmentModalMode] = useState<"assignment" | "question" | "material">("assignment");
  const [clonedItemData, setClonedItemData] = useState<any>(null);

  const [expandedItem, setExpandedItem] = useState<{ type: Assignment["type"]; id: number } | null>(null);

  const [topicModalOpen, setTopicModalOpen] = useState(false);
  const [topicTitle, setTopicTitle] = useState("");
  const [topicTitleTouched, setTopicTitleTouched] = useState(false);

  const [localAssignments, setLocalAssignments] = useState<Assignment[]>([]);
  const [localTopics, setLocalTopics] = useState<CourseTopic[]>([]);

  const [reuseDialogOpen, setReuseDialogOpen] = useState(false);

  const createRef = useRef<HTMLDivElement>(null);
  const topicFilterRef = useRef<HTMLDivElement>(null);

  useClickOutside(createRef, () => setCreateOpen(false));
  useClickOutside(topicFilterRef, () => setTopicFilterOpen(false));

  useEffect(() => {
    if (user && !isTeacher()) {
      router.replace("/app");
    }
  }, [user, isTeacher, router]);

  const { data: groups = [], isLoading: groupsLoading } = useQuery({
    queryKey: ["teacher-groups"],
    queryFn: async () => {
      const { data } = await api.get<Group[]>("/teacher/groups");
      return data;
    },
  });

  const group = useMemo(() => groups.find((g) => g.id === groupId), [groups, groupId]);

  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery({
    queryKey: ["teacher-assignments", groupId],
    queryFn: async () => {
      const { data } = await api.get<Assignment[]>(`/teacher/assignments?group_id=${groupId}`);
      setLocalAssignments(data);
      return data;
    },
    enabled: Number.isFinite(groupId) && !!group,
  });

  const { data: submissionsInbox = [] } = useQuery({
    queryKey: ["teacher-submissions-inbox", groupId],
    queryFn: async () => {
      const { data } = await api.get<SubmissionInboxRow[]>(`/teacher/submissions/inbox?group_id=${groupId}`);
      return data;
    },
    enabled: Number.isFinite(groupId) && !!group,
  });

  const { data: questionsList = [] } = useQuery({
    queryKey: ["teacher-questions", groupId],
    queryFn: async () => {
      const { data } = await api.get<QuestionListRow[]>(`/teacher/questions?group_id=${groupId}`);
      return data;
    },
    enabled: Number.isFinite(groupId) && !!group,
  });

  const { data: topics = [] } = useQuery({
    queryKey: ["course-topics", group?.course_id],
    queryFn: async () => {
      const { data } = await api.get<CourseTopic[]>(`/courses/${group!.course_id}/topics`);
      setLocalTopics(data);
      return data;
    },
    enabled: !!group?.course_id,
  });

  const { data: students = [] } = useQuery({
    queryKey: ["teacher-group-students", groupId],
    queryFn: async () => {
      const { data } = await api.get<GroupStudent[]>(`/teacher/groups/${groupId}/students`);
      return data;
    },
    enabled: Number.isFinite(groupId) && !!group,
  });

  const { data: expandedAssignmentDetails } = useQuery({
    queryKey: ["teacher-assignment-details", expandedItem?.id],
    queryFn: async () => {
      if (!expandedItem || expandedItem.type !== "assignment") throw new Error("Not an assignment");
      const { data } = await api.get<AssignmentDetails>(`/teacher/assignments/${expandedItem.id}`);
      return data;
    },
    enabled: expandedItem?.type === "assignment",
  });

  const { data: expandedMaterialDetails } = useQuery({
    queryKey: ["teacher-material-details", expandedItem?.id],
    queryFn: async () => {
      if (!expandedItem || expandedItem.type !== "material") throw new Error("Not a material");
      const { data } = await api.get<MaterialDetails>(`/teacher/materials/${expandedItem.id}`);
      return data;
    },
    enabled: expandedItem?.type === "material",
  });

  const submittedAssignmentMap = useMemo(() => {
    const m = new Map<number, { submitted: number; assigned: number }>();
    for (const row of submissionsInbox) {
      m.set(row.id, { submitted: row.submitted_count, assigned: row.total_students });
    }
    return m;
  }, [submissionsInbox]);

  const submittedQuestionMap = useMemo(() => {
    const m = new Map<number, number>();
    for (const q of questionsList) {
      m.set(q.id, q.answers_count);
    }
    return m;
  }, [questionsList]);

  const assignedCountForGroup = students.length;

  const { data: studentsWithoutGroup = [] } = useQuery({
    queryKey: ["teacher-students-without-group", groupId],
    queryFn: async () => {
      const { data } = await api.get<StudentWithoutGroup[]>(
        `/teacher/courses/${group!.course_id}/students-without-group`
      );
      return data;
    },
    enabled: addStudentOpen && !!group?.course_id,
  });

  const addStudentMutation = useMutation({
    mutationFn: async ({ gid, studentId }: { gid: number; studentId: number }) => {
      await api.post(`/teacher/groups/${gid}/students`, { student_id: studentId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-group-students", groupId] });
      queryClient.invalidateQueries({ queryKey: ["teacher-students-without-group", groupId] });
      queryClient.invalidateQueries({ queryKey: ["teacher-groups"] });
      setAddStudentOpen(false);
    },
  });

  const createTopicMutation = useMutation({
    mutationFn: async (title: string) => {
      const { data } = await api.post<{ id: number; title: string }>(
        `/teacher/courses/${group?.course_id}/topics`,
        { title }
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course-topics", group?.course_id] });
      setTopicModalOpen(false);
      setTopicTitle("");
      setTopicTitleTouched(false);
    },
  });

  const nearest = useMemo(() => pickNearestDeadline(assignments), [assignments]);
  const streamItems = useMemo(() => [...assignments].sort(sortByCreatedDesc).slice(0, 30), [assignments]);

  const topicSections = useMemo(() => {
    const filtered = (arr: Assignment[]) =>
      topicFilter === "all" ? arr : arr.filter((a) => a.topic_id === topicFilter);

    const uncategorized = filtered(localAssignments.filter((a) => a.topic_id == null));

    const sections: { key: string; topicId: number | null; title: string; items: Assignment[] }[] = [];

    for (const tp of localTopics) {
      sections.push({
        key: `t-${tp.id}`,
        topicId: tp.id,
        title: tp.title,
        items: filtered(localAssignments.filter((a) => a.topic_id === tp.id)),
      });
    }

    if (uncategorized.length > 0) {
      sections.push({
        key: "uncategorized",
        topicId: null,
        title: t("courseTopicUncategorized"),
        items: uncategorized,
      });
    }

    if (topicFilter === "all") return sections;
    return sections.filter((s) => s.topicId === topicFilter);
  }, [localAssignments, localTopics, topicFilter, t]);

  const onDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId, type } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    if (type === "TOPIC") {
      const newTopics = Array.from(localTopics);
      const [removed] = newTopics.splice(source.index, 1);
      newTopics.splice(destination.index, 0, removed);
      setLocalTopics(newTopics);
      // API call for reordering topics could go here
      return;
    }

    // Assignment drag
    const assignmentId = Number(draggableId.split("-")[1]);
    const sourceTopicId = source.droppableId === "uncategorized" ? null : Number(source.droppableId.split("-")[1]);
    const destTopicId = destination.droppableId === "uncategorized" ? null : Number(destination.droppableId.split("-")[1]);

    const newAssignments = Array.from(localAssignments);
    const assignmentIndex = newAssignments.findIndex(a => a.id === assignmentId);
    if (assignmentIndex === -1) return;

    const [movedAssignment] = newAssignments.splice(assignmentIndex, 1);
    movedAssignment.topic_id = destTopicId;
    
    // Find where to insert in the destination list
    const destItems = newAssignments.filter(a => a.topic_id === destTopicId);
    destItems.splice(destination.index, 0, movedAssignment);
    
    // Rebuild the whole list
    const otherItems = newAssignments.filter(a => a.topic_id !== destTopicId);
    setLocalAssignments([...otherItems, ...destItems]);

    // API call to update assignment's topic
    try {
      await api.patch(`/teacher/assignments/${assignmentId}`, { topic_id: destTopicId });
      queryClient.invalidateQueries({ queryKey: ["teacher-assignments", groupId] });
    } catch (e) {
      console.error("Failed to update assignment topic", e);
      setLocalAssignments(assignments); // revert on error
    }
  };

  const toggleTopicCollapsed = (key: string) => {
    setCollapsedTopics((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const collapseAllTopics = () => {
    const next: Record<string, boolean> = {};
    for (const s of topicSections) {
      next[s.key] = true;
    }
    setCollapsedTopics(next);
  };

  const goTeacherCreate = () => {
    setCreateOpen(false);
    router.push("/app/teacher?tab=groups");
  };

  const openTeacherCreateAssignment = () => {
    setCreateOpen(false);
    setAssignmentModalMode("assignment");
    setClonedItemData(null);
    setAssignmentModalOpen(true);
  };

  const openTeacherCreateMaterial = () => {
    setCreateOpen(false);
    setAssignmentModalMode("material");
    setClonedItemData(null);
    setAssignmentModalOpen(true);
  };

  const openTeacherCreateQuestion = () => {
    setCreateOpen(false);
    setAssignmentModalMode("question");
    setClonedItemData(null);
    setAssignmentModalOpen(true);
  };

  const openTeacherCreateTopic = () => {
    setCreateOpen(false);
    setTopicTitle("");
    setTopicTitleTouched(false);
    setTopicModalOpen(true);
  };

  const openTeacherReuse = () => {
    setCreateOpen(false);
    setReuseDialogOpen(true);
  };

  const handleReuseItem = (item: any) => {
    setReuseDialogOpen(false);
    setAssignmentModalMode(item.type === "material" ? "material" : "assignment");
    setClonedItemData(item);
    setAssignmentModalOpen(true);
  };

  const deadlineLine =
    nearest?.deadline &&
    t("teacherCourseCardDeadlineLine")
      .replace("{when}", formatDueWhen(nearest.deadline, lang))
      .replace("{title}", nearest.title);

  const tabClass = (id: TabId) =>
    `pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
      activeTab === id ? "border-blue-600 text-blue-600" : "border-transparent opacity-80 hover:opacity-100"
    }`;

  const borderSubtle = isDark ? "border-white/10" : "border-black/10";

  if (user && !isTeacher()) {
    return null;
  }

  if (!Number.isFinite(groupId)) {
    return (
      <div className="max-w-3xl mx-auto">
        <p className="text-sm" style={{ color: textColors.secondary }}>
          {t("courseGroupNotFound")}
        </p>
      </div>
    );
  }

  if (groupsLoading) {
    return (
      <div className="max-w-5xl mx-auto">
        <p className="text-sm" style={{ color: textColors.secondary }}>
          {t("loading")}
        </p>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <p style={{ color: textColors.primary }}>{t("courseGroupNotFound")}</p>
        <Link
          href="/app/teacher/courses"
          className="text-sm font-medium text-blue-500 hover:underline"
        >
          {t("teacherBackToCourses")}
        </Link>
      </div>
    );
  }

  const y = yearFromCreated(group.created_at);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <BlurFade>
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <Link
              href="/app/teacher/courses"
              className="text-xs font-medium mb-2 inline-block text-blue-500 hover:underline"
            >
              {t("teacherBackToCourses")}
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold font-geologica" style={{ color: textColors.primary }}>
              {group.group_name}
              {y ? <span className="text-lg font-semibold opacity-80"> · {y}</span> : null}
            </h1>
            <p className="text-sm mt-1" style={{ color: textColors.secondary }}>
              {group.course_title}
            </p>
          </div>
        </div>
      </BlurFade>

      <div className="flex flex-wrap gap-6 border-b" style={{ borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)" }}>
        <button type="button" className={tabClass("stream")} style={{ color: activeTab === "stream" ? undefined : textColors.primary }} onClick={() => setActiveTab("stream")}>
          {t("courseStream")}
        </button>
        <button type="button" className={tabClass("classwork")} style={{ color: activeTab === "classwork" ? undefined : textColors.primary }} onClick={() => setActiveTab("classwork")}>
          {t("courseClasswork")}
        </button>
        <button type="button" className={tabClass("people")} style={{ color: activeTab === "people" ? undefined : textColors.primary }} onClick={() => setActiveTab("people")}>
          {t("coursePeople")}
        </button>
        <button type="button" className={tabClass("grades")} style={{ color: activeTab === "grades" ? undefined : textColors.primary }} onClick={() => setActiveTab("grades")}>
          {t("courseGrades")}
        </button>
      </div>

      {activeTab === "stream" && (
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 items-start">
          <div className="space-y-4">
            <div className="rounded-2xl p-4" style={{ ...glassStyle }}>
              <h3 className="text-sm font-semibold mb-3" style={{ color: textColors.primary }}>
                {t("courseCode")}
              </h3>
              <div className="flex items-center justify-between gap-2">
                <code className="text-lg font-mono font-bold tracking-wider" style={{ color: textColors.primary }}>
                  {group.id}
                </code>
                <button
                  type="button"
                  title={t("courseCopyCode")}
                  onClick={() => navigator.clipboard.writeText(String(group.id))}
                  className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                  style={{ color: textColors.secondary }}
                >
                  <Copy className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="rounded-2xl p-4" style={{ ...glassStyle }}>
              <h3 className="text-sm font-semibold mb-3" style={{ color: textColors.primary }}>
                {t("upcoming")}
              </h3>
              {deadlineLine ? (
                <p className="text-sm leading-snug" style={{ color: textColors.secondary }}>
                  {deadlineLine}
                </p>
              ) : (
                <p className="text-sm" style={{ color: textColors.secondary }}>
                  {t("teacherNoUpcomingDeadline")}
                </p>
              )}
              <button
                type="button"
                onClick={() => setActiveTab("classwork")}
                className="mt-3 text-sm font-medium text-blue-500 hover:underline"
              >
                {t("viewAll")}
              </button>
            </div>
          </div>

          <div className="space-y-4 min-w-0">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {}}
                disabled
                className="px-4 py-2 rounded-xl text-sm font-medium border transition-colors opacity-50 cursor-not-allowed"
                style={{ ...glassStyle, color: textColors.primary, borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)" }}
                title={t("comingSoon") || "Coming soon"}
              >
                {t("newAnnouncement")}
              </button>
              <button
                type="button"
                onClick={() => {}}
                disabled
                className="px-4 py-2 rounded-xl text-sm font-medium border transition-colors opacity-50 cursor-not-allowed"
                style={{ ...glassStyle, color: textColors.primary, borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)" }}
                title={t("comingSoon") || "Coming soon"}
              >
                {t("republish")}
              </button>
            </div>

            <div className="rounded-2xl p-4 sm:p-6 space-y-4" style={{ ...glassStyle }}>
              <h3 className="text-sm font-semibold" style={{ color: textColors.primary }}>
                {t("currentAssignments")}
              </h3>
              {assignmentsLoading ? (
                <p className="text-sm" style={{ color: textColors.secondary }}>
                  {t("loading")}
                </p>
              ) : streamItems.length === 0 ? (
                <p className="text-sm" style={{ color: textColors.secondary }}>
                  {t("teacherNoAssignments")}
                </p>
              ) : (
                <ul className="space-y-4">
                  {streamItems.map((item) => (
                    <li key={`${item.type}-${item.id}`} className="flex gap-3">
                      <div className="mt-0.5">
                        <TypeIcon type={item.type} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-snug" style={{ color: textColors.primary }}>
                          {activityMessage(item, t)}
                        </p>
                        <p className="text-xs mt-1" style={{ color: textColors.secondary }}>
                          {t("teacherPostedAt").replace("{when}", formatPostedAt(item.created_at, lang))}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "classwork" && (
        <div className="space-y-6">
          {/* SECTION 1: Topics management */}
          <div className="rounded-2xl p-5 sm:p-6" style={{ ...glassStyle }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold font-geologica" style={{ color: textColors.primary }}>
                  {t("courseTopicsSection")}
                </h2>
                <p className="text-xs mt-1" style={{ color: textColors.secondary }}>
                  {t("courseTopicsSectionHint")}
                </p>
              </div>
              <button
                type="button"
                onClick={openTeacherCreateTopic}
                className="p-2.5 rounded-xl text-white shrink-0"
                style={{ background: "linear-gradient(135deg, #10B981, #06B6D4)" }}
                aria-label={t("teacherCreateTopic")}
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>

            {topics.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm" style={{ color: textColors.secondary }}>
                  {t("teacherTopicEmptyHint")}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {topics.map((tp) => (
                  <div
                    key={tp.id}
                    className="flex items-center justify-between p-3 rounded-xl border"
                    style={{ borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}
                  >
                    <span className="font-medium text-sm" style={{ color: textColors.primary }}>
                      {tp.title}
                    </span>
                    <span className="text-xs px-2 py-1 rounded-lg" style={{ background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)", color: textColors.secondary }}>
                      {localAssignments.filter((a) => a.topic_id === tp.id).length} работ
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION 2: Assignments and materials */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative" ref={createRef}>
              <button
                type="button"
                aria-expanded={createOpen}
                aria-haspopup="menu"
                aria-label={t("teacherCreateDropdownAria")}
                onClick={() => setCreateOpen((o) => !o)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-md"
                style={{ background: "linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)" }}
              >
                <Plus className="w-4 h-4" />
                {t("teacherCreate")}
                <ChevronDown className="w-4 h-4 opacity-90" />
              </button>
              {createOpen ? (
                <div
                  className="absolute left-0 top-full mt-2 z-40 min-w-[220px] rounded-xl py-1 shadow-xl border"
                  style={{ ...glassStyle, borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)" }}
                  role="menu"
                >
                  {(
                    [
                      "teacherCreateAssignment",
                      "teacherCreateAssignmentWithTest",
                      "teacherCreateQuestion",
                      "teacherCreateMaterial",
                      "teacherCreateTopic",
                      "teacherCreateReuse",
                    ] as const
                  ).map((key) => (
                    <button
                      key={key}
                      type="button"
                      role="menuitem"
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                      style={{ color: textColors.primary }}
                      onClick={() => {
                        if (key === "teacherCreateAssignment") openTeacherCreateAssignment();
                        else if (key === "teacherCreateMaterial") openTeacherCreateMaterial();
                        else if (key === "teacherCreateQuestion") openTeacherCreateQuestion();
                        else if (key === "teacherCreateTopic") openTeacherCreateTopic();
                        else if (key === "teacherCreateReuse") openTeacherReuse();
                        else goTeacherCreate();
                      }}
                    >
                      {t(key)}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="relative" ref={topicFilterRef}>
              <button
                type="button"
                aria-label={t("teacherTopicFilterAria")}
                onClick={() => setTopicFilterOpen((o) => !o)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm border"
                style={{ ...glassStyle, color: textColors.primary, borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)" }}
              >
                {t("topicFilter")}
                <ChevronDown className="w-4 h-4 opacity-70" />
              </button>
              {topicFilterOpen ? (
                <div
                  className="absolute left-0 top-full mt-2 z-40 min-w-[200px] max-h-64 overflow-y-auto rounded-xl py-1 shadow-xl border"
                  style={{ ...glassStyle, borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)" }}
                >
                  <button
                    type="button"
                    className="w-full text-left px-4 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10"
                    style={{ color: textColors.primary }}
                    onClick={() => {
                      setTopicFilter("all");
                      setTopicFilterOpen(false);
                    }}
                  >
                    {t("allTopics")}
                  </button>
                  {topics.map((tp) => (
                    <button
                      key={tp.id}
                      type="button"
                      className="w-full text-left px-4 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10"
                      style={{ color: textColors.primary }}
                      onClick={() => {
                        setTopicFilter(tp.id);
                        setTopicFilterOpen(false);
                      }}
                    >
                      {tp.title}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => {}}
              disabled
              className="text-sm font-medium px-3 py-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 opacity-50 cursor-not-allowed"
              style={{ color: textColors.secondary }}
              title={t("comingSoon") || "Coming soon"}
            >
              {t("viewYourWork")}
            </button>
            <button
              type="button"
              onClick={collapseAllTopics}
              className="text-sm font-medium px-3 py-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10"
              style={{ color: textColors.secondary }}
            >
              {t("collapseAll")}
            </button>
          </div>

          <div className="space-y-4">
            {topicSections.length === 0 ? (
              <div className="rounded-2xl p-8 text-center" style={{ ...glassStyle }}>
                <p className="font-medium" style={{ color: textColors.primary }}>
                  {t("classworkEmpty")}
                </p>
                <p className="text-sm mt-2" style={{ color: textColors.secondary }}>
                  {t("classworkEmptyHint")}
                </p>
              </div>
            ) : (
              <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="all-topics" type="TOPIC">
                  {(provided) => (
                    <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-4">
                      {topicSections.map((section, index) => {
                        const collapsed = !!collapsedTopics[section.key];
                        return (
                          <Draggable key={section.key} draggableId={section.key} index={index}>
                            {(provided) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className="rounded-2xl overflow-hidden"
                                style={{
                                  ...glassStyle,
                                  ...provided.draggableProps.style,
                                }}
                              >
                                <div className={`flex items-center gap-2 px-4 py-3 border-b ${borderSubtle}`}>
                                  <div {...provided.dragHandleProps} className="p-1 cursor-grab active:cursor-grabbing">
                                    <GripVertical className="w-4 h-4 opacity-40" style={{ color: textColors.secondary }} />
                                  </div>
                                  <button
                                    type="button"
                                    aria-expanded={!collapsed}
                                    aria-label={collapsed ? t("teacherExpandTopic") : t("teacherCollapseTopic")}
                                    onClick={() => toggleTopicCollapsed(section.key)}
                                    className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"
                                    style={{ color: textColors.secondary }}
                                  >
                                    {collapsed ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
                                  </button>
                                  <h3 className="flex-1 text-sm font-semibold font-geologica min-w-0 truncate" style={{ color: textColors.primary }}>
                                    {section.title}
                                  </h3>
                                  <div className="relative group">
                                    <button
                                      type="button"
                                      className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 opacity-60"
                                      aria-label={t("teacherMoreOptions")}
                                      onClick={() => {}}
                                      disabled
                                      title={t("comingSoon") || "Coming soon"}
                                    >
                                      <MoreVertical className="w-5 h-5" style={{ color: textColors.secondary }} />
                                    </button>
                                    <div className="absolute right-0 top-full mt-1 hidden group-hover:block z-50 min-w-[140px] rounded-xl py-1 shadow-xl border" style={{ ...glassStyle }}>
                                      <button className="w-full text-left px-4 py-2 text-xs hover:bg-black/5 dark:hover:bg-white/10" style={{ color: textColors.primary }}>Переименовать</button>
                                      <button className="w-full text-left px-4 py-2 text-xs hover:bg-black/5 dark:hover:bg-white/10" style={{ color: textColors.primary }}>Удалить</button>
                                      <button className="w-full text-left px-4 py-2 text-xs hover:bg-black/5 dark:hover:bg-white/10" style={{ color: textColors.primary }}>Переместить</button>
                                    </div>
                                  </div>
                                </div>
                                {!collapsed && (
                                  <Droppable droppableId={section.key} type="ASSIGNMENT">
                                    {(provided, snapshot) => (
                                      <ul
                                        {...provided.droppableProps}
                                        ref={provided.innerRef}
                                        className={`divide-y transition-colors ${snapshot.isDraggingOver ? "bg-blue-500/5" : ""}`}
                                        style={{ borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }}
                                      >
                                        {section.items.length === 0 ? (
                                          <li className="px-4 py-8 text-sm text-center list-none" style={{ color: textColors.secondary }}>
                                            {t("teacherTopicEmptyHint")}
                                          </li>
                                        ) : null}
                                        {section.items.map((item, iIndex) => (
                                          <Draggable key={`${item.type}-${item.id}`} draggableId={`${item.type}-${item.id}`} index={iIndex}>
                                            {(provided) => (
                                              <li
                                                ref={provided.innerRef}
                                                {...provided.draggableProps}
                                                className="px-0"
                                              >
                                                <div
                                                  role="button"
                                                  tabIndex={0}
                                                  onClick={() => {
                                                    setExpandedItem((prev) => {
                                                      if (prev && prev.type === item.type && prev.id === item.id) return null;
                                                      return { type: item.type, id: item.id };
                                                    });
                                                  }}
                                                  onKeyDown={(e) => {
                                                    if (e.key !== "Enter" && e.key !== " ") return;
                                                    e.preventDefault();
                                                    setExpandedItem((prev) => {
                                                      if (prev && prev.type === item.type && prev.id === item.id) return null;
                                                      return { type: item.type, id: item.id };
                                                    });
                                                  }}
                                                  className="flex items-start gap-3 px-4 py-3 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] cursor-pointer"
                                                >
                                                  <div
                                                    {...provided.dragHandleProps}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="p-1 cursor-grab active:cursor-grabbing mt-1"
                                                    aria-hidden
                                                  >
                                                    <GripVertical className="w-4 h-4 opacity-40" style={{ color: textColors.secondary }} />
                                                  </div>

                                                  <TypeIcon type={item.type} />

                                                  <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2">
                                                      {item.type === "assignment" ? (
                                                        <Link
                                                          href={`/app/teacher/view-answers/${item.id}`}
                                                          onClick={(e) => {
                                                            e.stopPropagation();
                                                          }}
                                                          className="flex-1 min-w-0 font-medium text-sm leading-snug truncate hover:underline"
                                                          style={{ color: textColors.primary }}
                                                        >
                                                          {item.title}
                                                        </Link>
                                                      ) : item.type === "question" ? (
                                                        <Link
                                                          href={`/app/teacher/view-questions/${item.id}`}
                                                          onClick={(e) => {
                                                            e.stopPropagation();
                                                          }}
                                                          className="flex-1 min-w-0 font-medium text-sm leading-snug truncate hover:underline"
                                                          style={{ color: textColors.primary }}
                                                        >
                                                          {item.title}
                                                        </Link>
                                                      ) : (
                                                        <span className="flex-1 min-w-0 font-medium text-sm leading-snug truncate" style={{ color: textColors.primary }}>
                                                          {item.title}
                                                        </span>
                                                      )}
                                                    </div>

                                                    <p className="text-xs mt-1" style={{ color: textColors.secondary }}>
                                                      {t("teacherPostedAt").replace("{when}", formatPostedClassworkLine(item.created_at, lang))}
                                                    </p>

                                                    {item.type !== "material" ? (
                                                      <p className="text-xs mt-1" style={{ color: textColors.secondary }}>
                                                        {item.deadline
                                                          ? `${t("teacherDueDateRowLabel")}: ${formatDueClasswork(item.deadline, lang)}`
                                                          : t("noDueDate")}
                                                      </p>
                                                    ) : null}
                                                  </div>

                                                  <button
                                                    type="button"
                                                    className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 shrink-0 mt-1"
                                                    aria-label={t("teacherMoreOptions")}
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                    }}
                                                  >
                                                    <MoreVertical className="w-4 h-4" style={{ color: textColors.secondary }} />
                                                  </button>
                                                </div>

                                                {expandedItem?.type === item.type && expandedItem.id === item.id ? (
                                                  <div className="px-4 pb-4 pt-0">
                                                    <div
                                                      className="mt-1 rounded-2xl p-4 border"
                                                      style={{
                                                        ...glassStyle,
                                                        borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)",
                                                      }}
                                                    >
                                                      {(() => {
                                                        const dueLabel = item.deadline
                                                          ? `${t("teacherDueDateRowLabel")}: ${formatDueClasswork(item.deadline, lang)}`
                                                          : t("noDueDate");

                                                        const isAssignment = item.type === "assignment";
                                                        const isQuestion = item.type === "question";

                                                        const submittedCount = isAssignment
                                                          ? submittedAssignmentMap.get(item.id)?.submitted ?? 0
                                                          : isQuestion
                                                          ? submittedQuestionMap.get(item.id) ?? 0
                                                          : 0;

                                                        const assignedCount = isAssignment
                                                          ? submittedAssignmentMap.get(item.id)?.assigned ?? assignedCountForGroup
                                                          : isQuestion
                                                          ? assignedCountForGroup
                                                          : 0;

                                                        const showSubmissionStats = isAssignment;

                                                        const descriptionToRender =
                                                          isAssignment
                                                            ? expandedAssignmentDetails?.description ?? item.description
                                                            : item.type === "material"
                                                            ? expandedMaterialDetails?.description ?? item.description
                                                            : item.description;

                                                        const rubric = expandedAssignmentDetails?.rubric ?? [];
                                                        const hasRubric = isAssignment && rubric.length > 0;
                                                        const rubricMaxTotal = rubric.reduce((sum, c) => sum + (Number(c.max_points) || 0), 0);

                                                        const attachment_urls = isAssignment ? expandedAssignmentDetails?.attachment_urls ?? [] : [];
                                                        const attachment_links = isAssignment ? expandedAssignmentDetails?.attachment_links ?? [] : [];
                                                        const video_urls = isAssignment ? expandedAssignmentDetails?.video_urls ?? [] : [];

                                                        const m_attachment_urls = item.type === "material" ? expandedMaterialDetails?.attachment_urls ?? [] : [];
                                                        const m_attachment_links = item.type === "material" ? expandedMaterialDetails?.attachment_links ?? [] : [];

                                                        const hasAttachments =
                                                          (isAssignment && (attachment_urls.length > 0 || attachment_links.length > 0 || video_urls.length > 0)) ||
                                                          (item.type === "material" && (m_attachment_urls.length > 0 || m_attachment_links.length > 0));

                                                        const instructionsHref =
                                                          item.type === "assignment"
                                                            ? `/app/teacher/view-answers/${item.id}?tab=instructions`
                                                            : item.type === "question"
                                                            ? `/app/teacher/view-questions/${item.id}?tab=instructions`
                                                            : null;

                                                        return (
                                                          <div className="space-y-3">
                                                            {item.type !== "material" ? (
                                                              <div className="text-sm font-medium" style={{ color: textColors.primary }}>
                                                                {dueLabel}
                                                              </div>
                                                            ) : null}

                                                            {showSubmissionStats ? (
                                                              <div className="grid grid-cols-2 gap-3">
                                                                <div className="rounded-xl p-3 border" style={{ borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}>
                                                                  <div className="text-lg font-semibold" style={{ color: textColors.primary }}>
                                                                    {submittedCount}
                                                                  </div>
                                                                  <div className="text-xs" style={{ color: textColors.secondary }}>
                                                                    {t("submitted")}
                                                                  </div>
                                                                </div>
                                                                <div className="rounded-xl p-3 border" style={{ borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}>
                                                                  <div className="text-lg font-semibold" style={{ color: textColors.primary }}>
                                                                    {assignedCount}
                                                                  </div>
                                                                  <div className="text-xs" style={{ color: textColors.secondary }}>
                                                                    {t("assigned")}
                                                                  </div>
                                                                </div>
                                                              </div>
                                                            ) : null}

                                                            {descriptionToRender ? (
                                                              <div
                                                                className="text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none"
                                                                style={{ color: textColors.secondary }}
                                                                dangerouslySetInnerHTML={{ __html: descriptionToRender }}
                                                              />
                                                            ) : null}

                                                            {hasRubric ? (
                                                              <div className="text-sm font-medium" style={{ color: textColors.primary }}>
                                                                Критерий оценки: {rubric.length} условие · {rubricMaxTotal % 1 === 0 ? String(rubricMaxTotal.toFixed(0)) : rubricMaxTotal.toFixed(1)} баллов
                                                              </div>
                                                            ) : null}

                                                            {hasAttachments ? (
                                                              <div className="space-y-2">
                                                                <div className="text-xs font-semibold" style={{ color: textColors.secondary }}>
                                                                  Вложения
                                                                </div>

                                                                {isAssignment ? (
                                                                  <>
                                                                    {attachment_urls.length > 0 ? (
                                                                      <div className="space-y-2">
                                                                        {attachment_urls.map((u, idx) => {
                                                                          const name = u.split("/").pop()?.split("?")[0] || `File ${idx + 1}`;
                                                                          return (
                                                                            <a
                                                                              key={`${u}-${idx}`}
                                                                              href={u}
                                                                              target="_blank"
                                                                              rel="noopener noreferrer"
                                                                              className="block rounded-xl border px-3 py-2 hover:underline truncate"
                                                                              style={{ color: textColors.primary, borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}
                                                                              onClick={(e) => e.stopPropagation()}
                                                                            >
                                                                              {name}
                                                                            </a>
                                                                          );
                                                                        })}
                                                                      </div>
                                                                    ) : null}

                                                                    {attachment_links.length > 0 ? (
                                                                      <div className="space-y-2">
                                                                        {attachment_links.map((u, idx) => {
                                                                          const lower = u.toLowerCase();
                                                                          let host = u;
                                                                          try {
                                                                            host = new URL(u).hostname;
                                                                          } catch {
                                                                            // Keep raw url as a fallback label
                                                                          }
                                                                          const label = lower.includes("forms") ? "Google Формы" : host;
                                                                          return (
                                                                            <a
                                                                              key={`${u}-${idx}`}
                                                                              href={u}
                                                                              target="_blank"
                                                                              rel="noopener noreferrer"
                                                                              className="block rounded-xl border px-3 py-2 hover:underline truncate"
                                                                              style={{ color: textColors.primary, borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}
                                                                              onClick={(e) => e.stopPropagation()}
                                                                            >
                                                                              {label}
                                                                            </a>
                                                                          );
                                                                        })}
                                                                      </div>
                                                                    ) : null}

                                                                    {video_urls.length > 0 ? (
                                                                      <div className="space-y-2">
                                                                        {video_urls.map((u, idx) => {
                                                                          const name = u.split("/").pop()?.split("?")[0] || `Video ${idx + 1}`;
                                                                          return (
                                                                            <a
                                                                              key={`${u}-${idx}`}
                                                                              href={u}
                                                                              target="_blank"
                                                                              rel="noopener noreferrer"
                                                                              className="block rounded-xl border px-3 py-2 hover:underline truncate"
                                                                              style={{ color: textColors.primary, borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}
                                                                              onClick={(e) => e.stopPropagation()}
                                                                            >
                                                                              {name}
                                                                            </a>
                                                                          );
                                                                        })}
                                                                      </div>
                                                                    ) : null}
                                                                  </>
                                                                ) : (
                                                                  <>
                                                                    {m_attachment_urls.length > 0 ? (
                                                                      <div className="space-y-2">
                                                                        {m_attachment_urls.map((u, idx) => {
                                                                          const name = u.split("/").pop()?.split("?")[0] || `File ${idx + 1}`;
                                                                          return (
                                                                            <a
                                                                              key={`${u}-${idx}`}
                                                                              href={u}
                                                                              target="_blank"
                                                                              rel="noopener noreferrer"
                                                                              className="block rounded-xl border px-3 py-2 hover:underline truncate"
                                                                              style={{ color: textColors.primary, borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}
                                                                              onClick={(e) => e.stopPropagation()}
                                                                            >
                                                                              {name}
                                                                            </a>
                                                                          );
                                                                        })}
                                                                      </div>
                                                                    ) : null}

                                                                    {m_attachment_links.length > 0 ? (
                                                                      <div className="space-y-2">
                                                                        {m_attachment_links.map((u, idx) => {
                                                                          const lower = u.toLowerCase();
                                                                          let host = u;
                                                                          try {
                                                                            host = new URL(u).hostname;
                                                                          } catch {
                                                                            // Keep raw url as a fallback label
                                                                          }
                                                                          const label = lower.includes("forms") ? "Google Формы" : host;
                                                                          return (
                                                                            <a
                                                                              key={`${u}-${idx}`}
                                                                              href={u}
                                                                              target="_blank"
                                                                              rel="noopener noreferrer"
                                                                              className="block rounded-xl border px-3 py-2 hover:underline truncate"
                                                                              style={{ color: textColors.primary, borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}
                                                                              onClick={(e) => e.stopPropagation()}
                                                                            >
                                                                              {label}
                                                                            </a>
                                                                          );
                                                                        })}
                                                                      </div>
                                                                    ) : null}
                                                                  </>
                                                                )}
                                                              </div>
                                                            ) : null}

                                                            {instructionsHref ? (
                                                              <div>
                                                                <Link
                                                                  href={instructionsHref}
                                                                  onClick={(e) => e.stopPropagation()}
                                                                  className="text-sm font-medium text-blue-500 hover:underline"
                                                                >
                                                                  Инструкции
                                                                </Link>
                                                              </div>
                                                            ) : null}
                                                          </div>
                                                        );
                                                      })()}
                                                    </div>
                                                  </div>
                                                ) : null}
                                              </li>
                                            )}
                                          </Draggable>
                                        ))}
                                        {provided.placeholder}
                                      </ul>
                                    )}
                                  </Droppable>
                                )}
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            )}
          </div>
          </div>
        </div>
      )}

      {activeTab === "people" && (
        <div className="space-y-6">
          <section className="rounded-2xl p-5 sm:p-6" style={{ ...glassStyle }}>
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <h2 className="text-lg font-semibold font-geologica" style={{ color: textColors.primary }}>
                {t("courseTeachers")}
              </h2>
              <button
                type="button"
                onClick={() => {}}
                disabled
                className="text-sm font-medium px-3 py-2 rounded-xl border opacity-50 cursor-not-allowed"
                style={{ borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)", color: textColors.primary }}
                title={t("comingSoon") || "Coming soon"}
              >
                {t("inviteTeacher")}
              </button>
            </div>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                style={{ background: "linear-gradient(135deg, #3B82F6, #8B5CF6)" }}
              >
                {(user?.full_name || user?.email || "?").charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="font-medium truncate" style={{ color: textColors.primary }}>
                  {user?.full_name || user?.email || "—"}
                </p>
                <p className="text-xs truncate" style={{ color: textColors.secondary }}>
                  {user?.email}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl p-5 sm:p-6" style={{ ...glassStyle }}>
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg font-semibold font-geologica" style={{ color: textColors.primary }}>
                  {t("courseStudents")}
                </h2>
                <p className="text-sm mt-1" style={{ color: textColors.secondary }}>
                  {t("courseStudentsCount").replace("{n}", String(students.length))}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAddStudentOpen(true)}
                  className="p-2.5 rounded-xl text-white"
                  style={{ background: "linear-gradient(135deg, #10B981, #06B6D4)" }}
                  aria-label={t("teacherAddStudent")}
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 mb-4">
              <button
                type="button"
                onClick={() => {}}
                disabled
                className="px-3 py-1.5 rounded-lg text-sm border opacity-50 cursor-not-allowed"
                style={{ borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)", color: textColors.primary }}
                title={t("comingSoon") || "Coming soon"}
              >
                {t("actions")}
              </button>
            </div>

            <ul className="space-y-1">
              {students.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
                >
                  <input
                    type="checkbox"
                    className="rounded border-gray-400"
                    checked={!!selectedStudents[s.id]}
                    onChange={() =>
                      setSelectedStudents((prev) => ({ ...prev, [s.id]: !prev[s.id] }))
                    }
                    aria-label={s.full_name || s.email}
                  />
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: "linear-gradient(135deg, #10B981, #06B6D4)" }}>
                    {(s.full_name || s.email).charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link href={`/app/profile/${s.id}`} className="text-sm font-medium hover:underline truncate block" style={{ color: isDark ? "#60A5FA" : "#3B82F6" }}>
                      {s.full_name || s.email}
                    </Link>
                    <p className="text-xs truncate" style={{ color: textColors.secondary }}>
                      {s.email}
                    </p>
                  </div>
                  <button type="button" className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 shrink-0 opacity-50" aria-label={t("teacherMoreOptions")} onClick={() => {}} disabled title={t("comingSoon") || "Coming soon"}>
                    <MoreVertical className="w-4 h-4" style={{ color: textColors.secondary }} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      {activeTab === "grades" && (
        <div className="rounded-2xl p-10 sm:p-14 flex flex-col items-center text-center max-w-lg mx-auto" style={{ ...glassStyle }}>
          <div className="mb-6 text-blue-500/90">
            <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#3B82F6" />
                  <stop offset="1" stopColor="#8B5CF6" />
                </linearGradient>
              </defs>
              <circle cx="60" cy="60" r="52" fill="url(#g1)" opacity="0.15" />
              <path
                d="M38 78 L52 64 L66 74 L82 48"
                stroke="url(#g1)"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
              <circle cx="82" cy="48" r="4" fill="url(#g1)" />
            </svg>
          </div>
          <p className="text-base leading-relaxed" style={{ color: textColors.primary }}>
            {t("gradesEmptyHint")}
          </p>
          <button
            type="button"
            onClick={() => setActiveTab("people")}
            className="mt-6 text-sm font-semibold text-blue-500 hover:underline"
          >
            {t("inviteStudents")}
          </button>
        </div>
      )}

      {addStudentOpen && group ? (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200"
          onClick={() => setAddStudentOpen(false)}
        >
          <div
            className="rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto animate-slide-up"
            style={modalStyle}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-emerald-500 to-teal-500 text-white">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold font-geologica" style={{ color: textColors.primary }}>
                    {t("teacherAddStudent")}
                  </h3>
                  <p className="text-xs" style={{ color: textColors.secondary }}>
                    {group.group_name}
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setAddStudentOpen(false)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
                <X className="w-5 h-5" style={{ color: textColors.secondary }} />
              </button>
            </div>
            {studentsWithoutGroup.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3" style={{ background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)" }}>
                  <Users className="w-6 h-6" style={{ color: textColors.secondary }} />
                </div>
                <p className="text-sm" style={{ color: textColors.secondary }}>
                  {t("teacherNoStudentsWithoutGroup")}
                </p>
              </div>
            ) : (
              <ul className="space-y-1">
                {studentsWithoutGroup.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-2 p-3 rounded-xl transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                        style={{ background: "linear-gradient(135deg, #10B981, #06B6D4)" }}
                      >
                        {(s.full_name || s.email).charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <Link href={`/app/profile/${s.id}`} className="text-sm font-medium hover:underline block truncate" style={{ color: isDark ? "#60A5FA" : "#3B82F6" }}>
                          {s.full_name || s.email}
                        </Link>
                        <p className="text-xs truncate" style={{ color: textColors.secondary }}>
                          {s.email}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => addStudentMutation.mutate({ gid: group.id, studentId: s.id })}
                      disabled={addStudentMutation.isPending}
                      className="py-1.5 px-3 rounded-lg text-white text-xs font-medium disabled:opacity-50 shrink-0 transition-all hover:shadow-md"
                      style={{ background: "linear-gradient(135deg, #10B981, #06B6D4)" }}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={() => setAddStudentOpen(false)}
              className="mt-5 w-full py-2.5 rounded-xl text-sm font-medium transition-colors"
              style={{ background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)", color: textColors.secondary }}
            >
              {t("close")}
            </button>
          </div>
        </div>
      ) : null}

      <CreateAssignmentFullPageModal
        isOpen={assignmentModalOpen}
        onClose={() => setAssignmentModalOpen(false)}
        currentGroup={group}
        teacherGroups={groups}
        topics={topics}
        onInviteStudents={() => setAddStudentOpen(true)}
        mode={assignmentModalMode}
        initialData={clonedItemData}
      />

      {topicModalOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200"
          onClick={() => setTopicModalOpen(false)}
        >
          <div
            className="rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4 animate-slide-up"
            style={modalStyle}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold font-geologica" style={{ color: textColors.primary }}>
                Добавить тему
              </h3>
              <button
                type="button"
                onClick={() => setTopicModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" style={{ color: textColors.secondary }} />
              </button>
            </div>
            <div className="space-y-4">
              <div className="space-y-1">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Тема*"
                    value={topicTitle}
                    maxLength={100}
                    onChange={(e) => setTopicTitle(e.target.value)}
                    onBlur={() => setTopicTitleTouched(true)}
                    className={`w-full px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/40 ${
                      topicTitleTouched && !topicTitle.trim() ? "border-red-500" : ""
                    }`}
                    style={{ ...inputStyle, color: textColors.primary }}
                  />
                  <div
                    className="absolute right-3 bottom-3 text-[10px] opacity-50"
                    style={{ color: textColors.secondary }}
                  >
                    {topicTitle.length}/100
                  </div>
                </div>
                {topicTitleTouched && !topicTitle.trim() && (
                  <p className="text-xs text-red-500 ml-1">*Это поле должно быть заполнено</p>
                )}
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setTopicModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors"
                style={{
                  background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)",
                  color: textColors.secondary,
                }}
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={createTopicMutation.isPending || !topicTitle.trim()}
                onClick={() => createTopicMutation.mutate(topicTitle)}
                className="flex-1 py-2.5 rounded-xl text-white font-medium text-sm disabled:opacity-50 transition-all hover:shadow-lg"
                style={{ background: "linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)" }}
              >
                {createTopicMutation.isPending ? "Добавление..." : "Добавить тему"}
              </button>
            </div>
          </div>
        </div>
      )}

      {reuseDialogOpen && (
        <ReuseItemDialog
          isOpen={reuseDialogOpen}
          onClose={() => setReuseDialogOpen(false)}
          onReuse={handleReuseItem}
          teacherGroups={groups}
        />
      )}
    </div>
  );
}

function ReuseItemDialog({
  isOpen,
  onClose,
  onReuse,
  teacherGroups,
}: {
  isOpen: boolean;
  onClose: () => void;
  onReuse: (item: any) => void;
  teacherGroups: Group[];
}) {
  const { t, lang } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const modalStyle = getModalStyle(theme);
  const textColors = getTextColors(theme);
  const glassStyle = getGlassCardStyle(theme);

  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [copyAttachments, setCopyAttachments] = useState(true);

  const { data: items = [], isLoading: itemsLoading } = useQuery({
    queryKey: ["teacher-assignments", selectedGroup?.id],
    queryFn: async () => {
      const { data } = await api.get<Assignment[]>(`/teacher/assignments?group_id=${selectedGroup!.id}`);
      return data;
    },
    enabled: !!selectedGroup,
  });

  const handleSelectGroup = (g: Group) => {
    setSelectedGroup(g);
  };

  const handleReuse = async (item: Assignment) => {
    try {
      const { data } = await api.get(
        item.type === "material"
          ? `/teacher/materials/${item.id}/clone`
          : `/teacher/assignments/${item.id}/clone`
      );
      
      const clonedData = { ...data, type: item.type };
      if (!copyAttachments) {
        clonedData.attachment_urls = [];
        clonedData.attachment_links = [];
        clonedData.video_urls = [];
        clonedData.image_urls = [];
      }
      
      onReuse(clonedData);
    } catch (e) {
      console.error("Error cloning item", e);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl bg-white dark:bg-[#1A2238] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        style={modalStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}>
          <h3 className="text-lg font-semibold font-geologica" style={{ color: textColors.primary }}>
            {selectedGroup ? `Выберите запись (${selectedGroup.group_name})` : "Выберите курс"}
          </h3>
          <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10">
            <X className="w-5 h-5" style={{ color: textColors.secondary }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {!selectedGroup ? (
            <div className="space-y-2">
              {teacherGroups.map((g) => (
                <button
                  key={g.id}
                  onClick={() => handleSelectGroup(g)}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-left"
                >
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0"
                    style={{ background: `hsl(${(g.course_id * 137) % 360}, 70%, 50%)` }}
                  >
                    {g.course_title.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate" style={{ color: textColors.primary }}>{g.group_name}</p>
                    <p className="text-xs truncate" style={{ color: textColors.secondary }}>{g.course_title}</p>
                    <p className="text-[10px] mt-1 opacity-60" style={{ color: textColors.secondary }}>
                      Создано: {formatPostedAt(g.created_at, lang)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              <button
                onClick={() => setSelectedGroup(null)}
                className="text-sm font-medium text-blue-500 hover:underline mb-4 flex items-center gap-1"
              >
                ← Назад к выбору курса
              </button>
              
              {itemsLoading ? (
                <p className="text-center py-10" style={{ color: textColors.secondary }}>Загрузка...</p>
              ) : items.length === 0 ? (
                <p className="text-center py-10" style={{ color: textColors.secondary }}>В этом курсе записей нет.</p>
              ) : (
                items.map((item) => (
                  <button
                    key={`${item.type}-${item.id}`}
                    onClick={() => handleReuse(item)}
                    className="w-full flex items-center gap-3 p-4 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-left"
                  >
                    <TypeIcon type={item.type} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate" style={{ color: textColors.primary }}>{item.title}</p>
                      <p className="text-xs opacity-60" style={{ color: textColors.secondary }}>
                        {formatPostedAt(item.created_at, lang)}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <div className="p-6 border-t bg-black/5 dark:bg-white/5" style={{ borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={copyAttachments}
              onChange={(e) => setCopyAttachments(e.target.checked)}
              className="w-4 h-4 rounded accent-blue-500"
            />
            <span className="text-sm font-medium" style={{ color: textColors.primary }}>
              Скопировать все прикрепленные файлы
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}
