"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column, type TableFilter } from "@/components/admin/tables/data-table";
import { RowActions } from "@/components/admin/tables/row-actions";
import { StatusBadge } from "@/components/admin/badges/status-badge";
import { ConfirmDialog } from "@/components/admin/common/confirm-dialog";
import { FormError } from "@/components/admin/forms/form-feedback";
import { formatDate } from "@/lib/format";
import { deletePost } from "@/services/blog";
import type { BlogPostSummary } from "@/types";

const columns: Column<BlogPostSummary>[] = [
  {
    id: "title",
    header: "Post",
    sortValue: (p) => p.title,
    cell: (p) => (
      <Link href={`/admin/blog/${p.id}/edit`} className="block min-w-0">
        <span className="block font-semibold hover:text-accent">{p.title}</span>
        <span className="text-xs text-muted">/{p.slug}</span>
      </Link>
    ),
  },
  { id: "category", header: "Category", sortValue: (p) => p.category, cell: (p) => p.category },
  { id: "author", header: "Author", cell: (p) => p.authorName ?? <span className="text-muted">—</span> },
  { id: "views", header: "Views", align: "right", sortValue: (p) => p.viewCount, cell: (p) => p.viewCount },
  { id: "date", header: "Published", sortValue: (p) => p.publishedAt ?? "", cell: (p) => (p.publishedAt ? formatDate(p.publishedAt) : <span className="text-muted">—</span>) },
  { id: "status", header: "Status", cell: (p) => <StatusBadge label={p.status === "published" ? "Published" : "Draft"} tone={p.status === "published" ? "success" : "warning"} /> },
];

const filters: TableFilter<BlogPostSummary>[] = [
  { id: "status", label: "Status", options: [{ value: "published", label: "Published" }, { value: "draft", label: "Draft" }], matches: (p, v) => p.status === v },
];

export function BlogTable({ posts }: { posts: BlogPostSummary[] }) {
  const router = useRouter();
  const [pendingDelete, setPendingDelete] = React.useState<BlogPostSummary | null>(null);
  const remove = useMutation({
    mutationFn: (id: string) => deletePost(id),
    onSuccess: () => {
      setPendingDelete(null);
      router.refresh();
    },
  });

  return (
    <>
      <DataTable
        caption="Blog posts"
        columns={columns}
        data={posts}
        getRowId={(p) => p.id}
        searchText={(p) => `${p.title} ${p.slug} ${p.category}`}
        searchPlaceholder="Search posts"
        filters={filters}
        emptyTitle="No posts yet"
        emptyDescription="Write your first blog post."
        emptyAction={
          <Button asChild>
            <Link href="/admin/blog/new">
              <Plus className="size-4" aria-hidden /> New post
            </Link>
          </Button>
        }
        rowActions={(p) => (
          <RowActions
            label={p.title}
            actions={[
              { label: "Edit", href: `/admin/blog/${p.id}/edit`, icon: <Pencil /> },
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
        title="Delete post?"
        description={`“${pendingDelete?.title ?? ""}” will be removed permanently.`}
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
