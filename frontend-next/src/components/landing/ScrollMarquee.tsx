"use client";

import { useEffect, useState, useRef } from "react";
import { useLanguage } from "@/context/LanguageContext";
import type { TranslationKey } from "@/i18n/translations";

const COURSE_KEYS: TranslationKey[] = [
  "coursesWebFull",
  "coursesAiFull",
  "coursesDataFull",
  "coursesMobileFull",
  "coursesDbFull",
  "coursesSecurityFull",
  "coursesWebTitle",
  "coursesAiTitle",
  "coursesDataTitle",
  "coursesMobileTitle",
];

const TECHNOLOGIES = [
   "REST API", "FastAPI", "Python", "PostgreSQL", "HTML", "CSS", "JavaScript", "TypeScript",
  "React", "Node.js", "Flask", "SQL", "Docker", "Git", "Redis",
  "Vue.js", "Next.js", "Tailwind", "GraphQL", "Kubernetes", "AWS",
  "TensorFlow", "Django",
];

type MarqueeDirection = "left" | "right";

interface ScrollMarqueeProps {
  direction?: MarqueeDirection;
  noBorderTop?: boolean;
}

export function ScrollMarquee({ direction = "left", noBorderTop }: ScrollMarqueeProps) {
  const { t } = useLanguage();
  const [scrollOffset, setScrollOffset] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onScroll = () => {
      const section = sectionRef.current;
      if (!section) return;
      const rect = section.getBoundingClientRect();
      const sectionTop = rect.top + window.scrollY;
      const scrollStart = direction === "right" ? Math.max(0, sectionTop - window.innerHeight) : 0;
      const effectiveScroll = Math.max(0, window.scrollY - scrollStart);
      setScrollOffset(effectiveScroll * 0.4);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [direction]);

  const items = direction === "left"
    ? COURSE_KEYS.map((key) => t(key)).filter(Boolean)
    : TECHNOLOGIES;
  // Много копий для непрерывного заполнения без пустых промежутков
  const track = direction === "left"
    ? [...items, ...items, ...items, ...items]
    : [...items, ...items, ...items, ...items, ...items, ...items];
  // Для direction="right" — начальный сдвиг влево, чтобы слева всегда был контент
  const leftOffset = direction === "right" ? 600 : 0;
  const translateX = direction === "left" ? -scrollOffset : -leftOffset + scrollOffset;

  return (
    <section
      ref={sectionRef}
      className={`overflow-hidden py-8 bg-[#f5f7ff] dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 ${noBorderTop ? "border-b border-t-0" : "border-y"} ${direction === "right" ? "w-[calc(100%+12rem)] -mr-[12rem]" : "w-full"}`}
    >
      <div className="relative w-full">
        <div
          className={`flex whitespace-nowrap gap-12 py-4 transition-transform duration-150 ease-out will-change-transform ${direction === "right" ? "pr-32 lg:pr-48" : ""}`}
          style={{
            transform: `translateX(${translateX}px)`,
          }}
        >
          {track.map((name, i) => (
            <span
              key={i}
              className="text-lg font-semibold text-[#1a237e] dark:text-[#00b0ff] shrink-0"
            >
              {name} •
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
