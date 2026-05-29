/**
 * Common Types
 */
export type Gender = 'Мужской' | 'Женский' | 'Другое';
export type InterfaceLanguage = 'Русский' | 'Казахский' | 'Английский';

/**
 * 1. STUDENT
 */
export type StudyForm = 'Очная' | 'Заочная' | 'Очно-заочная';
export type StudentStatusStatus = 'Активный' | 'Неактивный';

export interface StudentProfile {
  // Основная информация
  fullName: string;
  birthDate: string; // date
  gender: Gender;
  nationality: string;
  identityCard: string;
  snilsInn: string;
  photoUrl?: string; // file (jpg, png) -> stored as URL

  // Контактная информация
  email: string;
  phonePersonal: string;
  phoneAlternative?: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;

  // Образовательная информация
  studentIdCardNumber: string;
  specialty: string;
  course: number;
  group: string;
  studyForm: StudyForm;
  admissionDate: string;
  graduationDatePlanned: string;

  // Дополнительно
  status: StudentStatusStatus;
  createdAt: string; // datetime
  lastLogin?: string; // datetime
  interfaceLanguage: InterfaceLanguage;
  timezone: string; // UTC±X
}

/**
 * 2. PARENT
 */
export type KinshipDegree = 'Отец' | 'Мать' | 'Опекун' | 'Другое';
export type EducationalProcessRole = 'Законный представитель' | 'Опекун';

export interface ParentProfile {
  // Основная информация
  fullName: string;
  birthDate: string;
  gender: Gender;
  identityCard: string;
  workPlace?: string;
  position?: string;

  // Контактная информация
  emailWork?: string;
  emailPersonal: string;
  phoneWork?: string;
  phonePersonal: string;
  address: string;

  // Информация о связи со студентом
  kinshipDegree: KinshipDegree;
  studentFullName: string;
  studentId: string; // внешний ключ
  educationalProcessRole: EducationalProcessRole;

  // Настройки и уведомления
  notificationsEmail: boolean;
  notificationsSms: boolean;
  interfaceLanguage: InterfaceLanguage;
  lastLogin?: string;
}

/**
 * 3. TEACHER
 */
export type EmploymentStatus = 'Штатный' | 'Совместитель' | 'Почасовой';
export type TeacherStatus = 'Активный' | 'В отпуске' | 'Неактивный';

export interface TeacherProfile {
  // Основная информация
  fullName: string;
  birthDate: string;
  gender: Gender;
  identityCard: string;
  education: string;
  academicDegree?: string;
  photoUrl?: string;

  // Контактная информация
  emailWork: string;
  emailPersonal: string;
  phoneWork?: string;
  phonePersonal: string;
  office?: string;
  receptionHours?: string | object; // string или json (день, время)

  // Информация о работе
  employeeNumber: string;
  position: string;
  department: string;
  hireDate: string;
  employmentStatus: EmploymentStatus;
  academicInterests?: string; // text (описание)

  // Предметы и курсы
  subjectsTaught: string[];
  studentCounts: number[]; // array (integer)
  teachingHours: string;

  // Дополнительно
  status: TeacherStatus;
  lastLogin?: string;
  interfaceLanguage: InterfaceLanguage;
}

/**
 * 4. ADMINISTRATOR
 */
export type AdminRole = 'Суперадминистратор' | 'Администратор факультета' | 'Администратор кафедры';
export type AdminStatus = 'Активный' | 'В отпуске' | 'Неактивный';
export type Permission = 'Управление пользователями' | 'Управление курсами' | 'Просмотр отчетов' | string;

export interface AdminProfile {
  // Основная информация
  fullName: string;
  birthDate: string;
  gender: Gender;
  identityCard: string;
  educationLevel: string;
  photoUrl?: string;

  // Контактная информация
  emailWork: string;
  emailPersonal: string;
  phoneWork?: string;
  phonePersonal: string;
  office?: string;

  // Информация о работе
  employeeNumber: string;
  position: string;
  department: string;
  hireDate: string;
  status: AdminStatus;

  // Права доступа и разрешения
  systemRole: AdminRole;
  permissions: Permission[];
  areasOfResponsibility: string[]; // факультеты, специальности
  canCreateUsers: boolean;
  canDeleteUsers: boolean;
  canEditCourses: boolean;
  canViewAnalytics: boolean;
  canConfigureSystem: boolean;

  // Дополнительно
  createdAt: string;
  lastLogin?: string;
  ipAddresses?: string[]; // логирование
  interfaceLanguage: InterfaceLanguage;
  twoFactorEnabled: boolean;
}

/**
 * 5. CURATOR
 */
export type CuratorPosition = 'Куратор' | 'Классный руководитель' | 'Наставник';
export type CuratorStatus = 'Активный' | 'В отпуске' | 'Неактивный';

export interface CuratorProfile {
  // Основная информация
  fullName: string;
  birthDate: string;
  gender: Gender;
  identityCard: string;
  education: string;
  academicDegree?: string | null;
  photoUrl?: string;

  // Контактная информация
  emailWork: string;
  emailPersonal: string;
  phoneWork?: string;
  phonePersonal: string;
  office?: string;

  // Информация о работе
  employeeNumber: string;
  position: CuratorPosition;
  department: string;
  hireDate: string;
  status: CuratorStatus;

  // Информация о кураторской деятельности
  assignedGroups: string[]; // ID групп
  studentCountInGroup: number;
  curatedCourses: string[];
  consultationSchedule: string | object; // json (день, время, длительность)
  consultationLocation: string;

  // Функции и обязанности
  canViewPerformance: boolean;
  canMessageStudents: boolean;
  canViewAttendance: boolean;
  canCallParentTeacherMeetings: boolean;
  canCreateGroupAnnouncements: boolean;

  // Дополнительно
  createdAt: string;
  lastLogin?: string;
  interfaceLanguage: InterfaceLanguage;
  notificationsEnabled: boolean;
  timezone: string;
}

export interface ProfileRelationSummary {
  id: number;
  full_name: string;
  email?: string;
  role?: string;
}

export interface SafeProfilePreviewData {
  id: number;
  email: string;
  full_name: string;
  role: string;
  photo_url?: string | null;
  description?: string | null;
  phone?: string | null;
  city?: string | null;
  address?: string | null;
  created_at?: string | null;
  birth_date?: string | null;
  points?: number | null;
  status?: string | null;
  tg_email?: string | null;
  tg_username?: string | null;
  school?: string | null;
  school_name?: string | null;

  // Student
  gender?: string | null;
  nationality?: string | null;
  iin?: string | null;
  identity_card?: string | null;
  phone_alternative?: string | null;
  postal_code?: string | null;
  country?: string | null;
  student_id_card_number?: string | null;
  specialty?: string | null;
  course?: number | null;
  group?: string | null;
  study_form?: string | null;
  admission_date?: string | null;
  graduation_date_planned?: string | null;
  parent?: ProfileRelationSummary | null;
  teacher?: ProfileRelationSummary | null;

  // Parent
  work_place?: string | null;
  kinship_degree?: string | null;
  educational_process_role?: string | null;
  education?: string | null;
  academic_degree?: string | null;
  email_work?: string | null;
  phone_work?: string | null;
  office?: string | null;
  employee_number?: string | null;
  position?: string | null;
  department?: string | null;
  hire_date?: string | null;
  employment_status?: string | null;
  children?: ProfileRelationSummary[] | null;

  // Teacher / curator
  academic_interests?: string | null;
  subjects_taught?: string[] | null;
  teaching_hours?: string | null;
  curated_courses?: string[] | null;
  consultation_location?: string | null;
  reception_hours?: string | null;
  groups?: Array<{ id: number; name: string }> | null;
  students_count?: number | null;

  // Admin / director
  education_level?: string | null;
  system_role?: string | null;
  permissions?: string[] | null;
  areas_of_responsibility?: string[] | null;
  can_create_users?: boolean | null;
  can_delete_users?: boolean | null;
  can_edit_courses?: boolean | null;
  can_view_analytics?: boolean | null;
  can_configure_system?: boolean | null;
  interface_language?: string | null;
}
