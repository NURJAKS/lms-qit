"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { AiChatCore } from "@/components/ai/AiChatCore";

export default function QazaqAiPage() {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col gap-4 min-h-[calc(100dvh-7rem)] max-w-3xl mx-auto w-full">
      <div className="flex items-center gap-3 shrink-0">
        <Link
          href="/app"
          className="inline-flex items-center gap-1 text-sm font-medium text-[var(--qit-primary)] dark:text-[var(--qit-secondary)] hover:opacity-90"
        >
          <ArrowLeft className="w-4 h-4" />
          {t("dashboard")}
        </Link>
      </div>
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white font-geologica">{t("qazaqAiPageTitle")}</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t("qazaqAiPageSubtitle")}</p>
      </div>
      <AiChatCore layout="page" className="flex-1" />
    </div>
  );
}
