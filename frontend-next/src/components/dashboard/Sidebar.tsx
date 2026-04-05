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
  PanelLeftClose,
  ShoppingBag,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useQueryClient } from "@tanstack/react-query";
import { useNotifications } from "@/hooks/useNotifications";
import { useSidebar } from "@/context/SidebarContext";
import { useLanguage } from "@/context/LanguageContext";
import { useState, useEffect, useRef } from "react";
import { api } from "@/api/client";
import { getLocalizedNotificationText } from "@/lib/notificationText";

export function Sidebar() {
  const { user, logout, isAdmin, isTeacher } = useAuthStore();
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useLanguage();
  const { collapsed, toggle, width } = useSidebar();
  const { data: notifications = [], refetch } = useNotifications();
  const [notifOpen, setNotifOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!notifOpen) return;
    const close = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [notifOpen]);

  const unread = notifications.filter((n) => !n.is_read);

  const markRead = (notificationId: number, link?: string) => {
    api.put(`/notifications/${notificationId}/read`).then(() => {
      refetch();
      setNotifOpen(false);
      if (link) router.push(link);
    });
  };

  const navLinkClass = (href: string) => {
    const isActive = pathname === href || pathname.startsWith(href + "/");
    return `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
      isActive
        ? "bg-[var(--qit-primary)]/10 text-[var(--qit-primary)] dark:text-[var(--qit-secondary)] font-medium border-l-2 border-[var(--qit-primary)] dark:border-[var(--qit-secondary)]"
        : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"
    }`;
  };

  return (
    <aside
      className="fixed left-0 top-0 z-40 h-screen bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 shadow-lg flex flex-col transition-all duration-300 ease-in-out overflow-hidden"
      style={{ width }}
    >
      <div className="flex items-center justify-between h-16 px-3 shrink-0 border-b border-gray-100 dark:border-gray-700">
        <Link
          href="/app"
          className="flex items-center gap-2 text-[var(--qit-primary)] dark:text-[var(--qit-secondary)] overflow-hidden min-w-0 hover:opacity-90 transition-opacity"
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white font-bold text-sm shadow-md"
            style={{ background: "var(--qit-primary)" }}
          >
            Q
          </div>
          {!collapsed && (
            <span className="font-semibold text-lg whitespace-nowrap truncate">
              {t("platformName")}
            </span>
          )}
        </Link>
        <button
          type="button"
          onClick={toggle}
          className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 shrink-0"
          aria-label={collapsed ? t("openMenu") : t("closeMenu")}
        >
          {collapsed ? (
            <Menu className="w-5 h-5" />
          ) : (
            <PanelLeftClose className="w-5 h-5" />
          )}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        <Link href="/app/courses" className={navLinkClass("/app/courses")}>
          <BookOpen className="w-[22px] h-[22px] shrink-0" />
          {!collapsed && <span>{t("courses")}</span>}
        </Link>
        <Link href="/app/leaderboard" className={navLinkClass("/app/leaderboard")}>
          <Trophy className="w-[22px] h-[22px] shrink-0" />
          {!collapsed && <span>{t("rating")}</span>}
        </Link>
        <Link href="/app/tasks-calendar" className={navLinkClass("/app/tasks-calendar")}>
          <Calendar className="w-[22px] h-[22px] shrink-0" />
          {!collapsed && <span>{t("tasksCalendar")}</span>}
        </Link>
        <Link href="/app#ai-challenge" className={navLinkClass("/app")}>
          <Zap className="w-[22px] h-[22px] shrink-0" />
          {!collapsed && <span>{t("aiVsStudent")}</span>}
        </Link>
        <Link href="/app/shop" className={navLinkClass("/app/shop")}>
          <ShoppingBag className="w-[22px] h-[22px] shrink-0" />
          {!collapsed && <span>{t("shop")}</span>}
        </Link>
        {isTeacher() && (
          <Link href="/app/teacher" className={navLinkClass("/app/teacher")}>
            <Users className="w-[22px] h-[22px] shrink-0" />
            {!collapsed && <span>{t("teacher")}</span>}
          </Link>
        )}
        {(user?.role === "parent" || isAdmin()) && (
          <Link
            href="/app/parent-dashboard"
            className={navLinkClass("/app/parent-dashboard")}
          >
            <Baby className="w-[22px] h-[22px] shrink-0" />
            {!collapsed && <span>{t("parent")}</span>}
          </Link>
        )}
        {isAdmin() && (
          <Link href="/app/admin" className={navLinkClass("/app/admin")}>
            <LayoutDashboard className="w-[22px] h-[22px] shrink-0" />
            {!collapsed && <span>{t("admin")}</span>}
          </Link>
        )}
      </nav>

      <div className="border-t border-gray-100 dark:border-gray-700 py-3 px-2 space-y-1">
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setNotifOpen(!notifOpen)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all`}
            title={t("notifications")}
          >
            <div className="relative shrink-0">
              <Bell className="w-[22px] h-[22px]" />
              {unread.length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 text-xs bg-red-500 text-white rounded-full flex items-center justify-center">
                  {unread.length > 9 ? "9+" : unread.length}
                </span>
              )}
            </div>
            {!collapsed && <span>{t("notifications")}</span>}
          </button>
          {notifOpen && (
            <div
              className={`absolute bottom-full left-0 mb-1 w-80 bg-white dark:bg-gray-800 border dark:border-gray-600 rounded-xl shadow-xl z-50 max-h-80 overflow-auto ${
                collapsed ? "left-full ml-2" : ""
              }`}
            >
              {notifications.length === 0 ? (
                <p className="p-4 text-gray-500 dark:text-gray-400 text-sm">
                  {t("noNotifications")}
                </p>
              ) : (
                notifications.slice(0, 20).map((n) => {
                  const { title, message } = getLocalizedNotificationText(n, t);
                  return (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => markRead(n.id, n.link)}
                      className={`w-full text-left px-4 py-3 border-b dark:border-gray-600 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                        !n.is_read ? "bg-[var(--qit-primary)]/10" : ""
                      }`}
                    >
                      <p className="font-medium text-sm">{title}</p>
                      <p className="text-xs text-gray-600 truncate">{message}</p>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        <Link href="/app/profile" className={navLinkClass("/app/profile")}>
          <User className="w-[22px] h-[22px] shrink-0" />
          {!collapsed && (
            <span className="truncate">
              {user?.full_name || t("profile")}
            </span>
          )}
        </Link>

        <button
          type="button"
          onClick={() => {
            queryClient.clear();
            logout();
            router.push("/");
          }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-all"
          title={t("logout")}
        >
          <LogOut className="w-[22px] h-[22px] shrink-0" />
          {!collapsed && <span>{t("logout")}</span>}
        </button>
      </div>
    </aside>
  );
}
