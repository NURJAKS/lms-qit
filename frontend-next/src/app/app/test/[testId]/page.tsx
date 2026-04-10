"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { TestComponent } from "@/components/tests/TestComponent";
import { ChevronLeft } from "lucide-react";

function TestPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const raw = params.testId as string;
  const testId = Number(raw);
  const courseId = searchParams.get("courseId");

  if (!Number.isFinite(testId) || testId <= 0) {
    return (
      <div className="max-w-lg mx-auto p-6 text-center">
        <p className="text-red-600 dark:text-red-400">{t("topicInvalidId")}</p>
        <Link href="/app/courses" className="mt-4 inline-block text-blue-600 dark:text-blue-400 hover:underline">
          {t("courses")}
        </Link>
      </div>
    );
  }

  const backHref = courseId ? `/app/courses/${courseId}` : "/app/courses";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-24">
      <div className="max-w-3xl mx-auto px-3 sm:px-4 pt-4 sm:pt-6">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
        >
          <ChevronLeft className="w-4 h-4" />
          {t("topicBackToCourse")}
        </Link>
        <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-4">
          {t("courseFinalTestCardTitle")}
        </h1>
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 sm:p-4 shadow-sm">
          <TestComponent
            testId={testId}
            onComplete={() => {
              window.location.href = backHref;
            }}
            onCancel={() => {
              window.location.href = backHref;
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default function StandaloneTestPage() {
  const { t } = useLanguage();
  return (
    <Suspense
      fallback={
        <div className="min-h-[40vh] flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm">
          {t("loading")}
        </div>
      }
    >
      <TestPageContent />
    </Suspense>
  );
}
