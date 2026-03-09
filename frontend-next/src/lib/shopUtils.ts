import type { Purchase } from "@/types";

/** Maps API product title to translation key for localized display */
export const PRODUCT_TITLE_KEYS: Record<string, string> = {
  // Kazakh (Primary)
  "IT значок": "productITBadge",
  "Қалам гель": "productGelPen",
  "Қызмет көрсету сертификаты": "productServiceCertificate",
  "Қағаз клип": "productPaperClip",
  "Стикерлер жинағы": "productStickers",
  // Russian variants
  "IT значок (RU)": "productITBadge",
  "Гелевая ручка": "productGelPen",
  "Сертификат на услуги": "productServiceCertificate",
  "Скрепка": "productPaperClip",
  "Набор стикеров": "productStickers",
  "IT магнитик (RU)": "productITMagnet",
  "Ножницы": "productScissors",
  "Набор ручек": "productPenSet",
  "Тонкая тетрадь": "productShortNotebook",
  "Цветные карандаши": "productColoredPencils",
  "Бумага A4": "productA4Paper",
  "Бумажный пакет": "productPaperBag",
  "Металлические скрепки": "productMetalClips",
  "Тетрадь A4": "productA4Notebook",
  "IT тетрадь": "productITNotebook",
  "Ручка": "productPen",
  "Пачка бумаги A4": "productA4PaperPack",
  "Цветные карандаши (разные)": "productVariousColoredPencils",
  // Kazakh additions
  "IT магнитик": "productITMagnet",
  "Қайшы": "productScissors",
  "Қалам жинағы": "productPenSet",
  "Қысқа дәптер": "productShortNotebook",
  "Қаламша": "productColoredPencils",
  "A4 қағаз": "productA4Paper",
  "Қағаз қап": "productPaperBag",
  "A4 дәптер": "productA4Notebook",
  "IT дәптер": "productITNotebook",
  "Қалам қалам": "productPen",
  "А4 қағаз пачка": "productA4PaperPack",
  "Қаламша түрлі": "productVariousColoredPencils",
};

export const PRODUCT_DESC_KEYS: Record<string, string> = {
  // Add description keys if available in translations
};

export const CATEGORY_KEYS: Record<string, string> = {
  all: "shopAll",
  favorites: "shopFavorites",
  book: "shopBooks",
  souvenir: "shopSouvenirs",
  cap: "shopCaps",
  notebook: "shopNotebooks",
  a4: "shopPaper",
  headphones: "shopHeadphones",
  keyboard: "shopKeyboards",
  laptop: "shopLaptops",
  monitor: "shopMonitor",
  mouse: "shopMouse",
  webcam: "shopWebcam",
  bag: "shopBags",
  other: "shopOther",
};

export function getLocalizedProductTitle(
  title: string,
  t: (key: string) => string
): string {
  const key = PRODUCT_TITLE_KEYS[title];
  return key ? t(key) : title;
}

export function getLocalizedShopItemTitle(
  item: { title: string },
  t: (key: string) => string
): string {
  return getLocalizedProductTitle(item.title, t);
}

export function getLocalizedShopItemDesc(
  item: { title: string; description: string | null },
  t: (key: string) => string
): string {
  const key = PRODUCT_DESC_KEYS[item.title];
  return key ? t(key) : (item.description ?? "");
}
