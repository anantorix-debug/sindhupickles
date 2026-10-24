import Link from "next/link";
import { StoreProviders } from "@/components/store/providers";
import { ReviewForm } from "@/components/store/product/review-form";
import type { ReviewEligibility } from "@/server/store/reviews";

/** What the visitor sees under "Customer reviews": the form for a verified buyer, otherwise a short explanation. */
export function ReviewPrompt({ state, productSlug }: { state: ReviewEligibility; productSlug: string }) {
  if (state === "can_review") {
    return (
      <StoreProviders>
        <ReviewForm productSlug={productSlug} />
      </StoreProviders>
    );
  }
  const text: Record<Exclude<ReviewEligibility, "can_review">, React.ReactNode> = {
    signed_out: (
      <>
        Bought this pickle? <Link href={`/login?next=${encodeURIComponent(`/product/${productSlug}`)}`} className="font-semibold text-accent hover:underline">Sign in</Link> to share your review.
      </>
    ),
    not_buyer: "Reviews can be written by customers once their order of this pickle has been delivered.",
    pending: "Thank you for your review. It will appear here once it has been approved.",
    reviewed: "You have reviewed this pickle. Thank you!",
  };
  return <p className="rounded-lg border border-border bg-surface p-4 text-sm text-muted">{text[state]}</p>;
}
