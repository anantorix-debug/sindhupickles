import "server-only";
import { execute, query } from "@/server/db";
import { getOrder } from "@/server/repositories/orders";
import { getSettings } from "@/server/repositories/settings";
import { mailer } from "@/server/store/mailer";
import { formatCurrency } from "@/lib/format";

const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

/**
 * Order confirmation emails: one to the customer (unless they switched "Order updates" off) and one
 * to the store. Sent at most once per order (recorded on the order's timeline) and never allowed to
 * break checkout or payment confirmation.
 */
export async function sendOrderConfirmation(orderId: string): Promise<void> {
  try {
    const [done] = await query("SELECT 1 AS x FROM order_events WHERE order_id = ? AND type = 'EMAIL' LIMIT 1", [orderId]);
    if (done) return;
    const order = await getOrder(orderId);
    if (!order || order.status === "pending_payment" || order.status === "payment_failed" || order.status === "cancelled") return;

    // Claim it first, so a concurrent confirmation (checkout + webhook) can't send twice.
    const claim = await execute(
      `INSERT INTO order_events (order_id, type, status, previous_status, message, actor_type, actor_id, created_at)
       SELECT ?, 'EMAIL', NULL, NULL, 'Confirmation emails sent.', 'SYSTEM', NULL, NOW(3) FROM DUAL
       WHERE NOT EXISTS (SELECT 1 FROM order_events WHERE order_id = ? AND type = 'EMAIL')`,
      [orderId, orderId],
    );
    if (claim.affectedRows === 0) return;

    const settings = await getSettings();
    const [cust] = await query("SELECT cc.preferences FROM customer_credentials cc WHERE cc.customer_id = ?", [order.customerId]);
    const wantsUpdates = cust?.preferences?.orderUpdates !== false;

    const lines = order.items.map((i) => `  ${i.quantity} × ${i.name} (${i.variantLabel}) — ${formatCurrency(i.lineTotal)}`).join("\n");
    const summary = [
      `Order ${order.orderNumber}`,
      lines,
      "",
      `Subtotal: ${formatCurrency(order.subtotal)}`,
      ...(order.discount ? [`Discount: −${formatCurrency(order.discount)}`] : []),
      `Shipping: ${order.shipping ? formatCurrency(order.shipping) : "Free"}`,
      `Total: ${formatCurrency(order.total)}`,
      "",
      `Deliver to: ${order.shippingName}, ${order.shippingAddress}`,
    ].join("\n");

    if (wantsUpdates) {
      await mailer.send({
        to: order.customerEmail,
        subject: `Your Sindhu's Pickles order ${order.orderNumber} is confirmed`,
        text: `Hi ${order.customerName.split(" ")[0]},\n\nThank you for your order! We'll keep you posted as it's prepared and shipped.\n\n${summary}\n\nTrack it any time: ${siteUrl()}/account/orders/${order.id}\n\n— ${settings.storeName}`,
      });
    }
    await mailer.send({
      to: settings.supportEmail,
      subject: `New order ${order.orderNumber} — ${formatCurrency(order.total)}`,
      text: `A new order was placed.\n\n${summary}\n\nCustomer: ${order.customerName} <${order.customerEmail}> ${order.customerPhone}\nPayment: ${order.paymentMethod}${order.paymentStatus === "captured" ? " (paid)" : " (payment pending)"}\n\nOpen in admin: ${siteUrl()}/admin/orders/${order.id}`,
    });
  } catch (err) {
    console.error("[notifications] order email failed", orderId, err);
    // The order timeline must not claim the emails went out when they didn't (e.g. SMTP not configured).
    await execute("UPDATE order_events SET message = ? WHERE order_id = ? AND type = 'EMAIL'", ["Confirmation emails could not be sent (check the SMTP settings).", orderId]).catch(() => undefined);
  }
}
