import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";

export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
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
  });
}
