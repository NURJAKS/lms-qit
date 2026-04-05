# Промпты для AI-агентов: Реализация раздела «Курсы» (Google Classroom-стиль)

> Запускай задачи **строго по порядку** (1 → 2 → 3 → 4 → 5). Каждая задача зависит от предыдущей.

---

## ЗАДАЧА 1 — Бэкенд: новый эндпоинт `GET /api/teacher/submissions/inbox`

**Модель:** Gemini 2.5 Flash или Haiku 3.5 (быстрая задача, один файл)

### Промпт:

```
Ты работаешь над LMS-платформой (FastAPI + SQLAlchemy).

КОНТЕКСТ ПРОЕКТА:
- Бэкенд: /home/nurjaks/Development/LMS platform - order/backend/
- Файл роутов учителя: backend/app/api/routes/teacher.py (prefix="/teacher")
- Модели: TeacherGroup (teacher_groups), TeacherAssignment (teacher_assignments), AssignmentSubmission (assignment_submissions), GroupStudent (group_students)
- Авторизация: get_current_teacher_user из app.api.deps
- БД: get_db из app.core.database
- API клиент на фронте делает запросы к /api/teacher/...

ЗАДАНИЕ:
Добавь НОВЫЙ эндпоинт в файл backend/app/api/routes/teacher.py:

GET /submissions/inbox

Этот эндпоинт нужен для экрана "Непроверенные задания" учителя (как в Google Classroom). Он возвращает список заданий (НЕ отдельные сдачи студентов, а именно ЗАДАНИЯ) с агрегированными счётчиками.

Query-параметры:
- status: str | None = Query(None) — "pending" (есть хотя бы одна непроверенная сдача) или "graded" (все сдачи проверены)
- group_id: int | None = Query(None) — фильтр по конкретной группе (курсу)

Логика:
1. Получить group_ids текущего учителя (для admin/director/curator — все группы). Используй тот же паттерн как в существующих эндпоинтах:
   ```python
   is_admin = current_user.role in ("admin", "director", "curator")
   q_groups = db.query(TeacherGroup)
   if not is_admin:
       q_groups = q_groups.filter(TeacherGroup.teacher_id == current_user.id)
   ```
2. Если передан group_id — фильтровать только по нему
3. Получить все TeacherAssignment для этих групп (только type="assignment", т.е. обычные задания из таблицы teacher_assignments)
4. Для каждого задания посчитать:
   - total_students: количество студентов в группе (len(group.students))
   - submitted_count: количество AssignmentSubmission по этому assignment_id
   - graded_count: количество AssignmentSubmission где grade IS NOT NULL
5. Фильтрация по status:
   - "pending": оставить только задания, где есть хотя бы одна сдача с grade IS NULL (submitted_count > graded_count)
   - "graded": оставить только задания, где все сдачи проверены (graded_count >= submitted_count > 0) или для вкладки проверенных — где graded_count > 0
6. Группировать по наличию/отсутствию дедлайна для фронтенда

Формат ответа — массив объектов:
```json
[
  {
    "id": 123,
    "title": "2-модуль: Массивтер",
    "group_id": 5,
    "group_name": "пайтон курсы",
    "course_id": 1,
    "course_title": "Основы программирования на Python",
    "deadline": "2026-05-21T23:59:00+00:00",
    "created_at": "2026-04-01T10:00:00+00:00",
    "submitted_count": 0,
    "total_students": 1,
    "graded_count": 0
  }
]
```

Сортировка: по deadline (null — в начало), затем по created_at desc.

ВАЖНО:
- НЕ трогай существующие эндпоинты
- Добавь новый эндпоинт ПОСЛЕ блока с @router.get("/recent-submissions") (примерно после строки 350)
- Следуй стилю кода: type hints через Annotated, Depends, docstring на русском
- Импорты уже есть в файле (TeacherGroup, TeacherAssignment, AssignmentSubmission, GroupStudent и т.д.)
```

---

## ЗАДАЧА 2 — Фронтенд: добавить пункт «Курсы» в сайдбар учителя

**Модель:** Gemini 2.5 Flash или Haiku 3.5 (небольшая задача, 3 файла)

### Промпт:

```
Ты работаешь над LMS-платформой на Next.js 14 (App Router) + TypeScript.

КОНТЕКСТ:
- Проект: /home/nurjaks/Development/LMS platform - order/frontend-next/
- Сайдбар: src/components/dashboard/AppDashboardSidebar.tsx
- Мобильная навигация: src/components/dashboard/MobileBottomNav.tsx
- Переводы: src/i18n/translations.ts (три языка: ru, kk, en)
- Иконки: lucide-react (уже используется)

ЗАДАНИЕ:
Добавь новый пункт навигации «Курсы» для учителя в боковую панель. Этот пункт будет виден ТОЛЬКО для учителей (isTeacher() === true).

### 1. Файл: src/i18n/translations.ts

Добавь следующие ключи переводов в ВСЕ три секции (ru, kk, en):

В секцию `ru` (после ключа `teacher`):
```
teacherCoursesTab: 'Курсы',
teacherCoursesTabHint: 'Курсы, которые я преподаю',
unreviewedAssignments: 'Непроверенные задания',
reviewedAssignments: 'Проверенные',
allCourses: 'Все курсы',
noUnreviewedWork: 'Непроверенных работ нет',
noUnreviewedWorkHint: 'Здесь будут все задания и работы всех ваших курсов.',
noReviewedWork: 'Проверенных работ нет',
noReviewedWorkHint: 'Здесь будут работы, которые вы проверили.',
courseStream: 'Лента',
courseClasswork: 'Задания',
coursePeople: 'Пользователи',
courseGrades: 'Оценки',
courseCode: 'Код курса',
upcoming: 'Предстоящие',
viewAll: 'Посмотреть всё',
newAnnouncement: 'Новое объявление',
republish: 'Опубликовать повторно',
courseTeachers: 'Преподаватели',
courseStudents: 'Учащиеся',
inviteStudents: 'Пригласить учащихся',
gradesEmptyHint: 'Здесь вы сможете просматривать и изменять оценки.',
classworkEmpty: 'Страница назначения работ',
classworkEmptyHint: 'Здесь вы можете добавлять задания для курса, а затем систематизировать их по темам.',
submitted: 'Сдано',
assigned: 'Назначено',
graded: 'Поставлена оценка',
noDueDate: 'Без срока сдачи',
currentAssignments: 'Текущие задания',
topicFilter: 'Фильтр по теме',
allTopics: 'Все темы',
collapseAll: 'Свернуть всё',
viewYourWork: 'Посмотреть свои работы',
```

В секцию `kk` те же ключи с казахским переводом:
```
teacherCoursesTab: 'Курстар',
teacherCoursesTabHint: 'Мен оқытатын курстар',
unreviewedAssignments: 'Тексерілмеген тапсырмалар',
reviewedAssignments: 'Тексерілгендер',
allCourses: 'Барлық курстар',
noUnreviewedWork: 'Тексерілмеген жұмыстар жоқ',
noUnreviewedWorkHint: 'Мұнда барлық курстарыңыздың тапсырмалары мен жұмыстары болады.',
noReviewedWork: 'Тексерілген жұмыстар жоқ',
noReviewedWorkHint: 'Мұнда сіз тексерген жұмыстар болады.',
courseStream: 'Лента',
courseClasswork: 'Тапсырмалар',
coursePeople: 'Қатысушылар',
courseGrades: 'Бағалар',
courseCode: 'Курс коды',
upcoming: 'Алдағылар',
viewAll: 'Барлығын көру',
newAnnouncement: 'Жаңа хабарлама',
republish: 'Қайта жариялау',
courseTeachers: 'Оқытушылар',
courseStudents: 'Оқушылар',
inviteStudents: 'Оқушыларды шақыру',
gradesEmptyHint: 'Мұнда бағаларды қарап, өзгерте аласыз.',
classworkEmpty: 'Жұмыстарды тағайындау беті',
classworkEmptyHint: 'Мұнда курс үшін тапсырмалар қосуға болады, содан кейін оларды тақырыптар бойынша жүйелеуге болады.',
submitted: 'Тапсырылды',
assigned: 'Тағайындалды',
graded: 'Баға қойылды',
noDueDate: 'Мерзімі жоқ',
currentAssignments: 'Ағымдағы тапсырмалар',
topicFilter: 'Тақырып сүзгісі',
allTopics: 'Барлық тақырыптар',
collapseAll: 'Барлығын жию',
viewYourWork: 'Өз жұмыстарыңызды қараңыз',
```

В секцию `en`:
```
teacherCoursesTab: 'Courses',
teacherCoursesTabHint: 'Courses I teach',
unreviewedAssignments: 'To review',
reviewedAssignments: 'Reviewed',
allCourses: 'All courses',
noUnreviewedWork: 'No work to review',
noUnreviewedWorkHint: 'All assignments and work from your courses will appear here.',
noReviewedWork: 'No reviewed work',
noReviewedWorkHint: 'Work that you have reviewed will appear here.',
courseStream: 'Stream',
courseClasswork: 'Classwork',
coursePeople: 'People',
courseGrades: 'Grades',
courseCode: 'Class code',
upcoming: 'Upcoming',
viewAll: 'View all',
newAnnouncement: 'New announcement',
republish: 'Reuse post',
courseTeachers: 'Teachers',
courseStudents: 'Students',
inviteStudents: 'Invite students',
gradesEmptyHint: 'Here you can view and change grades.',
classworkEmpty: 'This is where you assign work',
classworkEmptyHint: 'You can add assignments for the course and then organize them by topics.',
submitted: 'Turned in',
assigned: 'Assigned',
graded: 'Graded',
noDueDate: 'No due date',
currentAssignments: 'Current assignments',
topicFilter: 'Topic filter',
allTopics: 'All topics',
collapseAll: 'Collapse all',
viewYourWork: 'View your work',
```

### 2. Файл: src/components/dashboard/AppDashboardSidebar.tsx

Найди строку 164:
```typescript
...(isTeacher() ? [{ href: "/app/teacher", icon: Users, label: t("teacher") }] : []),
```

ПОСЛЕ этой строки добавь:
```typescript
...(isTeacher() ? [{ href: "/app/teacher/courses", icon: BookOpen, label: t("teacherCoursesTab") }] : []),
```

Иконка BookOpen уже импортирована в этом файле.

### 3. Файл: src/components/dashboard/MobileBottomNav.tsx

Найди блок (строки 20-26):
```typescript
...(isTeacher() ? [
  {
    href: "/app/teacher",
    icon: Users,
    label: t("teacher"),
  }
] : [
```

Замени его на:
```typescript
...(isTeacher() ? [
  {
    href: "/app/teacher",
    icon: Users,
    label: t("teacher"),
  },
  {
    href: "/app/teacher/courses",
    icon: BookOpen,
    label: t("teacherCoursesTab"),
  }
] : [
```

И добавь BookOpen в импорт иконок:
```typescript
import { LayoutDashboard, BookOpen, Trophy, User, Users } from "lucide-react";
```

ВАЖНО:
- НЕ удаляй и не меняй существующие пункты навигации
- НЕ трогай другие файлы
- Убедись что TypeScript типы корректны (ключи переводов автоматически будут типизированы через TranslationKey)
```

---

## ЗАДАЧА 3 — Фронтенд: Layout раздела курсов + страница «Непроверенные задания»

**Модель:** Auto / Claude (большая задача с UI)

### Промпт:

```
Ты работаешь над LMS-платформой на Next.js 14 (App Router) + TypeScript + Tailwind CSS.

КОНТЕКСТ ПРОЕКТА:
- Проект: /home/nurjaks/Development/LMS platform - order/frontend-next/
- API клиент: import { api } from "@/api/client" — axios instance, baseURL="/api"
- Запросы: @tanstack/react-query (useQuery, useMutation, useQueryClient)
- Тема: useTheme() из @/context/ThemeContext — возвращает { theme: "light" | "dark", toggleTheme }
- Стили: import { getGlassCardStyle, getTextColors, getInputStyle } from "@/utils/themeStyles" — функции для получения стилей в зависимости от темы
- Языки: useLanguage() из @/context/LanguageContext — возвращает { t, lang, setLang }
- Авторизация: useAuthStore() из @/store/authStore — { user, isTeacher, canManageUsers }
- Анимации: import { BlurFade } from "@/components/ui/blur-fade"
- Иконки: lucide-react

API эндпоинты которые УЖЕ СУЩЕСТВУЮТ:
- GET /api/teacher/groups — список групп учителя: [{id, course_id, course_title, group_name, teacher_id, students_count, created_at}]
- GET /api/teacher/assignments?group_id=N — задания группы
- GET /api/teacher/submissions/inbox?status=pending|graded&group_id=N — НОВЫЙ эндпоинт, возвращает: [{id, title, group_id, group_name, course_id, course_title, deadline, created_at, submitted_count, total_students, graded_count}]

Стиль UI проекта:
- Тёмная тема: glass-morphism карточки (rgba(26, 34, 56, 0.7), blur, border rgba(255,255,255,0.12))
- Светлая тема: белые карточки, тонкие серые бордеры
- Градиенты кнопок: linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)
- Шрифт заголовков: font-geologica
- Скругление: rounded-2xl / rounded-xl
- Класс CSS для hover: card-glow-hover

ЗАДАНИЕ:
Создай 3 файла:

### Файл 1: src/app/app/teacher/courses/layout.tsx

Layout в стиле Google Classroom с левой боковой панелью.

Структура:
```
+------------------------------------------+
| Левая панель (280px)  | Основной контент  |
| ----------------------|                   |
| [Курсы, которые       |   {children}      |
|  я преподаю]    ▼      |                   |
| [Непроверенные задания]|                   |
| [Курс 1 (карточка)]   |                   |
| [Курс 2 (карточка)]   |                   |
+------------------------------------------+
```

Левая панель:
- Заголовок-dropdown "Курсы, которые я преподаю" (как в Google Classroom) — при клике сворачивается/разворачивается
- Ссылка "Непроверенные задания" → /app/teacher/courses/review — с иконкой FileText
- Список курсов (из GET /teacher/groups): каждый курс показывается как:
  - Цветная буква-аватар (первая буква group_name) с цветом из массива акцентных цветов
  - group_name (жирным)
  - Год (из created_at, например "2026") — бледным серым
  - При клике → /app/teacher/courses/[group.id]
  - Активная ссылка подсвечивается (background синий)
- На мобильных (<1024px) левая панель скрыта, показывается только контент

Используй usePathname() для подсветки активной ссылки. Загружай данные через useQuery с ключом "teacher-groups".

На мобильных левая панель должна скрываться, но добавь кнопку-гамбургер для её показа через drawer.

### Файл 2: src/app/app/teacher/courses/page.tsx

Главная страница раздела — показывает карточки курсов как в Google Classroom:

Каждая карточка (grid, 1-3 карточки в ряд):
- Верх: синий градиентный баннер (height: 100px) с названием группы и годом (белым текстом, жирный)
- Середина: ближайший дедлайн — "Срок сдачи: четверг 23:59 — название_задания" (берём из assignments)
- Низ: три иконки-кнопки (BarChart3, FolderOpen, MoreVertical) — пока без функционала, просто заглушки
- При клике на карточку → /app/teacher/courses/[group.id]

Данные: GET /teacher/groups для списка, и для каждой группы запросить GET /teacher/assignments?group_id=N для получения ближайшего дедлайна.

Кнопка "+" (создать курс) — справа сверху — при клике открывает модальное окно с:
- Select: выбор курса из каталога (GET /courses?is_active=true)
- Input: название группы
- Кнопка "Создать" → POST /teacher/groups с { course_id, group_name }

### Файл 3: src/app/app/teacher/courses/review/page.tsx

Страница "Непроверенные задания" как в Google Classroom.

Верх:
- Заголовок "Непроверенные задания"
- Две вкладки: "Непроверенные задания" | "Проверенные" (tab-переключатель)

Под вкладками:
- Dropdown "Все курсы" — фильтр по group_id (группе/курсу). Опции: "Все курсы" + каждая группа учителя (из GET /teacher/groups)

Вкладка "Непроверенные задания" (status=pending):
- Запрос: GET /teacher/submissions/inbox?status=pending(&group_id=N если выбран)
- Задания группируются:
  1. "Без срока сдачи" — задания где deadline === null, с числом в badge и стрелкой для свернуть/развернуть
  2. "Текущие задания" — задания с deadline, с числом в badge и стрелкой

Каждое задание — строка:
- Иконка задания (FileText)
- Название (жирное)
- Подпись: "group_name • Срок сдачи: дата" (если есть дедлайн)
- Справа три числа:
  - submitted_count / "Сдано"
  - total_students / "Назначено"
  - graded_count / "Поставлена оценка"
- Кнопка ⋮ (меню, пока заглушка)
- При клике на задание → /app/teacher/view-answers/[assignment.id] (уже существующая страница)

Вкладка "Проверенные" (status=graded):
- То же самое, но GET /teacher/submissions/inbox?status=graded
- Аналогичная структура

Пустые состояния:
- Если нет данных — показать иллюстрацию (можно простой SVG/emoji) + текст:
  - Непроверенные: "Непроверенных работ нет" + "Здесь будут все задания и работы всех ваших курсов."
  - Проверенные: "Проверенных работ нет" + "Здесь будут работы, которые вы проверили."

СТИЛЬ:
- Используй те же утилиты что в проекте: getGlassCardStyle(theme), getTextColors(theme), getInputStyle(theme)
- Поддержка light/dark theme через useTheme()
- Локализация всех строк через t("ключ") — ключи уже добавлены в translations.ts
- "use client" в начале каждого файла
- Проверь что все импорты корректны

Пример импортов для каждого файла:
```tsx
"use client";
import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useAuthStore } from "@/store/authStore";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { getGlassCardStyle, getTextColors, getInputStyle, getModalStyle } from "@/utils/themeStyles";
import { BlurFade } from "@/components/ui/blur-fade";
import { Plus, FileText, ChevronDown, ChevronRight, BarChart3, FolderOpen, MoreVertical, Users, BookOpen } from "lucide-react";
```
```

---

## ЗАДАЧА 4 — Фронтенд: Страница курса (класса) с вкладками

**Модель:** Auto / Claude (большая задача)

### Промпт:

```
Ты работаешь над LMS-платформой на Next.js 14 (App Router) + TypeScript + Tailwind CSS.

КОНТЕКСТ ПРОЕКТА (такой же как в Задаче 3):
- Проект: /home/nurjaks/Development/LMS platform - order/frontend-next/
- API: import { api } from "@/api/client" (axios, baseURL="/api")
- React Query: useQuery, useMutation
- Тема: useTheme() → { theme, toggleTheme }; стили из @/utils/themeStyles
- Языки: useLanguage() → { t, lang }
- Auth: useAuthStore() → { user, isTeacher }
- Анимации: BlurFade из @/components/ui/blur-fade

Существующие API:
- GET /teacher/groups — [{id, course_id, course_title, group_name, teacher_id, students_count, created_at}]
- GET /teacher/groups/{groupId}/students — [{id, full_name, email}]
- GET /teacher/assignments?group_id=N — [{id, type, group_id, group_name, course_id, course_title, topic_id, title, description, deadline, closed_at, is_closed, created_at}]
- GET /teacher/assignments/{id}/submissions — {submissions: [{id, student_id, student_name, grade, status, submitted_at, ...}], rubric: [...], assignment: {title, description, max_points, deadline, group_name}}
- GET /courses/{courseId}/topics — [{id, title}]
- POST /teacher/assignments — создание задания
- POST /teacher/groups/{groupId}/students — {student_id: N}
- GET /teacher/materials — [{id, group_name, course_title, title}]
- GET /teacher/questions — [{id, group_name, question_text, ...}]

Ключи переводов (уже в translations.ts):
courseStream, courseClasswork, coursePeople, courseGrades, courseCode, upcoming, viewAll, newAnnouncement, republish, courseTeachers, courseStudents, inviteStudents, gradesEmptyHint, classworkEmpty, classworkEmptyHint, submitted, assigned, graded, noDueDate, currentAssignments, topicFilter, allTopics, collapseAll, viewYourWork, teacherCreate, teacherCreateAssignment, teacherCreateQuestion, teacherCreateMaterial, teacherCreateTopic

ЗАДАНИЕ:
Создай файл: src/app/app/teacher/courses/[groupId]/page.tsx

Страница одного курса (класса) с 4 вкладками, как в Google Classroom. groupId — это id из TeacherGroup.

### Общий layout страницы:

Верх:
- Название группы (group_name) и год (из created_at) — как заголовок страницы
- Горизонтальные вкладки: "Лента" | "Задания" | "Пользователи" | "Оценки"
- Используй useState для activeTab (stream/classwork/people/grades), дефолт "stream"

### Вкладка "Лента" (stream):

Двухколоночный layout:
- Левая колонка (узкая, ~300px):
  - Блок "Код курса": показать ID группы (group.id) как код + кнопка копирования
  - Блок "Предстоящие": показать ближайший дедлайн из assignments (deadline не null, is_closed === false), формат "Срок сдачи: дата — название". Ссылка "Посмотреть всё" → переключение на вкладку classwork
- Правая колонка (основная):
  - Кнопки "Новое объявление" и "Опубликовать повторно" (заглушки, не функциональные)
  - Лента активности: показать последние задания/материалы/вопросы по этой группе (из GET /teacher/assignments?group_id=groupId), формат:
    - Иконка (FileText для assignment, MessageCircle для question, BookOpen для material)
    - "Учитель опубликовал новое задание: название"
    - Время (created_at, отформатированное)

### Вкладка "Задания" (classwork):

- Кнопка "+ Создать" (dropdown как в Classroom):
  - Задание
  - Задание с тестом
  - Вопрос
  - Материал
  - Тема
  - НЕ реализуй создание внутри этой страницы! При клике перенаправляй на существующую страницу /app/teacher?tab=groups (или открывай модалку — для MVP просто router.push)

- Фильтр "Все темы" (dropdown) — из GET /courses/{course_id}/topics
- Кнопки "Посмотреть свои работы" и "Свернуть всё"

- Список заданий сгруппированных по topic:
  - Заголовок темы (topic.title) с кнопками свернуть (ChevronUp) и ⋮ (меню)
  - Внутри — задания/материалы/вопросы:
    - Иконка типа
    - Название
    - Справа: дедлайн ("Due May 9, 11:59 PM") или "No due date"
    - Кнопка ⋮

### Вкладка "Пользователи" (people):

- Секция "Преподаватели":
  - Показать текущего пользователя (user из useAuthStore), или имя учителя группы
  - Кнопка приглашения преподавателя (заглушка)

- Секция "Учащиеся":
  - Счётчик: "N учащийся"
  - Кнопка "+" для приглашения — откроет модалку для добавления студента
  - Список студентов (GET /teacher/groups/{groupId}/students): имя + кнопка ⋮
  - Чекбоксы и кнопка "Действия" (пока заглушки)

### Вкладка "Оценки" (grades):

- Пустое состояние (пока нет данных для таблицы оценок):
  - Иллюстрация (простая SVG/иконка)
  - Текст: "Здесь вы сможете просматривать и изменять оценки."
  - Ссылка: "Пригласить учащихся"

СТИЛЬ:
- Тот же дизайн-язык (glass cards, gradients, rounded-2xl)
- Вкладки: подчёркнутые снизу (border-bottom) как в Google Classroom, не pill-стиль
- Поддержка dark/light theme
- "use client"
- Все строки через t("key")
```

---

## ЗАДАЧА 5 — Фронтенд: Боковая панель студента «Зачисленные курсы»

**Модель:** Gemini 2.5 Flash или Haiku 3.5 (небольшая задача)

### Промпт:

```
Ты работаешь над LMS-платформой на Next.js 14 (App Router) + TypeScript + Tailwind CSS.

КОНТЕКСТ:
- Проект: /home/nurjaks/Development/LMS platform - order/frontend-next/
- Сайдбар: src/components/dashboard/AppDashboardSidebar.tsx
- Существующая страница курсов студента: src/app/app/courses/page.tsx — показывает записанные курсы
- Страница курса: src/app/app/courses/[courseId]/page.tsx — детали курса
- API: GET /api/courses/my — [{id, title, ...}] — курсы на которые записан студент
- Auth: useAuthStore() → { user, isTeacher }
- Переводы: t("myCourses") = "Мои курсы"

ЗАДАНИЕ:
В файле src/components/dashboard/AppDashboardSidebar.tsx добавь секцию "Зачисленные курсы" для СТУДЕНТОВ (когда isTeacher() === false и user?.role !== "parent") в левой панели навигации.

Между основными ссылками (mainLinks) и блоком extraLinksBeforeManager добавь:

1. Dropdown заголовок "Enrolled" (или t("profileEnrolled")) со стрелкой ChevronDown — при клике сворачивается/разворачивается
2. Ссылка "To-do" (t("tasksCalendar")) → /app/tasks-calendar — с иконкой ListTodo
3. Список курсов студента:
   - Загружать через useQuery: GET /courses/my
   - Каждый курс: цветная буква (первая буква title) + название курса + год
   - При клике → /app/courses/{courseId}
   - Показывать максимум 5, если больше — ссылка "Ещё..."

СТИЛЬ:
- Секция должна быть визуально отделена тонким бордером сверху (как секция "Ещё")
- Буква-аватар: маленький квадрат 28x28 с цветом из массива акцентных цветов
- В компактном режиме (collapsed) секция скрыта

ВАЖНО:
- НЕ трогай никакие другие файлы
- НЕ ломай существующую навигацию
- Добавь ключ перевода если нужен (например enrolled: 'Зачисленные' в ru, kk, en) в translations.ts
```

---

## Порядок выполнения

| # | Задача | Файлы | Зависимости |
|---|--------|-------|-------------|
| 1 | Backend inbox API | `backend/app/api/routes/teacher.py` | — |
| 2 | Sidebar nav items + i18n | `AppDashboardSidebar.tsx`, `MobileBottomNav.tsx`, `translations.ts` | — |
| 3 | Courses layout + review page | 3 новых файла в `src/app/app/teacher/courses/` | Задачи 1, 2 |
| 4 | Course detail page with tabs | 1 новый файл `[groupId]/page.tsx` | Задачи 1, 2, 3 |
| 5 | Student enrolled sidebar | `AppDashboardSidebar.tsx`, `translations.ts` | Задача 2 |

> Задачи 1 и 2 можно запускать параллельно. Задачи 3 и 4 — последовательно после 1+2. Задача 5 — после 2.
