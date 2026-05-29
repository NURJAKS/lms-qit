"use client";

import Link from "next/link";
import { BookOpen, Coins, GraduationCap, Sparkles, Target, Trophy, ArrowRight } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useAuthStore } from "@/store/authStore";
import { useTheme } from "@/context/ThemeContext";
import { getGlassCardStyle, getTextColors } from "@/utils/themeStyles";

type Tip = {
  icon: typeof Target;
  text: string;
};

export function LeaderboardMotivationWidget() {
  const { t, lang } = useLanguage();
  const { user } = useAuthStore();
  const { theme } = useTheme();
  const glassStyle = getGlassCardStyle(theme);
  const textColors = getTextColors(theme);
  const coins = user?.points ?? 0;
  const levelSize = 500; // Purely visual “XP” step size based on current coins.
  const levelProgress = Math.max(0, Math.min(1, (coins % levelSize) / levelSize));
  const progressPct = Math.round(levelProgress * 100);

  const tips: Tip[] = [
    { icon: GraduationCap, text: t("leaderboardMotivationStep1") },
    { icon: BookOpen, text: t("leaderboardMotivationStep2") },
    { icon: Trophy, text: t("leaderboardMotivationStep3") },
  ];

  return (
    <div className="rounded-xl p-4 sm:p-6 overflow-hidden relative" style={glassStyle}>
      {/* Ambient “game board” background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-24 -right-20 w-64 h-64 rounded-full bg-[var(--qit-primary)]/12 blur-3xl animate-pulse" />
        <div className="absolute -bottom-24 -left-16 w-64 h-64 rounded-full bg-purple-500/12 blur-3xl animate-pulse [animation-delay:600ms]" />

        {/* Starfield layers (twinkle via opacity + subtle drift) */}
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,0.55) 1px, transparent 1px)",
            backgroundSize: "34px 34px",
            animation: "lbTwinkle 6.5s ease-in-out infinite",
          }}
        />
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,0.45) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
            animation: "lbTwinkle 4.8s ease-in-out infinite",
            animationDelay: "800ms",
            filter: "blur(0.35px)",
          }}
        />

        {/* Vignette */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/28 dark:to-black/58" />
      </div>

      <div className="relative z-10 flex flex-col gap-4 sm:gap-5 lg:flex-row lg:items-stretch lg:justify-between lg:gap-6">
        <div className="flex min-w-0 flex-1 flex-col space-y-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--qit-primary)] to-purple-600 text-white shadow-lg">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg lg:text-xl font-bold" style={{ color: textColors.primary }}>
                {t("leaderboardMotivationTitle")}
              </h3>
              <p className="text-sm" style={{ color: textColors.secondary }}>
                {t("leaderboardMotivationSubtitle")}
              </p>
            </div>
          </div>

          {/* Quest steps — растягиваются по ширине блока */}
          <div className="relative grid min-w-0 flex-1 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-5">
            {tips.map((tip, index) => {
              const Icon = tip.icon;
              const step = index + 1;
              return (
                <div
                  key={tip.text}
                  className="group relative min-w-0 rounded-2xl border border-white/20 bg-white/75 dark:bg-white/10 p-4 sm:p-5 lg:p-6 backdrop-blur-sm overflow-hidden transition-all duration-300 will-change-transform hover:-translate-y-1 hover:border-[var(--qit-primary)]/40 hover:shadow-[0_14px_40px_rgba(20,184,166,0.18)] focus-within:-translate-y-1 focus-within:border-[var(--qit-primary)]/40 focus-within:shadow-[0_14px_40px_rgba(20,184,166,0.18)] flex flex-col"
                  style={{ ["--step-text-color" as string]: textColors.primary }}
                >
                  {/* Glow — только у наведённой карточки */}
                  <div className="absolute inset-0 bg-gradient-to-br from-[var(--qit-primary)]/20 via-purple-500/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100" />
                  <div className="relative z-10 flex flex-1 flex-col min-h-0 pr-1 sm:pr-2 lg:pr-10">
                    {step < tips.length && (
                      <ArrowRight
                        className="hidden lg:block absolute right-4 top-[2.2rem] -translate-y-1/2 w-5 h-5 text-[var(--qit-primary)]/30 group-hover:text-[var(--qit-primary)]/60 transition-colors duration-300 drop-shadow-[0_0_12px_rgba(20,184,166,0.15)]"
                        aria-hidden="true"
                      />
                    )}

                    <div className="flex items-center">
                      <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--qit-primary)]/15 to-purple-500/10 border border-[var(--qit-primary)]/20 text-[var(--qit-primary)] transition-colors duration-300 group-hover:border-[var(--qit-primary)]/50 group-hover:from-[var(--qit-primary)]/25 group-hover:to-purple-500/20">
                        <div className="absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.9),transparent_55%)] opacity-70" />
                        <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-[var(--qit-primary)] text-sm font-bold text-white">
                          {step}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center">
                      <Icon className="h-5 w-5 shrink-0 text-[var(--qit-primary)] transition-colors duration-300 group-hover:text-[var(--qit-primary)]" />
                    </div>

                    <div className="mt-3 flex min-w-0 flex-1 flex-col">
                      <p className="step-card-text text-sm sm:text-base font-semibold leading-relaxed text-pretty transition-colors duration-300 mobile-safe-text" style={{ color: "var(--step-text-color)" }}>
                        {tip.text}
                      </p>
                      <div className="mt-4 h-2 w-full rounded-full bg-white/20 dark:bg-white/5 overflow-hidden">
                        <div
                          className="h-full w-full origin-left rounded-full bg-gradient-to-r from-[var(--qit-primary)] to-purple-500"
                          style={{ transform: `scaleX(${0.25 + index * 0.25})` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="w-full lg:max-w-xs rounded-2xl border border-[var(--qit-primary)]/15 p-4 relative overflow-hidden">
          {/* Более непрозрачная подложка под текст */}
          <div className="absolute inset-0 bg-white/65 dark:bg-white/10" />
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--qit-primary)]/18 to-purple-500/18" />

          <div className="relative z-10">
            <div className="flex items-center gap-2 text-[var(--qit-primary)] font-semibold mb-2">
              <Coins className="h-4 w-4" />
              <span>{t("profileCoins")}</span>
            </div>
            <p className="text-2xl sm:text-3xl font-bold mb-2" style={{ color: textColors.primary }}>
              {coins.toLocaleString(lang === "kk" ? "kk-KZ" : lang === "ru" ? "ru-RU" : "en-US")}
            </p>
            <p className="text-sm leading-6 mb-4" style={{ color: textColors.secondary }}>
              {t("leaderboardMotivationReward")}
            </p>

          {/* XP / Progress (visual only, derived from coins) */}
          <div className="mb-4 rounded-xl bg-white/55 dark:bg-white/10 border border-white/15 p-3 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold" style={{ color: textColors.secondary }}>
                {t("statsProgress")}
              </p>
              <p className="text-xs font-bold" style={{ color: textColors.primary }}>
                {progressPct}%
              </p>
            </div>
            <div className="h-2.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[var(--qit-primary)] to-purple-500 transition-[width] duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
            <Link
              href="/app/leaderboard"
              className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 min-h-[2.5rem]"
              style={{ background: "linear-gradient(135deg, #14b8a6 0%, #3b82f6 100%)" }}
            >
              <Trophy className="h-4 w-4" />
              {t("leaderboardMotivationOpenRating")}
            </Link>
            <Link
              href="/app/courses"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--qit-primary)]/20 px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-[var(--qit-primary)]/10 min-h-[2.5rem]"
              style={{ color: textColors.primary }}
            >
              <BookOpen className="h-4 w-4" />
              {t("leaderboardMotivationGoCourses")}
            </Link>
          </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .step-card-text {
          color: var(--step-text-color);
        }
        .group:hover .step-card-text,
        .group:focus-within .step-card-text {
          color: var(--qit-primary);
        }
        @keyframes lbTwinkle {
          0% {
            opacity: 0.25;
            transform: translate3d(0, 0, 0);
          }
          50% {
            opacity: 0.55;
            transform: translate3d(0, -1px, 0);
          }
          100% {
            opacity: 0.25;
            transform: translate3d(0, 0, 0);
          }
        }
      `}</style>
    </div>
  );
}
