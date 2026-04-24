"use client";

import { useState, useRef, useEffect, useLayoutEffect, type PointerEvent } from "react";
import { Bot, X, Send, Lock, Sparkles, CornerUpLeft, ChevronDown } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useAuthStore } from "@/store/authStore";
import { useLanguage } from "@/context/LanguageContext";
import { useSidebar } from "@/context/SidebarContext";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function AIChatWidget() {
  const { t, lang } = useLanguage();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Array<{ role: "user" | "bot"; text: string }>>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestionPool] = useState(() => {
    const all = [
      "Маған оқу жоспарын құруға көмектесші",
      "Бүгінгі сабақ бойынша сұрақтарым бар",
      "Қалай тиімді оқуға болады?",
      "Осы курстың ең қиын тақырыптары қандай?",
      "Маған тестке дайындалуға көмектесші",
      "Программалау негіздерін түсіндіріп берші",
      "Бұл тақырыпты қарапайым тілмен түсіндірші",
      "Маған практикалық тапсырма берші",
    ];
    return [...all].sort(() => Math.random() - 0.5);
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resizeSessionRef = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null);
  const isPremium = user?.is_premium === 1;

  const SIZE_STORAGE_KEY = "ai-chat-widget-size";
  const PANEL_MIN_W = 288; // 18rem
  const PANEL_MIN_H = 320; // 20rem
  const { mobileOpen } = useSidebar();

  const [panelPx, setPanelPx] = useState<{ w: number; h: number } | null>(null);
  const [isMobileViewport, setIsMobileViewport] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(max-width: 767px)");
    const syncViewport = () => {
      setIsMobileViewport(media.matches);
    };
    syncViewport();
    media.addEventListener("change", syncViewport);
    return () => media.removeEventListener("change", syncViewport);
  }, []);

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
  }, [messages, loading, suggestionsOpen]);

  useLayoutEffect(() => {
    if (!open) return;
    if (isMobileViewport) {
      setPanelPx(null);
      return;
    }
    try {
      const raw = localStorage.getItem(SIZE_STORAGE_KEY);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw) as { w?: number; h?: number };
      const w = parsed.w;
      const h = parsed.h;
      if (typeof w !== "number" || typeof h !== "number" || w < 1 || h < 1) {
        return;
      }
      const maxW = window.innerWidth - 16;
      const maxH = Math.min(window.innerHeight * 0.9, window.innerHeight - 80);
      setPanelPx({
        w: Math.round(Math.min(maxW, Math.max(PANEL_MIN_W, w))),
        h: Math.round(Math.min(maxH, Math.max(PANEL_MIN_H, h))),
      });
    } catch {
      /* ignore */
    }
  }, [open, isMobileViewport]);

  useEffect(() => {
    if (isMobileViewport && panelPx !== null) {
      setPanelPx(null);
    }
  }, [isMobileViewport, panelPx]);

  useEffect(() => {
    if (!open || isMobileViewport || !panelPx) return;
    const syncPanelWithinViewport = () => {
      const { maxW, maxH } = panelBounds();
      const nextW = Math.min(maxW, Math.max(PANEL_MIN_W, panelPx.w));
      const nextH = Math.min(maxH, Math.max(PANEL_MIN_H, panelPx.h));
      if (nextW !== panelPx.w || nextH !== panelPx.h) {
        setPanelPx({ w: Math.round(nextW), h: Math.round(nextH) });
      }
    };
    window.addEventListener("resize", syncPanelWithinViewport);
    return () => window.removeEventListener("resize", syncPanelWithinViewport);
  }, [open, isMobileViewport, panelPx]);

  useEffect(() => {
    if (!open) {
      resizeSessionRef.current = null;
    }
  }, [open]);

  const panelBounds = () => {
    const maxW = window.innerWidth - 16;
    const maxH = Math.min(window.innerHeight * 0.9, window.innerHeight - 80);
    return { maxW, maxH };
  };

  const persistPanelSize = () => {
    const el = panelRef.current;
    if (!el) return;
    try {
      localStorage.setItem(
        SIZE_STORAGE_KEY,
        JSON.stringify({ w: el.offsetWidth, h: el.offsetHeight }),
      );
    } catch {
      /* ignore */
    }
  };

  const onResizePointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (isMobileViewport) return;
    e.preventDefault();
    e.stopPropagation();
    const el = panelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const startW = panelPx?.w ?? Math.round(rect.width);
    const startH = panelPx?.h ?? Math.round(rect.height);
    if (panelPx === null) {
      setPanelPx({ w: startW, h: startH });
    }
    resizeSessionRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startW,
      startH,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onResizePointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    const session = resizeSessionRef.current;
    if (!session) return;
    const { maxW, maxH } = panelBounds();
    const nextW = Math.round(
      Math.min(maxW, Math.max(PANEL_MIN_W, session.startW - (e.clientX - session.startX))),
    );
    const nextH = Math.round(
      Math.min(maxH, Math.max(PANEL_MIN_H, session.startH - (e.clientY - session.startY))),
    );
    setPanelPx({ w: nextW, h: nextH });
  };

  const endResize = (e: PointerEvent<HTMLButtonElement>) => {
    resizeSessionRef.current = null;
    persistPanelSize();
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const STORAGE_KEY = "ai-chat-history";

  // Load history from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const key = user?.id ? `${STORAGE_KEY}-${user.id}` : `${STORAGE_KEY}-guest`;
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMessages(parsed);
          } else {
            // If empty array, add greeting
            setMessages([
              {
                role: "bot",
                text: "Сәлем! Мен саған оқу процесінде көмектесуге дайынмын. Өзіңді қызықтырған сұрақты қой немесе төмендегі дайын нұсқауларды пайдалан. 👇",
              },
            ]);
          }
        } catch (e) {
          console.error("Failed to parse AI history", e);
        }
      } else {
        // First time opening, add greeting
        setMessages([
          {
            role: "bot",
            text: "Сәлем! Мен саған оқу процесінде көмектесуге дайынмын. Өзіңді қызықтырған сұрақты қой немесе төмендегі дайын нұсқауларды пайдалан. 👇",
          },
        ]);
      }
    }
  }, [user?.id]);

  // Save history to localStorage whenever messages change
  useEffect(() => {
    if (typeof window !== "undefined" && messages.length > 0) {
      const key = user?.id ? `${STORAGE_KEY}-${user.id}` : `${STORAGE_KEY}-guest`;
      localStorage.setItem(key, JSON.stringify(messages.slice(-50)));
    }
  }, [messages, user?.id]);

  const sendMessage = async (textRaw: string) => {
    const text = textRaw.trim();
    if (!text || loading || !token) return;

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
      const { data } = await api.post<{ response: string }>("/ai/chat", { message: text }, { params: { lang } });
      setMessages((m) => [...m, { role: "bot", text: data.response }]);
      queryClient.invalidateQueries({ queryKey: ["ai-daily-limit"] });
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.detail || t("aiError");
      setMessages((m) => [...m, { role: "bot", text: errorMessage }]);
    } finally {
      setLoading(false);
    }
  };

  const send = () => void sendMessage(input);

  const sendPreset = (preset: string) => {
    setSuggestionsOpen(false);
    setInput(preset);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      const textLength = preset.length;
      inputRef.current?.setSelectionRange(textLength, textLength);
    });
  };

  if (!token) return null;

  return (
    <div className={`transition-opacity duration-300 ${mobileOpen ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="fixed bottom-[88px] sm:bottom-6 right-4 sm:right-6 w-12 h-12 sm:w-14 sm:h-14 rounded-full text-white shadow-xl flex items-center justify-center z-[50] transition-all active:scale-90 hover:scale-105 active-tap pb-safe"
        style={{ background: "var(--qit-gradient-1)" }}
      >
        <Bot className="w-6 h-6 sm:w-7 sm:h-7" />
      </button>
      {open && (
        <div
          ref={panelRef}
          className={`fixed z-[50] flex flex-col overflow-hidden border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800 ${
            isMobileViewport
              ? "left-2 right-2 bottom-[90px] rounded-2xl max-w-none w-auto min-h-[18rem] h-[min(70dvh,42rem)] max-h-[calc(100dvh-6.5rem)]"
              : "bottom-[150px] right-4 md:bottom-24 md:right-6 rounded-xl min-w-[18rem] max-w-[calc(100vw-1rem)] min-h-[20rem] max-h-[min(90vh,calc(100vh-7rem))] w-[min(34rem,calc(100vw-2rem))] h-[min(75vh,40rem)] md:min-w-[22rem] md:w-[min(36rem,calc(100vw-2rem))] md:h-[min(78vh,42rem)]"
          }`}
          style={
            !isMobileViewport && panelPx
              ? {
                  width: panelPx.w,
                  height: panelPx.h,
                  maxWidth: "min(calc(100vw - 1rem), 100%)",
                  maxHeight: "min(90vh, calc(100vh - 7rem))",
                }
              : undefined
          }
        >
          {!isMobileViewport && (
            <button
              type="button"
              aria-label={t("aiChatResizePanel")}
              title={t("aiChatResizePanel")}
              className="absolute left-0 top-0 z-30 flex h-10 w-10 cursor-nwse-resize items-start justify-start rounded-tl-xl border-0 bg-transparent p-2 text-white/80 outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-white/70"
              onPointerDown={onResizePointerDown}
              onPointerMove={onResizePointerMove}
              onPointerUp={endResize}
              onPointerCancel={endResize}
              onLostPointerCapture={() => {
                if (resizeSessionRef.current) {
                  resizeSessionRef.current = null;
                  persistPanelSize();
                }
              }}
            >
              <CornerUpLeft className="pointer-events-none h-4 w-4 drop-shadow-sm" strokeWidth={2.25} />
            </button>
          )}
          <div className="flex items-center justify-between p-3 border-b dark:border-gray-700 text-white" style={{ background: "var(--qit-gradient-1)" }}>
            <div className="flex items-center gap-2 pl-7">
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
          <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto p-3 space-y-3">
            {messages.length === 0 && <p className="text-gray-500 text-sm">{t("chatWelcomeMessage")}</p>}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`w-fit max-w-[85%] min-w-0 rounded-lg px-3 py-2 text-[15px] sm:text-[16px] leading-relaxed shadow-sm break-words text-left ${msg.role === "user" ? "text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200"}`}
                  style={msg.role === "user" ? { background: "var(--qit-primary)" } : undefined}
                >
                  {msg.role === "user" ? (
                    msg.text
                  ) : (
                    <div className="markdown-content whitespace-pre-wrap [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          h1: ({ ...props }) => <h1 className="text-xl font-bold mb-4 mt-6 border-b pb-1 border-gray-200 dark:border-gray-700" {...props} />,
                          h2: ({ ...props }) => <h2 className="text-lg font-bold mb-3 mt-5 border-b pb-1 border-gray-200 dark:border-gray-700" {...props} />,
                          h3: ({ ...props }) => <h3 className="text-base font-bold mb-2 mt-4 text-[var(--qit-primary)] dark:text-[var(--qit-secondary)]" {...props} />,
                          h4: ({ ...props }) => <h4 className="text-sm font-bold mb-2 mt-3 uppercase tracking-wider text-gray-500" {...props} />,
                          ul: ({ ...props }) => <ul className="list-disc ml-5 mb-4 space-y-2 marker:text-[var(--qit-primary)]" {...props} />,
                          ol: ({ ...props }) => <ol className="list-decimal ml-5 mb-4 space-y-2 marker:text-[var(--qit-primary)]" {...props} />,
                          li: ({ ...props }) => <li className="pl-1" {...props} />,
                          p: ({ ...props }) => <p className="mb-4 last:mb-0 leading-relaxed" {...props} />,
                          code: ({ ...props }) => <code className="bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 rounded px-1.5 py-0.5 font-mono text-[0.9em] font-medium" {...props} />,
                          pre: ({ ...props }) => (
                            <pre className="bg-gray-900 text-gray-100 rounded-xl p-4 my-4 overflow-x-auto font-mono text-sm shadow-inner border border-gray-800" {...props} />
                          ),
                          strong: ({ ...props }) => <strong className="font-bold text-[var(--qit-primary)] dark:text-[var(--qit-secondary)]" {...props} />,
                          blockquote: ({ ...props }) => (
                            <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 py-1 my-3 italic text-gray-600 dark:text-gray-400" {...props} />
                          ),
                        }}
                      >
                        {msg.text}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="w-fit max-w-[85%] rounded-lg px-3 py-2 text-sm text-gray-500 bg-gray-100 dark:bg-gray-700">{t("aiAnswerLoading")}</div>
              </div>
            )}
            <div className="pt-1 border-t border-dashed border-gray-200/90 dark:border-gray-600/80 mt-2">
              <button
                type="button"
                onClick={() => setSuggestionsOpen((v) => !v)}
                aria-expanded={suggestionsOpen}
                id="ai-chat-suggestions-toggle"
                className="inline-flex w-full sm:w-auto items-center justify-center sm:justify-start gap-1 rounded-full border border-[var(--qit-primary)] bg-white dark:bg-gray-700 px-3 py-1.5 sm:px-2.5 sm:py-1 text-center sm:text-left text-[11px] sm:text-[12px] font-bold text-[var(--qit-primary)] dark:text-gray-200 shadow-sm transition-colors hover:bg-[var(--qit-primary)] hover:text-white dark:hover:text-white disabled:opacity-50"
                disabled={!isPremium && dailyLimit && !dailyLimit.is_allowed}
              >
                <span className="leading-tight">{t("aiChatWhatCanIAsk")}</span>
                <ChevronDown
                  className={`h-3 w-3 shrink-0 opacity-80 transition-transform ${suggestionsOpen ? "rotate-180" : ""}`}
                  aria-hidden
                />
              </button>
              {suggestionsOpen && (
                <div
                  className="mt-1.5 flex flex-wrap gap-1 pl-0 sm:pl-0.5"
                  role="group"
                  aria-labelledby="ai-chat-suggestions-toggle"
                >
                  {suggestionPool.slice(0, 6).map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => sendPreset(s)}
                      disabled={loading || (!isPremium && dailyLimit && !dailyLimit.is_allowed)}
                      className="max-w-[calc(100%-0.25rem)] text-left text-[11px] sm:text-[12px] leading-snug bg-white dark:bg-gray-700 hover:bg-[var(--qit-primary)] hover:text-white border border-[var(--qit-primary)]/90 dark:border-[var(--qit-primary)] rounded-full px-2 py-1 text-[var(--qit-primary)] dark:text-gray-200 transition-colors active:scale-[0.98] shadow-sm font-bold disabled:opacity-50 disabled:pointer-events-none"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="p-3 border-t dark:border-gray-700 flex gap-2">
            <input
              ref={inputRef}
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
              className="group relative inline-flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--qit-primary)]/60 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-md"
              style={{ background: "var(--qit-gradient-1)" }}
            >
              <span className="pointer-events-none absolute inset-0 rounded-xl bg-white/0 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-hover:bg-white/10" />
              <Send className="relative z-10 h-5 w-5 drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)]" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
