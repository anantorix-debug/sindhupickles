import "server-only";
import type { PoolConnection } from "mysql2/promise";
import type { Order, OrderEvent, OrderItem, OrderStatus, OrderSummary, PaymentMethod, PaymentStatus } from "@/types";
import { canTransition, STOCK_RESERVED_STATUSES } from "@/lib/order-flow";
import type { TrackingInput } from "@/lib/validation/content";
import { ApiError, notFound } from "@/server/http";
import { iso, query, transaction, type Row } from "@/server/db";
import { toRupees } from "@/server/money";
import { PLACED_ORDER_SQL } from "@/server/repositories/revenue";

const lower = <T extends string>(v: string | null): T => String(v ?? "").toLowerCase() as T;

const SUMMARY_SQL = `
  SELECT o.id, o.order_number, o.customer_id, o.status, o.payment_status, o.payment_method, o.total_paise, o.placed_at,
         c.name AS customer_name, c.email AS customer_email,
         (SELECT COALESCE(SUM(oi.quantity), 0) FROM order_items oi WHERE oi.order_id = o.id) AS item_count
  FROM orders o JOIN customers c ON c.id = o.customer_id`;

function mapSummary(r: Row): OrderSummary {
  return {
    id: String(r.id),
    orderNumber: r.order_number,
    customerId: String(r.customer_id),
    customerName: r.customer_name,
    customerEmail: r.customer_email,
    itemCount: Number(r.item_count),
    total: toRupees(r.total_paise),
    status: lower<OrderStatus>(r.status),
    paymentStatus: lower<PaymentStatus>(r.payment_status),
    paymentMethod: lower<PaymentMethod>(r.payment_method),
    placedAt: iso(r.placed_at)!,
  };
}

export async function listOrders(opts: { customerId?: string; status?: OrderStatus; limit?: number } = {}): Promise<OrderSummary[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.customerId) {
    where.push("o.customer_id = ?");
    params.push(opts.customerId);
  }
  if (opts.status) {
    where.push("o.status = ?");
    params.push(opts.status.toUpperCase());
  } else {
    where.push(PLACED_ORDER_SQL); // unpaid online drafts aren't orders yet
  }
  const rows = await query(
    `${SUMMARY_SQL} ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY o.placed_at DESC, o.id DESC LIMIT ?`,
    [...params, opts.limit ?? 500],
  );
  return rows.map(mapSummary);
}

export async function getOrder(id: string): Promise<Order | null> {
  const [row] = await query(
    `SELECT o.*, c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone,
            (SELECT COALESCE(SUM(oi.quantity), 0) FROM order_items oi WHERE oi.order_id = o.id) AS item_count
     FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.id = ?`,
    [id],
  );
  if (!row) return null;

  const [items, events] = await Promise.all([
    query("SELECT * FROM order_items WHERE order_id = ? ORDER BY id", [id]),
    query("SELECT * FROM order_events WHERE order_id = ? ORDER BY created_at DESC, id DESC", [id]),
  ]);

  const address = [row.ship_line1, row.ship_line2, row.ship_landmark, row.ship_city, row.ship_state, row.ship_pincode, row.ship_country]
    .filter(Boolean)
    .join(", ");

  return {
    ...mapSummary(row),
    customerPhone: row.customer_phone,
    items: items.map(
      (i): OrderItem => ({
        id: String(i.id),
        productId: i.product_id === null ? null : String(i.product_id),
        name: i.product_name,
        variantLabel: i.variant_label,
        sku: i.sku,
        quantity: i.quantity,
        unitPrice: toRupees(i.unit_price_paise),
        lineTotal: toRupees(i.line_total_paise),
      }),
    ),
    subtotal: toRupees(row.subtotal_paise),
    discount: toRupees(row.discount_paise),
    couponCode: row.coupon_code,
    shipping: toRupees(row.shipping_paise),
    shippingName: row.ship_full_name,
    shippingAddress: address,
    tracking: row.tracking_number ? { carrier: row.tracking_carrier ?? "", number: row.tracking_number } : null,
    customerNote: row.customer_note,
    events: events.map(
      (e): OrderEvent => ({
        id: String(e.id),
        type: e.type,
        status: e.status ? lower<OrderStatus>(e.status) : null,
        message: e.message,
        actor: String(e.actor_type).toLowerCase(),
        at: iso(e.created_at)!,
      }),
    ),
  };
}

const TIMESTAMP_FOR: Partial<Record<OrderStatus, string>> = {
  confirmed: "confirmed_at",
  shipped: "shipped_at",
  delivered: "delivered_at",
  cancelled: "cancelled_at",
};

/**
 * Keeps inventory consistent with the order lifecycle (same convention as the
 * existing data): stock is reserved when an order is placed, consumed when it
 * ships, and released if it is cancelled before shipping.
 */
async function applyStockEffect(conn: PoolConnection, orderId: string, orderNumber: string, effect: "CONSUME" | "RELEASE") {
  const [items] = await conn.query<Row[]>(
    "SELECT variant_id, SUM(quantity) AS quantity FROM order_items WHERE order_id = ? AND variant_id IS NOT NULL GROUP BY variant_id",
    [orderId],
  );
  for (const item of items) {
    const [inv] = await conn.query<Row[]>("SELECT id, on_hand, reserved FROM inventory WHERE variant_id = ? FOR UPDATE", [item.variant_id]);
    if (!inv[0]) continue;
    const qty = Number(item.quantity);
    const reservedDelta = -Math.min(qty, inv[0].reserved);
    const onHandDelta = effect === "CONSUME" ? -Math.min(qty, inv[0].on_hand) : 0;
    await conn.query("UPDATE inventory SET on_hand = on_hand + ?, reserved = reserved + ?, updated_at = NOW(3) WHERE id = ?", [
      onHandDelta,
      reservedDelta,
      inv[0].id,
    ]);
    await conn.query(
      `INSERT INTO inventory_movements (inventory_id, type, on_hand_delta, reserved_delta, reason, order_id, actor_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL, NOW(3))`,
      [inv[0].id, effect, onHandDelta, reservedDelta, effect === "CONSUME" ? `Shipped on ${orderNumber}` : `Cancelled ${orderNumber}`, orderId],
    );
  }
}

export async function updateOrderStatus(id: string, status: OrderStatus): Promise<Order> {
  await transaction(async (conn) => {
    const [rows] = await conn.query<Row[]>("SELECT status, order_number FROM orders WHERE id = ? FOR UPDATE", [id]);
    if (!rows[0]) throw notFound("Order");
    const current = lower<OrderStatus>(rows[0].status);
    if (current === status) return;
    if (!canTransition(current, status)) {
      throw new ApiError(
        409,
        current === "cancelled" ? "A cancelled order can't be changed." : `An order can't move from "${current}" to "${status}".`,
        "invalid_transition",
        { status: "Not allowed from the current status" },
      );
    }

    if (STOCK_RESERVED_STATUSES.includes(current)) {
      if (status === "shipped") await applyStockEffect(conn, id, rows[0].order_number, "CONSUME");
      if (status === "cancelled") await applyStockEffect(conn, id, rows[0].order_number, "RELEASE");
    }

    const stamp = TIMESTAMP_FOR[status];
    await conn.query(
      `UPDATE orders SET status = ?, updated_at = NOW(3)${stamp ? `, ${stamp} = COALESCE(${stamp}, NOW(3))` : ""} WHERE id = ?`,
      [status.toUpperCase(), id],
    );
    await conn.query(
      `INSERT INTO order_events (order_id, type, status, previous_status, message, actor_type, actor_id, created_at)
       VALUES (?, 'STATUS_CHANGE', ?, ?, ?, 'ADMIN', NULL, NOW(3))`,
      [id, status.toUpperCase(), current.toUpperCase(), `Status changed to ${status.replace(/_/g, " ")}.`],
    );
  });
  return (await getOrder(id))!;
}

export async function updateTracking(id: string, input: TrackingInput): Promise<Order> {
  await transaction(async (conn) => {
    const [rows] = await conn.query<Row[]>("SELECT status FROM orders WHERE id = ? FOR UPDATE", [id]);
    if (!rows[0]) throw notFound("Order");
    if (rows[0].status === "CANCELLED") throw new ApiError(409, "A cancelled order can't be changed.", "invalid_transition");
    await conn.query("UPDATE orders SET tracking_carrier = ?, tracking_number = ?, updated_at = NOW(3) WHERE id = ?", [
      input.carrier,
      input.number,
      id,
    ]);
    await conn.query(
      `INSERT INTO order_events (order_id, type, status, previous_status, message, actor_type, actor_id, created_at)
       VALUES (?, 'SYSTEM', NULL, NULL, ?, 'ADMIN', NULL, NOW(3))`,
      [id, `Tracking updated: ${input.carrier} ${input.number}`],
    );
  });
  return (await getOrder(id))!;
}
