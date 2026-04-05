"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import Image from "next/image";
import { api } from "@/api/client";
import { useAuthStore } from "@/store/authStore";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { getGlassCardStyle, getTextColors } from "@/utils/themeStyles";
import { formatDateLocalized } from "@/lib/dateUtils";
import { formatProfileStudyDuration } from "@/lib/profileFieldLabels";
import type { TranslationKey } from "@/i18n/translations";
import { getLocalizedCourseTitle, getLocalizedTopicTitle, COURSE_TITLE_KEYS } from "@/lib/courseUtils";
import { ProfilePreviewCard } from "@/components/profile/ProfilePreviewCard";
import { LeaderboardTopAchievementCard } from "@/components/profile/LeaderboardTopAchievementCard";
import type { SafeProfilePreviewData } from "@/types/profiles";
import {
  User as UserIcon,
  BookOpen,
  Award,
  Trophy,
  Star,
  Camera,
  ChevronRight,
  Phone,
  Mail,
  MapPin,
  Users,
  GraduationCap,
  Clock,
  CheckCircle,
  Crown,
  Medal,
  Flame,
  Calendar,
  Target,
  ChevronDown,
  ChevronUp,
  Lock,
  Download,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Activity,
  BarChart3,
  PieChart as PieChartIcon,
  ListTodo,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, AreaChart, Area, PieChart, Pie, Cell, Legend } from "recharts";
import { EmptyState } from "@/components/profile/EmptyState";
import type { User } from "@/types";
import { MagicCard } from "@/components/ui/magic-card";
import { AnimatedGradientText } from "@/components/ui/animated-gradient-text";
import { NumberTicker } from "@/components/ui/number-ticker";
import { Ripple } from "@/components/ui/ripple";
import { BorderBeam } from "@/components/ui/border-beam";
import { SparklesText } from "@/components/ui/sparkles-text";
import { AnimatedShinyText } from "@/components/ui/animated-shiny-text";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { DotPattern } from "@/components/ui/dot-pattern";
import { BlurFade } from "@/components/ui/blur-fade";
import { AnimatedCircularProgressBar } from "@/components/ui/animated-circular-progress-bar";
import { Lens } from "@/components/ui/lens";
import { ShineBorder } from "@/components/ui/shine-border";
import { InteractiveGridPattern } from "@/components/ui/interactive-grid-pattern";
import { FlickeringGrid } from "@/components/ui/flickering-grid";
import { AnimatedList } from "@/components/ui/animated-list";
import { RippleButton } from "@/components/ui/ripple-button";
import { Particles } from "@/components/ui/particles";
import { ScrollProgress } from "@/components/ui/scroll-progress";
import { RetroGrid } from "@/components/ui/retro-grid";
import { WarpBackground } from "@/components/ui/warp-background";
import { Confetti, ConfettiRef, useConfetti } from "@/components/ui/confetti";

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
  next_topic_id?: number | null;
  next_topic_title?: string | null;
};

type ProfileExtended = {
  id: number;
  email: string;
  full_name: string;
  role: string;
  photo_url: string | null;
  description: string | null;
  phone: string | null;
  birth_date: string | null;
  gender: string | null;
  identity_card: string | null;
  curated_courses?: string[] | null;
  consultation_schedule?: unknown | null;
  consultation_location?: string | null;
  can_view_performance?: boolean | null;
  can_message_students?: boolean | null;
  can_view_attendance?: boolean | null;
  can_call_parent_teacher_meetings?: boolean | null;
  can_create_group_announcements?: boolean | null;
  work_place: string | null;
  kinship_degree: string | null;
  educational_process_role: string | null;
  education: string | null;
  academic_degree: string | null;
  email_work: string | null;
  phone_work: string | null;
  office: string | null;
  reception_hours: string | null;
  employee_number: string | null;
  position: string | null;
  department: string | null;
  hire_date: string | null;
  employment_status: string | null;
  academic_interests: string | null;
  subjects_taught: string[] | null;
  student_counts: number[] | null;
  teaching_hours: string | null;
  status: string | null;
  interface_language: string | null;
  // Admin profile fields
  education_level?: string | null;
  email_personal?: string | null;
  system_role?: string | null;
  permissions?: string[] | null;
  areas_of_responsibility?: string[] | null;
  can_create_users?: boolean | null;
  can_delete_users?: boolean | null;
  can_edit_courses?: boolean | null;
  can_view_analytics?: boolean | null;
  can_configure_system?: boolean | null;
  city: string | null;
  address: string | null;
  parent_id: number | null;
  created_at: string | null;
  parent?: { id: number; full_name: string; email: string };
  enrollments?: Array<{ course_id: number; course_title: string }>;
  certificates?: Array<{ id: number; course_id: number; final_score: number | null }>;
  teacher?: { id: number; full_name: string; email: string };
  children?: Array<{ id: number; full_name: string; email: string; role: string }>;
  groups?: Array<{ id: number; name: string }>;
  students_count?: number;
};

type ScheduleItem = {
  id: number;
  course_id: number | null;
  topic_id: number | null;
  course_title: string | null;
  topic_title: string | null;
  scheduled_date: string;
  is_completed: boolean;
  notes: string | null;
};

type Goal = {
  id: number;
  goal_type: string;
  description: string | null;
  target_date: string | null;
  is_achieved: boolean;
};

type HeatmapDay = { date: string; count: number; minutes: number };

type CoinTx = {
  id: number;
  amount: number;
  reason: string;
  label: string;
  created_at: string | null;
};

type StudentProfileMerged = {
  id: number;
  email: string;
  full_name: string;
  photo_url: string | null;
  phone: string | null;
  birth_date: string | null;
  address: string | null;
  city: string | null;
  created_at: string | null;
  gender: string | null;
  nationality: string | null;
  identity_card: string | null;
  iin: string | null;
  phone_alternative: string | null;
  postal_code: string | null;
  country: string | null;
  student_id_card_number: string | null;
  specialty: string | null;
  course: number | null;
  group: string | null;
  study_form: string | null;
  admission_date: string | null;
  graduation_date_planned: string | null;
  status: string | null;
  interface_language: string | null;
  timezone: string | null;
  last_login: string | null;
};

const schema = z.object({
  full_name: z.string().min(1),
  description: z.string().optional(),
  photo_url: z.string().optional(),
  phone: z.string().optional(),
  birth_date: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  // Teacher fields
  gender: z.string().optional(),
  identity_card: z.string().optional(),
  iin_teacher: z.string().optional(),
  curated_courses_text: z.string().optional(),
  consultation_schedule_json: z.string().optional(),
  consultation_location: z.string().optional(),
  can_view_performance: z.coerce.boolean().optional(),
  can_message_students: z.coerce.boolean().optional(),
  can_view_attendance: z.coerce.boolean().optional(),
  can_call_parent_teacher_meetings: z.coerce.boolean().optional(),
  can_create_group_announcements: z.coerce.boolean().optional(),
  // Parent fields
  work_place: z.string().optional(),
  kinship_degree: z.string().optional(),
  educational_process_role: z.string().optional(),
  student_id: z.string().optional(),
  // Student fields
  nationality: z.string().optional(),
  iin: z.string().optional(),
  phone_alternative: z.string().optional(),
  postal_code: z.string().optional(),
  country: z.string().optional(),
  student_id_card_number: z.string().optional(),
  specialty: z.string().optional(),
  course: z.coerce.number().optional(),
  group: z.string().optional(),
  study_form: z.string().optional(),
  admission_date: z.string().optional(),
  graduation_date_planned: z.string().optional(),
  timezone: z.string().optional(),
  education: z.string().optional(),
  academic_degree: z.string().optional(),
  email_work: z.string().optional(),
  phone_work: z.string().optional(),
  office: z.string().optional(),
  reception_hours: z.string().optional(),
  employee_number: z.string().optional(),
  position: z.string().optional(),
  department: z.string().optional(),
  hire_date: z.string().optional(),
  employment_status: z.string().optional(),
  academic_interests: z.string().optional(),
  teaching_hours: z.string().optional(),
  status: z.string().optional(),
  interface_language: z.string().optional(),
  // Admin fields
  education_level: z.string().optional(),
  email_personal: z.string().optional(),
  system_role: z.string().optional(),
  permissions_text: z.string().optional(),
  areas_of_responsibility_text: z.string().optional(),
});

type Form = z.infer<typeof schema>;

export default function ProfilePage() {
  const { t, lang } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const glassStyle = getGlassCardStyle(theme);
  const textColors = getTextColors(theme);
  const { user, setAuth, token } = useAuthStore();
  const isAdmin = useAuthStore((s) => s.isAdmin());
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const saveSuccessTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "progress" | "edit">("overview");
  const [coinHistoryOpen, setCoinHistoryOpen] = useState(false);
  const [goalFormOpen, setGoalFormOpen] = useState(false);
  const [newGoalType, setNewGoalType] = useState("");
  const [newGoalDesc, setNewGoalDesc] = useState("");
  const [newGoalDate, setNewGoalDate] = useState("");
  const confettiRef = useRef<ConfettiRef>(null);
  const confetti = useConfetti();

  useEffect(() => {
    return () => {
      if (saveSuccessTimeoutRef.current) {
        clearTimeout(saveSuccessTimeoutRef.current);
      }
    };
  }, []);

  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data } = await api.get<User>("/users/me");
      return data;
    },
    staleTime: 0, // Всегда получаем свежие данные
    gcTime: 0, // Не кешируем данные
  });

  const profileExtQuery = useQuery({
    queryKey: ["profile-extended"],
    queryFn: async () => {
      const { data } = await api.get<ProfileExtended>("/users/me/profile-extended");
      return data;
    },
    staleTime: 0, // Всегда получаем свежие данные
    gcTime: 0, // Не кешируем данные
  });

  const me = meQuery.data;
  const profileExt = profileExtQuery.data;
  const refetch = meQuery.refetch;

  const { data: studentProfile, refetch: refetchStudentProfile } = useQuery({
    queryKey: ["student-profile"],
    queryFn: async () => {
      const { data } = await api.get<StudentProfileMerged>("/users/me/student-profile");
      return data;
    },
    enabled: profileExt?.role === "student",
    staleTime: 0,
    gcTime: 0,
  });
  const { data: enrollments = [] } = useQuery({
    queryKey: ["my-enrollments", user?.id],
    queryFn: async () => {
      const { data } = await api.get<unknown[]>("/courses/my/enrollments");
      return data;
    },
    enabled: user?.id != null,
  });
  const { data: certificates = [] } = useQuery({
    queryKey: ["my-certificates"],
    queryFn: async () => {
      const { data } = await api.get<Array<{ id: number; course_title: string; certificate_url: string; final_score: number | null }>>("/users/me/certificates");
      return data;
    },
  });
  const { data: leaderboard = [] } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: async () => {
      const { data } = await api.get<Array<{ rank: number; user_id: number; full_name: string; avg_score: number; courses_done: number }>>("/analytics/leaderboard?limit=100");
      return data;
    },
  });
  const { data: progressDetail } = useQuery({
    queryKey: ["my-progress-detail"],
    queryFn: async () => {
      const { data } = await api.get<{ courses: CourseProgress[] }>("/users/me/progress-detail");
      return data;
    },
  });
  const { data: streakData } = useQuery({
    queryKey: ["my-streak"],
    queryFn: async () => {
      const { data } = await api.get<{ streak: number }>("/users/me/streak");
      return data;
    },
  });
  const { data: scheduleItems = [] } = useQuery({
    queryKey: ["schedule-upcoming"],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const end = new Date();
      end.setDate(end.getDate() + 14);
      const endStr = end.toISOString().slice(0, 10);
      const { data } = await api.get<ScheduleItem[]>(`/schedule?from_date=${today}&to_date=${endStr}`);
      return data;
    },
  });
  const { data: heatmapData } = useQuery({
    queryKey: ["activity-heatmap"],
    queryFn: async () => {
      const { data } = await api.get<{ days: HeatmapDay[] }>("/users/me/activity-heatmap?days=14");
      return data;
    },
  });
  const { data: coinHistory = [] } = useQuery({
    queryKey: ["coin-history"],
    queryFn: async () => {
      const { data } = await api.get<CoinTx[]>("/users/me/coin-history?limit=10");
      return data;
    },
  });
  const { data: goals = [], refetch: refetchGoals } = useQuery({
    queryKey: ["goals"],
    queryFn: async () => {
      const { data } = await api.get<Goal[]>("/schedule/goals");
      return data;
    },
  });
  const { data: topHistory = [] } = useQuery({
    queryKey: ["top-history", me?.id ?? user?.id],
    queryFn: async () => {
      const currentId = me?.id ?? user?.id;
      if (!currentId) return [];
      const { data } = await api.get<Array<{ date: string; rank: number; amount: number }>>(`/analytics/leaderboard/${currentId}/top-history`);
      return data;
    },
    enabled: !!(me?.id ?? user?.id),
  });

  // Admin analytics queries
  const { data: adminOverview } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: async () => {
      const { data } = await api.get<{
        departments: Array<{ id: string; name: string; count: number; importance: string; description: string }>;
        total_users: number;
        total_courses: number;
      }>("/admin/overview");
      
      // Преобразуем departments в удобный формат
      const deptMap = new Map(data.departments.map(d => [d.id, d.count]));
      return {
        users_count: deptMap.get("users") ?? 0,
        courses_count: deptMap.get("courses") ?? 0,
        enrollments_count: deptMap.get("enrollments") ?? 0,
        progress_count: deptMap.get("progress") ?? 0,
        certificates_count: deptMap.get("certificates") ?? 0,
        groups_count: deptMap.get("groups") ?? 0,
        assignments_count: deptMap.get("assignments") ?? 0,
        activity_logs_count: deptMap.get("activity") ?? 0,
      };
    },
    enabled: isAdmin,
  });

  const { data: courseStats = [] } = useQuery({
    queryKey: ["analytics-course-stats"],
    queryFn: async () => {
      const { data } = await api.get<Array<{
        course_id: number;
        title?: string;
        enrollments: number;
        completed_topics: number;
        total_topics?: number;
      }>>("/analytics/course-stats");
      return data;
    },
    enabled: isAdmin,
  });

  const { data: completionsData } = useQuery({
    queryKey: ["analytics-completions", 30],
    queryFn: async () => {
      const { data } = await api.get<{ data: Array<{ date: string; count: number }> }>(
        "/analytics/completions-over-time?days=30"
      );
      return data;
    },
    enabled: isAdmin,
  });

  const { register, handleSubmit, reset, setValue, getValues, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema) as Resolver<Form>,
    defaultValues: { 
      full_name: "", 
      description: "", 
      photo_url: "", 
      phone: "", 
      birth_date: "", 
      city: "", 
      address: "",
      gender: "Мужской",
      identity_card: "",
      iin_teacher: "",
      curated_courses_text: "",
      consultation_schedule_json: "",
      consultation_location: "",
      can_view_performance: false,
      can_message_students: false,
      can_view_attendance: false,
      can_call_parent_teacher_meetings: false,
      can_create_group_announcements: false,
      nationality: "",
      iin: "",
      phone_alternative: "",
      postal_code: "",
      country: "",
      student_id_card_number: "",
      specialty: "",
      course: 1,
      group: "",
      study_form: "Очная",
      admission_date: "",
      graduation_date_planned: "",
      timezone: "UTC+6",
      education: "",
      academic_degree: "",
      email_work: "",
      phone_work: "",
      office: "",
      reception_hours: "",
      employee_number: "",
      position: "",
      department: "",
      hire_date: "",
      employment_status: "Штатный",
      academic_interests: "",
      teaching_hours: "",
      status: "Активный",
      interface_language: "Русский",
      work_place: "",
      kinship_degree: "",
      educational_process_role: "",
      student_id: "",
      education_level: "",
      email_personal: "",
      system_role: "Суперадминистратор",
      permissions_text: "",
      areas_of_responsibility_text: "",
    },
  });
  useEffect(() => {
    if (me) reset({
      full_name: me.full_name,
      description: me.description ?? "",
      photo_url: me.photo_url ?? "",
      phone: (me as any).phone ?? "",
      birth_date: (me as any).birth_date ?? "",
      city: (me as any).city ?? "",
      address: (me as any).address ?? "",
      gender: (profileExt?.role === "student" ? studentProfile?.gender : (me as any).gender) ?? "Мужской",
      identity_card: (profileExt?.role === "student" ? studentProfile?.identity_card : (me as any).identity_card) ?? "",
      iin_teacher: (me as any).iin ?? "",
      curated_courses_text: Array.isArray((profileExt as any)?.curated_courses) ? ((profileExt as any).curated_courses as string[]).join("\n") : "",
      consultation_schedule_json: (profileExt as any)?.consultation_schedule
        ? JSON.stringify((profileExt as any).consultation_schedule, null, 2)
        : "",
      consultation_location: (profileExt as any)?.consultation_location ?? "",
      can_view_performance: Boolean((profileExt as any)?.can_view_performance ?? false),
      can_message_students: Boolean((profileExt as any)?.can_message_students ?? false),
      can_view_attendance: Boolean((profileExt as any)?.can_view_attendance ?? false),
      can_call_parent_teacher_meetings: Boolean((profileExt as any)?.can_call_parent_teacher_meetings ?? false),
      can_create_group_announcements: Boolean((profileExt as any)?.can_create_group_announcements ?? false),
      nationality: studentProfile?.nationality ?? "",
      iin: (studentProfile as any)?.iin ?? "",
      phone_alternative: studentProfile?.phone_alternative ?? "",
      postal_code: studentProfile?.postal_code ?? "",
      country: studentProfile?.country ?? "",
      student_id_card_number: studentProfile?.student_id_card_number ?? "",
      specialty: studentProfile?.specialty ?? "",
      course: (studentProfile?.course ?? 1) as any,
      group: studentProfile?.group ?? "",
      study_form: studentProfile?.study_form ?? "Очная",
      admission_date: studentProfile?.admission_date ?? "",
      graduation_date_planned: studentProfile?.graduation_date_planned ?? "",
      timezone: studentProfile?.timezone ?? "UTC+6",
      education: (me as any).education ?? "",
      academic_degree: (me as any).academic_degree ?? "",
      email_work: (me as any).email_work ?? "",
      phone_work: (me as any).phone_work ?? "",
      office: (me as any).office ?? "",
      reception_hours: (me as any).reception_hours ?? "",
      employee_number: (me as any).employee_number ?? "",
      position: (me as any).position ?? "",
      department: (me as any).department ?? "",
      hire_date: (me as any).hire_date ?? "",
      employment_status: (me as any).employment_status ?? "Штатный",
      academic_interests: (me as any).academic_interests ?? "",
      teaching_hours: (me as any).teaching_hours ?? "",
      status: (me as any).status ?? "Активный",
      interface_language: (me as any).interface_language ?? "Русский",
      work_place: (me as any).work_place ?? "",
      kinship_degree: (me as any).kinship_degree ?? "",
      educational_process_role: (me as any).educational_process_role ?? "",
      student_id: profileExt?.role === "parent" ? String(profileExt.children?.[0]?.id ?? "") : "",
      education_level: (profileExt as any)?.education_level ?? "",
      email_personal: (profileExt as any)?.email_personal ?? "",
      system_role: (profileExt as any)?.system_role ?? "Суперадминистратор",
      permissions_text: Array.isArray((profileExt as any)?.permissions) ? ((profileExt as any).permissions as string[]).join("\n") : "",
      areas_of_responsibility_text: Array.isArray((profileExt as any)?.areas_of_responsibility)
        ? ((profileExt as any).areas_of_responsibility as string[]).join("\n")
        : "",
    });
  }, [me, reset, studentProfile, profileExt?.role, profileExt?.children]);

  const onSubmit = async (data: Form) => {
    setSaving(true);
    setSaveSuccessMessage(null);
    try {
      const parseList = (txt?: string) => {
        const raw = (txt ?? "").trim();
        if (!raw) return [];
        const items = raw
          .split(/\r?\n|,/g)
          .map((s) => s.trim())
          .filter(Boolean);
        return Array.from(new Set(items));
      };
      const safeParseJson = (txt?: string) => {
        const raw = (txt ?? "").trim();
        if (!raw) return undefined;
        try {
          return JSON.parse(raw) as unknown;
        } catch {
          return undefined;
        }
      };

      const payloadUser: Record<string, unknown> = {
        full_name: data.full_name,
        description: data.description || undefined,
        photo_url: data.photo_url || undefined,
        phone: data.phone || undefined,
        city: data.city || undefined,
        address: data.address || undefined,
      };
      if (data.birth_date) payloadUser.birth_date = data.birth_date;

      if (profileExt?.role === "teacher") {
        Object.assign(payloadUser, {
          gender: data.gender || undefined,
          identity_card: data.identity_card || undefined,
          iin: data.iin_teacher || undefined,
          education: data.education || undefined,
          academic_degree: data.academic_degree || undefined,
          email_work: data.email_work || undefined,
          phone_work: data.phone_work || undefined,
          office: data.office || undefined,
          reception_hours: data.reception_hours || undefined,
          employee_number: data.employee_number || undefined,
          position: data.position || undefined,
          department: data.department || undefined,
          hire_date: data.hire_date || undefined,
          employment_status: data.employment_status || undefined,
          academic_interests: data.academic_interests || undefined,
          teaching_hours: data.teaching_hours || undefined,
          status: data.status || undefined,
          interface_language: data.interface_language || undefined,
          email_personal: data.email_personal || undefined,
          curated_courses: parseList(data.curated_courses_text),
          consultation_schedule: safeParseJson(data.consultation_schedule_json),
          consultation_location: data.consultation_location || undefined,
          can_view_performance: Boolean(data.can_view_performance),
          can_message_students: Boolean(data.can_message_students),
          can_view_attendance: Boolean(data.can_view_attendance),
          can_call_parent_teacher_meetings: Boolean(data.can_call_parent_teacher_meetings),
          can_create_group_announcements: Boolean(data.can_create_group_announcements),
        });
      }
      if (profileExt?.role === "admin" || profileExt?.role === "director") {
        Object.assign(payloadUser, {
          gender: data.gender || undefined,
          identity_card: data.identity_card || undefined,
          education_level: data.education_level || undefined,
          email_work: data.email_work || undefined,
          email_personal: data.email_personal || undefined,
          phone_work: data.phone_work || undefined,
          office: data.office || undefined,
          employee_number: data.employee_number || undefined,
          position: data.position || undefined,
          department: data.department || undefined,
          hire_date: data.hire_date || undefined,
          status: data.status || undefined,
          interface_language: data.interface_language || undefined,
          system_role: data.system_role || undefined,
          permissions: parseList(data.permissions_text),
          areas_of_responsibility: parseList(data.areas_of_responsibility_text),
        });
      }
      if (profileExt?.role === "parent") {
        Object.assign(payloadUser, {
          gender: data.gender || undefined,
          identity_card: data.identity_card || undefined,
          email_work: data.email_work || undefined,
          phone_work: data.phone_work || undefined,
          position: data.position || undefined,
          work_place: data.work_place || undefined,
          kinship_degree: data.kinship_degree || undefined,
          educational_process_role: data.educational_process_role || undefined,
        });
      }

      await api.patch("/users/me", payloadUser);
      if (profileExt?.role === "student") {
        const payloadStudent: Record<string, unknown> = {
          gender: data.gender || undefined,
          nationality: data.nationality || undefined,
          identity_card: data.identity_card || undefined,
          iin: data.iin || undefined,
          phone_alternative: data.phone_alternative || undefined,
          postal_code: data.postal_code || undefined,
          country: data.country || undefined,
          student_id_card_number: data.student_id_card_number || undefined,
          specialty: data.specialty || undefined,
          course: data.course ?? undefined,
          group: data.group || undefined,
          study_form: data.study_form || undefined,
          admission_date: data.admission_date || undefined,
          graduation_date_planned: data.graduation_date_planned || undefined,
          status: data.status || undefined,
          interface_language: data.interface_language || undefined,
          timezone: data.timezone || undefined,
        };
        await api.patch("/users/me/student-profile", payloadStudent);
        queryClient.invalidateQueries({ queryKey: ["student-profile"] });
        refetchStudentProfile();
      }
      await refetch();
      queryClient.invalidateQueries({ queryKey: ["profile-extended"] });
      if (me && token) setAuth({ ...me, ...data }, token);
      setSaveSuccessMessage(t("profileSaved"));
      if (saveSuccessTimeoutRef.current) clearTimeout(saveSuccessTimeoutRef.current);
      saveSuccessTimeoutRef.current = setTimeout(() => {
        setSaveSuccessMessage(null);
      }, 3000);
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err && typeof (err as { response?: { data?: { detail?: string } } }).response?.data?.detail === "string"
          ? (err as { response: { data: { detail: string } } }).response.data.detail
          : t("profileSaveError");
      alert(msg);
    } finally {
      setSaving(false);
    }
  };

  const linkStudentToParent = async () => {
    if (profileExt?.role !== "parent") return;
    const raw = (getValues("student_id") || "").trim();
    const studentId = Number(raw);
    if (!raw || Number.isNaN(studentId) || studentId <= 0) {
      alert(t("profileInvalidStudentId"));
      return;
    }
    try {
      await api.patch("/users/me/parent-link", { student_id: studentId });
      queryClient.invalidateQueries({ queryKey: ["profile-extended"] });
      await profileExtQuery.refetch();
      setValue("student_id", String(studentId));
      alert(t("profileStudentLinked"));
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err && typeof (err as { response?: { data?: { detail?: string } } }).response?.data?.detail === "string"
          ? (err as { response: { data: { detail: string } } }).response.data.detail
          : t("profileSaveError");
      alert(msg);
    }
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert(t("profilePhotoError"));
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { data: updated } = await api.post<User>("/users/me/photo", formData);
      queryClient.invalidateQueries({ queryKey: ["me"] });
      refetch();
      if (me && token) setAuth({ ...me, photo_url: updated.photo_url }, token);
      alert(t("profilePhotoSaved"));
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "response" in err && typeof (err as { response?: { data?: { detail?: string } } }).response?.data?.detail === "string"
        ? (err as { response: { data: { detail: string } } }).response.data.detail
        : t("profileUploadError");
      alert(msg);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const toggleGoalAchieved = async (goalId: number, isAchieved: boolean) => {
    try {
      await api.patch(`/schedule/goals/${goalId}`, { is_achieved: !isAchieved });
      refetchGoals();
      if (!isAchieved && confetti) {
        confetti.fire({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
        });
      }
    } catch {
      alert(t("profileSaveError"));
    }
  };

  const addGoal = async () => {
    if (!newGoalType.trim()) return;
    try {
      await api.post("/schedule/goals", {
        goal_type: newGoalType,
        description: newGoalDesc || undefined,
        target_date: newGoalDate || undefined,
      });
      refetchGoals();
      setGoalFormOpen(false);
      setNewGoalType("");
      setNewGoalDesc("");
      setNewGoalDate("");
    } catch {
      alert(t("profileSaveError"));
    }
  };

  // Используем данные из API, а не из store, чтобы избежать проблем с устаревшими данными
  // Приоритет: profileExt > me > user (fallback)
  const u = profileExt ? {
    id: profileExt.id,
    email: profileExt.email,
    full_name: profileExt.full_name,
    role: profileExt.role,
    photo_url: profileExt.photo_url,
    description: profileExt.description,
    points: (me as { points?: number })?.points ?? (user as { points?: number })?.points ?? 0,
    is_premium: (me as { is_premium?: number })?.is_premium ?? (user as { is_premium?: number })?.is_premium ?? 0,
  } : (me ?? user);

  const profilePreviewData = useMemo<SafeProfilePreviewData | null>(() => {
    if (!profileExt) return null;

    const base: SafeProfilePreviewData = {
      id: profileExt.id,
      email: profileExt.email,
      full_name: profileExt.full_name,
      role: profileExt.role,
      photo_url: profileExt.photo_url,
      description: profileExt.description,
      phone: profileExt.phone,
      city: profileExt.city,
      created_at: profileExt.created_at,
      points: (me as { points?: number })?.points ?? (user as { points?: number })?.points ?? 0,
      status: (profileExt as { status?: string | null }).status ?? null,
      email_work: (profileExt as { email_work?: string | null }).email_work ?? null,
      phone_work: (profileExt as { phone_work?: string | null }).phone_work ?? null,
      office: (profileExt as { office?: string | null }).office ?? null,
      department: (profileExt as { department?: string | null }).department ?? null,
      position: (profileExt as { position?: string | null }).position ?? null,
      education: (profileExt as { education?: string | null }).education ?? null,
      academic_degree: (profileExt as { academic_degree?: string | null }).academic_degree ?? null,
      employment_status: (profileExt as { employment_status?: string | null }).employment_status ?? null,
      reception_hours: (profileExt as { reception_hours?: string | null }).reception_hours ?? null,
      employee_number: (profileExt as { employee_number?: string | null }).employee_number ?? null,
      work_place: (profileExt as { work_place?: string | null }).work_place ?? null,
      kinship_degree: (profileExt as { kinship_degree?: string | null }).kinship_degree ?? null,
      educational_process_role: (profileExt as { educational_process_role?: string | null }).educational_process_role ?? null,
      education_level: (profileExt as { education_level?: string | null }).education_level ?? null,
      system_role: (profileExt as { system_role?: string | null }).system_role ?? null,
      permissions: (profileExt as { permissions?: string[] | null }).permissions ?? null,
      areas_of_responsibility: (profileExt as { areas_of_responsibility?: string[] | null }).areas_of_responsibility ?? null,
      curated_courses: (profileExt as { curated_courses?: string[] | null }).curated_courses ?? null,
      consultation_location: (profileExt as { consultation_location?: string | null }).consultation_location ?? null,
      academic_interests: (profileExt as { academic_interests?: string | null }).academic_interests ?? null,
      subjects_taught: (profileExt as { subjects_taught?: string[] | null }).subjects_taught ?? null,
      teaching_hours: (profileExt as { teaching_hours?: string | null }).teaching_hours ?? null,
      groups: (profileExt as { groups?: Array<{ id: number; name: string }> | null }).groups ?? null,
      students_count: (profileExt as { students_count?: number | null }).students_count ?? null,
      children: (profileExt as { children?: Array<{ id: number; full_name: string; email?: string; role?: string }> | null }).children ?? null,
      parent: (profileExt as { parent?: { id: number; full_name: string; email?: string; role?: string } | null }).parent ?? null,
      teacher: (profileExt as { teacher?: { id: number; full_name: string; email?: string; role?: string } | null }).teacher ?? null,
    };

    if (profileExt.role === "student" && studentProfile) {
      base.status = studentProfile.status ?? base.status;
      base.specialty = studentProfile.specialty;
      base.course = studentProfile.course;
      base.group = studentProfile.group;
      base.study_form = studentProfile.study_form;
      base.admission_date = studentProfile.admission_date;
      base.graduation_date_planned = studentProfile.graduation_date_planned;
    }

    return base;
  }, [me, profileExt, studentProfile, user]);

  const myRank = u ? leaderboard.find((r) => r.user_id === u.id) : undefined;
  const has100 = certificates.some((c) => c.final_score != null && c.final_score >= 100);
  const completedCount = certificates.length;
  const totalStudySeconds = progressDetail?.courses?.reduce((s, c) => s + (c.video_watched_seconds ?? 0), 0) ?? 0;
  const studyHoursStr = formatProfileStudyDuration(totalStudySeconds, t);
  const overallProgress = progressDetail?.courses?.length
    ? Math.round(progressDetail.courses.reduce((s, c) => s + c.progress_percent, 0) / progressDetail.courses.length)
    : 0;
  const streak = streakData?.streak ?? 0;

  const continueCourse = progressDetail?.courses
    ?.filter((c) => c.next_topic_id && c.next_topic_title)
    .sort((a, b) => b.progress_percent - a.progress_percent)[0];

  const upcomingTasks = scheduleItems.filter((s) => !s.is_completed).slice(0, 5);

  const chartData = heatmapData?.days?.map((d) => ({
    name: d.date.slice(5),
    minutes: d.minutes,
    count: d.count,
  })) ?? [];

  const badges = [
    enrollments.length >= 1 && { icon: BookOpen, labelKey: "profileFirstCourse" as const, color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
    enrollments.length >= 5 && { icon: Star, labelKey: "profile5Courses" as const, color: "bg-[var(--qit-primary)]/10 text-[var(--qit-primary)] dark:bg-[var(--qit-primary)]/20 dark:text-[#00b0ff]" },
    certificates.length >= 1 && { icon: Award, labelKey: "profileCertHolder" as const, color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
    has100 && { icon: Trophy, labelKey: "profile100Test" as const, color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
    streak >= 7 && { icon: Flame, labelKey: "profileStreakDays" as const, color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" },
  ].filter(Boolean) as Array<{ icon: typeof BookOpen; labelKey: TranslationKey; color: string }>;

  const rightSidebar = (
    <aside className="lg:order-none order-last">
      <div className="lg:sticky lg:top-24 space-y-6">
        {profileExt?.role === "student" && (profileExt.parent || profileExt.teacher) && (
          <BlurFade delay={0.1}>
            <MagicCard className="bg-white dark:bg-gray-800 rounded-[20px] shadow-md border border-gray-200 dark:border-gray-700 p-5 relative overflow-hidden">
              <h2 className="font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2 relative z-10">
                <Users className="w-5 h-5" />
                <AnimatedShinyText className="text-base">{t("profileContactInfo")}</AnimatedShinyText>
              </h2>
            <div className="space-y-3">
              {profileExt.parent && (
                <Link href={`/app/profile/${profileExt.parent.id}`} className="block p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700/70 transition-colors">
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t("profileParent")}</p>
                  <p className="font-medium text-gray-800 dark:text-white">{profileExt.parent.full_name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{profileExt.parent.email}</p>
                  <p className="text-xs text-[var(--qit-primary)] dark:text-[#00b0ff] mt-1">{t("parentViewProfile")} →</p>
                </Link>
              )}
              {profileExt.teacher && (
                <Link href={`/app/profile/${profileExt.teacher.id}`} className="block p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700/70 transition-colors">
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t("profileTeacherCurator")}</p>
                  <p className="font-medium text-gray-800 dark:text-white">{profileExt.teacher.full_name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{profileExt.teacher.email}</p>
                  <p className="text-xs text-[var(--qit-primary)] dark:text-[#00b0ff] mt-1">{t("parentViewProfile")} →</p>
                </Link>
              )}
            </div>
            </MagicCard>
          </BlurFade>
        )}
        {profileExt?.role === "parent" && profileExt.children && profileExt.children.length > 0 && (
          <BlurFade delay={0.15}>
            <MagicCard className="bg-white dark:bg-gray-800 rounded-[20px] shadow-md border border-gray-200 dark:border-gray-700 p-5 relative overflow-hidden">
              <h2 className="font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2 relative z-10">
                <Users className="w-5 h-5" />
                <AnimatedShinyText className="text-base">{t("profileChildren")}</AnimatedShinyText>
              </h2>
            <div className="space-y-2">
              {profileExt.children.map((c) => (
                <Link key={c.id} href={`/app/profile/${c.id}`} className="block p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <p className="font-medium text-gray-800 dark:text-white">{c.full_name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{c.email}</p>
                  <p className="text-xs text-[var(--qit-primary)] dark:text-[#00b0ff] mt-1">{t("parentViewProfile")} →</p>
                </Link>
              ))}
            </div>
            </MagicCard>
          </BlurFade>
        )}
        {profileExt?.role === "student" && (
          <BlurFade delay={0.25}>
            <MagicCard className="bg-white dark:bg-gray-800 rounded-[20px] shadow-md border border-gray-200 dark:border-gray-700 p-5 relative overflow-hidden">
              <h2 className="font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2 relative z-10">
                <Trophy className="w-5 h-5 text-amber-500" />
                <AnimatedShinyText className="text-base">{t("profileStats")}</AnimatedShinyText>
              </h2>
            <div className="space-y-3">
              {streak > 0 && (
                <div className="flex items-center gap-2">
                  <Flame className="w-5 h-5 text-orange-500 shrink-0" />
                  <span className="text-gray-600 dark:text-gray-400">{t("profileStreak")}: <strong className="text-gray-800 dark:text-white">{t("profileStreakDays").replace("{n}", String(streak))}</strong></span>
                </div>
              )}
              {myRank && (
                <Link href="/app/leaderboard" className="flex items-center gap-2 hover:opacity-80">
                  <Trophy className="w-5 h-5 text-amber-500 shrink-0" />
                  <span className="text-gray-600 dark:text-gray-400">{t("profileRankPlace")}: <strong className="text-gray-800 dark:text-white">{myRank.rank}</strong></span>
                </Link>
              )}
              <div className="flex items-center gap-2">
                <Image src="/icons/coin.png" alt={t("coinsAlt")} width={20} height={20} className="shrink-0" />
                <span className="text-gray-600 dark:text-gray-400">{t("profileCoins")}: <strong className="text-gray-800 dark:text-white">{(me as { points?: number })?.points ?? (user as { points?: number })?.points ?? 0}</strong></span>
                <Link href="/app/shop" className="text-[var(--qit-primary)] hover:underline text-sm ml-1">{t("profileShopLink")}</Link>
              </div>
              {coinHistory.length > 0 && (
                <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
                  <button
                    type="button"
                    onClick={() => setCoinHistoryOpen(!coinHistoryOpen)}
                    className="flex items-center gap-2 text-sm text-[var(--qit-primary)] dark:text-[#00b0ff] hover:underline"
                  >
                    {coinHistoryOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    {t("profileCoinHistory")}
                  </button>
                  {coinHistoryOpen && (
                    <ul className="mt-2 space-y-1.5 max-h-40 overflow-y-auto">
                      {coinHistory.map((tx) => {
                        const reasonKey = tx.reason || tx.label;
                        let translatedLabel = tx.label;
                        if (reasonKey) {
                          if (reasonKey.startsWith("ai_challenge_perfect_")) {
                            translatedLabel = t("coinsReason_ai_challenge_perfect");
                          } else if (reasonKey.startsWith("ai_challenge_")) {
                            translatedLabel = t("coinsReason_ai_challenge");
                          } else if (reasonKey.startsWith("daily_streak_")) {
                            translatedLabel = t("coinsReason_daily_streak");
                          } else {
                            const tVal = t(`coinsReason_${reasonKey}` as TranslationKey);
                            // If t returns the key itself because it's missing, fallback to tx.label or tx.reason
                            translatedLabel = (tVal !== `coinsReason_${reasonKey}`) ? tVal : (tx.label || reasonKey);
                          }
                        }
                        return (
                          <li key={tx.id} className="flex items-center justify-between text-xs">
                            <span className="text-gray-600 dark:text-gray-400 truncate">{translatedLabel}</span>
                            <span className={tx.amount >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                              {tx.amount >= 0 ? "+" : ""}{tx.amount}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </div>
            </MagicCard>
          </BlurFade>
        )}

        {profileExt?.role === "student" && (
          <BlurFade delay={0.3}>
            <MagicCard className="bg-white dark:bg-gray-800 rounded-[20px] shadow-md border border-gray-200 dark:border-gray-700 p-5 relative overflow-hidden">
              <h2 className="font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2 relative z-10">
                <Target className="w-5 h-5" />
                <AnimatedShinyText className="text-base">{t("profileGoals")}</AnimatedShinyText>
              </h2>
            {goals.length === 0 ? (
              <>
                <EmptyState variant="goals" ctaOnClick={() => setGoalFormOpen(true)}/>
                {goalFormOpen && (
                  <div className="mt-4 space-y-2 pt-4 border-t border-gray-200 dark:border-gray-600">
                    <input
                      type="text"
                      value={newGoalType}
                      onChange={(e) => setNewGoalType(e.target.value)}
                      placeholder={t("profileGoalType")}
                      className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white"
                    />
                    <input
                      type="text"
                      value={newGoalDesc}
                      onChange={(e) => setNewGoalDesc(e.target.value)}
                      placeholder={t("profileGoalDescription")}
                      className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white"
                    />
                    <input
                      type="date"
                      value={newGoalDate}
                      onChange={(e) => setNewGoalDate(e.target.value)}
                      className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white"
                    />
                    <div className="flex gap-2">
                      <RippleButton onClick={addGoal} className="px-3 py-1.5 rounded-lg text-white text-sm" style={{ background: "var(--qit-primary)" }}>
                        {t("save")}
                      </RippleButton>
                      <button type="button" onClick={() => setGoalFormOpen(false)} className="px-3 py-1.5 rounded-lg border dark:border-gray-600 text-sm">
                        {t("cancel")}
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <ul className="space-y-2 relative z-10">
                  {goals.map((g) => (
                    <li key={g.id} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                      <button
                        type="button"
                        onClick={() => toggleGoalAchieved(g.id, g.is_achieved)}
                        className={`shrink-0 w-5 h-5 rounded border flex items-center justify-center ${g.is_achieved ? "bg-green-500 border-green-500 text-white" : "border-gray-400 dark:border-gray-500"}`}
                      >
                        {g.is_achieved && <CheckCircle className="w-3 h-3" />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-medium ${g.is_achieved ? "line-through text-gray-500 dark:text-gray-400" : "text-gray-800 dark:text-white"}`}>{g.goal_type || g.description || "—"}</p>
                        {g.target_date && <p className="text-xs text-gray-500 dark:text-gray-400">{g.target_date}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
                {!goalFormOpen ? (
                  <RippleButton onClick={() => setGoalFormOpen(true)} className="mt-3 text-sm text-[var(--qit-primary)] dark:text-[#00b0ff] hover:underline bg-transparent border-none">
                    {t("profileAddGoal")}
                  </RippleButton>
                ) : (
                  <div className="mt-3 space-y-2 relative z-10">
                    <input
                      type="text"
                      value={newGoalType}
                      onChange={(e) => setNewGoalType(e.target.value)}
                      placeholder={t("profileGoalType")}
                      className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white"
                    />
                    <input
                      type="text"
                      value={newGoalDesc}
                      onChange={(e) => setNewGoalDesc(e.target.value)}
                      placeholder={t("profileGoalDescription")}
                      className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white"
                    />
                    <input
                      type="date"
                      value={newGoalDate}
                      onChange={(e) => setNewGoalDate(e.target.value)}
                      className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white"
                    />
                    <div className="flex gap-2">
                      <RippleButton onClick={addGoal} className="px-3 py-1.5 rounded-lg text-white text-sm" style={{ background: "var(--qit-primary)" }}>
                        {t("save")}
                      </RippleButton>
                      <button type="button" onClick={() => setGoalFormOpen(false)} className="px-3 py-1.5 rounded-lg border dark:border-gray-600 text-sm">
                        {t("cancel")}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
            </MagicCard>
          </BlurFade>
        )}

        {(badges.length > 0 || topHistory.length > 0) && (
          <BlurFade delay={0.35}>
            <MagicCard className="bg-white dark:bg-gray-800 rounded-[20px] shadow-md border border-gray-200 dark:border-gray-700 p-5 relative overflow-hidden">
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
                    <MagicCard key={b.labelKey} className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-sm font-medium ${b.color} hover:scale-105 transition-transform cursor-default`}>
                      <b.icon className="w-4 h-4" />
                      <SparklesText className="text-sm font-medium">
                        {b.labelKey === "profileStreakDays" ? t("profileStreakDays").replace("{n}", String(streak)) : t(b.labelKey)}
                      </SparklesText>
                    </MagicCard>
                  ))}
                </div>
              </div>
            </MagicCard>
          </BlurFade>
        )}
        {certificates.length > 0 ? (
          <BlurFade delay={0.4}>
            <MagicCard className="bg-white dark:bg-gray-800 rounded-[20px] shadow-md border border-gray-200 dark:border-gray-700 p-5 relative overflow-hidden">
              <h2 className="font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2 relative z-10">
                <Award className="w-5 h-5" />
                <AnimatedShinyText className="text-base">{t("profileCertificates")}</AnimatedShinyText>
              </h2>
            <ul className="space-y-3 relative z-10">
              {certificates.map((c: any) => (
                <li key={c.id} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl relative overflow-hidden">
                  <ShineBorder className="rounded-xl" />
                  <div className="relative z-10">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-sm text-gray-800 dark:text-white truncate">{getLocalizedCourseTitle({ title: c.course_title } as any, t)} {c.final_score != null && `(${c.final_score}%)`}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        {c.certificate_url && (
                          <a href={c.certificate_url} target="_blank" rel="noreferrer" className="text-[var(--qit-primary)] dark:text-[#00b0ff] hover:underline text-sm">{t("profileView")}</a>
                        )}
                        {c.can_download_pdf ? (
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const response = await api.get(`/users/me/certificates/${c.id}/pdf`, {
                                  responseType: "blob",
                                });
                                // response.data уже является Blob при responseType: "blob"
                                const url = window.URL.createObjectURL(response.data);
                                const link = document.createElement("a");
                                link.href = url;
                                link.setAttribute("download", `certificate_${c.id}.pdf`);
                                document.body.appendChild(link);
                                link.click();
                                link.remove();
                                window.URL.revokeObjectURL(url);
                              } catch (error) {
                                console.error("Failed to download PDF:", error);
                                const err = error as { response?: { data?: { detail?: string }; status?: number }; message?: string };
                                const errorMessage = err?.response?.data?.detail || err?.message || t("excelExportError");
                                alert(errorMessage);
                              }
                            }}
                            className="text-[var(--qit-primary)] dark:text-[#00b0ff] hover:underline text-sm inline-flex items-center gap-1"
                          >
                            <Download className="w-3 h-3" />
                            {t("profileDownloadPDF")}
                          </button>
                        ) : (
                          <Link
                            href="/app/premium"
                            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 text-sm inline-flex items-center gap-1"
                            title={t("premiumFeatureRequired")}
                          >
                            <Lock className="w-3 h-3" />
                            <span className="hidden sm:inline">{t("profileDownloadPDF")}</span>
                          </Link>
                        )}
                      </div>
                    </div>
                    {c.certificate_url && (
                      <Lens>
                        <a href={c.certificate_url} target="_blank" rel="noreferrer" className="block rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600">
                          <img src={c.certificate_url} alt={getLocalizedCourseTitle({ title: c.course_title } as any, t)} className="w-full h-auto max-h-40 object-contain" />
                        </a>
                      </Lens>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </MagicCard>
        </BlurFade>
        ) : (
          profileExt?.role === "student" && (
            <BlurFade delay={0.4}>
              <MagicCard className="bg-white dark:bg-gray-800 rounded-[20px] shadow-md border border-gray-200 dark:border-gray-700 p-5 relative overflow-hidden">
                <h2 className="font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2 relative z-10">
                  <Award className="w-5 h-5" />
                  <AnimatedShinyText className="text-base">{t("profileCertificates")}</AnimatedShinyText>
                </h2>
              <EmptyState variant="certificates" ctaHref="/app/courses" />
              </MagicCard>
            </BlurFade>
          )
        )}
      </div>
    </aside>
  );

  const showProgressTab = profileExt?.role === "student";
  const tabs = (
    <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700 relative">
      <BlurFade delay={0.05}>
        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-all duration-300 ${
            activeTab === "overview"
              ? "border-[var(--qit-primary)] text-[var(--qit-primary)] dark:text-[#00b0ff]"
              : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          {activeTab === "overview" ? (
            <AnimatedGradientText className="text-sm font-medium">{t("profileOverview")}</AnimatedGradientText>
          ) : (
            t("profileOverview")
          )}
        </button>
      </BlurFade>
      {showProgressTab && (
        <BlurFade delay={0.1}>
          <button
            type="button"
            onClick={() => setActiveTab("progress")}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-all duration-300 ${
              activeTab === "progress"
                ? "border-[var(--qit-primary)] text-[var(--qit-primary)] dark:text-[#00b0ff]"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {activeTab === "progress" ? (
              <AnimatedGradientText className="text-sm font-medium">{t("profileProgress")}</AnimatedGradientText>
            ) : (
              t("profileProgress")
            )}
          </button>
        </BlurFade>
      )}
      <BlurFade delay={0.15}>
        <button
          type="button"
          onClick={() => setActiveTab("edit")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-all duration-300 ${
            activeTab === "edit"
              ? "border-[var(--qit-primary)] text-[var(--qit-primary)] dark:text-[#00b0ff]"
              : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          {activeTab === "edit" ? (
            <AnimatedGradientText className="text-sm font-medium">{t("profileEdit")}</AnimatedGradientText>
          ) : (
            t("profileEdit")
          )}
        </button>
      </BlurFade>
    </div>
  );

  const userRank = leaderboard.find((r) => r.user_id === (me?.id ?? user?.id));

  const roleLabel = useMemo(() => {
    if (!profileExt) return "";
    if (profileExt.role === "director") return t("director");
    if (profileExt.role === "teacher") return t("teacher");
    if (profileExt.role === "curator") return t("curator");
    if (profileExt.role === "admin") return t("roleAdmin");
    if (profileExt.role === "parent") return t("parent");
    if (profileExt.role === "student") return t("student");
    if (profileExt.role === "courier") return t("adminShopCourier");
    return profileExt.role;
  }, [profileExt, t]);

  const userCard = (
    <MagicCard className="flex flex-col items-center text-center mb-8 relative overflow-hidden">
      {((me as { is_premium?: number })?.is_premium ?? (user as { is_premium?: number })?.is_premium ?? 0) === 1 && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2">
          <BorderBeam />
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-sm font-semibold mb-3 relative z-10">
            <Crown className="w-4 h-4" />
            <SparklesText className="text-sm font-semibold">
              {t("premiumBadge")}
            </SparklesText>
          </div>
        </div>
      )}
      <div className="relative group">
        <div className="relative w-28 h-28 rounded-2xl bg-[var(--qit-primary)]/10 flex items-center justify-center overflow-hidden shrink-0">
          {profileExt?.photo_url ? <img src={profileExt.photo_url} alt="" className="w-full h-full object-cover" /> : <UserIcon className="w-14 h-14 text-[var(--qit-primary)] dark:text-[#00b0ff]" />}
          <Ripple className="opacity-50" />
        </div>
        {userRank && userRank.rank <= 3 && (
          <div className="absolute -top-4 -left-3 z-10 pointer-events-none">
            {userRank.rank === 1 && <Crown className="w-10 h-10 text-yellow-500 rotate-[-15deg] drop-shadow-lg animate-bounce" />}
            {userRank.rank === 2 && <Crown className="w-9 h-9 text-gray-400 rotate-[-10deg] drop-shadow-md" />}
            {userRank.rank === 3 && <Crown className="w-9 h-9 text-orange-400 rotate-[-10deg] drop-shadow-md" />}
          </div>
        )}
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={handlePhotoChange} disabled={uploading}/>
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="absolute inset-0 rounded-2xl bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer disabled:opacity-50 z-10" title={t("profileUploadPhoto")}>
          <Camera className="w-8 h-8 text-white" />
        </button>
      </div>
      <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="mt-2 text-sm font-medium text-[var(--qit-primary)] dark:text-[#00b0ff] hover:underline disabled:opacity-50">
        {uploading ? t("loading") : t("profileChangePhoto")}
      </button>
      <AnimatedGradientText className="font-semibold text-xl mt-2">
        {profileExt?.full_name ?? ""}
      </AnimatedGradientText>
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 mt-2 text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1.5 text-sm"><Mail className="w-4 h-4 shrink-0" /> {profileExt?.email ?? ""}</span>
        {profileExt?.phone && (
          <span className="flex items-center gap-1.5 text-sm"><Phone className="w-4 h-4 shrink-0" /> {profileExt.phone}</span>
        )}
        {profileExt?.city && (
          <span className="flex items-center gap-1.5 text-sm"><MapPin className="w-4 h-4 shrink-0" /> {profileExt.city}</span>
        )}
        <span className="text-sm">{roleLabel}</span>
      </div>
      {profileExt?.created_at && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {t("profileMemberSince")}{" "}
          {profileExt.created_at ? formatDateLocalized(profileExt.created_at, lang, { day: "numeric", month: "long", year: "numeric" }) : ""}
        </p>
      )}
    </MagicCard>
  );

  const kpiCards = profileExt?.role === "student" && (
    <BlurFade delay={0.05}>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-6">
        {[
          { icon: BookOpen, label: t("profileEnrolled"), value: enrollments.length, gradient: "linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)", color: "#3B82F6" },
          { icon: CheckCircle, label: t("profileCompleted"), value: completedCount, gradient: "linear-gradient(135deg, #10B981 0%, #06B6D4 100%)", color: "#10B981", iconColor: "#10B981" },
          { icon: Clock, label: t("profileStudyHours"), value: studyHoursStr, gradient: "linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)", color: "#F59E0B", isString: true },
          { icon: Award, label: t("profileCertificates"), value: certificates.length, gradient: "linear-gradient(135deg, #EC4899 0%, #8B5CF6 100%)", color: "#EC4899", iconColor: "#F59E0B" },
          ...(streak > 0 ? [{ icon: Flame, label: t("profileStreak"), value: streak, gradient: "linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)", color: "#F59E0B", iconColor: "#F59E0B" }] : []),
        ].map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className="rounded-2xl p-3.5 sm:p-4 relative overflow-hidden group hover:scale-[1.02] transition-all duration-300 card-glow-hover"
              style={{
                ...glassStyle,
                background: isDark
                  ? `linear-gradient(135deg, rgba(26, 34, 56, 0.9) 0%, rgba(30, 41, 59, 0.8) 100%)`
                  : `linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(255, 255, 255, 0.95) 100%)`,
              }}
            >
              <div
                className="absolute top-0 right-0 w-20 h-20 rounded-full opacity-15 blur-2xl transition-opacity group-hover:opacity-25"
                style={{ background: card.gradient }}
              />
              <div className="relative">
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-white shadow-md group-hover:scale-110 transition-transform duration-300"
                    style={{ background: card.gradient, boxShadow: `0 4px 12px ${card.color}40` }}
                  >
                    <Icon className="w-5 h-5" style={{ color: card.iconColor || "white" }}/>
                  </div>
                  <span className="text-[11px] sm:text-xs font-medium leading-tight" style={{ color: textColors.secondary }}>{card.label}</span>
                </div>
                {card.isString ? (
                  <p className="text-xl sm:text-2xl font-bold font-geologica" style={{ color: textColors.primary }}>{card.value}</p>
                ) : (
                  <NumberTicker value={card.value as number} className="text-xl sm:text-2xl font-bold font-geologica" style={{ color: textColors.primary }}/>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </BlurFade>
  );

  // Prepare admin chart data
  const completionsChartData = useMemo(() => {
    if (!completionsData?.data) return [];
    const raw = completionsData.data;
    const byDate = new Map(raw.map((r) => [r.date, r.count]));
    const result: Array<{ date: string; count: number; name: string }> = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      result.push({ date: dateStr, count: byDate.get(dateStr) ?? 0, name: dateStr.slice(5) });
    }
    return result;
  }, [completionsData?.data]);

  const courseStatsLocalized = courseStats.map((c) => {
    const key = c.title ? COURSE_TITLE_KEYS[c.title] : undefined;
    const localizedTitle = key ? t(key as any) : (c.title || `${t("course")} #${c.course_id}`);
    return {
      ...c,
      localizedTitle,
    };
  });

  const courseStatsForPie = courseStatsLocalized.slice(0, 5).map((c) => ({
    name: c.localizedTitle,
    value: c.enrollments,
    completed: c.completed_topics,
  }));

  const COLORS = ["#3B82F6", "#8B5CF6", "#10B981", "#F59E0B", "#EC4899", "#06B6D4", "#EF4444"];

  const isPending = meQuery.isPending || profileExtQuery.isPending;
  const isError = meQuery.isError || profileExtQuery.isError;

  if (isPending) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-10 h-10 border-2 border-[var(--qit-primary)] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (isError || !profileExt || !u) {
    const err =
      (profileExtQuery.error as any)?.response?.data?.detail ||
      (meQuery.error as any)?.response?.data?.detail ||
      (profileExtQuery.error as any)?.message ||
      (meQuery.error as any)?.message ||
      t("profileSaveError");
    return (
      <div className="flex items-center justify-center min-h-[400px] px-4">
        <div className="max-w-md w-full rounded-2xl p-5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-2">
            {t("profileLoadError")}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 break-words">{String(err)}</p>
          <button
            type="button"
            onClick={() => {
              meQuery.refetch();
              profileExtQuery.refetch();
            }}
            className="px-4 py-2 rounded-xl bg-[var(--qit-primary)] text-white font-medium hover:opacity-90 transition-opacity"
          >
            {t("retry")}
          </button>
        </div>
      </div>
    );
  }

  const teacherKpiCards = profileExt.role === "teacher" && (
    <BlurFade delay={0.08}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {[
          { icon: GraduationCap, label: t("profileTeacherGroupsCount"), value: profileExt.groups?.length ?? 0, gradient: "linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)", color: "#3B82F6" },
          { icon: Users, label: t("profileTeacherStudentsCount"), value: profileExt.students_count ?? 0, gradient: "linear-gradient(135deg, #10B981 0%, #06B6D4 100%)", color: "#10B981" },
        ].map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className="rounded-2xl p-3.5 sm:p-4 relative overflow-hidden group hover:scale-[1.02] transition-all duration-300 card-glow-hover"
              style={{
                ...glassStyle,
                background: isDark
                  ? `linear-gradient(135deg, rgba(26, 34, 56, 0.9) 0%, rgba(30, 41, 59, 0.8) 100%)`
                  : `linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(255, 255, 255, 0.95) 100%)`,
              }}
            >
              <div
                className="absolute top-0 right-0 w-20 h-20 rounded-full opacity-15 blur-2xl transition-opacity group-hover:opacity-25"
                style={{ background: card.gradient }}
              />
              <div className="relative">
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-white shadow-md group-hover:scale-110 transition-transform duration-300"
                    style={{ background: card.gradient, boxShadow: `0 4px 12px ${card.color}40` }}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-medium" style={{ color: textColors.secondary }}>{card.label}</span>
                </div>
                <NumberTicker value={card.value} className="text-xl sm:text-2xl font-bold font-geologica" style={{ color: textColors.primary }}/>
              </div>
            </div>
          );
        })}
        <Link
          href="/app/teacher"
          className="col-span-2 rounded-2xl p-4 flex items-center justify-center gap-2 font-medium transition-all hover:shadow-lg hover:scale-[1.02] relative overflow-hidden min-h-[2.75rem]"
          style={{
            background: "linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)",
            color: "white",
            boxShadow: "0 4px 12px rgba(59, 130, 246, 0.3)",
          }}
        >
          <GraduationCap className="w-5 h-5" />
          <span>{t("profileTeacherPanelLink")} →</span>
        </Link>
      </div>
    </BlurFade>
  );



  const safePreviewBlock = profilePreviewData && (
    <BlurFade delay={0.09}>
      <ProfilePreviewCard profile={profilePreviewData} rank={userRank?.rank} className="mb-6" />
    </BlurFade>
  );

  const adminKpiCards = isAdmin && adminOverview && (
    <BlurFade delay={0.1}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {[
          { icon: Users, label: t("adminTotalUsers"), value: Number(adminOverview?.users_count ?? 0), gradient: "linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)", color: "#3B82F6" },
          { icon: BookOpen, label: t("adminActiveCourses"), value: Number(adminOverview?.courses_count ?? 0), gradient: "linear-gradient(135deg, #10B981 0%, #06B6D4 100%)", color: "#10B981" },
          { icon: GraduationCap, label: t("adminEnrollments"), value: Number(adminOverview?.enrollments_count ?? 0), gradient: "linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)", color: "#F59E0B" },
          { icon: CheckCircle, label: t("adminCompletedTopics"), value: Number(adminOverview?.progress_count ?? 0), gradient: "linear-gradient(135deg, #EC4899 0%, #8B5CF6 100%)", color: "#EC4899" },
        ].map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className="rounded-2xl p-5 relative overflow-hidden group hover:scale-[1.02] transition-all duration-300 card-glow-hover"
              style={{
                ...glassStyle,
                background: isDark
                  ? `linear-gradient(135deg, rgba(26, 34, 56, 0.9) 0%, rgba(30, 41, 59, 0.8) 100%)`
                  : `linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(255, 255, 255, 0.95) 100%)`,
              }}
            >
              <div
                className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-20 blur-2xl transition-opacity group-hover:opacity-30"
                style={{ background: card.gradient }}
              />
              <div className="relative">
                <div className="flex items-start justify-between mb-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-white shadow-lg group-hover:scale-110 transition-transform duration-300"
                    style={{ background: card.gradient, boxShadow: `0 8px 16px ${card.color}40` }}
                  >
                    <Icon className="w-6 h-6" />
                  </div>
                </div>
                <p className="text-3xl font-bold font-geologica tracking-tight mb-1" style={{ color: textColors.primary }}>
                  <NumberTicker value={card.value}/>
                </p>
                <p className="text-sm font-medium" style={{ color: textColors.secondary }}>
                  {card.label}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </BlurFade>
  );

  const adminCharts = isAdmin ? (
    <BlurFade delay={0.15}>
      <div className="space-y-6 mb-6">
        {completionsChartData.length > 0 && (
          <div className="rounded-2xl p-6 relative overflow-hidden" style={glassStyle}>
            <div className="flex items-center gap-2 mb-5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-500 text-white">
                <TrendingUp className="w-4 h-4" />
              </div>
              <h2 className="font-semibold font-geologica" style={{ color: textColors.primary }}>
                {t("adminCompletionsOverTime")}
              </h2>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={completionsChartData}>
                  <defs>
                    <linearGradient id="colorCompletions" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: textColors.secondary }}/>
                  <YAxis tick={{ fontSize: 11, fill: textColors.secondary }}/>
                  <Tooltip
                    contentStyle={{
                      background: isDark ? "rgba(26, 34, 56, 0.95)" : "rgba(255, 255, 255, 0.95)",
                      border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
                      borderRadius: "12px",
                    }}
                  />
                  <Area type="monotone" dataKey="count" stroke="#3B82F6" fillOpacity={1} fill="url(#colorCompletions)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {courseStatsForPie.length > 0 && (
          <div className="space-y-6">
            <div className="rounded-2xl p-6 relative overflow-hidden" style={glassStyle}>
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-amber-500 to-orange-500 text-white">
                  <PieChartIcon className="w-4 h-4" />
                </div>
                <h2 className="font-semibold font-geologica" style={{ color: textColors.primary }}>
                  {t("adminCourseStats")}
                </h2>
              </div>
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={courseStatsForPie}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={105}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {courseStatsForPie.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]}/>
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: isDark ? "rgba(26, 34, 56, 0.95)" : "rgba(255, 255, 255, 0.95)",
                        border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
                        borderRadius: "12px",
                      }}
                      formatter={((value: number, name: string, props: any) => {
                        const v = value ?? 0;
                        const total = courseStatsForPie.reduce((sum, item) => sum + item.value, 0);
                        const percent = total > 0 ? ((props?.payload?.value ?? v) / total * 100).toFixed(0) : "0";
                        return [`${v} (${percent}%)`, props?.payload?.name ?? name];
                      }) as any}
                    />
                    <Legend
                      layout="horizontal"
                      align="center"
                      verticalAlign="bottom"
                      iconType="circle"
                      formatter={(value, entry: any) => {
                        const data = courseStatsForPie.find((item) => item.name === value);
                        const total = courseStatsForPie.reduce((sum, item) => sum + item.value, 0);
                        const percent = data ? ((data.value / total) * 100).toFixed(0) : "0";
                        const displayName = (value ?? "").length > 25 ? `${(value ?? "").slice(0, 25)}...` : value;
                        return (
                          <span style={{ color: textColors.secondary, fontSize: "12px" }}>
                            {displayName} ({percent}%)
                          </span>
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-2xl p-6 relative overflow-hidden" style={glassStyle}>
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <h2 className="font-semibold font-geologica" style={{ color: textColors.primary }}>
                  {t("adminCourseStats")}
                </h2>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={courseStatsLocalized.slice(0, 5)} margin={{ top: 10, right: 10, left: 0, bottom: 60 }}>
                    <XAxis
                      dataKey="localizedTitle"
                      tick={{ fontSize: 11, fill: textColors.secondary }}
                      angle={0}
                      textAnchor="middle"
                      height={50}
                      tickFormatter={(value) => {
                        if (!value) return "";
                        return value.length > 18 ? `${value.slice(0, 18)}...` : value;
                      }}
                    />
                    <YAxis tick={{ fontSize: 11, fill: textColors.secondary }}/>
                    <Tooltip
                      contentStyle={{
                        background: isDark ? "rgba(26, 34, 56, 0.95)" : "rgba(255, 255, 255, 0.95)",
                        border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
                        borderRadius: "12px",
                      }}
                      formatter={(value: any, name: any) => {
                        if (name === "enrollments") return [value ?? 0, t("adminEnrollments")];
                        if (name === "completed_topics" || name === "completed") return [value ?? 0, t("adminCompletedTopics")];
                        return [value ?? 0, String(name)];
                      }}
                    />
                    <Bar name={t("adminEnrollments")} dataKey="enrollments" fill="#3B82F6" radius={[8, 8, 0, 0]}/>
                    <Bar name={t("adminCompletedTopics")} dataKey="completed_topics" fill="#10B981" radius={[8, 8, 0, 0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>
    </BlurFade>
  ) : null;



  const parentMainBlock = profileExt?.role === "parent" && (
    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-[20px] border border-gray-200 dark:border-gray-600 p-6 mb-6">
      <h2 className="font-semibold text-gray-800 dark:text-white mb-2 flex items-center gap-2">
        <Users className="w-5 h-5" /> {t("profileMyStudents")}
      </h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{t("profileParentStudentsIntro")}</p>
      {profileExt.children && profileExt.children.length > 0 ? (
        <div className="space-y-3">
          {profileExt.children.map((c) => (
            <Link key={c.id} href={`/app/profile/${c.id}`} className="block p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-600 hover:border-[var(--qit-primary)]/50 dark:hover:border-[#00b0ff]/50 transition-colors">
              <p className="font-medium text-gray-800 dark:text-white">{c.full_name}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{c.email}</p>
              <p className="text-xs text-[var(--qit-primary)] dark:text-[#00b0ff] mt-1">{t("profileParentOfStudent")} · {t("parentViewProfile")} →</p>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t("profileChildren")}: 0</p>
      )}
    </div>
  );

  const continueLearningCta = continueCourse && (
    <BlurFade delay={0.05}>
      <MagicCard className="mb-6 p-4 rounded-xl border-2 border-[var(--qit-primary)]/30 dark:border-[#00b0ff]/30 bg-[var(--qit-primary)]/5 dark:bg-[#00b0ff]/5 hover:bg-[var(--qit-primary)]/10 dark:hover:bg-[#00b0ff]/10 transition-colors relative overflow-hidden">
        <Link
          href={`/app/courses/${continueCourse.course_id}/topic/${continueCourse.next_topic_id}`}
          className="block relative z-10"
        >
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{t("profileContinueLearning")}</p>
          <AnimatedGradientText className="font-semibold text-base">
            {t("profileContinueCourse")
              .replace("{course}", getLocalizedCourseTitle({ title: continueCourse.course_title } as any, t))
              .replace("{topic}", continueCourse.next_topic_title ? getLocalizedTopicTitle(continueCourse.next_topic_title, t) : "")}
          </AnimatedGradientText>
        </Link>
      </MagicCard>
    </BlurFade>
  );

  const upcomingTasksBlock = profileExt?.role === "student" && (
    <BlurFade delay={0.1}>
      <MagicCard className="bg-gray-50 dark:bg-gray-700/50 rounded-[20px] border border-gray-200 dark:border-gray-600 p-5 mb-6 relative overflow-hidden">
        <h2 className="font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2 relative z-10">
          <Calendar className="w-5 h-5" />
          <AnimatedShinyText className="text-base">{t("profileUpcomingTasks")}</AnimatedShinyText>
        </h2>
        {upcomingTasks.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2 relative z-10">{t("eventsNoScheduled")}</p>
        ) : (
          <AnimatedList className="space-y-2 relative z-10" delay={200}>
            {upcomingTasks.map((s) => (
              <MagicCard key={s.id} className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-gray-800">
                <span className="text-sm text-gray-800 dark:text-white truncate">
                  {s.course_title ? getLocalizedCourseTitle({ title: s.course_title } as any, t) : (s.topic_title ? getLocalizedTopicTitle(s.topic_title, t) : s.notes) || "—"}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0 ml-2">{s.scheduled_date}</span>
              </MagicCard>
            ))}
          </AnimatedList>
        )}
        <Link 
          href="/app/tasks-calendar" 
          className="mt-3 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all hover:opacity-90 relative z-10"
          style={{
            background: theme === "dark" 
              ? "rgba(0, 0, 0, 0.6)" 
              : "rgba(59, 130, 246, 0.1)",
            color: theme === "dark" 
              ? "#00b0ff" 
              : "#3b82f6",
            border: theme === "dark" 
              ? "1px solid rgba(0, 176, 255, 0.2)" 
              : "1px solid rgba(59, 130, 246, 0.2)",
          }}
        >
          {t("profileAllTasks")} →
        </Link>
      </MagicCard>
    </BlurFade>
  );

  const heatmapBlock = heatmapData?.days && heatmapData.days.length > 0 && (
    <MagicCard className="bg-gray-50 dark:bg-gray-700/50 rounded-[20px] border border-gray-200 dark:border-gray-600 p-5 mb-6 relative overflow-hidden">
      <FlickeringGrid className="absolute inset-0 opacity-30" />
      <h2 className="font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2 relative z-10">
        <Flame className="w-5 h-5 text-orange-500" />
        <AnimatedShinyText className="text-base">{t("profileActivityHeatmap")}</AnimatedShinyText>
      </h2>
      <div className="flex flex-wrap gap-1 relative z-10">
        {heatmapData.days.map((d) => {
          const maxVal = Math.max(...heatmapData.days.map((x) => x.count + x.minutes / 10), 1);
          const intensity = (d.count + d.minutes / 10) / maxVal;
          const opacityClass = intensity <= 0 ? "bg-gray-200 dark:bg-gray-600" : intensity < 0.33 ? "bg-[var(--qit-primary)]/30" : intensity < 0.66 ? "bg-[var(--qit-primary)]/60" : "bg-[var(--qit-primary)]/90";
          return (
            <div
              key={d.date}
              title={`${d.date}: ${d.count} active, ${d.minutes} min`}
              className={`w-4 h-4 rounded-sm transition-all hover:scale-125 hover:z-20 relative ${opacityClass}`}
            />
          );
        })}
      </div>
    </MagicCard>
  );

  const activityChart = chartData.length > 0 && (
    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-[20px] border border-gray-200 dark:border-gray-600 p-5 mb-6">
      <h2 className="font-semibold text-gray-800 dark:text-white mb-4">{t("profileActivityHeatmap")}</h2>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <XAxis dataKey="name" tick={{ fontSize: 10 }}/>
            <YAxis tick={{ fontSize: 10 }}/>
            <Tooltip />
            <Bar dataKey="minutes" fill="var(--qit-primary)" radius={[4, 4, 0, 0]}/>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  const progressBlock = (
    <>
      {(progressDetail?.courses?.length ?? 0) > 0 ? (
        <div className="grid lg:grid-cols-3 gap-6 mb-6">
          <MagicCard className="lg:col-span-1 bg-gray-50 dark:bg-gray-700/50 rounded-[20px] border border-gray-200 dark:border-gray-600 p-6 shadow-sm relative overflow-hidden">
            <h2 className="font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2 relative z-10">
              <BookOpen className="w-5 h-5" />
              <AnimatedShinyText className="text-base">{t("profileProgressGeneral")}</AnimatedShinyText>
            </h2>
            <div className="flex flex-col items-center relative z-10">
              <AnimatedCircularProgressBar
                value={overallProgress}
                gaugePrimaryColor="var(--qit-primary)"
                gaugeSecondaryColor="rgb(229, 231, 235)"
                className="mb-2"
              />
              <AnimatedGradientText className="text-2xl font-bold">
                {overallProgress}%
              </AnimatedGradientText>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{t("profileCourseProgress")}</p>
            </div>
          </MagicCard>
          <MagicCard className="lg:col-span-2 bg-gray-50 dark:bg-gray-700/50 rounded-[20px] border border-gray-200 dark:border-gray-600 p-6 shadow-sm relative overflow-hidden">
            <BorderBeam className="absolute inset-0" />
            <h2 className="font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2 relative z-10">
              <BookOpen className="w-5 h-5" />
              <AnimatedShinyText className="text-base">{t("profileCourseProgress")}</AnimatedShinyText>
            </h2>
            <div className="space-y-4 max-h-64 overflow-y-auto relative z-10">
              {progressDetail!.courses.map((c) => (
                <Link key={c.course_id} href={`/app/courses/${c.course_id}`} className="block">
                  <MagicCard className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
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
                        <div className="h-full rounded-full transition-all bg-gradient-to-r from-[var(--qit-primary)] to-[#00b0ff]" style={{ width: `${c.progress_percent}%` }}/>
                      </div>
                    </div>
                    <AnimatedGradientText className="text-sm font-semibold shrink-0 w-12 text-right">
                      {c.progress_percent}%
                    </AnimatedGradientText>
                    <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                  </MagicCard>
                </Link>
              ))}
            </div>
          </MagicCard>
        </div>
      ) : (
        profileExt?.role === "student" && (
          <div className="mb-6">
            <EmptyState variant="courses" ctaHref="/app/courses" />
          </div>
        )
      )}
    </>
  );

  const editForm = (
    <BlurFade delay={0.1}>
      <MagicCard className="relative overflow-hidden">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 relative z-10">
          <AnimatedShinyText className="text-xl font-semibold mb-4 block">{t("profileEdit")}</AnimatedShinyText>
          {saveSuccessMessage && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-900/20 dark:text-emerald-300">
              <CheckCircle className="h-4 w-4 shrink-0" />
              <span>{saveSuccessMessage}</span>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("profileFullName")}</label>
            <input {...register("full_name")} className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-[var(--qit-primary)] focus:border-[var(--qit-primary)] transition-all" />
            {errors.full_name && <p className="text-red-600 text-sm mt-1 animate-pulse">{t("profileFullNameRequired")}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("profilePhone")}</label>
            <input {...register("phone")} placeholder={t("profilePlaceholderPhone")} className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white transition-all" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("profileBirthDate")}</label>
            <input {...register("birth_date")} type="date" className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white transition-all" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("profileCity")}</label>
            <input {...register("city")} placeholder={t("profilePlaceholderCity")} className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white transition-all" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("profileAddress")}</label>
            <input {...register("address")} placeholder={t("profilePlaceholderAddress")} className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white transition-all" />
          </div>

          {profileExt?.role === "teacher" && (
            <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-800 dark:text-white">{t("profileTeacherPersonalData")}</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("profileGender")}</label>
                  <select {...register("gender")} className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-[var(--qit-primary)] transition-all">
                    <option value="Мужской">{t("genderMale")}</option>
                    <option value="Женский">{t("genderFemale")}</option>
                    <option value="Другое">{t("genderOther")}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("profileIdentityCard")}</label>
                  <input {...register("identity_card")} className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white transition-all" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("profileIin")}</label>
                  <input {...register("iin_teacher")} className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white transition-all" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("profileEducation")}</label>
                  <input {...register("education")} className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("profileAcademicDegree")}</label>
                  <input {...register("academic_degree")} className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white transition-all" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("profileWorkEmail")}</label>
                  <input {...register("email_work")} type="email" className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("profilePersonalEmail")}</label>
                  <input {...register("email_personal")} type="email" className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white transition-all" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("profileWorkPhone")}</label>
                  <input {...register("phone_work")} className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white transition-all" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("profileOffice")}</label>
                  <input {...register("office")} className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("profileReceptionHours")}</label>
                  <input {...register("reception_hours")} placeholder={t("profileReceptionHoursPlaceholder")}  className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white transition-all" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("profileEmployeeNumber")}</label>
                  <input {...register("employee_number")} className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("profilePosition")}</label>
                  <select {...register("position")} className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white transition-all">
                    <option value="">—</option>
                    <option value="Куратор">{t("profileTeacherPositionCurator")}</option>
                    <option value="Классный руководитель">{t("profileTeacherPositionClassLeader")}</option>
                    <option value="Наставник">{t("profileTeacherPositionMentor")}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("profileDepartment")}</label>
                  <input {...register("department")} className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("profileHireDate")}</label>
                  <input {...register("hire_date")} type="date" className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white transition-all" />
                </div>
              </div>

              <div className="space-y-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t("profileTeacherActivityInfo")}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("profileCuratedCourses")}</label>
                    <textarea
                      {...register("curated_courses_text")}
                      rows={3}
                      placeholder={t("profileCuratedCoursesHint")} 
                      className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("profileConsultationLocation")}</label>
                    <input {...register("consultation_location")} className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white transition-all" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("profileEmploymentStatus")}</label>
                  <select {...register("employment_status")} className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white transition-all">
                    <option value="Штатный">{t("profileEmploymentFullTime")}</option>
                    <option value="Совместитель">{t("profileEmploymentPartTime")}</option>
                    <option value="Почасовой">{t("profileEmploymentHourly")}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("profileTeachingHours")}</label>
                  <input {...register("teaching_hours")} placeholder={t("profileTeachingHoursPlaceholder")} className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white transition-all" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("profileAcademicInterests")}</label>
                <textarea {...register("academic_interests")} rows={3} className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white transition-all" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("profileStatus")}</label>
                  <select {...register("status")} className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white transition-all">
                    <option value="Активный">{t("profileStatusActive")}</option>
                    <option value="В отпуске">{t("profileStatusVacation")}</option>
                    <option value="Неактивный">{t("profileStatusInactive")}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("profileInterfaceLanguage")}</label>
                  <select {...register("interface_language")} className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white transition-all">
                    <option value="Русский">{t("profileLanguageRussian")}</option>
                    <option value="Казахский">{t("profileLanguageKazakh")}</option>
                    <option value="Английский">{t("profileLanguageEnglish")}</option>
                  </select>
                </div>
              </div>
            </div>
          )}
          {profileExt?.role === "parent" && (
            <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-800 dark:text-white">{t("profileParentPersonalData")}</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("profileGender")}</label>
                  <select {...register("gender")} className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-[var(--qit-primary)] transition-all">
                    <option value="Мужской">{t("genderMale")}</option>
                    <option value="Женский">{t("genderFemale")}</option>
                    <option value="Другое">{t("genderOther")}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("profileIdentityCard")}</label>
                  <input {...register("identity_card")} className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white transition-all" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("profileWorkPlace")}</label>
                  <input {...register("work_place")} className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("profilePosition")}</label>
                  <input {...register("position")} className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white transition-all" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("profileWorkEmail")}</label>
                  <input {...register("email_work")} type="email" className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("profileWorkPhone")}</label>
                  <input {...register("phone_work")} className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white transition-all" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("profileKinshipDegree")}</label>
                  <select {...register("kinship_degree")} className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white transition-all">
                    <option value="Отец">{t("kinshipFather")}</option>
                    <option value="Мать">{t("kinshipMother")}</option>
                    <option value="Опекун">{t("kinshipGuardian")}</option>
                    <option value="Другое">{t("kinshipOther")}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("profileEducationalProcessRole")}</label>
                  <select {...register("educational_process_role")} className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white transition-all">
                    <option value="Законный представитель">{t("eduRoleLegalRepresentative")}</option>
                    <option value="Опекун">{t("eduRoleGuardian")}</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                <h4 className="font-medium text-gray-800 dark:text-white mb-2">{t("profileStudentRelation")}</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                  {profileExt.children?.[0]
                    ? `${t("profileLinkedStudent")}: ${profileExt.children[0].full_name} (ID: ${profileExt.children[0].id})`
                    : t("parentNoChildren")}
                </p>
                <div className="flex flex-col md:flex-row gap-3">
                  <input
                    {...register("student_id")}
                    inputMode="numeric"
                    placeholder={t("profileStudentIdPlaceholder")}
                    className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white transition-all"
                  />
                  <RippleButton
                    type="button"
                    onClick={linkStudentToParent}
                    className="px-4 py-2 rounded-lg text-white text-sm"
                    style={{ background: "var(--qit-primary)" }}
                  >
                    {t("profileLinkStudent")}
                  </RippleButton>
                </div>
              </div>
            </div>
          )}
          {(profileExt?.role === "admin" || profileExt?.role === "director") && (
            <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-800 dark:text-white">{t("profileAdminPersonalData")}</h3>

              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t("profileBasicInfoSection")}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("profileGender")}</label>
                    <select {...register("gender")} className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-[var(--qit-primary)] transition-all">
                      <option value="Мужской">{t("genderMale")}</option>
                      <option value="Женский">{t("genderFemale")}</option>
                      <option value="Другое">{t("genderOther")}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("profileIdentityCard")}</label>
                    <input {...register("identity_card")} className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white transition-all" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("profileEducationLevel")}</label>
                    <select {...register("education_level")} className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white transition-all">
                      <option value="">—</option>
                      <option value="Высшее (бакалавр)">{t("educationLevelBachelor")}</option>
                      <option value="Высшее (магистр)">{t("educationLevelMaster")}</option>
                      <option value="Высшее (специалист)">{t("educationLevelSpecialist")}</option>
                      <option value="Среднее специальное">{t("educationLevelSecondarySpecial")}</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t("profileContactsSection")}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("profileWorkEmail")}</label>
                    <input {...register("email_work")} type="email" className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white transition-all" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("profilePersonalEmail")}</label>
                    <input {...register("email_personal")} type="email" className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white transition-all" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("profileWorkPhone")}</label>
                    <input {...register("phone_work")} className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white transition-all" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("profileOffice")}</label>
                    <input {...register("office")} className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white transition-all" />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t("profileWorkInfo")}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("profileEmployeeNumber")}</label>
                    <input {...register("employee_number")} className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white transition-all" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("profilePosition")}</label>
                    <input {...register("position")} className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white transition-all" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("profileDepartment")}</label>
                    <input {...register("department")} className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white transition-all" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("profileHireDate")}</label>
                    <input {...register("hire_date")} type="date" className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white transition-all" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("profileStatus")}</label>
                    <select {...register("status")} className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white transition-all">
                      <option value="Активный">{t("profileStatusActive")}</option>
                      <option value="В отпуске">{t("profileStatusVacation")}</option>
                      <option value="Неактивный">{t("profileStatusInactive")}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("profileInterfaceLanguage")}</label>
                    <select {...register("interface_language")} className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white transition-all">
                      <option value="Русский">{t("profileLanguageRussian")}</option>
                      <option value="Казахский">{t("profileLanguageKazakh")}</option>
                      <option value="Английский">{t("profileLanguageEnglish")}</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t("profileAccessInfo")}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("profileSystemRole")}</label>
                    <select {...register("system_role")} className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white transition-all">
                      <option value="Суперадминистратор">{t("profileSystemRoleSuperAdmin")}</option>
                      <option value="Администратор факультета">{t("profileSystemRoleFacultyAdmin")}</option>
                      <option value="Администратор кафедры">{t("profileSystemRoleDepartmentAdmin")}</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("profileAccessRightsLines")}</label>
                    <textarea {...register("permissions_text")} rows={4} placeholder={t("profileAdminPermissionsPlaceholder")} className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white transition-all" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("profileResponsibilityAreasLines")}</label>
                    <textarea {...register("areas_of_responsibility_text")} rows={4} placeholder={t("profileResponsibilityAreasPlaceholder")} className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white transition-all" />
                  </div>
                </div>
              </div>
            </div>
          )}
          {profileExt?.role === "student" && (
            <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-800 dark:text-white">{t("profileStudentPersonalData")}</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("profileGender")}</label>
                  <select {...register("gender")} className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-[var(--qit-primary)] transition-all">
                    <option value="Мужской">{t("genderMale")}</option>
                    <option value="Женский">{t("genderFemale")}</option>
                    <option value="Другое">{t("genderOther")}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("profileNationality")}</label>
                  <input {...register("nationality")} className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white transition-all" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("profileIdentityCard")}</label>
                  <input {...register("identity_card")} className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("profileIin")}</label>
                  <input {...register("iin")} className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white transition-all" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("profileAlternativePhone")}</label>
                  <input {...register("phone_alternative")} className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("profilePostalCode")}</label>
                  <input {...register("postal_code")} className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white transition-all" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("profileCountry")}</label>
                  <input {...register("country")} className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("profileStudentCardNumber")}</label>
                  <input {...register("student_id_card_number")} className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white transition-all" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("profileSpecialty")}</label>
                  <input {...register("specialty")} className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("profileCourse")}</label>
                  <input {...register("course")} type="number" min={1} className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white transition-all" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("profileGroups")}</label>
                  <input {...register("group")} className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("profileStudyForm")}</label>
                  <select {...register("study_form")} className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white transition-all">
                    <option value="Очная">{t("profileStudyFullTime")}</option>
                    <option value="Заочная">{t("profileStudyPartTime")}</option>
                    <option value="Очно-заочная">{t("profileStudyMixed")}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("profileAdmissionDate")}</label>
                  <input {...register("admission_date")} type="date" className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("profileGraduationDate")}</label>
                  <input {...register("graduation_date_planned")} type="date" className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white transition-all" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("profileStatus")}</label>
                  <select {...register("status")} className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white transition-all">
                    <option value="Активный">{t("profileStatusActive")}</option>
                    <option value="Неактивный">{t("profileStatusInactive")}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("profileInterfaceLanguage")}</label>
                  <select {...register("interface_language")} className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white transition-all">
                    <option value="Русский">{t("profileLanguageRussian")}</option>
                    <option value="Казахский">{t("profileLanguageKazakh")}</option>
                    <option value="Английский">{t("profileLanguageEnglish")}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("profileTimezone")}</label>
                  <input {...register("timezone")} placeholder={t("profileTimezonePlaceholder")} className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white transition-all" />
                </div>
                <div className="flex flex-col justify-end">
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {t("profileCreatedAt")}: <span className="font-medium">{studentProfile?.created_at ? formatDateLocalized(studentProfile.created_at, lang) : "—"}</span>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {t("profileLastLogin")}: <span className="font-medium">{studentProfile?.last_login ? formatDateLocalized(studentProfile.last_login, lang) : "—"}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("profilePhotoUrl")}</label>
            <input {...register("photo_url")} placeholder={t("profilePhotoUrlPlaceholder")} className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white transition-all" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("profileDescription")}</label>
            <textarea {...register("description")} rows={4} placeholder={t("profileDescriptionPlaceholder")} className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white transition-all" />
          </div>
          <div className="flex flex-wrap gap-4 pt-2">
            <ShimmerButton type="submit" disabled={saving} className="py-2.5 px-5 rounded-lg text-white font-medium disabled:opacity-70 disabled:cursor-not-allowed" style={{ background: "var(--qit-primary)" }}>
              {saving ? t("loading") : t("save")}
            </ShimmerButton>
          </div>
        </form>
      </MagicCard>
    </BlurFade>
  );

  return (
    <>
      <div className="hidden md:block">
        <ScrollProgress />
      </div>
      <Confetti ref={confettiRef} manualstart />
      
      {/* Фоновое изображение позади всех блоков */}
      <div className="hidden sm:block fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div
          className="absolute inset-0 opacity-30 dark:opacity-20"
          style={{
            background: isDark
              ? "linear-gradient(135deg, #7C3AED 0%, #2563EB 30%, #06B6D4 60%, #8B5CF6 100%)"
              : "linear-gradient(135deg, #8B5CF6 0%, #3B82F6 30%, #06B6D4 60%, #A855F7 100%)",
          }}
        >
          {/* Декоративные волны */}
          <div className="absolute inset-0 opacity-20">
            <svg className="absolute bottom-0 left-0 w-full h-full" viewBox="0 0 1200 800" preserveAspectRatio="none">
              <path fill="currentColor" d="M0,400 C300,200 600,600 900,400 C1050,300 1200,500 1200,400 L1200,800 L0,800 Z" />
            </svg>
          </div>
          
          {/* Светящиеся шары */}
          <div className="absolute top-20 right-20 w-96 h-96 rounded-full bg-white/10 blur-3xl animate-pulse" />
          <div className="absolute bottom-32 left-32 w-64 h-64 rounded-full bg-white/8 blur-2xl animate-pulse" style={{ animationDelay: "1s" }}/>
          <div className="absolute top-1/2 left-1/4 w-80 h-80 rounded-full bg-white/5 blur-3xl animate-pulse" style={{ animationDelay: "2s" }}/>
          
          {/* Декоративные иконки */}
          <div className="absolute top-24 left-24 opacity-20">
            <Sparkles className="w-16 h-16 text-white" />
          </div>
          <div className="absolute bottom-40 right-40 opacity-15">
            <Star className="w-12 h-12 text-white fill-current" />
          </div>
          <div className="absolute top-1/3 right-1/4 opacity-10">
            <Sparkles className="w-20 h-20 text-white" />
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 lg:gap-6 relative -mt-8">
        <div className="min-w-0">
          <AnimatedGradientText className="text-2xl font-bold mb-4 block">
            {t("profile")}
          </AnimatedGradientText>
          
          <MagicCard className="bg-white dark:bg-gray-800 rounded-[20px] shadow-lg p-6 mb-6 border border-gray-200 dark:border-gray-700 relative overflow-hidden">
            <RetroGrid className="opacity-20 hidden md:block" />
            {userCard}
            {tabs}

            {activeTab === "overview" && (
              <BlurFade delay={0.1}>
                <>
                  {safePreviewBlock}
                  {kpiCards}
                  {teacherKpiCards}
                  {adminKpiCards}
                  {adminCharts}
                  {parentMainBlock}
                  {profileExt?.role === "student" && continueLearningCta}
                  {upcomingTasksBlock}
                  {profileExt?.role === "student" && heatmapBlock}
                </>
              </BlurFade>
            )}

            {activeTab === "progress" && showProgressTab && (
              <BlurFade delay={0.1}>
                <>
                  {progressBlock}
                  {activityChart}
                </>
              </BlurFade>
            )}

            {activeTab === "edit" && editForm}
          </MagicCard>
        </div>
        {rightSidebar}
      </div>
    </>
  );
}
