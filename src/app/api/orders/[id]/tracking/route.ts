import { trackingSchema } from "@/lib/validation/content";
import { ok, parseId, readJson, adminRoute } from "@/server/http";
import { updateTracking } from "@/server/repositories/orders";

export const PATCH = adminRoute(async (req, { params }) => {
  const id = parseId((await params).id, "Order");
  return ok(await updateTracking(id, await readJson(req, trackingSchema)));
});
