"use client";

import { api, ApiRequestError } from "@/services/api-client";

interface StartResponse {
  keyId: string;
  mode: "test" | "live";
  razorpayOrderId: string;
  amountPaise: number;
  currency: "INR";
  orderNumber: string;
  prefill: { name: string; email: string; contact: string };
}

interface CheckoutSuccess {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open(): void; on(event: string, cb: (r: { error?: { description?: string } }) => void): void };
  }
}

let scriptPromise: Promise<void> | null = null;
/** Loaded only when someone actually pays, so it costs nothing on every other page. */
function loadScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      scriptPromise = null;
      reject(new ApiRequestError("Couldn't load the payment window. Check your connection and try again.", 0));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export type PayResult = "paid" | "review" | "pending" | "dismissed" | "failed";

/**
 * Opens Razorpay Checkout for one of the customer's own unpaid orders and resolves when it ends.
 * "paid" only ever means the *server* verified the payment — never just the browser callback.
 */
export async function payOrder(orderId: string): Promise<{ result: PayResult; message?: string }> {
  const start = await api<StartResponse>("/store/payments/razorpay/order", { method: "POST", body: { orderId } });
  await loadScript();

  return new Promise((resolve) => {
    let settled = false;
    const done = (result: PayResult, message?: string) => {
      if (!settled) {
        settled = true;
        resolve({ result, message });
      }
    };

    const rzp = new window.Razorpay!({
      key: start.keyId,
      order_id: start.razorpayOrderId,
      amount: start.amountPaise,
      currency: start.currency,
      name: "Sindhu's Pickles",
      description: `Order ${start.orderNumber}`,
      prefill: start.prefill,
      theme: { color: "#b45309" },
      modal: { ondismiss: () => done("dismissed") },
      handler: async (response: CheckoutSuccess) => {
        try {
          const verified = await api<{ status: "paid" | "pending" | "review" }>("/store/payments/razorpay/verify", {
            method: "POST",
            body: { orderId, ...response },
          });
          done(verified.status);
        } catch (e) {
          done("failed", e instanceof Error ? e.message : undefined);
        }
      },
    });
    rzp.on("payment.failed", (r) => done("failed", r.error?.description));
    rzp.open();
  });
}
