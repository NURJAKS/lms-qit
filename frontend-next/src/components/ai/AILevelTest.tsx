"use client";

import { useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { motion, AnimatePresence } from "motion/react";
import { 
  CheckCircle2, 
  Brain, 
  ChevronRight, 
  Trophy, 
  Target, 
  Loader2, 
  Sparkles,
  ArrowRight,
  Settings2,
  GraduationCap
} from "lucide-react";
import { BlurFade } from "@/components/ui/blur-fade";
import { SparklesText } from "@/components/ui/sparkles-text";
import { useAuthStore } from "@/store/authStore";

interface DiagnosticQuestion {
  id: string;
  level: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
}

interface DiagnosticSubmitResponse {
  level: string;
  correct_by_level?: Record<string, number>;
  total_by_level?: Record<string, number>;
}

interface AILevelTestProps {
  onComplete: (level: string) => void;
}

export function AILevelTest({ onComplete }: AILevelTestProps) {
  const { t, lang } = useLanguage();
  const setAuth = useAuthStore(s => s.setAuth);
  const user = useAuthStore(s => s.user);
  const token = useAuthStore(s => s.token);

  const [step, setStep] = useState<"manual" | "result">("manual");
  const [determinedLevel, setDeterminedLevel] = useState<string | null>(null);

  const manualSetMutation = useMutation({
    mutationFn: async (level: string) => {
      const { data } = await api.post<{ level: string }>("/challenge/level", { level });
      return data;
    },
    onSuccess: (data) => {
      setDeterminedLevel(data.level);
      if (user && token) {
        setAuth({ ...user, ai_level: data.level }, token);
      }
      onComplete(data.level);
    }
  });

  if (step === "manual") {
    const levels = [
      { 
        id: "beginner", 
        label: t("aiLevelBeginner"), 
        desc: lang === "kk" ? "Программалауды енді бастадым" : lang === "en" ? "I'm just starting out" : "Я только начинаю" 
      },
      { 
        id: "intermediate", 
        label: t("aiLevelIntermediate"), 
        desc: lang === "kk" ? "Негіздерін білемін, тәжірибем бар" : lang === "en" ? "I have some experience" : "У меня есть базовый опыт" 
      },
      { 
        id: "expert", 
        label: t("aiLevelExpert"), 
        desc: lang === "kk" ? "Күрделі тапсырмаларды орындай аламын" : lang === "en" ? "I can solve complex tasks" : "Могу решать сложные задачи" 
      },
    ];

    return (
      <BlurFade>
        <div className="max-w-3xl mx-auto p-10 space-y-10 text-center">
          <div className="space-y-4">
            <h2 className="text-3xl font-bold">
              {lang === "kk" ? "Деңгейіңізді таңдаңыз" : lang === "en" ? "Select your level" : "Выберите ваш уровень"}
            </h2>
            <p className="text-gray-500 max-w-md mx-auto">
              {lang === "kk" ? "Біз сізге ең қолайлы жоспарды дайындаймыз" : lang === "en" ? "We will prepare the most suitable plan for you" : "Мы подготовим наиболее подходящий план для вас"}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {levels.map((lvl) => (
              <button
                key={lvl.id}
                disabled={manualSetMutation.isPending}
                onClick={() => manualSetMutation.mutate(lvl.id)}
                className="group relative p-6 rounded-3xl border-2 border-gray-100 dark:border-gray-800 hover:border-purple-600 dark:hover:border-purple-500 hover:bg-white dark:hover:bg-gray-800 shadow-sm hover:shadow-xl transition-all duration-300 text-left flex flex-col gap-4 disabled:opacity-50"
              >
                <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-colors">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <div>
                  <div className="font-bold text-xl mb-1 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                    {lvl.label}
                  </div>
                  <div className="text-sm text-gray-400 leading-tight">
                    {lvl.desc}
                  </div>
                </div>
                {manualSetMutation.isPending && manualSetMutation.variables === lvl.id && (
                  <Loader2 className="absolute top-4 right-4 w-5 h-5 text-purple-600 animate-spin" />
                )}
              </button>
            ))}
          </div>
        </div>
      </BlurFade>
    );
  }

  return null;
}
