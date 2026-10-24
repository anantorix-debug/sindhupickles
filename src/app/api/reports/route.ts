import { ok, adminRoute } from "@/server/http";
import { getReports } from "@/server/repositories/analytics";

export const GET = adminRoute(async () => ok(await getReports()));
