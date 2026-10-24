import { checkoutSchema } from "@/lib/validation/store";
import { created, readJson } from "@/server/http";
import { placeOrder } from "@/server/store/checkout";
import { requireCustomer, storeRoute } from "@/server/store/http";
import { rateLimit } from "@/server/store/rate-limit";

/** Creates an order for the signed-in customer. Prices, stock and totals are computed server-side. */
export const POST = storeRoute(async (req) => {
  const customerId = await requireCustomer();
  rateLimit(`checkout:${customerId}`, 10, 10 * 60_000);
  return created(await placeOrder(customerId, await readJson(req, checkoutSchema)));
});
