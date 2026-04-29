export type AppNotification = {
  id: number;
  type: string;
  title: string;
  message: string;
  link?: string;
  is_read: boolean;
  created_at: string;
};

export function getLocalizedNotificationText<K extends string>(
  n: Pick<AppNotification, "type" | "title" | "message">,
  t: (key: K) => string,
) {
  const T = t as (key: string) => string;
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
        message: T("notificationAddStudentTaskBody"),
      };
    case "add_student_task_completed":
      return {
        title: T("notificationAddStudentTaskCompletedTitle"),
        message: T("notificationAddStudentTaskCompletedBody"),
      };
    case "added_to_group":
      return {
        title: T("notificationAddedToGroupTitle"),
        message: T("notificationAddedToGroupBody"),
      };
    case "course_purchased":
      return {
        title: T("notificationCoursePurchasedTitle"),
        message: T("notificationCoursePurchasedBody"),
      };
    case "assignment_created":
      return {
        title: T("notificationAssignmentCreatedTitle"),
        message: T("notificationAssignmentCreatedBody"),
      };
    case "assignment_submitted":
      return {
        title: T("notificationAssignmentSubmittedTitle"),
        message: T("notificationAssignmentSubmittedBody"),
      };
    case "assignment_graded":
      return {
        title: T("notificationAssignmentGradedTitle"),
        message: T("notificationAssignmentGradedBody"),
      };
    case "assignment_returned": {
      try {
        const p = JSON.parse(n.message) as { grade?: number | null; comment?: string };
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
        message: T("notificationMaterialCreatedBody"),
      };
    case "question_created":
      return {
        title: T("notificationQuestionCreatedTitle"),
        message: T("notificationQuestionCreatedBody"),
      };
    case "schedule_reminder":
      return {
        title: T("notificationScheduleReminderTitle"),
        message: T("notificationScheduleReminderBody"),
      };
    case "coins_earned":
      return {
        title: T("notificationCoinsEarnedTitle"),
        message: T("notificationCoinsEarnedBody"),
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
        message: T("notificationTestPassedBody"),
      };
    case "test_failed":
      return {
        title: T("notificationTestFailedTitle"),
        message: T("notificationTestFailedBody"),
      };
    case "news":
      return {
        title: T(n.title) || n.title,
        message: T(n.message) || n.message,
      };
    case "support_ticket": {
      try {
        const p = JSON.parse(n.message) as {
          student_name: string;
          course_title?: string | null;
          message_snippet: string;
        };
        const title = T("notificationSupportTicketTitle");
        const bodyTemplate = p.course_title
          ? T("notificationSupportTicketBodyWithCourse")
          : T("notificationSupportTicketBody");

        const message = bodyTemplate
          .replace("{student_name}", p.student_name)
          .replace("{course_title}", p.course_title || "")
          .replace("{message_snippet}", p.message_snippet);

        return { title, message };
      } catch {
        return {
          title: T(n.title) || n.title,
          message: T(n.message) || n.message,
        };
      }
    }
    default:
      return {
        title: T(n.title) || n.title,
        message: T(n.message) || n.message,
      };
  }
}

