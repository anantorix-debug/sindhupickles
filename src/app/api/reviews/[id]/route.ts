import { reviewVisibilitySchema } from "@/lib/validation/content";
import { ok, parseId, readJson, adminRoute } from "@/server/http";
import { deleteReview, setReviewVisibility } from "@/server/repositories/reviews";

export const PATCH = adminRoute(async (req, { params }) => {
  const id = parseId((await params).id, "Review");
  const { visible } = await readJson(req, reviewVisibilitySchema);
  await setReviewVisibility(id, visible);
  return ok({ id, visible });
});

export const DELETE = adminRoute(async (_req, { params }) => {
  await deleteReview(parseId((await params).id, "Review"));
  return ok({ deleted: true });
});
