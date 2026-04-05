from app.core.database import Base
from app.models.user import User
from app.models.course_category import CourseCategory
from app.models.course import Course
from app.models.course_module import CourseModule
from app.models.course_topic import CourseTopic
from app.models.test import Test
from app.models.test_question import TestQuestion
from app.models.progress import StudentProgress
from app.models.enrollment import CourseEnrollment
from app.models.certificate import Certificate
from app.models.ai_challenge import AIChallenge
from app.models.activity_log import UserActivityLog
from app.models.study_schedule import StudySchedule
from app.models.student_goal import StudentGoal
from app.models.teacher_group import TeacherGroup
from app.models.group_student import GroupStudent
from app.models.teacher_assignment import TeacherAssignment
from app.models.teacher_assignment_rubric import TeacherAssignmentRubric
from app.models.assignment_submission import AssignmentSubmission
from app.models.assignment_submission_grade import AssignmentSubmissionGrade
from app.models.assignment_class_comment import AssignmentClassComment
from app.models.assignment_class_comment import AssignmentClassComment
from app.models.notification import Notification
from app.models.ai_chat_history import AIChatHistory
from app.models.payment import Payment
from app.models.coin_transaction_log import CoinTransactionLog
from app.models.daily_leaderboard_reward import DailyLeaderboardReward
from app.models.shop_item import ShopItem
from app.models.user_purchase import UserPurchase
from app.models.user_favorite import UserFavorite
from app.models.cart_item import CartItem
from app.models.premium_subscription import PremiumSubscription
from app.models.course_application import CourseApplication
from app.models.add_student_task import AddStudentTask
from app.models.teacher_material import TeacherMaterial
from app.models.teacher_question import TeacherQuestion, TeacherQuestionAnswer
from app.models.course_review import CourseReview
from app.models.community_post import CommunityPost
from app.models.community_post_like import CommunityPostLike
from app.models.topic_note import TopicNote
from app.models.student_profile import StudentProfile
from app.models.material_private_comment import MaterialPrivateComment

__all__ = [
    "Base",
    "User",
    "CourseCategory",
    "Course",
    "CourseModule",
    "CourseTopic",
    "Test",
    "TestQuestion",
    "StudentProgress",
    "CourseEnrollment",
    "Certificate",
    "AIChallenge",
    "UserActivityLog",
    "StudySchedule",
    "StudentGoal",
    "TeacherGroup",
    "GroupStudent",
    "TeacherAssignment",
    "TeacherAssignmentRubric",
    "AssignmentSubmission",
    "AssignmentSubmissionGrade",
    "AssignmentClassComment",
    "AssignmentClassComment",
    "Notification",
    "AIChatHistory",
    "Payment",
    "CoinTransactionLog",
    "DailyLeaderboardReward",
    "ShopItem",
    "UserPurchase",
    "UserFavorite",
    "CartItem",
    "PremiumSubscription",
    "CourseApplication",
    "AddStudentTask",
    "TeacherMaterial",
    "TeacherQuestion",
    "TeacherQuestionAnswer",
    "CourseReview",
    "CommunityPost",
    "CommunityPostLike",
    "TopicNote",
    "StudentProfile",
    "MaterialPrivateComment",
]
