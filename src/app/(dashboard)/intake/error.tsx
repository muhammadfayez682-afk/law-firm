"use client";

import { ErrorState } from "@/components/ui/ErrorState";

export default function IntakeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorState error={error} reset={reset} />;
}
