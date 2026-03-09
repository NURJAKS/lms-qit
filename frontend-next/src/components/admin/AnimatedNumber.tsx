"use client";

import { useEffect, useRef, useState } from "react";
import CountUp from "react-countup";

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  className?: string;
  decimals?: number;
}

export function AnimatedNumber({ 
  value, 
  duration = 2, 
  className = "",
  decimals = 0 
}: AnimatedNumberProps) {
  const [shouldAnimate, setShouldAnimate] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !shouldAnimate) {
            setShouldAnimate(true);
          }
        });
      },
      { threshold: 0.1 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
    };
  }, [shouldAnimate]);

  return (
    <span ref={ref} className={className}>
      {shouldAnimate ? (
        <CountUp
          end={value}
          duration={duration}
          decimals={decimals}
          separator=" "
        />
      ) : (
        "0"
      )}
    </span>
  );
}
