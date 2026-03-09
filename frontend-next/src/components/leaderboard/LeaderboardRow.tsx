"use client";

import { motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { Trophy, Medal, Award, Baby } from "lucide-react";
import { SparklesText } from "@/components/ui/sparkles-text";
import { BorderBeam } from "@/components/ui/border-beam";
import { useLanguage } from "@/context/LanguageContext";
import type { TranslationKey } from "@/i18n/translations";
import { cn } from "@/lib/utils";

type LeaderboardRowData = {
  rank: number;
  user_id: number;
  full_name: string;
  email: string;
  avg_score: number;
  courses_done: number;
  activity: number;
  points: number;
};

interface LeaderboardRowProps {
  row: LeaderboardRowData;
  index: number;
  onCoursesClick?: (row: LeaderboardRowData) => void;
  t: (k: TranslationKey) => string;
  isChild?: boolean;
}

const rankConfig = {
  1: {
    icon: Trophy,
    colors: {
      bg: "bg-gradient-to-r from-amber-50/50 to-yellow-50/50 dark:from-amber-900/20 dark:to-yellow-900/20",
      border: "border-amber-200 dark:border-amber-800",
      text: "text-amber-700 dark:text-amber-300",
      sparkles: { first: "#FBBF24", second: "#F59E0B" },
      beamFrom: "#FBBF24",
      beamTo: "#F59E0B",
    },
  },
  2: {
    icon: Medal,
    colors: {
      bg: "bg-gradient-to-r from-gray-50/50 to-slate-50/50 dark:from-gray-800/20 dark:to-slate-800/20",
      border: "border-gray-200 dark:border-gray-700",
      text: "text-gray-700 dark:text-gray-300",
      sparkles: { first: "#9CA3AF", second: "#6B7280" },
      beamFrom: "#9CA3AF",
      beamTo: "#6B7280",
    },
  },
  3: {
    icon: Award,
    colors: {
      bg: "bg-gradient-to-r from-orange-50/50 to-amber-50/50 dark:from-orange-900/20 dark:to-amber-900/20",
      border: "border-orange-200 dark:border-orange-800",
      text: "text-orange-700 dark:text-orange-300",
      sparkles: { first: "#FB923C", second: "#F97316" },
      beamFrom: "#FB923C",
      beamTo: "#F97316",
    },
  },
};

function PlaceCell({ rank, t }: { rank: number; t: (k: TranslationKey) => string }) {
  const titles: Record<number, TranslationKey> = {
    1: "leaderboardPlace1",
    2: "leaderboardPlace2",
    3: "leaderboardPlace3",
  };
  const titleKey = titles[rank];
  const title = titleKey ? t(titleKey) : "";
  const config = rankConfig[rank as keyof typeof rankConfig];

  if (rank <= 3 && config) {
    const Icon = config.icon;
    return (
      <td className="py-4 px-4">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "relative p-2 rounded-lg",
              config.colors.bg,
              config.colors.border,
              "border"
            )}
          >
            <Icon className={cn("w-6 h-6", config.colors.text)} />
            {rank === 1 && (
              <BorderBeam
                size={30}
                duration={4}
                colorFrom={config.colors.beamFrom}
                colorTo={config.colors.beamTo}
                borderWidth={1}
              />
            )}
          </div>
          <div>
            <div className="font-bold text-lg">#{rank}</div>
            {title && (
              <div className={cn("text-xs font-medium", config.colors.text)}>
                {title}
              </div>
            )}
          </div>
        </div>
      </td>
    );
  }

  return (
    <td className="py-4 px-4">
      <span className="font-medium text-gray-600 dark:text-gray-400 text-lg">
        #{rank}
      </span>
    </td>
  );
}

function ScoreProgressBar({ score }: { score: number }) {
  const percentage = Math.min(score, 100);
  const getColor = () => {
    if (score >= 90) return "bg-green-500";
    if (score >= 75) return "bg-blue-500";
    if (score >= 60) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className={cn("h-full rounded-full", getColor())}
        />
      </div>
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[35px]">
        {score.toFixed(1)}
      </span>
    </div>
  );
}

export function LeaderboardRow({
  row,
  index,
  onCoursesClick,
  t,
  isChild = false,
}: LeaderboardRowProps) {
  const isTopThree = row.rank <= 3;
  const config = isTopThree ? rankConfig[row.rank as keyof typeof rankConfig] : null;

  return (
    <motion.tr
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className={cn(
        "border-b dark:border-gray-700 transition-all duration-300 relative",
        "hover:bg-gray-50 dark:hover:bg-gray-700/50",
        isTopThree && config && cn(config.colors.bg, "hover:shadow-md"),
        isChild && "bg-purple-50/50 dark:bg-purple-900/20 border-l-4 border-l-purple-500 dark:border-l-purple-400"
      )}
    >
      <PlaceCell rank={row.rank} t={t} />
      <td className="py-4 px-4">
        <div className="flex items-center gap-2">
          {isChild && (
            <span title={t("yourChild")}><Baby className="w-4 h-4 text-purple-500 dark:text-purple-400 shrink-0" /></span>
          )}
          {isTopThree && config ? (
            <SparklesText
              className={cn("text-base font-semibold", config.colors.text)}
              colors={config.colors.sparkles}
              sparklesCount={5}
            >
              <Link
                href={`/app/profile/${row.user_id}`}
                className="hover:underline"
              >
                {row.full_name}
              </Link>
            </SparklesText>
          ) : (
            <Link
              href={`/app/profile/${row.user_id}`}
              className={cn(
                "hover:underline font-medium",
                isChild 
                  ? "text-purple-600 dark:text-purple-400" 
                  : "text-[var(--qit-primary)] dark:text-[#00b0ff]"
              )}
            >
              {row.full_name}
            </Link>
          )}
        </div>
      </td>
      <td className="py-4 px-4">
        <ScoreProgressBar score={row.avg_score} />
      </td>
      <td className="py-4 px-4">
        {row.courses_done > 0 ? (
          <button
            type="button"
            onClick={() => onCoursesClick?.(row)}
            className="text-amber-500 dark:text-amber-400 hover:underline font-medium cursor-pointer transition-colors"
          >
            {row.courses_done}
          </button>
        ) : (
          <span className="text-amber-500 dark:text-amber-400">
            {row.courses_done}
          </span>
        )}
      </td>
      <td className="py-4 px-4">
        <div className="flex items-center gap-1">
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: index * 0.05 + 0.3 }}
            className="text-gray-700 dark:text-gray-300 font-medium"
          >
            {row.activity}
          </motion.span>
        </div>
      </td>
      <td className="py-4 px-4">
        <motion.span
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{
            delay: index * 0.05 + 0.4,
            type: "spring",
            stiffness: 200,
          }}
          className="inline-flex items-center gap-1.5 font-medium text-amber-500 dark:text-amber-400"
        >
          <Image
            src="/icons/coin.png"
            alt=""
            width={20}
            height={20}
            className="animate-pulse"
          />
          {row.points ?? 0}
        </motion.span>
      </td>
    </motion.tr>
  );
}
