"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/api/client";
import { useLanguage } from "@/context/LanguageContext";
import type { TranslationKey } from "@/i18n/translations";
import type { TestQuestion, Test } from "@/types";
import { AlertTriangle, Maximize } from "lucide-react";
import { useNotificationStore } from "@/store/notificationStore";

interface TestComponentProps {
  testId: number;
  onComplete: () => void;
  onCancel: () => void;
  /** If set, «retake» starts a fresh attempt without calling onCancel (e.g. stay on topic / in inline test). */
  onRetake?: () => void;
  /** Label for the primary button on the «passed» result card (default: profileContinue). */
  passedContinueLabelKey?: TranslationKey;
}

function navigateToCourseSupplementaryTab(router: { push: (href: string) => void }) {
  if (typeof window === "undefined") return;
  const path = window.location.pathname;
  const courseMatch = path.match(/^\/app\/courses\/(\d+)/);
  const courseId = courseMatch?.[1] ?? new URLSearchParams(window.location.search).get("courseId");
  if (courseId) {
    router.push(`/app/courses/${courseId}?tab=supplementary`);
    return;
  }
  const url = new URL(window.location.href);
  url.searchParams.set("tab", "supplementary");
  router.push(`${url.pathname}${url.search}`);
}

function closeTestThenGoToSupplementary(
  router: { push: (href: string) => void },
  onCancel: () => void,
) {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  const standalone = typeof window !== "undefined" && window.location.pathname.startsWith("/app/test/");
  if (!standalone) onCancel();
  navigateToCourseSupplementaryTab(router);
}

function TestScoreThresholdBar({
  score,
  barClassName,
  marker50ClassName,
}: {
  score: number;
  barClassName: string;
  marker50ClassName: string;
}) {
  const pct = Math.min(Math.max(score, 0), 100);
  return (
    <>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-1000 ${barClassName}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="relative mt-2 h-4 text-xs font-medium max-sm:h-3.5">
        <span className="absolute left-0 text-gray-400 dark:text-gray-500">0%</span>
        <span className={`absolute -translate-x-1/2 max-sm:hidden ${marker50ClassName}`} style={{ left: "50%" }}>
          50%
        </span>
        <span
          className="absolute -translate-x-1/2 text-green-600 dark:text-green-500 max-sm:hidden"
          style={{ left: "80%" }}
        >
          80%
        </span>
        <span className="absolute left-full -translate-x-full text-gray-400 dark:text-gray-500">100%</span>
      </div>
    </>
  );
}

export function TestComponent({ testId, onComplete, onCancel, onRetake, passedContinueLabelKey }: TestComponentProps) {
  const router = useRouter();
  const { t, lang } = useLanguage();

  const handleRetakeClick = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    if (onRetake) onRetake();
    else onCancel();
  };
  const [step, setStep] = useState(0);
  const showConfirm = useNotificationStore((s) => s.showConfirm);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [timeStart] = useState(() => Date.now());

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

  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showCheatingWarning, setShowCheatingWarning] = useState(false);
  const [hasEnteredFullscreenOnce, setHasEnteredFullscreenOnce] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const handleFinishEarly = () => {
    setShowExitConfirm(true);
  };

  const handleNext = () => {
    if (step === questions.length - 1) submitMutation.mutate();
    else setStep((s) => s + 1);
  };

  const handlePrev = () => setStep((s) => Math.max(0, s - 1));

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
      if (key === "escape") {
        e.preventDefault();
        handleFinishEarly();
      }
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

  const current = questions[step];
  const isLast = step === questions.length - 1;

  if (submitMutation.isSuccess && submitMutation.data) {
    const d = submitMutation.data;
    const tier: string = (d as Record<string, unknown>).result_tier as string || (d.passed ? "passed" : "failed");
    const showSuppLink: boolean = (d as Record<string, unknown>).show_supplementary_link as boolean || false;

    const wrapperClass = "w-full h-full min-h-[400px] flex flex-col items-center justify-center bg-white dark:bg-gray-900 p-4 transition-all duration-300";

    // --- PASSED (80-100%) ---
    if (tier === "passed") {
      return (
        <div className={wrapperClass}>
          <div className="w-full max-w-xl mx-auto rounded-2xl overflow-hidden shadow-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800">
            <div className="bg-green-600 p-6 text-center relative overflow-hidden">
              <div className="relative">
                <div className="text-4xl mb-3">✅</div>
                <h2 className="text-xl font-bold text-white tracking-wide">{t("testResultPassedTitle")}</h2>
              </div>
            </div>
            <div className="p-6 text-center">
              <p className="text-gray-700 dark:text-gray-300 mb-6 text-base leading-relaxed">{t("testResultPassedDesc")}</p>
              <div className="inline-flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 rounded-xl px-8 py-4 border border-gray-100 dark:border-gray-700 mb-6">
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{t("testScore")}</span>
                <span className="text-4xl font-bold text-green-600 dark:text-green-500">{d.score.toFixed(0)}%</span>
                <span className="text-xs text-gray-400 mt-1">({d.correct_count}/{d.total_count})</span>
              </div>
              <div className="mt-2">
                <button type="button" onClick={onComplete} className="py-2.5 px-6 rounded-lg bg-[var(--qit-primary)] hover:opacity-90 text-white font-semibold transition-all text-sm w-full sm:w-auto mt-2">
                  {t(passedContinueLabelKey ?? "profileContinue")}
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // --- NEEDS REVIEW (50-80%) ---
    if (tier === "needs_review") {
      return (
        <div className={wrapperClass}>
          <div className="w-full max-w-xl mx-auto rounded-2xl overflow-hidden shadow-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800">
            <div className="bg-amber-500 p-6 text-center relative overflow-hidden">
              <div className="relative">
                <div className="text-4xl mb-3">⚠️</div>
                <h2 className="text-xl font-bold text-white tracking-wide">{t("testResultNeedsReviewTitle")}</h2>
              </div>
            </div>
            <div className="p-6">
              <p className="text-gray-700 dark:text-gray-300 mb-4 text-base leading-relaxed text-center">{t("testResultNeedsReviewDesc")}</p>
              <div className="my-6 bg-gray-50 dark:bg-gray-900 rounded-xl p-5 border border-gray-100 dark:border-gray-700">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{t("testScore")}</span>
                  <span className="text-2xl font-bold text-amber-600 dark:text-amber-500">{d.score.toFixed(0)}%</span>
                </div>
                <TestScoreThresholdBar score={d.score} barClassName="bg-amber-500" marker50ClassName="text-amber-600 dark:text-amber-500" />
              </div>
              <p className="text-gray-500 dark:text-gray-400 text-sm text-center mb-6">{t("testResultNeedsReviewSupplementaryHint")}</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button type="button" onClick={handleRetakeClick} className="py-2.5 px-6 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-semibold transition-all text-sm">
                  {t("testRetry")}
                </button>
                {showSuppLink && (
                  <button
                    type="button"
                    onClick={() => closeTestThenGoToSupplementary(router, onCancel)}
                    className="py-2.5 px-6 rounded-lg bg-[var(--qit-primary)] hover:opacity-90 text-white font-semibold transition-all text-sm"
                  >
                    {t("testGoToSupplementary")}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    // --- FAILED (0-50%) ---
    return (
      <div className={wrapperClass}>
        <div className="w-full max-w-xl mx-auto rounded-2xl overflow-hidden shadow-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800">
          <div className="bg-red-500 p-6 text-center relative overflow-hidden">
            <div className="relative">
              <div className="text-4xl mb-3">❌</div>
              <h2 className="text-xl font-bold text-white tracking-wide">{t("testResultFailedTitle")}</h2>
            </div>
          </div>
          <div className="p-6">
            <p className="text-gray-700 dark:text-gray-300 mb-4 text-base leading-relaxed text-center">{t("testResultFailedDesc")}</p>
            <div className="my-6 bg-gray-50 dark:bg-gray-900 rounded-xl p-5 border border-gray-100 dark:border-gray-700">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{t("testScore")}</span>
                <span className="text-2xl font-bold text-red-600 dark:text-red-500">{d.score.toFixed(0)}%</span>
              </div>
              <TestScoreThresholdBar score={d.score} barClassName="bg-red-500" marker50ClassName="text-red-500 dark:text-red-400" />
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-sm text-center mb-6">{t("testResultFailedSupplementaryHint")}</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button type="button" onClick={handleRetakeClick} className="py-2.5 px-6 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-semibold transition-all text-sm">
                {t("testRetry")}
              </button>
              {showSuppLink && (
                <button
                  type="button"
                  onClick={() => closeTestThenGoToSupplementary(router, onCancel)}
                  className="py-2.5 px-6 rounded-lg bg-[var(--qit-primary)] hover:opacity-90 text-white font-semibold transition-all text-sm"
                >
                  {t("testGoToSupplementary")}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (questionsError) {
    const errorMessage = (questionsError as { response?: { data?: { detail?: string } } })?.response?.data?.detail || t("testError");
    return (
      <div className="max-w-xl mx-auto bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6 text-center">
        <h2 className="text-xl font-bold text-amber-800 dark:text-amber-200 mb-2">{t("testError")}</h2>
        <p className="text-amber-700 dark:text-amber-300 mb-4">{t(errorMessage as TranslationKey)}</p>
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
    <div
      ref={containerRef}
      className="fixed inset-0 z-[50] flex flex-col items-center justify-center bg-white dark:bg-gray-900 overflow-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] transition-all duration-300"
    >
      {!isFullscreen && !submitMutation.isSuccess && (
        <div className="absolute inset-0 z-[60] flex flex-col items-center justify-center bg-white dark:bg-gray-900 px-4 py-8 sm:p-6 text-center text-gray-800 dark:text-white">
          <Maximize className="w-12 h-12 sm:w-16 sm:h-16 text-[var(--qit-primary)] mb-4 sm:mb-6 animate-pulse shrink-0" />
          <h2 className="text-lg sm:text-2xl font-bold mb-6 max-w-md leading-snug">{t("testFullscreenPrompt")}</h2>
          <button
            type="button"
            onClick={enterFullscreen}
            className="w-full max-w-sm py-3.5 px-6 rounded-xl text-white font-bold shadow-lg active:scale-[0.98] transition-transform text-base sm:text-lg min-h-[3rem]"
            style={{ background: "var(--qit-primary)" }}
          >
            {t("profileContinue")}
          </button>
        </div>
      )}

      {showCheatingWarning && !submitMutation.isSuccess && (
        <div className="absolute inset-0 z-[70] flex flex-col bg-black/90 backdrop-blur-md px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))] text-center text-white sm:items-center sm:justify-center sm:p-6">
          <div className="flex min-h-0 w-full max-w-md flex-1 flex-col items-center justify-center mx-auto sm:flex-none">
            <AlertTriangle className="w-14 h-14 sm:w-20 sm:h-20 text-red-500 mb-4 sm:mb-5 animate-bounce shrink-0" />
            <p className="text-base sm:text-xl font-bold text-red-400 leading-snug">{t("testCheatingWarning")}</p>
          </div>
          <button
            type="button"
            onClick={() => setShowCheatingWarning(false)}
            className="mx-auto mt-4 w-full max-w-sm shrink-0 rounded-xl bg-white py-3.5 px-6 text-base font-bold text-black shadow-lg transition-colors hover:bg-gray-200 sm:mt-6 sm:text-lg min-h-[3rem]"
          >
            {t("profileContinue")}
          </button>
        </div>
      )}

      {showExitConfirm && !submitMutation.isSuccess && (
        <div className="absolute inset-0 z-[80] flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm p-4 sm:p-6 text-center text-white">
          <div className="bg-white dark:bg-gray-800 p-5 sm:p-8 rounded-2xl max-w-md w-full shadow-2xl border border-red-200 dark:border-red-900 max-h-[90dvh] overflow-y-auto">
            <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-red-600 dark:text-red-400 leading-tight">
              {t("testFinishAndExit")}
            </h2>
            <p className="text-gray-700 dark:text-gray-300 mb-6 sm:mb-8 text-sm sm:text-base leading-relaxed text-left sm:text-center">
              {t("testExitWarning")}
            </p>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-center sm:gap-4">
              <button
                type="button"
                onClick={() => setShowExitConfirm(false)}
                className="py-3 px-6 rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-all w-full sm:flex-1 min-h-[2.75rem]"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowExitConfirm(false);
                  submitMutation.mutate();
                }}
                className="py-3 px-6 rounded-xl bg-red-600 text-white font-semibold shadow-lg hover:bg-red-700 transition-all w-full sm:flex-1 min-h-[2.75rem]"
              >
                {t("testFinishConfirm")}
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        className="max-w-2xl w-full min-w-0 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-2xl shadow-2xl p-4 sm:p-10 select-none relative z-10"
        onCopy={(e) => e.preventDefault()}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start mb-5 sm:mb-6">
          <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm font-bold text-[var(--qit-primary)] uppercase tracking-wider mb-1">
              {t("testQuestion")} {step + 1} / {questions.length}
            </p>
            <h2 className="text-lg sm:text-2xl font-bold text-gray-800 dark:text-white leading-tight break-words">
              {q.question_text}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleFinishEarly}
            className="shrink-0 self-stretch sm:self-auto text-xs font-semibold py-2.5 px-3 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-950/40 transition-colors min-h-[2.5rem] sm:min-h-0"
          >
            {t("testFinishAndExit")}
          </button>
        </div>
      <ul className="space-y-2 mb-5 sm:mb-6">
        {options.map((opt) => (
          <li key={opt.key}>
            <label className="flex items-start gap-3 p-3 sm:p-3.5 border dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 has-[:checked]:bg-[var(--qit-primary)]/10 has-[:checked]:border-[var(--qit-primary)] min-h-[2.75rem]">
              <input
                type="radio"
                name={`q-${q.id}`}
                value={opt.key}
                checked={answers[q.id] === opt.key}
                onChange={() => setAnswers((a) => ({ ...a, [q.id]: opt.key }))}
                className="w-4 h-4 shrink-0 mt-0.5"
                style={{ accentColor: "var(--qit-primary)" }}
              />
              <span className="mobile-safe-text min-w-0 flex-1 break-words leading-snug">{opt.label}</span>
            </label>
          </li>
        ))}
      </ul>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-between">
        <button
          type="button"
          onClick={handlePrev}
          disabled={step === 0}
          className="w-full sm:w-auto py-3 px-4 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 min-h-[2.75rem] font-medium"
        >
          {t("testBack")}
        </button>
        <button
          type="button"
          onClick={handleNext}
          disabled={!answers[q.id]}
          className="w-full sm:w-auto py-3 px-4 rounded-lg text-white disabled:opacity-50 min-h-[2.75rem] font-semibold"
          style={{ background: "var(--qit-primary)" }}
        >
          {isLast ? t("testSubmit") : t("testNext")}
        </button>
      </div>
      </div>
    </div>
  );
}
