"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { api } from "@/api/client";
import { useLanguage } from "@/context/LanguageContext";
import type { TranslationKey } from "@/i18n/translations";
import { Trophy, Download, Medal, Award, X, BookOpen } from "lucide-react";
import { LeaderboardHeader } from "@/components/leaderboard/LeaderboardHeader";
import { StatCard } from "@/components/leaderboard/StatCard";
import { LeaderboardRow } from "@/components/leaderboard/LeaderboardRow";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { AnimatedGridPattern } from "@/components/ui/animated-grid-pattern";
import { Meteors } from "@/components/ui/meteors";
import { DotPattern } from "@/components/ui/dot-pattern";
import { BlurFade } from "@/components/ui/blur-fade";
import { motion, AnimatePresence } from "motion/react";
import { getLocalizedCourseTitle } from "@/lib/courseUtils";

type LeaderboardRow = {
  rank: number;
  user_id: number;
  full_name: string;
  email: string;
  avg_score: number;
  courses_done: number;
  activity: number;
  points: number;
};

function RatingTable({
  rows,
  columns,
  t,
  onCoursesClick,
}: {
  rows: LeaderboardRow[];
  columns: readonly { key: keyof LeaderboardRow; labelKey: TranslationKey }[];
  t: (k: TranslationKey) => string;
  onCoursesClick?: (row: LeaderboardRow) => void;
}) {
  return (
    <table className="w-full">
      <thead className="bg-gray-50/80 dark:bg-gray-700/80 backdrop-blur-sm sticky top-0 z-10">
        <tr>
          <th className="text-left py-4 px-4 font-semibold text-gray-700 dark:text-gray-200">
            {t("leaderboardPlace")}
          </th>
          {columns.map((c) => (
            <th key={c.key} className="text-left py-4 px-4 font-semibold text-gray-700 dark:text-gray-200">
              {t(c.labelKey as TranslationKey)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, index) => (
          <LeaderboardRow
            key={r.user_id}
            row={r}
            index={index}
            onCoursesClick={onCoursesClick}
            t={t}
          />
        ))}
      </tbody>
    </table>
  );
}

const TABLE_COLUMN_KEYS: { key: keyof LeaderboardRow; labelKey: TranslationKey }[] = [
  { key: "full_name", labelKey: "leaderboardName" },
  { key: "avg_score", labelKey: "leaderboardAvgScore" },
  { key: "courses_done", labelKey: "leaderboardCourses" },
  { key: "activity", labelKey: "leaderboardActivity" },
  { key: "points", labelKey: "profileCoins" },
];

type ActiveBlock = "top" | "middle" | "low";

type CourseItem = { course_id: number; course_title: string };

export default function LeaderboardPage() {
  const { t } = useLanguage();
  const [activeBlock, setActiveBlock] = useState<ActiveBlock>("top");
  const [coursesModal, setCoursesModal] = useState<LeaderboardRow | null>(null);

  const { data: list = [] } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: async () => {
      const { data } = await api.get<LeaderboardRow[]>(
        "/analytics/leaderboard?limit=100"
      );
      return data;
    },
  });

  const { data: studentCourses = [] } = useQuery({
    queryKey: ["leaderboard-courses", coursesModal?.user_id],
    queryFn: async () => {
      if (!coursesModal) return [];
      const { data } = await api.get<CourseItem[]>(
        `/analytics/leaderboard/${coursesModal.user_id}/courses`
      );
      return data;
    },
    enabled: !!coursesModal,
  });

  const { data: lastReward } = useQuery({
    queryKey: ["leaderboard-my-last-reward"],
    queryFn: async () => {
      const { data } = await api.get<{ date: string; rank: number; amount: number } | null>("/analytics/leaderboard/my-last-reward");
      return data;
    },
  });

  const handleExportCsv = async () => {
    try {
      const { data } = await api.get<Blob>("/analytics/leaderboard/csv", {
        responseType: "blob",
      });
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = "leaderboard.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to export CSV:", error);
      const err = error as { response?: { data?: { detail?: string }; status?: number }; message?: string };
      const errorMessage = err?.response?.data?.detail || err?.message || t("csvExportError");
      alert(errorMessage);
    }
  };

  const n = list.length;
  const topCount = Math.max(1, Math.ceil(n / 3));
  const midCount = Math.max(0, Math.ceil(n / 3));
  const top = list.slice(0, topCount);
  const middle = list.slice(topCount, topCount + midCount);
  const low = list.slice(topCount + midCount);

  const colorSchemes = {
    top: {
      border: "border-green-500 dark:border-green-600",
      bg: "bg-green-50 dark:bg-green-900/30",
      bgDark: "dark:bg-green-900/30",
      text: "text-green-800 dark:text-green-200",
      textDark: "dark:text-green-200",
      icon: "text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/50",
      iconDark: "dark:text-green-400 dark:bg-green-900/50",
      beamFrom: "#10B981",
      beamTo: "#34D399",
    },
    middle: {
      border: "border-amber-500 dark:border-amber-600",
      bg: "bg-amber-50 dark:bg-amber-900/30",
      bgDark: "dark:bg-amber-900/30",
      text: "text-amber-800 dark:text-amber-200",
      textDark: "dark:text-amber-200",
      icon: "text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/50",
      iconDark: "dark:text-amber-400 dark:bg-amber-900/50",
      beamFrom: "#F59E0B",
      beamTo: "#FBBF24",
    },
    low: {
      border: "border-blue-500 dark:border-blue-600",
      bg: "bg-blue-50 dark:bg-blue-900/30",
      bgDark: "dark:bg-blue-900/30",
      text: "text-blue-800 dark:text-blue-200",
      textDark: "dark:text-blue-200",
      icon: "text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/50",
      iconDark: "dark:text-blue-400 dark:bg-blue-900/50",
      beamFrom: "#3B82F6",
      beamTo: "#60A5FA",
    },
  };

  return (
    <div className="relative min-h-screen space-y-8 pb-8">
      {/* Background Effects */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <AnimatedGridPattern
          numSquares={30}
          maxOpacity={0.1}
          duration={3}
          className="opacity-40"
        />
        <DotPattern
          className="opacity-20 [&>svg>circle]:fill-gray-400 dark:[&>svg>circle]:fill-gray-600"
          width={20}
          height={20}
        />
        <Meteors number={15} />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
      </div>

      {/* Modal: курсы студента */}
      <AnimatePresence>
        {coursesModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="courses-modal-title"
            onClick={() => setCoursesModal(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 max-w-md mx-4 w-full max-h-[80vh] flex flex-col border border-gray-200 dark:border-gray-700"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 id="courses-modal-title" className="text-lg font-semibold text-gray-800 dark:text-white">
                  {t("leaderboardCoursesModalTitle")} — {coursesModal.full_name}
                </h2>
                <button
                  type="button"
                  onClick={() => setCoursesModal(null)}
                  className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition-colors"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="overflow-y-auto flex-1 min-h-0">
                {studentCourses.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400 text-sm">
                    {t("leaderboardNoCourses")}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {studentCourses.map((c) => (
                      <li key={c.course_id}>
                        <Link
                          href={`/app/courses/${c.course_id}`}
                          className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-800 dark:text-white transition-colors"
                          onClick={() => setCoursesModal(null)}
                        >
                          <BookOpen className="w-4 h-4 text-[var(--qit-primary)] shrink-0" />
                          <span>{getLocalizedCourseTitle({ title: c.course_title } as any, t)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="relative z-10">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
          <LeaderboardHeader lastReward={lastReward} />
          <BlurFade delay={0.2} inView>
            <ShimmerButton
              onClick={handleExportCsv}
              className="bg-gradient-to-r from-[var(--qit-primary)] to-purple-600 text-white border-0"
              shimmerColor="#ffffff"
              borderRadius="12px"
            >
              <Download className="w-4 h-4 mr-2" /> CSV
            </ShimmerButton>
          </BlurFade>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-3 relative z-10">
        <StatCard
          title={t("leaderboardTopLevel")}
          description={t("leaderboardTopDesc")}
          count={top.length}
          icon={<Trophy className="w-6 h-6" />}
          isActive={activeBlock === "top"}
          onClick={() => setActiveBlock("top")}
          colorScheme={colorSchemes.top}
          delay={0.1}
        />
        <StatCard
          title={t("leaderboardMidLevel")}
          description={t("leaderboardMidDesc")}
          count={middle.length}
          icon={<Medal className="w-6 h-6" />}
          isActive={activeBlock === "middle"}
          onClick={() => setActiveBlock("middle")}
          colorScheme={colorSchemes.middle}
          delay={0.2}
        />
        <StatCard
          title={t("leaderboardLowLevel")}
          description={t("leaderboardLowDesc")}
          count={low.length}
          icon={<Award className="w-6 h-6" />}
          isActive={activeBlock === "low"}
          onClick={() => setActiveBlock("low")}
          colorScheme={colorSchemes.low}
          delay={0.3}
        />
      </div>

      {/* Table */}
      <BlurFade delay={0.4} inView className="relative z-10">
        <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-xl shadow-xl overflow-hidden border border-gray-200 dark:border-gray-700">
          <div
            className={`border-b px-6 py-4 backdrop-blur-sm ${
              activeBlock === "top"
                ? "bg-green-50/80 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                : activeBlock === "middle"
                ? "bg-amber-50/80 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"
                : "bg-blue-50/80 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
            }`}
          >
            <h2 className="font-semibold flex items-center gap-2 text-lg">
              {activeBlock === "top" && <Trophy className="w-5 h-5 text-green-600 dark:text-green-400" />}
              {activeBlock === "middle" && <Medal className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
              {activeBlock === "low" && <Award className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
              {activeBlock === "top" && t("leaderboardTopLevel")}
              {activeBlock === "middle" && t("leaderboardMidLevel")}
              {activeBlock === "low" && t("leaderboardLowLevel")}
            </h2>
          </div>
          <div className="overflow-x-auto max-h-[32rem] overflow-y-auto">
            <AnimatePresence mode="wait">
              {activeBlock === "top" && (
                <motion.div
                  key="top"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <RatingTable rows={top} columns={TABLE_COLUMN_KEYS} t={t} onCoursesClick={setCoursesModal} />
                </motion.div>
              )}
              {activeBlock === "middle" && (
                <motion.div
                  key="middle"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <RatingTable rows={middle} columns={TABLE_COLUMN_KEYS} t={t} onCoursesClick={setCoursesModal} />
                </motion.div>
              )}
              {activeBlock === "low" && (
                <motion.div
                  key="low"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <RatingTable rows={low} columns={TABLE_COLUMN_KEYS} t={t} onCoursesClick={setCoursesModal} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </BlurFade>
    </div>
  );
}
