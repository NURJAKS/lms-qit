import axios from "axios";
import { useAuthStore } from "../store/authStore";

const token = () => {
  if (typeof window === "undefined") return null;
  const fromStore = useAuthStore.getState().token;
  if (fromStore) return fromStore;
  return localStorage.getItem("token");
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
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const t = token();
  if (t) config.headers.Authorization = `Bearer ${t}`;
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
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);
