"use client";

import { Globe, Sun, Moon, ChevronDown } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { useState, useRef, useEffect } from "react";

export function AppHeader() {
  const { lang, setLang, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!langOpen) return;
    const close = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node))
        setLangOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [langOpen]);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={toggleTheme}
        className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200 transition-colors"
        title={theme === "light" ? t("darkTheme") : t("lightTheme")}
        aria-label={theme === "light" ? t("darkTheme") : t("lightTheme")}
      >
        {theme === "light" ? (
          <Moon className="w-5 h-5" />
        ) : (
          <Sun className="w-5 h-5" />
        )}
      </button>

      <div className="relative" ref={langRef}>
        <button
          type="button"
          onClick={() => setLangOpen(!langOpen)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all text-sm font-medium shadow-sm"
          title={t("language")}
          aria-label={t("language")}
        >
          <Globe className="w-4 h-4" />
          <span>{t(lang === "ru" ? "russian" : lang === "kk" ? "kazakh" : "english")}</span>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${langOpen ? "rotate-180" : ""}`} />
        </button>
        {langOpen && (
          <div className="absolute right-0 top-full mt-1 py-1 w-36 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
            {(["ru", "kk", "en"] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => {
                  setLang(l);
                  setLangOpen(false);
                }}
                className={`w-full px-3 py-2 text-left text-sm ${lang === l
                  ? "bg-[var(--qit-primary)]/10 text-[var(--qit-primary)] dark:text-[var(--qit-secondary)] font-medium"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
              >
                {t(l === "ru" ? "russian" : l === "kk" ? "kazakh" : "english")}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
