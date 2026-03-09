"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { api } from "@/api/client";
import { TestManagement } from "@/components/admin/TestManagement";
import { getLocalizedCourseTitle } from "@/lib/courseUtils";
import type { Course } from "@/types";
import { ArrowLeft } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

export default function AdminTestsCoursePage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useLanguage();
  const courseId = Number(params.courseId);

  const { data: course, isLoading, error } = useQuery({
    queryKey: ["admin-course", courseId],
    queryFn: async () => {
      const { data } = await api.get<Course>(`/admin/courses/${courseId}`);
      return data;
    },
    enabled: !isNaN(courseId) && courseId > 0,
  });

  if (isNaN(courseId) || courseId <= 0) {
    router.replace("/app/admin/tests");
    return null;
  }

  if (isLoading || !course) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <p className="text-gray-500">{t("loading")}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <p className="text-red-600">{t("courseNotFound")}</p>
        <Link href="/app/admin/tests" className="text-qit-primary hover:underline mt-2 inline-block">
          ← {t("backToTests")}
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Link
        href="/app/admin/tests"
        className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-qit-primary mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> {t("backToTestsList")}
      </Link>
      <TestManagement courseId={courseId} courseTitle={getLocalizedCourseTitle(course, t)} />
    </div>
  );
}
