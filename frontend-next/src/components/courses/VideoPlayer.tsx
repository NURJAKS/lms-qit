"use client";

import { useRef, useState, useEffect } from "react";
import { Gauge } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

interface VideoPlayerProps {
  src?: string;
  duration: number;
  initialWatched: number;
  onProgress: (seconds: number) => void;
  onDurationLoaded?: (seconds: number) => void;
  disabled?: boolean;
  isPremium?: boolean;
}

export function VideoPlayer({ src, duration, initialWatched, onProgress, onDurationLoaded, disabled = false, isPremium = false }: VideoPlayerProps) {
  const { t } = useLanguage();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [watched, setWatched] = useState(initialWatched);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const lastSent = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    if (disabled) {
      // Останавливаем видео при блокировке
      if (videoRef.current) {
        videoRef.current.pause();
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      const el = videoRef.current;
      if (!el || disabled) return;
      const current = Math.floor(el.currentTime);
      if (current > lastSent.current) {
        lastSent.current = current;
        setWatched(current);
        onProgress(current);
      }
    }, 2000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [onProgress, disabled]);

  // Применяем скорость воспроизведения
  useEffect(() => {
    if (videoRef.current && isPremium) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate, isPremium]);

  const handleSpeedChange = (rate: number) => {
    setPlaybackRate(rate);
    setShowSpeedMenu(false);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
  };

  const speedOptions = [1.0, 1.25, 1.5, 2.0];
  const speedMenuRef = useRef<HTMLDivElement>(null);

  // Закрытие меню при клике вне его
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (speedMenuRef.current && !speedMenuRef.current.contains(event.target as Node)) {
        setShowSpeedMenu(false);
      }
    };

    if (showSpeedMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [showSpeedMenu]);

  const videoSrc = src?.startsWith("http") ? src : src ? (src.startsWith("/") ? src : `/uploads/${src}`) : undefined;

  return (
    <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
      {videoSrc ? (
        <>
          <video
            ref={videoRef}
            src={videoSrc}
            controls={!disabled}
            className={`w-full h-full ${disabled ? "opacity-50" : ""}`}
            onLoadedMetadata={() => {
              if (disabled) return;
              const el = videoRef.current;
              if (el && !isNaN(el.duration) && el.duration > 0 && onDurationLoaded) {
                onDurationLoaded(Math.floor(el.duration));
              }
            }}
            onTimeUpdate={() => {
              if (disabled) return;
              const el = videoRef.current;
              if (el && el.currentTime > lastSent.current) {
                const s = Math.floor(el.currentTime);
                lastSent.current = s;
                setWatched(s);
                onProgress(s);
              }
            }}
            onPlay={(e) => {
              if (disabled) {
                e.preventDefault();
                videoRef.current?.pause();
              }
            }}
          >
            {t("videoNotSupported")}
          </video>
          {/* Speed controls для Premium */}
          {isPremium && !disabled && (
            <div className="absolute top-4 right-4 z-10">
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
          <p>{t("noVideoFiles")} {Math.min(100, Math.round((watched / duration) * 100))}%</p>
          <button
            type="button"
            className="ml-4 py-2 px-4 rounded text-white"
            style={{ background: "var(--qit-primary)" }}
            onClick={() => {
              const s = Math.min(duration, watched + 30);
              setWatched(s);
              onProgress(s);
            }}
          >
            {t("simulateSkip")}
          </button>
        </div>
      )}
    </div>
  );
}
