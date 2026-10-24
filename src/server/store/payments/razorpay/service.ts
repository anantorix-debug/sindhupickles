import "server-only";
import type { PoolConnection } from "mysql2/promise";
import { revalidatePath } from "next/cache";
import { ApiError, notFound } from "@/server/http";
import { sendOrderConfirmation } from "@/server/store/notifications";
import { query, transaction, type Row } from "@/server/db";
import {
  captureRazorpayPayment,
  createRazorpayOrder,
  fetchRazorpayPayment,
  requireRazorpay,
  verifyCheckoutSignature,
  type RazorpayPayment,
} from "./client";

type Conn = PoolConnection;
const q = async (conn: Conn, sql: string, params: unknown[] = []) => (await conn.query<Row[]>(sql, params))[0];

async function logEvent(conn: Conn, orderId: number | string, status: string | null, previous: string | null, message: string) {
  await conn.query(
    `INSERT INTO order_events (order_id, type, status, previous_status, message, actor_type, actor_id, created_at)
     VALUES (?, 'STATUS_CHANGE', ?, ?, ?, 'SYSTEM', NULL, NOW(3))`,
    [orderId, status, previous, message],
  );
}

export interface PaymentStart {
  keyId: string;
  mode: "test" | "live";
  razorpayOrderId: string;
  amountPaise: number;
  currency: "INR";
  orderNumber: string;
  prefill: { name: string; email: string; contact: string };
}

/**
 * Creates (or re-uses) the Razorpay order for one of the signed-in customer's own unpaid orders.
 * The amount always comes from our database, never from the request.
 */
export async function startRazorpayPayment(customerId: string, orderId: string): Promise<PaymentStart> {
  const cfg = requireRazorpay();
  const [row] = await query(
    `SELECT o.id, o.order_number, o.status, o.payment_method, o.total_paise, o.ship_full_name, o.ship_email, o.ship_phone,
            p.id AS payment_id, p.provider_order_id, p.status AS payment_status
     FROM orders o JOIN payments p ON p.order_id = o.id WHERE o.id = ? AND o.customer_id = ?`,
    [orderId, customerId],
  );
  if (!row) throw notFound("Order"); // also the answer for someone else's order
  if (row.payment_method !== "RAZORPAY") throw new ApiError(409, "This order isn't paid online", "wrong_payment_method");
  if (!["PENDING_PAYMENT", "PAYMENT_FAILED"].includes(row.status) || row.payment_status === "CAPTURED") {
    throw new ApiError(409, "This order doesn't need a payment", "not_payable");
  }

  let razorpayOrderId: string | null = row.provider_order_id;
  if (!razorpayOrderId) {
    const created = await createRazorpayOrder(cfg, {
      amountPaise: row.total_paise,
      receipt: row.order_number,
      notes: { order_number: row.order_number, internal_order_id: String(row.id) },
    });
    // Another request may have created one meanwhile; first writer wins and everyone uses it.
    razorpayOrderId = await transaction(async (conn) => {
      const [pay] = await q(conn, "SELECT provider_order_id FROM payments WHERE id = ? FOR UPDATE", [row.payment_id]);
      if (pay.provider_order_id) return pay.provider_order_id as string;
      await conn.query("UPDATE payments SET provider_order_id = ?, updated_at = NOW(3) WHERE id = ?", [created.id, row.payment_id]);
      return created.id;
    });
  }

  // A retry after a failed attempt puts the order back to "awaiting payment".
  if (row.status === "PAYMENT_FAILED") {
    await transaction(async (conn) => {
      const res = await conn.query<import("mysql2").ResultSetHeader>(
        "UPDATE orders SET status = 'PENDING_PAYMENT', payment_status = 'PENDING', updated_at = NOW(3) WHERE id = ? AND status = 'PAYMENT_FAILED'",
        [row.id],
      );
      await conn.query("UPDATE payments SET status = 'PENDING', failure_code = NULL, failure_reason = NULL, updated_at = NOW(3) WHERE id = ? AND status = 'FAILED'", [row.payment_id]);
      if (res[0].affectedRows) await logEvent(conn, row.id, "PENDING_PAYMENT", "PAYMENT_FAILED", "Customer is retrying payment.");
    });
  }

  return {
    keyId: cfg.keyId,
    mode: cfg.mode,
    razorpayOrderId,
    amountPaise: row.total_paise,
    currency: "INR",
    orderNumber: row.order_number,
    prefill: { name: row.ship_full_name, email: row.ship_email, contact: row.ship_phone },
  };
}

export type ApplyResult = "confirmed" | "already_confirmed" | "needs_review" | "amount_mismatch" | "unknown_order";

/**
 * Marks a payment captured and confirms the order. Idempotent, and safe when events arrive late or
 * out of order. The amount must equal what we stored for the order, or nothing is confirmed.
 */
export async function applyCapture(p: { razorpayOrderId: string; paymentId: string; amountPaise: number; currency: string; instrument?: string | null; signatureVerified: boolean; source: string }): Promise<ApplyResult> {
  const result = await transaction(async (conn): Promise<ApplyResult> => {
    const [pay] = await q(conn, "SELECT id, order_id, status, amount_paise FROM payments WHERE provider_order_id = ? AND provider = 'RAZORPAY' FOR UPDATE", [p.razorpayOrderId]);
    if (!pay) return "unknown_order";
    const [order] = await q(conn, "SELECT id, status, order_number FROM orders WHERE id = ? FOR UPDATE", [pay.order_id]);

    if (p.currency !== "INR" || p.amountPaise !== pay.amount_paise) {
      await logEvent(conn, order.id, null, order.status, `Payment ${p.paymentId} amount/currency did not match the order — not confirmed. Needs manual review.`);
      return "amount_mismatch";
    }
    if (pay.status === "CAPTURED") return "already_confirmed";
    if (pay.status === "REFUNDED") return "already_confirmed";

    await conn.query(
      `UPDATE payments SET status = 'CAPTURED', provider_payment_id = ?, instrument = ?, signature_verified = ?, failure_code = NULL, failure_reason = NULL,
              captured_at = NOW(3), updated_at = NOW(3) WHERE id = ?`,
      [p.paymentId, p.instrument ?? null, p.signatureVerified ? 1 : 0, pay.id],
    );

    if (order.status === "CANCELLED") {
      // Money arrived for an order we already cancelled and released stock for. Don't resurrect it silently.
      await conn.query("UPDATE orders SET payment_status = 'CAPTURED', updated_at = NOW(3) WHERE id = ?", [order.id]);
      await logEvent(conn, order.id, null, "CANCELLED", `Payment ${p.paymentId} was received after this order was cancelled. Refund it or re-create the order.`);
      return "needs_review";
    }
    if (order.status === "PENDING_PAYMENT" || order.status === "PAYMENT_FAILED") {
      await conn.query("UPDATE orders SET status = 'CONFIRMED', payment_status = 'CAPTURED', confirmed_at = COALESCE(confirmed_at, NOW(3)), updated_at = NOW(3) WHERE id = ?", [order.id]);
      await logEvent(conn, order.id, "PAID", order.status, `Payment received (${p.source}).`);
      await logEvent(conn, order.id, "CONFIRMED", "PAID", "Order confirmed and queued for the next fresh batch.");
      return "confirmed";
    }
    // Already further along (e.g. processing/shipped): just make sure the payment status is right.
    await conn.query("UPDATE orders SET payment_status = 'CAPTURED', updated_at = NOW(3) WHERE id = ?", [order.id]);
    return "already_confirmed";
  });
  if (result === "confirmed" || result === "needs_review") revalidatePath("/", "layout");
  if (result === "confirmed") {
    const [pay] = await query("SELECT order_id FROM payments WHERE provider_order_id = ?", [p.razorpayOrderId]);
    if (pay) await sendOrderConfirmation(String(pay.order_id));
  }
  return result;
}

/** Records a failed attempt. A payment that is already captured is never downgraded. */
export async function applyFailure(p: { razorpayOrderId: string; paymentId: string; code?: string | null; description?: string | null }): Promise<"failed" | "ignored"> {
  return transaction(async (conn) => {
    const [pay] = await q(conn, "SELECT id, order_id, status FROM payments WHERE provider_order_id = ? AND provider = 'RAZORPAY' FOR UPDATE", [p.razorpayOrderId]);
    if (!pay || pay.status !== "PENDING") return "ignored";
    const [order] = await q(conn, "SELECT id, status FROM orders WHERE id = ? FOR UPDATE", [pay.order_id]);
    if (order.status !== "PENDING_PAYMENT") return "ignored";
    await conn.query("UPDATE payments SET status = 'FAILED', provider_payment_id = ?, failure_code = ?, failure_reason = ?, updated_at = NOW(3) WHERE id = ?", [
      p.paymentId,
      p.code ?? null,
      (p.description ?? "Payment failed").slice(0, 255),
      pay.id,
    ]);
    await conn.query("UPDATE orders SET status = 'PAYMENT_FAILED', payment_status = 'FAILED', updated_at = NOW(3) WHERE id = ?", [order.id]);
    await logEvent(conn, order.id, "PAYMENT_FAILED", "PENDING_PAYMENT", "Payment failed. The customer can retry.");
    return "failed";
  });
}

export async function applyRefund(p: { paymentId: string; refundId: string; amountPaise: number }): Promise<"refunded" | "ignored"> {
  return transaction(async (conn) => {
    const [pay] = await q(conn, "SELECT id, order_id, amount_paise, amount_refunded_paise FROM payments WHERE provider_payment_id = ? AND provider = 'RAZORPAY' FOR UPDATE", [p.paymentId]);
    if (!pay) return "ignored";
    const total = Math.min(pay.amount_paise, pay.amount_refunded_paise + p.amountPaise);
    const full = total >= pay.amount_paise;
    await conn.query("UPDATE payments SET amount_refunded_paise = ?, status = ?, provider_refund_id = ?, refunded_at = NOW(3), updated_at = NOW(3) WHERE id = ?", [
      total,
      full ? "REFUNDED" : "PARTIALLY_REFUNDED",
      p.refundId,
      pay.id,
    ]);
    await conn.query("UPDATE orders SET payment_status = ?, updated_at = NOW(3) WHERE id = ?", [full ? "REFUNDED" : "PARTIALLY_REFUNDED", pay.order_id]);
    await logEvent(conn, pay.order_id, null, null, `Refund of ₹${(p.amountPaise / 100).toFixed(2)} processed.`);
    return "refunded";
  });
}

/**
 * Browser reports success → we don't believe it. Verify the signature, then ask Razorpay for the
 * payment itself and require it to be for this order, in INR, for the stored amount.
 */
export async function verifyAndConfirm(customerId: string, input: { orderId: string; razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) {
  const cfg = requireRazorpay();
  const [row] = await query(
    `SELECT o.id, o.status, p.provider_order_id, p.status AS payment_status FROM orders o JOIN payments p ON p.order_id = o.id
     WHERE o.id = ? AND o.customer_id = ? AND o.payment_method = 'RAZORPAY'`,
    [input.orderId, customerId],
  );
  if (!row) throw notFound("Order");
  if (!row.provider_order_id || row.provider_order_id !== input.razorpay_order_id) {
    throw new ApiError(400, "This payment doesn't belong to the order", "order_mismatch");
  }
  if (!verifyCheckoutSignature(cfg, input.razorpay_order_id, input.razorpay_payment_id, input.razorpay_signature)) {
    throw new ApiError(400, "Payment verification failed", "bad_signature");
  }

  let payment: RazorpayPayment = await fetchRazorpayPayment(cfg, input.razorpay_payment_id);
  if (payment.order_id !== input.razorpay_order_id) throw new ApiError(400, "This payment doesn't belong to the order", "order_mismatch");
  if (payment.status === "authorized") payment = await captureRazorpayPayment(cfg, payment.id, payment.amount);
  if (payment.status !== "captured") return { status: "pending" as const };

  const result = await applyCapture({
    razorpayOrderId: input.razorpay_order_id,
    paymentId: payment.id,
    amountPaise: payment.amount,
    currency: payment.currency,
    instrument: payment.method ?? null,
    signatureVerified: true,
    source: "checkout verified",
  });
  if (result === "amount_mismatch" || result === "unknown_order") throw new ApiError(409, "We couldn't confirm this payment. Our team has been notified.", "payment_mismatch");
  return { status: result === "needs_review" ? ("review" as const) : ("paid" as const) };
}

/** Cancels unpaid online orders after `minutes` and releases the stock they reserved. */
export async function expireUnpaidOrders(minutes = 60): Promise<number> {
  const stale = await query(
    `SELECT id FROM orders WHERE payment_method = 'RAZORPAY' AND status IN ('PENDING_PAYMENT','PAYMENT_FAILED') AND placed_at < (NOW(3) - INTERVAL ? MINUTE) LIMIT 100`,
    [minutes],
  );
  let n = 0;
  for (const s of stale) {
    const done = await transaction(async (conn) => {
      const [o] = await q(conn, "SELECT id, order_number, status FROM orders WHERE id = ? FOR UPDATE", [s.id]);
      if (!o || !["PENDING_PAYMENT", "PAYMENT_FAILED"].includes(o.status)) return false;
      const items = await q(conn, "SELECT variant_id, SUM(quantity) AS qty FROM order_items WHERE order_id = ? AND variant_id IS NOT NULL GROUP BY variant_id", [o.id]);
      for (const it of items) {
        const [inv] = await q(conn, "SELECT id, reserved FROM inventory WHERE variant_id = ? FOR UPDATE", [it.variant_id]);
        if (!inv) continue;
        const release = Math.min(Number(it.qty), inv.reserved);
        await conn.query("UPDATE inventory SET reserved = reserved - ?, updated_at = NOW(3) WHERE id = ?", [release, inv.id]);
        await conn.query(
          `INSERT INTO inventory_movements (inventory_id, type, on_hand_delta, reserved_delta, reason, order_id, actor_id, created_at)
           VALUES (?, 'RELEASE', 0, ?, ?, ?, NULL, NOW(3))`,
          [inv.id, -release, `Unpaid order ${o.order_number} expired`, o.id],
        );
      }
      await conn.query("UPDATE orders SET status = 'CANCELLED', cancelled_at = NOW(3), updated_at = NOW(3) WHERE id = ?", [o.id]);
      await logEvent(conn, o.id, "CANCELLED", o.status, "Cancelled automatically: payment wasn't completed in time.");
      return true;
    });
    if (done) n++;
  }
  if (n) revalidatePath("/", "layout");
  return n;
}
