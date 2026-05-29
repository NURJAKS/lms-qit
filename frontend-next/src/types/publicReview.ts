/** Отзыв с публичного API GET /reviews (одобренные). */
export type PublicReview = {
  id: number;
  user_name: string;
  course_title: string;
  course_id?: number;
  rating: number;
  text: string | null;
  is_featured?: boolean;
  admin_reply?: string | null;
  created_at?: string | null;
};
