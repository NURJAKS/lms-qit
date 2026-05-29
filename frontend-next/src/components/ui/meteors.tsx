"use client";

import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface MeteorsProps {
  number?: number;
  className?: string;
}

export function Meteors({ number = 20, className }: MeteorsProps) {
  const [meteors, setMeteors] = useState<Array<{ id: number; left: string; delay: string; duration: string; size: string }>>([]);

  useEffect(() => {
    const meteorArray = Array.from({ length: number }, (_, i) => ({
      id: i,
      left: Math.floor(Math.random() * (400 - -400) + -400) + "px",
      delay: Math.random() * (0.8 - 0.2) + 0.2 + "s",
      duration: Math.random() * (10 - 2) + 2 + "s",
      size: Math.random() * (1 - 0.5) + 0.5 + "px",
    }));
    setMeteors(meteorArray);
  }, [number]);

  return (
    <>
      {meteors.map((meteor) => (
        <span
          key={meteor.id}
          className={cn(
            "animate-meteor-effect absolute top-1/2 left-1/2 h-px w-px rounded-[9999px] bg-slate-500 shadow-[0_0_0_1px_#ffffff10] rotate-[215deg]",
            "before:content-[''] before:absolute before:top-1/2 before:transform before:-translate-y-[50%] before:w-[50px] before:h-[1px] before:bg-gradient-to-r before:from-[#64748b] before:to-transparent",
            className
          )}
          style={{
            top: "0",
            left: meteor.left,
            animationDelay: meteor.delay,
            animationDuration: meteor.duration,
            opacity: Math.random() * 0.5 + 0.5,
          }}
        />
      ))}
    </>
  );
}
