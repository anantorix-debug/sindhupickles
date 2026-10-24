import { NextResponse } from "next/server";
import { route } from "@/server/http";
import { handleWebhook } from "@/server/store/payments/razorpay/webhook";

/** Server-to-server from Razorpay: no cookies, no Origin. Authenticated solely by the HMAC signature on the raw body. */
export const POST = route(async (req) => {
  const raw = await req.text();
  const outcome = await handleWebhook(raw, req.headers.get("x-razorpay-signature"), req.headers.get("x-razorpay-event-id"));
  return NextResponse.json({ received: true, outcome });
});
