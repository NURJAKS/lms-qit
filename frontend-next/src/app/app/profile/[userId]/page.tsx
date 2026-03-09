"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/api/client";
import { useAuthStore } from "@/store/authStore";
import { useLanguage } from "@/context/LanguageContext";
import type { TranslationKey } from "@/i18n/translations";
import { getLocalizedCourseTitle } from "@/lib/courseUtils";
import { User as UserIcon, BookOpen, Award, Trophy, Star, ChevronRight, Phone, Mail, MapPin, Users, GraduationCap, Clock, CheckCircle, ArrowLeft } from "lucide-react";

type CourseProgress = {
  course_id: number;
  course_title: string;
  progress_percent: number;
  topics_completed: number;
  total_topics: number;
  completed_topic_titles: string[];
  test_scores: number[];
  avg_test_score: number | null;
  certificate: { id: number; final_score: number | null; issued_at: string | null } | null;
  video_watched_seconds?: number;
};

type ProfilePublic = {
  profile: {
    id: number;
    email: string;
    full_name: string;
    role: string;
    photo_url: string | null;
    description: string | null;
    phone: string | null;
    birth_date: string | null;
    city: string | null;
    address: string | null;
    points?: number;
    parent?: { id: number; full_name: string; email: string };
    enrollments?: Array<{ course_id: number; course_title: string }>;
    teacher?: { id: number; full_name: string; email: string };
    children?: Array<{ id: number; full_name: string; email: string; role: string }>;
    groups?: Array<{ id: number; name: string }>;
    students_count?: number;
  };
  certificates: Array<{ id: number; course_title: string; certificate_url: string; final_score: number | null }>;
  progress_detail: { courses: CourseProgress[] };
  enrollments: Array<{ course_id: number }>;
};

export default function UserProfilePage() {
  const { t } = useLanguage();
  const params = useParams();
  const router = useRouter();
  const userId = Number(params.userId);
  const { user } = useAuthStore();
  const canManageUsers = useAuthStore((s) => s.canManageUsers());

  const { data, isLoading, error } = useQuery({
    queryKey: ["profile-public", userId],
    queryFn: async () => {
      const { data: res } = await api.get<ProfilePublic>(`/users/${userId}/profile-public`);
      return res;
    },
    enabled: !!userId && !Number.isNaN(userId) && user?.id !== userId,
  });

  const { data: leaderboard = [] } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: async () => {
      const { data: lb } = await api.get<Array<{ rank: number; user_id: number }>>("/analytics/leaderboard?limit=100");
      return lb;
    },
    enabled: !!userId && !!data,
  });

  useEffect(() => {
    if (user && userId === user.id) {
      router.replace("/app/profile");
    }
  }, [user, userId, router]);

  if (user && userId === user.id) return null;

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin w-10 h-10 border-2 border-[var(--qit-primary)] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 dark:text-gray-400 mb-4">{t("error")}</p>
        <Link href="/app/leaderboard" className="text-[var(--qit-primary)] hover:underline">
          ← {t("leaderboardTitle")}
        </Link>
      </div>
    );
  }

  const { profile, certificates, progress_detail } = data;
  const u = profile;
  const enrollments = data.enrollments ?? [];
  const completedCount = certificates.length;
  const totalStudySeconds = progress_detail?.courses?.reduce((s, c) => s + (c.video_watched_seconds ?? 0), 0) ?? 0;
  const studyHours = Math.floor(totalStudySeconds / 3600);
  const studyMins = Math.floor((totalStudySeconds % 3600) / 60);
  const studyHoursStr = studyHours > 0 ? `${studyHours}h${studyMins}` : studyMins > 0 ? `${studyMins}m` : "0";
  const overallProgress = progress_detail?.courses?.length
    ? Math.round(progress_detail.courses.reduce((s, c) => s + c.progress_percent, 0) / progress_detail.courses.length)
    : 0;
  const has100 = certificates.some((c) => c.final_score != null && c.final_score >= 100);
  const badges = [
    enrollments.length >= 1 && { icon: BookOpen, labelKey: "profileFirstCourse" as const, color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
    enrollments.length >= 5 && { icon: Star, labelKey: "profile5Courses" as const, color: "bg-[var(--qit-primary)]/10 text-[var(--qit-primary)] dark:bg-[var(--qit-primary)]/20 dark:text-[#00b0ff]" },
    certificates.length >= 1 && { icon: Award, labelKey: "profileCertHolder" as const, color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
    has100 && { icon: Trophy, labelKey: "profile100Test" as const, color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
  ].filter(Boolean) as Array<{ icon: typeof BookOpen; labelKey: TranslationKey; color: string }>;

  const userRank = leaderboard.find((r) => r.user_id === userId);

  const rightSidebar = (
    <aside className="lg:order-none order-last">
      <div className="lg:sticky lg:top-24 space-y-6">
        {u.role === "student" && (u.parent || u.teacher) && (
          <div className="bg-white dark:bg-gray-800 rounded-[20px] shadow-md border border-gray-200 dark:border-gray-700 p-5">
            <h2 className="font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
              <Users className="w-5 h-5" /> {t("profileContactInfo")}
            </h2>
            <div className="space-y-3">
              {u.parent && (
                <Link href={`/app/profile/${u.parent.id}`} className="block p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700/70 transition-colors">
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t("profileParent")}</p>
                  <p className="font-medium text-gray-800 dark:text-white">{u.parent.full_name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{u.parent.email}</p>
                  <p className="text-xs text-[var(--qit-primary)] dark:text-[#00b0ff] mt-1">{t("parentViewProfile")} →</p>
                </Link>
              )}
              {u.teacher && (
                <Link href={`/app/profile/${u.teacher.id}`} className="block p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700/70 transition-colors">
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t("profileTeacherCurator")}</p>
                  <p className="font-medium text-gray-800 dark:text-white">{u.teacher.full_name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{u.teacher.email}</p>
                  <p className="text-xs text-[var(--qit-primary)] dark:text-[#00b0ff] mt-1">{t("parentViewProfile")} →</p>
                </Link>
              )}
            </div>
          </div>
        )}
        <div className="bg-white dark:bg-gray-800 rounded-[20px] shadow-md border border-gray-200 dark:border-gray-700 p-5">
          <h2 className="font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" /> {t("profileStats")}
          </h2>
          <div className="space-y-3">
            {userRank && (
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500 shrink-0" />
                <span className="text-gray-600 dark:text-gray-400">{t("profileRankPlace")}: <strong className="text-gray-800 dark:text-white">{userRank.rank}</strong></span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Image src="/icons/coin.png" alt="coins" width={20} height={20} className="shrink-0" />
              <span className="text-gray-600 dark:text-gray-400">{t("profileCoins")}: <strong className="text-gray-800 dark:text-white">{u.points ?? 0}</strong></span>
            </div>
          </div>
        </div>
        {badges.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-[20px] shadow-md border border-gray-200 dark:border-gray-700 p-5">
            <h2 className="font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
              <Award className="w-5 h-5" /> {t("profileAchievements")}
            </h2>
            <div className="flex flex-wrap gap-2">
              {badges.map((b) => (
                <span key={b.labelKey} className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-sm font-medium ${b.color}`}>
                  <b.icon className="w-4 h-4" /> {t(b.labelKey)}
                </span>
              ))}
            </div>
          </div>
        )}
        {certificates.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-[20px] shadow-md border border-gray-200 dark:border-gray-700 p-5">
            <h2 className="font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
              <Award className="w-5 h-5" /> {t("profileCertificates")}
            </h2>
            <ul className="space-y-3">
              {certificates.map((c: any) => (
                <li key={c.id} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-sm text-gray-800 dark:text-white truncate">{getLocalizedCourseTitle({ title: c.course_title } as any, t)} {c.final_score != null && `(${c.final_score}%)`}</span>
                    {c.certificate_url && (
                      <a href={c.certificate_url} target="_blank" rel="noreferrer" className="text-[var(--qit-primary)] dark:text-[#00b0ff] hover:underline text-sm shrink-0">{t("profileView")}</a>
                    )}
                  </div>
                  {c.certificate_url && (
                    <a href={c.certificate_url} target="_blank" rel="noreferrer" className="block rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600">
                      <img src={c.certificate_url} alt={getLocalizedCourseTitle({ title: c.course_title } as any, t)} className="w-full h-auto max-h-40 object-contain" />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </aside>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 lg:gap-8">
      <div className="min-w-0">
        <div className="flex flex-wrap gap-4 mb-6">
          {canManageUsers && (
            <Link href="/app/admin/users" className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-[var(--qit-primary)]">
              <ArrowLeft className="w-4 h-4" /> {t("adminUsersTitle")}
            </Link>
          )}
          <Link href="/app/leaderboard" className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-[var(--qit-primary)]">
            <ArrowLeft className="w-4 h-4" /> {t("leaderboardTitle")}
          </Link>
        </div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">{t("profile")}</h1>
        <div className="bg-white dark:bg-gray-800 rounded-[20px] shadow-lg p-6 mb-6 border border-gray-200 dark:border-gray-700">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-28 h-28 rounded-2xl bg-[var(--qit-primary)]/10 flex items-center justify-center overflow-hidden shrink-0">
              {u.photo_url ? <img src={u.photo_url} alt="" className="w-full h-full object-cover" /> : <UserIcon className="w-14 h-14 text-[var(--qit-primary)] dark:text-[#00b0ff]" />}
            </div>
            <p className="font-semibold text-gray-800 dark:text-white text-xl mt-2">{u.full_name}</p>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 mt-2 text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1.5 text-sm">
                <Mail className="w-4 h-4 shrink-0" /> {u.email}
              </span>
              {u.phone && (
                <span className="flex items-center gap-1.5 text-sm">
                  <Phone className="w-4 h-4 shrink-0" /> {u.phone}
                </span>
              )}
              {(u as { city?: string }).city && (
                <span className="flex items-center gap-1.5 text-sm">
                  <MapPin className="w-4 h-4 shrink-0" /> {(u as { city?: string }).city}
                </span>
              )}
              <span className="text-sm capitalize">{u.role}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-[20px] border border-gray-200 dark:border-gray-600 p-4 shadow-sm">
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
                <BookOpen className="w-5 h-5" />
                <span className="text-sm font-medium">{t("profileEnrolled")}</span>
              </div>
              <p className="text-2xl font-bold text-gray-800 dark:text-white">{enrollments.length}</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-[20px] border border-gray-200 dark:border-gray-600 p-4 shadow-sm">
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span className="text-sm font-medium">{t("profileCompleted")}</span>
              </div>
              <p className="text-2xl font-bold text-gray-800 dark:text-white">{completedCount}</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-[20px] border border-gray-200 dark:border-gray-600 p-4 shadow-sm">
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
                <Clock className="w-5 h-5" />
                <span className="text-sm font-medium">{t("profileStudyHours")}</span>
              </div>
              <p className="text-2xl font-bold text-gray-800 dark:text-white">{studyHoursStr}</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-[20px] border border-gray-200 dark:border-gray-600 p-4 shadow-sm">
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
                <Award className="w-5 h-5 text-amber-500" />
                <span className="text-sm font-medium">{t("profileCertificates")}</span>
              </div>
              <p className="text-2xl font-bold text-gray-800 dark:text-white">{certificates.length}</p>
            </div>
          </div>

          {(progress_detail?.courses?.length ?? 0) > 0 && (
            <div className="grid lg:grid-cols-3 gap-6 mb-6">
              <div className="lg:col-span-1 bg-gray-50 dark:bg-gray-700/50 rounded-[20px] border border-gray-200 dark:border-gray-600 p-6 shadow-sm">
                <h2 className="font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                  <BookOpen className="w-5 h-5" /> {t("profileProgressGeneral")}
                </h2>
                <div className="flex flex-col items-center">
                  <div className="relative w-36 h-36">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-200 dark:text-gray-600" />
                      <circle
                        cx="18" cy="18" r="15.9"
                        fill="none" stroke="var(--qit-primary)" strokeWidth="2"
                        strokeDasharray={`${overallProgress} 100`}
                        strokeLinecap="round"
                        className="transition-all duration-500"
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-gray-800 dark:text-white">{overallProgress}%</span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{t("profileCourseProgress")}</p>
                </div>
              </div>
              <div className="lg:col-span-2 bg-gray-50 dark:bg-gray-700/50 rounded-[20px] border border-gray-200 dark:border-gray-600 p-6 shadow-sm">
                <h2 className="font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                  <BookOpen className="w-5 h-5" /> {t("profileCourseProgress")}
                </h2>
                <div className="space-y-4 max-h-64 overflow-y-auto">
                  {progress_detail!.courses.map((c) => (
                    <Link key={c.course_id} href={`/app/courses/${c.course_id}`} className="block">
                      <div className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 dark:text-white truncate">
                            {getLocalizedCourseTitle({ title: c.course_title } as any, t)}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {c.topics_completed}/{c.total_topics} {t("profileTopic")}
                            {c.avg_test_score != null && ` • ${c.avg_test_score}%`}
                            {c.certificate && ` • ✓`}
                          </p>
                          <div className="mt-1 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${c.progress_percent}%`, background: "var(--qit-primary)" }}
                            />
                          </div>
                        </div>
                        <span className="text-sm font-semibold text-gray-600 dark:text-gray-300 shrink-0 w-12 text-right">{c.progress_percent}%</span>
                        <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          )}

          {u.description && (
            <div className="pt-4 border-t border-gray-200 dark:border-gray-600">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("profileDescription")}</p>
              <p className="text-gray-600 dark:text-gray-400 text-sm">{u.description}</p>
            </div>
          )}
        </div>
      </div>
      {rightSidebar}
    </div>
  );
}
