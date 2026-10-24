import { PageContainer, SectionHeading } from "@/components/store/common/section-heading";
import { Rating } from "@/components/store/common/rating";
import type { StoreReview } from "@/types/store";

/** Real customer reviews from the database. Renders nothing until reviews exist. */
export function ReviewsSection({ reviews }: { reviews: (StoreReview & { productName: string })[] }) {
  if (reviews.length === 0) return null;
  return (
    <section aria-labelledby="reviews-title" className="bg-section-warm">
      <PageContainer className="space-y-10 py-14 sm:py-20">
        <div id="reviews-title">
          <SectionHeading title="Loved by Foodies Across India" description="Read actual feedback from our loving customer family." />
        </div>
        <ul className="grid gap-6 md:grid-cols-3">
          {reviews.map((r) => (
            <li key={r.id} className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6 sm:p-8">
              <Rating value={r.rating} />
              <blockquote className="flex-1 text-[15px] italic leading-relaxed">“{r.comment}”</blockquote>
              <footer>
                <p className="text-sm font-bold">{r.customerName}</p>
                <p className="text-xs text-muted">on {r.productName}</p>
              </footer>
            </li>
          ))}
        </ul>
      </PageContainer>
    </section>
  );
}
