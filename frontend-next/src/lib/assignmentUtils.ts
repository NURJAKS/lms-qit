export const ASSIGNMENT_TITLE_KEYS: Record<string, string> = {
  "Тестовое задание для студента": "testStudentAssignmentTitle",
};

export function getLocalizedAssignmentTitle<K extends string>(
  title: string | null | undefined,
  t: (key: K) => string
): string {
  const normalizedTitle = (title ?? "").trim();
  if (!normalizedTitle) return "";

  const key = ASSIGNMENT_TITLE_KEYS[normalizedTitle];
  return key ? (t as (key: string) => string)(key) : normalizedTitle;
}

