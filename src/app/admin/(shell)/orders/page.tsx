import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/common/page-header";
import { OrdersTable } from "@/components/admin/tables/orders-table";
import { listOrders } from "@/server/repositories/orders";

export const metadata: Metadata = { title: "Orders" };

export default async function OrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  const [orders, params] = await Promise.all([listOrders(), searchParams]);
  const q = typeof params.q === "string" ? params.q : undefined;

  return (
    <>
      <PageHeader title="Orders" description={`${orders.length} orders in total.`} />
      <OrdersTable orders={orders} initialQuery={q} />
    </>
  );
}
