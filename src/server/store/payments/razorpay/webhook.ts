import "server-only";
import { createHash } from "node:crypto";
import { ApiError } from "@/server/http";
import { execute, query } from "@/server/db";
import { captureRazorpayPayment, requireRazorpay, verifyWebhookSignature } from "./client";
import { applyCapture, applyFailure, applyRefund } from "./service";

interface PaymentEntity {
  id: string;
  order_id: string | null;
  amount: number;
  currency: string;
  status: string;
  method?: string;
  error_code?: string | null;
  error_description?: string | null;
}
interface WebhookBody {
  event: string;
  payload?: {
    payment?: { entity: PaymentEntity };
    order?: { entity: { id: string; amount_paid?: number } };
    refund?: { entity: { id: string; payment_id: string; amount: number } };
  };
}

export type WebhookOutcome = "processed" | "duplicate" | "ignored";

/**
 * Handles one Razorpay webhook delivery.
 *  - Signature is checked against the *raw* body with the webhook secret (401 otherwise).
 *  - Each event id is stored once (unique key); redeliveries of a processed event do nothing.
 *  - If processing throws, the event stays unprocessed and we return 500 so Razorpay retries it.
 */
export async function handleWebhook(rawBody: string, signature: string | null, eventIdHeader: string | null): Promise<WebhookOutcome> {
  const cfg = requireRazorpay();
  if (!signature || !verifyWebhookSignature(cfg, rawBody, signature)) throw new ApiError(401, "Invalid signature", "bad_signature");

  let body: WebhookBody;
  try {
    body = JSON.parse(rawBody) as WebhookBody;
  } catch {
    throw new ApiError(400, "Invalid payload", "bad_json");
  }
  const eventId = eventIdHeader || `body:${createHash("sha256").update(rawBody).digest("hex")}`;

  await execute("INSERT IGNORE INTO webhook_events (provider, event_id, event_type, payload, created_at) VALUES ('RAZORPAY', ?, ?, ?, NOW(3))", [eventId, body.event, rawBody]);
  const [row] = await query("SELECT id, processed_at FROM webhook_events WHERE provider = 'RAZORPAY' AND event_id = ?", [eventId]);
  if (row?.processed_at) return "duplicate";

  const payment = body.payload?.payment?.entity;
  let outcome: WebhookOutcome = "processed";

  switch (body.event) {
    case "payment.authorized": {
      // Accounts without auto-capture need an explicit capture before the money is ours.
      if (payment?.order_id && payment.status === "authorized") {
        const captured = await captureRazorpayPayment(cfg, payment.id, payment.amount);
        if (captured.status === "captured") {
          await applyCapture({ razorpayOrderId: payment.order_id, paymentId: payment.id, amountPaise: captured.amount, currency: captured.currency, instrument: captured.method, signatureVerified: true, source: "webhook" });
        }
      }
      break;
    }
    case "payment.captured":
    case "order.paid": {
      if (payment?.order_id && payment.status === "captured") {
        await applyCapture({ razorpayOrderId: payment.order_id, paymentId: payment.id, amountPaise: payment.amount, currency: payment.currency, instrument: payment.method, signatureVerified: true, source: "webhook" });
      } else outcome = "ignored";
      break;
    }
    case "payment.failed": {
      if (payment?.order_id) await applyFailure({ razorpayOrderId: payment.order_id, paymentId: payment.id, code: payment.error_code, description: payment.error_description });
      else outcome = "ignored";
      break;
    }
    case "refund.processed": {
      const refund = body.payload?.refund?.entity;
      if (refund) await applyRefund({ paymentId: refund.payment_id, refundId: refund.id, amountPaise: refund.amount });
      else outcome = "ignored";
      break;
    }
    default:
      outcome = "ignored";
  }

  await execute("UPDATE webhook_events SET processed_at = NOW(3) WHERE id = ?", [row.id]);
  return outcome;
}
