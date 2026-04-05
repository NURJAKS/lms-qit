"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { isAxiosError } from "axios";
import { api } from "@/api/client";
import { useLanguage } from "@/context/LanguageContext";
import { useAuthStore } from "@/store/authStore";
import { VideoPlayer } from "@/components/courses/VideoPlayer";
import { TestComponent } from "@/components/tests/TestComponent";
import { TopicNotes } from "@/components/courses/TopicNotes";
import { TopicTheoryContent } from "@/components/courses/TopicTheoryContent";
import { ChevronLeft, Lock, Sparkles, Coins, CheckCircle2 } from "lucide-react";
import { getLocalizedTopicTitle } from "@/lib/courseUtils";

function hasVideo(topic: { title: string; video_url?: string | null }): boolean {
  return !!topic.video_url;
}

function buildVideoSrc(
  videoUrl: string | undefined | null,
): string | undefined {
  if (!videoUrl) return undefined;
  return videoUrl.startsWith("http") ? videoUrl : videoUrl.startsWith("/") ? videoUrl : `/uploads/${videoUrl}`;
}

export default function TopicViewPage() {
  const params = useParams();
  const { t } = useLanguage();
  const user = useAuthStore((s) => s.user);
  const userId = user?.id;
  const courseId = params.courseId as string;
  const topicId = params.topicId as string;
  const cId = Number(courseId);
  const tId = Number(topicId);
  const validTopicId = Number.isFinite(tId) && tId > 0;
  const queryClient = useQueryClient();
  const [showTest, setShowTest] = useState(false);
  const [testId, setTestId] = useState<number | null>(null);
  const [showCoinsToast, setShowCoinsToast] = useState(false);
  const [coinsToastMessage, setCoinsToastMessage] = useState<string>("");
  const [actualVideoDuration, setActualVideoDuration] = useState<number | null>(null);
  const [hasShownTheoryCoinsToast, setHasShownTheoryCoinsToast] = useState(false);
  const [localWatchedSeconds, setLocalWatchedSeconds] = useState<number>(0);
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

  const isVideoTopic = Boolean(topic && hasVideo(topic));

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
  const canTakeTest = isVideoTopic ? watchedPercent >= 90 || !!progress?.is_completed : true;
  const canViewTheory = canTakeTest;

  const { data: topicTest } = useQuery({
    queryKey: ["topic-test", tId],
    queryFn: async () => {
      const { data } = await api.get<{ test_id: number }>(`/topics/${tId}/test`);
      return data;
    },
    enabled: validTopicId && !!topic && canTakeTest,
  });

  useEffect(() => {
    if (topicTest?.test_id) setTestId(topicTest.test_id);
  }, [topicTest?.test_id]);

  useEffect(() => {
    setHasShownTheoryCoinsToast(false);
  }, [tId]);

  useEffect(() => {
    setActualVideoDuration(null);
  }, [tId]);

  const lastSavedSeconds = useRef<number>(0);
  const lastProgressTopicIdRef = useRef<number>(tId);

  useEffect(() => {
    if (lastProgressTopicIdRef.current !== tId) {
      lastProgressTopicIdRef.current = tId;
      lastSavedSeconds.current = videoWatched;
    } else if (videoWatched > lastSavedSeconds.current) {
      lastSavedSeconds.current = videoWatched;
    }
  }, [tId, videoWatched]);

  const onVideoProgress = (seconds: number) => {
    setLocalWatchedSeconds(seconds);

    const denom = duration > 0 ? duration : 1;
    const isMajorMilestone = seconds / denom >= 0.9;
    const isNearOrAtEnd = duration > 0 && seconds >= duration - 1;
    const shouldSave =
      Math.abs(seconds - lastSavedSeconds.current) >= 5 || isMajorMilestone || isNearOrAtEnd;

    if (shouldSave) {
      lastSavedSeconds.current = seconds;
      api.post("/progress/video", { topic_id: tId, video_watched_seconds: seconds })
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ["progress", cId, userId] });
          queryClient.invalidateQueries({ queryKey: ["topic", tId] });
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
  };

  const onTestPassed = () => {
    queryClient.invalidateQueries({ queryKey: ["progress", cId, userId] });
    queryClient.invalidateQueries({ queryKey: ["topic", tId] });
    queryClient.invalidateQueries({ queryKey: ["topic-access", tId] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    queryClient.invalidateQueries({ queryKey: ["course-structure", cId] });
    setCoinsToastMessage(
      t("topicCoinsComplete")
        .replace("{coins}", "25")
    );
    setShowCoinsToast(true);
    setTimeout(() => setShowCoinsToast(false), 4000);
    setShowTest(false);
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

  return (
    <div className="relative">
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
      <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">
        {getLocalizedTopicTitle(topic.title, t as any)}
      </h1>

      {!isPremium && (
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
                  {watchedPercent >= 90 ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-amber-500 shrink-0" />
                  )}
                  <span>
                    <strong className="text-amber-600 dark:text-amber-400">
                      {t("topicRewardsTheory").replace("{coins}", "25")}
                    </strong>
                    {watchedPercent >= 90 && (
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

      {!showTest ? (
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
              <div className="bg-black rounded-lg overflow-hidden mb-4 max-w-4xl relative">
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
                  src={buildVideoSrc(topic.video_url)}
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
          {canTakeTest && (
            <div className="mt-6 space-y-3">
              <h3 className="text-base font-semibold text-gray-800 dark:text-white">{t("topicControlTestTitle")}</h3>
              {currentTestId ? (
                <button
                  type="button"
                  onClick={() => setShowTest(true)}
                  className="py-2 px-4 rounded-lg text-white"
                  style={{ background: "var(--qit-primary)" }}
                >
                  {t("topicTestButton")}
                </button>
              ) : (
                <p className="text-gray-500">{t("topicTestLoading")}</p>
              )}
            </div>
          )}
          {!canTakeTest && isVideoTopic && (
            <p className="text-amber-600">{t("topicWatchEnoughToUnlock")}</p>
          )}
        </>
      ) : (
        currentTestId && <TestComponent testId={currentTestId} onComplete={onTestPassed} onCancel={() => setShowTest(false)} />
      )}
    </div>
  );
}
