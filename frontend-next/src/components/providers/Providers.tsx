"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { LanguageProvider } from "@/context/LanguageContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { SidebarProvider } from "@/context/SidebarContext";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Оптимизированное кеширование для улучшения производительности
            staleTime: 5 * 60 * 1000, // Данные считаются свежими 5 минут (300000ms)
            gcTime: 10 * 60 * 1000, // Храним данные в кеше 10 минут (600000ms)
            refetchOnMount: false, // Используем кеш при монтировании, если данные свежие
            refetchOnWindowFocus: false, // Не обновляем при фокусе окна
            refetchOnReconnect: true, // Обновляем при восстановлении соединения
          },
        },
      })
  );

  return (
    <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ""}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <LanguageProvider>
            <SidebarProvider>{children}</SidebarProvider>
          </LanguageProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </GoogleOAuthProvider>
  );
}
