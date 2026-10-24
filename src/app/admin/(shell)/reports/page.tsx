import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/admin/common/page-header";
import { RevenueBarChart } from "@/components/admin/dashboard/bar-chart";
import { CategoryShareChart } from "@/components/admin/dashboard/category-share";
import { TopProductsList } from "@/components/admin/dashboard/top-products";
import { methodLabel } from "@/config/labels";
import { formatCurrency, formatNumber } from "@/lib/format";
import { getReports } from "@/server/repositories/analytics";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage() {
  const r = await getReports();
  const mixTotal = r.paymentMix.reduce((s, m) => s + m.amount, 0) || 1;
  const totals = [
    { label: "Revenue", value: formatCurrency(r.totals.revenue) },
    { label: "Fulfilled orders", value: formatNumber(r.totals.orders) },
    { label: "Avg. order value", value: formatCurrency(r.totals.aov) },
    { label: "Refunds", value: formatCurrency(r.totals.refunds) },
  ];

  return (
    <>
      <PageHeader title="Reports" description="Sales performance across products, categories and payment methods." />
      <section aria-label="Totals" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {totals.map((t) => (
          <Card key={t.label} className="p-5">
            <p className="text-sm font-medium text-muted">{t.label}</p>
            <p className="mt-2 font-display text-2xl font-black">{t.value}</p>
          </Card>
        ))}
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Monthly revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueBarChart data={r.monthly} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Category split</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryShareChart data={r.categoryShare} />
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Best-selling products</CardTitle>
          </CardHeader>
          <CardContent>
            <TopProductsList products={r.topProducts} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Payment methods</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-4">
              {r.paymentMix.map((m) => (
                <li key={m.method}>
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold">{methodLabel(m.method)}</span>
                    <span className="text-muted">
                      {formatCurrency(m.amount)} · {Math.round((m.amount / mixTotal) * 100)}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-raised">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${(m.amount / mixTotal) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
