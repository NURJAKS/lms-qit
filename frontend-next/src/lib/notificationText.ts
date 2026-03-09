export type AppNotification = {
  id: number;
  type: string;
  title: string;
  message: string;
  link?: string;
  is_read: boolean;
  created_at: string;
};

type TFunction = (key: string, vars?: Record<string, unknown>) => string;

export function getLocalizedNotificationText(
  n: Pick<AppNotification, "type" | "title" | "message">,
  t: TFunction,
) {
  switch (n.type) {
    case "new_application":
      return {
        title: t("notificationNewApplicationTitle"),
        message: t("notificationNewApplicationBody"),
      };
    case "application_approved":
      return {
        title: t("notificationApplicationApprovedTitle"),
        message: t("notificationApplicationApprovedBody"),
      };
    case "add_student_task":
      return {
        title: t("notificationAddStudentTaskTitle"),
        message: t("notificationAddStudentTaskBody"),
      };
    case "add_student_task_completed":
      return {
        title: t("notificationAddStudentTaskCompletedTitle"),
        message: t("notificationAddStudentTaskCompletedBody"),
      };
    case "added_to_group":
      return {
        title: t("notificationAddedToGroupTitle"),
        message: t("notificationAddedToGroupBody"),
      };
    case "course_purchased":
      return {
        title: t("notificationCoursePurchasedTitle"),
        message: t("notificationCoursePurchasedBody"),
      };
    case "assignment_created":
      return {
        title: t("notificationAssignmentCreatedTitle"),
        message: t("notificationAssignmentCreatedBody"),
      };
    case "assignment_submitted":
      return {
        title: t("notificationAssignmentSubmittedTitle"),
        message: t("notificationAssignmentSubmittedBody"),
      };
    case "assignment_graded":
      return {
        title: t("notificationAssignmentGradedTitle"),
        message: t("notificationAssignmentGradedBody"),
      };
    case "material_created":
      return {
        title: t("notificationMaterialCreatedTitle"),
        message: t("notificationMaterialCreatedBody"),
      };
    case "question_created":
      return {
        title: t("notificationQuestionCreatedTitle"),
        message: t("notificationQuestionCreatedBody"),
      };
    case "schedule_reminder":
      return {
        title: t("notificationScheduleReminderTitle"),
        message: t("notificationScheduleReminderBody"),
      };
    case "coins_earned":
      return {
        title: t("notificationCoinsEarnedTitle"),
        message: t("notificationCoinsEarnedBody"),
      };
    case "certificate_issued":
      return {
        title: t("notificationCertificateIssuedTitle"),
        message: t("notificationCertificateIssuedBody"),
      };
    case "ai_challenge_result":
      return {
        title: t("notificationAiChallengeResultTitle"),
        message: t("notificationAiChallengeResultBody"),
      };
    default:
      return {
        title: n.title,
        message: n.message,
      };
  }
}

