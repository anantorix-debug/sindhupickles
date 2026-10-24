import { ok, adminRoute } from "@/server/http";
import { listReviews } from "@/server/repositories/reviews";

export const GET = adminRoute(async () => ok(await listReviews()));
