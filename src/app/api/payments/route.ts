import { ok, adminRoute } from "@/server/http";
import { listPayments } from "@/server/repositories/payments";

export const GET = adminRoute(async () => ok(await listPayments()));
