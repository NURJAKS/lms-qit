"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles, ArrowRight, RotateCcw } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import type { TranslationKey } from "@/i18n/translations";
import { AppHeader } from "@/components/common/AppHeader";

const COURSES = [
  { id: "web", fullTitleKey: "coursesWebFull", descKey: "coursesWebDesc", gradient: "from-[#1a237e] to-[#311b92]" },
  { id: "ai", fullTitleKey: "coursesAiFull", descKey: "coursesAiDesc", gradient: "from-[#00b0ff] to-[#00e5ff]" },
  { id: "data", fullTitleKey: "coursesDataFull", descKey: "coursesDataDesc", gradient: "from-[#ff4081] to-[#ff80ab]" },
  { id: "mobile", fullTitleKey: "coursesMobileFull", descKey: "coursesMobileDesc", gradient: "from-[#76ff03] to-[#64dd17]" },
  { id: "db", fullTitleKey: "coursesDbFull", descKey: "coursesDbDesc", gradient: "from-[#ff9800] to-[#ff5722]" },
  { id: "security", fullTitleKey: "coursesSecurityFull", descKey: "coursesSecurityDesc", gradient: "from-[#9c27b0] to-[#673ab7]" },
] as const;

type QuestionId = "experience" | "interest" | "time" | "goal";

const QUESTIONS: { id: QuestionId; key: string; options: { value: string; key: string }[] }[] = [
  { id: "experience", key: "pickerQ1", options: [{ value: "none", key: "pickerExpNone" }, { value: "basic", key: "pickerExpBasic" }, { value: "advanced", key: "pickerExpAdvanced" }] },
  { id: "interest", key: "pickerQ2", options: [{ value: "web", key: "coursesFilterWeb" }, { value: "ai", key: "coursesFilterAi" }, { value: "mobile", key: "coursesFilterMobile" }, { value: "data", key: "coursesFilterData" }, { value: "security", key: "pickerInterestSecurity" }] },
  { id: "time", key: "pickerQ3", options: [{ value: "5", key: "pickerTime5" }, { value: "10", key: "pickerTime10" }, { value: "15", key: "pickerTime15" }] },
  { id: "goal", key: "pickerQ4", options: [{ value: "job", key: "pickerGoalJob" }, { value: "hobby", key: "pickerGoalHobby" }, { value: "startup", key: "pickerGoalStartup" }] },
];

function pickCourse(answers: Record<QuestionId, string>): (typeof COURSES)[number] {
  const { experience, interest } = answers;
  if (interest === "ai") return COURSES[1];
  if (interest === "mobile") return COURSES[3];
  if (interest === "data") return experience === "none" ? COURSES[4] : COURSES[2];
  if (interest === "security") return COURSES[5];
  return experience === "advanced" ? COURSES[5] : COURSES[0];
}

export default function CoursePickerPage() {
  const { t } = useLanguage();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<QuestionId, string>>({
    experience: "", interest: "", time: "", goal: "",
  });

  const currentQ = QUESTIONS[step];
  const isCompleted = step >= QUESTIONS.length;
  const recommended = isCompleted ? pickCourse(answers) : null;

  const select = (value: string) => {
    setAnswers((prev) => ({ ...prev, [currentQ.id]: value }));
    setStep((s) => (s < QUESTIONS.length - 1 ? s + 1 : QUESTIONS.length));
  };

  const reset = () => {
    setStep(0);
    setAnswers({ experience: "", interest: "", time: "", goal: "" });
  };

  return (
    <div className="min-h-screen bg-[#f5f7ff] dark:bg-gray-900">
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-3xl mx-auto px-4 flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold animate-[spin_3s_linear_infinite]" style={{ background: "var(--qit-gradient-1)" }}>
              Q
            </div>
            <span className="font-bold text-gray-900 dark:text-white">Qazaq IT Academy</span>
          </Link>
          <AppHeader />
        </div>
      </header>

      <main className="pt-24 pb-12 px-4 max-w-2xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 sm:p-8">
          {!isCompleted ? (
            <>
              <div className="flex items-center gap-2 mb-6">
                <Sparkles className="w-6 h-6" style={{ color: "var(--qit-secondary)" }} />
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t("pickerTitle")}</h1>
              </div>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">{t("pickerSubtitle")}</p>
              <div className="flex gap-1 mb-6">
                {QUESTIONS.map((_, i) => (
                  <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? "" : "bg-gray-200 dark:bg-gray-600"}`} style={i <= step ? { background: "var(--qit-gradient-2)" } : undefined} />
                ))}
              </div>
              <p className="font-semibold text-gray-800 dark:text-gray-200 mb-4">{t(currentQ.key as TranslationKey)}</p>
              <div className="space-y-3">
                {currentQ.options.map((opt) => (
                  <button key={opt.value} type="button" onClick={() => select(opt.value)} className="w-full py-3 px-4 rounded-xl text-left font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 hover:bg-[#e8eaf6] dark:hover:bg-gray-600 border-2 border-transparent hover:border-[#00b0ff]/50 transition-all">
                    {t(opt.key as TranslationKey)}
                  </button>
                ))}
              </div>
              {step > 0 && (
                <button type="button" onClick={() => setStep((s) => s - 1)} className="mt-6 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 flex items-center gap-1">
                  <RotateCcw className="w-4 h-4" /> {t("pickerBack")}
                </button>
              )}
            </>
          ) : (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-white" style={{ background: "var(--qit-gradient-3)" }}>
                <Sparkles className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{t("pickerResultTitle")}</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">{t("pickerResultSubtitle")}</p>
              {recommended && (
                <div className={`rounded-2xl p-6 mb-6 text-white ${recommended.gradient}`}>
                  <h3 className="text-xl font-bold mb-2">{t(recommended.fullTitleKey as TranslationKey)}</h3>
                  <p className="text-white/90 text-sm mb-4">{t(recommended.descKey as TranslationKey)}</p>
                  <p className="text-sm font-medium mb-4">{t("pickerMotivation")}</p>
                  <Link href="/register" className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold bg-white text-gray-900 hover:bg-gray-100 transition-colors">
                    {t("pickerCta")} <ArrowRight className="w-5 h-5" />
                  </Link>
                </div>
              )}
              <button type="button" onClick={reset} className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 flex items-center gap-1 mx-auto">
                <RotateCcw className="w-4 h-4" /> {t("pickerRetake")}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
