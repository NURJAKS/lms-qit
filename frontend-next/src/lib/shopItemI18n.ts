import type { Lang } from "@/i18n/translations";

type LocalizedText = {
  title: string;
  description: string | null;
};

type LocalizedByLang = {
  ru: LocalizedText;
  en: LocalizedText;
};

const EXACT: Record<string, LocalizedByLang> = {
  // Books
  "Программирование кітабы": {
    ru: { title: "Книга по программированию", description: "Основы Python" },
    en: { title: "Programming Book", description: "Python basics" },
  },
  "Web дамыту кітабы": {
    ru: { title: "Книга по веб‑разработке", description: "HTML, CSS, JavaScript" },
    en: { title: "Web Development Book", description: "HTML, CSS, JavaScript" },
  },
  "JavaScript кітабы": {
    ru: { title: "Книга по JavaScript", description: "Современный JS и React" },
    en: { title: "JavaScript Book", description: "Modern JS and React" },
  },
  "SQL және деректер қоры": {
    ru: { title: "SQL и базы данных", description: "Основы баз данных" },
    en: { title: "SQL and Databases", description: "Database fundamentals" },
  },
  "Git және GitHub": {
    ru: { title: "Git и GitHub", description: "Управление версиями" },
    en: { title: "Git and GitHub", description: "Version control" },
  },
  "AI және ML кітабы": {
    ru: { title: "Книга по AI и ML", description: "Основы искусственного интеллекта" },
    en: { title: "AI & ML Book", description: "Artificial intelligence fundamentals" },
  },
  "Киберқауіпсіздік": {
    ru: { title: "Кибербезопасность", description: "Основы безопасности" },
    en: { title: "Cybersecurity", description: "Security fundamentals" },
  },
  "Мобильді қосымшалар": {
    ru: { title: "Мобильные приложения", description: "React Native, Flutter" },
    en: { title: "Mobile Apps", description: "React Native, Flutter" },
  },

  // Souvenirs
  "Q Academy сувенир": {
    ru: { title: "Сувенир Q Academy", description: "Фирменный брелок" },
    en: { title: "Q Academy Souvenir", description: "Branded keychain" },
  },
  "Стикерлер жинағы": {
    ru: { title: "Набор стикеров", description: "Стикеры для программистов" },
    en: { title: "Sticker Pack", description: "Programmer stickers" },
  },
  "Q Academy сувенир кепка": {
    ru: { title: "Сувенирная кепка Q Academy", description: "Фирменная кепка (сувенир)" },
    en: { title: "Q Academy Souvenir Cap", description: "Branded cap (souvenir)" },
  },
  "IT магнитик": {
    ru: { title: "IT магнитик", description: "Сувенирный магнит" },
    en: { title: "IT Magnet", description: "Souvenir magnet" },
  },
  "Брелок код": {
    ru: { title: "Брелок «код»", description: "Брелок с символами {}" },
    en: { title: "Code Keychain", description: "Keychain with {} symbols" },
  },
  "IT значок": {
    ru: { title: "IT значок", description: "Фирменный значок (badge)" },
    en: { title: "IT Badge", description: "Branded badge" },
  },
  "Q Academy кружка": {
    ru: { title: "Кружка Q Academy", description: "Кружка с логотипом" },
    en: { title: "Q Academy Mug", description: "Mug with logo" },
  },
  "IT плакат": {
    ru: { title: "IT плакат", description: "Мотивационный плакат" },
    en: { title: "IT Poster", description: "Motivational poster" },
  },
  "Қысқа жеңіл кепка": {
    ru: { title: "Snapback кепка", description: "Фирменный snapback" },
    en: { title: "Snapback Cap", description: "Branded snapback" },
  },
  "Қызмет көрсету сертификаты": {
    ru: { title: "Сертификат на услуги", description: "Бумажный сертификат" },
    en: { title: "Service Certificate", description: "Paper certificate" },
  },

  // Caps
  "Q Academy кепка": {
    ru: { title: "Кепка Q Academy", description: "Фирменная кепка" },
    en: { title: "Q Academy Cap", description: "Branded cap" },
  },
  "Бейсболка": {
    ru: { title: "Бейсболка", description: "Удобная бейсболка" },
    en: { title: "Baseball Cap", description: "Comfortable baseball cap" },
  },
  "IT кепка": {
    ru: { title: "IT кепка", description: "Фирменная кепка" },
    en: { title: "IT Cap", description: "Branded cap" },
  },
  "Қызмет көрсету кепка": {
    ru: { title: "Кепка для занятий", description: "Для онлайн‑уроков" },
    en: { title: "Study Cap", description: "For online classes" },
  },
  "Жазғы кепка": {
    ru: { title: "Летняя кепка", description: "Лёгкая летняя кепка" },
    en: { title: "Summer Cap", description: "Light summer cap" },
  },
  "Snapback кепка": {
    ru: { title: "Snapback кепка", description: "Стильная кепка" },
    en: { title: "Snapback Cap", description: "Stylish cap" },
  },

  // Notebooks
  "Үлестірме дәптер": {
    ru: { title: "Раздаточная тетрадь", description: "Тетрадь A5, 96 листов" },
    en: { title: "Handout Notebook", description: "A5 notebook, 96 pages" },
  },
  "Код жазу дәптері": {
    ru: { title: "Тетрадь для кода", description: "Блоки для записи кода" },
    en: { title: "Coding Notebook", description: "Code blocks layout" },
  },
  "A4 дәптер": {
    ru: { title: "Тетрадь A4", description: "96 листов, обложка" },
    en: { title: "A4 Notebook", description: "96 pages, cover" },
  },
  "Стикерлі дәптер": {
    ru: { title: "Тетрадь со стикерами", description: "В комплекте Post‑it" },
    en: { title: "Notebook with Sticky Notes", description: "Includes Post‑it notes" },
  },
  "Молескин дәптер": {
    ru: { title: "Тетрадь Moleskine", description: "Классическая тетрадь" },
    en: { title: "Moleskine Notebook", description: "Classic notebook" },
  },
  "Қысқа дәптер": {
    ru: { title: "Маленькая тетрадь", description: "Тетрадь A6, 48 листов" },
    en: { title: "Small Notebook", description: "A6 notebook, 48 pages" },
  },
  "IT дәптер": {
    ru: { title: "IT тетрадь", description: "Фирменная тетрадь" },
    en: { title: "IT Notebook", description: "Branded notebook" },
  },
  "Схема дәптері": {
    ru: { title: "Тетрадь для схем", description: "Блоки для схем" },
    en: { title: "Diagram Notebook", description: "Layout for diagrams" },
  },

  // A4 / Paper
  "A4 қағаз пачка": {
    ru: { title: "Пачка бумаги A4", description: "500 листов" },
    en: { title: "A4 Paper Pack", description: "500 sheets" },
  },
  "Қағаз стикерлер": {
    ru: { title: "Стикеры‑листочки", description: "Post‑it, 100 листов" },
    en: { title: "Sticky Notes", description: "Post‑it, 100 sheets" },
  },
  "Картон қағаз": {
    ru: { title: "Картонная бумага", description: "Разные цвета" },
    en: { title: "Cardboard Paper", description: "Various colors" },
  },
  "Қағаз папка": {
    ru: { title: "Папка для бумаг", description: "10 файлов" },
    en: { title: "Paper Folder", description: "10 files" },
  },
  "Қағаз клип": {
    ru: { title: "Бумажный клип", description: "Металлические клипсы" },
    en: { title: "Paper Clip", description: "Metal clips" },
  },
  "Қағаз қап": {
    ru: { title: "Бумажный чехол", description: "Защитный чехол" },
    en: { title: "Paper Case", description: "Protective case" },
  },

  // Headphones
  "Құлаққап": {
    ru: { title: "Наушники", description: "Качественные наушники" },
    en: { title: "Headphones", description: "High‑quality headphones" },
  },
  "Қызмет көрсету құлаққаптары": {
    ru: { title: "Наушники с микрофоном", description: "Для онлайн‑уроков" },
    en: { title: "Headset", description: "For online classes" },
  },
  "Bluetooth құлаққап": {
    ru: { title: "Bluetooth наушники", description: "Беспроводные наушники" },
    en: { title: "Bluetooth Headphones", description: "Wireless headphones" },
  },
  "Құлаққап TWS": {
    ru: { title: "TWS наушники", description: "Беспроводные наушники" },
    en: { title: "TWS Earbuds", description: "Wireless earbuds" },
  },
  "Құлаққап ойын": {
    ru: { title: "Игровые наушники", description: "7.1 surround" },
    en: { title: "Gaming Headphones", description: "7.1 surround" },
  },
  "Құлаққап студент": {
    ru: { title: "Наушники для студента", description: "Доступная цена" },
    en: { title: "Student Headphones", description: "Affordable price" },
  },
  "Құлаққап микрофон": {
    ru: { title: "Наушники с микрофоном", description: "Гарнитура" },
    en: { title: "Headset with Microphone", description: "Headset" },
  },
  "Құлаққап офис": {
    ru: { title: "Офисные наушники", description: "Для работы и звонков" },
    en: { title: "Office Headphones", description: "For work and calls" },
  },

  // Keyboard
  "Пернетақта": {
    ru: { title: "Клавиатура", description: "Механическая клавиатура" },
    en: { title: "Keyboard", description: "Mechanical keyboard" },
  },
  "Пернетақта мембрана": {
    ru: { title: "Клавиатура (мембранная)", description: "Доступная цена" },
    en: { title: "Membrane Keyboard", description: "Affordable price" },
  },
  "Пернетақта компакт": {
    ru: { title: "Компактная клавиатура", description: "Форм‑фактор 60%" },
    en: { title: "Compact Keyboard", description: "60% layout" },
  },
  "Пернетақта RGB": {
    ru: { title: "Клавиатура RGB", description: "Подсветка RGB" },
    en: { title: "RGB Keyboard", description: "RGB backlight" },
  },
  "Пернетақта wireless": {
    ru: { title: "Беспроводная клавиатура", description: "Удобное подключение" },
    en: { title: "Wireless Keyboard", description: "Convenient connection" },
  },
  "Пернетақта ойын": {
    ru: { title: "Игровая клавиатура", description: "Механическая игровая" },
    en: { title: "Gaming Keyboard", description: "Mechanical gaming keyboard" },
  },

  // Laptop
  "Ноутбук": {
    ru: { title: "Ноутбук", description: "Для IT‑студентов" },
    en: { title: "Laptop", description: "For IT students" },
  },
  "Ноутбук MacBook": {
    ru: { title: "Ноутбук MacBook", description: "Apple MacBook Air" },
    en: { title: "MacBook Laptop", description: "Apple MacBook Air" },
  },
  "Ноутбук игровой": {
    ru: { title: "Игровой ноутбук", description: "Для игр и разработки" },
    en: { title: "Gaming Laptop", description: "For gaming and development" },
  },
  "Ноутбук тұғыры": {
    ru: { title: "Подставка для ноутбука", description: "Эргономичная подставка" },
    en: { title: "Laptop Stand", description: "Ergonomic stand" },
  },
  "Ноутбук салқындату": {
    ru: { title: "Охлаждающая подставка", description: "Охлаждение для ноутбука" },
    en: { title: "Cooling Stand", description: "Laptop cooling stand" },
  },

  // Monitor
  "Монитор 24\"": {
    ru: { title: "Монитор 24″", description: "Full HD, для второго экрана" },
    en: { title: "24″ Monitor", description: "Full HD, for a second screen" },
  },
  "Қосымша экран қорғағышы": {
    ru: { title: "Защитная плёнка для экрана", description: "Защита экрана ноутбука" },
    en: { title: "Screen Protector", description: "Protects laptop screen" },
  },
  "Монитор 27\"": {
    ru: { title: "Монитор 27″", description: "Дисплей 2K" },
    en: { title: "27″ Monitor", description: "2K display" },
  },
  "Монитор тұғыры": {
    ru: { title: "Подставка для монитора", description: "Эргономичная подставка" },
    en: { title: "Monitor Stand", description: "Ergonomic stand" },
  },
  "Қосымша экран": {
    ru: { title: "Дополнительный экран", description: "Портативный 15.6″" },
    en: { title: "Extra Screen", description: "Portable 15.6″" },
  },
  "Монитор кабель": {
    ru: { title: "Кабель для монитора", description: "HDMI кабель, 2 м" },
    en: { title: "Monitor Cable", description: "HDMI cable, 2 m" },
  },

  // Mouse
  "Компьютерлі тышқан": {
    ru: { title: "Компьютерная мышь", description: "Для игр и работы" },
    en: { title: "Computer Mouse", description: "For gaming and work" },
  },
  "Тышқан ойын": {
    ru: { title: "Игровая мышь", description: "RGB подсветка" },
    en: { title: "Gaming Mouse", description: "RGB lighting" },
  },
  "Тышқан wireless": {
    ru: { title: "Беспроводная мышь", description: "Удобная мышь" },
    en: { title: "Wireless Mouse", description: "Convenient mouse" },
  },
  "Тышқан коврик": {
    ru: { title: "Коврик для мыши", description: "Большой коврик" },
    en: { title: "Mouse Pad", description: "Large pad" },
  },
  "Тышқан вертикаль": {
    ru: { title: "Вертикальная мышь", description: "Эргономичная" },
    en: { title: "Vertical Mouse", description: "Ergonomic" },
  },
  "Тышқан трекбол": {
    ru: { title: "Трекбол‑мышь", description: "Трекбол" },
    en: { title: "Trackball Mouse", description: "Trackball" },
  },
  "Тышқан бюджет": {
    ru: { title: "Бюджетная мышь", description: "Доступная цена" },
    en: { title: "Budget Mouse", description: "Affordable price" },
  },
  "Тышқан офис": {
    ru: { title: "Офисная мышь", description: "Мышь для офиса" },
    en: { title: "Office Mouse", description: "Office mouse" },
  },

  // Webcam
  "Веб-камера HD": {
    ru: { title: "Веб‑камера HD", description: "Для онлайн‑уроков" },
    en: { title: "HD Webcam", description: "For online classes" },
  },
  "Веб-камера 4K": {
    ru: { title: "Веб‑камера 4K", description: "Высокое качество" },
    en: { title: "4K Webcam", description: "High quality" },
  },
  "Веб-камера бюджет": {
    ru: { title: "Бюджетная веб‑камера", description: "720p" },
    en: { title: "Budget Webcam", description: "720p" },
  },
  "Веб-камера жарық": {
    ru: { title: "Веб‑камера с подсветкой", description: "В комплекте ring light" },
    en: { title: "Webcam with Light", description: "Includes ring light" },
  },
  "Веб-камера микрофон": {
    ru: { title: "Веб‑камера с микрофоном", description: "Для звонков и занятий" },
    en: { title: "Webcam with Microphone", description: "For calls and classes" },
  },

  // Bags
  "Ноутбук сөмкесі": {
    ru: { title: "Сумка для ноутбука", description: "Защитный рюкзак" },
    en: { title: "Laptop Bag", description: "Protective backpack" },
  },
  "Рюкзак IT": {
    ru: { title: "IT рюкзак", description: "Подходит для ноутбука" },
    en: { title: "IT Backpack", description: "Fits a laptop" },
  },
  "Қызмет көрсету портфель": {
    ru: { title: "Портфель", description: "Портфель для документов" },
    en: { title: "Briefcase", description: "Document briefcase" },
  },
  "Сөмке кросовка": {
    ru: { title: "Сумка", description: "Удобная сумка" },
    en: { title: "Bag", description: "Convenient bag" },
  },
  "Қағаз сөмке": {
    ru: { title: "Бумажная сумка", description: "Бумажная сумка" },
    en: { title: "Paper Bag", description: "Paper bag" },
  },
  "Ноутбук қап": {
    ru: { title: "Чехол для ноутбука", description: "Защитный чехол" },
    en: { title: "Laptop Sleeve", description: "Protective sleeve" },
  },
  "Құлаққап сөмке": {
    ru: { title: "Чехол для наушников", description: "Для наушников" },
    en: { title: "Headphones Case", description: "For headphones" },
  },
  "USB рюкзак": {
    ru: { title: "Рюкзак с USB‑портом", description: "Встроенный USB‑порт" },
    en: { title: "Backpack with USB Port", description: "Built‑in USB port" },
  },

  // Other
  "USB-C кабель": {
    ru: { title: "Кабель USB‑C", description: "Быстрая зарядка" },
    en: { title: "USB‑C Cable", description: "Fast charging" },
  },
  "USB hub": {
    ru: { title: "USB‑хаб", description: "4 порта" },
    en: { title: "USB Hub", description: "4 ports" },
  },
  "Power bank 20000mAh": {
    ru: { title: "Power bank 20000 mAh", description: "Портативная зарядка" },
    en: { title: "Power Bank 20000 mAh", description: "Portable charger" },
  },
  "Қалам жинағы": {
    ru: { title: "Набор ручек", description: "5 цветных маркеров" },
    en: { title: "Pen Set", description: "5 colored markers" },
  },
  "Қалам гель": {
    ru: { title: "Гелевая ручка", description: "Чёрная гелевая ручка" },
    en: { title: "Gel Pen", description: "Black gel pen" },
  },
  "Қалам маркер": {
    ru: { title: "Ручка‑маркер", description: "Разные цвета" },
    en: { title: "Marker Pen", description: "Various colors" },
  },
  "Қалам жинағы 12": {
    ru: { title: "Набор маркеров (12)", description: "12 цветных маркеров" },
    en: { title: "Marker Set (12)", description: "12 colored markers" },
  },
  "Қалам қалам": {
    ru: { title: "Ручка", description: "Обычная ручка" },
    en: { title: "Pen", description: "Regular pen" },
  },
  "Қалам": {
    ru: { title: "Ручка", description: "Обычная ручка" },
    en: { title: "Pen", description: "Regular pen" },
  },
  "Көзәйнек": {
    ru: { title: "Очки", description: "Защитные очки" },
    en: { title: "Glasses", description: "Protective glasses" },
  },
  "Көзәйнек оқыту": {
    ru: { title: "Очки для учебы", description: "Защита глаз" },
    en: { title: "Study Glasses", description: "Eye protection" },
  },
  "Көзәйнек күн": {
    ru: { title: "Солнцезащитные очки", description: "Очки от солнца" },
    en: { title: "Sunglasses", description: "Sun protection" },
  },
  "Калькулятор": {
    ru: { title: "Калькулятор", description: "Инженерный калькулятор" },
    en: { title: "Calculator", description: "Scientific calculator" },
  },
  "Қайшы": {
    ru: { title: "Ножницы", description: "Офисные ножницы" },
    en: { title: "Scissors", description: "Office scissors" },
  },
  "Қаламша": {
    ru: { title: "Карандаш", description: "Карандаш" },
    en: { title: "Pencil", description: "Pencil" },
  },
  "Қаламша түрлі": {
    ru: { title: "Разные карандаши", description: "Разные цвета" },
    en: { title: "Various Pencils", description: "Various colors" },
  },
};

const PATTERNS: Array<{
  re: RegExp;
  build: (match: RegExpMatchArray) => LocalizedByLang;
}> = [
  // Marker sets: "Қалам жинағы 24" etc.
  {
    re: /^Қалам жинағы (\d+)$/u,
    build: (m) => {
      const n = m[1] ?? "";
      return {
        ru: { title: `Набор маркеров (${n})`, description: `${n} цветных маркеров` },
        en: { title: `Marker Set (${n})`, description: `${n} colored markers` },
      };
    },
  },
  // USB flash drive sizes
  {
    re: /^USB флешка (\d+)GB$/u,
    build: (m) => {
      const gb = m[1] ?? "";
      return {
        ru: { title: `USB‑флешка ${gb}GB`, description: "Для хранения данных" },
        en: { title: `USB Flash Drive ${gb}GB`, description: "For data storage" },
      };
    },
  },
  // Colored pencils sets: "Қаламша жинағы 72" etc.
  {
    re: /^Қаламша жинағы (\d+)$/u,
    build: (m) => {
      const n = m[1] ?? "";
      return {
        ru: { title: `Набор цветных карандашей (${n})`, description: `${n} цветов` },
        en: { title: `Colored Pencil Set (${n})`, description: `${n} colors` },
      };
    },
  },
  // Monitors sometimes come without the inch quote
  {
    re: /^Монитор (\d+)(?:\\"|"|″|\\)?$/u,
    build: (m) => {
      const inch = m[1] ?? "";
      return {
        ru: { title: `Монитор ${inch}″`, description: "Монитор" },
        en: { title: `${inch}″ Monitor`, description: "Monitor" },
      };
    },
  },
];

function normalize(s: string) {
  return s.trim();
}

export function localizeShopItem(params: {
  title: string;
  description: string | null;
  lang: Lang;
}): LocalizedText {
  const title = normalize(params.title);
  const description = params.description;
  const lang = params.lang;

  // Kazakh is our source language in DB for most items.
  if (lang === "kk") {
    return { title, description };
  }

  const exact = EXACT[title];
  if (exact) {
    return lang === "ru" ? exact.ru : exact.en;
  }

  for (const p of PATTERNS) {
    const m = title.match(p.re);
    if (!m) continue;
    const byLang = p.build(m);
    return lang === "ru" ? byLang.ru : byLang.en;
  }

  // Fallback: show what we got from API.
  return { title, description };
}

