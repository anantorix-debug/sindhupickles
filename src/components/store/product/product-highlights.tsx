import { Droplets, Leaf, ShieldCheck, Truck } from "lucide-react";

/** The shop's promises (same wording as the home page), shown under the product photos. */
const POINTS = [
  { Icon: Leaf, title: "100% homemade", text: "Small batches, no artificial flavours or colours" },
  { Icon: Droplets, title: "Pure gingelly oil", text: "Cold-pressed oil, absolutely no palm oil" },
  { Icon: ShieldCheck, title: "No preservatives", text: "Preserved naturally with oil and spices" },
  { Icon: Truck, title: "Delivered across India", text: "Sealed jars, tracked with ST Courier" },
];

export function ProductHighlights() {
  return (
    <section aria-labelledby="highlights-title" className="rounded-lg border border-border bg-surface p-5">
      <h2 id="highlights-title" className="mb-4 font-display text-lg font-bold">Why you&apos;ll love it</h2>
      <ul className="grid gap-4 sm:grid-cols-2">
        {POINTS.map(({ Icon, title, text }) => (
          <li key={title} className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
              <Icon className="size-5" aria-hidden />
            </span>
            <span>
              <span className="block text-sm font-bold">{title}</span>
              <span className="block text-xs text-muted">{text}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
