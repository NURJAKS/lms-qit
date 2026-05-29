"use client";

import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Brain, Clock, Target, Rocket, RefreshCw, GraduationCap, Download, WandSparkles, CheckCircle2 } from "lucide-react";
import { SparklesText } from "@/components/ui/sparkles-text";
import { BlurFade } from "@/components/ui/blur-fade";
import Link from "next/link";
import { useAuthStore } from "@/store/authStore";

interface AIPlanTabProps {
  courseId: string;
  level?: string;
  weakTopics?: string;
}

type PlanAction = "short" | "focus_weak" | "simplify";

const extractActionItems = (markdown: string): string[] => {
  const lines = markdown
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const tasks = lines
    .filter((line) => /^(-|\*|\d+\.)\s+/.test(line))
    .map((line) => line.replace(/^(-|\*|\d+\.)\s+/, "").trim())
    .filter((line) => line.length > 4 && line.length < 140);

  if (tasks.length >= 3) return tasks;

  const fallback = lines
    .filter((line) => !line.startsWith("#"))
    .slice(0, 3)
    .map((line) => (line.length > 90 ? `${line.slice(0, 87)}...` : line));

  return fallback;
};

const isoDate = (date: Date) => date.toISOString().slice(0, 10);
const cleanPlanText = (text: string): string =>
  text
    .replace(/\\\*/g, "*")
    .replace(/\*\*(.*?)\*\*/g, "$1");

export function AIPlanTab({ courseId, level = "intermediate", weakTopics = "" }: AIPlanTabProps) {
  const { t, lang } = useLanguage();
  const setAuth = useAuthStore((s) => s.setAuth);
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const [transformedPlan, setTransformedPlan] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<PlanAction | null>(null);
  const [isTransforming, setIsTransforming] = useState(false);
  const [checkedMap, setCheckedMap] = useState<Record<number, boolean>>({});
  const [isLevelPickerOpen, setIsLevelPickerOpen] = useState(false);
  const [customInstruction, setCustomInstruction] = useState("");

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["ai-personal-plan", level, weakTopics],
    queryFn: async () => {
      const topicsArray = weakTopics ? weakTopics.split(",").map(t => t.trim()).filter(Boolean) : [];
      const { data } = await api.post<{ plan: string }>(
        `/challenge/personal-plan?lang=${lang}`,
        {
          level,
          weak_topics: topicsArray,
        }
      );
      return data;
    },
    staleTime: 1000 * 60 * 30, // 30 minutes
    gcTime: 1000 * 60 * 60, // 1 hour
    retry: 1,
  });

  const weakTopicsList = useMemo(
    () => weakTopics.split(",").map((item) => item.trim()).filter(Boolean),
    [weakTopics]
  );
  const basePlan = cleanPlanText(data?.plan || "");
  const shownPlan = transformedPlan ?? basePlan;
  const dailyFocusItems = useMemo(() => extractActionItems(shownPlan).slice(0, 3), [shownPlan]);
  const today = isoDate(new Date());
  const planScope = `${lang}:${level}:${weakTopics}`;
  const checklistKey = `ai-plan-checklist:${planScope}:${today}`;
  const weeklyKey = `ai-plan-weekly:${planScope}`;

  useEffect(() => {
    setTransformedPlan(null);
    setActiveAction(null);
  }, [basePlan]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(checklistKey);
      if (!raw) {
        setCheckedMap({});
        return;
      }
      const parsed = JSON.parse(raw) as Record<number, boolean>;
      setCheckedMap(parsed ?? {});
    } catch {
      setCheckedMap({});
    }
  }, [checklistKey, shownPlan]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(checklistKey, JSON.stringify(checkedMap));
      const completed = Object.values(checkedMap).filter(Boolean).length;
      const rawWeekly = localStorage.getItem(weeklyKey);
      const weekly = rawWeekly ? (JSON.parse(rawWeekly) as Record<string, number>) : {};
      weekly[today] = completed;
      localStorage.setItem(weeklyKey, JSON.stringify(weekly));
    } catch {
      // no-op
    }
  }, [checkedMap, checklistKey, weeklyKey, today]);

  const weekStats = useMemo(() => {
    if (typeof window === "undefined") return { activeDays: 0, streakDays: 0 };
    try {
      const rawWeekly = localStorage.getItem(weeklyKey);
      const weekly = rawWeekly ? (JSON.parse(rawWeekly) as Record<string, number>) : {};
      const now = new Date();
      let activeDays = 0;
      let streakDays = 0;
      for (let i = 0; i < 7; i += 1) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const key = isoDate(d);
        if ((weekly[key] || 0) > 0) activeDays += 1;
      }
      for (let i = 0; i < 30; i += 1) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const key = isoDate(d);
        if ((weekly[key] || 0) > 0) streakDays += 1;
        else break;
      }
      return { activeDays, streakDays };
    } catch {
      return { activeDays: 0, streakDays: 0 };
    }
  }, [weeklyKey]);

  const completedToday = Object.values(checkedMap).filter(Boolean).length;

  const toggleTask = (index: number) => {
    setCheckedMap((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const transformPlan = async (action: PlanAction) => {
    if (!basePlan) return;
    setIsTransforming(true);
    try {
      const { data: transformed } = await api.post<{ plan: string }>(
        `/challenge/personal-plan/transform?lang=${lang}`,
        {
          plan: basePlan,
          action,
          weak_topics: weakTopicsList,
        }
      );
      setTransformedPlan(cleanPlanText(transformed.plan || basePlan));
      setActiveAction(action);
    } finally {
      setIsTransforming(false);
    }
  };

  const levelMutation = useMutation({
    mutationFn: async (nextLevel: string) => {
      const { data } = await api.post<{ level: string }>("/challenge/level", { level: nextLevel });
      return data;
    },
    onSuccess: (data) => {
      if (user && token) {
        setAuth({ ...user, ai_level: data.level }, token);
      }
      setIsLevelPickerOpen(false);
      refetch();
    },
  });

  const customTransformMutation = useMutation({
    mutationFn: async (instruction: string) => {
      const { data: transformed } = await api.post<{ plan: string }>(
        `/challenge/personal-plan/transform?lang=${lang}`,
        {
          plan: basePlan,
          action: "custom",
          weak_topics: weakTopicsList,
          custom_instruction: instruction,
        }
      );
      return transformed;
    },
    onSuccess: (transformed) => {
      setTransformedPlan(cleanPlanText(transformed.plan || basePlan));
      setActiveAction(null);
      setCustomInstruction("");
    },
  });

  if (isLoading || isFetching) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-8 p-6 text-center">
        <div className="relative">
          <div className="w-24 h-24 rounded-full border-4 border-purple-100 dark:border-purple-900/30 border-t-purple-600 animate-spin" />
          <Brain className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 text-purple-600 animate-pulse" />
        </div>
        
        <div className="space-y-4 max-w-md">
          <SparklesText className="text-2xl font-bold">
            {t("aiPlanGeneratingTitle")}
          </SparklesText>
          <p className="text-gray-500 dark:text-gray-400 animate-pulse">
            {t("aiPlanGeneratingDesc")}
          </p>
        </div>

        <div className="flex gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-50 dark:bg-purple-900/20 text-xs font-medium text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-800">
            <Target className="w-3.5 h-3.5" />
            {level === "expert" ? t("aiLevelExpert") : level === "beginner" ? t("aiLevelBeginner") : t("aiLevelIntermediate")}
          </div>
          {weakTopics && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-xs font-medium text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800">
              <Clock className="w-3.5 h-3.5" />
              {t("aiPlanTopicsCount").replace("{count}", String(weakTopics.split(",").length))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border-2 border-red-100 dark:border-red-900/30 bg-red-50/50 dark:bg-red-900/10 p-8 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center mx-auto text-red-600">
          <RefreshCw className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-red-800 dark:text-red-300">
          {t("aiPlanErrorTitle")}
        </h3>
        <p className="text-sm text-red-700 dark:text-red-400 max-w-xs mx-auto">
          {t("aiPlanErrorDesc")}
        </p>
        <button
          onClick={() => refetch()}
          className="px-6 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-medium shadow-lg"
        >
          {t("aiRetry")}
        </button>
      </div>
    );
  }

  const handleDownloadPlan = () => {
    if (!shownPlan) return;

    const now = new Date();
    const datePart = now.toISOString().slice(0, 10);
    const title = t("aiPlanFileTitle");
    const fileContents = `# ${title}\n\n${shownPlan}\n`;

    const blob = new Blob([fileContents], { type: "text/markdown;charset=utf-8" });
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = downloadUrl;
    const filePrefix = lang === 'kk' ? 'ai-oqu-jospary' : lang === 'ru' ? 'ai-plan-razvitiya' : 'ai-study-plan';
    a.download = `${filePrefix}-${datePart}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(downloadUrl);
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="plan-content"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="space-y-6"
      >
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 text-white shadow-lg">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-indigo-600">
                {t("aiPersonalPlanTitle")}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5 mt-0.5">
                <Brain className="w-3 h-3" />
                {t("aiPoweredByGemini")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto sm:overflow-visible pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setIsLevelPickerOpen((prev) => !prev)}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-200 shrink-0"
            >
              <GraduationCap className="w-4 h-4" />
              <span className="text-sm font-medium">
                {t("aiChangeLevel")}
              </span>
            </button>
            <button
              onClick={handleDownloadPlan}
              disabled={!shownPlan}
              title={t("aiDownloadPlan")}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              <Download className="w-4 h-4" />
              <span className="text-sm font-medium">
                {t("aiDownload")}
              </span>
            </button>
             <button
              onClick={() => refetch()}
              title={t("aiUpdatePlan")}
              className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-gray-500 shrink-0"
            >
              <RefreshCw className={`w-5 h-5 ${isFetching ? "animate-spin" : ""}`} />
            </button>
            <Link
              href={courseId ? `/app/courses/${courseId}` : "/app/courses"}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 text-white hover:bg-purple-700 transition-all font-semibold shadow-md active:scale-95"
            >
              <Rocket className="w-4 h-4" />
              {t("aiStartLearning")}
            </Link>
          </div>
        </div>
        {isLevelPickerOpen && (
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/50 p-3">
            <p className="text-xs text-gray-500 mb-2">
              {t("aiSelectNewLevel")}
            </p>
            <div className="flex flex-wrap gap-2">
              {(["beginner", "intermediate", "expert"] as const).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => levelMutation.mutate(lvl)}
                  disabled={levelMutation.isPending}
                  className={`px-3 py-1.5 rounded-lg text-sm border ${
                    lvl === level ? "bg-purple-600 text-white border-purple-600" : "hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
                >
                  {lvl === "beginner" ? t("aiLevelBeginner") : lvl === "intermediate" ? t("aiLevelIntermediate") : t("aiLevelExpert")}
                </button>
              ))}
            </div>
          </div>
        )}

        <BlurFade delay={0.2}>
          <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 mb-4">
            <div className="rounded-2xl border border-purple-200/70 dark:border-purple-900/50 bg-white/70 dark:bg-gray-900/40 p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-4 h-4 text-purple-600" />
                <h3 className="font-bold text-sm">
                  {t("aiTodayFocus")}
                </h3>
              </div>
              <div className="space-y-2">
                {dailyFocusItems.map((item, index) => (
                  <button
                    key={`${item}-${index}`}
                    type="button"
                    onClick={() => toggleTask(index)}
                    className="w-full text-left flex items-start gap-2 rounded-xl px-3 py-2 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                  >
                    <CheckCircle2 className={`w-4 h-4 mt-0.5 ${checkedMap[index] ? "text-green-500" : "text-gray-400"}`} />
                    <span className={`text-sm ${checkedMap[index] ? "line-through text-gray-400" : "text-gray-700 dark:text-gray-300"}`}>
                      {item}
                    </span>
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs text-gray-500">
                {t("aiCompletedProgress")
                  .replace("{done}", String(completedToday))
                  .replace("{total}", String(Math.max(dailyFocusItems.length, 1)))}
              </p>
            </div>

            <div className="rounded-2xl border border-blue-200/70 dark:border-blue-900/50 bg-white/70 dark:bg-gray-900/40 p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-3">
                <WandSparkles className="w-4 h-4 text-blue-600" />
                <h3 className="font-bold text-sm">
                  {t("aiQuickActions")}
                </h3>
              </div>
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => transformPlan("short")}
                  disabled={isTransforming}
                  className="px-3 py-2 rounded-xl border text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60"
                >
                  {t("aiQuickCompress15")}
                </button>
                <button
                  type="button"
                  onClick={() => transformPlan("focus_weak")}
                  disabled={isTransforming}
                  className="px-3 py-2 rounded-xl border text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60"
                >
                  {t("aiQuickFocusWeak")}
                </button>
                <button
                  type="button"
                  onClick={() => transformPlan("simplify")}
                  disabled={isTransforming}
                  className="px-3 py-2 rounded-xl border text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60"
                >
                  {t("aiQuickSimplify")}
                </button>
                {activeAction && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveAction(null);
                      setTransformedPlan(null);
                    }}
                    className="px-3 py-2 rounded-xl text-xs font-semibold text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                  >
                    {t("aiBackToOriginalPlan")}
                  </button>
                )}
              </div>
              <p className="mt-3 text-xs text-gray-500">
                {t("aiActiveDaysStreak")
                  .replace("{activeDays}", String(weekStats.activeDays))
                  .replace("{streakDays}", String(weekStats.streakDays))}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-indigo-200/70 dark:border-indigo-900/50 bg-white/70 dark:bg-gray-900/40 p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-2">
              <WandSparkles className="w-4 h-4 text-indigo-600" />
              <h3 className="font-bold text-sm">
                {t("aiAdaptPlanTitle")}
              </h3>
            </div>
            <textarea
              value={customInstruction}
              onChange={(e) => setCustomInstruction(e.target.value)}
              placeholder={t("aiAdaptPlanPlaceholder")}
              className="w-full min-h-[92px] rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 text-sm"
            />
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                disabled={!customInstruction.trim() || customTransformMutation.isPending}
                onClick={() => customTransformMutation.mutate(customInstruction.trim())}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60"
              >
                {t("aiAdaptPlanUpdate")}
              </button>
            </div>
          </div>

          <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden border border-purple-200/60 dark:border-purple-900/50 bg-white/40 dark:bg-gray-900/40 backdrop-blur-xl shadow-2xl p-4 sm:p-10">
            {/* Decorative backgrounds */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-purple-500/5 rounded-full blur-[100px] -z-10" />
            <div className="absolute bottom-0 left-0 w-60 h-60 bg-blue-500/5 rounded-full blur-[100px] -z-10" />

            <div className="markdown-content prose prose-purple dark:prose-invert max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ ...props }) => <h1 className="text-xl sm:text-3xl font-bold mb-4 sm:mb-6 mt-6 sm:mt-8 pb-3 sm:pb-4 border-b border-purple-100 dark:border-purple-900/50" {...props} />,
                  h2: ({ ...props }) => <h2 className="text-lg sm:text-2xl font-bold mb-3 sm:mb-4 mt-6 sm:mt-8 flex items-center gap-2" {...props} />,
                  h3: ({ ...props }) => <h3 className="text-base sm:text-lg font-bold mb-2 sm:mb-3 mt-4 sm:mt-6 text-purple-700 dark:text-purple-400" {...props} />,
                  p: ({ ...props }) => <p className="mb-3 sm:mb-4 leading-relaxed text-sm sm:text-base text-gray-700 dark:text-gray-300" {...props} />,
                  ul: ({ ...props }) => <ul className="list-disc pl-5 sm:pl-6 space-y-1 sm:space-y-2 mb-4 sm:mb-6 mt-3 sm:mt-4 text-sm sm:text-base text-gray-700 dark:text-gray-300 marker:text-purple-500" {...props} />,
                  li: ({ ...props }) => (
                    <li className="pl-1 leading-relaxed" {...props} />
                  ),
                  strong: ({ ...props }) => <strong className="font-bold text-purple-900 dark:text-purple-100 px-1 py-0.5 rounded bg-purple-50 dark:bg-purple-900/20" {...props} />,
                  code: ({ ...props }) => <code className="bg-gray-100 dark:bg-gray-800 text-purple-600 dark:text-purple-400 rounded-md px-1.5 py-0.5 font-mono text-[0.9em]" {...props} />,
                  blockquote: ({ ...props }) => (
                    <blockquote className="border-l-4 border-purple-500 bg-purple-50/50 dark:bg-purple-900/20 rounded-r-2xl p-4 my-6 italic text-gray-700 dark:text-gray-300" {...props} />
                  ),
                }}
              >
                {shownPlan}
              </ReactMarkdown>
            </div>
            
            <div className="mt-12 pt-8 border-t border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="flex -space-x-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="w-10 h-10 rounded-full border-2 border-white dark:border-gray-900 bg-gray-200 dark:bg-gray-800 flex items-center justify-center">
                      <GraduationCap className="w-5 h-5 text-gray-400" />
                    </div>
                  ))}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t("aiStudentsUseMethod")}
                </p>
              </div>
              
              <Link
                href="/app/courses"
                className="group flex items-center gap-2 text-purple-600 dark:text-purple-400 font-bold hover:gap-3 transition-all"
              >
                {t("aiBrowseCourses")}
                <span aria-hidden>→</span>
              </Link>
            </div>
          </div>
        </BlurFade>
      </motion.div>
    </AnimatePresence>
  );
}
