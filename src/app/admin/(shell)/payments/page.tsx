import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/admin/common/page-header";
import { PaymentsTable } from "@/components/admin/tables/payments-table";
import { formatCurrency } from "@/lib/format";
import { listPayments } from "@/server/repositories/payments";
import type { PaymentStatus } from "@/types";

export const metadata: Metadata = { title: "Payments" };

export default async function PaymentsPage() {
  const payments = await listPayments();
  const sum = (status: PaymentStatus) => payments.filter((p) => p.status === status).reduce((s, p) => s + p.amount, 0);
  const refunded = payments.reduce((s, p) => s + p.refunded, 0);
  const summary = [
    { label: "Collected", value: sum("captured") },
    { label: "Pending", value: sum("pending") },
    { label: "Failed", value: sum("failed") },
    { label: "Refunded", value: refunded },
  ];

  return (
    <>
      <PageHeader title="Payments" description="Every transaction across all payment methods." />
      <section aria-label="Payment summary" className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summary.map((s) => (
          <Card key={s.label} className="p-5">
            <p className="text-sm font-medium text-muted">{s.label}</p>
            <p className="mt-2 font-display text-2xl font-black">{formatCurrency(s.value)}</p>
          </Card>
        ))}
      </section>
      <PaymentsTable payments={payments} />
    </>
  );
}
