"use client";

import { useState, useRef, useEffect } from "react";
import {
  MessageCircle,
  Send,
  Lightbulb,
  Target,
  Users,
  GraduationCap,
  ThumbsUp,
  Clock,
  Sparkles,
  ChevronDown,
  Crown,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { useAuthStore } from "@/store/authStore";
import { getGlassCardStyle, getTextColors, getInputStyle } from "@/utils/themeStyles";
import { BlurFade } from "@/components/ui/blur-fade";

type MessageTag = "strategy" | "tip";

interface ChatMessage {
  id: number;
  author: string;
  avatarColor: string;
  text: string;
  tag: MessageTag;
  timeAgo: string;
  likes: number;
  isAlumni: boolean;
  isPremium?: boolean;
  courseName?: string;
}

const AVATAR_COLORS = [
  "linear-gradient(135deg, #FF6B6B 0%, #EE5A24 100%)",
  "linear-gradient(135deg, #7C3AED 0%, #DB2777 100%)",
  "linear-gradient(135deg, #059669 0%, #14B8A6 100%)",
  "linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)",
  "linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)",
  "linear-gradient(135deg, #EC4899 0%, #8B5CF6 100%)",
  "linear-gradient(135deg, #06B6D4 0%, #3B82F6 100%)",
  "linear-gradient(135deg, #10B981 0%, #059669 100%)",
];

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const MOCK_MESSAGES_RU: ChatMessage[] = [
  {
    id: 1,
    author: "Алия Касымова",
    avatarColor: AVATAR_COLORS[0],
    text: "Совет будущим студентам: когда будете изучать циклы, не пытайтесь сразу понять рекурсию. Сначала разберитесь с for и while, и только потом переходите. Мне это очень помогло!",
    tag: "tip",
    timeAgo: "2ч назад",
    likes: 12,
    isAlumni: false,
  },
  {
    id: 2,
    author: "Данияр Ахметов",
    avatarColor: AVATAR_COLORS[1],
    text: "Моя стратегия для решения задач: сначала пишу решение на бумаге/в голове, потом pseudo-code, и только потом код. Так ошибок гораздо меньше и логика сразу понятна.",
    tag: "strategy",
    timeAgo: "5ч назад",
    likes: 24,
    isAlumni: false,
  },
  {
    id: 3,
    author: "Арман Нурланов",
    avatarColor: AVATAR_COLORS[2],
    text: "Закончил этот курс в прошлом потоке. Совет: обязательно делайте все задания, даже необязательные. Именно на них я понял ООП по-настоящему. Удачи вам!",
    tag: "tip",
    timeAgo: "1д назад",
    likes: 31,
    isAlumni: true,
    isPremium: true,
  },
  {
    id: 4,
    author: "Камила Жумабаева",
    avatarColor: AVATAR_COLORS[3],
    text: "Подход к отладке: когда код не работает, я сначала читаю ошибку вслух, потом гуглю первую строку ошибки. В 90% случаев находишь ответ за 5 минут.",
    tag: "strategy",
    timeAgo: "1д назад",
    likes: 18,
    isAlumni: false,
  },
  {
    id: 5,
    author: "Ерболат Сериков",
    avatarColor: AVATAR_COLORS[4],
    text: "Прошел курс с отличием. Стратегия: каждый день по 1 часу лучше, чем 7 часов раз в неделю. Consistency is key! Также очень помогали ежедневные квесты на платформе.",
    tag: "strategy",
    timeAgo: "2д назад",
    likes: 45,
    isAlumni: true,
    isPremium: true,
  },
  {
    id: 6,
    author: "Мадина Токаева",
    avatarColor: AVATAR_COLORS[5],
    text: "Совет: когда застряли на задаче — объясните её кому-нибудь (даже резиновой уточке). Rubber duck debugging реально работает! Я так решила самую сложную задачу модуля.",
    tag: "tip",
    timeAgo: "3д назад",
    likes: 22,
    isAlumni: false,
  },
  {
    id: 7,
    author: "Нурсултан Абдрахманов",
    avatarColor: AVATAR_COLORS[6],
    text: "Моя стратегия: после каждого урока я пишу краткий конспект своими словами. Занимает 5-10 минут, но потом при подготовке к тестам экономишь часы.",
    tag: "strategy",
    timeAgo: "4д назад",
    likes: 29,
    isAlumni: true,
    isPremium: true,
  },
  {
    id: 8,
    author: "Айгерим Бекболатова",
    avatarColor: AVATAR_COLORS[7],
    text: "Будущим студентам: не бойтесь задавать вопросы куратору! Они здесь, чтобы помочь. Я стеснялась первый месяц и зря потеряла время.",
    tag: "tip",
    timeAgo: "5д назад",
    likes: 36,
    isAlumni: false,
  },
];

const MOCK_MESSAGES_KK: ChatMessage[] = [
  {
    id: 1,
    author: "Әлия Қасымова",
    avatarColor: AVATAR_COLORS[0],
    text: "Болашақ студенттерге кеңес: циклдерді оқығанда рекурсияны бірден түсінуге тырыспаңыз. Алдымен for мен while-ді меңгеріңіз, содан кейін ғана ауысыңыз.",
    tag: "tip",
    timeAgo: "2 сағ бұрын",
    likes: 12,
    isAlumni: false,
  },
  {
    id: 2,
    author: "Данияр Ахметов",
    avatarColor: AVATAR_COLORS[1],
    text: "Менің есептерді шешу стратегиям: алдымен шешімді қағазға/ойымда жазамын, содан кейін pseudo-code, содан кейін ғана код. Қателіктер әлдеқайда аз болады.",
    tag: "strategy",
    timeAgo: "5 сағ бұрын",
    likes: 24,
    isAlumni: false,
  },
  {
    id: 3,
    author: "Арман Нұрланов",
    avatarColor: AVATAR_COLORS[2],
    text: "Осы курсты өткен ағымда аяқтадым. Кеңес: барлық тапсырмаларды орындаңыз, тіпті міндетті емес. ООП-ты дәл осы тапсырмаларда түсіндім. Сәттілік!",
    tag: "tip",
    timeAgo: "1 күн бұрын",
    likes: 31,
    isAlumni: true,
    isPremium: true,
  },
  {
    id: 4,
    author: "Камила Жұмабаева",
    avatarColor: AVATAR_COLORS[3],
    text: "Отладка тәсілім: код жұмыс істемегенде, алдымен қатені дауыстап оқимын, содан кейін қатенің бірінші жолын іздеймін. 90% жағдайда 5 минутта жауап табасыз.",
    tag: "strategy",
    timeAgo: "1 күн бұрын",
    likes: 18,
    isAlumni: false,
  },
  {
    id: 5,
    author: "Ерболат Серіков",
    avatarColor: AVATAR_COLORS[4],
    text: "Курсты үздік бағамен аяқтадым. Стратегия: аптасына бір рет 7 сағаттан гөрі күн сайын 1 сағат жақсы. Тұрақтылық — кілт! Платформадағы күнделікті квесттер де өте көмектесті.",
    tag: "strategy",
    timeAgo: "2 күн бұрын",
    likes: 45,
    isAlumni: true,
    isPremium: true,
  },
  {
    id: 6,
    author: "Мадина Тоқаева",
    avatarColor: AVATAR_COLORS[5],
    text: "Кеңес: тапсырмада тұрып қалсаңыз — оны біреуге түсіндіріңіз (тіпті резеңке үйректе де). Rubber duck debugging шынымен жұмыс істейді!",
    tag: "tip",
    timeAgo: "3 күн бұрын",
    likes: 22,
    isAlumni: false,
  },
];

const MOCK_MESSAGES_EN: ChatMessage[] = [
  {
    id: 1,
    author: "Aliya Kassymova",
    avatarColor: AVATAR_COLORS[0],
    text: "Tip for future students: when learning loops, don't try to understand recursion right away. Master for and while first, then move on. It helped me a lot!",
    tag: "tip",
    timeAgo: "2h ago",
    likes: 12,
    isAlumni: false,
  },
  {
    id: 2,
    author: "Daniyar Akhmetov",
    avatarColor: AVATAR_COLORS[1],
    text: "My strategy for solving problems: first I write the solution on paper/in my head, then pseudo-code, and only then actual code. Way fewer bugs and the logic is clear right away.",
    tag: "strategy",
    timeAgo: "5h ago",
    likes: 24,
    isAlumni: false,
  },
  {
    id: 3,
    author: "Arman Nurlanov",
    avatarColor: AVATAR_COLORS[2],
    text: "Finished this course in the previous cohort. Advice: do all assignments, even optional ones. That's where I truly understood OOP. Good luck!",
    tag: "tip",
    timeAgo: "1d ago",
    likes: 31,
    isAlumni: true,
    isPremium: true,
  },
  {
    id: 4,
    author: "Kamila Zhumabayeva",
    avatarColor: AVATAR_COLORS[3],
    text: "Debugging approach: when code doesn't work, I first read the error out loud, then Google the first line of the error. 90% of the time you find the answer in 5 minutes.",
    tag: "strategy",
    timeAgo: "1d ago",
    likes: 18,
    isAlumni: false,
  },
  {
    id: 5,
    author: "Yerbolat Serikov",
    avatarColor: AVATAR_COLORS[4],
    text: "Graduated with honors. Strategy: 1 hour every day is better than 7 hours once a week. Consistency is key! The platform's daily quests also helped a lot.",
    tag: "strategy",
    timeAgo: "2d ago",
    likes: 45,
    isAlumni: true,
    isPremium: true,
  },
  {
    id: 6,
    author: "Madina Tokayeva",
    avatarColor: AVATAR_COLORS[5],
    text: "Tip: when you're stuck on a task — explain it to someone (even a rubber duck). Rubber duck debugging really works! That's how I solved the hardest module challenge.",
    tag: "tip",
    timeAgo: "3d ago",
    likes: 22,
    isAlumni: false,
  },
  {
    id: 7,
    author: "Nursultan Abdrakhmanov",
    avatarColor: AVATAR_COLORS[6],
    text: "My strategy: after each lesson I write a brief summary in my own words. Takes 5-10 minutes, but saves hours when preparing for tests.",
    tag: "strategy",
    timeAgo: "4d ago",
    likes: 29,
    isAlumni: true,
    isPremium: true,
  },
  {
    id: 8,
    author: "Aigerim Bekbolatova",
    avatarColor: AVATAR_COLORS[7],
    text: "Future students: don't be afraid to ask your curator questions! They're here to help. I was too shy for the first month and wasted valuable time.",
    tag: "tip",
    timeAgo: "5d ago",
    likes: 36,
    isAlumni: false,
  },
];

const MESSAGES_BY_LANG: Record<string, ChatMessage[]> = {
  ru: MOCK_MESSAGES_RU,
  kk: MOCK_MESSAGES_KK,
  en: MOCK_MESSAGES_EN,
};

type FilterType = "all" | "strategy" | "tip";

export function StudentGroupChat() {
  const { t, lang } = useLanguage();
  const { theme } = useTheme();
  const { user } = useAuthStore();
  const glassStyle = getGlassCardStyle(theme);
  const textColors = getTextColors(theme);
  const inputStyle = getInputStyle(theme);
  const isDark = theme === "dark";

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [selectedTag, setSelectedTag] = useState<MessageTag>("strategy");
  const [filter, setFilter] = useState<FilterType>("all");
  const [likedIds, setLikedIds] = useState<Set<number>>(new Set());
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages(MESSAGES_BY_LANG[lang] || MOCK_MESSAGES_RU);
  }, [lang]);

  const filteredMessages = filter === "all" ? messages : messages.filter((m) => m.tag === filter);

  const handleSend = () => {
    if (!newMessage.trim()) return;
    const newMsg: ChatMessage = {
      id: Date.now(),
      author: user?.full_name || "Student",
      avatarColor: "linear-gradient(135deg, #FF4181 0%, #B938EB 100%)",
      text: newMessage.trim(),
      tag: selectedTag,
      timeAgo: lang === "ru" ? "только что" : lang === "kk" ? "дәл қазір" : "just now",
      likes: 0,
      isAlumni: false,
      isPremium: user?.is_premium === 1,
    };
    setMessages((prev) => [newMsg, ...prev]);
    setNewMessage("");
  };

  const handleLike = (id: number) => {
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setMessages((prev) =>
      prev.map((m) =>
        m.id === id
          ? { ...m, likes: likedIds.has(id) ? m.likes - 1 : m.likes + 1 }
          : m
      )
    );
  };

  const tagConfig = {
    strategy: {
      icon: Target,
      label: t("communityTagStrategy"),
      bg: isDark ? "rgba(59, 130, 246, 0.15)" : "rgba(59, 130, 246, 0.1)",
      color: "#3B82F6",
      border: isDark ? "rgba(59, 130, 246, 0.3)" : "rgba(59, 130, 246, 0.2)",
    },
    tip: {
      icon: Lightbulb,
      label: t("communityTagTip"),
      bg: isDark ? "rgba(245, 158, 11, 0.15)" : "rgba(245, 158, 11, 0.1)",
      color: "#F59E0B",
      border: isDark ? "rgba(245, 158, 11, 0.3)" : "rgba(245, 158, 11, 0.2)",
    },
  };

  const statsStrategies = messages.filter((m) => m.tag === "strategy").length;
  const statsTips = messages.filter((m) => m.tag === "tip").length;
  const statsAlumni = messages.filter((m) => m.isAlumni).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <BlurFade delay={0} direction="down" duration={0.5} offset={20}>
        <div
          className="relative rounded-xl overflow-hidden p-6 text-white"
          style={{
            background: "linear-gradient(135deg, #7C3AED 0%, #2563EB 50%, #06B6D4 100%)",
            boxShadow: "0 8px 24px rgba(124, 58, 237, 0.25)",
          }}
        >
          <div className="absolute inset-0 opacity-10">
            <svg className="absolute bottom-0 left-0 w-full h-24" viewBox="0 0 1200 120" preserveAspectRatio="none">
              <path fill="currentColor" d="M0,60 C300,120 600,0 900,60 C1050,90 1200,30 1200,60 L1200,120 L0,120 Z" />
            </svg>
          </div>
          <div className="absolute top-4 right-4 w-32 h-32 rounded-full bg-white/10 blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl lg:text-2xl font-bold">{t("communityTitle")}</h1>
                <p className="text-white/80 text-sm">Python — {t("communityCohort")} #3</p>
              </div>
            </div>
            <p className="text-white/90 text-sm mt-3 max-w-2xl">{t("communitySubtitle")}</p>
          </div>
        </div>
      </BlurFade>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: MessageCircle, value: messages.length, label: t("communityStatsMessages"), color: "#7C3AED" },
          { icon: Target, value: statsStrategies, label: t("communityStatsStrategies"), color: "#3B82F6" },
          { icon: Lightbulb, value: statsTips, label: t("communityStatsTips"), color: "#F59E0B" },
          { icon: GraduationCap, value: statsAlumni, label: t("communityStatsAlumni"), color: "#10B981" },
        ].map((stat, index) => (
          <BlurFade key={stat.label} delay={0.1 + index * 0.05} direction="down" duration={0.5} offset={20}>
            <div
              className="rounded-xl p-4 flex items-center gap-3"
              style={glassStyle}
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center text-white shrink-0"
                style={{ background: stat.color }}
              >
                <stat.icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-lg font-bold" style={{ color: textColors.primary }}>{stat.value}</p>
                <p className="text-xs" style={{ color: textColors.secondary }}>{stat.label}</p>
              </div>
            </div>
          </BlurFade>
        ))}
      </div>

      {/* Write message */}
      <BlurFade delay={0.3} direction="down" duration={0.5} offset={20}>
        <div className="rounded-xl overflow-hidden" style={glassStyle}>
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4" style={{ color: "#7C3AED" }} />
              <span className="text-sm font-semibold" style={{ color: textColors.primary }}>
                {t("communityWriteMessage")}
              </span>
            </div>

            {/* Tag selector */}
            <div className="flex gap-2 mb-3">
              {(["strategy", "tip"] as MessageTag[]).map((tag) => {
                const cfg = tagConfig[tag];
                const isSelected = selectedTag === tag;
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setSelectedTag(tag)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={{
                      background: isSelected ? cfg.color : cfg.bg,
                      color: isSelected ? "#fff" : cfg.color,
                      border: `1px solid ${cfg.border}`,
                    }}
                  >
                    <cfg.icon className="w-3.5 h-3.5" />
                    {cfg.label}
                  </button>
                );
              })}
            </div>

            {/* Input */}
            <div className="flex gap-2">
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={t("communityPlaceholder")}
                rows={2}
                className="flex-1 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                style={inputStyle}
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={!newMessage.trim()}
                className="self-end px-4 py-3 rounded-xl text-white font-medium text-sm transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: "linear-gradient(135deg, #7C3AED 0%, #2563EB 100%)" }}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </BlurFade>

      {/* Filter tabs */}
      <BlurFade delay={0.4} direction="down" duration={0.5} offset={20}>
        <div className="flex gap-2">
          {(["all", "strategy", "tip"] as FilterType[]).map((f) => {
            const isActive = filter === f;
            const label =
              f === "all"
                ? t("communityFilterAll")
                : f === "strategy"
                ? t("communityTagStrategy")
                : t("communityTagTip");
            return (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className="px-4 py-2 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: isActive
                    ? "linear-gradient(135deg, #7C3AED 0%, #2563EB 100%)"
                    : isDark
                    ? "rgba(30, 41, 59, 0.6)"
                    : "rgba(0, 0, 0, 0.04)",
                  color: isActive ? "#fff" : textColors.secondary,
                  border: `1px solid ${
                    isActive
                      ? "transparent"
                      : isDark
                      ? "rgba(255, 255, 255, 0.08)"
                      : "rgba(0, 0, 0, 0.06)"
                  }`,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </BlurFade>

      {/* Messages list */}
      <div className="space-y-3">
        {filteredMessages.map((msg, index) => {
          const cfg = tagConfig[msg.tag];
          const TagIcon = cfg.icon;
          const isLiked = likedIds.has(msg.id);

          return (
            <BlurFade key={msg.id} delay={0.5 + index * 0.08} direction="down" duration={0.5} offset={20}>
              <div
                className="rounded-xl overflow-hidden transition-all hover:scale-[1.005] group"
                style={glassStyle}
              >
                <div className="p-4">
                  {/* Author row */}
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                      style={{ background: msg.avatarColor }}
                    >
                      {getInitials(msg.author)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold" style={{ color: textColors.primary }}>
                          {msg.author}
                        </span>
                        {msg.isAlumni && (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                            style={{
                              background: isDark ? "rgba(16, 185, 129, 0.15)" : "rgba(16, 185, 129, 0.1)",
                              color: "#10B981",
                              border: `1px solid ${isDark ? "rgba(16, 185, 129, 0.3)" : "rgba(16, 185, 129, 0.2)"}`,
                            }}
                          >
                            <GraduationCap className="w-3 h-3" />
                            {t("communityAlumni")}
                          </span>
                        )}
                        {msg.isPremium && (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                            style={{
                              background: isDark ? "rgba(124, 58, 237, 0.15)" : "rgba(124, 58, 237, 0.1)",
                              color: "#7C3AED",
                              border: `1px solid ${isDark ? "rgba(124, 58, 237, 0.3)" : "rgba(124, 58, 237, 0.2)"}`,
                            }}
                          >
                            <Sparkles className="w-3 h-3" />
                            {t("communityPremiumBadge")}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Clock className="w-3 h-3" style={{ color: textColors.secondary }} />
                        <span className="text-xs" style={{ color: textColors.secondary }}>{msg.timeAgo}</span>
                      </div>
                    </div>

                    {/* Tag badge */}
                    <span
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium shrink-0"
                      style={{
                        background: cfg.bg,
                        color: cfg.color,
                        border: `1px solid ${cfg.border}`,
                      }}
                    >
                      <TagIcon className="w-3 h-3" />
                      {cfg.label}
                    </span>
                  </div>

                  {/* Message text */}
                  <p className="text-sm leading-relaxed mb-3 pl-12" style={{ color: textColors.primary }}>
                    {msg.text}
                  </p>

                  {/* Footer: likes */}
                  <div className="flex items-center gap-3 pl-12">
                    <button
                      type="button"
                      onClick={() => handleLike(msg.id)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all hover:scale-105"
                      style={{
                        background: isLiked
                          ? isDark
                            ? "rgba(124, 58, 237, 0.2)"
                            : "rgba(124, 58, 237, 0.1)"
                          : isDark
                          ? "rgba(255, 255, 255, 0.05)"
                          : "rgba(0, 0, 0, 0.03)",
                        color: isLiked ? "#7C3AED" : textColors.secondary,
                        border: `1px solid ${
                          isLiked
                            ? isDark
                              ? "rgba(124, 58, 237, 0.3)"
                              : "rgba(124, 58, 237, 0.2)"
                            : isDark
                            ? "rgba(255, 255, 255, 0.08)"
                            : "rgba(0, 0, 0, 0.06)"
                        }`,
                      }}
                    >
                      <ThumbsUp className="w-3 h-3" />
                      {msg.likes + (isLiked ? 1 : 0)}
                    </button>
                  </div>
                </div>
              </div>
            </BlurFade>
          );
        })}
      </div>

      <div ref={chatEndRef} />
    </div>
  );
}
