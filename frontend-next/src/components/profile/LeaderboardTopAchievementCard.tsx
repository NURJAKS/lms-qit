"use client";

import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Lang, TranslationKey } from "@/i18n/translations";
import { formatLocalizedDate } from "@/utils/dateUtils";
import { MagicCard } from "@/components/ui/magic-card";
import { SparklesText } from "@/components/ui/sparkles-text";

export type LeaderboardTopHistoryItem = {
  date: string;
  rank: number;
  amount: number;
};

const RANK_STYLES = {
  1: {
    card: "from-yellow-50/90 via-amber-50/40 to-transparent dark:from-yellow-900/25 dark:via-amber-900/15 dark:to-transparent border-amber-200/70 dark:border-amber-700/45",
    iconBg:
      "bg-gradient-to-br from-yellow-400 to-amber-500 ring-2 ring-yellow-300/60 dark:ring-amber-600/45",
    crown: "text-yellow-50 drop-shadow-sm",
    sparkles: { first: "#FBBF24", second: "#F59E0B" } as const,
  },
  2: {
    card: "from-slate-100/90 via-slate-50/40 to-transparent dark:from-slate-700/35 dark:via-slate-800/20 dark:to-transparent border-slate-200/80 dark:border-slate-600/50",
    iconBg:
      "bg-gradient-to-br from-slate-300 to-slate-500 ring-2 ring-slate-200/70 dark:ring-slate-500/40",
    crown: "text-slate-50 drop-shadow-sm",
    sparkles: { first: "#94a3b8", second: "#64748b" } as const,
  },
  3: {
    card: "from-orange-50/90 via-amber-50/35 to-transparent dark:from-orange-900/25 dark:via-amber-900/12 dark:to-transparent border-orange-200/70 dark:border-orange-800/45",
    iconBg:
      "bg-gradient-to-br from-orange-400 to-amber-600 ring-2 ring-orange-300/55 dark:ring-orange-600/40",
    crown: "text-orange-50 drop-shadow-sm",
    sparkles: { first: "#fb923c", second: "#d97706" } as const,
  },
} as const;

function clampRank(rank: number): 1 | 2 | 3 {
  if (rank === 1 || rank === 2 || rank === 3) return rank;
  return 3;
}

type Props = {
  item: LeaderboardTopHistoryItem;
  lang: Lang;
  t: (key: TranslationKey) => string;
  /** MagicCard + SparklesText (own profile); plain card for minimal public view when false */
  fancy?: boolean;
};

export function LeaderboardTopAchievementCard({ item, lang, t, fancy = false }: Props) {
  const r = clampRank(item.rank);
  const styles = RANK_STYLES[r];
  const titleKey = `profileAchievementTop${r}` as TranslationKey;
  const title = t(titleKey);
  const coinsLine =
    item.amount > 0
      ? t("profileAchievementTopCoins").replace("{amount}", String(item.amount))
      : null;
  const dateStr = formatLocalizedDate(item.date, lang as any, t);

  const content = (
    <>
      <div
        className={cn(
          "w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center shrink-0 shadow-inner",
          styles.iconBg,
        )}
      >
        <Crown
          className={cn(
            "w-5 h-5 sm:w-6 sm:h-6",
            styles.crown,
            fancy && item.rank === 1 && "animate-bounce",
          )}
        />
      </div>
      <div className="min-w-0 flex-1">
        {fancy ? (
          <SparklesText
            className="text-sm font-semibold text-gray-900 dark:text-white"
            sparklesCount={3}
            colors={styles.sparkles}
          >
            {title}
          </SparklesText>
        ) : (
          <p className="text-sm font-semibold text-gray-800 dark:text-white">{title}</p>
        )}
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{dateStr}</p>
        {coinsLine ? (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">{coinsLine}</p>
        ) : null}
      </div>
    </>
  );

  const shellClass = cn(
    "flex items-center gap-3 p-3 rounded-xl border bg-gradient-to-r hover:shadow-md transition-all",
    styles.card,
  );

  if (fancy) {
    return <MagicCard className={shellClass}>{content}</MagicCard>;
  }

  return <div className={shellClass}>{content}</div>;
}
