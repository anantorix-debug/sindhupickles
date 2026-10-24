import { formatCurrency } from "@/lib/format";
import type { CategoryShare } from "@/types";

// Theme tokens, assigned to categories in order of revenue.
const palette = ["var(--primary)", "var(--accent)", "var(--info)", "var(--success)", "var(--warning)", "var(--danger)"];

/** Donut + legend showing revenue split by product category. */
export function CategoryShareChart({ data }: { data: CategoryShare[] }) {
  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-muted">No sales yet.</p>;
  }
  const total = data.reduce((s, d) => s + d.revenue, 0) || 1;
  const r = 52;
  const c = 2 * Math.PI * r;
  const lengths = data.map((d) => (d.revenue / total) * c);
  const offsets = lengths.map((_, i) => lengths.slice(0, i).reduce((s, l) => s + l, 0));
  const color = (i: number) => palette[i % palette.length];

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row">
      <svg viewBox="0 0 140 140" role="img" aria-label="Revenue share by category" className="size-36 shrink-0 -rotate-90">
        <circle cx="70" cy="70" r={r} fill="none" stroke="var(--surface-raised)" strokeWidth="18" />
        {data.map((d, i) => (
          <circle
            key={d.category}
            cx="70"
            cy="70"
            r={r}
            fill="none"
            stroke={color(i)}
            strokeWidth="18"
            strokeDasharray={`${Math.max(lengths[i] - 2, 0)} ${c}`}
            strokeDashoffset={-offsets[i]}
          />
        ))}
      </svg>
      <ul className="w-full space-y-2.5 text-sm">
        {data.map((d, i) => (
          <li key={d.category} className="flex items-center gap-2">
            <span aria-hidden className="size-2.5 rounded-full" style={{ background: color(i) }} />
            <span className="flex-1">{d.category}</span>
            <span className="text-muted">{formatCurrency(d.revenue)}</span>
            <span className="w-10 text-right font-semibold">{Math.round((d.revenue / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
