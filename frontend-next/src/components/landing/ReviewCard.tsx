"use client";

import React from "react";
import { Star } from "lucide-react";
import { MagicCard } from "@/components/ui/magic-card";
import { cn } from "@/lib/utils";
import type { PublicReview } from "@/types/publicReview";
import { useLanguage } from "@/context/LanguageContext";
import { formatLocalizedDate } from "@/utils/dateUtils";

interface ReviewCardProps {
  review: PublicReview;
  className?: string;
}

export function ReviewCard({ review, className }: ReviewCardProps) {
  const { lang: currentLang, t } = useLanguage();
  const lang = currentLang as "ru" | "kk" | "en";

  const initials = review.user_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const courseTitle = review.course_title;
  const reviewText = review.text?.trim() || "—";

  return (
    <MagicCard
      className={cn(
        "flex flex-col p-6 w-[350px] min-h-[220px] shrink-0 mx-4",
        "border border-gray-200/50 dark:border-white/10 select-none",
        review.is_featured && "ring-1 ring-yellow-500/50",
        className
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-lg shadow-purple-500/20">
            {initials}
          </div>
          <div className="overflow-hidden">
            <h4 className="font-semibold text-gray-900 dark:text-white truncate text-sm">
              {review.user_name}
            </h4>
          </div>
        </div>
        {review.is_featured && (
          <div className="bg-yellow-500 text-white text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider shadow-sm">
            Top
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 mb-3">
        <div className="flex">
          {[...Array(5)].map((_, i) => (
            <Star key={i} size={12} className={cn(i < review.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300 dark:text-gray-600")} />
          ))}
        </div>
        <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 truncate bg-gray-100 dark:bg-white/5 px-2 py-0.5 rounded">
          {courseTitle}
        </span>
      </div>

      <div className="flex-grow">
        <p className="text-gray-700 dark:text-gray-300 text-[13px] leading-relaxed line-clamp-4 italic font-medium">
          &ldquo;{reviewText}&rdquo;
        </p>
      </div>

      {review.admin_reply && (
        <div className="mt-4 pt-3 border-t border-gray-100 dark:border-white/5 bg-blue-50/30 dark:bg-blue-900/10 rounded-b-xl -mx-6 -mb-6 px-6 pb-6">
          <div className="flex items-start gap-2">
            <div className="w-0.5 h-full bg-blue-500/50 rounded-full self-stretch" />
            <div>
              <p className="text-[9px] font-bold text-blue-500/80 uppercase tracking-tight mb-0.5">
                {t("reviewAdminResponse")}
              </p>
              <p className="text-[11px] text-gray-600 dark:text-gray-400 line-clamp-2">
                {review.admin_reply}
              </p>
            </div>
          </div>
        </div>
      )}

      {!review.admin_reply && review.created_at && (
        <div className="mt-4 text-[9px] text-gray-400 dark:text-gray-600 text-right">
          {formatLocalizedDate(review.created_at, lang, t)}
        </div>
      )}
    </MagicCard>
  );
}
