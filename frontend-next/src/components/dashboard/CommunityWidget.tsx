"use client";

import Link from "next/link";
import {
  MessageCircle,
  Target,
  Lightbulb,
  GraduationCap,
  ArrowRight,
  Users,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { getGlassCardStyle, getTextColors } from "@/utils/themeStyles";

interface PreviewMessage {
  author: string;
  text: string;
  tag: "strategy" | "tip";
  isAlumni: boolean;
}

const PREVIEWS: Record<string, PreviewMessage[]> = {
  ru: [
    { author: "Данияр А.", text: "Сначала пишу решение на бумаге, потом pseudo-code, и только потом код…", tag: "strategy", isAlumni: false },
    { author: "Арман Н.", text: "Обязательно делайте все задания, даже необязательные. Именно на них я понял ООП!", tag: "tip", isAlumni: true },
    { author: "Мадина Т.", text: "Rubber duck debugging реально работает! Объясните задачу кому-нибудь вслух…", tag: "tip", isAlumni: false },
  ],
  kk: [
    { author: "Данияр А.", text: "Алдымен шешімді қағазға жазамын, содан кейін pseudo-code, содан кейін код…", tag: "strategy", isAlumni: false },
    { author: "Арман Н.", text: "Барлық тапсырмаларды орындаңыз, тіпті міндетті емес. ООП-ты осында түсіндім!", tag: "tip", isAlumni: true },
    { author: "Мадина Т.", text: "Rubber duck debugging шынымен жұмыс істейді! Тапсырманы біреуге түсіндіріңіз…", tag: "tip", isAlumni: false },
  ],
  en: [
    { author: "Daniyar A.", text: "First I write the solution on paper, then pseudo-code, and only then code…", tag: "strategy", isAlumni: false },
    { author: "Arman N.", text: "Do all assignments, even optional ones. That's where I truly understood OOP!", tag: "tip", isAlumni: true },
    { author: "Madina T.", text: "Rubber duck debugging really works! Explain the task to someone out loud…", tag: "tip", isAlumni: false },
  ],
};

export function CommunityWidget() {
  const { t, lang } = useLanguage();
  const { theme } = useTheme();
  const glassStyle = getGlassCardStyle(theme);
  const textColors = getTextColors(theme);
  const isDark = theme === "dark";
  const previews = PREVIEWS[lang] || PREVIEWS.ru;

  const tagStyles = {
    strategy: { color: "#3B82F6", bg: isDark ? "rgba(59, 130, 246, 0.15)" : "rgba(59, 130, 246, 0.1)" },
    tip: { color: "#F59E0B", bg: isDark ? "rgba(245, 158, 11, 0.15)" : "rgba(245, 158, 11, 0.1)" },
  };

  return (
    <div className="h-full flex flex-col rounded-xl overflow-hidden" style={glassStyle}>
      {/* Header */}
      <div
        className="p-3 text-white flex items-center justify-between relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #7C3AED 0%, #2563EB 100%)" }}
      >
        <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-white/10 blur-2xl" />
        <div className="flex items-center gap-2 relative z-10">
          <Users className="w-4 h-4" />
          <h3 className="font-bold text-sm">{t("communityTitle")}</h3>
        </div>
        <div className="flex items-center gap-1 text-white/80 text-xs relative z-10">
          <MessageCircle className="w-3 h-3" />
          <span>8+</span>
        </div>
      </div>

      {/* Preview messages */}
      <div className="flex-1 p-3 space-y-2">
        {previews.map((msg, idx) => {
          const ts = tagStyles[msg.tag];
          const TagIcon = msg.tag === "strategy" ? Target : Lightbulb;
          return (
            <div
              key={idx}
              className="p-2.5 rounded-lg"
              style={{
                background: isDark ? "rgba(30, 41, 59, 0.4)" : "rgba(0, 0, 0, 0.02)",
                border: `1px solid ${isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.04)"}`,
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold" style={{ color: textColors.primary }}>
                  {msg.author}
                </span>
                {msg.isAlumni && (
                  <GraduationCap className="w-3 h-3" style={{ color: "#10B981" }} />
                )}
                <span
                  className="ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
                  style={{ background: ts.bg, color: ts.color }}
                >
                  <TagIcon className="w-2.5 h-2.5" />
                  {msg.tag === "strategy" ? t("communityTagStrategy") : t("communityTagTip")}
                </span>
              </div>
              <p className="text-xs line-clamp-2 leading-relaxed" style={{ color: textColors.secondary }}>
                {msg.text}
              </p>
            </div>
          );
        })}
      </div>

      {/* CTA */}
      <div className="p-3 pt-0">
        <Link
          href="/app/community"
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl font-medium text-sm transition-all hover:opacity-90 text-white"
          style={{ background: "linear-gradient(135deg, #7C3AED 0%, #2563EB 100%)" }}
        >
          {t("communitySidebarLink")}
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
