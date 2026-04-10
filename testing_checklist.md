# LMS Localization Testing Checklist

Use this checklist to verify that UI elements adapt correctly to different languages and that no hardcoded strings remain in key user flows.

## 👤 Student Role
- [ ] **Dashboard (`/app`):** Check "Continue Watching" cards and AI Challenge section.
- [ ] **Courses (`/app/courses`):** Verify category filters and course card titles/descriptions (DB content).
- [ ] **Tasks Calendar (`/app/tasks-calendar`):** Check month/day names and event titles.
- [ ] **Leaderboard (`/app/leaderboard`):** Verify "Points", "Coins", and rank labels.
- [ ] **Shop (`/app/shop`):** Check item names and "Purchase" buttons.
- [ ] **Profile (`/app/profile`):** Check labels for personal data, achievements, and settings.

## 👨‍🏫 Teacher Role
- [ ] **Teacher Dashboard (`/app/teacher`):** Check overview stats (Active Students, Groups).
- [ ] **Assignments:** Verify "Create Assignment" modal and grading interface localized text.
- [ ] **Group Management:** Check labels for adding/removing students.
- [ ] **Materials:** Verify upload buttons and file description labels.

## 🔑 Admin Role
- [ ] **Admin Panel (`/app/admin`):** Verify analytics charts and system logs localization.
- [ ] **User Management:** Check role badges (Admin, Teacher, Student) and status labels.
- [ ] **Content Moderation:** Verify labels for approving/rejecting courses.

## 📱 Mobile & Layout Integrity
- [ ] **Sidebar:** Toggle collapse state; ensure icons and text are aligned.
- [ ] **Language Switcher:** Test switching between KK, RU, EN; verify immediate UI update.
- [ ] **Text Overflow:** Check for broken layouts in Kazakh (longer text) on mobile view.
- [ ] **Modals:** Ensure "Confirm", "Cancel", and error messages in modals are localized.
