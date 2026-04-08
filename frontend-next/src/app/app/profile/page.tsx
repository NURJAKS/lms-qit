"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import axios from "axios";
import { api } from "@/api/client";
import { useAuthStore } from "@/store/authStore";
import { useLanguage } from "@/context/LanguageContext";
import type { TranslationKey } from "@/i18n/translations";
import { getLocalizedCourseTitle } from "@/lib/courseUtils";
import { 
  BookOpen, Award, Trophy, Star, ChevronRight, Users, 
  Clock, CheckCircle, ArrowLeft, X
} from "lucide-react";
import { ProfilePreviewCard } from "@/components/profile/ProfilePreviewCard";
import { LeaderboardTopAchievementCard } from "@/components/profile/LeaderboardTopAchievementCard";
import { MagicCard } from "@/components/ui/magic-card";
import { BorderBeam } from "@/components/ui/border-beam";
import { AnimatedShinyText } from "@/components/ui/animated-shiny-text";
import { formatProfileStudyDuration } from "@/lib/profileFieldLabels";
import type { SafeProfilePreviewData } from "@/types/profiles";

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
  profile: SafeProfilePreviewData;
  certificates: Array<{ id: number; course_title: string; certificate_url: string; final_score: number | null }>;
  progress_detail: { courses: CourseProgress[] };
  enrollments: Array<{ course_id: number }>;
};

export default function MyProfilePage() {
  const { t, lang } = useLanguage();
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const canManageUsers = useAuthStore((s) => s.canManageUsers());
  const [editOpen, setEditOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [workPlace, setWorkPlace] = useState("");
  const [kinshipDegree, setKinshipDegree] = useState("");
  const [educationalProcessRole, setEducationalProcessRole] = useState("");
  const [academicDegree, setAcademicDegree] = useState("");

  const userId = user?.id;

  const {
    data,
    isPending,
    isError,
    error,
  } = useQuery({
    queryKey: ["profile-self", userId],
    queryFn: async () => {
      const { data: res } = await api.get<ProfilePublic>(`/users/${userId}/profile-public`);
      return res;
    },
    enabled: !!userId && !!token,
    retry: 1,
  });

  const { data: leaderboard = [] } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: async () => {
      const { data: lb } = await api.get<Array<{ rank: number; user_id: number }>>("/analytics/leaderboard?limit=100");
      return lb;
    },
    enabled: !!userId && !!data,
  });

  const { data: topHistory = [] } = useQuery({
    queryKey: ["top-history", userId],
    queryFn: async () => {
      const { data: th } = await api.get<Array<{ date: string; rank: number; amount: number }>>(`/analytics/leaderboard/${userId}/top-history`);
      return th;
    },
    enabled: !!userId && !!data,
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (body: Record<string, string | null>) => {
      const { data } = await api.patch("/users/me", body);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile-self"] });
      setEditOpen(false);
    },
  });

  if (!token) {
    router.replace("/login");
    return null;
  }

  if (isPending || !data) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin w-10 h-10 border-2 border-[var(--qit-primary)] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (isError) {
    const isTimeout =
      axios.isAxiosError(error) &&
      (error.code === "ECONNABORTED" ||
        (typeof error.message === "string" && error.message.toLowerCase().includes("timeout")));

    return (
      <div className="text-center py-12">
        <p className="text-gray-600 dark:text-gray-400 mb-4">{t("error")}</p>
        <Link href="/app" className="text-[var(--qit-primary)] hover:underline">
          ← {t("dashboardTitle")}
        </Link>
      </div>
    );
  }

  const { profile, certificates, progress_detail } = data;
  const u = profile;

  const openEdit = () => {
    setFullName(u.full_name ?? "");
    setPhone(u.phone ?? "");
    setCity(u.city ?? "");
    setAddress(u.address ?? "");
    setWorkPlace(u.work_place ?? "");
    setKinshipDegree(u.kinship_degree ?? "");
    setEducationalProcessRole(u.educational_process_role ?? "");
    setAcademicDegree(u.academic_degree ?? "");
    setEditOpen(true);
  };

  const saveEdit = () => {
    const body: Record<string, string | null> = {
      full_name: fullName.trim(),
      phone: phone.trim() || null,
      city: city.trim() || null,
      address: address.trim() || null,
    };
    if (u.role === "parent") {
      body.work_place = workPlace.trim() || null;
      body.kinship_degree = kinshipDegree.trim() || null;
      body.educational_process_role = educationalProcessRole.trim() || null;
      body.academic_degree = academicDegree.trim() || null;
    }
    updateProfileMutation.mutate(body);
  };
  const enrollments = data.enrollments ?? [];
  const completedCount = certificates.length;
  const totalStudySeconds = progress_detail?.courses?.reduce((s, c) => s + (c.video_watched_seconds ?? 0), 0) ?? 0;
  const studyHoursStr = formatProfileStudyDuration(totalStudySeconds, t);
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
                  <p className="text-xs text-[var(--qit-primary)] dark:text-[#00b0ff] mt-1">{t("parentViewProfile")} →</p>
                </Link>
              )}
              {u.teacher && (
                <Link href={`/app/profile/${u.teacher.id}`} className="block p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700/70 transition-colors">
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t("profileTeacherCurator")}</p>
                  <p className="font-medium text-gray-800 dark:text-white">{u.teacher.full_name}</p>
                  <p className="text-xs text-[var(--qit-primary)] dark:text-[#00b0ff] mt-1">{t("parentViewProfile")} →</p>
                </Link>
              )}
            </div>
          </div>
        )}
        {u.role === "student" && (
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
                <Image src="/icons/coin.png" alt={t("coinsAlt")} width={20} height={20} className="shrink-0" />
                <span className="text-gray-600 dark:text-gray-400">{t("profileCoins")}: <strong className="text-gray-800 dark:text-white">{u.points ?? 0}</strong></span>
              </div>
            </div>
          </div>
        )}
        {(badges.length > 0 || topHistory.length > 0) && (
          <MagicCard className="bg-white dark:bg-gray-800 rounded-[20px] shadow-md border border-gray-200 dark:border-gray-700 p-5 relative overflow-hidden text-card-foreground">
            <BorderBeam className="absolute inset-0" />
            <h2 className="font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2 relative z-10">
              <Award className="w-5 h-5" />
              <AnimatedShinyText className="text-base">{t("profileAchievements")}</AnimatedShinyText>
            </h2>
            <div className="flex flex-col gap-3 relative z-10">
              {topHistory.length > 0 && (
                <div className="flex flex-col gap-2">
                  {topHistory.slice(0, 5).map((h) => (
                    <LeaderboardTopAchievementCard
                      key={`${h.date}-${h.rank}`}
                      item={h}
                      lang={lang}
                      t={t}
                      fancy
                    />
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {badges.map((b) => (
                  <span key={b.labelKey} className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-sm font-medium ${b.color}`}>
                    <b.icon className="w-4 h-4" /> {t(b.labelKey)}
                  </span>
                ))}
              </div>
            </div>
          </MagicCard>
        )}
        {certificates.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-[20px] shadow-md border border-gray-200 dark:border-gray-700 p-5">
            <h2 className="font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
              <Award className="w-5 h-5" /> {t("profileCertificates")}
            </h2>
            <ul className="space-y-3">
              {certificates.map((c) => (
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {editOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t("profileEdit")}</h2>
              <button type="button" onClick={() => setEditOpen(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t("profileFullName")} className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm" />
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t("profilePhone")} className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm" />
              <input value={city} onChange={(e) => setCity(e.target.value)} placeholder={t("city")} className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm" />
              <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder={t("profileAddress")} className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm" />
              {u.role === "parent" && (
                <>
                  <input value={workPlace} onChange={(e) => setWorkPlace(e.target.value)} placeholder={t("profileWorkPlace")} className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm" />
                  <input value={kinshipDegree} onChange={(e) => setKinshipDegree(e.target.value)} placeholder={t("profileKinshipDegree")} className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm" />
                  <input value={educationalProcessRole} onChange={(e) => setEducationalProcessRole(e.target.value)} placeholder={t("profileEducationalProcessRole")} className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm md:col-span-2" />
                  <input value={academicDegree} onChange={(e) => setAcademicDegree(e.target.value)} placeholder={t("profileAcademicDegree")} className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm md:col-span-2" />
                </>
              )}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setEditOpen(false)} className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600">
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={saveEdit}
                disabled={updateProfileMutation.isPending}
                className="px-4 py-2 rounded-lg text-white disabled:opacity-60"
                style={{ background: "linear-gradient(135deg, #FF4181 0%, #B938EB 100%)" }}
              >
                {updateProfileMutation.isPending ? t("loading") : t("save")}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-4 mb-6">
            <Link href="/app" className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-[var(--qit-primary)]">
              <ArrowLeft className="w-4 h-4" /> {t("dashboardTitle")}
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">{t("profile")}</h1>
          <div className="mb-4">
            <button
              type="button"
              onClick={openEdit}
              className="inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium text-white"
              style={{ background: "linear-gradient(135deg, #FF4181 0%, #B938EB 100%)" }}
            >
              {t("profileEdit")}
            </button>
          </div>
          
          <div className="mb-6">
            <ProfilePreviewCard profile={u} rank={userRank?.rank} />
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
                <div className="space-y-4 max-h-64 overflow-y-auto pr-2">
                  {progress_detail!.courses.map((c) => (
                    <Link key={c.course_id} href={`/app/courses/${c.course_id}`} className="block">
                      <div className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
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
        </div>
        {rightSidebar}
      </div>
    </div>
  );
}
