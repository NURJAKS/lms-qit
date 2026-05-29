"use client";

import type { ReactNode } from "react";
import { useLanguage } from "@/context/LanguageContext";

export type AIHubTab = "battle" | "plan";

export function AIHub({
  activeTab,
  onTabChange,
  battleContent,
  planContent,
}: {
  activeTab: AIHubTab;
  onTabChange: (tab: AIHubTab) => void;
  battleContent: ReactNode;
  planContent: ReactNode;
}) {
  const { t } = useLanguage();

  return (
    <div className="space-y-4">
      <div
        className="flex rounded-xl bg-gray-200/70 dark:bg-gray-800/90 p-1 gap-1 border border-gray-200/80 dark:border-gray-700"
        role="tablist"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "battle"}
          onClick={() => onTabChange("battle")}
          className={`flex-1 rounded-lg px-2 py-1.5 sm:px-3 sm:py-2 text-[11px] sm:text-sm font-semibold transition-colors ${
            activeTab === "battle"
              ? "bg-white dark:bg-gray-900 text-purple-700 dark:text-purple-300 shadow-sm"
              : "text-gray-600 dark:text-gray-400 hover:bg-white/60 dark:hover:bg-gray-900/40"
          }`}
        >
          {t("aiVsStudent")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "plan"}
          onClick={() => onTabChange("plan")}
          className={`flex-1 rounded-lg px-2 py-1.5 sm:px-3 sm:py-2 text-[11px] sm:text-sm font-semibold transition-colors ${
            activeTab === "plan"
              ? "bg-white dark:bg-gray-900 text-purple-700 dark:text-purple-300 shadow-sm"
              : "text-gray-600 dark:text-gray-400 hover:bg-white/60 dark:hover:bg-gray-900/40"
          }`}
        >
          {t("studyPlanTitle")}
        </button>
      </div>
      <div role="tabpanel" className="min-h-[12rem]">
        {activeTab === "battle" ? battleContent : planContent}
      </div>
    </div>
  );
}
