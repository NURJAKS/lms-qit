"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "@/store/notificationStore";
import { 
  ChevronLeft, Paperclip, CheckCircle, Clock, XCircle, Search, Save, 
  Download, FileText, Check, Users, ChevronRight, PanelLeftClose, 
  PanelLeftOpen, MoreVertical, ExternalLink,
  SortAsc
} from "lucide-react";
import { useState, useMemo, useEffect, Children, cloneElement, isValidElement } from "react";
import { MagicCard } from "@/components/ui/magic-card";
import { cn } from "@/lib/utils";
import { formatLocalizedDate } from "@/utils/dateUtils";
import { useTheme } from "@/context/ThemeContext";

// Custom UI Components to replace missing shadcn/ui
const Button = ({ className, variant = "primary", size = "md", children, asChild, ...props }: any) => {
  const baseStyles = "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50";
  const variants: any = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 shadow-sm",
    outline: "border border-gray-200 bg-transparent hover:bg-gray-100 dark:border-gray-800 dark:hover:bg-gray-800",
    ghost: "hover:bg-gray-100 dark:hover:bg-gray-800",
    link: "text-blue-600 underline-offset-4 hover:underline",
  };
  const sizes: any = {
    sm: "h-8 px-3 text-xs",
    md: "h-9 px-4 py-2",
    lg: "h-10 px-8",
    icon: "h-9 w-9",
  };

  const finalClassName = cn(baseStyles, variants[variant], sizes[size], className);

  if (asChild && isValidElement(children)) {
    return cloneElement(children as any, {
      ...props,
      className: cn(finalClassName, (children as any).props?.className),
    });
  }

  return (
    <button className={finalClassName} {...props}>
      {children}
    </button>
  );
};


const Checkbox = ({ checked, onCheckedChange, className, ...props }: any) => (
  <input
    type="checkbox"
    checked={checked}
    onChange={(e) => onCheckedChange(e.target.checked)}
    className={cn("h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600", className)}
    {...props}
  />
);

const DropdownMenu = ({ children }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="relative inline-block text-left" onBlur={() => setTimeout(() => setIsOpen(false), 200)}>
      {Children.map(children, (child) =>
        isValidElement(child) ? cloneElement(child, { isOpen, setIsOpen } as any) : child
      )}
    </div>
  );
};
const DropdownMenuTrigger = ({ children, setIsOpen }: any) =>
  isValidElement(children) ? cloneElement(children, { onClick: () => setIsOpen((prev: boolean) => !prev) } as any) : null;
const DropdownMenuContent = ({ children, isOpen, align = "end" }: any) => isOpen ? (
  <div className={cn(
    "absolute z-50 top-full mt-2 min-w-[8rem] overflow-hidden rounded-md border border-gray-200 bg-white p-1 shadow-md dark:border-gray-800 dark:bg-gray-900",
    align === "end" ? "right-0" : "left-0"
  )}>
    {children}
  </div>
) : null;
const DropdownMenuItem = ({ children, onClick, className }: any) => (
  <button onClick={onClick} className={cn("relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-gray-100 dark:hover:bg-gray-800", className)}>{children}</button>
);
const DropdownMenuLabel = ({ children, className }: any) => <div className={cn("px-2 py-1.5 text-sm font-semibold", className)}>{children}</div>;
const DropdownMenuSeparator = () => <div className="h-px bg-gray-200 dark:bg-gray-800 my-1" />;

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
  student_email?: string;
  submission_text: string | null;
  file_url: string | null;
  file_urls: string[];
  grade: number | null;
  teacher_comment: string | null;
  student_private_comment?: string | null;
  submitted_at: string | null;
  rubric_grades: RubricGrade[];
  status: "graded" | "pending" | "not_submitted";
};

type AssignmentDetails = {
  title: string;
  description: string;
  max_points: number;
  deadline: string | null;
  group_name: string;
};

export default function AssignmentDetailPage() {
  const { t, lang } = useLanguage();
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = Number(params.id);
  const queryClient = useQueryClient();
  const { theme, toggleTheme } = useTheme();

  /** Like Google Classroom /details: open instructions by default; use ?tab=submissions for grading. */
  const activeTab: "instructions" | "submissions" =
    searchParams.get("tab") === "submissions" ? "submissions" : "instructions";
  const studentIdParam = searchParams.get("studentId");
  const fileIndexParam = searchParams.get("fileIndex");
  const queryStudentId = studentIdParam != null ? Number(studentIdParam) : null;
  const queryFileIndex = fileIndexParam != null ? Number(fileIndexParam) : null;

  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "graded" | "not_submitted">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [sortBy, setSortBy] = useState<"name" | "status" | "date">("name");
  const [selectedSubmissions, setSelectedSubmissions] = useState<Set<number>>(new Set());
  
  const [grade, setGrade] = useState("");
  const [comment, setComment] = useState("");
  const [rubricGrades, setRubricGrades] = useState<Record<number, string>>({});
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [hasAppliedQuerySelection, setHasAppliedQuerySelection] = useState(false);
  const [hasAppliedQueryFile, setHasAppliedQueryFile] = useState(false);

  const { data, isPending, isError } = useQuery({
    queryKey: ["assignment-submissions", id],
    queryFn: async () => {
      const { data: res } = await api.get<{ submissions: Submission[]; rubric: RubricCriterion[]; assignment: AssignmentDetails }>(
        `/teacher/assignments/${id}/submissions`
      );
      return res;
    },
    enabled: !!id,
  });

  const submissions = data?.submissions ?? [];
  const rubric = data?.rubric ?? [];
  const assignment = data?.assignment;

  const sortedAndFilteredSubmissions = useMemo(() => {
    let result = [...submissions];
    
    if (filter !== "all") {
      result = result.filter((s) => s.status === filter);
    }
    
    if (searchQuery) {
      result = result.filter((s) => s.student_name.toLowerCase().includes(searchQuery.toLowerCase()));
    }

    result.sort((a, b) => {
      if (sortBy === "name") return a.student_name.localeCompare(b.student_name);
      if (sortBy === "status") return a.status.localeCompare(b.status);
      if (sortBy === "date") {
        const dateA = a.submitted_at ? new Date(a.submitted_at).getTime() : 0;
        const dateB = b.submitted_at ? new Date(b.submitted_at).getTime() : 0;
        return dateB - dateA;
      }
      return 0;
    });

    return result;
  }, [submissions, filter, searchQuery, sortBy]);

  const groupedSubmissions = useMemo(() => {
    const turnedIn = sortedAndFilteredSubmissions.filter(s => s.status !== 'not_submitted');
    const assigned = sortedAndFilteredSubmissions.filter(s => s.status === 'not_submitted');
    return { turnedIn, assigned };
  }, [sortedAndFilteredSubmissions]);

  // When a student is selected, update the form state
  const handleSelectStudent = (s: Submission) => {
    setSelectedStudentId(s.student_id);
    setGrade(s.grade !== null ? String(s.grade) : "");
    setComment(s.teacher_comment ?? "");
    setActiveFileIndex(0);
    const grades: Record<number, string> = {};
    if (rubric.length) {
      rubric.forEach((c) => {
        const rg = s.rubric_grades?.find((g) => g.criterion_id === c.id);
        grades[c.id] = rg != null ? String(rg.points) : "";
      });
    }
    setRubricGrades(grades);
  };

  const selectedSubmission = useMemo(() => {
    return submissions.find((s) => s.student_id === selectedStudentId);
  }, [submissions, selectedStudentId]);

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
    setGrade(selectedSubmission.grade !== null ? String(selectedSubmission.grade) : "");
    setComment(selectedSubmission.teacher_comment ?? "");
    const grades: Record<number, string> = {};
    if (rubric.length) {
      rubric.forEach((c) => {
        const rg = selectedSubmission.rubric_grades?.find((g) => g.criterion_id === c.id);
        grades[c.id] = rg != null ? String(rg.points) : "";
      });
    }
    setRubricGrades(grades);
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
      if (requestedIndex >= 0 && requestedIndex < files.length) {
        setActiveFileIndex(requestedIndex);
      } else {
        setActiveFileIndex(0);
      }
      setHasAppliedQueryFile(true);
      return;
    }
    setActiveFileIndex(0);
  }, [
    selectedSubmission,
    rubric,
    hasAppliedQueryFile,
    queryFileIndex,
    queryStudentId,
  ]);

  // Navigation logic
  const currentIndex = useMemo(() => {
    if (selectedStudentId === null) return -1;
    return sortedAndFilteredSubmissions.findIndex(s => s.student_id === selectedStudentId);
  }, [sortedAndFilteredSubmissions, selectedStudentId]);

  const handleNextStudent = () => {
    if (currentIndex < sortedAndFilteredSubmissions.length - 1) {
      handleSelectStudent(sortedAndFilteredSubmissions[currentIndex + 1]);
    }
  };

  const handlePrevStudent = () => {
    if (currentIndex > 0) {
      handleSelectStudent(sortedAndFilteredSubmissions[currentIndex - 1]);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      if (e.key === "ArrowDown" || e.key === "j") handleNextStudent();
      if (e.key === "ArrowUp" || e.key === "k") handlePrevStudent();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, sortedAndFilteredSubmissions]);

  const gradeMutation = useMutation({
    mutationFn: async ({
      subId,
      g,
      c,
      grades,
    }: {
      subId: number;
      g?: number;
      c: string;
      grades?: RubricGrade[];
    }) => {
      await api.put(`/teacher/submissions/${subId}`, {
        grade: g,
        teacher_comment: c,
        grades,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignment-submissions", id] });
      queryClient.invalidateQueries({ queryKey: ["teacher-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["teacher-submissions-inbox"] });
      setShowSavedToast(true);
      setTimeout(() => setShowSavedToast(false), 2500);
    },
    onError: (error) => {
      console.error("Failed to save grade:", error);
      toast.error(t("errorSavingGrade"));
    },
  });

  const handleGrade = () => {
    if (!selectedSubmission || !selectedSubmission.id) return;
    const hasRubric = rubric.length > 0;
    const grades: RubricGrade[] = hasRubric
      ? rubric.map((c) => ({
          criterion_id: c.id,
          points: parseFloat(rubricGrades[c.id] ?? "0") || 0,
        }))
      : [];
    const numericGrade = grade ? Number(grade) : undefined;
    if (hasRubric || numericGrade != null || comment.trim()) {
      gradeMutation.mutate({
        subId: selectedSubmission.id,
        g: numericGrade,
        c: comment,
        grades: hasRubric ? grades : undefined,
      });
    }
  };

  const toggleSubmissionSelection = (studentId: number) => {
    const newSelected = new Set(selectedSubmissions);
    if (newSelected.has(studentId)) {
      newSelected.delete(studentId);
    } else {
      newSelected.add(studentId);
    }
    setSelectedSubmissions(newSelected);
  };

  const toggleAllSubmissions = () => {
    if (selectedSubmissions.size === sortedAndFilteredSubmissions.length) {
      setSelectedSubmissions(new Set());
    } else {
      setSelectedSubmissions(new Set(sortedAndFilteredSubmissions.map(s => s.student_id)));
    }
  };

  const getStatusIcon = (status: Submission["status"]) => {
    switch (status) {
      case "graded": return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "pending": return <Clock className="w-4 h-4 text-amber-500" />;
      case "not_submitted": return <XCircle className="w-4 h-4 text-red-400" />;
    }
  };

  const getStatusLabel = (status: Submission["status"]) => {
    switch (status) {
      case "graded":
        return t("teacherSubmissionStatusGraded");
      case "pending":
        return t("teacherSubmissionStatusPending");
      case "not_submitted":
        return t("teacherSubmissionStatusNotSubmitted");
    }
  };

  if (isPending) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-10 h-10 border-2 border-[var(--qit-primary)] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (isError || !assignment) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4 text-red-600">
          <XCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold mb-2">{t("errorLoadingSubmissions")}</h2>
        <p className="text-gray-500 mb-6 max-w-md">
          {t("errorFetchingDataDetail")}
        </p>
        <div className="flex gap-4">
          <button
            onClick={() => router.push("/app/teacher?tab=assignments")}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200"
          >
            {t("back")}
          </button>
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ["assignment-submissions", id] })}
            className="px-4 py-2 bg-[var(--qit-primary)] text-white rounded-lg"
          >
            {t("retry")}
          </button>
        </div>
      </div>
    );
  }

  const allFiles = selectedSubmission ? [
    ...(selectedSubmission.file_url ? [selectedSubmission.file_url] : []),
    ...(selectedSubmission.file_urls ?? [])
  ] : [];

  const currentFile = allFiles[activeFileIndex];
  if (activeTab === "instructions") {
    return (
      <div className="flex min-h-[calc(100vh-12rem)] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        <div className="shrink-0 border-b border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 sm:px-6">
          <button
            onClick={() => router.push("/app/teacher?tab=assignments")}
            className="mb-2 inline-flex items-center gap-2 text-sm text-gray-500 transition-colors hover:text-[var(--qit-primary)] dark:text-gray-400 dark:hover:text-[#00b0ff]"
          >
            <ChevronLeft className="w-4 h-4" />
            {t("teacherBack")}
          </button>
          <h1 className="flex flex-col gap-2 text-lg font-bold text-gray-800 sm:flex-row sm:items-center sm:text-2xl dark:text-white">
            <span className="min-w-0 break-words">{assignment.title}</span>
            <span className="w-fit shrink-0 rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
              {assignment.group_name}
            </span>
          </h1>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
            {assignment.deadline && (
              <span className="min-w-0">
                {t("teacherDeadline")}: {formatLocalizedDate(assignment.deadline, lang as any, t, { includeTime: true })}
              </span>
            )}
            <span>
              {t("teacherScore")}: {t("teacherGradingScoreMaxLine").replace("{max}", String(assignment.max_points))}
            </span>
          </div>

          <div className="mt-4 flex w-full gap-1 rounded-2xl border border-gray-200 bg-gray-50/80 p-1 dark:border-gray-600 dark:bg-gray-900/50 sm:inline-flex sm:w-auto sm:rounded-full">
            <button
              type="button"
              onClick={() => router.push(`/app/teacher/view-answers/${id}?tab=instructions`)}
              className="min-h-[44px] flex-1 rounded-xl bg-[var(--qit-primary)] px-3 py-2 text-center text-sm font-medium text-white shadow-sm sm:min-h-0 sm:flex-initial sm:rounded-full sm:py-1.5"
            >
              {t("teacherViewAnswersInstructions")}
            </button>
            <button
              type="button"
              onClick={() => router.push(`/app/teacher/view-answers/${id}?tab=submissions`)}
              className="min-h-[44px] flex-1 rounded-xl bg-gray-100 px-3 py-2 text-center text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-600 sm:min-h-0 sm:flex-initial sm:rounded-full sm:bg-gray-200 sm:py-1.5 dark:sm:bg-gray-700"
            >
              <span className="line-clamp-2 text-balance sm:line-clamp-none">{t("teacherViewAnswersSubmissions")}</span>
            </button>
          </div>
        </div>

        <div className="flex-1 bg-gray-100 dark:bg-gray-900/80 overflow-y-auto w-full">
          <div className="p-6 max-w-4xl mx-auto">
            <MagicCard className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-500" />
                {t("teacherViewAnswersInstructions")}
              </h2>
              {assignment.description ? (
                <div
                  className="prose prose-sm dark:prose-invert max-w-none text-gray-800 dark:text-gray-100"
                  dangerouslySetInnerHTML={{ __html: assignment.description }}
                />
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t("teacherViewAnswersNoInstructions")}
                </p>
              )}
            </MagicCard>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-12rem)] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-950">
      {/* Top Bar - Google Classroom Style */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-2 flex items-center justify-between shrink-0 z-20 shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/app/teacher?tab=assignments")}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <div className="flex flex-col">
            <h1 className="text-base font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
              {assignment.title}
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 font-bold uppercase tracking-wider">
                {assignment.group_name}
              </span>
            </h1>
            {selectedSubmission && (
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                {selectedSubmission.student_name}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {selectedSubmission && (
            <>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 gap-1 text-xs font-semibold">
                    {assignment.max_points} {t("teacherScore")}
                    <ChevronRight className="w-3 h-3 rotate-90" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel className="text-xs">{t("teacherGradingMaxPointsMenu")}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {[10, 20, 50, 100].map((pts) => (
                    <DropdownMenuItem key={pts} onClick={() => setGrade(String(pts))} className="text-xs">
                      {t("teacherGradingPointsOption").replace("{n}", String(pts))}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
          
          <Button 
            onClick={handleGrade}
            disabled={gradeMutation.isPending || !selectedSubmission?.id}
            className={cn(
              "h-9 px-6 rounded-md font-bold transition-all",
              showSavedToast ? "bg-green-600 hover:bg-green-700" : "bg-green-600 hover:bg-green-700 text-white"
            )}
          >
            {showSavedToast ? <Check className="w-4 h-4 mr-2" /> : null}
            {showSavedToast ? t("teacherWorkChecked") : t("teacherGradingReturn")}
          </Button>


        </div>
      </div>

      <div className="flex flex-1 overflow-hidden flex-col lg:flex-row min-h-0">
        {/* Left Sidebar: Student List */}
        <div className={cn(
          "border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col shrink-0 h-full overflow-hidden transition-all duration-300",
          isSidebarOpen ? "w-72" : "w-0"
        )}>
          <div className="p-3 border-b border-gray-100 dark:border-gray-800 min-w-[288px]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Checkbox 
                  checked={selectedSubmissions.size === sortedAndFilteredSubmissions.length && sortedAndFilteredSubmissions.length > 0}
                  onCheckedChange={toggleAllSubmissions}
                />
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  {selectedSubmissions.size > 0
                    ? t("teacherGradingSelectedCount").replace("{count}", String(selectedSubmissions.size))
                    : t("teacherGradingStudents")}
                </span>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1">
                    <SortAsc className="w-3 h-3" />
                    {t("teacherGradingSort")}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem onClick={() => setSortBy("name")} className="text-xs">
                    {t("teacherGradingSortByName")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy("status")} className="text-xs">
                    {t("teacherGradingSortByStatus")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy("date")} className="text-xs">
                    {t("teacherGradingSortByDate")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder={t("teacherGradingSearchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto min-w-[288px]">
            {sortedAndFilteredSubmissions.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-500">{t("teacherNoSubmissions")}</div>
            ) : (
              <div className="pb-4">
                {groupedSubmissions.turnedIn.length > 0 && (
                  <div>
                    <div className="px-4 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50 dark:bg-gray-800/50">
                      {t("teacherGradingTurnedIn").replace("{count}", String(groupedSubmissions.turnedIn.length))}
                    </div>
                    {groupedSubmissions.turnedIn.map((s) => (
                      <div 
                        key={s.student_id}
                        className={cn(
                          "group flex items-center px-3 py-2 border-l-4 transition-all cursor-pointer",
                          selectedStudentId === s.student_id 
                            ? "bg-blue-50 dark:bg-blue-900/20 border-blue-600" 
                            : "border-transparent hover:bg-gray-50 dark:hover:bg-gray-800"
                        )}
                        onClick={() => handleSelectStudent(s)}
                      >
                        <Checkbox 
                          checked={selectedSubmissions.has(s.student_id)}
                          onCheckedChange={() => toggleSubmissionSelection(s.student_id)}
                          onClick={(e: any) => e.stopPropagation()}
                          className="mr-3"
                        />
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            "text-sm font-medium truncate",
                            selectedStudentId === s.student_id ? "text-blue-700 dark:text-blue-400" : "text-gray-700 dark:text-gray-300"
                          )}>
                            {s.student_name}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {getStatusIcon(s.status)}
                            <span className="text-[10px] text-gray-500 dark:text-gray-400">{getStatusLabel(s.status)}</span>
                          </div>
                        </div>
                        {s.grade != null && (
                          <span className="text-xs font-bold text-green-600 dark:text-green-400 ml-2">
                            {s.grade}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {groupedSubmissions.assigned.length > 0 && (
                  <div className="mt-2">
                    <div className="px-4 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50 dark:bg-gray-800/50">
                      {t("teacherGradingAssigned").replace("{count}", String(groupedSubmissions.assigned.length))}
                    </div>
                    {groupedSubmissions.assigned.map((s) => (
                      <div 
                        key={s.student_id}
                        className={cn(
                          "group flex items-center px-3 py-2 border-l-4 transition-all cursor-pointer",
                          selectedStudentId === s.student_id 
                            ? "bg-blue-50 dark:bg-blue-900/20 border-blue-600" 
                            : "border-transparent hover:bg-gray-50 dark:hover:bg-gray-800"
                        )}
                        onClick={() => handleSelectStudent(s)}
                      >
                        <Checkbox 
                          checked={selectedSubmissions.has(s.student_id)}
                          onCheckedChange={() => toggleSubmissionSelection(s.student_id)}
                          onClick={(e: any) => e.stopPropagation()}
                          className="mr-3"
                        />
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            "text-sm font-medium truncate",
                            selectedStudentId === s.student_id ? "text-blue-700 dark:text-blue-400" : "text-gray-700 dark:text-gray-300"
                          )}>
                            {s.student_name}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {getStatusIcon(s.status)}
                            <span className="text-[10px] text-gray-500 dark:text-gray-400">{getStatusLabel(s.status)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Main Content: File Preview */}
        <div className="flex-1 flex flex-col bg-gray-100 dark:bg-gray-950 overflow-hidden relative">
          {/* Sidebar Toggle Button (Floating) */}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white dark:bg-gray-800 border border-l-0 border-gray-200 dark:border-gray-700 p-1 rounded-r-md shadow-sm hover:bg-gray-50 transition-colors"
          >
            {isSidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
          </button>

          {selectedSubmission ? (
            <>
              {/* File Tabs & Navigation */}
              <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-1 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                  {allFiles.length > 0 ? (
                    allFiles.map((file, idx) => {
                      const filename = file.split("/").pop() || t("teacherGradingFileFallback").replace("{n}", String(idx + 1));
                      return (
                        <button
                          key={idx}
                          onClick={() => setActiveFileIndex(idx)}
                          className={cn(
                            "px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-2 whitespace-nowrap",
                            activeFileIndex === idx 
                              ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800" 
                              : "text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800"
                          )}
                        >
                          <FileText className="w-3.5 h-3.5" />
                          {filename}
                        </button>
                      );
                    })
                  ) : (
                    <div className="px-3 py-1.5 text-xs text-gray-400 italic">{t("teacherGradingNoFilesInTab")}</div>
                  )}
                </div>

                <div className="flex items-center gap-3 ml-4">
                  <div className="flex items-center gap-1 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                    <span>{currentIndex + 1}</span>
                    <span className="mx-0.5">/</span>
                    <span>{sortedAndFilteredSubmissions.length}</span>
                  </div>
                  <div className="flex gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 rounded-full" 
                      onClick={handlePrevStudent} 
                      disabled={currentIndex <= 0}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 rounded-full" 
                      onClick={handleNextStudent} 
                      disabled={currentIndex >= sortedAndFilteredSubmissions.length - 1}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Preview Area */}
              <div className="flex-1 overflow-auto p-4 flex flex-col items-center">
                <div className="w-full max-w-5xl bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col min-h-full">
                  {currentFile ? (
                    <>
                      <div className="bg-gray-50 dark:bg-gray-800/50 px-4 py-2 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-500 truncate pr-4">
                          {currentFile.split('/').pop()}
                        </span>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => window.open(currentFile, "_blank", "noopener,noreferrer")}>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                            <a href={currentFile} download>
                              <Download className="w-3.5 h-3.5" />
                            </a>
                          </Button>
                        </div>
                      </div>
                      <div className="flex-1 bg-gray-100 dark:bg-gray-950 flex items-center justify-center p-4">
                        {currentFile.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? (
                          <img src={currentFile} alt={t("teacherFilePreview")} className="max-w-full h-auto shadow-lg rounded-sm" />
                        ) : currentFile.match(/\.(pdf)$/i) ? (
                          <iframe src={`${currentFile}#toolbar=0`} className="w-full h-[800px] border-none" title={t("teacherFilePreview")} />
                        ) : (
                          <div className="text-center py-20">
                            <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                            <p className="text-sm text-gray-500 mb-4">{t("teacherGradingPreviewUnavailable")}</p>
                            <Button variant="outline" size="sm" asChild>
                              <a href={currentFile} target="_blank" rel="noopener noreferrer">
                                {t("teacherGradingOpenInNewWindow")}
                              </a>
                            </Button>
                          </div>
                        )}
                      </div>
                    </>
                  ) : selectedSubmission.submission_text ? (
                    <div className="p-8 prose dark:prose-invert max-w-none text-sm leading-relaxed whitespace-pre-wrap">
                      {selectedSubmission.submission_text}
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center py-20 text-gray-400">
                      <FileText className="w-12 h-12 mb-4 opacity-20" />
                      <p className="text-sm font-medium">{t("teacherGradingNoFilesPreview")}</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-900 rounded-full flex items-center justify-center mb-4">
                <Users className="w-8 h-8 opacity-20" />
              </div>
              <h3 className="text-lg font-bold text-gray-700 dark:text-gray-300 mb-1">{t("teacherPickStudent")}</h3>
              <p className="text-sm text-center max-w-xs">{t("teacherPickStudentDesc")}</p>
            </div>
          )}
        </div>

        {/* Right Sidebar: Grading & Comments */}
        <div className="w-full max-w-full lg:w-80 lg:max-w-[20rem] border-t lg:border-t-0 border-gray-200 dark:border-gray-800 lg:border-l bg-white dark:bg-gray-900 flex flex-col shrink-0 overflow-hidden min-h-0">
          {selectedSubmission ? (
            <div className="flex flex-col h-full overflow-y-auto">
              {/* Submission Info */}
              <div className="p-4 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">{t("teacherGradingFiles")}</h3>
                </div>
                <div className="space-y-2">
                  {allFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs p-2 bg-gray-50 dark:bg-gray-800 rounded border border-gray-100 dark:border-gray-700">
                      <span className="truncate font-medium text-gray-600 dark:text-gray-300 pr-2">{file.split('/').pop()}</span>
                      <span className="shrink-0 text-[10px] text-gray-400">
                        {selectedSubmission.submitted_at ? formatLocalizedDate(selectedSubmission.submitted_at, lang, t, { includeTime: true, shortMonth: true }) : ''}
                      </span>
                    </div>
                  ))}
                  {allFiles.length === 0 && (
                    <div className="text-[11px] text-gray-400 italic py-2">{t("teacherGradingNoFilesAttached")}</div>
                  )}
                </div>
              </div>

              {/* Grade Section */}
              <div className="p-4 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">{t("teacherGradingGrade")}</h3>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        <MoreVertical className="w-3 h-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem className="text-xs">{t("teacherGradingChangeMaxPoints")}</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {rubric.length > 0 ? (
                  <div className="space-y-4">
                    {rubric.map((c) => (
                      <div key={c.id} className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium text-gray-700 dark:text-gray-300">{c.name}</span>
                          <span className="text-gray-400">{t("teacherGradingRubricOutOf").replace("{max}", String(c.max_points))}</span>
                        </div>
                        <input
                          type="number"
                          min={0}
                          max={c.max_points}
                          step={0.5}
                          value={rubricGrades[c.id] ?? ""}
                          onChange={(e) => setRubricGrades((prev) => ({ ...prev, [c.id]: e.target.value }))}
                          className="w-full h-9 px-3 text-sm rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                      </div>
                    ))}
                    <div className="pt-2 flex justify-between items-center border-t border-gray-100 dark:border-gray-800">
                      <span className="text-xs font-bold text-gray-500">{t("teacherGradingTotal")}</span>
                      <span className="text-lg font-bold text-blue-600">
                        {rubric.reduce((sum, c) => sum + (parseFloat(rubricGrades[c.id] ?? "0") || 0), 0).toFixed(1)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max={assignment.max_points}
                      value={grade}
                      onChange={(e) => setGrade(e.target.value)}
                      className="w-20 h-10 text-center text-lg font-bold rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                    <span className="text-lg font-medium text-gray-400">/ {assignment.max_points}</span>
                  </div>
                )}
              </div>

              {/* Private Comments */}
              <div className="p-4 flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">{t("teacherGradingPrivateComments")}</h3>
                </div>
                <div className="flex-1 flex flex-col gap-3">
                  <textarea
                    placeholder={t("teacherGradingPrivateCommentPlaceholder")}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="w-full flex-1 p-3 text-xs rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:ring-1 focus:ring-blue-500 outline-none resize-none min-h-[100px]"
                  />
                  <Button 
                    onClick={handleGrade}
                    disabled={gradeMutation.isPending}
                    variant="ghost" 
                    className="h-8 text-xs font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                  >
                    {t("teacherGradingPublish")}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8 text-center">
              <p className="text-xs text-gray-400">{t("teacherGradingSelectStudentForGrade")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
