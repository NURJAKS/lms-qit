"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, User, LogOut, ChevronDown, Globe, Sun, Moon } from "lucide-react";
import { SearchHeader } from "./SearchHeader";
import { useAuthStore } from "@/store/authStore";
import { useQueryClient } from "@tanstack/react-query";
import { useTheme } from "@/context/ThemeContext";
import { useState, useRef, useEffect } from "react";
import { useNotifications } from "@/hooks/useNotifications";
import { useLanguage } from "@/context/LanguageContext";
import { api } from "@/api/client";
import { getLocalizedNotificationText } from "@/lib/notificationText";

export function AppDashboardHeader() {
  const { user, logout } = useAuthStore();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { t, lang, setLang } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { data: notifications = [], refetch } = useNotifications();
  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const langRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!notifOpen) return;
    const close = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node))
        setNotifOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [notifOpen]);

  useEffect(() => {
    if (!userMenuOpen) return;
    const close = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node))
        setUserMenuOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [userMenuOpen]);

  useEffect(() => {
    if (!langOpen) return;
    const close = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node))
        setLangOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [langOpen]);

  const unread = notifications.filter((n) => !n.is_read);

  const markRead = (notificationId: number, link?: string) => {
    api.put(`/notifications/${notificationId}/read`).then(() => {
      refetch();
      setNotifOpen(false);
      if (link) router.push(link);
    });
  };

  const markAllRead = () => {
    api.post("/notifications/read-all").then(() => {
      refetch();
    });
  };

  return (
    <header className="hidden lg:block sticky top-0 z-30 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200/80 dark:border-gray-700">
      <div className="flex items-center justify-between h-14 px-4 lg:px-6">
        <SearchHeader />

        <div className="hidden lg:flex items-center gap-2">
          <div className="relative hidden sm:block" ref={langRef}>
            <button
              type="button"
              onClick={() => setLangOpen(!langOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/60 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-gray-700 transition-all text-sm font-medium shadow-sm border border-gray-200/50 dark:border-gray-700"
              title={t("language")}
            >
              <Globe className="w-4 h-4" />
              <span>{t(lang === "ru" ? "russian" : lang === "kk" ? "kazakh" : "english")}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${langOpen ? "rotate-180" : ""}`} />
            </button>
            {langOpen && (
              <div className="absolute right-0 top-full mt-1 py-1 w-36 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-xl z-50">
                {(["ru", "kk", "en"] as const).map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => {
                      setLang(l);
                      setLangOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-sm ${lang === l
                        ? "font-medium"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                      }`}
                    style={lang === l ? { color: "var(--qit-accent)" } : undefined}
                  >
                    {t(l === "ru" ? "russian" : l === "kk" ? "kazakh" : "english")}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-white/80 dark:hover:bg-gray-800 transition-colors hidden sm:flex"
            title={theme === "light" ? t("darkTheme") : t("lightTheme")}
          >
            {theme === "light" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </button>
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={() => setNotifOpen(!notifOpen)}
              className="p-2 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-white/80 dark:hover:bg-gray-800 transition-colors"
              title={t("notifications")}
            >
              <div className="relative">
                <Bell className="w-5 h-5" />
                {unread.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 text-xs text-white rounded-full flex items-center justify-center" style={{ background: "var(--qit-gradient-3)" }}>
                    {unread.length > 9 ? "9+" : unread.length}
                  </span>
                )}
              </div>
            </button>
            {notifOpen && (
              <div className="absolute right-0 top-full mt-1 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-2xl shadow-xl z-50 max-h-80 overflow-auto">
                <div className="p-3 border-b dark:border-gray-600 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{t("notifications")}</span>
                  {unread.length > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        markAllRead();
                      }}
                      className="text-xs font-semibold text-[var(--qit-primary)] dark:text-[var(--qit-secondary)] hover:underline"
                    >
                      {t("markAllAsRead")}
                    </button>
                  )}
                </div>
                {notifications.length === 0 ? (
                  <p className="p-4 text-gray-500 dark:text-gray-400 text-sm">{t("noNotifications")}</p>
                ) : (
                  notifications.slice(0, 20).map((n) => {
                    const { title, message } = getLocalizedNotificationText(n, t);
                    return (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => markRead(n.id, n.link)}
                        className={`w-full text-left px-4 py-3 border-b dark:border-gray-600 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                          !n.is_read ? "bg-[#ff4081]/5" : ""
                        }`}
                      >
                        <p className="font-medium text-sm text-gray-800 dark:text-gray-200">{title}</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{message}</p>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          <div className="relative" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-white/80 dark:hover:bg-gray-800 transition-colors"
            >
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-semibold text-sm shrink-0"
                style={{ background: "var(--qit-gradient-3)" }}
              >
                {(user?.full_name || "U")[0].toUpperCase()}
              </div>
              <span className="hidden md:inline text-sm font-medium text-gray-700 dark:text-gray-200">
                {user?.full_name || t("profile")}
              </span>
              <ChevronDown className={`hidden md:block w-4 h-4 text-gray-500 transition-transform ${userMenuOpen ? "rotate-180" : ""}`} />
            </button>
            {userMenuOpen && (
              <div className="absolute right-0 top-full mt-1 py-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-2xl shadow-xl z-50">
                <Link
                  href="/app/profile"
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-2 px-4 py-2.5 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors rounded-t-2xl"
                >
                  <User className="w-4 h-4" />
                  {t("profile")}
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    queryClient.clear();
                    logout();
                    router.push("/");
                    setUserMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors rounded-b-2xl"
                >
                  <LogOut className="w-4 h-4" />
                  {t("logout")}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
