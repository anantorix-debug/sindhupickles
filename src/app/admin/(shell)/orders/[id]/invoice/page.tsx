import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, FileWarning } from "lucide-react";
import { PageHeader } from "@/components/admin/common/page-header";
import { DownloadInvoiceButton } from "@/components/invoice/download-invoice-button";
import { InvoicePaper } from "@/components/invoice/invoice-paper";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ApiError } from "@/server/http";
import { invoiceForOrderOrThrow } from "@/server/invoices/service";

export const metadata: Metadata = { title: "Invoice" };

export default async function OrderInvoicePage({ params }: PageProps<"/admin/orders/[id]/invoice">) {
  const { id } = await params;
  if (!/^\d{1,18}$/.test(id)) notFound();
  let result: Awaited<ReturnType<typeof invoiceForOrderOrThrow>> | null = null;
  let problem: string | null = null;
  try {
    result = await invoiceForOrderOrThrow(id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    problem = err instanceof ApiError ? err.message : "The invoice could not be prepared. Please try again.";
    if (!(err instanceof ApiError)) console.error("[invoices] preview", id, err);
  }

  if (!result) {
    return (
      <>
        <PageHeader title="Invoice" backHref={`/admin/orders/${id}`} backLabel="Order" />
        <Card>
          <CardContent className="flex items-start gap-3 py-6">
            <FileWarning className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
            <p className="text-sm">{problem}</p>
          </CardContent>
        </Card>
      </>
    );
  }

  const inv = result.invoice;
  const pdf = `/api/orders/${inv.orderId}/invoice/download`;
  return (
    <>
      <PageHeader
        title={`Invoice ${inv.invoiceNumber}`}
        description={`For order ${inv.orderNumber}`}
        backHref={`/admin/orders/${inv.orderId}`}
        backLabel={`Order ${inv.orderNumber}`}
        actions={
          <>
            <Button asChild variant="secondary">
              <a href={`${pdf}?inline=1`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-4" aria-hidden /> Open PDF
              </a>
            </Button>
            <DownloadInvoiceButton url={pdf} label="Download PDF" variant="primary" />
          </>
        }
      />
      <InvoicePaper invoice={inv} />
      <p className="mt-4 text-center text-xs text-muted">
        Amounts, items and addresses are fixed from when the invoice was issued. Only the payment lines follow the order.{" "}
        <Link href={`/admin/orders/${inv.orderId}`} className="text-accent hover:underline">Back to the order</Link>
      </p>
    </>
  );
}
