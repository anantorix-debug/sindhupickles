"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Mail, MailOpen, Trash2 } from "lucide-react";
import { DataTable, type Column, type TableFilter } from "@/components/admin/tables/data-table";
import { RowActions } from "@/components/admin/tables/row-actions";
import { StatusBadge } from "@/components/admin/badges/status-badge";
import { ConfirmDialog } from "@/components/admin/common/confirm-dialog";
import { FormError } from "@/components/admin/forms/form-feedback";
import { formatDateTime } from "@/lib/format";
import { deleteEnquiry, setEnquiryRead } from "@/services/enquiries";
import type { Enquiry } from "@/types";

const filters: TableFilter<Enquiry>[] = [
  { id: "status", label: "Status", options: [{ value: "unread", label: "Unread" }, { value: "read", label: "Read" }], matches: (e, v) => (v === "read") === e.isRead },
];

export function EnquiriesTable({ enquiries }: { enquiries: Enquiry[] }) {
  const router = useRouter();
  const [pendingDelete, setPendingDelete] = React.useState<Enquiry | null>(null);

  const mark = useMutation({
    mutationFn: ({ id, isRead }: { id: string; isRead: boolean }) => setEnquiryRead(id, isRead),
    onSuccess: () => router.refresh(),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteEnquiry(id),
    onSuccess: () => {
      setPendingDelete(null);
      router.refresh();
    },
  });

  const columns: Column<Enquiry>[] = [
    {
      id: "from",
      header: "From",
      sortValue: (e) => e.name,
      cell: (e) => (
        <div className="min-w-0">
          <p className={e.isRead ? "font-medium" : "font-bold"}>{e.name}</p>
          <a href={`mailto:${e.email}`} className="block truncate text-xs text-accent hover:underline">{e.email}</a>
          {e.phone && <span className="block text-xs text-muted">{e.phone}</span>}
        </div>
      ),
    },
    { id: "message", header: "Message", className: "max-w-lg", cell: (e) => <p className="line-clamp-3 whitespace-pre-line text-muted">{e.message}</p> },
    { id: "date", header: "Received", sortValue: (e) => e.createdAt, cell: (e) => <span className="whitespace-nowrap">{formatDateTime(e.createdAt)}</span> },
    { id: "status", header: "Status", cell: (e) => <StatusBadge label={e.isRead ? "Read" : "Unread"} tone={e.isRead ? "neutral" : "primary"} /> },
  ];

  return (
    <>
      {mark.isError && (
        <div className="mb-4">
          <FormError>{mark.error.message}</FormError>
        </div>
      )}
      <DataTable
        caption="Enquiries"
        columns={columns}
        data={enquiries}
        getRowId={(e) => e.id}
        searchText={(e) => `${e.name} ${e.email} ${e.phone ?? ""} ${e.message}`}
        searchPlaceholder="Search enquiries"
        filters={filters}
        emptyTitle="No enquiries yet"
        emptyDescription="Messages from the storefront contact form appear here."
        rowActions={(e) => (
          <RowActions
            label={`enquiry from ${e.name}`}
            actions={[
              e.isRead
                ? { label: "Mark unread", icon: <Mail />, onSelect: () => mark.mutate({ id: e.id, isRead: false }) }
                : { label: "Mark as read", icon: <MailOpen />, onSelect: () => mark.mutate({ id: e.id, isRead: true }) },
              {
                label: "Delete",
                icon: <Trash2 />,
                destructive: true,
                onSelect: () => {
                  remove.reset();
                  setPendingDelete(e);
                },
              },
            ]}
          />
        )}
      />
      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title="Delete enquiry?"
        description="This permanently removes the message."
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
