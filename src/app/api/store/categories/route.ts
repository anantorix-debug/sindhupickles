import { ok } from "@/server/http";
import { listCategories } from "@/server/store/catalog";
import { storeRoute } from "@/server/store/http";

export const GET = storeRoute(async () =>
  ok(await listCategories(), { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }),
);
