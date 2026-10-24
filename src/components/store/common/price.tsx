import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

export function Price({ price, compareAt, size = "md", className }: { price: number; compareAt?: number | null; size?: "md" | "lg"; className?: string }) {
  return (
    <p className={cn("flex items-baseline gap-2", className)}>
      <span className={cn("font-bold text-foreground", size === "lg" ? "text-3xl" : "text-lg")}>{formatCurrency(price)}</span>
      {compareAt ? (
        <>
          <s className={cn("text-muted", size === "lg" ? "text-base" : "text-sm")}>
            <span className="sr-only">Original price </span>
            {formatCurrency(compareAt)}
          </s>
        </>
      ) : null}
    </p>
  );
}
