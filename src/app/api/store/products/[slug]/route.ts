import { notFound, ok } from "@/server/http";
import { getProductBySlug } from "@/server/store/catalog";
import { storeRoute } from "@/server/store/http";

export const GET = storeRoute(async (_req, { params }) => {
  const product = await getProductBySlug((await params).slug);
  if (!product) throw notFound("Product");
  return ok(product, { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" } });
});
