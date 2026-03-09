import type { Course } from "@/types";

/** Maps API course title (Kazakh) to translation key for localized display */
export const COURSE_TITLE_KEYS: Record<string, string> = {
  // Kazakh (Primary)
  "Python программалау негіздері": "coursePythonTitle",
  "Web-әзірлеу негіздері": "courseWebTitle",
  "Машиналық оқыту негіздері": "courseMLTitle",
  "React әзірлеу": "courseReactTitle",
  "Flutter мобильді әзірлеу": "courseFlutterTitle",
  "UI/UX дизайн": "courseUIUXTitle",
  "SQL және деректер базасы": "courseSQLTitle",
  "Docker және контейнерлеу": "courseDockerTitle",
  "TypeScript программалау": "courseTypeScriptTitle",
  "Node.js Backend әзірлеу": "courseNodeTitle",
  "Vue.js фреймворкі": "courseVueTitle",
  "MongoDB NoSQL база": "courseMongoDBTitle",
  "GraphQL API": "courseGraphQLTitle",
  "Figma дизайн құралы": "courseFigmaTitle",
  "Git және GitHub": "courseGitTitle",
  "AWS бұлтты қызметтер": "courseAWSTitle",
  "Кибер қауіпсіздік негіздері": "courseSecurityTitle",
  "Блокчейн технологиясы": "courseBlockchainTitle",
  "Agile және Scrum": "courseAgileTitle",
  "Тестілеу және QA": "courseQATitle",
  // Russian variants
  "Python для начинающих": "coursePythonTitle",
  "Web разработка": "courseWebTitle",
  "Основы программирования на Python": "coursePythonTitle",
  "Основы веб-разработки": "courseWebTitle",
  "Машинное обучение": "courseMLTitle",
  "Веб-дизайнер": "courseWebDesignerTitle",
  "C++ разработчик": "courseCPPDeveloperTitle",
  "C# разработчик": "courseCSharpDeveloperTitle",
  "AutoCAD": "courseAutoCADTitle",
  "Blender 3D": "courseBlender3DTitle",
  // English variants
  "Python Programming": "coursePythonTitle",
  "Web Development": "courseWebTitle",
  "Python Programming Fundamentals": "coursePythonTitle",
  "Web Development Fundamentals": "courseWebTitle",
  "Machine Learning Fundamentals": "courseMLTitle",
};

export const COURSE_DESC_KEYS: Record<string, string> = {
  "Python программалау негіздері": "coursePythonDesc",
  "Web-әзірлеу негіздері": "courseWebDesc",
  "Машиналық оқыту негіздері": "courseMLDesc",
  "React әзірлеу": "courseReactDesc",
  "Flutter мобильді әзірлеу": "courseFlutterDesc",
  "UI/UX дизайн": "courseUIUXDesc",
  "SQL және деректер базасы": "courseSQLDesc",
  "Docker және контейнерлеу": "courseDockerDesc",
  "TypeScript программалау": "courseTypeScriptDesc",
  "Node.js Backend әзірлеу": "courseNodeDesc",
  "Vue.js фреймворкі": "courseVueDesc",
  "MongoDB NoSQL база": "courseMongoDBDesc",
  "GraphQL API": "courseGraphQLDesc",
  "Figma дизайн құралы": "courseFigmaDesc",
  "Git және GitHub": "courseGitDesc",
  "AWS бұлтты қызметтер": "courseAWSDesc",
  "Кибер қауіпсіздік негіздері": "courseSecurityDesc",
  "Блокчейн технологиясы": "courseBlockchainDesc",
  "Agile және Scrum": "courseAgileDesc",
  "Тестілеу және QA": "courseQADesc",
  // Russian-only course names (mapped to shared descriptions)
  "Веб-дизайнер": "courseWebDesignerDesc",
  "C++ разработчик": "courseCPPDeveloperDesc",
  "C# разработчик": "courseCSharpDeveloperDesc",
  "AutoCAD": "courseAutoCADDesc",
  "Blender 3D": "courseBlender3DDesc",
};

/** Maps API topic title (Kazakh/Russian/English) to translation key for localized display */
export const TOPIC_TITLE_KEYS: Record<string, string> = {
  // Python course — intro
  "Python дегеніміз не?": "topicPythonWhatIsTitle",
  "Что такое Python?": "topicPythonWhatIsTitle",
  "What is Python?": "topicPythonWhatIsTitle",
  // Web course — HTML tags
  "HTML тегтері": "topicHtmlTagsTitle",
  "HTML‑теги": "topicHtmlTagsTitle",
  "HTML tags": "topicHtmlTagsTitle",
};

/** Maps module titles to translation keys (for Units on topic pages) */
export const MODULE_TITLE_KEYS: Record<string, string> = {
  "Кіріспе": "moduleIntroTitle",
  "Басқару құрылымдары": "moduleControlStructuresTitle",
  "HTML негіздері": "moduleHtmlBasicsTitle",
  "CSS стильдері": "moduleCssStylesTitle",
  "JavaScript негіздері": "moduleJsBasicsTitle",
  // Potential future localized variants
  Introduction: "moduleIntroTitle",
  "Control structures": "moduleControlStructuresTitle",
  "HTML basics": "moduleHtmlBasicsTitle",
  "CSS styles": "moduleCssStylesTitle",
  "JavaScript basics": "moduleJsBasicsTitle",
};

export const CATEGORY_ACCENT: Record<string, string> = {
  web: "#3f51b5",
  ai: "#00bcd4",
  mobile: "#4caf50",
  data: "#e91e63",
};

/** Уникальные цвета для карточек курсов (каждая карточка — свой цвет) */
export const COURSE_CARD_COLORS: string[] = [
  "#4C4CE1", // индиго
  "#37D6C9", // бирюзовый
  "#E91E63", // розовый
  "#FF9800", // оранжевый
  "#9C27B0", // фиолетовый
  "#009688", // teal
  "#2196F3", // синий
  "#8BC34A", // светло-зелёный
  "#795548", // коричневый
  "#F44336", // красный
  "#00BCD4", // cyan
  "#673AB7", // глубокий фиолетовый
  "#FF5722", // оранжево-красный
  "#3F51B5", // синий материал
  "#4CAF50", // зелёный
  "#607D8B", // синевато-серый
];

export const CATEGORY_GRADIENT: Record<string, string> = {
  web: "from-[#3f51b5] to-[#5c6bc0]",
  ai: "from-[#00bcd4] to-[#4dd0e1]",
  mobile: "from-[#4caf50] to-[#81c784]",
  data: "from-[#e91e63] to-[#f06292]",
};

export const CATEGORY_METRICS: Record<string, { durationKey: string; levelKey: string; students: string }> = {
  web: { durationKey: "coursesDuration4", levelKey: "coursesLevelMedium", students: "100+" },
  ai: { durationKey: "coursesDuration6", levelKey: "coursesLevelHard", students: "50+" },
  mobile: { durationKey: "coursesDuration4", levelKey: "coursesLevelBeginner", students: "100+" },
  data: { durationKey: "coursesDuration5", levelKey: "coursesLevelMedium", students: "250+" },
};

export function courseImageUrl(c: Course): string {
  if (c.image_url) return c.image_url;
  const seeds: Record<number, string> = {
    1: "python-programming",
    2: "web-development",
    3: "react-framework",
    4: "machine-learning",
  };
  const seed = seeds[c.id] ?? `course-${c.id}`;
  return `https://picsum.photos/seed/${seed}/400/240`;
}

export function getCategoryFromCourse(c: Course): { key: string; labelKey: string } {
  const t = (c.title || "").toLowerCase();
  if (t.includes("python") || t.includes("машина") || t.includes("ml") || t.includes("ai") || t.includes("оқыту") || t.includes("c++") || t.includes("c#"))
    return { key: "ai", labelKey: "coursesFilterAi" };
  if (t.includes("web") || t.includes("әзірлеу") || t.includes("html") || t.includes("react") || t.includes("дизайн") || t.includes("design"))
    return { key: "web", labelKey: "coursesFilterWeb" };
  if (t.includes("flutter") || t.includes("мобиль")) return { key: "mobile", labelKey: "coursesFilterMobile" };
  if (t.includes("data") || t.includes("ui") || t.includes("ux") || t.includes("1с") || t.includes("autocad") || t.includes("blender"))
    return { key: "data", labelKey: "coursesFilterData" };
  return { key: "data", labelKey: "coursesFilterData" };
}

export function getLocalizedCourseTitle(
  course: Course,
  t: (key: string) => string
): string {
  const key = COURSE_TITLE_KEYS[course.title];
  return key ? t(key) : course.title;
}

export function getLocalizedCourseDesc(
  course: Course,
  t: (key: string) => string
): string {
  const key = COURSE_DESC_KEYS[course.title];
  return key ? t(key) : (course.description ?? "");
}

export function getLocalizedTopicTitle(title: string, t: (key: string) => string): string {
  const key = TOPIC_TITLE_KEYS[title];
  return key ? t(key) : title;
}

export function getLocalizedModuleTitle(title: string, t: (key: string) => string): string {
  const key = MODULE_TITLE_KEYS[title];
  return key ? t(key) : title;
}
