import axios from "axios";
import { useAuthStore } from "../store/authStore";

const token = () => {
  if (typeof window === "undefined") return null;
  // Try to get from localStorage first as it's the most reliable source if rehydration is slow
  const rawToken = localStorage.getItem("token");
  if (rawToken) return rawToken;
  
  // Fallback to store
  const fromStore = useAuthStore.getState().token;
  if (fromStore) return fromStore;
  
  return null;
};

export const api = axios.create({
  baseURL: "/api",
  headers: {
    "Content-Type": "application/json",
    // ngrok заголовок оставлен для совместимости, но не обязателен для локального запуска
    ...(typeof window !== "undefined" && window.location.hostname.includes("ngrok") 
      ? { "ngrok-skip-browser-warning": "1" } 
      : {}),
  },
  timeout: 60000,
});

api.interceptors.request.use((config) => {
  const t = token();
  const hasAuthorizationHeader =
    Boolean(config.headers?.Authorization) || Boolean(config.headers?.authorization);
  if (t && !hasAuthorizationHeader) {
    config.headers.Authorization = `Bearer ${t}`;
  }
  // Для FormData не задаём Content-Type — браузер сам добавит multipart/form-data с boundary
  if (config.data instanceof FormData) {
    delete config.headers["Content-Type"];
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    const isAuthEndpoint = err.config?.url?.includes("/auth/login") || err.config?.url?.includes("/auth/register");
    if (err.response?.status === 401 && !isAuthEndpoint) {
      useAuthStore.getState().logout();
      if (typeof window !== "undefined") {
        localStorage.removeItem("auth-storage");
        const currentPath = `${window.location.pathname}${window.location.search}`;
        const redirect = currentPath.startsWith("/app")
          ? `?redirect=${encodeURIComponent(currentPath)}`
          : "";
        window.location.href = `/login${redirect}`;
      }
    }
    return Promise.reject(err);
  }
);
