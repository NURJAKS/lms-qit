"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { api } from "@/api/client";
import { useLanguage } from "@/context/LanguageContext";
import type { TestQuestion, Test } from "@/types";
import { AlertTriangle, Maximize } from "lucide-react";
import { useNotificationStore } from "@/store/notificationStore";

interface TestComponentProps {
  testId: number;
  onComplete: () => void;
  onCancel: () => void;
}

export function TestComponent({ testId, onComplete, onCancel }: TestComponentProps) {
  const { t, lang } = useLanguage();
  const [step, setStep] = useState(0);
  const showConfirm = useNotificationStore((s) => s.showConfirm);
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



  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showCheatingWarning, setShowCheatingWarning] = useState(false);
  const [hasEnteredFullscreenOnce, setHasEnteredFullscreenOnce] = useState(false);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setShowCheatingWarning(true);
      }
    };

    const handleBlur = () => {
      setShowCheatingWarning(true);
    };

    const handleFullscreenChange = () => {
      const isFull = !!document.fullscreenElement;
      setIsFullscreen(isFull);
      if (!isFull && hasEnteredFullscreenOnce) {
        setShowCheatingWarning(true);
      }
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!submitMutation.isSuccess) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasEnteredFullscreenOnce, submitMutation.isSuccess]);

  useEffect(() => {
    if (submitMutation.isSuccess) return;

    const blockClipboard = (e: ClipboardEvent) => {
      e.preventDefault();
    };

    const blockSelection = (e: Event) => {
      e.preventDefault();
    };

    const blockHotkeys = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && (key === "c" || key === "x" || key === "a" || key === "insert")) {
        e.preventDefault();
      }
      if (e.shiftKey && key === "insert") {
        e.preventDefault();
      }
    };

    document.addEventListener("copy", blockClipboard);
    document.addEventListener("cut", blockClipboard);
    document.addEventListener("selectstart", blockSelection);
    document.addEventListener("contextmenu", blockSelection);
    document.addEventListener("keydown", blockHotkeys);

    return () => {
      document.removeEventListener("copy", blockClipboard);
      document.removeEventListener("cut", blockClipboard);
      document.removeEventListener("selectstart", blockSelection);
      document.removeEventListener("contextmenu", blockSelection);
      document.removeEventListener("keydown", blockHotkeys);
    };
  }, [submitMutation.isSuccess]);

  const enterFullscreen = () => {
    if (containerRef.current?.requestFullscreen) {
      containerRef.current.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
      setHasEnteredFullscreenOnce(true);
      setShowCheatingWarning(false);
    }
  };

  const handleFinishEarly = () => {
    showConfirm({
      title: t("testFinishAndExit"),
      message: t("testExitWarning"),
      variant: "danger",
      onConfirm: () => submitMutation.mutate(),
    });
  };

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
    <div ref={containerRef} className="relative w-full h-full min-h-[400px] flex flex-col items-center justify-center bg-white dark:bg-gray-900 overflow-auto p-4 transition-all duration-300">
      
      {!isFullscreen && !submitMutation.isSuccess && (
        <div className="absolute inset-0 z-[60] flex flex-col items-center justify-center bg-white dark:bg-gray-900 p-6 text-center text-gray-800 dark:text-white">
          <Maximize className="w-16 h-16 text-[var(--qit-primary)] mb-6 animate-pulse" />
          <h2 className="text-2xl font-bold mb-4">{t("testFullscreenPrompt")}</h2>
          <p className="text-gray-600 dark:text-gray-400 max-w-md mb-8">
            {t("testFullscreenPrompt")}
          </p>
          <button 
            type="button" 
            onClick={enterFullscreen}
            className="py-3 px-8 rounded-xl text-white font-bold shadow-lg hover:scale-105 transition-all text-lg"
            style={{ background: "var(--qit-primary)" }}
          >
            {t("profileContinue")}
          </button>
        </div>
      )}

      {showCheatingWarning && isFullscreen && !submitMutation.isSuccess && (
        <div className="absolute inset-0 z-[70] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md p-6 text-center text-white">
          <AlertTriangle className="w-20 h-20 text-red-500 mb-6 animate-bounce" />
          <h2 className="text-2xl font-bold mb-4 text-red-500">{t("testCheatingWarning")}</h2>
          <p className="text-gray-300 max-w-md mb-8">
            {t("testCheatingWarning")}
          </p>
          <button 
            type="button" 
            onClick={() => setShowCheatingWarning(false)}
            className="py-3 px-8 rounded-xl bg-white text-black font-bold shadow-lg hover:bg-gray-200 transition-all text-lg"
          >
            {t("profileContinue")}
          </button>
        </div>
      )}

      <div 
        className="max-w-2xl w-full bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-2xl shadow-2xl p-6 sm:p-10 select-none relative z-10"
        onCopy={(e) => e.preventDefault()}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="flex justify-between items-start mb-6">
          <div>
            <p className="text-sm font-bold text-[var(--qit-primary)] uppercase tracking-wider mb-1">{t("testQuestion")} {step + 1} / {questions.length}</p>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white leading-tight">{q.question_text}</h2>
          </div>
          <button 
            type="button"
            onClick={handleFinishEarly}
            className="text-xs font-semibold py-1.5 px-3 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
          >
            {t("testFinishAndExit")}
          </button>
        </div>
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
    </div>
  );
}
