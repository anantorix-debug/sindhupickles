"use client";

import * as React from "react";
import { PackagePlus } from "lucide-react";
import { DataTable, type Column, type TableFilter } from "@/components/admin/tables/data-table";
import { RowActions } from "@/components/admin/tables/row-actions";
import { StockBadge } from "@/components/admin/badges/status-badge";
import { AdjustStockDialog } from "@/components/admin/dialogs/adjust-stock";
import { stockLevelMeta, toMetaOptions } from "@/config/labels";
import type { InventoryItem } from "@/types";

const columns: Column<InventoryItem>[] = [
  {
    id: "name",
    header: "Product",
    sortValue: (i) => i.productName,
    cell: (i) => (
      <>
        <span className="block font-semibold">{i.productName}</span>
        <span className="text-xs text-muted">{i.sku}</span>
      </>
    ),
  },
  { id: "category", header: "Category", cell: (i) => i.category },
  { id: "label", header: "Pack", cell: (i) => i.label },
  { id: "onHand", header: "On hand", align: "right", sortValue: (i) => i.onHand, cell: (i) => <span className="tabular-nums">{i.onHand}</span> },
  { id: "reserved", header: "Reserved", align: "right", cell: (i) => <span className="text-muted tabular-nums">{i.reserved}</span> },
  { id: "available", header: "Available", align: "right", sortValue: (i) => i.available, cell: (i) => <span className="font-semibold tabular-nums">{i.available}</span> },
  { id: "level", header: "Level", cell: (i) => <StockBadge level={i.level} /> },
];

const buildFilters = (items: InventoryItem[]): TableFilter<InventoryItem>[] => [
  { id: "level", label: "Level", options: toMetaOptions(stockLevelMeta), matches: (i, v) => i.level === v },
  {
    id: "category",
    label: "Category",
    options: [...new Set(items.map((i) => i.category))].sort().map((c) => ({ value: c, label: c })),
    matches: (i, v) => i.category === v,
  },
];

export function InventoryTable({ items }: { items: InventoryItem[] }) {
  const [adjusting, setAdjusting] = React.useState<InventoryItem | null>(null);
  const filters = React.useMemo(() => buildFilters(items), [items]);

  return (
    <>
      <DataTable
        caption="Inventory"
        columns={columns}
        data={items}
        getRowId={(i) => i.variantId}
        searchText={(i) => `${i.productName} ${i.sku} ${i.label}`}
        searchPlaceholder="Search by product or SKU"
        filters={filters}
        emptyTitle="No stock records"
        emptyDescription="Add products to start tracking inventory."
        rowActions={(i) => (
          <RowActions label={`${i.productName} ${i.label}`} actions={[{ label: "Adjust stock", icon: <PackagePlus />, onSelect: () => setAdjusting(i) }]} />
        )}
      />
      <AdjustStockDialog item={adjusting} onOpenChange={(o) => !o && setAdjusting(null)} />
    </>
  );
}
