import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { ApiError } from "@/server/http";
import { razorpayConfig, type RazorpayConfig } from "./config";

export function requireRazorpay(): RazorpayConfig {
  const cfg = razorpayConfig();
  if (!cfg) throw new ApiError(501, "Online payment isn't available right now", "payment_not_configured");
  return cfg;
}

const safeEqualHex = (a: string, b: string) => {
  const x = Buffer.from(a, "utf8");
  const y = Buffer.from(b, "utf8");
  return x.length === y.length && timingSafeEqual(x, y);
};

/** Checkout success signature: HMAC-SHA256(`${order_id}|${payment_id}`, key_secret). */
export function verifyCheckoutSignature(cfg: RazorpayConfig, orderId: string, paymentId: string, signature: string): boolean {
  const expected = createHmac("sha256", cfg.keySecret).update(`${orderId}|${paymentId}`).digest("hex");
  return safeEqualHex(expected, signature);
}

/** Webhook signature: HMAC-SHA256(raw body, webhook secret). Must be given the *unparsed* body. */
export function verifyWebhookSignature(cfg: RazorpayConfig, rawBody: string, signature: string): boolean {
  if (!cfg.webhookSecret || !signature) return false;
  return safeEqualHex(createHmac("sha256", cfg.webhookSecret).update(rawBody).digest("hex"), signature);
}

async function call<T>(cfg: RazorpayConfig, method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${cfg.apiBase}${path}`, {
      method,
      headers: {
        Authorization: `Basic ${Buffer.from(`${cfg.keyId}:${cfg.keySecret}`).toString("base64")}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
  } catch {
    throw new ApiError(502, "The payment service is unreachable. Please try again.", "payment_gateway_unreachable");
  }
  const json = (await res.json().catch(() => null)) as (T & { error?: { description?: string } }) | null;
  if (!res.ok || !json) {
    // Log the gateway's description server-side only; never forward gateway details or keys to the browser.
    console.error("[razorpay]", method, path, res.status, json?.error?.description);
    throw new ApiError(502, "The payment service couldn't process this request. Please try again.", "payment_gateway_error");
  }
  return json;
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  receipt: string | null;
  status: string;
}

export interface RazorpayPayment {
  id: string;
  order_id: string | null;
  amount: number;
  currency: string;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  method?: string;
  error_code?: string | null;
  error_description?: string | null;
}

export const createRazorpayOrder = (cfg: RazorpayConfig, o: { amountPaise: number; receipt: string; notes: Record<string, string> }) =>
  call<RazorpayOrder>(cfg, "POST", "/orders", { amount: o.amountPaise, currency: "INR", receipt: o.receipt, notes: o.notes });

export const fetchRazorpayPayment = (cfg: RazorpayConfig, paymentId: string) => call<RazorpayPayment>(cfg, "GET", `/payments/${encodeURIComponent(paymentId)}`);

/** Authorized (not yet captured) payments are captured server-side when the account isn't on auto-capture. */
export const captureRazorpayPayment = (cfg: RazorpayConfig, paymentId: string, amountPaise: number) =>
  call<RazorpayPayment>(cfg, "POST", `/payments/${encodeURIComponent(paymentId)}/capture`, { amount: amountPaise, currency: "INR" });
