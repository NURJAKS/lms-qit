"use client";

import { ReactNode } from "react";
import { MagicCard } from "@/components/ui/magic-card";
import { BorderBeam } from "@/components/ui/border-beam";
import { NumberTicker } from "@/components/ui/number-ticker";
import { DotPattern } from "@/components/ui/dot-pattern";
import { BlurFade } from "@/components/ui/blur-fade";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  description: string;
  count: number;
  icon: ReactNode;
  isActive: boolean;
  onClick: () => void;
  colorScheme: {
    border: string;
    bg: string;
    bgDark: string;
    text: string;
    textDark: string;
    icon: string;
    iconDark: string;
    beamFrom: string;
    beamTo: string;
  };
  delay?: number;
}

export function StatCard({
  title,
  description,
  count,
  icon,
  isActive,
  onClick,
  colorScheme,
  delay = 0,
}: StatCardProps) {
  return (
    <BlurFade delay={delay} inView>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "relative text-left rounded-xl border-2 p-5 transition-all duration-300 overflow-hidden group",
          "hover:shadow-xl hover:scale-[1.02]",
          isActive
            ? cn(
                colorScheme.border,
                colorScheme.bg,
                colorScheme.bgDark,
                "shadow-lg"
              )
            : cn(
                "border-gray-200 dark:border-gray-700",
                "bg-white/80 dark:bg-gray-800/80",
                "hover:border-gray-300 dark:hover:border-gray-600"
              )
        )}
      >
        {isActive && (
          <>
            <BorderBeam
              size={80}
              duration={6}
              colorFrom={colorScheme.beamFrom}
              colorTo={colorScheme.beamTo}
              borderWidth={2}
            />
            <DotPattern
              className={cn(
                "absolute inset-0 opacity-10",
                "[&>svg>circle]:fill-current",
                colorScheme.text
              )}
              width={20}
              height={20}
            />
          </>
        )}

        <div className="relative z-10 space-y-3">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "p-2 rounded-lg transition-colors",
                isActive
                  ? colorScheme.icon
                  : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
              )}
            >
              {icon}
            </div>
            <h2
              className={cn(
                "font-semibold text-lg transition-colors",
                isActive
                  ? cn(colorScheme.text, colorScheme.textDark)
                  : "text-gray-800 dark:text-gray-200"
              )}
            >
              {title}
            </h2>
          </div>

          <p
            className={cn(
              "text-sm transition-colors",
              isActive
                ? cn(colorScheme.text, colorScheme.textDark, "opacity-90")
                : "text-gray-600 dark:text-gray-400"
            )}
          >
            {description}
          </p>

          <div className="flex items-baseline gap-2">
            <NumberTicker
              value={count}
              className={cn(
                "text-2xl font-bold transition-colors",
                isActive
                  ? cn(colorScheme.text, colorScheme.textDark)
                  : "text-gray-800 dark:text-gray-200"
              )}
            />
            <span
              className={cn(
                "text-xs font-medium transition-colors",
                isActive
                  ? cn(colorScheme.text, colorScheme.textDark, "opacity-70")
                  : "text-gray-500 dark:text-gray-500"
              )}
            >
              студентов
            </span>
          </div>
        </div>

        {isActive && (
          <div
            className={cn(
              "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300",
              "bg-gradient-to-br from-white/10 to-transparent"
            )}
          />
        )}
      </button>
    </BlurFade>
  );
}
