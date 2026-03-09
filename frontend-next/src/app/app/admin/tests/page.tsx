"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { api } from "@/api/client";
import type { Course, Test } from "@/types";
import { ChevronRight } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

export default function AdminTestsPage() {
  const { t } = useLanguage();

  const { data: courses = [] } = useQuery({
    queryKey: ["admin-courses"],
    queryFn: async () => {
      const { data } = await api.get<Course[]>("/admin/courses");
      return data;
    },
  });

  const courseIds = courses.map((c) => c.id);
  const { data: testsByCourse } = useQuery({
    queryKey: ["admin-tests-by-course", courseIds],
    queryFn: async () => {
      const result: Record<number, Test[]> = {};
      await Promise.all(
        courseIds.map(async (courseId) => {
          const { data } = await api.get<Test[]>(`/admin/courses/${courseId}/tests`);
          result[courseId] = data;
        })
      );
      return result;
    },
    enabled: courseIds.length > 0,
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">{t("testsTitle")}</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        {t("testsGroupedByCourses")}
      </p>
      <div className="space-y-4">
        {courses.map((course) => {
          const tests = (testsByCourse?.[course.id] ?? []) as Test[];
          return (
            <div
              key={course.id}
              className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-100 dark:border-gray-700 overflow-hidden"
            >
              <Link
                href={`/app/admin/tests/${course.id}`}
                className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div>
                  <h2 className="font-semibold text-gray-800 dark:text-white">
                    {course.title}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                    {tests.length} {t("testsCount")}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </Link>
              {tests.length > 0 && (
                <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-2 bg-gray-50/50 dark:bg-gray-800/50">
                  <ul className="space-y-1">
                    {tests.map((test) => (
                      <li key={test.id} className="text-sm text-gray-600 dark:text-gray-300">
                        • {test.title} ({t("testsPassingScore")}: {test.passing_score}%, {t("testsQuestionCount")}: {test.question_count})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
