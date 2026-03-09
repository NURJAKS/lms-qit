"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { Sparkles, ArrowRight, RotateCcw } from "lucide-react";

const MAX_TILT = 8;

function TiltButton({
  children,
  onClick,
  className = "",
}: {
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left - rect.width / 2) / rect.width;
      const y = (e.clientY - rect.top - rect.height / 2) / rect.height;
      setTilt({ x: y * MAX_TILT, y: x * MAX_TILT });
    },
    []
  );

  const onMouseLeave = useCallback(() => setTilt({ x: 0, y: 0 }), []);

  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      className={className}
      style={{
        transform: `perspective(500px) rotateX(${-tilt.x}deg) rotateY(${tilt.y}deg)`,
        transition: "transform 0.15s ease-out",
      }}
    >
      {children}
    </button>
  );
}
import { useLanguage } from "@/context/LanguageContext";
import type { TranslationKey } from "@/i18n/translations";

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

export function CoursePickerWidget() {
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
    <div className="min-h-[320px]">
      {!isCompleted ? (
        <>
          <div className="flex gap-1 mb-4">
            {QUESTIONS.map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full ${i <= step ? "" : "bg-white/30"}`}
                style={i <= step ? { background: "var(--qit-gradient-3)" } : undefined}
              />
            ))}
          </div>
          <p className="font-semibold text-white/95 mb-3 text-sm">
            {t(currentQ.key as TranslationKey)}
          </p>
          <div className="space-y-2 [perspective:500px]">
            {currentQ.options.map((opt) => (
              <TiltButton
                key={opt.value}
                onClick={() => select(opt.value)}
                className="w-full py-2.5 px-3 rounded-xl text-left text-sm font-medium text-white bg-white/15 hover:bg-white/25 border border-white/20 transition-colors shadow-lg hover:shadow-xl"
              >
                {t(opt.key as TranslationKey)}
              </TiltButton>
            ))}
          </div>
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="mt-4 text-xs text-white/70 hover:text-white flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" /> {t("pickerBack")}
            </button>
          )}
        </>
      ) : (
        <div className="text-center">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 text-[#1a237e]" style={{ background: "var(--qit-gradient-3)" }}>
            <Sparkles className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-white mb-1">{t("pickerResultTitle")}</h3>
          <p className="text-white/85 text-sm mb-4">{t("pickerResultSubtitle")}</p>
          {recommended && (
            <div className={`rounded-xl p-4 mb-4 text-white ${recommended.gradient}`}>
              <p className="font-bold text-sm mb-1">{t(recommended.fullTitleKey as TranslationKey)}</p>
              <p className="text-white/90 text-xs mb-3 line-clamp-2">{t(recommended.descKey as TranslationKey)}</p>
              <Link
                href="/register"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold bg-white text-gray-900 hover:bg-gray-100 transition-colors"
              >
                {t("pickerCta")} <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}
          <button type="button" onClick={reset} className="text-xs text-white/70 hover:text-white flex items-center gap-1 mx-auto">
            <RotateCcw className="w-3.5 h-3.5" /> {t("pickerRetake")}
          </button>
        </div>
      )}
    </div>
  );
}
