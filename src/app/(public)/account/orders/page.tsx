import type { Metadata } from "next";
import Link from "next/link";
import { Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OrderStatusBadge } from "@/components/ui/status-badge";
import { StateMessage } from "@/components/store/common/state-message";
import { formatCurrency, formatDate } from "@/lib/format";
import { listCustomerOrders } from "@/server/store/customer-orders";
import { requireCustomerPage } from "@/server/store/page-auth";

export const metadata: Metadata = { title: "My Orders" };

export default async function OrdersPage() {
  const me = await requireCustomerPage("/account/orders");
  const orders = await listCustomerOrders(me.id);

  if (orders.length === 0) {
    return (
      <StateMessage
        icon={Package}
        title="No orders yet"
        description="When you place an order it will show up here."
        action={<Button asChild><Link href="/shop">Shop pickles</Link></Button>}
      />
    );
  }

  return (
    <ul className="space-y-4">
      {orders.map((o) => (
        <li key={o.id}>
          <Link href={`/account/orders/${o.id}`} className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-surface p-5 transition-colors hover:border-primary">
            <div className="min-w-0">
              <p className="font-bold text-accent">{o.orderNumber}</p>
              <p className="text-sm text-muted">Placed {formatDate(o.placedAt)} · {o.itemCount} {o.itemCount === 1 ? "item" : "items"}</p>
            </div>
            <OrderStatusBadge status={o.status} />
            <p className="font-bold">{formatCurrency(o.total)}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
