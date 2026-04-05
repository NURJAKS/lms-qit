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
  "1С:Предприятие 8": "course1CTitle",
  "1С:Кәсіпорын 8": "course1CTitle",
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

/** Maps API course title to custom banner image URL */
export const COURSE_BANNER_IMAGES: Record<string, string> = {
  "Web-әзірлеу негіздері": "/courses/web-development.png",
  "Основы веб-разработки": "/courses/web-development.png",
  "Web Development": "/courses/web-development.png",
  "Web Development Fundamentals": "/courses/web-development.png",
  "Python программалау негіздері": "/courses/python.png",
  "Python для начинающих": "/courses/python.png",
  "Основы программирования на Python": "/courses/python.png",
  "Python Programming": "/courses/python.png",
  "Python Programming Fundamentals": "/courses/python.png",
  "Машиналық оқыту негіздері": "/courses/machine-learning.png",
  "Машинное обучение": "/courses/machine-learning.png",
  "Machine Learning": "/courses/machine-learning.png",
  "Machine Learning Fundamentals": "/courses/machine-learning.png",
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
  "1С:Предприятие 8": "course1CDesc",
  "1С:Кәсіпорын 8": "course1CDesc",
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
  "Айнымалылар және деректер түрлері": "topicPythonVariablesTitle",
  "Переменные и типы данных": "topicPythonVariablesTitle",
  "Variables and Data Types": "topicPythonVariablesTitle",
  "Операторлар": "topicPythonOperatorsTitle",
  "Операторы": "topicPythonOperatorsTitle",
  "Operators": "topicPythonOperatorsTitle",
  "Шартты операторлар": "topicPythonConditionalOperatorsTitle",
  "Условные операторы": "topicPythonConditionalOperatorsTitle",
  "Conditional Operators": "topicPythonConditionalOperatorsTitle",
  "Циклдар": "topicPythonLoopsTitle",
  "Циклы": "topicPythonLoopsTitle",
  "Loops": "topicPythonLoopsTitle",
  // Web course — HTML intro
  "HTML дегеніміз не?": "topicHtmlWhatIsTitle",
  "Что такое HTML?": "topicHtmlWhatIsTitle",
  "What is HTML?": "topicHtmlWhatIsTitle",
  // Web course — HTML tags
  "HTML тегтері": "topicHtmlTagsTitle",
  "HTML‑теги": "topicHtmlTagsTitle",
  "HTML tags": "topicHtmlTagsTitle",
  "Формалар": "topicHtmlFormsTitle",
  "Формы": "topicHtmlFormsTitle",
  "Forms": "topicHtmlFormsTitle",
  "Семантикалық HTML": "topicHtmlSemanticTitle",
  "Семантический HTML": "topicHtmlSemanticTitle",
  "Semantic HTML": "topicHtmlSemanticTitle",
  "CSS селекторлары": "topicCssSelectorsTitle",
  "CSS селекторы": "topicCssSelectorsTitle",
  "CSS Selectors": "topicCssSelectorsTitle",
  "Flexbox": "topicFlexboxTitle",
  "Responsive дизайн": "topicResponsiveDesignTitle",
  "Адаптивный дизайн": "topicResponsiveDesignTitle",
  "Responsive Design": "topicResponsiveDesignTitle",
  "JavaScript айнымалылары": "topicJsVariablesTitle",
  "Переменные JavaScript": "topicJsVariablesTitle",
  "JavaScript Variables": "topicJsVariablesTitle",
  "DOM манипуляциясы": "topicDomManipulationTitle",
  "Манипуляции DOM": "topicDomManipulationTitle",
  "DOM Manipulation": "topicDomManipulationTitle",
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

/** Локальный нейтральный плейсхолдер, без внешних stock/mock URL. */
export function coursePlaceholderImageUrl(): string {
  return "/course-placeholder.svg";
}

export function courseImageUrl(c: Course): string {
  if (c.image_url) return c.image_url;
  return getCourseBannerUrl(c);
}

/** Returns a high-quality banner image for the course detail page */
export function getCourseBannerUrl(c: { title?: string; image_url?: string }): string {
  const apiTitle = (c.title ?? "").trim();
  if (COURSE_BANNER_IMAGES[apiTitle]) return COURSE_BANNER_IMAGES[apiTitle];

  // Try substring match for common course names if exact match fails
  const lowerTitle = apiTitle.toLowerCase();
  if (lowerTitle.includes("python")) return "/courses/python.png";
  if (lowerTitle.includes("web") || lowerTitle.includes("веб") || lowerTitle.includes("әзірлеу")) 
    return "/courses/web-development.png";
  if (lowerTitle.includes("машина") || lowerTitle.includes("machine") || lowerTitle.includes("ml")) 
    return "/courses/machine-learning.png";
  
  // Fallback to category-based banners if needed, or just use course image
  if (c.image_url) return c.image_url;
  return coursePlaceholderImageUrl();
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

export function getLocalizedCourseTitle<K extends string>(
  course: Course,
  t: (key: K) => string
): string {
  const apiTitle = (course.title ?? "").trim();
  const key = COURSE_TITLE_KEYS[apiTitle];
  return key ? (t as (key: string) => string)(key) : apiTitle || course.title;
}

export function getLocalizedCourseDesc<K extends string>(
  course: Course,
  t: (key: K) => string
): string {
  const apiTitle = (course.title ?? "").trim();
  const key = COURSE_DESC_KEYS[apiTitle];
  return key ? (t as (key: string) => string)(key) : (course.description ?? "");
}

export function getLocalizedTopicTitle<K extends string>(title: string, t: (key: K) => string): string {
  const key = TOPIC_TITLE_KEYS[title];
  return key ? (t as (key: string) => string)(key) : title;
}

export function getLocalizedModuleTitle(title: string, t: (key: string) => string): string {
  const key = MODULE_TITLE_KEYS[title];
  return key ? t(key) : title;
}
