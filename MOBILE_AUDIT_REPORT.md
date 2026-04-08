# Mobile Audit Report (LMS)

## Scope

- Viewports: `360-412px`, `375px`, `430px`
- Environment: local dev (`http://localhost:3000`)
- Roles in scope: Student, Teacher, Admin, Parent
- Audit method: route inventory + component-level responsive review + live teacher-flow checks on local session

## Route Checklist

### Auth
- `/login`
- `/register`
- `/confirm-purchase/[token]`

### Shared App
- `/app`
- `/app/assignments`
- `/app/analytics`
- `/app/community`
- `/app/leaderboard`
- `/app/materials`
- `/app/people`
- `/app/premium`
- `/app/profile`
- `/app/profile/[userId]`
- `/app/schedule`
- `/app/shop`
- `/app/tasks-calendar`
- `/app/todo`
- `/app/ai-challenge`
- `/app/ai-challenge/[courseId]`

### Student Courses
- `/app/courses`
- `/app/courses/[courseId]`
- `/app/courses/[courseId]/topic/[topicId]`
- `/courses`
- `/course-picker`

### Teacher
- `/app/teacher`
- `/app/teacher/courses`
- `/app/teacher/courses/review`
- `/app/teacher/courses/[groupId]`
- `/app/teacher/courses/[groupId]/assignment/[assignmentId]`
- `/app/teacher/view-answers/[id]`
- `/app/teacher/view-questions/[id]`

### Admin
- `/app/admin`
- `/app/admin/overview`
- `/app/admin/analytics`
- `/app/admin/users`
- `/app/admin/shop`
- `/app/admin/reviews`
- `/app/admin/applications`
- `/app/admin/moderation`
- `/app/admin/courses`
- `/app/admin/courses/moderation`
- `/app/admin/courses/tests`
- `/app/admin/tests/[courseId]`

### Parent
- `/app/parent-dashboard`
- `/app/parent-rating`

## Findings (Prioritized)

### Critical

1. Mobile drawer did not lock body scroll while open in main app shell.  
   Impact: background scroll conflicts and accidental context loss while menu is open.

### High

2. Mobile header brand text could overflow in narrow widths or long localized platform names.  
   Impact: top bar crowding and reduced tap comfort.
3. Bottom navigation labels were prone to clipping/compression with long i18n labels.  
   Impact: reduced readability and navigation confidence.
4. Gradebook controls were desktop-biased (`min-width` constraints), causing excessive horizontal pressure on phones.  
   Impact: difficult grading flow on narrow devices.
5. Assignment hand-in confirmation dialog used center modal behavior not optimized for small screens.  
   Impact: cramped controls and reduced usability with software keyboard / short viewport.

### Medium

6. Several dense teacher/student pages rely on horizontal overflow patterns (gradebook/classwork/modals).  
   Impact: discoverability friction unless explicit scroll affordance exists.
7. Admin layout uses universal `p-6`; very dense admin pages can feel tight on 360-375px.  
   Impact: content density and first-screen clarity.

## Implemented Fixes

- `frontend-next/src/components/dashboard/AppDashboardSidebar.tsx`
  - Added body scroll lock while mobile drawer is open.
  - Added `Escape` key close handler for drawer.
  - Added `aria-expanded` and `aria-controls` on menu trigger.
  - Truncated platform name in mobile header to prevent overflow.

- `frontend-next/src/components/dashboard/MobileBottomNav.tsx`
  - Switched nav items to flexible width per tab (`flex-1`, `min-w-0`).
  - Added truncation + centered label rendering for long localized text.
  - Added small inter-item gap for visual separation.

- `frontend-next/src/components/teacher/TeacherGradebook.tsx`
  - Improved mobile sizing for sort select (`min-w-0` on small screens).
  - Reduced first-column and assignment-column minimum widths on phone.
  - Added mobile scroll hint above horizontal table region.

- `frontend-next/src/components/courses/StudentCourseClasswork.tsx`
  - Converted confirm dialog to mobile-friendly bottom-sheet alignment on small screens.
  - Added max-height + internal scroll to prevent clipped dialog content.
  - Stacked action buttons on mobile for safer touch interactions.

## Regression Checklist (Post-fix)

- Open/close mobile menu repeatedly on `/app`, confirm no background scroll bleed.
- Validate header brand layout at `360px`, `375px`, `430px`.
- Validate bottom nav labels in RU/KK/EN, no overlap/truncation glitches.
- In teacher gradebook, verify table remains usable with horizontal scroll.
- In assignment detail, open submit confirmation and verify all actions visible on 360px.
