"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { Search, User, Mail, Phone, ArrowRight, GraduationCap, Users, BookOpen, UserCircle, CheckCircle2 } from "lucide-react";
import { getGlassCardStyle, getInputStyle, getTextColors } from "@/utils/themeStyles";
import { BlurFade } from "@/components/ui/blur-fade";
import { getLocalizedCourseTitle } from "@/lib/courseUtils";

type CourseInfo = {
  id: number;
  title: string;
};

type ChildInfo = {
  id: number;
  full_name: string;
  email: string;
  courses?: CourseInfo[];
  group_name?: string | null;
  teacher_name?: string | null;
  courses_count?: number;
  completed_courses_count?: number;
};

type RelatedUserInfo = {
  id: number;
  full_name: string;
  email: string;
  role: string;
};

type UserRow = {
  id: number;
  email: string;
  full_name: string;
  role: string;
  phone?: string | null;
  city?: string | null;
  description?: string | null;
  photo_url?: string | null;
  children?: ChildInfo[];
  students?: RelatedUserInfo[];
  teachers_curators?: RelatedUserInfo[];
  groups?: string[];
};

interface PeopleListProps {
  role: "student" | "parent" | "teacher" | "curator";
}

export function PeopleList({ role }: PeopleListProps) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const isDark = theme === "dark";
  const glassStyle = getGlassCardStyle(theme);
  const inputStyle = getInputStyle(theme);
  const textColors = getTextColors(theme);

  const { data: users = [], isLoading, isError } = useQuery({
    queryKey: ["people-list", role, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams({ role });
      if (searchQuery.trim()) {
        params.append("search", searchQuery.trim());
      }
      // Включаем расширенную информацию о связях
      params.append("include_relations", "true");
      if (role === "parent") {
        params.append("include_children", "true");
      }
      const { data } = await api.get<UserRow[]>(`/admin/users?${params.toString()}`);
      return data;
    },
  });

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getAvatarGradient = (id: number) => {
    const gradients = [
      "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
      "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
      "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
      "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
      "linear-gradient(135deg, #30cfd0 0%, #330867 100%)",
      "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)",
      "linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)",
    ];
    return gradients[id % gradients.length];
  };

  const emptyMessage =
    role === "student"
      ? t("noStudentsFound")
      : role === "parent"
        ? t("noParentsFound")
        : role === "teacher"
          ? t("noTeachersFound")
          : t("noCuratorsFound");

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <BlurFade delay={0.1} duration={0.6} blur="8px" offset={20}>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: textColors.secondary }} />
          <input
            type="text"
            placeholder={t("searchPeople")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-xl border-0 transition-all backdrop-blur-sm"
            style={inputStyle}
          />
        </div>
      </BlurFade>

      {/* Error State */}
      {isError && (
        <BlurFade delay={0.1} duration={0.6} blur="8px" offset={20}>
          <div
            className="rounded-xl p-12 text-center border-red-500/20"
            style={{ ...glassStyle, border: "1px solid rgba(239, 68, 68, 0.2)" }}
          >
            <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center rounded-full bg-red-500/10">
              <User className="w-8 h-8 text-red-500" />
            </div>
            <p className="text-lg font-medium text-red-500">
              {t("errorLoadingPeople")}
            </p>
            <p className="text-sm mt-2" style={{ color: textColors.secondary }}>
              {t("checkPermissionsOrNetwork")}
            </p>
          </div>
        </BlurFade>
      )}

      {/* Loading State */}
      {isLoading && !isError && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <BlurFade key={i} delay={0.1 + i * 0.05} duration={0.4} blur="4px" offset={10}>
              <div
                className="rounded-xl p-6 animate-pulse"
                style={glassStyle}
              >
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-gray-300 dark:bg-gray-700" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-3/4" />
                    <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded w-1/2" />
                  </div>
                </div>
              </div>
            </BlurFade>
          ))}
        </div>
      )}

      {/* Users Grid */}
      {!isLoading && !isError && (
        <>
          {users.length === 0 ? (
            <BlurFade delay={0.2} duration={0.6} blur="8px" offset={20}>
              <div
                className="rounded-xl p-12 text-center"
                style={glassStyle}
              >
                <User className="w-16 h-16 mx-auto mb-4 opacity-50" style={{ color: textColors.secondary }} />
                <p className="text-lg font-medium" style={{ color: textColors.primary }}>
                  {emptyMessage}
                </p>
                {searchQuery.trim() && (
                  <p className="text-sm mt-2" style={{ color: textColors.secondary }}>
                    {t("tryDifferentSearch")}
                  </p>
                )}
              </div>
            </BlurFade>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {users.map((user, index) => (
                <BlurFade
                  key={`user-${user.id}-${index}`}
                  delay={0.15 + index * 0.05}
                  duration={0.6}
                  blur="8px"
                  offset={30}
                  direction="up"
                >
                  <Link
                    href={`/app/profile/${user.id}`}
                    className="group block"
                  >
                    <div
                      className="rounded-2xl p-5 sm:p-6 transition-all duration-300 hover:scale-[1.01] hover:shadow-xl relative overflow-hidden"
                      style={{
                        ...glassStyle,
                        cursor: "pointer",
                      }}
                    >
                      {/* Decorative gradient background */}
                      <div
                        className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-20 group-hover:opacity-30 transition-opacity"
                        style={{
                          background: getAvatarGradient(user.id),
                        }}
                      />
 
                      {/* Content */}
                      <div className="relative z-10 flex flex-col h-full">
                        <div className="flex items-start gap-4 mb-5">
                          {/* Avatar */}
                          {user.photo_url ? (
                            <img
                              src={user.photo_url}
                              alt={user.full_name}
                              className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover ring-2 ring-white/20 group-hover:ring-white/40 transition-all text-[0px]"
                            />
                          ) : (
                            <div
                              className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-lg group-hover:scale-105 transition-transform shrink-0"
                              style={{
                                background: getAvatarGradient(user.id),
                              }}
                            >
                              {getInitials(user.full_name || "U")}
                            </div>
                          )}
 
                          {/* Name */}
                          <div className="flex-1 min-w-0 pt-0.5">
                            <h3
                              className="font-bold text-base sm:text-lg mb-1 truncate group-hover:text-[#3B82F6] transition-colors leading-tight"
                              style={{ color: textColors.primary }}
                            >
                              {user.full_name || user.email || t("noName")}
                            </h3>
                            <div className="flex items-center gap-1.5 text-xs sm:text-sm" style={{ color: textColors.secondary }}>
                              <Mail className="w-3.5 h-3.5 shrink-0 opacity-60" />
                              <span className="truncate">{user.email}</span>
                            </div>
                          </div>
                        </div>
 
                        {/* Phone, City, Description */}
                        {(user.phone || user.city || user.description) && (
                          <div className="space-y-2 mb-5">
                            {user.phone && (
                              <div className="flex items-center gap-2 text-xs sm:text-sm" style={{ color: textColors.secondary }}>
                                <Phone className="w-3.5 h-3.5 shrink-0 opacity-60" />
                                <span>{user.phone}</span>
                              </div>
                            )}
                            {user.city && (
                              <div className="flex items-center gap-2 text-xs sm:text-sm" style={{ color: textColors.secondary }}>
                                <UserCircle className="w-3.5 h-3.5 shrink-0 opacity-60" />
                                <span>{user.city}</span>
                              </div>
                            )}
                            {user.description && (
                              <p className="text-xs line-clamp-2 mt-1 italic leading-relaxed opacity-80" style={{ color: textColors.secondary }}>
                                {user.description}
                              </p>
                            )}
                          </div>
                        )}
 
                        {/* Groups Section */}
                        {user.groups && user.groups.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-5 mt-auto">
                            {user.groups.slice(0, 5).map((group, gIdx) => (
                              <span
                                key={gIdx}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] sm:text-xs font-semibold"
                                style={{
                                  background: isDark ? "rgba(139, 92, 246, 0.15)" : "rgba(139, 92, 246, 0.08)",
                                  color: isDark ? "#A78BFA" : "#7C3AED",
                                }}
                              >
                                {group}
                              </span>
                            ))}
                            {user.groups.length > 5 && (
                              <span className="text-[10px] font-bold px-1.5 py-1" style={{ color: textColors.secondary }}>
                                +{user.groups.length - 5}
                              </span>
                            )}
                          </div>
                        )}
 
                        {/* Students Section (for Teachers/Curators) */}
                        {user.students && user.students.length > 0 && (
                          <div className="mb-5 pt-4 border-t" style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}>
                            <div className="flex items-center gap-2 mb-3">
                              <Users className="w-4 h-4 opacity-70" style={{ color: textColors.secondary }} />
                              <span className="text-xs sm:text-sm font-bold uppercase tracking-wider" style={{ color: textColors.primary }}>
                                {t("studentsLabel")} ({user.students.length})
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {user.students.slice(0, 6).map((s, sIdx) => (
                                <span key={`student-${s.id}-${sIdx}`} className="text-[10px] sm:text-xs px-2.5 py-1 rounded-lg bg-black/[0.03] dark:bg-white/5 font-medium border border-transparent hover:border-blue-500/20 transition-colors" style={{ color: textColors.secondary }}>
                                  {s.full_name}
                                </span>
                              ))}
                              {user.students.length > 6 && (
                                <span className="text-[10px] font-bold px-1.5 py-1" style={{ color: textColors.secondary }}>
                                  +{user.students.length - 6}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
 
                        {/* Teachers/Curators Section (for Students) */}
                        {user.teachers_curators && user.teachers_curators.length > 0 && (
                          <div className="mb-5 pt-4 border-t" style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}>
                            <div className="flex items-center gap-2 mb-3">
                              <UserCircle className="w-4 h-4 opacity-70" style={{ color: textColors.secondary }} />
                              <span className="text-xs sm:text-sm font-bold uppercase tracking-wider" style={{ color: textColors.primary }}>
                                {t("teachersLabel")}
                              </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {user.teachers_curators.map((t, tIdx) => (
                                <div key={`teacher-${t.id}-${tIdx}`} className="text-xs flex items-center justify-between p-2 rounded-lg bg-black/[0.02] dark:bg-white/[0.03]" style={{ color: textColors.secondary }}>
                                  <span className="font-bold truncate pr-2">{t.full_name}</span>
                                  <span className="opacity-50 text-[10px] shrink-0">{t.role}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
 
                        {/* Children Section - только для родителей */}
                        {role === "parent" && user.children && user.children.length > 0 && (
                          <div className="mb-5 pt-4 border-t" style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}>
                            <div className="flex items-center gap-2 mb-4">
                              <Users className="w-4 h-4 opacity-70" style={{ color: textColors.secondary }} />
                              <span className="text-xs sm:text-sm font-bold uppercase tracking-wider" style={{ color: textColors.primary }}>
                                {t("children")} ({user.children.length})
                              </span>
                            </div>
                            <div className="space-y-3">
                              {user.children.map((child, childIndex) => (
                                <div
                                  key={`child-${child.id}-${childIndex}`}
                                  className="rounded-xl p-3 border border-gray-100 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02]"
                                >
                                  <div className="flex items-start gap-2 mb-2">
                                    <GraduationCap className="w-4 h-4 shrink-0 mt-0.5 opacity-60" style={{ color: textColors.secondary }} />
                                    <div className="flex-1 min-w-0">
                                      <p className="font-bold text-sm hover:text-[#3B82F6] transition-colors truncate" style={{ color: textColors.primary }}>
                                        {child.full_name || child.email}
                                      </p>
                                      <p className="text-[10px] truncate mt-0.5 opacity-60" style={{ color: textColors.secondary }}>
                                        {child.email}
                                      </p>
                                    </div>
                                  </div>
                                  
                                  {/* Courses */}
                                  {child.courses && child.courses.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                      {child.courses.slice(0, 3).map((course, cIdx) => (
                                        <span
                                          key={`course-${course.id}-${cIdx}`}
                                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold"
                                          style={{
                                            background: isDark ? "rgba(59, 130, 246, 0.15)" : "rgba(59, 130, 246, 0.08)",
                                            color: isDark ? "#93C5FD" : "#3B82F6",
                                          }}
                                        >
                                          {getLocalizedCourseTitle({ title: course.title } as any, t)}
                                        </span>
                                      ))}
                                      {child.courses.length > 3 && (
                                        <span className="text-[10px] opacity-60" style={{ color: textColors.secondary }}>
                                          +{child.courses.length - 3}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
 
                        {/* No children message */}
                        {role === "parent" && (!user.children || user.children.length === 0) && (
                          <div className="mb-5 pt-4 border-t mt-auto" style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}>
                            <div className="flex items-center gap-2 text-sm opacity-60" style={{ color: textColors.secondary }}>
                              <Users className="w-4 h-4" />
                              <span>{t("noChildren")}</span>
                            </div>
                          </div>
                        )}
 
                        {/* View Profile Button */}
                        <div className="flex items-center justify-between pt-4 border-t mt-auto" style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}>
                          <span className="text-xs sm:text-sm font-bold uppercase tracking-tight" style={{ color: textColors.secondary }}>
                            {t("viewProfile")}
                          </span>
                          <div className="w-8 h-8 rounded-full flex items-center justify-center bg-black/[0.04] dark:bg-white/[0.04] group-hover:bg-blue-500/10 transition-colors">
                            <ArrowRight
                              className="w-4 h-4 transition-transform group-hover:translate-x-1"
                              style={{ color: isDark ? "#60A5FA" : "#3B82F6" }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                </BlurFade>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
