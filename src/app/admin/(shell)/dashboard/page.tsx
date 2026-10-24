import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { PageHeader } from "@/components/admin/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/admin/dashboard/kpi-card";
import { RevenueBarChart } from "@/components/admin/dashboard/bar-chart";
import { CategoryShareChart } from "@/components/admin/dashboard/category-share";
import { TopProductsList } from "@/components/admin/dashboard/top-products";
import { ActivityFeed } from "@/components/admin/dashboard/activity-feed";
import { RecentOrdersTable } from "@/components/admin/dashboard/recent-orders";
import { getDashboard } from "@/server/repositories/analytics";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const data = await getDashboard();

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="A quick look at how the store is doing."
        actions={
          <Button asChild>
            <Link href="/admin/products/new">
              <Plus className="size-4" aria-hidden /> Add product
            </Link>
          </Button>
        }
      />

      <section aria-label="Key metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {data.kpis.map((k) => (
          <KpiCard key={k.key} kpi={k} />
        ))}
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Revenue · last 14 days</CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueBarChart data={data.revenueSeries} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Sales by category</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryShareChart data={data.categoryShare} />
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Recent orders</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin/orders">
                View all <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <RecentOrdersTable orders={data.recentOrders} />
          </CardContent>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Top products</CardTitle>
            </CardHeader>
            <CardContent>
              <TopProductsList products={data.topProducts} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Recent activity</CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityFeed items={data.activity} />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
