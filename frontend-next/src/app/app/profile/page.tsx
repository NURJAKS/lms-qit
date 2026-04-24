"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useRef } from "react";
import axios from "axios";
import { api } from "@/api/client";
import { useAuthStore } from "@/store/authStore";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "@/store/notificationStore";
import type { TranslationKey } from "@/i18n/translations";
import { getLocalizedCourseTitle } from "@/lib/courseUtils";
import { 
  BookOpen, Award, Trophy, Star, ChevronRight, Users, 
  Clock, CheckCircle, ArrowLeft, X, Camera, User
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
  const [birthDate, setBirthDate] = useState("");
  const [description, setDescription] = useState("");
  const [gender, setGender] = useState("");
  const [nationality, setNationality] = useState("");
  const [country, setCountry] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [phoneAlternative, setPhoneAlternative] = useState("");
  const [tgEmail, setTgEmail] = useState("");
  const [school, setSchool] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setBirthDate(u.birth_date ?? "");
    setDescription(u.description ?? "");
    setGender(u.gender ?? "");
    setNationality(u.nationality ?? "");
    setCountry(u.country ?? "");
    setPostalCode(u.postal_code ?? "");
    setPhoneAlternative(u.phone_alternative ?? "");
    setTgEmail(u.tg_email ?? "");
    setSchool(u.school ?? "");
    setEditOpen(true);
  };

  const saveEdit = () => {
    const body: Record<string, string | null> = {
      full_name: fullName.trim(),
      phone: phone.trim() || null,
      city: city.trim() || null,
      address: address.trim() || null,
      birth_date: birthDate || null,
      description: description.trim() || null,
      gender: gender.trim() || null,
      nationality: nationality.trim() || null,
      country: country.trim() || null,
      postal_code: postalCode.trim() || null,
      phone_alternative: phoneAlternative.trim() || null,
    };
    if (u.role === "parent") {
      body.work_place = workPlace.trim() || null;
      body.kinship_degree = kinshipDegree.trim() || null;
      body.educational_process_role = educationalProcessRole.trim() || null;
      body.academic_degree = academicDegree.trim() || null;
    }
    updateProfileMutation.mutate(body);
  };
  
  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      await api.post("/users/me/photo", formData);
      queryClient.invalidateQueries({ queryKey: ["profile-self"] });
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t("profilePhotoUploadFailed"));
    } finally {
      setUploading(false);
    }
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
        <div className="fixed inset-0 z-50 bg-black/50 flex items-stretch sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-xl h-[100dvh] sm:h-auto sm:max-h-[min(90dvh,900px)] flex flex-col rounded-none sm:rounded-2xl bg-white dark:bg-gray-800 border-0 sm:border border-gray-200 dark:border-gray-700 shadow-xl overflow-hidden">
            <div className="shrink-0 flex items-center justify-between px-4 sm:px-6 pt-4 sm:pt-6 pb-3 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 pr-2">{t("profileEdit")}</h2>
              <button type="button" onClick={() => setEditOpen(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 shrink-0" aria-label={t("cancel")}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-6 py-4">
            <div className="flex flex-col items-center mb-6">
              <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                <div className="w-24 h-24 rounded-2xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center overflow-hidden border-2 border-dashed border-gray-300 dark:border-gray-600 group-hover:border-[var(--qit-primary)] transition-colors">
                  {u.photo_url ? (
                    <img src={u.photo_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-gray-400 text-sm text-center px-2">{uploading ? t("loading") : t("profileChangePhoto")}</span>
                  )}
                </div>
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center">
                  <span className="text-white text-xs font-medium">{t("profileChangePhoto")}</span>
                </div>
              </div>
              <input type="file" ref={fileInputRef} onChange={handlePhotoChange} className="hidden" accept="image/*" />
            </div>

              <input type="file" ref={fileInputRef} onChange={handlePhotoChange} className="hidden" accept="image/*" />
            </div>

            <div className="space-y-6">
              {/* Section: Основная информация */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1.5 h-6 rounded-full bg-[var(--qit-primary)]" />
                  <h3 className="font-bold text-gray-900 dark:text-white uppercase tracking-wider text-xs">
                    {t("profileMainInfo" as TranslationKey)}
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 ml-1 uppercase tracking-tighter">{t("profileFullName")}</label>
                    <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t("profileFullName")} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm focus:ring-2 focus:ring-[var(--qit-primary)] transition-all" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 ml-1 uppercase tracking-tighter">{t("profileBirthDate")}</label>
                    <input
                      type="date"
                      lang={lang === "kk" ? "kk" : lang === "en" ? "en" : "ru"}
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                      className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm focus:ring-2 focus:ring-[var(--qit-primary)] transition-all"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 ml-1 uppercase tracking-tighter">{t("profileGender")}</label>
                    <select value={gender} onChange={(e) => setGender(e.target.value)} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm focus:ring-2 focus:ring-[var(--qit-primary)] transition-all">
                      <option value="Мужской">{t("profileGenderMale")}</option>
                      <option value="Женский">{t("profileGenderFemale")}</option>
                      <option value="Другое">{t("profileGenderOther")}</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Section: Контакты */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2 text-blue-500">
                  <div className="w-1.5 h-6 rounded-full bg-blue-500" />
                  <h3 className="font-bold text-gray-900 dark:text-white uppercase tracking-wider text-xs">
                    {t("contacts" as TranslationKey)}
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 ml-1 uppercase tracking-tighter">{t("profilePhone")}</label>
                    <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t("profilePhone")} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm focus:ring-2 focus:ring-[var(--qit-primary)] transition-all" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 ml-1 uppercase tracking-tighter">{t("profilePhoneAlternative")}</label>
                    <input value={phoneAlternative} onChange={(e) => setPhoneAlternative(e.target.value)} placeholder={t("profilePhoneAlternative")} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm focus:ring-2 focus:ring-[var(--qit-primary)] transition-all" />
                  </div>
                </div>
              </div>

              {/* Section: Местоположение */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2 text-emerald-500">
                  <div className="w-1.5 h-6 rounded-full bg-emerald-500" />
                  <h3 className="font-bold text-gray-900 dark:text-white uppercase tracking-wider text-xs">
                    {t("location" as TranslationKey)}
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 ml-1 uppercase tracking-tighter">{t("profileCountry")}</label>
                    <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder={t("profileCountry")} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm focus:ring-2 focus:ring-[var(--qit-primary)] transition-all" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 ml-1 uppercase tracking-tighter">{t("profileCity")}</label>
                    <input value={city} onChange={(e) => setCity(e.target.value)} placeholder={t("city")} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm focus:ring-2 focus:ring-[var(--qit-primary)] transition-all" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 ml-1 uppercase tracking-tighter">{t("profilePostalCode")}</label>
                    <input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder={t("profilePostalCode")} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm focus:ring-2 focus:ring-[var(--qit-primary)] transition-all" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 ml-1 uppercase tracking-tighter">{t("profileAddress")}</label>
                    <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder={t("profileAddress")} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm focus:ring-2 focus:ring-[var(--qit-primary)] transition-all" />
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-center mb-6">
                <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  <div className="w-24 h-24 rounded-2xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center overflow-hidden border-2 border-dashed border-gray-300 dark:border-gray-600 group-hover:border-[var(--qit-primary)] transition-colors">
                    {u.photo_url ? (
                      <img src={u.photo_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-gray-400 text-sm text-center px-2">{uploading ? t("loading") : t("profileChangePhoto")}</span>
                    )}
                  </div>
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center">
                    <Camera className="w-8 h-8 text-white" />
                  </div>
                </div>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoChange} />
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{t("profileClickToChange")}</p>
              </div>

              <div className="space-y-8">
                <section className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--qit-primary)] flex items-center gap-2">
                    <User className="w-3.5 h-3.5" /> {t("profilePersonalInfo")}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 ml-1 uppercase tracking-tighter">{t("adminFullName")}</label>
                      <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t("adminFullName")} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm focus:ring-2 focus:ring-[var(--qit-primary)] transition-all" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 ml-1 uppercase tracking-tighter">{t("profileEmail")}</label>
                      <input value={u.email} disabled className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-2.5 text-sm cursor-not-allowed text-gray-500" />
                    </div>
                  </div>
                </section>

                <section className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--qit-primary)] flex items-center gap-2">
                    <User className="w-3.5 h-3.5" /> {t("profileContactInfo")}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 ml-1 uppercase tracking-tighter">{t("profilePhone")}</label>
                      <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7 (___) ___-__-__" className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm focus:ring-2 focus:ring-[var(--qit-primary)] transition-all" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 ml-1 uppercase tracking-tighter">{t("profileTgEmail")}</label>
                      <input value={tgEmail} onChange={(e) => setTgEmail(e.target.value)} placeholder="example@gmail.com" className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm focus:ring-2 focus:ring-[var(--qit-primary)] transition-all" />
                    </div>
                  </div>
                </section>

                <section className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--qit-primary)] flex items-center gap-2">
                    <User className="w-3.5 h-3.5" /> {t("profileLocationTitle")}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 ml-1 uppercase tracking-tighter">{t("profileCity")}</label>
                      <input value={city} onChange={(e) => setCity(e.target.value)} placeholder={t("profileCity")} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm focus:ring-2 focus:ring-[var(--qit-primary)] transition-all" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 ml-1 uppercase tracking-tighter">{t("profileSchool")}</label>
                      <input value={school} onChange={(e) => setSchool(e.target.value)} placeholder={t("profileSchool")} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm focus:ring-2 focus:ring-[var(--qit-primary)] transition-all" />
                    </div>
                  </div>
                </section>

                {u.role === "student" && (
                  <section className="space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--qit-primary)] flex items-center gap-2">
                      <User className="w-3.5 h-3.5" /> {t("profileParentData")}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 ml-1 uppercase tracking-tighter">{t("profileWorkPlace")}</label>
                        <input value={workPlace} onChange={(e) => setWorkPlace(e.target.value)} placeholder={t("profileWorkPlace")} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm focus:ring-2 focus:ring-[var(--qit-primary)] transition-all" />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 ml-1 uppercase tracking-tighter">{t("profileKinshipDegree")}</label>
                        <input value={kinshipDegree} onChange={(e) => setKinshipDegree(e.target.value)} placeholder={t("profileKinshipDegree")} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm focus:ring-2 focus:ring-[var(--qit-primary)] transition-all" />
                      </div>
                    </div>
                  </section>
                )}
              </div>
            </div>
            <div className="shrink-0 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 sm:px-6 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex flex-col-reverse sm:flex-row justify-end gap-2">
              <button type="button" onClick={() => setEditOpen(false)} className="w-full sm:w-auto px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium">
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={saveEdit}
                disabled={updateProfileMutation.isPending}
                className="w-full sm:w-auto px-4 py-2.5 rounded-lg text-white text-sm font-medium disabled:opacity-60"
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
            {[
              { icon: BookOpen, label: t("profileEnrolled"), count: enrollments.length, color: "var(--qit-primary)" },
              { icon: CheckCircle, label: t("profileCompleted"), count: completedCount, color: "#10b981" },
              { icon: Clock, label: t("profileStudyHours"), count: studyHoursStr, color: "#00b0ff" },
              { icon: Award, label: t("profileCertificates"), count: certificates.length, color: "#f59e0b" },
            ].map(({ icon: Icon, label, count, color }) => (
              <div key={label} className="bg-white dark:bg-gray-800 rounded-[24px] border border-gray-100 dark:border-gray-700 p-5 shadow-lg shadow-gray-200/20 dark:shadow-none hover:scale-[1.02] transition-transform duration-300 group">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-xl bg-gray-50 dark:bg-gray-700 group-hover:scale-110 transition-transform">
                    <Icon className="w-5 h-5" style={{ color }} />
                  </div>
                  <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-tighter">{label}</span>
                </div>
                <p className="text-2xl font-black text-gray-900 dark:text-white font-montserrat">{count}</p>
              </div>
            ))}
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
