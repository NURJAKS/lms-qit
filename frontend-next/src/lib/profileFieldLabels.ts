import type { TranslationKey } from "@/i18n/translations";

type TFn = (key: TranslationKey) => string;

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Display label for profile status from API (canonical Russian + common variants). */
export function mapProfileStatus(value: string | null | undefined, t: TFn): string {
  if (value == null || value === "") return "";
  const n = norm(value);
  if (
    n === "активный" ||
    n === "активен" ||
    n === "active" ||
    n === "белсенді"
  ) {
    return t("profileStatusActive");
  }
  if (
    n === "неактивный" ||
    n === "неактивен" ||
    n === "inactive" ||
    n === "белсенді емес"
  ) {
    return t("profileStatusInactive");
  }
  if (n === "в отпуске" || n === "on leave" || n === "демалыста" || n === "vacation") {
    return t("profileStatusVacation");
  }
  return value;
}

export function mapEmploymentStatus(value: string | null | undefined, t: TFn): string {
  if (value == null || value === "") return "";
  const n = norm(value);
  if (
    n === "штатный" ||
    n === "full-time" ||
    n === "full time" ||
    n === "штаты" ||
    n === "штаттық"
  ) {
    return t("profileEmploymentFullTime");
  }
  if (
    n === "совместитель" ||
    n === "part-time" ||
    n === "part time" ||
    n === "қосымша жұмыс"
  ) {
    return t("profileEmploymentPartTime");
  }
  if (n === "почасовой" || n === "hourly" || n === "сағаттық") {
    return t("profileEmploymentHourly");
  }
  return value;
}

export function mapEducationLevel(value: string | null | undefined, t: TFn): string {
  if (value == null || value === "") return "";
  const n = norm(value);
  const bachelor =
    n === norm("Высшее (бакалавр)") ||
    n === norm("Higher education (bachelor)") ||
    n.includes("бакалавр") ||
    n === "bachelor";
  if (bachelor) return t("educationLevelBachelor");
  const master =
    n === norm("Высшее (магистр)") ||
    n === norm("Higher education (master)") ||
    n.includes("магистр") ||
    n === "master";
  if (master) return t("educationLevelMaster");
  const specialist =
    n === norm("Высшее (специалист)") ||
    n === norm("Higher education (specialist)") ||
    n.includes("специалист") ||
    n === "specialist";
  if (specialist) return t("educationLevelSpecialist");
  const secondary =
    n === norm("Среднее специальное") ||
    n === norm("Secondary specialized") ||
    n.includes("среднее специальное") ||
    n === "secondary specialized";
  if (secondary) return t("educationLevelSecondarySpecial");
  return value;
}

export function mapSystemRole(value: string | null | undefined, t: TFn): string {
  if (value == null || value === "") return "";
  const n = norm(value);
  if (
    n === norm("Суперадминистратор") ||
    n === "super admin" ||
    n === "superadmin" ||
    n === "суперадмин"
  ) {
    return t("profileSystemRoleSuperAdmin");
  }
  if (
    n === norm("Администратор факультета") ||
    n === "faculty admin" ||
    n === "факультет әкімшісі"
  ) {
    return t("profileSystemRoleFacultyAdmin");
  }
  if (
    n === norm("Администратор кафедры") ||
    n === "department admin" ||
    n === "кафедра әкімшісі"
  ) {
    return t("profileSystemRoleDepartmentAdmin");
  }
  return value;
}

export function mapKinshipDegree(value: string | null | undefined, t: TFn): string {
  if (value == null || value === "") return "";
  const n = norm(value);
  if (n === "отец" || n === "father" || n === "әке") return t("kinshipFather");
  if (n === "мать" || n === "mother" || n === "ана") return t("kinshipMother");
  if (n === "опекун" || n === "guardian" || n === "қамқоршы") return t("kinshipGuardian");
  if (n === "другое" || n === "other" || n === "басқа") return t("kinshipOther");
  return value;
}

export function mapEducationalProcessRole(value: string | null | undefined, t: TFn): string {
  if (value == null || value === "") return "";
  const n = norm(value);
  if (
    n === norm("Законный представитель") ||
    n === "legal representative" ||
    n === "заңды өкіл"
  ) {
    return t("eduRoleLegalRepresentative");
  }
  if (n === "опекун" || n === "guardian" || n === "қамқоршы") {
    return t("eduRoleGuardian");
  }
  return value;
}

export function mapStudyForm(value: string | null | undefined, t: TFn): string {
  if (value == null || value === "") return "";
  const n = norm(value);
  if (n === "очная" || n === "full-time study" || n === "күндізгі") return t("profileStudyFullTime");
  if (n === "заочная" || n === "part-time study" || n === "сырттай") return t("profileStudyPartTime");
  if (n === "очно-заочная" || n === "mixed" || n === "аралас") return t("profileStudyMixed");
  return value;
}

export function formatProfileStudyDuration(totalSeconds: number, t: TFn): string {
  const studyHours = Math.floor(totalSeconds / 3600);
  const studyMins = Math.floor((totalSeconds % 3600) / 60);
  if (studyHours > 0) {
    return t("profileStudyTimeHoursMinutes")
      .replace("{hours}", String(studyHours))
      .replace("{minutes}", String(studyMins));
  }
  if (studyMins > 0) {
    return t("profileStudyTimeMinutesOnly").replace("{minutes}", String(studyMins));
  }
  return t("profileStudyTimeZero");
}

export function profileEmptyDash(t: TFn): string {
  return t("profileValueEmpty");
}
