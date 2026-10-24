import { formatCurrency } from "@/lib/format";
import type { TopProduct } from "@/types";

export function TopProductsList({ products }: { products: TopProduct[] }) {
  const max = Math.max(...products.map((p) => p.revenue), 1);
  return (
    <ol className="space-y-4">
      {products.map((p, i) => (
        <li key={p.productId}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate font-semibold">
              <span className="mr-2 text-muted">{i + 1}.</span>
              {p.name}
            </span>
            <span className="shrink-0 text-muted">
              {p.unitsSold} sold · <span className="font-semibold text-foreground">{formatCurrency(p.revenue)}</span>
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-raised">
            <div className="h-full rounded-full bg-primary" style={{ width: `${(p.revenue / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ol>
  );
}
