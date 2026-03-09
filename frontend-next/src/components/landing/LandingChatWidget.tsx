"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Bot, X, Send } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useAuthStore } from "@/store/authStore";
import { api } from "@/api/client";

const STORAGE_KEY = "ai-chat-history";

function loadMessages(userId: number | undefined): Array<{ role: "user" | "bot"; text: string }> {
  if (typeof window === "undefined") return [];
  try {
    const key = userId ? `${STORAGE_KEY}-${userId}` : `${STORAGE_KEY}-guest`;
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveMessages(userId: number | undefined, messages: Array<{ role: "user" | "bot"; text: string }>) {
  if (typeof window === "undefined") return;
  try {
    const key = userId ? `${STORAGE_KEY}-${userId}` : `${STORAGE_KEY}-guest`;
    localStorage.setItem(key, JSON.stringify(messages));
  } catch {
    // ignore
  }
}

export function LandingChatWidget() {
  const { t } = useLanguage();
  const token = useAuthStore((s) => s.token);
  const userId = useAuthStore((s) => s.user?.id);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Array<{ role: "user" | "bot"; text: string }>>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setMessages(loadMessages(userId));
  }, [userId]);

  useEffect(() => {
    saveMessages(userId, messages);
  }, [messages, userId]);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading || !token) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text }]);
    setLoading(true);
    try {
      const { data } = await api.post<{ response: string }>("/ai/chat", { message: text });
      setMessages((m) => [...m, { role: "bot", text: data.response }]);
    } catch {
      setMessages((m) => [...m, { role: "bot", text: t("aiError") }]);
    } finally {
      setLoading(false);
    }
  };

  const renderPanel = () => {
    if (token) {
      return (
        <div className="absolute bottom-20 right-0 w-80 sm:w-96 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col max-h-[28rem]">
          <div className="p-4 text-white shrink-0" style={{ background: "var(--qit-gradient-1)" }}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg">{t("chatbotTitle")}</h3>
                <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">{t("chatbotBadge")}</span>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="p-2 hover:bg-white/20 rounded-full transition-colors" aria-label={t("ariaClose")}>
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div ref={scrollRef} className="flex-1 overflow-auto p-4 space-y-3 min-h-[12rem]">
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
          <div className="p-3 border-t dark:border-gray-700 flex gap-2 shrink-0">
            <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder={t("aiMessagePlaceholder")} className="flex-1 border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-[var(--qit-primary)]" />
            <button type="button" onClick={send} disabled={loading || !input.trim()} className="p-2 rounded-lg text-white disabled:opacity-50" style={{ background: "var(--qit-primary)" }}>
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="absolute bottom-20 right-0 w-80 sm:w-96 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="p-6 text-white" style={{ background: "var(--qit-gradient-1)" }}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-lg">{t("chatbotTitle")}</h3>
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">{t("chatbotBadge")}</span>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="p-2 hover:bg-white/20 rounded-full transition-colors" aria-label={t("ariaClose")}>
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-gray-600 dark:text-gray-300 text-sm">{t("chatbotWelcome")}</p>
          <div className="flex gap-3">
            <Link href="/login" className="flex-1 py-2.5 px-4 rounded-xl text-white text-center font-medium hover:opacity-90 transition-opacity" style={{ background: "var(--qit-gradient-1)" }}>
              {t("chatbotLoginPrompt")}
            </Link>
            <Link href="/register" className="flex-1 py-2.5 px-4 rounded-xl text-white text-center font-medium hover:opacity-90 transition-opacity" style={{ background: "var(--qit-gradient-3)" }}>
              {t("chatbotRegisterPrompt")}
            </Link>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed bottom-8 right-8 z-[1000]">
      {open && renderPanel()}
      <div className="animate-float">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="w-16 h-16 rounded-full flex items-center justify-center text-white shadow-lg hover:scale-105 transition-transform relative"
          style={{ background: "var(--qit-gradient-2)" }}
          aria-label="AI Assistant"
        >
          <Bot className="w-8 h-8" />
          {messages.length > 0 && !open && (
            <span className="absolute -top-1 -right-1 min-w-[1.5rem] h-6 px-1 rounded-full text-white text-xs font-bold flex items-center justify-center" style={{ background: "var(--qit-gradient-3)" }}>
              {messages.length > 99 ? "99+" : messages.length}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
