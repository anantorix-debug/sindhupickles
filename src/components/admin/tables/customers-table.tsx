"use client";

import Link from "next/link";
import { Eye } from "lucide-react";
import { DataTable, type Column, type TableFilter } from "@/components/admin/tables/data-table";
import { RowActions } from "@/components/admin/tables/row-actions";
import { CustomerStatusBadge } from "@/components/admin/badges/status-badge";
import { UserAvatar } from "@/components/admin/sidebar/sidebar-user";
import { customerStatusMeta, toMetaOptions } from "@/config/labels";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Customer } from "@/types";

const columns: Column<Customer>[] = [
  {
    id: "name",
    header: "Customer",
    sortValue: (c) => c.name,
    cell: (c) => (
      <Link href={`/admin/customers/${c.id}`} className="flex items-center gap-3">
        <UserAvatar name={c.name} />
        <span className="min-w-0">
          <span className="block font-semibold hover:text-accent">{c.name}</span>
          <span className="block truncate text-xs text-muted">{c.email}</span>
        </span>
      </Link>
    ),
  },
  {
    id: "location",
    header: "Location",
    sortValue: (c) => c.city ?? "",
    cell: (c) => (c.city ? `${c.city}${c.state ? `, ${c.state}` : ""}` : <span className="text-muted">—</span>),
  },
  { id: "orders", header: "Orders", align: "right", sortValue: (c) => c.ordersCount, cell: (c) => c.ordersCount },
  { id: "spent", header: "Total spent", align: "right", sortValue: (c) => c.totalSpent, cell: (c) => <span className="font-semibold">{formatCurrency(c.totalSpent)}</span> },
  { id: "joined", header: "Joined", sortValue: (c) => c.joinedAt, cell: (c) => formatDate(c.joinedAt) },
  { id: "status", header: "Status", cell: (c) => <CustomerStatusBadge status={c.status} /> },
];

const filters: TableFilter<Customer>[] = [
  { id: "status", label: "Status", options: toMetaOptions(customerStatusMeta), matches: (c, v) => c.status === v },
];

export function CustomersTable({ customers }: { customers: Customer[] }) {
  return (
    <DataTable
      caption="Customers"
      columns={columns}
      data={customers}
      getRowId={(c) => c.id}
      searchText={(c) => `${c.name} ${c.email} ${c.phone} ${c.city}`}
      searchPlaceholder="Search by name, email, phone or city"
      filters={filters}
      emptyTitle="No customers yet"
      emptyDescription="Customers appear after their first sign-up or order."
      rowActions={(c) => <RowActions label={c.name} actions={[{ label: "View profile", href: `/admin/customers/${c.id}`, icon: <Eye /> }]} />}
    />
  );
}
