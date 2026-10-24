"use client";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/admin/common/empty-state";

export default function AdminError({ reset }: { error: Error; reset: () => void }) {
  return (
    <ErrorState
      description="We couldn't load this page. Please try again."
      action={<Button onClick={reset}>Try again</Button>}
    />
  );
}
