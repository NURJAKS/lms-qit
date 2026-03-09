"use client";

import { RadialBarChart, RadialBar, ResponsiveContainer, Cell } from "recharts";
import { useTheme } from "@/context/ThemeContext";
import { getTextColors } from "@/utils/themeStyles";

type RadialProgressChartProps = {
  value: number; // 0-100
  size?: number;
  strokeWidth?: number;
  showLabel?: boolean;
  label?: string;
};

export function RadialProgressChart({
  value,
  size = 200,
  strokeWidth = 20,
  showLabel = true,
  label,
}: RadialProgressChartProps) {
  const { theme } = useTheme();
  const textColors = getTextColors(theme);
  const isDark = theme === "dark";

  // Данные для графика - сначала прогресс, потом оставшееся
  const data = [
    {
      name: "progress",
      value: value,
      fill: "#3B82F6",
    },
    {
      name: "remaining",
      value: 100 - value,
      fill: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.05)",
    },
  ];

  const innerRadius = (size - strokeWidth * 2) / 2;
  const outerRadius = size / 2;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          cx="50%"
          cy="50%"
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          barSize={strokeWidth}
          data={data}
          startAngle={90}
          endAngle={-270}
        >
          <RadialBar
            dataKey="value"
            cornerRadius={10}
            animationDuration={1000}
            animationBegin={0}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </RadialBar>
        </RadialBarChart>
      </ResponsiveContainer>
      {showLabel && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          style={{ top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}
        >
          <p className="text-3xl font-bold" style={{ color: textColors.primary }}>
            {value}%
          </p>
          {label && (
            <p className="text-xs mt-1" style={{ color: textColors.secondary }}>
              {label}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
