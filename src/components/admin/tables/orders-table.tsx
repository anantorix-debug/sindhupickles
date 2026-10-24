"use client";

import Link from "next/link";
import { Eye } from "lucide-react";
import { DataTable, type Column, type TableFilter } from "@/components/admin/tables/data-table";
import { RowActions } from "@/components/admin/tables/row-actions";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/admin/badges/status-badge";
import { methodLabel, orderStatusMeta, paymentStatusMeta, toMetaOptions } from "@/config/labels";
import { formatCurrency, formatDateTime } from "@/lib/format";
import type { OrderSummary } from "@/types";

const columns: Column<OrderSummary>[] = [
  {
    id: "id",
    header: "Order",
    sortValue: (o) => o.orderNumber,
    cell: (o) => (
      <Link href={`/admin/orders/${o.id}`} className="font-bold text-accent hover:underline">
        {o.orderNumber}
      </Link>
    ),
  },
  { id: "date", header: "Placed", sortValue: (o) => o.placedAt, cell: (o) => <span className="whitespace-nowrap">{formatDateTime(o.placedAt)}</span> },
  {
    id: "customer",
    header: "Customer",
    sortValue: (o) => o.customerName,
    cell: (o) => (
      <Link href={`/admin/customers/${o.customerId}`} className="hover:text-accent">
        {o.customerName}
      </Link>
    ),
  },
  { id: "items", header: "Items", align: "right", cell: (o) => o.itemCount },
  {
    id: "payment",
    header: "Payment",
    cell: (o) => (
      <div className="flex flex-col items-start gap-1">
        <PaymentStatusBadge status={o.paymentStatus} />
        <span className="text-xs text-muted">{methodLabel(o.paymentMethod)}</span>
      </div>
    ),
  },
  { id: "status", header: "Status", cell: (o) => <OrderStatusBadge status={o.status} /> },
  { id: "total", header: "Total", align: "right", sortValue: (o) => o.total, cell: (o) => <span className="font-semibold">{formatCurrency(o.total)}</span> },
];

const filters: TableFilter<OrderSummary>[] = [
  { id: "status", label: "Status", options: toMetaOptions(orderStatusMeta), matches: (o, v) => o.status === v },
  { id: "payment", label: "Payment", options: toMetaOptions(paymentStatusMeta), matches: (o, v) => o.paymentStatus === v },
];

export function OrdersTable({ orders, initialQuery }: { orders: OrderSummary[]; initialQuery?: string }) {
  return (
    <DataTable
      caption="Orders"
      columns={columns}
      data={orders}
      getRowId={(o) => o.id}
      initialQuery={initialQuery}
      searchText={(o) => `${o.orderNumber} ${o.customerName} ${o.customerEmail}`}
      searchPlaceholder="Search by order, customer or email"
      filters={filters}
      emptyTitle="No orders yet"
      emptyDescription="Orders will appear here as customers check out."
      rowActions={(o) => <RowActions label={`order ${o.orderNumber}`} actions={[{ label: "View order", href: `/admin/orders/${o.id}`, icon: <Eye /> }]} />}
    />
  );
}
