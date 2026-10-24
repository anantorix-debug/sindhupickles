import { ok } from "@/server/http";
import { isProductSort, listProducts } from "@/server/store/catalog";
import { storeRoute } from "@/server/store/http";

/** GET /api/store/products?category=&q=&sort=&page=&pageSize= — active products only. */
export const GET = storeRoute(async (req) => {
  const sp = req.nextUrl.searchParams;
  const sort = sp.get("sort") ?? undefined;
  const data = await listProducts({
    category: sp.get("category") ?? undefined,
    q: sp.get("q") ?? undefined,
    sort: isProductSort(sort) ? sort : undefined,
    page: Number(sp.get("page")) || 1,
    pageSize: Number(sp.get("pageSize")) || 12,
  });
  return ok(data, { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" } });
});
