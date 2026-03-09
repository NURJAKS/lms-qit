"use client";

import { useEffect, useRef } from "react";
import { Trophy, Medal, Award } from "lucide-react";
import { SparklesText } from "@/components/ui/sparkles-text";
import { BorderBeam } from "@/components/ui/border-beam";
import { Confetti, useConfetti } from "@/components/ui/confetti";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

interface TopThreeBadgeProps {
  rank: number;
  name: string;
  showConfetti?: boolean;
}

const rankConfig = {
  1: {
    icon: Trophy,
    colors: {
      bg: "bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/30 dark:to-yellow-900/30",
      border: "border-amber-400 dark:border-amber-600",
      text: "text-amber-700 dark:text-amber-300",
      sparkles: { first: "#FBBF24", second: "#F59E0B" },
      beamFrom: "#FBBF24",
      beamTo: "#F59E0B",
    },
    label: "🥇",
  },
  2: {
    icon: Medal,
    colors: {
      bg: "bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-800/30 dark:to-slate-800/30",
      border: "border-gray-400 dark:border-gray-600",
      text: "text-gray-700 dark:text-gray-300",
      sparkles: { first: "#9CA3AF", second: "#6B7280" },
      beamFrom: "#9CA3AF",
      beamTo: "#6B7280",
    },
    label: "🥈",
  },
  3: {
    icon: Award,
    colors: {
      bg: "bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/30 dark:to-amber-900/30",
      border: "border-orange-400 dark:border-orange-600",
      text: "text-orange-700 dark:text-orange-300",
      sparkles: { first: "#FB923C", second: "#F97316" },
      beamFrom: "#FB923C",
      beamTo: "#F97316",
    },
    label: "🥉",
  },
};

export function TopThreeBadge({
  rank,
  name,
  showConfetti = false,
}: TopThreeBadgeProps) {
  const config = rankConfig[rank as keyof typeof rankConfig];
  const Icon = config.icon;
  const confettiRef = useRef<{ fire: (options?: any) => void } | null>(null);
  const hasShownConfetti = useRef(false);

  useEffect(() => {
    if (showConfetti && rank === 1 && !hasShownConfetti.current && confettiRef.current) {
      setTimeout(() => {
        confettiRef.current?.fire({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#FBBF24", "#F59E0B", "#FCD34D"],
        });
        hasShownConfetti.current = true;
      }, 500);
    }
  }, [showConfetti, rank]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.5, delay: rank * 0.1 }}
      className={cn(
        "relative rounded-xl border-2 p-4 overflow-hidden",
        config.colors.bg,
        config.colors.border
      )}
    >
      {rank === 1 && (
        <>
          <Confetti ref={confettiRef} manualstart />
          <BorderBeam
            size={60}
            duration={5}
            colorFrom={config.colors.beamFrom}
            colorTo={config.colors.beamTo}
            borderWidth={2}
          />
        </>
      )}

      <div className="relative z-10 flex items-center gap-3">
        <div
          className={cn(
            "p-2 rounded-lg",
            config.colors.bg,
            "border",
            config.colors.border
          )}
        >
          <Icon className={cn("w-6 h-6", config.colors.text)} />
        </div>
        <div className="flex-1">
          <div className="text-xs font-medium mb-1 opacity-70">
            {config.label} Место #{rank}
          </div>
          <SparklesText
            className={cn("text-lg font-bold", config.colors.text)}
            colors={config.colors.sparkles}
            sparklesCount={8}
          >
            {name}
          </SparklesText>
        </div>
      </div>
    </motion.div>
  );
}
