import Link from "next/link";
import { OrderStatusBadge } from "@/components/admin/badges/status-badge";
import { formatCurrency, formatDateTime } from "@/lib/format";
import type { OrderSummary } from "@/types";

export function RecentOrdersTable({ orders }: { orders: OrderSummary[] }) {
  return (
    <div className="-mx-5 overflow-x-auto px-5">
      <table className="w-full min-w-[520px] text-left text-sm">
        <caption className="sr-only">Recent orders</caption>
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
            <th scope="col" className="py-2 pr-4 font-semibold">Order</th>
            <th scope="col" className="py-2 pr-4 font-semibold">Customer</th>
            <th scope="col" className="py-2 pr-4 font-semibold">Status</th>
            <th scope="col" className="py-2 text-right font-semibold">Total</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} className="border-b border-border last:border-0">
              <td className="py-3 pr-4">
                <Link href={`/admin/orders/${o.id}`} className="font-bold text-accent hover:underline">
                  {o.orderNumber}
                </Link>
                <p className="text-xs text-muted">{formatDateTime(o.placedAt)}</p>
              </td>
              <td className="py-3 pr-4">{o.customerName}</td>
              <td className="py-3 pr-4">
                <OrderStatusBadge status={o.status} />
              </td>
              <td className="py-3 text-right font-semibold">{formatCurrency(o.total)}</td>
            </tr>
          ))}
          {orders.length === 0 && (
            <tr>
              <td colSpan={4} className="py-8 text-center text-muted">No orders yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
