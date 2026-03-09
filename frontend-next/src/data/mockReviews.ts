export interface Review {
  id: number;
  user_name: string;
  user_email: string;
  course_title: { ru: string; kk: string; en: string };
  rating: number;
  text: { ru: string; kk: string; en: string };
  admin_reply: { ru: string; kk: string; en: string } | null;
  created_at?: string | null;
  is_featured?: boolean;
}

export const mockReviews: Review[] = [
  {
    id: 1,
    user_name: "Айдар Асқар",
    user_email: "a.askar@edu.kz",
    course_title: {
      ru: "Основы программирования на Python",
      kk: "Python программалау негіздері",
      en: "Python Programming Basics"
    },
    rating: 5,
    text: {
      ru: "Отличная платформа! Материалы очень понятные, преподаватели всегда готовы помочь. Курс Python помог мне освоить программирование с нуля. Рекомендую всем!",
      kk: "Керемет платформа! Материалдар өте түсінікті, оқытушылар әрқашан көмектесуге дайын. Python курсы маған бағдарламалауды нөлден меңгеруге көмектесті. Барлығына ұсынамын!",
      en: "Excellent platform! The materials are very clear, and the teachers are always ready to help. The Python course helped me master programming from scratch. Highly recommend to everyone!"
    },
    admin_reply: {
      ru: "Очень рады за ваш успех!",
      kk: "Сіздің жетістігіңіз үшін өте қуаныштымыз!",
      en: "We are very happy for your success!"
    },
    created_at: "2026-03-03T00:00:00.000Z",
    is_featured: true,
  },
  {
    id: 2,
    user_name: "Жандос Смаилов",
    user_email: "j.smail@edu.kz",
    course_title: {
      ru: "Основы Web-разработки",
      kk: "Web-әзірлеу негіздері",
      en: "Web Development Basics"
    },
    rating: 5,
    text: {
      ru: "Лучшая IT-платформа в Казахстане! Качественные курсы, профессиональные преподаватели. Узнал много нового. Спасибо!",
      kk: "Қазақстандағы ең жақсы IT платформасы! Курстар сапалы, мұғалімдер кәсіби. Көптеген жаңа нәрселерді үйрендім. Рахмет!",
      en: "The best IT platform in Kazakhstan! Quality courses, professional teachers. Learned a lot of new things. Thanks!"
    },
    admin_reply: null,
    created_at: "2026-02-28T00:00:00.000Z",
    is_featured: false,
  },
  {
    id: 3,
    user_name: "Марина Петрова",
    user_email: "m.petrova@gmail.com",
    course_title: {
      ru: "Основы машинного обучения",
      kk: "Машиналық оқыту негіздері",
      en: "Machine Learning Basics"
    },
    rating: 5,
    text: {
      ru: "Платформа просто супер! Удобный интерфейс, интересные задания, хорошая обратная связь. Прошла курс и уже работаю в IT-компании.",
      kk: "Платформа өте керемет! Ыңғайлы интерфейс, қызықты тапсырмалар, жақсы кері байланыс. Курсты бітіріп, қазірдің өзінде IT-компанияда жұмыс істеймін.",
      en: "The platform is just super! User-friendly interface, interesting tasks, good feedback. I finished the course and am already working in an IT company."
    },
    admin_reply: {
      ru: "Спасибо за теплые слова!",
      kk: "Жылы лебізіңізге рахмет!",
      en: "Thank you for the kind words!"
    },
    created_at: "2026-02-25T00:00:00.000Z",
    is_featured: true,
  },
  {
    id: 4,
    user_name: "Данияр Қайрат",
    user_email: "d.kairat@edu.kz",
    course_title: {
      ru: "Frontend Разработчик",
      kk: "Frontend әзірлеуші",
      en: "Frontend Developer"
    },
    rating: 5,
    text: {
      ru: "Лучший курс по фронтенду. Практические задания помогли собрать портфолио. AI-помощник подсказывает в любое время суток, что очень удобно!",
      kk: "Фронтенд бойынша ең жақсы курс. Практикалық тапсырмалар портфолио жинауға көмектесті. AI-көмекші тәуліктің кез келген уақытында кеңес береді, бұл өте ыңғайлы!",
      en: "The best frontend course. Practical tasks helped me build a portfolio. The AI assistant gives tips at any time of the day, which is very convenient!"
    },
    admin_reply: {
      ru: "Рады быть полезными!",
      kk: "Пайдалы болғанымызға қуаныштымыз!",
      en: "Happy to be helpful!"
    },
    created_at: "2026-03-05T00:00:00.000Z",
    is_featured: false,
  },
  {
    id: 5,
    user_name: "Айсулу Болат",
    user_email: "a.bolat@edu.kz",
    course_title: {
      ru: "Backend Разработка",
      kk: "Backend әзірлеу",
      en: "Backend Development"
    },
    rating: 4,
    text: {
      ru: "Очень качественный материал. Глубоко освоила Node.js и базы данных. Понравилось, что было много практических работ.",
      kk: "Өте сапалы материал. Node.js пен деректер қорын терең меңгердім. Практикалық жұмыстар көп болғаны ұнады.",
      en: "Very high-quality material. Deeply mastered Node.js and databases. I liked that there were many practical assignments."
    },
    admin_reply: {
      ru: "Мы тоже рады вашему прогрессу!",
      kk: "Біз де сіздің прогресіңізге қуаныштымыз!",
      en: "We are also happy with your progress!"
    },
    created_at: "2026-03-01T00:00:00.000Z",
    is_featured: false,
  },
  {
    id: 6,
    user_name: "Елена Иванова",
    user_email: "e.ivanova@ya.ru",
    course_title: {
      ru: "UX/UI Дизайн",
      kk: "UX/UI Дизайн",
      en: "UX/UI Design"
    },
    rating: 5,
    text: {
      ru: "Я узнала очень много на этом курсе. Освоила работу в Figma и основы дизайна. Отличная возможность!",
      kk: "Мен бұл курстан өте көп нәрсе үйрендім. Figma-мен жұмыс істеуді және дизайн негіздерін меңгердім. Керемет мүмкіндік!",
      en: "I learned a lot on this course. Mastered Figma and the basics of design. Great opportunity!"
    },
    admin_reply: {
      ru: "Отличный результат!",
      kk: "Керемет нәтиже!",
      en: "Great result!"
    },
    created_at: "2026-02-20T00:00:00.000Z",
    is_featured: true,
  },
  {
    id: 7,
    user_name: "Сергей Ким",
    user_email: "s.kim@google.com",
    course_title: {
      ru: "Наука о данных",
      kk: "Деректер ғылымы",
      en: "Data Science"
    },
    rating: 5,
    text: {
      ru: "Сложные темы объясняются доступно. Прошел путь от основ статистики до нейросетей. Помощь кураторов на высоте.",
      kk: "Күрделі тақырыптар қолжетімді түрде түсіндіріледі. Статистика негіздерінен нейрондық желілерге дейінгі жолдан өттім. Кураторлардың көмегі өте жоғары деңгейде.",
      en: "Complex topics are explained accessibly. I went from the basics of statistics to neural networks. Curator support is top-notch."
    },
    admin_reply: null,
    created_at: "2026-03-07T00:00:00.000Z",
    is_featured: false,
  },
  {
    id: 8,
    user_name: "Арман Ерлан",
    user_email: "a.erlan@edu.kz",
    course_title: {
      ru: "Основы кибербезопасности",
      kk: "Киберқауіпсіздік негіздері",
      en: "Cybersecurity Basics"
    },
    rating: 5,
    text: {
      ru: "Курс был очень интересным. Много практических лабораторий, это хорошо помогает закрепить знания. Спасибо QIT!",
      kk: "Курс өте қызықты болды. Практикалық зертханалар көп, бұл білімді бекітуге жақсы көмектеседі. Рахмет QIT!",
      en: "The course was very interesting. Many practical labs, which helps a lot to consolidate knowledge. Thanks QIT!"
    },
    admin_reply: {
      ru: "Желаем удачи!",
      kk: "Сәттілік тілейміз!",
      en: "Good luck!"
    },
    created_at: "2026-02-15T00:00:00.000Z",
    is_featured: true,
  },
  {
    id: 9,
    user_name: "Наталья Смирнова",
    user_email: "n.smirnova@mail.ru",
    course_title: {
      ru: "Flutter мобильная разработка",
      kk: "Flutter мобильді әзірлеу",
      en: "Flutter Mobile Development"
    },
    rating: 5,
    text: {
      ru: "Всегда хотела создавать приложения. Благодаря курсу выпустила свое первое приложение в стор! Курс структурирован идеально.",
      kk: "Әрқашан қолданбалар жасағым келетін. Курстың арқасында сторға өзімнің алғашқы қосымшамды шығардым! Курс тамаша құрылымдалған.",
      en: "I always wanted to create apps. Thanks to the course, I released my first app to the store! The course is structured perfectly."
    },
    admin_reply: {
      ru: "Поздравляем с первым приложением!",
      kk: "Алғашқы қосымшаңызбен құттықтаймыз!",
      en: "Congratulations on your first app!"
    },
    created_at: "2026-03-04T00:00:00.000Z",
    is_featured: false,
  },
  {
    id: 10,
    user_name: "Тимур Сатпаев",
    user_email: "t.satpayev@edu.kz",
    course_title: {
      ru: "DevOps инженер",
      kk: "DevOps инженер",
      en: "DevOps Engineer"
    },
    rating: 5,
    text: {
      ru: "Docker, K8s, CI/CD - все темы раскрыты полностью. Платформа работает без сбоев, интерфейс очень интуитивный.",
      kk: "Docker, K8s, CI/CD - барлық тақырыптар толық ашылған. Платформа іркіліссіз жұмыс істейді, интерфейсі өте интуитивті.",
      en: "Docker, K8s, CI/CD - all topics are fully covered. The platform works flawlessly, the interface is very intuitive."
    },
    admin_reply: null,
    created_at: "2026-02-10T00:00:00.000Z",
    is_featured: true,
  },
  {
    id: 11,
    user_name: "Диана Мурат",
    user_email: "d.murat@edu.kz",
    course_title: {
      ru: "Цифровой маркетинг",
      kk: "Цифрлық маркетинг",
      en: "Digital Marketing"
    },
    rating: 4,
    text: {
      ru: "Курс хороший, но хотелось бы больше примеров по некоторым темам. В целом было полезно.",
      kk: "Курс жақсы, бірақ кейбір тақырыптар бойынша көбірек мысалдар болса екен. Жалпы алғанда пайдалы болды.",
      en: "The course is good, but I would like more examples on some topics. Overall it was useful."
    },
    admin_reply: {
      ru: "Спасибо за отзыв, учтем!",
      kk: "Пікіріңізге рахмет, ескереміз!",
      en: "Thanks for the feedback, we'll take it into account!"
    },
    created_at: "2026-03-02T00:00:00.000Z",
    is_featured: false,
  },
  {
    id: 12,
    user_name: "Алексей Попов",
    user_email: "a.popov@bk.ru",
    course_title: {
      ru: "QA Automation (Java)",
      kk: "QA Automation (Java)",
      en: "QA Automation (Java)"
    },
    rating: 5,
    text: {
      ru: "Перешел из ручного тестирования в авто. Курс помог плавно освоить Java и Selenium. Теперь работаю в крупной финтех компании.",
      kk: "Қолмен тестілеуден автоматты тестілеуге ауыстым. Курс Java мен Selenium-ді бірқалыпты меңгеруге көмектесті. Қазір ірі финтех компаниясында жұмыс істеймін.",
      en: "Switched from manual testing to automation. The course helped me smoothly master Java and Selenium. Now I work in a large fintech company."
    },
    admin_reply: {
      ru: "Отличный карьерный скачок!",
      kk: "Керемет мансаптық секіріс!",
      en: "Great career leap!"
    },
    created_at: "2026-02-12T00:00:00.000Z",
    is_featured: true,
  },
  {
    id: 13,
    user_name: "Гульнара Серик",
    user_email: "g.serik@edu.kz",
    course_title: {
      ru: "Управление проектами",
      kk: "Жобаларды басқару",
      en: "Project Management"
    },
    rating: 5,
    text: {
      ru: "Узнала тонкости менеджмента. Систематизировала знания по Agile и Scrum. Работать с командой стало легче.",
      kk: "Менеджменттің қыр-сырын үйрендім. Agile мен Scrum бойынша білімдерімді жүйеледім. Командамен жұмыс істеу жеңілдеді.",
      en: "Learned the nuances of management. Systematized knowledge of Agile and Scrum. Working with the team became easier."
    },
    admin_reply: null,
    created_at: "2026-03-06T00:00:00.000Z",
    is_featured: false,
  },
  {
    id: 14,
    user_name: "Дмитрий Соколов",
    user_email: "d.sokolov@ya.ru",
    course_title: {
      ru: "Продвинутый C++",
      kk: "Кеңейтілген C++",
      en: "C++ Advanced"
    },
    rating: 5,
    text: {
      ru: "Глубокое погружение в алгоритмы и структуры данных. Платформа QIT действительно держит высокую планку качества.",
      kk: "Алгоритмдер мен деректер құрылымына терең бойлау. QIT платформасы шын мәнінде сапаның жоғары деңгейін сақтайды.",
      en: "Deep dive into algorithms and data structures. The QIT platform really maintains a high bar of quality."
    },
    admin_reply: {
      ru: "Мы стараемся для вас!",
      kk: "Біз сіз үшін тырысамыз!",
      en: "We try our best for you!"
    },
    created_at: "2026-02-05T00:00:00.000Z",
    is_featured: false,
  },
  {
    id: 15,
    user_name: "Малика Оспан",
    user_email: "m.ospan@edu.kz",
    course_title: {
      ru: "Разработка игр (Unity)",
      kk: "Ойын әзірлеу (Unity)",
      en: "GameDev (Unity)"
    },
    rating: 5,
    text: {
      ru: "Мечтала о разработке игр. Сейчас у меня есть свой небольшой проект. Все началось с QIT. Спасибо!",
      kk: "Ойын әзірлеуді армандаған едім. Қазір өзімнің кішігірім жобам бар. Бәрі QIT-тен басталды. Рахмет!",
      en: "I dreamed of game development. Now I have my own small project. It all started with QIT. Thanks!"
    },
    admin_reply: {
      ru: "Желаем вдохновения вашему творчеству!",
      kk: "Творчествоңызға шабыт тілейміз!",
      en: "We wish inspiration to your creativity!"
    },
    created_at: "2026-02-22T00:00:00.000Z",
    is_featured: true,
  },
  {
    id: 16,
    user_name: "Олег Волков",
    user_email: "o.volkov@gmail.com",
    course_title: {
      ru: "SQL и Базы данных",
      kk: "SQL және деректер қоры",
      en: "SQL & Databases"
    },
    rating: 4,
    text: {
      ru: "Хороший курс для старта. Базы данных перестали быть чем-то пугающим. Все разложили по полочкам.",
      kk: "Бастау үшін жақсы курс. Деректер қоры қорқынышты болудан қалды. Бәрін рет-ретімен түсіндірді.",
      en: "Good course for a start. Databases stopped being something scary. Everything was put on the shelves."
    },
    admin_reply: null,
    created_at: "2026-03-01T00:00:00.000Z",
    is_featured: false,
  },
  {
    id: 17,
    user_name: "Аяна Бекзат",
    user_email: "a.bekzat@edu.kz",
    course_title: {
      ru: "Английский для IT",
      kk: "IT-ге арналған ағылшын тілі",
      en: "English for IT"
    },
    rating: 5,
    text: {
      ru: "Изучение английского для IT было очень полезным. Стала лучше понимать термины. Отличные уроки!",
      kk: "IT саласына арналған ағылшын тілін үйрену өте пайдалы болды. Терминдерді жақсы түсіне бастадым. Керемет сабақтар!",
      en: "Learning English for IT was very useful. I started to understand terms better. Great lessons!"
    },
    admin_reply: {
      ru: "Продолжайте в том же духе!",
      kk: "Осы бағытта жалғастыра беріңіз!",
      en: "Keep up the good work!"
    },
    created_at: "2026-02-18T00:00:00.000Z",
    is_featured: false,
  },
  {
    id: 18,
    user_name: "Иван Кузнецов",
    user_email: "i.kuznetsov@bk.ru",
    course_title: {
      ru: "Основы Java",
      kk: "Java негіздері",
      en: "Java Core"
    },
    rating: 5,
    text: {
      ru: "Основы Java даны очень полно. Понравились домашние задания, которые заставляют думать и искать решения самостоятельно.",
      kk: "Java негіздері өте толық берілген. Тапсырмалар ойлануға және шешімдерді өз бетінше іздеуге мәжбүрлейтіні ұнады.",
      en: "Java basics are given very fully. I liked the homework assignments that make you think and look for solutions independently."
    },
    admin_reply: {
      ru: "Самостоятельная работа - залог успеха!",
      kk: "Өз бетінше жұмыс істеу - сәттілік кепілі!",
      en: "Self-study is the key to success!"
    },
    created_at: "2026-02-27T00:00:00.000Z",
    is_featured: true,
  },
  {
    id: 19,
    user_name: "Бахытгуль Али",
    user_email: "b.ali@edu.kz",
    course_title: {
      ru: "Основы HTML/CSS",
      kk: "HTML/CSS негіздері",
      en: "HTML/CSS Basic"
    },
    rating: 5,
    text: {
      ru: "Научилась верстать макеты. Уроки прошли очень интересно. Создала свои первые сайты.",
      kk: "Макеттерді версткалауды үйрендім. Сабақтар өте қызықты өтті. Алғашқы сайттарымды жасап шықтым.",
      en: "Learned how to lay out mockups. The lessons were very interesting. I created my first websites."
    },
    admin_reply: null,
    created_at: "2026-03-03T00:00:00.000Z",
    is_featured: false,
  },
  {
    id: 20,
    user_name: "Андрей Морозов",
    user_email: "a.morozov@google.com",
    course_title: {
      ru: "Node.js Бэкенд",
      kk: "Node.js Бэкенд",
      en: "Node.js Backend"
    },
    rating: 5,
    text: {
      ru: "Качественное обучение серверной разработке. Преподаватели делятся реальным опытом из индустрии. Очень ценно.",
      kk: "Серверлік әзірлеу бойынша сапалы оқыту. Оқытушылар индустриядағы нақты тәжірибелерімен бөліседі. Өте құнды.",
      en: "High-quality server-side development training. Teachers share real industry experience. Very valuable."
    },
    admin_reply: {
      ru: "Опыт - наше всё!",
      kk: "Тәжірибе - біздің бәріміз!",
      en: "Experience is everything!"
    },
    created_at: "2026-01-20T00:00:00.000Z",
    is_featured: true,
  },
  {
    id: 21,
    user_name: "Салтанат Самат",
    user_email: "s.samat@edu.kz",
    course_title: {
      ru: "Illustrator и Photoshop",
      kk: "Illustrator және Photoshop",
      en: "Illustrator & Photoshop"
    },
    rating: 5,
    text: {
      ru: "Открылась дверь в мир дизайна. Быстро научилась работать с инструментами. Спасибо команде QIT!",
      kk: "Дизайн әлеміне есік ашылды. Құралдармен жұмыс істеуді тез үйреніп алдым. Рахмет, QIT командасы!",
      en: "A door to the world of design has opened. Quickly learned how to work with the tools. Thanks to the QIT team!"
    },
    admin_reply: {
      ru: "Пусть ваше творчество процветает!",
      kk: "Творчествоңыз шыңдала берсін!",
      en: "May your creativity flourish!"
    },
    created_at: "2026-02-10T00:00:00.000Z",
    is_featured: false,
  },
  {
    id: 22,
    user_name: "Павел Новиков",
    user_email: "p.novikov@ya.ru",
    course_title: {
      ru: "React Разработчик",
      kk: "React әзірлеуші",
      en: "React Developer"
    },
    rating: 5,
    text: {
      ru: "Хуки, контекст, стейт менеджмент - все объяснили на пальцах. После курса чувствую себя уверенным фронтендщиком.",
      kk: "Хуки, контекст, стейт менеджмент - бәрін қарапайым тілмен түсіндірді. Курстан кейін өзімді сенімді фронтендші ретінде сезінемін.",
      en: "Hooks, context, state management - everything was explained simply. After the course, I feel like a confident frontend developer."
    },
    admin_reply: null,
    created_at: "2026-03-02T00:00:00.000Z",
    is_featured: true,
  },
  {
    id: 23,
    user_name: "Дамира Нурлан",
    user_email: "d.nurlan@edu.kz",
    course_title: {
      ru: "IT-менеджмент",
      kk: "IT-менеджмент",
      en: "IT Management"
    },
    rating: 4,
    text: {
      ru: "Курс очень содержательный. Поняла, как управлять крупными проектами. Много полезных советов.",
      kk: "Курс өте мазмұнды. Ірі жобаларды қалай басқару керектігін түсіндім. Пайдалы кеңестер көп.",
      en: "The course is very substantial. I understood how to manage large projects. Many useful tips."
    },
    admin_reply: {
      ru: "Удачи в делах!",
      kk: "Іске сәт!",
      en: "Good luck with your business!"
    },
    created_at: "2026-02-05T00:00:00.000Z",
    is_featured: false,
  },
  {
    id: 24,
    user_name: "Михаил Егоров",
    user_email: "m.egorov@bk.ru",
    course_title: {
      ru: "PHP и Laravel",
      kk: "PHP және Laravel",
      en: "PHP & Laravel"
    },
    rating: 5,
    text: {
      ru: "Классический бэкенд на современном фреймворке. Узнал много нового про архитектуру веб-приложений.",
      kk: "Заманауи фреймворктегі классикалық бэкенд. Веб-қосымшалардың архитектурасы туралы көптеген жаңа нәрселерді білдім.",
      en: "Classic backend on a modern framework. Learned a lot of new things about the architecture of web applications."
    },
    admin_reply: null,
    created_at: "2026-02-28T00:00:00.000Z",
    is_featured: false,
  },
  {
    id: 25,
    user_name: "Индира Жан",
    user_email: "i.zhan@edu.kz",
    course_title: {
      ru: "Компьютерная грамотность",
      kk: "Компьютерлік сауаттылық",
      en: "Computer Literacy"
    },
    rating: 5,
    text: {
      ru: "Научилась работать с компьютером. Теперь выполняю работу быстрее и качественнее. Очень нужный курс.",
      kk: "Компьютермен жұмыс істеуді үйрендім. Енді жұмысымды тез және сапалы орындай аламын. Өте қажетті курс.",
      en: "Learned how to work with a computer. Now I perform my work faster and better. A very necessary course."
    },
    admin_reply: {
      ru: "Мы очень рады!",
      kk: "Біз қуаныштымыз!",
      en: "We are very happy!"
    },
    created_at: "2026-03-05T00:00:00.000Z",
    is_featured: true,
  },
  {
    id: 26,
    user_name: "Роман Абрамов",
    user_email: "r.abramov@gmail.com",
    course_title: {
      ru: "Golang для Бэкенда",
      kk: "Golang Бэкенд үшін",
      en: "Golang for Backend"
    },
    rating: 5,
    text: {
      ru: "Быстрый язык для быстрых систем. Курс помог быстро вкатиться в Go после Python. Задачи интересные и сложные.",
      kk: "Жылдам жүйелерге арналған жылдам тіл. Курс Python-нан кейін Go-ға тез енуге көмектесті. Тапсырмалар қызықты және күрделі.",
      en: "A fast language for fast systems. The course helped me quickly get into Go after Python. The tasks are interesting and challenging."
    },
    admin_reply: {
      ru: "Go - отличный выбор!",
      kk: "Go - керемет таңдау!",
      en: "Go is a great choice!"
    },
    created_at: "2026-02-15T00:00:00.000Z",
    is_featured: false,
  },
  {
    id: 27,
    user_name: "Карлыгаш Абай",
    user_email: "k.abay@edu.kz",
    course_title: {
      ru: "SMM специалист",
      kk: "SMM маман",
      en: "SMM Specialist"
    },
    rating: 5,
    text: {
      ru: "Узнала, как развивать бренд в соцсетях. Практические задания были очень полезными.",
      kk: "Әлеуметтік желілерде брендті қалай дамыту керектігін үйрендім. Практикалық тапсырмалар өте пайдалы болды.",
      en: "Learned how to develop a brand in social networks. Practical tasks were very useful."
    },
    admin_reply: null,
    created_at: "2026-03-01T00:00:00.000Z",
    is_featured: false,
  },
  {
    id: 28,
    user_name: "Артем Васильев",
    user_email: "a.vasiliev@bk.ru",
    course_title: {
      ru: "Машинное обучение (Python)",
      kk: "Машиналық оқыту (Python)",
      en: "Machine Learning (Python)"
    },
    rating: 5,
    text: {
      ru: "Обучение на данных - это будущее. Спасибо QIT за возможность прикоснуться к этим технологиям уже сегодня.",
      kk: "Деректер негізінде оқыту - бұл болашақ. QIT-ке бүгінгі таңда осы технологиялармен танысуға мүмкіндік бергені үшін рахмет.",
      en: "Learning on data is the future. Thanks to QIT for the opportunity to touch these technologies already today."
    },
    admin_reply: {
      ru: "Будущее уже наступило!",
      kk: "Болашақ келді!",
      en: "The future has already arrived!"
    },
    created_at: "2026-02-20T00:00:00.000Z",
    is_featured: true,
  },
  {
    id: 29,
    user_name: "Асем Болат",
    user_email: "a.bolat2@edu.kz",
    course_title: {
      ru: "Цифровое искусство",
      kk: "Сандық өнер",
      en: "Digital Art"
    },
    rating: 5,
    text: {
      ru: "Научилась рисовать в цифре. Работа с Procreate и Photoshop очень интересна. Спасибо!",
      kk: "Сандық сурет салуды үйрендім. Procreate және Photoshop-пен жұмыс істеу өте қызықты. Рахмет!",
      en: "Learned how to draw digitally. Working with Procreate and Photoshop is very interesting. Thanks!"
    },
    admin_reply: {
      ru: "Пусть ваше творчество идет только вперед!",
      kk: "Творчествоңыз алға баса берсін!",
      en: "May your creativity only go forward!"
    },
    created_at: "2026-03-04T00:00:00.000Z",
    is_featured: false,
  },
  {
    id: 30,
    user_name: "Василий Зайцев",
    user_email: "v.zaytsev@ya.ru",
    course_title: {
      ru: "Архитектура систем",
      kk: "Жүйелер архитектурасы",
      en: "System Architecture"
    },
    rating: 5,
    text: {
      ru: "Курс для тех, кто хочет строить по-настоящему надежные системы. Высокий уровень экспертизы преподавателей.",
      kk: "Нағыз сенімді жүйелерді құрғысы келетіндерге арналған курс. Оқытушылардың жоғары сараптамалық деңгейі.",
      en: "A course for those who want to build truly reliable systems. High level of teacher expertise."
    },
    admin_reply: {
      ru: "Надежность - наш приоритет.",
      kk: "Сенімділік - біздің басты назарымызда.",
      en: "Reliability is our priority."
    },
    created_at: "2026-01-15T00:00:00.000Z",
    is_featured: true,
  },
  {
    id: 31,
    user_name: "Айтолқын Берік",
    user_email: "a.berik@edu.kz",
    course_title: {
      ru: "Power BI и Excel",
      kk: "Power BI және Excel",
      en: "Power BI & Excel"
    },
    rating: 4,
    text: {
      ru: "Работать с данными стало легче. Научилась создавать отчеты автоматически. Отличная возможность!",
      kk: "Деректермен жұмыс істеу жеңілдеді. Есептерді автоматты түрде жасауды үйрендім. Керемет мүмкіндік!",
      en: "Working with data became easier. Learned how to create reports automatically. Great opportunity!"
    },
    admin_reply: null,
    created_at: "2026-03-02T00:00:00.000Z",
    is_featured: false,
  },
  {
    id: 32,
    user_name: "Григорий Орлов",
    user_email: "g.orlov@bk.ru",
    course_title: {
      ru: "Кибербезопасность Pro",
      kk: "Киберқауіпсіздік Pro",
      en: "Cyber Security Pro"
    },
    rating: 5,
    text: {
      ru: "Продвинутые техники защиты и атаки. Рекомендую всем, кто хочет серьезно заниматься безопасностью.",
      kk: "Қорғау мен шабуылдың озық техникалары. Қауіпсіздікпен байыпты айналысқысы келетіндердің бәріне ұсынамын.",
      en: "Advanced protection and attack techniques. I recommend it to everyone who wants to seriously engage in security."
    },
    admin_reply: {
      ru: "Безопасность прежде всего!",
      kk: "Қауіпсіздік бәрінен бұрын!",
      en: "Security first!"
    },
    created_at: "2026-02-25T00:00:00.000Z",
    is_featured: true,
  },
  {
    id: 33,
    user_name: "Бекзат Мурат",
    user_email: "b.murat@edu.kz",
    course_title: {
      ru: "Swift Разработчик",
      kk: "Swift әзірлеуші",
      en: "Swift Developer"
    },
    rating: 5,
    text: {
      ru: "Сделала шаг в мир iOS. Курс очень качественный, получила ответы на все свои вопросы. Спасибо QIT!",
      kk: "iOS әлеміне қадам бастым. Курс өте сапалы, барлық сұрақтарыма жауап алдым. Рахмет, QIT!",
      en: "Stepped into the world of iOS. The course is very high quality, I got answers to all my questions. Thanks QIT!"
    },
    admin_reply: {
      ru: "Добро пожаловать в мир Apple!",
      kk: "Apple әлеміне қош келдіңіз!",
      en: "Welcome to the world of Apple!"
    },
    created_at: "2026-03-06T00:00:00.000Z",
    is_featured: false,
  },
  {
    id: 34,
    user_name: "Анастасия Козлова",
    user_email: "a.kozlova@gmail.com",
    course_title: {
      ru: "Копирайтинг",
      kk: "Копирайтинг",
      en: "Copywriting"
    },
    rating: 5,
    text: {
      ru: "Научилась писать тексты, которые цепляют. Очень много практики и разборов реальных кейсов.",
      kk: "Қызықтыратын мәтіндер жазуды үйрендім. Көптеген практика және нақты кейстерді талдау болды.",
      en: "Learned how to write texts that hook. A lot of practice and analysis of real cases."
    },
    admin_reply: null,
    created_at: "2026-02-12T00:00:00.000Z",
    is_featured: false,
  },
  {
    id: 35,
    user_name: "Ерасыл Серік",
    user_email: "e.serik@edu.kz",
    course_title: {
      ru: "Аналитика данных",
      kk: "Деректер аналитикасы",
      en: "Data Analytics"
    },
    rating: 5,
    text: {
      ru: "Научилась анализировать данные. Теперь могу помогать улучшать процессы в компании. Полезные знания!",
      kk: "Деректерді талдауды үйрендім. Енді компаниядағы процестерді жақсартуға көмектесе аламын. Пайдалы білім!",
      en: "Learned how to analyze data. Now I can help improve processes in the company. Useful knowledge!"
    },
    admin_reply: {
      ru: "Удачи!",
      kk: "Сәттілік!",
      en: "Good luck!"
    },
    created_at: "2026-03-07T00:00:00.000Z",
    is_featured: true,
  }
];
