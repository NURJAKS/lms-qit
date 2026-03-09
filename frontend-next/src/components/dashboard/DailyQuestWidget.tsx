"use client";

import { useState } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useTheme } from "@/context/ThemeContext";
import { getGlassCardStyle, getTextColors } from "@/utils/themeStyles";

type Quest = {
  id: string;
  title_key: string;
  title: string;
  progress: number;
  target: number;
  points: number;
  completed: boolean;
  claimed: boolean;
};

const TITLE_KEYS = [
  "dailyQuestLogin",
  "dailyQuestQuiz",
  "dailyQuestWatch",
  "dailyQuestTopics5",
  "dailyQuestFinalTest",
] as const;

export function DailyQuestWidget() {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const glassStyle = getGlassCardStyle(theme);
  const textColors = getTextColors(theme);
  const queryClient = useQueryClient();
  const [claiming, setClaiming] = useState<string | null>(null);

  const { data: quests = [] } = useQuery({
    queryKey: ["daily-quests"],
    queryFn: async () => {
      const { data } = await api.get<Quest[]>("/dashboard/daily-quests");
      return data;
    },
  });

  const handleClaim = async (questId: string) => {
    setClaiming(questId);
    try {
      await api.post(`/dashboard/daily-quests/${questId}/claim`);
      queryClient.invalidateQueries({ queryKey: ["daily-quests"] });
      queryClient.invalidateQueries({ queryKey: ["my-progress-detail"] });
    } catch {
      // Error handled by user
    } finally {
      setClaiming(null);
    }
  };

  return (
    <div className="h-full flex flex-col rounded-xl border-0 shadow-sm overflow-hidden" style={glassStyle}>
      <div
        className="p-3 text-white flex items-center justify-between"
        style={{ background: "linear-gradient(135deg, #14b8a6 0%, #3b82f6 100%)" }}
      >
        <h3 className="font-bold text-sm">{t("dailyQuest")}</h3>
      </div>
      <div className="flex-1 p-2.5 space-y-2">
        {quests.slice(0, 3).map((q) => (
          <div key={q.id} className="p-2.5 rounded-lg" style={{ background: theme === "dark" ? "rgba(30, 41, 59, 0.4)" : "rgba(0, 0, 0, 0.02)" }}>
            <div className="flex items-start gap-2.5">
              {q.completed || q.claimed ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#10b981" }} />
              ) : (
                <Circle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: textColors.secondary }} />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium line-clamp-1" style={{ color: textColors.primary }}>
                  {t(q.title_key as "dailyQuestLogin") || q.title}
                </p>
                <p className="text-xs mt-0.5" style={{ color: textColors.secondary }}>
                  {q.progress}/{q.target} · +{q.points} {t("points")}
                </p>
                <div className="mt-1.5 h-1 rounded-full overflow-hidden" style={{ background: theme === "dark" ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)" }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, (q.progress / q.target) * 100)}%`,
                      background: "linear-gradient(135deg, #14b8a6 0%, #3b82f6 100%)",
                    }}
                  />
                </div>
                {q.claimed ? (
                  <span className="mt-2 inline-block text-xs font-medium" style={{ color: "#10b981" }}>
                    {t("dailyQuestClaimed")}
                  </span>
                ) : !q.completed ? (
                  <button
                    type="button"
                    disabled
                    className="mt-2 text-xs font-medium py-1 px-2 rounded-lg cursor-not-allowed"
                    style={{ border: theme === "dark" ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(0, 0, 0, 0.1)", color: textColors.secondary }}
                  >
                    {t("claimReward")}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleClaim(q.id)}
                    disabled={claiming === q.id}
                    className="mt-2 text-xs font-medium py-1 px-2 rounded-lg text-white hover:opacity-90 disabled:opacity-50"
                    style={{ background: "linear-gradient(135deg, #14b8a6 0%, #3b82f6 100%)" }}
                  >
                    {claiming === q.id ? "..." : t("claimReward")}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
