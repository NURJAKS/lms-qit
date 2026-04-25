"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import axios from "axios";
import { api } from "@/api/client";
import { useAuthStore } from "@/store/authStore";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "@/store/notificationStore";
import type { TranslationKey } from "@/i18n/translations";
import { getLocalizedCourseTitle } from "@/lib/courseUtils";
import {
  BookOpen, Award, Trophy, Star, ChevronRight, Users,
  Clock, CheckCircle, ArrowLeft, X, Camera
} from "lucide-react";
import { ProfilePreviewCard } from "@/components/profile/ProfilePreviewCard";
import { LeaderboardTopAchievementCard } from "@/components/profile/LeaderboardTopAchievementCard";
import { MagicCard } from "@/components/ui/magic-card";
import { BorderBeam } from "@/components/ui/border-beam";
import { AnimatedShinyText } from "@/components/ui/animated-shiny-text";
import { formatProfileStudyDuration } from "@/lib/profileFieldLabels";
import type { SafeProfilePreviewData } from "@/types/profiles";
import type { User } from "@/types";

/** Same path after re-upload → browser cache; bump forces reload. */
function avatarUrlWithBust(url: string | null | undefined, bust: number): string | undefined {
  if (!url?.trim()) return undefined;
  if (!bust) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}_avatar=${bust}`;
}

/** Stored values for User.kinship_degree (backend seed / User model). */
const PARENT_KINSHIP_VALUES = ["Отец", "Мать", "Опекун", "Другое"] as const;
/** Stored values for User.educational_process_role (backend). */
const PARENT_EDU_PROCESS_ROLES = ["Законный представитель", "Опекун"] as const;

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
  const [emailWork, setEmailWork] = useState("");
  const [phoneWork, setPhoneWork] = useState("");
  const [office, setOffice] = useState("");
  const [uploading, setUploading] = useState(false);
  const [avatarBust, setAvatarBust] = useState(0);
  /** Blob URL for instant UI while POST /users/me/photo completes (same disk path would otherwise stay cached). */
  const [avatarLocalPreview, setAvatarLocalPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (avatarLocalPreview) URL.revokeObjectURL(avatarLocalPreview);
    };
  }, [avatarLocalPreview]);

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
    mutationFn: async (payload: {
      user: Record<string, string | null>;
      student: Record<string, string | null> | null;
    }) => {
      await api.patch("/users/me", payload.user);
      if (payload.student) {
        await api.patch("/users/me/student-profile", payload.student);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile-self"] });
      toast.success(t("profileSaved"));
      setEditOpen(false);
    },
    onError: () => {
      toast.error(t("profileSaveError"));
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
        <Link href="/app" className="inline-flex items-center justify-center gap-2 text-[var(--qit-primary)] hover:underline">
          <ArrowLeft className="w-4 h-4 shrink-0" />
          {t("dashboardTitle")}
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
    setEmailWork(u.email_work ?? "");
    setPhoneWork(u.phone_work ?? "");
    setOffice(u.office ?? "");
    setEditOpen(true);
  };

  const showWorkContacts = ["parent", "teacher", "curator", "admin", "director"].includes(u.role);

  const saveEdit = () => {
    const userBody: Record<string, string | null> = {
      full_name: fullName.trim(),
      phone: phone.trim() || null,
      city: city.trim() || null,
      address: address.trim() || null,
      birth_date: birthDate || null,
      description: description.trim() || null,
    };
    if (u.role !== "student") {
      userBody.gender = gender.trim() || null;
    }
    if (showWorkContacts) {
      const ew = emailWork.trim();
      userBody.email_work = ew || null;
      userBody.phone_work = phoneWork.trim() || null;
      userBody.office = office.trim() || null;
    }
    if (u.role === "parent") {
      userBody.work_place = workPlace.trim() || null;
      userBody.kinship_degree = kinshipDegree.trim() || null;
      userBody.educational_process_role = educationalProcessRole.trim() || null;
      userBody.academic_degree = academicDegree.trim() || null;
    }
    const studentBody =
      u.role === "student"
        ? {
          gender: gender.trim() || "Мужской",
          nationality: nationality.trim() || "",
          country: country.trim() || "",
          postal_code: postalCode.trim() || "",
          phone_alternative: phoneAlternative.trim() || null,
        }
        : null;
    updateProfileMutation.mutate({ user: userBody, student: studentBody });
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setAvatarLocalPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return previewUrl;
    });
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { data: updatedUser } = await api.post<User>("/users/me/photo", formData);
      const newUrl = updatedUser?.photo_url;

      setAvatarBust((n) => n + 1);

      if (userId != null) {
        queryClient.setQueryData(["profile-self", userId], (prev: ProfilePublic | undefined) => {
          if (!prev) return prev;
          return {
            ...prev,
            profile: { ...prev.profile, ...(newUrl != null ? { photo_url: newUrl } : {}) },
          };
        });
      }

      const auth = useAuthStore.getState().user;
      if (auth && userId != null && auth.id === userId && newUrl != null) {
        useAuthStore.setState({ user: { ...auth, photo_url: newUrl } });
      }

      toast.success(t("profilePhotoSaved"));
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t("profilePhotoUploadFailed"));
    } finally {
      setUploading(false);
      setAvatarLocalPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      e.target.value = "";
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
                  <p className="text-xs text-[var(--qit-primary)] dark:text-[#00b0ff] mt-1">{t("parentViewProfileCta")}</p>
                </Link>
              )}
              {u.teacher && (
                <Link href={`/app/profile/${u.teacher.id}`} className="block p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700/70 transition-colors">
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t("profileTeacherCurator")}</p>
                  <p className="font-medium text-gray-800 dark:text-white">{u.teacher.full_name}</p>
                  <p className="text-xs text-[var(--qit-primary)] dark:text-[#00b0ff] mt-1">{t("parentViewProfileCta")}</p>
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
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
      {editOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-stretch sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-xl h-[100dvh] sm:h-auto sm:max-h-[min(90dvh,900px)] flex flex-col rounded-none sm:rounded-2xl bg-white dark:bg-gray-800 border-0 sm:border border-gray-200 dark:border-gray-700 shadow-xl overflow-hidden">
            <div className="shrink-0 flex items-center justify-between px-4 sm:px-6 pt-4 sm:pt-6 pb-3 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 pr-2">{t("profileEdit")}</h2>
              <button type="button" onClick={() => setEditOpen(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 shrink-0" aria-label={t("cancel")}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="shrink-0 px-4 sm:px-6 pt-4 pb-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/90 dark:bg-gray-900/50">
              <p className="text-center text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                {t("profileChangePhoto")}
              </p>
              <div className="flex flex-col items-center gap-2">
                <label
                  htmlFor="profile-avatar-upload"
                  className={`relative group block cursor-pointer rounded-full focus-within:ring-2 focus-within:ring-[var(--qit-primary)] focus-within:ring-offset-2 focus-within:ring-offset-gray-50 dark:focus-within:ring-offset-gray-900 ${uploading ? "pointer-events-none opacity-60" : ""}`}
                >
                  <input
                    id="profile-avatar-upload"
                    ref={fileInputRef}
                    type="file"
                    onChange={handlePhotoChange}
                    className="sr-only"
                    accept="image/*"
                    disabled={uploading}
                    aria-label={t("profileClickToChange")}
                  />
                  <div className="w-[7.25rem] h-[7.25rem] sm:w-28 sm:h-28 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center overflow-hidden border-[3px] border-white dark:border-gray-800 shadow-md ring-1 ring-gray-200/80 dark:ring-gray-600/80">
                    {avatarLocalPreview || u.photo_url ? (
                      <img
                        key={`${avatarLocalPreview ?? u.photo_url}-${avatarBust}`}
                        src={avatarLocalPreview ?? avatarUrlWithBust(u.photo_url, avatarBust)}
                        alt=""
                        className="w-full h-full object-cover pointer-events-none"
                      />
                    ) : (
                      <span className="text-gray-500 dark:text-gray-400 text-xs font-medium text-center px-3 pointer-events-none">
                        {uploading ? t("loading") : t("profileChangePhoto")}
                      </span>
                    )}
                  </div>
                  <div className="pointer-events-none absolute inset-0 rounded-full bg-black/45 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity flex items-center justify-center">
                    <Camera className="w-9 h-9 text-white drop-shadow-md" aria-hidden />
                  </div>
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center max-w-[260px] leading-snug">
                  {t("profileClickToChange")}
                </p>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-6 py-5 scroll-pt-2">
              <div className="space-y-6">
                {/* Section: Основная информация */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-1.5 h-6 rounded-full bg-[var(--qit-primary)]" />
                    <h3 className="font-bold text-gray-900 dark:text-white uppercase tracking-wider text-xs">
                      {t("profileBasicInfoSection")}
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
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 ml-1 uppercase tracking-tighter">{t("profileEmail")}</label>
                      <input value={u.email} readOnly className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-2.5 text-sm cursor-not-allowed text-gray-500" />
                    </div>
                  </div>
                </div>

                {/* Section: Контакты */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-2 text-blue-500">
                    <div className="w-1.5 h-6 rounded-full bg-blue-500" />
                    <h3 className="font-bold text-gray-900 dark:text-white uppercase tracking-wider text-xs">
                      {t("profileContactsSection")}
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 ml-1 uppercase tracking-tighter">{t("profilePhone")}</label>
                      <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t("profilePhone")} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm focus:ring-2 focus:ring-[var(--qit-primary)] transition-all" />
                    </div>
                    {u.role === "student" && (
                      <div className="flex flex-col gap-1.5 md:col-span-2">
                        <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 ml-1 uppercase tracking-tighter">{t("profilePhoneAlternative")}</label>
                        <input value={phoneAlternative} onChange={(e) => setPhoneAlternative(e.target.value)} placeholder={t("profilePhoneAlternative")} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm focus:ring-2 focus:ring-[var(--qit-primary)] transition-all" />
                      </div>
                    )}
                    {showWorkContacts && (
                      <>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 ml-1 uppercase tracking-tighter">{t("profileWorkEmail")}</label>
                          <input
                            type="email"
                            value={emailWork}
                            onChange={(e) => setEmailWork(e.target.value)}
                            placeholder={t("profileWorkEmail")}
                            autoComplete="email"
                            className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm focus:ring-2 focus:ring-[var(--qit-primary)] transition-all"
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 ml-1 uppercase tracking-tighter">{t("profileWorkPhone")}</label>
                          <input
                            value={phoneWork}
                            onChange={(e) => setPhoneWork(e.target.value)}
                            placeholder={t("profileWorkPhone")}
                            className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm focus:ring-2 focus:ring-[var(--qit-primary)] transition-all"
                          />
                        </div>
                        <div className="flex flex-col gap-1.5 md:col-span-2">
                          <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 ml-1 uppercase tracking-tighter">{t("profileOffice")}</label>
                          <input
                            value={office}
                            onChange={(e) => setOffice(e.target.value)}
                            placeholder={t("profileOffice")}
                            className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm focus:ring-2 focus:ring-[var(--qit-primary)] transition-all"
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Section: Местоположение */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-2 text-emerald-500">
                    <div className="w-1.5 h-6 rounded-full bg-emerald-500" />
                    <h3 className="font-bold text-gray-900 dark:text-white uppercase tracking-wider text-xs">
                      {t("profileLocationTitle")}
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {u.role === "student" && (
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 ml-1 uppercase tracking-tighter">{t("profileCountry")}</label>
                        <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder={t("profileCountry")} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm focus:ring-2 focus:ring-[var(--qit-primary)] transition-all" />
                      </div>
                    )}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 ml-1 uppercase tracking-tighter">{t("profileCity")}</label>
                      <input value={city} onChange={(e) => setCity(e.target.value)} placeholder={t("profileCity")} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm focus:ring-2 focus:ring-[var(--qit-primary)] transition-all" />
                    </div>
                    {u.role === "student" && (
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 ml-1 uppercase tracking-tighter">{t("profilePostalCode")}</label>
                        <input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder={t("profilePostalCode")} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm focus:ring-2 focus:ring-[var(--qit-primary)] transition-all" />
                      </div>
                    )}
                    <div className={`flex flex-col gap-1.5 ${u.role === "student" ? "" : "md:col-span-2"}`}>
                      <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 ml-1 uppercase tracking-tighter">{t("profileAddress")}</label>
                      <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder={t("profileAddress")} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm focus:ring-2 focus:ring-[var(--qit-primary)] transition-all" />
                    </div>
                  </div>
                </div>

                {u.role === "parent" && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-2 text-amber-500">
                      <div className="w-1.5 h-6 rounded-full bg-amber-500" />
                      <h3 className="font-bold text-gray-900 dark:text-white uppercase tracking-wider text-xs">
                        {t("profileParentData")}
                      </h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 ml-1 uppercase tracking-tighter">{t("profileWorkPlace")}</label>
                        <input value={workPlace} onChange={(e) => setWorkPlace(e.target.value)} placeholder={t("profileWorkPlace")} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm focus:ring-2 focus:ring-[var(--qit-primary)] transition-all" />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 ml-1 uppercase tracking-tighter">{t("profileKinshipDegree")}</label>
                        <select
                          value={kinshipDegree}
                          onChange={(e) => setKinshipDegree(e.target.value)}
                          className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm focus:ring-2 focus:ring-[var(--qit-primary)] transition-all"
                        >
                          <option value="">{t("profileValueEmpty")}</option>
                          {kinshipDegree &&
                            !PARENT_KINSHIP_VALUES.includes(kinshipDegree as (typeof PARENT_KINSHIP_VALUES)[number]) ? (
                            <option value={kinshipDegree}>{kinshipDegree}</option>
                          ) : null}
                          <option value="Отец">{t("kinshipFather")}</option>
                          <option value="Мать">{t("kinshipMother")}</option>
                          <option value="Опекун">{t("kinshipGuardian")}</option>
                          <option value="Другое">{t("kinshipOther")}</option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-1.5 md:col-span-2">
                        <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 ml-1 uppercase tracking-tighter">{t("profileEducationalProcessRole")}</label>
                        <select
                          value={educationalProcessRole}
                          onChange={(e) => setEducationalProcessRole(e.target.value)}
                          className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm focus:ring-2 focus:ring-[var(--qit-primary)] transition-all"
                        >
                          <option value="">{t("profileValueEmpty")}</option>
                          {educationalProcessRole &&
                            !PARENT_EDU_PROCESS_ROLES.includes(
                              educationalProcessRole as (typeof PARENT_EDU_PROCESS_ROLES)[number],
                            ) ? (
                            <option value={educationalProcessRole}>{educationalProcessRole}</option>
                          ) : null}
                          <option value="Законный представитель">{t("eduRoleLegalRepresentative")}</option>
                          <option value="Опекун">{t("eduRoleGuardian")}</option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-1.5 md:col-span-2">
                        <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 ml-1 uppercase tracking-tighter">{t("profileAcademicDegree")}</label>
                        <input value={academicDegree} onChange={(e) => setAcademicDegree(e.target.value)} placeholder={t("profileAcademicDegree")} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm focus:ring-2 focus:ring-[var(--qit-primary)] transition-all" />
                      </div>
                    </div>
                  </div>
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
            <ProfilePreviewCard
              profile={u}
              rank={userRank?.rank}
              photoCacheBust={avatarBust}
              localAvatarPreview={avatarLocalPreview}
            />
          </div>

          <div className="grid grid-cols-1 min-[360px]:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
            {[
              { icon: BookOpen, label: t("profileEnrolled"), count: enrollments.length, color: "var(--qit-primary)" },
              { icon: CheckCircle, label: t("profileCompleted"), count: completedCount, color: "#10b981" },
              { icon: Clock, label: t("profileStudyHours"), count: studyHoursStr, color: "#00b0ff" },
              { icon: Award, label: t("profileCertificates"), count: certificates.length, color: "#f59e0b" },
            ].map(({ icon: Icon, label, count, color }) => (
              <div key={label} className="bg-white dark:bg-gray-800 rounded-[20px] sm:rounded-[24px] border border-gray-100 dark:border-gray-700 p-3.5 sm:p-5 shadow-lg shadow-gray-200/20 dark:shadow-none hover:scale-[1.02] transition-transform duration-300 group min-w-0">
                <div className="flex flex-col xs:flex-row xs:items-center gap-2 xs:gap-3 mb-2 sm:mb-3 min-w-0">
                  <div className="p-1.5 sm:p-2 rounded-xl bg-gray-50 dark:bg-gray-700 group-hover:scale-110 transition-transform shrink-0 w-fit">
                    <Icon className="w-4 h-4 sm:w-5 sm:h-5" style={{ color }} />
                  </div>
                  <span className="text-[10px] sm:text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-tighter leading-tight break-words">{label}</span>
                </div>
                <p className="text-lg sm:text-2xl font-black text-gray-900 dark:text-white font-montserrat break-words">{count}</p>
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
                            {c.avg_test_score != null && `${t("profileMetaSeparator")}${c.avg_test_score}%`}
                            {c.certificate && `${t("profileMetaSeparator")}${t("profileCertificateShort")}`}
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
