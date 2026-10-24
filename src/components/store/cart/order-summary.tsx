import { Truck } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import type { CartTotals } from "@/types/store";

export function OrderTotals({ totals }: { totals: CartTotals }) {
  const rows: [string, string, string?][] = [
    ["Subtotal", formatCurrency(totals.subtotal)],
    ...(totals.discount > 0 ? ([[`Discount${totals.couponCode ? ` (${totals.couponCode})` : ""}`, `− ${formatCurrency(totals.discount)}`, "text-success"]] as [string, string, string][]) : []),
    ["Shipping", totals.shipping > 0 ? formatCurrency(totals.shipping) : "Free"],
  ];
  return (
    <div className="space-y-3 text-sm">
      <dl className="space-y-2.5">
        {rows.map(([label, value, tone]) => (
          <div key={label} className="flex justify-between gap-4">
            <dt className="text-muted">{label}</dt>
            <dd className={tone ?? "font-medium"}>{value}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-4 border-t border-border pt-3 text-base font-bold">
          <dt>Total</dt>
          <dd className="text-accent">{formatCurrency(totals.total)}</dd>
        </div>
      </dl>
      {totals.amountToFreeShipping > 0 && totals.subtotal > 0 && (
        <p className="flex items-start gap-2 rounded-md bg-accent-soft px-3 py-2 text-xs text-accent">
          <Truck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Add {formatCurrency(totals.amountToFreeShipping)} more for free delivery.
        </p>
      )}
    </div>
  );
}
