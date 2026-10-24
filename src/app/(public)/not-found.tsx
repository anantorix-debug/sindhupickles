import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/store/common/section-heading";
import { StateMessage } from "@/components/store/common/state-message";

export default function PublicNotFound() {
  return (
    <PageContainer>
      <StateMessage
        title="We couldn't find that page"
        description="The pickle or page you're looking for may have moved or sold out for good."
        action={
          <Button asChild>
            <Link href="/shop">Browse all pickles</Link>
          </Button>
        }
      />
    </PageContainer>
  );
}
