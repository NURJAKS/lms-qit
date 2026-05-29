"use client";

import { Sparkles, Star, Zap } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { getGlassCardStyle, getTextColors } from "@/utils/themeStyles";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { getLocalizedCourseTitle } from "@/lib/courseUtils";

interface Skill {
  course_id: number;
  course_title: string;
  skill_name: string;
  skill_name_kk: string;
  skill_name_en: string;
  icon: string;
  color: string;
  level: number;
  max_level: number;
  xp: number;
  progress_pct: number;
  avg_score: number;
  completed_topics: number;
  total_topics: number;
}

interface SkillTreeData {
  hero_level: number;
  total_xp: number;
  skills: Skill[];
}

export function SkillTreeTab() {
  const { t, lang } = useLanguage();
  const { theme } = useTheme();
  const glassStyle = getGlassCardStyle(theme);
  const textColors = getTextColors(theme);
  const isDark = theme === "dark";

  const { data, isLoading } = useQuery({
    queryKey: ["student-skill-tree"],
    queryFn: async () => {
      const { data } = await api.get<SkillTreeData>("/analytics/student-insights/skill-tree");
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="rounded-xl p-8 text-center" style={glassStyle}>
        <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto" />
        <p className="mt-3 text-sm" style={{ color: textColors.secondary }}>{t("loading")}</p>
      </div>
    );
  }

  if (!data || data.skills.length === 0) {
    return (
      <div className="rounded-xl p-8 text-center" style={glassStyle}>
        <Sparkles className="w-10 h-10 mx-auto mb-3 text-gray-400" />
        <p className="text-sm" style={{ color: textColors.secondary }}>{t("skillTreeEmpty")}</p>
      </div>
    );
  }

  const getSkillName = (skill: Skill) => {
    if (lang === "kk") return skill.skill_name_kk;
    if (lang === "en") return skill.skill_name_en;
    return skill.skill_name;
  };

  return (
    <div className="space-y-4">
      {/* Hero card */}
      <div
        className="rounded-xl p-5 sm:p-6 relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #1E1B4B 0%, #312E81 50%, #4C1D95 100%)",
          border: "1px solid rgba(139, 92, 246, 0.3)",
          boxShadow: "0 8px 32px rgba(79, 70, 229, 0.3)",
        }}
      >
        {/* Ambient particles */}
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: "radial-gradient(rgba(255,255,255,0.5) 1px, transparent 1px)",
              backgroundSize: "30px 30px",
              animation: "lbTwinkle 5s ease-in-out infinite",
            }}
          />
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-purple-500/20 blur-3xl" />
          <div className="absolute -bottom-12 -left-12 w-48 h-48 rounded-full bg-indigo-500/20 blur-3xl" />
        </div>

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
          {/* Hero avatar */}
          <div className="flex flex-col items-center">
            <div
              className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl flex items-center justify-center text-3xl sm:text-4xl font-black text-white relative"
              style={{
                background: "linear-gradient(135deg, #6366F1, #8B5CF6, #A855F7)",
                boxShadow: "0 0 30px rgba(139, 92, 246, 0.5), inset 0 1px 0 rgba(255,255,255,0.2)",
              }}
            >
              {data.hero_level}
              <div className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full bg-yellow-400 flex items-center justify-center shadow-lg">
                <Star className="w-4 h-4 text-yellow-900" fill="currentColor" />
              </div>
            </div>
            <p className="text-xs text-white/70 mt-2 font-medium">{t("skillTreeHeroLevel")}</p>
          </div>

          {/* Stats */}
          <div className="flex-1">
            <h3 className="text-lg sm:text-xl font-bold text-white mb-1">{t("skillTreeTitle")}</h3>
            <div className="flex items-center gap-4 mt-3">
              <div className="flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-yellow-400" />
                <span className="text-sm font-bold text-white">{data.total_xp.toLocaleString()}</span>
                <span className="text-xs text-white/50">{t("skillTreeXP")}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-purple-300" />
                <span className="text-sm font-bold text-white">{data.skills.length}</span>
                <span className="text-xs text-white/50">{t("skillTreeTab")}</span>
              </div>
            </div>

            {/* XP progress bar */}
            <div className="mt-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-white/60">{t("skillTreeLevel")} {data.hero_level}</span>
                <span className="text-xs text-white/60">{t("skillTreeLevel")} {Math.min(data.hero_level + 1, 100)}</span>
              </div>
              <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{
                    width: `${data.hero_level}%`,
                    background: "linear-gradient(90deg, #6366F1, #A855F7, #EC4899)",
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <style jsx>{`
          @keyframes lbTwinkle {
            0%, 100% { opacity: 0.15; }
            50% { opacity: 0.3; }
          }
        `}</style>
      </div>

      {/* Skill cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {data.skills.map((skill) => {
          const levelLabel = skill.level >= 80 ? "🔥" : skill.level >= 50 ? "⚡" : skill.level >= 20 ? "💪" : "🌱";

          return (
            <div
              key={skill.course_id}
              className="rounded-xl p-4 sm:p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg group"
              style={glassStyle}
            >
              <div className="flex items-start gap-3">
                {/* Skill icon */}
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-lg transition-transform duration-200 group-hover:scale-110"
                  style={{
                    background: `${skill.color}18`,
                    border: `1px solid ${skill.color}30`,
                  }}
                >
                  {levelLabel}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-bold text-sm truncate" style={{ color: textColors.primary }}>
                      {getSkillName(skill)}
                    </h4>
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-md shrink-0"
                      style={{ color: skill.color, background: `${skill.color}15` }}
                    >
                      {t("skillTreeLevelShort")} {skill.level}
                    </span>
                  </div>
                  <p className="text-xs truncate mt-0.5" style={{ color: textColors.secondary }}>
                    {getLocalizedCourseTitle({ title: skill.course_title } as any, t)}
                  </p>

                  {/* Progress bar */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-medium" style={{ color: textColors.secondary }}>
                        {skill.completed_topics}/{skill.total_topics} {t("skillTreeProgress")}
                      </span>
                      <span className="text-[10px] font-bold" style={{ color: skill.color }}>
                        {skill.progress_pct}%
                      </span>
                    </div>
                    <div
                      className="h-2 rounded-full overflow-hidden"
                      style={{ background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }}
                    >
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${skill.progress_pct}%`, background: skill.color }}
                      />
                    </div>
                  </div>

                  {/* XP & avg score */}
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-[10px] font-medium" style={{ color: textColors.secondary }}>
                      <Zap className="w-3 h-3 inline-block mr-0.5 text-yellow-500" />
                      {skill.xp} {t("skillTreeXP")}
                    </span>
                    {skill.avg_score > 0 && (
                      <span className="text-[10px] font-medium" style={{ color: textColors.secondary }}>
                        ⭐ {skill.avg_score}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
