import { Theme } from "@/context/ThemeContext";

/**
 * Возвращает стили для glassmorphism карточек в зависимости от темы - улучшенный с разделением
 */
export function getGlassCardStyle(theme: Theme) {
  if (theme === "dark") {
    return {
      background: "rgba(26, 34, 56, 0.7)",
      backdropFilter: "blur(20px) saturate(180%)",
      WebkitBackdropFilter: "blur(20px) saturate(180%)",
      borderWidth: "1px",
      borderStyle: "solid",
      borderColor: "rgba(255, 255, 255, 0.12)",
      boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.2)",
    };
  }
  return {
    background: "#F8FAFC",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "rgba(0, 0, 0, 0.08)",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.03)",
  };
}

/**
 * Возвращает стили для модальных окон в зависимости от темы
 */
export function getModalStyle(theme: Theme) {
  if (theme === "dark") {
    return {
      background: "rgba(26, 34, 56, 0.95)",
      backdropFilter: "blur(12px)",
      border: "1px solid rgba(255, 255, 255, 0.08)",
    };
  }
  return {
    background: "rgba(255, 255, 255, 0.98)",
    backdropFilter: "blur(12px)",
    border: "1px solid rgba(0, 0, 0, 0.1)",
    boxShadow: "0 20px 60px rgba(0, 0, 0, 0.15)",
  };
}

/**
 * Возвращает стили для инпутов в зависимости от темы
 */
export function getInputStyle(theme: Theme) {
  if (theme === "dark") {
    return {
      background: "rgba(30, 41, 59, 0.7)",
      border: "1px solid rgba(255, 255, 255, 0.1)",
      color: "#FFFFFF",
    };
  }
  return {
    background: "rgba(255, 255, 255, 0.9)",
    border: "1px solid rgba(0, 0, 0, 0.12)",
    color: "#0F172A",
  };
}

/**
 * Возвращает цвета текста в зависимости от темы
 */
export function getTextColors(theme: Theme) {
  if (theme === "dark") {
    return {
      primary: "#FFFFFF",
      secondary: "#94A3B8",
    };
  }
  return {
    primary: "#0F172A",
    secondary: "#64748B",
  };
}

/**
 * Возвращает стили для карточек дашборда - улучшенный современный дизайн с четким разделением
 */
export function getDashboardCardStyle(theme: Theme) {
  if (theme === "dark") {
    return {
      background: "rgba(30, 41, 59, 0.8)",
      border: "1px solid rgba(255, 255, 255, 0.08)",
      boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3), 0 1px 3px rgba(0, 0, 0, 0.2)",
    };
  }
  return {
    background: "#FFFFFF",
    border: "1px solid rgba(0, 0, 0, 0.08)",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.05)",
  };
}

/**
 * Возвращает стили для темных карточек (как Financial Report) - улучшенный дизайн
 */
export function getDarkCardStyle() {
  return {
    background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    boxShadow: "0 4px 16px rgba(0, 0, 0, 0.3)",
  };
}
