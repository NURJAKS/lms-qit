"use client";

import { useState, useEffect } from "react";

const DURATION = 2000;

export function CountUpStat({
  target,
  suffix = "",
  color,
}: {
  target: number;
  suffix?: string;
  color: string;
}) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / DURATION, 1);
      const eased = 1 - (1 - progress) ** 3;
      const current = Math.round(target * eased);
      setDisplayValue(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setDisplayValue(target);
      }
    };

    requestAnimationFrame(animate);
  }, [target]);

  return (
    <p className={`text-3xl font-bold ${color} mb-2`}>
      {displayValue}
      {suffix}
    </p>
  );
}
