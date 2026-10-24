"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Eye, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column, type TableFilter } from "@/components/admin/tables/data-table";
import { RowActions } from "@/components/admin/tables/row-actions";
import { ProductStatusBadge, StockBadge } from "@/components/admin/badges/status-badge";
import { ConfirmDialog } from "@/components/admin/common/confirm-dialog";
import { FormError } from "@/components/admin/forms/form-feedback";
import { productStatusMeta, toMetaOptions } from "@/config/labels";
import { formatCurrency } from "@/lib/format";
import { deleteProduct } from "@/services/products";
import type { Product } from "@/types";

const columns: Column<Product>[] = [
  {
    id: "name",
    header: "Product",
    sortValue: (p) => p.name,
    cell: (p) => (
      <Link href={`/admin/products/${p.id}`} className="block min-w-0">
        <span className="block font-semibold hover:text-accent">{p.name}</span>
        <span className="text-xs text-muted">{p.sku}</span>
      </Link>
    ),
  },
  { id: "category", header: "Category", sortValue: (p) => p.category, cell: (p) => (p.subcategory ? `${p.category} › ${p.subcategory}` : p.category) },
  { id: "packs", header: "Packs", cell: (p) => (p.variants.length ? p.variants.map((v) => v.label).join(" · ") : <span className="text-muted">—</span>) },
  {
    id: "price",
    header: "Price",
    align: "right",
    sortValue: (p) => p.salePrice ?? p.price,
    cell: (p) =>
      p.salePrice !== null ? (
        <span>
          <span className="font-semibold">{formatCurrency(p.salePrice)}</span>{" "}
          <span className="text-xs text-muted line-through">{formatCurrency(p.price)}</span>
        </span>
      ) : (
        formatCurrency(p.price)
      ),
  },
  {
    id: "stock",
    header: "Stock",
    sortValue: (p) => p.totalStock,
    cell: (p) => (
      <div className="flex items-center gap-2">
        <span className="w-8 tabular-nums">{p.totalStock}</span>
        <StockBadge level={p.stockLevel} />
      </div>
    ),
  },
  {
    id: "rating",
    header: "Rating",
    sortValue: (p) => p.ratingAvg,
    cell: (p) =>
      p.reviewCount ? (
        <span className="inline-flex items-center gap-1">
          <Star className="size-3.5 fill-accent text-accent" aria-hidden /> {p.ratingAvg.toFixed(1)}
          <span className="text-xs text-muted">({p.reviewCount})</span>
        </span>
      ) : (
        <span className="text-muted">—</span>
      ),
  },
  { id: "status", header: "Status", cell: (p) => <ProductStatusBadge status={p.status} /> },
];

const buildFilters = (products: Product[]): TableFilter<Product>[] => [
  {
    id: "category",
    label: "Category",
    options: [...new Set(products.map((p) => p.category))].sort().map((c) => ({ value: c, label: c })),
    matches: (p, v) => p.category === v,
  },
  { id: "status", label: "Status", options: toMetaOptions(productStatusMeta), matches: (p, v) => p.status === v },
];

export function ProductsTable({ products }: { products: Product[] }) {
  const router = useRouter();
  const filters = React.useMemo(() => buildFilters(products), [products]);
  const [pendingDelete, setPendingDelete] = React.useState<Product | null>(null);

  const remove = useMutation({
    mutationFn: (id: string) => deleteProduct(id),
    onSuccess: () => {
      setPendingDelete(null);
      router.refresh();
    },
  });

  return (
    <>
      <DataTable
        caption="Products"
        columns={columns}
        data={products}
        getRowId={(p) => p.id}
        searchText={(p) => `${p.name} ${p.sku} ${p.category}`}
        searchPlaceholder="Search by name, SKU or category"
        filters={filters}
        emptyTitle="No products yet"
        emptyDescription="Add your first pickle to start selling."
        emptyAction={
          <Button asChild>
            <Link href="/admin/products/new">
              <Plus className="size-4" aria-hidden /> Add product
            </Link>
          </Button>
        }
        rowActions={(p) => (
          <RowActions
            label={p.name}
            actions={[
              { label: "View", href: `/admin/products/${p.id}`, icon: <Eye /> },
              { label: "Edit", href: `/admin/products/${p.id}/edit`, icon: <Pencil /> },
              {
                label: "Delete",
                icon: <Trash2 />,
                destructive: true,
                onSelect: () => {
                  remove.reset();
                  setPendingDelete(p);
                },
              },
            ]}
          />
        )}
      />
      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title="Delete product?"
        description={`“${pendingDelete?.name ?? ""}” and its pack sizes will be removed permanently. This can't be undone.`}
        confirmLabel="Delete"
        destructive
        loading={remove.isPending}
        onConfirm={() => pendingDelete && remove.mutate(pendingDelete.id)}
      >
        {remove.isError && <FormError>{remove.error.message}</FormError>}
      </ConfirmDialog>
    </>
  );
}
