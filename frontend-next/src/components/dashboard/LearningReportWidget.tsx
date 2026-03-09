"use client";

import { useState } from "react";
import { X, Printer, Download, Maximize2 } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { useLanguage } from "@/context/LanguageContext";
import { getDarkCardStyle, getTextColors } from "@/utils/themeStyles";

export function LearningReportWidget() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(false);
  const textColors = getTextColors(theme);

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    // TODO: Implement export functionality
    console.log("Export report");
  };

  const handleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div
      className={`rounded-xl p-6 transition-all duration-300 ${isExpanded ? "col-span-2 row-span-2" : ""}`}
      style={{
        background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        boxShadow: "0 4px 16px rgba(0, 0, 0, 0.3)",
      }}
    >
      {/* Header with actions */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs mb-1" style={{ color: "rgba(255, 255, 255, 0.6)" }}>
            {t("trackAndPrintReport")}
          </p>
          <h3 className="text-lg font-bold text-white">
            {t("learningReport")}
          </h3>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleExpand}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            title={t("expand")}
          >
            <Maximize2 className="w-4 h-4 text-white/70" />
          </button>
          <button
            onClick={handlePrint}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            title={t("print")}
          >
            <Printer className="w-4 h-4 text-white/70" />
          </button>
          <button
            onClick={handleExport}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            title={t("export")}
          >
            <Download className="w-4 h-4 text-white/70" />
          </button>
          <button
            onClick={() => {}}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            title={t("close")}
          >
            <X className="w-4 h-4 text-white/70" />
          </button>
        </div>
      </div>

      {/* Report content placeholder */}
      <div className="mt-6">
        <p className="text-sm text-white/60">
          {t("reportContentPlaceholder")}
        </p>
      </div>
    </div>
  );
}
