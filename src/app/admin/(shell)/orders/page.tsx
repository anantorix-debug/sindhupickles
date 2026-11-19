import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/common/page-header";
import { OrdersTable } from "@/components/admin/tables/orders-table";
import { backfillInvoices } from "@/server/invoices/service";
import { listOrders } from "@/server/repositories/orders";

export const metadata: Metadata = { title: "Orders" };

export default async function OrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  // Every placed order has an invoice: older orders (from before invoices existed) get theirs here, oldest first.
  await backfillInvoices().catch((err) => console.error("[invoices] backfill", err));
  const [orders, params] = await Promise.all([listOrders(), searchParams]);
  const q = typeof params.q === "string" ? params.q : undefined;

  return (
    <>
      <PageHeader title="Orders" description={`${orders.length} orders in total.`} />
      <OrdersTable orders={orders} initialQuery={q} />
    </>
  );
}
