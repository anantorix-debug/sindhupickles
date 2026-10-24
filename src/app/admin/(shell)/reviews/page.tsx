import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/common/page-header";
import { ReviewsTable } from "@/components/admin/tables/reviews-table";
import { listReviews } from "@/server/repositories/reviews";

export const metadata: Metadata = { title: "Reviews" };

export default async function ReviewsPage() {
  const reviews = await listReviews();
  return (
    <>
      <PageHeader title="Reviews" description="Moderate what customers say about your pickles." />
      <ReviewsTable reviews={reviews} />
    </>
  );
}
