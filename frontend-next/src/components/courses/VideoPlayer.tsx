"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { Gauge, SkipForward, Loader2, AlertCircle } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

/** Matches progressInterval (ms) below */
const PROGRESS_INTERVAL_SEC = 1;
const MAX_STEP_COEFF = 2;
const MAX_STEP_SLACK = 3;

function maxAllowedForwardStep(playbackRate: number) {
  return playbackRate * PROGRESS_INTERVAL_SEC * MAX_STEP_COEFF + MAX_STEP_SLACK;
}

const ReactPlayer = dynamic(() => import("react-player"), { 
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-black/90 aspect-video rounded-lg">
      <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
    </div>
  )
});

interface VideoPlayerProps {
  src?: string;
  duration: number;
  initialWatched: number;
  onProgress: (seconds: number) => void;
  onDurationLoaded?: (seconds: number) => void;
  disabled?: boolean;
  isPremium?: boolean;
}

export function VideoPlayer({
  src,
  duration,
  initialWatched,
  onProgress,
  onDurationLoaded,
  disabled = false,
  isPremium = false,
}: VideoPlayerProps) {
  const { t } = useLanguage();
  const playerRef = useRef<any>(null);
  const [mounted, setMounted] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [watched, setWatched] = useState(initialWatched);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showSkipWarning, setShowSkipWarning] = useState(false);
  const lastSent = useRef(0);
  /** Furthest honestly reached time (seconds); drives API / UI */
  const legitimateMaxRef = useRef(initialWatched);
  /** Last raw playedSeconds sample (for jump detection) */
  const lastAcceptedSecondsRef = useRef(initialWatched);
  const skipFlagRef = useRef(false);
  const effectiveRate = isPremium ? playbackRate : 1.0;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const videoSrc = src?.startsWith("http") ? src : src ? (src.startsWith("/") ? src : `/uploads/${src}`) : undefined;

  const Player = ReactPlayer as any;

  const [hasSetInitialProgress, setHasSetInitialProgress] = useState(false);

  const syncRefsFromInitial = useCallback((w: number) => {
    legitimateMaxRef.current = w;
    lastAcceptedSecondsRef.current = w;
    lastSent.current = w;
    setWatched(w);
  }, []);

  useEffect(() => {
    syncRefsFromInitial(initialWatched);
    setHasSetInitialProgress(false);
    setIsReady(false);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only reset player bookkeeping when the media URL changes
  }, [src]);

  const showSkipWarningBriefly = useCallback(() => {
    setShowSkipWarning(true);
    setTimeout(() => setShowSkipWarning(false), 2500);
  }, []);

  const clampSeekToLegitimate = useCallback(() => {
    const cap = legitimateMaxRef.current;
    skipFlagRef.current = true;
    if (playerRef.current) {
      playerRef.current.seekTo(cap, "seconds");
    }
    lastAcceptedSecondsRef.current = cap;
    showSkipWarningBriefly();
    setTimeout(() => {
      skipFlagRef.current = false;
    }, 500);
  }, [showSkipWarningBriefly]);

  useEffect(() => {
    if (initialWatched > 0 && !hasSetInitialProgress && playerRef.current) {
      playerRef.current.seekTo(initialWatched, "seconds");
      syncRefsFromInitial(initialWatched);
      setHasSetInitialProgress(true);
    }
  }, [initialWatched, hasSetInitialProgress, mounted, syncRefsFromInitial]);

  const handleProgress = useCallback(
    (state: { playedSeconds: number }) => {
      if (disabled || skipFlagRef.current) return;

      const playedSeconds = state.playedSeconds;
      const maxStep = maxAllowedForwardStep(effectiveRate);
      const lastAcc = lastAcceptedSecondsRef.current;
      const legit = legitimateMaxRef.current;
      const delta = playedSeconds - lastAcc;

      const forwardJumpBeyondLegit =
        delta > maxStep && playedSeconds > legit + 0.01;

      if (forwardJumpBeyondLegit) {
        clampSeekToLegitimate();
        return;
      }

      lastAcceptedSecondsRef.current = playedSeconds;

      const floored = Math.floor(playedSeconds);
      if (floored > legit) {
        legitimateMaxRef.current = floored;
      }

      if (floored > lastSent.current) {
        lastSent.current = floored;
        setWatched(floored);
        onProgress(floored);
      }
    },
    [disabled, onProgress, effectiveRate, clampSeekToLegitimate],
  );

  const handleSeek = useCallback(
    (seconds: number) => {
      if (disabled) return;

      const legit = legitimateMaxRef.current;
      const maxStep = maxAllowedForwardStep(effectiveRate);
      if (seconds > legit + maxStep) {
        clampSeekToLegitimate();
      }
    },
    [disabled, effectiveRate, clampSeekToLegitimate],
  );

  const handleEnded = useCallback(() => {
    if (disabled) return;

    let playerDur = 0;
    try {
      playerDur = Math.floor(playerRef.current?.getDuration?.() ?? 0);
    } catch {
      playerDur = 0;
    }
    const known = Math.max(0, Math.floor(duration));
    const target =
      playerDur > 0 && known > 0 ? Math.min(playerDur, known) : Math.max(playerDur, known);

    if (target <= 0) return;

    legitimateMaxRef.current = target;
    lastAcceptedSecondsRef.current = target;

    if (target > lastSent.current) {
      lastSent.current = target;
      setWatched(target);
      onProgress(target);
    }
  }, [disabled, duration, onProgress]);

  const handleSpeedChange = (rate: number) => {
    setPlaybackRate(rate);
    setShowSpeedMenu(false);
  };

  const speedOptions = [1.0, 1.25, 1.5, 2.0];
  const speedMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (speedMenuRef.current && !speedMenuRef.current.contains(event.target as Node)) {
        setShowSpeedMenu(false);
      }
    };
    if (showSpeedMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showSpeedMenu]);

  if (!mounted) {
    return (
      <div className="relative bg-black rounded-lg overflow-hidden aspect-video flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="relative w-full bg-black rounded-lg overflow-hidden aspect-video">
      {videoSrc ? (
        <>
          {showSkipWarning && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 bg-black/80 text-white px-4 py-2 rounded-lg text-sm font-medium backdrop-blur-sm border border-white/20 animate-in fade-in slide-in-from-top-2">
              <SkipForward className="w-4 h-4 text-amber-400" />
              <span>{t("videoNoSkipWarning")}</span>
            </div>
          )}

          {!isReady && !error && (
            <div className="absolute inset-0 z-[25] flex items-center justify-center bg-black/60 pointer-events-none">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-10 h-10 text-purple-500 animate-spin" />
                <span className="text-white text-sm font-medium">{t("loading")}...</span>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/80 p-6">
              <div className="text-center text-white">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                <p className="font-semibold mb-2">{t("videoLoadError")}</p>
                <button 
                  onClick={() => { setError(null); setIsReady(false); }}
                  className="px-4 py-2 bg-purple-600 rounded-lg text-sm hover:bg-purple-700 transition-colors"
                >
                  {t("retry")}
                </button>
              </div>
            </div>
          )}

          <div className="absolute inset-0 z-0 min-h-0 overflow-hidden [&>div]:!h-full [&>div]:!w-full [&>div]:!min-h-0">
            <Player
              ref={playerRef}
              url={videoSrc}
              controls={!disabled}
              width="100%"
              height="100%"
              playsinline
              progressInterval={1000}
              playing={false} // Force manual play to avoid autoplay issues
              playbackRate={isPremium ? playbackRate : 1.0}
              onProgress={handleProgress}
              onSeek={handleSeek}
              onEnded={handleEnded}
              onError={(e: any) => {
                console.error("Video error:", e);
                setError(t("videoLoadError"));
              }}
              onDuration={(dur: number) => {
                if (onDurationLoaded) onDurationLoaded(Math.floor(dur));
              }}
              onReady={() => {
                setIsReady(true);
                if (initialWatched > 0 && playerRef.current && !hasSetInitialProgress) {
                  playerRef.current.seekTo(initialWatched, "seconds");
                  syncRefsFromInitial(initialWatched);
                  setHasSetInitialProgress(true);
                }
              }}
              config={{
                youtube: {
                  playerVars: {
                    showinfo: 0,
                    rel: 0,
                    modestbranding: 1,
                    cc_load_policy: 1,
                    cc_lang_pref: "kk",
                    hl: "kk",
                    origin: typeof window !== "undefined" ? window.location.origin : undefined,
                  },
                },
                file: {
                  attributes: {
                    controlsList: "nodownload",
                    preload: "auto",
                  },
                },
              }}
            />
          </div>

          {isPremium && !disabled && (
            <div className="absolute top-4 right-4 z-30 pointer-events-auto">
              <div className="relative" ref={speedMenuRef}>
                <button
                  type="button"
                  onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                  className="bg-black/70 hover:bg-black/90 text-white px-3 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors backdrop-blur-sm"
                  title={t("playbackSpeed")}
                >
                  <Gauge className="w-4 h-4" />
                  <span>{playbackRate}x</span>
                </button>
                {showSpeedMenu && (
                  <div className="absolute top-full right-0 mt-2 bg-black/90 backdrop-blur-sm rounded-lg overflow-hidden shadow-xl border border-white/10">
                    {speedOptions.map((rate) => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => handleSpeedChange(rate)}
                        className={`w-full px-4 py-2 text-left text-sm text-white hover:bg-white/10 transition-colors ${
                          playbackRate === rate ? "bg-purple-600/50 font-semibold" : ""
                        }`}
                      >
                        {rate}x
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gray-900">
          <p>{t("noVideoFiles")}</p>
        </div>
      )}
    </div>
  );
}
