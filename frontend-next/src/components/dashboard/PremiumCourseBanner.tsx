"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

export function PremiumCourseBanner() {
  const { t } = useLanguage();

  return (
    <Link
      href="/app/premium"
      className="group relative rounded-xl p-5 overflow-hidden transition-all duration-300 hover:shadow-lg"
      style={{
        background: "linear-gradient(135deg, #14b8a6 0%, #3b82f6 100%)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        boxShadow: "0 4px 12px rgba(20, 184, 166, 0.25)",
      }}
    >
      {/* Content */}
      <div className="relative z-10">
        <h3 className="text-base font-bold text-white mb-3">
          {t("joinFinancialClass" as any) || "Присоединяйтесь к финансовому классу"}
        </h3>
        
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-green-500/20 border border-green-500/30 mb-4">
          <span className="text-xs font-semibold text-green-300">
            +15% {t("discountForMember" as any) || "скидка для участников"}
          </span>
        </div>

        <button
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white font-semibold text-sm transition-all duration-200 group-hover:gap-3"
        >
          <span>{t("joinClass" as any) || "Присоединиться к классу"}</span>
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </Link>
  );
}
