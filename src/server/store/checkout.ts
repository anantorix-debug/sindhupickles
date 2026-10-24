import "server-only";
import { revalidatePath } from "next/cache";
import type { CheckoutInput } from "@/lib/validation/store";
import { ApiError } from "@/server/http";
import { transaction, type Row } from "@/server/db";
import { insertAddress } from "@/server/store/addresses";
import { getPaymentProvider } from "@/server/store/payments/providers";
import { sendOrderConfirmation } from "@/server/store/notifications";
import { CartIssuesError, resolveCart, toPricedCart, type Querier } from "@/server/store/pricing";

/** Existing orders use this prefix; the sequence continues from the `counters` table. */
const ORDER_PREFIX = process.env.ORDER_NUMBER_PREFIX ?? "ANX";

export interface PlacedOrder {
  orderId: string;
  orderNumber: string;
  total: number;
  status: "PENDING_PAYMENT" | "CONFIRMED";
  paymentStatus: "PENDING" | "CAPTURED";
}

/**
 * Creates an order from a cart. Nothing from the browser is trusted except *which* variants
 * and quantities were chosen: prices, stock, discounts, shipping and the total are all
 * computed here, and the address must belong to the signed-in customer.
 */
export async function placeOrder(customerId: string, input: CheckoutInput): Promise<PlacedOrder> {
  const provider = getPaymentProvider(input.paymentMethod);
  if (!(await provider.isAvailable())) {
    throw new ApiError(422, "That payment method isn't available", "payment_unavailable", { paymentMethod: "Choose another payment method" });
  }

  const placed = await transaction(async (conn) => {
    const q: Querier = async (sql, params) => (await conn.query<Row[]>(sql, params))[0];

    // 1. Lock stock rows first (stable order avoids deadlocks); every later read sees the locked state.
    const variantIds = [...new Set(input.items.map((i) => Number(i.variantId)))].sort((a, b) => a - b);
    const lockedInventory = await q("SELECT id, variant_id FROM inventory WHERE variant_id IN (?) ORDER BY id FOR UPDATE", [variantIds]);
    const inventoryIdByVariant = new Map(lockedInventory.map((r) => [String(r.variant_id), r.id as number]));

    // 2. Delivery address: an existing one of this customer, or a new one saved now.
    const addressId = input.newAddress ? await insertAddress(conn, customerId, input.newAddress) : input.addressId!;
    const [addr] = await q(
      `SELECT a.*, d.area, d.district FROM addresses a LEFT JOIN address_details d ON d.address_id = a.id
       WHERE a.id = ? AND a.customer_id = ?`,
      [addressId, customerId],
    );
    if (!addr) throw new ApiError(422, "Choose a delivery address", "bad_address", { addressId: "Choose a delivery address" });
    const [customer] = await q("SELECT email FROM customers WHERE id = ?", [customerId]);

    // 3. Authoritative pricing + stock check.
    const cart = await resolveCart(input.items, { couponCode: input.couponCode, customerId, q });
    if (cart.lines.length === 0 || cart.lines.some((l) => l.issue)) throw new CartIssuesError(toPricedCart(cart));
    if (input.couponCode && cart.coupon.error) throw new ApiError(422, cart.coupon.error, "bad_coupon", { couponCode: cart.coupon.error });
    if (cart.coupon.code) {
      const [res] = await conn.query<import("mysql2").ResultSetHeader>(
        "UPDATE coupons SET used_count = used_count + 1 WHERE code = ? AND (usage_limit IS NULL OR used_count < usage_limit)",
        [cart.coupon.code],
      );
      if (res.affectedRows === 0) throw new ApiError(422, "That coupon has reached its usage limit.", "bad_coupon", { couponCode: "Coupon unavailable" });
    }

    // 4. Order number from the shared counter. A brand-new database has no counter yet, so create it (never reset it).
    await conn.query("INSERT IGNORE INTO counters (name, value) VALUES ('order_number', 1000)");
    await conn.query("UPDATE counters SET value = LAST_INSERT_ID(value + 1) WHERE name = 'order_number'");
    const [seq] = await q("SELECT LAST_INSERT_ID() AS n");
    const orderNumber = `${ORDER_PREFIX}-${seq.n}`;

    // 5. The order and its items (names/prices are snapshots, so later catalogue edits don't rewrite history).
    const line2 = [addr.line2, addr.area, addr.district].filter(Boolean).join(", ") || null;
    const [order] = await conn.query<import("mysql2").ResultSetHeader>(
      `INSERT INTO orders (order_number, customer_id, status, payment_status, payment_method, subtotal_paise, discount_paise, coupon_code,
         shipping_paise, total_paise, ship_full_name, ship_phone, ship_email, ship_line1, ship_line2, ship_landmark, ship_city, ship_state,
         ship_pincode, ship_country, customer_note, placed_at, created_at, updated_at)
       VALUES (?, ?, 'PENDING_PAYMENT', 'PENDING', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3), NOW(3))`,
      [
        orderNumber, customerId, provider.dbName, cart.subtotalPaise, cart.discountPaise, cart.coupon.code, cart.shippingPaise, cart.totalPaise,
        addr.full_name, addr.phone, customer.email, addr.line1, line2, addr.landmark, addr.city, addr.state, addr.pincode, addr.country,
        input.note || null,
      ],
    );
    const orderId = order.insertId;

    for (const l of cart.lines) {
      await conn.query(
        `INSERT INTO order_items (order_id, product_id, variant_id, product_name, variant_label, sku, image_url, unit_price_paise,
           list_price_paise, quantity, line_total_paise) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [orderId, l.productId, l.variantId, l.name, l.variantLabel, l.sku, l.imageUrl, l.unitPaise, l.listPaise, l.quantity, l.unitPaise * l.quantity],
      );

      // 6. Reserve stock; the guard re-checks availability even though the row is locked.
      const [reserved] = await conn.query<import("mysql2").ResultSetHeader>(
        "UPDATE inventory SET reserved = reserved + ?, updated_at = NOW(3) WHERE variant_id = ? AND on_hand - reserved >= ?",
        [l.quantity, l.variantId, l.quantity],
      );
      if (reserved.affectedRows === 0) throw new CartIssuesError(toPricedCart(await resolveCart(input.items, { couponCode: input.couponCode, customerId, q })));
      await conn.query(
        `INSERT INTO inventory_movements (inventory_id, type, on_hand_delta, reserved_delta, reason, order_id, actor_id, created_at)
         VALUES (?, 'RESERVE', 0, ?, ?, ?, NULL, NOW(3))`,
        [inventoryIdByVariant.get(l.variantId), l.quantity, `Reserved for ${orderNumber}`, orderId],
      );
    }

    // 7. Timeline + payment record via the provider.
    // `actor_id` references the admin `users` table, so customer-initiated events leave it NULL.
    await conn.query(
      `INSERT INTO order_events (order_id, type, status, previous_status, message, actor_type, actor_id, created_at)
       VALUES (?, 'STATUS_CHANGE', 'PENDING_PAYMENT', NULL, 'Checkout started. Awaiting payment.', 'CUSTOMER', NULL, NOW(3))`,
      [orderId],
    );
    const outcome = await provider.initiate({ conn, orderId: String(orderId), orderNumber, amountPaise: cart.totalPaise, customerId });
    await conn.query(
      `INSERT INTO payments (order_id, provider, status, amount_paise, amount_refunded_paise, currency, provider_order_id, provider_payment_id,
         signature_verified, instrument, captured_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, 0, 'INR', ?, ?, 0, ?, ${outcome.paymentStatus === "CAPTURED" ? "NOW(3)" : "NULL"}, NOW(3), NOW(3))`,
      [orderId, provider.dbName, outcome.paymentStatus, cart.totalPaise, outcome.providerOrderId, outcome.providerPaymentId, outcome.instrument],
    );
    let previous = "PENDING_PAYMENT";
    for (const e of outcome.events) {
      await conn.query(
        `INSERT INTO order_events (order_id, type, status, previous_status, message, actor_type, actor_id, created_at)
         VALUES (?, 'STATUS_CHANGE', ?, ?, ?, 'SYSTEM', NULL, NOW(3))`,
        [orderId, e.status, previous, e.message],
      );
      previous = e.status;
    }
    await conn.query(
      `UPDATE orders SET status = ?, payment_status = ?${outcome.orderStatus === "CONFIRMED" ? ", confirmed_at = NOW(3)" : ""}, updated_at = NOW(3) WHERE id = ?`,
      [outcome.orderStatus, outcome.paymentStatus, orderId],
    );

    return {
      orderId: String(orderId),
      orderNumber,
      total: cart.totalPaise / 100,
      status: outcome.orderStatus,
      paymentStatus: outcome.paymentStatus,
    } satisfies PlacedOrder;
  });

  // Stock changed, so cached storefront pages must refresh.
  revalidatePath("/", "layout");
  if (placed.status === "CONFIRMED") await sendOrderConfirmation(placed.orderId);
  return placed;
}
