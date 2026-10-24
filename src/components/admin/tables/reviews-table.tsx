"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Check, Eye, EyeOff, Star, Trash2 } from "lucide-react";
import { DataTable, type Column, type TableFilter } from "@/components/admin/tables/data-table";
import { RowActions } from "@/components/admin/tables/row-actions";
import { StatusBadge } from "@/components/admin/badges/status-badge";
import { ConfirmDialog } from "@/components/admin/common/confirm-dialog";
import { FormError } from "@/components/admin/forms/form-feedback";
import { formatDate } from "@/lib/format";
import { deleteReview, setReviewVisibility } from "@/services/reviews";
import type { Review } from "@/types";

const columns: Column<Review>[] = [
  {
    id: "rating",
    header: "Rating",
    sortValue: (r) => r.rating,
    cell: (r) => (
      <span className="inline-flex items-center gap-1 font-semibold">
        <Star className="size-3.5 fill-accent text-accent" aria-hidden /> {r.rating}
      </span>
    ),
  },
  {
    id: "review",
    header: "Review",
    className: "max-w-md",
    cell: (r) => (
      <div className="min-w-0">
        {r.title && <p className="font-semibold">{r.title}</p>}
        <p className="line-clamp-2 text-muted">{r.comment ?? "No comment"}</p>
      </div>
    ),
  },
  {
    id: "product",
    header: "Product",
    sortValue: (r) => r.productName,
    cell: (r) => (
      <Link href={`/admin/products/${r.productId}`} className="hover:text-accent">
        {r.productName}
      </Link>
    ),
  },
  {
    id: "customer",
    header: "Customer",
    cell: (r) => (
      <Link href={`/admin/customers/${r.customerId}`} className="hover:text-accent">
        {r.customerName}
      </Link>
    ),
  },
  { id: "date", header: "Date", sortValue: (r) => r.createdAt, cell: (r) => <span className="whitespace-nowrap">{formatDate(r.createdAt)}</span> },
  {
    id: "status",
    header: "Status",
    cell: (r) =>
      r.status === "pending" ? <StatusBadge label="Awaiting approval" tone="warning" /> : <StatusBadge label={r.visible ? "Visible" : "Hidden"} tone={r.visible ? "success" : "neutral"} />,
  },
];

const filters: TableFilter<Review>[] = [
  { id: "rating", label: "Rating", options: [5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: `${n} star${n > 1 ? "s" : ""}` })), matches: (r, v) => String(r.rating) === v },
  { id: "status", label: "Status", options: [{ value: "pending", label: "Awaiting approval" }, { value: "visible", label: "Visible" }, { value: "hidden", label: "Hidden" }], matches: (r, v) => (v === "pending" ? r.status === "pending" : r.status === "approved" && (v === "visible") === r.visible) },
];

export function ReviewsTable({ reviews }: { reviews: Review[] }) {
  const router = useRouter();
  const [pendingDelete, setPendingDelete] = React.useState<Review | null>(null);

  const toggle = useMutation({
    mutationFn: (r: Review) => setReviewVisibility(r.id, !r.visible),
    onSuccess: () => router.refresh(),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteReview(id),
    onSuccess: () => {
      setPendingDelete(null);
      router.refresh();
    },
  });

  return (
    <>
      {toggle.isError && (
        <div className="mb-4">
          <FormError>{toggle.error.message}</FormError>
        </div>
      )}
      <DataTable
        caption="Reviews"
        columns={columns}
        data={reviews}
        getRowId={(r) => r.id}
        searchText={(r) => `${r.title ?? ""} ${r.comment ?? ""} ${r.productName} ${r.customerName}`}
        searchPlaceholder="Search reviews"
        filters={filters}
        emptyTitle="No reviews yet"
        emptyDescription="Reviews written by customers who received their order appear here for approval."
        rowActions={(r) => (
          <RowActions
            label={`review by ${r.customerName}`}
            actions={[
              r.status === "pending"
                ? { label: "Approve", icon: <Check />, onSelect: () => toggle.mutate(r) }
                : { label: r.visible ? "Hide" : "Show", icon: r.visible ? <EyeOff /> : <Eye />, onSelect: () => toggle.mutate(r) },
              {
                label: "Delete",
                icon: <Trash2 />,
                destructive: true,
                onSelect: () => {
                  remove.reset();
                  setPendingDelete(r);
                },
              },
            ]}
          />
        )}
      />
      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title="Delete review?"
        description="This permanently removes the review. Hide it instead if you may want it back."
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
