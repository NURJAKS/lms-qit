"use client";

import { useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Brain,
  LineChart,
  ListChecks,
  Swords,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { getGlassCardStyle, getTextColors } from "@/utils/themeStyles";
import { BlurFade } from "@/components/ui/blur-fade";
import { WeakTopicsTab } from "./WeakTopicsTab";
import { ComparisonTab } from "./ComparisonTab";
import { SkillTreeTab } from "./SkillTreeTab";
import { ForecastTab } from "./ForecastTab";
import { StudyPlanTab } from "./StudyPlanTab";

const TABS = [
  { id: "weak", icon: AlertTriangle, tKey: "weakTopicsTab" as const },
  { id: "compare", icon: BarChart3, tKey: "comparisonTab" as const },
  { id: "skills", icon: Swords, tKey: "skillTreeTab" as const },
  { id: "forecast", icon: LineChart, tKey: "forecastTab" as const },
  { id: "plan", icon: ListChecks, tKey: "studyPlanTab" as const },
];

export function StudentInsightsPage() {
  const [activeTab, setActiveTab] = useState("weak");
  const { t } = useLanguage();
  const { theme } = useTheme();
  const glassStyle = getGlassCardStyle(theme);
  const textColors = getTextColors(theme);
  const isDark = theme === "dark";

  return (
    <div className="space-y-5">
      {/* Header */}
      <BlurFade direction="down" delay={0.05} offset={30} inView duration={0.6} blur="8px">
        <div
          className="relative rounded-xl overflow-hidden p-5 lg:p-7 text-white"
          style={{
            background: "linear-gradient(135deg, #6366F1 0%, #8B5CF6 50%, #EC4899 100%)",
            boxShadow: "0 8px 24px rgba(99, 102, 241, 0.3)",
          }}
        >
          <div className="absolute inset-0 opacity-10">
            <svg className="absolute bottom-0 left-0 w-full h-24" viewBox="0 0 1200 120" preserveAspectRatio="none">
              <path fill="currentColor" d="M0,60 C300,120 600,0 900,60 C1050,90 1200,30 1200,60 L1200,120 L0,120 Z" />
            </svg>
          </div>
          <div className="relative flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Brain className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">
                {t("studentAnalytics")}
              </h1>
              <p className="text-white/80 text-sm mt-0.5">
                {t("studentAnalyticsSubtitle")}
              </p>
            </div>
          </div>
        </div>
      </BlurFade>

      {/* Tab bar */}
      <BlurFade direction="up" delay={0.1} offset={20} inView duration={0.5} blur="6px">
        <div
          className="rounded-xl p-1.5 flex gap-1 overflow-x-auto no-scrollbar"
          style={glassStyle}
        >
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-all duration-200 ${
                  isActive
                    ? "text-white shadow-md"
                    : isDark
                    ? "text-white/60 hover:text-white/90 hover:bg-white/5"
                    : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
                }`}
                style={
                  isActive
                    ? {
                        background: "linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)",
                        boxShadow: "0 2px 12px rgba(99, 102, 241, 0.4)",
                      }
                    : undefined
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">{t(tab.tKey)}</span>
              </button>
            );
          })}
        </div>
      </BlurFade>

      {/* Tab content */}
      <BlurFade key={activeTab} direction="up" delay={0.05} offset={20} inView duration={0.4} blur="4px">
        {activeTab === "weak" && <WeakTopicsTab />}
        {activeTab === "compare" && <ComparisonTab />}
        {activeTab === "skills" && <SkillTreeTab />}
        {activeTab === "forecast" && <ForecastTab />}
        {activeTab === "plan" && <StudyPlanTab />}
      </BlurFade>
    </div>
  );
}
