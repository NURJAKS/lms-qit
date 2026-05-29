"use client";

import { Trophy } from "lucide-react";
import { AnimatedGradientText } from "@/components/ui/animated-gradient-text";
import { AnimatedShinyText } from "@/components/ui/animated-shiny-text";
import { BorderBeam } from "@/components/ui/border-beam";
import { BlurFade } from "@/components/ui/blur-fade";
import { useLanguage } from "@/context/LanguageContext";
import { cn } from "@/lib/utils";

interface LeaderboardHeaderProps {
  lastReward?: { date: string; rank: number; amount: number } | null;
}

export function LeaderboardHeader({ lastReward }: LeaderboardHeaderProps) {
  const { t, lang } = useLanguage();

  return (
    <BlurFade delay={0.1} inView className="relative">
      <div className="relative rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl p-6 shadow-lg overflow-hidden">
        <BorderBeam
          size={100}
          duration={8}
          colorFrom="#ffaa40"
          colorTo="#9c40ff"
          borderWidth={2}
        />
        
        <div className="relative z-10 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Trophy className="w-10 h-10 text-amber-500 dark:text-amber-400 animate-bounce" />
                <div className="absolute inset-0 bg-amber-500/20 blur-xl rounded-full" />
              </div>
              <div>
                <AnimatedGradientText
                  className="text-3xl md:text-4xl font-bold"
                  colorFrom="#ffaa40"
                  colorTo="#9c40ff"
                  speed={0.8}
                >
                  {t("leaderboardTitle")}
                </AnimatedGradientText>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 leading-relaxed max-w-3xl">
              {t("leaderboardRankingHint")}
            </p>
            <div className="mt-3 p-4 rounded-xl bg-gray-50/50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-700/50">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                🎁 {lang === "kk" ? "Күнделікті сыйлықтар (Топ-5)" : lang === "en" ? "Daily Rewards (Top-5)" : "Ежедневные награды (Топ-5)"}
              </p>
              <div className="grid grid-cols-5 gap-2 text-center">
                {/* 1st Place */}
                <div className="flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 shadow-sm shadow-amber-500/5 group hover:scale-[1.05] transition-transform min-h-[60px] sm:min-h-[70px] h-auto">
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-amber-500 text-white font-bold text-xs flex items-center justify-center shadow-md">1</div>
                  <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 whitespace-nowrap">1000 🪙</span>
                </div>
                
                {/* 2nd Place */}
                <div className="flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl bg-slate-400/10 border border-slate-400/20 shadow-sm group hover:scale-[1.05] transition-transform min-h-[60px] sm:min-h-[70px] h-auto">
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-slate-400 text-white font-bold text-xs flex items-center justify-center shadow-md">2</div>
                  <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">700 🪙</span>
                </div>

                {/* 3rd Place */}
                <div className="flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl bg-amber-700/10 border border-amber-700/20 shadow-sm group hover:scale-[1.05] transition-transform min-h-[60px] sm:min-h-[70px] h-auto">
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-amber-700 text-white font-bold text-xs flex items-center justify-center shadow-md">3</div>
                  <span className="text-[10px] font-bold text-amber-950 dark:text-amber-400 whitespace-nowrap">500 🪙</span>
                </div>

                {/* 4th Place */}
                <div className="flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 shadow-sm group hover:scale-[1.05] transition-transform min-h-[60px] sm:min-h-[70px] h-auto">
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-blue-500 text-white font-bold text-xs flex items-center justify-center shadow-md">4</div>
                  <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 whitespace-nowrap">250 🪙</span>
                </div>

                {/* 5th Place */}
                <div className="flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 shadow-sm group hover:scale-[1.05] transition-transform min-h-[60px] sm:min-h-[70px] h-auto">
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-purple-500 text-white font-bold text-xs flex items-center justify-center shadow-md">5</div>
                  <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300 whitespace-nowrap">100 🪙</span>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400 justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span>{lang === "kk" ? "Есептеу 00:05-те" : lang === "en" ? "Calculation at 00:05" : "Расчет в 00:05"}</span>
              </div>
            </div>
            
            {lastReward && (
              <BlurFade delay={0.3} inView>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-amber-500/20 to-purple-500/20 border border-amber-500/30 dark:border-purple-500/30">
                  <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
                    {t("leaderboardLastReward")
                      .replace("{date}", lastReward.date)
                      .replace("{amount}", String(lastReward.amount))
                      .replace("{rank}", String(lastReward.rank))}
                  </span>
                </div>
              </BlurFade>
            )}
          </div>
        </div>
      </div>
    </BlurFade>
  );
}
