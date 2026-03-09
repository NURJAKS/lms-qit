"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api } from "@/api/client";
import { useLanguage } from "@/context/LanguageContext";
import { useAuthStore } from "@/store/authStore";
import type { Course } from "@/types";
import { Zap, Layers, Brain, ChevronLeft } from "lucide-react";
import Link from "next/link";

type GameMode = "quiz" | "flashcard" | "memory";
type AILevel = "beginner" | "intermediate" | "expert";

export default function AIChallengeListPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const { user, isAdmin } = useAuthStore();

  useEffect(() => {
    if (user?.role === "parent") {
      router.replace("/app");
    }
  }, [user, router]);

  if (user?.role === "parent") {
    return null;
  }
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [gameMode, setGameMode] = useState<GameMode>("quiz");
  const [aiLevel, setAiLevel] = useState<AILevel>("intermediate");

  const { data: enrollments = [], isLoading: enrollmentsLoading } = useQuery({
    queryKey: ["my-enrollments"],
    queryFn: async () => {
      const { data } = await api.get<Array<{ course_id: number; course: Course }>>("/courses/my/enrollments");
      return data;
    },
  });

  const { data: courses = [], isLoading: coursesLoading } = useQuery({
    queryKey: ["courses-active"],
    queryFn: async () => {
      const { data } = await api.get<Course[]>("/courses?is_active=true");
      return data;
    },
    enabled: isAdmin(),
  });

  const isLoading = enrollmentsLoading || coursesLoading;
  const availableCourses = isAdmin() ? courses : enrollments.map((e) => e.course).filter((c): c is Course => !!c);
  const hasCourses = availableCourses.length > 0;

  // Автоматически выбираем первый курс (Python или первый доступный)
  useEffect(() => {
    if (!isLoading && hasCourses && !selectedCourse) {
      // Ищем курс Python или берем первый доступный
      const pythonCourse = availableCourses.find((c) => 
        c.title?.toLowerCase().includes("python") || 
        c.title?.includes("Python программалау")
      ) || availableCourses[0];
      setSelectedCourse(pythonCourse);
    }
  }, [isLoading, hasCourses, availableCourses, selectedCourse]);

  const handleStartChallenge = () => {
    if (!selectedCourse) return;
    router.push(`/app/ai-challenge/${selectedCourse.id}?mode=${gameMode}&level=${aiLevel}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div>
          <div className="w-16 h-16 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-center text-gray-600 dark:text-gray-400">
            {t("loading")}
          </p>
        </div>
      </div>
    );
  }

  if (!hasCourses) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center bg-purple-600">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-semibold mb-2 text-gray-800 dark:text-white">
            {isAdmin() ? t("noActiveCourses") : t("noEnrollments")}
          </h2>
          <p className="mb-6 text-gray-600 dark:text-gray-400">
            {t("aiChallengeEnroll")}
          </p>
          {!isAdmin() && (
            <Link
              href="/courses"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium text-white bg-purple-600 hover:bg-purple-700 transition-colors"
            >
              {t("goToCatalog")}
            </Link>
          )}
        </div>
      </div>
    );
  }

  // Если курс выбран, показываем настройки игры
  if (selectedCourse) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
              <Zap className="w-8 h-8 text-purple-600 dark:text-purple-400" />
            </div>
            <h1 className="text-2xl font-bold mb-2 text-gray-800 dark:text-white">
              AI vs Студент
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {selectedCourse.title}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              {gameMode === "flashcard"
                ? t("aiChallengeFlashcardDesc")
                : gameMode === "memory"
                  ? t("aiChallengeMemoryDesc")
                  : t("aiChallengeQuizDesc")}
            </p>
          </div>

          <div className="mb-6">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t("gameMode")}:</p>
            <div className="flex gap-2 justify-center flex-wrap mb-4">
              {([
                { mode: "quiz" as GameMode, icon: Zap, label: t("quiz") },
                { mode: "flashcard" as GameMode, icon: Layers, label: t("flashcardDuel") },
                { mode: "memory" as GameMode, icon: Brain, label: t("memoryGame") },
              ]).map(({ mode, icon: Icon, label }) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setGameMode(mode)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    gameMode === mode
                      ? "bg-purple-600 text-white"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
            {gameMode !== "memory" && (
              <>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t("aiLevel")}</p>
                <div className="flex gap-2 justify-center flex-wrap">
                  {([
                    { level: "beginner" as AILevel, label: t("aiLevelBeginner") },
                    { level: "intermediate" as AILevel, label: t("aiLevelIntermediate") },
                    { level: "expert" as AILevel, label: t("aiLevelExpert") },
                  ]).map(({ level, label }) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setAiLevel(level)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        aiLevel === level
                          ? "bg-purple-600 text-white"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="flex justify-center mt-8">
            <button
              onClick={handleStartChallenge}
              className="px-8 py-3 rounded-lg text-white bg-purple-600 hover:bg-purple-700 font-medium transition-colors"
            >
              {t("aiStarting")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Если нет курсов, показываем сообщение
  if (!hasCourses) {
    return null; // Уже обработано выше
  }

  // Показываем загрузку, пока курс не выбран
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div>
        <div className="w-16 h-16 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto" />
        <p className="mt-4 text-center text-gray-600 dark:text-gray-400">
          {t("loading")}
        </p>
      </div>
    </div>
  );
}
