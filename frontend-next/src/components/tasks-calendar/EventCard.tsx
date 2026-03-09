"use client";

import { BlurFade } from "@/components/ui/blur-fade";
import { cn } from "@/lib/utils";

type EventColor = "gray" | "yellow" | "pink" | "purple" | "red";

interface EventCardProps {
  title: string;
  time?: string;
  color?: EventColor;
  onClick?: () => void;
  className?: string;
}

const colorMap: Record<EventColor, { bg: string; text: string }> = {
  gray: {
    bg: "rgba(229, 231, 235, 0.8)",
    text: "#1F2937",
  },
  yellow: {
    bg: "rgba(251, 191, 36, 0.3)",
    text: "#92400E",
  },
  pink: {
    bg: "rgba(252, 165, 165, 0.4)",
    text: "#991B1B",
  },
  purple: {
    bg: "rgba(196, 181, 253, 0.4)",
    text: "#6B21A8",
  },
  red: {
    bg: "rgba(239, 68, 68, 0.3)",
    text: "#991B1B",
  },
};

export function EventCard({ title, time, color = "gray", onClick, className }: EventCardProps) {
  const colors = colorMap[color];

  return (
    <BlurFade delay={0.1} duration={0.3}>
      <div
        onClick={onClick}
        className={cn(
          "px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-medium transition-all duration-200",
          "hover:scale-[1.02] hover:shadow-md",
          onClick && "cursor-pointer",
          className
        )}
        style={{
          background: colors.bg,
          color: colors.text,
        }}
      >
        <div className="flex items-center gap-1 sm:gap-1.5">
          <span className="truncate flex-1">{title}</span>
          {time && (
            <span className="opacity-75 text-[9px] sm:text-[10px] shrink-0 whitespace-nowrap">
              {time}
            </span>
          )}
        </div>
      </div>
    </BlurFade>
  );
}
