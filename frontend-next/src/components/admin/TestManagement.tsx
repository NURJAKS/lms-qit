"use client";

import { useQuery, useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useState } from "react";
import type { Test, TestQuestion } from "@/types";
import { Pencil, Trash2, Plus, ChevronDown, ChevronUp } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { getTextColors } from "@/utils/themeStyles";

interface CourseStructure {
  course_id: number;
  modules: Array<{
    id: number;
    title: string;
    order_number: number;
    topics: Array<{ id: number; title: string; order_number: number }>;
  }>;
}

interface TestManagementProps {
  courseId: number;
  courseTitle: string;
}

export function TestManagement({ courseId, courseTitle }: TestManagementProps) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const textColors = getTextColors(theme);
  const [editingTest, setEditingTest] = useState<Test | null>(null);
  const [deleteTestConfirm, setDeleteTestConfirm] = useState<number | null>(null);
  const [expandedTest, setExpandedTest] = useState<number | null>(null);
  const [showCreateTest, setShowCreateTest] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<TestQuestion | null>(null);
  const [addingQuestion, setAddingQuestion] = useState<number | null>(null);
  const [deleteQuestionConfirm, setDeleteQuestionConfirm] = useState<{ testId: number; questionId: number } | null>(null);
  const queryClient = useQueryClient();

  const { data: tests = [] } = useQuery({
    queryKey: ["admin-tests", courseId],
    queryFn: async () => {
      const { data } = await api.get<Test[]>(`/admin/courses/${courseId}/tests`);
      return data;
    },
  });

  const { data: structure } = useQuery({
    queryKey: ["course-structure", courseId],
    queryFn: async () => {
      const { data } = await api.get<CourseStructure>(`/courses/${courseId}/structure`);
      return data;
    },
  });

  const topics = structure?.modules?.flatMap((m) => m.topics) ?? [];

  const createTestMutation = useMutation({
    mutationFn: async (body: { title: string; passing_score: number; question_count: number; topic_id?: number; is_final?: boolean }) => {
      const { data } = await api.post<Test>(`/admin/courses/${courseId}/tests`, {
        course_id: courseId,
        title: body.title,
        passing_score: body.passing_score,
        question_count: body.question_count,
        topic_id: body.topic_id ?? null,
        is_final: body.is_final ?? false,
        time_limit_seconds: null,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tests", courseId] });
      queryClient.invalidateQueries({ queryKey: ["admin-tests-by-course"] });
      setShowCreateTest(false);
    },
  });

  const updateTestMutation = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: Partial<{ title: string; passing_score: number; question_count: number }> }) => {
      const { data } = await api.patch<Test>(`/admin/tests/${id}`, body);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tests", courseId] });
      queryClient.invalidateQueries({ queryKey: ["admin-tests-by-course"] });
      setEditingTest(null);
    },
  });

  const deleteTestMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/admin/tests/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tests", courseId] });
      queryClient.invalidateQueries({ queryKey: ["admin-tests-by-course"] });
      setDeleteTestConfirm(null);
    },
  });

  const addQuestionMutation = useMutation({
    mutationFn: async ({ testId, body }: { testId: number; body: { question_text: string; correct_answer: string; option_a: string; option_b: string; option_c: string; option_d: string; order_number?: number } }) => {
      const { data } = await api.post<TestQuestion>(`/admin/tests/${testId}/questions`, { ...body, test_id: testId });
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["admin-questions", vars.testId] });
      setAddingQuestion(null);
    },
  });

  const updateQuestionMutation = useMutation({
    mutationFn: async ({ testId, questionId, body }: { testId: number; questionId: number; body: Partial<TestQuestion> }) => {
      const { data } = await api.patch<TestQuestion>(`/admin/tests/${testId}/questions/${questionId}`, body);
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["admin-questions", vars.testId] });
      setEditingQuestion(null);
    },
  });

  const deleteQuestionMutation = useMutation({
    mutationFn: async ({ testId, questionId }: { testId: number; questionId: number }) => {
      await api.delete(`/admin/tests/${testId}/questions/${questionId}`);
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["admin-questions", vars.testId] });
      setDeleteQuestionConfirm(null);
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: textColors.primary }}>{t("adminTestTitle")}: {courseTitle}</h1>
          <p className="mt-1" style={{ color: textColors.secondary }}>{t("adminTestSubtitle")}</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateTest(true)}
          className="flex items-center gap-2 py-2 px-4 rounded-lg bg-qit-primary text-white hover:opacity-90"
        >
          <Plus className="w-4 h-4" /> {t("adminTestCreate")}
        </button>
      </div>

      <div className="space-y-4">
        {tests.map((test) => (
          <TestCard
            key={test.id}
            test={test}
            courseId={courseId}
            isExpanded={expandedTest === test.id}
            onToggleExpand={() => setExpandedTest((v) => (v === test.id ? null : test.id))}
            onEdit={() => setEditingTest(test)}
            onDelete={() => setDeleteTestConfirm(test.id)}
            onAddQuestion={() => setAddingQuestion(test.id)}
            onCloseAddQuestion={() => setAddingQuestion(null)}
            editingQuestion={editingQuestion}
            onEditQuestion={setEditingQuestion}
            addingQuestion={addingQuestion}
            onDeleteQuestion={(qId) => setDeleteQuestionConfirm({ testId: test.id, questionId: qId })}
            addQuestionMutation={addQuestionMutation as UseMutationResult<unknown, Error, unknown, unknown>}
            updateQuestionMutation={updateQuestionMutation as UseMutationResult<unknown, Error, unknown, unknown>}
            deleteQuestionMutation={deleteQuestionMutation as UseMutationResult<unknown, Error, unknown, unknown>}
          />
        ))}
      </div>

      {showCreateTest && (
        <CreateTestModal
          courseId={courseId}
          topics={topics}
          onClose={() => setShowCreateTest(false)}
          onSubmit={(body) => createTestMutation.mutate(body)}
          isPending={createTestMutation.isPending}
        />
      )}

      {editingTest && (
        <EditTestModal
          test={editingTest}
          onClose={() => setEditingTest(null)}
          onSave={(body) => updateTestMutation.mutate({ id: editingTest.id, body })}
          isPending={updateTestMutation.isPending}
        />
      )}

      {deleteTestConfirm && (
        <ConfirmModal
          title={t("adminTestDeleteConfirm")}
          message={t("adminTestDeleteMessage")}
          onClose={() => setDeleteTestConfirm(null)}
          onConfirm={() => deleteTestMutation.mutate(deleteTestConfirm)}
          isPending={deleteTestMutation.isPending}
        />
      )}

      {deleteQuestionConfirm && (
        <ConfirmModal
          title={t("adminTestQuestionDelete")}
          message={t("adminTestQuestionDeleteMessage")}
          onClose={() => setDeleteQuestionConfirm(null)}
          onConfirm={() =>
            deleteQuestionMutation.mutate({
              testId: deleteQuestionConfirm.testId,
              questionId: deleteQuestionConfirm.questionId,
            })
          }
          isPending={deleteQuestionMutation.isPending}
        />
      )}
    </div>
  );
}

function TestCard({
  test,
  courseId,
  isExpanded,
  onToggleExpand,
  onEdit,
  onDelete,
  onAddQuestion,
  onCloseAddQuestion,
  editingQuestion,
  onEditQuestion,
  addingQuestion,
  onDeleteQuestion,
  addQuestionMutation,
  updateQuestionMutation,
  deleteQuestionMutation,
}: {
  test: Test;
  courseId: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddQuestion: () => void;
  onCloseAddQuestion: () => void;
  editingQuestion: TestQuestion | null;
  onEditQuestion: (q: TestQuestion | null) => void;
  addingQuestion: number | null;
  onDeleteQuestion: (questionId: number) => void;
  addQuestionMutation: UseMutationResult<unknown, Error, unknown, unknown>;
  updateQuestionMutation: UseMutationResult<unknown, Error, unknown, unknown>;
  deleteQuestionMutation: UseMutationResult<unknown, Error, unknown, unknown>;
}) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const textColors = getTextColors(theme);
  const { data: questions = [] } = useQuery({
    queryKey: ["admin-questions", test.id],
    queryFn: async () => {
      const { data } = await api.get<TestQuestion[]>(`/admin/tests/${test.id}/questions`);
      return data;
    },
    enabled: isExpanded,
  });

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-100 dark:border-gray-700 overflow-hidden">
      <div className="flex items-center justify-between p-4">
        <button type="button" onClick={onToggleExpand} className="flex items-center gap-2 flex-1 text-left">
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          <div>
            <h3 className="font-semibold text-gray-800 dark:text-white">{test.title}</h3>
            <p className="text-sm" style={{ color: textColors.secondary }}>
              {t("adminTestPassingScoreLabel").replace("{score}", test.passing_score.toString()).replace("{count}", test.question_count.toString()).replace("{dbCount}", questions.length.toString())}
            </p>
          </div>
        </button>
        <div className="flex items-center gap-1">
          <button type="button" onClick={onEdit} className="p-2 text-qit-primary hover:bg-qit-primary/10 rounded-lg" title={t("adminTestEdit")}>
            <Pencil className="w-4 h-4" />
          </button>
          <button type="button" onClick={onDelete} className="p-2 text-red-600 hover:bg-red-50 rounded-lg" title={t("adminTestDelete")}>
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      {isExpanded && (
        <div className="border-t border-gray-100 dark:border-gray-700 p-4 bg-gray-50/50 dark:bg-gray-800/50">
          <div className="flex justify-between items-center mb-3">
            <h4 className="font-medium" style={{ color: textColors.primary }}>{t("adminTestQuestions")}</h4>
            <button
              type="button"
              onClick={onAddQuestion}
              className="flex items-center gap-1 text-sm py-1.5 px-3 rounded-lg border border-qit-primary text-qit-primary hover:bg-qit-primary/10"
            >
              <Plus className="w-4 h-4" /> {t("adminTestAddQuestion")}
            </button>
          </div>
          <ul className="space-y-2">
            {questions.map((q) => (
              <li key={q.id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 dark:text-white truncate">{q.question_text}</p>
                  <p className="text-xs mt-0.5" style={{ color: textColors.secondary }}>{t("adminTestCorrectAnswerLabel").replace("{answer}", (q.correct_answer ?? "—").toUpperCase())}</p>
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <button type="button" onClick={() => onEditQuestion(q)} className="p-1.5 text-qit-primary hover:bg-qit-primary/10 rounded">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => onDeleteQuestion(q.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {addingQuestion === test.id && (
            <AddQuestionForm
              testId={test.id}
              onClose={() => { onCloseAddQuestion(); addQuestionMutation.reset(); }}
              onSubmit={(body) => addQuestionMutation.mutate({ testId: test.id, body })}
              isPending={addQuestionMutation.isPending}
            />
          )}
          {editingQuestion && editingQuestion.test_id === test.id && (
            <EditQuestionModal
              question={editingQuestion}
              onClose={() => onEditQuestion(null)}
              onSave={(body) => updateQuestionMutation.mutate({ testId: test.id, questionId: editingQuestion.id, body })}
              isPending={updateQuestionMutation.isPending}
            />
          )}
        </div>
      )}
    </div>
  );
}

function CreateTestModal({
  courseId,
  topics,
  onClose,
  onSubmit,
  isPending,
}: {
  courseId: number;
  topics: Array<{ id: number; title: string }>;
  onClose: () => void;
  onSubmit: (body: { title: string; passing_score: number; question_count: number; topic_id?: number; is_final?: boolean }) => void;
  isPending: boolean;
}) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const textColors = getTextColors(theme);
  const [title, setTitle] = useState("");
  const [passingScore, setPassingScore] = useState(70);
  const [questionCount, setQuestionCount] = useState(10);
  const [topicId, setTopicId] = useState<string>("");
  const [isFinal, setIsFinal] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      title,
      passing_score: passingScore,
      question_count: questionCount,
      topic_id: topicId ? Number(topicId) : undefined,
      is_final: isFinal,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 max-w-md mx-4 w-full">
        <h3 className="font-semibold mb-4" style={{ color: textColors.primary }}>{t("adminTestCreate")}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: textColors.secondary }}>{t("adminTestTitleLabel")}</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border rounded-lg px-3 py-2 dark:bg-gray-700 dark:border-gray-600" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: textColors.secondary }}>{t("adminTestPassingScorePercent")}</label>
            <input type="number" min={1} max={100} value={passingScore} onChange={(e) => setPassingScore(Number(e.target.value))} className="w-full border rounded-lg px-3 py-2 dark:bg-gray-700 dark:border-gray-600" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: textColors.secondary }}>{t("adminTestQuestionCount")}</label>
            <input type="number" min={1} value={questionCount} onChange={(e) => setQuestionCount(Number(e.target.value))} className="w-full border rounded-lg px-3 py-2 dark:bg-gray-700 dark:border-gray-600" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: textColors.secondary }}>{t("adminTestTopic")}</label>
            <select value={topicId} onChange={(e) => setTopicId(e.target.value)} className="w-full border rounded-lg px-3 py-2 dark:bg-gray-700 dark:border-gray-600">
              <option value="">{t("adminTestNoTopic")}</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="is_final" checked={isFinal} onChange={(e) => setIsFinal(e.target.checked)} className="rounded" />
            <label htmlFor="is_final" className="text-sm font-medium" style={{ color: textColors.secondary }}>{t("adminTestFinal")}</label>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={onClose} className="py-2 px-4 rounded-lg border hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700">{t("adminShopCancel")}</button>
            <button type="submit" disabled={isPending} className="py-2 px-4 rounded-lg bg-qit-primary text-white hover:opacity-90 disabled:opacity-50">{t("adminShopCreate")}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditTestModal({
  test,
  onClose,
  onSave,
  isPending,
}: {
  test: Test;
  onClose: () => void;
  onSave: (body: Partial<{ title: string; passing_score: number; question_count: number }>) => void;
  isPending: boolean;
}) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const textColors = getTextColors(theme);
  const [title, setTitle] = useState(test.title);
  const [passingScore, setPassingScore] = useState(test.passing_score);
  const [questionCount, setQuestionCount] = useState(test.question_count);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const body: Partial<{ title: string; passing_score: number; question_count: number }> = {};
    if (title !== test.title) body.title = title;
    if (passingScore !== test.passing_score) body.passing_score = passingScore;
    if (questionCount !== test.question_count) body.question_count = questionCount;
    if (Object.keys(body).length) onSave(body);
    else onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 max-w-md mx-4 w-full">
        <h3 className="font-semibold mb-4" style={{ color: textColors.primary }}>{t("adminTestEdit")}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: textColors.secondary }}>{t("adminTestTitleLabel")}</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border rounded-lg px-3 py-2 dark:bg-gray-700 dark:border-gray-600" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: textColors.secondary }}>{t("adminTestPassingScorePercent")}</label>
            <input type="number" min={1} max={100} value={passingScore} onChange={(e) => setPassingScore(Number(e.target.value))} className="w-full border rounded-lg px-3 py-2 dark:bg-gray-700 dark:border-gray-600" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: textColors.secondary }}>{t("adminTestQuestionCount")}</label>
            <input type="number" min={1} value={questionCount} onChange={(e) => setQuestionCount(Number(e.target.value))} className="w-full border rounded-lg px-3 py-2 dark:bg-gray-700 dark:border-gray-600" />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={onClose} className="py-2 px-4 rounded-lg border hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700">{t("adminShopCancel")}</button>
            <button type="submit" disabled={isPending} className="py-2 px-4 rounded-lg bg-qit-primary text-white hover:opacity-90 disabled:opacity-50">{t("adminShopSave")}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddQuestionForm({
  testId,
  onClose,
  onSubmit,
  isPending,
}: {
  testId: number;
  onClose: () => void;
  onSubmit: (body: { question_text: string; correct_answer: string; option_a: string; option_b: string; option_c: string; option_d: string; order_number?: number }) => void;
  isPending: boolean;
}) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const textColors = getTextColors(theme);
  const [questionText, setQuestionText] = useState("");
  const [correctAnswer, setCorrectAnswer] = useState("a");
  const [optionA, setOptionA] = useState("");
  const [optionB, setOptionB] = useState("");
  const [optionC, setOptionC] = useState("");
  const [optionD, setOptionD] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionText.trim() || !optionA.trim() || !optionB.trim() || !optionC.trim() || !optionD.trim()) return;
    onSubmit({ question_text: questionText, correct_answer: correctAnswer, option_a: optionA, option_b: optionB, option_c: optionC, option_d: optionD });
  };

  return (
    <div className="mt-4 p-4 bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700">
      <h4 className="font-medium mb-3" style={{ color: textColors.primary }}>{t("adminTestNewQuestion")}</h4>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm mb-1" style={{ color: textColors.secondary }}>{t("adminTestQuestionText")}</label>
          <textarea value={questionText} onChange={(e) => setQuestionText(e.target.value)} rows={2} className="w-full border rounded-lg px-3 py-2 dark:bg-gray-700 dark:border-gray-600" required />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(["a", "b", "c", "d"] as const).map((key) => (
            <div key={key}>
              <label className="block text-sm mb-0.5" style={{ color: textColors.secondary }}>{t("adminTestOption")} {key.toUpperCase()}</label>
              <input type="text" value={key === "a" ? optionA : key === "b" ? optionB : key === "c" ? optionC : optionD} onChange={(e) => { const s = e.target.value; if (key === "a") setOptionA(s); else if (key === "b") setOptionB(s); else if (key === "c") setOptionC(s); else setOptionD(s); }} className="w-full border rounded px-2 py-1.5 text-sm dark:bg-gray-700 dark:border-gray-600" required />
            </div>
          ))}
        </div>
        <div>
          <label className="block text-sm mb-1" style={{ color: textColors.secondary }}>{t("adminTestCorrectAnswer")}</label>
          <select value={correctAnswer} onChange={(e) => setCorrectAnswer(e.target.value)} className="border rounded-lg px-3 py-2 dark:bg-gray-700 dark:border-gray-600">
            <option value="a">A</option>
            <option value="b">B</option>
            <option value="c">C</option>
            <option value="d">D</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="py-1.5 px-3 rounded border hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700">{t("adminShopCancel")}</button>
          <button type="submit" disabled={isPending} className="py-1.5 px-3 rounded bg-qit-primary text-white disabled:opacity-50">{t("adminTestAddQuestion")}</button>
        </div>
      </form>
    </div>
  );
}

function EditQuestionModal({
  question,
  onClose,
  onSave,
  isPending,
}: {
  question: TestQuestion;
  onClose: () => void;
  onSave: (body: Partial<TestQuestion>) => void;
  isPending: boolean;
}) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const textColors = getTextColors(theme);
  const [questionText, setQuestionText] = useState(question.question_text);
  const [correctAnswer, setCorrectAnswer] = useState(question.correct_answer ?? "a");
  const [optionA, setOptionA] = useState(question.option_a);
  const [optionB, setOptionB] = useState(question.option_b);
  const [optionC, setOptionC] = useState(question.option_c);
  const [optionD, setOptionD] = useState(question.option_d);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const body: Partial<TestQuestion> = {};
    if (questionText !== question.question_text) body.question_text = questionText;
    if (correctAnswer !== question.correct_answer) body.correct_answer = correctAnswer;
    if (optionA !== question.option_a) body.option_a = optionA;
    if (optionB !== question.option_b) body.option_b = optionB;
    if (optionC !== question.option_c) body.option_c = optionC;
    if (optionD !== question.option_d) body.option_d = optionD;
    if (Object.keys(body).length) onSave(body);
    else onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 max-w-lg mx-4 w-full max-h-[90vh] overflow-y-auto">
        <h3 className="font-semibold mb-4" style={{ color: textColors.primary }}>{t("adminTestEditQuestion")}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: textColors.secondary }}>{t("adminTestQuestionText")}</label>
            <textarea value={questionText} onChange={(e) => setQuestionText(e.target.value)} rows={3} className="w-full border rounded-lg px-3 py-2 dark:bg-gray-700 dark:border-gray-600" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {(["a", "b", "c", "d"] as const).map((key) => (
              <div key={key}>
                <label className="block text-sm mb-1" style={{ color: textColors.secondary }}>{t("adminTestOption")} {key.toUpperCase()}</label>
                <input type="text" value={key === "a" ? optionA : key === "b" ? optionB : key === "c" ? optionC : optionD} onChange={(e) => { const s = e.target.value; if (key === "a") setOptionA(s); else if (key === "b") setOptionB(s); else if (key === "c") setOptionC(s); else setOptionD(s); }} className="w-full border rounded-lg px-3 py-2 dark:bg-gray-700 dark:border-gray-600" required />
              </div>
            ))}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: textColors.secondary }}>{t("adminTestCorrectAnswer")}</label>
            <select value={correctAnswer} onChange={(e) => setCorrectAnswer(e.target.value)} className="w-full border rounded-lg px-3 py-2 dark:bg-gray-700 dark:border-gray-600">
              <option value="a">A</option>
              <option value="b">B</option>
              <option value="c">C</option>
              <option value="d">D</option>
            </select>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={onClose} className="py-2 px-4 rounded-lg border hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700">{t("adminShopCancel")}</button>
            <button type="submit" disabled={isPending} className="py-2 px-4 rounded-lg bg-qit-primary text-white hover:opacity-90 disabled:opacity-50">{t("adminShopSave")}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ConfirmModal({
  title,
  message,
  onClose,
  onConfirm,
  isPending,
}: {
  title: string;
  message: string;
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
}) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const textColors = getTextColors(theme);
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 max-w-md mx-4">
        <h3 className="font-semibold text-gray-800 dark:text-white mb-2">{title}</h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">{message}</p>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="py-2 px-4 rounded-lg border hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700">{t("adminShopCancel")}</button>
          <button type="button" onClick={onConfirm} disabled={isPending} className="py-2 px-4 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">{t("adminDelete")}</button>
        </div>
      </div>
    </div>
  );
}
