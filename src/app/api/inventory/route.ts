import { ok, adminRoute } from "@/server/http";
import { listInventory } from "@/server/repositories/inventory";

export const GET = adminRoute(async () => ok(await listInventory()));
