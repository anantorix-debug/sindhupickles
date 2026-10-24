import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/common/page-header";
import { DetailCard } from "@/components/admin/common/detail-list";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/admin/badges/status-badge";
import { UpdateOrderStatusDialog } from "@/components/admin/dialogs/update-order-status";
import { OrderTrackingDialog } from "@/components/admin/dialogs/order-tracking";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { methodLabel } from "@/config/labels";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { getOrder } from "@/server/repositories/orders";

export async function generateMetadata({ params }: PageProps<"/admin/orders/[id]">): Promise<Metadata> {
  const order = await getOrder((await params).id);
  return { title: order ? `Order ${order.orderNumber}` : "Order" };
}

export default async function OrderDetailPage({ params }: PageProps<"/admin/orders/[id]">) {
  const order = await getOrder((await params).id);
  if (!order) notFound();

  const totals: [string, string, boolean?][] = [
    ["Subtotal", formatCurrency(order.subtotal)],
    ...(order.discount ? ([[`Discount${order.couponCode ? ` (${order.couponCode})` : ""}`, `− ${formatCurrency(order.discount)}`]] as [string, string][]) : []),
    ["Shipping", order.shipping ? formatCurrency(order.shipping) : "Free"],
    ["Total", formatCurrency(order.total), true],
  ];

  return (
    <>
      <PageHeader
        title={`Order ${order.orderNumber}`}
        description={`Placed ${formatDateTime(order.placedAt)}`}
        backHref="/admin/orders"
        backLabel="Orders"
        actions={
          <>
            <OrderTrackingDialog orderId={order.id} orderNumber={order.orderNumber} tracking={order.tracking} disabled={order.status === "cancelled"} />
            <UpdateOrderStatusDialog orderId={order.id} orderNumber={order.orderNumber} status={order.status} />
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[440px] text-left text-sm">
                  <caption className="sr-only">Order items</caption>
                  <thead>
                    <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                      <th scope="col" className="py-2 pr-4 font-semibold">Product</th>
                      <th scope="col" className="py-2 pr-4 text-right font-semibold">Price</th>
                      <th scope="col" className="py-2 pr-4 text-right font-semibold">Qty</th>
                      <th scope="col" className="py-2 text-right font-semibold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items.map((it) => (
                      <tr key={it.id} className="border-b border-border last:border-0">
                        <td className="py-3 pr-4">
                          {it.productId ? (
                            <Link href={`/admin/products/${it.productId}`} className="font-semibold hover:text-accent">
                              {it.name}
                            </Link>
                          ) : (
                            <span className="font-semibold">{it.name}</span>
                          )}
                          <p className="text-xs text-muted">{it.variantLabel} · {it.sku}</p>
                        </td>
                        <td className="py-3 pr-4 text-right">{formatCurrency(it.unitPrice)}</td>
                        <td className="py-3 pr-4 text-right">{it.quantity}</td>
                        <td className="py-3 text-right font-semibold">{formatCurrency(it.lineTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <dl className="ml-auto mt-4 max-w-xs space-y-2 text-sm">
                {totals.map(([label, value, strong]) => (
                  <div key={label} className={strong ? "flex justify-between border-t border-border pt-2 text-base font-bold" : "flex justify-between text-muted"}>
                    <dt>{label}</dt>
                    <dd className={strong ? "text-accent" : "text-foreground"}>{value}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>

          <DetailCard
            title="Delivery"
            rows={[
              { label: "Deliver to", value: order.shippingName },
              { label: "Address", value: order.shippingAddress },
              { label: "Tracking", value: order.tracking ? `${order.tracking.carrier} · ${order.tracking.number}` : "Not shipped yet" },
              ...(order.customerNote ? [{ label: "Customer note", value: order.customerNote }] : []),
            ]}
          />

          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-4 border-l border-border pl-5">
                {order.events.map((e) => (
                  <li key={e.id} className="relative text-sm">
                    <span aria-hidden className="absolute -left-[26px] top-1.5 size-2.5 rounded-full bg-primary" />
                    <p>{e.message}</p>
                    <p className="text-xs text-muted">{formatDateTime(e.at)} · {e.actor}</p>
                  </li>
                ))}
                {order.events.length === 0 && <li className="text-sm text-muted">No activity recorded yet.</li>}
              </ol>
            </CardContent>
          </Card>
        </div>
        <div className="space-y-6">
          <DetailCard
            title="Status"
            rows={[
              { label: "Order", value: <OrderStatusBadge status={order.status} /> },
              { label: "Payment", value: <PaymentStatusBadge status={order.paymentStatus} /> },
              { label: "Method", value: methodLabel(order.paymentMethod) },
            ]}
          />
          <DetailCard
            title="Customer"
            rows={[
              { label: "Name", value: <Link href={`/admin/customers/${order.customerId}`} className="text-accent hover:underline">{order.customerName}</Link> },
              { label: "Email", value: order.customerEmail },
              { label: "Phone", value: order.customerPhone },
            ]}
          />
        </div>
      </div>
    </>
  );
}
