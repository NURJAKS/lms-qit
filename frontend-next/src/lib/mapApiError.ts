import type { TranslationKey } from "@/i18n/translations";

/** Backend HTTPException detail may be string, list (validation), or { code, message? }. */
const CODE_TO_KEY: Record<string, TranslationKey> = {
  topic_not_in_course: "errorTopicNotInCourse",
  no_access_group: "errorNoAccessToGroup",
  course_group_mismatch: "errorCourseIdGroupMismatch",
  synopsis_assignment_exists: "assignmentErrorSynopsisExists",
  question_closed: "errorQuestionClosed",
  question_edit_not_allowed: "errorQuestionEditNotAllowed",
  question_already_graded: "errorQuestionAlreadyGraded",
  forbidden: "errorQuestionForbidden",
  not_found: "errorNotFound",
  assignment_class_comments_disabled: "classCommentsPostingDisabled",
  question_class_comments_disabled: "classCommentsPostingDisabled",
};

const LEGACY_DETAIL_PATTERNS: Array<{ test: (s: string) => boolean; key: TranslationKey }> = [
  {
    test: (s) => /тема не найдена/i.test(s) && /курс/i.test(s),
    key: "errorTopicNotInCourse",
  },
  {
    test: (s) => /нет доступа к этой группе/i.test(s),
    key: "errorNoAccessToGroup",
  },
  {
    test: (s) => /course_id/i.test(s) && /не совпадает/i.test(s),
    key: "errorCourseIdGroupMismatch",
  },
  {
    test: (s) =>
      /уже существует/i.test(s) &&
      /конспект/i.test(s) &&
      /задан/i.test(s) &&
      /тем/i.test(s),
    key: "assignmentErrorSynopsisExists",
  },
];

function flattenDetailToString(detail: unknown): string {
  if (detail == null) return "";
  if (typeof detail === "string") return detail.trim();
  if (Array.isArray(detail)) {
    return detail
      .map((x) => {
        if (typeof x === "string") return x;
        if (x && typeof x === "object" && "msg" in x) return String((x as { msg: unknown }).msg ?? "");
        return "";
      })
      .filter(Boolean)
      .join(", ");
  }
  if (typeof detail === "object") {
    const o = detail as Record<string, unknown>;
    if (typeof o.msg === "string") return o.msg.trim();
  }
  return "";
}

export function mapApiErrorToUserMessage(
  detail: unknown,
  t: (key: TranslationKey) => string,
  fallbackKey: TranslationKey = "assignmentErrorCreate"
): string {
  if (detail === null || detail === undefined) {
    return t(fallbackKey);
  }

  if (typeof detail === "string") {
    const trimmed = detail.trim();
    if (
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]"))
    ) {
      try {
        return mapApiErrorToUserMessage(JSON.parse(trimmed) as unknown, t, fallbackKey);
      } catch {
        /* use as plain message */
      }
    }
  }

  if (typeof detail === "object" && !Array.isArray(detail) && detail !== null) {
    const o = detail as Record<string, unknown>;
    if (typeof o.code === "string") {
      const k = CODE_TO_KEY[o.code];
      if (k) return t(k);
    }
    if (o.detail !== undefined && o.detail !== null) {
      if (typeof o.detail === "string" || Array.isArray(o.detail)) {
        return mapApiErrorToUserMessage(o.detail, t, fallbackKey);
      }
      if (typeof o.detail === "object") {
        return mapApiErrorToUserMessage(o.detail, t, fallbackKey);
      }
    }
    if (typeof o.message === "string") {
      return mapApiErrorToUserMessage(o.message, t, fallbackKey);
    }
  }

  const flat = flattenDetailToString(detail);
  if (!flat) return t(fallbackKey);

  for (const { test, key } of LEGACY_DETAIL_PATTERNS) {
    if (test(flat)) return t(key);
  }

  const direct = CODE_TO_KEY[flat];
  if (direct) return t(direct);

  return flat;
}
