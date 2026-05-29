"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useLanguage } from "@/context/LanguageContext";
import { useAuthStore } from "@/store/authStore";
import { formatLocalizedDate } from "@/utils/dateUtils";
import { 
  ChevronLeft, CheckCircle, XCircle, Search, Users, 
  ChevronRight, PanelLeftClose, PanelLeftOpen, MessageCircle,
  Save, RotateCcw, Check, Send, AlertCircle
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { MagicCard } from "@/components/ui/magic-card";
import { QuestionClassCommentsSection } from "@/components/courses/QuestionClassCommentsSection";
import { cn } from "@/lib/utils";
import { toast, useNotificationStore } from "@/store/notificationStore";

type Answer = {
  id: number | null;
  student_id: number;
  student_name: string;
  answer_text: string | null;
  grade: number | null;
  teacher_comment: string | null;
  submitted_at: string | null;
  status: "submitted" | "not_submitted";
};

type QuestionDetails = {
  id: number;
  text: string;
  type: string;
  options: string[];
  correct_option: string | null;
  group_name: string;
  allow_student_class_comments?: boolean;
};

/** Backend may store `open` while options are present; 2+ options ⇒ single-choice UI. */
function isSingleChoiceQuestion(q: Pick<QuestionDetails, "type" | "options">): boolean {
  if (q.type === "single_choice") return true;
  return (q.options?.length ?? 0) >= 2;
}

export default function ViewQuestionsPage() {
  const { t, lang } = useLanguage();
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isTeacher } = useAuthStore();
  const id = Number(params.id);
  const queryClient = useQueryClient();
  const showConfirm = useNotificationStore((s) => s.showConfirm);

  const teacherMode = isTeacher();

  const activeTab: "instructions" | "answers" =
    searchParams.get("tab") === "answers" ? "answers" : "instructions";

  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [filter, setFilter] = useState<"all" | "submitted" | "not_submitted">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  const [grade, setGrade] = useState("");
  const [comment, setComment] = useState("");
  const [showSavedToast, setShowSavedToast] = useState(false);

  // Student-specific state
  const [studentAnswer, setStudentAnswer] = useState("");
  const [studentSelectedOption, setStudentSelectedOption] = useState<string | null>(null);
  const [teacherPreviewOption, setTeacherPreviewOption] = useState<string | null>(null);

  const { data, isPending, isError } = useQuery({
    queryKey: ["question-answers", id, teacherMode],
    queryFn: async () => {
      if (teacherMode) {
        const { data: res } = await api.get<{ answers: Answer[]; question: QuestionDetails }>(
          `/teacher/questions/${id}/answers`
        );
        return res;
      } else {
        const { data: res } = await api.get<{ answer: Answer | null; question: QuestionDetails }>(
          `/questions/${id}`
        );
        return {
          question: res.question,
          answers: res.answer ? [res.answer] : []
        };
      }
    },
    enabled: !!id,
    retry: 1,
  });

  const answers = data?.answers ?? [];
  const question = data?.question;

  useEffect(() => {
    setTeacherPreviewOption(null);
  }, [id]);

  const filteredAnswers = useMemo(() => {
    return answers.filter((a) => {
      if (filter !== "all" && a.status !== filter) return false;
      if (searchQuery && !a.student_name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [answers, filter, searchQuery]);

  const handleSelectStudent = (a: Answer) => {
    setSelectedStudentId(a.student_id);
    setGrade(a.grade !== null ? String(a.grade) : "");
    setComment(a.teacher_comment ?? "");
  };

  const selectedAnswer = useMemo(() => {
    return answers.find((a) => a.student_id === selectedStudentId);
  }, [answers, selectedStudentId]);

  // Navigation logic
  const currentIndex = useMemo(() => {
    if (selectedStudentId === null) return -1;
    return filteredAnswers.findIndex(a => a.student_id === selectedStudentId);
  }, [filteredAnswers, selectedStudentId]);

  const handleNextStudent = () => {
    if (currentIndex < filteredAnswers.length - 1) {
      handleSelectStudent(filteredAnswers[currentIndex + 1]);
    }
  };

  const handlePrevStudent = () => {
    if (currentIndex > 0) {
      handleSelectStudent(filteredAnswers[currentIndex - 1]);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowDown" || e.key === "j") handleNextStudent();
      if (e.key === "ArrowUp" || e.key === "k") handlePrevStudent();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, filteredAnswers]);

  const gradeMutation = useMutation({
    mutationFn: async ({
      ansId,
      g,
      c,
    }: {
      ansId: number;
      g: number;
      c: string;
    }) => {
      await api.put(`/teacher/questions/answers/${ansId}`, {
        grade: g,
        teacher_comment: c,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["question-answers", id] });
      setShowSavedToast(true);
      setTimeout(() => setShowSavedToast(false), 2500);
    },
    onError: (error) => {
      console.error("Failed to save grade:", error);
      toast.error(t("errorSavingGrade"));
    },
  });

  const returnMutation = useMutation({
    mutationFn: async (ansId: number) => {
      await api.post(`/teacher/questions/answers/${ansId}/return`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["question-answers", id] });
      setGrade("");
      setComment("");
    },
    onError: (error) => {
      console.error("Failed to return answer:", error);
      toast.error(t("errorReturningAnswer"));
    },
  });

  const submitAnswerMutation = useMutation({
    mutationFn: async () => {
      if (!question) return;
      const text = isSingleChoiceQuestion(question) ? studentSelectedOption : studentAnswer;
      if (!text) return;
      await api.post(`/questions/${id}/submit`, { answer_text: text });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["question-answers", id] });
    },
    onError: (error) => {
      console.error("Failed to submit answer:", error);
      toast.error(t("errorSubmittingAnswer"));
    }
  });

  const handleGrade = () => {
    if (!selectedAnswer || !selectedAnswer.id) return;
    const numericGrade = grade ? Number(grade) : undefined;
    if (numericGrade === undefined) {
      toast.error(t("teacherEnterGrade"));
      return;
    }
    gradeMutation.mutate({
      ansId: selectedAnswer.id,
      g: Math.max(0, Math.min(numericGrade, 100)),
      c: comment,
    });
  };

  const handleReturn = () => {
    if (!selectedAnswer || !selectedAnswer.id) return;
    showConfirm({
      title: t("returnLabel"),
      message: t("returnQuestionConfirm"),
      variant: "danger",
      onConfirm: () => returnMutation.mutate(selectedAnswer.id!),
    });
  };

  const currentStudentAnswer = !teacherMode ? answers[0] : selectedAnswer;

  useEffect(() => {
    if (!teacherMode && answers[0] && question) {
      if (isSingleChoiceQuestion(question)) {
        setStudentSelectedOption(answers[0].answer_text);
      } else {
        setStudentAnswer(answers[0].answer_text || "");
      }
    }
  }, [teacherMode, answers, question?.id, question?.type, question?.options?.length]);

  if (isPending) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-10 h-10 border-2 border-[var(--qit-primary)] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (isError || !question) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center text-gray-800 dark:text-gray-100">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4 text-red-600">
          <XCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold mb-2">{t("errorLoadingAnswers")}</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md">
          {t("errorFetchingDataDetail")}
        </p>
        <div className="flex gap-4">
          <button
            onClick={() => router.push("/app/teacher?tab=assignments")}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 transition-colors"
          >
            {t("back")}
          </button>
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ["question-answers", id] })}
            className="px-4 py-2 bg-[var(--qit-primary)] text-white rounded-lg hover:opacity-90 transition-opacity"
          >
            {t("retry")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex flex-col -mx-3 sm:-mx-4 md:-mx-6 pb-4 sm:pb-6 lg:pb-8 text-gray-800 dark:text-gray-100">
      {/* Header — avoid negative top margin so fixed mobile nav (h-16) does not clip "Back" */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 sm:px-6 flex items-center justify-between shrink-0 transition-colors lg:rounded-t-xl">
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 mb-2 text-sm text-gray-500 dark:text-gray-400 hover:text-[var(--qit-primary)] transition-colors pt-0.5"
          >
            <ChevronLeft className="w-4 h-4" />
            {teacherMode ? t("teacherBack") : t("back")}
          </button>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-3 truncate max-w-2xl">
            {question.text}
            {question.group_name && (
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                {question.group_name}
              </span>
            )}
          </h1>
          {teacherMode && (
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => router.push(`/app/teacher/view-questions/${id}?tab=instructions`)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  activeTab === "instructions"
                    ? "bg-[var(--qit-primary)] text-white shadow-sm"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                }`}
              >
                {t("assignmentTypeQuestion")}
              </button>
              <button
                type="button"
                onClick={() => router.push(`/app/teacher/view-questions/${id}?tab=answers`)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  activeTab === "answers"
                    ? "bg-[var(--qit-primary)] text-white shadow-sm"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                }`}
              >
                {t("studentAnswers")}
              </button>
            </div>
          )}
        </div>
      </div>

      {teacherMode ? (
        activeTab === "instructions" ? (
          <div className="flex-1 bg-gray-100 dark:bg-gray-950 overflow-y-auto">
            <div className="p-6 max-w-4xl mx-auto">
              <MagicCard className="p-8 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-3xl shadow-lg">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">{t("questionText")}</h2>
                <p className="text-xl mb-6 leading-relaxed">{question.text}</p>
                
                <div className="space-y-4">
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {t("questionTypeLabel")}:{" "}
                    <span className="font-medium">
                      {isSingleChoiceQuestion(question) ? t("questionSingleChoice") : t("questionOpenAnswer")}
                    </span>
                  </p>

                  {isSingleChoiceQuestion(question) && question.options?.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                        {t("questionOptionsLabel")}
                      </h3>
                      <div className="grid gap-2">
                        {question.options.map((opt, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setTeacherPreviewOption(opt)}
                            className={`w-full text-left p-4 rounded-xl border transition-colors ${
                              teacherPreviewOption === opt
                                ? "border-[var(--qit-primary)] bg-[var(--qit-primary)]/5"
                                : question.correct_option === opt
                                  ? "border-green-500 bg-green-50 dark:bg-green-900/10"
                                  : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className={`w-4 h-4 rounded-full border shrink-0 flex items-center justify-center ${
                                  teacherPreviewOption === opt
                                    ? "border-[var(--qit-primary)]"
                                    : question.correct_option === opt
                                      ? "border-green-500 bg-green-500"
                                      : "border-gray-300"
                                }`}
                              >
                                {teacherPreviewOption === opt ? (
                                  <div className="w-2 h-2 rounded-full bg-[var(--qit-primary)]" />
                                ) : null}
                              </div>
                              <span className="flex-1 min-w-0 break-words">{opt}</span>
                              {question.correct_option === opt && (
                                <span className="text-xs font-medium text-green-600 shrink-0">{t("correctLabel")}</span>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </MagicCard>
              <MagicCard className="mt-6 p-6 sm:p-8 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-3xl shadow-lg">
                <QuestionClassCommentsSection questionId={id} canPost />
              </MagicCard>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 overflow-hidden">
            {/* Sidebar */}
            <div className={`border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex flex-col shrink-0 h-full overflow-hidden transition-all duration-300 ${isSidebarOpen ? "w-80" : "w-0"}`}>
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 min-w-[320px]">
                <div className="relative mb-3">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder={t("searchPlaceholder")}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-[var(--qit-primary)] outline-none"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(["all", "submitted", "not_submitted"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${
                        filter === f
                          ? "bg-[var(--qit-primary)] text-white"
                          : "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                      }`}
                    >
                      {f === "all" ? t("filterAll") : (f === "submitted" ? t("filterSubmitted") : t("filterNotSubmitted"))}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredAnswers.map((a) => (
                    <li key={a.student_id}>
                      <button
                        onClick={() => handleSelectStudent(a)}
                        className={`w-full text-left p-4 hover:bg-white dark:hover:bg-gray-800 transition-colors flex items-center justify-between ${
                          selectedStudentId === a.student_id ? "bg-blue-50 dark:bg-blue-900/20 shadow-inner border-l-4 border-[var(--qit-primary)]" : "border-l-4 border-transparent"
                        }`}
                      >
                        <div className="min-w-0 pr-3">
                          <p className="font-medium truncate">{a.student_name}</p>
                          <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5">
                            {a.status === "submitted" ? <CheckCircle className="w-3 h-3 text-green-500" /> : <XCircle className="w-3 h-3 text-red-400" />}
                            {a.status === "submitted" ? t("submittedStatus") : t("teacherSubmissionStatusNotSubmitted")}
                          </p>
                        </div>
                        {a.grade !== null && (
                          <div className="text-sm font-bold text-green-600">
                            {a.grade}
                          </div>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 bg-gray-100 dark:bg-gray-950 overflow-y-auto relative">
              <div className="sticky top-0 z-10 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700 p-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    {isSidebarOpen ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeftOpen className="w-5 h-5" />}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 font-medium">
                    {currentIndex + 1} / {filteredAnswers.length}
                  </span>
                  <div className="flex border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                    <button
                      onClick={handlePrevStudent}
                      disabled={currentIndex <= 0}
                      className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30 transition-colors border-r border-gray-200 dark:border-gray-700"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      onClick={handleNextStudent}
                      disabled={currentIndex >= filteredAnswers.length - 1}
                      className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30 transition-colors"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-6 max-w-5xl mx-auto">
                {selectedAnswer ? (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Answer Detail */}
                    <div className="lg:col-span-2">
                      <MagicCard className="p-8 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-3xl shadow-lg">
                        <div className="flex items-center gap-4 mb-8">
                          <div className="w-12 h-12 rounded-full bg-[var(--qit-primary)]/10 flex items-center justify-center text-[var(--qit-primary)] font-bold text-xl">
                            {selectedAnswer.student_name[0]}
                          </div>
                          <div>
                            <h2 className="text-2xl font-bold">{selectedAnswer.student_name}</h2>
                            <p className="text-sm text-gray-500">{selectedAnswer.submitted_at ? formatLocalizedDate(selectedAnswer.submitted_at, lang as any, t, { includeTime: true }) : t("teacherSubmissionStatusNotSubmitted")}</p>
                          </div>
                        </div>

                        <div className="space-y-6">
                          <div>
                            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">{t("studentAnswerLabel")}</h3>
                            {selectedAnswer.status === "submitted" ? (
                              <div className="space-y-6">
                                <div className="p-6 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl text-lg leading-relaxed shadow-inner font-geologica">
                                  {selectedAnswer.answer_text}
                                </div>

                                {isSingleChoiceQuestion(question) && (
                                  <div>
                                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">{t("questionOptionsLabel")}</h3>
                                    <div className="grid gap-2">
                                      {question.options.map((opt, i) => {
                                        const isSelected = selectedAnswer.answer_text === opt;
                                        const isCorrect = question.correct_option === opt;
                                        return (
                                          <div 
                                            key={i} 
                                            className={`p-4 rounded-xl border flex items-center gap-3 ${
                                              isSelected 
                                                ? "border-[var(--qit-primary)] bg-[var(--qit-primary)]/5" 
                                                : "border-gray-200 dark:border-gray-700"
                                            }`}
                                          >
                                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isSelected ? "border-[var(--qit-primary)]" : "border-gray-300"}`}>
                                              {isSelected && <div className="w-2 h-2 rounded-full bg-[var(--qit-primary)]" />}
                                            </div>
                                            <span>{opt}</span>
                                            {isCorrect && <Check className="w-4 h-4 text-green-500 ml-auto" />}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="p-12 text-center border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-3xl text-gray-400">
                                <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                <p>{t("noAnswerProvided")}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </MagicCard>
                    </div>

                    {/* Grading Panel */}
                    <div className="lg:col-span-1">
                      <MagicCard className="p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-3xl shadow-lg sticky top-6">
                        <h3 className="text-lg font-semibold mb-4">{t("gradeLabel")}</h3>
                        
                        {selectedAnswer.status === "not_submitted" ? (
                          <p className="text-sm text-gray-500 text-center py-4">{t("studentNotSubmittedYet")}</p>
                        ) : (
                          <div className="space-y-4">
                            <div>
                              <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">{t("pointsRangeLabel")}</label>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={grade}
                                onChange={(e) => setGrade(e.target.value)}
                                className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-[var(--qit-primary)] outline-none"
                                placeholder="0"
                              />
                            </div>

                            <div>
                              <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">{t("commentLabel")}</label>
                              <textarea
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-[var(--qit-primary)] outline-none resize-none font-geologica"
                                rows={4}
                                placeholder={t("feedbackPlaceholder")}
                              />
                            </div>

                            <button
                              onClick={handleGrade}
                              disabled={gradeMutation.isPending}
                              className={`w-full py-3 rounded-xl font-bold text-white transition-all flex items-center justify-center gap-2 ${
                                showSavedToast ? "bg-green-500" : "bg-[var(--qit-primary)] hover:opacity-90"
                              }`}
                            >
                              {gradeMutation.isPending ? (
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              ) : showSavedToast ? (
                                <><Check className="w-5 h-5" /> {t("savedLabel")}</>
                              ) : (
                                <><Save className="w-5 h-5" /> {t("teacherSave")}</>
                              )}
                            </button>

                            <button
                              onClick={handleReturn}
                              disabled={returnMutation.isPending}
                              className="w-full py-3 rounded-xl font-bold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all flex items-center justify-center gap-2"
                            >
                              {returnMutation.isPending ? (
                                <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <><RotateCcw className="w-5 h-5" /> {t("returnLabel")}</>
                              )}
                            </button>
                          </div>
                        )}
                      </MagicCard>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                    <Users className="w-20 h-20 mb-6 opacity-10" />
                    <p className="text-xl font-medium">{t("selectStudentToSeeAnswer")}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      ) : (
        /* Student Answering UI */
        <div className="flex-1 bg-gray-50 dark:bg-gray-950 overflow-y-auto">
          <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6">
            <MagicCard className="p-8 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-3xl shadow-lg">
              <div className="mb-6">
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-bold uppercase tracking-wider mb-3">
                  <MessageCircle className="w-3 h-3" />
                  {t("assignmentTypeQuestion")}
                </span>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white leading-tight">
                  {question.text}
                </h2>
              </div>

              <div className="space-y-6">
                {isSingleChoiceQuestion(question) ? (
                  <div className="grid gap-3">
                    {question.options.map((opt, i) => {
                      const isSelected = studentSelectedOption === opt;
                      const isCorrect = currentStudentAnswer?.grade !== null && question.correct_option === opt;
                      const isYourIncorrect = currentStudentAnswer?.grade !== null && isSelected && !isCorrect;

                      return (
                        <button
                          key={i}
                          disabled={currentStudentAnswer?.status === "submitted" || submitAnswerMutation.isPending}
                          onClick={() => setStudentSelectedOption(opt)}
                          className={cn(
                            "w-full text-left p-4 rounded-xl border-2 transition-all flex items-center gap-4",
                            isSelected
                              ? "border-[var(--qit-primary)] bg-[var(--qit-primary)]/5"
                              : "border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600",
                            isCorrect && "border-green-500 bg-green-50 dark:bg-green-900/10",
                            isYourIncorrect && "border-red-500 bg-red-50 dark:bg-red-900/10"
                          )}
                        >
                          <div className={cn(
                            "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
                            isSelected ? "border-[var(--qit-primary)]" : "border-gray-300"
                          )}>
                            {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-[var(--qit-primary)]" />}
                          </div>
                          <span className="flex-1 font-medium">{opt}</span>
                          {isCorrect && <Check className="w-5 h-5 text-green-500" />}
                          {isYourIncorrect && <XCircle className="w-5 h-5 text-red-500" />}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                      {t("studentYourAnswer")}
                    </label>
                    <textarea
                      disabled={currentStudentAnswer?.status === "submitted" || submitAnswerMutation.isPending}
                      value={studentAnswer}
                      onChange={(e) => setStudentAnswer(e.target.value)}
                      rows={6}
                      placeholder={t("studentAnswerPlaceholder")}
                      className="w-full p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl outline-none focus:ring-2 focus:ring-[var(--qit-primary)] transition-all resize-none font-geologica"
                    />
                  </div>
                )}

                {currentStudentAnswer?.status !== "submitted" ? (
                  <button
                    onClick={() => submitAnswerMutation.mutate()}
                    disabled={
                      submitAnswerMutation.isPending ||
                      (isSingleChoiceQuestion(question) ? !studentSelectedOption : !studentAnswer.trim())
                    }
                    className="w-full py-4 rounded-2xl bg-gradient-to-br from-[var(--qit-primary)] to-blue-600 text-white font-bold shadow-xl shadow-[var(--qit-primary)]/20 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2"
                  >
                    {submitAnswerMutation.isPending ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        {t("submitAnswer")}
                      </>
                    )}
                  </button>
                ) : (
                  <div className="p-6 rounded-2xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center shrink-0 text-white">
                      <CheckCircle className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-blue-900 dark:text-blue-100">
                        {t("answerSubmittedTitle")}
                      </h4>
                      <p className="text-sm text-blue-700/80 dark:text-blue-300/80 mt-1">
                        {t("answerSubmittedPendingReview")}
                      </p>
                    </div>
                  </div>
                )}

                {currentStudentAnswer != null && currentStudentAnswer.grade != null && (
                  <div className="p-6 rounded-2xl bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 font-bold text-green-900 dark:text-green-100 text-lg">
                        <CheckCircle className="w-6 h-6 text-green-500" />
                        {t("gradedStatus")}
                      </div>
                      <div className="text-2xl font-black text-green-600">
                        {currentStudentAnswer.grade}/100
                      </div>
                    </div>
                    {currentStudentAnswer.teacher_comment ? (
                      <div className="p-4 bg-white/50 dark:bg-black/20 rounded-xl border border-green-200/50 dark:border-green-700/30">
                        <p className="text-xs font-bold text-green-800/60 dark:text-green-200/60 uppercase tracking-widest mb-1">
                          {t("teacherComment")}
                        </p>
                        <p className="text-green-900 dark:text-green-100 italic">
                          “{currentStudentAnswer.teacher_comment}”
                        </p>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </MagicCard>
            <MagicCard className="p-6 sm:p-8 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-3xl shadow-lg">
              <QuestionClassCommentsSection
                questionId={id}
                canPost={question.allow_student_class_comments !== false}
              />
            </MagicCard>
          </div>
        </div>
      )}
    </div>
  );
}
