"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useAuthStore } from "@/store/authStore";
import { api } from "@/api/client";

export function PremiumBanner() {
  const { t, lang } = useLanguage();
  const { user } = useAuthStore();

  const { data: config } = useQuery({
    queryKey: ["premium-config"],
    queryFn: async () => {
      const { data } = await api.get<{ price_tenge: number; currency: string }>("/premium/config");
      return data;
    },
  });

  const isPremium = user?.is_premium === 1;
  if (isPremium) return null;

  const price = config?.price_tenge ?? 199999;

  return (
    <div
      className="rounded-2xl overflow-hidden border border-purple-200/60 dark:border-purple-900/30 bg-gradient-to-br from-purple-50 via-indigo-50/80 to-violet-50 dark:from-gray-800/90 dark:via-purple-900/20 dark:to-gray-800/90"
      style={{
        boxShadow: "0 2px 12px rgba(124, 58, 237, 0.08)",
      }}
    >
      <div className="flex flex-col sm:flex-row items-stretch gap-4 p-4 sm:p-5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-purple-600" />
            <span className="text-xs font-medium text-purple-600 uppercase tracking-wide">
              {t("premiumBadge")}
            </span>
          </div>
          <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white leading-tight">
            {t("premiumHeadline")}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
            {t("premiumDescription")}
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-3">
            <span className="text-lg font-bold text-purple-700 dark:text-purple-400">
              {price.toLocaleString(lang === "kk" ? "kk-KZ" : lang === "en" ? "en-US" : "ru-KZ")} ₸
            </span>
            <Link
              href="/app/premium"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl font-medium text-white transition-all hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #7c3aed, #5b21b6)" }}
            >
              {t("goPremium")}
              <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
        <div className="hidden sm:flex w-24 shrink-0 items-center justify-center opacity-90">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center bg-purple-100/80 dark:bg-purple-900/30">
            <Sparkles className="w-10 h-10 text-purple-600 dark:text-purple-400" />
          </div>
        </div>
      </div>
    </div>
  );
}
