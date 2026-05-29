import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { useAuthStore } from "../store/authStore";

export function useNotifications() {
  const user = useAuthStore((s) => s.user);

  return useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await api.get<
        Array<{
          id: number;
          type: string;
          title: string;
          message: string;
          link?: string;
          is_read: boolean;
          created_at: string;
        }>
      >("/notifications?is_read=false");
      return data;
    },
    refetchInterval: 30_000,
    enabled: !!user?.id,
  });
}
