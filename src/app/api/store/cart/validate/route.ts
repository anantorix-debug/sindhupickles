import { cartValidateSchema } from "@/lib/validation/store";
import { ok, readJson } from "@/server/http";
import { storeRoute } from "@/server/store/http";
import { resolveCart, toPricedCart } from "@/server/store/pricing";
import { getSessionCustomerId } from "@/server/store/session";

/**
 * Prices a cart on the server. The browser only sends which variants and quantities it wants;
 * this returns the real prices, stock-clamped quantities, coupon result and totals.
 */
export const POST = storeRoute(async (req) => {
  const { items, couponCode } = await readJson(req, cartValidateSchema);
  const cart = await resolveCart(items, { couponCode, customerId: await getSessionCustomerId() });
  return ok(toPricedCart(cart), { headers: { "Cache-Control": "no-store" } });
});
