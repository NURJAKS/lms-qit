"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef, useCallback } from "react";
import { isAxiosError } from "axios";
import { api } from "@/api/client";
import { useLanguage } from "@/context/LanguageContext";
import { useAuthStore } from "@/store/authStore";
import { VideoPlayer } from "@/components/courses/VideoPlayer";
import { TestComponent } from "@/components/tests/TestComponent";
import { TopicNotes } from "@/components/courses/TopicNotes";
import { TopicTheoryContent } from "@/components/courses/TopicTheoryContent";
import { TopicSynopsisSection } from "@/components/courses/TopicSynopsisSection";
import { TopicAssignmentsInlineSection } from "@/components/courses/TopicAssignmentsInlineSection";
import { ChevronLeft, Lock, Sparkles, Coins, CheckCircle2 } from "lucide-react";
import { getLocalizedTopicTitle } from "@/lib/courseUtils";
import type { TranslationKey } from "@/i18n/translations";

interface Structure {
  course_id: number;
  modules: Array<{
    id: number;
    title: string;
    order_number: number;
    topics: Array<{ id: number; title: string; order_number: number }>;
  }>;
}


function hasVideo(topic: { title: string; video_url?: string | null }): boolean {
  return !!topic.video_url;
}

function buildVideoSrc(
  videoUrl: string | undefined | null,
): string | undefined {
  if (!videoUrl || videoUrl === "undefined" || videoUrl === "null") return undefined;
  return videoUrl.startsWith("http") ? videoUrl : videoUrl.startsWith("/") ? videoUrl : `/uploads/${videoUrl}`;
}

function isWebCourseTitle(title: string | undefined | null): boolean {
  const value = (title ?? "").trim().toLowerCase();
  if (!value) return false;
  return (
    value.includes("web") ||
    value.includes("веб") ||
    value.includes("html") ||
    value.includes("css") ||
    value.includes("javascript") ||
    value.includes("js")
  );
}

function topicFlowBlockMessage(reason: string, t: (key: TranslationKey) => string): string {
  const keys: Record<string, TranslationKey> = {
    no_groups: "topicFlowNoGroups",
    video: "topicFlowTheoryLockedUntilVideo",
    synopsis: "topicFlowSynopsisRequired",
    no_assignment: "topicFlowWaitTeacherAssignment",
    wait_grade: "topicFlowWaitTeacherGrade",
  };
  const k = keys[reason];
  return k ? t(k) : t("topicFlowTestBlocked");
}

export default function TopicViewPage() {
  const params = useParams();
  const { t } = useLanguage();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const userId = user?.id;
  const courseId = params.courseId as string;
  const topicId = params.topicId as string;
  const cId = Number(courseId);
  const tId = Number(topicId);
  const validTopicId = Number.isFinite(tId) && tId > 0;
  const queryClient = useQueryClient();
  const [showTest, setShowTest] = useState(false);
  const [testAttemptKey, setTestAttemptKey] = useState(0);
  const [testId, setTestId] = useState<number | null>(null);
  const [showCoinsToast, setShowCoinsToast] = useState(false);
  const [coinsToastMessage, setCoinsToastMessage] = useState<string>("");
  const [actualVideoDuration, setActualVideoDuration] = useState<number | null>(null);
  const [hasShownTheoryCoinsToast, setHasShownTheoryCoinsToast] = useState(false);
  const [localWatchedSeconds, setLocalWatchedSeconds] = useState<number>(0);
  const [topicTab, setTopicTab] = useState<"lesson" | "supplementary">("lesson");
  const isPremium = user?.is_premium === 1;

  const {
    data: topic,
    isPending: topicPending,
    isError: topicError,
    error: topicErr,
  } = useQuery({
    queryKey: ["topic", tId],
    queryFn: async () => {
      const { data } = await api.get<{
        id: number;
        title: string;
        video_url?: string;
        video_duration?: number;
        description?: string | null;
        theory_unlocked?: boolean;
      }>(`/topics/${tId}`);
      return data;
    },
    enabled: validTopicId,
  });

  const { data: course } = useQuery({
    queryKey: ["course", cId],
    queryFn: async () => {
      const { data } = await api.get<{ id: number; title: string }>(`/courses/${cId}`);
      return data;
    },
    enabled: Number.isFinite(cId) && cId > 0,
  });

  const { data: structure } = useQuery({
    queryKey: ["course-structure", cId],
    queryFn: async () => {
      const { data } = await api.get<Structure>(`/courses/${cId}/structure`);
      return data;
    },
    enabled: !!cId,
  });

  const effectiveVideoUrl = topic?.video_url;

  const {
    data: access,
    isPending: accessPending,
    isError: accessError,
  } = useQuery({
    queryKey: ["topic-access", tId],
    queryFn: async () => {
      const { data } = await api.get<{ allowed: boolean }>(`/topics/${tId}/access`);
      return data;
    },
    enabled: validTopicId,
  });

  const { data: progressList = [] } = useQuery({
    queryKey: ["progress", cId, userId],
    queryFn: async () => {
      const { data } = await api.get<Array<{ topic_id: number; is_completed: boolean; video_watched_seconds?: number }>>(`/progress/course/${cId}`);
      return data;
    },
    enabled: !!cId && userId != null,
  });

  const isVideoTopic = Boolean(topic && hasVideo({ ...topic, video_url: effectiveVideoUrl ?? null }));

  useEffect(() => {
    const progress = progressList.find((p) => p.topic_id === tId);
    if (progress) {
      setLocalWatchedSeconds(progress.video_watched_seconds ?? 0);
    }
  }, [progressList, tId]);

  const { data: dailyVideoLimit } = useQuery({
    queryKey: ["daily-video-limit", userId],
    queryFn: async () => {
      const { data } = await api.get<{
        is_premium: boolean;
        used_seconds: number;
        limit_seconds: number;
        remaining_seconds: number;
        is_allowed: boolean;
      }>("/progress/daily-video-limit");
      return data;
    },
    enabled: userId != null && !!isVideoTopic && !isPremium,
    refetchInterval: 30000,
  });

  const progress = progressList.find((p) => p.topic_id === tId);
  const videoWatched = progress?.video_watched_seconds ?? 0;
  const dbDuration = topic?.video_duration ?? 300;
  const duration = actualVideoDuration ?? dbDuration;
  const watchedPercent = duration ? Math.min(100, (localWatchedSeconds / duration) * 100) : 0;
  const theoryUnlockedLocal = isVideoTopic ? watchedPercent >= 90 || !!progress?.is_completed : true;

  const { data: flow } = useQuery({
    queryKey: ["topic-flow", tId],
    queryFn: async () => {
      const { data } = await api.get<{
        has_course_groups: boolean;
        video_ok: boolean;
        theory_unlocked: boolean;
        synopsis_done: boolean;
        homework_exists: boolean;
        homework_graded: boolean;
        can_take_test: boolean;
        block_reason: string;
        topic_assignment_ids: number[];
      }>(`/topics/${tId}/flow-status`);
      return data;
    },
    enabled: validTopicId && !!access?.allowed,
  });

  const theoryUnlocked = flow?.theory_unlocked ?? theoryUnlockedLocal;
  const canViewTheory = theoryUnlocked;

  const { data: topicTest } = useQuery({
    queryKey: ["topic-test", tId],
    queryFn: async () => {
      try {
        const { data } = await api.get<{ test_id: number }>(`/topics/${tId}/test`);
        return data;
      } catch (e) {
        if (isAxiosError(e) && e.response?.status === 404) return null;
        throw e;
      }
    },
    enabled: validTopicId && !!topic && !!access?.allowed,
  });

  useEffect(() => {
    if (topicTest?.test_id) setTestId(topicTest.test_id);
    else setTestId(null);
  }, [topicTest?.test_id, topicTest]);

  useEffect(() => {
    setHasShownTheoryCoinsToast(false);
  }, [tId]);

  useEffect(() => {
    setTopicTab("lesson");
  }, [tId]);

  useEffect(() => {
    setActualVideoDuration(null);
  }, [tId]);

  const lastSavedSeconds = useRef<number>(0);
  const lastProgressTopicIdRef = useRef<number>(tId);
  const lastDurationSyncRef = useRef<string>("");

  useEffect(() => {
    if (lastProgressTopicIdRef.current !== tId) {
      lastProgressTopicIdRef.current = tId;
      lastSavedSeconds.current = videoWatched;
    } else if (videoWatched > lastSavedSeconds.current) {
      lastSavedSeconds.current = videoWatched;
    }
  }, [tId, videoWatched]);

  const onVideoProgress = useCallback((seconds: number) => {
    setLocalWatchedSeconds(seconds);

    const denom = duration > 0 ? duration : 1;
    const isMajorMilestone = seconds / denom >= 0.9;
    const isNearOrAtEnd = duration > 0 && seconds >= duration - 1;
    const shouldSave =
      Math.abs(seconds - lastSavedSeconds.current) >= 5 || isMajorMilestone || isNearOrAtEnd;

    if (shouldSave) {
      lastSavedSeconds.current = seconds;
      api.post("/progress/video", {
        topic_id: tId,
        video_watched_seconds: seconds,
        video_duration: duration > 0 ? Math.round(duration) : undefined,
      })
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ["progress", cId, userId] });
          queryClient.invalidateQueries({ queryKey: ["topic", tId] });
          queryClient.invalidateQueries({ queryKey: ["topic-flow", tId] });
          queryClient.invalidateQueries({ queryKey: ["daily-video-limit", userId] });
          queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });

          if (topic && duration > 0) {
            const currentPercent = (seconds / duration) * 100;
            if (currentPercent >= 90 && !hasShownTheoryCoinsToast && !progress?.is_completed) {
              setCoinsToastMessage(
                t("topicCoinsTheory")
                  .replace("{coins}", "25")
              );
              setShowCoinsToast(true);
              setHasShownTheoryCoinsToast(true);
              setTimeout(() => setShowCoinsToast(false), 4000);
            }
          }
        })
        .catch((error) => {
          if (error?.response?.status === 429) {
            queryClient.invalidateQueries({ queryKey: ["daily-video-limit", userId] });
          }
        });
    }
  }, [cId, duration, hasShownTheoryCoinsToast, progress?.is_completed, queryClient, t, tId, topic, userId]);

  useEffect(() => {
    if (!validTopicId || !isVideoTopic || actualVideoDuration == null || actualVideoDuration <= 0 || localWatchedSeconds <= 0) {
      return;
    }
    const syncKey = `${tId}:${Math.round(actualVideoDuration)}`;
    if (lastDurationSyncRef.current === syncKey) return;
    lastDurationSyncRef.current = syncKey;
    api.post("/progress/video", {
      topic_id: tId,
      video_watched_seconds: Math.floor(localWatchedSeconds),
      video_duration: Math.round(actualVideoDuration),
    })
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["topic", tId] });
        queryClient.invalidateQueries({ queryKey: ["topic-flow", tId] });
      })
      .catch(() => {
        lastDurationSyncRef.current = "";
      });
  }, [actualVideoDuration, cId, isVideoTopic, localWatchedSeconds, queryClient, tId, userId, validTopicId]);

  const goToNextTopicOrCourse = useCallback(() => {
    if (!structure?.modules?.length) {
      router.push(`/app/courses/${cId}`);
      return;
    }
    const flattened: number[] = [];
    const sortedModules = [...structure.modules].sort((a, b) => (a.order_number ?? 0) - (b.order_number ?? 0));
    for (const mod of sortedModules) {
      const sortedTopics = [...(mod.topics || [])].sort((a, b) => (a.order_number ?? 0) - (b.order_number ?? 0));
      for (const topic of sortedTopics) {
        flattened.push(topic.id);
      }
    }

    const currentIndex = flattened.indexOf(tId);
    if (currentIndex !== -1 && currentIndex < flattened.length - 1) {
      const nextTopicId = flattened[currentIndex + 1];
      router.push(`/app/courses/${cId}/topic/${nextTopicId}`);
    } else {
      router.push(`/app/courses/${cId}`);
    }
  }, [structure, router, cId, tId]);

  const onTestPassed = () => {
    queryClient.invalidateQueries({ queryKey: ["progress", cId, userId] });
    queryClient.invalidateQueries({ queryKey: ["topic", tId] });
    queryClient.invalidateQueries({ queryKey: ["topic-access", tId] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    queryClient.invalidateQueries({ queryKey: ["course-structure", cId] });
    queryClient.invalidateQueries({ queryKey: ["topic-flow", tId] });
    setCoinsToastMessage(
      t("topicCoinsComplete")
        .replace("{coins}", "25")
    );
    setShowCoinsToast(true);
    setTimeout(() => setShowCoinsToast(false), 4000);
    setShowTest(false);
    goToNextTopicOrCourse();
  };

  const onNextTopic = () => {
    goToNextTopicOrCourse();
  };

  if (!validTopicId) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <p className="text-red-600 dark:text-red-400 font-medium mb-4">{t("topicInvalidId")}</p>
        <Link href={`/app/courses/${cId}`} className="text-[#1a237e] dark:text-[#00b0ff] hover:underline">
          {t("topicBackToCourse")}
        </Link>
      </div>
    );
  }

  if (topicError) {
    const status = isAxiosError(topicErr) ? topicErr.response?.status : undefined;
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <p className="text-red-600 dark:text-red-400 font-medium mb-2">{t("topicLoadError")}</p>
        {status != null && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">HTTP {status}</p>
        )}
        <Link href={`/app/courses/${cId}`} className="text-[#1a237e] dark:text-[#00b0ff] hover:underline">
          {t("topicBackToCourse")}
        </Link>
      </div>
    );
  }

  if (topicPending || !topic) {
    return <p className="text-gray-500">{t("loading")}</p>;
  }

  if (accessError) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <p className="text-red-600 dark:text-red-400 font-medium mb-4">{t("topicAccessLoadError")}</p>
        <Link href={`/app/courses/${cId}`} className="text-[#1a237e] dark:text-[#00b0ff] hover:underline">
          {t("topicBackToCourse")}
        </Link>
      </div>
    );
  }

  if (accessPending || !access) {
    return <p className="text-gray-500">{t("loading")}</p>;
  }

  if (!access.allowed) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <p className="text-amber-600 font-medium mb-4">{t("topicAccessCompletePrevTopic")}</p>
        <Link href={`/app/courses/${cId}`} className="text-[#1a237e] dark:text-[#00b0ff] hover:underline">
          {t("topicBackToCourse")}
        </Link>
      </div>
    );
  }

  const currentTestId = topicTest?.test_id ?? testId;
  const showSupplementarySlots = canViewTheory && (flow == null || flow.has_course_groups);

  return (
    <div className="relative w-full max-w-4xl mx-auto px-3 sm:px-4 lg:px-0">
      {showCoinsToast && (
        <div
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-white shadow-lg animate-in slide-in-from-bottom-5"
          role="status"
        >
          <Coins className="w-5 h-5" />
          <span className="font-semibold">{coinsToastMessage || t("courseTopicComplete")}</span>
        </div>
      )}
      <Link href={`/app/courses/${cId}`} className="inline-flex items-center gap-1 text-gray-600 dark:text-gray-400 hover:text-[#1a237e] dark:hover:text-[#00b0ff] mb-4">
        <ChevronLeft className="w-4 h-4" /> {t("topicBackToCourse")}
      </Link>
      <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-800 dark:text-white mb-4 break-words">
        {getLocalizedTopicTitle(topic.title, t as any)}
      </h1>

      {!showTest && (
        <nav
          className="mb-6 flex flex-nowrap gap-2 overflow-x-auto overscroll-x-contain border-b border-gray-200 px-0 pb-0.5 [-webkit-overflow-scrolling:touch] dark:border-gray-600 sm:gap-6 scroll-px-0"
          aria-label={t("courseSectionsAria")}
        >
          <button
            type="button"
            onClick={() => setTopicTab("lesson")}
            className={`shrink-0 whitespace-nowrap pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              topicTab === "lesson"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-600 dark:text-gray-400 hover:opacity-90"
            }`}
          >
            {t("topicTabMain")}
          </button>
          <button
            type="button"
            onClick={() => setTopicTab("supplementary")}
            className={`shrink-0 whitespace-nowrap pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              topicTab === "supplementary"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-600 dark:text-gray-400 hover:opacity-90"
            }`}
          >
            {t("supplementaryMaterialsTab")}
          </button>
        </nav>
      )}

      {!isPremium && topicTab === "lesson" && (
      <div className="mb-6 p-4 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
            <Coins className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-800 dark:text-white mb-2 flex items-center gap-2">
              <span>{t("topicRewardsTitle")}</span>
            </h3>
            <div className="space-y-2 text-sm">
              {isVideoTopic && (
                <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                  {watchedPercent >= 99 ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-amber-500 shrink-0" />
                  )}
                  <span>
                    <strong className="text-amber-600 dark:text-amber-400">
                      {t("topicRewardsTheory").replace("{coins}", "25")}
                    </strong>
                    {watchedPercent >= 99 && (
                      <span className="text-green-600 dark:text-green-400 ml-1">✓</span>
                    )}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                {progress?.is_completed ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-amber-500 shrink-0" />
                )}
                <span>
                  <strong className="text-amber-600 dark:text-amber-400">
                    {t("topicRewardsTest").replace("{coins}", "25")}
                  </strong>
                  {progress?.is_completed && (
                    <span className="text-green-600 dark:text-green-400 ml-1">✓</span>
                  )}
                </span>
              </div>
              <div className="pt-2 border-t border-amber-200 dark:border-amber-800">
                <p className="text-gray-600 dark:text-gray-400">
                  {t("topicRewardsTotal").replace("{coins}", "50")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      )}

      {!showTest && topicTab === "lesson" ? (
        <>
          {isVideoTopic ? (
            <>
              {isPremium && <TopicNotes topicId={tId} />}
              {!isPremium && dailyVideoLimit && !dailyVideoLimit.is_allowed && (
                <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Lock className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <p className="text-yellow-800 dark:text-yellow-200 font-medium mb-1">
                        {t("videoDailyLimitReached")}
                      </p>
                      <p className="text-yellow-700 dark:text-yellow-300 text-sm mb-2">
                        {t("videoDailyLimitMessage")?.replace("{used}", String(Math.floor(dailyVideoLimit.used_seconds / 60)))?.replace("{limit}", String(Math.floor(dailyVideoLimit.limit_seconds / 60))) || `Просмотрено сегодня: ${Math.floor(dailyVideoLimit.used_seconds / 60)} мин / ${Math.floor(dailyVideoLimit.limit_seconds / 60)} мин`}
                      </p>
                      <Link
                        href="/app/premium"
                        className="text-yellow-600 dark:text-yellow-400 hover:underline text-sm inline-flex items-center gap-1"
                      >
                        <Sparkles className="w-4 h-4" />
                        {t("upgradeToPremium")}
                      </Link>
                    </div>
                  </div>
                </div>
              )}
              {!isPremium && dailyVideoLimit && dailyVideoLimit.is_allowed && dailyVideoLimit.remaining_seconds < 1800 && (
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-blue-800 dark:text-blue-200 text-sm">
                    {t("videoDailyLimitWarning")?.replace("{remaining}", String(Math.floor(dailyVideoLimit.remaining_seconds / 60))) || `Осталось времени просмотра сегодня: ${Math.floor(dailyVideoLimit.remaining_seconds / 60)} мин`}
                  </p>
                </div>
              )}
              <div className="bg-black rounded-lg overflow-hidden mb-4 w-full max-w-4xl mx-auto relative">
                {!isPremium && dailyVideoLimit && !dailyVideoLimit.is_allowed && (
                  <div className="absolute inset-0 bg-black/70 z-10 flex items-center justify-center">
                    <div className="text-center text-white p-6">
                      <Lock className="w-12 h-12 mx-auto mb-4" />
                      <p className="text-lg font-semibold mb-2">
                        {t("videoDailyLimitReached")}
                      </p>
                      <Link
                        href="/app/premium"
                        className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-lg text-white font-semibold"
                        style={{ background: "linear-gradient(135deg, #7c3aed, #5b21b6)" }}
                      >
                        <Sparkles className="w-5 h-5" />
                        {t("upgradeToPremium")}
                      </Link>
                    </div>
                  </div>
                )}
                <VideoPlayer
                  key={`video-${tId}`}
                  src={buildVideoSrc(effectiveVideoUrl)}
                  duration={duration}
                  initialWatched={videoWatched}
                  onProgress={onVideoProgress}
                  onDurationLoaded={setActualVideoDuration}
                  disabled={!isPremium && dailyVideoLimit && !dailyVideoLimit.is_allowed}
                  isPremium={isPremium}
                />
              </div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-500">
                  {t("topicWatchedPercent").replace(
                    "{percent}",
                    String(Math.round(watchedPercent))
                  )}
                </p>
                {!isPremium && dailyVideoLimit && (
                  <p className="text-sm text-gray-500">
                    {t("videoDailyLimitIndicator")?.replace("{used}", String(Math.floor(dailyVideoLimit.used_seconds / 60)))?.replace("{limit}", String(Math.floor(dailyVideoLimit.limit_seconds / 60))) || `Время просмотра сегодня: ${Math.floor(dailyVideoLimit.used_seconds / 60)} мин / ${Math.floor(dailyVideoLimit.limit_seconds / 60)} мин`}
                  </p>
                )}
              </div>
              {isVideoTopic && !canViewTheory && (
                <div className="mb-6 flex items-start gap-3 p-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-900/20">
                  <Lock className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-800 dark:text-amber-200">{t("topicTheoryLockedUntilVideo")}</p>
                </div>
              )}
              {canViewTheory && topic.description && (
                <div className="mb-6">
                  <TopicTheoryContent content={topic.description} />
                </div>
              )}
            </>
          ) : (
            <>
              <div className="mb-6">
                {topic.description ? (
                  <TopicTheoryContent content={topic.description} />
                ) : (
                  <p className="text-gray-600 dark:text-gray-300">{t("materialPreparing")}</p>
                )}
              </div>
              {isPremium && <TopicNotes topicId={tId} />}
            </>
          )}
          {flow && !progress?.is_completed && !flow.can_take_test && flow.block_reason && flow.block_reason !== "ok" && (
            <div className="mt-4 mb-2 flex flex-col gap-2 p-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-900/20">
              <p className="text-sm text-amber-900 dark:text-amber-100">{topicFlowBlockMessage(flow.block_reason, t)}</p>
              {(flow.block_reason === "no_assignment" || flow.block_reason === "wait_grade") && (
                <Link
                  href={`/app/courses/${cId}?tab=classwork`}
                  className="text-sm font-medium text-[#1a237e] dark:text-[#00b0ff] hover:underline w-fit"
                >
                  {t("topicFlowGoToClassworkOptional")}
                </Link>
              )}
            </div>
          )}
          {!flow && isVideoTopic && !theoryUnlockedLocal && (
            <p className="text-amber-600 dark:text-amber-400 mt-2">{t("topicWatchEnoughToUnlock")}</p>
          )}
          {flow?.can_take_test && (
            <div className="mt-6 space-y-3">
              <h3 className="text-base font-semibold text-gray-800 dark:text-white">{t("topicControlTestTitle")}</h3>
              {currentTestId ? (
                <button
                  type="button"
                  onClick={() => setShowTest(true)}
                  className="py-2 px-4 rounded-lg text-white font-semibold hover:opacity-90 transition-opacity"
                  style={{ background: "var(--qit-primary)" }}
                >
                  {t("topicTestButton")}
                </button>
              ) : (
                <p className="text-gray-500">{t("topicTestNone")}</p>
              )}
            </div>
          )}

          {progress?.is_completed && (
            <div className="mt-8 p-6 rounded-2xl border-2 border-green-200 dark:border-green-900/40 bg-green-50/50 dark:bg-green-900/10 text-center animate-in fade-in zoom-in duration-500">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                {t("topicFlowCongratulations")}
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                {t("topicTestCongratsBody")}
              </p>
              <button
                type="button"
                onClick={onNextTopic}
                className="inline-flex items-center gap-2 py-3 px-8 rounded-xl text-white font-bold shadow-lg shadow-green-500/20 hover:scale-105 transition-all"
                style={{ background: "#2ecc71" }}
              >
                {t("topicFlowNextTopic")}
                <CheckCircle2 className="w-5 h-5" />
              </button>
            </div>
          )}
        </>
      ) : !showTest && topicTab === "supplementary" ? (
        <div className="space-y-2">
          {!canViewTheory && isVideoTopic ? (
            <div className="mb-6 flex items-start gap-3 p-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-900/20">
              <Lock className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800 dark:text-amber-200">{t("topicTheoryLockedUntilVideo")}</p>
            </div>
          ) : flow && !flow.has_course_groups ? (
            <div className="mb-6 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/30">
              <p className="text-sm text-gray-700 dark:text-gray-300">{t("topicFlowNoGroups")}</p>
            </div>
          ) : showSupplementarySlots ? (
            <>
              <TopicSynopsisSection topicId={tId} courseId={cId} />
              <TopicAssignmentsInlineSection courseId={cId} topicId={tId} />
            </>
          ) : null}
        </div>
      ) : showTest ? (
        currentTestId && (
          <TestComponent
            key={testAttemptKey}
            testId={currentTestId}
            onComplete={onTestPassed}
            onCancel={() => setShowTest(false)}
            onRetake={() => {
              setTestAttemptKey((k) => k + 1);
              setShowTest(true);
            }}
            passedContinueLabelKey="topicFlowNextTopic"
          />
        )
      ) : null}
    </div>
  );
}
