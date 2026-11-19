import "server-only";
import type { PoolConnection } from "mysql2/promise";
import type { Invoice, InvoiceLine, InvoiceParty, OrderStatus, PaymentMethod, PaymentStatus } from "@/types";
import { methodLabel } from "@/config/labels";
import { iso, parseJson, query, transaction, type Row } from "@/server/db";
import { ApiError, notFound } from "@/server/http";
import { renderInvoicePdf } from "@/server/invoices/pdf";
import { getSettings } from "@/server/repositories/settings";
import { siteUrl } from "@/server/store/customer-auth";

/**
 * Invoices: one per placed order, numbered INV-00001, INV-00002… from the shared `counters` table.
 *
 * - Created inside the transaction that places a cash-on-delivery order or captures an online payment
 *   (see createInvoiceInTransaction), so a failed or unpaid online order never gets one.
 * - Any placed order still without one (older orders, or if creation failed) gets it the first time it is opened
 *   (ensureInvoice); the order row is locked first, so two requests can't create two invoices.
 * - Amounts and a snapshot of business/customer/address/items are frozen at creation. Only the payment fields
 *   follow the order afterwards (cash collected, refunds).
 */

const PREFIX = process.env.INVOICE_NUMBER_PREFIX ?? "INV";
/** Orders in these states are not placed yet (unpaid / failed online checkout), so they have no invoice. */
const NOT_PLACED = new Set(["PENDING_PAYMENT", "PAYMENT_FAILED"]);
const CLOSED = new Set(["CANCELLED", "REFUNDED", "RETURNED"]);

type Run = (sql: string, params?: unknown[]) => Promise<Row[]>;
const rows = async (conn: PoolConnection, sql: string, params: unknown[] = []) => (await conn.query<Row[]>(sql, params))[0];

interface Snapshot {
  version: 1;
  orderNumber: string;
  orderDate: string;
  paymentMethod: string | null;
  couponCode: string | null;
  business: Invoice["business"];
  billTo: InvoiceParty;
  shipTo: InvoiceParty;
  items: { name: string; variantLabel: string; sku: string; quantity: number; unitPaise: number; totalPaise: number }[];
}

const addressLines = (r: Row) =>
  [r.ship_line1, r.ship_line2, r.ship_landmark, [r.ship_city, r.ship_pincode].filter(Boolean).join(" "), r.ship_state, r.ship_country]
    .map((v) => String(v ?? "").trim())
    .filter(Boolean);

/** The shop address in Settings is one line ("street, area, city - pin, state, country"); print it a part per line. */
const businessAddressLines = (address: string) => address.split(/\s*,\s*/).map((s) => s.trim()).filter(Boolean);

/** What has actually been paid and refunded for an order (cash on delivery counts once the order is marked paid). */
async function paymentState(run: Run, order: Row) {
  const [p] = await run(
    `SELECT COALESCE(SUM(CASE WHEN status IN ('CAPTURED','REFUNDED','PARTIALLY_REFUNDED') THEN amount_paise ELSE 0 END), 0) AS paid,
            COALESCE(SUM(amount_refunded_paise), 0) AS refunded,
            MAX(CASE WHEN status IN ('CAPTURED','REFUNDED','PARTIALLY_REFUNDED') THEN instrument END) AS instrument
     FROM payments WHERE order_id = ?`,
    [order.id],
  );
  let paid = Number(p?.paid ?? 0);
  if (paid === 0 && order.payment_status === "CAPTURED") paid = Number(order.total_paise);
  const refunded = Number(p?.refunded ?? 0);
  const balanceDue = CLOSED.has(order.status) ? 0 : Math.max(0, Number(order.total_paise) - paid);
  return { paid, refunded, balanceDue, status: String(order.payment_status), instrument: (p?.instrument as string | null) ?? null };
}

/**
 * Creates the invoice for a placed order, inside the caller's transaction (the order row must be locked by it, or
 * locked here). Returns the existing invoice if there already is one, or null when the order isn't placed.
 */
export async function createInvoiceInTransaction(conn: PoolConnection, orderId: string | number): Promise<{ id: string; created: boolean } | null> {
  const [order] = await rows(conn, "SELECT * FROM orders WHERE id = ? FOR UPDATE", [orderId]);
  if (!order || NOT_PLACED.has(order.status)) return null;
  const [existing] = await rows(conn, "SELECT id FROM invoices WHERE order_id = ?", [order.id]);
  if (existing) return { id: String(existing.id), created: false };

  const [items, [customer], settings] = await Promise.all([
    rows(conn, "SELECT product_name, variant_label, sku, quantity, unit_price_paise, line_total_paise FROM order_items WHERE order_id = ? ORDER BY id", [order.id]),
    rows(conn, "SELECT name, email, phone FROM customers WHERE id = ?", [order.customer_id]),
    getSettings(),
  ]);
  const shipTo: InvoiceParty = { name: order.ship_full_name, phone: order.ship_phone, email: order.ship_email, addressLines: addressLines(order) };
  const snapshot: Snapshot = {
    version: 1,
    orderNumber: order.order_number,
    orderDate: iso(order.placed_at)!,
    paymentMethod: order.payment_method,
    couponCode: order.coupon_code,
    business: {
      name: settings.storeName,
      addressLines: businessAddressLines(settings.address),
      phone: settings.supportPhone,
      email: settings.supportEmail,
      gstin: settings.gstin,
      website: siteUrl(),
    },
    // Checkout takes one address; the customer's account name/email go on the bill.
    billTo: { ...shipTo, name: customer?.name || shipTo.name, email: customer?.email || shipTo.email, phone: shipTo.phone || customer?.phone || "" },
    shipTo,
    items: items.map((it) => ({
      name: it.product_name,
      variantLabel: it.variant_label,
      sku: it.sku,
      quantity: Number(it.quantity),
      unitPaise: Number(it.unit_price_paise),
      totalPaise: Number(it.line_total_paise),
    })),
  };
  const pay = await paymentState((sql, p) => rows(conn, sql, p), order);

  // Next number from the shared counter. The counter row stays locked until this transaction ends, so numbers are
  // never reused, and a rolled-back attempt gives its number back.
  await conn.query("INSERT IGNORE INTO counters (name, value) VALUES ('invoice_number', 0)");
  await conn.query("UPDATE counters SET value = LAST_INSERT_ID(value + 1) WHERE name = 'invoice_number'");
  const [[seq]] = await conn.query<Row[]>("SELECT LAST_INSERT_ID() AS n");
  const invoiceNumber = `${PREFIX}-${String(seq.n).padStart(5, "0")}`;

  const [res] = await conn.query<import("mysql2").ResultSetHeader>(
    `INSERT INTO invoices (invoice_number, order_id, invoice_date, subtotal_paise, discount_paise, shipping_paise, tax_paise, total_paise,
       amount_paid_paise, refunded_paise, balance_due_paise, payment_status, snapshot, created_at, updated_at)
     VALUES (?, ?, NOW(3), ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))`,
    [
      invoiceNumber, order.id, order.subtotal_paise, order.discount_paise, order.shipping_paise, order.total_paise,
      pay.paid, pay.refunded, pay.balanceDue, pay.status, JSON.stringify(snapshot),
    ],
  );
  await conn.query(
    `INSERT INTO order_events (order_id, type, status, previous_status, message, actor_type, actor_id, created_at)
     VALUES (?, 'INVOICE', NULL, NULL, ?, 'SYSTEM', NULL, NOW(3))`,
    [order.id, `Invoice ${invoiceNumber} issued.`],
  );
  return { id: String(res.insertId), created: true };
}

/**
 * For the checkout / payment transactions: an invoice problem must never undo a placed order or a captured payment,
 * so it runs inside a savepoint and is simply retried later by ensureInvoice.
 */
export async function issueInvoiceSafely(conn: PoolConnection, orderId: string | number): Promise<void> {
  await conn.query("SAVEPOINT invoice_issue");
  try {
    await createInvoiceInTransaction(conn, orderId);
    await conn.query("RELEASE SAVEPOINT invoice_issue");
  } catch (err) {
    await conn.query("ROLLBACK TO SAVEPOINT invoice_issue");
    console.error("[invoices] could not issue the invoice now; it will be created when the order is opened", orderId, err);
  }
}

/** The order's invoice, creating it first if the order is placed and has none yet. Null if the order isn't placed. */
export async function ensureInvoice(orderId: string): Promise<{ invoice: Invoice; created: boolean } | null> {
  const before = await getInvoiceByOrder(orderId);
  if (before) return { invoice: before, created: false };
  const made = await transaction((conn) => createInvoiceInTransaction(conn, orderId));
  if (!made) return null;
  return { invoice: (await getInvoiceById(made.id))!, created: made.created };
}

export async function getInvoiceByOrder(orderId: string): Promise<Invoice | null> {
  const [r] = await query("SELECT id FROM invoices WHERE order_id = ?", [orderId]);
  return r ? getInvoiceById(String(r.id)) : null;
}

/** Reads an invoice. Payment fields are brought up to date with the order (frozen amounts and snapshot are not). */
export async function getInvoiceById(id: string): Promise<Invoice | null> {
  const [inv] = await query("SELECT * FROM invoices WHERE id = ?", [id]);
  if (!inv) return null;
  const [order] = await query("SELECT id, status, payment_status, total_paise FROM orders WHERE id = ?", [inv.order_id]);
  const snap = parseJson<Snapshot>(inv.snapshot, null as unknown as Snapshot);
  const pay = await paymentState(query, order);
  if (pay.paid !== inv.amount_paid_paise || pay.refunded !== inv.refunded_paise || pay.balanceDue !== inv.balance_due_paise || pay.status !== inv.payment_status) {
    await query(
      "UPDATE invoices SET amount_paid_paise = ?, refunded_paise = ?, balance_due_paise = ?, payment_status = ?, updated_at = NOW(3) WHERE id = ?",
      [pay.paid, pay.refunded, pay.balanceDue, pay.status, inv.id],
    );
  }
  const method = (snap.paymentMethod ? snap.paymentMethod.toLowerCase() : null) as PaymentMethod | null;
  const instrument = pay.instrument && pay.instrument !== "test" ? pay.instrument.toUpperCase() : null;
  const rupees = (paise: number) => Number(paise) / 100;
  const items: InvoiceLine[] = snap.items.map((it) => ({
    name: it.name,
    variantLabel: it.variantLabel,
    sku: it.sku,
    quantity: it.quantity,
    unitPrice: rupees(it.unitPaise),
    total: rupees(it.totalPaise),
  }));
  return {
    id: String(inv.id),
    invoiceNumber: inv.invoice_number,
    orderId: String(inv.order_id),
    orderNumber: snap.orderNumber,
    invoiceDate: iso(inv.invoice_date)!,
    orderDate: snap.orderDate,
    orderStatus: String(order.status).toLowerCase() as OrderStatus,
    paymentStatus: pay.status.toLowerCase() as PaymentStatus,
    paymentMethod: method,
    paymentMethodLabel: `${method ? methodLabel(method) : "—"}${instrument ? ` · ${instrument}` : ""}`,
    business: snap.business,
    billTo: snap.billTo,
    shipTo: snap.shipTo,
    sameAddress: JSON.stringify(snap.billTo.addressLines) === JSON.stringify(snap.shipTo.addressLines),
    items,
    subtotal: rupees(inv.subtotal_paise),
    discount: rupees(inv.discount_paise),
    couponCode: snap.couponCode,
    shipping: rupees(inv.shipping_paise),
    tax: rupees(inv.tax_paise),
    total: rupees(inv.total_paise),
    amountPaid: rupees(pay.paid),
    refunded: rupees(pay.refunded),
    balanceDue: rupees(pay.balanceDue),
    createdAt: iso(inv.created_at)!,
  };
}

/** Gives placed orders that have no invoice yet (e.g. orders from before invoices existed) theirs, oldest first. */
export async function backfillInvoices(limit = 200): Promise<number> {
  const missing = await query(
    `SELECT o.id FROM orders o LEFT JOIN invoices i ON i.order_id = o.id
     WHERE i.id IS NULL AND o.status NOT IN ('PENDING_PAYMENT','PAYMENT_FAILED') ORDER BY o.placed_at, o.id LIMIT ?`,
    [limit],
  );
  let made = 0;
  for (const m of missing) {
    try {
      if ((await transaction((conn) => createInvoiceInTransaction(conn, m.id)))?.created) made++;
    } catch (err) {
      console.error("[invoices] backfill failed for order", m.id, err);
    }
  }
  return made;
}

/**
 * For the API routes: the order's invoice (created if needed), or a clear error. With `customerId`, only that
 * customer's own orders are found; anyone else's order looks exactly like a missing one (404).
 */
export async function invoiceForOrderOrThrow(orderId: string, customerId?: string): Promise<{ invoice: Invoice; created: boolean }> {
  const [order] = await query(`SELECT id, status FROM orders WHERE id = ?${customerId ? " AND customer_id = ?" : ""}`, customerId ? [orderId, customerId] : [orderId]);
  if (!order) throw notFound("Order");
  if (NOT_PLACED.has(order.status)) {
    throw new ApiError(409, "This order has no invoice yet: its payment hasn't been completed. The invoice is issued as soon as the order is confirmed.", "not_placed");
  }
  const result = await ensureInvoice(orderId);
  if (!result) throw new ApiError(409, "This order has no invoice yet.", "not_placed");
  return result;
}

/** PDF response; `inline` opens it in the browser's viewer, otherwise it downloads. */
export async function invoicePdfResponse(invoice: Invoice, inline: boolean): Promise<Response> {
  const pdf = await renderInvoicePdf(invoice);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${invoiceFileName(invoice)}"`,
      "Content-Length": String(pdf.length),
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}

export const invoiceFileName = (inv: Pick<Invoice, "orderNumber">) => `Invoice_${inv.orderNumber.replace(/[^A-Za-z0-9-]/g, "")}.pdf`;
