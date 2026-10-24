"use client";

import Link from "next/link";
import { DataTable, type Column, type TableFilter } from "@/components/admin/tables/data-table";
import { PaymentStatusBadge } from "@/components/admin/badges/status-badge";
import { methodLabel, paymentMethodLabels, paymentStatusMeta, toMetaOptions, toOptions } from "@/config/labels";
import { formatCurrency, formatDateTime } from "@/lib/format";
import type { Payment } from "@/types";

const columns: Column<Payment>[] = [
  {
    id: "txn",
    header: "Reference",
    cell: (p) => <span className="font-mono text-xs">{p.providerPaymentId ?? "—"}</span>,
  },
  {
    id: "order",
    header: "Order",
    cell: (p) => (
      <Link href={`/admin/orders/${p.orderId}`} className="font-bold text-accent hover:underline">
        {p.orderNumber}
      </Link>
    ),
  },
  { id: "customer", header: "Customer", sortValue: (p) => p.customerName, cell: (p) => p.customerName },
  { id: "method", header: "Method", sortValue: (p) => p.method, cell: (p) => methodLabel(p.method) },
  { id: "date", header: "Date", sortValue: (p) => p.createdAt, cell: (p) => <span className="whitespace-nowrap">{formatDateTime(p.createdAt)}</span> },
  {
    id: "status",
    header: "Status",
    cell: (p) => (
      <div className="flex flex-col items-start gap-1">
        <PaymentStatusBadge status={p.status} />
        {p.failureReason && <span className="max-w-48 truncate text-xs text-muted" title={p.failureReason}>{p.failureReason}</span>}
      </div>
    ),
  },
  {
    id: "amount",
    header: "Amount",
    align: "right",
    sortValue: (p) => p.amount,
    cell: (p) => (
      <>
        <span className="font-semibold">{formatCurrency(p.amount)}</span>
        {p.refunded > 0 && <span className="block text-xs text-muted">{formatCurrency(p.refunded)} refunded</span>}
      </>
    ),
  },
];

const filters: TableFilter<Payment>[] = [
  { id: "status", label: "Status", options: toMetaOptions(paymentStatusMeta), matches: (p, v) => p.status === v },
  { id: "method", label: "Method", options: toOptions(paymentMethodLabels), matches: (p, v) => p.method === v },
];

export function PaymentsTable({ payments }: { payments: Payment[] }) {
  return (
    <DataTable
      caption="Payments"
      columns={columns}
      data={payments}
      getRowId={(p) => p.id}
      searchText={(p) => `${p.providerPaymentId ?? ""} ${p.orderNumber} ${p.customerName}`}
      searchPlaceholder="Search by reference, order or customer"
      filters={filters}
      emptyTitle="No payments yet"
      emptyDescription="Payments are recorded when customers check out."
    />
  );
}
