import { reviewSchema } from "@/lib/validation/store";
import { created, readJson } from "@/server/http";
import { requireCustomer, storeRoute } from "@/server/store/http";
import { rateLimit } from "@/server/store/rate-limit";
import { submitReview } from "@/server/store/reviews";

/** A signed-in customer reviews a product they have received. It waits for the owner's approval before it shows. */
export const POST = storeRoute(async (req) => {
  const customerId = await requireCustomer();
  rateLimit(`review:${customerId}`, 6, 60 * 60_000);
  return created(await submitReview(customerId, await readJson(req, reviewSchema)));
});
