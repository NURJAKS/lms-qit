"use client";

import React, { useEffect, useState } from "react";
import { ReviewCard } from "./ReviewCard";
import type { PublicReview } from "@/types/publicReview";
import { api as apiClient } from "@/api/client";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/LanguageContext";

interface ReviewsMarqueeProps {
  className?: string;
  speed?: number;
  reverse?: boolean;
  items?: PublicReview[];
}

export function ReviewsMarquee({
  className,
  speed = 60,
  reverse = false,
  items,
}: ReviewsMarqueeProps) {
  const { t } = useLanguage();
  const [reviews, setReviews] = useState<PublicReview[]>(items ?? []);
  const [loading, setLoading] = useState(!items);

  useEffect(() => {
    if (items) {
      setReviews(items);
      setLoading(false);
      return;
    }
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const { data } = await apiClient.get<PublicReview[]>("/reviews", {
          params: { is_featured: true, limit: 36 },
        });
        if (cancelled) return;
        if (data?.length) {
          setReviews(data);
          return;
        }
        const { data: all } = await apiClient.get<PublicReview[]>("/reviews", { params: { limit: 36 } });
        if (!cancelled) setReviews(all ?? []);
      } catch {
        if (!cancelled) setReviews([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [items]);

  if (loading) {
    return (
      <div className={cn("relative w-full py-12 flex justify-center", className)}>
        <div className="h-32 w-full max-w-md rounded-xl bg-gray-100 dark:bg-white/5 animate-pulse" />
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className={cn("relative w-full py-8 px-4 text-center text-gray-500 dark:text-gray-400 text-sm", className)}>
        {t("reviewsEmpty")}
      </div>
    );
  }

  const duplicatedReviews = [...reviews, ...reviews];

  return (
    <div className={cn("relative w-full overflow-hidden py-12 bg-transparent", className)}>
      <div className="absolute left-0 top-0 bottom-0 w-24 sm:w-48 bg-gradient-to-r from-white dark:from-[#0B0F19] to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-24 sm:w-48 bg-gradient-to-l from-white dark:from-[#0B0F19] to-transparent z-10 pointer-events-none" />

      <div
        className={cn("flex whitespace-nowrap", reverse ? "animate-marquee-reverse" : "animate-marquee")}
        style={
          {
            "--duration": `${speed}s`,
            width: "max-content",
          } as React.CSSProperties
        }
      >
        {duplicatedReviews.map((review, idx) => (
          <ReviewCard
            key={`${review.id}-${idx}`}
            review={review}
            className="hover:pause-animation transition-transform hover:scale-105 duration-300"
          />
        ))}
      </div>

      <style jsx>{`
        .animate-marquee:hover,
        .animate-marquee-reverse:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
}
