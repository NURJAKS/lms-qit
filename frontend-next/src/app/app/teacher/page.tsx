"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useAuthStore } from "@/store/authStore";
import { useLanguage } from "@/context/LanguageContext";
import type { TranslationKey } from "@/i18n/translations";
import { useTheme } from "@/context/ThemeContext";
import { getGlassCardStyle, getTextColors, getInputStyle, getModalStyle } from "@/utils/themeStyles";
import { BlurFade } from "@/components/ui/blur-fade";
import { getLocalizedCourseTitle } from "@/lib/courseUtils";
import {
  Users, BookOpen, Plus, Download, ChevronDown, ChevronRight, ListTodo,
  Check, Paperclip, Link as LinkIcon, Trash2, ClipboardList, MessageCircle,
  Copy, List, Calendar, GraduationCap, Sparkles, FileText, X, Eye,
  UserPlus, FolderOpen,
} from "lucide-react";
import { RichTextEditor } from "@/components/teacher/RichTextEditor";

type Group = {
  id: number;
  course_id: number;
  course_title: string;
  group_name: string;
  students_count: number;
};

type Assignment = {
  id: number;
  group_id: number;
  group_name: string;
  course_id: number;
  course_title: string;
  title: string;
  deadline: string | null;
};

type AddStudentTask = {
  id: number;
  student_id: number;
  student_name: string;
  student_email: string;
  group_id: number;
  group_name: string;
  course_id: number | null;
  course_title: string;
  status: string;
  created_at: string | null;
  completed_at: string | null;
};

const GROUP_ACCENT_COLORS = [
  "#3B82F6", "#8B5CF6", "#10B981", "#F59E0B", "#EC4899", "#06B6D4", "#EF4444", "#14B8A6",
];

export default function TeacherPage() {
  const router = useRouter();
  const { user, isTeacher } = useAuthStore();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<"groups" | "assignments" | "students">(
    tabParam === "assignments" ? "assignments" : tabParam === "students" ? "students" : "groups"
  );
  
  useEffect(() => {
    if (user && !isTeacher()) {
      router.replace("/app");
    }
  }, [user, isTeacher, router]);

  useEffect(() => {
    if (tabParam === "assignments") setActiveTab("assignments");
    else if (tabParam === "students") setActiveTab("students");
    else if (tabParam === "groups") setActiveTab("groups");
  }, [tabParam]);

  if (user && !isTeacher()) {
    return null;
  }

  const { t } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const glassStyle = getGlassCardStyle(theme);
  const inputStyle = getInputStyle(theme);
  const modalStyle = getModalStyle(theme);
  const textColors = getTextColors(theme);

  const queryClient = useQueryClient();
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupCourseId, setNewGroupCourseId] = useState<number | "">("");
  const [expandedGroupId, setExpandedGroupId] = useState<number | null>(null);
  const [addStudentGroupId, setAddStudentGroupId] = useState<number | null>(null);
  const [createDropdownOpen, setCreateDropdownOpen] = useState(false);
  const [createModalType, setCreateModalType] = useState<"assignment" | "assignmentWithTest" | "question" | "material" | "topic" | "reuse" | null>(null);
  const [editingDeadlineId, setEditingDeadlineId] = useState<number | null>(null);
  const [editingDeadline, setEditingDeadline] = useState("");
  const [newAssignment, setNewAssignment] = useState({
    group_id: "" as number | "",
    course_id: "" as number | "",
    topic_id: "" as number | "",
    title: "",
    description: "",
    deadline: "",
    max_points: 100,
    attachment_urls: [] as string[],
    attachment_links: [] as string[],
    video_urls: [] as string[],
    rubric: [] as { name: string; max_points: number }[],
    test_questions: [] as { question_text: string; option_a: string; option_b: string; option_c: string; option_d: string; correct_answer: string }[],
  });
  const [newLinkInput, setNewLinkInput] = useState("");
  const [newVideoLinkInput, setNewVideoLinkInput] = useState("");
  const [newQuestion, setNewQuestion] = useState({
    group_id: "" as number | "",
    course_id: "" as number | "",
    question_text: "",
    question_type: "single_choice" as "single_choice" | "open",
    options: [] as string[],
    correct_option: "",
  });
  const [newMaterial, setNewMaterial] = useState({
    group_id: "" as number | "",
    course_id: "" as number | "",
    topic_id: null as number | null,
    title: "",
    description: "",
    video_urls: [] as string[],
    image_urls: [] as string[],
  });
  const [newTopic, setNewTopic] = useState({ course_id: "" as number | "", title: "", description: "" });
  const [materialVideoLinkInput, setMaterialVideoLinkInput] = useState("");
  const createDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (createDropdownRef.current && !createDropdownRef.current.contains(e.target as Node)) {
        setCreateDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const { data: groups = [] } = useQuery({
    queryKey: ["teacher-groups"],
    queryFn: async () => {
      const { data } = await api.get<Group[]>("/teacher/groups");
      return data;
    },
  });

  const selectedGroup = groups.find((g) => g.id === expandedGroupId);
  const { data: groupStudents = [] } = useQuery({
    queryKey: ["teacher-group-students", expandedGroupId],
    queryFn: async () => {
      const { data } = await api.get<Array<{ id: number; full_name: string; email: string }>>(
        `/teacher/groups/${expandedGroupId}/students`
      );
      return data;
    },
    enabled: !!expandedGroupId,
  });

  const courseIdForTopics = (createModalType === "material" ? newMaterial.course_id : newAssignment.course_id) as number | "";
  const { data: courseTopics = [] } = useQuery({
    queryKey: ["course-topics", courseIdForTopics],
    queryFn: async () => {
      const { data } = await api.get<Array<{ id: number; title: string }>>(`/courses/${courseIdForTopics}/topics`);
      return data;
    },
    enabled: !!courseIdForTopics && typeof courseIdForTopics === "number",
  });

  const addStudentGroup = groups.find((g) => g.id === addStudentGroupId);
  const { data: studentsWithoutGroup = [] } = useQuery({
    queryKey: ["teacher-students-without-group", addStudentGroupId],
    queryFn: async () => {
      if (!addStudentGroup?.course_id) return [];
      const { data } = await api.get<Array<{ id: number; full_name: string; email: string }>>(
        `/teacher/courses/${addStudentGroup.course_id}/students-without-group`
      );
      return data;
    },
    enabled: !!addStudentGroupId && !!addStudentGroup?.course_id,
  });

  const { data: courses = [] } = useQuery({
    queryKey: ["courses-active"],
    queryFn: async () => {
      const { data } = await api.get<Array<{ id: number; title: string }>>("/courses?is_active=true");
      return data;
    },
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ["teacher-assignments"],
    queryFn: async () => {
      const { data } = await api.get<Assignment[]>("/teacher/assignments");
      return data;
    },
  });

  const { data: materials = [] } = useQuery({
    queryKey: ["teacher-materials"],
    queryFn: async () => {
      const { data } = await api.get<Array<{ id: number; group_name: string; course_title: string; title: string }>>("/teacher/materials");
      return data;
    },
    enabled: createModalType === "reuse" || createModalType === "material",
  });

  const { data: questions = [] } = useQuery({
    queryKey: ["teacher-questions"],
    queryFn: async () => {
      const { data } = await api.get<Array<{ id: number; group_name: string; question_text: string }>>("/teacher/questions");
      return data;
    },
    enabled: createModalType === "question",
  });

  const { data: addStudentTasks = [] } = useQuery({
    queryKey: ["teacher-add-student-tasks"],
    queryFn: async () => {
      const { data } = await api.get<AddStudentTask[]>("/teacher/add-student-tasks?status=pending");
      return data;
    },
    enabled: activeTab === "students",
  });

  const createGroupMutation = useMutation({
    mutationFn: async (body: { course_id: number; group_name: string }) => {
      await api.post("/teacher/groups", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-groups"] });
      queryClient.invalidateQueries({ queryKey: ["teacher-stats"] });
      setNewGroupName("");
      setNewGroupCourseId("");
    },
  });

  const addStudentMutation = useMutation({
    mutationFn: async ({ groupId, studentId }: { groupId: number; studentId: number }) => {
      await api.post(`/teacher/groups/${groupId}/students`, { student_id: studentId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-groups"] });
      queryClient.invalidateQueries({ queryKey: ["teacher-group-students", addStudentGroupId] });
      queryClient.invalidateQueries({ queryKey: ["teacher-students-without-group", addStudentGroupId] });
      queryClient.invalidateQueries({ queryKey: ["teacher-stats"] });
      setAddStudentGroupId(null);
    },
  });

  const removeStudentMutation = useMutation({
    mutationFn: async ({ groupId, studentId }: { groupId: number; studentId: number }) => {
      await api.delete(`/teacher/groups/${groupId}/students/${studentId}`);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["teacher-groups"] });
      queryClient.invalidateQueries({ queryKey: ["teacher-group-students", variables.groupId] });
      queryClient.invalidateQueries({ queryKey: ["teacher-stats"] });
    },
  });

  const completeTaskMutation = useMutation({
    mutationFn: async (taskId: number) => {
      await api.post(`/teacher/add-student-tasks/${taskId}/complete`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-add-student-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["teacher-stats"] });
    },
  });

  const createAssignmentMutation = useMutation({
    mutationFn: async (body: {
      group_id: number;
      course_id: number;
      topic_id: number;
      title: string;
      description?: string;
      deadline?: string;
      max_points?: number;
      attachment_urls?: string[];
      attachment_links?: string[];
      video_urls?: string[];
      rubric?: { name: string; max_points: number }[];
      test_questions?: { question_text: string; option_a: string; option_b: string; option_c: string; option_d: string; correct_answer: string }[];
    }) => {
      await api.post("/teacher/assignments", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["teacher-stats"] });
      queryClient.invalidateQueries({ queryKey: ["upcoming-deadlines"] });
      setCreateModalType(null);
      resetNewAssignment();
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || t("errorCreatingAssignment"));
    },
  });

  const updateDeadlineMutation = useMutation({
    mutationFn: async ({ assignmentId, deadline }: { assignmentId: number; deadline: string | null }) => {
      await api.patch(`/teacher/assignments/${assignmentId}/deadline`, { deadline });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["upcoming-deadlines"] });
      setEditingDeadlineId(null);
      setEditingDeadline("");
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || t("errorUpdatingDeadline"));
    },
  });

  const createQuestionMutation = useMutation({
    mutationFn: async (body: { group_id: number; course_id: number; question_text: string; question_type: string; options?: string[]; correct_option?: string }) => {
      await api.post("/teacher/questions", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-questions"] });
      queryClient.invalidateQueries({ queryKey: ["teacher-stats"] });
      setCreateModalType(null);
      setNewQuestion({ group_id: "" as number | "", course_id: "" as number | "", question_text: "", question_type: "single_choice", options: [], correct_option: "" });
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || t("errorCreatingQuestion"));
    },
  });

  const createMaterialMutation = useMutation({
    mutationFn: async (body: { group_id: number; course_id: number; topic_id?: number; title: string; description?: string; video_urls?: string[]; image_urls?: string[] }) => {
      await api.post("/teacher/materials", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-materials"] });
      queryClient.invalidateQueries({ queryKey: ["teacher-stats"] });
      setCreateModalType(null);
      setNewMaterial({ group_id: "" as number | "", course_id: "" as number | "", topic_id: null, title: "", description: "", video_urls: [], image_urls: [] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || t("errorCreatingMaterial"));
    },
  });

  const createTopicMutation = useMutation({
    mutationFn: async (body: { course_id: number; title: string; description?: string }) => {
      await api.post(`/teacher/courses/${body.course_id}/topics`, { title: body.title, description: body.description });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course-topics"] });
      queryClient.invalidateQueries({ queryKey: ["teacher-stats"] });
      setCreateModalType(null);
      setNewTopic({ course_id: "" as number | "", title: "", description: "" });
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || t("errorCreatingTopic"));
    },
  });

  const resetNewAssignment = () => {
    setNewAssignment({
      group_id: "" as number | "",
      course_id: "" as number | "",
      topic_id: "" as number | "",
      title: "",
      description: "",
      deadline: "",
      max_points: 100,
      attachment_urls: [],
      attachment_links: [],
      video_urls: [],
      rubric: [],
      test_questions: [],
    });
  };

  const handleCreateGroup = () => {
    if (newGroupName && newGroupCourseId) {
      createGroupMutation.mutate({
        course_id: Number(newGroupCourseId),
        group_name: newGroupName,
      });
    }
  };

  const handleAddStudent = (studentId: number) => {
    if (addStudentGroupId) {
      addStudentMutation.mutate({ groupId: addStudentGroupId, studentId });
    }
  };

  const handleCreateAssignment = () => {
    if (newAssignment.group_id && newAssignment.course_id && newAssignment.topic_id && newAssignment.title) {
      createAssignmentMutation.mutate({
        group_id: Number(newAssignment.group_id),
        course_id: Number(newAssignment.course_id),
        topic_id: Number(newAssignment.topic_id),
        title: newAssignment.title,
        description: newAssignment.description || undefined,
        deadline: newAssignment.deadline || undefined,
        max_points: newAssignment.max_points,
        attachment_urls: newAssignment.attachment_urls.length ? newAssignment.attachment_urls : undefined,
        attachment_links: newAssignment.attachment_links.length ? newAssignment.attachment_links : undefined,
        video_urls: newAssignment.video_urls.length ? newAssignment.video_urls : undefined,
        rubric: newAssignment.rubric.length ? newAssignment.rubric : undefined,
        test_questions: createModalType === "assignmentWithTest" && newAssignment.test_questions.length ? newAssignment.test_questions : undefined,
      });
      setNewAssignment({
        group_id: "" as number | "",
        course_id: "" as number | "",
        topic_id: "" as number | "",
        title: "",
        description: "",
        deadline: "",
        max_points: 100,
        attachment_urls: [],
        attachment_links: [],
        video_urls: [],
        rubric: [],
        test_questions: [],
      });
      setCreateModalType(null);
    }
  };

  const handleUploadAssignmentFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    const { data } = await api.post<{ url: string }>("/teacher/assignments/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    setNewAssignment((prev) => ({ ...prev, attachment_urls: [...prev.attachment_urls, data.url] }));
    e.target.value = "";
  };

  const handleUploadVideoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    const { data } = await api.post<{ url: string }>("/teacher/assignments/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    setNewAssignment((prev) => ({ ...prev, video_urls: [...prev.video_urls, data.url] }));
    e.target.value = "";
  };

  const handleCreateQuestion = () => {
    if (newQuestion.group_id && newQuestion.course_id && newQuestion.question_text) {
      createQuestionMutation.mutate({
        group_id: Number(newQuestion.group_id),
        course_id: Number(newQuestion.course_id),
        question_text: newQuestion.question_text,
        question_type: newQuestion.question_type,
        options: newQuestion.options.length ? newQuestion.options : undefined,
        correct_option: newQuestion.correct_option || undefined,
      });
      setNewQuestion({ group_id: "" as number | "", course_id: "" as number | "", question_text: "", question_type: "single_choice", options: ["", ""], correct_option: "" });
      setCreateModalType(null);
    }
  };

  const handleCreateMaterial = () => {
    if (newMaterial.group_id && newMaterial.course_id && newMaterial.title) {
      createMaterialMutation.mutate({
        group_id: Number(newMaterial.group_id),
        course_id: Number(newMaterial.course_id),
        topic_id: newMaterial.topic_id ? Number(newMaterial.topic_id) : undefined,
        title: newMaterial.title,
        description: newMaterial.description || undefined,
        video_urls: newMaterial.video_urls.length ? newMaterial.video_urls : undefined,
        image_urls: newMaterial.image_urls.length ? newMaterial.image_urls : undefined,
      });
      setNewMaterial({ group_id: "" as number | "", course_id: "" as number | "", topic_id: null, title: "", description: "", video_urls: [], image_urls: [] });
    }
  };

  const handleCreateTopic = () => {
    if (newTopic.course_id && newTopic.title) {
      createTopicMutation.mutate({
        course_id: Number(newTopic.course_id),
        title: newTopic.title,
        description: newTopic.description || undefined,
      });
      setNewTopic({ course_id: "" as number | "", title: "", description: "" });
      setCreateModalType(null);
    }
  };

  const handleAddRubricCriterion = () => {
    setNewAssignment((prev) => ({
      ...prev,
      rubric: [...prev.rubric, { name: "", max_points: 0 }],
    }));
  };

  const handleExportCsv = async (groupId: number) => {
    try {
      const { data } = await api.get(`/teacher/groups/${groupId}/progress/csv`, {
        responseType: "blob",
      });
      const url = URL.createObjectURL(data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `group_${groupId}_progress.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to export CSV:", error);
      const err = error as { response?: { data?: { detail?: string }; status?: number }; message?: string };
      const errorMessage = err?.response?.data?.detail || err?.message || t("csvExportError");
      alert(errorMessage);
    }
  };

  const getGroupColor = (index: number) => GROUP_ACCENT_COLORS[index % GROUP_ACCENT_COLORS.length];

  const tabItems = [
    { key: "groups" as const, icon: Users, label: t("teacherGroups"), count: groups.length },
    { key: "assignments" as const, icon: BookOpen, label: t("teacherAssignments"), count: assignments.length },
    { key: "students" as const, icon: ListTodo, label: t("teacherStudentsList"), count: addStudentTasks.length },
  ];

  const inputClasses = "w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-all duration-200 focus:ring-2 focus:ring-blue-500/40";
  const selectClasses = "rounded-xl px-4 py-2.5 text-sm outline-none transition-all duration-200 focus:ring-2 focus:ring-blue-500/40 appearance-none cursor-pointer";

  return (
    <div className="max-w-5xl mx-auto pb-12 space-y-6">
      {/* Page Header */}
      <BlurFade delay={0.05}>
        <div className="flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 text-white shadow-lg"
            style={{ background: "linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)" }}
          >
            <GraduationCap className="w-7 h-7" />
          </div>
          <div>
            <h1
              className="text-2xl font-bold font-geologica tracking-tight"
              style={{ color: textColors.primary }}
            >
              {t("teacherDashboardGreeting")}
            </h1>
            <p className="text-sm mt-0.5" style={{ color: textColors.secondary }}>
              {t("teacherGroups")}, {t("teacherAssignments").toLowerCase()}, {t("teacherStudentsList").toLowerCase()}
            </p>
          </div>
        </div>
      </BlurFade>

      {/* Tab Navigation */}
      <BlurFade delay={0.1}>
        <div
          className="flex gap-1 p-1.5 rounded-2xl"
          style={{
            ...glassStyle,
            background: isDark ? "rgba(26, 34, 56, 0.6)" : "rgba(255, 255, 255, 0.9)",
          }}
        >
          {tabItems.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium transition-all duration-300 ${
                  isActive ? "text-white shadow-lg" : "hover:bg-black/5 dark:hover:bg-white/5"
                }`}
                style={
                  isActive
                    ? { background: "linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)", boxShadow: "0 4px 12px rgba(59, 130, 246, 0.4)" }
                    : { color: textColors.secondary }
                }
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      isActive
                        ? "bg-white/20 text-white"
                        : isDark ? "bg-white/10 text-white/60" : "bg-black/5 text-gray-500"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </BlurFade>

      {/* ========== GROUPS TAB ========== */}
      {activeTab === "groups" && (
        <div className="space-y-6">
          {/* Create Group */}
          <BlurFade delay={0.15}>
            <div className="rounded-2xl p-6 relative overflow-hidden" style={glassStyle}>
              <div
                className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl"
                style={{ background: "linear-gradient(90deg, #3B82F6, #8B5CF6, #EC4899)" }}
              />
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-500 text-white">
                  <Plus className="w-4 h-4" />
                </div>
                <h2 className="font-semibold font-geologica" style={{ color: textColors.primary }}>
                  {t("teacherCreateGroup")}
                </h2>
              </div>
              <div className="flex gap-3 flex-wrap">
                <select
                  value={newGroupCourseId}
                  onChange={(e) => setNewGroupCourseId(Number(e.target.value) || "")}
                  className={selectClasses}
                  style={inputStyle}
                >
                  <option value="">{t("course")}</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder={t("teacherGroupName")}
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className={`flex-1 min-w-[200px] ${inputClasses}`}
                  style={inputStyle}
                />
                <button
                  type="button"
                  onClick={handleCreateGroup}
                  disabled={createGroupMutation.isPending || !newGroupName || !newGroupCourseId}
                  className="py-2.5 px-6 rounded-xl text-white font-medium text-sm disabled:opacity-40 transition-all duration-200 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
                  style={{
                    background: "linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)",
                    boxShadow: "0 4px 12px rgba(59, 130, 246, 0.3)",
                  }}
                >
                  <Plus className="w-4 h-4 inline mr-1.5" /> {t("save")}
                </button>
              </div>
            </div>
          </BlurFade>

          {/* Groups List */}
          <BlurFade delay={0.2}>
            <div className="rounded-2xl p-6" style={glassStyle}>
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-emerald-500 to-teal-500 text-white">
                    <FolderOpen className="w-4 h-4" />
                  </div>
                  <h2 className="font-semibold font-geologica" style={{ color: textColors.primary }}>
                    {t("teacherGroups")}
                  </h2>
                </div>
                <span
                  className="text-xs font-medium px-3 py-1 rounded-full"
                  style={{
                    background: isDark ? "rgba(59, 130, 246, 0.15)" : "rgba(59, 130, 246, 0.08)",
                    color: isDark ? "#60A5FA" : "#3B82F6",
                  }}
                >
                  {groups.length} {t("teacherGroups").toLowerCase()}
                </span>
              </div>

              {groups.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                    style={{ background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)" }}
                  >
                    <Users className="w-8 h-8" style={{ color: textColors.secondary }} />
                  </div>
                  <p className="font-medium mb-1" style={{ color: textColors.secondary }}>
                    {t("teacherNoGroups")}
                  </p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {groups.map((g, idx) => {
                    const accentColor = getGroupColor(idx);
                    return (
                      <li
                        key={g.id}
                        className="rounded-xl overflow-hidden transition-all duration-200 hover:shadow-md"
                        style={{
                          background: isDark ? "rgba(30, 41, 59, 0.6)" : "rgba(249, 250, 251, 0.8)",
                          border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}`,
                          borderLeft: `4px solid ${accentColor}`,
                        }}
                      >
                        <div className="flex items-center justify-between p-4">
                          <button
                            type="button"
                            onClick={() => setExpandedGroupId(expandedGroupId === g.id ? null : g.id)}
                            className="flex items-center gap-3 flex-1 text-left group"
                          >
                            <ChevronRight
                              className="w-4 h-4 transition-transform duration-200"
                              style={{
                                color: textColors.secondary,
                                transform: expandedGroupId === g.id ? "rotate(90deg)" : "rotate(0deg)",
                              }}
                            />
                            <div>
                              <span className="font-semibold text-sm" style={{ color: textColors.primary }}>
                                {g.group_name}
                              </span>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span
                                  className="text-xs font-medium px-2 py-0.5 rounded-md"
                                  style={{
                                    background: `${accentColor}15`,
                                    color: accentColor,
                                  }}
                                >
                                  {getLocalizedCourseTitle({ title: g.course_title } as any, t) || `#${g.course_id}`}
                                </span>
                                <span className="text-xs flex items-center gap-1" style={{ color: textColors.secondary }}>
                                  <Users className="w-3 h-3" /> {g.students_count} {t("teacherStatsStudents")}
                                </span>
                              </div>
                            </div>
                          </button>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setAddStudentGroupId(g.id)}
                              className="flex items-center gap-1.5 py-2 px-3.5 rounded-lg text-white text-xs font-medium transition-all hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
                              style={{ background: "linear-gradient(135deg, #10B981, #06B6D4)", boxShadow: "0 2px 8px rgba(16, 185, 129, 0.3)" }}
                            >
                              <UserPlus className="w-3.5 h-3.5" /> {t("teacherAddStudent")}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleExportCsv(g.id)}
                              className="flex items-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition-all hover:scale-[1.02] active:scale-[0.98]"
                              style={{
                                background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)",
                                color: textColors.secondary,
                              }}
                            >
                              <Download className="w-3.5 h-3.5" /> CSV
                            </button>
                          </div>
                        </div>

                        {expandedGroupId === g.id && (
                          <div
                            className="px-4 pb-4 pt-2 border-t"
                            style={{ borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)" }}
                          >
                            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: textColors.secondary }}>
                              {t("teacherStatsStudents")}
                            </p>
                            {groupStudents.length === 0 ? (
                              <p className="text-sm py-3 text-center" style={{ color: textColors.secondary }}>
                                {t("teacherNoStudentsInGroup")}
                              </p>
                            ) : (
                              <ul className="space-y-1">
                                {groupStudents.map((s) => (
                                  <li
                                    key={s.id}
                                    className="flex items-center justify-between py-2.5 px-3 rounded-lg transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
                                  >
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                      <div
                                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                                        style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}CC)` }}
                                      >
                                        {(s.full_name || s.email).charAt(0).toUpperCase()}
                                      </div>
                                      <div className="min-w-0">
                                        <Link
                                          href={`/app/profile/${s.id}`}
                                          className="text-sm font-medium hover:underline"
                                          style={{ color: isDark ? "#60A5FA" : "#3B82F6" }}
                                        >
                                          {s.full_name || s.email}
                                        </Link>
                                        <p className="text-xs truncate" style={{ color: textColors.secondary }}>{s.email}</p>
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (window.confirm(t("confirmDelete"))) {
                                          removeStudentMutation.mutate({ groupId: g.id, studentId: s.id });
                                        }
                                      }}
                                      className="p-1.5 rounded-lg transition-colors hover:bg-red-500/10 text-red-400 hover:text-red-500"
                                      title={t("delete")}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </BlurFade>
        </div>
      )}

      {/* ========== STUDENTS TAB ========== */}
      {activeTab === "students" && (
        <BlurFade delay={0.15}>
          <div className="rounded-2xl p-6" style={glassStyle}>
            <div className="flex items-center gap-2 mb-5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-amber-500 to-orange-500 text-white">
                <ListTodo className="w-4 h-4" />
              </div>
              <h2 className="font-semibold font-geologica" style={{ color: textColors.primary }}>
                {t("teacherStudentsList")}
              </h2>
              {addStudentTasks.length > 0 && (
                <span
                  className="text-xs font-semibold px-2.5 py-0.5 rounded-full ml-2"
                  style={{
                    background: isDark ? "rgba(245, 158, 11, 0.15)" : "rgba(245, 158, 11, 0.1)",
                    color: isDark ? "#FBBF24" : "#D97706",
                  }}
                >
                  {addStudentTasks.length}
                </span>
              )}
            </div>

            {addStudentTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                  style={{ background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)" }}
                >
                  <Check className="w-8 h-8" style={{ color: "#10B981" }} />
                </div>
                <p className="font-medium mb-1" style={{ color: textColors.secondary }}>
                  {t("teacherNoStudentTasks")}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-6">
                <table className="w-full min-w-[640px]">
                  <thead>
                    <tr
                      style={{
                        background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                        borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`,
                      }}
                    >
                      <th className="text-left py-3 px-6 text-xs font-semibold uppercase tracking-wider" style={{ color: textColors.secondary }}>
                        {t("adminFullName")} / Email
                      </th>
                      <th className="text-left py-3 px-6 text-xs font-semibold uppercase tracking-wider" style={{ color: textColors.secondary }}>
                        {t("courses")}
                      </th>
                      <th className="text-left py-3 px-6 text-xs font-semibold uppercase tracking-wider" style={{ color: textColors.secondary }}>
                        {t("teacherGroups")}
                      </th>
                      <th className="text-right py-3 px-6 text-xs font-semibold uppercase tracking-wider" style={{ color: textColors.secondary }}>
                        {t("adminCoursesActions")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {addStudentTasks.map((task) => (
                      <tr
                        key={task.id}
                        className="transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
                        style={{ borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"}` }}
                      >
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                              style={{ background: "linear-gradient(135deg, #F59E0B, #EF4444)" }}
                            >
                              {(task.student_name || task.student_email).charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <Link
                                href={`/app/profile/${task.student_id}`}
                                className="text-sm font-medium hover:underline"
                                style={{ color: isDark ? "#60A5FA" : "#3B82F6" }}
                              >
                                {task.student_name || task.student_email}
                              </Link>
                              <p className="text-xs" style={{ color: textColors.secondary }}>{task.student_email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span
                            className="text-xs font-medium px-2.5 py-1 rounded-md"
                            style={{
                              background: isDark ? "rgba(139, 92, 246, 0.15)" : "rgba(139, 92, 246, 0.08)",
                              color: isDark ? "#A78BFA" : "#7C3AED",
                            }}
                          >
                            {getLocalizedCourseTitle({ title: task.course_title } as any, t)}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-sm" style={{ color: textColors.primary }}>
                          {task.group_name}
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveTab("groups");
                                setExpandedGroupId(task.group_id);
                              }}
                              className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-white text-xs font-medium transition-all hover:shadow-md hover:scale-[1.02]"
                              style={{ background: "linear-gradient(135deg, #3B82F6, #8B5CF6)" }}
                            >
                              <Plus className="w-3.5 h-3.5" /> {t("teacherAddToGroup")}
                            </button>
                            <button
                              type="button"
                              onClick={() => completeTaskMutation.mutate(task.id)}
                              disabled={completeTaskMutation.isPending}
                              className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-medium transition-all hover:scale-[1.02] disabled:opacity-50"
                              style={{
                                background: isDark ? "rgba(16, 185, 129, 0.15)" : "rgba(16, 185, 129, 0.1)",
                                color: isDark ? "#34D399" : "#059669",
                              }}
                              title={t("teacherMarkDone")}
                            >
                              <Check className="w-3.5 h-3.5" /> {t("teacherMarkDone")}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </BlurFade>
      )}

      {/* ========== ASSIGNMENTS TAB ========== */}
      {activeTab === "assignments" && (
        <div className="space-y-6">
          <BlurFade delay={0.15}>
            <div className="rounded-2xl p-6" style={glassStyle}>
              <div className="flex justify-between items-center mb-5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <h2 className="font-semibold font-geologica" style={{ color: textColors.primary }}>
                    {t("teacherAssignments")}
                  </h2>
                  {assignments.length > 0 && (
                    <span
                      className="text-xs font-medium px-2.5 py-0.5 rounded-full"
                      style={{
                        background: isDark ? "rgba(139, 92, 246, 0.15)" : "rgba(139, 92, 246, 0.08)",
                        color: isDark ? "#A78BFA" : "#7C3AED",
                      }}
                    >
                      {assignments.length}
                    </span>
                  )}
                </div>
                <div className="relative" ref={createDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setCreateDropdownOpen(!createDropdownOpen)}
                    className="py-2 px-5 rounded-xl text-white text-sm font-medium flex items-center gap-2 transition-all hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
                    style={{
                      background: "linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)",
                      boxShadow: "0 4px 12px rgba(139, 92, 246, 0.35)",
                    }}
                  >
                    <Sparkles className="w-4 h-4" />
                    {t("teacherCreate")}
                    <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${createDropdownOpen ? "rotate-180" : ""}`} />
                  </button>
                  {createDropdownOpen && (
                    <div
                      className="absolute right-0 mt-2 w-60 rounded-xl py-2 z-50 shadow-2xl animate-slide-up"
                      style={{
                        ...modalStyle,
                        boxShadow: isDark
                          ? "0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.08)"
                          : "0 20px 60px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)",
                      }}
                    >
                      {[
                        { type: "assignment" as const, icon: ClipboardList, label: t("teacherCreateAssignment") },
                        { type: "assignmentWithTest" as const, icon: FileText, label: t("teacherCreateAssignmentWithTest") },
                        { type: "question" as const, icon: MessageCircle, label: t("teacherCreateQuestion") },
                        { type: "material" as const, icon: BookOpen, label: t("teacherCreateMaterial") },
                        { type: "topic" as const, icon: List, label: t("teacherCreateTopic") },
                        { type: "reuse" as const, icon: Copy, label: t("teacherCreateReuse") },
                      ].map((item) => {
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.type}
                            type="button"
                            onClick={() => { setCreateModalType(item.type); setCreateDropdownOpen(false); }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                            style={{ color: textColors.primary }}
                          >
                            <Icon className="w-4 h-4" style={{ color: textColors.secondary }} />
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Assignment Creation Form */}
              {(createModalType === "assignment" || createModalType === "assignmentWithTest") && (
                <div
                  className="mb-6 p-5 rounded-xl space-y-4"
                  style={{
                    background: isDark ? "rgba(30, 41, 59, 0.5)" : "rgba(249, 250, 251, 0.8)",
                    border: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`,
                  }}
                >
                  <select
                    value={newAssignment.group_id}
                    onChange={(e) => {
                      const g = groups.find((x) => x.id === Number(e.target.value));
                      setNewAssignment((prev) => ({
                        ...prev,
                        group_id: Number(e.target.value) || ("" as number | ""),
                        course_id: g ? g.course_id : ("" as number | ""),
                        topic_id: "" as number | "",
                      }));
                    }}
                    className={`w-full ${selectClasses}`}
                    style={inputStyle}
                  >
                    <option value="">{t("teacherGroups")}</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>{g.group_name} — {getLocalizedCourseTitle({ title: g.course_title } as any, t)}</option>
                    ))}
                  </select>

                  {newAssignment.course_id && (
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: textColors.secondary }}>
                        {t("teacherTopic")} *
                      </label>
                      <select
                        value={newAssignment.topic_id}
                        onChange={(e) =>
                          setNewAssignment((prev) => ({ ...prev, topic_id: Number(e.target.value) || ("" as number | "") }))
                        }
                        className={`w-full ${selectClasses}`}
                        style={inputStyle}
                      >
                        <option value="">— {t("teacherSelectTopic")} —</option>
                        {courseTopics.map((tpc) => (
                          <option key={tpc.id} value={tpc.id}>{tpc.title}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <input
                    type="text"
                    placeholder={t("teacherAssignmentTitle")}
                    value={newAssignment.title}
                    onChange={(e) => setNewAssignment((prev) => ({ ...prev, title: e.target.value }))}
                    className={inputClasses}
                    style={inputStyle}
                  />

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: textColors.secondary }}>
                      {t("teacherAssignmentDesc")}
                    </label>
                    <RichTextEditor
                      value={newAssignment.description}
                      onChange={(html) => setNewAssignment((prev) => ({ ...prev, description: html }))}
                      placeholder={t("teacherAssignmentDesc")}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: textColors.secondary }}>
                      {t("teacherVideo")}
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="file" accept="video/*,.mp4,.webm" onChange={handleUploadVideoFile} className="hidden" />
                        <Paperclip className="w-4 h-4" style={{ color: textColors.secondary }} />
                        <span className="text-sm font-medium" style={{ color: isDark ? "#60A5FA" : "#3B82F6" }}>
                          {t("teacherVideoUpload")}
                        </span>
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          placeholder={t("teacherVideoLink")}
                          value={newVideoLinkInput}
                          onChange={(e) => setNewVideoLinkInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              if (newVideoLinkInput.trim()) {
                                setNewAssignment((prev) => ({ ...prev, video_urls: [...prev.video_urls, newVideoLinkInput.trim()] }));
                                setNewVideoLinkInput("");
                              }
                            }
                          }}
                          className={`flex-1 ${inputClasses}`}
                          style={inputStyle}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (newVideoLinkInput.trim()) {
                              setNewAssignment((prev) => ({ ...prev, video_urls: [...prev.video_urls, newVideoLinkInput.trim()] }));
                              setNewVideoLinkInput("");
                            }
                          }}
                          className="py-2.5 px-3.5 rounded-xl transition-colors"
                          style={{
                            background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)",
                            color: textColors.secondary,
                          }}
                        >
                          <LinkIcon className="w-4 h-4" />
                        </button>
                      </div>
                      {newAssignment.video_urls.length > 0 && (
                        <ul className="space-y-1">
                          {newAssignment.video_urls.map((u, i) => (
                            <li key={i} className="flex items-center gap-2 text-sm" style={{ color: textColors.secondary }}>
                              <a href={u} target="_blank" rel="noopener noreferrer" className="truncate hover:underline" style={{ color: isDark ? "#60A5FA" : "#3B82F6" }}>
                                {u.startsWith("/") ? u.split("/").pop() : u}
                              </a>
                              <button
                                type="button"
                                onClick={() => setNewAssignment((prev) => ({ ...prev, video_urls: prev.video_urls.filter((_, j) => j !== i) }))}
                                className="text-red-400 hover:text-red-500 shrink-0"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: textColors.secondary }}>
                      {t("teacherMaxPoints")}
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={newAssignment.max_points}
                      onChange={(e) =>
                        setNewAssignment((prev) => ({ ...prev, max_points: Math.max(1, parseInt(e.target.value, 10) || 100) }))
                      }
                      className={inputClasses}
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: textColors.secondary }}>
                      {t("teacherRubric")}
                    </label>
                    <div className="space-y-2">
                      {newAssignment.rubric.map((c, i) => (
                        <div key={i} className="flex gap-2 items-center">
                          <input
                            type="text"
                            placeholder={t("teacherCriterionName")}
                            value={c.name}
                            onChange={(e) =>
                              setNewAssignment((prev) => ({
                                ...prev,
                                rubric: prev.rubric.map((r, j) => j === i ? { ...r, name: e.target.value } : r),
                              }))
                            }
                            className={`flex-1 ${inputClasses}`}
                            style={inputStyle}
                          />
                          <input
                            type="number"
                            min={0}
                            placeholder="0"
                            value={c.max_points || ""}
                            onChange={(e) =>
                              setNewAssignment((prev) => ({
                                ...prev,
                                rubric: prev.rubric.map((r, j) => j === i ? { ...r, max_points: parseInt(e.target.value, 10) || 0 } : r),
                              }))
                            }
                            className="w-24 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/40"
                            style={inputStyle}
                          />
                          <button
                            type="button"
                            onClick={() => setNewAssignment((prev) => ({ ...prev, rubric: prev.rubric.filter((_, j) => j !== i) }))}
                            className="p-2 rounded-lg text-red-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={handleAddRubricCriterion}
                        className="flex items-center gap-1.5 text-sm font-medium transition-colors"
                        style={{ color: isDark ? "#60A5FA" : "#3B82F6" }}
                      >
                        <Plus className="w-4 h-4" /> {t("teacherAddCriterion")}
                      </button>
                    </div>
                  </div>

                  {createModalType === "assignmentWithTest" && (
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: textColors.secondary }}>
                        {t("teacherTestQuestions")}
                      </label>
                      <div className="space-y-3">
                        {newAssignment.test_questions.map((q, i) => (
                          <div
                            key={i}
                            className="p-4 rounded-xl space-y-3"
                            style={{
                              background: isDark ? "rgba(30, 41, 59, 0.4)" : "rgba(255, 255, 255, 0.7)",
                              border: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`,
                            }}
                          >
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-bold px-2 py-0.5 rounded-md" style={{ background: isDark ? "rgba(139,92,246,0.2)" : "rgba(139,92,246,0.1)", color: isDark ? "#A78BFA" : "#7C3AED" }}>
                                #{i + 1}
                              </span>
                              <button
                                type="button"
                                onClick={() => setNewAssignment((prev) => ({ ...prev, test_questions: prev.test_questions.filter((_, j) => j !== i) }))}
                                className="p-1.5 rounded-lg text-red-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                            <input
                              type="text"
                              placeholder={t("teacherQuestionText")}
                              value={q.question_text}
                              onChange={(e) =>
                                setNewAssignment((prev) => ({
                                  ...prev,
                                  test_questions: prev.test_questions.map((tq, j) => j === i ? { ...tq, question_text: e.target.value } : tq),
                                }))
                              }
                              className={inputClasses}
                              style={inputStyle}
                            />
                            <div className="grid grid-cols-2 gap-2">
                              {(["a", "b", "c", "d"] as const).map((opt) => (
                                <input
                                  key={opt}
                                  type="text"
                                  placeholder={t(`teacherOption${opt.toUpperCase()}` as TranslationKey)}
                                  value={q[`option_${opt}`]}
                                  onChange={(e) =>
                                    setNewAssignment((prev) => ({
                                      ...prev,
                                      test_questions: prev.test_questions.map((tq, j) => j === i ? { ...tq, [`option_${opt}`]: e.target.value } : tq),
                                    }))
                                  }
                                  className={`${inputClasses}`}
                                  style={inputStyle}
                                />
                              ))}
                            </div>
                            <select
                              value={q.correct_answer}
                              onChange={(e) =>
                                setNewAssignment((prev) => ({
                                  ...prev,
                                  test_questions: prev.test_questions.map((tq, j) => j === i ? { ...tq, correct_answer: e.target.value } : tq),
                                }))
                              }
                              className={selectClasses}
                              style={inputStyle}
                            >
                              <option value="">{t("teacherCorrectAnswer")}</option>
                              <option value="a">A</option>
                              <option value="b">B</option>
                              <option value="c">C</option>
                              <option value="d">D</option>
                            </select>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() =>
                            setNewAssignment((prev) => ({
                              ...prev,
                              test_questions: [...prev.test_questions, { question_text: "", option_a: "", option_b: "", option_c: "", option_d: "", correct_answer: "" }],
                            }))
                          }
                          className="flex items-center gap-1.5 text-sm font-medium transition-colors"
                          style={{ color: isDark ? "#A78BFA" : "#7C3AED" }}
                        >
                          <Plus className="w-4 h-4" /> {t("teacherAddTestQuestion")}
                        </button>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: textColors.secondary }}>
                      {t("teacherAttachments")}
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="file"
                          accept=".jpg,.jpeg,.png,.gif,.webp,.mp4,.webm,.pdf,.doc,.docx,.txt"
                          onChange={handleUploadAssignmentFile}
                          className="hidden"
                        />
                        <Paperclip className="w-4 h-4" style={{ color: textColors.secondary }} />
                        <span className="text-sm font-medium" style={{ color: isDark ? "#60A5FA" : "#3B82F6" }}>
                          {t("teacherUploadFile")}
                        </span>
                      </label>
                      {newAssignment.attachment_urls.length > 0 && (
                        <ul className="space-y-1">
                          {newAssignment.attachment_urls.map((u, i) => (
                            <li key={i} className="flex items-center gap-2 text-sm">
                              <a href={u} target="_blank" rel="noopener noreferrer" className="truncate hover:underline" style={{ color: isDark ? "#60A5FA" : "#3B82F6" }}>
                                {u.split("/").pop()}
                              </a>
                              <button
                                type="button"
                                onClick={() => setNewAssignment((prev) => ({ ...prev, attachment_urls: prev.attachment_urls.filter((_, j) => j !== i) }))}
                                className="text-red-400 hover:text-red-500 shrink-0"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                      <div className="flex gap-2">
                        <input
                          type="url"
                          placeholder={t("teacherAddLink")}
                          value={newLinkInput}
                          onChange={(e) => setNewLinkInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              if (newLinkInput.trim()) {
                                setNewAssignment((prev) => ({ ...prev, attachment_links: [...prev.attachment_links, newLinkInput.trim()] }));
                                setNewLinkInput("");
                              }
                            }
                          }}
                          className={`flex-1 ${inputClasses}`}
                          style={inputStyle}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (newLinkInput.trim()) {
                              setNewAssignment((prev) => ({ ...prev, attachment_links: [...prev.attachment_links, newLinkInput.trim()] }));
                              setNewLinkInput("");
                            }
                          }}
                          className="py-2.5 px-3.5 rounded-xl transition-colors"
                          style={{
                            background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)",
                            color: textColors.secondary,
                          }}
                        >
                          <LinkIcon className="w-4 h-4" />
                        </button>
                      </div>
                      {newAssignment.attachment_links.length > 0 && (
                        <ul className="space-y-1">
                          {newAssignment.attachment_links.map((link, i) => (
                            <li key={i} className="flex items-center gap-2 text-sm">
                              <a href={link} target="_blank" rel="noopener noreferrer" className="truncate hover:underline" style={{ color: isDark ? "#60A5FA" : "#3B82F6" }}>
                                {link}
                              </a>
                              <button
                                type="button"
                                onClick={() => setNewAssignment((prev) => ({ ...prev, attachment_links: prev.attachment_links.filter((_, j) => j !== i) }))}
                                className="text-red-400 hover:text-red-500 shrink-0"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: textColors.secondary }}>
                      <Calendar className="w-3.5 h-3.5" />
                      {t("teacherDeadline")} {t("teacherOptional")}
                    </label>
                    <input
                      type="datetime-local"
                      value={newAssignment.deadline}
                      onChange={(e) => setNewAssignment((prev) => ({ ...prev, deadline: e.target.value }))}
                      min={new Date().toISOString().slice(0, 16)}
                      className={inputClasses}
                      style={inputStyle}
                    />
                    {newAssignment.deadline && (
                      <p className="text-xs mt-1.5" style={{ color: textColors.secondary }}>
                        {t("teacherDeadlineHint")}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={handleCreateAssignment}
                      disabled={createAssignmentMutation.isPending || !newAssignment.title || !newAssignment.topic_id}
                      className="py-2.5 px-6 rounded-xl text-white font-medium text-sm disabled:opacity-40 transition-all hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
                      style={{ background: "linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)", boxShadow: "0 4px 12px rgba(59, 130, 246, 0.3)" }}
                    >
                      {t("save")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreateModalType(null)}
                      className="py-2.5 px-6 rounded-xl text-sm font-medium transition-colors"
                      style={{
                        background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)",
                        color: textColors.secondary,
                      }}
                    >
                      {t("cancel")}
                    </button>
                  </div>
                </div>
              )}

              {/* Assignments List */}
              {assignments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                    style={{ background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)" }}
                  >
                    <BookOpen className="w-8 h-8" style={{ color: textColors.secondary }} />
                  </div>
                  <p className="font-medium" style={{ color: textColors.secondary }}>
                    {t("teacherNoAssignments")}
                  </p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {assignments.map((a, idx) => {
                    const accentColor = getGroupColor(idx);
                    const deadlineDate = a.deadline ? new Date(a.deadline) : null;
                    const isOverdue = deadlineDate && deadlineDate < new Date();
                    const isSoon = deadlineDate && !isOverdue && (deadlineDate.getTime() - Date.now()) < 3 * 24 * 60 * 60 * 1000;

                    return (
                      <li
                        key={a.id}
                        className="p-4 rounded-xl transition-all duration-200 hover:shadow-md group"
                        style={{
                          background: isDark ? "rgba(30, 41, 59, 0.6)" : "rgba(249, 250, 251, 0.8)",
                          border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}`,
                          borderLeft: `4px solid ${accentColor}`,
                        }}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm mb-1" style={{ color: textColors.primary }}>{a.title}</p>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className="text-xs font-medium px-2 py-0.5 rounded-md"
                                style={{ background: `${accentColor}15`, color: accentColor }}
                              >
                                {a.group_name}
                              </span>
                              <span className="text-xs" style={{ color: textColors.secondary }}>
                                {getLocalizedCourseTitle({ title: a.course_title } as any, t)}
                              </span>
                            </div>
                          </div>
                          <Link
                            href={`/app/teacher/assignment/${a.id}`}
                            className="flex items-center gap-1.5 py-1.5 px-3.5 rounded-lg text-white text-xs font-medium shrink-0 transition-all hover:shadow-md hover:scale-[1.02]"
                            style={{
                              background: "linear-gradient(135deg, #3B82F6, #8B5CF6)",
                              boxShadow: "0 2px 8px rgba(59, 130, 246, 0.3)",
                            }}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            {t("teacherViewSubmissions")}
                          </Link>
                        </div>

                        <div className="flex items-center gap-2 mt-3 pt-3" style={{ borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)"}` }}>
                          {editingDeadlineId === a.id ? (
                            <div className="flex items-center gap-2 flex-1">
                              <input
                                type="datetime-local"
                                value={editingDeadline}
                                onChange={(e) => setEditingDeadline(e.target.value)}
                                min={new Date().toISOString().slice(0, 16)}
                                className="flex-1 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/40"
                                style={inputStyle}
                              />
                              <button
                                type="button"
                                onClick={() => updateDeadlineMutation.mutate({ assignmentId: a.id, deadline: editingDeadline || null })}
                                disabled={updateDeadlineMutation.isPending}
                                className="px-3 py-1.5 text-xs font-medium text-white rounded-lg disabled:opacity-50 transition-all"
                                style={{ background: "linear-gradient(135deg, #10B981, #06B6D4)" }}
                              >
                                {t("save")}
                              </button>
                              <button
                                type="button"
                                onClick={() => { setEditingDeadlineId(null); setEditingDeadline(""); }}
                                className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
                                style={{ background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)", color: textColors.secondary }}
                              >
                                {t("cancel")}
                              </button>
                            </div>
                          ) : (
                            <>
                              <Calendar className="w-3.5 h-3.5" style={{ color: textColors.secondary }} />
                              <span
                                className="text-xs font-medium px-2 py-0.5 rounded-md"
                                style={{
                                  background: !deadlineDate
                                    ? (isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)")
                                    : isOverdue
                                      ? (isDark ? "rgba(239, 68, 68, 0.15)" : "rgba(239, 68, 68, 0.1)")
                                      : isSoon
                                        ? (isDark ? "rgba(245, 158, 11, 0.15)" : "rgba(245, 158, 11, 0.1)")
                                        : (isDark ? "rgba(16, 185, 129, 0.15)" : "rgba(16, 185, 129, 0.1)"),
                                  color: !deadlineDate
                                    ? textColors.secondary
                                    : isOverdue
                                      ? (isDark ? "#F87171" : "#DC2626")
                                      : isSoon
                                        ? (isDark ? "#FBBF24" : "#D97706")
                                        : (isDark ? "#34D399" : "#059669"),
                                }}
                              >
                                {a.deadline
                                  ? new Date(a.deadline).toLocaleString("ru-RU", {
                                      day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                                    })
                                  : t("teacherNoDeadline")}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingDeadlineId(a.id);
                                  setEditingDeadline(a.deadline ? new Date(a.deadline).toISOString().slice(0, 16) : "");
                                }}
                                className="ml-auto text-xs font-medium transition-colors"
                                style={{ color: isDark ? "#60A5FA" : "#3B82F6" }}
                              >
                                {a.deadline ? t("edit") : t("addDeadline")}
                              </button>
                            </>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </BlurFade>
        </div>
      )}

      {/* ========== MODALS ========== */}

      {/* Question Modal */}
      {createModalType === "question" && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200" onClick={() => setCreateModalType(null)}>
          <div className="rounded-2xl shadow-2xl p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto animate-slide-up" style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-blue-500 to-cyan-500 text-white">
                  <MessageCircle className="w-4 h-4" />
                </div>
                <h3 className="font-semibold font-geologica" style={{ color: textColors.primary }}>{t("teacherCreateQuestion")}</h3>
              </div>
              <button type="button" onClick={() => setCreateModalType(null)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
                <X className="w-5 h-5" style={{ color: textColors.secondary }} />
              </button>
            </div>
            <div className="space-y-3">
              <select
                value={newQuestion.group_id}
                onChange={(e) => {
                  const g = groups.find((x) => x.id === Number(e.target.value));
                  setNewQuestion((prev) => ({ ...prev, group_id: Number(e.target.value) || ("" as number | ""), course_id: g ? g.course_id : ("" as number | "") }));
                }}
                className={`w-full ${selectClasses}`}
                style={inputStyle}
              >
                <option value="">{t("teacherGroups")}</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.group_name} — {getLocalizedCourseTitle({ title: g.course_title } as any, t)}</option>
                ))}
              </select>
              <textarea
                placeholder={t("teacherQuestionText")}
                value={newQuestion.question_text}
                onChange={(e) => setNewQuestion((prev) => ({ ...prev, question_text: e.target.value }))}
                className={`${inputClasses} resize-none`}
                style={inputStyle}
                rows={3}
              />
              <select
                value={newQuestion.question_type}
                onChange={(e) => setNewQuestion((prev) => ({ ...prev, question_type: e.target.value as "single_choice" | "open" }))}
                className={`w-full ${selectClasses}`}
                style={inputStyle}
              >
                <option value="single_choice">{t("teacherQuestionTypeSingle")}</option>
                <option value="open">{t("teacherQuestionTypeOpen")}</option>
              </select>
              {newQuestion.question_type === "single_choice" && (
                <div className="space-y-2">
                  {newQuestion.options.map((opt, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        type="text"
                        placeholder={`${t("teacherOptionA")} / B / C...`}
                        value={opt}
                        onChange={(e) => setNewQuestion((prev) => ({ ...prev, options: prev.options.map((o, j) => (j === i ? e.target.value : o)) }))}
                        className={`flex-1 ${inputClasses}`}
                        style={inputStyle}
                      />
                      <button type="button" onClick={() => setNewQuestion((prev) => ({ ...prev, options: prev.options.filter((_, j) => j !== i) }))} className="text-red-400 hover:text-red-500 p-2">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setNewQuestion((prev) => ({ ...prev, options: [...prev.options, ""] }))}
                    className="flex items-center gap-1.5 text-sm font-medium"
                    style={{ color: isDark ? "#60A5FA" : "#3B82F6" }}
                  >
                    <Plus className="w-4 h-4" /> {t("teacherAddOption")}
                  </button>
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-5">
              <button
                type="button"
                onClick={handleCreateQuestion}
                disabled={createQuestionMutation.isPending || !newQuestion.question_text || !newQuestion.group_id}
                className="py-2.5 px-6 rounded-xl text-white font-medium text-sm disabled:opacity-40 transition-all hover:shadow-lg"
                style={{ background: "linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)" }}
              >
                {t("save")}
              </button>
              <button
                type="button"
                onClick={() => setCreateModalType(null)}
                className="py-2.5 px-6 rounded-xl text-sm font-medium transition-colors"
                style={{ background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)", color: textColors.secondary }}
              >
                {t("cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Material Modal */}
      {createModalType === "material" && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200" onClick={() => setCreateModalType(null)}>
          <div className="rounded-2xl shadow-2xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto animate-slide-up" style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-emerald-500 to-teal-500 text-white">
                  <BookOpen className="w-4 h-4" />
                </div>
                <h3 className="font-semibold font-geologica" style={{ color: textColors.primary }}>{t("teacherCreateMaterial")}</h3>
              </div>
              <button type="button" onClick={() => setCreateModalType(null)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
                <X className="w-5 h-5" style={{ color: textColors.secondary }} />
              </button>
            </div>
            <div className="space-y-3">
              <select
                value={newMaterial.group_id}
                onChange={(e) => {
                  const g = groups.find((x) => x.id === Number(e.target.value));
                  setNewMaterial((prev) => ({ ...prev, group_id: Number(e.target.value) || ("" as number | ""), course_id: g ? g.course_id : ("" as number | ""), topic_id: null }));
                }}
                className={`w-full ${selectClasses}`}
                style={inputStyle}
              >
                <option value="">{t("teacherGroups")}</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.group_name} — {getLocalizedCourseTitle({ title: g.course_title } as any, t)}</option>
                ))}
              </select>
              {newMaterial.course_id && (
                <select
                  value={newMaterial.topic_id || ""}
                  onChange={(e) => setNewMaterial((prev) => ({ ...prev, topic_id: e.target.value ? Number(e.target.value) : null }))}
                  className={`w-full ${selectClasses}`}
                  style={inputStyle}
                >
                  <option value="">— {t("teacherTopic")} {t("teacherOptional")} —</option>
                  {courseTopics.map((tpc) => (
                    <option key={tpc.id} value={tpc.id}>{tpc.title}</option>
                  ))}
                </select>
              )}
              <input
                type="text"
                placeholder={t("teacherAssignmentTitle")}
                value={newMaterial.title}
                onChange={(e) => setNewMaterial((prev) => ({ ...prev, title: e.target.value }))}
                className={inputClasses}
                style={inputStyle}
              />
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: textColors.secondary }}>{t("teacherAssignmentDesc")}</label>
                <RichTextEditor value={newMaterial.description} onChange={(html) => setNewMaterial((prev) => ({ ...prev, description: html }))} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: textColors.secondary }}>{t("teacherVideo")}</label>
                <div className="flex gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="file" accept="video/*,.mp4,.webm" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const formData = new FormData();
                      formData.append("file", file);
                      const { data } = await api.post<{ url: string }>("/teacher/assignments/upload", formData, { headers: { "Content-Type": "multipart/form-data" } });
                      setNewMaterial((prev) => ({ ...prev, video_urls: [...prev.video_urls, data.url] }));
                      e.target.value = "";
                    }} className="hidden" />
                    <Paperclip className="w-4 h-4" style={{ color: textColors.secondary }} />
                    <span className="text-sm font-medium" style={{ color: isDark ? "#60A5FA" : "#3B82F6" }}>{t("teacherVideoUpload")}</span>
                  </label>
                  <input
                    type="url"
                    placeholder={t("teacherVideoLink")}
                    value={materialVideoLinkInput}
                    onChange={(e) => setMaterialVideoLinkInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (materialVideoLinkInput.trim()) {
                          setNewMaterial((prev) => ({ ...prev, video_urls: [...prev.video_urls, materialVideoLinkInput.trim()] }));
                          setMaterialVideoLinkInput("");
                        }
                      }
                    }}
                    className={`flex-1 ${inputClasses}`}
                    style={inputStyle}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (materialVideoLinkInput.trim()) {
                        setNewMaterial((prev) => ({ ...prev, video_urls: [...prev.video_urls, materialVideoLinkInput.trim()] }));
                        setMaterialVideoLinkInput("");
                      }
                    }}
                    className="py-2.5 px-3.5 rounded-xl transition-colors"
                    style={{ background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)", color: textColors.secondary }}
                  >
                    <LinkIcon className="w-4 h-4" />
                  </button>
                </div>
                {newMaterial.video_urls.length > 0 && (
                  <ul className="space-y-1 mt-2">
                    {newMaterial.video_urls.map((u, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <a href={u} target="_blank" rel="noopener noreferrer" className="truncate hover:underline" style={{ color: isDark ? "#60A5FA" : "#3B82F6" }}>{u.startsWith("/") ? u.split("/").pop() : u}</a>
                        <button type="button" onClick={() => setNewMaterial((prev) => ({ ...prev, video_urls: prev.video_urls.filter((_, j) => j !== i) }))} className="text-red-400 hover:text-red-500 shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                type="button"
                onClick={handleCreateMaterial}
                disabled={createMaterialMutation.isPending || !newMaterial.title || !newMaterial.group_id}
                className="py-2.5 px-6 rounded-xl text-white font-medium text-sm disabled:opacity-40 transition-all hover:shadow-lg"
                style={{ background: "linear-gradient(135deg, #10B981 0%, #06B6D4 100%)" }}
              >
                {t("save")}
              </button>
              <button
                type="button"
                onClick={() => setCreateModalType(null)}
                className="py-2.5 px-6 rounded-xl text-sm font-medium transition-colors"
                style={{ background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)", color: textColors.secondary }}
              >
                {t("cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Topic Modal */}
      {createModalType === "topic" && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200" onClick={() => setCreateModalType(null)}>
          <div className="rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4 animate-slide-up" style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-amber-500 to-orange-500 text-white">
                  <List className="w-4 h-4" />
                </div>
                <h3 className="font-semibold font-geologica" style={{ color: textColors.primary }}>{t("teacherCreateTopic")}</h3>
              </div>
              <button type="button" onClick={() => setCreateModalType(null)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
                <X className="w-5 h-5" style={{ color: textColors.secondary }} />
              </button>
            </div>
            <div className="space-y-3">
              <select
                value={newTopic.course_id}
                onChange={(e) => setNewTopic((prev) => ({ ...prev, course_id: Number(e.target.value) || ("" as number | "") }))}
                className={`w-full ${selectClasses}`}
                style={inputStyle}
              >
                <option value="">{t("course")}</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder={t("teacherAssignmentTitle")}
                value={newTopic.title}
                onChange={(e) => setNewTopic((prev) => ({ ...prev, title: e.target.value }))}
                className={inputClasses}
                style={inputStyle}
              />
              <textarea
                placeholder={t("teacherAssignmentDesc")}
                value={newTopic.description}
                onChange={(e) => setNewTopic((prev) => ({ ...prev, description: e.target.value }))}
                className={`${inputClasses} resize-none`}
                style={inputStyle}
                rows={2}
              />
            </div>
            <div className="flex gap-2 mt-5">
              <button
                type="button"
                onClick={handleCreateTopic}
                disabled={createTopicMutation.isPending || !newTopic.title || !newTopic.course_id}
                className="py-2.5 px-6 rounded-xl text-white font-medium text-sm disabled:opacity-40 transition-all hover:shadow-lg"
                style={{ background: "linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)" }}
              >
                {t("save")}
              </button>
              <button
                type="button"
                onClick={() => setCreateModalType(null)}
                className="py-2.5 px-6 rounded-xl text-sm font-medium transition-colors"
                style={{ background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)", color: textColors.secondary }}
              >
                {t("cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reuse Modal */}
      {createModalType === "reuse" && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200" onClick={() => setCreateModalType(null)}>
          <div className="rounded-2xl shadow-2xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto animate-slide-up" style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white">
                  <Copy className="w-4 h-4" />
                </div>
                <h3 className="font-semibold font-geologica" style={{ color: textColors.primary }}>{t("teacherCreateReuse")}</h3>
              </div>
              <button type="button" onClick={() => setCreateModalType(null)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
                <X className="w-5 h-5" style={{ color: textColors.secondary }} />
              </button>
            </div>
            <p className="text-sm mb-5" style={{ color: textColors.secondary }}>{t("teacherSelectAssignmentOrMaterial")}</p>
            <div className="space-y-5">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: textColors.secondary }}>{t("teacherAssignments")}</h4>
                {assignments.length === 0 ? (
                  <p className="text-sm" style={{ color: textColors.secondary }}>{t("teacherNoAssignments")}</p>
                ) : (
                  <ul className="space-y-1">
                    {assignments.map((a) => (
                      <li key={a.id}>
                        <button
                          type="button"
                          onClick={async () => {
                            const { data } = await api.get<{ group_id: number; course_id: number; topic_id: number; title: string; description: string; video_urls: string[]; attachment_urls: string[]; attachment_links: string[]; rubric: { name: string; max_points: number }[] }>(`/teacher/assignments/${a.id}/clone`);
                            setNewAssignment({
                              group_id: data.group_id, course_id: data.course_id, topic_id: data.topic_id,
                              title: data.title + ` ${t("teacherCopy")}`, description: data.description || "", deadline: "", max_points: 100,
                              attachment_urls: data.attachment_urls || [], attachment_links: data.attachment_links || [],
                              video_urls: data.video_urls || [], rubric: data.rubric || [], test_questions: [],
                            });
                            setActiveTab("assignments");
                            setCreateModalType("assignment");
                          }}
                          className="w-full text-left p-3 rounded-xl text-sm transition-all hover:bg-black/[0.03] dark:hover:bg-white/[0.05]"
                          style={{ color: textColors.primary }}
                        >
                          <span className="font-medium">{a.title}</span>
                          <span className="text-xs ml-2" style={{ color: textColors.secondary }}>— {a.group_name}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div style={{ borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`, paddingTop: "1.25rem" }}>
                <h4 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: textColors.secondary }}>{t("teacherCreateMaterial")}</h4>
                {materials.length === 0 ? (
                  <p className="text-sm" style={{ color: textColors.secondary }}>{t("teacherNoMaterials")}</p>
                ) : (
                  <ul className="space-y-1">
                    {materials.map((m) => (
                      <li key={m.id}>
                        <button
                          type="button"
                          onClick={async () => {
                            const { data } = await api.get<{ group_id: number; course_id: number; topic_id: number | null; title: string; description: string; video_urls: string[]; image_urls: string[] }>(`/teacher/materials/${m.id}/clone`);
                            setNewMaterial({
                              group_id: data.group_id, course_id: data.course_id, topic_id: data.topic_id,
                              title: data.title + ` ${t("teacherCopy")}`, description: data.description || "",
                              video_urls: data.video_urls || [], image_urls: data.image_urls || [],
                            });
                            setCreateModalType("material");
                          }}
                          className="w-full text-left p-3 rounded-xl text-sm transition-all hover:bg-black/[0.03] dark:hover:bg-white/[0.05]"
                          style={{ color: textColors.primary }}
                        >
                          <span className="font-medium">{m.title}</span>
                          <span className="text-xs ml-2" style={{ color: textColors.secondary }}>— {m.group_name}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setCreateModalType(null)}
              className="mt-5 w-full py-2.5 rounded-xl text-sm font-medium transition-colors"
              style={{ background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)", color: textColors.secondary }}
            >
              {t("close")}
            </button>
          </div>
        </div>
      )}

      {/* Add Student Modal */}
      {addStudentGroupId && addStudentGroup && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200" onClick={() => setAddStudentGroupId(null)}>
          <div className="rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto animate-slide-up" style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-emerald-500 to-teal-500 text-white">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold font-geologica" style={{ color: textColors.primary }}>{t("teacherAddStudent")}</h3>
                  <p className="text-xs" style={{ color: textColors.secondary }}>{addStudentGroup.group_name}</p>
                </div>
              </div>
              <button type="button" onClick={() => setAddStudentGroupId(null)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
                <X className="w-5 h-5" style={{ color: textColors.secondary }} />
              </button>
            </div>
            {studentsWithoutGroup.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3" style={{ background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)" }}>
                  <Users className="w-6 h-6" style={{ color: textColors.secondary }} />
                </div>
                <p className="text-sm" style={{ color: textColors.secondary }}>{t("teacherNoStudentsWithoutGroup")}</p>
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
                        <p className="text-xs truncate" style={{ color: textColors.secondary }}>{s.email}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddStudent(s.id)}
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
              onClick={() => setAddStudentGroupId(null)}
              className="mt-5 w-full py-2.5 rounded-xl text-sm font-medium transition-colors"
              style={{ background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)", color: textColors.secondary }}
            >
              {t("close")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
