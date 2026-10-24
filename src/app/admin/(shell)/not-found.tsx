import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/admin/common/empty-state";

export default function AdminNotFound() {
  return (
    <EmptyState
      icon={SearchX}
      title="We couldn't find that"
      description="The record may have been deleted, or the link is wrong."
      action={
        <Button asChild>
          <Link href="/admin/dashboard">Back to dashboard</Link>
        </Button>
      }
    />
  );
}
