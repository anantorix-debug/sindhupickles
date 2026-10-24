"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { CornerDownRight, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/admin/tables/data-table";
import { RowActions } from "@/components/admin/tables/row-actions";
import { StatusBadge } from "@/components/admin/badges/status-badge";
import { ConfirmDialog } from "@/components/admin/common/confirm-dialog";
import { CategoryDialog, type CategoryDialogTarget } from "@/components/admin/dialogs/category-dialog";
import { FormError } from "@/components/admin/forms/form-feedback";
import { deleteCategory } from "@/services/categories";
import type { Category } from "@/types";

const columns: Column<Category>[] = [
  {
    id: "name",
    header: "Category",
    cell: (c) => (
      <div className={c.parentId ? "flex items-center gap-2 pl-6" : ""}>
        {c.parentId && <CornerDownRight className="size-4 shrink-0 text-muted" aria-hidden />}
        <div className="min-w-0">
          <span className={c.parentId ? "font-medium" : "font-semibold"}>{c.name}</span>
          <span className="block text-xs text-muted">{c.slug}</span>
        </div>
      </div>
    ),
  },
  { id: "parent", header: "Parent", cell: (c) => c.parentName ?? <span className="text-muted">—</span> },
  { id: "products", header: "Products", align: "right", cell: (c) => c.productCount },
  { id: "status", header: "Status", cell: (c) => <StatusBadge label={c.active ? "Visible" : "Hidden"} tone={c.active ? "success" : "neutral"} /> },
];

export function CategoriesTable({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [target, setTarget] = React.useState<CategoryDialogTarget>(null);
  const [pendingDelete, setPendingDelete] = React.useState<Category | null>(null);

  const remove = useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: () => {
      setPendingDelete(null);
      router.refresh();
    },
  });

  return (
    <>
      <DataTable
        caption="Categories"
        columns={columns}
        data={categories}
        getRowId={(c) => c.id}
        pageSize={20}
        searchText={(c) => `${c.name} ${c.slug} ${c.parentName ?? ""}`}
        searchPlaceholder="Search categories"
        toolbar={
          <Button onClick={() => setTarget("new")}>
            <Plus className="size-4" aria-hidden /> Add category
          </Button>
        }
        emptyTitle="No categories yet"
        emptyDescription="Create a category to organise your products."
        rowActions={(c) => (
          <RowActions
            label={c.name}
            actions={[
              { label: "Edit", icon: <Pencil />, onSelect: () => setTarget(c) },
              {
                label: "Delete",
                icon: <Trash2 />,
                destructive: true,
                onSelect: () => {
                  remove.reset();
                  setPendingDelete(c);
                },
              },
            ]}
          />
        )}
      />
      <CategoryDialog target={target} categories={categories} onOpenChange={(o) => !o && setTarget(null)} />
      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title="Delete category?"
        description={`“${pendingDelete?.name ?? ""}” will be removed. Categories that still have products or subcategories can't be deleted.`}
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
