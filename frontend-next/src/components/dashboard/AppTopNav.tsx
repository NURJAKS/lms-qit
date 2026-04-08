"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpen,
  User,
  Trophy,
  Bell,
  LogOut,
  LayoutDashboard,
  Calendar,
  Users,
  Baby,
  Zap,
  Menu,
  ChevronDown,
  ShoppingBag,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useQueryClient } from "@tanstack/react-query";
import { useNotifications } from "@/hooks/useNotifications";
import { useLanguage } from "@/context/LanguageContext";
import { AppHeader } from "@/components/common/AppHeader";
import { useState, useEffect, useRef } from "react";
import { api } from "@/api/client";
import { getLocalizedNotificationText } from "@/lib/notificationText";
import { cn } from "@/lib/utils";

export function AppTopNav() {
  const { user, logout, isAdmin, isTeacher } = useAuthStore();
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const { t, lang } = useLanguage();
  const { data: notifications = [], refetch } = useNotifications();
  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

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

  const navLinkClass = (href: string) => {
    const isActive =
      href === "/app"
        ? pathname === "/app" || pathname === "/app/"
        : pathname === href || pathname.startsWith(href + "/");
    return `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? "bg-[var(--qit-primary)]/10 text-[var(--qit-primary)] dark:text-[var(--qit-secondary)]"
        : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"
    }`;
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link
            href="/app"
            className="flex items-center gap-2 text-[var(--qit-primary)] dark:text-[var(--qit-secondary)] hover:opacity-90 transition-opacity shrink-0"
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0 aspect-square"
              style={{ background: "var(--qit-gradient-1)" }}
            >
              Q
            </div>
            <span className="font-semibold text-lg hidden sm:inline">
              {t("platformName")}
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            <Link href="/app/courses" className={navLinkClass("/app/courses")}>
              <BookOpen className="w-4 h-4 shrink-0" />
              {t("courses")}
            </Link>
            <Link href="/app/leaderboard" className={navLinkClass("/app/leaderboard")}>
              <Trophy className="w-4 h-4 shrink-0" />
              {t("rating")}
            </Link>
            <Link href="/app/tasks-calendar" className={navLinkClass("/app/tasks-calendar")}>
              <Calendar className="w-4 h-4 shrink-0" />
              {t("tasksCalendar")}
            </Link>
            <Link href="/app#ai-challenge" className={navLinkClass("/app")}>
              <Zap className="w-4 h-4 shrink-0" />
              {t("aiVsStudent")}
            </Link>
            <Link href="/app/shop" className={navLinkClass("/app/shop")}>
              <ShoppingBag className="w-4 h-4 shrink-0" />
              {t("shop")}
            </Link>
            {isTeacher() && (
              <Link href="/app/teacher" className={navLinkClass("/app/teacher")}>
                <Users className="w-4 h-4 shrink-0" />
                {t("teacherDashboardSidebar")}
              </Link>
            )}
            {(user?.role === "parent" || isAdmin()) && (
              <Link
                href="/app/parent-dashboard"
                className={navLinkClass("/app/parent-dashboard")}
              >
                <Baby className="w-4 h-4 shrink-0" />
                {t("parent")}
              </Link>
            )}
            {isAdmin() && (
              <Link href="/app/admin" className={navLinkClass("/app/admin")}>
                <LayoutDashboard className="w-4 h-4 shrink-0" />
                {t("admin")}
              </Link>
            )}
          </nav>

          <div className="flex items-center gap-2">
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={() => setNotifOpen(!notifOpen)}
                className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title={t("notifications")}
              >
                <div className="relative">
                  <Bell className="w-5 h-5" />
                  {unread.length > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 text-xs bg-red-500 text-white rounded-full flex items-center justify-center">
                      {unread.length > 9 ? "9+" : unread.length}
                    </span>
                  )}
                </div>
              </button>
              {notifOpen && (
                <div className="absolute right-0 top-full mt-1 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-xl z-50 max-h-[32rem] flex flex-col">
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
                  <div className="overflow-y-auto flex-1">
                    {notifications.length === 0 ? (
                      <p className="p-4 text-gray-500 dark:text-gray-400 text-sm text-center">
                        {t("noNotifications")}
                      </p>
                    ) : (
                      notifications.slice(0, 50).map((n) => {
                        const { title, message } = getLocalizedNotificationText(n, t);
                        return (
                          <button
                            key={n.id}
                            type="button"
                            onClick={() => markRead(n.id, n.link)}
                            className={`w-full text-left px-4 py-3 border-b dark:border-gray-600 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                              !n.is_read ? "bg-[var(--qit-primary)]/5 border-l-2 border-l-[var(--qit-primary)]" : ""
                            }`}
                          >
                            <p className={cn("text-sm", !n.is_read ? "font-bold" : "font-medium text-gray-700 dark:text-gray-200")}>{title}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{message}</p>
                            <p className="text-[10px] text-gray-400 mt-1">
                              {new Date(n.created_at).toLocaleString(lang === "en" ? "en-US" : lang === "kk" ? "kk-KZ" : "ru-RU", {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit"
                              })}
                            </p>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            <AppHeader />

            {/* Mobile nav - hamburger on small screens */}
            <div className="md:hidden">
              <MobileNavMenu
                pathname={pathname}
                navLinkClass={navLinkClass}
                isTeacher={isTeacher}
                isAdmin={isAdmin}
                userRole={user?.role}
                t={t as (key: string) => string}
              />
            </div>

            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 px-2 md:px-3 py-2 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-[var(--qit-primary)]/20 dark:bg-[var(--qit-secondary)]/20 flex items-center justify-center text-[var(--qit-primary)] dark:text-[var(--qit-secondary)] font-semibold text-sm">
                  {(user?.full_name || "U")[0].toUpperCase()}
                </div>
                <span className="hidden lg:inline text-sm font-medium">
                  {user?.full_name || t("profile")}
                </span>
                <ChevronDown className={`hidden md:block w-4 h-4 transition-transform ${userMenuOpen ? "rotate-180" : ""}`} />
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-1 py-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-xl z-50">
                  <Link
                    href="/app/profile"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2.5 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
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
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    {t("logout")}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

function MobileNavMenu({
  pathname,
  navLinkClass,
  isTeacher,
  isAdmin,
  userRole,
  t,
}: {
  pathname: string;
  navLinkClass: (href: string) => string;
  isTeacher: () => boolean;
  isAdmin: () => boolean;
  userRole?: string;
  t: (key: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);

  const links: { href: string; icon: typeof BookOpen; label: string }[] = [
    ...(isTeacher() ? [] : [{ href: "/app/courses", icon: BookOpen, label: t("courses") }]),
    { href: "/app/leaderboard", icon: Trophy, label: t("rating") },
    { href: "/app/tasks-calendar", icon: Calendar, label: t("tasksCalendar") },
    { href: "/app", icon: Zap, label: t("aiVsStudent") },
    { href: "/app/shop", icon: ShoppingBag, label: t("shop") },
    ...(isTeacher() ? [{ href: "/app/teacher", icon: Users, label: t("teacherDashboardSidebar") }] : []),
    ...(userRole === "parent" || isAdmin() ? [{ href: "/app/parent-dashboard", icon: Baby, label: t("parent") }] : []),
    ...(isAdmin() ? [{ href: "/app/admin", icon: LayoutDashboard, label: t("admin") }] : []),
  ];

  return (
    <div ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
        aria-label="Menu"
      >
        <Menu className="w-6 h-6" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 py-2 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-xl z-50 flex flex-col gap-0.5">
          {links.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={`${navLinkClass(href)} w-full justify-start mx-2`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
