"use client";

import Link from "next/link";
import { BookOpen, Award, Target } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

type EmptyStateProps = {
  variant: "courses" | "certificates" | "goals";
  ctaHref?: string;
  ctaLabel?: string;
  ctaOnClick?: () => void;
};

const icons = {
  courses: BookOpen,
  certificates: Award,
  goals: Target,
};

const labelKeys = {
  courses: "profileEmptyCourses" as const,
  certificates: "profileEmptyCertificates" as const,
  goals: "profileEmptyGoals" as const,
};

const ctaKeys = {
  courses: "profileEmptyCoursesCta" as const,
  certificates: "profileEmptyCertificatesCta" as const,
  goals: "profileEmptyGoalsCta" as const,
};

export function EmptyState({ variant, ctaHref, ctaLabel, ctaOnClick }: EmptyStateProps) {
  const { t } = useLanguage();
  const Icon = icons[variant];
  const label = t(labelKeys[variant]);
  const cta = ctaLabel ?? t(ctaKeys[variant]);

  return (
    <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-700/50 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-gray-400 dark:text-gray-500" />
      </div>
      <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">{label}</p>
      {ctaOnClick && (
        <button
          type="button"
          onClick={ctaOnClick}
          className="text-sm font-medium text-[var(--qit-primary)] dark:text-[#00b0ff] hover:underline"
        >
          {cta}
        </button>
      )}
      {!ctaOnClick && ctaHref && (
        <Link
          href={ctaHref}
          className="text-sm font-medium text-[var(--qit-primary)] dark:text-[#00b0ff] hover:underline"
        >
          {cta}
        </Link>
      )}
    </div>
  );
}
