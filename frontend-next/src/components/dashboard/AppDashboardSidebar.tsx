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
  X,
  ListTodo,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useTheme } from "@/context/ThemeContext";
import { useSidebar } from "@/context/SidebarContext";
import { useNotifications } from "@/hooks/useNotifications";
import { useLanguage } from "@/context/LanguageContext";
import { useState, useEffect, useRef } from "react";
import { api } from "@/api/client";
import { getLocalizedNotificationText } from "@/lib/notificationText";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export function AppDashboardSidebar() {
  const { user, logout, isAdmin, isTeacher, canManageUsers } = useAuthStore();
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const { t, lang, setLang } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { collapsed, toggle, width, mobileOpen, setMobileOpen } = useSidebar();
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

  const navLinkClass = (href: string) => {
    const isActive =
      href === "/app"
        ? pathname === "/app" || pathname === "/app/"
        : href === "/app/teacher"
          ? pathname === "/app/teacher" || pathname === "/app/teacher/"
          : pathname === href || (href !== "/app" && pathname.startsWith(href + "/"));
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
        : href === "/app/teacher"
          ? pathname === "/app/teacher" || pathname === "/app/teacher/"
          : pathname === href || (href !== "/app" && pathname.startsWith(href + "/"));
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
            { href: "/courses", icon: Library, label: t("courseCatalog") },
            { href: "/app/analytics", icon: BarChart3, label: t("studentAnalytics") },
          ]),
          { href: "/app/ai-challenge/1", icon: Zap, label: t("aiVsStudent") },
          { href: "/app/shop", icon: ShoppingBag, label: t("shop") },
          { href: "/app/leaderboard", icon: Trophy, label: t("rating") },
          { href: "/app/community", icon: MessageCircle, label: t("communitySidebarLink") },
        ]
    : [{ href: "/app", icon: LayoutDashboard, label: t("dashboard") }];

  const extraLinksBeforeManager = isApproved
    ? isStudentWithoutGroup
      ? [
        { href: "/app/premium", icon: Sparkles, label: t("premiumTab"), isPremium: true },
      ]
      : [
        // Premium показывается только для студентов (не для учителей, директора, админа, куратора, родителя)
        ...(user?.role === "student" ? [{ href: "/app/premium", icon: Sparkles, label: t("premiumTab"), isPremium: true }] : []),
        ...(isTeacher() ? [{ href: "/app/teacher", icon: Users, label: t("teacher") }] : []),
        ...(isParent ? [] : isAdmin() ? [{ href: "/app/parent-dashboard", icon: Baby, label: t("parent") }] : []),
        ...(isAdmin() || isTeacher() || user?.role === "curator" ? [{ href: "/app/people", icon: Users, label: t("peopleList") }] : []),
        ...(user?.role === "curator" ? [
          { href: "/app/admin/courses", icon: BookOpen, label: t("adminNavCourses") },
          { href: "/app/admin/analytics", icon: BarChart3, label: t("adminNavAnalytics") },
        ] : []),
      ]
    : [];

  // Curator links are now merged into extraLinksBeforeManager
  const curatorLinks: any[] = [];

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

    
    const { data: teacherGroups = [] } = useQuery({
      queryKey: ["teacher-groups-sidebar"],
      queryFn: async () => {
        const res = await api.get("/teacher/groups");
        return res.data as { id: number; group_name: string }[];
      },
      enabled: isTeacher() && !compact,
    });
    
    return (
      <>
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1 min-h-0 custom-scrollbar">
          {/* User Profile Section for Mobile Drawer removed per request */}

          {mainLinks.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={`${navLinkClass(href)} ${compact ? "justify-center px-2" : "px-4"}`}
              style={navLinkStyle(href)}
              title={compact ? label : undefined}
            >
              <Icon className="w-5 h-5 shrink-0" />
              {!compact && <span className="text-sm font-semibold">{label}</span>}
            </Link>
          ))}

          {/* Teacher Courses Section */}
          {!compact && isTeacher() && (
            <div className={`pt-4 mt-4 border-t ${theme === "dark" ? "border-white/10" : "border-gray-100"}`}>
              <Link
                href="/app/teacher/courses"
                onClick={() => setMobileOpen(false)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 ${
                  pathname === "/app/teacher/courses"
                    ? "bg-gradient-to-r from-[#FF4181] to-[#B938EB] text-white font-semibold shadow-lg shadow-[#FF4181]/30"
                    : theme === "dark"
                      ? "text-white/70 hover:text-white hover:bg-white/10"
                      : "text-gray-700 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                <span className="text-sm font-semibold">{t("teacherCoursesTabHint")}</span>
                <BookOpen className="w-4 h-4 shrink-0" />
              </Link>
            </div>
          )}

          {/* Student: courses I take (same style as teacher) */}
          {!compact && user?.role === "student" && user?.has_group_access && (
            <div className={`pt-4 mt-4 border-t ${theme === "dark" ? "border-white/10" : "border-gray-100"}`}>
              <Link
                href="/app/courses"
                onClick={() => setMobileOpen(false)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 ${
                  pathname === "/app/courses" || pathname.startsWith("/app/courses/")
                    ? "bg-gradient-to-r from-[#FF4181] to-[#B938EB] text-white font-semibold shadow-lg shadow-[#FF4181]/30"
                    : theme === "dark"
                      ? "text-white/70 hover:text-white hover:bg-white/10"
                      : "text-gray-700 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                <span className="text-sm font-semibold">{t("studentCoursesTabHint")}</span>
                <BookOpen className="w-4 h-4 shrink-0" />
              </Link>
            </div>
          )}
          
          {extraLinksBeforeManager.length > 0 && (
            <div className={`pt-4 mt-4 border-t ${theme === "dark" ? "border-white/10" : "border-gray-100"}`}>
               {!compact && <p className="px-4 text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">{t("more")}</p>}
              {extraLinksBeforeManager.map(({ href, icon: Icon, label, isPremium }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={`${navLinkClass(href)} ${compact ? "justify-center px-2" : "px-4"}`}
                  style={navLinkStyle(href, isPremium)}
                  title={compact ? label : undefined}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  {!compact && <span className="text-sm font-semibold">{label}</span>}
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
        
        {/* Mobile Utility Sections */}
        {(!compact || mobileOpen) && (
          <div className="lg:hidden px-3 pb-6 space-y-4">
            <div className={`pt-4 border-t ${theme === "dark" ? "border-white/10" : "border-gray-100"}`}>
               <p className="px-4 text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                 {t("language")}
               </p>
               <div className="grid grid-cols-3 gap-1 px-2">
                 {(["ru", "kk", "en"] as const).map((l) => (
                   <button
                     key={l}
                     type="button"
                     onClick={() => setLang(l)}
                     className={`py-2 rounded-lg text-xs font-bold transition-all ${
                       lang === l
                         ? "bg-[var(--qit-primary)] text-white shadow-md shadow-[var(--qit-primary)]/20"
                         : "bg-gray-50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400"
                     }`}
                   >
                     {l.toUpperCase()}
                   </button>
                 ))}
               </div>
            </div>

            <div className="px-2">
              <button
                type="button"
                onClick={toggleTheme}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 text-gray-700 dark:text-gray-200 transition-all font-medium active-tap"
              >
                <div className="flex items-center gap-3">
                  {theme === "light" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                  <span className="text-sm">{theme === "light" ? t("darkTheme") : t("lightTheme")}</span>
                </div>
                <div className={`w-8 h-4 rounded-full relative transition-colors ${theme === "dark" ? "bg-[var(--qit-secondary)]" : "bg-gray-300"}`}>
                  <div className={`absolute top-1 w-2 h-2 rounded-full bg-white transition-all ${theme === "dark" ? "right-1" : "left-1"}`} />
                </div>
              </button>
            </div>

            <div className="px-2">
              <button
                type="button"
                onClick={() => {
                  queryClient.clear();
                  logout();
                  router.push("/");
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/10 font-bold text-sm active-tap"
              >
                <LogOut className="w-5 h-5" />
                <span>{t("logout")}</span>
              </button>
            </div>
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
            {!collapsed && <span className="whitespace-nowrap">{t("platformName")}</span>}
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

      {/* Mobile header - Simplified */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 h-16 flex items-center justify-between px-4 glass-nav">
        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 -ml-2 rounded-xl active-tap text-gray-700 dark:text-white bg-white/50 dark:bg-white/10"
          aria-label="Menu"
        >
          <Menu className="w-6 h-6" />
        </button>
        
        <Link href="/app" className="flex items-center gap-2 group">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-lg group-active:scale-95 transition-transform"
            style={{ background: "var(--qit-gradient-3)" }}
          >
            Q
          </div>
          <span className="font-bold text-gray-900 dark:text-white tracking-tight">
            {t("platformName")}
          </span>
        </Link>
        
        <div className="flex items-center">
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={() => setNotifOpen(!notifOpen)}
              className="p-2 -mr-2 rounded-xl active-tap text-gray-700 dark:text-white"
            >
              <div className="relative">
                <Bell className="w-6 h-6" />
                {unread.length > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 text-[10px] bg-red-500 text-white rounded-full flex items-center justify-center border-2 border-white dark:border-gray-900">
                    {unread.length > 9 ? "9+" : unread.length}
                  </span>
                )}
              </div>
            </button>
            {notifOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-2xl shadow-2xl z-50 max-h-96 overflow-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between sticky top-0 bg-inherit z-10">
                  <h3 className="font-bold text-sm">{t("notifications")}</h3>
                  {unread.length > 0 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-bold uppercase">
                      New
                    </span>
                  )}
                </div>
                {notifications.length === 0 ? (
                  <div className="p-8 text-center">
                    <Bell className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {t("noNotifications")}
                    </p>
                  </div>
                ) : (
                  notifications.slice(0, 15).map((n) => {
                    const { title, message } = getLocalizedNotificationText(n, t);
                    return (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => markRead(n.id, n.link)}
                        className={`w-full text-left px-4 py-3 border-b border-gray-100 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${!n.is_read ? "bg-[var(--qit-primary)]/5 dark:bg-[var(--qit-primary)]/10" : ""}`}
                      >
                        <p className="font-bold text-xs text-gray-900 dark:text-gray-200 mb-0.5">{title}</p>
                        <p className="text-[11px] text-gray-600 dark:text-gray-400 line-clamp-2 leading-relaxed">
                          {message}
                        </p>
                      </button>
                    );
                  })
                )}
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
        className={`lg:hidden fixed top-0 left-0 z-50 h-full w-[min(18rem,85vw)] flex flex-col transition-transform duration-300 shadow-xl ${mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        style={{ 
          background: theme === "dark" ? "#0B0F19" : "#FFFFFF",
          borderRight: theme === "dark" ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(0, 0, 0, 0.08)"
        }}
      >
        <div className="flex items-center justify-between h-16 px-5 border-b border-gray-100 dark:border-gray-800 min-w-0">
           <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-white font-bold text-xs" style={{ background: "var(--qit-gradient-3)" }}>Q</div>
              <span className="font-bold text-sm truncate">{t("platformName")}</span>
           </div>
          <button type="button" onClick={() => setMobileOpen(false)} className="p-2.5 -mr-2 rounded-xl active-tap text-gray-400 bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 shadow-sm">
            <X className="w-5 h-5" />
          </button>
        </div>
        <NavContent compact={false} />
      </aside>
    </>
  );
}
