import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/** Five stars filled to the nearest half, plus the numeric value (as in the Figma cards). */
export function Rating({ value, count, className }: { value: number; count?: number; className?: string }) {
  const rounded = Math.round(value * 2) / 2;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-semibold", className)} role="img" aria-label={`Rated ${value.toFixed(1)} out of 5${count ? ` from ${count} reviews` : ""}`}>
      <span className="flex gap-0.5" aria-hidden>
        {[1, 2, 3, 4, 5].map((i) => (
          <Star key={i} className={cn("size-3.5", i <= rounded ? "fill-accent text-accent" : i - 0.5 === rounded ? "fill-accent/50 text-accent" : "fill-transparent text-muted/50")} />
        ))}
      </span>
      <span aria-hidden>{value % 1 === 0 ? value : value.toFixed(1)}</span>
      {count ? <span className="font-normal text-muted" aria-hidden>({count})</span> : null}
    </span>
  );
}
