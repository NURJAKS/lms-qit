"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/api/client";
import { useLanguage } from "@/context/LanguageContext";
import type { TestQuestion } from "@/types";

interface TestComponentProps {
  testId: number;
  onComplete: () => void;
  onCancel: () => void;
}

export function TestComponent({ testId, onComplete, onCancel }: TestComponentProps) {
  const { t, lang } = useLanguage();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [timeStart] = useState(Date.now());

  const { data: questions = [], error: questionsError } = useQuery({
    queryKey: ["test-questions", testId],
    queryFn: async () => {
      const { data } = await api.get<TestQuestion[]>(`/tests/${testId}/questions?lang=${lang}`);
      return data;
    },
    enabled: !!testId,
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const timeSeconds = (Date.now() - timeStart) / 1000;
      const res = await api.post<{ score: number; passed: boolean; correct_count: number; total_count: number }>(
        `/tests/${testId}/submit?lang=${lang}`,
        {
          answers: Object.entries(answers).map(([question_id, answer]) => ({ question_id: Number(question_id), answer })),
          time_seconds: timeSeconds,
        }
      );
      return res.data;
    },
    onSuccess: (data) => {
      setStep(data.passed ? 1 : 2);
    },
  });

  const current = questions[step];
  const isLast = step === questions.length - 1;

  const handleNext = () => {
    if (isLast) submitMutation.mutate();
    else setStep((s) => s + 1);
  };

  const handlePrev = () => setStep((s) => Math.max(0, s - 1));

  if (submitMutation.isSuccess && submitMutation.data) {
    const d = submitMutation.data;
    if (d.passed) {
      return (
        <div className="max-w-xl mx-auto bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-6 text-center">
          <h2 className="text-xl font-bold text-green-800 dark:text-green-200 mb-2">{t("topicTestCongratsTitle")}</h2>
          <p className="text-green-700 dark:text-green-300 mb-2 font-medium">{t("testPassed")}</p>
          <p className="text-green-700/90 dark:text-green-300/90 mb-4 text-sm">{t("topicTestCongratsBody")}</p>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{t("testScore")}: {d.score.toFixed(0)}% ({d.correct_count}/{d.total_count})</p>
          <button type="button" onClick={onComplete} className="py-2 px-4 rounded-lg bg-green-600 text-white hover:bg-green-700">{t("profileContinue")}</button>
        </div>
      );
    }
    return (
      <div className="max-w-xl mx-auto bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6 text-center">
        <h2 className="text-xl font-bold text-amber-800 dark:text-amber-200 mb-2">{t("testFailed")}</h2>
        <p className="text-amber-700 dark:text-amber-300 mb-4">{t("testFailedDesc")}</p>
        <p className="text-gray-600 dark:text-gray-400 mb-4">{t("testScore")}: {d.score.toFixed(0)}% ({d.correct_count}/{d.total_count})</p>
        <button type="button" onClick={onCancel} className="py-2 px-4 rounded-lg bg-amber-600 text-white hover:bg-amber-700">{t("testRetry")}</button>
      </div>
    );
  }

  if (questionsError) {
    const errorMessage = (questionsError as { response?: { data?: { detail?: string } } })?.response?.data?.detail || t("testError");
    return (
      <div className="max-w-xl mx-auto bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6 text-center">
        <h2 className="text-xl font-bold text-amber-800 dark:text-amber-200 mb-2">{t("testError")}</h2>
        <p className="text-amber-700 dark:text-amber-300 mb-4">{errorMessage}</p>
        <button type="button" onClick={onCancel} className="py-2 px-4 rounded-lg bg-amber-600 text-white hover:bg-amber-700">{t("testBack")}</button>
      </div>
    );
  }

  if (questions.length === 0) return <p className="text-gray-500">{t("testLoading")}</p>;

  const q = current;
  const options = [
    { key: "a", label: q.option_a },
    { key: "b", label: q.option_b },
    { key: "c", label: q.option_c },
    { key: "d", label: q.option_d },
  ];

  return (
    <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl shadow p-4 sm:p-6">
      <p className="text-sm text-gray-500 mb-2">{t("testQuestion")} {step + 1} / {questions.length}</p>
      <h3 className="text-base sm:text-lg font-medium text-gray-800 dark:text-white mb-4 mobile-safe-text">{q.question_text}</h3>
      <ul className="space-y-2 mb-6">
        {options.map((opt) => (
          <li key={opt.key}>
            <label className="flex items-center gap-2 p-3 sm:p-3.5 border dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 has-[:checked]:bg-[var(--qit-primary)]/10 has-[:checked]:border-[var(--qit-primary)] min-h-[2.75rem]">
              <input type="radio" name={`q-${q.id}`} value={opt.key} checked={answers[q.id] === opt.key} onChange={() => setAnswers((a) => ({ ...a, [q.id]: opt.key }))} className="w-4 h-4 shrink-0" style={{ accentColor: "var(--qit-primary)" }} />
              <span className="mobile-safe-text">{opt.label}</span>
            </label>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap justify-between gap-2">
        <button type="button" onClick={handlePrev} disabled={step === 0} className="py-2.5 px-4 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 min-h-[2.5rem]">
          {t("testBack")}
        </button>
        <button type="button" onClick={handleNext} disabled={!answers[q.id]} className="py-2.5 px-4 rounded-lg text-white disabled:opacity-50 min-h-[2.5rem]" style={{ background: "var(--qit-primary)" }}>
          {isLast ? t("testSubmit") : t("testNext")}
        </button>
      </div>
    </div>
  );
}
