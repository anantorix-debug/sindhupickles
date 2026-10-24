import "server-only";
import type { Payment, PaymentMethod, PaymentStatus } from "@/types";
import { iso, query } from "@/server/db";
import { toRupees } from "@/server/money";

export async function listPayments(): Promise<Payment[]> {
  const rows = await query(
    `SELECT p.*, o.order_number, c.name AS customer_name
     FROM payments p
     JOIN orders o ON o.id = p.order_id
     JOIN customers c ON c.id = o.customer_id
     ORDER BY COALESCE(p.captured_at, p.created_at) DESC, p.id DESC`,
  );
  return rows.map((r) => ({
    id: String(r.id),
    orderId: String(r.order_id),
    orderNumber: r.order_number,
    customerName: r.customer_name,
    method: String(r.provider).toLowerCase() as PaymentMethod,
    status: String(r.status).toLowerCase() as PaymentStatus,
    amount: toRupees(r.amount_paise),
    refunded: toRupees(r.amount_refunded_paise),
    instrument: r.instrument,
    providerPaymentId: r.provider_payment_id,
    failureReason: r.failure_reason,
    createdAt: iso(r.captured_at ?? r.created_at)!,
  }));
}
