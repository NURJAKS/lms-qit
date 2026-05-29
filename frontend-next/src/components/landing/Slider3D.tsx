"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useLanguage } from "@/context/LanguageContext";
import type { TranslationKey } from "@/i18n/translations";
import type { Course } from "@/types";
import { getLocalizedCourseTitle } from "@/lib/courseUtils";

// Уникальные градиенты для каждой карточки
const UNIQUE_GRADIENTS = [
  "from-[#1a237e] to-[#311b92]",      // Темно-синий/фиолетовый
  "from-[#00b0ff] to-[#00e5ff]",      // Голубой/циан
  "from-[#ff4081] to-[#ff80ab]",      // Розовый/маджента
  "from-[#76ff03] to-[#64dd17]",      // Зеленый/лайм
  "from-[#ff9800] to-[#ff5722]",      // Оранжевый/красный
  "from-[#9c27b0] to-[#673ab7]",      // Фиолетовый
  "from-[#00e676] to-[#00c853]",      // Ярко-зеленый
  "from-[#ff1744] to-[#d50000]",      // Красный
  "from-[#3f51b5] to-[#303f9f]",      // Индиго
  "from-[#00bcd4] to-[#0097a7]",      // Бирюзовый
  "from-[#ff6f00] to-[#e65100]",      // Темно-оранжевый
  "from-[#7b1fa2] to-[#6a1b9a]",      // Темно-фиолетовый
];

const SLIDER_COURSES_FALLBACK = [
  { titleKey: "coursesWebTitle" as const },
  { titleKey: "coursesAiTitle" as const },
  { titleKey: "coursesDataTitle" as const },
  { titleKey: "coursesMobileTitle" as const },
  { titleKey: "coursesDbTitle" as const },
  { titleKey: "coursesSecurityTitle" as const },
];

type Slider3DProps = {
  courses?: Course[];
  onCardClick?: (courseId: number) => void;
};

export function Slider3D({ courses = [], onCardClick }: Slider3DProps) {
  const { t } = useLanguage();
  const [isHovered, setIsHovered] = useState(false);
  const [isClickPaused, setIsClickPaused] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isNarrow, setIsNarrow] = useState(false);
  const [mounted, setMounted] = useState(false);
  const isPaused = isHovered || isClickPaused;

  useEffect(() => {
    setMounted(true);
    const checkMobile = () => {
      const w = window.innerWidth;
      setIsMobile(w <= 768);
      setIsNarrow(w <= 480);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const sliderItems = useMemo(() => {
    if (courses.length > 0) {
      return courses.slice(0, 6).map((c, index) => {
        // Используем уникальный градиент по индексу для каждой карточки
        const gradient = UNIQUE_GRADIENTS[index % UNIQUE_GRADIENTS.length];
        return { id: c.id, title: getLocalizedCourseTitle(c, t as (k: string) => string), gradient };
      });
    }
    return SLIDER_COURSES_FALLBACK.map((item, index) => ({
      id: null as number | null,
      title: t(item.titleKey as TranslationKey),
      gradient: UNIQUE_GRADIENTS[index % UNIQUE_GRADIENTS.length],
    }));
  }, [courses, t]);

  const quantity = sliderItems.length;

  const handleCardClick = useCallback(
    (id: number | null) => {
      setIsClickPaused(true);
      if (id !== null) onCardClick?.(id);
      setTimeout(() => setIsClickPaused(false), 4000);
    },
    [onCardClick]
  );

  // Вычисляем угол поворота для каждой карточки
  const getCardTransform = useCallback(
    (index: number) => {
      const angle = (360 / quantity) * index;
      // Во время гидратации (первый рендер) используем дефолтное значение, которое совпадает с серверным
      // На сервере window undefined, поэтому используется 353 (что дает translateZ = 110)
      if (!mounted) {
        const translateZ = 110;
        const tiltForward = -15;
        return `rotateX(${tiltForward}deg) rotateY(${angle}deg) translateZ(${translateZ}px)`;
      }
      
      const w = window.innerWidth;
      const translateZ = w <= 360 ? 110 : isNarrow ? 140 : isMobile ? 180 : 280;
      const tiltForward = -15; // Наклон вперед
      return `rotateX(${tiltForward}deg) rotateY(${angle}deg) translateZ(${translateZ}px)`;
    },
    [quantity, isMobile, isNarrow, mounted]
  );

  return (
    <section className="relative w-full min-h-[42vh] flex items-center justify-center overflow-hidden bg-[#f5f7ff] dark:bg-gray-800/50 py-8">
      {/* Фон с сеткой */}
      <div
        className="absolute inset-0 opacity-30 dark:opacity-20 pointer-events-none"
        style={{
          backgroundImage: `
            repeating-linear-gradient(to right, transparent 0 100px, rgba(26,35,126,0.08) 100px 101px),
            repeating-linear-gradient(to bottom, transparent 0 100px, rgba(26,35,126,0.08) 100px 101px)
          `,
        }}
      />

      {/* 3D сцена — текст в центре по глубине, карточки вращаются вокруг */}
      <div
        className="slider-3d-scene relative w-full min-h-[32vh] flex flex-col items-center justify-center overflow-hidden"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Текст IT COURSES — в середине по глубине (золотая середина) */}
        <div className="slider-3d-center-text absolute left-1/2 top-1/2 text-center pointer-events-none">
          <h2
            className="text-2xl sm:text-3xl lg:text-4xl font-bold font-montserrat whitespace-nowrap bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient"
            style={{
              backgroundImage: "linear-gradient(90deg, #1a237e, #00b0ff, #ff4081, #9c27b0, #1a237e)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
            }}
          >
            {t("slider3dTitle" as TranslationKey)}
          </h2>
        </div>

        <div
          className={`slider-3d ${isPaused ? "slider-3d-paused" : ""}`}
          style={{ "--quantity": quantity } as React.CSSProperties}
        >
          {sliderItems.map((item, i) => (
            <div
              key={item.id ?? `fallback-${i}`}
              className="slider-3d-item"
              style={{ transform: getCardTransform(i) } as React.CSSProperties}
            >
              <button
                type="button"
                onClick={() => handleCardClick(item.id)}
                className={`w-full h-full rounded-xl shadow-xl flex items-center justify-center bg-gradient-to-br ${item.gradient} p-4 cursor-pointer transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-transparent`}
              >
                <span className="text-base sm:text-lg font-bold text-white text-center drop-shadow-md font-montserrat">
                  {item.title}
                </span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
