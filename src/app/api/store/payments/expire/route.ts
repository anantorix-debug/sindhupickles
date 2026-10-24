import { timingSafeEqual } from "node:crypto";
import { ApiError, ok, route } from "@/server/http";
import { expireUnpaidOrders } from "@/server/store/payments/razorpay/service";

/** Called by a scheduler (cron): `Authorization: Bearer $CRON_SECRET`. Cancels stale unpaid online orders and releases their stock. */
export const POST = route(async (req) => {
  const secret = process.env.CRON_SECRET;
  const given = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!secret || secret.length < 24 || given.length !== secret.length || !timingSafeEqual(Buffer.from(given), Buffer.from(secret))) {
    throw new ApiError(401, "Unauthorized", "unauthenticated");
  }
  return ok({ expired: await expireUnpaidOrders(Number(process.env.UNPAID_ORDER_EXPIRY_MINUTES ?? 60)) });
});
