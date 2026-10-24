import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, ExternalLink } from "lucide-react";
import { trackingPageUrl } from "@/lib/couriers";
import { Card } from "@/components/ui/card";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/ui/status-badge";
import { OrderTracker } from "@/components/store/account/order-tracker";
import { PayNow } from "@/components/store/account/pay-now";
import { StoreProviders } from "@/components/store/providers";
import { methodLabel } from "@/config/labels";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { getCustomerOrder } from "@/server/store/customer-orders";
import { requireCustomerPage } from "@/server/store/page-auth";

export const metadata: Metadata = { title: "Order details" };

export default async function OrderDetailPage({ params, searchParams }: PageProps<"/account/orders/[id]">) {
  const { id } = await params;
  const me = await requireCustomerPage(`/account/orders/${id}`);
  const order = await getCustomerOrder(me.id, id);
  if (!order) notFound();
  const sp = await searchParams;
  const justPlaced = sp.placed === "1";
  const payState = Array.isArray(sp.payment) ? sp.payment[0] : sp.payment;
  const needsPayment = order.paymentMethod === "razorpay" && (order.status === "pending_payment" || order.status === "payment_failed") && order.paymentStatus !== "captured";

  return (
    <div className="space-y-6">
      {justPlaced && (
        <div role="status" className="flex items-start gap-3 rounded-lg border border-success/40 bg-success-soft p-5">
          <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-success" aria-hidden />
          <div>
            <h2 className="font-display text-xl font-bold">Thank you! Your order is placed.</h2>
            <p className="mt-1 text-sm text-muted">Your order number is <strong className="text-foreground">{order.orderNumber}</strong>. We&apos;ll keep this page updated as it moves along.</p>
          </div>
        </div>
      )}

      {needsPayment && (
        <div role="status" className="space-y-3 rounded-lg border border-warning/40 bg-warning-soft p-5">
          <h2 className="font-display text-xl font-bold">{payState === "dismissed" ? "Payment not completed" : payState === "failed" ? "Payment didn't go through" : "Payment pending"}</h2>
          <p className="text-sm text-muted">Your order is reserved for a short time. Complete the payment to confirm it.</p>
          <StoreProviders>
            <PayNow orderId={order.id} />
          </StoreProviders>
        </div>
      )}
      {payState === "review" && (
        <p role="status" className="rounded-lg border border-border bg-surface-raised p-4 text-sm">We received your payment, but this order needs a quick check by our team. We&apos;ll contact you shortly.</p>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/account/orders" className="text-sm text-muted hover:text-accent">← All orders</Link>
          <h2 className="font-display text-2xl font-black">{order.orderNumber}</h2>
          <p className="text-sm text-muted">Placed on {formatDateTime(order.placedAt)}</p>
        </div>
        <div className="flex gap-2"><OrderStatusBadge status={order.status} /><PaymentStatusBadge status={order.paymentStatus} /></div>
      </div>

      <Card className="p-5 sm:p-6"><OrderTracker status={order.status} />
        {order.tracking && (
          <div className="mt-5 space-y-1 text-sm">
            <p><span className="text-muted">Courier:</span> <strong>{order.tracking.carrier}</strong></p>
            <p><span className="text-muted">AWB / tracking number:</span> <strong className="select-all">{order.tracking.number}</strong></p>
            {trackingPageUrl(order.tracking.carrier) && (
              <p>
                <a href={trackingPageUrl(order.tracking.carrier)!} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-accent hover:underline">
                  Track on {order.tracking.carrier} <ExternalLink className="size-3.5" aria-hidden />
                </a>
                <span className="block text-xs text-muted">Enter the number above on the courier&apos;s tracking page.</span>
              </p>
            )}
          </div>
        )}
      </Card>

      <Card className="p-5 sm:p-6">
        <h3 className="mb-4 font-display text-lg font-bold">Items</h3>
        <ul className="divide-y divide-border">
          {order.items.map((it) => (
            <li key={it.id} className="flex justify-between gap-4 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="font-semibold">{it.name}</p>
                <p className="text-xs text-muted">{it.variantLabel} · Qty {it.quantity} × {formatCurrency(it.unitPrice)}</p>
              </div>
              <p className="font-semibold">{formatCurrency(it.lineTotal)}</p>
            </li>
          ))}
        </ul>
        <dl className="ml-auto mt-5 max-w-xs space-y-2 border-t border-border pt-4 text-sm">
          <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{formatCurrency(order.subtotal)}</dd></div>
          {order.discount > 0 && <div className="flex justify-between"><dt className="text-muted">Discount{order.couponCode ? ` (${order.couponCode})` : ""}</dt><dd className="text-success">− {formatCurrency(order.discount)}</dd></div>}
          <div className="flex justify-between"><dt className="text-muted">Shipping</dt><dd>{order.shipping ? formatCurrency(order.shipping) : "Free"}</dd></div>
          <div className="flex justify-between border-t border-border pt-2 text-base font-bold"><dt>Total</dt><dd className="text-accent">{formatCurrency(order.total)}</dd></div>
        </dl>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-5 sm:p-6">
          <h3 className="mb-3 font-display text-lg font-bold">Delivery address</h3>
          <p className="font-medium">{order.shippingName}</p>
          <p className="mt-1 text-sm text-muted">{order.shippingAddress}</p>
          <p className="mt-2 text-sm text-muted">{order.customerPhone}</p>
        </Card>
        <Card className="p-5 sm:p-6">
          <h3 className="mb-3 font-display text-lg font-bold">Payment</h3>
          <p className="text-sm">{methodLabel(order.paymentMethod)}</p>
          <p className="mt-1 text-sm text-muted">Order total {formatCurrency(order.total)} · {formatDate(order.placedAt)}</p>
        </Card>
      </div>

      {order.events.length > 0 && (
        <Card className="p-5 sm:p-6">
          <h3 className="mb-4 font-display text-lg font-bold">Order history</h3>
          <ol className="space-y-4 border-l border-border pl-5">
            {order.events.map((e) => (
              <li key={e.id} className="relative text-sm">
                <span aria-hidden className="absolute -left-[26px] top-1.5 size-2.5 rounded-full bg-primary" />
                <p>{e.message}</p>
                <p className="text-xs text-muted">{formatDateTime(e.at)}</p>
              </li>
            ))}
          </ol>
        </Card>
      )}
    </div>
  );
}
