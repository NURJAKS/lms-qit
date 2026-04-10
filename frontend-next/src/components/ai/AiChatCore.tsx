"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Lock, Sparkles } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { api } from "@/api/client";
import { useAuthStore } from "@/store/authStore";
import { useLanguage } from "@/context/LanguageContext";

type AiChatCoreProps = {
  /** Full-page layout: fills height, no floating positioning */
  layout?: "page" | "panel";
  className?: string;
};

export function AiChatCore({ layout = "panel", className = "" }: AiChatCoreProps) {
  const { t } = useLanguage();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<Array<{ role: "user" | "bot"; text: string }>>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isPremium = user?.is_premium === 1;

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
    refetchInterval: 30000,
  });

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading || !token) return;

    if (!isPremium && dailyLimit && !dailyLimit.is_allowed) {
      setMessages((m) => [...m, { role: "bot", text: t("aiDailyLimitReached") }]);
      return;
    }

    setInput("");
    setMessages((m) => [...m, { role: "user", text }]);
    setLoading(true);
    try {
      const { data } = await api.post<{ response: string }>("/ai/chat", { message: text });
      setMessages((m) => [...m, { role: "bot", text: data.response }]);
      queryClient.invalidateQueries({ queryKey: ["ai-daily-limit"] });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } };
      const errorMessage = err?.response?.data?.detail || t("aiError");
      setMessages((m) => [...m, { role: "bot", text: errorMessage }]);
    } finally {
      setLoading(false);
    }
  };

  if (!token) return null;

  const shell =
    layout === "page"
      ? `flex flex-col flex-1 min-h-0 min-h-[18rem] rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg ${className}`
      : `flex flex-col max-h-[60vh] md:max-h-[28rem] w-full md:w-96 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 ${className}`;

  return (
    <div className={shell}>
      <div
        className="flex items-center justify-between p-3 border-b dark:border-gray-700 text-white shrink-0"
        style={{ background: "var(--qit-gradient-1)" }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-4 h-4 shrink-0 opacity-90" />
          <span className="font-semibold truncate">{t("qazaqAiPageTitle")}</span>
          <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded uppercase tracking-wider font-bold shrink-0">
            AI
          </span>
          {!isPremium && dailyLimit && (
            <span className="text-xs bg-white/20 px-2 py-0.5 rounded shrink-0">
              {dailyLimit.used_count}/{dailyLimit.limit}
            </span>
          )}
        </div>
      </div>
      {!isPremium && dailyLimit && !dailyLimit.is_allowed && (
        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border-b dark:border-yellow-800 shrink-0">
          <div className="flex items-start gap-2 text-sm">
            <Lock className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-yellow-800 dark:text-yellow-200 font-medium">{t("aiDailyLimitReached")}</p>
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
        {messages.length === 0 && <p className="text-gray-500 dark:text-gray-400 text-sm">{t("chatWelcomeMessage")}</p>}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                msg.role === "user" ? "text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
              }`}
              style={msg.role === "user" ? { background: "var(--qit-primary)" } : undefined}
            >
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
      <div className="p-3 border-t dark:border-gray-700 flex gap-2 shrink-0">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={t("aiMessagePlaceholder")}
          disabled={!isPremium && dailyLimit && !dailyLimit.is_allowed}
          className="flex-1 min-w-0 border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-[var(--qit-primary)] disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <button
          type="button"
          onClick={send}
          disabled={loading || !input.trim() || (!isPremium && dailyLimit && !dailyLimit.is_allowed)}
          className="p-2 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          style={{ background: "var(--qit-primary)" }}
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
