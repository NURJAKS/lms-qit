export interface User {
  id: number;
  email: string;
  full_name: string;
  role: string;
  photo_url?: string;
  description?: string;
  phone?: string;
  birth_date?: string;
  city?: string;
  address?: string;
  parent_id?: number;
  points?: number;
  is_premium?: number;
  is_approved?: boolean;
  has_group_access?: boolean;
  created_at?: string;
}

export interface Course {
  id: number;
  title: string;
  description?: string;
  image_url?: string;
  category_id?: number;
  is_active: boolean;
  is_premium_only?: boolean;
  price: number | string;
  language: string;
  created_by?: number;
  published_at?: string;
  created_at?: string;
}

export interface CourseModule {
  id: number;
  course_id: number;
  title: string;
  order_number: number;
  description?: string;
  topics: CourseTopic[];
}

export interface CourseTopic {
  id: number;
  title: string;
  order_number: number;
  video_url?: string;
  video_duration?: number;
}

export interface Test {
  id: number;
  course_id: number;
  topic_id?: number | null;
  title: string;
  passing_score: number;
  question_count: number;
  is_final: boolean;
  time_limit_seconds?: number | null;
}

export interface TestQuestion {
  id: number;
  test_id: number;
  question_text: string;
  correct_answer?: string; // present in admin API, absent in student API
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  order_number?: number | null;
}

export interface NotificationItem {
  id: number;
  type: string;
  title: string;
  message: string;
  link?: string;
  is_read: boolean;
  created_at: string;
}
