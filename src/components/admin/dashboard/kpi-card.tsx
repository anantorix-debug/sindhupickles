import { ArrowDownRight, ArrowUpRight, CreditCard, IndianRupee, ShoppingBag, Users, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatCurrency, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DashboardKpi } from "@/types";

const icons: Record<DashboardKpi["key"], LucideIcon> = {
  revenue: IndianRupee,
  orders: ShoppingBag,
  customers: Users,
  aov: CreditCard,
};

export function KpiCard({ kpi }: { kpi: DashboardKpi }) {
  const Icon = icons[kpi.key];
  const change = kpi.changePct;
  const up = (change ?? 0) >= 0;
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-muted">{kpi.label}</p>
        <span className="flex size-10 items-center justify-center rounded-full bg-accent-soft text-accent">
          <Icon className="size-5" aria-hidden />
        </span>
      </div>
      <p className="mt-3 font-display text-3xl font-black">
        {kpi.format === "currency" ? formatCurrency(kpi.value) : formatNumber(kpi.value)}
      </p>
      {change === null ? (
        <p className="mt-2 text-xs text-muted">No earlier period to compare</p>
      ) : (
        <p className={cn("mt-2 flex items-center gap-1 text-xs font-semibold", up ? "text-success" : "text-danger")}>
          {up ? <ArrowUpRight className="size-3.5" aria-hidden /> : <ArrowDownRight className="size-3.5" aria-hidden />}
          {Math.abs(change)}%<span className="font-normal text-muted"> vs previous 30 days</span>
        </p>
      )}
    </Card>
  );
}
