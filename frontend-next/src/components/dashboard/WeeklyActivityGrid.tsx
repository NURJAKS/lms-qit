"use client";

import { useTheme } from "@/context/ThemeContext";
import { useLanguage } from "@/context/LanguageContext";
import { getTextColors } from "@/utils/themeStyles";

type ActivityLevel = "high" | "medium" | "none";

type WeeklyActivityData = {
  category: string;
  days: ActivityLevel[];
};

type WeeklyActivityGridProps = {
  data: WeeklyActivityData[];
  period?: "weekly" | "monthly";
};

const dayLabels = ["S", "M", "T", "W", "T", "F", "S"];

const getDotColor = (level: ActivityLevel, theme: "light" | "dark") => {
  if (level === "high") return theme === "dark" ? "#3B82F6" : "#2563EB";
  if (level === "medium") return theme === "dark" ? "#94A3B8" : "#64748B";
  return theme === "dark" ? "#1F2937" : "#D1D5DB";
};

const getDotSize = (level: ActivityLevel) => {
  if (level === "high") return "w-2.5 h-2.5";
  if (level === "medium") return "w-2 h-2";
  return "w-1.5 h-1.5";
};

export function WeeklyActivityGrid({ data, period = "weekly" }: WeeklyActivityGridProps) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const textColors = getTextColors(theme);
  const isDark = theme === "dark";

  return (
    <div className="space-y-4">
      {/* Day labels */}
      <div className="flex items-center gap-1 px-2">
        <div className="w-16" /> {/* Spacer for category labels */}
        {dayLabels.map((day, idx) => (
          <div
            key={idx}
            className="flex-1 text-center text-xs font-medium"
            style={{ color: textColors.secondary }}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Activity rows */}
      {data.map((item, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <div
            className="w-16 text-xs font-medium truncate"
            style={{ color: textColors.primary }}
          >
            {item.category}
          </div>
          <div className="flex-1 flex items-center gap-1">
            {item.days.map((level, dayIdx) => (
              <div
                key={dayIdx}
                className={`${getDotSize(level)} rounded-full transition-all duration-200 hover:scale-125`}
                style={{
                  backgroundColor: getDotColor(level, theme),
                }}
                title={`${item.category} - ${dayLabels[dayIdx]}: ${level}`}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Legend */}
      <div className="flex items-center gap-4 pt-2 border-t" style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.08)" }}>
        <div className="flex items-center gap-1.5">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: getDotColor("high", theme) }}
          />
          <span className="text-xs" style={{ color: textColors.secondary }}>
            {t("activityHigh")}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: getDotColor("medium", theme) }}
          />
          <span className="text-xs" style={{ color: textColors.secondary }}>
            {t("activityMedium")}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: getDotColor("none", theme) }}
          />
          <span className="text-xs" style={{ color: textColors.secondary }}>
            {t("activityNone")}
          </span>
        </div>
      </div>
    </div>
  );
}
