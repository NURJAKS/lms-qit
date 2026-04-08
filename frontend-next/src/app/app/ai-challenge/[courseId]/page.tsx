"use client";

import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { api } from "@/api/client";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { Trophy, Zap, User, Bot, Clock, Layers, Brain, Star, Sparkles, Bug, Code, Terminal, GraduationCap, Shield } from "lucide-react";
import { BlurFade } from "@/components/ui/blur-fade";
import { Particles } from "@/components/ui/particles";
import { getLocalizedCourseTitle } from "@/lib/courseUtils";
import { getApiErrorMessage } from "@/lib/apiError";
import { useAuthStore } from "@/store/authStore";

type Screen = "intro" | "playing" | "results" | "memory" | "memoryComplete" | "newModePlaying" | "newModeResults";
type AILevel = "beginner" | "intermediate" | "expert";
type GameMode = "quiz" | "flashcard" | "memory" | "find_bug" | "guess_output" | "speed_code";
/** Единая тема: классический classic_track и логика новых режимов */
type ChallengeTopic = "python" | "web" | "informatics" | "cybersecurity";

interface Question {
  id: number;
  question_text: string;
  option_a?: string;
  option_b?: string;
  option_c?: string;
  option_d?: string;
  answer_text?: string;
}

interface StartResponse {
  challenge_id: number;
  questions: Question[];
  ai_times_per_question: number[];
  round_time_limit_seconds: number;
  ai_bonus_points: number;
}

interface WrongTopic {
  id: number;
  title: string;
}

interface MemoryCard {
  id: string;
  text: string;
  pair_id: string;
}

interface ResultsResponse {
  total_questions: number;
  user_correct: number;
  ai_correct: number;
  user_time: number;
  ai_time: number;
  user_bonus_points: number;
  ai_bonus_points: number;
  user_total_score: number;
  ai_total_score: number;
  user_wins: boolean;
  overtime: boolean;
  recommendations?: string;
  round_time_limit: number;
  wrong_topics?: WrongTopic[];
  details?: Array<{
    question_id: string;
    correct: boolean;
    user_answer: string;
    correct_answer: string;
    explanation?: string;
    explanation_by_lang?: {
      ru?: string;
      kk?: string;
      en?: string;
    };
  }>;
  metrics?: {
    user_speed_avg_sec: number;
    user_accuracy_pct: number;
    user_strategy_bonus: number;
    ai_speed_avg_sec?: number;
    ai_accuracy_pct?: number;
    ai_strategy_bonus?: number;
  };
}

interface NewModeQuestion {
  id: string;
  category: string;
  level: string;
  code?: string;
  total_lines?: number;
  options?: string[];
  task?: string;
}

interface NewModeStartResponse {
  challenge_id: number;
  game_mode: string;
  questions: NewModeQuestion[];
  ai_times_per_question: number[];
  round_time_limit_seconds: number;
  ai_correct_count: number;
  ai_bonus_points: number;
  total_questions: number;
}

const CATEGORY_ICONS: Record<string, string> = {
  all: "🎯",
  python: "🐍",
  javascript: "⚡",
  html_css: "🎨",
  algorithms: "🧩",
  cs_general: "💻",
  cybersecurity: "🔐",
  web: "🌐",
};

function topicToNewGameCategory(topic: ChallengeTopic): string {
  if (topic === "informatics") return "cs_general";
  return topic;
}

function resolveChallengeHelpCourseId(
  gameMode: GameMode,
  topic: ChallengeTopic,
  pageCourseId: number,
): number {
  if (["find_bug", "guess_output", "speed_code"].includes(gameMode)) {
    if (topic === "python") return 1;
    if (topic === "web") return 2;
    if (topic === "informatics") {
      const n = Number(process.env.NEXT_PUBLIC_AI_CHALLENGE_INFORMATICS_COURSE_ID);
      return Number.isFinite(n) && n > 0 ? n : 7;
    }
    if (topic === "cybersecurity") {
      const n = Number(process.env.NEXT_PUBLIC_AI_CHALLENGE_CYBER_COURSE_ID);
      return Number.isFinite(n) && n > 0 ? n : pageCourseId;
    }
    return pageCourseId;
  }
  if (topic === "web") return 2;
  if (topic === "informatics") {
    const n = Number(process.env.NEXT_PUBLIC_AI_CHALLENGE_INFORMATICS_COURSE_ID);
    return Number.isFinite(n) && n > 0 ? n : 3;
  }
  if (topic === "cybersecurity") {
    const n = Number(process.env.NEXT_PUBLIC_AI_CHALLENGE_CYBER_COURSE_ID);
    return Number.isFinite(n) && n > 0 ? n : pageCourseId;
  }
  return 1;
}

function parseChallengeTopicFromUrl(s: string | null): ChallengeTopic | null {
  if (s === "python" || s === "web" || s === "informatics" || s === "cybersecurity") return s;
  return null;
}

function getAllowedTopicsForMode(mode: GameMode): ChallengeTopic[] {
  if (mode === "find_bug" || mode === "guess_output" || mode === "speed_code") {
    return ["python", "web"];
  }
  return ["python", "web", "informatics", "cybersecurity"];
}

function localizeNewModeCategory(category: string, t: (key: string) => string): string {
  const normalized = category.trim().toLowerCase();
  const keyMap: Record<string, string> = {
    all: "aiCategoryAll",
    python: "aiCategoryPython",
    javascript: "aiCategoryJavascript",
    html_css: "aiCategoryHtmlCss",
    algorithms: "aiCategoryAlgorithms",
    cs_general: "aiCategoryCsGeneral",
    cybersecurity: "aiTopicCybersecurity",
    web: "aiClassicTrackWeb",
  };
  const key = keyMap[normalized];
  return key ? t(key) : category;
}

function localizeNewModeLevel(level: string, t: (key: string) => string): string {
  const normalized = level.trim().toLowerCase();
  const keyMap: Record<string, string> = {
    beginner: "aiLevelBeginner",
    intermediate: "aiLevelIntermediate",
    expert: "aiLevelExpert",
  };
  const key = keyMap[normalized];
  return key ? t(key) : level;
}

// LEVEL_LABELS will be created using translations inside the component

export default function AIChallengePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const courseId = params.courseId as string;
  const cId = Number(courseId);
  const queryClient = useQueryClient();
  const { t, lang } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const isTeacher = useAuthStore((s) => s.isTeacher());
  
  // Получаем параметры из URL
  const urlMode = searchParams.get("mode") as GameMode | null;
  const urlLevel = searchParams.get("level") as AILevel | null;
  const urlTrackParam = searchParams.get("track");
  const urlChallengeTopic = parseChallengeTopicFromUrl(urlTrackParam);
  
  const [screen, setScreen] = useState<Screen>("intro");
  const [gameMode, setGameMode] = useState<GameMode>(urlMode || "quiz");
  const [aiLevel, setAiLevel] = useState<AILevel>(urlLevel || "intermediate");
  const [challengeId, setChallengeId] = useState<number | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [aiTimes, setAiTimes] = useState<number[]>([]);
  const [roundTimeLimit, setRoundTimeLimit] = useState(90);
  const [aiBonusPoints, setAiBonusPoints] = useState(0);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Array<{ question_id: number; answer?: string; time_seconds: number }>>([]);
  const [qStartTime, setQStartTime] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState(90);
  const [aiAnsweredCount, setAiAnsweredCount] = useState(0);
  const [results, setResults] = useState<ResultsResponse | null>(null);
  const [cardResult, setCardResult] = useState<"user" | "ai" | null>(null);
  const [memoryCards, setMemoryCards] = useState<MemoryCard[]>([]);
  const [memoryFlipped, setMemoryFlipped] = useState<number[]>([]);
  const [memoryMatched, setMemoryMatched] = useState<Set<string>>(new Set());
  const urlAutostart = !!(urlMode && urlLevel);
  const [wizardGameSelected, setWizardGameSelected] = useState(urlAutostart);
  const [challengeTopic, setChallengeTopic] = useState<ChallengeTopic | null>(() =>
    urlAutostart ? urlChallengeTopic ?? "python" : null,
  );
  const [levelConfirmed, setLevelConfirmed] = useState(urlAutostart);
  const isClassicChallengeMode = !["find_bug", "guess_output", "speed_code"].includes(gameMode);
  const allowedTopics = getAllowedTopicsForMode(gameMode);
  const { data: classicHelpCourseId } = useQuery({
    queryKey: ["classic-help-course-id", challengeTopic],
    queryFn: async () => {
      const { data } = await api.get<{ course_id: number }>("/challenge/classic-help-course-id", {
        params: { classic_track: challengeTopic ?? "python", lang },
      });
      return data.course_id;
    },
    enabled: wizardGameSelected && isClassicChallengeMode && challengeTopic != null,
    staleTime: 5 * 60 * 1000,
  });
  const targetCourseId =
    isClassicChallengeMode && classicHelpCourseId != null
      ? classicHelpCourseId
      : challengeTopic != null
        ? resolveChallengeHelpCourseId(gameMode, challengeTopic, cId)
        : cId;
  const [newModeQuestions, setNewModeQuestions] = useState<NewModeQuestion[]>([]);
  const [newModeCurrentQ, setNewModeCurrentQ] = useState(0);
  const [newModeAnswers, setNewModeAnswers] = useState<Array<{ question_id: string; answer: string; time_seconds: number }>>([]);
  const [newModeQStartTime, setNewModeQStartTime] = useState<number>(0);
  const [newModeTimeLeft, setNewModeTimeLeft] = useState(100);
  const [newModeAiTimes, setNewModeAiTimes] = useState<number[]>([]);
  const [newModeAiAnswered, setNewModeAiAnswered] = useState(0);
  const roundStartRef = useRef<number>(0);
  const aiTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const answersRef = useRef(answers);
  const submittedRef = useRef(false);
  const newModeAnswersRef = useRef(newModeAnswers);
  answersRef.current = answers;
  newModeAnswersRef.current = newModeAnswers;

  const { data: course } = useQuery({
    queryKey: ["course", cId],
    queryFn: async () => {
      const { data } = await api.get<{ title: string }>(`/courses/${cId}`);
      return data;
    },
    enabled: !!cId,
  });

  const startMutation = useMutation({
    mutationFn: async () => {
      try {
        if (gameMode === "memory") {
          const { data } = await api.get<{ cards: MemoryCard[] }>(
            `/challenge/memory?course_id=${cId}&lang=${lang}&classic_track=${challengeTopic ?? "python"}`,
          );
          if (!data?.cards?.length) {
            throw new Error(t("aiPassedTopicsRequirement"));
          }
          return { memory: data };
        }
        const { data } = await api.post<StartResponse>(
          `/challenge/start?course_id=${cId}&ai_level=${aiLevel}&game_mode=${gameMode}&lang=${lang}&classic_track=${challengeTopic ?? "python"}`,
        );
        if (!data?.questions?.length) {
          throw new Error(t("aiPassedTopicsRequirement"));
        }
        return { challenge: data };
      } catch (e) {
        throw new Error(getApiErrorMessage(e, t("error")));
      }
    },
    onSuccess: (result) => {
      if ("memory" in result && result.memory) {
        setMemoryCards(result.memory.cards);
        setMemoryFlipped([]);
        setMemoryMatched(new Set());
        setScreen("memory");
        submittedRef.current = false;
      } else if ("challenge" in result && result.challenge) {
        const data = result.challenge;
        setChallengeId(data.challenge_id);
        setQuestions(data.questions);
        setAiTimes(data.ai_times_per_question || []);
        setRoundTimeLimit(data.round_time_limit_seconds ?? 90);
        setAiBonusPoints(data.ai_bonus_points ?? 0);
        setCurrentQ(0);
        setAnswers([]);
        setAiAnsweredCount(0);
        setCardResult(null);
        setTimeLeft(data.round_time_limit_seconds ?? 90);
        setQStartTime(Date.now());
        roundStartRef.current = Date.now();
        submittedRef.current = false;
        setScreen("playing");
      }
    },
  });

  // New game mode start mutation
  const newModeStartMutation = useMutation({
    mutationFn: async () => {
      try {
        const { data } = await api.post<NewModeStartResponse>(
          `/challenge/new-game/start?game_mode=${gameMode}&ai_level=${aiLevel}&category=${encodeURIComponent(topicToNewGameCategory(challengeTopic ?? "python"))}&lang=${lang}`,
        );
        return data;
      } catch (e) {
        throw new Error(getApiErrorMessage(e, t("error")));
      }
    },
    onSuccess: (data) => {
      setChallengeId(data.challenge_id);
      setNewModeQuestions(data.questions);
      setNewModeAiTimes(data.ai_times_per_question || []);
      setRoundTimeLimit(data.round_time_limit_seconds ?? 100);
      setAiBonusPoints(data.ai_bonus_points ?? 0);
      setNewModeCurrentQ(0);
      setNewModeAnswers([]);
      setNewModeAiAnswered(0);
      setNewModeTimeLeft(data.round_time_limit_seconds ?? 100);
      setNewModeQStartTime(Date.now());
      roundStartRef.current = Date.now();
      submittedRef.current = false;
      setScreen("newModePlaying");
    },
  });

  // New game mode submit mutation
  const newModeSubmitMutation = useMutation({
    mutationFn: async (body: { answers: Array<{ question_id: string; answer: string; time_seconds: number }> }) => {
      if (!challengeId) throw new Error(t("aiChallengeIdMissing"));
      const { data } = await api.post<ResultsResponse>(`/challenge/new-game/${challengeId}/submit?lang=${lang}`, body);
      return data;
    },
    onSuccess: (data) => {
      submittedRef.current = true;
      setResults(data);
      setScreen("newModeResults");
    },
  });

  const prevChallengeTopicRef = useRef<ChallengeTopic | undefined>(undefined);

  // Сброс ошибки старта при смене темы на intro (не на первом монтировании)
  useEffect(() => {
    if (
      prevChallengeTopicRef.current !== undefined &&
      challengeTopic != null &&
      prevChallengeTopicRef.current !== challengeTopic &&
      screen === "intro"
    ) {
      startMutation.reset();
    }
    if (challengeTopic != null) prevChallengeTopicRef.current = challengeTopic;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset stable from useMutation
  }, [challengeTopic, screen]);

  // Автоматически начинаем игру, если параметры переданы в URL
  useEffect(() => {
    if (
      course &&
      urlMode &&
      urlLevel &&
      screen === "intro" &&
      !startMutation.isPending &&
      questions.length === 0
    ) {
      startMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course, urlMode, urlLevel, screen, challengeTopic]);

  const submitMutation = useMutation({
    mutationFn: async (body: { answers: Array<{ question_id: number; answer?: string; time_seconds: number }> }) => {
      if (!challengeId) {
        throw new Error(t("aiChallengeIdMissing"));
      }
      const { data } = await api.post<ResultsResponse>(`/challenge/${challengeId}/submit?lang=${lang}`, body);
      return data;
    },
    onSuccess: (data) => {
      submittedRef.current = true;
      setResults(data);
      setScreen("results");
      queryClient.invalidateQueries({ queryKey: ["course-structure", cId] });
    },
  });

  useEffect(() => {
    if (screen !== "playing" || questions.length === 0 || aiTimes.length === 0) return;
    if (gameMode === "flashcard") {
      const i = currentQ;
      if (i >= aiTimes.length) return;
      const aiTime = aiTimes[i] ?? 3;
      aiTimersRef.current.forEach((t) => clearTimeout(t));
      aiTimersRef.current = [];
      const id = setTimeout(() => {
        setAiAnsweredCount((c) => Math.min(c + 1, i + 1));
        const currentAnswers = answersRef.current;
        if (currentAnswers.length === i) {
          const q = questions[i];
          const newAnswers = [...currentAnswers, { question_id: q.id, answer: "x", time_seconds: 999 }];
          setAnswers(newAnswers);
          setCardResult("ai");
        }
      }, aiTime * 1000);
      aiTimersRef.current = [id];
      return () => aiTimersRef.current.forEach((t) => clearTimeout(t));
    }
    // Для quiz режима
    aiTimersRef.current.forEach((t) => clearTimeout(t));
    aiTimersRef.current = [];
    let elapsed = 0;
    aiTimes.forEach((t, i) => {
      const id = setTimeout(() => {
        setAiAnsweredCount((c) => Math.min(c + 1, i + 1));
      }, (elapsed + t) * 1000);
      elapsed += t;
      aiTimersRef.current.push(id);
    });
    return () => aiTimersRef.current.forEach((t) => clearTimeout(t));
  }, [screen, questions.length, aiTimes, gameMode, currentQ]);

  // AI Timers for new modes
  useEffect(() => {
    if (screen !== "newModePlaying" || newModeQuestions.length === 0 || newModeAiTimes.length === 0) return;
    
    // Clear any existing timers
    aiTimersRef.current.forEach((t) => clearTimeout(t));
    aiTimersRef.current = [];
    
    let elapsed = 0;
    newModeAiTimes.forEach((t, i) => {
      const id = setTimeout(() => {
        setNewModeAiAnswered((c) => Math.min(c + 1, i + 1));
      }, (elapsed + t) * 1000);
      elapsed += t;
      aiTimersRef.current.push(id);
    });
    
    return () => aiTimersRef.current.forEach((t) => clearTimeout(t));
  }, [screen, newModeQuestions.length, newModeAiTimes]);

  // Global Timer for new modes
  useEffect(() => {
    if (screen !== "newModePlaying" || newModeQuestions.length === 0) return;
    
    if (newModeTimeLeft <= 0) {
      if (!submittedRef.current) {
        const currentAnswers = newModeAnswersRef.current;
        if (currentAnswers.length < newModeQuestions.length) {
          const remaining = newModeQuestions.slice(currentAnswers.length);
          const autoAnswers = [
            ...currentAnswers,
            ...remaining.map((r) => ({ question_id: r.id, answer: "", time_seconds: 0 })),
          ];
          submittedRef.current = true;
          newModeSubmitMutation.mutate({ answers: autoAnswers });
        }
      }
      return;
    }
    
    const id = setInterval(() => {
      setNewModeTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          if (!submittedRef.current) {
            const currentAnswers = newModeAnswersRef.current;
            const remaining = newModeQuestions.slice(currentAnswers.length);
            const autoAnswers = [
              ...currentAnswers,
              ...remaining.map((r) => ({ question_id: r.id, answer: "", time_seconds: 0 })),
            ];
            submittedRef.current = true;
            newModeSubmitMutation.mutate({ answers: autoAnswers });
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(id);
    // newModeTimeLeft intentionally omitted: listing it re-ran this effect every second and reset the interval.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- timer driven by setState(prev => ...) only
  }, [screen, newModeQuestions.length]);

  useEffect(() => {
    if (screen !== "playing" || gameMode === "flashcard" || questions.length === 0) return;
    if (timeLeft <= 0) {
      if (!submittedRef.current) {
        const currentAnswers = answersRef.current;
        if (currentAnswers.length < questions.length) {
          const remaining = questions.slice(currentAnswers.length);
          const newAnswers = [
            ...currentAnswers,
            ...remaining.map((r) => ({ question_id: r.id, answer: "", time_seconds: 0 })),
          ];
          submitMutation.mutate({ answers: newAnswers });
        }
      }
      return;
    }
    const id = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          if (!submittedRef.current && challengeId) {
            const currentAnswers = answersRef.current;
            if (currentAnswers.length < questions.length) {
              const remaining = questions.slice(currentAnswers.length);
              const newAnswers = [
                ...currentAnswers,
                ...remaining.map((r) => ({ question_id: r.id, answer: "", time_seconds: 0 })),
              ];
              submittedRef.current = true;
              submitMutation.mutate({ answers: newAnswers });
            }
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
    // timeLeft omitted for same reason as newModeTimeLeft (stable interval, functional updates).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, questions.length, gameMode]);

  const handleAnswer = (answer: string) => {
    if (submittedRef.current || !questions[currentQ]) return;
    const timeSec = (Date.now() - qStartTime) / 1000;
    const q = questions[currentQ];
    const newAnswers = [...answers, { question_id: q.id, answer, time_seconds: timeSec }];
    setAnswers(newAnswers);
    if (currentQ + 1 >= questions.length) {
      submittedRef.current = true;
      submitMutation.mutate({ answers: newAnswers });
    } else {
      setCurrentQ(currentQ + 1);
      setQStartTime(Date.now());
    }
  };

  const handleFlashcardAnswer = (answer: string) => {
    if (answers.length !== currentQ || cardResult || submittedRef.current || !questions[currentQ]) return;
    const timeSec = (Date.now() - qStartTime) / 1000;
    const q = questions[currentQ];
    const optText = answer === "a" ? q.option_a : answer === "b" ? q.option_b : answer === "c" ? q.option_c : q.option_d;
    const correct = optText === q.answer_text;
    const aiTime = aiTimes[currentQ] ?? 3;
    const userWins = correct && timeSec < aiTime;
    const newAnswers = [...answers, { question_id: q.id, answer, time_seconds: timeSec }];
    setAnswers(newAnswers);
    setCardResult(userWins ? "user" : "ai");
    aiTimersRef.current.forEach((t) => clearTimeout(t));
    aiTimersRef.current = [];
  };

  const handleNewModeAnswer = (answer: string) => {
    if (submittedRef.current || !newModeQuestions[newModeCurrentQ]) return;
    const timeSec = (Date.now() - newModeQStartTime) / 1000;
    const q = newModeQuestions[newModeCurrentQ];
    const newAnswers = [...newModeAnswers, { question_id: q.id, answer, time_seconds: timeSec }];
    setNewModeAnswers(newAnswers);
    if (newModeCurrentQ + 1 >= newModeQuestions.length) {
      submittedRef.current = true;
      newModeSubmitMutation.mutate({ answers: newAnswers });
    } else {
      setNewModeCurrentQ(newModeCurrentQ + 1);
      setNewModeQStartTime(Date.now());
    }
  };

  const getPairKey = (id1: string, id2: string) => [id1, id2].sort().join("-");

  const handleMemoryCardClick = (idx: number) => {
    if (memoryFlipped.length >= 2 || memoryFlipped.includes(idx)) return;
    const card = memoryCards[idx];
    const pairKey = getPairKey(card.id, card.pair_id);
    if (memoryMatched.has(pairKey)) return;
    const newFlipped = [...memoryFlipped, idx];
    setMemoryFlipped(newFlipped);
    if (newFlipped.length === 2) {
      const [a, b] = newFlipped;
      const cardA = memoryCards[a];
      const cardB = memoryCards[b];
      if (cardA.pair_id === cardB.id || cardB.pair_id === cardA.id) {
        setMemoryMatched((s) => new Set([...s, getPairKey(cardA.id, cardA.pair_id)]));
        setMemoryFlipped([]);
      } else {
        setTimeout(() => setMemoryFlipped([]), 1000);
      }
    }
  };

  useEffect(() => {
    if (memoryCards.length === 8 && memoryMatched.size === 4) {
      setScreen("memoryComplete");
    }
  }, [memoryCards.length, memoryMatched.size]);

  useEffect(() => {
    if (cardResult && gameMode === "flashcard" && !submittedRef.current) {
      const id = setTimeout(() => {
        setCardResult(null);
        if (currentQ + 1 >= questions.length) {
          submittedRef.current = true;
          submitMutation.mutate({ answers: answersRef.current });
        } else {
          setCurrentQ((prev) => prev + 1);
          setQStartTime(Date.now());
        }
      }, 1500);
      return () => clearTimeout(id);
    }
  }, [cardResult, gameMode, currentQ, questions.length]);

  const topicDescriptionLabel =
    challengeTopic == null
      ? t("aiClassicTrackAll")
      : challengeTopic === "python"
      ? t("aiClassicTrackPython")
      : challengeTopic === "web"
        ? t("aiClassicTrackWeb")
        : challengeTopic === "informatics"
          ? t("aiClassicTrackInformatics")
          : challengeTopic === "cybersecurity"
            ? t("aiTopicCybersecurity")
            : t("aiClassicTrackAll");

  const canStartFromIntro =
    wizardGameSelected &&
    challengeTopic != null &&
    (gameMode === "memory" || levelConfirmed);

  const selectWizardGame = (m: GameMode) => {
    setGameMode(m);
    setWizardGameSelected(true);
    setChallengeTopic(null);
    setLevelConfirmed(false);
    startMutation.reset();
    newModeStartMutation.reset();
  };

  const selectWizardTopic = (topic: ChallengeTopic) => {
    setChallengeTopic(topic);
    setLevelConfirmed(gameMode === "memory");
    startMutation.reset();
    newModeStartMutation.reset();
  };

  const selectWizardLevel = (l: AILevel) => {
    setAiLevel(l);
    setLevelConfirmed(true);
  };

  useEffect(() => {
    if (challengeTopic && !allowedTopics.includes(challengeTopic)) {
      setChallengeTopic(null);
      setLevelConfirmed(false);
      startMutation.reset();
      newModeStartMutation.reset();
    }
  }, [allowedTopics, challengeTopic, startMutation, newModeStartMutation]);

  if (!course) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
          <p className="mt-4 text-center text-gray-600 dark:text-gray-400">
            {t("loading")}
          </p>
        </div>
      </div>
    );
  }

  // Если параметры переданы в URL, не показываем экран intro, а сразу начинаем игру
  const shouldShowIntro = screen === "intro" && !urlMode && !urlLevel;
  
  // Не использовать «questions.length===0» после завершения запроса — иначе вечный спиннер.
  const isUrlAutoStart = !!(urlMode && urlLevel && screen === "intro");
  const isLoadingGame =
    isUrlAutoStart &&
    (startMutation.isPending ||
      startMutation.isError ||
      (startMutation.isIdle && !startMutation.isSuccess && questions.length === 0));

  return (
    <div className="relative min-h-screen">
      {/* Декоративный фон с игровыми элементами */}
      {shouldShowIntro && (
        <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
          {/* Градиентный фон */}
          <div 
            className="absolute inset-0 opacity-30"
            style={{
              background: isDark
                ? "radial-gradient(circle at 20% 50%, rgba(139, 92, 246, 0.15) 0%, transparent 50%), radial-gradient(circle at 80% 50%, rgba(59, 130, 246, 0.15) 0%, transparent 50%)"
                : "radial-gradient(circle at 20% 50%, rgba(139, 92, 246, 0.08) 0%, transparent 50%), radial-gradient(circle at 80% 50%, rgba(59, 130, 246, 0.08) 0%, transparent 50%)"
            }}
          />
          
          {/* Плавающие декоративные элементы */}
          <div className="absolute top-[10%] left-[5%] w-16 h-16 opacity-20 animate-float-particle">
            <Zap className="w-full h-full text-purple-500" />
          </div>
          <div className="absolute top-[20%] right-[10%] w-12 h-12 opacity-15 animate-float-particle-slow" style={{ animationDelay: "-2s" }}>
            <Star className="w-full h-full text-blue-500 fill-current" />
          </div>
          <div className="absolute bottom-[15%] left-[8%] w-10 h-10 opacity-20 animate-float-particle" style={{ animationDelay: "-4s" }}>
            <Sparkles className="w-full h-full text-purple-400" />
          </div>
          <div className="absolute bottom-[25%] right-[5%] w-14 h-14 opacity-15 animate-float-particle-slow" style={{ animationDelay: "-1s" }}>
            <Trophy className="w-full h-full text-amber-500" />
          </div>
          <div className="absolute top-[50%] left-[3%] w-8 h-8 opacity-20 animate-float-particle-fast" style={{ animationDelay: "-3s" }}>
            <Star className="w-full h-full text-blue-400 fill-current" />
          </div>
          <div className="absolute top-[40%] right-[3%] w-12 h-12 opacity-15 animate-float-particle" style={{ animationDelay: "-5s" }}>
            <Zap className="w-full h-full text-purple-400" />
          </div>
          
          {/* Орбитальные частицы */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] animate-orbit-slow">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-purple-400/40" />
            <div className="absolute top-1/2 right-0 -translate-y-1/2 translate-x-1/2 w-1.5 h-1.5 rounded-full bg-blue-400/30" />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2 h-2 rounded-full bg-purple-500/30" />
            <div className="absolute top-1/2 left-0 -translate-y-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-blue-500/40" />
          </div>
          
          {/* Дополнительные плавающие точки */}
          <div className="absolute top-[30%] left-[15%] w-1.5 h-1.5 rounded-full bg-purple-400/50 animate-float-particle" />
          <div className="absolute top-[35%] right-[20%] w-2 h-2 rounded-full bg-blue-400/40 animate-float-particle" style={{ animationDelay: "-2s" }} />
          <div className="absolute bottom-[30%] left-[25%] w-1 h-1 rounded-full bg-purple-500/50 animate-float-particle-slow" style={{ animationDelay: "-4s" }} />
          <div className="absolute bottom-[40%] right-[15%] w-1.5 h-1.5 rounded-full bg-blue-500/40 animate-float-particle" style={{ animationDelay: "-1s" }} />
          
          {/* Particles эффект */}
          <Particles
            className="absolute inset-0"
            quantity={30}
            ease={80}
            color={isDark ? "#8b5cf6" : "#7c3aed"}
            size={0.8}
            staticity={50}
          />
        </div>
      )}
      
      <div className="relative max-w-4xl mx-auto z-10 px-1 sm:px-0">
      {/* Показываем загрузку, если параметры переданы и игра начинается */}
      {isLoadingGame && (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="relative text-center">
            <div className="w-16 h-16 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto" />
            <p className="mt-4 text-center text-gray-600 dark:text-gray-400">
              {startMutation.isError
                ? getApiErrorMessage(startMutation.error, t("error"))
                : t("aiJoining")}
            </p>
            {startMutation.isError && (
              <div className="mt-4 space-y-2">
                <Link
                  href={`/app/courses/${targetCourseId}`}
                  className="block px-4 py-2 rounded-lg text-white text-center bg-purple-600 hover:bg-purple-700 transition-colors"
                >
                  {t("aiGoToCourse")}
                </Link>
                <button
                  onClick={() => startMutation.mutate()}
                  className="w-full px-4 py-2 rounded-lg border-2 border-purple-500 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  {t("aiRetry")}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Показываем контент игры, если не идет загрузка */}
      {!isLoadingGame && (
        <>
      {shouldShowIntro && (
        <BlurFade delay={0.1}>
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-5 sm:p-8 lg:p-12 text-center overflow-hidden border-2 border-purple-200/50 dark:border-purple-800/50">
            {/* Декоративные элементы внутри карточки */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/5 dark:bg-purple-400/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/5 dark:bg-blue-400/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
            
            {/* Светящиеся углы */}
            <div className="absolute top-0 left-0 w-20 h-20 bg-gradient-to-br from-purple-500/20 to-transparent rounded-tl-2xl" />
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-blue-500/20 to-transparent rounded-tr-2xl" />
            <div className="absolute bottom-0 left-0 w-20 h-20 bg-gradient-to-tr from-purple-500/20 to-transparent rounded-bl-2xl" />
            <div className="absolute bottom-0 right-0 w-20 h-20 bg-gradient-to-tl from-blue-500/20 to-transparent rounded-br-2xl" />
            
            <div className="relative z-10">
              <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center mx-auto mb-4 shadow-lg">
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-purple-400 to-blue-400 animate-pulse opacity-75" />
                <Zap className="w-10 h-10 text-white relative z-10 animate-pulse" />
                {/* Вращающиеся звезды вокруг иконки */}
                <div className="absolute -top-2 -right-2 w-4 h-4 animate-spin" style={{ animationDuration: "3s" }}>
                  <Star className="w-full h-full text-yellow-400 fill-current" />
                </div>
                <div className="absolute -bottom-2 -left-2 w-3 h-3 animate-spin" style={{ animationDuration: "4s", animationDirection: "reverse" }}>
                  <Star className="w-full h-full text-blue-400 fill-current" />
                </div>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-2">
                {t("aiVsStudent")}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {gameMode === "flashcard"
                  ? t("aiGameDescriptionFlashcardTrack").replace("{track}", topicDescriptionLabel)
                  : gameMode === "memory"
                    ? t("aiGameDescriptionMemoryTrack").replace("{track}", topicDescriptionLabel)
                    : gameMode === "find_bug"
                      ? t("aiGameDescriptionFindBug")
                      : gameMode === "guess_output"
                        ? t("aiGameDescriptionGuessOutput")
                        : gameMode === "speed_code"
                          ? t("aiGameDescriptionSpeedCode")
                          : t("aiGameDescriptionQuizTrack").replace("{track}", topicDescriptionLabel)}
              </p>
              
              {/* Tip for classic modes */}
              {wizardGameSelected &&
                (gameMode === "quiz" || gameMode === "flashcard" || gameMode === "memory") && (
                  <div className="max-w-md mx-auto mb-6 p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 rounded-xl text-sm text-purple-700 dark:text-purple-300 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    {gameMode === "quiz" && t("aiClassicModeQuizTip")}
                    {gameMode === "flashcard" && t("aiClassicModeFlashcardTip")}
                    {gameMode === "memory" && t("aiClassicModeMemoryTip")}
                  </div>
                )}

              <div className="mb-6">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{t("gameMode")}:</p>
                </div>
                <div className="flex gap-2 justify-center flex-wrap">
                  <button
                    type="button"
                    onClick={() => selectWizardGame("quiz")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      wizardGameSelected && gameMode === "quiz"
                        ? "bg-purple-600 text-white"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                    }`}
                  >
                    <Zap className="w-4 h-4" />
                    {t("quiz")}
                  </button>
                  <button
                    type="button"
                    onClick={() => selectWizardGame("flashcard")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      wizardGameSelected && gameMode === "flashcard"
                        ? "bg-purple-600 text-white"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                    }`}
                  >
                    <Layers className="w-4 h-4" />
                    {t("flashcardDuel")}
                  </button>
                  <button
                    type="button"
                    onClick={() => selectWizardGame("memory")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      wizardGameSelected && gameMode === "memory"
                        ? "bg-purple-600 text-white"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                    }`}
                  >
                    <Brain className="w-4 h-4" />
                    {t("memoryGame")}
                  </button>
                  <button
                    type="button"
                    onClick={() => selectWizardGame("find_bug")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      wizardGameSelected && gameMode === "find_bug"
                        ? "bg-purple-600 text-white shadow-lg"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                    }`}
                  >
                    <Bug className="w-4 h-4" />
                    {t("findBugGame")}
                  </button>
                  <button
                    type="button"
                    onClick={() => selectWizardGame("guess_output")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      wizardGameSelected && gameMode === "guess_output"
                        ? "bg-purple-600 text-white shadow-lg"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                    }`}
                  >
                    <Terminal className="w-4 h-4" />
                    {t("guessOutputGame")}
                  </button>
                  <button
                    type="button"
                    onClick={() => selectWizardGame("speed_code")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      wizardGameSelected && gameMode === "speed_code"
                        ? "bg-purple-600 text-white shadow-lg"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                    }`}
                  >
                    <Code className="w-4 h-4" />
                    {t("speedCodeGame")}
                  </button>
                </div>

                {wizardGameSelected && (
                  <div className="mb-4 mt-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex items-center justify-center gap-2 mb-3">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{t("aiTopicLabel")}:</p>
                    </div>
                    <div className="flex gap-2 justify-center flex-wrap">
                      {allowedTopics.map((topic) => (
                        <button
                          key={topic}
                          type="button"
                          onClick={() => selectWizardTopic(topic)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            challengeTopic === topic
                              ? "bg-purple-600 text-white"
                              : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                          }`}
                        >
                          {topic === "python" && <span aria-hidden>🐍</span>}
                          {topic === "web" && <span aria-hidden>🌐</span>}
                          {topic === "informatics" && <GraduationCap className="w-4 h-4" />}
                          {topic === "cybersecurity" && <Shield className="w-4 h-4" aria-hidden />}
                          {topic === "python" && t("aiClassicTrackPython")}
                          {topic === "web" && t("aiClassicTrackWeb")}
                          {topic === "informatics" && t("aiClassicTrackInformatics")}
                          {topic === "cybersecurity" && t("aiTopicCybersecurity")}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {wizardGameSelected && challengeTopic != null && gameMode !== "memory" && (
                  <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex items-center justify-center gap-2 mb-3 mt-4">
                      <Bot className="w-4 h-4 text-blue-500" />
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{t("aiLevelLabel")}:</p>
                    </div>
                    <div className="flex gap-2 justify-center flex-wrap">
                      {(["beginner", "intermediate", "expert"] as const).map((l) => (
                        <button
                          key={l}
                          type="button"
                          onClick={() => selectWizardLevel(l)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            levelConfirmed && aiLevel === l
                              ? "bg-purple-600 text-white"
                              : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                          }`}
                        >
                          {l === "beginner" ? t("aiLevelBeginner") : l === "intermediate" ? t("aiLevelIntermediate") : t("aiLevelExpert")}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    if (["find_bug", "guess_output", "speed_code"].includes(gameMode)) {
                      newModeStartMutation.mutate();
                    } else {
                      startMutation.mutate();
                    }
                  }}
                  disabled={
                    !canStartFromIntro || startMutation.isPending || newModeStartMutation.isPending
                  }
                  className="relative py-4 sm:py-5 px-8 sm:px-14 rounded-xl text-white disabled:opacity-50 font-semibold text-lg sm:text-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 transition-all shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 overflow-hidden group min-h-[3rem]"
                >
                  {/* Блестящий эффект при hover */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                  <span className="relative z-10 flex items-center gap-2">
                    <Zap className="w-5 h-5" />
                    {startMutation.isPending || newModeStartMutation.isPending ? t("aiJoining") : t("aiStarting")}
                  </span>
                </button>
                {/* Декоративные элементы вокруг кнопки */}
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-ping" />
                <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
              </div>
              {(startMutation.isError || newModeStartMutation.isError) && (
                <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                  <p className="text-red-600 dark:text-red-400 text-sm">
                    {getApiErrorMessage(startMutation.error || newModeStartMutation.error, t("error"))}
                  </p>
                </div>
              )}
            </div>
          </div>
        </BlurFade>
      )}

      {screen === "playing" && questions[currentQ] && gameMode === "flashcard" && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-purple-100 dark:bg-purple-900">
              <User className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <div className="flex gap-1">
                {questions.map((_, i) => (
                  <div
                    key={i}
                    className={`w-2 h-2 rounded-full ${
                      i < answers.length ? "bg-purple-600" : "bg-gray-200 dark:bg-gray-600"
                    }`}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-100 dark:bg-amber-900">
              <Bot className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <div className="flex gap-1">
                {questions.map((_, i) => (
                  <div
                    key={i}
                    className={`w-2 h-2 rounded-full ${
                      i < aiAnsweredCount ? "bg-amber-600" : "bg-gray-200 dark:bg-gray-600"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">{t("aiCard")} {currentQ + 1} / {questions.length}</p>
          <p className="text-sm text-amber-600 dark:text-amber-400 mb-4">{t("aiTime")}: {aiTimes[currentQ]?.toFixed(1)}{t("aiSecondsShort")}</p>
          {cardResult ? (
            <div className="space-y-4">
              <p className={`text-lg font-semibold ${cardResult === "user" ? "text-green-600" : "text-amber-600"}`}>
                {cardResult === "user" ? t("aiYouWon") : t("aiWon")}
              </p>
              <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-700">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{t("aiAnswer")}:</p>
                <p className="text-gray-800 dark:text-white">{questions[currentQ].answer_text}</p>
              </div>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">{questions[currentQ].question_text}</h2>
              <p className="text-sm text-amber-600 dark:text-amber-400 mb-3">
                {t("aiWaitAnswer")
                  .replace("{time}", aiTimes[currentQ]?.toFixed(1) || "0")
                  .replace("{unit}", t("aiSecondsShort"))}
              </p>
              <div className="space-y-3">
                {["a", "b", "c", "d"].map((key) => {
                  const q = questions[currentQ];
                  const opt = key === "a" ? q.option_a : key === "b" ? q.option_b : key === "c" ? q.option_c : q.option_d;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleFlashcardAnswer(key)}
                      className="w-full text-left py-3 px-4 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                    >
                      {key.toUpperCase()}. {opt ?? ""}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {screen === "memory" && memoryCards.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{t("aiMemoryFindPairs")}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {memoryCards.map((card, idx) => {
              const isFlipped = memoryFlipped.includes(idx);
              const pairKey = getPairKey(card.id, card.pair_id);
              const isMatched = memoryMatched.has(pairKey);
              return (
                <button
                  key={card.id + idx}
                  type="button"
                  onClick={() => handleMemoryCardClick(idx)}
                  disabled={isMatched || (memoryFlipped.length >= 2 && !isFlipped)}
                  className={`aspect-[4/3] rounded-lg p-3 text-left text-sm font-medium transition-all flex items-center justify-center ${
                    isMatched
                      ? "bg-green-100 dark:bg-green-900/30 border-2 border-green-500 opacity-80"
                      : isFlipped
                        ? "bg-purple-100 dark:bg-purple-900/30 border-2 border-purple-500"
                        : "bg-gray-100 dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 hover:border-purple-500"
                  }`}
                >
                  <span className={isFlipped || isMatched ? "text-gray-800 dark:text-white line-clamp-4" : "text-2xl text-gray-400"}>
                    {isFlipped || isMatched ? card.text : "?"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {screen === "memoryComplete" && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
          <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mx-auto mb-4">
            <Trophy className="w-10 h-10 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">{t("aiCongratulations")}</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{t("aiAllPairsFound")}</p>
          <div className="flex gap-3 justify-center">
            <button
              type="button"
              onClick={() => { setScreen("intro"); setMemoryCards([]); setMemoryMatched(new Set()); }}
              className="py-2 px-4 rounded-lg border border-purple-500 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
            >
              {t("aiRetry")}
            </button>
            {!isTeacher && (
              <Link href={`/app/courses/${targetCourseId}`} className="py-2 px-4 rounded-lg text-white bg-purple-600 hover:bg-purple-700 transition-colors">
                {t("aiBackToCourse")}
              </Link>
            )}
          </div>
        </div>
      )}

      {screen === "playing" && questions[currentQ] && gameMode === "quiz" && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <Clock className="w-5 h-5" />
          <span className="font-bold text-lg">{timeLeft}{t("aiSecondsShort")}</span>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-purple-100 dark:bg-purple-900">
              <User className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <div className="flex-1">
                <div className="flex gap-1 mb-1">
                  {questions.map((_, i) => (
                    <div
                      key={i}
                      className={`w-2 h-2 rounded-full ${
                        i < answers.length ? "bg-purple-600" : "bg-gray-200 dark:bg-gray-600"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-100 dark:bg-amber-900">
              <Bot className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <div className="flex gap-1">
                {questions.map((_, i) => (
                  <div
                    key={i}
                    className={`w-2 h-2 rounded-full ${
                      i < aiAnsweredCount ? "bg-amber-600" : "bg-gray-200 dark:bg-gray-600"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">{t("teacherCreateQuestion")} {currentQ + 1} / {questions.length}</p>
          <p className="text-sm text-amber-600 dark:text-amber-400 mb-4">{t("aiTime")}: {aiTimes[currentQ]?.toFixed(1)}{t("aiSecondsShort")}</p>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-6">{questions[currentQ].question_text}</h2>
          <div className="space-y-3">
            {["a", "b", "c", "d"].map((key) => {
              const q = questions[currentQ];
              const opt = key === "a" ? q.option_a : key === "b" ? q.option_b : key === "c" ? q.option_c : q.option_d;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleAnswer(key)}
                  className="w-full text-left py-3 px-4 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                >
                  {key.toUpperCase()}. {opt ?? ""}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════════ NEW MODE: PLAYING SCREEN ═══════════ */}
      {screen === "newModePlaying" && newModeQuestions[newModeCurrentQ] && (() => {
        const q = newModeQuestions[newModeCurrentQ];
        const codeLines = q.code ? q.code.split("\n") : [];
        const progress = ((newModeCurrentQ) / newModeQuestions.length) * 100;

        const handleNewModeAnswerInternal = (answer: string) => {
          handleNewModeAnswer(answer);
        };

        return (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
            {/* Header: progress + timer + AI status */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                  {newModeCurrentQ + 1}/{newModeQuestions.length}
                </span>
                <div className="w-32 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800">
                  <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className={`text-sm font-mono font-bold ${newModeTimeLeft < 10 ? "text-red-500 animate-pulse" : "text-blue-700 dark:text-blue-300"}`}>
                    {newModeTimeLeft}{t("aiSecondsShort")}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800">
                  <Bot className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span className="text-sm font-bold text-amber-700 dark:text-amber-300">{newModeAiAnswered}/{newModeQuestions.length}</span>
                </div>
              </div>
            </div>

            {/* Category + Level badge */}
            <div className="flex items-center justify-center gap-2 mb-4">
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300">
                {CATEGORY_ICONS[q.category] || "📝"} {localizeNewModeCategory(q.category, t)}
              </span>
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                {localizeNewModeLevel(q.level, t)}
              </span>
            </div>

            {/* Game mode hint */}
            <p className="text-center font-semibold text-gray-700 dark:text-gray-200 mb-4">
              {gameMode === "find_bug" ? t("aiFindBugHint")
                : gameMode === "guess_output" ? t("aiGuessOutputHint")
                : t("aiSpeedCodeHint")}
            </p>

            {/* Task description for speed_code */}
            {gameMode === "speed_code" && q.task && (
              <div className="mb-4 p-4 rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 border border-green-200 dark:border-green-800">
                <p className="text-sm font-medium text-green-800 dark:text-green-200">{q.task}</p>
              </div>
            )}

            {/* Code display (for find_bug and guess_output) */}
            {(gameMode === "find_bug" || gameMode === "guess_output") && codeLines.length > 0 && (
              <div className="mb-4 rounded-xl overflow-hidden border border-gray-300 dark:border-gray-600">
                <div className="bg-gray-900 p-1 flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="ml-2 text-xs text-gray-400">{q.category}.{gameMode === "find_bug" ? "bug" : "py"}</span>
                </div>
                <div className="bg-gray-950 p-3 overflow-x-auto">
                  {codeLines.map((line, idx) => (
                    <div
                      key={idx}
                      onClick={() => gameMode === "find_bug" ? handleNewModeAnswerInternal(String(idx + 1)) : undefined}
                      className={`flex items-start gap-3 px-2 py-0.5 rounded transition-all ${
                        gameMode === "find_bug"
                          ? "cursor-pointer hover:bg-red-500/20 hover:border-l-2 hover:border-red-500 active:bg-red-500/30"
                          : ""
                      }`}
                    >
                      <span className="text-gray-500 text-xs font-mono w-6 text-right select-none shrink-0">{idx + 1}</span>
                      <pre className="text-green-400 text-sm font-mono whitespace-pre-wrap break-all">{line || " "}</pre>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Options (for guess_output and speed_code) */}
            {(gameMode === "guess_output" || gameMode === "speed_code") && q.options && (
              <div className="grid grid-cols-1 gap-3">
                {q.options.map((opt, idx) => {
                  const key = String.fromCharCode(97 + idx); // a, b, c, d
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleNewModeAnswerInternal(key)}
                      className="text-left p-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 hover:border-purple-400 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all group"
                    >
                      <div className="flex items-start gap-3">
                        <span className="shrink-0 w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-sm font-bold text-gray-600 dark:text-gray-300 group-hover:bg-purple-100 dark:group-hover:bg-purple-800 group-hover:text-purple-700 dark:group-hover:text-purple-300 transition-colors">
                          {key.toUpperCase()}
                        </span>
                        <pre className="text-sm font-mono text-gray-700 dark:text-gray-200 whitespace-pre-wrap break-all flex-1">{opt}</pre>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {newModeSubmitMutation.isPending && (
              <div className="flex items-center justify-center mt-4">
                <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
              </div>
            )}
          </div>
        );
      })()}

      {/* ═══════════ RESULTS SCREEN (both classic and new modes) ═══════════ */}
      {(screen === "results" || screen === "newModeResults") && results && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5 sm:p-8 text-center">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${results.user_wins ? "bg-green-100 dark:bg-green-900" : "bg-amber-100 dark:bg-amber-900"}`}>
            <Trophy className={`w-10 h-10 ${results.user_wins ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}`} />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
            {results.overtime ? t("aiTimeUp") : results.user_wins ? t("aiCongratulations") : `${t("aiWon")}. ${t("tryAgain")}`}
          </h1>
          {results.user_correct === results.total_questions && (
            <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl text-green-700 dark:text-green-300 font-bold animate-bounce">
              ✨ {t("aiPerfectScoreBonus")} ✨
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 my-6 text-left">
            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <p className="font-medium text-gray-700 dark:text-gray-300">{t("aiUser")}</p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{results.user_correct}/{results.total_questions}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t("aiThinkingSpeed")}: {results.user_time.toFixed(1)}{t("aiSecondsShort")}</p>
              {results.user_bonus_points > 0 && <p className="text-sm text-green-600 dark:text-green-400">{t("bonus")}: +{results.user_bonus_points}</p>}
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mt-1">{t("aiTotal")}: {results.user_total_score}</p>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <p className="font-medium text-gray-700 dark:text-gray-300">{t("aiBot")}</p>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{results.ai_correct}/{results.total_questions}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t("aiThinkingSpeed")}: {results.ai_time.toFixed(1)}{t("aiSecondsShort")}</p>
              {results.ai_bonus_points > 0 && <p className="text-sm text-green-600 dark:text-green-400">{t("bonus")}: +{results.ai_bonus_points}</p>}
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mt-1">{t("aiTotal")}: {results.ai_total_score}</p>
            </div>
          </div>
          {results.metrics && (
            <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg text-left">
              <p className="font-medium text-gray-700 dark:text-gray-300 mb-3">{t("aiStudentVsAiMetrics")}</p>
              <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-600">
                    <th className="text-left py-2 text-gray-600 dark:text-gray-400 font-medium">{t("aiMetric")}</th>
                    <th className="text-left py-2 text-purple-600 dark:text-purple-400 font-medium">{t("aiUser")}</th>
                    <th className="text-left py-2 text-amber-600 dark:text-amber-400 font-medium">{t("aiBot")}</th>
                  </tr>
                </thead>
                <tbody className="text-gray-700 dark:text-gray-300">
                  <tr className="border-b border-gray-100 dark:border-gray-600">
                    <td className="py-2">{t("aiThinkingSpeed")} ({t("aiSpeedUnit")})</td>
                    <td className="py-2">{results.metrics.user_speed_avg_sec}</td>
                    <td className="py-2">{results.metrics.ai_speed_avg_sec ?? "-"}</td>
                  </tr>
                  <tr className="border-b border-gray-100 dark:border-gray-600">
                    <td className="py-2">{t("aiMemoryAccuracy")}</td>
                    <td className="py-2">{results.metrics.user_accuracy_pct}</td>
                    <td className="py-2">{results.metrics.ai_accuracy_pct ?? "-"}</td>
                  </tr>
                  <tr>
                    <td className="py-2">{t("aiStrategyBonus")}</td>
                    <td className="py-2">+{results.metrics.user_strategy_bonus}</td>
                    <td className="py-2">+{results.metrics.ai_strategy_bonus ?? 0}</td>
                  </tr>
                </tbody>
              </table>
              </div>
              <div className="sm:hidden space-y-2">
                <div className="rounded-lg bg-white/70 dark:bg-gray-800/60 p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t("aiThinkingSpeed")} ({t("aiSpeedUnit")})</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{t("aiUser")}: {results.metrics.user_speed_avg_sec}</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{t("aiBot")}: {results.metrics.ai_speed_avg_sec ?? "-"}</p>
                </div>
                <div className="rounded-lg bg-white/70 dark:bg-gray-800/60 p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t("aiMemoryAccuracy")}</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{t("aiUser")}: {results.metrics.user_accuracy_pct}</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{t("aiBot")}: {results.metrics.ai_accuracy_pct ?? "-"}</p>
                </div>
                <div className="rounded-lg bg-white/70 dark:bg-gray-800/60 p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t("aiStrategyBonus")}</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{t("aiUser")}: +{results.metrics.user_strategy_bonus}</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{t("aiBot")}: +{results.metrics.ai_strategy_bonus ?? 0}</p>
                </div>
              </div>
            </div>
          ) }
          {results.recommendations && (
            <div className="mb-8 overflow-hidden rounded-2xl border border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/20 dark:to-gray-900 shadow-sm">
              <div className="flex items-center justify-between bg-purple-100/50 dark:bg-purple-900/30 px-4 py-3 border-b border-purple-200 dark:border-purple-800">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-purple-600 rounded-lg">
                    <Brain className="w-4 h-4 text-white" />
                  </div>
                  <span className="font-bold text-purple-900 dark:text-purple-100">
                    {t("aiRecommendations")}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/80 dark:bg-gray-800/80 border border-purple-200 dark:border-purple-800 shadow-sm">
                  <Sparkles className="w-3 h-3 text-purple-600 dark:text-purple-400 animate-pulse" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                    {t("aiGeneratedBy")}
                  </span>
                </div>
              </div>
              <div className="p-5 text-left">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                    {results.recommendations}
                  </p>
                </div>
                
                {results.wrong_topics && results.wrong_topics.length > 0 && (
                  <div className="mt-5 pt-4 border-t border-purple-100 dark:border-purple-900/50">
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                      {t("aiRecommendedTopicsToReview")}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {results.wrong_topics.map((topic) => (
                        <Link
                          key={topic.id}
                          href={`/app/courses/${targetCourseId}/topic/${topic.id}`}
                          className="group flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-purple-100 dark:border-purple-900 hover:border-purple-400 dark:hover:border-purple-500 hover:shadow-md transition-all duration-200"
                        >
                          <div className="w-6 h-6 flex items-center justify-center rounded-lg bg-purple-50 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                            <GraduationCap className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                            {topic.title}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {results.details && results.details.length > 0 && (
            <div className="mb-6 text-left">
              <p className="font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <Bug className="w-4 h-4 text-red-500" />
                {t("aiRecommendations")}
              </p>
              <div className="space-y-3">
                {results.details.map((detail, idx) => (
                  <div key={idx} className={`p-4 rounded-xl border ${detail.correct ? "bg-green-50/50 dark:bg-green-900/10 border-green-200 dark:border-green-800" : "bg-red-50/50 dark:bg-red-900/10 border-red-200 dark:border-red-800"}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                        {t("aiResultQuestion").replace("{n}", String(idx + 1))}
                      </span>
                      {detail.correct ? (
                        <span className="text-xs font-bold text-green-600 dark:text-green-400 flex items-center gap-1">
                          <Zap className="w-3 h-3" /> {t("aiResultCorrect")}
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-red-600 dark:text-red-400 flex items-center gap-1">
                          <Bug className="w-3 h-3" /> {t("aiResultWrong")}
                        </span>
                      )}
                    </div>
                    {gameMode === "find_bug" ? (
                      <p className="text-sm text-gray-700 dark:text-gray-300 mb-1">
                        {t("aiCorrectLine")}: <span className="font-mono font-bold text-purple-600 dark:text-purple-400">{detail.correct_answer}</span>
                      </p>
                    ) : (
                      <p className="text-sm text-gray-700 dark:text-gray-300 mb-1">
                        {t("aiAnswer")}: <span className="font-mono font-bold text-purple-600 dark:text-purple-400">{detail.correct_answer}</span>
                      </p>
                    )}
                    {detail.explanation && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 italic mt-2">
                        <span className="font-bold not-italic">{t("aiExplanation")}:</span>{" "}
                        {detail.explanation_by_lang?.[lang as "ru" | "kk" | "en"] ||
                          detail.explanation_by_lang?.ru ||
                          detail.explanation}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-3 justify-center">
            <button
              type="button"
              onClick={() => {
                // Сбросить состояние и вернуться на экран выбора игры
                router.replace(`/app/ai-challenge/${cId}`);
                setScreen("intro");
                setResults(null);
                setCardResult(null);
                setQuestions([]);
                setAiTimes([]);
                setAiAnsweredCount(0);
              }}
              className="py-2 px-4 rounded-lg border border-purple-500 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
            >
              {t("aiViewAgain")}
            </button>
            {!isTeacher && (
              <Link href={`/app/courses/${targetCourseId}`} className="py-2 px-4 rounded-lg text-white bg-purple-600 hover:bg-purple-700 transition-colors">
                {t("aiBackToCourse")}
              </Link>
            )}
          </div>
        </div>
      )}
        </>
      )}
      </div>
    </div>
  );
}
