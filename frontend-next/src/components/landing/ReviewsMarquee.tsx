"use client";

import React, { useEffect, useState } from "react";
import { ReviewCard } from "./ReviewCard";
import { mockReviews, type Review } from "@/data/mockReviews";
import { api as apiClient } from "@/api/client";
import { cn } from "@/lib/utils";

interface ReviewsMarqueeProps {
  className?: string;
  speed?: number; // Duration in seconds
  reverse?: boolean;
  items?: Review[];
}

export function ReviewsMarquee({ 
  className, 
  speed = 60, 
  reverse = false,
  items
}: ReviewsMarqueeProps) {
  const [reviews, setReviews] = useState<Review[]>(items || mockReviews);

  useEffect(() => {
    if (items) return; // Skip fetch if items are provided manually
    async function fetchFeaturedReviews() {
      try {
        const { data } = await apiClient.get("/reviews", { 
          params: { is_featured: true, limit: 10 } 
        });
        if (data && data.length > 0) {
          setReviews(data);
        }
      } catch (error) {
        // Fallback to mock data is already set in initial state
        console.warn("Using mock reviews for marquee");
      }
    }
    fetchFeaturedReviews();
  }, []);

  // Duplicate reviews to create a seamless loop
  const duplicatedReviews = [...reviews, ...reviews];

  return (
    <div className={cn("relative w-full overflow-hidden py-12 bg-transparent", className)}>
      {/* Side gradients for fading effect */}
      <div className="absolute left-0 top-0 bottom-0 w-24 sm:w-48 bg-gradient-to-r from-white dark:from-[#0B0F19] to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-24 sm:w-48 bg-gradient-to-l from-white dark:from-[#0B0F19] to-transparent z-10 pointer-events-none" />
      
      <div 
        className={cn(
          "flex whitespace-nowrap",
          reverse ? "animate-marquee-reverse" : "animate-marquee"
        )}
        style={{ 
          "--duration": `${speed}s`,
          width: "max-content"
        } as React.CSSProperties}
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
        .animate-marquee:hover, .animate-marquee-reverse:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
}
