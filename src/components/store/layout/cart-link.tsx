"use client";

import * as React from "react";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { useCart } from "@/components/store/cart/cart-store";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Header cart pill. The count updates instantly from the shared cart store. */
export function CartLink() {
  const { count, approxSubtotal } = useCart();
  // Pop the cart when something is added (React's "adjust state while rendering" pattern, no effect needed).
  const [prev, setPrev] = React.useState(count);
  const [bump, setBump] = React.useState(0);
  if (count !== prev) {
    setPrev(count);
    if (count > prev) setBump((b) => b + 1);
  }
  return (
    <Link
      href="/cart"
      aria-label={`Cart, ${count} ${count === 1 ? "item" : "items"}`}
      className="flex items-center gap-2 rounded-pill bg-accent-soft px-3 py-2.5 text-sm font-bold text-accent transition-colors hover:bg-banner focus-visible:outline-2 focus-visible:outline-accent sm:px-4"
    >
      <span key={bump} className={cn("relative", bump > 0 && "bump")}>
        <ShoppingCart className="size-[18px]" aria-hidden />
        {count > 0 && (
          <span className="absolute -right-2 -top-2 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-4 text-white sm:hidden">
            {count}
          </span>
        )}
      </span>
      <span className="hidden sm:inline" suppressHydrationWarning>
        {formatCurrency(approxSubtotal)} ({count} {count === 1 ? "item" : "items"})
      </span>
    </Link>
  );
}
