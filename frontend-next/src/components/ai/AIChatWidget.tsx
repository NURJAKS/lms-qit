"use client";

import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Lock, Sparkles } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useAuthStore } from "@/store/authStore";
import { useLanguage } from "@/context/LanguageContext";
import { useSidebar } from "@/context/SidebarContext";
import Link from "next/link";

export function AIChatWidget() {
  const { t } = useLanguage();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Array<{ role: "user" | "bot"; text: string }>>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isPremium = user?.is_premium === 1;
  const { mobileOpen } = useSidebar();

  const { data: dailyLimit } = useQuery({
    queryKey: ["ai-daily-limit"],
    queryFn: async () => {
      const { data } = await api.get<{
        is_premium: boolean;
        used_count: number;
        limit: number;
        remaining: number;
        is_allowed: boolean;
      }>("/ai/daily-limit");
      return data;
    },
    enabled: !!token,
    refetchInterval: 30000, // Обновляем каждые 30 секунд
  });

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading || !token) return;

    // Проверяем лимит перед отправкой
    if (!isPremium && dailyLimit && !dailyLimit.is_allowed) {
      setMessages((m) => [
        ...m,
        {
          role: "bot",
          text: t("aiDailyLimitReached"),
        },
      ]);
      return;
    }

    setInput("");
    setMessages((m) => [...m, { role: "user", text }]);
    setLoading(true);
    try {
      const { data } = await api.post<{ response: string }>("/ai/chat", { message: text });
      setMessages((m) => [...m, { role: "bot", text: data.response }]);
      // Обновляем лимит после успешного запроса
      queryClient.invalidateQueries({ queryKey: ["ai-daily-limit"] });
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.detail || t("aiError");
      setMessages((m) => [...m, { role: "bot", text: errorMessage }]);
    } finally {
      setLoading(false);
    }
  };

  if (!token) return null;

  return (
    <div className={`transition-opacity duration-300 ${mobileOpen ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="fixed bottom-[96px] right-4 md:bottom-6 md:right-6 w-12 h-12 md:w-14 md:h-14 rounded-full text-white shadow-lg flex items-center justify-center z-[50] transition-all active:scale-95 hover:scale-105"
        style={{ background: "var(--qit-primary)" }}
      >
        <MessageCircle className="w-5 h-5 md:w-6 md:h-6" />
      </button>
      {open && (
        <div className="fixed bottom-[150px] right-4 md:bottom-24 md:right-6 w-[calc(100vw-2rem)] md:w-96 max-h-[60vh] md:max-h-[28rem] bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 flex flex-col z-[50]">
          <div className="flex items-center justify-between p-3 border-b dark:border-gray-700 text-white" style={{ background: "var(--qit-gradient-1)" }}>
            <div className="flex items-center gap-2">
              <span className="font-semibold">🤖 {t("aiAssistant")}</span>
              <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded uppercase tracking-wider font-bold">
                AI
              </span>
              {!isPremium && dailyLimit && (
                <span className="text-xs bg-white/20 px-2 py-0.5 rounded">
                  {dailyLimit.used_count}/{dailyLimit.limit}
                </span>
              )}
            </div>
            <button type="button" onClick={() => setOpen(false)} className="p-1 hover:bg-white/20 rounded text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
          {!isPremium && dailyLimit && !dailyLimit.is_allowed && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border-b dark:border-yellow-800">
              <div className="flex items-start gap-2 text-sm">
                <Lock className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-yellow-800 dark:text-yellow-200 font-medium">
                    {t("aiDailyLimitReached")}
                  </p>
                  <Link
                    href="/app/premium"
                    className="text-yellow-600 dark:text-yellow-400 hover:underline text-xs mt-1 inline-flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    {t("upgradeToPremium")}
                  </Link>
                </div>
              </div>
            </div>
          )}
          <div ref={scrollRef} className="flex-1 overflow-auto p-3 space-y-3 min-h-[12rem]">
            {messages.length === 0 && <p className="text-gray-500 text-sm">{t("chatWelcomeMessage")}</p>}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${msg.role === "user" ? "text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200"}`} style={msg.role === "user" ? { background: "var(--qit-primary)" } : undefined}>
                  {msg.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2 text-sm text-gray-500">{t("aiAnswerLoading")}</div>
              </div>
            )}
          </div>
          <div className="p-3 border-t dark:border-gray-700 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder={t("aiMessagePlaceholder")}
              disabled={!isPremium && dailyLimit && !dailyLimit.is_allowed}
              className="flex-1 border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-[var(--qit-primary)] disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              type="button"
              onClick={send}
              disabled={loading || !input.trim() || (!isPremium && dailyLimit && !dailyLimit.is_allowed)}
              className="p-2 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: "var(--qit-primary)" }}
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
