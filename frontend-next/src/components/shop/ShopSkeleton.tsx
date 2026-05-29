"use client";

import { motion } from "motion/react";
import { useTheme } from "@/context/ThemeContext";
import { getGlassCardStyle } from "@/utils/themeStyles";

export function ShopSkeleton() {
  const { theme } = useTheme();
  const cardStyle = getGlassCardStyle(theme);
  const isDark = theme === "dark";

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {[...Array(8)].map((_, i) => (
        <div
          key={i}
          className="rounded-xl p-5 flex flex-col h-[280px] overflow-hidden relative"
          style={cardStyle}
        >
          {/* Header with image and favorite placeholder */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3 flex-1">
              {/* Icon/Image placeholder */}
              <div
                className={`w-14 h-14 rounded-xl shrink-0 animate-pulse ${
                  isDark ? "bg-white/10" : "bg-black/5"
                }`}
              />
              <div className="flex-1 space-y-2">
                {/* Title placeholder */}
                <div
                  className={`h-5 w-3/4 rounded-md animate-pulse ${
                    isDark ? "bg-white/10" : "bg-black/5"
                  }`}
                />
                {/* Price placeholder */}
                <div
                  className={`h-4 w-1/3 rounded-md animate-pulse ${
                    isDark ? "bg-white/10" : "bg-black/5"
                  }`}
                />
              </div>
            </div>
            {/* Favorite button placeholder */}
            <div
              className={`w-9 h-9 rounded-xl shrink-0 animate-pulse ${
                isDark ? "bg-white/10" : "bg-black/5"
              }`}
            />
          </div>

          {/* Description placeholder */}
          <div className="space-y-2 mb-6 flex-1">
            <div
              className={`h-3 w-full rounded-sm animate-pulse ${
                isDark ? "bg-white/10" : "bg-black/5"
              }`}
            />
            <div
              className={`h-3 w-5/6 rounded-sm animate-pulse ${
                isDark ? "bg-white/10" : "bg-black/5"
              }`}
            />
          </div>

          {/* Buttons placeholder */}
          <div className="flex gap-2 mt-auto">
            <div
              className={`h-10 flex-1 rounded-xl animate-pulse ${
                isDark ? "bg-white/10" : "bg-black/5"
              }`}
            />
            <div
              className={`h-10 w-12 rounded-xl animate-pulse ${
                isDark ? "bg-white/10" : "bg-black/5"
              }`}
            />
          </div>

          {/* Shimmer effect overlay */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <motion.div
              className="w-full h-full bg-gradient-to-r from-transparent via-white/5 to-transparent"
              initial={{ x: "-100%" }}
              animate={{ x: "100%" }}
              transition={{
                repeat: Infinity,
                duration: 1.5,
                ease: "linear",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
