import { stockAdjustSchema } from "@/lib/validation/api";
import { notFound, ok, parseId, readJson, adminRoute } from "@/server/http";
import { adjustStock, getInventoryItem } from "@/server/repositories/inventory";

export const GET = adminRoute(async (_req, { params }) => {
  const item = await getInventoryItem(parseId((await params).variantId, "Variant"));
  if (!item) throw notFound("Inventory record");
  return ok(item);
});

export const PATCH = adminRoute(async (req, { params }) => {
  const variantId = parseId((await params).variantId, "Variant");
  return ok(await adjustStock(variantId, await readJson(req, stockAdjustSchema)));
});
