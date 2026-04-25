"use client";

import { useEffect, useMemo, useRef, useState, Fragment, type RefObject } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useAuthStore } from "@/store/authStore";
import { useLanguage } from "@/context/LanguageContext";
import type { Lang } from "@/i18n/translations";
import { toast } from "@/store/notificationStore";
import { useTheme } from "@/context/ThemeContext";
import { getGlassCardStyle, getTextColors, getInputStyle, getModalStyle } from "@/utils/themeStyles";
import { formatLocalizedDate, formatRelativeDate } from "@/utils/dateUtils";
import { BlurFade } from "@/components/ui/blur-fade";
import { CourseFeedPanel } from "@/components/courses/CourseFeedPanel";
import { CreateAssignmentFullPageModal } from "@/components/teacher/CreateAssignmentFullPageModal";
import { TeacherGradebook } from "@/components/teacher/TeacherGradebook";
import InviteTeacherModal from "@/components/teacher/InviteTeacherModal";
import { cn } from "@/lib/utils";
import { getLocalizedCourseTitle } from "@/lib/courseUtils";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  FileText,
  Filter,
  GripVertical,
  Loader2,
  MessageCircle,
  MoreVertical,
  Plus,
  Trash2,
  UserPlus,
  Users,
  X,
  StickyNote,
  Edit,
  Pencil,
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
  is_synopsis?: boolean;
  is_supplementary?: boolean;
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

type AssignmentRubricRow = {
  id: number;
  name: string;
  max_points: number;
  description?: string;
  levels?: { text: string; points: number }[];
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
  rubric: AssignmentRubricRow[];
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

type GroupTeacher = {
  id: number;
  full_name: string;
  email: string;
  role: "primary" | "secondary";
};

type TabId = "classwork" | "people" | "grades" | "feed";

/** Стабильные ссылки — иначе `data ?? []` в деструктуризации useQuery даёт новый [] каждый рендер и useEffect([assignments]) уходит в бесконечный цикл. */
const EMPTY_ASSIGNMENT_LIST: Assignment[] = [];
const EMPTY_TOPIC_LIST: CourseTopic[] = [];

function yearFromCreated(s: string | null | undefined): string {
  if (!s) return "";
  try {
    return String(new Date(s).getFullYear());
  } catch {
    return "";
  }
}



function TypeIcon({ type, isCompleted, isSynopsis }: { type: Assignment["type"]; isCompleted?: boolean; isSynopsis?: boolean }) {
  const color = isCompleted ? "text-slate-400" : (
    type === "question" ? "text-violet-500" :
    type === "material" ? "text-emerald-500" :
    isSynopsis ? "text-amber-500" : "text-blue-500"
  );
  if (type === "question") return <MessageCircle className={cn("w-5 h-5 shrink-0", color)} />;
  if (type === "material") return <BookOpen className={cn("w-5 h-5 shrink-0", color)} />;
  if (isSynopsis) return <StickyNote className={cn("w-5 h-5 shrink-0", color)} />;
  return <FileText className={cn("w-5 h-5 shrink-0", color)} />;
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
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
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

  const [activeTab, setActiveTab] = useState<TabId>(() => {
    if (tabParam === "people" || tabParam === "grades") return tabParam;
    if (tabParam === "feed") return "feed";
    if (tabParam === "classwork" || tabParam === "stream") return "classwork";
    return "classwork";
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [topicFilterOpen, setTopicFilterOpen] = useState(false);
  const [topicFilter, setTopicFilter] = useState<"all" | number>("all");
  const [collapsedTopics, setCollapsedTopics] = useState<Record<string, boolean>>({});
  const [addStudentOpen, setAddStudentOpen] = useState(false);
  const [inviteTeacherOpen, setInviteTeacherOpen] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState<Record<number, boolean>>({});
  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false);
  const [synopsisModalTopic, setSynopsisModalTopic] = useState<{ id: number; title: string } | null>(null);

  const [assignmentModalMode, setAssignmentModalMode] = useState<
    "assignment" | "assignmentWithTest" | "question" | "material"
  >("assignment");
  const [clonedItemData, setClonedItemData] = useState<any>(null);

  const [expandedItem, setExpandedItem] = useState<{ type: Assignment["type"]; id: number } | null>(null);

  const [topicModalOpen, setTopicModalOpen] = useState(false);
  const [topicTitle, setTopicTitle] = useState("");
  const [topicTitleTouched, setTopicTitleTouched] = useState(false);

  const [renameTopicModalOpen, setRenameTopicModalOpen] = useState(false);
  const [renamingTopic, setRenamingTopic] = useState<CourseTopic | null>(null);
  const [renameTitle, setRenameTitle] = useState("");

  const [activeTopicMenu, setActiveTopicMenu] = useState<number | string | null>(null);
  const [isRenamingUncategorized, setIsRenamingUncategorized] = useState(false);
  const [isDeletingUncategorized, setIsDeletingUncategorized] = useState(false);
  const [topicIdPendingDelete, setTopicIdPendingDelete] = useState<number | null>(null);
  const topicMenuRef = useRef<HTMLDivElement>(null);
  useClickOutside(topicMenuRef, () => setActiveTopicMenu(null));

  const [classworkItemMenu, setClassworkItemMenu] = useState<{ type: Assignment["type"]; id: number } | null>(null);
  const classworkItemMenuRef = useRef<HTMLDivElement>(null);
  useClickOutside(classworkItemMenuRef, () => setClassworkItemMenu(null));
  const [deleteAssignmentConfirmId, setDeleteAssignmentConfirmId] = useState<number | null>(null);
  const [confirmMounted, setConfirmMounted] = useState(false);
  useEffect(() => {
    setConfirmMounted(true);
  }, []);

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

  useEffect(() => {
    if (!tabParam) return;
    if (tabParam === "people") setActiveTab("people");
    else if (tabParam === "grades") setActiveTab("grades");
    else if (tabParam === "feed") setActiveTab("feed");
    else if (tabParam === "classwork" || tabParam === "stream") setActiveTab("classwork");
  }, [tabParam]);

  const { data: groups = [], isLoading: groupsLoading } = useQuery({
    queryKey: ["teacher-groups"],
    queryFn: async () => {
      const { data } = await api.get<Group[]>("/teacher/groups");
      return data;
    },
  });

  const group = useMemo(() => groups.find((g) => g.id === groupId), [groups, groupId]);

  const { data: assignmentsData } = useQuery({
    queryKey: ["teacher-assignments", groupId],
    queryFn: async () => {
      const { data } = await api.get<Assignment[]>(`/teacher/assignments?group_id=${groupId}`);
      return data;
    },
    enabled: Number.isFinite(groupId) && !!group,
  });

  const { data: groupTeachers = [] } = useQuery<GroupTeacher[]>({
    queryKey: ["group-teachers", groupId],
    queryFn: async () => {
      const { data } = await api.get(`/teacher/groups/${groupId}/teachers`);
      return data;
    },
    enabled: Number.isFinite(groupId) && !!group,
  });

  const removeTeacherMutation = useMutation({
    mutationFn: async (teacherId: number) => {
      await api.delete(`/teacher/groups/${groupId}/teachers/${teacherId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-teachers", groupId] });
    },
  });

  const assignments = assignmentsData ?? EMPTY_ASSIGNMENT_LIST;

  const { data: submissionsInbox = [] } = useQuery({
    queryKey: ["teacher-submissions-inbox", groupId],
    queryFn: async () => {
      const { data } = await api.get<SubmissionInboxRow[]>(`/teacher/submissions/inbox?group_id=${groupId}`);
      return data;
    },
    enabled: Number.isFinite(groupId) && !!group,
  });

  const { data: topicsMissingAssignments = [] } = useQuery({
    queryKey: ["teacher-topics-missing-assignments", groupId],
    queryFn: async () => {
      const { data } = await api.get<Array<{ id: number; title: string }>>(
        `/teacher/groups/${groupId}/topics-missing-assignments`
      );
      return data;
    },
    enabled: Number.isFinite(groupId) && !!group,
  });

  const incompleteTopics = useMemo(() => {
    return localTopics.map(tp => {
      const topicAssignments = localAssignments.filter(a => a.topic_id === tp.id);
      const hasSynopsis = topicAssignments.some(a => a.is_synopsis);
      const hasTask = topicAssignments.some(a => !a.is_synopsis);
      return { ...tp, hasSynopsis, hasTask };
    }).filter(tp => !tp.hasSynopsis || !tp.hasTask);
  }, [localTopics, localAssignments]);

  const { data: topicSynopsesList = [], isFetching: topicSynopsesLoading } = useQuery({
    queryKey: ["teacher-topic-synopses", groupId, synopsisModalTopic?.id],
    queryFn: async () => {
      const tid = synopsisModalTopic!.id;
      const { data } = await api.get<
        Array<{
          synopsis_id: number;
          student_id: number;
          full_name: string;
          email: string;
          note_text: string | null;
          submitted_at: string | null;
          grade: number | null;
          teacher_comment: string | null;
          graded_at: string | null;
          files: Array<{
            id: number;
            file_url: string;
            submitted_at: string | null;
          }>;
        }>
      >(`/teacher/groups/${groupId}/topic-synopses/${tid}`);
      return data;
    },
    enabled: Number.isFinite(groupId) && !!synopsisModalTopic,
  });

  const { data: questionsList = [] } = useQuery({
    queryKey: ["teacher-questions", groupId],
    queryFn: async () => {
      const { data } = await api.get<QuestionListRow[]>(`/teacher/questions?group_id=${groupId}`);
      return data;
    },
    enabled: Number.isFinite(groupId) && !!group,
  });

  const { data: topicsData } = useQuery({
    queryKey: ["course-topics", group?.course_id],
    queryFn: async () => {
      const { data } = await api.get<CourseTopic[]>(`/courses/${group!.course_id}/topics`);
      return data;
    },
    enabled: !!group?.course_id,
  });
  const topics = topicsData ?? EMPTY_TOPIC_LIST;

  useEffect(() => {
    setLocalAssignments(assignments);
  }, [assignments]);

  useEffect(() => {
    setLocalTopics(topics);
  }, [topics]);

  useEffect(() => {
    setCollapsedTopics({});
    setTopicFilter("all");
  }, [groupId]);

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
    onSuccess: async (newTopic) => {
      queryClient.invalidateQueries({ queryKey: ["course-topics", group?.course_id] });
      setTopicModalOpen(false);
      setTopicTitle("");
      setTopicTitleTouched(false);

      if (isRenamingUncategorized) {
        setIsRenamingUncategorized(false);
        const uncategorizedItems = localAssignments.filter(a => !a.topic_id);
        if (uncategorizedItems.length > 0) {
          try {
            await Promise.all(uncategorizedItems.map(item => {
              const endpoint = item.type === "material"
                ? `/teacher/materials/${item.id}`
                : item.type === "question"
                  ? `/teacher/questions/${item.id}`
                  : `/teacher/assignments/${item.id}`;
              return api.patch(endpoint, { topic_id: newTopic.id });
            }));
            toast.success(t("teacherWorkCreated"));
            queryClient.invalidateQueries({ queryKey: ["teacher-assignments", groupId] });
          } catch {
            toast.error(t("error"));
          }
        }
      }
    },
  });

  const renameTopicMutation = useMutation({
    mutationFn: async ({ id, title }: { id: number; title: string }) => {
      await api.patch(`/teacher/topics/${id}`, { title });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course-topics", group?.course_id] });
      setRenameTopicModalOpen(false);
      setRenamingTopic(null);
      setRenameTitle("");
    },
  });

  const deleteTopicMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/teacher/topics/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course-topics", group?.course_id] });
      queryClient.invalidateQueries({ queryKey: ["teacher-assignments", groupId] });
      setTopicIdPendingDelete(null);
    },
  });

  const gradeSynopsisMutation = useMutation({
    mutationFn: async ({ synopsisId, grade, comment }: { synopsisId: number; grade: number; comment: string }) => {
      await api.put(`/teacher/synopses/${synopsisId}/grade`, { grade, teacher_comment: comment });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-topic-synopses", groupId, synopsisModalTopic?.id] });
    },
  });

  const deleteClassworkAssignmentMutation = useMutation({
    mutationFn: async (assignmentId: number) => {
      await api.delete(`/teacher/assignments/${assignmentId}`);
    },
    onSuccess: (_, assignmentId) => {
      queryClient.invalidateQueries({ queryKey: ["teacher-assignments", groupId] });
      queryClient.invalidateQueries({ queryKey: ["teacher-submissions-inbox", groupId] });
      queryClient.invalidateQueries({ queryKey: ["teacher-topics-missing-assignments", groupId] });
      queryClient.invalidateQueries({ queryKey: ["teacher-gradebook", groupId] });
      setClassworkItemMenu(null);
      setDeleteAssignmentConfirmId(null);
      setExpandedItem((prev) => (prev?.type === "assignment" && prev.id === assignmentId ? null : prev));
    },
  });

  const handleBulkDeleteUncategorized = async () => {
    const topicIdSet = new Set(localTopics.map((tp) => tp.id));
    const uniqueAssignments = Array.from(new Map(localAssignments.map(a => [a.id, a])).values());
    const uncategorizedItems = uniqueAssignments.filter(
      (a) => a.topic_id == null || !topicIdSet.has(a.topic_id as number)
    );

    if (!uncategorizedItems.length) {
      setIsDeletingUncategorized(false);
      return;
    }

    try {
      await Promise.all(uncategorizedItems.map(item => {
        const endpoint = item.type === "material"
          ? `/teacher/materials/${item.id}`
          : item.type === "question"
            ? `/teacher/questions/${item.id}`
            : `/teacher/assignments/${item.id}`;
        return api.delete(endpoint);
      }));
      toast.success(t("teacherWorkDeleted") || "Success");
      queryClient.invalidateQueries({ queryKey: ["teacher-assignments", groupId] });
      setIsDeletingUncategorized(false);
    } catch {
      toast.error(t("error"));
    }
  };

  const topicSections = useMemo(() => {
    const byId = new Map<number, Assignment>();
    for (const a of localAssignments) {
      byId.set(a.id, a);
    }
    const uniqueAssignments = Array.from(byId.values());

    const topicIdSet = new Set(localTopics.map((tp) => tp.id));

    const filtered = (arr: Assignment[]) =>
      topicFilter === "all" ? arr : arr.filter((a) => a.topic_id === topicFilter);

    const uncategorized = filtered(
      uniqueAssignments.filter(
        (a) => a.topic_id == null || !topicIdSet.has(a.topic_id as number)
      )
    );

    const sections: { key: string; topicId: number | null; title: string; items: Assignment[] }[] = [];

    if (uncategorized.length > 0) {
      sections.push({
        key: "uncategorized",
        topicId: null,
        title: t("courseTopicUncategorized"),
        items: uncategorized,
      });
    }

    for (const tp of localTopics) {
      const items = filtered(uniqueAssignments.filter((a) => a.topic_id === tp.id))
        .sort((a, b) => {
          if (!!a.is_supplementary === !!b.is_supplementary) return 0;
          return a.is_supplementary ? 1 : -1;
        });

      sections.push({
        key: `t-${tp.id}`,
        topicId: tp.id,
        title: tp.title,
        items,
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

  const allSectionsCollapsed = useMemo(() => {
    if (topicSections.length === 0) return false;
    return topicSections.every((s) => !!collapsedTopics[s.key]);
  }, [topicSections, collapsedTopics]);

  const toggleCollapseAllTopics = () => {
    if (topicSections.length === 0) return;
    if (topicSections.every((s) => !!collapsedTopics[s.key])) {
      setCollapsedTopics({});
      return;
    }
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

  const openTeacherCreateSynopsis = () => {
    setCreateOpen(false);
    setAssignmentModalMode("assignment");
    setClonedItemData({ is_supplementary: false, is_synopsis: true });
    setAssignmentModalOpen(true);
  };

  const openTeacherCreateSupplementaryAssignment = () => {
    setCreateOpen(false);
    setAssignmentModalMode("assignment");
    setClonedItemData({ is_supplementary: true, is_synopsis: false });
    setAssignmentModalOpen(true);
  };

  const openTeacherCreateSupplementarySynopsis = () => {
    setCreateOpen(false);
    setAssignmentModalMode("assignment");
    setClonedItemData({ is_supplementary: true, is_synopsis: true });
    setAssignmentModalOpen(true);
  };

  const openTeacherCreateSupplementaryMaterial = () => {
    setCreateOpen(false);
    setAssignmentModalMode("material");
    setClonedItemData({ is_supplementary: true, is_synopsis: false });
    setAssignmentModalOpen(true);
  };

  const openCreateAssignmentForTopic = (topicId: number) => {
    setCreateOpen(false);
    setAssignmentModalMode("assignment");
    setClonedItemData({ topic_id: topicId, is_supplementary: false, is_synopsis: false });
    setAssignmentModalOpen(true);
  };

  const openTeacherCreateAssignmentWithTest = () => {
    setCreateOpen(false);
    setAssignmentModalMode("assignmentWithTest");
    setClonedItemData(null);
    setAssignmentModalOpen(true);
  };

  const openCreateSynopsisForTopic = (topicId: number) => {
    setCreateOpen(false);
    setAssignmentModalMode("assignment");
    setClonedItemData({ topic_id: topicId, is_supplementary: false, is_synopsis: true });
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

  const handleEditItem = async (item: Assignment) => {
    try {
      const endpoint = item.type === "material"
        ? `/teacher/materials/${item.id}`
        : item.type === "question"
          ? `/teacher/questions/${item.id}`
          : `/teacher/assignments/${item.id}`;

      const { data } = await api.get(endpoint);
      setAssignmentModalMode(item.type);
      setClonedItemData({ ...data, isEdit: true });
      setAssignmentModalOpen(true);
    } catch (e) {
      console.error("Error fetching item details for edit", e);
    }
  };

  const tabClass = (id: TabId) =>
    `pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${activeTab === id ? "border-blue-600 text-blue-600" : "border-transparent opacity-80 hover:opacity-100"
    }`;

  const borderSubtle = isDark ? "border-white/10" : "border-black/10";

  if (user && !isTeacher()) {
    return null;
  }

  if (!Number.isFinite(groupId)) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <p className="text-sm" style={{ color: textColors.primary }}>
          {t("teacherGroupInvalidId")}
        </p>
        <Link
          href="/app/teacher/courses"
          className="text-sm font-medium text-blue-500 hover:underline"
        >
          {t("teacherBackToCourses")}
        </Link>
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
    <div className="mx-auto w-full max-w-5xl min-w-0 space-y-6 overflow-x-hidden">
      <BlurFade>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <Link
              href="/app/teacher/courses"
              className="mb-2 inline-block text-xs font-medium text-blue-500 hover:underline"
            >
              {t("teacherBackToCourses")}
            </Link>
            <h1 className="break-words font-geologica text-xl font-bold sm:text-2xl md:text-3xl" style={{ color: textColors.primary }}>
              {group.group_name}
              {y ? <span className="text-base font-semibold opacity-80 sm:text-lg"> · {y}</span> : null}
            </h1>
            <p className="mt-1 break-words text-sm" style={{ color: textColors.secondary }}>
              {getLocalizedCourseTitle({ title: group.course_title } as any, t)}
            </p>
          </div>
        </div>
      </BlurFade>

      <nav
        className="mb-0 flex flex-nowrap gap-2 overflow-x-auto overscroll-x-contain border-b px-3 pb-0.5 [-webkit-overflow-scrolling:touch] sm:gap-6 sm:px-0 scroll-px-3 sm:scroll-px-0"
        style={{ borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)" }}
        aria-label={t("groupSections")}
      >
        <button type="button" className={`${tabClass("classwork")} shrink-0 whitespace-nowrap`} style={{ color: activeTab === "classwork" ? undefined : textColors.primary }} onClick={() => setActiveTab("classwork")}>
          {t("courseClasswork")}
        </button>
        <button type="button" className={`${tabClass("people")} shrink-0 whitespace-nowrap`} style={{ color: activeTab === "people" ? undefined : textColors.primary }} onClick={() => setActiveTab("people")}>
          {t("coursePeople")}
        </button>
        <button type="button" className={`${tabClass("grades")} shrink-0 whitespace-nowrap`} style={{ color: activeTab === "grades" ? undefined : textColors.primary }} onClick={() => setActiveTab("grades")}>
          {t("courseGrades")}
        </button>
        <button type="button" className={`${tabClass("feed")} shrink-0 whitespace-nowrap`} style={{ color: activeTab === "feed" ? undefined : textColors.primary }} onClick={() => setActiveTab("feed")}>
          {t("courseFeedTab")}
        </button>
      </nav>

      {activeTab === "classwork" && (
        <div className="space-y-4">
          {incompleteTopics.length > 0 && (
            <div
              className="p-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/90 dark:bg-amber-900/25 flex gap-3"
              style={{ borderColor: isDark ? "rgba(251,191,36,0.35)" : undefined }}
            >
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">{t("teacherTopicsMissingAssignmentsTitle")}</p>
                <p className="text-xs text-amber-800/90 dark:text-amber-200/90 mt-1">{t("teacherTopicsMissingAssignmentsBody")}</p>
                <ul className="mt-3 space-y-2">
                  {incompleteTopics.map((tp) => (
                    <li
                      key={tp.id}
                      className="flex flex-wrap items-center gap-2 text-sm"
                      style={{ color: textColors.primary }}
                    >
                      <span className="font-medium truncate max-w-[200px] sm:max-w-xs">{tp.title}</span>
                      {!tp.hasSynopsis && (
                        <button
                          type="button"
                          onClick={() => openCreateSynopsisForTopic(tp.id)}
                          className="text-xs font-semibold px-2 py-1 rounded-lg border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-100 hover:bg-amber-100/50 dark:hover:bg-amber-900/40"
                        >
                          + {t("teacherCreateSynopsis")}
                        </button>
                      )}
                      {!tp.hasTask && (
                        <button
                          type="button"
                          onClick={() => openCreateAssignmentForTopic(tp.id)}
                          className="text-xs font-semibold px-2 py-1 rounded-lg bg-amber-600 text-white hover:bg-amber-700"
                        >
                          + {t("teacherCreateAssignment")}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
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
                      "teacherCreateSynopsis",
                      "teacherCreateQuestion",
                      "teacherCreateMaterial",
                      "teacherCreateSupplementaryAssignment",
                      "teacherCreateSupplementarySynopsis",
                      "teacherCreateSupplementaryMaterial",
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
                        else if (key === "teacherCreateAssignmentWithTest") openTeacherCreateAssignmentWithTest();
                        else if (key === "teacherCreateSynopsis") openTeacherCreateSynopsis();
                        else if (key === "teacherCreateMaterial") openTeacherCreateMaterial();
                        else if (key === "teacherCreateSupplementaryAssignment") openTeacherCreateSupplementaryAssignment();
                        else if (key === "teacherCreateSupplementarySynopsis") openTeacherCreateSupplementarySynopsis();
                        else if (key === "teacherCreateSupplementaryMaterial") openTeacherCreateSupplementaryMaterial();
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
                className="group inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border transition-all hover:border-blue-300 dark:hover:border-blue-500 min-w-0 sm:min-w-[260px] sm:w-auto"
                style={{ ...glassStyle, color: textColors.primary, borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)" }}
              >
                <Filter className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
                {topicFilter === "all" ? t("allTopics") : topics.find((tp) => tp.id === topicFilter)?.title ?? t("allTopics")}
                <ChevronDown className={cn("w-4 h-4 text-gray-400 transition-transform duration-200", topicFilterOpen && "rotate-180")} />
              </button>
              {topicFilterOpen ? (
                <div
                  className="absolute left-0 top-full mt-2 z-40 min-w-[240px] max-h-72 overflow-y-auto rounded-2xl p-1.5 shadow-xl border animate-in fade-in zoom-in duration-100"
                  style={{ ...glassStyle, borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)" }}
                >
                  <button
                    type="button"
                    className={cn(
                      "w-full text-left px-3.5 py-2.5 text-sm rounded-xl transition-colors",
                      topicFilter === "all"
                        ? "bg-blue-50 text-blue-600 font-bold dark:bg-blue-900/20 dark:text-blue-400"
                        : "hover:bg-black/5 dark:hover:bg-white/10"
                    )}
                    style={{ color: topicFilter === "all" ? undefined : textColors.primary }}
                    onClick={() => {
                      setTopicFilter("all");
                      setTopicFilterOpen(false);
                    }}
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
                          : "hover:bg-black/5 dark:hover:bg-white/10"
                      )}
                      style={{ color: topicFilter === tp.id ? undefined : textColors.primary }}
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
              onClick={toggleCollapseAllTopics}
              className="text-sm font-medium px-3 py-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10"
              style={{ color: textColors.secondary }}
            >
              {allSectionsCollapsed ? t("expandAll") : t("collapseAll")}
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
                                className="rounded-2xl"
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
                                  <div className="relative" ref={activeTopicMenu === (section.topicId || section.key) ? topicMenuRef : null}>
                                    <button
                                      type="button"
                                      className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 opacity-60"
                                      aria-label={t("teacherMoreOptions")}
                                      onClick={() => {
                                        const menuKey = section.topicId || section.key;
                                        setActiveTopicMenu(activeTopicMenu === menuKey ? null : menuKey);
                                      }}
                                    >
                                      <MoreVertical className="w-5 h-5" style={{ color: textColors.secondary }} />
                                    </button>
                                    {activeTopicMenu === (section.topicId || section.key) && (
                                      <div
                                        className="absolute right-0 top-full mt-1 z-50 min-w-[140px] rounded-xl py-1 shadow-xl border animate-in fade-in zoom-in duration-100"
                                        style={{ ...glassStyle }}
                                      >
                                        {section.topicId ? (
                                          <>
                                            <button
                                              className="w-full text-left px-4 py-2.5 text-xs hover:bg-black/5 dark:hover:bg-white/10 flex items-center gap-2 transition-colors"
                                              style={{ color: textColors.primary }}
                                              onClick={() => {
                                                const tp = localTopics.find(t => t.id === section.topicId);
                                                if (tp) {
                                                  setRenamingTopic(tp);
                                                  setRenameTitle(tp.title);
                                                  setRenameTopicModalOpen(true);
                                                }
                                                setActiveTopicMenu(null);
                                              }}
                                            >
                                              <Pencil className="w-4 h-4 shrink-0 opacity-60" />
                                              {t("teacherRenameCourse")}
                                            </button>
                                            <button
                                              className="w-full text-left px-4 py-2.5 text-xs hover:bg-red-500/10 text-red-500 flex items-center gap-2 transition-colors font-medium"
                                              onClick={() => {
                                                setTopicIdPendingDelete(section.topicId!);
                                                setActiveTopicMenu(null);
                                              }}
                                            >
                                              <Trash2 className="w-4 h-4 shrink-0" />
                                              {t("remove")}
                                            </button>
                                          </>
                                        ) : (
                                          <>
                                            <button
                                              className="w-full text-left px-4 py-2.5 text-xs hover:bg-black/5 dark:hover:bg-white/10 flex items-center gap-2 transition-colors"
                                              style={{ color: textColors.primary }}
                                              onClick={() => {
                                                setIsRenamingUncategorized(true);
                                                setTopicModalOpen(true);
                                                setActiveTopicMenu(null);
                                              }}
                                            >
                                              <Pencil className="w-4 h-4 shrink-0 opacity-60" />
                                              {t("teacherRenameCourse")}
                                            </button>
                                            <button
                                              className="w-full text-left px-4 py-2.5 text-xs hover:bg-red-500/10 text-red-500 flex items-center gap-2 transition-colors font-medium"
                                              onClick={() => {
                                                setIsDeletingUncategorized(true);
                                                setActiveTopicMenu(null);
                                              }}
                                            >
                                              <Trash2 className="w-4 h-4 shrink-0" />
                                              {t("remove")}
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    )}
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
                                        {section.items.map((item, iIndex) => {
                                          const isFirstSupplementary = item.is_supplementary && (iIndex === 0 || !section.items[iIndex - 1].is_supplementary);
                                          const isFirstMain = !item.is_supplementary && iIndex === 0 && section.items.some(x => x.is_supplementary);
                                          
                                          return (
                                            <Fragment key={`${item.type}-${item.id}`}>
                                              {isFirstMain && (
                                                <div className="px-4 py-3 bg-black/[0.02] dark:bg-white/[0.02] border-b" style={{ borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }}>
                                                  <span className="text-[10px] font-bold tracking-wider uppercase opacity-50" style={{ color: textColors.primary }}>
                                                    {t("teacherMainContentsHeading")}
                                                  </span>
                                                </div>
                                              )}
                                              {isFirstSupplementary && (
                                                <div className="px-4 py-3 bg-purple-500/[0.03] dark:bg-purple-500/[0.05] border-y" style={{ borderColor: isDark ? "rgba(139,92,246,0.15)" : "rgba(139,92,246,0.1)" }}>
                                                  <span className="text-[10px] font-bold tracking-wider uppercase text-purple-600 dark:text-purple-400">
                                                    {t("teacherSupplementaryHeading")}
                                                  </span>
                                                </div>
                                              )}
                                              <Draggable draggableId={`${item.type}-${item.id}`} index={iIndex}>
                                                {(provided) => (
                                                  <li
                                                    ref={provided.innerRef}
                                                    {...provided.draggableProps}
                                                    className="px-0 relative group list-none"
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
                                                        if (e.key === "Enter" || e.key === " ") {
                                                          setExpandedItem((prev) => {
                                                            if (prev && prev.type === item.type && prev.id === item.id) return null;
                                                            return { type: item.type, id: item.id };
                                                          });
                                                        }
                                                      }}
                                                      className="flex items-start gap-3 px-4 py-3 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] cursor-pointer group"
                                                    >
                                                      <div
                                                        {...provided.dragHandleProps}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="p-1 cursor-grab active:cursor-grabbing mt-1"
                                                        aria-hidden
                                                      >
                                                        <GripVertical className="w-4 h-4 opacity-40" style={{ color: textColors.secondary }} />
                                                      </div>

                                                      {(() => {
                                                        let isCompleted = false;
                                                        if (item.type === "assignment") {
                                                          const stats = submittedAssignmentMap.get(item.id);
                                                          isCompleted = !!stats && stats.submitted >= stats.assigned && stats.assigned > 0;
                                                        } else if (item.type === "question") {
                                                          const answersCount = submittedQuestionMap.get(item.id) ?? 0;
                                                          isCompleted = answersCount >= assignedCountForGroup && assignedCountForGroup > 0;
                                                        }
                                                        return <TypeIcon type={item.type} isCompleted={isCompleted} isSynopsis={item.is_synopsis as boolean} />;
                                                      })()}

                                                      <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-2">
                                                          {item.type === "assignment" ? (
                                                            <Link
                                                              href={`/app/teacher/courses/${groupId}/assignment/${item.id}`}
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
                                                          <p className="text-xs font-medium px-2 py-0.5 rounded-md hidden sm:block" style={{ background: "rgba(59, 130, 246, 0.1)", color: "#3B82F6" }}>
                                                            {item.type === "question" ? t("quiz") : item.type === "material" ? t("studentMaterials") : t("courseClasswork")}
                                                          </p>
                                                        </div>

                                                        <p className="text-xs mt-1" style={{ color: textColors.secondary }}>
                                                          {t("teacherPostedAt").replace("{when}", formatLocalizedDate(item.created_at, lang, t, { includeTime: true, shortMonth: true }))}
                                                        </p>

                                                        {item.type !== "material" ? (
                                                          <p className="text-xs mt-1" style={{ color: textColors.secondary }}>
                                                            {item.deadline
                                                              ? `${t("teacherDueDateRowLabel")}: ${formatLocalizedDate(item.deadline, lang, t, { includeTime: true, shortMonth: true })}`
                                                              : t("noDueDate")}
                                                          </p>
                                                        ) : null}
                                                      </div>

                                                      <div
                                                        className="relative shrink-0 mt-1"
                                                        ref={
                                                          classworkItemMenu?.id === item.id && classworkItemMenu?.type === item.type
                                                            ? classworkItemMenuRef
                                                            : null
                                                        }
                                                      >
                                                        <button
                                                          type="button"
                                                          className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"
                                                          aria-label={t("teacherMoreOptions")}
                                                          onClick={(e) => {
                                                            e.stopPropagation();
                                                            setClassworkItemMenu((prev) =>
                                                              prev?.id === item.id && prev?.type === item.type
                                                                ? null
                                                                : { type: item.type, id: item.id }
                                                            );
                                                          }}
                                                        >
                                                          <MoreVertical className="w-4 h-4" style={{ color: textColors.secondary }} />
                                                        </button>
                                                        {classworkItemMenu?.id === item.id &&
                                                          classworkItemMenu?.type === item.type ? (
                                                            <div
                                                              className="absolute right-0 top-full mt-1 z-[60] min-w-[200px] max-h-64 overflow-y-auto rounded-xl py-1 shadow-2xl border animate-in fade-in zoom-in duration-100"
                                                              style={{ ...glassStyle, borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)" }}
                                                              role="menu"
                                                            >
                                                              <button
                                                                type="button"
                                                                role="menuitem"
                                                                className="w-full text-left px-4 py-2.5 text-xs hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-2 transition-colors"
                                                                style={{ color: textColors.primary }}
                                                                onClick={async (e) => {
                                                                  e.stopPropagation();
                                                                  setClassworkItemMenu(null);
                                                                  handleEditItem(item);
                                                                }}
                                                              >
                                                                <Pencil className="w-4 h-4 shrink-0 opacity-60" />
                                                                {t("edit")}
                                                              </button>
                                                              <div className="h-px mx-2 my-1 bg-black/5 dark:bg-white/5" />
                                                              <button
                                                                type="button"
                                                                role="menuitem"
                                                                className="w-full text-left px-4 py-2.5 text-xs hover:bg-red-500/10 text-red-500 flex items-center gap-2 transition-colors font-medium"
                                                                disabled={deleteClassworkAssignmentMutation.isPending}
                                                                onClick={(e) => {
                                                                  e.stopPropagation();
                                                                  setClassworkItemMenu(null);
                                                                  setDeleteAssignmentConfirmId(item.id);
                                                                }}
                                                              >
                                                                <Trash2 className="w-4 h-4 shrink-0" />
                                                                {t("delete")}
                                                              </button>
                                                            </div>
                                                          ) : null}
                                                      </div>
                                                    </div>

                                                    {expandedItem?.type === item.type && expandedItem.id === item.id ? (
                                                      <div className="px-4 pb-4 pt-0 text-left">
                                                        <div
                                                          className="mt-1 rounded-2xl p-4 border"
                                                          style={{
                                                            ...glassStyle,
                                                            borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)",
                                                          }}
                                                        >
                                                          {(() => {
                                                            const dueLabel = item.deadline
                                                              ? `${t("teacherDueDateRowLabel")}: ${formatLocalizedDate(item.deadline, lang, t, { includeTime: true, shortMonth: true })}`
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
                                                                ? `/app/teacher/courses/${groupId}/assignment/${item.id}`
                                                                : item.type === "question"
                                                                  ? `/app/teacher/view-questions/${item.id}`
                                                                  : null;

                                                            return (
                                                              <div className="space-y-3">
                                                                {item.type !== "material" ? (
                                                                  <div className="text-sm font-medium" style={{ color: textColors.primary }}>
                                                                    {dueLabel}
                                                                  </div>
                                                                ) : null}

                                                                {showSubmissionStats && (
                                                                  <div className="flex items-center gap-4 py-2 border-y border-black/5 dark:border-white/5">
                                                                    <div className="flex-1 text-center">
                                                                      <p className="text-xs opacity-60" style={{ color: textColors.primary }}>{t("teacherAssignedCount")}</p>
                                                                      <p className="text-lg font-bold" style={{ color: textColors.primary }}>{assignedCount}</p>
                                                                    </div>
                                                                    <div className="w-px h-8 bg-black/5 dark:bg-white/5" />
                                                                    <div className="flex-1 text-center">
                                                                      <p className="text-xs opacity-60" style={{ color: textColors.primary }}>{t("teacherTurnedIn")}</p>
                                                                      <p className="text-lg font-bold" style={{ color: textColors.primary }}>{submittedCount}</p>
                                                                    </div>
                                                                    <div className="w-px h-8 bg-black/5 dark:bg-white/5" />
                                                                    <Link 
                                                                      href={`/app/teacher/courses/${groupId}/assignment/${item.id}`}
                                                                      className="flex-1 text-center group/btn"
                                                                    >
                                                                      <p className="text-xs text-blue-500 font-semibold group-hover/btn:underline">{t("teacherViewSubmissions")}</p>
                                                                      <div className="flex items-center justify-center mt-1">
                                                                        <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center group-hover/btn:bg-blue-500/20 transition-colors">
                                                                          <CheckCircle className="w-4 h-4 text-blue-500" />
                                                                        </div>
                                                                      </div>
                                                                    </Link>
                                                                  </div>
                                                                )}

                                                                {descriptionToRender && (
                                                                  <div 
                                                                    className="text-sm prose prose-sm dark:prose-invert max-w-none break-words"
                                                                    style={{ color: textColors.primary }}
                                                                    dangerouslySetInnerHTML={{ __html: descriptionToRender }}
                                                                  />
                                                                )}

                                                                {hasRubric && (
                                                                  <div className="mt-4 pt-4 border-t border-black/5 dark:border-white/5">
                                                                    <div className="flex items-center justify-between mb-3">
                                                                      <h4 className="text-xs font-bold uppercase tracking-wider opacity-60" style={{ color: textColors.primary }}>
                                                                        {t("assignmentRubricCriterion")}
                                                                      </h4>
                                                                      <span className="text-xs font-semibold px-2 py-1 bg-blue-500/10 text-blue-500 rounded-lg">
                                                                        {rubricMaxTotal} {t("pointsSuffix")}
                                                                      </span>
                                                                    </div>
                                                                    <div className="space-y-2">
                                                                      {rubric.map((r, rIdx) => (
                                                                        <div key={`${r.name}-${rIdx}`} className="p-3 rounded-xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/5 dark:border-white/5">
                                                                          <div className="flex items-center justify-between gap-4">
                                                                            <span className="text-sm font-semibold truncate" style={{ color: textColors.primary }}>{r.name}</span>
                                                                            <span className="text-xs font-bold whitespace-nowrap" style={{ color: textColors.primary }}>{r.max_points} {t("pointsSuffix")}</span>
                                                                          </div>
                                                                          {r.description && <p className="text-xs mt-1 opacity-70 italic" style={{ color: textColors.primary }}>{r.description}</p>}
                                                                        </div>
                                                                      ))}
                                                                    </div>
                                                                  </div>
                                                                )}

                                                                {hasAttachments && (
                                                                  <div className="mt-3 space-y-3">
                                                                    {attachment_urls.length > 0 && (
                                                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                                        {attachment_urls.map((u, idx) => {
                                                                          const name = u.split("/").pop() ?? t("teacherAttachments");
                                                                          return (
                                                                            <a
                                                                              key={`${u}-${idx}`}
                                                                              href={u}
                                                                              target="_blank"
                                                                              rel="noopener noreferrer"
                                                                              className="flex items-center gap-2 p-2 rounded-xl border hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                                                                              style={{ color: textColors.primary, borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}
                                                                              onClick={(e) => e.stopPropagation()}
                                                                            >
                                                                              <FileText className="w-4 h-4 shrink-0 opacity-60" />
                                                                              <span className="text-xs truncate">{name}</span>
                                                                            </a>
                                                                          );
                                                                        })}
                                                                      </div>
                                                                    )}

                                                                    {attachment_links.length > 0 && (
                                                                      <div className="space-y-2">
                                                                        {attachment_links.map((u, idx) => (
                                                                          <a
                                                                            key={`${u}-${idx}`}
                                                                            href={u}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="block rounded-xl border px-3 py-2 hover:underline truncate"
                                                                            style={{ color: textColors.primary, borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}
                                                                            onClick={(e) => e.stopPropagation()}
                                                                          >
                                                                            {u}
                                                                          </a>
                                                                        ))}
                                                                      </div>
                                                                    )}

                                                                    {video_urls.length > 0 && (
                                                                      <div className="grid grid-cols-1 gap-2">
                                                                        {video_urls.map((v, idx) => (
                                                                          <div key={`${v}-${idx}`} className="rounded-xl overflow-hidden border" style={{ borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)" }}>
                                                                            <iframe 
                                                                              className="w-full aspect-video"
                                                                              src={v.replace("watch?v=", "embed/").split("&")[0]}
                                                                              allowFullScreen
                                                                            />
                                                                          </div>
                                                                        ))}
                                                                      </div>
                                                                    )}

                                                                    {m_attachment_urls.length > 0 && (
                                                                      <div className="space-y-2">
                                                                        {m_attachment_urls.map((u, idx) => {
                                                                          const name = u.split("/").pop() ?? t("teacherAttachments");
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
                                                                    )}

                                                                    {m_attachment_links.length > 0 && (
                                                                      <div className="space-y-2">
                                                                        {m_attachment_links.map((u, idx) => {
                                                                          const lower = u.toLowerCase();
                                                                          let host = u;
                                                                          try {
                                                                            host = new URL(u).hostname;
                                                                          } catch {
                                                                            // Keep raw url as a fallback label
                                                                          }
                                                                          const label = lower.includes("forms") ? t("googleForms") : host;
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
                                                                    )}
                                                                  </div>
                                                                )}

                                                                {instructionsHref ? (
                                                                  <div className="pt-2 border-t border-black/5 dark:border-white/5">
                                                                    <Link
                                                                      href={instructionsHref}
                                                                      onClick={(e) => e.stopPropagation()}
                                                                      className="text-xs font-semibold text-blue-500 hover:underline flex items-center gap-1"
                                                                    >
                                                                      {t("teacherViewAnswersInstructions")}
                                                                      <ArrowLeft className="w-3 h-3 rotate-180" />
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
                                            </Fragment>
                                          );
                                        })}
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
                onClick={() => setInviteTeacherOpen(true)}
                className="text-sm font-medium px-3 py-2 rounded-xl border transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.05]"
                style={{ borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)", color: textColors.primary }}
              >
                {t("inviteTeacher")}
              </button>
            </div>
            <div className="space-y-3">
              {groupTeachers.map((teacher) => (
                <div key={teacher.id} className="flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                      style={{
                        background: teacher.role === "primary"
                          ? "linear-gradient(135deg, #3B82F6, #8B5CF6)"
                          : "linear-gradient(135deg, #6366F1, #A855F7)"
                      }}
                    >
                      {(teacher.full_name || teacher.email || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate flex items-center gap-2" style={{ color: textColors.primary }}>
                        {teacher.full_name || teacher.email || "—"}
                        {teacher.role === "primary" && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wider">
                            {t("primary")}
                          </span>
                        )}
                      </p>
                      <p className="text-xs truncate" style={{ color: textColors.secondary }}>
                        {teacher.email}
                      </p>
                    </div>
                  </div>
                  {teacher.role === "secondary" && (user?.id === group?.teacher_id || user?.role === "admin") && (
                    <button
                      type="button"
                      onClick={() => removeTeacherMutation.mutate(teacher.id)}
                      disabled={removeTeacherMutation.isPending}
                      className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-30"
                      title={t("remove")}
                    >
                      {removeTeacherMutation.isPending && removeTeacherMutation.variables === teacher.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>
              ))}
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
                onClick={() => { }}
                disabled
                className="px-3 py-1.5 rounded-lg text-sm border opacity-50 cursor-not-allowed"
                style={{ borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)", color: textColors.primary }}
                title={t("courseSoon")}
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
                  <button type="button" className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 shrink-0 opacity-50" aria-label={t("teacherMoreOptions")} onClick={() => { }} disabled title={t("courseSoon")}>
                    <MoreVertical className="w-4 h-4" style={{ color: textColors.secondary }} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      {activeTab === "grades" && Number.isFinite(groupId) && group ? (
        <div className="rounded-2xl px-2 py-4 sm:p-6" style={{ ...glassStyle }}>
          <h2 className="mb-4 px-2 font-geologica text-lg font-bold sm:px-0 sm:text-xl" style={{ color: textColors.primary }}>
            {t("courseGrades")}
          </h2>
          <TeacherGradebook groupId={groupId} topics={topics} />
        </div>
      ) : null}

      {activeTab === "feed" && Number.isFinite(groupId) && group ? (
        <div className="rounded-2xl p-4 sm:p-6" style={{ ...glassStyle }}>
          <h2 className="mb-4 font-geologica text-lg font-bold sm:text-xl" style={{ color: textColors.primary }}>
            {t("courseFeedHeading")}
          </h2>
          <CourseFeedPanel variant="teacher" courseId={group.course_id} groupId={groupId} />
        </div>
      ) : null}

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

      {synopsisModalTopic ? (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setSynopsisModalTopic(null)}
        >
          <div
            className="rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col"
            style={modalStyle}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)" }}>
              <h3 className="font-semibold font-geologica pr-2" style={{ color: textColors.primary }}>
                {t("teacherTopicSynopsesTitle")}: {synopsisModalTopic.title}
              </h3>
              <button
                type="button"
                onClick={() => setSynopsisModalTopic(null)}
                className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 shrink-0"
              >
                <X className="w-5 h-5" style={{ color: textColors.secondary }} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              {topicSynopsesLoading ? (
                <div className="flex items-center gap-2 text-sm" style={{ color: textColors.secondary }}>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t("loading")}
                </div>
              ) : topicSynopsesList.length === 0 ? (
                <p className="text-sm" style={{ color: textColors.secondary }}>
                  {t("teacherTopicSynopsesEmpty")}
                </p>
              ) : (
                <ul className="space-y-4">
                  {topicSynopsesList.map((row) => (
                    <li
                      key={`${row.student_id}-${row.submitted_at}`}
                      className="p-3 rounded-xl border text-sm"
                      style={{ borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)" }}
                    >
                      <p className="font-medium" style={{ color: textColors.primary }}>
                        {row.full_name || row.email}
                      </p>
                      {row.submitted_at && (
                        <p className="text-xs mt-0.5 opacity-70">{row.submitted_at}</p>
                      )}
                      <div className="mt-2 space-y-1.5">
                        {row.files.map((file) => (
                          <a
                            key={file.id}
                            href={file.file_url.startsWith("/") ? file.file_url : `/uploads/${file.file_url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline text-xs font-medium mr-3"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            {t("teacherTopicSynopsisOpenFile")}: {file.file_url.split("/").pop()?.split("?")[0] || t("teacherFileFallback").replace("{n}", "1")}
                          </a>
                        ))}
                      </div>
                      {row.note_text ? (
                        <p className="mt-2 text-xs whitespace-pre-wrap opacity-90" style={{ color: textColors.secondary }}>
                          {row.note_text}
                        </p>
                      ) : null}

                      <div className="mt-4 pt-3 border-t" style={{ borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)" }}>
                        {row.graded_at ? (
                          <div className="flex items-center gap-2 text-green-600 dark:text-green-400 font-semibold text-xs">
                            <CheckCircle className="w-4 h-4" />
                            {t("teacherAssignmentListStatusGraded")}
                            {row.teacher_comment && <span className="font-normal opacity-80 ml-1">({row.teacher_comment})</span>}
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <textarea
                              placeholder={t("teacherComment")}
                              className="w-full text-xs p-2 rounded-lg border outline-none focus:ring-1 focus:ring-teal-500"
                              style={inputStyle}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                  e.preventDefault();
                                  const text = (e.target as HTMLTextAreaElement).value;
                                  gradeSynopsisMutation.mutate({ synopsisId: row.synopsis_id, grade: 100, comment: text });
                                }
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const textarea = document.querySelector(`textarea[placeholder="${t("teacherComment")}"]`) as HTMLTextAreaElement;
                                gradeSynopsisMutation.mutate({
                                  synopsisId: row.synopsis_id,
                                  grade: 100,
                                  comment: textarea?.value || ""
                                });
                              }}
                              disabled={gradeSynopsisMutation.isPending}
                              className="w-full py-1.5 rounded-lg text-xs font-semibold bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50"
                            >
                              {gradeSynopsisMutation.isPending ? t("loading") : t("teacherMarkDone")}
                            </button>
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <CreateAssignmentFullPageModal
        isOpen={assignmentModalOpen}
        onClose={() => {
          setAssignmentModalOpen(false);
          setClonedItemData(null);
        }}
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
          onClick={() => { setTopicModalOpen(false); setIsRenamingUncategorized(false); }}
        >
          <div
            className="rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4 animate-slide-up"
            style={modalStyle}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold font-geologica" style={{ color: textColors.primary }}>
                {isRenamingUncategorized ? t("teacherRenameCourse") : t("teacherAddTopic")}
              </h3>
              <button
                type="button"
                onClick={() => { setTopicModalOpen(false); setIsRenamingUncategorized(false); }}
                className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                style={{ color: textColors.secondary }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="space-y-1">
                <div className="relative">
                  <input
                    type="text"
                    placeholder={`${t("teacherCreateTopic")}*`}
                    value={topicTitle}
                    maxLength={100}
                    onChange={(e) => setTopicTitle(e.target.value)}
                    onBlur={() => setTopicTitleTouched(true)}
                    className={`w-full px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/40 ${topicTitleTouched && !topicTitle.trim() ? "border-red-500" : ""
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
                  <p className="text-xs text-red-500 ml-1">*{t("fieldRequired")}</p>
                )}
              </div>

              {/* Quick topics suggestions */}
              {!isRenamingUncategorized && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider opacity-60" style={{ color: textColors.secondary }}>
                    {t("teacherCourseTopics")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      t("topicSuggestion1"),
                      t("topicSuggestion2"),
                      t("topicSuggestion3"),
                      t("topicSuggestion4"),
                      t("topicSuggestion5"),
                      t("topicSuggestion6"),
                      t("topicSuggestion7"),
                    ].map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => setTopicTitle(suggestion)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:bg-blue-500 hover:text-white hover:border-blue-500"
                        style={{
                          borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
                          color: textColors.primary,
                          background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.02)"
                        }}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 pt-4">
              <button
                type="button"
                onClick={() => { setTopicModalOpen(false); setIsRenamingUncategorized(false); }}
                className="flex-1 py-2.5 rounded-xl font-medium text-sm transition-all"
                style={{ background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)", color: textColors.primary }}
              >
                {t("teacherCancel")}
              </button>
              <button
                type="button"
                disabled={createTopicMutation.isPending || !topicTitle.trim()}
                onClick={() => createTopicMutation.mutate(topicTitle)}
                className="flex-1 py-2.5 rounded-xl text-white font-medium text-sm disabled:opacity-50 transition-all hover:shadow-lg"
                style={{ background: "linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)" }}
              >
                {createTopicMutation.isPending ? t("teacherAdding") : (isRenamingUncategorized ? t("teacherSave") : t("teacherAddTopic"))}
              </button>
            </div>
          </div>
        </div>
      )}

      {topicIdPendingDelete !== null && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200"
          onClick={() => !deleteTopicMutation.isPending && setTopicIdPendingDelete(null)}
        >
          <div
            className="relative w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl border animate-in zoom-in-95 duration-200"
            style={{
              ...modalStyle,
              borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => !deleteTopicMutation.isPending && setTopicIdPendingDelete(null)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              style={{ color: textColors.secondary }}
              aria-label={t("back")}
            >
              <X className="w-5 h-5" />
            </button>
            <div className="p-8 text-center">
              <div className="w-20 h-20 bg-red-50 dark:bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="w-10 h-10 text-red-500" />
              </div>
              <h3 className="text-xl font-bold mb-3 font-geologica" style={{ color: textColors.primary }}>
                {t("confirmDelete")}
              </h3>
              <p className="text-sm mb-8 px-4 leading-relaxed" style={{ color: textColors.secondary }}>
                {t("teacherDeleteTopicConfirm")}
              </p>
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => deleteTopicMutation.mutate(topicIdPendingDelete)}
                  disabled={deleteTopicMutation.isPending}
                  className="w-full py-4 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-bold transition-all shadow-lg shadow-red-500/30 flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {deleteTopicMutation.isPending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Trash2 className="w-5 h-5" />
                  )}
                  {t("delete")}
                </button>
                <button
                  type="button"
                  onClick={() => setTopicIdPendingDelete(null)}
                  disabled={deleteTopicMutation.isPending}
                  className="w-full py-4 rounded-2xl font-semibold transition-all flex items-center justify-center gap-2"
                  style={{
                    background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
                    color: textColors.primary,
                  }}
                >
                  <ArrowLeft className="w-5 h-5" />
                  {t("back")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {isDeletingUncategorized && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-[110] p-4 animate-in fade-in duration-200"
          onClick={() => setIsDeletingUncategorized(false)}
        >
          <div
            className="relative w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl border animate-in zoom-in-95 duration-200"
            style={{
              ...modalStyle,
              borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setIsDeletingUncategorized(false)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              style={{ color: textColors.secondary }}
            >
              <X className="w-5 h-5" />
            </button>
            <div className="p-8 text-center">
              <div className="w-20 h-20 bg-red-50 dark:bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="w-10 h-10 text-red-500" />
              </div>
              <h3 className="text-xl font-bold mb-3 font-geologica" style={{ color: textColors.primary }}>
                {t("confirmDelete")}
              </h3>
              <p className="text-sm mb-8 px-4 leading-relaxed" style={{ color: textColors.secondary }}>
                {t("teacherDeleteTopicConfirm")} ({t("teacherDeleteUncategorizedConfirm").replace("{count}", String(topicSections.find((s) => s.topicId == null)?.items.length || 0))})
              </p>
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={handleBulkDeleteUncategorized}
                  disabled={deleteClassworkAssignmentMutation.isPending}
                  className="w-full py-4 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-bold transition-all shadow-lg shadow-red-500/30 flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <Trash2 className="w-5 h-5" />
                  {t("delete")}
                </button>
                <button
                  type="button"
                  onClick={() => setIsDeletingUncategorized(false)}
                  className="w-full py-4 rounded-2xl font-semibold transition-all flex items-center justify-center gap-2"
                  style={{
                    background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
                    color: textColors.primary,
                  }}
                >
                  <ArrowLeft className="w-5 h-5" />
                  {t("back")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {renameTopicModalOpen && renamingTopic && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200"
          onClick={() => setRenameTopicModalOpen(false)}
        >
          <div
            className="rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4 animate-slide-up"
            style={modalStyle}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold font-geologica" style={{ color: textColors.primary }}>
                {t("teacherRenameTopic")}
              </h3>
              <button
                type="button"
                onClick={() => setRenameTopicModalOpen(false)}
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
                    placeholder={`${t("teacherCreateTopic")}*`}
                    value={renameTitle}
                    maxLength={100}
                    onChange={(e) => setRenameTitle(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/40"
                    style={{ ...inputStyle, color: textColors.primary }}
                  />
                  <div
                    className="absolute right-3 bottom-3 text-[10px] opacity-50"
                    style={{ color: textColors.secondary }}
                  >
                    {renameTitle.length}/100
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setRenameTopicModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors"
                style={{
                  background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)",
                  color: textColors.secondary,
                }}
              >
                {t("teacherCancel")}
              </button>
              <button
                type="button"
                disabled={renameTopicMutation.isPending || !renameTitle.trim() || renameTitle === renamingTopic.title}
                onClick={() => renameTopicMutation.mutate({ id: renamingTopic.id, title: renameTitle })}
                className="flex-1 py-2.5 rounded-xl text-white font-medium text-sm disabled:opacity-50 transition-all hover:shadow-lg"
                style={{ background: "linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)" }}
              >
                {renameTopicMutation.isPending ? t("teacherSaving") : t("teacherSave")}
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

      {inviteTeacherOpen && Number.isFinite(groupId) && (
        <InviteTeacherModal
          isOpen={inviteTeacherOpen}
          onClose={() => setInviteTeacherOpen(false)}
          groupId={groupId}
        />
      )}

      {confirmMounted &&
        deleteAssignmentConfirmId != null &&
        createPortal(
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <button
              type="button"
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              aria-label={t("back")}
              onClick={() => setDeleteAssignmentConfirmId(null)}
            />
            <div
              className="relative w-full max-w-md rounded-2xl border p-6 shadow-2xl"
              style={{
                ...getModalStyle(theme),
                borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)",
              }}
              role="dialog"
              aria-modal="true"
            >
              <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-7 h-7 text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-center mb-2" style={{ color: textColors.primary }}>
                {t("confirmDelete")}
              </h3>
              <p className="text-sm text-center mb-6 leading-relaxed" style={{ color: textColors.secondary }}>
                {t("teacherDeleteAssignmentConfirm")}
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteAssignmentConfirmId(null)}
                  className="flex-1 py-3 rounded-xl font-semibold text-sm"
                  style={{
                    background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
                    color: textColors.primary,
                  }}
                >
                  {t("teacherCancel")}
                </button>
                <button
                  type="button"
                  disabled={deleteClassworkAssignmentMutation.isPending}
                  onClick={() => deleteClassworkAssignmentMutation.mutate(deleteAssignmentConfirmId)}
                  className="flex-1 py-3 rounded-xl font-semibold text-sm text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {deleteClassworkAssignmentMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  {t("delete")}
                </button>
              </div>
            </div>
          </div>,
          document.body
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
            {selectedGroup ? `${t("reuseSelectRecord")} (${selectedGroup.group_name})` : t("reuseSelectCourse")}
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
                    <p className="text-xs truncate" style={{ color: textColors.secondary }}>{getLocalizedCourseTitle({ title: g.course_title } as any, t)}</p>
                    <p className="text-[10px] mt-1 opacity-60" style={{ color: textColors.secondary }}>
                      {t("createdLabel")}: {formatLocalizedDate(g.created_at, lang, t, { includeTime: true, shortMonth: true })}
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
                ← {t("reuseBackToSelection")}
              </button>

              {itemsLoading ? (
                <p className="text-center py-10" style={{ color: textColors.secondary }}>{t("loading")}</p>
              ) : items.length === 0 ? (
                <p className="text-center py-10" style={{ color: textColors.secondary }}>{t("reuseNoRecords")}</p>
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
                        {formatLocalizedDate(item.created_at, lang, t, { includeTime: true, shortMonth: true })}
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
              {t("reuseCopyAttachments")}
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}
