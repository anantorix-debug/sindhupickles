import { formatCompactCurrency, formatCurrency } from "@/lib/format";
import type { RevenuePoint } from "@/types";

/** Dependency-free SVG bar chart; renders on the server, no client JS. */
export function RevenueBarChart({ data, height = 220 }: { data: RevenuePoint[]; height?: number }) {
  const W = 640;
  const pad = { t: 12, r: 8, b: 28, l: 44 };
  const max = Math.max(...data.map((d) => d.revenue), 1);
  const niceMax = Math.ceil(max / 10000) * 10000 || 1;
  const innerW = W - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const step = innerW / data.length;
  const barW = Math.min(28, step * 0.6);
  const ticks = [0, 0.5, 1].map((f) => niceMax * f);

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${height}`} role="img" aria-label="Revenue by period" className="h-auto w-full">
        {ticks.map((t) => {
          const y = pad.t + innerH - (t / niceMax) * innerH;
          return (
            <g key={t}>
              <line x1={pad.l} x2={W - pad.r} y1={y} y2={y} stroke="var(--border)" strokeDasharray={t === 0 ? undefined : "3 4"} />
              <text x={pad.l - 8} y={y + 4} textAnchor="end" fontSize="11" fill="var(--muted)">
                {formatCompactCurrency(t)}
              </text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const h = (d.revenue / niceMax) * innerH;
          const x = pad.l + i * step + (step - barW) / 2;
          return (
            <g key={d.label}>
              <rect x={x} y={pad.t + innerH - h} width={barW} height={h} rx="4" fill="var(--primary)">
                <title>{`${d.label}: ${formatCurrency(d.revenue)} · ${d.orders} orders`}</title>
              </rect>
              {(data.length <= 8 || i % 2 === 0) && (
                <text x={x + barW / 2} y={height - 8} textAnchor="middle" fontSize="11" fill="var(--muted)">
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <figcaption className="sr-only">
        {data.map((d) => `${d.label}: ${formatCurrency(d.revenue)}`).join(", ")}
      </figcaption>
    </figure>
  );
}
