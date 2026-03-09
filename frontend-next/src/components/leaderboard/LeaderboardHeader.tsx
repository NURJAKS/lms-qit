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
  const { t } = useLanguage();

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
            <AnimatedShinyText
              className="text-sm md:text-base text-gray-700 dark:text-gray-300 max-w-none"
              shimmerWidth={150}
            >
              {t("leaderboardDailyRewardsHint")}
            </AnimatedShinyText>
            
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
