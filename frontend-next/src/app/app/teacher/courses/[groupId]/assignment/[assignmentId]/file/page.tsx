import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ groupId: string; assignmentId: string }>;
  searchParams: Promise<{ studentId?: string; fileIndex?: string }>;
};

export default async function AssignmentFileRoutePage({ params, searchParams }: PageProps) {
  const { groupId, assignmentId } = await params;
  const { studentId, fileIndex } = await searchParams;

  const qs = new URLSearchParams({ tab: "student-work" });
  if (studentId) qs.set("studentId", studentId);
  if (fileIndex) qs.set("fileIndex", fileIndex);

  redirect(`/app/teacher/courses/${groupId}/assignment/${assignmentId}?${qs.toString()}`);
}
