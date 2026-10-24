import { ok, adminRoute } from "@/server/http";
import { getDashboard } from "@/server/repositories/analytics";

export const GET = adminRoute(async () => ok(await getDashboard()));
