"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  Library,
  Calendar,
  Settings,
  Menu,
  ChevronDown,
  Bell,
  User,
  LogOut,
  Trophy,
  ShoppingBag,
  Users,
  MessageCircle,
  Baby,
  Globe,
  Sun,
  Moon,
  PanelLeftClose,
  Sparkles,
  FileText,
  Activity,
  BarChart3,
  Star,
  Grid3x3,
  FileQuestion,
  ShieldCheck,
  ArrowRight,
  Zap,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useTheme } from "@/context/ThemeContext";
import { useSidebar } from "@/context/SidebarContext";
import { useNotifications } from "@/hooks/useNotifications";
import { useLanguage } from "@/context/LanguageContext";
import { useState, useEffect, useRef } from "react";
import { api } from "@/api/client";
import { getLocalizedNotificationText } from "@/lib/notificationText";

export function AppDashboardSidebar() {
  const { user, logout, isAdmin, isTeacher, canManageUsers } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const { t, lang, setLang } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { collapsed, toggle, width } = useSidebar();
  const { data: notifications = [], refetch } = useNotifications();
  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
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

  const navLinkClass = (href: string) => {
    const isActive =
      href === "/app"
        ? pathname === "/app" || pathname === "/app/"
        : pathname === href || pathname.startsWith(href + "/");
    if (isActive) {
      return "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-white font-medium";
    }
    return `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
      theme === "dark" 
        ? "text-white/70 hover:text-white hover:bg-white/10" 
        : "text-gray-700 hover:text-gray-900 hover:bg-gray-100"
    }`;
  };

  const navLinkStyle = (href: string, isPremiumLink?: boolean) => {
    const isActive =
      href === "/app"
        ? pathname === "/app" || pathname === "/app/"
        : pathname === href || pathname.startsWith(href + "/");
    if (!isActive) return undefined;
    if (isPremiumLink) {
      return { background: "linear-gradient(135deg, #FF4181 0%, #B938EB 100%)", boxShadow: "0 0 12px rgba(255, 65, 129, 0.4)" };
    }
    return { background: "linear-gradient(135deg, #FF4181 0%, #B938EB 100%)", boxShadow: "0 0 12px rgba(255, 65, 129, 0.3)" };
  };

  const isApproved = user?.is_approved !== false;
  const isParent = user?.role === "parent";
  const isStudentWithoutGroup = user?.role === "student" && !user?.has_group_access;

  const mainLinks = isApproved
    ? isParent
      ? [
          { href: "/app", icon: LayoutDashboard, label: t("dashboard") },
          { href: "/app/parent-rating", icon: Trophy, label: t("rating") },
        ]
      : isStudentWithoutGroup
        ? [{ href: "/app", icon: LayoutDashboard, label: t("dashboard") }]
        : [
          { href: "/app", icon: LayoutDashboard, label: t("dashboard") },
          ...(isTeacher() ? [] : [
            { href: "/app/courses", icon: BookOpen, label: t("myCourses") },
            { href: "/courses", icon: Library, label: t("courseCatalog") },
            { href: "/app/materials", icon: FileText, label: t("studentMaterials") },
          ]),
          { href: "/app/ai-challenge", icon: Zap, label: t("aiVsStudent") },
          { href: "/app/tasks-calendar", icon: Calendar, label: t("tasksCalendar") },
          { href: "/app/shop", icon: ShoppingBag, label: t("shop") },
          { href: "/app/leaderboard", icon: Trophy, label: t("rating") },
          { href: "/app/community", icon: MessageCircle, label: t("communitySidebarLink") },
        ]
    : [{ href: "/app", icon: LayoutDashboard, label: t("dashboard") }];

  const extraLinksBeforeManager = isApproved
    ? isStudentWithoutGroup
      ? [
        { href: "/app/premium", icon: Sparkles, label: t("premiumTab"), isPremium: true },
        { href: "/app/profile", icon: Settings, label: t("settings") },
      ]
      : [
        // Premium показывается только для студентов (не для учителей, директора, админа, куратора, родителя)
        ...(user?.role === "student" ? [{ href: "/app/premium", icon: Sparkles, label: t("premiumTab"), isPremium: true }] : []),
        { href: "/app/profile", icon: Settings, label: t("settings") },
        ...(isTeacher() ? [{ href: "/app/teacher", icon: Users, label: t("teacher") }] : []),
        ...(isParent ? [] : isAdmin() ? [{ href: "/app/parent-dashboard", icon: Baby, label: t("parent") }] : []),
        ...(isAdmin() || isTeacher() || user?.role === "curator" ? [{ href: "/app/people", icon: Users, label: t("peopleList") }] : []),
      ]
    : [{ href: "/app/profile", icon: Settings, label: t("settings") }];

  // Меню для куратора (ограниченный доступ)
  const curatorLinks = user?.role === "curator" ? [
    { href: "/app/admin/courses", icon: BookOpen, label: t("adminNavCourses") },
    { href: "/app/admin/courses/moderation", icon: ShieldCheck, label: t("adminNavModeration") },
    { href: "/app/admin/analytics", icon: BarChart3, label: t("adminNavAnalytics") },
  ] : [];

  // Меню для администраторов и директоров (полный доступ)
  const managerLinks = canManageUsers() ? [
    { href: "/app/admin/users", icon: Users, label: t("adminNavUsers") },
    { href: "/app/admin/courses", icon: BookOpen, label: t("adminNavCourses") },
    { href: "/app/admin/overview", icon: Activity, label: t("adminNavProcesses") },
    { href: "/app/admin/analytics", icon: BarChart3, label: t("adminNavAnalytics") },
    { href: "/app/admin/reviews", icon: Star, label: t("adminNavReviews") },
    { href: "/app/admin/shop", icon: ShoppingBag, label: t("adminShopPurchases") },
  ] : [];

  const NavContent = ({ compact = false }: { compact?: boolean }) => {
    const isManagerSectionActive = pathname.startsWith("/app/admin");
    
    return (
      <>
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1 min-h-0">
          {mainLinks.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={`${navLinkClass(href)} ${compact ? "justify-center px-2" : ""}`}
              style={navLinkStyle(href)}
              title={compact ? label : undefined}
            >
              <Icon className="w-5 h-5 shrink-0" />
              {!compact && <span>{label}</span>}
            </Link>
          ))}
          {extraLinksBeforeManager.length > 0 && (
            <div className={`pt-4 mt-4 border-t ${theme === "dark" ? "border-white/20" : "border-gray-200"}`}>
              {extraLinksBeforeManager.map(({ href, icon: Icon, label, isPremium }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={`${navLinkClass(href)} ${compact ? "justify-center px-2" : ""}`}
                  style={navLinkStyle(href, isPremium)}
                  title={compact ? label : undefined}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  {!compact && <span>{label}</span>}
                </Link>
              ))}
            </div>
          )}
          {curatorLinks.length > 0 && (
            <>
              <div className={`pt-4 mt-4 border-t ${theme === "dark" ? "border-white/20" : "border-gray-200"}`}></div>
              <div className="pt-4 px-3">
                <div className="flex items-center gap-3 mb-2">
                  <Grid3x3 className={`w-5 h-5 shrink-0 ${theme === "dark" ? "text-white" : "text-gray-700"}`} />
                  {!compact && <span className={`font-medium text-sm ${theme === "dark" ? "text-white" : "text-gray-700"}`}>{t("admin")}</span>}
                </div>
                <div className="space-y-1 mt-2">
                  {curatorLinks.map(({ href, icon: Icon, label }) => {
                    const isActive = pathname === href || pathname.startsWith(href + "/");
                    return (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                          isActive
                            ? "text-white font-medium"
                            : theme === "dark"
                              ? "text-white/70 hover:text-white hover:bg-white/10"
                              : "text-gray-700 hover:text-gray-900 hover:bg-gray-100"
                        } ${compact ? "justify-center px-2" : ""}`}
                        style={isActive ? { background: "linear-gradient(135deg, #FF4181 0%, #B938EB 100%)", boxShadow: "0 0 12px rgba(255, 65, 129, 0.3)" } : undefined}
                        title={compact ? label : undefined}
                      >
                        <Icon className="w-5 h-5 shrink-0" />
                        {!compact && <span>{label}</span>}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </>
          )}
          {managerLinks.length > 0 && (
            <>
              <div className={`pt-4 mt-4 border-t ${theme === "dark" ? "border-white/20" : "border-gray-200"}`}></div>
              <div className="pt-4 px-3">
                <div className="flex items-center gap-3 mb-2">
                  <Grid3x3 className={`w-5 h-5 shrink-0 ${theme === "dark" ? "text-white" : "text-gray-700"}`} />
                  {!compact && <span className={`font-medium text-sm ${theme === "dark" ? "text-white" : "text-gray-700"}`}>{t("admin")}</span>}
                </div>
                <div className="space-y-1 mt-2">
                  {managerLinks.map(({ href, icon: Icon, label }) => {
                    const isActive = pathname === href || pathname.startsWith(href + "/");
                    return (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                          isActive
                            ? "text-white font-medium"
                            : theme === "dark"
                              ? "text-white/70 hover:text-white hover:bg-white/10"
                              : "text-gray-700 hover:text-gray-900 hover:bg-gray-100"
                        } ${compact ? "justify-center px-2" : ""}`}
                        style={isActive ? { background: "linear-gradient(135deg, #FF4181 0%, #B938EB 100%)", boxShadow: "0 0 12px rgba(255, 65, 129, 0.3)" } : undefined}
                        title={compact ? label : undefined}
                      >
                        <Icon className="w-5 h-5 shrink-0" />
                        {!compact && <span>{label}</span>}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </nav>
        
        {/* Subscription Advertisement - только для студентов без премиум подписки */}
        {!compact && user?.role === "student" && user?.is_premium !== 1 && (
          <div className="px-3 pb-4 mt-auto">
            <Link
              href="/app/premium"
              className="group relative block rounded-xl overflow-hidden transition-all duration-300 hover:shadow-lg"
              style={{
                background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                border: "1px solid rgba(255, 255, 255, 0.2)",
              }}
            >
              {/* Decorative background pattern */}
              <div className="absolute inset-0 opacity-10">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white rounded-full blur-2xl" />
              </div>
              
              {/* Content */}
              <div className="relative p-5">
                {/* Icon */}
                <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center mb-3">
                  <Sparkles className="w-5 h-5 text-yellow-300" />
                </div>
                
                {/* Text */}
                <h4 className="text-white font-bold text-base mb-1.5">
                  {t("unlockFullVersion")}
                </h4>
                <p className="text-white/90 text-xs mb-4">
                  {t("moreMetrics")}
                </p>
                
                {/* CTA Button */}
                <button
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-black/20 hover:bg-black/30 backdrop-blur-sm text-white font-semibold text-xs transition-all duration-200 group-hover:gap-3"
                >
                  <span>{t("freeTrial")}</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </Link>
          </div>
        )}
      </>
    );
  };

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex fixed left-0 top-0 z-40 h-screen flex-col shrink-0 transition-all duration-300 ease-in-out overflow-hidden shadow-lg"
        style={{ 
          background: theme === "dark" ? "#0B0F19" : "#FFFFFF", 
          width: width,
          borderRight: theme === "dark" ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(0, 0, 0, 0.08)"
        }}
      >
        <div className={`flex items-center justify-between h-16 px-3 shrink-0 border-b min-w-0 ${theme === "dark" ? "border-white/10" : "border-gray-200"}`}>
          <button
            type="button"
            onClick={toggle}
            className={`flex items-center gap-2 font-semibold text-lg hover:opacity-90 transition-opacity w-full min-w-0 ${theme === "dark" ? "text-white" : "text-gray-900"}`}
            title={collapsed ? t("openMenu") : t("closeMenu")}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0 animate-[spin_3s_linear_infinite]"
              style={{ background: "var(--qit-gradient-3)" }}
            >
              Q
            </div>
            {!collapsed && <span className="truncate">{t("platformName")}</span>}
          </button>
          {!collapsed && (
            <button
              type="button"
              onClick={toggle}
              className={`p-2 rounded-lg shrink-0 ${
                theme === "dark"
                  ? "text-white/70 hover:text-white hover:bg-white/10"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              }`}
              title={t("closeMenu")}
              aria-label={t("closeMenu")}
            >
              <PanelLeftClose className="w-5 h-5" />
            </button>
          )}
        </div>
        <div className="flex-1 flex flex-col min-h-0">
          <NavContent compact={collapsed} />
        </div>
      </aside>

      {/* Mobile header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 h-16 flex items-center justify-between px-4 backdrop-blur-md" style={{ background: theme === "dark" ? "rgba(11, 15, 25, 0.95)" : "rgba(248, 250, 252, 0.95)", borderBottom: theme === "dark" ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(0, 0, 0, 0.08)" }}>
        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 rounded-lg hover:opacity-80"
          style={{ color: theme === "dark" ? "#FFFFFF" : "#0F172A" }}
          aria-label="Menu"
        >
          <Menu className="w-6 h-6" />
        </button>
        <Link href="/app" className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs animate-[spin_3s_linear_infinite]"
            style={{ background: "var(--qit-gradient-3)" }}
          >
            Q
          </div>
          <span className="font-semibold text-gray-800 dark:text-white">{t("platformName")}</span>
        </Link>
        <div className="flex items-center gap-1">
          <div className="relative" ref={langRef}>
            <button
              type="button"
              onClick={() => setLangOpen(!langOpen)}
              className="flex items-center gap-1 px-2 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs font-medium"
              title={t("language")}
            >
              <Globe className="w-4 h-4" />
              <span>{lang.toUpperCase()}</span>
            </button>
            {langOpen && (
              <div className="absolute right-0 top-full mt-1 py-1 w-36 rounded-xl shadow-xl z-50 backdrop-blur-xl" style={{ background: "rgba(26, 34, 56, 0.95)", backdropFilter: "blur(12px)", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
                {(["ru", "kk", "en"] as const).map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => { setLang(l); setLangOpen(false); }}
                    className={`w-full px-3 py-2 text-left text-sm ${lang === l ? "font-medium" : "hover:opacity-80"}`}
                    style={lang === l ? { color: "#8B5CF6" } : { color: "#94A3B8" }}
                  >
                    {t(l === "ru" ? "russian" : l === "kk" ? "kazakh" : "english")}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button type="button" onClick={toggleTheme} className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800" title={theme === "light" ? t("darkTheme") : t("lightTheme")}>
            {theme === "light" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </button>
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={() => setNotifOpen(!notifOpen)}
              className="p-2 rounded-lg text-gray-600 dark:text-gray-300"
            >
              <div className="relative">
                <Bell className="w-5 h-5" />
                {unread.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 text-xs bg-red-500 text-white rounded-full flex items-center justify-center">
                    {unread.length > 9 ? "9+" : unread.length}
                  </span>
                )}
              </div>
            </button>
            {notifOpen && (
              <div
                className="absolute right-0 top-full mt-1 w-72 rounded-xl shadow-xl z-50 max-h-64 overflow-auto backdrop-blur-xl"
                style={{ background: "rgba(26, 34, 56, 0.95)", backdropFilter: "blur(12px)", border: "1px solid rgba(255, 255, 255, 0.08)" }}
              >
                {notifications.length === 0 ? (
                  <p className="p-4 text-sm" style={{ color: "#94A3B8" }}>
                    {t("noNotifications")}
                  </p>
                ) : (
                  notifications.slice(0, 15).map((n) => {
                    const { title, message } = getLocalizedNotificationText(n, t);
                    return (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => markRead(n.id, n.link)}
                        className="w-full text-left px-4 py-3 last:border-0 hover:opacity-80"
                        style={{
                          borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
                          background: !n.is_read ? "rgba(139, 92, 246, 0.1)" : "transparent",
                        }}
                      >
                        <p className="font-medium text-sm text-white">{title}</p>
                        <p className="text-xs truncate" style={{ color: "#94A3B8" }}>
                          {message}
                        </p>
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
              className="flex items-center gap-2 p-2 rounded-lg"
            >
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold" style={{ background: "var(--qit-gradient-3)" }}>
                {(user?.full_name || "U")[0].toUpperCase()}
              </div>
              <ChevronDown className={`w-4 h-4 transition-transform ${userMenuOpen ? "rotate-180" : ""}`} />
            </button>
            {userMenuOpen && (
              <div className="absolute right-0 top-full mt-1 py-1 w-48 rounded-xl shadow-xl z-50 backdrop-blur-xl" style={{ background: "rgba(26, 34, 56, 0.95)", backdropFilter: "blur(12px)", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
                <Link href="/app/profile" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-4 py-2.5 hover:opacity-80 text-white">
                  <User className="w-4 h-4" />
                  {t("profile")}
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    router.push("/");
                    setUserMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <LogOut className="w-4 h-4" />
                  {t("logout")}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile overlay menu */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}
      <aside
        className={`lg:hidden fixed top-0 left-0 z-50 h-full w-72 flex flex-col transition-transform duration-300 shadow-xl ${mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        style={{ 
          background: theme === "dark" ? "#0B0F19" : "#FFFFFF",
          borderRight: theme === "dark" ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(0, 0, 0, 0.08)"
        }}
      >
        <div className="flex items-center justify-between h-16 px-4" style={{ borderBottom: theme === "dark" ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(0, 0, 0, 0.08)" }}>
          <span className="font-semibold" style={{ color: theme === "dark" ? "#FFFFFF" : "#0F172A" }}>{t("platformName")}</span>
          <button type="button" onClick={() => setMobileOpen(false)} className="p-2 hover:opacity-80" style={{ color: theme === "dark" ? "rgba(255, 255, 255, 0.7)" : "rgba(0, 0, 0, 0.6)" }}>
            ×
          </button>
        </div>
        <NavContent />
      </aside>
    </>
  );
}
