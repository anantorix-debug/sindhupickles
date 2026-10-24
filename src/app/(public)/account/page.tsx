import type { Metadata } from "next";
import Link from "next/link";
import { OrderStatusBadge } from "@/components/ui/status-badge";
import { Card } from "@/components/ui/card";
import { ProfileForm } from "@/components/store/forms/profile-form";
import { formatCurrency, formatDate } from "@/lib/format";
import { listCustomerOrders } from "@/server/store/customer-orders";
import { requireCustomerPage } from "@/server/store/page-auth";

export const metadata: Metadata = { title: "Profile" };

export default async function AccountPage() {
  const me = await requireCustomerPage("/account");
  const orders = (await listCustomerOrders(me.id)).slice(0, 3);

  return (
    <div className="space-y-6">
      <ProfileForm profile={me} />
      <Card className="p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">Recent orders</h2>
          <Link href="/account/orders" className="text-sm font-semibold text-accent hover:underline">View all</Link>
        </div>
        {orders.length === 0 ? (
          <p className="text-sm text-muted">You haven&apos;t placed an order yet. <Link href="/shop" className="font-semibold text-accent hover:underline">Start shopping</Link></p>
        ) : (
          <ul className="divide-y divide-border">
            {orders.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div>
                  <Link href={`/account/orders/${o.id}`} className="font-bold text-accent hover:underline">{o.orderNumber}</Link>
                  <p className="text-xs text-muted">{formatDate(o.placedAt)} · {o.itemCount} {o.itemCount === 1 ? "item" : "items"}</p>
                </div>
                <OrderStatusBadge status={o.status} />
                <span className="font-semibold">{formatCurrency(o.total)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
