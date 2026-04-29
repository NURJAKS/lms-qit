export type AppNotification = {
  id: number;
  type: string;
  title: string;
  message: string;
  link?: string;
  is_read: boolean;
  created_at: string;
  meta?: Record<string, any>;
};


export function formatTranslation(text: string, meta?: Record<string, any>): string {
  if (!text || !meta) return text;
  let result = text;
  for (const key in meta) {
    result = result.replace(new RegExp(`{${key}}`, "g"), String(meta[key]));
  }
  return result;
}

export function getLocalizedNotificationText<K extends string>(
  n: { type: string; title: string; message: string; meta?: any },
  t: (key: K) => string,
) {
  const T = t as (key: string) => string;
  const meta = typeof n.meta === "object" ? n.meta : {};

  const translateAndFormat = (key: string, fallback: string) => {
    const translated = T(key);
    if (translated === key) return formatTranslation(fallback, meta);
    return formatTranslation(translated, meta);
  };

  switch (n.type) {
    case "new_application":
      return {
        title: T("notificationNewApplicationTitle"),
        message: T("notificationNewApplicationBody"),
      };
    case "application_approved":
      return {
        title: T("notificationApplicationApprovedTitle"),
        message: T("notificationApplicationApprovedBody"),
      };
    case "add_student_task":
      return {
        title: T("notificationAddStudentTaskTitle"),
        message: formatTranslation(T("notificationAddStudentTaskBody"), meta),
      };
    case "add_student_task_completed":
      return {
        title: T("notificationAddStudentTaskCompletedTitle"),
        message: T("notificationAddStudentTaskCompletedBody"),
      };
    case "added_to_group":
      return {
        title: T("notificationAddedToGroupTitle"),
        message: formatTranslation(T("notificationAddedToGroupBody"), meta),
      };
    case "course_purchased":
      return {
        title: T("notificationCoursePurchasedTitle"),
        message: formatTranslation(T("notificationCoursePurchasedBody"), meta),
      };
    case "assignment_created":
      return {
        title: T("notificationAssignmentCreatedTitle"),
        message: formatTranslation(T("notificationAssignmentCreatedBody"), meta),
      };
    case "assignment_submitted":
      return {
        title: T("notificationAssignmentSubmittedTitle"),
        message: formatTranslation(T("notificationAssignmentSubmittedBody"), meta),
      };
    case "assignment_graded":
      return {
        title: formatTranslation(T("notificationAssignmentGradedTitle"), meta),
        message: T("notificationAssignmentGradedBody"),
      };
    case "assignment_returned": {
      try {
        const p = typeof n.message === "string" && n.message.startsWith("{") ? JSON.parse(n.message) : n.meta || {};
        const gradeStr =
          p.grade != null && Number.isFinite(Number(p.grade))
            ? String(p.grade)
            : T("notificationAssignmentNoGrade");
        const comment = (p.comment || "").trim();
        const base = T("notificationAssignmentReturnedBody").replace("{grade}", gradeStr);
        const message = comment
          ? `${base} ${T("notificationAssignmentReturnedComment").replace("{comment}", comment)}`
          : base;
        return {
          title: T("notificationAssignmentReturnedTitle"),
          message,
        };
      } catch {
        return {
          title: T("notificationAssignmentReturnedTitle"),
          message: n.message,
        };
      }
    }
    case "material_created":
      return {
        title: T("notificationMaterialCreatedTitle"),
        message: formatTranslation(T("notificationMaterialCreatedBody"), meta),
      };
    case "question_created":
      return {
        title: T("notificationQuestionCreatedTitle"),
        message: formatTranslation(T("notificationQuestionCreatedBody"), meta),
      };
    case "schedule_reminder":
      return {
        title: T("notificationScheduleReminderTitle"),
        message: T("notificationScheduleReminderBody"),
      };
    case "coins_earned":
      return {
        title: T("notificationCoinsEarnedTitle"),
        message: formatTranslation(T("notificationCoinsEarnedBody"), meta),
      };
    case "certificate_issued":
      return {
        title: T("notificationCertificateIssuedTitle"),
        message: T("notificationCertificateIssuedBody"),
      };
    case "ai_challenge_result":
      return {
        title: T("notificationAiChallengeResultTitle"),
        message: T("notificationAiChallengeResultBody"),
      };
    case "test_passed":
      return {
        title: T("notificationTestPassedTitle"),
        message: formatTranslation(T("notificationTestPassedBody"), meta),
      };
    case "test_failed":
      return {
        title: T("notificationTestFailedTitle"),
        message: formatTranslation(T("notificationTestFailedBody"), meta),
      };
    case "news":
      return {
        title: translateAndFormat(n.title, n.title),
        message: translateAndFormat(n.message, n.message),
      };
    case "support_ticket": {
      try {
        const p = typeof n.message === "string" && n.message.startsWith("{") ? JSON.parse(n.message) : n.meta || {};
        const title = T("notificationSupportTicketTitle");
        const bodyTemplate = p.course_title
          ? T("notificationSupportTicketBodyWithCourse")
          : T("notificationSupportTicketBody");

        const message = bodyTemplate
          .replace("{student_name}", p.student_name || "")
          .replace("{course_title}", p.course_title || "")
          .replace("{message_snippet}", p.message_snippet || "");

        return { title, message };
      } catch {
        return {
          title: translateAndFormat(n.title, n.title),
          message: translateAndFormat(n.message, n.message),
        };
      }
    }
    default:
      return {
        title: translateAndFormat(n.title, n.title),
        message: translateAndFormat(n.message, n.message),
      };
  }
}

