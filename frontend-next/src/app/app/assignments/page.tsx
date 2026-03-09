"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AssignmentsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/app/tasks-calendar?tab=all-assignments");
  }, [router]);
  return null;
}
