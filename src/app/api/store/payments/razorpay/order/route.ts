import { z } from "zod";
import { ok, readJson } from "@/server/http";
import { requireCustomer, storeRoute } from "@/server/store/http";
import { rateLimit } from "@/server/store/rate-limit";
import { startRazorpayPayment } from "@/server/store/payments/razorpay/service";

/** Creates the Razorpay order for one of the signed-in customer's unpaid orders. The amount is read from our database. */
export const POST = storeRoute(async (req) => {
  const customerId = await requireCustomer();
  rateLimit(`rzp-order:${customerId}`, 20, 10 * 60_000);
  const { orderId } = await readJson(req, z.object({ orderId: z.string().regex(/^\d{1,18}$/) }));
  return ok(await startRazorpayPayment(customerId, orderId), { headers: { "Cache-Control": "no-store" } });
});
