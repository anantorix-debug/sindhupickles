import type { PoolConnection } from "mysql2/promise";
import type { PaymentOption } from "@/types/store";

/**
 * Payment abstraction. Checkout only talks to this interface, so adding Razorpay later is
 * a new provider here (create payment order → client checkout → verify → webhook) and does
 * not touch the checkout flow.
 */
export type PaymentProviderId = PaymentOption["id"];

export interface PaymentContext {
  conn: PoolConnection;
  orderId: string;
  orderNumber: string;
  amountPaise: number;
  customerId: string;
}

export interface PaymentOutcome {
  /** State of the payment record. */
  paymentStatus: "PENDING" | "CAPTURED";
  /** State the order moves to once the provider has run. */
  orderStatus: "PENDING_PAYMENT" | "CONFIRMED";
  providerPaymentId: string | null;
  providerOrderId: string | null;
  instrument: string | null;
  /** Order-timeline messages recorded for this outcome, in order. */
  events: { status: "PAID" | "CONFIRMED" | "PENDING_PAYMENT"; message: string }[];
  /** Hook for providers that need the browser to continue (e.g. Razorpay's checkout widget). */
  clientAction?: { type: string; payload: Record<string, unknown> };
}

export interface PaymentProvider {
  id: PaymentProviderId;
  /** Value stored in `orders.payment_method` / `payments.provider`. */
  dbName: string;
  label: string;
  description: string;
  isAvailable(): boolean | Promise<boolean>;
  initiate(ctx: PaymentContext): Promise<PaymentOutcome>;
}
