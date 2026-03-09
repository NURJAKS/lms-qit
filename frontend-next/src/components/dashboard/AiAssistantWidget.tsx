"use client";

import { useState, useRef, useEffect } from "react";
import { Bot, Send, X } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { api } from "@/api/client";

export function AiAssistantWidget() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Array<{ role: "user" | "bot"; text: string }>>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRefDesktop = useRef<HTMLDivElement>(null);
  const scrollRefMobile = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRefDesktop.current?.scrollTo(0, scrollRefDesktop.current.scrollHeight);
    scrollRefMobile.current?.scrollTo(0, scrollRefMobile.current.scrollHeight);
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
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

  return (
    <div className="lg:w-80 shrink-0">
      <div
        className="rounded-[20px] overflow-hidden shadow-lg border border-gray-200/80 dark:border-gray-700"
        style={{
          background: "linear-gradient(135deg, rgba(26,35,126,0.08) 0%, rgba(255,64,129,0.08) 100%)",
        }}
      >
        <div
          className="p-4 text-white flex items-center justify-between"
          style={{ background: "var(--qit-gradient-banner)" }}
        >
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/20">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm">{t("aiAssistant")}</h3>
              <span className="text-xs text-white/80">{t("askAiHomework")}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors lg:hidden"
            aria-label={open ? t("aiClose") : t("aiOpen")}
          >
            {open ? <X className="w-5 h-5" /> : <span className="text-xs bg-white/20 px-2 py-0.5 rounded">{t("aiOpen")}</span>}
          </button>
        </div>

        {/* Desktop: always show full widget */}
        <div className="hidden lg:block">
          <div ref={scrollRefDesktop} className="h-48 overflow-auto p-4 space-y-3 bg-white/50 dark:bg-gray-800/30">
              {messages.length === 0 && (
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  {t("aiWelcomeLong")}
                </p>
              )}
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[90%] rounded-xl px-3 py-2 text-sm ${
                      msg.role === "user"
                        ? "text-white"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                    }`}
                    style={msg.role === "user" ? { background: "var(--qit-gradient-3)" } : undefined}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 dark:bg-gray-700 rounded-xl px-3 py-2 text-sm text-gray-500">
                    {t("aiAnswerLoading")}
                  </div>
                </div>
              )}
            </div>
            <div className="p-3 border-t border-gray-200/80 dark:border-gray-700 flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder={t("aiQuestionPlaceholder")}
                className="flex-1 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-800 focus:ring-2 focus:ring-[#ff4081]/30 focus:border-[#ff4081]"
              />
              <button
                type="button"
                onClick={send}
                disabled={loading || !input.trim()}
                className="p-2 rounded-xl text-white disabled:opacity-50 transition-opacity"
                style={{ background: "var(--qit-gradient-3)" }}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>

        {/* Mobile: collapsed by default, expand on click */}
        <div className="lg:hidden">
            {open && (
            <>
              <div ref={scrollRefMobile} className="h-40 overflow-auto p-4 space-y-3 bg-white/50 dark:bg-gray-800/30">
                {messages.length === 0 && (
                  <p className="text-gray-600 dark:text-gray-400 text-sm">{t("aiWelcomeShort")}</p>
                )}
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[90%] rounded-xl px-3 py-2 text-sm ${
                        msg.role === "user" ? "text-white" : "bg-gray-100 dark:bg-gray-700"
                      }`}
                      style={msg.role === "user" ? { background: "var(--qit-gradient-3)" } : undefined}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 dark:bg-gray-700 rounded-xl px-3 py-2 text-sm text-gray-500">
                      {t("aiAnswerLoading")}
                    </div>
                  </div>
                )}
              </div>
              <div className="p-3 border-t border-gray-200/80 flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                  placeholder={t("aiQuestionPlaceholder")}
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={send}
                  disabled={loading || !input.trim()}
                  className="p-2 rounded-xl text-white disabled:opacity-50"
                  style={{ background: "var(--qit-gradient-3)" }}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
          {!open && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="w-full p-4 flex items-center justify-center gap-2 text-gray-600 dark:text-gray-400 hover:bg-white/30 dark:hover:bg-gray-700/30 transition-colors"
            >
              <Bot className="w-5 h-5" style={{ color: "var(--qit-accent)" }} />
              <span className="text-sm font-medium">{t("askAiHomework")}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
