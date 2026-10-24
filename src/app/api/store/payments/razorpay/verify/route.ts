import { z } from "zod";
import { ok, readJson } from "@/server/http";
import { requireCustomer, storeRoute } from "@/server/store/http";
import { rateLimit } from "@/server/store/rate-limit";
import { verifyAndConfirm } from "@/server/store/payments/razorpay/service";

const schema = z.object({
  orderId: z.string().regex(/^\d{1,18}$/),
  razorpay_order_id: z.string().min(5).max(64),
  razorpay_payment_id: z.string().min(5).max(64),
  razorpay_signature: z.string().min(10).max(200),
});

/** The browser's "payment succeeded" is only a claim: the signature and the payment itself are verified server-side. */
export const POST = storeRoute(async (req) => {
  const customerId = await requireCustomer();
  rateLimit(`rzp-verify:${customerId}`, 30, 10 * 60_000);
  return ok(await verifyAndConfirm(customerId, await readJson(req, schema)), { headers: { "Cache-Control": "no-store" } });
});
