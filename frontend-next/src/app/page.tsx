"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Bot,
  Code2,
  Users,
  GraduationCap,
  PlayCircle,
  Clock,
  Signal,
  MessageCircle,
  BookOpen,
  LineChart,
  Lightbulb,
  Plus,
  Minus,
  Instagram,
  Headphones,
  Gift,
  Award,
  Trophy,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useLanguage } from "@/context/LanguageContext";
import type { TranslationKey } from "@/i18n/translations";
import { api } from "@/api/client";
import type { Course } from "@/types";
import { AppHeader } from "@/components/common/AppHeader";
import { LandingChatWidget } from "@/components/landing/LandingChatWidget";
import { CoursePickerWidget } from "@/components/landing/CoursePickerWidget";
import { TypingHeroText } from "@/components/landing/TypingHeroText";
import { CountUpStat } from "@/components/landing/CountUpStat";
import ScrollVelocity from "@/components/landing/ScrollVelocity";
import { Slider3D } from "@/components/landing/Slider3D";
import { ReviewsMarquee } from "@/components/landing/ReviewsMarquee";
import { mockReviews } from "@/data/mockReviews";
import {
  getCategoryFromCourse,
  courseImageUrl,
  getLocalizedCourseTitle,
  getLocalizedCourseDesc,
  CATEGORY_ACCENT,
  CATEGORY_GRADIENT,
  CATEGORY_METRICS,
} from "@/lib/courseUtils";

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
  "REST API",
  "FastAPI",
  "Python",
  "PostgreSQL",
  "HTML",
  "CSS",
  "JavaScript",
  "TypeScript",
  "React",
  "Node.js",
  "Flask",
  "SQL",
  "Docker",
  "Git",
  "Redis",
  "Vue.js",
  "Next.js",
  "Tailwind",
  "GraphQL",
  "Kubernetes",
  "AWS",
  "TensorFlow",
  "Django",
];

const CATEGORIES = [
  { id: "all", key: "coursesFilterAll" },
  { id: "web", key: "coursesFilterWeb" },
  { id: "ai", key: "coursesFilterAi" },
  { id: "mobile", key: "coursesFilterMobile" },
  { id: "data", key: "coursesFilterData" },
] as const;

const ADVANTAGES = [
  { icon: Bot, iconColor: "text-[#1a237e]", titleKey: "advantagesAiTitle", descKey: "advantagesAiDesc" },
  { icon: Code2, iconColor: "text-[#00b0ff]", titleKey: "advantagesProjectsTitle", descKey: "advantagesProjectsDesc" },
  { icon: Users, iconColor: "text-[#ff4081]", titleKey: "advantagesTeachersTitle", descKey: "advantagesTeachersDesc" },
] as const;

export default function HomePage() {
  const { t } = useLanguage();
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const [category, setCategory] = useState<string>("all");
  const advantagesRef = useRef<HTMLElement>(null);
  const [advantagesVisible, setAdvantagesVisible] = useState(false);
  const coursesRef = useRef<HTMLElement>(null);
  const [coursesVisible, setCoursesVisible] = useState(false);
  const [faqOpen, setFaqOpen] = useState<number | null>(null);
  const [highlightedCourseId, setHighlightedCourseId] = useState<number | null>(null);
  const heroBtnRef = useRef<HTMLAnchorElement>(null);
  const [heroBtnTilt, setHeroBtnTilt] = useState({ x: 0, y: 0 });

  const { data: courses = [], isLoading: coursesLoading, isError: coursesError } = useQuery({
    queryKey: ["courses-all"],
    queryFn: async () => {
      const { data } = await api.get<Course[]>("/courses");
      return data;
    },
  });

  const filteredCourses =
    category === "all"
      ? courses
      : courses.filter((c) => getCategoryFromCourse(c).key === category);

  const onHeroBtnMouseMove = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    const el = heroBtnRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left - rect.width / 2) / rect.width;
    const y = (e.clientY - rect.top - rect.height / 2) / rect.height;
    setHeroBtnTilt({ x: y * 8, y: x * 8 });
  }, []);

  const onHeroBtnMouseLeave = useCallback(() => setHeroBtnTilt({ x: 0, y: 0 }), []);

  const scrollTo = (id: string) => {
    if (id === "home") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSliderCardClick = useCallback((courseId: number) => {
    const course = courses.find((c) => c.id === courseId);
    if (course) {
      setCategory(getCategoryFromCourse(course).key);
      setHighlightedCourseId(courseId);
      setTimeout(() => scrollTo("courses"), 100);
      setTimeout(() => scrollTo(`course-${courseId}`), 500);
      setTimeout(() => setHighlightedCourseId(null), 3500);
    }
  }, [courses]);

  useEffect(() => {
    if (token) router.replace("/app");
  }, [token, router]);

  useEffect(() => {
    const el = advantagesRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => e.isIntersecting && setAdvantagesVisible(true),
      { threshold: 0.05 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const el = coursesRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => e.isIntersecting && setCoursesVisible(true),
      { threshold: 0.05 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  if (token) return null;

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 overflow-x-hidden">
      {/* Header */}
      <header
        id="home"
        className="fixed top-0 left-0 right-0 z-50 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-b border-gray-100 dark:border-gray-800"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-20 gap-4 sm:gap-6 lg:gap-8">
            <Link href="/" className="flex items-center gap-2 shrink-0">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg animate-[spin_3s_linear_infinite]"
                style={{ background: "var(--qit-gradient-1)" }}
              >
                Q
              </div>
              <span className="text-xl font-bold text-gray-900 dark:text-white font-montserrat">
                Qazaq IT Academy
              </span>
            </Link>
            <nav className="hidden md:flex items-center justify-center gap-4 lg:gap-6 flex-1">
              <button type="button" onClick={() => scrollTo("home")} className="shrink-0 py-2 text-gray-600 dark:text-gray-300 hover:text-[#1a237e] dark:hover:text-[#00b0ff] font-medium transition-colors whitespace-nowrap text-center">
                {t("navHome")}
              </button>
              <Link href="/courses" className="shrink-0 py-2 text-gray-600 dark:text-gray-300 hover:text-[#1a237e] dark:hover:text-[#00b0ff] font-medium transition-colors whitespace-nowrap text-center">
                {t("courseCatalog")}
              </Link>
              <button type="button" onClick={() => scrollTo("ai")} className="shrink-0 py-2 text-gray-600 dark:text-gray-300 hover:text-[#1a237e] dark:hover:text-[#00b0ff] font-medium transition-colors whitespace-nowrap text-center">
                {t("navCoursePicker")}
              </button>
              <button type="button" onClick={() => scrollTo("ai")} className="shrink-0 py-2 text-gray-600 dark:text-gray-300 hover:text-[#1a237e] dark:hover:text-[#00b0ff] font-medium transition-colors whitespace-nowrap text-center">
                {t("navAi")}
              </button>
              <button type="button" onClick={() => scrollTo("about")} className="shrink-0 py-2 text-gray-600 dark:text-gray-300 hover:text-[#1a237e] dark:hover:text-[#00b0ff] font-medium transition-colors whitespace-nowrap text-center">
                {t("navAbout")}
              </button>
              <button type="button" onClick={() => scrollTo("contact")} className="shrink-0 py-2 text-gray-600 dark:text-gray-300 hover:text-[#1a237e] dark:hover:text-[#00b0ff] font-medium transition-colors whitespace-nowrap text-center">
                {t("navContact")}
              </button>
            </nav>
            <div className="flex items-center gap-6 ml-auto shrink-0">
              <Link
                href="/login"
                className="px-5 py-2.5 rounded-full font-semibold text-white transition-all hover:opacity-90 whitespace-nowrap"
                style={{ background: "var(--qit-gradient-3)" }}
              >
                {t("navPersonalCabinet")}
              </Link>
              <AppHeader />
            </div>
          </div>
        </div>
      </header>

      <section className="relative min-h-[90vh] flex items-center justify-center pt-20 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url(/hero-bg.jpg)" }}
        />
        <div className="absolute inset-0 bg-[#1a237e]/60" />
        <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[120px] h-[120px] animate-orbit-faster">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-white/50" />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-1 h-1 rounded-full bg-white/40" />
          </div>
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] animate-orbit-fast">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white/40" />
            <div className="absolute top-1/2 right-0 -translate-y-1/2 translate-x-1/2 w-1 h-1 rounded-full bg-[#00b0ff]/35" />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-1 h-1 rounded-full bg-white/35" />
          </div>
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] animate-orbit">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-white/35" />
            <div className="absolute top-1/2 right-0 -translate-y-1/2 translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#00e5ff]/30" />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-1 h-1 rounded-full bg-white/30" />
            <div className="absolute top-1/2 left-0 -translate-y-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#ff4081]/25" />
          </div>
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px] animate-orbit-slow">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-white/30" />
            <div className="absolute top-1/2 right-0 -translate-y-1/2 translate-x-1/2 w-1 h-1 rounded-full bg-[#00b0ff]/25" />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-1 h-1 rounded-full bg-white/25" />
            <div className="absolute top-1/2 left-0 -translate-y-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#00e5ff]/20" />
          </div>
          <div className="absolute top-[20%] left-[15%] w-1 h-1 rounded-full bg-white/50 animate-float-particle" />
          <div className="absolute top-[30%] right-[20%] w-2 h-2 rounded-full bg-[#00b0ff]/40 animate-float-particle" style={{ animationDelay: "-2s" }} />
          <div className="absolute bottom-[25%] left-[25%] w-1.5 h-1.5 rounded-full bg-[#ff4081]/40 animate-float-particle-slow" style={{ animationDelay: "-4s" }} />
          <div className="absolute bottom-[35%] right-[15%] w-1 h-1 rounded-full bg-white/40 animate-float-particle" style={{ animationDelay: "-1s" }} />
          <div className="absolute top-[50%] left-[10%] w-1 h-1 rounded-full bg-[#00e5ff]/50 animate-float-particle-slow" style={{ animationDelay: "-3s" }} />
          <div className="absolute top-[45%] right-[10%] w-1.5 h-1.5 rounded-full bg-white/30 animate-float-particle-fast" style={{ animationDelay: "-5s" }} />
        </div>
        <div className="relative z-20 max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4 sm:mb-6 font-montserrat leading-tight px-2">
            <span className="block sm:inline">{t("heroTitle")}</span>
            <span
              className="bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient block sm:inline"
              style={{
                backgroundImage: "linear-gradient(90deg, #6366f1, #8b5cf6, #ec4899, #06b6d4, #6366f1)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
              }}
            >
              <TypingHeroText />
            </span>
            <span className="block sm:inline">{t("heroTitleSuffix")}</span>
          </h1>
          <p className="text-base sm:text-lg lg:text-xl text-white/90 mb-6 sm:mb-10 max-w-2xl mx-auto px-4">
            {t("heroDescription")}
          </p>
          <Link
            ref={heroBtnRef}
            href="/courses"
            onMouseMove={onHeroBtnMouseMove}
            onMouseLeave={onHeroBtnMouseLeave}
            className="inline-flex items-center gap-2 sm:gap-3 px-6 sm:px-8 lg:px-10 py-3 sm:py-4 rounded-full font-bold text-base sm:text-lg text-white transition-colors hover:opacity-95 shadow-lg hover:shadow-xl"
            style={{
              background: "linear-gradient(90deg, #ff4081, #e040fb)",
              transform: `perspective(500px) rotateX(${-heroBtnTilt.x}deg) rotateY(${heroBtnTilt.y}deg)`,
              transition: "transform 0.15s ease-out, opacity 0.2s",
            }}
          >
            <PlayCircle className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" strokeWidth={2} />
            <span className="whitespace-nowrap">{t("heroButton")}</span>
          </Link>
          <p className="mt-3 sm:mt-4 text-sm sm:text-base text-white/80 px-4">
            {t("pickerHeroHint")}{" "}
            <button type="button" onClick={() => scrollTo("ai")} className="underline hover:text-white font-medium">
              {t("navCoursePicker")}
            </button>
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 lg:py-20 bg-[#f5f7ff] dark:bg-gray-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { target: 2000, suffix: "+", labelKey: "statsStudents", color: "text-[#1a237e]" },
              { target: 50, suffix: "+", labelKey: "statsCourses", color: "text-[#00b0ff]" },
              { target: 40, suffix: "+", labelKey: "statsTeachers", color: "text-[#1a237e]" },
              { target: 95, suffix: "%", labelKey: "statsSatisfaction", color: "text-[#ff4081]" },
            ].map(({ target, suffix, labelKey, color }, i) => (
              <div
                key={labelKey}
                className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg relative overflow-hidden animate-float"
                style={{ animationDelay: `${i * 200}ms` }}
              >
                <div className="absolute top-0 left-0 right-0 h-1" style={{ background: "var(--qit-gradient-2)" }} />
                <CountUpStat target={target} suffix={suffix} color={color} />
                <p className="text-gray-600 dark:text-gray-400">{t(labelKey as TranslationKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Advantages */}
      <section ref={advantagesRef} id="about" className="py-16 lg:py-24 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-4 font-montserrat">
            {t("advantagesTitle")}
          </h2>
          <div className="w-24 h-1 mx-auto mb-16 rounded-full" style={{ background: "var(--qit-gradient-3)" }} />
          <div className="grid md:grid-cols-3 gap-8">
            {ADVANTAGES.map(({ icon: Icon, iconColor, titleKey, descKey }, i) => (
              <div
                key={titleKey}
                className={`group bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden relative transition-shadow duration-300 hover:shadow-[0_20px_40px_-12px_rgba(0,176,255,0.25),0_8px_20px_-8px_rgba(255,64,129,0.15)] dark:hover:shadow-[0_20px_40px_-12px_rgba(0,176,255,0.2),0_8px_20px_-8px_rgba(255,64,129,0.12)] ${advantagesVisible ? "animate-wiggle" : ""
                  }`}
                style={advantagesVisible ? { animationDelay: `${i * 200}ms` } : undefined}
              >
                <div className="absolute top-0 left-0 right-0 h-1" style={{ background: "var(--qit-gradient-2)" }} />
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6" style={{ background: "var(--qit-light)" }}>
                  <Icon className={`w-8 h-8 ${iconColor}`} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 font-montserrat">
                  {t(titleKey as TranslationKey)}
                </h3>
                <p className="text-gray-600 dark:text-gray-400">{t(descKey as TranslationKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Scroll Velocity — курсы и технологии */}
      <section className="overflow-hidden py-8 bg-[#f5f7ff] dark:bg-gray-800/50 border-y border-gray-200 dark:border-gray-700">
        <ScrollVelocity
          texts={COURSE_KEYS.map((key) => t(key)).filter(Boolean)}
          velocity={100}
          className="text-lg font-semibold text-[#1a237e] dark:text-[#00b0ff] shrink-0"
          parallaxClassName="parallax"
          scrollerClassName="scroller"
          numCopies={4}
        />
      </section>
      <section className="overflow-hidden py-8 bg-[#f5f7ff] dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
        <ScrollVelocity
          texts={TECHNOLOGIES}
          velocity={-100}
          className="text-lg font-semibold text-[#1a237e] dark:text-[#00b0ff] shrink-0"
          parallaxClassName="parallax"
          scrollerClassName="scroller"
          numCopies={6}
        />
      </section>

      {/* 3D Slider — карусель курсов */}
      <Slider3D courses={courses} onCardClick={handleSliderCardClick} />

      {/* Courses */}
      <section ref={coursesRef} id="courses" className="py-16 lg:py-24 bg-[#f5f7ff] dark:bg-gray-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white font-montserrat">
              {t("coursesTitle")}
            </h2>
            <div className="flex flex-wrap gap-3">
              {CATEGORIES.map(({ id, key }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setCategory(id)}
                  className={`px-5 py-2.5 rounded-full font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#00b0ff] focus:ring-offset-2 ${category === id
                    ? "text-white"
                    : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-2 border-gray-200 dark:border-gray-600 hover:border-[#00b0ff] hover:scale-105"
                    }`}
                  style={category === id ? { background: "var(--qit-gradient-2)" } : undefined}
                >
                  {t(key as TranslationKey)}
                </button>
              ))}
            </div>
          </div>
          {coursesLoading && (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-12 h-12 animate-spin text-[#00b0ff] mb-4" />
              <p className="text-gray-600 dark:text-gray-400">{t("loading")}</p>
            </div>
          )}
          {coursesError && (
            <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-6 text-center">
              <p className="font-medium text-red-700 dark:text-red-400 mb-2">{t("errorLoadingCourses")}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">{t("checkBackendRunning")}</p>
            </div>
          )}
          {!coursesLoading && !coursesError && (
            <>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {filteredCourses.slice(0, 6).map((course, i) => {
                  const category = getCategoryFromCourse(course);
                  const accent = CATEGORY_ACCENT[category.key] ?? "#00b0ff";
                  const gradient = CATEGORY_GRADIENT[category.key] ?? "from-[#00b0ff] to-[#00e5ff]";
                  const metrics = CATEGORY_METRICS[category.key] ?? CATEGORY_METRICS.data;
                  const imgUrl = courseImageUrl(course);
                  return (
                    <div
                      key={course.id}
                      id={`course-${course.id}`}
                      className={`group bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-lg relative border-2 transition-all duration-300 hover:-translate-y-2 scroll-mt-24 ${highlightedCourseId === course.id
                        ? "border-[#00b0ff] shadow-[0_0_0_4px_rgba(0,176,255,0.3)] ring-2 ring-[#00b0ff]/50"
                        : "border-gray-100 dark:border-gray-700 hover:shadow-[0_20px_40px_-12px_rgba(0,176,255,0.2),0_8px_20px_-8px_rgba(255,64,129,0.12)] dark:hover:shadow-[0_20px_40px_-12px_rgba(0,176,255,0.2),0_8px_20px_-8px_rgba(255,64,129,0.12)]"
                        } ${coursesVisible ? "animate-slide-up opacity-0" : "opacity-0"}`}
                      style={{
                        borderLeftWidth: 4,
                        borderLeftColor: accent,
                        ...(coursesVisible ? { animationDelay: `${i * 80}ms`, animationFillMode: "forwards" } : {}),
                      }}
                    >
                      <div className={`h-48 relative overflow-hidden bg-gradient-to-br ${gradient}`}>
                        <img src={imgUrl} alt={getLocalizedCourseTitle(course, t as (k: string) => string)} className="absolute inset-0 w-full h-full object-cover opacity-80" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                        <span className="absolute bottom-3 left-4 text-xl font-bold text-white drop-shadow-md">
                          {getLocalizedCourseTitle(course, t as (k: string) => string)}
                        </span>
                      </div>
                      <div className="p-6">
                        <span
                          className="inline-block px-4 py-1 rounded-full text-sm font-semibold mb-3 border"
                          style={{ background: `${accent}20`, color: accent, borderColor: `${accent}50` }}
                        >
                          {t(category.labelKey as TranslationKey)}
                        </span>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 font-montserrat">
                          {getLocalizedCourseTitle(course, t as (k: string) => string)}
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-3">
                          {getLocalizedCourseDesc(course, t as (k: string) => string)}
                        </p>
                        <div className="flex flex-wrap gap-4 text-sm text-gray-500 dark:text-gray-400 mb-4">
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {t(metrics.durationKey as TranslationKey)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Signal className="w-4 h-4" />
                            {t(metrics.levelKey as TranslationKey)}
                          </span>
                          <span className="flex items-center gap-1">
                            <GraduationCap className="w-4 h-4" />
                            {metrics.students} {t("coursesStudents")}
                          </span>
                        </div>
                        <p className="text-xl font-bold text-[#1a237e] dark:text-[#00b0ff] mb-4">
                          {Number(course.price)} ₸
                        </p>
                        <Link
                          href={`/courses?course=${course.id}`}
                          className="block w-full py-3 rounded-full font-semibold text-white text-center transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-indigo-500/30"
                          style={{ background: "var(--qit-gradient-1)" }}
                        >
                          {t("coursesEnroll")}
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-10 text-center">
                <Link
                  href="/courses"
                  className="inline-flex items-center gap-2 px-8 py-3 rounded-full font-semibold text-white transition-all hover:scale-105 hover:shadow-lg"
                  style={{ background: "var(--qit-gradient-2)" }}
                >
                  {t("moreCourses")}
                  <ChevronRight className="w-5 h-5" />
                </Link>
              </div>
            </>
          )}
        </div>
      </section>

      {/* AI Section — трёхколоночная структура: AI | Платформа | Подбор курса */}
      <section id="ai" className="py-16 lg:py-24 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-[1fr_1fr_1.1fr] gap-0 items-stretch overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl">
            {/* Левая колонка: AI-помощник */}
            <div className="p-6 lg:p-8 flex flex-col justify-center bg-white dark:bg-gray-900 border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-gray-700">
              <h2 className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-white mb-4 font-montserrat">
                {t("aiTitle")}{" "}
                <span
                  className="bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient"
                  style={{
                    backgroundImage: "linear-gradient(90deg, #6366f1, #8b5cf6, #06b6d4, #6366f1)",
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                  }}
                >
                  {t("aiHighlight")}
                </span>{" "}
                {t("aiTitleSuffix")}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                {t("aiDescription")}
              </p>
              <ul className="space-y-3">
                {[
                  { icon: MessageCircle, key: "aiFeature1" },
                  { icon: BookOpen, key: "aiFeature2" },
                  { icon: LineChart, key: "aiFeature3" },
                  { icon: Lightbulb, key: "aiFeature4" },
                ].map(({ icon: Icon, key }) => (
                  <li key={key} className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-[#06b6d4]/20 text-[#06b6d4] dark:bg-[#06b6d4]/30">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-sm">{t(key as TranslationKey)}</span>
                  </li>
                ))}
              </ul>
              <div className="flex items-center gap-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-white shrink-0" style={{ background: "var(--qit-gradient-2)" }}>
                  <Bot className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-bold text-gray-900 dark:text-white text-sm">QIT</p>
                  <p className="text-gray-500 dark:text-gray-400 text-xs">{t("aiAssistantName")}</p>
                </div>
              </div>
            </div>

            {/* Средняя колонка: подбор курса */}
            <div className="relative p-6 lg:p-8 flex flex-col border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-gray-700" style={{ background: "var(--qit-gradient-1)" }}>
              <div
                className="absolute inset-0 opacity-30 pointer-events-none"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0L60 30L30 60L0 30Z' fill='%23ffffff' fill-opacity='0.03'/%3E%3C/svg%3E")`,
                }}
              />
              <h3 className="text-lg lg:text-xl font-bold text-white uppercase tracking-wide mb-4 relative">
                {t("navCoursePicker").toUpperCase()}
              </h3>
              <p className="text-white/90 text-sm mb-6 relative">{t("pickerSubtitle")}</p>
              <div className="relative flex-1 min-h-[200px]">
                <CoursePickerWidget />
              </div>
            </div>

            {/* Правая колонка: преимущества платформы — насыщенный фон, иконка Q внизу */}
            <div className="relative p-6 lg:p-8 flex flex-col justify-between overflow-hidden border-b lg:border-b-0 border-gray-200 dark:border-gray-700" style={{ background: "linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #1e1b4b 100%)" }}>
              <div
                className="absolute inset-0 opacity-20 pointer-events-none"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M20 0L40 20L20 40L0 20Z' fill='%2306b6d4' fill-opacity='0.15'/%3E%3C/svg%3E")`,
                }}
              />
              <div className="relative">
                <h3 className="text-lg font-bold text-white mb-5 font-montserrat">
                  {t("aiPlatformBenefits")}
                </h3>
                <ul className="space-y-4">
                  {[
                    { icon: Headphones, key: "aiFeature5" },
                    { icon: Gift, key: "aiFeature6" },
                    { icon: Award, key: "aiFeature7" },
                    { icon: Trophy, key: "aiFeature8" },
                    { icon: Users, key: "aiFeature9" },
                  ].map(({ icon: Icon, key }) => (
                    <li key={key} className="flex items-center gap-4 text-white/95">
                      <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 bg-[#06b6d4]/25 text-[#06b6d4] border border-[#06b6d4]/40">
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="text-sm font-medium">{t(key as TranslationKey)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="relative flex items-center gap-4 mt-8 pt-6 border-t border-white/10">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 bg-[#1a237e] text-white font-bold text-2xl shadow-lg" style={{ fontFamily: "var(--font-geist-sans)" }}>
                  Q
                </div>
                <div>
                  <p className="font-bold text-white text-base">QIT</p>
                  <p className="text-white/70 text-sm">{t("aiAssistantName")}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Reviews Section */}
      <section className="py-20 overflow-hidden bg-white dark:bg-[#0B0F19]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12 text-center">
          <h2 className="text-3xl lg:text-4xl font-extrabold text-gray-900 dark:text-white mb-4 font-geologica tracking-tight">
            {t("reviewsTitle")}
          </h2>
          <div className="w-20 h-1.5 mx-auto mb-6 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 shadow-lg shadow-purple-500/20" />
          <p className="max-w-2xl mx-auto text-gray-600 dark:text-gray-400 text-lg leading-relaxed">
            {t("reviewsSubtitle")}
          </p>
        </div>
        
        <ReviewsMarquee speed={60} items={mockReviews.slice(0, 18)} />
        <ReviewsMarquee speed={80} reverse className="-mt-8" items={mockReviews.slice(18)} />
      </section>

      {/* FAQ */}
      <section id="faq" className="py-16 lg:py-20 bg-[#f5f7ff] dark:bg-gray-800/50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mb-2 font-montserrat text-center">
            {t("faqTitle")}
          </h2>
          <div className="w-16 h-1 mx-auto mb-4 rounded-full" style={{ background: "var(--qit-gradient-2)" }} />
          <p className="text-gray-500 dark:text-gray-400 text-center mb-10 text-sm">{t("faqSubtitle")}</p>
          <div className="space-y-4">
            {[
              { q: "faqQ1", a: "faqA1" },
              { q: "faqQ2", a: "faqA2" },
              { q: "faqQ3", a: "faqA3" },
              { q: "faqQ4", a: "faqA4" },
            ].map((item, i) => (
              <div
                key={i}
                className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden transition-shadow duration-300 hover:shadow-[0_12px_24px_-8px_rgba(0,176,255,0.15)] dark:hover:shadow-[0_12px_24px_-8px_rgba(0,176,255,0.1)]"
              >
                <div className="absolute top-0 left-0 right-0 h-1" style={{ background: "var(--qit-gradient-2)" }} />
                <button
                  type="button"
                  onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left font-medium text-gray-900 dark:text-white hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors"
                >
                  <span>{t(item.q as TranslationKey)}</span>
                  <span className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-colors" style={{ background: "rgba(0, 176, 255, 0.1)" }}>
                    {faqOpen === i ? <Minus className="w-4 h-4 text-[#00b0ff]" /> : <Plus className="w-4 h-4 text-[#00b0ff]" />}
                  </span>
                </button>
                {faqOpen === i && (
                  <div className="px-5 pb-5 pt-0 border-t border-gray-100 dark:border-gray-700">
                    <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed pt-4">
                      {t(item.a as TranslationKey)}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white font-montserrat mb-1">Qazaq IT Academy</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm">{t("footerTagline")}</p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-3">{t("footerAddress")}</h4>
              <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">{t("footerLocation")}</p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-3">{t("footerContact")}</h4>
              <a href="tel:+77024236474" className="text-[#1a237e] dark:text-[#00b0ff] text-sm hover:underline block">{t("footerPhone")}</a>
              <a href="mailto:qazaqitacademy@gmail.com" className="text-gray-600 dark:text-gray-300 text-sm hover:underline block mt-1">{t("footerEmail")}</a>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-3">{t("footerSocial")}</h4>
              <div className="flex gap-2">
                <a href="https://www.instagram.com/qazaqitacademy?igsh=MWxzbmNxZzJwMXE0Zw%3D%3D&utm_source=qr" target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-full bg-pink-500/20 flex items-center justify-center text-pink-600 dark:text-pink-400 hover:bg-pink-500/30 transition-colors" aria-label="Instagram">
                  <Instagram className="w-4 h-4" />
                </a>
                <a href="https://t.me/qazaqitacademy" target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-full bg-sky-500/20 flex items-center justify-center text-sky-600 dark:text-sky-400 hover:bg-sky-500/30 transition-colors" aria-label="Telegram">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" /></svg>
                </a>
                <a href="https://chat.whatsapp.com/H7zVHSuISNVGFobjwclNe3" target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-full bg-green-500/20 flex items-center justify-center text-green-600 dark:text-green-400 hover:bg-green-500/30 transition-colors" aria-label="WhatsApp">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.865 9.865 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                </a>
              </div>
            </div>
          </div>
        </div>
        <div className="border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 py-4">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <p className="text-center text-sm font-medium text-gray-700 dark:text-gray-300">{t("footerCopyright")}</p>
          </div>
        </div>
      </footer>

      <LandingChatWidget />
    </div>
  );
}
